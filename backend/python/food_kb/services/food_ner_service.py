"""
食品领域命名实体识别(NER)服务
Food Domain Named Entity Recognition Service.

Supports 13 entity types with BIO tagging:
  ADDITIVE, STANDARD, EQUIPMENT, PROCESS_PARAM, INGREDIENT,
  MICROBE, HAZARD, TEST_METHOD, PRODUCT, CERT,
  REGULATION, NUTRIENT, ORG

Dual-mode: Model-based (RoBERTa) + Dictionary-based (regex + entity dict)
"""

import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple

logger = logging.getLogger(__name__)


# ============================================================
# Entity Types
# ============================================================

ENTITY_TYPES = [
    "ADDITIVE",       # 食品添加剂: 山梨酸钾, 柠檬酸, 卡拉胶
    "STANDARD",       # 标准号: GB 2760, GB 14881-2013
    "EQUIPMENT",      # 设备: 杀菌釜, 均质机, 冷冻干燥机
    "PROCESS_PARAM",  # 工艺参数: 121°C/15min, pH 4.6, Aw 0.85
    "INGREDIENT",     # 原料: 全脂奶粉, 转化糖浆, 棕榈油
    "MICROBE",        # 微生物: 沙门氏菌, 大肠杆菌O157:H7
    "HAZARD",         # 危害物: 黄曲霉毒素B1, 丙烯酰胺
    "TEST_METHOD",    # 检测方法: 平板计数法, ELISA法
    "PRODUCT",        # 产品: 调制乳, 发酵面制品, 速冻水饺
    "CERT",           # 认证: HACCP, ISO 22000, BRC
    "REGULATION",     # 法规: 食品安全法第34条
    "NUTRIENT",       # 营养成分: 蛋白质, 膳食纤维, 维生素D
    "ORG",            # 机构: 市场监管总局, FDA, CFSA
]

# BIO labels
BIO_LABELS = ["O"] + [f"{prefix}-{et}" for et in ENTITY_TYPES for prefix in ("B", "I")]


@dataclass
class Entity:
    """A recognized named entity."""
    text: str
    entity_type: str
    start: int
    end: int
    confidence: float = 1.0
    source: str = "dict"  # "dict" or "model"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "type": self.entity_type,
            "start": self.start,
            "end": self.end,
            "confidence": round(self.confidence, 3),
            "source": self.source,
            "metadata": self.metadata,
        }


# ============================================================
# Regex patterns for dictionary-based NER
# ============================================================

# GB standard number pattern: GB 2760, GB/T 12345-2024, GB 4789.2-2016
_RE_STANDARD = re.compile(
    r"(?:GB(?:/T)?|NY(?:/T)?|SC(?:/T)?|SB(?:/T)?|DB\d{2}(?:/T)?)\s*\d{3,5}(?:\.\d+)?(?:-\d{4})?",
    re.IGNORECASE,
)

# Process parameter patterns: 121°C, 15min, pH 4.6, Aw 0.85, 72-85℃
_RE_PROCESS_PARAM = re.compile(
    r"(?:"
    r"\d+(?:\.\d+)?(?:\s*[-~]\s*\d+(?:\.\d+)?)?\s*[°℃]\s*C?"  # Temperature: 121°C, 72-85℃
    r"|\d+(?:\.\d+)?\s*(?:min|s|h|小时|分钟|秒)"                 # Time: 15min, 30分钟
    r"|pH\s*\d+(?:\.\d+)?"                                       # pH: pH 4.6
    r"|Aw\s*\d+(?:\.\d+)?"                                       # Water activity: Aw 0.85
    r"|\d+(?:\.\d+)?\s*(?:MPa|bar|atm|kPa)"                     # Pressure: 0.1MPa
    r"|\d+(?:\.\d+)?\s*(?:rpm|r/min|转/分)"                      # Speed: 3000rpm
    r"|\d+(?:\.\d+)?\s*(?:mg/kg|g/kg|μg/kg|mg/L|g/L)"           # Concentration: 200mg/kg
    r"|\d+(?:\.\d+)?\s*%"                                        # Percentage: 3.5%
    r")",
    re.IGNORECASE,
)

# Certification patterns
_RE_CERT = re.compile(
    r"(?:HACCP|ISO\s*22000|ISO\s*9001|BRC(?:GS)?|FSSC\s*22000|SQF|IFS|GMP|GAP|"
    r"SC认证|QS认证|有机认证|绿色食品认证)",
    re.IGNORECASE,
)

