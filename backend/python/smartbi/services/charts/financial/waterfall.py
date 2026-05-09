from __future__ import annotations
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import (
    detect_value_scale,
    empty_chart_config,
    make_bar_label,
    make_enhanced_tooltip,
    scale_series_data,
)
from ..registry import register_chart


@register_chart("waterfall")
class WaterfallChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols) == 0:
            return empty_chart_config("瀑布图需要数值列")
        x_data = df[x_field].tolist() if x_field else df.index.tolist()
        y_col = y_fields[0] if y_fields else numeric_cols[0]
        values = pd.to_numeric(df[y_col], errors='coerce').fillna(0).tolist()

        placeholder_data: list = []
        positive_data: list = []
        negative_data: list = []

        cumulative = 0
        for i, val in enumerate(values):
            if i == 0:
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

        scale = detect_value_scale(values)
        if scale["divisor"] != 1:
            placeholder_data = scale_series_data(placeholder_data, scale["divisor"])
            positive_data = scale_series_data(positive_data, scale["divisor"])
            negative_data = scale_series_data(negative_data, scale["divisor"])

        return {
            "xAxis": {"type": "category", "data": x_data},
            "yAxis": {
                "type": "value",
                "name": scale["name_suffix"].strip() if scale["name_suffix"] else None,
            },
            "series": [
                {
                    "name": "Placeholder", "type": "bar", "stack": "Total",
                    "itemStyle": {"color": "transparent"},
                    "data": placeholder_data,
                },
                {
                    "name": "增长", "type": "bar", "stack": "Total",
                    "itemStyle": {"color": "#36B37E", "borderRadius": [4, 4, 0, 0]},
                    "label": make_bar_label(scale["suffix"]),
                    "data": positive_data,
                },
                {
                    "name": "下降", "type": "bar", "stack": "Total",
                    "itemStyle": {"color": "#FF5630", "borderRadius": [4, 4, 0, 0]},
                    "label": make_bar_label(scale["suffix"]),
                    "data": negative_data,
                },
            ],
            "tooltip": make_enhanced_tooltip("axis"),
        }


@register_chart("budget_comparison")
class BudgetComparisonChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        opts = options or {}
        dept_col = x_field
        budget_col = None
        actual_col = None

        if y_fields and len(y_fields) >= 2:
            budget_col = y_fields[0]
            actual_col = y_fields[1]
        elif opts.get("budget_col") and opts.get("actual_col"):
            budget_col = opts["budget_col"]
            actual_col = opts["actual_col"]

        if not dept_col or not budget_col or not actual_col:
            return empty_chart_config("分部预实对比")

        df[budget_col] = pd.to_numeric(df[budget_col], errors='coerce').fillna(0)
        df[actual_col] = pd.to_numeric(df[actual_col], errors='coerce').fillna(0)
        grouped = df.groupby(dept_col).agg({budget_col: 'sum', actual_col: 'sum'}).reset_index()
        grouped = grouped.sort_values(budget_col, ascending=False)

        departments = [str(d) for d in grouped[dept_col].tolist()]
        budgets = grouped[budget_col].tolist()
        actuals = grouped[actual_col].tolist()

        rates = [round(a / b * 100, 1) if b > 0 else 0 for b, a in zip(budgets, actuals)]

        max_val = max(max(budgets, default=0), max(actuals, default=0))
        scale_unit = ""
        if max_val >= 1e8:
            scale_unit = "亿"
        elif max_val >= 1e4:
            scale_unit = "万"

        def _rate_color(r):
            if r >= 100:
                return "#67c23a"
            if r >= 80:
                return "#e6a23c"
            return "#f56c6c"

        rate_colors = [_rate_color(r) for r in rates]

        config = {
            "tooltip": {
                "trigger": "axis", "confine": True,
                "axisPointer": {"type": "cross", "crossStyle": {"color": "#999"}},
            },
            "legend": {
                "data": ["预算", "实际", "达成率"], "bottom": 0,
                "icon": "rect", "itemWidth": 14, "itemHeight": 8,
            },
            "grid": {"top": 50, "right": 65, "bottom": 50, "left": 60, "containLabel": True},
            "xAxis": {
                "type": "category", "data": departments,
                "axisPointer": {"type": "shadow"},
                "axisLabel": {
                    "rotate": 30 if len(departments) > 6 or max((len(d) for d in departments), default=0) > 4 else 0,
                    "hideOverlap": True, "fontSize": 11,
                },
            },
            "yAxis": [
                {
                    "type": "value",
                    "name": f"金额{' (' + scale_unit + ')' if scale_unit else ''}",
                    "splitLine": {"lineStyle": {"color": "#ebeef5", "type": "dashed"}},
                    "axisLine": {"show": False}, "axisTick": {"show": False},
                    "axisLabel": {"fontSize": 11},
                },
                {
                    "type": "value", "name": "达成率 (%)", "min": 0,
                    "max": max(120, max(rates, default=100) + 10),
                    "splitLine": {"show": False}, "axisLine": {"show": False},
                    "axisTick": {"show": False}, "axisLabel": {"fontSize": 11},
                },
            ],
            "series": [
                {
                    "name": "预算", "type": "bar", "data": budgets, "barGap": "0%",
                    "itemStyle": {"color": "#2D8B57", "borderRadius": [4, 4, 0, 0]},
                    "emphasis": {"focus": "series"},
                },
                {
                    "name": "实际", "type": "bar", "data": actuals, "barGap": "0%",
                    "itemStyle": {"color": "#67c23a", "borderRadius": [4, 4, 0, 0]},
                    "emphasis": {"focus": "series"},
                },
                {
                    "name": "达成率", "type": "line", "yAxisIndex": 1,
                    "data": rates, "smooth": True, "symbol": "circle", "symbolSize": 8,
                    "lineStyle": {"width": 2, "color": "#e6a23c"},
                    "itemStyle": {"color": rate_colors},
                    "label": {"show": len(departments) <= 12, "position": "top", "fontSize": 11, "formatter": "{c}%"},
                    "markLine": {
                        "silent": True, "symbol": "none", "lineStyle": {"type": "dashed"},
                        "data": [
                            {"yAxis": 80, "label": {"show": True, "formatter": "80%", "position": "end"}, "lineStyle": {"color": "#f56c6c"}},  # noqa: E501
                            {"yAxis": 100, "label": {"show": True, "formatter": "100%", "position": "end"}, "lineStyle": {"color": "#67c23a"}},  # noqa: E501
                        ],
                    },
                },
            ],
        }

        if len(departments) > 10:
            end_pct = min(100, round((10 / len(departments)) * 100))
            config["dataZoom"] = [
                {"type": "slider", "show": True, "xAxisIndex": 0, "start": 0, "end": end_pct, "height": 20, "bottom": 8},  # noqa: E501
                {"type": "inside", "xAxisIndex": 0, "start": 0, "end": end_pct},
            ]
            config["grid"]["bottom"] = 60

        return config
