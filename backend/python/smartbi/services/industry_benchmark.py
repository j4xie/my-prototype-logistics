from __future__ import annotations
"""
Industry Benchmark Service

Provides industry comparison and benchmarking capabilities:
- Industry standard metrics lookup
- Company vs industry comparison
- Percentile ranking
- Improvement recommendations

Part of SmartBI Phase 6: AI Chat Deep Integration.
"""
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class IndustryCategory(str, Enum):
    """Industry categories for benchmarking"""
    FOOD_PROCESSING = "food_processing"
    FOOD_MANUFACTURING = "food_manufacturing"
    RETAIL = "retail"
    WHOLESALE = "wholesale"
    LOGISTICS = "logistics"
    AGRICULTURE = "agriculture"
    MANUFACTURING = "manufacturing"
    TECHNOLOGY = "technology"
    HEALTHCARE = "healthcare"
    FINANCE = "finance"


class PerformanceLevel(str, Enum):
    """Performance level relative to industry"""
    TOP_QUARTILE = "top_quartile"       # Top 25%
    ABOVE_AVERAGE = "above_average"     # 50-75%
    AVERAGE = "average"                 # 25-50%
    BELOW_AVERAGE = "below_average"     # Bottom 25%


@dataclass
class IndustryBenchmarkData:
    """Benchmark data for an industry metric"""
    metric_name: str
    industry: IndustryCategory

    # Statistical benchmarks
    industry_avg: float
    industry_median: float
    percentile_25: float
    percentile_75: float
    percentile_90: float

    # Best practices
    best_in_class: float
    min_acceptable: float

    # Metadata
    unit: str = ""
    higher_is_better: bool = True
    data_year: int = 2025
    source: str = "industry_reports"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metric_name": self.metric_name,
            "industry": self.industry.value,
            "benchmarks": {
                "industry_avg": self.industry_avg,
                "industry_median": self.industry_median,
                "percentile_25": self.percentile_25,
                "percentile_75": self.percentile_75,
                "percentile_90": self.percentile_90,
                "best_in_class": self.best_in_class,
                "min_acceptable": self.min_acceptable
            },
            "metadata": {
                "unit": self.unit,
                "higher_is_better": self.higher_is_better,
                "data_year": self.data_year,
                "source": self.source
            }
        }


@dataclass
class CompanyMetricComparison:
    """Comparison of company metric vs industry benchmark"""
    metric_name: str
    company_value: float
    industry_avg: float

    gap: float  # company_value - industry_avg
    gap_percentage: float

    # Performance assessment
    performance_level: PerformanceLevel
    percentile_estimate: float  # 0-100

    # Improvement suggestion
    target_value: Optional[float] = None
    improvement_needed: Optional[float] = None
    assessment: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metric_name": self.metric_name,
            "company_value": self.company_value,
            "industry_avg": self.industry_avg,
            "gap": self.gap,
            "gap_percentage": self.gap_percentage,
            "performance_level": self.performance_level.value,
            "percentile_estimate": self.percentile_estimate,
            "target_value": self.target_value,
            "improvement_needed": self.improvement_needed,
            "assessment": self.assessment
        }


@dataclass
class BenchmarkResult:
    """Result of benchmark analysis"""
    success: bool
    error: Optional[str] = None

    industry: Optional[IndustryCategory] = None
    comparisons: List[CompanyMetricComparison] = field(default_factory=list)

    # Summary
    overall_assessment: str = ""
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

    # Sources
    data_sources: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "error": self.error,
            "industry": self.industry.value if self.industry else None,
            "comparisons": [c.to_dict() for c in self.comparisons],
            "summary": {
                "overall_assessment": self.overall_assessment,
                "strengths": self.strengths,
                "weaknesses": self.weaknesses,
                "recommendations": self.recommendations
            },
            "sources": self.data_sources
        }


