"""
Chart Generator Service

Smart chart recommendation and generation engine for SmartBI.
Supports 20+ chart types with intelligent selection based on data characteristics.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum

import numpy as np
import pandas as pd

from ..statistical_analyzer import StatisticalAnalyzer, ComparisonReport

logger = logging.getLogger(__name__)


# ============================================================
# Field Adapter - Support both old and new field types
# ============================================================

def get_field_name(field_def) -> str:
    """Get field name from either field type"""
    if hasattr(field_def, 'standard_name'):
        return field_def.standard_name or field_def.original_name
    return getattr(field_def, 'field_name', str(field_def))


def is_field_time(field_def) -> bool:
    """Check if field is a time field"""
    if hasattr(field_def, 'is_time'):
        return field_def.is_time
    return getattr(field_def, 'chart_role', '') == 'time'


def is_field_dimension(field_def) -> bool:
    """Check if field is a dimension"""
    if hasattr(field_def, 'is_dimension'):
        return field_def.is_dimension
    return getattr(field_def, 'chart_role', '') == 'dimension'


def is_field_measure(field_def) -> bool:
    """Check if field is a measure"""
    if hasattr(field_def, 'is_measure'):
        return field_def.is_measure
    return getattr(field_def, 'chart_role', '') == 'measure'


class ChartType(str, Enum):
    """Supported chart types"""
    # Basic charts
    BAR = "bar"
    BAR_HORIZONTAL = "bar_horizontal"
    BAR_GROUPED = "bar_grouped"
    BAR_STACKED = "bar_stacked"
    LINE = "line"
    AREA = "area"
    AREA_STACKED = "area_stacked"
    PIE = "pie"
    DONUT = "donut"
    SCATTER = "scatter"
    BUBBLE = "bubble"

    # Advanced charts
    WATERFALL = "waterfall"
    FUNNEL = "funnel"
    RADAR = "radar"
    GAUGE = "gauge"
    TREEMAP = "treemap"
    SUNBURST = "sunburst"
    HEATMAP = "heatmap"
    BOXPLOT = "boxplot"
    SANKEY = "sankey"
    PARETO = "pareto"


# ============================================================
# Table Type Chart Customization Rules
# ============================================================

TABLE_TYPE_CHART_RULES: Dict[str, Dict[str, Any]] = {
    "profit_table": {
        # 利润表: 展示财务结构、预算vs实际对比
        "priority_charts": ["waterfall", "bar_horizontal", "bar_grouped"],
        "exclude_charts": ["pie", "donut"],  # 利润表不适合占比图
        "boost_priority": {"waterfall": 3, "bar_horizontal": 2, "bar_grouped": 2},
        "reason": "利润表推荐瀑布图展示财务结构"
    },
    "finance_summary": {
        # 财务汇总表: 月度趋势、区域占比
        "priority_charts": ["line", "bar", "area", "donut"],
        "exclude_charts": [],
        "boost_priority": {"line": 2, "area": 1},
        "reason": "财务汇总推荐折线图展示趋势"
    },
    "budget_report": {
        # 预算报告: 预算达成率、差异分析
        "priority_charts": ["bar_grouped", "waterfall", "bar"],
        "exclude_charts": ["scatter"],
        "boost_priority": {"bar_grouped": 3, "waterfall": 2},
        "reason": "预算报告推荐分组柱状图对比预算与实际"
    },
    "sales_detail": {
        # 销售明细: 客户贡献、销售漏斗
        "priority_charts": ["pareto", "funnel", "bar_horizontal", "scatter"],
        "exclude_charts": [],
        "boost_priority": {"pareto": 2, "funnel": 2, "bar_horizontal": 1},
        "reason": "销售明细推荐帕累托图分析客户贡献"
    },
    "inventory_report": {
        # 库存报告: 分布、异常检测
        "priority_charts": ["bar", "boxplot", "treemap"],
        "exclude_charts": ["funnel"],
        "boost_priority": {"boxplot": 2, "treemap": 1},
        "reason": "库存报告推荐箱线图分析分布"
    },
    "hr_performance": {
        # 人效报告: 多维对比、排名
        "priority_charts": ["radar", "bar_horizontal", "funnel"],
        "exclude_charts": [],
        "boost_priority": {"radar": 2, "bar_horizontal": 1},
        "reason": "人效报告推荐雷达图多维对比"
    },
    "general": {
        # 通用: 无特殊偏好
        "priority_charts": ["bar", "pareto", "boxplot", "scatter"],
        "exclude_charts": [],
        "boost_priority": {},
        "reason": "通用分析"
    }
}


def get_table_type_rules(table_type: Optional[str]) -> Dict[str, Any]:
    """Get chart rules for a given table type"""
    if not table_type:
        return TABLE_TYPE_CHART_RULES.get("general", {})
    # Normalize table type name
    normalized = table_type.lower().replace(" ", "_").replace("-", "_")
    return TABLE_TYPE_CHART_RULES.get(normalized, TABLE_TYPE_CHART_RULES.get("general", {}))


@dataclass
class DataProfile:
    """Data profile for chart recommendation"""
    row_count: int = 0
    has_time_dimension: bool = False
    time_column: Optional[str] = None
    has_category_dimension: bool = False
    category_column: Optional[str] = None
    category_count: int = 0
    has_hierarchy: bool = False
    hierarchy_columns: List[str] = field(default_factory=list)
    measure_columns: List[str] = field(default_factory=list)
    measure_count: int = 0
    is_composition_analysis: bool = False
    is_ranking_analysis: bool = False
    is_multi_dimension_score: bool = False
    needs_distribution_analysis: bool = False
    data_type: str = "general"  # general, sales, financial, hr, etc.


@dataclass
class ChartRecommendation:
    """Chart recommendation with reasoning"""
    chart_type: str
    reason: str
    config: Dict[str, Any]
    priority: int = 5  # 1-10, higher = more recommended
    suitable_for: List[str] = field(default_factory=list)


@dataclass
class ChartConfig:
    """Complete ECharts configuration"""
    chart_type: str
    title: str
    subtitle: Optional[str] = None
    x_axis: Dict[str, Any] = field(default_factory=dict)
    y_axis: Dict[str, Any] = field(default_factory=dict)
    series: List[Dict[str, Any]] = field(default_factory=list)
    legend: Dict[str, Any] = field(default_factory=dict)
    tooltip: Dict[str, Any] = field(default_factory=dict)
    grid: Dict[str, Any] = field(default_factory=dict)
    data_labels: List[str] = field(default_factory=list)
    raw_data: List[Dict[str, Any]] = field(default_factory=list)


def _safe_float(value) -> float:
    """Convert value to a JSON-safe float, replacing NaN/Inf/Excel errors with 0"""
    # Handle None
    if value is None:
        return 0.0

    # Handle Excel error values
    if isinstance(value, str):
        value_upper = value.strip().upper()
        if value_upper in ('#DIV/0!', '#N/A', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#NULL!', '-', ''):
            return 0.0

    try:
        f = float(value)
        if np.isnan(f) or np.isinf(f):
            return 0.0
        return f
    except (TypeError, ValueError):
        return 0.0


def _clean_numeric_column(series: pd.Series) -> pd.Series:
    """Clean a series to be numeric, handling Excel errors and non-numeric values"""
    # Excel error values to treat as NaN
    excel_errors = {'#DIV/0!', '#N/A', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#NULL!', '-', ''}

    def clean_value(v):
        if v is None:
            return np.nan
        if isinstance(v, str):
            v_upper = v.strip().upper()
            if v_upper in excel_errors:
                return np.nan
            # Try to parse numeric string
            try:
                return float(v.replace(',', '').replace('¥', '').replace('$', '').replace('%', ''))
            except (ValueError, TypeError):
                return np.nan
        try:
            return float(v)
        except (ValueError, TypeError):
            return np.nan

    return series.apply(clean_value)


def _clean_dataframe_for_charts(data: pd.DataFrame) -> pd.DataFrame:
    """
    Clean DataFrame for chart generation by:
    1. Replacing Excel error values with NaN
    2. Converting numeric columns to proper types
    3. Handling mixed-type columns (e.g., columns with Chinese month names mixed with numbers)
    """
    excel_errors = ['#DIV/0!', '#N/A', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#NULL!']

    df = data.copy()

    # Replace Excel errors with NaN across all columns
    for col in df.columns:
        df[col] = df[col].replace(excel_errors, np.nan)

    # Try to convert numeric columns
    for col in df.columns:
        try:
            # Check if column has any numeric values
            non_null = df[col].dropna()
            if len(non_null) > 0:
                sample = non_null.head(20)  # Larger sample for better detection
                numeric_count = sum(1 for v in sample if isinstance(v, (int, float)) or
                                   (isinstance(v, str) and _is_numeric_string(v)))

                # If at least 30% of sample is numeric, clean the column
                # (lower threshold to catch columns with mixed content)
                if numeric_count >= len(sample) * 0.3:
                    df[col] = _clean_numeric_column(df[col])
        except Exception:
            pass

    return df


def _is_numeric_string(s: str) -> bool:
    """Check if string represents a number"""
    try:
        float(s.replace(',', '').replace('¥', '').replace('$', '').replace('%', ''))
        return True
    except (ValueError, TypeError):
        return False


def _format_chart_title(title: str) -> str:
    """
    Format chart title for better readability.

    Transformations:
    1. Convert timestamps: "2025-01-01 00:00:00_预算数" → "2025年1月 预算"
    2. Remove excessive whitespace in Chinese text
    3. Simplify suffixes: _预算数 → 预算, _实际数 → 实际

    Args:
        title: Raw chart title

    Returns:
        Formatted chart title
    """
    import re

    if not title:
        return title

    # 1. Convert datetime timestamps to friendly format
    # Pattern: 2025-01-01 00:00:00 → 2025年1月
    def timestamp_to_chinese(match):
        year = match.group(1)
        month = int(match.group(2))
        return f"{year}年{month}月"

    title = re.sub(
        r'(\d{4})-(\d{2})-\d{2}\s+\d{2}:\d{2}:\d{2}',
        timestamp_to_chinese,
        title
    )

    # 2. Convert date-only format: 2025-01-01 → 2025年1月
    title = re.sub(
        r'(\d{4})-(\d{2})-\d{2}(?!\d)',
        timestamp_to_chinese,
        title
    )

    # 3. Remove excessive whitespace (common in Chinese text like "项　　　目")
    title = re.sub(r'[\s\u3000]+', '', title)

    # 4. Simplify common suffixes
    title = title.replace('_预算数', ' 预算').replace('_实际数', ' 实际')
    title = title.replace('_预算', ' 预算').replace('_实际', ' 实际')
    title = title.replace('预算数', '预算').replace('实际数', '实际')

    # 5. Clean up multiple spaces
    title = re.sub(r'\s+', ' ', title).strip()

    return title


def _safe_groupby_agg(data: pd.DataFrame, dim: str, measure: str, agg_func: str = 'sum') -> pd.DataFrame:
    """
    Safely aggregate data, handling the case where dimension and measure have the same name.

    Args:
        data: DataFrame to aggregate
        dim: Dimension column name (group by)
        measure: Measure column name (aggregate)
        agg_func: Aggregation function ('sum', 'mean', 'count', etc.)

    Returns:
        Aggregated DataFrame with 'dim' and 'value' columns, or empty DataFrame on error
    """
    try:
        # Skip if dimension and measure are the same column
        if dim == measure:
            return pd.DataFrame()

        # Skip if columns don't exist
        if dim not in data.columns or measure not in data.columns:
            return pd.DataFrame()

        # Create a working copy with cleaned numeric column
        work_data = data[[dim, measure]].copy()
        work_data[measure] = _clean_numeric_column(work_data[measure])

        # Drop rows with NaN in measure column
        work_data = work_data.dropna(subset=[measure])

        if work_data.empty:
            return pd.DataFrame()

        # Perform aggregation
        if agg_func == 'sum':
            agg_series = work_data.groupby(dim)[measure].sum()
        elif agg_func == 'mean':
            agg_series = work_data.groupby(dim)[measure].mean()
        elif agg_func == 'count':
            agg_series = work_data.groupby(dim)[measure].count()
        else:
            agg_series = work_data.groupby(dim)[measure].sum()

        # Convert to DataFrame with safe column names
        result = pd.DataFrame({
            'dim': agg_series.index,
            'value': agg_series.values
        })

        # Replace NaN/Inf values with 0 for JSON serialization safety
        result['value'] = result['value'].apply(_safe_float)

        return result

    except Exception as e:
        logger.warning(f"Safe groupby aggregation failed: {e}")
        return pd.DataFrame()


class ChartRecommendationEngine:
    """Intelligent chart recommendation engine"""

    def __init__(self):
        self.analyzer = StatisticalAnalyzer()

    def analyze_data_profile(
        self,
        data: pd.DataFrame,
        fields: List[Any]
    ) -> DataProfile:
        """Analyze data to create a profile for chart recommendation"""
        profile = DataProfile()
        profile.row_count = len(data)

        for field_def in fields:
            field_name = get_field_name(field_def)

            if is_field_time(field_def):
                profile.has_time_dimension = True
                profile.time_column = field_name

            elif is_field_dimension(field_def):
                profile.has_category_dimension = True
                if profile.category_column is None:
                    profile.category_column = field_name

                # Count unique values
                if field_name in data.columns:
                    unique_count = data[field_name].nunique()
                    profile.category_count = max(profile.category_count, unique_count)

            elif is_field_measure(field_def):
                profile.measure_columns.append(field_name)
                profile.measure_count += 1

        # Detect hierarchy (multiple dimensions)
        dimensions = [f for f in fields if is_field_dimension(f) and not is_field_time(f)]
        if len(dimensions) >= 2:
            profile.has_hierarchy = True
            profile.hierarchy_columns = [get_field_name(f) for f in dimensions]

        # Detect analysis type
        profile.is_composition_analysis = (
            profile.measure_count == 1 and
            profile.has_category_dimension and
            profile.category_count <= 15
        )

        profile.is_ranking_analysis = (
            profile.has_category_dimension and
            profile.measure_count >= 1
        )

        profile.is_multi_dimension_score = (
            profile.measure_count >= 3 and
            profile.category_count <= 10
        )

        profile.needs_distribution_analysis = (
            profile.row_count >= 20 and
            profile.measure_count >= 1
        )

        return profile

    def recommend(
        self,
        data: pd.DataFrame,
        profile: DataProfile,
        max_charts: int = 8
    ) -> List[ChartRecommendation]:
        """
        Recommend optimal chart types based on data profile.

        Args:
            data: DataFrame with the data
            profile: Data profile from analyze_data_profile
            max_charts: Maximum number of charts to recommend

        Returns:
            List of chart recommendations with configs
        """
        recommendations = []

        # 1. Time series → Line/Area chart (highest priority if time exists)
        if profile.has_time_dimension and profile.measure_count >= 1:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.LINE.value,
                reason="检测到时间维度，推荐折线图展示趋势",
                priority=9,
                config=self._build_line_config(data, profile),
                suitable_for=["trend", "time_series"]
            ))

            if profile.measure_count > 1:
                recommendations.append(ChartRecommendation(
                    chart_type=ChartType.AREA_STACKED.value,
                    reason="多指标时间序列，推荐堆叠面积图",
                    priority=7,
                    config=self._build_stacked_area_config(data, profile),
                    suitable_for=["trend", "composition"]
                ))

        # 2. Category + Value → Bar chart
        if profile.has_category_dimension and profile.measure_count >= 1:
            if profile.category_count <= 10:
                recommendations.append(ChartRecommendation(
                    chart_type=ChartType.BAR.value,
                    reason=f"{profile.category_count}个类别，推荐柱状图比较",
                    priority=8,
                    config=self._build_bar_config(data, profile),
                    suitable_for=["comparison", "ranking"]
                ))
            else:
                recommendations.append(ChartRecommendation(
                    chart_type=ChartType.BAR_HORIZONTAL.value,
                    reason=f"类别较多({profile.category_count}个)，推荐横向条形图",
                    priority=8,
                    config=self._build_horizontal_bar_config(data, profile),
                    suitable_for=["ranking"]
                ))

        # 3. Composition analysis → Pie/Donut/Treemap
        if profile.is_composition_analysis:
            if profile.category_count <= 6:
                recommendations.append(ChartRecommendation(
                    chart_type=ChartType.DONUT.value,
                    reason="占比分析，类别≤6个，推荐环形图",
                    priority=7,
                    config=self._build_donut_config(data, profile),
                    suitable_for=["composition", "share"]
                ))
            else:
                recommendations.append(ChartRecommendation(
                    chart_type=ChartType.TREEMAP.value,
                    reason="占比分析，类别较多，推荐矩形树图",
                    priority=6,
                    config=self._build_treemap_config(data, profile),
                    suitable_for=["composition", "hierarchy"]
                ))

        # 4. Hierarchy → Sunburst
        if profile.has_hierarchy:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.SUNBURST.value,
                reason="检测到层级结构，推荐旭日图展示",
                priority=6,
                config=self._build_sunburst_config(data, profile),
                suitable_for=["hierarchy", "drill_down"]
            ))

        # 5. Correlation analysis → Scatter
        if profile.measure_count >= 2:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.SCATTER.value,
                reason=f"多度量({profile.measure_count}个)，推荐散点图分析相关性",
                priority=5,
                config=self._build_scatter_config(data, profile),
                suitable_for=["correlation", "distribution"]
            ))

        # 6. Distribution analysis → Boxplot
        if profile.needs_distribution_analysis:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.BOXPLOT.value,
                reason="推荐箱线图展示数据分布特征",
                priority=4,
                config=self._build_boxplot_config(data, profile),
                suitable_for=["distribution", "outliers"]
            ))

        # 7. Ranking → Funnel
        if profile.is_ranking_analysis and profile.category_count <= 10:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.FUNNEL.value,
                reason="排名分析，推荐漏斗图",
                priority=5,
                config=self._build_funnel_config(data, profile),
                suitable_for=["ranking", "conversion"]
            ))

        # 8. Multi-dimension score → Radar
        if profile.is_multi_dimension_score:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.RADAR.value,
                reason="多维度评分，推荐雷达图",
                priority=5,
                config=self._build_radar_config(data, profile),
                suitable_for=["multi_dimension", "comparison"]
            ))

        # 9. Pareto analysis (if ranking)
        if profile.is_ranking_analysis and profile.category_count >= 5:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.PARETO.value,
                reason="推荐帕累托图分析80/20法则",
                priority=6,
                config=self._build_pareto_config(data, profile),
                suitable_for=["ranking", "pareto"]
            ))

        # 10. Waterfall chart for additive analysis
        if profile.measure_count == 1 and profile.category_count <= 12:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.WATERFALL.value,
                reason="推荐瀑布图展示增减变化",
                priority=4,
                config=self._build_waterfall_config(data, profile),
                suitable_for=["breakdown", "variance"]
            ))

        # 11. Ensure minimum 6 charts - add additional chart types if needed
        min_charts = 6
        if len(recommendations) < min_charts and profile.measure_count >= 1:
            # Build list of available dimension columns
            dim_columns = []
            if profile.category_column:
                dim_columns.append(profile.category_column)
            if profile.hierarchy_columns:
                for hc in profile.hierarchy_columns:
                    if hc not in dim_columns:
                        dim_columns.append(hc)
            if profile.time_column and profile.time_column not in dim_columns:
                dim_columns.append(profile.time_column)

            # Add additional dimension × measure combinations
            for dim_col in dim_columns[:3]:
                if len(recommendations) >= min_charts:
                    break
                for measure_col in profile.measure_columns[:3]:
                    if len(recommendations) >= min_charts:
                        break
                    # Check if this combination already exists
                    existing = any(
                        r.config and r.config.get('xAxis', {}).get('field') == dim_col and
                        any(s.get('field') == measure_col for s in r.config.get('series', []))
                        for r in recommendations if r.config
                    )
                    if not existing:
                        # Add bar chart for this combination
                        config = self._build_simple_bar_config(data, dim_col, measure_col)
                        if config:
                            recommendations.append(ChartRecommendation(
                                chart_type=ChartType.BAR.value,
                                reason=f"{measure_col} by {dim_col}",
                                priority=3,
                                config=config,
                                suitable_for=["comparison"]
                            ))

            # Add pie chart if still need more
            if len(recommendations) < min_charts and dim_columns and profile.measure_columns:
                dim_col = dim_columns[0]
                measure_col = profile.measure_columns[0]
                config = self._build_simple_pie_config(data, dim_col, measure_col)
                if config:
                    recommendations.append(ChartRecommendation(
                        chart_type=ChartType.PIE.value,
                        reason=f"{measure_col} 构成分析 by {dim_col}",
                        priority=3,
                        config=config,
                        suitable_for=["composition"]
                    ))

            # Add horizontal bar if still need more (Top N analysis)
            if len(recommendations) < min_charts and dim_columns and profile.measure_columns:
                dim_col = dim_columns[0]
                measure_col = profile.measure_columns[0]
                config = self._build_simple_horizontal_bar_config(data, dim_col, measure_col, top_n=15)
                if config:
                    recommendations.append(ChartRecommendation(
                        chart_type=ChartType.BAR_HORIZONTAL.value,
                        reason=f"{measure_col} Top 15 by {dim_col}",
                        priority=3,
                        config=config,
                        suitable_for=["ranking"]
                    ))

            # Add grouped bar chart if still need more (multi-measure comparison)
            if len(recommendations) < min_charts and dim_columns and len(profile.measure_columns) >= 2:
                dim_col = dim_columns[0]
                config = self._build_grouped_bar_config(data, dim_col, profile.measure_columns[:3])
                if config:
                    recommendations.append(ChartRecommendation(
                        chart_type=ChartType.BAR_GROUPED.value,
                        reason=f"多指标对比 by {dim_col}",
                        priority=3,
                        config=config,
                        suitable_for=["comparison", "multi_measure"]
                    ))

            # Add area chart if still need more (trend analysis)
            if len(recommendations) < min_charts and profile.time_column and profile.measure_columns:
                measure_col = profile.measure_columns[0]
                config = self._build_simple_area_config(data, profile.time_column, measure_col)
                if config:
                    recommendations.append(ChartRecommendation(
                        chart_type=ChartType.AREA.value,
                        reason=f"{measure_col} 趋势面积图",
                        priority=3,
                        config=config,
                        suitable_for=["trend"]
                    ))

        # Sort by priority and limit
        recommendations.sort(key=lambda x: x.priority, reverse=True)
        return recommendations[:max_charts]

    def _build_line_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build line chart configuration"""
        if not profile.time_column or not profile.measure_columns:
            return {}

        time_col = profile.time_column
        measure = profile.measure_columns[0]

        # Aggregate by time
        agg_data = _safe_groupby_agg(data, time_col, measure, 'sum')
        if agg_data.empty:
            return {}

        agg_data = agg_data.sort_values('dim')

        return {
            "chartType": ChartType.LINE.value.upper(),
            "title": _format_chart_title(f"{measure} 趋势"),
            "xAxis": {
                "field": time_col,
                "type": "category",
                "data": agg_data['dim'].astype(str).tolist()
            },
            "yAxis": {"field": measure, "type": "value"},
            "series": [{
                "name": measure,
                "type": "line",
                "data": agg_data['value'].tolist(),
                "smooth": True
            }]
        }

    def _build_stacked_area_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build stacked area chart configuration"""
        if not profile.time_column or len(profile.measure_columns) < 2:
            return {}

        time_col = profile.time_column
        # Filter out measures that conflict with time column
        measures = [m for m in profile.measure_columns[:3] if m != time_col and m in data.columns]

        if len(measures) < 2:
            return {}

        try:
            agg_data = data.groupby(time_col)[measures].sum().reset_index()
            agg_data = agg_data.sort_values(time_col)

            series = []
            for measure in measures:
                series.append({
                    "name": measure,
                    "type": "line",
                    "areaStyle": {},
                    "stack": "total",
                    "data": agg_data[measure].tolist()
                })

            return {
                "chartType": ChartType.AREA_STACKED.value.upper(),
                "title": "多指标趋势对比",
                "xAxis": {
                    "field": time_col,
                    "type": "category",
                    "data": agg_data[time_col].astype(str).tolist()
                },
                "yAxis": {"type": "value"},
                "series": series
            }
        except Exception:
            return {}

    def _build_bar_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build bar chart configuration"""
        if not profile.category_column or not profile.measure_columns:
            return {}

        dim = profile.category_column
        measure = profile.measure_columns[0]

        agg_data = _safe_groupby_agg(data, dim, measure, 'sum')
        if agg_data.empty:
            return {}

        agg_data = agg_data.sort_values('value', ascending=False)

        return {
            "chartType": ChartType.BAR.value.upper(),
            "title": f"{measure} by {dim}",
            "xAxis": {
                "field": dim,
                "type": "category",
                "data": agg_data['dim'].astype(str).tolist()
            },
            "yAxis": {"field": measure, "type": "value"},
            "series": [{
                "name": measure,
                "type": "bar",
                "data": agg_data['value'].tolist()
            }]
        }

    def _build_horizontal_bar_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build horizontal bar chart configuration"""
        if not profile.category_column or not profile.measure_columns:
            return {}

        dim = profile.category_column
        measure = profile.measure_columns[0]

        agg_data = _safe_groupby_agg(data, dim, measure, 'sum')
        if agg_data.empty:
            return {}

        agg_data = agg_data.sort_values('value', ascending=True).tail(15)

        return {
            "chartType": ChartType.BAR_HORIZONTAL.value.upper(),
            "title": f"{measure} Top 15 by {dim}",
            "xAxis": {"field": measure, "type": "value"},
            "yAxis": {
                "field": dim,
                "type": "category",
                "data": agg_data['dim'].astype(str).tolist()
            },
            "series": [{
                "name": measure,
                "type": "bar",
                "data": agg_data['value'].tolist()
            }]
        }

    def _build_donut_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build donut chart configuration"""
        if not profile.category_column or not profile.measure_columns:
            return {}

        dim = profile.category_column
        measure = profile.measure_columns[0]

        agg_data = _safe_groupby_agg(data, dim, measure, 'sum')
        if agg_data.empty:
            return {}

        agg_data = agg_data.sort_values('value', ascending=False)

        pie_data = [
            {"name": str(row['dim']), "value": _safe_float(row['value'])}
            for _, row in agg_data.iterrows()
        ]

        return {
            "chartType": ChartType.DONUT.value.upper(),
            "title": f"{measure} 占比分布",
            "series": [{
                "name": measure,
                "type": "pie",
                "radius": ["40%", "70%"],
                "data": pie_data
            }]
        }

    def _build_treemap_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build treemap chart configuration"""
        if not profile.category_column or not profile.measure_columns:
            return {}

        dim = profile.category_column
        measure = profile.measure_columns[0]

        agg_data = _safe_groupby_agg(data, dim, measure, 'sum')
        if agg_data.empty:
            return {}

        agg_data = agg_data.sort_values('value', ascending=False)

        treemap_data = [
            {"name": str(row['dim']), "value": _safe_float(row['value'])}
            for _, row in agg_data.iterrows()
        ]

        return {
            "chartType": ChartType.TREEMAP.value.upper(),
            "title": f"{measure} 构成分析",
            "series": [{
                "name": measure,
                "type": "treemap",
                "data": treemap_data
            }]
        }

    def _build_sunburst_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build sunburst chart configuration for hierarchical data"""
        if len(profile.hierarchy_columns) < 2 or not profile.measure_columns:
            return {}

        measure = profile.measure_columns[0]
        level1 = profile.hierarchy_columns[0]
        level2 = profile.hierarchy_columns[1]

        # Build hierarchical data
        sunburst_data = []
        # Clean measure column first
        data_clean = data.copy()
        data_clean[measure] = _clean_numeric_column(data_clean[measure])

        for val1 in data_clean[level1].unique():
            subset = data_clean[data_clean[level1] == val1]
            children = []
            for val2 in subset[level2].unique():
                sub_subset = subset[subset[level2] == val2]
                children.append({
                    "name": str(val2),
                    "value": _safe_float(sub_subset[measure].sum())
                })
            sunburst_data.append({
                "name": str(val1),
                "children": children
            })

        return {
            "chartType": ChartType.SUNBURST.value.upper(),
            "title": f"{measure} 层级分析",
            "series": [{
                "type": "sunburst",
                "data": sunburst_data,
                "radius": ["15%", "80%"]
            }]
        }

    def _build_scatter_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build scatter chart configuration"""
        if len(profile.measure_columns) < 2:
            return {}

        # Get unique measure columns
        unique_measures = list(dict.fromkeys(profile.measure_columns))
        if len(unique_measures) < 2:
            return {}

        x_measure = unique_measures[0]
        y_measure = unique_measures[1]

        # Skip if columns don't exist
        if x_measure not in data.columns or y_measure not in data.columns:
            return {}

        try:
            scatter_data = data[[x_measure, y_measure]].dropna().values.tolist()
        except Exception:
            return {}

        return {
            "chartType": ChartType.SCATTER.value.upper(),
            "title": f"{x_measure} vs {y_measure}",
            "xAxis": {"field": x_measure, "type": "value", "name": x_measure},
            "yAxis": {"field": y_measure, "type": "value", "name": y_measure},
            "series": [{
                "name": "数据点",
                "type": "scatter",
                "data": scatter_data
            }]
        }

    def _build_boxplot_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build boxplot chart configuration"""
        if not profile.measure_columns:
            return {}

        measure = profile.measure_columns[0]
        if measure not in data.columns:
            return {}

        try:
            values = data[measure].dropna()
            if len(values) < 5:
                return {}

            # Calculate boxplot statistics
            q1 = _safe_float(values.quantile(0.25))
            q2 = _safe_float(values.quantile(0.50))
            q3 = _safe_float(values.quantile(0.75))
            min_val = _safe_float(values.min())
            max_val = _safe_float(values.max())

            return {
                "chartType": ChartType.BOXPLOT.value.upper(),
                "title": f"{measure} 分布",
                "xAxis": {"type": "category", "data": [measure]},
                "yAxis": {"type": "value"},
                "series": [{
                    "name": "boxplot",
                    "type": "boxplot",
                    "data": [[min_val, q1, q2, q3, max_val]]
                }]
            }
        except Exception:
            return {}

    def _build_funnel_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build funnel chart configuration"""
        if not profile.category_column or not profile.measure_columns:
            return {}

        dim = profile.category_column
        measure = profile.measure_columns[0]

        agg_data = _safe_groupby_agg(data, dim, measure, 'sum')
        if agg_data.empty:
            return {}

        agg_data = agg_data.sort_values('value', ascending=False)

        funnel_data = [
            {"name": str(row['dim']), "value": _safe_float(row['value'])}
            for _, row in agg_data.head(10).iterrows()
        ]

        return {
            "chartType": ChartType.FUNNEL.value.upper(),
            "title": f"{measure} 排名",
            "series": [{
                "name": measure,
                "type": "funnel",
                "data": funnel_data,
                "sort": "descending"
            }]
        }

    def _build_radar_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build radar chart configuration"""
        if len(profile.measure_columns) < 3:
            return {}

        # Get unique measures that exist in data
        unique_measures = []
        seen = set()
        for m in profile.measure_columns[:6]:
            if m not in seen and m in data.columns:
                unique_measures.append(m)
                seen.add(m)

        if len(unique_measures) < 3:
            return {}

        try:
            # Normalize values for radar
            radar_data = []
            indicator = []

            for measure in unique_measures:
                max_val = _safe_float(data[measure].max())
                if max_val <= 0:
                    max_val = 1.0
                avg_val = _safe_float(data[measure].mean())
                indicator.append({"name": measure, "max": max_val})
                radar_data.append(avg_val)

            return {
                "chartType": ChartType.RADAR.value.upper(),
                "title": "多维度分析",
                "radar": {"indicator": indicator},
                "series": [{
                    "name": "平均值",
                    "type": "radar",
                    "data": [{"value": radar_data, "name": "平均值"}]
                }]
            }
        except Exception:
            return {}

    def _build_pareto_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build Pareto chart configuration (bar + cumulative line)"""
        if not profile.category_column or not profile.measure_columns:
            return {}

        dim = profile.category_column
        measure = profile.measure_columns[0]

        agg_data = _safe_groupby_agg(data, dim, measure, 'sum')
        if agg_data.empty:
            return {}

        agg_data = agg_data.sort_values('value', ascending=False)
        total = agg_data['value'].sum()

        # Calculate cumulative percentage
        agg_data['cumulative'] = (agg_data['value'].cumsum() / total * 100).round(1)

        return {
            "chartType": ChartType.PARETO.value.upper(),
            "title": f"{measure} 帕累托分析",
            "xAxis": {
                "field": dim,
                "type": "category",
                "data": agg_data['dim'].astype(str).tolist()
            },
            "yAxis": [
                {"field": measure, "type": "value", "position": "left"},
                {"type": "value", "position": "right", "max": 100, "name": "累计%"}
            ],
            "series": [
                {
                    "name": measure,
                    "type": "bar",
                    "data": agg_data['value'].tolist()
                },
                {
                    "name": "累计占比",
                    "type": "line",
                    "yAxisIndex": 1,
                    "data": agg_data['cumulative'].tolist()
                }
            ]
        }

    def _build_waterfall_config(self, data: pd.DataFrame, profile: DataProfile) -> Dict[str, Any]:
        """Build waterfall chart configuration"""
        if not profile.category_column or not profile.measure_columns:
            return {}

        dim = profile.category_column
        measure = profile.measure_columns[0]

        agg_data = _safe_groupby_agg(data, dim, measure, 'sum')
        if agg_data.empty:
            return {}

        agg_data = agg_data.sort_values('value', ascending=False)

        categories = agg_data['dim'].astype(str).tolist()
        values = agg_data['value'].tolist()

        # Add total
        categories.append("合计")
        total_val = sum(values)

        # Build waterfall data
        waterfall_data = []
        cumulative = 0
        for val in values:
            waterfall_data.append({
                "value": val,
                "itemStyle": {"color": "#91cc75" if val >= 0 else "#ee6666"}
            })
            cumulative += val

        waterfall_data.append({
            "value": total_val,
            "itemStyle": {"color": "#5470c6"}
        })

        return {
            "chartType": ChartType.WATERFALL.value.upper(),
            "title": f"{measure} 构成分解",
            "xAxis": {"type": "category", "data": categories},
            "yAxis": {"type": "value"},
            "series": [{
                "name": measure,
                "type": "bar",
                "data": waterfall_data
            }]
        }

    def _build_simple_bar_config(self, data: pd.DataFrame, dim_col: str, measure_col: str) -> Dict[str, Any]:
        """Build a simple bar chart for dimension × measure combination"""
        try:
            agg_data = _safe_groupby_agg(data, dim_col, measure_col, 'sum')
            if agg_data.empty:
                return {}

            agg_data = agg_data.sort_values('value', ascending=False).head(15)

            return {
                "chartType": ChartType.BAR.value.upper(),
                "title": f"{measure_col} by {dim_col}",
                "xAxis": {
                    "field": dim_col,
                    "type": "category",
                    "data": agg_data['dim'].astype(str).tolist()
                },
                "yAxis": [{"field": measure_col, "type": "value"}],
                "series": [{
                    "name": measure_col,
                    "field": measure_col,
                    "type": "bar",
                    "data": [{"name": str(row['dim']), "value": _safe_float(row['value'])}
                            for _, row in agg_data.iterrows()]
                }]
            }
        except Exception:
            return {}

    def _build_simple_pie_config(self, data: pd.DataFrame, dim_col: str, measure_col: str) -> Dict[str, Any]:
        """Build a simple pie chart for dimension × measure combination"""
        try:
            agg_data = _safe_groupby_agg(data, dim_col, measure_col, 'sum')
            if agg_data.empty:
                return {}

            agg_data = agg_data.sort_values('value', ascending=False).head(10)

            return {
                "chartType": ChartType.PIE.value.upper(),
                "title": f"{measure_col} 构成分析",
                "series": [{
                    "name": measure_col,
                    "type": "pie",
                    "radius": ["40%", "70%"],
                    "data": [{"name": str(row['dim']), "value": _safe_float(row['value'])}
                            for _, row in agg_data.iterrows()]
                }]
            }
        except Exception:
            return {}

    def _build_simple_horizontal_bar_config(self, data: pd.DataFrame, dim_col: str, measure_col: str, top_n: int = 15) -> Dict[str, Any]:
        """Build a simple horizontal bar chart for Top N analysis"""
        try:
            agg_data = _safe_groupby_agg(data, dim_col, measure_col, 'sum')
            if agg_data.empty:
                return {}

            agg_data = agg_data.sort_values('value', ascending=True).tail(top_n)

            return {
                "chartType": ChartType.BAR_HORIZONTAL.value.upper(),
                "title": f"{measure_col} Top {top_n} by {dim_col}",
                "xAxis": {"field": measure_col, "type": "value"},
                "yAxis": {
                    "field": dim_col,
                    "type": "category",
                    "data": agg_data['dim'].astype(str).tolist()
                },
                "series": [{
                    "name": measure_col,
                    "field": measure_col,
                    "type": "bar",
                    "data": [{"name": str(row['dim']), "value": _safe_float(row['value'])}
                            for _, row in agg_data.iterrows()]
                }]
            }
        except Exception:
            return {}

    def _build_grouped_bar_config(self, data: pd.DataFrame, dim_col: str, measure_cols: List[str]) -> Dict[str, Any]:
        """Build a grouped bar chart for multi-measure comparison"""
        try:
            if dim_col not in data.columns:
                return {}

            # Filter out measure columns that conflict with dim_col
            valid_measures = [m for m in measure_cols if m != dim_col and m in data.columns]
            if not valid_measures:
                return {}

            # Aggregate by dimension for each measure
            agg_data = data.groupby(dim_col)[valid_measures].sum().reset_index()
            agg_data = agg_data.head(15)  # Limit categories
            if agg_data.empty:
                return {}

            series = []
            for measure_col in valid_measures:
                if measure_col in agg_data.columns:
                    series.append({
                        "name": measure_col,
                        "type": "bar",
                        "data": agg_data[measure_col].tolist()
                    })

            if not series:
                return {}

            return {
                "chartType": ChartType.BAR_GROUPED.value.upper(),
                "title": f"多指标对比 by {dim_col}",
                "xAxis": {
                    "field": dim_col,
                    "type": "category",
                    "data": agg_data[dim_col].astype(str).tolist()
                },
                "yAxis": {"type": "value"},
                "series": series
            }
        except Exception:
            return {}

    def _build_simple_area_config(self, data: pd.DataFrame, time_col: str, measure_col: str) -> Dict[str, Any]:
        """Build a simple area chart for trend analysis"""
        try:
            agg_data = _safe_groupby_agg(data, time_col, measure_col, 'sum')
            if agg_data.empty:
                return {}

            # Sort by time dimension (stored in 'dim' column)
            agg_data = agg_data.sort_values('dim')

            return {
                "chartType": ChartType.AREA.value.upper(),
                "title": f"{measure_col} 趋势",
                "xAxis": {
                    "field": time_col,
                    "type": "category",
                    "data": agg_data['dim'].astype(str).tolist()
                },
                "yAxis": {"field": measure_col, "type": "value"},
                "series": [{
                    "name": measure_col,
                    "type": "line",
                    "areaStyle": {},
                    "smooth": True,
                    "data": agg_data['value'].tolist()
                }]
            }
        except Exception:
            return {}


class ChartGenerator:
    """Main chart generation service"""

    def __init__(self):
        self.recommendation_engine = ChartRecommendationEngine()
        self.analyzer = StatisticalAnalyzer()

    def generate_charts_for_sheet(
        self,
        data: pd.DataFrame,
        fields: List[Any],
        sheet_name: str = "Sheet1",
        max_charts: int = 8,
        table_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate optimal charts for a sheet of data.

        Args:
            data: DataFrame with the sheet data
            fields: List of field definitions
            sheet_name: Name of the sheet
            max_charts: Maximum number of charts to generate
            table_type: Detected table type (profit_table, finance_summary, etc.)

        Returns:
            List of chart configurations
        """
        # Clean data for chart generation (handle Excel errors etc.)
        data = _clean_dataframe_for_charts(data)

        # Analyze data profile
        profile = self.recommendation_engine.analyze_data_profile(data, fields)

        # Get table type chart rules
        type_rules = get_table_type_rules(table_type)
        if table_type:
            logger.info(f"Applying table type rules for '{table_type}': {type_rules.get('reason', 'N/A')}")

        # Check for wide table (many measures, few dimensions)
        # Wide table: > 20 measures and dimensions / measures ratio < 0.2
        dimensions = [f for f in fields if is_field_dimension(f)]
        measures = [f for f in fields if is_field_measure(f)]

        is_wide_table = (
            profile.measure_count > 20 and
            len(dimensions) <= 3 and
            (len(dimensions) / max(profile.measure_count, 1)) < 0.2
        )

        if is_wide_table:
            logger.info(f"Detected wide table: {profile.measure_count} measures, {len(dimensions)} dimensions")
            # Use specialized wide table chart generation
            wide_charts = self.generate_charts_for_wide_table(data, fields, sheet_name, max_charts)
            if wide_charts:
                return wide_charts
            # Fall back to standard if wide table generation fails
            logger.info("Wide table generation returned empty, falling back to standard")

        # Get recommendations
        recommendations = self.recommendation_engine.recommend(data, profile, max_charts * 2)  # Get more for filtering

        # Apply table type rules: boost priorities and filter excluded charts
        exclude_charts = set(type_rules.get("exclude_charts", []))
        boost_priority = type_rules.get("boost_priority", {})

        for rec in recommendations:
            chart_type = rec.chart_type.lower() if isinstance(rec.chart_type, str) else rec.chart_type
            # Boost priority based on table type
            if chart_type in boost_priority:
                rec.priority += boost_priority[chart_type]

        # Filter out excluded chart types
        filtered_recommendations = [
            rec for rec in recommendations
            if (rec.chart_type.lower() if isinstance(rec.chart_type, str) else rec.chart_type) not in exclude_charts
        ]

        # Re-sort by adjusted priority
        filtered_recommendations.sort(key=lambda x: x.priority, reverse=True)

        # Convert to chart configs
        charts = []
        for rec in filtered_recommendations[:max_charts]:
            if rec.config:
                config = rec.config.copy()
                # Apply title formatting to clean timestamps and whitespace
                if 'title' in config:
                    config['title'] = _format_chart_title(config['title'])
                config['recommendation_reason'] = rec.reason
                config['suitable_for'] = rec.suitable_for
                charts.append(config)

        return charts

    def generate_drilldown_charts(
        self,
        data: pd.DataFrame,
        fields: List[Any],
        parent_dim: str,
        parent_value: str
    ) -> List[Dict[str, Any]]:
        """
        Generate charts for drill-down view.

        Args:
            data: Filtered DataFrame for the drill-down
            fields: Field definitions
            parent_dim: Parent dimension name
            parent_value: Parent dimension value being drilled into

        Returns:
            List of chart configurations for drill-down view
        """
        # Get sub-dimensions (exclude the parent dimension)
        dimensions = [
            f for f in fields
            if is_field_dimension(f) and get_field_name(f) != parent_dim
        ]
        measures = [f for f in fields if is_field_measure(f)]

        charts = []

        if not measures:
            return charts

        primary_measure = get_field_name(measures[0])

        # Clean primary measure column once for all charts
        if primary_measure in data.columns:
            data = data.copy()
            data[primary_measure] = _clean_numeric_column(data[primary_measure])

        # 1. Sub-dimension bar chart
        if dimensions:
            sub_dim = get_field_name(dimensions[0])
            if sub_dim in data.columns and primary_measure in data.columns:
                try:
                    agg_data = data.groupby(sub_dim)[primary_measure].sum().sort_values(ascending=False)
                    charts.append({
                        "chartType": "BAR",
                        "title": f"{parent_value} - {primary_measure} by {sub_dim}",
                        "xAxis": {"type": "category", "data": agg_data.index.astype(str).tolist()},
                        "yAxis": {"type": "value"},
                        "series": [{"type": "bar", "data": [_safe_float(v) for v in agg_data.tolist()]}]
                    })
                except Exception as e:
                    logger.debug(f"Skipping bar chart: {e}")

        # 2. Composition pie chart
        if dimensions:
            sub_dim = get_field_name(dimensions[0])
            if sub_dim in data.columns and primary_measure in data.columns:
                try:
                    agg_data = data.groupby(sub_dim)[primary_measure].sum()
                    pie_data = [
                        {"name": str(k), "value": _safe_float(v)}
                        for k, v in agg_data.items()
                    ]
                    charts.append({
                        "chartType": "PIE",
                        "title": f"{parent_value} - {primary_measure} 占比",
                        "series": [{
                            "type": "pie",
                            "radius": ["30%", "60%"],
                            "data": pie_data
                        }]
                    })
                except Exception as e:
                    logger.debug(f"Skipping pie chart: {e}")

        # 3. Distribution boxplot
        if primary_measure in data.columns:
            values = _clean_numeric_column(data[primary_measure]).dropna()
            if len(values) >= 5:
                try:
                    q1, q2, q3 = values.quantile([0.25, 0.5, 0.75])
                    charts.append({
                        "chartType": "BOXPLOT",
                        "title": f"{parent_value} - {primary_measure} 分布",
                        "xAxis": {"type": "category", "data": [primary_measure]},
                        "yAxis": {"type": "value"},
                        "series": [{
                            "type": "boxplot",
                            "data": [[
                                _safe_float(values.min()),
                                _safe_float(q1),
                                _safe_float(q2),
                                _safe_float(q3),
                                _safe_float(values.max())
                            ]]
                        }]
                    })
                except Exception as e:
                    logger.debug(f"Skipping boxplot for {primary_measure}: {e}")

        # 4. Scatter plot (if multiple measures)
        if len(measures) >= 2:
            m1 = get_field_name(measures[0])
            m2 = get_field_name(measures[1])
            if m1 in data.columns and m2 in data.columns:
                try:
                    scatter_df = data[[m1, m2]].copy()
                    scatter_df[m1] = _clean_numeric_column(scatter_df[m1])
                    scatter_df[m2] = _clean_numeric_column(scatter_df[m2])
                    scatter_df = scatter_df.dropna()
                    if len(scatter_df) > 0:
                        scatter_data = [[_safe_float(row[m1]), _safe_float(row[m2])]
                                       for _, row in scatter_df.head(500).iterrows()]
                        charts.append({
                            "chartType": "SCATTER",
                            "title": f"{parent_value} - {m1} vs {m2}",
                            "xAxis": {"type": "value", "name": m1},
                            "yAxis": {"type": "value", "name": m2},
                            "series": [{"type": "scatter", "data": scatter_data}]
                        })
                except Exception as e:
                    logger.debug(f"Skipping scatter plot: {e}")

        return charts[:6]  # Limit to 6 drill-down charts

    def generate_charts_for_wide_table(
        self,
        data: pd.DataFrame,
        fields: List[Any],
        sheet_name: str = "Sheet1",
        max_charts: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Generate charts for wide tables (100+ columns, few dimensions).

        Strategy:
        1. Group measures by prefix/suffix patterns (e.g., "1月_收入", "2月_收入" → "收入" group)
        2. Create multi-line/bar charts for each group
        3. Generate summary charts for top measures

        Args:
            data: DataFrame with the sheet data
            fields: List of field definitions
            sheet_name: Name of the sheet
            max_charts: Maximum number of charts to generate

        Returns:
            List of chart configurations
        """
        charts = []

        # Separate dimensions and measures
        dimensions = [f for f in fields if is_field_dimension(f) and not is_field_time(f)]
        measures = [f for f in fields if is_field_measure(f)]

        if not measures:
            return charts

        # Get dimension column (use first one if exists)
        dim_col = None
        if dimensions:
            dim_col = get_field_name(dimensions[0])
            if dim_col not in data.columns:
                dim_col = None

        # 1. Group measures by prefix/suffix patterns
        measure_groups = self._group_measures_by_pattern(measures)

        logger.info(f"Wide table analysis: {len(measures)} measures grouped into {len(measure_groups)} groups")

        # 2. Generate charts for each measure group
        for group_name, group_measures in list(measure_groups.items())[:max_charts - 1]:
            if len(group_measures) >= 2:
                # Multi-line/bar chart for the group
                chart = self._create_grouped_measure_chart(
                    data, dim_col, group_measures[:10],  # Max 10 measures per chart
                    title=_format_chart_title(f"{group_name} 趋势对比")
                )
                if chart:
                    charts.append(chart)

        # 3. Top measures summary bar chart
        if len(measures) > 5:
            top_measures_chart = self._create_top_measures_chart(data, measures[:20])
            if top_measures_chart:
                charts.append(top_measures_chart)

        # 4. If we have dimensions, add dimension-based analysis
        if dim_col and measures:
            measure_col = get_field_name(measures[0])
            if measure_col in data.columns:
                dim_chart = self._build_simple_bar_config(data, dim_col, measure_col)
                if dim_chart:
                    # Apply title formatting
                    if 'title' in dim_chart:
                        dim_chart['title'] = _format_chart_title(dim_chart['title'])
                    dim_chart['recommendation_reason'] = _format_chart_title(f"按{dim_col}分析{measure_col}")
                    charts.append(dim_chart)

        # Apply title formatting to all charts before returning
        for chart in charts:
            if 'title' in chart:
                chart['title'] = _format_chart_title(chart['title'])

        return charts[:max_charts]

    def _group_measures_by_pattern(self, measures: List[Any]) -> Dict[str, List[str]]:
        """
        Group measures by common patterns (prefixes/suffixes).

        Example: "1月_收入", "2月_收入", "3月_收入" → {"收入": ["1月_收入", "2月_收入", "3月_收入"]}
        """
        import re

        groups: Dict[str, List[str]] = {}
        measure_names = [get_field_name(m) for m in measures]

        # Common separators
        sep_pattern = r'[_\-/\s]'

        for name in measure_names:
            parts = re.split(sep_pattern, name)
            if len(parts) >= 2:
                # Try suffix as group key (e.g., "收入" from "1月_收入")
                suffix = parts[-1]
                # Try prefix as group key (e.g., "毛利" from "毛利_1月")
                prefix = parts[0]

                # Prefer longer group names
                group_key = suffix if len(suffix) >= len(prefix) else prefix

                if len(group_key) >= 2:  # Minimum 2 chars for group name
                    if group_key not in groups:
                        groups[group_key] = []
                    groups[group_key].append(name)
            else:
                # No separator, use first 4 chars as group
                group_key = name[:4] if len(name) >= 4 else name
                if group_key not in groups:
                    groups[group_key] = []
                groups[group_key].append(name)

        # Filter out groups with only 1 member
        groups = {k: v for k, v in groups.items() if len(v) >= 2}

        # Sort by group size (descending)
        groups = dict(sorted(groups.items(), key=lambda x: len(x[1]), reverse=True))

        return groups

    def _create_grouped_measure_chart(
        self,
        data: pd.DataFrame,
        dim_col: Optional[str],
        measure_names: List[str],
        title: str
    ) -> Optional[Dict[str, Any]]:
        """Create a grouped bar/line chart for multiple measures"""
        try:
            # Filter valid measure columns - only those that can be converted to numeric
            valid_measures = []
            for m in measure_names:
                if m in data.columns:
                    # Check if column has numeric data
                    col_cleaned = _clean_numeric_column(data[m])
                    if col_cleaned.notna().sum() > 0:
                        valid_measures.append(m)

            if len(valid_measures) < 2:
                return None

            # Clean the measure columns before aggregation
            clean_data = data.copy()
            for m in valid_measures:
                clean_data[m] = _clean_numeric_column(clean_data[m])

            if dim_col and dim_col in clean_data.columns:
                # Aggregate by dimension
                agg_data = clean_data.groupby(dim_col)[valid_measures].sum().reset_index()
                agg_data = agg_data.head(15)  # Limit categories
                x_data = agg_data[dim_col].astype(str).tolist()
            else:
                # Use row index as x-axis
                agg_data = clean_data[valid_measures].head(30)
                x_data = [str(i) for i in range(len(agg_data))]

            series = []
            for measure in valid_measures:
                values = agg_data[measure].apply(_safe_float).tolist()
                series.append({
                    "name": measure,
                    "type": "bar",
                    "data": values
                })

            return {
                "chartType": "BAR_GROUPED",
                "title": title,
                "xAxis": {"type": "category", "data": x_data},
                "yAxis": {"type": "value"},
                "series": series,
                "recommendation_reason": f"多指标对比分析 ({len(valid_measures)} 个指标)"
            }
        except Exception as e:
            logger.warning(f"Failed to create grouped measure chart: {e}")
            return None

    def _create_top_measures_chart(
        self,
        data: pd.DataFrame,
        measures: List[Any]
    ) -> Optional[Dict[str, Any]]:
        """Create a summary bar chart showing top measures by total value"""
        try:
            # Calculate totals for each measure
            totals = []
            for m in measures:
                name = get_field_name(m)
                if name in data.columns:
                    total = _safe_float(data[name].sum())
                    totals.append({"name": name, "value": abs(total)})

            if not totals:
                return None

            # Sort by value and take top 15
            totals.sort(key=lambda x: x["value"], reverse=True)
            top_totals = totals[:15]

            return {
                "chartType": "BAR_HORIZONTAL",
                "title": "Top 15 指标汇总",
                "xAxis": {"type": "value"},
                "yAxis": {
                    "type": "category",
                    "data": [t["name"] for t in reversed(top_totals)]
                },
                "series": [{
                    "name": "汇总值",
                    "type": "bar",
                    "data": [t["value"] for t in reversed(top_totals)]
                }],
                "recommendation_reason": "指标汇总排名"
            }
        except Exception as e:
            logger.warning(f"Failed to create top measures chart: {e}")
            return None

    def _build_simple_bar_config(self, data: pd.DataFrame, dim_col: str, measure_col: str) -> Optional[Dict[str, Any]]:
        """Build a simple bar chart (delegating to recommendation engine)"""
        return self.recommendation_engine._build_simple_bar_config(data, dim_col, measure_col)


# Helper function for quick chart generation
def quick_charts(
    data: pd.DataFrame,
    fields: List[Any],
    max_charts: int = 6
) -> List[Dict[str, Any]]:
    """Quick chart generation helper"""
    generator = ChartGenerator()
    return generator.generate_charts_for_sheet(data, fields, max_charts=max_charts)
