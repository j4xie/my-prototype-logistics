from __future__ import annotations
from typing import List, Optional

import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, get_palette, make_enhanced_tooltip
from ..registry import register_chart


@register_chart("slope")
class SlopeChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        palette = get_palette()["charts"]
        numeric_cols = list(df.select_dtypes(include=['number']).columns)

        if len(numeric_cols) < 2:
            return empty_chart_config("斜率图需要至少两列数值数据")

        cat_col = x_field
        if not cat_col:
            non_num = [c for c in df.columns if c not in numeric_cols]
            cat_col = non_num[0] if non_num else None

        if y_fields and len(y_fields) >= 2:
            left_col = y_fields[0] if y_fields[0] in df.columns else numeric_cols[0]
            right_col = y_fields[1] if y_fields[1] in df.columns else numeric_cols[1]
        else:
            left_col = numeric_cols[0]
            right_col = numeric_cols[1]

        categories = df[cat_col].astype(str).tolist() if cat_col else [f"项目{i + 1}" for i in range(len(df))]
        left_values = pd.to_numeric(df[left_col], errors='coerce').fillna(0).tolist()
        right_values = pd.to_numeric(df[right_col], errors='coerce').fillna(0).tolist()

        series = []
        for i, (cat, lv, rv) in enumerate(zip(categories, left_values, right_values)):
            color = palette[i % len(palette)]
            series.append({
                "type": "line", "name": str(cat),
                "data": [round(lv, 2), round(rv, 2)],
                "lineStyle": {"width": 2, "color": color},
                "itemStyle": {"color": color}, "symbolSize": 8,
                "label": {"show": True, "formatter": f"{cat}", "fontSize": 11},
                "emphasis": {"lineStyle": {"width": 4}, "label": {"fontSize": 13, "fontWeight": "bold"}},
            })

        return {
            "tooltip": {**make_enhanced_tooltip("item"), "formatter": "__FMT__slope_tooltip"},
            "legend": {"show": len(series) <= 15, "type": "scroll", "bottom": 0},
            "grid": {"left": "15%", "right": "15%", "top": "8%", "bottom": "15%"},
            "xAxis": {
                "type": "category", "data": [str(left_col), str(right_col)],
                "axisLabel": {"fontSize": 13, "fontWeight": "bold"},
                "axisTick": {"show": False}, "axisLine": {"show": False},
            },
            "yAxis": {
                "type": "value",
                "axisLabel": {"formatter": "__FMT__thousands_sep"},
                "splitLine": {"lineStyle": {"type": "dashed", "color": "#f0f2f5"}},
            },
            "series": series,
        }
