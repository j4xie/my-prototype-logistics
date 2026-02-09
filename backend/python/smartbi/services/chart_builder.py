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
    """Replace NaN/Infinity/-Infinity with None to prevent JSON serialization errors."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(item) for item in obj]
    if isinstance(obj, np.floating):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return 0
        return val
    if isinstance(obj, np.integer):
        return int(obj)
    return obj


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


class ChartBuilder:
    """ECharts configuration builder"""

    # ========== 8-Benchmark Color System ==========
    # Synthesized from: Tableau (professional palettes) + Looker (Material) + Metabase (friendly)
    THEME_PALETTES = {
        "business": {  # 商务蓝 (default) — Tableau + Power BI inspired
            "primary": ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"],
            "secondary": ["#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"],
            "accent": ["#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a"],
            "danger": ["#dc2626", "#ef4444", "#f87171", "#fca5a5"],
            "charts": [
                "#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626",
                "#0891b2", "#c026d3", "#ea580c", "#4f46e5", "#15803d"
            ],
            "gradients": [
                {"start": "#2563eb", "end": "#60a5fa"},   # blue
                {"start": "#059669", "end": "#34d399"},   # green
                {"start": "#d97706", "end": "#fbbf24"},   # gold
                {"start": "#7c3aed", "end": "#a78bfa"},   # purple
                {"start": "#dc2626", "end": "#f87171"},   # red
            ],
            "semantic": {
                "success": "#059669",
                "warning": "#d97706",
                "danger": "#dc2626",
                "info": "#2563eb",
                "muted": "#9ca3af",
            }
        }
    }

    # Active theme
    _active_theme = "business"

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
            "animationDelay": "__FUNC__function(idx){return idx*80}",
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
            "animationDelayUpdate": "__FUNC__function(idx){return idx*5}",
        },
        "area": {
            "animationDuration": 1200,
            "animationEasing": "cubicOut",
        },
        "waterfall": {
            "animationDuration": 800,
            "animationEasing": "cubicOut",
            "animationDelay": "__FUNC__function(idx){return idx*60}",
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
        except Exception:
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

            mean_val = sum(numeric_vals) / len(numeric_vals)

            # markLine: average reference line
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
            else:
                config = self._build_line_chart(df, x_field, y_fields, series_field)

            # Add mark annotations (average line, max/min points)
            config = self._add_mark_annotations(config, df, y_fields, chart_type_enum.value)

            # Add common options
            config = self._add_common_options(config, title, subtitle, theme, options, chart_type_enum.value)

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
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols) == 0:
            return self._empty_chart_config(None)
        value_field = y_fields[0] if y_fields else numeric_cols[0]

        data = [
            {"name": str(row[name_field]), "value": round(float(row[value_field]), 2)}
            for _, row in df.iterrows()
            if pd.notna(row[value_field])
        ]

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

        # Add area style to series
        for i, s in enumerate(config["series"]):
            s["areaStyle"] = {
                "opacity": 0.3
            }
            s["stack"] = "total" if len(config["series"]) > 1 else None

        return config

    def _build_scatter_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build scatter chart configuration with trendline"""
        x_col = x_field or df.select_dtypes(include=[np.number]).columns[0]
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols) < 2:
            return self._empty_chart_config("散点图需要至少2个数值列")
        y_col = y_fields[0] if y_fields else numeric_cols[1]

        all_x, all_y = [], []
        series = []
        if series_field and series_field in df.columns:
            for name, group in df.groupby(series_field):
                data = []
                for _, row in group.iterrows():
                    try:
                        xv, yv = float(row[x_col]), float(row[y_col])
                        data.append([xv, yv])
                        all_x.append(xv)
                        all_y.append(yv)
                    except (ValueError, TypeError):
                        continue
                series.append({
                    "name": str(name),
                    "type": "scatter",
                    "data": data,
                    "symbolSize": 10
                })
        else:
            data = []
            for _, row in df.iterrows():
                try:
                    xv, yv = float(row[x_col]), float(row[y_col])
                    data.append([xv, yv])
                    all_x.append(xv)
                    all_y.append(yv)
                except (ValueError, TypeError):
                    continue
            series.append({
                "name": f"{x_col} vs {y_col}",
                "type": "scatter",
                "data": data,
                "symbolSize": 10
            })

        # 趋势线：线性回归
        if len(all_x) >= 3:
            try:
                coeffs = np.polyfit(all_x, all_y, 1)
                x_min, x_max = min(all_x), max(all_x)
                series.append({
                    "name": "趋势线",
                    "type": "line",
                    "data": [
                        [round(x_min, 2), round(coeffs[0] * x_min + coeffs[1], 2)],
                        [round(x_max, 2), round(coeffs[0] * x_max + coeffs[1], 2)]
                    ],
                    "smooth": False,
                    "symbol": "none",
                    "lineStyle": {"type": "dashed", "color": "#ff7875", "width": 2},
                    "tooltip": {"show": False}
                })
            except Exception:
                pass

        return {
            "xAxis": {"type": "value", "name": x_col},
            "yAxis": {"type": "value", "name": y_col},
            "series": series,
            "tooltip": self._make_enhanced_tooltip("item")
        }

    def _build_waterfall_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build waterfall chart configuration"""
        x_data = df[x_field].tolist() if x_field else df.index.tolist()
        y_col = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]
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
                    "itemStyle": {"color": "#91cc75", "borderRadius": [4, 4, 0, 0]},
                    "label": self._make_bar_label(scale["suffix"]),
                    "data": positive_data
                },
                {
                    "name": "下降",
                    "type": "bar",
                    "stack": "Total",
                    "itemStyle": {"color": "#ee6666", "borderRadius": [4, 4, 0, 0]},
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
        """Build radar chart configuration"""
        indicators = []
        data_values = []

        # Use y_fields as indicators
        if y_fields:
            for field in y_fields:
                if field in df.columns:
                    max_val = float(df[field].max())
                    indicators.append({"name": field, "max": max_val * 1.2})
                    data_values.append(float(df[field].iloc[0]) if len(df) > 0 else 0)
        else:
            # Use numeric columns
            for col in df.select_dtypes(include=[np.number]).columns[:6]:
                max_val = float(df[col].max())
                indicators.append({"name": col, "max": max_val * 1.2})
                data_values.append(float(df[col].iloc[0]) if len(df) > 0 else 0)

        return {
            "radar": {
                "indicator": indicators
            },
            "series": [{
                "name": "Radar",
                "type": "radar",
                "data": [{
                    "value": data_values,
                    "name": "Value"
                }]
            }],
            "tooltip": {
                "trigger": "item"
            }
        }

    def _build_funnel_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build funnel chart configuration"""
        name_field = x_field or df.columns[0]
        value_field = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]

        data = sorted([
            {"name": str(row[name_field]), "value": float(row[value_field])}
            for _, row in df.iterrows()
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
            "tooltip": {
                "trigger": "item",
                "formatter": "{a} <br/>{b}: {c}"
            }
        }

    def _build_gauge_chart(
        self,
        df: pd.DataFrame,
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build gauge chart configuration"""
        value_field = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]
        value = float(df[value_field].iloc[0]) if len(df) > 0 else 0

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
            "tooltip": {
                "formatter": "{a} <br/>{b}: {c}%"
            }
        }

    def _build_heatmap_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build heatmap chart configuration"""
        x_col = x_field or df.columns[0]
        y_col = series_field or df.columns[1]
        value_col = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]

        x_data = df[x_col].unique().tolist()
        y_data = df[y_col].unique().tolist()

        data = []
        for _, row in df.iterrows():
            x_idx = x_data.index(row[x_col])
            y_idx = y_data.index(row[y_col])
            data.append([x_idx, y_idx, float(row[value_col])])

        max_val = df[value_col].max()
        min_val = df[value_col].min()

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
        chart_type: str = ""
    ) -> dict:
        """Add common ECharts options with visual enhancements (8-benchmark synthesis)"""
        palette = self._get_palette()

        # Title (ThoughtSpot minimal style)
        if title:
            config["title"] = {
                "text": title,
                "subtext": subtitle or "",
                "left": "center",
                "textStyle": {"fontSize": 14, "fontWeight": 600, "color": "#374151"},
                "subtextStyle": {"fontSize": 12, "color": "#9ca3af"}
            }

        # Theme colors
        config["color"] = palette["charts"]

        # Grid with better spacing
        if "grid" not in config:
            config["grid"] = {
                "left": "3%",
                "right": "4%",
                "bottom": "3%",
                "containLabel": True
            }

        # Toolbox (minimal, right-aligned)
        config["toolbox"] = {
            "feature": {
                "saveAsImage": {"pixelRatio": 2},
                "dataZoom": {},
                "restore": {}
            },
            "right": 16,
            "top": 4,
            "iconStyle": {"borderColor": "#9ca3af"}
        }

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
            if len(x_data) > 15:
                config["dataZoom"] = [
                    {"type": "slider", "start": 0, "end": round(15 / len(x_data) * 100),
                     "borderColor": "transparent", "backgroundColor": "#f3f4f6",
                     "fillerColor": "rgba(37,99,235,0.12)", "handleStyle": {"color": "#2563eb"}},
                    {"type": "inside"}
                ]
                config["grid"]["bottom"] = "15%"

        # ===== Type-specific animation (Tableau + Power BI Fluent Motion) =====
        config["animation"] = True
        preset = self.ANIMATION_PRESETS.get(chart_type, {})
        config["animationDuration"] = preset.get("animationDuration", 800)
        config["animationEasing"] = preset.get("animationEasing", "cubicOut")
        # JS function refs are serialized as "__FUNC__..." strings — frontend handles eval
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

        value_field = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]

        # Build hierarchical data
        def build_tree(df, level_cols, value_col):
            if not level_cols:
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
                    node["children"] = build_tree(group, remaining_cols, value_col)
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
        x_col = x_field or df.columns[0]
        y_col = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]

        # Sort by value descending
        sorted_df = df.sort_values(y_col, ascending=False)
        x_data = sorted_df[x_col].tolist()
        y_data = sorted_df[y_col].tolist()

        # Calculate cumulative percentage
        total = sum(y_data)
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
                    "itemStyle": {"color": "#5470c6"}
                },
                {
                    "name": "累计百分比",
                    "type": "line",
                    "data": cumulative,
                    "yAxisIndex": 1,
                    "smooth": True,
                    "itemStyle": {"color": "#ee6666"},
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
        actual_data = df[actual_col].tolist() if actual_col in df.columns else [0] * len(x_data)
        target_data = df[target_col].tolist() if target_col in df.columns else [100] * len(x_data)

        # Calculate max for background ranges
        max_val = max(max(actual_data), max(target_data)) * 1.2

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
                    "itemStyle": {"color": "#5470c6"},
                    "z": 2
                },
                {
                    "name": target_col,
                    "type": "scatter",
                    "data": [[t, i] for i, t in enumerate(target_data)],
                    "symbol": "rect",
                    "symbolSize": [4, 20],
                    "itemStyle": {"color": "#ee6666"},
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
        y_data = df[x_field].tolist() if x_field else df.index.tolist()

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
        inner_field = x_field or df.columns[0]
        outer_field = series_field or (df.columns[1] if len(df.columns) > 1 else inner_field)
        value_field = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]

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
                    "label": {"formatter": "{b}: {d}%"},
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
            {"id": "nested_donut", "name": "嵌套环形图", "description": "多层级占比"}
        ]
