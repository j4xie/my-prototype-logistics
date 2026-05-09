from __future__ import annotations
from typing import List, Optional

import pandas as pd

from ..base import BaseChartStrategy
from ..common import (
    detect_value_scale,
    get_palette,
    make_enhanced_tooltip,
    scale_series_data,
)
from ..registry import register_chart


@register_chart("line")
class LineChartStrategy(BaseChartStrategy):
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
                            "emphasis": {"focus": "series"},
                        })
        else:
            palette_colors = get_palette()["charts"]
            for i, y_field in enumerate(y_fields or []):
                if y_field in df.columns:
                    raw = df[y_field].tolist()
                    all_values.extend([v for v in raw if isinstance(v, (int, float))])
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
                                    {"offset": 1, "color": color + "05"},
                                ],
                            }
                        } if i == 0 else None,
                    })

        scale = detect_value_scale(all_values)
        if scale["divisor"] != 1:
            for s in series:
                s["data"] = scale_series_data(s["data"], scale["divisor"])

        for s in series:
            if s.get("areaStyle") is None:
                s.pop("areaStyle", None)

        return {
            "xAxis": {
                "type": "category",
                "data": x_data,
                "boundaryGap": False,
            },
            "yAxis": {
                "type": "value",
                "name": scale["name_suffix"].strip() if scale["name_suffix"] else None,
                "splitLine": {"lineStyle": {"type": "dashed", "color": "#f0f0f0"}},
            },
            "series": series,
            "tooltip": make_enhanced_tooltip("axis"),
            "legend": {"data": [s["name"] for s in series]},
        }
