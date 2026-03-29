from __future__ import annotations
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config
from ..registry import register_chart


@register_chart("sunburst")
class SunburstChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        hierarchy_cols = options.get("hierarchy", []) if options else []
        if not hierarchy_cols:
            hierarchy_cols = df.columns[:2].tolist()

        numeric_cols_sb = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols_sb) == 0:
            return empty_chart_config("旭日图需要数值列")
        value_field = y_fields[0] if y_fields else numeric_cols_sb[0]

        MAX_DEPTH = 10

        def build_tree(df_inner, level_cols, value_col, depth=0):
            if not level_cols or depth >= MAX_DEPTH:
                return []
            current_col = level_cols[0]
            remaining_cols = level_cols[1:]
            children = []
            for name, group in df_inner.groupby(current_col):
                node = {"name": str(name), "value": float(group[value_col].sum())}
                if remaining_cols:
                    node["children"] = build_tree(group, remaining_cols, value_col, depth + 1)
                children.append(node)
            return children

        data = build_tree(df, hierarchy_cols, value_field)

        return {
            "series": [{"type": "sunburst", "data": data, "radius": ["15%", "80%"], "label": {"rotate": "radial"}, "emphasis": {"focus": "ancestor"}}],
            "tooltip": {"trigger": "item", "formatter": "{b}: {c}"},
        }
