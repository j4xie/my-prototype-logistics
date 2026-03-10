from __future__ import annotations
"""
Chart Builder Service

Builds ECharts configuration from data and chart specifications.
"""
import logging
from typing import Any, Optional, List, Dict
from enum import Enum

import math
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


def _sanitize_for_json(obj):
    """Replace NaN/Infinity/-Infinity and non-serializable types with JSON-safe values.

    NaN → None (JSON null) so frontend can distinguish missing data from zero.
    Infinity → None (not a valid chart value).
    """
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, pd.Series):
        return [_sanitize_for_json(item) for item in obj.tolist()]
    if isinstance(obj, np.ndarray):
        return [_sanitize_for_json(item) for item in obj.tolist()]
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(item) for item in obj]
    if obj is pd.NaT:
        return None
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat() if not pd.isna(obj) else None
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.floating):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    if isinstance(obj, np.integer):
        return int(obj)
    return obj


_ID_NAME_PATTERNS = {'行次', '序号', '编号', '行号', '项目编号', 'index', 'no', 'no.', 'id', 'row_num', 'row_number', 'sn'}
_ID_NAME_FRAGMENTS = ['订单号', '单号', '编码', '工号', '货号', '票号', '凭证号',
                      'order_id', 'order_no', 'item_id', 'sku_id', 'batch_no']


def _is_id_column(col_name: str, series) -> bool:
    """Detect if a column is an ID/index/sequence column (not useful for chart Y-axis)."""
    lower = col_name.lower().strip()
    if lower in _ID_NAME_PATTERNS:
        return True
    if any(frag in lower for frag in _ID_NAME_FRAGMENTS):
        return True
    try:
        vals = pd.to_numeric(series.dropna().head(20), errors='coerce').dropna()
        if len(vals) >= 3:
            diffs = vals.diff().dropna()
            # Use approximate comparison for float safety
            if len(diffs) > 0 and all(abs(d - 1) < 0.001 for d in diffs):
                return True
            # High-cardinality large integers: require ALL unique + integer + large + high cardinality ratio
            if (vals.nunique() == len(vals) and vals.min() > 10000
                    and all(v == int(v) for v in vals)
                    and series.nunique() / max(len(series.dropna()), 1) > 0.9):
                return True
    except Exception:
        pass
    return False