# Regulation patterns: 食品安全法第X条, 食品安全法实施条例
_RE_REGULATION = re.compile(
    r"(?:《?食品安全法》?(?:实施条例)?(?:第[一二三四五六七八九十百千]+条)?|"
    r"《?食品生产许可管理办法》?|《?食品经营许可管理办法》?|"
    r"《?食品召回管理办法》?|《?食品标识管理规定》?|"
    r"《?农产品质量安全法》?)",
)

# Organization patterns
_RE_ORG = re.compile(
    r"(?:市场监管总局|国家市场监督管理总局|FDA|CFSA|食品安全风险评估中心|"
    r"卫生健康委|农业农村部|海关总署|WHO|FAO|Codex|CAC|EFSA)",
)

# Test method patterns
_RE_TEST_METHOD = re.compile(
    r"(?:平板计数法|MPN法|ELISA法|PCR法|HPLC法?|GC-?MS|LC-?MS|"
    r"原子吸收光谱法|ICP-?MS|滴定法|比色法|荧光法|"
    r"快速检测法|免疫层析法|酶联免疫法)",
)


class FoodNERService:
    """
    Food domain NER service.

    Two modes:
    1. Dictionary-based: Regex patterns + entity dictionary from PostgreSQL
    2. Model-based: Fine-tuned RoBERTa NER model (when available)

    Dictionary mode is always available as fallback.
    """

    def __init__(self):
        self._model = None
        self._tokenizer = None
        self._onnx_session = None
        self._ner_labels = BIO_LABELS
        self._use_onnx = False
        self._model_ready = False
        self._entity_dict: Dict[str, List[Dict]] = {}  # type -> list of entities
        self._dict_ready = False

    async def load_dictionary(self, db_pool) -> bool:
        """Load entity dictionary from PostgreSQL."""
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT entity_type, entity_name, aliases, standard_ref, category, metadata
                    FROM food_entity_dictionary
                    WHERE is_active = TRUE
                    """
                )

            self._entity_dict.clear()
            for row in rows:
                et = row["entity_type"]
                if et not in self._entity_dict:
                    self._entity_dict[et] = []

                names = [row["entity_name"]]
                if row["aliases"]:
                    names.extend(row["aliases"])

                self._entity_dict[et].append({
                    "names": list(set(names)),
                    "standard_ref": row["standard_ref"],
                    "category": row["category"],
                    "metadata": row["metadata"] or {},
                })

            total = sum(len(v) for v in self._entity_dict.values())
            self._dict_ready = True
            logger.info(f"Loaded {total} entities across {len(self._entity_dict)} types from dictionary")
            return True

        except Exception as e:
            logger.error(f"Failed to load entity dictionary: {e}")
            return False

    def load_model(self, model_path: str) -> bool:
        """Load NER model (ONNX or PyTorch)."""
        import os

        # Check for ONNX model first
        onnx_path = os.path.join(model_path, "food_model.onnx")
        if os.path.exists(onnx_path):
            return self._load_onnx_model(model_path, onnx_path)

        # Fallback to PyTorch
        return self._load_pytorch_model(model_path)

    def _load_onnx_model(self, model_dir: str, onnx_path: str) -> bool:
        """Load ONNX NER model with onnxruntime."""
        try:
            import json
            import onnxruntime as ort
            from transformers import AutoTokenizer

            self._tokenizer = AutoTokenizer.from_pretrained(model_dir)

            # Load label mapping
            label_path = os.path.join(model_dir, "label_mapping.json")
            with open(label_path, "r", encoding="utf-8") as f:
                label_data = json.load(f)
            self._ner_labels = label_data.get("ner_labels", BIO_LABELS)

            # Create ONNX session
            sess_opts = ort.SessionOptions()
            sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            sess_opts.intra_op_num_threads = 4
            self._onnx_session = ort.InferenceSession(onnx_path, sess_opts)
            self._use_onnx = True

            self._model_ready = True
            logger.info(f"ONNX NER model loaded from {onnx_path} ({len(self._ner_labels)} labels)")
            return True

        except Exception as e:
            logger.warning(f"ONNX NER model load failed: {e}")
            self._model_ready = False
            return False

    def _load_pytorch_model(self, model_path: str) -> bool:
        """Load PyTorch NER model."""
        try:
            from transformers import AutoTokenizer, AutoModelForTokenClassification
            import torch

            self._tokenizer = AutoTokenizer.from_pretrained(model_path)
            self._model = AutoModelForTokenClassification.from_pretrained(model_path)
            self._model.eval()

            device = "cuda" if torch.cuda.is_available() else "cpu"
            self._model.to(device)
            self._use_onnx = False

            self._model_ready = True
            logger.info(f"PyTorch NER model loaded from {model_path} on {device}")
            return True

        except Exception as e:
            logger.warning(f"NER model not available, using dictionary mode only: {e}")
            self._model_ready = False
            return False

    def extract_entities(self, text: str, use_model: bool = True) -> List[Entity]:
        """
        Extract food domain entities from text.

        Args:
            text: Input text
            use_model: Whether to use the RoBERTa model (if available)

        Returns:
            List of Entity objects
        """
        start_time = time.time()
        entities = []

        # Phase 1: Dictionary-based extraction (always available)
        dict_entities = self._extract_by_dictionary(text)
        entities.extend(dict_entities)

        # Phase 2: Regex-based extraction
        regex_entities = self._extract_by_regex(text)
        entities.extend(regex_entities)

        # Phase 3: Model-based extraction (if available)
        if use_model and self._model_ready:
            model_entities = self._extract_by_model(text)
            entities.extend(model_entities)

        # Deduplicate: prefer model over dict, higher confidence first
        entities = self._deduplicate(entities)

        elapsed = (time.time() - start_time) * 1000
        logger.debug(f"NER extracted {len(entities)} entities from '{text[:50]}...' in {elapsed:.1f}ms")

        return entities

    def _extract_by_dictionary(self, text: str) -> List[Entity]:
        """Extract entities using dictionary lookup."""
        if not self._dict_ready:
            return []

        entities = []
        text_lower = text.lower()

        for entity_type, entries in self._entity_dict.items():
            for entry in entries:
                for name in entry["names"]:
                    name_lower = name.lower()
                    start = 0
                    while True:
                        idx = text_lower.find(name_lower, start)
                        if idx == -1:
                            break
                        entities.append(Entity(
                            text=text[idx:idx + len(name)],
                            entity_type=entity_type,
                            start=idx,
                            end=idx + len(name),
                            confidence=0.95,
                            source="dict",
                            metadata={
                                "standard_ref": entry.get("standard_ref", ""),
                                "category": entry.get("category", ""),
                            },
                        ))
                        start = idx + len(name)

        return entities

    def _extract_by_regex(self, text: str) -> List[Entity]:
        """Extract entities using regex patterns."""
        entities = []

        # Standard numbers
        for match in _RE_STANDARD.finditer(text):
            entities.append(Entity(
                text=match.group(),
                entity_type="STANDARD",
                start=match.start(),
                end=match.end(),
                confidence=0.90,
                source="regex",
            ))

        # Process parameters
        for match in _RE_PROCESS_PARAM.finditer(text):
            entities.append(Entity(
                text=match.group(),
                entity_type="PROCESS_PARAM",
                start=match.start(),
                end=match.end(),
                confidence=0.85,
                source="regex",
            ))

        # Certifications
        for match in _RE_CERT.finditer(text):
            entities.append(Entity(
                text=match.group(),
                entity_type="CERT",
                start=match.start(),
                end=match.end(),
                confidence=0.90,
                source="regex",
            ))

        # Regulations
        for match in _RE_REGULATION.finditer(text):
            entities.append(Entity(
                text=match.group(),
                entity_type="REGULATION",
                start=match.start(),
                end=match.end(),
                confidence=0.88,
                source="regex",
            ))

        # Organizations
        for match in _RE_ORG.finditer(text):
            entities.append(Entity(
                text=match.group(),
                entity_type="ORG",
                start=match.start(),
                end=match.end(),
                confidence=0.90,
                source="regex",
            ))

        # Test methods
        for match in _RE_TEST_METHOD.finditer(text):
            entities.append(Entity(
                text=match.group(),
                entity_type="TEST_METHOD",
                start=match.start(),
                end=match.end(),
                confidence=0.88,
                source="regex",
            ))

        return entities

    def _extract_by_model(self, text: str) -> List[Entity]:
        """Extract entities using NER model (ONNX or PyTorch)."""
        if not self._model_ready:
            return []

        try:
            if getattr(self, '_use_onnx', False):
                return self._extract_by_onnx(text)
            else:
                return self._extract_by_pytorch(text)
        except Exception as e:
            logger.error(f"Model NER failed: {e}")
            return []

    def _extract_by_onnx(self, text: str) -> List[Entity]:
        """Extract entities using ONNX model."""
        import numpy as np

        inputs = self._tokenizer(
            text,
            max_length=128,
            truncation=True,
            return_offsets_mapping=True,
            return_tensors="np",
        )

        offset_mapping = inputs.pop("offset_mapping")[0].tolist()

        ort_inputs = {
            "input_ids": inputs["input_ids"].astype(np.int64),
            "attention_mask": inputs["attention_mask"].astype(np.int64),
            "token_type_ids": inputs["token_type_ids"].astype(np.int64),
        }

        outputs = self._onnx_session.run(None, ort_inputs)
        # outputs[0] = ner_logits, outputs[1] = intent_logits (ignored here)
        ner_logits = outputs[0][0]  # shape: (seq_len, num_ner_labels)

        # Softmax for confidence
        exp_logits = np.exp(ner_logits - np.max(ner_logits, axis=-1, keepdims=True))
        probs = exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)

        predictions = np.argmax(ner_logits, axis=-1).tolist()

        labels = getattr(self, '_ner_labels', BIO_LABELS)
        return self._decode_bio(text, predictions, probs, offset_mapping, labels)

    def _extract_by_pytorch(self, text: str) -> List[Entity]:
        """Extract entities using PyTorch model."""
        import torch

        inputs = self._tokenizer(
            text,
            return_tensors="pt",
            max_length=128,
            truncation=True,
            return_offsets_mapping=True,
        )

        offset_mapping = inputs.pop("offset_mapping")[0].tolist()

        device = next(self._model.parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self._model(**inputs)
            predictions = torch.argmax(outputs.logits, dim=-1)[0].cpu().tolist()
            confidences = torch.softmax(outputs.logits, dim=-1)[0].cpu().numpy()

        return self._decode_bio(text, predictions, confidences, offset_mapping, BIO_LABELS)

    def _decode_bio(self, text: str, predictions: list, confidences, offset_mapping: list, labels: list) -> List[Entity]:
        """Decode BIO predictions into Entity objects."""
        entities = []
        current_entity = None

        for idx, (pred_id, (start, end)) in enumerate(zip(predictions, offset_mapping)):
            if start == end:  # Special token
                continue

            label = labels[pred_id] if pred_id < len(labels) else "O"
            conf = float(confidences[idx][pred_id])

            if label.startswith("B-"):
                if current_entity:
                    entities.append(current_entity)
                entity_type = label[2:]
                current_entity = Entity(
                    text=text[start:end],
                    entity_type=entity_type,
                    start=start,
                    end=end,
                    confidence=conf,
                    source="model",
                )
            elif label.startswith("I-") and current_entity:
                expected_type = label[2:]
                if expected_type == current_entity.entity_type:
                    current_entity.text = text[current_entity.start:end]
                    current_entity.end = end
                    current_entity.confidence = min(current_entity.confidence, conf)
                else:
                    entities.append(current_entity)
                    current_entity = None
            else:
                if current_entity:
                    entities.append(current_entity)
                    current_entity = None

        if current_entity:
            entities.append(current_entity)

        return entities

    def _deduplicate(self, entities: List[Entity]) -> List[Entity]:
        """Remove duplicate/overlapping entities, preferring higher confidence."""
        if not entities:
            return []

        # Sort by confidence (desc), then by span length (desc)
        entities.sort(key=lambda e: (-e.confidence, -(e.end - e.start)))

        result = []
        occupied = set()

        for entity in entities:
            span = set(range(entity.start, entity.end))
            if not span.intersection(occupied):
                result.append(entity)
                occupied.update(span)

        # Sort by position
        result.sort(key=lambda e: e.start)
        return result

    def get_info(self) -> Dict[str, Any]:
        """Get service status info."""
        return {
            "model_available": self._model_ready,
            "dictionary_available": self._dict_ready,
            "entity_types": ENTITY_TYPES,
            "bio_labels_count": len(BIO_LABELS),
            "dictionary_stats": {
                et: len(entries) for et, entries in self._entity_dict.items()
            } if self._dict_ready else {},
        }


# Global singleton
_ner_instance: Optional[FoodNERService] = None


def get_food_ner_service() -> FoodNERService:
    global _ner_instance
    if _ner_instance is None:
        _ner_instance = FoodNERService()
    return _ner_instance
