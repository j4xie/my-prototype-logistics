from __future__ import annotations
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, make_enhanced_tooltip
from ..registry import register_chart


@register_chart("funnel")
class FunnelChartStrategy(BaseChartStrategy):
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
            return empty_chart_config("漏斗图需要数值列")
        name_field = x_field or df.columns[0]
        value_field = y_fields[0] if y_fields else numeric_cols[0]

        data = sorted(
            [
                {"name": str(row[name_field]), "value": float(pd.to_numeric(row[value_field], errors='coerce') or 0)}
                for _, row in df.iterrows() if pd.notna(row.get(value_field))
            ],
            key=lambda x: x["value"], reverse=True,
        )

        return {
            "series": [{
                "name": "Funnel", "type": "funnel", "left": "10%", "width": "80%",
                "label": {"show": True, "position": "inside"}, "gap": 2, "data": data,
            }],
            "tooltip": {**make_enhanced_tooltip("item"), "formatter": "{a} <br/>{b}: {c}"},
        }