def _coerce_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Try to convert object columns that look numeric to actual numeric dtype.

    Fixes the issue where mixed-type columns (e.g., "123.4" as str) are
    invisible to select_dtypes(include=[np.number]).
    Only converts columns where >50% of non-null values are numeric.
    Skips ID/index columns to avoid polluting Y-axis candidates.
    """
    df = df.copy()  # Avoid modifying the original DataFrame in batch scenarios
    for col in df.select_dtypes(include=['object']).columns:
        if _is_id_column(col, df[col]):
            continue
        coerced = pd.to_numeric(df[col], errors='coerce')
        non_null = df[col].notna().sum()
        if non_null > 0 and coerced.notna().sum() / non_null > 0.5:
            df[col] = coerced
    return df


class ChartType(str, Enum):
    """Supported chart types"""
    # Basic charts
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    AREA = "area"
    SCATTER = "scatter"
    HEATMAP = "heatmap"
    WATERFALL = "waterfall"
    RADAR = "radar"
    FUNNEL = "funnel"
    GAUGE = "gauge"
    TREEMAP = "treemap"
    SANKEY = "sankey"
    GANTT = "gantt"
    COMBINATION = "combination"

    # Advanced charts (Phase 5)
    SUNBURST = "sunburst"           # Hierarchical data (旭日图)
    PARETO = "pareto"               # 80/20 analysis (帕累托图)
    BULLET = "bullet"               # Target vs actual (子弹图)
    DUAL_AXIS = "dual_axis"         # Two Y-axes (双Y轴图)
    MATRIX_HEATMAP = "matrix_heatmap"  # Cross-tabulation heatmap
    BAR_HORIZONTAL = "bar_horizontal"  # Horizontal bar chart
    SLOPE = "slope"                 # Slope chart for comparison
    DONUT = "donut"                 # Donut chart (环形图)
    NESTED_DONUT = "nested_donut"   # Nested donut chart (嵌套环形图)

    # Statistical charts (Phase 5 - Advanced)
    BOXPLOT = "boxplot"                 # Box plot for distribution analysis
    PARALLEL = "parallel"               # Parallel coordinates for multi-variable
    CORRELATION_MATRIX = "correlation_matrix"  # Correlation heatmap matrix

    # Budget / target vs actual charts
    BUDGET_COMPARISON = "budget_comparison"  # Department budget vs actual (分部预实对比)


class ChartBuilder:
    """ECharts configuration builder"""

    # ========== 8-Benchmark Color System ==========
    # Synthesized from: Tableau (professional palettes) + Looker (Material) + Metabase (friendly)
    # Unified color palette — synced with frontend echarts-theme.ts CHART_COLORS
    # Brand: Atlassian-inspired (blue/green/amber/red/slate + lighter variants)
    THEME_PALETTES = {
        "business": {
            "primary": ["#1B65A8", "#2B7EC1", "#4C9AFF", "#93c5fd", "#bfdbfe"],
            "secondary": ["#36B37E", "#57D9A3", "#34d399", "#6ee7b7", "#a7f3d0"],
            "accent": ["#FFAB00", "#FFC400", "#fbbf24", "#fcd34d", "#fde68a"],
            "danger": ["#FF5630", "#FF8B6A", "#f87171", "#fca5a5"],
            "charts": [
                "#1B65A8", "#36B37E", "#FFAB00", "#FF5630", "#6B778C",
                "#2B7EC1", "#57D9A3", "#FFC400", "#FF8B6A", "#4C9AFF"
            ],
            "gradients": [
                {"start": "#1B65A8", "end": "#4C9AFF"},   # blue
                {"start": "#36B37E", "end": "#57D9A3"},   # green
                {"start": "#FFAB00", "end": "#FFC400"},   # amber
                {"start": "#FF5630", "end": "#FF8B6A"},   # red
                {"start": "#6B778C", "end": "#4C9AFF"},   # slate→sky
            ],
            "semantic": {
                "success": "#36B37E",
                "warning": "#FFAB00",
                "danger": "#FF5630",
                "info": "#1B65A8",
                "muted": "#6B778C",
            }
        }
    }

    # Active theme
    _active_theme = "business"

    # DataZoom auto-show threshold: show slider when x-axis has more than this many items
    DATAZOOM_THRESHOLD = 15

    @classmethod
    def _get_palette(cls) -> dict:
        return cls.THEME_PALETTES[cls._active_theme]

    # Legacy aliases for backward compatibility
    DEFAULT_COLORS = THEME_PALETTES["business"]["charts"]

    GRADIENT_COLORS = THEME_PALETTES["business"]["gradients"]

    # ========== Animation Presets (Tableau + Power BI Fluent Motion) ==========
    ANIMATION_PRESETS = {
        "bar": {
            "animationDuration": 800,
            "animationEasing": "elasticOut",
            "animationDelay": "__ANIM__stagger_80",
        },
        "line": {
            "animationDuration": 1200,
            "animationEasing": "cubicOut",
        },
        "pie": {
            "animationDuration": 1000,
            "animationEasing": "cubicOut",
            "animationType": "expansion",
        },
        "scatter": {
            "animationDuration": 600,
            "animationEasing": "elasticOut",
            "animationDelayUpdate": "__ANIM__stagger_5",
        },
        "area": {
            "animationDuration": 1200,
            "animationEasing": "cubicOut",
        },
        "waterfall": {
            "animationDuration": 800,
            "animationEasing": "cubicOut",
            "animationDelay": "__ANIM__stagger_60",
        },
        "heatmap": {
            "animationDuration": 1000,
            "animationEasing": "cubicOut",
        },
        "radar": {
            "animationDuration": 800,
            "animationEasing": "cubicOut",
        },
        "funnel": {
            "animationDuration": 800,
            "animationEasing": "cubicOut",
            "animationDelay": "__ANIM__stagger_80",
        },
        "gauge": {
            "animationDuration": 1500,
            "animationEasing": "elasticOut",
        },
        "treemap": {
            "animationDuration": 800,
            "animationEasing": "cubicOut",
        },
        "sankey": {
            "animationDuration": 1000,
            "animationEasing": "elasticOut",
        },
        "gantt": {
            "animationDuration": 800,
            "animationEasing": "cubicOut",
            "animationDelay": "__ANIM__stagger_60",
        },
        "sunburst": {
            "animationDuration": 1000,
            "animationEasing": "cubicOut",
        },
        "boxplot": {
            "animationDuration": 600,
            "animationEasing": "cubicOut",
            "animationDelay": "__ANIM__stagger_60",
        },
        "combination": {
            "animationDuration": 800,
            "animationEasing": "cubicOut",
            "animationDelay": "__ANIM__stagger_60",
        },
        "pareto": {
            "animationDuration": 800,
            "animationEasing": "cubicOut",
            "animationDelay": "__ANIM__stagger_60",
        },
    }

    def __init__(self):
        pass

    # ==================== 视觉增强工具方法 ====================

    @staticmethod
    def _detect_value_scale(values: list) -> dict:
        """检测数值量级，返回缩放因子和单位后缀"""
        try:
            abs_values = [abs(v) for v in values if isinstance(v, (int, float)) and not np.isnan(v)]
            if not abs_values:
                return {"divisor": 1, "suffix": "", "name_suffix": ""}
            max_val = max(abs_values)
            if max_val >= 1e8:
                return {"divisor": 1e8, "suffix": "亿", "name_suffix": " (亿元)"}
            elif max_val >= 1e4:
                return {"divisor": 1e4, "suffix": "万", "name_suffix": " (万)"}
            return {"divisor": 1, "suffix": "", "name_suffix": ""}
        except Exception as e:
            logger.debug(f"_detect_value_scale failed for {len(values)} items: {e}")
            return {"divisor": 1, "suffix": "", "name_suffix": ""}

    @staticmethod
    def _scale_series_data(data: list, divisor: float) -> list:
        """缩放数据系列"""
        if divisor == 1:
            return data
        scaled = []
        for v in data:
            if isinstance(v, (int, float)) and not np.isnan(v):
                scaled.append(round(v / divisor, 2))
            else:
                scaled.append(v)
        return scaled

    def _apply_gradient_to_series(self, series: list) -> list:
        """为柱状图系列应用渐变色 + 圆角"""
        gradients = self._get_palette()["gradients"]
        for i, s in enumerate(series):
            if s.get("type") != "bar":
                continue
            gc = gradients[i % len(gradients)]
            s["itemStyle"] = {
                "color": {
                    "type": "linear",
                    "x": 0, "y": 0, "x2": 0, "y2": 1,
                    "colorStops": [
                        {"offset": 0, "color": gc["start"]},
                        {"offset": 1, "color": gc["end"]}
                    ]
                },
                "borderRadius": [4, 4, 0, 0]
            }
        return series

    def _make_bar_label(self, suffix: str = "") -> dict:
        """柱状图顶部数据标签"""
        label = {
            "show": True,
            "position": "top",
            "fontSize": 11,
            "color": "#606266"
        }
        if suffix:
            label["formatter"] = "{c}" + suffix
        return label

    @staticmethod
    def _make_enhanced_tooltip(trigger: str = "axis") -> dict:
        """Structured Tooltip (Tableau multi-row + ThoughtSpot minimal + FineBI comparison)"""
        return {
            "trigger": trigger,
            "backgroundColor": "rgba(255,255,255,0.96)",
            "borderColor": "#e5e7eb",
            "borderWidth": 1,
            "borderRadius": 8,
            "padding": [12, 16],
            "textStyle": {"color": "#374151", "fontSize": 13},
            "extraCssText": "box-shadow: 0 4px 20px rgba(0,0,0,0.12);",
            "confine": True,
            # Thousands separator for tooltip values (resolved by frontend FMT_REGISTRY)
            "valueFormatter": "__FMT__thousands_sep",
            **({"axisPointer": {"type": "shadow", "shadowStyle": {"color": "rgba(37,99,235,0.06)"}}} if trigger == "axis" else {})
        }

    @staticmethod
    def _aggregate_pie_top_n(data: list, n: int = 5) -> list:
        """饼图超过 N 个分类时合并为 Top N + 其他"""
        if len(data) <= n + 1:
            return data
        sorted_data = sorted(data, key=lambda d: abs(d.get("value", 0)), reverse=True)
        top = sorted_data[:n]
        others_val = sum(d.get("value", 0) for d in sorted_data[n:])
        if others_val != 0:
            top.append({"name": "其他", "value": round(others_val, 2)})
        return top

    def _add_mark_annotations(
        self,
        config: dict,
        df: pd.DataFrame,
        y_fields: Optional[List[str]],
        chart_type: str
    ) -> dict:
        """Add markLine (average, min/max) and markPoint annotations to chart series"""
        if chart_type not in ("bar", "line", "area"):
            return config
        series = config.get("series", [])
        if not series or not y_fields:
            return config

        for s in series:
            s_name = s.get("name", "")
            # Only annotate main data series (skip placeholder, trend lines, forecasts)
            if s.get("type") not in ("bar", "line"):
                continue
            if s_name in ("Placeholder", "趋势线") or "预测" in s_name or "置信" in s_name:
                continue

            # Check if this series name corresponds to a y_field or contains data
            data_vals = s.get("data", [])
            numeric_vals = [v for v in data_vals if isinstance(v, (int, float)) and not (isinstance(v, float) and (math.isnan(v) or math.isinf(v)))]
            if len(numeric_vals) < 3:
                continue

            # markLine: average reference line (ECharts computes avg internally)
            s["markLine"] = {
                "silent": True,
                "lineStyle": {"type": "dashed", "color": "#9ca3af", "width": 1},
                "label": {"position": "insideEndTop", "fontSize": 10, "color": "#6b7280",
                          "formatter": f"均值: {{c}}"},
                "data": [{"type": "average", "name": "均值"}]
            }

            # markPoint: max and min values (only for first series to avoid clutter)
            if s is series[0] or len(series) == 1:
                s["markPoint"] = {
                    "symbolSize": 40,
                    "label": {"fontSize": 10},
                    "data": [
                        {"type": "max", "name": "最高"},
                        {"type": "min", "name": "最低"}
                    ]
                }

        return config

    def build(
        self,
        chart_type: str,
        data: List[dict],
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        title: Optional[str] = None,
        subtitle: Optional[str] = None,
        theme: str = "default",
        options: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        Build ECharts configuration

        Args:
            chart_type: Type of chart to build
            data: Data records
            x_field: X-axis field name
            y_fields: Y-axis field names
            series_field: Field for series grouping
            title: Chart title
            subtitle: Chart subtitle
            theme: Color theme
            options: Additional ECharts options

        Returns:
            ECharts configuration object
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return self._empty_chart_config(title)

            # Coerce object columns that contain numeric data (e.g., "123.4" stored as str)
            # so select_dtypes(include=[np.number]) won't miss them
            df = _coerce_numeric_columns(df)

            chart_type_enum = ChartType(chart_type.lower())

            # Build chart based on type
            if chart_type_enum == ChartType.LINE:
                config = self._build_line_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.BAR:
                config = self._build_bar_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.PIE:
                config = self._build_pie_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.AREA:
                config = self._build_area_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.SCATTER:
                config = self._build_scatter_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.WATERFALL:
                config = self._build_waterfall_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.RADAR:
                config = self._build_radar_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.FUNNEL:
                config = self._build_funnel_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.GAUGE:
                config = self._build_gauge_chart(df, y_fields)
            elif chart_type_enum == ChartType.HEATMAP:
                config = self._build_heatmap_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.COMBINATION:
                config = self._build_combination_chart(df, x_field, y_fields, series_field, options)
            elif chart_type_enum == ChartType.SUNBURST:
                config = self._build_sunburst_chart(df, x_field, y_fields, options)
            elif chart_type_enum == ChartType.PARETO:
                config = self._build_pareto_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.BULLET:
                config = self._build_bullet_chart(df, x_field, y_fields, options)
            elif chart_type_enum == ChartType.DUAL_AXIS:
                config = self._build_dual_axis_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.BAR_HORIZONTAL:
                config = self._build_horizontal_bar_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.DONUT:
                config = self._build_donut_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.NESTED_DONUT:
                config = self._build_nested_donut_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.BOXPLOT:
                config = self._build_boxplot_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.PARALLEL:
                config = self._build_parallel_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.CORRELATION_MATRIX:
                config = self._build_correlation_matrix_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.BUDGET_COMPARISON:
                config = self._build_budget_comparison_chart(df, x_field, y_fields, options)
            elif chart_type_enum == ChartType.TREEMAP:
                config = self._build_treemap_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.SANKEY:
                config = self._build_sankey_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.GANTT:
                config = self._build_gantt_chart(df, x_field, y_fields)
            else:
                config = self._build_line_chart(df, x_field, y_fields, series_field)

            # Add mark annotations (average line, max/min points)
            config = self._add_mark_annotations(config, df, y_fields, chart_type_enum.value)

            # Add common options
            config = self._add_common_options(config, title, subtitle, theme, options, chart_type_enum.value, df=df)

            # Inject blur for non-focused series (emphasis/blur three-state)
            for s in config.get("series", []):
                if isinstance(s, dict):
                    s.setdefault("emphasis", {}).setdefault("focus", "series")
                    s.setdefault("blur", {}).setdefault("itemStyle", {}).setdefault("opacity", 0.15)

            # Anomaly detection (ThoughtSpot SpotIQ + Grafana thresholds)
            anomalies = self._detect_chart_anomalies(df, y_fields, chart_type_enum.value)

            result = {
                "success": True,
                "chartType": chart_type,
                "config": _sanitize_for_json(config)
            }
            if anomalies:
                result["anomalies"] = _sanitize_for_json(anomalies)

            return result

        except Exception as e:
            logger.error(f"Chart build failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "config": self._empty_chart_config(title)
            }

    def _build_line_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build line chart configuration"""
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        all_values = []
        series = []
        if series_field and series_field in df.columns:
            for i, (name, group) in enumerate(df.groupby(series_field)):
                for y_field in (y_fields or []):
                    if y_field in group.columns:
                        raw = group[y_field].tolist()
                        all_values.extend([v for v in raw if isinstance(v, (int, float))])
                        series.append({
                            "name": f"{name}",
                            "type": "line",
                            "data": raw,
                            "smooth": True,
                            "emphasis": {"focus": "series"}
                        })
        else:
            for i, y_field in enumerate(y_fields or []):
                if y_field in df.columns:
                    raw = df[y_field].tolist()
                    all_values.extend([v for v in raw if isinstance(v, (int, float))])
                    palette_colors = self._get_palette()["charts"]
                    color = palette_colors[i % len(palette_colors)]
                    series.append({
                        "name": y_field,
                        "type": "line",
                        "data": raw,
                        "smooth": True,
                        "emphasis": {"focus": "series"},
                        "symbol": "circle",
                        "symbolSize": 6,
                        "showSymbol": len(raw) <= 20,
                        "areaStyle": {
                            "color": {
                                "type": "linear", "x": 0, "y": 0, "x2": 0, "y2": 1,
                                "colorStops": [
                                    {"offset": 0, "color": color + "30"},
                                    {"offset": 1, "color": color + "05"}
                                ]
                            }
                        } if i == 0 else None
                    })

        # Y轴缩放
        scale = self._detect_value_scale(all_values)
        if scale["divisor"] != 1:
            for s in series:
                s["data"] = self._scale_series_data(s["data"], scale["divisor"])

        # Clean None areaStyle
        for s in series:
            if s.get("areaStyle") is None:
                s.pop("areaStyle", None)

        return {
            "xAxis": {
                "type": "category",
                "data": x_data,
                "boundaryGap": False
            },
            "yAxis": {
                "type": "value",
                "name": scale["name_suffix"].strip() if scale["name_suffix"] else None,
                "splitLine": {"lineStyle": {"type": "dashed", "color": "#f0f0f0"}}
            },
            "series": series,
            "tooltip": self._make_enhanced_tooltip("axis"),
            "legend": {
                "data": [s["name"] for s in series]
            }
        }

    def _build_bar_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build bar chart configuration"""
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        # 收集所有数值用于量级检测
        all_values = []
        series = []
        if series_field and series_field in df.columns:
            for name, group in df.groupby(series_field):
                for y_field in (y_fields or []):
                    if y_field in group.columns:
                        raw = group[y_field].tolist()
                        all_values.extend([v for v in raw if isinstance(v, (int, float))])
                        series.append({
                            "name": str(name),
                            "type": "bar",
                            "data": raw,
                            "emphasis": {"focus": "series"}
                        })
        else:
            for y_field in (y_fields or []):
                if y_field in df.columns:
                    raw = df[y_field].tolist()
                    all_values.extend([v for v in raw if isinstance(v, (int, float))])
                    series.append({
                        "name": y_field,
                        "type": "bar",
                        "data": raw,
                        "emphasis": {"focus": "series"}
                    })

        # Y轴缩放
        scale = self._detect_value_scale(all_values)
        if scale["divisor"] != 1:
            for s in series:
                s["data"] = self._scale_series_data(s["data"], scale["divisor"])

        # 数据标签
        for s in series:
            s["label"] = self._make_bar_label(scale["suffix"])

        # 渐变配色
        series = self._apply_gradient_to_series(series)

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": {
                "type": "value",
                "name": scale["name_suffix"].strip() if scale["name_suffix"] else None
            },
            "series": series,
            "tooltip": self._make_enhanced_tooltip("axis"),
            "legend": {
                "data": [s["name"] for s in series]
            }
        }

    def _build_pie_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build pie chart configuration"""
        name_field = x_field or df.columns[0]
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not y_fields and len(numeric_cols) == 0:
            return self._empty_chart_config(None)
        value_field = (y_fields[0] if y_fields
                       else numeric_cols[0] if numeric_cols
                       else None)
        if value_field is None:
            return self._empty_chart_config(None)

        data = []
        for _, row in df.iterrows():
            if pd.notna(row[value_field]):
                v = pd.to_numeric(row[value_field], errors='coerce')
                if pd.notna(v):
                    data.append({"name": str(row[name_field]), "value": round(float(v), 2)})

        # Top5 + 其他 合并
        data = self._aggregate_pie_top_n(data, 5)

        return {
            "series": [{
                "name": value_field,
                "type": "pie",
                "radius": ["40%", "70%"],
                "avoidLabelOverlap": True,
                "itemStyle": {
                    "borderRadius": 10,
                    "borderColor": "#fff",
                    "borderWidth": 2
                },
                "label": {
                    "show": True,
                    "formatter": "{b}\n{d}%",
                    "overflow": "truncate",
                    "width": 80
                },
                "labelLayout": {"hideOverlap": True},
                "labelLine": {"length": 15, "length2": 10},
                "emphasis": {
                    "label": {
                        "show": True,
                        "fontSize": 16,
                        "fontWeight": "bold"
                    }
                },
                "data": data
            }],
            "tooltip": self._make_enhanced_tooltip("item"),
            "legend": {
                "orient": "vertical",
                "left": "left",
                "data": [d["name"] for d in data]
            }
        }

    def _build_area_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build area chart configuration"""
        config = self._build_line_chart(df, x_field, y_fields, series_field)

        is_stacked = len(config["series"]) > 1
        # Add area style to series
        for i, s in enumerate(config["series"]):
            s["areaStyle"] = {
                "opacity": 0.3
            }
            s["stack"] = "total" if is_stacked else None

        if is_stacked:
            title = config.get("title", {})
            if isinstance(title, dict):
                existing = title.get("subtext", "")
                title["subtext"] = ("堆叠面积图（数值为累计叠加）" +
                                    (f" | {existing}" if existing else ""))
                config["title"] = title

        return config

    def _build_scatter_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build scatter/bubble chart configuration with trendline, quadrant lines, and visual dimensions.

        Bubble mode: if 3+ numeric columns, 3rd column controls bubble size (symbolSize).
        Color dimension: if 4th numeric column exists, adds a visualMap for color coding.
        Quadrant lines: draws crosshair at mean values (BCG matrix style).
        Regression line: linear trend line with slope/intercept.
        Labels: show entity name near each bubble when <=20 data points.
        """
        numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
        if not y_fields and len(numeric_cols) < 2:
            return self._empty_chart_config("散点图需要至少2个数值列")
        if len(numeric_cols) == 0:
            return self._empty_chart_config("散点图需要数值列")

        x_col = x_field if x_field and x_field in df.columns else numeric_cols[0]
        y_col = y_fields[0] if y_fields else (numeric_cols[1] if len(numeric_cols) > 1 else numeric_cols[0])

        # Determine bubble size column (3rd numeric)
        remaining_numeric = [c for c in numeric_cols if c not in (x_col, y_col)]
        size_col = None
        color_col = None
        if y_fields and len(y_fields) >= 2 and y_fields[1] in df.columns:
            size_col = y_fields[1]
            if len(y_fields) >= 3 and y_fields[2] in df.columns:
                color_col = y_fields[2]
        elif len(remaining_numeric) >= 1:
            size_col = remaining_numeric[0]
            if len(remaining_numeric) >= 2:
                color_col = remaining_numeric[1]

        is_bubble = size_col is not None

        # Detect label column (first non-numeric column for entity names)
        non_numeric_cols = [c for c in df.columns if c not in numeric_cols]
        label_col = non_numeric_cols[0] if non_numeric_cols else None

        # Compute size scaling range for bubble mode
        size_min_val, size_max_val = 0, 1
        if is_bubble:
            size_series = pd.to_numeric(df[size_col], errors='coerce').dropna()
            if len(size_series) > 0:
                size_min_val = float(size_series.min())
                size_max_val = float(size_series.max())
                if size_max_val == size_min_val:
                    size_max_val = size_min_val + 1

        all_x, all_y = [], []
        series = []

        def _make_point(row):
            """Build a single scatter/bubble data point."""
            try:
                xv = float(row[x_col])
                yv = float(row[y_col])
            except (ValueError, TypeError):
                return None
            if not (math.isfinite(xv) and math.isfinite(yv)):
                return None

            all_x.append(xv)
            all_y.append(yv)
            point = [xv, yv]

            if is_bubble:
                try:
                    sv = float(row[size_col])
                    point.append(sv if math.isfinite(sv) else 0)
                except (ValueError, TypeError):
                    point.append(0)

            if color_col:
                try:
                    cv = float(row[color_col])
                    point.append(cv if math.isfinite(cv) else 0)
                except (ValueError, TypeError):
                    point.append(0)

            return point

        def _symbol_size_fn_ref():
            """Return a named function reference for ECharts symbolSize callback.
            Frontend resolves __FMT__bubble_size to:
              function(val) { return 8 + (val[2] - min) / (max - min) * 52; }
            """
            return "__FMT__bubble_size"

        if series_field and series_field in df.columns:
            for name, group in df.groupby(series_field):
                data = []
                for _, row in group.iterrows():
                    pt = _make_point(row)
                    if pt:
                        data.append(pt)
                s = {
                    "name": str(name),
                    "type": "scatter",
                    "data": data,
                }
                if is_bubble:
                    s["symbolSize"] = _symbol_size_fn_ref()
                    s["_sizeRange"] = [size_min_val, size_max_val]
                else:
                    s["symbolSize"] = 10
                # Labels for small datasets
                if label_col and len(group) <= 20:
                    s["label"] = {
                        "show": True,
                        "formatter": "__FMT__scatter_label",
                        "fontSize": 10,
                        "color": "#666",
                        "position": "right",
                    }
                series.append(s)
        else:
            data = []
            labels = []
            for _, row in df.iterrows():
                pt = _make_point(row)
                if pt:
                    data.append(pt)
                    if label_col:
                        labels.append(str(row.get(label_col, '')))
            s = {
                "name": f"{x_col} vs {y_col}",
                "type": "scatter",
                "data": data,
            }
            if is_bubble:
                s["symbolSize"] = _symbol_size_fn_ref()
                s["_sizeRange"] = [size_min_val, size_max_val]
            else:
                s["symbolSize"] = 10
            # Labels for small datasets
            if label_col and len(df) <= 20:
                s["label"] = {
                    "show": True,
                    "formatter": "__FMT__scatter_label",
                    "fontSize": 10,
                    "color": "#666",
                    "position": "right",
                }
                s["_labels"] = labels
            series.append(s)

        # Regression / trend line
        if len(all_x) >= 3:
            try:
                coeffs = np.polyfit(all_x, all_y, 1)
                slope, intercept = coeffs[0], coeffs[1]
                x_min, x_max = min(all_x), max(all_x)
                # Calculate R-squared
                y_pred = np.array(all_x) * slope + intercept
                ss_res = np.sum((np.array(all_y) - y_pred) ** 2)
                ss_tot = np.sum((np.array(all_y) - np.mean(all_y)) ** 2)
                r_squared = round(1 - ss_res / ss_tot, 4) if ss_tot > 0 else 0

                series.append({
                    "name": f"趋势线 (R²={r_squared})",
                    "type": "line",
                    "data": [
                        [round(x_min, 2), round(slope * x_min + intercept, 2)],
                        [round(x_max, 2), round(slope * x_max + intercept, 2)]
                    ],
                    "smooth": False,
                    "symbol": "none",
                    "lineStyle": {"type": "dashed", "color": "#ff7875", "width": 2},
                    "tooltip": {"show": False}
                })
            except Exception as e:
                logger.debug(f"Trendline polyfit failed with {len(all_x)} pts: {e}")

        # Quadrant lines (BCG matrix style): crosshair at mean values
        if len(all_x) >= 3:
            mean_x = round(float(np.mean(all_x)), 2)
            mean_y = round(float(np.mean(all_y)), 2)
            # Add markLine to first scatter series
            for s in series:
                if s.get("type") == "scatter":
                    s["markLine"] = {
                        "silent": True,
                        "symbol": ["none", "none"],
                        "lineStyle": {"type": "dashed", "color": "#c0c4cc", "width": 1},
                        "label": {"fontSize": 10, "color": "#909399"},
                        "data": [
                            {"xAxis": mean_x, "name": f"均值: {mean_x}"},
                            {"yAxis": mean_y, "name": f"均值: {mean_y}"},
                        ]
                    }
                    break

        config = {
            "xAxis": {"type": "value", "name": x_col, "nameLocation": "center", "nameGap": 30},
            "yAxis": {"type": "value", "name": y_col},
            "series": series,
            "tooltip": {
                **self._make_enhanced_tooltip("item"),
                "formatter": "__FMT__scatter_tooltip",
            }
        }

        # Color dimension via visualMap
        if color_col:
            color_series = pd.to_numeric(df[color_col], errors='coerce').dropna()
            c_min = float(color_series.min()) if len(color_series) > 0 else 0
            c_max = float(color_series.max()) if len(color_series) > 0 else 1
            config["visualMap"] = {
                "show": True,
                "dimension": 3,
                "min": c_min,
                "max": c_max,
                "calculable": True,
                "orient": "vertical",
                "right": 10,
                "top": "center",
                "text": [color_col, ""],
                "inRange": {
                    "color": ["#57D9A3", "#FFAB00", "#FF5630"]
                },
                "textStyle": {"fontSize": 11},
            }
            config["grid"] = {"right": "15%"}

        # Size legend reference for bubble mode
        if is_bubble:
            config["_bubbleMeta"] = {
                "sizeColumn": size_col,
                "sizeMin": size_min_val,
                "sizeMax": size_max_val,
            }

        return config

    def _build_waterfall_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build waterfall chart configuration"""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols) == 0:
            return self._empty_chart_config("瀑布图需要数值列")
        x_data = df[x_field].tolist() if x_field else df.index.tolist()
        y_col = y_fields[0] if y_fields else numeric_cols[0]
        values = pd.to_numeric(df[y_col], errors='coerce').fillna(0).tolist()

        # Calculate waterfall data
        placeholder_data = []
        positive_data = []
        negative_data = []

        cumulative = 0
        for i, val in enumerate(values):
            if i == 0:
                # First bar starts from 0
                positive_data.append(val if val > 0 else 0)
                negative_data.append(abs(val) if val < 0 else 0)
                placeholder_data.append(0)
            else:
                if val >= 0:
                    placeholder_data.append(cumulative)
                    positive_data.append(val)
                    negative_data.append(0)
                else:
                    placeholder_data.append(cumulative + val)
                    positive_data.append(0)
                    negative_data.append(abs(val))
            cumulative += val

        # Y轴缩放
        scale = self._detect_value_scale(values)
        if scale["divisor"] != 1:
            placeholder_data = self._scale_series_data(placeholder_data, scale["divisor"])
            positive_data = self._scale_series_data(positive_data, scale["divisor"])
            negative_data = self._scale_series_data(negative_data, scale["divisor"])

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": {
                "type": "value",
                "name": scale["name_suffix"].strip() if scale["name_suffix"] else None
            },
            "series": [
                {
                    "name": "Placeholder",
                    "type": "bar",
                    "stack": "Total",
                    "itemStyle": {"color": "transparent"},
                    "data": placeholder_data
                },
                {
                    "name": "增长",
                    "type": "bar",
                    "stack": "Total",
                    "itemStyle": {"color": "#36B37E", "borderRadius": [4, 4, 0, 0]},
                    "label": self._make_bar_label(scale["suffix"]),
                    "data": positive_data
                },
                {
                    "name": "下降",
                    "type": "bar",
                    "stack": "Total",
                    "itemStyle": {"color": "#FF5630", "borderRadius": [4, 4, 0, 0]},
                    "label": self._make_bar_label(scale["suffix"]),
                    "data": negative_data
                }
            ],
            "tooltip": self._make_enhanced_tooltip("axis")
        }

    def _build_radar_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build radar chart configuration.

        When x_field is provided (category column), each unique category
        becomes a separate radar polygon for multi-series comparison.
        Otherwise, aggregates all rows using mean values.
        """
        indicators = []

        def safe_mean(series):
            try:
                numeric_vals = pd.to_numeric(series, errors='coerce')
                mean_val = numeric_vals.mean()
                return round(float(mean_val), 2) if pd.notna(mean_val) else 0
            except Exception:
                return 0

        # Determine indicator fields
        indicator_fields = []
        if y_fields:
            indicator_fields = [f for f in y_fields if f in df.columns]
        if not indicator_fields:
            indicator_fields = list(df.select_dtypes(include=[np.number]).columns[:6])

        if not indicator_fields:
            return {"series": [], "tooltip": {"trigger": "item"}}

        # Build indicators with max values
        for field in indicator_fields:
            col_numeric = pd.to_numeric(df[field], errors='coerce').dropna()
            max_val = float(col_numeric.max()) if len(col_numeric) > 0 else 1.0
            if not (math.isfinite(max_val) and max_val > 0):
                max_val = 1.0
            indicators.append({"name": field, "max": max_val * 1.2})

        # Build radar data series
        radar_data = []

        if x_field and x_field in df.columns:
            # Multi-series: each unique x_field value becomes a radar polygon
            groups = df.groupby(x_field)
            for name, group in list(groups)[:8]:
                values = [safe_mean(group[f]) for f in indicator_fields]
                radar_data.append({"value": values, "name": str(name)})
        else:
            # Single series: aggregate all rows using mean
            values = [safe_mean(df[f]) for f in indicator_fields]
            radar_data.append({"value": values, "name": "均值"})

        return {
            "radar": {
                "indicator": indicators
            },
            "series": [{
                "name": "对比",
                "type": "radar",
                "data": radar_data
            }],
            "tooltip": self._make_enhanced_tooltip("item")
        }

    def _build_funnel_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build funnel chart configuration"""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols) == 0:
            return self._empty_chart_config("漏斗图需要数值列")
        name_field = x_field or df.columns[0]
        value_field = y_fields[0] if y_fields else numeric_cols[0]

        data = sorted([
            {"name": str(row[name_field]), "value": float(pd.to_numeric(row[value_field], errors='coerce') or 0)}
            for _, row in df.iterrows()
            if pd.notna(row.get(value_field))
        ], key=lambda x: x["value"], reverse=True)

        return {
            "series": [{
                "name": "Funnel",
                "type": "funnel",
                "left": "10%",
                "width": "80%",
                "label": {
                    "show": True,
                    "position": "inside"
                },
                "gap": 2,
                "data": data
            }],
            "tooltip": {**self._make_enhanced_tooltip("item"), "formatter": "{a} <br/>{b}: {c}"}
        }

    def _build_gauge_chart(
        self,
        df: pd.DataFrame,
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build gauge chart configuration"""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols) == 0:
            return self._empty_chart_config("仪表盘需要数值列")
        value_field = y_fields[0] if y_fields else numeric_cols[0]
        raw_val = pd.to_numeric(df[value_field].iloc[0], errors='coerce') if len(df) > 0 else 0
        value = float(raw_val) if pd.notna(raw_val) else 0

        return {
            "series": [{
                "name": value_field,
                "type": "gauge",
                "progress": {"show": True},
                "detail": {
                    "valueAnimation": True,
                    "formatter": "{value}%"
                },
                "data": [{"value": value, "name": value_field}]
            }],
            "tooltip": {**self._make_enhanced_tooltip("item"), "formatter": "{a} <br/>{b}: {c}%"}
        }

    def _build_heatmap_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build heatmap chart configuration"""
        if len(df.columns) < 2:
            return self._empty_chart_config("热力图至少需要2列")
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols) == 0:
            return self._empty_chart_config("热力图需要数值列")
        x_col = x_field or df.columns[0]
        y_col = series_field or (df.columns[1] if len(df.columns) > 1 else df.columns[0])
        value_col = y_fields[0] if y_fields else numeric_cols[0]

        x_data = df[x_col].unique().tolist()
        y_data = df[y_col].unique().tolist()

        data = []
        for _, row in df.iterrows():
            raw_val = pd.to_numeric(row.get(value_col), errors='coerce')
            if pd.isna(raw_val):
                continue
            try:
                x_idx = x_data.index(row[x_col])
                y_idx = y_data.index(row[y_col])
                data.append([x_idx, y_idx, float(raw_val)])
            except (ValueError, KeyError):
                continue

        numeric_series = pd.to_numeric(df[value_col], errors='coerce')
        max_val = numeric_series.max() if not numeric_series.isna().all() else 1
        min_val = numeric_series.min() if not numeric_series.isna().all() else 0

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": {
                "type": "category",
                "data": y_data
            },
            "visualMap": {
                "min": float(min_val),
                "max": float(max_val),
                "calculable": True,
                "orient": "horizontal",
                "left": "center",
                "bottom": "0%"
            },
            "series": [{
                "name": value_col,
                "type": "heatmap",
                "data": data,
                "label": {"show": True}
            }],
            "tooltip": {
                "position": "top"
            }
        }

    def _build_combination_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str],
        options: Optional[dict]
    ) -> dict:
        """Build combination chart (bar + line)"""
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        series = []
        y_axis_list = [{"type": "value", "position": "left"}]

        if y_fields and len(y_fields) >= 2:
            # First field as bar
            if y_fields[0] in df.columns:
                series.append({
                    "name": y_fields[0],
                    "type": "bar",
                    "data": df[y_fields[0]].tolist(),
                    "yAxisIndex": 0
                })

            # Second field as line with secondary axis
            if y_fields[1] in df.columns:
                y_axis_list.append({"type": "value", "position": "right"})
                series.append({
                    "name": y_fields[1],
                    "type": "line",
                    "data": df[y_fields[1]].tolist(),
                    "yAxisIndex": 1,
                    "smooth": True
                })

            # Additional fields as lines
            for y_field in y_fields[2:]:
                if y_field in df.columns:
                    series.append({
                        "name": y_field,
                        "type": "line",
                        "data": df[y_field].tolist(),
                        "yAxisIndex": 1,
                        "smooth": True
                    })

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": y_axis_list,
            "series": series,
            "tooltip": self._make_enhanced_tooltip("axis"),
            "legend": {
                "data": [s["name"] for s in series]
            }
        }

    def _add_common_options(
        self,
        config: dict,
        title: Optional[str],
        subtitle: Optional[str],
        theme: str,
        options: Optional[dict],
        chart_type: str = "",
        df: Optional[pd.DataFrame] = None
    ) -> dict:
        """Add common ECharts options with visual enhancements (8-benchmark synthesis)"""
        palette = self._get_palette()

        # Title: stripped by frontend (Vue card header displays it) — skip to save bandwidth

        # Theme colors
        config["color"] = palette["charts"]

        # Grid with better spacing
        if "grid" not in config:
            config["grid"] = {
                "left": "3%",
                "right": "4%",
                "top": "8%",
                "bottom": "3%",
                "containLabel": True
            }

        # Toolbox: added by frontend (with magicType support) — skip here

        # Legend auto-position (Power BI style)
        if "legend" in config:
            legend = config["legend"]
            legend_data = legend.get("data", [])
            if len(legend_data) > 5:
                legend["type"] = "scroll"
            if legend.get("orient") != "vertical":
                legend.setdefault("bottom", 0)
                legend.setdefault("left", "center")

        # ===== X轴中文自适应 =====
        x_axis = config.get("xAxis")
        if isinstance(x_axis, dict) and x_axis.get("type") == "category":
            x_data = x_axis.get("data", [])
            max_len = max((len(str(d)) for d in x_data), default=0)
            if max_len > 4:
                x_axis.setdefault("axisLabel", {})
                x_axis["axisLabel"]["rotate"] = 30
                x_axis["axisLabel"]["overflow"] = "truncate"
                x_axis["axisLabel"]["width"] = 80
            if len(x_data) > self.DATAZOOM_THRESHOLD:
                config["dataZoom"] = [
                    {"type": "slider", "start": 0, "end": round(self.DATAZOOM_THRESHOLD / len(x_data) * 100),
                     "borderColor": "transparent", "backgroundColor": "#f3f4f6",
                     "fillerColor": "rgba(27,101,168,0.12)", "handleStyle": {"color": "#1B65A8"}},
                    {"type": "inside"}
                ]
                config["grid"]["bottom"] = "15%"

        # ===== Large dataset optimization (ECharts progressive rendering) =====
        data_len = len(df) if df is not None else 0
        if data_len > 5000:
            if chart_type in ("bar", "scatter"):
                for s in config.get("series", []):
                    s["large"] = True
                    s["largeThreshold"] = 5000
                    if chart_type == "scatter":
                        s["progressive"] = 400
                        s["progressiveThreshold"] = 3000
                logger.info(f"Large dataset mode enabled: {data_len} rows, chart_type={chart_type}")
            elif chart_type in ("line", "area"):
                for s in config.get("series", []):
                    s["sampling"] = "lttb"
                logger.info(f"LTTB sampling enabled: {data_len} rows, chart_type={chart_type}")

        # ===== ARIA accessibility (colorblind decal + screen reader description) =====
        config["aria"] = {
            "enabled": True,
            "decal": {"show": True},
        }

        # ===== Tooltip confine to container (prevent overflow at edges) =====
        tooltip = config.get("tooltip", {})
        if isinstance(tooltip, dict):
            tooltip["confine"] = True
            config["tooltip"] = tooltip

        # ===== Type-specific animation (Tableau + Power BI Fluent Motion) =====
        config["animation"] = True
        preset = self.ANIMATION_PRESETS.get(chart_type, {})
        config["animationDuration"] = preset.get("animationDuration", 800)
        config["animationEasing"] = preset.get("animationEasing", "cubicOut")
        # Named refs (__ANIM__/...) are resolved by frontend registry (no eval)
        for anim_key in ("animationDelay", "animationDelayUpdate"):
            if anim_key in preset:
                config[anim_key] = preset[anim_key]

        # Merge custom options
        if options:
            for key, value in options.items():
                if isinstance(value, dict) and key in config:
                    config[key].update(value)
                else:
                    config[key] = value

        return config

    def _detect_chart_anomalies(
        self,
        df: pd.DataFrame,
        y_fields: Optional[List[str]],
        chart_type: str
    ) -> Dict[str, Any]:
        """Detect anomalies using IQR method (ThoughtSpot SpotIQ + Grafana thresholds).
        Returns markPoint/markLine config for frontend overlay."""
        if chart_type not in ("bar", "line", "area"):
            return {}
        if not y_fields:
            return {}

        anomaly_result: Dict[str, Any] = {}
        for col in y_fields:
            if col not in df.columns:
                continue
            values = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(values) < 5:
                continue

            q1, q3 = values.quantile(0.25), values.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            mean_val = float(values.mean())
            std_val = float(values.std())

            outlier_indices = []
            for idx_pos, (idx, val) in enumerate(values.items()):
                if val < lower or val > upper:
                    deviation = (val - mean_val) / std_val if std_val > 0 else 0
                    outlier_indices.append({
                        "index": idx_pos,
                        "value": float(val),
                        "deviation": round(float(deviation), 2)
                    })

            if outlier_indices:
                anomaly_result[col] = {
                    "outliers": outlier_indices[:10],
                    "mean": round(mean_val, 2),
                    "std": round(std_val, 2),
                    "q1": round(float(q1), 2),
                    "q3": round(float(q3), 2),
                }

        return anomaly_result

    def _empty_chart_config(self, title: Optional[str] = None) -> dict:
        """Return empty chart configuration"""
        return {
            "title": {
                "text": title or "No Data",
                "subtext": "暂无数据",
                "left": "center",
                "top": "center"
            },
            "series": []
        }

    def _build_sunburst_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        options: Optional[dict]
    ) -> dict:
        """Build sunburst chart for hierarchical data"""
        # Extract hierarchy columns from options or use first 2-3 columns
        hierarchy_cols = options.get("hierarchy", []) if options else []
        if not hierarchy_cols:
            hierarchy_cols = df.columns[:2].tolist()

        numeric_cols_sb = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols_sb) == 0:
            return self._empty_chart_config("旭日图需要数值列")
        value_field = y_fields[0] if y_fields else numeric_cols_sb[0]

        # Build hierarchical data
        MAX_DEPTH = 10

        def build_tree(df, level_cols, value_col, depth=0):
            if not level_cols or depth >= MAX_DEPTH:
                return []

            current_col = level_cols[0]
            remaining_cols = level_cols[1:]

            children = []
            for name, group in df.groupby(current_col):
                node = {
                    "name": str(name),
                    "value": float(group[value_col].sum())
                }
                if remaining_cols:
                    node["children"] = build_tree(group, remaining_cols, value_col, depth + 1)
                children.append(node)
            return children

        data = build_tree(df, hierarchy_cols, value_field)

        return {
            "series": [{
                "type": "sunburst",
                "data": data,
                "radius": ["15%", "80%"],
                "label": {
                    "rotate": "radial"
                },
                "emphasis": {
                    "focus": "ancestor"
                }
            }],
            "tooltip": {
                "trigger": "item",
                "formatter": "{b}: {c}"
            }
        }

    def _build_pareto_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build Pareto chart (80/20 analysis)"""
        numeric_cols_pa = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols_pa) == 0:
            return self._empty_chart_config("帕累托图需要数值列")
        x_col = x_field or df.columns[0]
        y_col = y_fields[0] if y_fields else numeric_cols_pa[0]

        # Sort by value descending; coerce to numeric first
        df_copy = df.copy()
        df_copy[y_col] = pd.to_numeric(df_copy[y_col], errors='coerce').fillna(0)
        sorted_df = df_copy.sort_values(y_col, ascending=False)
        x_data = sorted_df[x_col].tolist()
        y_data = sorted_df[y_col].tolist()

        # Calculate cumulative percentage — guard against zero total
        total = sum(y_data)
        if total == 0:
            return self._empty_chart_config("帕累托图数据全为零")
        cumulative = []
        cum_sum = 0
        for val in y_data:
            cum_sum += val
            cumulative.append(round(cum_sum / total * 100, 1))

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": [
                {"type": "value", "name": y_col, "position": "left"},
                {"type": "value", "name": "累计百分比", "position": "right", "max": 100}
            ],
            "series": [
                {
                    "name": y_col,
                    "type": "bar",
                    "data": y_data,
                    "yAxisIndex": 0,
                    "itemStyle": {"color": "#1B65A8"}
                },
                {
                    "name": "累计百分比",
                    "type": "line",
                    "data": cumulative,
                    "yAxisIndex": 1,
                    "smooth": True,
                    "itemStyle": {"color": "#FF5630"},
                    "markLine": {
                        "data": [{"yAxis": 80, "label": {"formatter": "80%"}}]
                    }
                }
            ],
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "cross"}
            },
            "legend": {
                "data": [y_col, "累计百分比"]
            }
        }

    def _build_bullet_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        options: Optional[dict]
    ) -> dict:
        """Build bullet chart for target vs actual comparison"""
        x_col = x_field or df.columns[0]
        actual_col = y_fields[0] if y_fields else "actual"
        target_col = y_fields[1] if y_fields and len(y_fields) > 1 else "target"

        x_data = df[x_col].tolist()
        actual_raw = pd.to_numeric(df[actual_col], errors='coerce').fillna(0).tolist() if actual_col in df.columns else [0] * len(x_data)
        target_raw = pd.to_numeric(df[target_col], errors='coerce').fillna(0).tolist() if target_col in df.columns else [100] * len(x_data)
        actual_data = actual_raw
        target_data = target_raw

        # Calculate max for background ranges — guard against empty lists
        all_vals = [v for v in actual_data + target_data if isinstance(v, (int, float)) and not math.isnan(v)]
        max_val = (max(all_vals) * 1.2) if all_vals else 100

        return {
            "xAxis": {
                "type": "value",
                "max": max_val
            },
            "yAxis": {
                "type": "category",
                "data": x_data
            },
            "series": [
                {
                    "name": "背景",
                    "type": "bar",
                    "data": [max_val] * len(x_data),
                    "barWidth": 30,
                    "itemStyle": {"color": "#eee"},
                    "z": 1
                },
                {
                    "name": actual_col,
                    "type": "bar",
                    "data": actual_data,
                    "barWidth": 15,
                    "itemStyle": {"color": "#1B65A8"},
                    "z": 2
                },
                {
                    "name": target_col,
                    "type": "scatter",
                    "data": [[t, i] for i, t in enumerate(target_data)],
                    "symbol": "rect",
                    "symbolSize": [4, 20],
                    "itemStyle": {"color": "#FF5630"},
                    "z": 3
                }
            ],
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "shadow"}
            },
            "legend": {
                "data": [actual_col, target_col]
            }
        }

    def _build_dual_axis_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build dual Y-axis chart"""
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        series = []
        y_axis_list = []

        if y_fields and len(y_fields) >= 2:
            # First field on left axis
            if y_fields[0] in df.columns:
                y_axis_list.append({
                    "type": "value",
                    "name": y_fields[0],
                    "position": "left"
                })
                series.append({
                    "name": y_fields[0],
                    "type": "bar",
                    "data": df[y_fields[0]].tolist(),
                    "yAxisIndex": 0
                })

            # Second field on right axis
            if y_fields[1] in df.columns:
                y_axis_list.append({
                    "type": "value",
                    "name": y_fields[1],
                    "position": "right"
                })
                series.append({
                    "name": y_fields[1],
                    "type": "line",
                    "data": df[y_fields[1]].tolist(),
                    "yAxisIndex": 1,
                    "smooth": True
                })

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": y_axis_list,
            "series": series,
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "cross"}
            },
            "legend": {
                "data": [s["name"] for s in series]
            }
        }

    def _build_horizontal_bar_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build horizontal bar chart"""
        # Category axis must be string labels — convert numeric values to strings
        y_data = [str(v) for v in (df[x_field].tolist() if x_field else df.index.tolist())]

        series = []
        for y_field in (y_fields or []):
            if y_field in df.columns:
                series.append({
                    "name": y_field,
                    "type": "bar",
                    "data": df[y_field].tolist(),
                    "emphasis": {"focus": "series"}
                })

        return {
            "xAxis": {
                "type": "value"
            },
            "yAxis": {
                "type": "category",
                "data": y_data
            },
            "series": series,
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "shadow"}
            },
            "legend": {
                "data": [s["name"] for s in series]
            },
            "grid": {
                "left": "15%",
                "right": "4%",
                "bottom": "3%",
                "containLabel": True
            }
        }

    def _build_donut_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build donut chart"""
        config = self._build_pie_chart(df, x_field, y_fields)
        # Modify to donut style
        if config.get("series"):
            config["series"][0]["radius"] = ["50%", "70%"]
        return config

    def _build_nested_donut_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build nested donut chart for hierarchical comparison"""
        numeric_cols_nd = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols_nd) == 0:
            return self._empty_chart_config("嵌套环形图需要数值列")
        inner_field = x_field or df.columns[0]
        outer_field = series_field or (df.columns[1] if len(df.columns) > 1 else inner_field)
        value_field = y_fields[0] if y_fields else numeric_cols_nd[0]

        # Inner ring data (aggregated by inner_field)
        inner_data = df.groupby(inner_field)[value_field].sum().reset_index()
        inner_series_data = [
            {"name": str(row[inner_field]), "value": float(row[value_field])}
            for _, row in inner_data.iterrows()
        ]

        # Outer ring data (by outer_field)
        outer_data = df.groupby(outer_field)[value_field].sum().reset_index()
        outer_series_data = [
            {"name": str(row[outer_field]), "value": float(row[value_field])}
            for _, row in outer_data.iterrows()
        ]

        return {
            "series": [
                {
                    "name": inner_field,
                    "type": "pie",
                    "radius": ["0%", "35%"],
                    "label": {"position": "inner", "fontSize": 10},
                    "data": inner_series_data
                },
                {
                    "name": outer_field,
                    "type": "pie",
                    "radius": ["50%", "70%"],
                    "label": {
                        "formatter": "{b}: {d}%",
                        "overflow": "truncate",
                        "width": 80,
                    },
                    "labelLayout": {"hideOverlap": True},
                    "labelLine": {"length": 15, "length2": 10},
                    "data": outer_series_data
                }
            ],
            "tooltip": {
                "trigger": "item",
                "formatter": "{a} <br/>{b}: {c} ({d}%)"
            },
            "legend": {
                "orient": "vertical",
                "left": "left"
            }
        }

    def _build_boxplot_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build boxplot for distribution analysis"""
        palette = self._get_palette()["charts"]

        if not y_fields:
            y_fields = df.select_dtypes(include=['number']).columns.tolist()[:6]
        if not y_fields:
            return self._empty_chart_config(None)

        # Compute boxplot statistics for each numeric column
        box_data = []
        outlier_data = []
        for i, col in enumerate(y_fields):
            if col not in df.columns:
                continue
            vals = pd.to_numeric(df[col], errors='coerce').dropna()
            if len(vals) < 5:
                continue
            q1 = float(vals.quantile(0.25))
            q2 = float(vals.quantile(0.5))
            q3 = float(vals.quantile(0.75))
            iqr = q3 - q1
            lower = float(max(vals.min(), q1 - 1.5 * iqr))
            upper = float(min(vals.max(), q3 + 1.5 * iqr))
            box_data.append([round(lower, 2), round(q1, 2), round(q2, 2), round(q3, 2), round(upper, 2)])

            # Outliers
            outliers = vals[(vals < q1 - 1.5 * iqr) | (vals > q3 + 1.5 * iqr)]
            for v in outliers.tolist()[:10]:  # Limit outliers
                outlier_data.append([i, round(float(v), 2)])

        if not box_data:
            return self._empty_chart_config(None)

        config = {
            "xAxis": {
                "type": "category",
                "data": y_fields[:len(box_data)],
                "axisLabel": {"fontSize": 11}
            },
            "yAxis": {"type": "value", "name": "数值"},
            "tooltip": self._make_enhanced_tooltip("item"),
            "grid": {"left": "10%", "right": "10%", "bottom": "15%", "top": "10%"},
            "series": [
                {
                    "name": "分布",
                    "type": "boxplot",
                    "data": box_data,
                    "itemStyle": {"color": palette[0], "borderColor": palette[1]},
                    "tooltip": {
                        "formatter": "__FMT__boxplot_tooltip"
                    }
                }
            ]
        }

        if outlier_data:
            config["series"].append({
                "name": "异常值",
                "type": "scatter",
                "data": outlier_data,
                "itemStyle": {"color": palette[4] if len(palette) > 4 else "#FF5630"},
                "symbolSize": 6
            })

        return config

    def _build_parallel_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build parallel coordinates chart for multi-variable comparison"""
        palette = self._get_palette()["charts"]

        if not y_fields:
            y_fields = df.select_dtypes(include=['number']).columns.tolist()[:8]
        if len(y_fields) < 3:
            return self._empty_chart_config(None)

        # Build parallel axes
        parallel_axis = []
        for i, col in enumerate(y_fields):
            if col not in df.columns:
                continue
            vals = pd.to_numeric(df[col], errors='coerce').dropna()
            if len(vals) == 0:
                continue
            parallel_axis.append({
                "dim": i,
                "name": col,
                "min": round(float(vals.min()), 2),
                "max": round(float(vals.max()), 2)
            })

        if len(parallel_axis) < 3:
            return self._empty_chart_config(None)

        # Build data rows (limit to 50 for readability)
        data_rows = []
        sample_df = df.head(50)
        for _, row in sample_df.iterrows():
            values = []
            for col in y_fields[:len(parallel_axis)]:
                val = pd.to_numeric(row.get(col), errors='coerce')
                values.append(round(float(val), 2) if not pd.isna(val) else 0)
            data_rows.append(values)

        # Color by label if available
        label_field = x_field or series_field
        line_styles = []
        if label_field and label_field in df.columns:
            labels = sample_df[label_field].astype(str).tolist()
            unique_labels = list(dict.fromkeys(labels))
            for label in labels:
                idx = unique_labels.index(label) if label in unique_labels else 0
                line_styles.append({"color": palette[idx % len(palette)], "opacity": 0.6})

        config = {
            "parallelAxis": parallel_axis,
            "parallel": {
                "left": "5%",
                "right": "13%",
                "bottom": "10%",
                "top": "10%",
                "parallelAxisDefault": {
                    "type": "value",
                    "nameLocation": "end",
                    "nameGap": 20,
                    "nameTextStyle": {"fontSize": 11}
                }
            },
            "tooltip": {"trigger": "item"},
            "series": [{
                "type": "parallel",
                "lineStyle": {"width": 2, "opacity": 0.5},
                "data": data_rows,
                "smooth": True
            }]
        }

        return config

    def _build_budget_comparison_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        options: Optional[dict] = None
    ) -> dict:
        """Build department budget vs actual comparison chart (分部预实对比)

        Grouped bar chart (budget + actual) with achievement rate line overlay.
        Color-coded achievement: green ≥100%, yellow 80-99%, red <80%.
        """
        opts = options or {}
        dept_col = x_field
        budget_col = None
        actual_col = None

        # Resolve budget and actual columns from y_fields or options
        if y_fields and len(y_fields) >= 2:
            budget_col = y_fields[0]
            actual_col = y_fields[1]
        elif opts.get("budget_col") and opts.get("actual_col"):
            budget_col = opts["budget_col"]
            actual_col = opts["actual_col"]

        if not dept_col or not budget_col or not actual_col:
            return self._empty_chart_config("分部预实对比")

        # Aggregate by department
        df[budget_col] = pd.to_numeric(df[budget_col], errors='coerce').fillna(0)
        df[actual_col] = pd.to_numeric(df[actual_col], errors='coerce').fillna(0)
        grouped = df.groupby(dept_col).agg({
            budget_col: 'sum',
            actual_col: 'sum'
        }).reset_index()

        # Sort by budget descending for readability
        grouped = grouped.sort_values(budget_col, ascending=False)

        departments = [str(d) for d in grouped[dept_col].tolist()]
        budgets = grouped[budget_col].tolist()
        actuals = grouped[actual_col].tolist()

        # Calculate achievement rates
        rates = []
        for b, a in zip(budgets, actuals):
            rates.append(round(a / b * 100, 1) if b > 0 else 0)

        # Detect scale for axis formatting
        max_val = max(max(budgets, default=0), max(actuals, default=0))
        scale_unit = ""
        scale_divisor = 1
        if max_val >= 1e8:
            scale_unit = "亿"
            scale_divisor = 1e8
        elif max_val >= 1e4:
            scale_unit = "万"
            scale_divisor = 1e4

        # Color each achievement rate point
        def _rate_color(r):
            if r >= 100:
                return "#67c23a"
            if r >= 80:
                return "#e6a23c"
            return "#f56c6c"

        rate_colors = [_rate_color(r) for r in rates]

        # Variance bar data (actual - budget), colored by sign
        variances = [round(a - b, 2) for a, b in zip(actuals, budgets)]

        config = {
            "tooltip": {
                "trigger": "axis",
                "confine": True,
                "axisPointer": {"type": "cross", "crossStyle": {"color": "#999"}},
            },
            "legend": {
                "data": ["预算", "实际", "达成率"],
                "bottom": 0,
                "icon": "rect",
                "itemWidth": 14,
                "itemHeight": 8
            },
            "grid": {
                "top": 50,
                "right": 65,
                "bottom": 50,
                "left": 60,
                "containLabel": True
            },
            "xAxis": {
                "type": "category",
                "data": departments,
                "axisPointer": {"type": "shadow"},
                "axisLabel": {
                    "rotate": 30 if len(departments) > 6 or max((len(d) for d in departments), default=0) > 4 else 0,
                    "hideOverlap": True,
                    "fontSize": 11
                }
            },
            "yAxis": [
                {
                    "type": "value",
                    "name": f"金额{' (' + scale_unit + ')' if scale_unit else ''}",
                    "splitLine": {"lineStyle": {"color": "#ebeef5", "type": "dashed"}},
                    "axisLine": {"show": False},
                    "axisTick": {"show": False},
                    "axisLabel": {"fontSize": 11}
                },
                {
                    "type": "value",
                    "name": "达成率 (%)",
                    "min": 0,
                    "max": max(120, max(rates, default=100) + 10),
                    "splitLine": {"show": False},
                    "axisLine": {"show": False},
                    "axisTick": {"show": False},
                    "axisLabel": {"fontSize": 11}
                }
            ],
            "series": [
                {
                    "name": "预算",
                    "type": "bar",
                    "data": budgets,
                    "barGap": "0%",
                    "itemStyle": {
                        "color": "#1B65A8",
                        "borderRadius": [4, 4, 0, 0]
                    },
                    "emphasis": {"focus": "series"}
                },
                {
                    "name": "实际",
                    "type": "bar",
                    "data": actuals,
                    "barGap": "0%",
                    "itemStyle": {
                        "color": "#67c23a",
                        "borderRadius": [4, 4, 0, 0]
                    },
                    "emphasis": {"focus": "series"}
                },
                {
                    "name": "达成率",
                    "type": "line",
                    "yAxisIndex": 1,
                    "data": rates,
                    "smooth": True,
                    "symbol": "circle",
                    "symbolSize": 8,
                    "lineStyle": {"width": 2, "color": "#e6a23c"},
                    "itemStyle": {
                        "color": rate_colors
                    },
                    "label": {
                        "show": len(departments) <= 12,
                        "position": "top",
                        "fontSize": 11,
                        "formatter": "{c}%"
                    },
                    "markLine": {
                        "silent": True,
                        "symbol": "none",
                        "lineStyle": {"type": "dashed"},
                        "data": [
                            {"yAxis": 80, "label": {"show": True, "formatter": "80%", "position": "end"}, "lineStyle": {"color": "#f56c6c"}},
                            {"yAxis": 100, "label": {"show": True, "formatter": "100%", "position": "end"}, "lineStyle": {"color": "#67c23a"}}
                        ]
                    }
                }
            ]
        }

        # Add dataZoom for many departments
        if len(departments) > 10:
            end_pct = min(100, round((10 / len(departments)) * 100))
            config["dataZoom"] = [
                {"type": "slider", "show": True, "xAxisIndex": 0, "start": 0, "end": end_pct, "height": 20, "bottom": 8},
                {"type": "inside", "xAxisIndex": 0, "start": 0, "end": end_pct}
            ]
            config["grid"]["bottom"] = 60

        return config

    def _build_correlation_matrix_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build correlation matrix as heatmap"""
        palette = self._get_palette()

        if not y_fields:
            y_fields = df.select_dtypes(include=['number']).columns.tolist()[:10]
        if len(y_fields) < 3:
            return self._build_bar_chart(df, x_field, y_fields, series_field)

        # Compute correlation matrix
        numeric_df = df[y_fields].apply(pd.to_numeric, errors='coerce')
        corr_matrix = numeric_df.corr()

        # Build heatmap data
        heatmap_data = []
        labels = y_fields[:len(corr_matrix)]
        for i, col_i in enumerate(labels):
            for j, col_j in enumerate(labels):
                val = corr_matrix.loc[col_i, col_j] if col_i in corr_matrix.index and col_j in corr_matrix.columns else 0
                if pd.isna(val):
                    val = 0
                heatmap_data.append([i, j, round(float(val), 2)])

        config = {
            "xAxis": {
                "type": "category",
                "data": labels,
                "axisLabel": {"rotate": 45, "fontSize": 10}
            },
            "yAxis": {
                "type": "category",
                "data": labels,
                "axisLabel": {"fontSize": 10}
            },
            "tooltip": {
                "trigger": "item",
                "formatter": "__FMT__correlation_tooltip"
            },
            "grid": {"left": "15%", "right": "10%", "bottom": "20%", "top": "5%"},
            "visualMap": {
                "min": -1,
                "max": 1,
                "calculable": True,
                "orient": "horizontal",
                "left": "center",
                "bottom": "0%",
                "inRange": {
                    "color": ["#FF5630", "#FF8B6A", "#ffffff", "#4C9AFF", "#1B65A8"]
                },
                "text": ["正相关", "负相关"],
                "textStyle": {"fontSize": 11}
            },
            "series": [{
                "type": "heatmap",
                "data": heatmap_data,
                "label": {
                    "show": True,
                    "fontSize": 10,
                    "formatter": "__FMT__correlation_label"
                },
                "emphasis": {
                    "itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.3)"}
                }
            }]
        }

        return config

    # ==================== Sankey / Treemap / Gantt ====================

    def _build_sankey_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        title: Optional[str] = None,
        theme_key: str = "business"
    ) -> dict:
        """Build Sankey flow diagram from source->target->value data.

        Auto-detects source/target/value columns from DataFrame.
        If not obvious flow data, creates P&L-style flow
        (Revenue -> Gross Profit -> Operating Profit -> Net Profit).
        """
        palette = self._get_palette()["charts"]

        # --- Detect source/target/value columns ---
        source_col, target_col, value_col = None, None, None
        col_lower_map = {c.lower().strip(): c for c in df.columns}

        # Explicit column hints
        for alias, target_name in [
            (('source', '来源', 'from', '源'), 'source'),
            (('target', '目标', 'to', '去向', '流向'), 'target'),
            (('value', '金额', '数值', 'amount', 'weight'), 'value'),
        ]:
            for a in alias:
                if a in col_lower_map:
                    if target_name == 'source':
                        source_col = col_lower_map[a]
                    elif target_name == 'target':
                        target_col = col_lower_map[a]
                    elif target_name == 'value':
                        value_col = col_lower_map[a]
                    break

        # Fallback: first two non-numeric cols = source/target, first numeric = value
        if not source_col or not target_col:
            non_num = [c for c in df.columns if c not in df.select_dtypes(include=[np.number]).columns]
            num_cols = list(df.select_dtypes(include=[np.number]).columns)
            if len(non_num) >= 2 and len(num_cols) >= 1:
                source_col = source_col or non_num[0]
                target_col = target_col or non_num[1]
                value_col = value_col or num_cols[0]

        # If still no valid flow structure, attempt P&L-style auto-flow
        if not source_col or not target_col or not value_col:
            return self._build_sankey_pnl_auto(df, x_field, y_fields, palette)

        # --- Build nodes and links ---
        node_set = set()
        links = []
        for _, row in df.iterrows():
            src = str(row.get(source_col, '')).strip()
            tgt = str(row.get(target_col, '')).strip()
            try:
                val = abs(float(pd.to_numeric(row.get(value_col), errors='coerce')))
            except (ValueError, TypeError):
                continue
            if not src or not tgt or val == 0 or not math.isfinite(val):
                continue
            node_set.add(src)
            node_set.add(tgt)
            links.append({"source": src, "target": tgt, "value": round(val, 2)})

        if not links:
            return self._empty_chart_config("桑基图无有效流向数据")

        # Assign colors to nodes
        nodes = []
        for i, name in enumerate(sorted(node_set)):
            nodes.append({
                "name": name,
                "itemStyle": {"color": palette[i % len(palette)]},
            })

        total_value = sum(lk["value"] for lk in links)
        orient = "horizontal" if len(nodes) <= 10 else "vertical"

        config = {
            "series": [{
                "type": "sankey",
                "layout": "none",
                "orient": orient,
                "nodeWidth": 20,
                "nodeGap": 12,
                "draggable": True,
                "emphasis": {
                    "focus": "adjacency",
                    "blurScope": "global",
                },
                "lineStyle": {
                    "color": "gradient",
                    "curveness": 0.5,
                    "opacity": 0.4,
                },
                "label": {
                    "show": True,
                    "fontSize": 11,
                    "color": "#333",
                    "formatter": "__FMT__sankey_node_label",
                },
                "data": nodes,
                "links": links,
                "tooltip": {
                    "trigger": "item",
                    "formatter": "__FMT__sankey_tooltip",
                },
                "levels": [
                    {
                        "depth": 0,
                        "itemStyle": {"borderWidth": 1, "borderColor": "#aaa"},
                        "lineStyle": {"opacity": 0.5},
                    },
                    {
                        "depth": 1,
                        "itemStyle": {"borderWidth": 1, "borderColor": "#aaa"},
                        "lineStyle": {"opacity": 0.4},
                    },
                    {
                        "depth": 2,
                        "itemStyle": {"borderWidth": 1, "borderColor": "#aaa"},
                        "lineStyle": {"opacity": 0.3},
                    },
                ],
            }],
            "tooltip": {
                **self._make_enhanced_tooltip("item"),
                "formatter": "__FMT__sankey_tooltip",
            },
            "_sankeyMeta": {
                "totalValue": round(total_value, 2),
                "nodeCount": len(nodes),
                "linkCount": len(links),
            },
        }

        return config

    def _build_sankey_pnl_auto(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        palette: list
    ) -> dict:
        """Auto-create P&L-style Sankey when no explicit source/target columns.

        Builds flow: 营业收入 -> [营业成本, 各项费用] -> 毛利润 -> 营业利润 -> 净利润
        """
        # Try to find item/value columns
        item_col = x_field
        if not item_col:
            for c in df.columns:
                if c.lower() in ('item', '项目', '科目', 'name', '名称'):
                    item_col = c
                    break
        if not item_col:
            non_num = [c for c in df.columns if c not in df.select_dtypes(include=[np.number]).columns]
            item_col = non_num[0] if non_num else None

        numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
        val_col = y_fields[0] if y_fields and y_fields[0] in df.columns else (numeric_cols[0] if numeric_cols else None)

        if not item_col or not val_col:
            return self._empty_chart_config("桑基图需要分类列和数值列")

        # Aggregate by item
        grouped = df.groupby(item_col)[val_col].sum()

        # Classify items
        revenue_items = {}
        cost_items = {}
        expense_items = {}
        tax_items = {}

        revenue_kw = ['收入', '营收', 'revenue', 'income', 'sales']
        cost_kw = ['成本', 'cost', 'cogs']
        expense_kw = ['费用', '管理', '销售', '研发', '财务', 'expense', 'admin', 'selling']
        tax_kw = ['税', 'tax']

        for item_name, val in grouped.items():
            name_lower = str(item_name).lower()
            abs_val = abs(float(val))
            if abs_val == 0:
                continue
            if any(kw in name_lower for kw in revenue_kw):
                revenue_items[str(item_name)] = abs_val
            elif any(kw in name_lower for kw in cost_kw):
                cost_items[str(item_name)] = abs_val
            elif any(kw in name_lower for kw in expense_kw):
                expense_items[str(item_name)] = abs_val
            elif any(kw in name_lower for kw in tax_kw):
                tax_items[str(item_name)] = abs_val
            else:
                expense_items[str(item_name)] = abs_val

        total_revenue = sum(revenue_items.values()) or 1
        total_cost = sum(cost_items.values())
        total_expense = sum(expense_items.values())
        total_tax = sum(tax_items.values())
        gross_profit = total_revenue - total_cost
        net_profit = gross_profit - total_expense - total_tax

        # Build nodes
        node_colors = {
            "营业收入": "#FF5630",
            "毛利润": "#1B65A8",
            "净利润": "#1B65A8",
        }
        node_names = ["营业收入"]
        links = []

        # Revenue -> costs
        for name, val in cost_items.items():
            node_names.append(name)
            node_colors[name] = "#36B37E"
            links.append({"source": "营业收入", "target": name, "value": round(val, 2)})

        # Revenue -> Gross Profit
        if gross_profit > 0:
            node_names.append("毛利润")
            links.append({"source": "营业收入", "target": "毛利润", "value": round(gross_profit, 2)})

            # Gross Profit -> expenses
            for name, val in expense_items.items():
                node_names.append(name)
                node_colors[name] = "#57D9A3"
                links.append({"source": "毛利润", "target": name, "value": round(val, 2)})

            for name, val in tax_items.items():
                node_names.append(name)
                node_colors[name] = "#6B778C"
                links.append({"source": "毛利润", "target": name, "value": round(val, 2)})

            # Gross Profit -> Net Profit
            if net_profit > 0:
                node_names.append("净利润")
                links.append({"source": "毛利润", "target": "净利润", "value": round(net_profit, 2)})

        if not links:
            return self._empty_chart_config("无法构建损益流向，请确保数据包含收入和成本项")

        nodes = []
        seen = set()
        for name in node_names:
            if name not in seen:
                seen.add(name)
                nodes.append({
                    "name": name,
                    "itemStyle": {"color": node_colors.get(name, palette[len(seen) % len(palette)])},
                })

        return {
            "series": [{
                "type": "sankey",
                "layout": "none",
                "orient": "horizontal",
                "nodeWidth": 20,
                "nodeGap": 14,
                "draggable": True,
                "emphasis": {"focus": "adjacency"},
                "lineStyle": {"color": "gradient", "curveness": 0.5, "opacity": 0.4},
                "label": {
                    "show": True,
                    "fontSize": 11,
                    "formatter": "__FMT__sankey_node_label",
                },
                "data": nodes,
                "links": links,
                "levels": [
                    {"depth": 0, "itemStyle": {"borderWidth": 1, "borderColor": "#aaa"}},
                    {"depth": 1, "lineStyle": {"opacity": 0.4}},
                    {"depth": 2, "lineStyle": {"opacity": 0.3}},
                ],
            }],
            "tooltip": {
                **self._make_enhanced_tooltip("item"),
                "formatter": "__FMT__sankey_tooltip",
            },
        }

    def _build_treemap_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        title: Optional[str] = None,
        theme_key: str = "business"
    ) -> dict:
        """Build Treemap for hierarchical proportion visualization.

        Size = absolute value, Color = growth rate or category.
        Supports drill-down via breadcrumb navigation.
        Auto-detects parent-child hierarchy or creates single-level treemap.
        """
        palette = self._get_palette()["charts"]
        numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
        if len(numeric_cols) == 0:
            return self._empty_chart_config("矩阵树图需要数值列")

        name_col = x_field
        if not name_col:
            non_num = [c for c in df.columns if c not in numeric_cols]
            name_col = non_num[0] if non_num else None

        value_col = y_fields[0] if y_fields and y_fields[0] in df.columns else numeric_cols[0]

        # Check for parent column (hierarchy)
        parent_col = None
        for c in df.columns:
            cl = c.lower().strip()
            if cl in ('parent', '父级', '上级', '大类', 'category', '分类', 'group', '组'):
                if c != name_col and c != value_col:
                    parent_col = c
                    break

        # Growth/color column (secondary numeric)
        color_col = None
        if y_fields and len(y_fields) >= 2 and y_fields[1] in df.columns:
            color_col = y_fields[1]
        elif len(numeric_cols) >= 2:
            remaining = [c for c in numeric_cols if c != value_col]
            color_col = remaining[0] if remaining else None

        total_value = 0

        if parent_col and name_col:
            # --- Hierarchical treemap ---
            parent_map = {}  # parent_name -> {children: [...], value: 0}
            for _, row in df.iterrows():
                parent_name = str(row.get(parent_col, '其他')).strip() or '其他'
                child_name = str(row.get(name_col, '')).strip()
                try:
                    val = abs(float(pd.to_numeric(row.get(value_col), errors='coerce')))
                except (ValueError, TypeError):
                    val = 0
                if not child_name or val == 0 or not math.isfinite(val):
                    continue

                if parent_name not in parent_map:
                    parent_map[parent_name] = {"children": [], "value": 0}
                child_entry = {"name": child_name, "value": round(val, 2)}
                if color_col:
                    try:
                        cv = float(pd.to_numeric(row.get(color_col), errors='coerce'))
                        if math.isfinite(cv):
                            child_entry["colorValue"] = round(cv, 2)
                    except (ValueError, TypeError):
                        pass
                parent_map[parent_name]["children"].append(child_entry)
                parent_map[parent_name]["value"] += val
                total_value += val

            tree_data = []
            for i, (pname, pdata) in enumerate(sorted(parent_map.items(), key=lambda x: -x["value"])):
                node = {
                    "name": pname,
                    "value": round(pdata["value"], 2),
                    "children": sorted(pdata["children"], key=lambda c: -c["value"]),
                    "itemStyle": {"borderColor": palette[i % len(palette)], "borderWidth": 2},
                }
                tree_data.append(node)
        else:
            # --- Single-level treemap ---
            if name_col:
                grouped = df.groupby(name_col)[value_col].sum()
            else:
                grouped = df[value_col]

            tree_data = []
            color_values = []
            for i, (name, val) in enumerate(
                sorted(
                    ((str(k), abs(float(v))) for k, v in grouped.items() if pd.notna(v) and float(v) != 0),
                    key=lambda x: -x[1]
                )
            ):
                if not math.isfinite(val):
                    continue
                entry = {"name": name, "value": round(val, 2)}
                total_value += val

                if color_col and name_col:
                    # Get mean color value for this group
                    mask = df[name_col].astype(str) == name
                    cv_series = pd.to_numeric(df.loc[mask, color_col], errors='coerce').dropna()
                    if len(cv_series) > 0:
                        cv = float(cv_series.mean())
                        if math.isfinite(cv):
                            entry["colorValue"] = round(cv, 2)
                            color_values.append(cv)

                tree_data.append(entry)

        if not tree_data:
            return self._empty_chart_config("矩阵树图无有效数据")

        # Build ECharts treemap config
        series_config = {
            "type": "treemap",
            "data": tree_data,
            "roam": True,
            "width": "92%",
            "height": "85%",
            "top": "5%",
            "left": "center",
            "breadcrumb": {
                "show": True,
                "bottom": 5,
                "left": "center",
                "itemStyle": {
                    "color": "#f5f5f5",
                    "borderColor": "#ddd",
                    "borderWidth": 1,
                    "shadowBlur": 2,
                    "shadowColor": "rgba(0,0,0,0.05)",
                    "textStyle": {"color": "#333", "fontSize": 12},
                },
                "emphasis": {
                    "itemStyle": {"color": "#e0e0e0"},
                },
            },
            "label": {
                "show": True,
                "formatter": "__FMT__treemap_label",
                "fontSize": 12,
                "color": "#fff",
                "fontWeight": "bold",
                "textShadowBlur": 2,
                "textShadowColor": "rgba(0,0,0,0.3)",
            },
            "upperLabel": {
                "show": True,
                "height": 24,
                "color": "#fff",
                "fontSize": 12,
                "fontWeight": "bold",
                "backgroundColor": "transparent",
            },
            "itemStyle": {
                "borderColor": "#fff",
                "borderWidth": 2,
                "gapWidth": 2,
            },
            "levels": [
                {
                    "itemStyle": {
                        "borderColor": "#999",
                        "borderWidth": 3,
                        "gapWidth": 3,
                    },
                    "upperLabel": {"show": True},
                },
                {
                    "itemStyle": {
                        "borderColor": "#ccc",
                        "borderWidth": 2,
                        "gapWidth": 2,
                    },
                    "label": {"show": True},
                    "upperLabel": {"show": False},
                },
                {
                    "itemStyle": {
                        "borderColor": "#ddd",
                        "borderWidth": 1,
                        "gapWidth": 1,
                    },
                    "label": {"show": True, "fontSize": 10},
                },
            ],
            "emphasis": {
                "itemStyle": {
                    "shadowBlur": 10,
                    "shadowColor": "rgba(0,0,0,0.2)",
                },
            },
        }

        config = {
            "series": [series_config],
            "tooltip": {
                **self._make_enhanced_tooltip("item"),
                "formatter": "__FMT__treemap_tooltip",
            },
            "_treemapMeta": {
                "totalValue": round(total_value, 2),
                "nodeCount": len(tree_data),
                "hasHierarchy": parent_col is not None,
            },
        }

        # Add visualMap for color dimension
        if color_col:
            # Collect all color values from tree_data (leaf level)
            all_cv = []
            def _collect_cv(nodes):
                for n in nodes:
                    if "colorValue" in n:
                        all_cv.append(n["colorValue"])
                    if "children" in n:
                        _collect_cv(n["children"])
            _collect_cv(tree_data)

            if all_cv:
                config["visualMap"] = {
                    "show": True,
                    "type": "continuous",
                    "min": min(all_cv),
                    "max": max(all_cv),
                    "calculable": True,
                    "orient": "horizontal",
                    "left": "center",
                    "bottom": 30,
                    "text": [f"高 ({color_col})", f"低"],
                    "inRange": {
                        "color": ["#57D9A3", "#FFAB00", "#FF5630"]
                    },
                    "textStyle": {"fontSize": 11},
                    "dimension": "colorValue",
                    "seriesIndex": 0,
                }

        return config

    def _build_gantt_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        title: Optional[str] = None,
        theme_key: str = "business"
    ) -> dict:
        """Build Gantt chart using stacked bar trick on a time axis.

        Uses horizontal bars: transparent base + colored bar for each task.
        Y-axis = task names (category, inverse), X-axis = time axis.
        Color by status: completed=#36B37E, in-progress=#1B65A8, delayed=#FF5630, planned=#6B778C.
        Progress fill: darker shade for completed portion.
        Today line: red dashed markLine at current date.
        """
        palette = self._get_palette()

        # --- Detect columns ---
        col_lower = {c.lower().strip(): c for c in df.columns}

        task_col = x_field
        if not task_col:
            for alias in ('task', '任务', 'name', '名称', '项目', 'activity', '活动'):
                if alias in col_lower:
                    task_col = col_lower[alias]
                    break
        if not task_col:
            non_num = [c for c in df.columns if c not in df.select_dtypes(include=[np.number]).columns]
            task_col = non_num[0] if non_num else df.columns[0]

        start_col, end_col = None, None
        for alias in ('start', '开始', 'start_date', '开始日期', '起始'):
            if alias in col_lower:
                start_col = col_lower[alias]
                break
        for alias in ('end', '结束', 'end_date', '结束日期', '截止', 'finish', '完成日期'):
            if alias in col_lower:
                end_col = col_lower[alias]
                break

        # Try y_fields for start/end
        if not start_col and y_fields and len(y_fields) >= 1:
            start_col = y_fields[0] if y_fields[0] in df.columns else None
        if not end_col and y_fields and len(y_fields) >= 2:
            end_col = y_fields[1] if y_fields[1] in df.columns else None

        if not start_col or not end_col:
            # Fallback: look for date-like columns
            date_cols = []
            for c in df.columns:
                if c == task_col:
                    continue
                try:
                    parsed = pd.to_datetime(df[c], errors='coerce')
                    if parsed.notna().sum() > len(df) * 0.5:
                        date_cols.append(c)
                except Exception:
                    continue
            if len(date_cols) >= 2:
                start_col = start_col or date_cols[0]
                end_col = end_col or date_cols[1]

        if not start_col or not end_col:
            return self._empty_chart_config("甘特图需要开始日期和结束日期列")

        # Detect status and progress columns
        status_col = None
        progress_col = None
        category_col = None
        for alias in ('status', '状态'):
            if alias in col_lower:
                status_col = col_lower[alias]
                break
        for alias in ('progress', '进度', 'completion', '完成率', 'percent'):
            if alias in col_lower:
                progress_col = col_lower[alias]
                break
        for alias in ('category', '分类', 'group', '组', '阶段', 'phase'):
            if alias in col_lower and col_lower[alias] not in (task_col, start_col, end_col, status_col, progress_col):
                category_col = col_lower[alias]
                break

        # Parse dates and build task data
        status_colors = {
            'completed': '#36B37E',
            'complete': '#36B37E',
            '已完成': '#36B37E',
            'in-progress': '#1B65A8',
            'in_progress': '#1B65A8',
            '进行中': '#1B65A8',
            'delayed': '#FF5630',
            '延迟': '#FF5630',
            '超期': '#FF5630',
            'planned': '#6B778C',
            '计划中': '#6B778C',
            '未开始': '#6B778C',
        }
        status_colors_dark = {
            '#36B37E': '#2D9D6C',
            '#1B65A8': '#155290',
            '#FF5630': '#E04A2A',
            '#6B778C': '#596475',
        }

        tasks = []
        all_dates = []
        for _, row in df.iterrows():
            task_name = str(row.get(task_col, '')).strip()
            if not task_name:
                continue
            try:
                start_dt = pd.to_datetime(row.get(start_col), errors='coerce')
                end_dt = pd.to_datetime(row.get(end_col), errors='coerce')
            except Exception:
                continue
            if pd.isna(start_dt) or pd.isna(end_dt):
                continue
            if end_dt < start_dt:
                start_dt, end_dt = end_dt, start_dt

            all_dates.extend([start_dt, end_dt])
            duration = (end_dt - start_dt).days or 1

            # Status
            status_raw = str(row.get(status_col, 'planned')).strip().lower() if status_col else 'planned'
            color = status_colors.get(status_raw, '#6B778C')

            # Progress
            progress = 0
            if progress_col:
                try:
                    pv = float(pd.to_numeric(row.get(progress_col), errors='coerce'))
                    if math.isfinite(pv):
                        progress = min(max(pv, 0), 100)
                        if progress > 1 and progress <= 100:
                            pass  # Already percentage
                        elif 0 < progress <= 1:
                            progress = progress * 100
                except (ValueError, TypeError):
                    pass

            cat = str(row.get(category_col, '')).strip() if category_col else ''

            tasks.append({
                "name": task_name,
                "start": start_dt.strftime("%Y-%m-%d"),
                "end": end_dt.strftime("%Y-%m-%d"),
                "start_ts": int(start_dt.timestamp() * 1000),
                "end_ts": int(end_dt.timestamp() * 1000),
                "duration": duration,
                "color": color,
                "colorDark": status_colors_dark.get(color, color),
                "status": status_raw,
                "progress": round(progress, 1),
                "category": cat,
            })

        if not tasks:
            return self._empty_chart_config("甘特图无有效任务数据")

        # Sort tasks: by category then start date
        if category_col:
            tasks.sort(key=lambda t: (t["category"], t["start"]))
        else:
            tasks.sort(key=lambda t: t["start"])

        # Reverse for ECharts (first task on top)
        tasks = list(reversed(tasks))
        task_names = [t["name"] for t in tasks]

        # Compute time range
        min_date = min(all_dates)
        max_date = max(all_dates)
        # Add 5% padding on each side
        date_range = (max_date - min_date).days or 1
        pad_days = max(int(date_range * 0.05), 1)
        axis_min = (min_date - pd.Timedelta(days=pad_days)).strftime("%Y-%m-%d")
        axis_max = (max_date + pd.Timedelta(days=pad_days)).strftime("%Y-%m-%d")

        # Build stacked bar data: transparent_base + task_bar
        # Using renderItem approach via custom series for precise control
        # However for compatibility we use the stacked bar trick:
        # base (transparent) = start_timestamp, bar = duration in ms

        base_data = []  # Transparent placeholder (start offset)
        bar_data = []   # Colored task bar

        # Use day-based values relative to min_date for stacked bar
        ref_date = min_date - pd.Timedelta(days=pad_days)

        for t in tasks:
            start_offset = (pd.to_datetime(t["start"]) - ref_date).days
            duration = t["duration"]
            base_data.append(start_offset)

            # Bar with individual color and progress overlay
            progress_width = duration * t["progress"] / 100 if t["progress"] > 0 else 0

            bar_data.append({
                "value": duration,
                "itemStyle": {
                    "color": t["color"],
                    "borderRadius": [3, 3, 3, 3],
                    "opacity": 0.85,
                },
                "_task": t,
            })

        # Today line (days from ref_date)
        today = pd.Timestamp.now()
        today_offset = (today - ref_date).days

        # Generate date labels for x-axis
        total_days = (max_date - min_date).days + pad_days * 2
        label_interval = max(total_days // 10, 1)
        x_labels = []
        for i in range(0, total_days + 1, label_interval):
            dt = ref_date + pd.Timedelta(days=i)
            x_labels.append(dt.strftime("%m/%d"))

        # Category separator lines
        separator_lines = []
        if category_col:
            prev_cat = None
            for i, t in enumerate(tasks):
                if prev_cat is not None and t["category"] != prev_cat:
                    separator_lines.append({
                        "yAxis": i - 0.5,
                        "lineStyle": {"type": "dashed", "color": "#ddd", "width": 1},
                        "label": {"show": False},
                        "symbol": ["none", "none"],
                    })
                prev_cat = t["category"]

        config = {
            "grid": {
                "left": "3%",
                "right": "5%",
                "top": "5%",
                "bottom": "12%",
                "containLabel": True,
            },
            "xAxis": {
                "type": "value",
                "name": "日期",
                "min": 0,
                "max": total_days,
                "axisLabel": {
                    "formatter": "__FMT__gantt_date_label",
                    "fontSize": 10,
                },
                "splitLine": {"lineStyle": {"type": "dashed", "color": "#f0f0f0"}},
            },
            "yAxis": {
                "type": "category",
                "data": task_names,
                "inverse": False,  # Already reversed
                "axisLabel": {
                    "fontSize": 11,
                    "width": 100,
                    "overflow": "truncate",
                },
                "axisTick": {"show": False},
                "splitLine": {"show": False},
            },
            "series": [
                {
                    "name": "基准",
                    "type": "bar",
                    "stack": "gantt",
                    "data": base_data,
                    "itemStyle": {"color": "transparent", "borderColor": "transparent"},
                    "emphasis": {"itemStyle": {"color": "transparent"}},
                    "tooltip": {"show": False},
                    "barMaxWidth": 22,
                    "barMinWidth": 12,
                },
                {
                    "name": "任务",
                    "type": "bar",
                    "stack": "gantt",
                    "data": bar_data,
                    "barMaxWidth": 22,
                    "barMinWidth": 12,
                    "label": {
                        "show": True,
                        "position": "inside",
                        "fontSize": 10,
                        "color": "#fff",
                        "formatter": "__FMT__gantt_bar_label",
                    },
                    "emphasis": {
                        "itemStyle": {"shadowBlur": 8, "shadowColor": "rgba(0,0,0,0.2)"},
                    },
                    "markLine": {
                        "silent": True,
                        "symbol": ["none", "none"],
                        "lineStyle": {"type": "dashed", "color": "#FF5630", "width": 2},
                        "label": {
                            "show": True,
                            "position": "start",
                            "formatter": "今天",
                            "color": "#FF5630",
                            "fontSize": 10,
                        },
                        "data": [{"xAxis": today_offset}],
                    },
                },
            ],
            "tooltip": {
                **self._make_enhanced_tooltip("item"),
                "formatter": "__FMT__gantt_tooltip",
            },
            "_ganttMeta": {
                "refDate": ref_date.strftime("%Y-%m-%d"),
                "totalDays": total_days,
                "taskCount": len(tasks),
                "todayOffset": today_offset,
                "tasks": [{
                    "name": t["name"],
                    "start": t["start"],
                    "end": t["end"],
                    "duration": t["duration"],
                    "status": t["status"],
                    "progress": t["progress"],
                    "category": t["category"],
                } for t in tasks],
            },
        }

        # Y-axis dataZoom for many tasks
        if len(tasks) > 15:
            config["dataZoom"] = [
                {
                    "type": "slider",
                    "yAxisIndex": 0,
                    "right": 5,
                    "start": 0,
                    "end": round(15 / len(tasks) * 100),
                    "width": 15,
                    "borderColor": "transparent",
                    "backgroundColor": "#f3f4f6",
                    "fillerColor": "rgba(27,101,168,0.12)",
                    "handleStyle": {"color": "#1B65A8"},
                },
                {"type": "inside", "yAxisIndex": 0},
            ]

        # Category separator markLines
        if separator_lines:
            config["series"][0]["markLine"] = {
                "silent": True,
                "symbol": ["none", "none"],
                "data": separator_lines,
            }

        return config

    def get_available_chart_types(self) -> List[dict]:
        """Get list of available chart types"""
        return [
            {"id": "line", "name": "折线图", "description": "展示趋势变化"},
            {"id": "bar", "name": "柱状图", "description": "对比分析"},
            {"id": "pie", "name": "饼图", "description": "占比分析"},
            {"id": "area", "name": "面积图", "description": "累计趋势"},
            {"id": "scatter", "name": "散点图", "description": "相关性分析"},
            {"id": "waterfall", "name": "瀑布图", "description": "增减分析"},
            {"id": "radar", "name": "雷达图", "description": "多维对比"},
            {"id": "funnel", "name": "漏斗图", "description": "转化分析"},
            {"id": "gauge", "name": "仪表盘", "description": "KPI展示"},
            {"id": "heatmap", "name": "热力图", "description": "分布分析"},
            {"id": "combination", "name": "组合图", "description": "多指标对比"},
            # Advanced charts (Phase 5)
            {"id": "sunburst", "name": "旭日图", "description": "层级结构展示"},
            {"id": "pareto", "name": "帕累托图", "description": "80/20分析"},
            {"id": "bullet", "name": "子弹图", "description": "目标对比"},
            {"id": "dual_axis", "name": "双Y轴图", "description": "不同量纲对比"},
            {"id": "bar_horizontal", "name": "水平柱图", "description": "长标签对比"},
            {"id": "donut", "name": "环形图", "description": "占比分析"},
            {"id": "nested_donut", "name": "嵌套环形图", "description": "多层级占比"},
            # Statistical charts (Phase 5 - Advanced)
            {"id": "boxplot", "name": "箱线图", "description": "数据分布分析（四分位、异常值）"},
            {"id": "parallel", "name": "平行坐标图", "description": "多变量同时对比分析"},
            {"id": "correlation_matrix", "name": "相关性矩阵", "description": "变量间相关性热力图"},
            {"id": "sankey", "name": "桑基图", "description": "流向分析"},
            {"id": "treemap", "name": "矩阵树图", "description": "层级占比分析"},
            {"id": "gantt", "name": "甘特图", "description": "项目进度时间轴"},
        ]
