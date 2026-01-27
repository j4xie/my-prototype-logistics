"""
Intent Classifier Service

Provides intent classification using a fine-tuned BERT-based classifier.
Outputs softmax probabilities for 143+ food industry intent categories.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional, List, Dict, Any
from functools import lru_cache

import torch
import torch.nn.functional as F

logger = logging.getLogger(__name__)


class IntentClassifierService:
    """
    Intent classification service using fine-tuned transformer model.

    Features:
    - Direct softmax classification (no similarity threshold issues)
    - TopK results with confidence scores
    - Hard negative aware training for confusing intent pairs
    - Efficient batch inference
    """

    # Default model path (relative to this file)
    DEFAULT_MODEL_PATH = Path(__file__).parent.parent.parent.parent.parent / "scripts" / "finetune" / "models" / "gte-base-zh-finetuned-classifier" / "final"

    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize the classifier service.

        Args:
            model_path: Path to the fine-tuned model directory.
                       If None, uses the default model path.
        """
        self.model_path = Path(model_path) if model_path else self.DEFAULT_MODEL_PATH
        self.model = None
        self.tokenizer = None
        self.label_mapping: Dict[int, str] = {}
        self.intent_to_id: Dict[str, int] = {}
        self.num_labels = 0
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._initialized = False

        # Try to initialize on startup
        self._lazy_init()

    def _lazy_init(self) -> bool:
        """Lazy initialization of model and tokenizer."""
        if self._initialized:
            return True

        if not self.model_path.exists():
            logger.warning(f"Model path does not exist: {self.model_path}")
            logger.warning("Classifier service will operate in fallback mode")
            return False

        try:
            from transformers import AutoTokenizer, AutoModelForSequenceClassification

            logger.info(f"Loading classifier model from: {self.model_path}")

            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(str(self.model_path))

            # Load model
            self.model = AutoModelForSequenceClassification.from_pretrained(
                str(self.model_path)
            )
            self.model.to(self.device)
            self.model.eval()

            # Load label mapping
            label_mapping_path = self.model_path / "label_mapping.json"
            if label_mapping_path.exists():
                with open(label_mapping_path, 'r', encoding='utf-8') as f:
                    mapping_data = json.load(f)
                    self.label_mapping = {int(k): v for k, v in mapping_data.get("id_to_label", {}).items()}
                    self.intent_to_id = mapping_data.get("label_to_id", {})
                    self.num_labels = mapping_data.get("num_labels", len(self.label_mapping))
            else:
                # Fallback: get num_labels from model config
                self.num_labels = self.model.config.num_labels
                logger.warning("Label mapping file not found, using model config")

            self._initialized = True
            logger.info(f"Classifier initialized successfully: {self.num_labels} labels, device={self.device}")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize classifier: {e}", exc_info=True)
            return False

    def is_available(self) -> bool:
        """Check if the classifier is ready for inference."""
        return self._initialized and self.model is not None

    def classify(
        self,
        text: str,
        top_k: int = 5,
        threshold: float = 0.0
    ) -> Dict[str, Any]:
        """
        Classify a single text input.

        Args:
            text: User input text to classify
            top_k: Number of top predictions to return
            threshold: Minimum confidence threshold (0.0-1.0)

        Returns:
            Dict with classification results:
            {
                "success": bool,
                "predictions": [
                    {"intent": "INTENT_CODE", "confidence": 0.85, "rank": 1},
                    ...
                ],
                "top_intent": "INTENT_CODE",
                "top_confidence": 0.85,
                "error": None | str
            }
        """
        if not self.is_available():
            if not self._lazy_init():
                return {
                    "success": False,
                    "predictions": [],
                    "top_intent": None,
                    "top_confidence": 0.0,
                    "error": "Classifier not initialized"
                }

        try:
            # Tokenize
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=128,
                padding=True
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            # Inference
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = F.softmax(logits, dim=-1).squeeze()

            # Get top-k predictions
            if probs.dim() == 0:
                probs = probs.unsqueeze(0)

            top_values, top_indices = torch.topk(probs, min(top_k, len(probs)))

            predictions = []
            for rank, (idx, conf) in enumerate(zip(top_indices.tolist(), top_values.tolist()), 1):
                if conf >= threshold:
                    intent_code = self.label_mapping.get(idx, f"UNKNOWN_{idx}")
                    predictions.append({
                        "intent": intent_code,
                        "confidence": round(conf, 4),
                        "rank": rank
                    })

            top_pred = predictions[0] if predictions else {"intent": None, "confidence": 0.0}

            return {
                "success": True,
                "predictions": predictions,
                "top_intent": top_pred.get("intent"),
                "top_confidence": top_pred.get("confidence", 0.0),
                "error": None
            }

        except Exception as e:
            logger.error(f"Classification error: {e}", exc_info=True)
            return {
                "success": False,
                "predictions": [],
                "top_intent": None,
                "top_confidence": 0.0,
                "error": str(e)
            }

    def classify_batch(
        self,
        texts: List[str],
        top_k: int = 5,
        threshold: float = 0.0
    ) -> Dict[str, Any]:
        """
        Classify multiple texts in a batch.

        Args:
            texts: List of user input texts
            top_k: Number of top predictions per text
            threshold: Minimum confidence threshold

        Returns:
            Dict with batch results:
            {
                "success": bool,
                "results": [
                    {"text": "...", "predictions": [...], "top_intent": "...", "top_confidence": 0.85},
                    ...
                ],
                "total": int,
                "success_count": int,
                "error": None | str
            }
        """
        if not self.is_available():
            if not self._lazy_init():
                return {
                    "success": False,
                    "results": [],
                    "total": len(texts),
                    "success_count": 0,
                    "error": "Classifier not initialized"
                }

        try:
            # Tokenize batch
            inputs = self.tokenizer(
                texts,
                return_tensors="pt",
                truncation=True,
                max_length=128,
                padding=True
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            # Inference
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = F.softmax(logits, dim=-1)

            results = []
            success_count = 0

            for i, (text, prob_row) in enumerate(zip(texts, probs)):
                top_values, top_indices = torch.topk(prob_row, min(top_k, len(prob_row)))

                predictions = []
                for rank, (idx, conf) in enumerate(zip(top_indices.tolist(), top_values.tolist()), 1):
                    if conf >= threshold:
                        intent_code = self.label_mapping.get(idx, f"UNKNOWN_{idx}")
                        predictions.append({
                            "intent": intent_code,
                            "confidence": round(conf, 4),
                            "rank": rank
                        })

                top_pred = predictions[0] if predictions else {"intent": None, "confidence": 0.0}

                results.append({
                    "text": text,
                    "predictions": predictions,
                    "top_intent": top_pred.get("intent"),
                    "top_confidence": top_pred.get("confidence", 0.0)
                })
                success_count += 1

            return {
                "success": True,
                "results": results,
                "total": len(texts),
                "success_count": success_count,
                "error": None
            }

        except Exception as e:
            logger.error(f"Batch classification error: {e}", exc_info=True)
            return {
                "success": False,
                "results": [],
                "total": len(texts),
                "success_count": 0,
                "error": str(e)
            }

    def get_confidence_for_intent(
        self,
        text: str,
        intent_code: str
    ) -> Dict[str, Any]:
        """
        Get the confidence score for a specific intent.

        Args:
            text: User input text
            intent_code: The intent code to check

        Returns:
            Dict with confidence for the specific intent
        """
        if not self.is_available():
            if not self._lazy_init():
                return {
                    "success": False,
                    "intent": intent_code,
                    "confidence": 0.0,
                    "error": "Classifier not initialized"
                }

        try:
            intent_id = self.intent_to_id.get(intent_code)
            if intent_id is None:
                return {
                    "success": False,
                    "intent": intent_code,
                    "confidence": 0.0,
                    "error": f"Unknown intent code: {intent_code}"
                }

            # Tokenize
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=128,
                padding=True
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            # Inference
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = F.softmax(logits, dim=-1).squeeze()

            confidence = probs[intent_id].item()

            return {
                "success": True,
                "intent": intent_code,
                "confidence": round(confidence, 4),
                "error": None
            }

        except Exception as e:
            logger.error(f"Confidence check error: {e}", exc_info=True)
            return {
                "success": False,
                "intent": intent_code,
                "confidence": 0.0,
                "error": str(e)
            }

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model."""
        return {
            "available": self.is_available(),
            "model_path": str(self.model_path),
            "num_labels": self.num_labels,
            "device": str(self.device),
            "labels": list(self.label_mapping.values()) if self.label_mapping else []
        }


# Singleton instance for the service
_classifier_instance: Optional[IntentClassifierService] = None


def get_classifier_service() -> IntentClassifierService:
    """Get or create the singleton classifier service."""
    global _classifier_instance
    if _classifier_instance is None:
        # Check for custom model path from environment
        model_path = os.environ.get("INTENT_CLASSIFIER_MODEL_PATH")
        _classifier_instance = IntentClassifierService(model_path)
    return _classifier_instance
