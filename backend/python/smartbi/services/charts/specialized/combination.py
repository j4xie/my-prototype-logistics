from __future__ import annotations
from typing import List, Optional

import pandas as pd

from ..base import BaseChartStrategy
from ..common import make_enhanced_tooltip
from ..registry import register_chart


@register_chart("combination")
class CombinationChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        series: list = []
        y_axis_list = [{"type": "value", "position": "left"}]

        if y_fields and len(y_fields) >= 2:
            if y_fields[0] in df.columns:
                series.append({"name": y_fields[0], "type": "bar", "data": df[y_fields[0]].tolist(), "yAxisIndex": 0})
            if y_fields[1] in df.columns:
                y_axis_list.append({"type": "value", "position": "right"})
                series.append({"name": y_fields[1], "type": "line", "data": df[y_fields[1]].tolist(), "yAxisIndex": 1, "smooth": True})  # noqa: E501
            for y_field in y_fields[2:]:
                if y_field in df.columns:
                    series.append({"name": y_field, "type": "line", "data": df[y_field].tolist(), "yAxisIndex": 1, "smooth": True})  # noqa: E501

        return {
            "xAxis": {"type": "category", "data": x_data},
            "yAxis": y_axis_list,
            "series": series,
            "tooltip": make_enhanced_tooltip("axis"),
            "legend": {"data": [s["name"] for s in series]},
        }