class IndustryBenchmarkDatabase:
    """
    Static database of industry benchmarks.

    In production, this would be backed by:
    - Web search API for real-time data
    - Industry report databases
    - Financial data providers
    """

    # Food Processing Industry Benchmarks (食品加工行业)
    FOOD_PROCESSING_BENCHMARKS = {
        "gross_margin": IndustryBenchmarkData(
            metric_name="毛利率",
            industry=IndustryCategory.FOOD_PROCESSING,
            industry_avg=0.28,
            industry_median=0.26,
            percentile_25=0.20,
            percentile_75=0.35,
            percentile_90=0.42,
            best_in_class=0.50,
            min_acceptable=0.15,
            unit="%",
            higher_is_better=True
        ),
        "operating_margin": IndustryBenchmarkData(
            metric_name="营业利润率",
            industry=IndustryCategory.FOOD_PROCESSING,
            industry_avg=0.08,
            industry_median=0.07,
            percentile_25=0.04,
            percentile_75=0.12,
            percentile_90=0.18,
            best_in_class=0.25,
            min_acceptable=0.02,
            unit="%",
            higher_is_better=True
        ),
        "net_margin": IndustryBenchmarkData(
            metric_name="净利率",
            industry=IndustryCategory.FOOD_PROCESSING,
            industry_avg=0.05,
            industry_median=0.04,
            percentile_25=0.02,
            percentile_75=0.08,
            percentile_90=0.12,
            best_in_class=0.18,
            min_acceptable=0.01,
            unit="%",
            higher_is_better=True
        ),
        "inventory_turnover": IndustryBenchmarkData(
            metric_name="存货周转率",
            industry=IndustryCategory.FOOD_PROCESSING,
            industry_avg=6.0,
            industry_median=5.5,
            percentile_25=4.0,
            percentile_75=8.0,
            percentile_90=12.0,
            best_in_class=18.0,
            min_acceptable=3.0,
            unit="次/年",
            higher_is_better=True
        ),
        "receivables_turnover": IndustryBenchmarkData(
            metric_name="应收账款周转率",
            industry=IndustryCategory.FOOD_PROCESSING,
            industry_avg=8.0,
            industry_median=7.5,
            percentile_25=5.0,
            percentile_75=10.0,
            percentile_90=14.0,
            best_in_class=20.0,
            min_acceptable=4.0,
            unit="次/年",
            higher_is_better=True
        ),
        "current_ratio": IndustryBenchmarkData(
            metric_name="流动比率",
            industry=IndustryCategory.FOOD_PROCESSING,
            industry_avg=1.5,
            industry_median=1.4,
            percentile_25=1.1,
            percentile_75=1.9,
            percentile_90=2.5,
            best_in_class=3.0,
            min_acceptable=1.0,
            unit="",
            higher_is_better=True
        ),
        "debt_ratio": IndustryBenchmarkData(
            metric_name="资产负债率",
            industry=IndustryCategory.FOOD_PROCESSING,
            industry_avg=0.45,
            industry_median=0.43,
            percentile_25=0.35,
            percentile_75=0.55,
            percentile_90=0.65,
            best_in_class=0.30,
            min_acceptable=0.70,
            unit="%",
            higher_is_better=False  # Lower is better for debt ratio
        ),
        "revenue_growth": IndustryBenchmarkData(
            metric_name="营收增长率",
            industry=IndustryCategory.FOOD_PROCESSING,
            industry_avg=0.08,
            industry_median=0.06,
            percentile_25=0.02,
            percentile_75=0.15,
            percentile_90=0.25,
            best_in_class=0.40,
            min_acceptable=-0.05,
            unit="%",
            higher_is_better=True
        )
    }

    # Retail Industry Benchmarks (零售行业)
    RETAIL_BENCHMARKS = {
        "gross_margin": IndustryBenchmarkData(
            metric_name="毛利率",
            industry=IndustryCategory.RETAIL,
            industry_avg=0.25,
            industry_median=0.23,
            percentile_25=0.18,
            percentile_75=0.32,
            percentile_90=0.40,
            best_in_class=0.50,
            min_acceptable=0.12,
            unit="%",
            higher_is_better=True
        ),
        "inventory_turnover": IndustryBenchmarkData(
            metric_name="存货周转率",
            industry=IndustryCategory.RETAIL,
            industry_avg=8.0,
            industry_median=7.0,
            percentile_25=5.0,
            percentile_75=12.0,
            percentile_90=18.0,
            best_in_class=25.0,
            min_acceptable=4.0,
            unit="次/年",
            higher_is_better=True
        )
    }

    # All benchmarks by industry
    BENCHMARKS_BY_INDUSTRY = {
        IndustryCategory.FOOD_PROCESSING: FOOD_PROCESSING_BENCHMARKS,
        IndustryCategory.FOOD_MANUFACTURING: FOOD_PROCESSING_BENCHMARKS,  # Similar benchmarks
        IndustryCategory.RETAIL: RETAIL_BENCHMARKS
    }

    @classmethod
    def get_benchmark(
        cls,
        industry: IndustryCategory,
        metric: str
    ) -> Optional[IndustryBenchmarkData]:
        """Get benchmark data for a specific metric and industry"""
        industry_benchmarks = cls.BENCHMARKS_BY_INDUSTRY.get(industry, {})
        return industry_benchmarks.get(metric)

    @classmethod
    def get_all_benchmarks(
        cls,
        industry: IndustryCategory
    ) -> Dict[str, IndustryBenchmarkData]:
        """Get all benchmarks for an industry"""
        return cls.BENCHMARKS_BY_INDUSTRY.get(industry, {})


