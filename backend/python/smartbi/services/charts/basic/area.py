from __future__ import annotations
from typing import List, Optional

import pandas as pd

from ..base import BaseChartStrategy
from ..registry import register_chart
from .line import LineChartStrategy


@register_chart("area")
class AreaChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        config = LineChartStrategy().build(df, x_field, y_fields, series_field, options)

        is_stacked = len(config["series"]) > 1
        for i, s in enumerate(config["series"]):
            s["areaStyle"] = {"opacity": 0.3}
            s["stack"] = "total" if is_stacked else None

        if is_stacked:
            title = config.get("title", {})
            if isinstance(title, dict):
                existing = title.get("subtext", "")
                title["subtext"] = (
                    "堆叠面积图（数值为累计叠加）" + (f" | {existing}" if existing else "")
                )
                config["title"] = title

        return config
