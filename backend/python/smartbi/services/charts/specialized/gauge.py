from __future__ import annotations
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, make_enhanced_tooltip
from ..registry import register_chart


@register_chart("gauge")
class GaugeChartStrategy(BaseChartStrategy):
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
            return empty_chart_config("仪表盘需要数值列")
        value_field = y_fields[0] if y_fields else numeric_cols[0]
        raw_val = pd.to_numeric(df[value_field].iloc[0], errors='coerce') if len(df) > 0 else 0
        value = float(raw_val) if pd.notna(raw_val) else 0

        return {
            "series": [{
                "name": value_field, "type": "gauge",
                "progress": {"show": True},
                "detail": {"valueAnimation": True, "formatter": "{value}%"},
                "data": [{"value": value, "name": value_field}],
            }],
            "tooltip": {**make_enhanced_tooltip("item"), "formatter": "{a} <br/>{b}: {c}%"},
        }
