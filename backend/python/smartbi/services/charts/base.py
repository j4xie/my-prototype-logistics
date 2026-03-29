from __future__ import annotations
"""
Base chart strategy and slim ChartBuilder orchestrator.

``BaseChartStrategy`` is the ABC that every chart-type module subclasses.
``ChartBuilder`` is the public API kept for backward compatibility --
it delegates to the strategy looked up in the registry.
"""
import logging
import math
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from .common import (
    ANIMATION_PRESETS,
    DATAZOOM_THRESHOLD,
    THEME_PALETTES,
    coerce_numeric_columns,
    detect_value_scale,
    empty_chart_config,
    get_palette,
    make_enhanced_tooltip,
    sanitize_for_json,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Chart type enum (unchanged from original)
# ---------------------------------------------------------------------------

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
    SUNBURST = "sunburst"
    PARETO = "pareto"
    BULLET = "bullet"
    DUAL_AXIS = "dual_axis"
    MATRIX_HEATMAP = "matrix_heatmap"
    BAR_HORIZONTAL = "bar_horizontal"
    SLOPE = "slope"
    DONUT = "donut"
    NESTED_DONUT = "nested_donut"

    # Statistical charts (Phase 5 - Advanced)
    BOXPLOT = "boxplot"
    PARALLEL = "parallel"
    CORRELATION_MATRIX = "correlation_matrix"

    # Text visualization
    WORDCLOUD = "wordcloud"

    # Budget / target vs actual
    BUDGET_COMPARISON = "budget_comparison"


# ---------------------------------------------------------------------------
# Strategy ABC
# ---------------------------------------------------------------------------

class BaseChartStrategy(ABC):
    """Base class for all chart-type strategies."""

    @abstractmethod
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        """Build the raw ECharts option dict for this chart type.

        Returns a dict that will be post-processed by ChartBuilder (common
        options, animations, anomaly detection, etc.).
        """
        ...


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class ChartBuilder:
    """Slim ECharts configuration builder -- delegates to strategy registry.

    Keeps the exact same public API as the original monolith so existing
    callers (``chart.py``, ``chat.py``, ``excel.py``, ``unified_analyzer.py``)
    continue to work unchanged.
    """

    # Expose palette on the class for callers that read ``ChartBuilder.THEME_PALETTES``
    THEME_PALETTES = THEME_PALETTES
    DEFAULT_COLORS = THEME_PALETTES["business"]["charts"]
    GRADIENT_COLORS = THEME_PALETTES["business"]["gradients"]
    DATAZOOM_THRESHOLD = DATAZOOM_THRESHOLD
    ANIMATION_PRESETS = ANIMATION_PRESETS

    def __init__(self):
        pass

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

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
        options: Optional[dict] = None,
    ) -> Dict[str, Any]:
        """Build ECharts configuration (same signature as original)."""
        try:
            df = pd.DataFrame(data)
            if df.empty:
                return {"success": True, "chartType": chart_type,
                        "config": sanitize_for_json(empty_chart_config(title))}

            df = coerce_numeric_columns(df)
            chart_type_enum = ChartType(chart_type.lower())

            # Lazy import to avoid circular refs (registry is populated when
            # the subpackage __init__ modules are first loaded).
            from .registry import get_strategy

            strategy = get_strategy(chart_type_enum.value)
            config = strategy.build(
                df,
                x_field=x_field,
                y_fields=y_fields,
                series_field=series_field,
                options=options,
            )

            # Mark annotations
            config = self._add_mark_annotations(config, df, y_fields, chart_type_enum.value)

            # Common options (theme, legend, animations, dataZoom, ...)
            config = self._add_common_options(
                config, title, subtitle, theme, options, chart_type_enum.value, df=df,
            )

            # Emphasis / blur three-state
            for s in config.get("series", []):
                if isinstance(s, dict):
                    s.setdefault("emphasis", {}).setdefault("focus", "series")
                    s.setdefault("blur", {}).setdefault("itemStyle", {}).setdefault("opacity", 0.15)

            # Anomaly detection
            anomalies = self._detect_chart_anomalies(df, y_fields, chart_type_enum.value)

            result: Dict[str, Any] = {
                "success": True,
                "chartType": chart_type,
                "config": sanitize_for_json(config),
            }
            if anomalies:
                result["anomalies"] = sanitize_for_json(anomalies)
            return result

        except Exception as e:
            logger.error(f"Chart build failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "config": empty_chart_config(title),
            }

    # ------------------------------------------------------------------
    # Helpers kept on the orchestrator (shared across chart types)
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_value_scale(values: list) -> dict:
        return detect_value_scale(values)

    def _add_mark_annotations(
        self,
        config: dict,
        df: pd.DataFrame,
        y_fields: Optional[List[str]],
        chart_type: str,
    ) -> dict:
        if chart_type not in ("bar", "line", "area"):
            return config
        series = config.get("series", [])
        if not series or not y_fields:
            return config

        for s in series:
            if s.get("type") not in ("bar", "line"):
                continue
            s_name = s.get("name", "")
            if s_name in ("Placeholder", "趋势线") or "预测" in s_name or "置信" in s_name:
                continue
            data_vals = s.get("data", [])
            numeric_vals = [
                v for v in data_vals
                if isinstance(v, (int, float)) and not (isinstance(v, float) and (math.isnan(v) or math.isinf(v)))
            ]
            if len(numeric_vals) < 3:
                continue
            s["markLine"] = {
                "silent": True,
                "lineStyle": {"type": "dashed", "color": "#9ca3af", "width": 1},
                "label": {
                    "position": "insideEndTop", "fontSize": 10, "color": "#6b7280",
                    "formatter": "均值: {c}",
                },
                "data": [{"type": "average", "name": "均值"}],
            }
            if s is series[0] or len(series) == 1:
                s["markPoint"] = {
                    "symbolSize": 40,
                    "label": {"fontSize": 10},
                    "data": [
                        {"type": "max", "name": "最高"},
                        {"type": "min", "name": "最低"},
                    ],
                }
        return config

    def _add_common_options(
        self,
        config: dict,
        title: Optional[str],
        subtitle: Optional[str],
        theme: str,
        options: Optional[dict],
        chart_type: str = "",
        df: Optional[pd.DataFrame] = None,
    ) -> dict:
        palette = get_palette()
        config["color"] = palette["charts"]

        if "grid" not in config:
            config["grid"] = {
                "left": "3%", "right": "4%", "top": "8%", "bottom": "3%",
                "containLabel": True,
            }

        if "legend" in config:
            legend = config["legend"]
            legend_data = legend.get("data", [])
            if len(legend_data) > 5:
                legend["type"] = "scroll"
            if legend.get("orient") != "vertical":
                legend.setdefault("bottom", 0)
                legend.setdefault("left", "center")

        # X-axis Chinese auto-adapt
        x_axis = config.get("xAxis")
        if isinstance(x_axis, dict) and x_axis.get("type") == "category":
            x_data = x_axis.get("data", [])
            max_len = max((len(str(d)) for d in x_data), default=0)
            if max_len > 4:
                x_axis.setdefault("axisLabel", {})
                x_axis["axisLabel"]["rotate"] = 30
                x_axis["axisLabel"]["overflow"] = "truncate"
                x_axis["axisLabel"]["width"] = 80
            if len(x_data) > DATAZOOM_THRESHOLD:
                config["dataZoom"] = [
                    {
                        "type": "slider", "start": 0,
                        "end": round(DATAZOOM_THRESHOLD / len(x_data) * 100),
                        "borderColor": "transparent", "backgroundColor": "#f3f4f6",
                        "fillerColor": "rgba(45,139,87,0.12)",
                        "handleStyle": {"color": "#2D8B57"},
                    },
                    {"type": "inside"},
                ]
                config["grid"]["bottom"] = "15%"

        # Large-dataset optimisation
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

        # ARIA accessibility
        config["aria"] = {"enabled": True, "decal": {"show": True}}

        # Tooltip confine
        tooltip = config.get("tooltip", {})
        if isinstance(tooltip, dict):
            tooltip["confine"] = True
            config["tooltip"] = tooltip

        # Animations
        config["animation"] = True
        preset = ANIMATION_PRESETS.get(chart_type, {})
        config["animationDuration"] = preset.get("animationDuration", 800)
        config["animationEasing"] = preset.get("animationEasing", "cubicOut")
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
        chart_type: str,
    ) -> Dict[str, Any]:
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
                        "deviation": round(float(deviation), 2),
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

    # ------------------------------------------------------------------
    # get_available_chart_types (unchanged)
    # ------------------------------------------------------------------

    def get_available_chart_types(self) -> List[dict]:
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
            {"id": "sunburst", "name": "旭日图", "description": "层级结构展示"},
            {"id": "pareto", "name": "帕累托图", "description": "80/20分析"},
            {"id": "bullet", "name": "子弹图", "description": "目标对比"},
            {"id": "dual_axis", "name": "双Y轴图", "description": "不同量纲对比"},
            {"id": "bar_horizontal", "name": "水平柱图", "description": "长标签对比"},
            {"id": "donut", "name": "环形图", "description": "占比分析"},
            {"id": "nested_donut", "name": "嵌套环形图", "description": "多层级占比"},
            {"id": "boxplot", "name": "箱线图", "description": "数据分布分析（四分位、异常值）"},
            {"id": "parallel", "name": "平行坐标图", "description": "多变量同时对比分析"},
            {"id": "correlation_matrix", "name": "相关性矩阵", "description": "变量间相关性热力图"},
            {"id": "sankey", "name": "桑基图", "description": "流向分析"},
            {"id": "treemap", "name": "矩阵树图", "description": "层级占比分析"},
            {"id": "gantt", "name": "甘特图", "description": "项目进度时间轴"},
            {"id": "slope", "name": "斜率图", "description": "两期对比变化"},
            {"id": "matrix_heatmap", "name": "矩阵热力图", "description": "交叉分析热力图"},
            {"id": "wordcloud", "name": "词云图", "description": "关键词频率可视化"},
            {"id": "budget_comparison", "name": "分部预实对比", "description": "预算与实际对比分析"},
        ]
