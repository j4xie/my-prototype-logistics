from __future__ import annotations
from typing import List, Optional

import pandas as pd

from ..base import BaseChartStrategy
from ..registry import register_chart


@register_chart("dual_axis")
class DualAxisChartStrategy(BaseChartStrategy):
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
        y_axis_list: list = []

        if y_fields and len(y_fields) >= 2:
            if y_fields[0] in df.columns:
                y_axis_list.append({"type": "value", "name": y_fields[0], "position": "left"})
                series.append({"name": y_fields[0], "type": "bar", "data": df[y_fields[0]].tolist(), "yAxisIndex": 0})
            if y_fields[1] in df.columns:
                y_axis_list.append({"type": "value", "name": y_fields[1], "position": "right"})
                series.append({"name": y_fields[1], "type": "line", "data": df[y_fields[1]].tolist(), "yAxisIndex": 1, "smooth": True})  # noqa: E501

        return {
            "xAxis": {"type": "category", "data": x_data},
            "yAxis": y_axis_list,
            "series": series,
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "cross"}},
            "legend": {"data": [s["name"] for s in series]},
        }
