"""
Drill-down Renderer Service

Pre-renders all drill-down data during analysis time.
Click on any dimension value to instantly display charts and insights without loading.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import pandas as pd
import numpy as np

from ..statistical_analyzer import StatisticalAnalyzer, ComparisonReport
from .generator import ChartGenerator

logger = logging.getLogger(__name__)


def _format_field_name(name: str) -> str:
    """
    Format field name to be more human-readable for insights.

    Converts:
    - '2025-01-01 00:00:00_预算数' → '2025年1月预算'
    - Removes excessive whitespace
    """
    if not name:
        return name

    # Convert timestamp format: 2025-01-01 00:00:00 → 2025年1月
    def timestamp_to_chinese(match):
        year = match.group(1)
        month = int(match.group(2))
        return f"{year}年{month}月"

    name = re.sub(r'(\d{4})-(\d{2})-\d{2}\s+\d{2}:\d{2}:\d{2}', timestamp_to_chinese, name)

    # Remove excessive whitespace
    name = re.sub(r'[\s\u3000]+', '', name)

    # Simplify common suffixes
    name = name.replace('_预算数', '预算').replace('_实际数', '实际')

    return name


@dataclass
class DrillDownMetric:
    """KPI metric for drill-down view"""
    title: str
    value: str
    raw_value: float
    change: Optional[float] = None
    change_text: Optional[str] = None
    sentiment: str = "neutral"  # positive, negative, neutral


@dataclass
class DrillDownInsight:
    """Insight for drill-down view"""
    level: str  # success, info, warning, error
    title: str
    text: str
    importance: int = 5


@dataclass
class DrillDownItem:
    """Complete drill-down data for one dimension value"""
    dimension_value: str
    parent_dimension: str
    row_count: int
    metrics: List[Dict[str, Any]] = field(default_factory=list)
    charts: List[Dict[str, Any]] = field(default_factory=list)
    insights: List[Dict[str, Any]] = field(default_factory=list)
    detail_table: List[Dict[str, Any]] = field(default_factory=list)


class DrillDownRenderer:
    """Pre-renders drill-down data for instant display"""

    def __init__(self):
        self.analyzer = StatisticalAnalyzer()
        self.chart_generator = ChartGenerator()

    def render_all_drilldowns(
        self,
        data: pd.DataFrame,
        fields: List[Any],
        sheet_name: str = "Sheet1",
        max_values_per_dim: int = 20
    ) -> Dict[str, Dict[str, Dict[str, Any]]]:
        """
        Pre-render drill-down data for all dimension values.

        Args:
            data: DataFrame with sheet data
            fields: List of field definitions
            sheet_name: Name of the sheet
            max_values_per_dim: Maximum unique values per dimension to process

        Returns:
            Nested dict: {dimension_name: {value: DrillDownItem as dict}}
        """
        import logging
        logger = logging.getLogger(__name__)

        # Debug: log all field attributes
        for f in fields:
            logger.info(f"DrillDown field check: {getattr(f, 'standard_name', 'N/A')} | is_dimension={getattr(f, 'is_dimension', None)} | is_measure={getattr(f, 'is_measure', None)} | is_time={getattr(f, 'is_time', None)}")

        dimensions = [f for f in fields if getattr(f, 'is_dimension', False) and not getattr(f, 'is_time', False)]
        measures = [f for f in fields if getattr(f, 'is_measure', False)]

        logger.info(f"DrillDown found: {len(dimensions)} dimensions, {len(measures)} measures")

        if not dimensions or not measures:
            logger.warning(f"DrillDown: Missing dimensions ({len(dimensions)}) or measures ({len(measures)}), returning empty")
            return {}

        drill_down_data = {}

        for dim_field in dimensions:
            dim_name = dim_field.standard_name or dim_field.original_name

            if dim_name not in data.columns:
                continue

            drill_down_data[dim_name] = {}

            # Get unique values
            unique_values = data[dim_name].dropna().unique()

            # Limit to top N by first measure (if too many)
            if len(unique_values) > max_values_per_dim:
                measure_name = measures[0].standard_name or measures[0].original_name
                if measure_name in data.columns:
                    top_values = (
                        data.groupby(dim_name)[measure_name]
                        .sum()
                        .nlargest(max_values_per_dim)
                        .index.tolist()
                    )
                    unique_values = top_values

            for value in unique_values:
                # Filter data for this dimension value
                filtered_data = data[data[dim_name] == value]

                if len(filtered_data) < 2:
                    continue

                # Render drill-down item
                drill_item = self._render_drilldown_item(
                    filtered_data,
                    fields,
                    dim_name,
                    str(value),
                    sheet_name
                )

                drill_down_data[dim_name][str(value)] = drill_item

        return drill_down_data

    def _render_drilldown_item(
        self,
        data: pd.DataFrame,
        fields: List[Any],
        parent_dim: str,
        parent_value: str,
        sheet_name: str
    ) -> Dict[str, Any]:
        """
        Render complete drill-down data for one dimension value.

        Args:
            data: Filtered DataFrame for this value
            fields: Field definitions
            parent_dim: Parent dimension name
            parent_value: Value being drilled into
            sheet_name: Sheet name for context

        Returns:
            Complete drill-down data as dict
        """
        measures = [f for f in fields if f.is_measure]
        dimensions = [
            f for f in fields
            if f.is_dimension and (f.standard_name or f.original_name) != parent_dim
        ]

        # 1. Generate metrics (KPIs)
        metrics = self._generate_metrics(data, measures, sheet_name)

        # 2. Generate charts (4-6 charts)
        charts = self.chart_generator.generate_drilldown_charts(
            data, fields, parent_dim, parent_value
        )

        # 3. Generate insights
        insights = self._generate_drill_insights(
            data, fields, parent_dim, parent_value
        )

        # 4. Detail table (first 50 rows)
        detail_table = data.head(50).to_dict('records')

        return {
            "dimensionValue": parent_value,
            "parentDimension": parent_dim,
            "rowCount": len(data),
            "metrics": metrics,
            "charts": charts,
            "insights": insights,
            "detailTable": detail_table
        }

    def _generate_metrics(
        self,
        data: pd.DataFrame,
        measures: List[Any],
        sheet_name: str
    ) -> List[Dict[str, Any]]:
        """Generate KPI metrics for drill-down view"""
        metrics = []

        for measure_field in measures[:5]:  # Limit to 5 KPIs
            measure_name = measure_field.standard_name or measure_field.original_name

            if measure_name not in data.columns:
                continue

            # Statistical analysis
            stats = self.analyzer.analyze(data, measure_name)

            # Format value
            raw_value = stats.sum
            if abs(raw_value) >= 1_000_000:
                formatted = f"{raw_value / 1_000_000:.2f}M"
            elif abs(raw_value) >= 1_000:
                formatted = f"{raw_value / 1_000:.2f}K"
            else:
                formatted = f"{raw_value:.2f}"

            metrics.append({
                "title": measure_name,
                "value": formatted,
                "rawValue": raw_value,
                "mean": round(stats.mean, 2),
                "median": round(stats.median, 2),
                "count": stats.count,
                "outlierCount": stats.outlier_count
            })

        return metrics

    def _generate_drill_insights(
        self,
        data: pd.DataFrame,
        fields: List[Any],
        parent_dim: str,
        parent_value: str
    ) -> List[Dict[str, Any]]:
        """Generate specialized insights for drill-down view"""
        insights = []
        measures = [f for f in fields if f.is_measure]
        sub_dims = [
            f for f in fields
            if f.is_dimension and (f.standard_name or f.original_name) != parent_dim
        ]

        for measure_field in measures[:2]:  # Focus on top 2 measures
            measure_name = measure_field.standard_name or measure_field.original_name

            if measure_name not in data.columns:
                continue

            stats = self.analyzer.analyze(data, measure_name)

            # 1. Summary insight
            insights.append({
                "level": "info",
                "title": f"{parent_value} 数据概览",
                "text": (
                    f"{parent_value} 共 {stats.count} 条记录，"
                    f"{measure_name} 合计 {self._format_number(stats.sum)}，"
                    f"平均值 {self._format_number(stats.mean)}"
                ),
                "importance": 7
            })

            # 2. Sub-dimension top insight
            if sub_dims:
                sub_dim = sub_dims[0].standard_name or sub_dims[0].original_name
                if sub_dim in data.columns:
                    comparison = self.analyzer.compare_dimensions(
                        data, sub_dim, measure_name
                    )

                    if comparison.top_3:
                        top_item = list(comparison.top_3.keys())[0]
                        top_value = comparison.top_3[top_item]
                        share = comparison.share.get(top_item, 0)

                        insights.append({
                            "level": "success",
                            "title": f"主要贡献者",
                            "text": (
                                f"{top_item} 贡献 {parent_value} 最多 {measure_name}: "
                                f"{self._format_number(top_value)} ({share:.1f}%)"
                            ),
                            "importance": 8
                        })

            # 3. Distribution insight
            if stats.distribution_type != "normal":
                insights.append({
                    "level": "warning" if stats.distribution_type in ["skewed_right", "skewed_left"] else "info",
                    "title": "分布特征",
                    "text": (
                        f"{parent_value} 的 {measure_name} 呈 "
                        f"{'右偏分布' if stats.distribution_type == 'skewed_right' else '左偏分布' if stats.distribution_type == 'skewed_left' else stats.distribution_type}，"
                        f"中位数 {self._format_number(stats.median)}，偏度 {stats.skewness:.2f}"
                    ),
                    "importance": 5
                })

            # 4. Outlier insight
            if stats.outlier_count > 0:
                insights.append({
                    "level": "warning",
                    "title": "异常值检测",
                    "text": (
                        f"{parent_value} 的 {measure_name} 中检测到 {stats.outlier_count} 个异常值，"
                        f"建议人工核查"
                    ),
                    "importance": 6
                })

            # 5. Concentration insight (if sub-dimension exists)
            if sub_dims:
                sub_dim = sub_dims[0].standard_name or sub_dims[0].original_name
                if sub_dim in data.columns:
                    comparison = self.analyzer.compare_dimensions(
                        data, sub_dim, measure_name
                    )

                    if comparison.cr3 > 70:
                        insights.append({
                            "level": "warning",
                            "title": "高集中度",
                            "text": (
                                f"{parent_value} 的 {measure_name} 集中度较高，"
                                f"前 3 个 {sub_dim} 占比 {comparison.cr3:.1f}%"
                            ),
                            "importance": 6
                        })

                    # Pareto insight
                    insights.append({
                        "level": "info",
                        "title": "帕累托分析",
                        "text": (
                            f"{comparison.pareto_count} 个 {sub_dim} "
                            f"贡献了 {parent_value} 80% 的 {measure_name}"
                        ),
                        "importance": 5
                    })

        # Sort by importance
        insights.sort(key=lambda x: x.get("importance", 0), reverse=True)
        return insights[:8]  # Limit to 8 insights

    def _format_number(self, value: float) -> str:
        """Format number for display"""
        if value is None:
            return "0"

        if abs(value) >= 1_000_000:
            return f"{value / 1_000_000:.2f}M"
        elif abs(value) >= 1_000:
            return f"{value / 1_000:.2f}K"
        else:
            return f"{value:.2f}"


class EnhancedInsightGenerator:
    """Enhanced insight generator integrating statistical analysis"""

    def __init__(self):
        self.analyzer = StatisticalAnalyzer()

    def generate_sheet_insights(
        self,
        data: pd.DataFrame,
        fields: List[Any],
        sheet_name: str = "Sheet1"
    ) -> List[Dict[str, Any]]:
        """
        Generate comprehensive insights for a sheet.

        Args:
            data: DataFrame with sheet data
            fields: Field definitions
            sheet_name: Name of the sheet

        Returns:
            List of insight dictionaries
        """
        insights = []
        measures = [f for f in fields if getattr(f, 'is_measure', False)]
        dimensions = [f for f in fields if getattr(f, 'is_dimension', False)]

        # 1. KPI Insights
        try:
            insights.extend(self._generate_kpi_insights(data, measures, sheet_name))
        except Exception as e:
            logger.warning(f"KPI insight generation failed: {e}")

        # 2. Ranking Insights
        try:
            insights.extend(self._generate_ranking_insights(
                data, dimensions, measures, sheet_name
            ))
        except Exception as e:
            logger.warning(f"Ranking insight generation failed: {e}")

        # 3. Anomaly Insights
        try:
            insights.extend(self._generate_anomaly_insights(data, measures, sheet_name))
        except Exception as e:
            logger.warning(f"Anomaly insight generation failed: {e}")

        # 4. Distribution Insights
        try:
            insights.extend(self._generate_distribution_insights(
                data, measures, sheet_name
            ))
        except Exception as e:
            logger.warning(f"Distribution insight generation failed: {e}")

        # 5. Correlation Insights (if multiple measures)
        if len(measures) >= 2:
            try:
                insights.extend(self._generate_correlation_insights(
                    data, measures, sheet_name
                ))
            except Exception as e:
                logger.warning(f"Correlation insight generation failed: {e}")

        # Sort by importance and limit
        insights.sort(key=lambda x: x.get("importance", 0), reverse=True)
        return insights[:12]  # Return top 12 insights

    def _generate_kpi_insights(
        self,
        data: pd.DataFrame,
        measures: List[Any],
        sheet_name: str
    ) -> List[Dict[str, Any]]:
        """Generate insights about core KPIs"""
        insights = []

        for measure_field in measures[:3]:
            measure = getattr(measure_field, 'standard_name', None) or getattr(measure_field, 'original_name', '')

            if not measure or measure not in data.columns:
                continue

            stats = self.analyzer.analyze(data, measure)
            if stats.count == 0:
                continue  # Skip if no numeric data

            # Format measure name for display
            display_measure = _format_field_name(measure)

            # Total value insight
            insights.append({
                "level": "info",
                "category": "核心指标",
                "title": f"{sheet_name} {display_measure} 总量",
                "text": (
                    f"{sheet_name} 的 {display_measure} 合计 {self._format_number(stats.sum)}，"
                    f"平均值 {self._format_number(stats.mean)}，"
                    f"中位数 {self._format_number(stats.median)}"
                ),
                "importance": 8,
                "metric": measure
            })

            # Variation insight
            if stats.coefficient_of_variation > 50:
                insights.append({
                    "level": "warning",
                    "category": "波动分析",
                    "title": f"{display_measure} 波动较大",
                    "text": (
                        f"{sheet_name} 的 {display_measure} 变异系数为 "
                        f"{stats.coefficient_of_variation:.1f}%，数据波动较大"
                    ),
                    "importance": 6,
                    "metric": measure
                })

        return insights

    def _generate_ranking_insights(
        self,
        data: pd.DataFrame,
        dimensions: List[Any],
        measures: List[Any],
        sheet_name: str
    ) -> List[Dict[str, Any]]:
        """Generate ranking insights"""
        insights = []

        if not dimensions or not measures:
            return insights

        dim = getattr(dimensions[0], 'standard_name', None) or getattr(dimensions[0], 'original_name', '')
        measure = getattr(measures[0], 'standard_name', None) or getattr(measures[0], 'original_name', '')

        if not dim or not measure or dim not in data.columns or measure not in data.columns:
            return insights

        comparison = self.analyzer.compare_dimensions(data, dim, measure)
        if comparison.total_value == 0:
            return insights  # Skip if no data

        # Format field names for display
        display_dim = _format_field_name(dim)
        display_measure = _format_field_name(measure)

        # Top 3 insight
        if comparison.top_3:
            top_items = list(comparison.top_3.items())
            top_text = "、".join([
                f"{k} ({self._format_number(v)})" for k, v in top_items
            ])
            insights.append({
                "level": "success",
                "category": "排名分析",
                "title": f"{display_measure} Top 3",
                "text": f"{sheet_name} 中 {display_measure} 排名前三: {top_text}",
                "importance": 7
            })

        # Concentration insight
        if comparison.cr3 > 60:
            insights.append({
                "level": "warning",
                "category": "集中度",
                "title": "高集中度警示",
                "text": (
                    f"前 3 个 {display_dim} 贡献了 {comparison.cr3:.1f}% 的 {display_measure}，"
                    f"业务集中度较高，建议关注风险分散"
                ),
                "importance": 6
            })

        # Pareto insight
        insights.append({
            "level": "info",
            "category": "帕累托分析",
            "title": "80/20 法则",
            "text": (
                f"仅 {comparison.pareto_count} 个 {display_dim} "
                f"贡献了 80% 的 {display_measure}"
            ),
            "importance": 5
        })

        # Gap insight
        if comparison.max_vs_min_ratio and comparison.max_vs_min_ratio > 10:
            insights.append({
                "level": "warning",
                "category": "差距分析",
                "title": "极端差异",
                "text": (
                    f"最高与最低 {display_dim} 之间 {display_measure} 相差 "
                    f"{comparison.max_vs_min_ratio:.1f} 倍，差异显著"
                ),
                "importance": 5
            })

        return insights

    def _generate_anomaly_insights(
        self,
        data: pd.DataFrame,
        measures: List[Any],
        sheet_name: str
    ) -> List[Dict[str, Any]]:
        """Generate anomaly detection insights"""
        insights = []

        for measure_field in measures[:2]:
            measure = getattr(measure_field, 'standard_name', None) or getattr(measure_field, 'original_name', '')

            if not measure or measure not in data.columns:
                continue

            stats = self.analyzer.analyze(data, measure)
            if stats.count == 0:
                continue

            # Format measure name for display
            display_measure = _format_field_name(measure)

            if stats.outlier_count > 0:
                outlier_range = ""
                if stats.outliers:
                    outlier_range = f"数值范围: {min(stats.outliers):.2f} ~ {max(stats.outliers):.2f}"

                insights.append({
                    "level": "error",
                    "category": "异常检测",
                    "title": f"发现 {stats.outlier_count} 个异常值",
                    "text": (
                        f"{sheet_name} 的 {display_measure} 中检测到 "
                        f"{stats.outlier_count} 个异常值，{outlier_range}，"
                        f"超出正常范围 (IQR 法则)，建议人工核查"
                    ),
                    "importance": 9
                })

        return insights

    def _generate_distribution_insights(
        self,
        data: pd.DataFrame,
        measures: List[Any],
        sheet_name: str
    ) -> List[Dict[str, Any]]:
        """Generate distribution analysis insights"""
        insights = []

        for measure_field in measures[:2]:
            measure = getattr(measure_field, 'standard_name', None) or getattr(measure_field, 'original_name', '')

            if not measure or measure not in data.columns:
                continue

            stats = self.analyzer.analyze(data, measure)

            # Format measure name for display
            display_measure = _format_field_name(measure)

            if stats.distribution_type not in ["normal", "unknown"]:
                dist_desc = {
                    "skewed_right": "右偏分布（存在高值长尾）",
                    "skewed_left": "左偏分布（存在低值长尾）",
                    "heavy_tailed": "厚尾分布（极端值较多）",
                    "bimodal": "双峰分布（可能存在两个群体）",
                    "uniform": "均匀分布"
                }.get(stats.distribution_type, stats.distribution_type)

                insights.append({
                    "level": "info",
                    "category": "分布特征",
                    "title": f"{display_measure} 分布分析",
                    "text": (
                        f"{sheet_name} 的 {display_measure} 呈 {dist_desc}，"
                        f"偏度 {stats.skewness:.2f}，峰度 {stats.kurtosis:.2f}"
                    ),
                    "importance": 4
                })

        return insights

    def _generate_correlation_insights(
        self,
        data: pd.DataFrame,
        measures: List[Any],
        sheet_name: str
    ) -> List[Dict[str, Any]]:
        """Generate correlation analysis insights"""
        insights = []

        measure_names = [
            getattr(m, 'standard_name', None) or getattr(m, 'original_name', '')
            for m in measures
        ]
        measure_names = [n for n in measure_names if n and n in data.columns]

        if len(measure_names) < 2:
            return insights

        corr_report = self.analyzer.analyze_correlations(data, measure_names)

        # Strong positive correlations
        for corr in corr_report.strong_positive[:2]:
            var1_display = _format_field_name(corr['var1'])
            var2_display = _format_field_name(corr['var2'])
            insights.append({
                "level": "info",
                "category": "相关性分析",
                "title": "强正相关",
                "text": (
                    f"{var1_display} 与 {var2_display} 呈强正相关 "
                    f"(r = {corr['correlation']:.2f})，当其中一个增加时另一个也倾向于增加"
                ),
                "importance": 5
            })

        # Strong negative correlations
        for corr in corr_report.strong_negative[:1]:
            var1_display = _format_field_name(corr['var1'])
            var2_display = _format_field_name(corr['var2'])
            insights.append({
                "level": "warning",
                "category": "相关性分析",
                "title": "强负相关",
                "text": (
                    f"{var1_display} 与 {var2_display} 呈强负相关 "
                    f"(r = {corr['correlation']:.2f})，存在此消彼长关系"
                ),
                "importance": 5
            })

        return insights

    def _format_number(self, value: float) -> str:
        """Format number for display"""
        if value is None:
            return "0"

        if abs(value) >= 1_000_000:
            return f"{value / 1_000_000:.2f}M"
        elif abs(value) >= 1_000:
            return f"{value / 1_000:.2f}K"
        else:
            return f"{value:.2f}"


# Convenience function
def render_drilldowns(
    data: pd.DataFrame,
    fields: List[Any],
    sheet_name: str = "Sheet1"
) -> Dict[str, Any]:
    """Quick drill-down rendering helper"""
    renderer = DrillDownRenderer()
    return renderer.render_all_drilldowns(data, fields, sheet_name)
