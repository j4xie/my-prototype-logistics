"""
Intent Classifier API Endpoints

Provides REST API for intent classification using a fine-tuned BERT-based model.
"""
from __future__ import annotations

import logging
from typing import List, Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class ClassifyRequest(BaseModel):
    """Single text classification request."""
    text: str = Field(..., description="User input text to classify", min_length=1)
    top_k: int = Field(default=5, ge=1, le=20, description="Number of top predictions to return")
    threshold: float = Field(default=0.0, ge=0.0, le=1.0, description="Minimum confidence threshold")


class ClassifyBatchRequest(BaseModel):
    """Batch classification request."""
    texts: List[str] = Field(..., description="List of texts to classify", min_items=1, max_items=100)
    top_k: int = Field(default=5, ge=1, le=20, description="Number of top predictions per text")
    threshold: float = Field(default=0.0, ge=0.0, le=1.0, description="Minimum confidence threshold")


class IntentConfidenceRequest(BaseModel):
    """Request to check confidence for a specific intent."""
    text: str = Field(..., description="User input text")
    intent_code: str = Field(..., description="Intent code to check")


class PredictionResult(BaseModel):
    """Single prediction result."""
    intent: str
    confidence: float
    rank: int


class ClassifyResponse(BaseModel):
    """Classification response."""
    success: bool
    predictions: List[PredictionResult] = []
    top_intent: Optional[str] = None
    top_confidence: float = 0.0
    error: Optional[str] = None


class BatchResultItem(BaseModel):
    """Single item in batch results."""
    text: str
    predictions: List[PredictionResult] = []
    top_intent: Optional[str] = None
    top_confidence: float = 0.0


class ClassifyBatchResponse(BaseModel):
    """Batch classification response."""
    success: bool
    results: List[BatchResultItem] = []
    total: int = 0
    success_count: int = 0
    error: Optional[str] = None


class IntentConfidenceResponse(BaseModel):
    """Intent confidence check response."""
    success: bool
    intent: str
    confidence: float = 0.0
    error: Optional[str] = None


class ModelInfoResponse(BaseModel):
    """Model information response."""
    available: bool
    model_path: str
    num_labels: int
    device: str
    labels: List[str] = []


# =============================================================================
# Lazy Service Initialization
# =============================================================================

_classifier_service = None


def get_classifier_service():
    """Lazy initialization of classifier service."""
    global _classifier_service
    if _classifier_service is None:
        from ..services.classifier_service import get_classifier_service as create_service
        _classifier_service = create_service()
    return _classifier_service


# =============================================================================
# API Endpoints
# =============================================================================

@router.post("/classify", response_model=ClassifyResponse)
async def classify_text(request: ClassifyRequest):
    """
    Classify a single text input.

    Returns top-k intent predictions with confidence scores.
    """
    try:
        service = get_classifier_service()
        result = service.classify(
            text=request.text,
            top_k=request.top_k,
            threshold=request.threshold
        )

        return ClassifyResponse(
            success=result["success"],
            predictions=[
                PredictionResult(**p) for p in result.get("predictions", [])
            ],
            top_intent=result.get("top_intent"),
            top_confidence=result.get("top_confidence", 0.0),
            error=result.get("error")
        )
    except Exception as e:
        logger.error(f"Classification error: {e}", exc_info=True)
        return ClassifyResponse(
            success=False,
            error=str(e)
        )


@router.post("/classify/batch", response_model=ClassifyBatchResponse)
async def classify_batch(request: ClassifyBatchRequest):
    """
    Classify multiple texts in a batch.

    More efficient than calling /classify multiple times.
    """
    try:
        service = get_classifier_service()
        result = service.classify_batch(
            texts=request.texts,
            top_k=request.top_k,
            threshold=request.threshold
        )

        return ClassifyBatchResponse(
            success=result["success"],
            results=[
                BatchResultItem(
                    text=r["text"],
                    predictions=[PredictionResult(**p) for p in r.get("predictions", [])],
                    top_intent=r.get("top_intent"),
                    top_confidence=r.get("top_confidence", 0.0)
                )
                for r in result.get("results", [])
            ],
            total=result.get("total", 0),
            success_count=result.get("success_count", 0),
            error=result.get("error")
        )
    except Exception as e:
        logger.error(f"Batch classification error: {e}", exc_info=True)
        return ClassifyBatchResponse(
            success=False,
            total=len(request.texts),
            error=str(e)
        )


@router.post("/confidence", response_model=IntentConfidenceResponse)
async def check_intent_confidence(request: IntentConfidenceRequest):
    """
    Get confidence score for a specific intent.

    Useful for checking if a text matches a particular intent.
    """
    try:
        service = get_classifier_service()
        result = service.get_confidence_for_intent(
            text=request.text,
            intent_code=request.intent_code
        )

        return IntentConfidenceResponse(
            success=result["success"],
            intent=result["intent"],
            confidence=result.get("confidence", 0.0),
            error=result.get("error")
        )
    except Exception as e:
        logger.error(f"Confidence check error: {e}", exc_info=True)
        return IntentConfidenceResponse(
            success=False,
            intent=request.intent_code,
            error=str(e)
        )


@router.get("/info", response_model=ModelInfoResponse)
async def get_model_info():
    """
    Get information about the loaded classifier model.
    """
    try:
        service = get_classifier_service()
        info = service.get_model_info()

        return ModelInfoResponse(
            available=info["available"],
            model_path=info["model_path"],
            num_labels=info["num_labels"],
            device=info["device"],
            labels=info.get("labels", [])
        )
    except Exception as e:
        logger.error(f"Model info error: {e}", exc_info=True)
        return ModelInfoResponse(
            available=False,
            model_path="",
            num_labels=0,
            device="unknown"
        )


@router.get("/health")
async def health_check():
    """
    Health check for classifier service.
    """
    try:
        service = get_classifier_service()
        available = service.is_available()

        return {
            "status": "healthy" if available else "degraded",
            "model_available": available,
            "service": "intent-classifier"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "model_available": False,
            "error": str(e)
        }
