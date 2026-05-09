from __future__ import annotations
import math
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, get_palette
from ..registry import register_chart


@register_chart("wordcloud")
class WordcloudChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
        non_num_cols = [c for c in df.columns if c not in numeric_cols]

        if len(numeric_cols) == 0 or len(non_num_cols) == 0:
            return empty_chart_config("词云图需要文本列和数值列")

        text_col = x_field or non_num_cols[0]
        value_col = y_fields[0] if y_fields and y_fields[0] in numeric_cols else numeric_cols[0]

        grouped = df.groupby(text_col, dropna=True)[value_col].sum().reset_index()
        grouped = grouped.sort_values(value_col, ascending=False).head(100)

        palette = get_palette()["charts"]
        word_data = []
        for i, (_, row) in enumerate(grouped.iterrows()):
            word = str(row[text_col]).strip()
            val = float(row[value_col])
            if word and not (math.isnan(val) or math.isinf(val)) and val > 0:
                word_data.append({"name": word, "value": round(val, 2), "textStyle": {"color": palette[i % len(palette)]}})  # noqa: E501

        if not word_data:
            return empty_chart_config("词云图无有效数据")

        return {
            "tooltip": {"show": True, "trigger": "item", "formatter": "{b}: {c}"},
            "series": [{
                "type": "wordCloud", "shape": "circle", "gridSize": 8,
                "sizeRange": [14, 60], "rotationRange": [-45, 45], "rotationStep": 15,
                "left": "center", "top": "center", "width": "90%", "height": "85%",
                "textStyle": {"fontFamily": "sans-serif", "fontWeight": "bold"},
                "emphasis": {"textStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.3)"}},
                "data": word_data,
            }],
        }
