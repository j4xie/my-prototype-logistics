from __future__ import annotations
from typing import List, Optional

import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, get_palette
from ..registry import register_chart


@register_chart("parallel")
class ParallelChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        palette = get_palette()["charts"]  # noqa: F841

        if not y_fields:
            y_fields = df.select_dtypes(include=['number']).columns.tolist()[:8]
        if len(y_fields) < 3:
            return empty_chart_config(None)

        parallel_axis = []
        for i, col in enumerate(y_fields):
            if col not in df.columns:
                continue
            vals = pd.to_numeric(df[col], errors='coerce').dropna()
            if len(vals) == 0:
                continue
            parallel_axis.append({"dim": i, "name": col, "min": round(float(vals.min()), 2), "max": round(float(vals.max()), 2)})  # noqa: E501

        if len(parallel_axis) < 3:
            return empty_chart_config(None)

        data_rows = []
        sample_df = df.head(50)
        for _, row in sample_df.iterrows():
            values = []
            for col in y_fields[:len(parallel_axis)]:
                val = pd.to_numeric(row.get(col), errors='coerce')
                values.append(round(float(val), 2) if not pd.isna(val) else 0)
            data_rows.append(values)

        return {
            "parallelAxis": parallel_axis,
            "parallel": {
                "left": "5%", "right": "13%", "bottom": "10%", "top": "10%",
                "parallelAxisDefault": {"type": "value", "nameLocation": "end", "nameGap": 20, "nameTextStyle": {"fontSize": 11}},  # noqa: E501
            },
            "tooltip": {"trigger": "item"},
            "series": [{"type": "parallel", "lineStyle": {"width": 2, "opacity": 0.5}, "data": data_rows, "smooth": True}],  # noqa: E501
        }
