"""
Field Services Module

This module contains all field-related services:
- Field detection (LLM-based and rule-based)
- Field mapping (dictionary-based)
- LLM mapper for sheet analysis and chart recommendation

All classes and functions are re-exported for backward compatibility.
"""

# From detector_llm.py (core LLM field detection)
from .detector_llm import (
    FieldDetectionResult,
    FieldCacheEntry,
    FieldDetectionCache,
    LLMFieldDetector,
    get_field_detector,
    detect_fields,
)

# From detector.py (compatibility layer with type aliases)
from .detector import (
    # Re-exported from detector_llm (also available here for convenience)
    FieldDetector,  # Alias for LLMFieldDetector
    # Type enums for compatibility
    DataType,
    SemanticType,
    ChartRole,
)

# From mapping.py (dictionary-based field mapping)
from .mapping import (
    MappingSource,
    CandidateField,
    FieldMappingResult,
    FieldMappingDictionary,
    FieldMappingService,
)

# From llm_mapper.py (sheet analysis and chart recommendation)
from .llm_mapper import (
    LLMMapper,
)

__all__ = [
    # Field detection (LLM-based)
    "FieldDetectionResult",
    "FieldCacheEntry",
    "FieldDetectionCache",
    "LLMFieldDetector",
    "FieldDetector",  # Alias for LLMFieldDetector
    "get_field_detector",
    "detect_fields",
    # Type enums
    "DataType",
    "SemanticType",
    "ChartRole",
    # Field mapping (dictionary-based)
    "MappingSource",
    "CandidateField",
    "FieldMappingResult",
    "FieldMappingDictionary",
    "FieldMappingService",
    # LLM mapper (sheet analysis)
    "LLMMapper",
]
