"""
Structure Services Group

This module provides Excel structure detection, analysis, and field mapping services:

- detector: Rule-based and LLM-powered structure detection
- llm_analyzer: LLM-based structure analysis with recommendations
- semantic_mapper: Field name to standard field mapping
- table_classifier: Table type classification

Usage:
    from smartbi.services.structure import StructureDetector, SemanticMapper, TableClassifier

    # Or import specific classes
    from smartbi.services.structure import (
        StructureDetectionResult,
        SemanticMappingResult,
        ClassificationResult,
    )
"""
from __future__ import annotations

# ============================================================
# From detector.py (structure_detector)
# ============================================================
from .detector import (
    RowInfo,
    ColumnInfo as StructureColumnInfo,  # Aliased to avoid conflict
    MergedCellInfo,
    StructureDetectionResult,
    StructureDetector,
)

# ============================================================
# From llm_analyzer.py (llm_structure_analyzer)
# ============================================================
from .llm_analyzer import (
    ColumnInfo as AnalyzerColumnInfo,  # Aliased to avoid conflict
    StructureAnalysis,
    AnalysisRecommendation,
    FullAnalysisResult,
    LLMStructureAnalyzer,
    analyze_excel_structure,
)

# ============================================================
# From semantic_mapper.py
# ============================================================
from .semantic_mapper import (
    # Constants
    CATEGORY_TO_DATA_TYPE,
    LEARNED_MAPPINGS_FILE,
    FIELD_REGISTRY_FILE,
    STANDARD_FIELDS,
    TABLE_TYPE_PATTERNS,
    # Classes
    FieldMappingResult,
    FieldMapping,
    SemanticMappingResult,
    SemanticMapper,
)

# ============================================================
# From table_classifier.py
# ============================================================
from .table_classifier import (
    TableType,
    ClassificationResult,
    TableClassifier,
)

# ============================================================
# Re-export original ColumnInfo from both modules
# (Users can import directly from submodule if needed)
# ============================================================
# For backward compatibility with code that imports ColumnInfo directly
# We export the detector's ColumnInfo as the default since it's more commonly used
from .detector import ColumnInfo

__all__ = [
    # detector.py
    "RowInfo",
    "ColumnInfo",
    "StructureColumnInfo",
    "MergedCellInfo",
    "StructureDetectionResult",
    "StructureDetector",
    # llm_analyzer.py
    "AnalyzerColumnInfo",
    "StructureAnalysis",
    "AnalysisRecommendation",
    "FullAnalysisResult",
    "LLMStructureAnalyzer",
    "analyze_excel_structure",
    # semantic_mapper.py
    "CATEGORY_TO_DATA_TYPE",
    "LEARNED_MAPPINGS_FILE",
    "FIELD_REGISTRY_FILE",
    "STANDARD_FIELDS",
    "TABLE_TYPE_PATTERNS",
    "FieldMappingResult",
    "FieldMapping",
    "SemanticMappingResult",
    "SemanticMapper",
    # table_classifier.py
    "TableType",
    "ClassificationResult",
    "TableClassifier",
]
