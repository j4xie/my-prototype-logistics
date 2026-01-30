from __future__ import annotations
"""
SmartBI Services Module

This module contains all business logic services for the SmartBI service.
Includes Zero-Code adaptive architecture components.
"""
from .excel_parser import ExcelParser, SheetInfo, DataDirection
from .field_detector import FieldDetector
from .llm_mapper import LLMMapper
from .metric_calculator import MetricCalculator
from .forecast_service import ForecastService
from .insight_generator import InsightGenerator
from .chart_builder import ChartBuilder
from .chart_recommender import (
    ChartRecommender,
    ChartRecommendation,
    DataSummary,
    ChartCategory,
    get_chart_recommender
)
from .ml_service import MLService
from .analysis import (
    FinanceAnalysisService,
    SalesAnalysisService,
    DepartmentAnalysisService,
    RegionAnalysisService
)
from .data_feature_analyzer import (
    DataFeatureAnalyzer,
    DataFeatureResult,
    DataType,
    NumericSubType
)
from .field_mapping import (
    FieldMappingService,
    FieldMappingResult,
    FieldMappingDictionary,
    MappingSource,
    CandidateField
)

# Zero-Code Architecture Services
from .structure_detector import (
    StructureDetector,
    StructureDetectionResult,
    RowInfo,
    ColumnInfo,
    MergedCellInfo
)
from .semantic_mapper import (
    SemanticMapper,
    SemanticMappingResult,
    FieldMapping,
    STANDARD_FIELDS
)
from .fixed_executor import (
    FixedExecutor,
    ExtractedData,
    DataTransformer
)
from .context_extractor import (
    ContextExtractor,
    ContextInfo
)
from .schema_cache import (
    SchemaCache,
    get_schema_cache,
    CacheEntry
)
from .data_exporter import (
    DataExporter,
    StructuredData,
    ColumnDef,
    HeaderFlattener,
    BatchExporter,
    BatchExportResult,
    SheetExportResult,
    export_excel_to_json,
    export_excel_to_markdown,
    export_excel_to_csv
)
from .smart_parser import (
    SmartExcelParser,
    RuleEngine,
    ExcelParseRule,
    HeaderRule,
    ColumnRule,
    MetadataRule,
    LLMParser,
    BUILTIN_RULES
)
from .export_validator import (
    ExportValidator,
    ExportFixer,
    ValidationResult,
    ValidationIssue,
    BatchValidationResult,
    SimpleLLMClient,
    export_with_validation,
    export_with_validation_and_fix,
    batch_export_with_validation
)
from .raw_exporter import (
    RawExporter,
    RawSheetData,
    RowInfo as RawRowInfo,
    CellInfo,
    MergedCellInfo as RawMergedCellInfo
)
from .llm_structure_analyzer import (
    LLMStructureAnalyzer,
    StructureAnalysis,
    ColumnInfo as LLMColumnInfo,
    AnalysisRecommendation,
    FullAnalysisResult,
    analyze_excel_structure
)
from .smart_analyzer import (
    SmartAnalyzer,
    SmartAnalysisOutput,
    ScenarioDetector,
    FieldMapper,
    AnalysisRecommender,
    InsightGenerator as SmartInsightGenerator,
    DataScenario,
    FieldMapping as SmartFieldMapping,
    ScenarioDetectionResult,
    AnalysisResult,
    analyze_exported_data,
    detect_scenario,
    map_fields
)
# Unified analyzer (parallel execution, comprehensive analysis)
from .unified_analyzer import (
    UnifiedAnalyzer,
    UnifiedAnalysisResult,
    AnalysisOptions,
    AnalysisDepth,
    ScenarioResult as UnifiedScenarioResult,
    MetricResult,
    ChartConfig,
    Insight,
    PredictionResult,
    FieldInfo,
    unified_analyze,
    quick_analyze
)
# Analysis persistence (chart configs, insights to PostgreSQL)
from .analysis_persistence import (
    AnalysisPersistenceService,
    get_persistence_service
)

__all__ = [
    # Core services
    "ExcelParser",
    "SheetInfo",
    "DataDirection",
    "FieldDetector",
    "LLMMapper",
    "MetricCalculator",
    "ForecastService",
    "InsightGenerator",
    "ChartBuilder",
    "ChartRecommender",
    "ChartRecommendation",
    "DataSummary",
    "ChartCategory",
    "get_chart_recommender",
    "MLService",
    # Analysis services
    "FinanceAnalysisService",
    "SalesAnalysisService",
    "DepartmentAnalysisService",
    "RegionAnalysisService",
    # Data feature analysis
    "DataFeatureAnalyzer",
    "DataFeatureResult",
    "DataType",
    "NumericSubType",
    # Field mapping
    "FieldMappingService",
    "FieldMappingResult",
    "FieldMappingDictionary",
    "MappingSource",
    "CandidateField",
    # Zero-Code Architecture
    "StructureDetector",
    "StructureDetectionResult",
    "RowInfo",
    "ColumnInfo",
    "MergedCellInfo",
    "SemanticMapper",
    "SemanticMappingResult",
    "FieldMapping",
    "STANDARD_FIELDS",
    "FixedExecutor",
    "ExtractedData",
    "DataTransformer",
    "SchemaCache",
    "get_schema_cache",
    "CacheEntry",
    # Context extraction (Three-Layer Model)
    "ContextExtractor",
    "ContextInfo",
    # Data exporter (Multi-format export)
    "DataExporter",
    "StructuredData",
    "ColumnDef",
    "HeaderFlattener",
    "BatchExporter",
    "BatchExportResult",
    "SheetExportResult",
    "export_excel_to_json",
    "export_excel_to_markdown",
    "export_excel_to_csv",
    # Smart parser (Rules + LLM)
    "SmartExcelParser",
    "RuleEngine",
    "ExcelParseRule",
    "HeaderRule",
    "ColumnRule",
    "MetadataRule",
    "LLMParser",
    "BUILTIN_RULES",
    # Export validation
    "ExportValidator",
    "ExportFixer",
    "ValidationResult",
    "ValidationIssue",
    "BatchValidationResult",
    "SimpleLLMClient",
    "export_with_validation",
    "export_with_validation_and_fix",
    "batch_export_with_validation",
    # Raw exporter (100% fidelity)
    "RawExporter",
    "RawSheetData",
    "RawRowInfo",
    "CellInfo",
    "RawMergedCellInfo",
    # LLM structure analyzer
    "LLMStructureAnalyzer",
    "StructureAnalysis",
    "LLMColumnInfo",
    "AnalysisRecommendation",
    "FullAnalysisResult",
    "analyze_excel_structure",
    # Smart analyzer
    "SmartAnalyzer",
    "SmartAnalysisOutput",
    "ScenarioDetector",
    "FieldMapper",
    "AnalysisRecommender",
    "SmartInsightGenerator",
    "DataScenario",
    "SmartFieldMapping",
    "ScenarioDetectionResult",
    "AnalysisResult",
    "analyze_exported_data",
    "detect_scenario",
    "map_fields",
    # Unified analyzer (parallel execution)
    "UnifiedAnalyzer",
    "UnifiedAnalysisResult",
    "AnalysisOptions",
    "AnalysisDepth",
    "UnifiedScenarioResult",
    "MetricResult",
    "ChartConfig",
    "Insight",
    "PredictionResult",
    "FieldInfo",
    "unified_analyze",
    "quick_analyze",
    # Analysis persistence (chart configs, insights to PostgreSQL)
    "AnalysisPersistenceService",
    "get_persistence_service"
]
