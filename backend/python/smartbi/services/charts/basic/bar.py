from __future__ import annotations
from typing import List, Optional

import pandas as pd

from ..base import BaseChartStrategy
from ..common import (
    apply_gradient_to_series,
    detect_value_scale,
    make_bar_label,
    make_enhanced_tooltip,
    scale_series_data,
)
from ..registry import register_chart


@register_chart("bar")
class BarChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        all_values: list = []
        series: list = []
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
                            "emphasis": {"focus": "series"},
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
                        "emphasis": {"focus": "series"},
                    })

        scale = detect_value_scale(all_values)
        if scale["divisor"] != 1:
            for s in series:
                s["data"] = scale_series_data(s["data"], scale["divisor"])

        for s in series:
            s["label"] = make_bar_label(scale["suffix"])

        series = apply_gradient_to_series(series)

        return {
            "xAxis": {"type": "category", "data": x_data},
            "yAxis": {
                "type": "value",
                "name": scale["name_suffix"].strip() if scale["name_suffix"] else None,
            },
            "series": series,
            "tooltip": make_enhanced_tooltip("axis"),
            "legend": {"data": [s["name"] for s in series]},
        }


@register_chart("bar_horizontal")
class HorizontalBarChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        y_data = [str(v) for v in (df[x_field].tolist() if x_field else df.index.tolist())]

        series = []
        for y_field in (y_fields or []):
            if y_field in df.columns:
                series.append({
                    "name": y_field,
                    "type": "bar",
                    "data": df[y_field].tolist(),
                    "emphasis": {"focus": "series"},
                })

        return {
            "xAxis": {"type": "value"},
            "yAxis": {"type": "category", "data": y_data},
            "series": series,
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "legend": {"data": [s["name"] for s in series]},
            "grid": {"left": "15%", "right": "4%", "bottom": "3%", "containLabel": True},
        }
