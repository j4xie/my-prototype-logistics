"""
Data Services Module

This module provides data processing, transformation, and export services:
- cleaner: Data cleaning with LLM-assisted issue detection
- transformer: Convert raw data to long table format
- exporter: Multi-format export (JSON, Markdown, CSV)
- feature_analyzer: Column data type and feature detection
- export_validator: Quality assurance for exports
- context_extractor: Extract contextual information (notes, metadata)
"""

# From cleaner (data_cleaner.py)
from .cleaner import (
    CleaningIssue,
    CleaningResult,
    DataCleaner,
    clean_data,
)

# From transformer (data_transformer.py)
from .transformer import (
    ColumnDefinition,
    Metadata,
    LongTableRow,
    TransformResult,
    DataTransformer,
    transform_to_long_table,
)

# From exporter (data_exporter.py)
from .exporter import (
    ColumnDef,
    StructuredData,
    HeaderFlattener,
    DataExporter,
    SheetExportResult,
    BatchExportResult,
    BatchExporter,
    export_excel_to_json,
    export_excel_to_markdown,
    export_excel_to_csv,
)

# From feature_analyzer (data_feature_analyzer.py)
from .feature_analyzer import (
    DataType,
    NumericSubType,
    DataFeatureResult,
    DataFeatureAnalyzer,
    TIME_PATTERNS,
    is_time_pattern,
    count_time_pattern_headers,
)

# From export_validator (export_validator.py)
from .export_validator import (
    ValidationIssue,
    ValidationResult,
    BatchValidationResult,
    ExportValidator,
    SimpleLLMClient,
    ExportFixer,
    export_with_validation_and_fix,
    export_with_validation,
    batch_export_with_validation,
)

# From context_extractor (context_extractor.py)
from .context_extractor import (
    ContextInfo,
    ContextExtractor,
)

__all__ = [
    # cleaner
    "CleaningIssue",
    "CleaningResult",
    "DataCleaner",
    "clean_data",
    # transformer
    "ColumnDefinition",
    "Metadata",
    "LongTableRow",
    "TransformResult",
    "DataTransformer",
    "transform_to_long_table",
    # exporter
    "ColumnDef",
    "StructuredData",
    "HeaderFlattener",
    "DataExporter",
    "SheetExportResult",
    "BatchExportResult",
    "BatchExporter",
    "export_excel_to_json",
    "export_excel_to_markdown",
    "export_excel_to_csv",
    # feature_analyzer
    "DataType",
    "NumericSubType",
    "DataFeatureResult",
    "DataFeatureAnalyzer",
    "TIME_PATTERNS",
    "is_time_pattern",
    "count_time_pattern_headers",
    # export_validator
    "ValidationIssue",
    "ValidationResult",
    "BatchValidationResult",
    "ExportValidator",
    "SimpleLLMClient",
    "ExportFixer",
    "export_with_validation_and_fix",
    "export_with_validation",
    "batch_export_with_validation",
    # context_extractor
    "ContextInfo",
    "ContextExtractor",
]
