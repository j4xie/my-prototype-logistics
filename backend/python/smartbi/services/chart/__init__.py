"""
Chart Services Package

This package contains all chart-related services for SmartBI:
- recommender: LLM-based chart recommendation service
- builder: ECharts configuration builder
- generator: Chart generation and recommendation engine
- drilldown: Drill-down rendering service

All classes and functions are re-exported here for backward compatibility.
"""
from __future__ import annotations

# =============================================================================
# recommender.py exports (formerly chart_recommender.py)
# =============================================================================
from .recommender import (
    ChartCategory,
    ChartRecommendation,
    DataSummary,
    ChartCacheEntry,
    ChartRecommendationCache,
    ChartRecommender,
    get_chart_recommender,
)

# =============================================================================
# builder.py exports (formerly chart_builder.py)
# =============================================================================
from .builder import (
    ChartType,
    ChartBuilder,
)

# =============================================================================
# generator.py exports (formerly chart_generator.py)
# =============================================================================
from .generator import (
    # Field adapter functions
    get_field_name,
    is_field_time,
    is_field_dimension,
    is_field_measure,
    # Table type rules
    TABLE_TYPE_CHART_RULES,
    get_table_type_rules,
    # Data classes
    DataProfile,
    ChartConfig,
    # Classes
    ChartRecommendationEngine,
    ChartGenerator,
    # Helper function
    quick_charts,
)

# Note: generator.py also defines ChartType and ChartRecommendation
# but we use the versions from builder.py and recommender.py respectively
# to avoid naming conflicts. Import them with aliases if needed:
from .generator import (
    ChartType as GeneratorChartType,
    ChartRecommendation as GeneratorChartRecommendation,
)

# =============================================================================
# drilldown.py exports (formerly drilldown_renderer.py)
# =============================================================================
from .drilldown import (
    DrillDownMetric,
    DrillDownInsight,
    DrillDownItem,
    DrillDownRenderer,
    EnhancedInsightGenerator,
    render_drilldowns,
)

# =============================================================================
# Public API (what gets exported with "from chart import *")
# =============================================================================
__all__ = [
    # From recommender
    "ChartCategory",
    "ChartRecommendation",
    "DataSummary",
    "ChartCacheEntry",
    "ChartRecommendationCache",
    "ChartRecommender",
    "get_chart_recommender",
    # From builder
    "ChartType",
    "ChartBuilder",
    # From generator
    "get_field_name",
    "is_field_time",
    "is_field_dimension",
    "is_field_measure",
    "TABLE_TYPE_CHART_RULES",
    "get_table_type_rules",
    "DataProfile",
    "ChartConfig",
    "ChartRecommendationEngine",
    "ChartGenerator",
    "quick_charts",
    "GeneratorChartType",
    "GeneratorChartRecommendation",
    # From drilldown
    "DrillDownMetric",
    "DrillDownInsight",
    "DrillDownItem",
    "DrillDownRenderer",
    "EnhancedInsightGenerator",
    "render_drilldowns",
]
