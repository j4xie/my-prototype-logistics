from __future__ import annotations
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import aggregate_pie_top_n, empty_chart_config, make_enhanced_tooltip
from ..registry import register_chart


@register_chart("pie")
class PieChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        name_field = x_field or df.columns[0]
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not y_fields and len(numeric_cols) == 0:
            return empty_chart_config(None)
        value_field = (
            y_fields[0] if y_fields
            else numeric_cols[0] if numeric_cols
            else None
        )
        if value_field is None:
            return empty_chart_config(None)

        data = []
        for _, row in df.iterrows():
            if pd.notna(row[value_field]):
                v = pd.to_numeric(row[value_field], errors='coerce')
                if pd.notna(v):
                    data.append({"name": str(row[name_field]), "value": round(float(v), 2)})

        data = aggregate_pie_top_n(data, 5)

        return {
            "series": [{
                "name": value_field,
                "type": "pie",
                "radius": ["40%", "70%"],
                "avoidLabelOverlap": True,
                "itemStyle": {"borderRadius": 10, "borderColor": "#fff", "borderWidth": 2},
                "label": {"show": True, "formatter": "{b}\n{d}%", "overflow": "truncate", "width": 80},
                "labelLayout": {"hideOverlap": True},
                "labelLine": {"length": 15, "length2": 10},
                "emphasis": {"label": {"show": True, "fontSize": 16, "fontWeight": "bold"}},
                "data": data,
            }],
            "tooltip": make_enhanced_tooltip("item"),
            "legend": {"orient": "vertical", "left": "left", "data": [d["name"] for d in data]},
        }


@register_chart("donut")
class DonutChartStrategy(BaseChartStrategy):
    """Thin wrapper around pie -- only radius differs."""

    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        config = PieChartStrategy().build(df, x_field, y_fields, series_field, options)
        if config.get("series"):
            config["series"][0]["radius"] = ["50%", "70%"]
        return config


@register_chart("nested_donut")
class NestedDonutChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        numeric_cols_nd = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols_nd) == 0:
            return empty_chart_config("嵌套环形图需要数值列")
        inner_field = x_field or df.columns[0]
        outer_field = series_field or (df.columns[1] if len(df.columns) > 1 else inner_field)
        value_field = y_fields[0] if y_fields else numeric_cols_nd[0]

        inner_data = df.groupby(inner_field)[value_field].sum().reset_index()
        inner_series_data = [
            {"name": str(row[inner_field]), "value": float(row[value_field])}
            for _, row in inner_data.iterrows()
        ]

        outer_data = df.groupby(outer_field)[value_field].sum().reset_index()
        outer_series_data = [
            {"name": str(row[outer_field]), "value": float(row[value_field])}
            for _, row in outer_data.iterrows()
        ]

        return {
            "series": [
                {
                    "name": inner_field,
                    "type": "pie",
                    "radius": ["0%", "35%"],
                    "label": {"position": "inner", "fontSize": 10},
                    "data": inner_series_data,
                },
                {
                    "name": outer_field,
                    "type": "pie",
                    "radius": ["50%", "70%"],
                    "label": {"formatter": "{b}: {d}%", "overflow": "truncate", "width": 80},
                    "labelLayout": {"hideOverlap": True},
                    "labelLine": {"length": 15, "length2": 10},
                    "data": outer_series_data,
                },
            ],
            "tooltip": {"trigger": "item", "formatter": "{a} <br/>{b}: {c} ({d}%)"},
            "legend": {"orient": "vertical", "left": "left"},
        }
