from __future__ import annotations
import math
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import make_enhanced_tooltip
from ..registry import register_chart


@register_chart("radar")
class RadarChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:

        def safe_mean(series):
            try:
                numeric_vals = pd.to_numeric(series, errors='coerce')
                mean_val = numeric_vals.mean()
                return round(float(mean_val), 2) if pd.notna(mean_val) else 0
            except Exception:
                return 0

        indicator_fields = []
        if y_fields:
            indicator_fields = [f for f in y_fields if f in df.columns]
        if not indicator_fields:
            indicator_fields = list(df.select_dtypes(include=[np.number]).columns[:6])

        if not indicator_fields:
            return {"series": [], "tooltip": {"trigger": "item"}}

        indicators = []
        for field in indicator_fields:
            col_numeric = pd.to_numeric(df[field], errors='coerce').dropna()
            max_val = float(col_numeric.max()) if len(col_numeric) > 0 else 1.0
            if not (math.isfinite(max_val) and max_val > 0):
                max_val = 1.0
            indicators.append({"name": field, "max": max_val * 1.2})

        radar_data = []
        if x_field and x_field in df.columns:
            groups = df.groupby(x_field)
            for name, group in list(groups)[:8]:
                values = [safe_mean(group[f]) for f in indicator_fields]
                radar_data.append({"value": values, "name": str(name)})
        else:
            values = [safe_mean(df[f]) for f in indicator_fields]
            radar_data.append({"value": values, "name": "均值"})

        return {
            "radar": {"indicator": indicators},
            "series": [{"name": "对比", "type": "radar", "data": radar_data}],
            "tooltip": make_enhanced_tooltip("item"),
        }