class IndustryBenchmark:
    """
    Industry benchmark analysis service.

    Provides comparison of company metrics against industry standards.
    """

    def __init__(self):
        self.database = IndustryBenchmarkDatabase()

    async def compare_with_industry(
        self,
        company_metrics: Dict[str, float],
        industry: IndustryCategory,
        metric_mapping: Optional[Dict[str, str]] = None
    ) -> BenchmarkResult:
        """
        Compare company metrics with industry benchmarks.

        Args:
            company_metrics: Dict of {metric_name: value}
            industry: Industry category
            metric_mapping: Optional mapping of company metric names to standard names

        Returns:
            BenchmarkResult with comparisons and recommendations
        """
        result = BenchmarkResult(
            success=False,
            industry=industry
        )

        try:
            # Get industry benchmarks
            benchmarks = self.database.get_all_benchmarks(industry)

            if not benchmarks:
                result.error = f"No benchmarks available for {industry.value}"
                return result

            comparisons = []
            strengths = []
            weaknesses = []
            recommendations = []

            for metric_name, value in company_metrics.items():
                # Map metric name if mapping provided
                standard_name = metric_name
                if metric_mapping and metric_name in metric_mapping:
                    standard_name = metric_mapping[metric_name]

                # Find matching benchmark
                benchmark = benchmarks.get(standard_name)
                if not benchmark:
                    continue

                # Calculate comparison
                comparison = self._compare_metric(
                    metric_name=metric_name,
                    company_value=value,
                    benchmark=benchmark
                )
                comparisons.append(comparison)

                # Categorize as strength or weakness
                if comparison.performance_level in [PerformanceLevel.TOP_QUARTILE, PerformanceLevel.ABOVE_AVERAGE]:
                    strengths.append(f"{metric_name}: {comparison.assessment}")
                elif comparison.performance_level == PerformanceLevel.BELOW_AVERAGE:
                    weaknesses.append(f"{metric_name}: {comparison.assessment}")
                    recommendations.append(
                        f"建议提升{metric_name}至行业平均水平({benchmark.industry_avg:.2f})"
                    )

            result.comparisons = comparisons
            result.strengths = strengths
            result.weaknesses = weaknesses
            result.recommendations = recommendations

            # Generate overall assessment
            result.overall_assessment = self._generate_overall_assessment(comparisons)

            # Add data sources
            result.data_sources = [
                f"{industry.value}行业报告 (2025)",
                "企业财务分析数据库"
            ]

            result.success = True
            return result

        except Exception as e:
            logger.error(f"Benchmark comparison failed: {e}", exc_info=True)
            result.error = str(e)
            return result

    def _compare_metric(
        self,
        metric_name: str,
        company_value: float,
        benchmark: IndustryBenchmarkData
    ) -> CompanyMetricComparison:
        """Compare a single metric against benchmark"""

        # Calculate gap
        gap = company_value - benchmark.industry_avg
        gap_percentage = (gap / benchmark.industry_avg * 100) if benchmark.industry_avg != 0 else 0

        # Estimate percentile
        percentile = self._estimate_percentile(
            company_value,
            benchmark,
            benchmark.higher_is_better
        )

        # Determine performance level
        if percentile >= 75:
            level = PerformanceLevel.TOP_QUARTILE
        elif percentile >= 50:
            level = PerformanceLevel.ABOVE_AVERAGE
        elif percentile >= 25:
            level = PerformanceLevel.AVERAGE
        else:
            level = PerformanceLevel.BELOW_AVERAGE

        # Generate assessment text
        if benchmark.higher_is_better:
            if gap > 0:
                assessment = f"高于行业平均{abs(gap_percentage):.1f}%，处于行业前{100-percentile:.0f}%"
            else:
                assessment = f"低于行业平均{abs(gap_percentage):.1f}%，需要改进"
        else:
            if gap < 0:
                assessment = f"优于行业平均{abs(gap_percentage):.1f}%（值越低越好）"
            else:
                assessment = f"高于行业平均{abs(gap_percentage):.1f}%，需控制"

        # Calculate improvement target
        target_value = None
        improvement_needed = None

        if level == PerformanceLevel.BELOW_AVERAGE:
            target_value = benchmark.industry_avg
            if benchmark.higher_is_better:
                improvement_needed = target_value - company_value
            else:
                improvement_needed = company_value - target_value

        return CompanyMetricComparison(
            metric_name=metric_name,
            company_value=company_value,
            industry_avg=benchmark.industry_avg,
            gap=gap,
            gap_percentage=gap_percentage,
            performance_level=level,
            percentile_estimate=percentile,
            target_value=target_value,
            improvement_needed=improvement_needed,
            assessment=assessment
        )

    def _estimate_percentile(
        self,
        value: float,
        benchmark: IndustryBenchmarkData,
        higher_is_better: bool
    ) -> float:
        """Estimate percentile based on benchmark distribution"""

        if higher_is_better:
            if value >= benchmark.percentile_90:
                return 95
            elif value >= benchmark.percentile_75:
                # Linear interpolation between 75 and 90
                range_size = benchmark.percentile_90 - benchmark.percentile_75
                if range_size > 0:
                    position = (value - benchmark.percentile_75) / range_size
                    return 75 + position * 15
                return 80
            elif value >= benchmark.industry_median:
                # Linear interpolation between 50 and 75
                range_size = benchmark.percentile_75 - benchmark.industry_median
                if range_size > 0:
                    position = (value - benchmark.industry_median) / range_size
                    return 50 + position * 25
                return 60
            elif value >= benchmark.percentile_25:
                # Linear interpolation between 25 and 50
                range_size = benchmark.industry_median - benchmark.percentile_25
                if range_size > 0:
                    position = (value - benchmark.percentile_25) / range_size
                    return 25 + position * 25
                return 35
            else:
                # Below 25th percentile
                return max(5, 25 * value / benchmark.percentile_25 if benchmark.percentile_25 > 0 else 10)
        else:
            # For metrics where lower is better (e.g., debt ratio)
            if value <= benchmark.percentile_25:
                return 90  # Top quartile
            elif value <= benchmark.industry_median:
                return 70
            elif value <= benchmark.percentile_75:
                return 40
            else:
                return 15

    def _generate_overall_assessment(
        self,
        comparisons: List[CompanyMetricComparison]
    ) -> str:
        """Generate overall assessment summary"""

        if not comparisons:
            return "数据不足，无法进行行业对比分析。"

        # Count by level
        level_counts = {}
        for c in comparisons:
            level = c.performance_level.value
            level_counts[level] = level_counts.get(level, 0) + 1

        total = len(comparisons)

        # Generate assessment
        top_count = level_counts.get("top_quartile", 0)
        above_count = level_counts.get("above_average", 0)
        below_count = level_counts.get("below_average", 0)

        if top_count + above_count >= total * 0.6:
            assessment = "整体表现优于行业平均水平"
        elif below_count >= total * 0.5:
            assessment = "整体表现低于行业平均，建议重点改进"
        else:
            assessment = "整体表现处于行业中等水平"

        # Add specific highlights
        details = []
        if top_count > 0:
            details.append(f"{top_count}项指标处于行业前列")
        if below_count > 0:
            details.append(f"{below_count}项指标需要改进")

        if details:
            assessment += f"，其中{', '.join(details)}"

        return assessment + "。"

    def get_benchmark_info(
        self,
        industry: IndustryCategory,
        metric: str
    ) -> Optional[Dict[str, Any]]:
        """Get benchmark information for a specific metric"""
        benchmark = self.database.get_benchmark(industry, metric)
        if benchmark:
            return benchmark.to_dict()
        return None

    def list_available_metrics(
        self,
        industry: IndustryCategory
    ) -> List[str]:
        """List available benchmark metrics for an industry"""
        benchmarks = self.database.get_all_benchmarks(industry)
        return list(benchmarks.keys())


# Convenience function for quick comparison
async def quick_benchmark(
    company_data: Dict[str, float],
    industry: str = "food_processing"
) -> BenchmarkResult:
    """
    Quick benchmark comparison.

    Args:
        company_data: Dict of metric values
        industry: Industry name (string)

    Returns:
        BenchmarkResult
    """
    # Map string to enum
    industry_map = {
        "food_processing": IndustryCategory.FOOD_PROCESSING,
        "food": IndustryCategory.FOOD_PROCESSING,
        "retail": IndustryCategory.RETAIL,
        "manufacturing": IndustryCategory.MANUFACTURING
    }

    industry_enum = industry_map.get(industry.lower(), IndustryCategory.FOOD_PROCESSING)

    benchmark_service = IndustryBenchmark()
    return await benchmark_service.compare_with_industry(company_data, industry_enum)
