"""
Smart Analyzer - Compatibility Layer

This module re-exports from scenario_detector for backward compatibility.
The actual implementation has been moved to scenario_detector.py.

Old implementation archived at: archive/smart_analyzer_v1.py
"""
from services.scenario_detector import (
    LLMScenarioDetector,
    ScenarioResult,
    ScenarioCache,
    get_scenario_detector,
    detect_scenario,
    detect_scenario_sync
)

# Compatibility aliases
ScenarioDetector = LLMScenarioDetector
ScenarioDetectionResult = ScenarioResult


# Legacy SmartAnalyzer class for backward compatibility
class SmartAnalyzer:
    """
    Deprecated: Use UnifiedAnalyzer for comprehensive analysis.

    This class provides backward compatibility for old code.
    """

    def __init__(self):
        self.scenario_detector = get_scenario_detector()
        self.field_mapper = FieldMapper()
        self.recommender = AnalysisRecommender()

    async def analyze(self, data, columns=None, sample_rows=None, metadata=None):
        """Legacy compatibility method."""
        # Detect scenario
        scenario = await self.scenario_detector.detect(
            columns=columns or [],
            sample_rows=sample_rows or [],
            metadata=metadata or {}
        )

        # Map fields
        field_mappings = self.field_mapper.map_fields(columns or [], sample_rows or [])

        return SmartAnalysisOutput(
            scenario=scenario,
            field_mappings=field_mappings,
            recommendations=[],
            analyses=[],
            summary=f"Scenario: {scenario.scenario_name}",
            processing_notes=["Using LLM-based detection"]
        )

    async def close(self):
        """Close resources."""
        await self.scenario_detector.close()


# Legacy InsightGenerator for backward compatibility
class InsightGenerator:
    """
    Deprecated: Use services.insight_generator.InsightGenerator instead.

    This is a compatibility stub that re-exports the real InsightGenerator.
    """

    def __init__(self):
        from services.insight_generator import InsightGenerator as RealInsightGenerator
        self._generator = RealInsightGenerator()

    async def generate_insights(self, *args, **kwargs):
        """Delegate to real generator."""
        return await self._generator.generate_insights(*args, **kwargs)


# Legacy functions for backward compatibility
async def analyze_exported_data(data, columns=None, sample_rows=None, metadata=None):
    """
    Deprecated: Use unified_analyzer.unified_analyze() instead.

    Legacy function for analyzing exported data.
    """
    analyzer = SmartAnalyzer()
    try:
        return await analyzer.analyze(data, columns, sample_rows, metadata)
    finally:
        await analyzer.close()


def map_fields(columns, sample_rows=None):
    """
    Deprecated: Use field_detector_llm.detect_fields() instead.

    Legacy function for field mapping.
    """
    mapper = FieldMapper()
    return mapper.map_fields(columns, sample_rows or [])


# Legacy DataScenario enum for backward compatibility
# New code should use dynamic scenario_type strings from LLM
class DataScenario:
    """
    Legacy scenario enum for backward compatibility.

    New code should use LLMScenarioDetector which returns dynamic
    scenario_type strings instead of fixed enums.
    """
    PROFIT_STATEMENT = "profit_statement"
    BUDGET_REPORT = "budget_report"
    SALES_DETAIL = "sales_detail"
    DEPARTMENT_REPORT = "department_report"
    COST_ANALYSIS = "cost_analysis"
    RECEIVABLE_AGING = "receivable_aging"
    INVENTORY_REPORT = "inventory_report"
    GENERAL_TABLE = "general_table"
    UNKNOWN = "unknown"


# Legacy classes - deprecated, use new modules instead
class FieldMapper:
    """Deprecated: Use semantic_mapper.py with LLM-based mapping instead."""

    def __init__(self):
        from services.semantic_mapper import SemanticMapper
        self._mapper = SemanticMapper()

    def map_fields(self, columns, sample_rows):
        """Legacy compatibility method."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(
                        asyncio.run,
                        self._mapper.map_fields_async(columns)
                    )
                    return future.result()
            else:
                return asyncio.run(self._mapper.map_fields_async(columns))
        except Exception:
            return []


class AnalysisRecommender:
    """Deprecated: Use chart_recommender.py with LLM-based recommendations instead."""

    def recommend(self, scenario, fields):
        """Legacy compatibility method."""
        return []


# Compatibility dataclasses
from dataclasses import dataclass, field as dataclass_field
from typing import List, Optional


@dataclass
class FieldMapping:
    """Legacy field mapping result for backward compatibility."""
    original_name: str
    standard_name: str
    data_type: str
    role: str
    confidence: float = 1.0
    detected_by: str = "llm"


@dataclass
class AnalysisRecommendation:
    """Legacy analysis recommendation for backward compatibility."""
    analysis_type: str
    method_name: str
    description: str
    priority: int
    required_fields: List[str]
    chart_type: str


@dataclass
class AnalysisResult:
    """Legacy analysis result for backward compatibility."""
    success: bool
    analysis_type: str
    title: str
    data: dict
    insights: List[str]
    warnings: List[str]
    chart_config: Optional[dict] = None


@dataclass
class SmartAnalysisOutput:
    """Legacy output format for backward compatibility."""
    scenario: ScenarioResult
    field_mappings: List[FieldMapping]
    recommendations: List[AnalysisRecommendation]
    analyses: List[AnalysisResult]
    summary: str
    processing_notes: List[str] = dataclass_field(default_factory=list)


__all__ = [
    # New exports
    "LLMScenarioDetector",
    "ScenarioResult",
    "ScenarioCache",
    "get_scenario_detector",
    "detect_scenario",
    "detect_scenario_sync",

    # Legacy compatibility
    "SmartAnalyzer",
    "ScenarioDetector",
    "ScenarioDetectionResult",
    "DataScenario",
    "FieldMapper",
    "AnalysisRecommender",
    "InsightGenerator",
    "FieldMapping",
    "AnalysisRecommendation",
    "AnalysisResult",
    "SmartAnalysisOutput",
    "analyze_exported_data",
    "map_fields"
]
