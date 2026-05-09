from __future__ import annotations
import math
from typing import List, Optional

import pandas as pd

from ..base import BaseChartStrategy
from ..registry import register_chart


@register_chart("bullet")
class BulletChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        x_col = x_field or df.columns[0]
        actual_col = y_fields[0] if y_fields else "actual"
        target_col = y_fields[1] if y_fields and len(y_fields) > 1 else "target"

        x_data = df[x_col].tolist()
        actual_data = pd.to_numeric(df[actual_col], errors='coerce').fillna(0).tolist() if actual_col in df.columns else [0] * len(x_data)  # noqa: E501
        target_data = pd.to_numeric(df[target_col], errors='coerce').fillna(0).tolist() if target_col in df.columns else [100] * len(x_data)  # noqa: E501

        all_vals = [v for v in actual_data + target_data if isinstance(v, (int, float)) and not math.isnan(v)]
        max_val = (max(all_vals) * 1.2) if all_vals else 100

        return {
            "xAxis": {"type": "value", "max": max_val},
            "yAxis": {"type": "category", "data": x_data},
            "series": [
                {"name": "背景", "type": "bar", "data": [max_val] * len(x_data), "barWidth": 30, "itemStyle": {"color": "#eee"}, "z": 1},  # noqa: E501
                {"name": actual_col, "type": "bar", "data": actual_data, "barWidth": 15, "itemStyle": {"color": "#2D8B57"}, "z": 2},  # noqa: E501
                {"name": target_col, "type": "scatter", "data": [[t, i] for i, t in enumerate(target_data)], "symbol": "rect", "symbolSize": [4, 20], "itemStyle": {"color": "#FF5630"}, "z": 3},  # noqa: E501
            ],
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "legend": {"data": [actual_col, target_col]},
        }
