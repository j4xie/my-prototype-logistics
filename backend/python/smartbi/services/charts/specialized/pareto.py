from __future__ import annotations
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config
from ..registry import register_chart


@register_chart("pareto")
class ParetoChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        numeric_cols_pa = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols_pa) == 0:
            return empty_chart_config("帕累托图需要数值列")
        x_col = x_field or df.columns[0]
        y_col = y_fields[0] if y_fields else numeric_cols_pa[0]

        df_copy = df.copy()
        df_copy[y_col] = pd.to_numeric(df_copy[y_col], errors='coerce').fillna(0)
        sorted_df = df_copy.sort_values(y_col, ascending=False)
        x_data = sorted_df[x_col].tolist()
        y_data = sorted_df[y_col].tolist()

        total = sum(y_data)
        if total == 0:
            return empty_chart_config("帕累托图数据全为零")

        cumulative = []
        cum_sum = 0
        for val in y_data:
            cum_sum += val
            cumulative.append(round(cum_sum / total * 100, 1))

        return {
            "xAxis": {"type": "category", "data": x_data},
            "yAxis": [
                {"type": "value", "name": y_col, "position": "left"},
                {"type": "value", "name": "累计百分比", "position": "right", "max": 100},
            ],
            "series": [
                {"name": y_col, "type": "bar", "data": y_data, "yAxisIndex": 0, "itemStyle": {"color": "#2D8B57"}},
                {
                    "name": "累计百分比", "type": "line", "data": cumulative, "yAxisIndex": 1,
                    "smooth": True, "itemStyle": {"color": "#FF5630"},
                    "markLine": {"data": [{"yAxis": 80, "label": {"formatter": "80%"}}]},
                },
            ],
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "cross"}},
            "legend": {"data": [y_col, "累计百分比"]},
        }
