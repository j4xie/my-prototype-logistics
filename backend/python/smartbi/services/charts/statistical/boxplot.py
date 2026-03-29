from __future__ import annotations
from typing import List, Optional

import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, get_palette, make_enhanced_tooltip
from ..registry import register_chart


@register_chart("boxplot")
class BoxplotChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        palette = get_palette()["charts"]

        if not y_fields:
            y_fields = df.select_dtypes(include=['number']).columns.tolist()[:6]
        if not y_fields:
            return empty_chart_config(None)

        box_data: list = []
        outlier_data: list = []
        for i, col in enumerate(y_fields):
            if col not in df.columns:
                continue
            vals = pd.to_numeric(df[col], errors='coerce').dropna()
            if len(vals) < 5:
                continue
            q1 = float(vals.quantile(0.25))
            q2 = float(vals.quantile(0.5))
            q3 = float(vals.quantile(0.75))
            iqr = q3 - q1
            lower = float(max(vals.min(), q1 - 1.5 * iqr))
            upper = float(min(vals.max(), q3 + 1.5 * iqr))
            box_data.append([round(lower, 2), round(q1, 2), round(q2, 2), round(q3, 2), round(upper, 2)])

            outliers = vals[(vals < q1 - 1.5 * iqr) | (vals > q3 + 1.5 * iqr)]
            for v in outliers.tolist()[:10]:
                outlier_data.append([i, round(float(v), 2)])

        if not box_data:
            return empty_chart_config(None)

        config = {
            "xAxis": {"type": "category", "data": y_fields[:len(box_data)], "axisLabel": {"fontSize": 11}},
            "yAxis": {"type": "value", "name": "数值"},
            "tooltip": make_enhanced_tooltip("item"),
            "grid": {"left": "10%", "right": "10%", "bottom": "15%", "top": "10%"},
            "series": [
                {
                    "name": "分布", "type": "boxplot", "data": box_data,
                    "itemStyle": {"color": palette[0], "borderColor": palette[1]},
                    "tooltip": {"formatter": "__FMT__boxplot_tooltip"},
                }
            ],
        }

        if outlier_data:
            config["series"].append({
                "name": "异常值", "type": "scatter", "data": outlier_data,
                "itemStyle": {"color": palette[4] if len(palette) > 4 else "#FF5630"},
                "symbolSize": 6,
            })

        return config
