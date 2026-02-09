"""
Insight Services Package

This package provides AI-powered insight generation, multi-dimensional analysis,
and industry benchmarking capabilities for SmartBI.

Modules:
- generator: AI-powered insight generation (InsightGenerator)
- dimensions: Multi-dimensional insight framework (InsightDimensionAnalyzer)
- benchmark: Industry benchmarking service (IndustryBenchmark)
"""

# Re-export from generator module
from .generator import (
    InsightType as GeneratorInsightType,  # Renamed to avoid conflict with dimensions.InsightType
    InsightGenerator,
)

# Re-export from dimensions module
from .dimensions import (
    InsightDimension,
    InsightType,  # This is the primary InsightType used in dimensions framework
    ImpactLevel,
    Insight,
    InsightReport,
    KPIDefinitions,
    InsightDimensionAnalyzer,
)

# Re-export from benchmark module
from .benchmark import (
    IndustryCategory,
    PerformanceLevel,
    IndustryBenchmarkData,
    CompanyMetricComparison,
    BenchmarkResult,
    IndustryBenchmarkDatabase,
    IndustryBenchmark,
    quick_benchmark,
)

__all__ = [
    # Generator
    "GeneratorInsightType",
    "InsightGenerator",
    # Dimensions
    "InsightDimension",
    "InsightType",
    "ImpactLevel",
    "Insight",
    "InsightReport",
    "KPIDefinitions",
    "InsightDimensionAnalyzer",
    # Benchmark
    "IndustryCategory",
    "PerformanceLevel",
    "IndustryBenchmarkData",
    "CompanyMetricComparison",
    "BenchmarkResult",
    "IndustryBenchmarkDatabase",
    "IndustryBenchmark",
    "quick_benchmark",
]
