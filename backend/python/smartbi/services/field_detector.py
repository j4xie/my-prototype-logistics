"""
Field Detector - Compatibility Layer

This module re-exports from field_detector_llm for backward compatibility.
The actual implementation has been moved to field_detector_llm.py.

Old implementation archived at: archive/field_detector_v1.py
"""
from services.field_detector_llm import (
    LLMFieldDetector,
    FieldDetectionResult,
    FieldDetectionCache,
    FieldCacheEntry,
    get_field_detector,
    detect_fields
)

# Compatibility aliases for old code that imports these
FieldDetector = LLMFieldDetector


# Re-export common type aliases for backward compatibility
class DataType:
    """Compatibility wrapper - use field_detector_llm.FieldDetectionResult.data_type instead"""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    UNKNOWN = "unknown"


class SemanticType:
    """Compatibility wrapper - use field_detector_llm.FieldDetectionResult.semantic_type instead"""
    AMOUNT = "amount"
    QUANTITY = "quantity"
    PERCENTAGE = "percentage"
    DATE = "date"
    CATEGORY = "category"
    GEOGRAPHY = "geography"
    PRODUCT = "product"
    CUSTOMER = "customer"
    ID = "id"
    NAME = "name"
    TEXT = "text"
    UNKNOWN = "unknown"


class ChartRole:
    """Compatibility wrapper - use field_detector_llm.FieldDetectionResult.chart_role instead"""
    DIMENSION = "dimension"
    MEASURE = "measure"
    TIME = "time"
    SERIES = "series"
    TOOLTIP = "tooltip"


__all__ = [
    "LLMFieldDetector",
    "FieldDetector",
    "FieldDetectionResult",
    "FieldDetectionCache",
    "get_field_detector",
    "detect_fields",
    "DataType",
    "SemanticType",
    "ChartRole"
]
