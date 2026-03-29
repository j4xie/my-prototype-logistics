from __future__ import annotations
import math
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, get_palette, make_enhanced_tooltip
from ..registry import register_chart


@register_chart("heatmap")
class HeatmapChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        if len(df.columns) < 2:
            return empty_chart_config("热力图至少需要2列")
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if not y_fields and len(numeric_cols) == 0:
            return empty_chart_config("热力图需要数值列")

        x_col = x_field or df.columns[0]
        y_col = series_field or (df.columns[1] if len(df.columns) > 1 else df.columns[0])
        value_col = y_fields[0] if y_fields else numeric_cols[0]

        x_data = df[x_col].unique().tolist()
        y_data = df[y_col].unique().tolist()

        data = []
        for _, row in df.iterrows():
            raw_val = pd.to_numeric(row.get(value_col), errors='coerce')
            if pd.isna(raw_val):
                continue
            try:
                x_idx = x_data.index(row[x_col])
                y_idx = y_data.index(row[y_col])
                data.append([x_idx, y_idx, float(raw_val)])
            except (ValueError, KeyError):
                continue

        numeric_series = pd.to_numeric(df[value_col], errors='coerce')
        max_val = numeric_series.max() if not numeric_series.isna().all() else 1
        min_val = numeric_series.min() if not numeric_series.isna().all() else 0

        return {
            "xAxis": {"type": "category", "data": x_data},
            "yAxis": {"type": "category", "data": y_data},
            "visualMap": {"min": float(min_val), "max": float(max_val), "calculable": True, "orient": "horizontal", "left": "center", "bottom": "0%"},
            "series": [{"name": value_col, "type": "heatmap", "data": data, "label": {"show": True}}],
            "tooltip": {"position": "top"},
        }


@register_chart("correlation_matrix")
class CorrelationMatrixChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        if not y_fields:
            y_fields = df.select_dtypes(include=['number']).columns.tolist()[:10]
        if len(y_fields) < 3:
            from ..basic.bar import BarChartStrategy
            return BarChartStrategy().build(df, x_field, y_fields, series_field, options)

        numeric_df = df[y_fields].apply(pd.to_numeric, errors='coerce')
        corr_matrix = numeric_df.corr()

        heatmap_data = []
        labels = y_fields[:len(corr_matrix)]
        for i, col_i in enumerate(labels):
            for j, col_j in enumerate(labels):
                val = corr_matrix.loc[col_i, col_j] if col_i in corr_matrix.index and col_j in corr_matrix.columns else 0
                if pd.isna(val):
                    val = 0
                heatmap_data.append([i, j, round(float(val), 2)])

        return {
            "xAxis": {"type": "category", "data": labels, "axisLabel": {"rotate": 45, "fontSize": 10}},
            "yAxis": {"type": "category", "data": labels, "axisLabel": {"fontSize": 10}},
            "tooltip": {"trigger": "item", "formatter": "__FMT__correlation_tooltip"},
            "grid": {"left": "15%", "right": "10%", "bottom": "20%", "top": "5%"},
            "visualMap": {
                "min": -1, "max": 1, "calculable": True, "orient": "horizontal", "left": "center", "bottom": "0%",
                "inRange": {"color": ["#FF5630", "#FF8B6A", "#ffffff", "#4C9AFF", "#2D8B57"]},
                "text": ["正相关", "负相关"], "textStyle": {"fontSize": 11},
            },
            "series": [{
                "type": "heatmap", "data": heatmap_data,
                "label": {"show": True, "fontSize": 10, "formatter": "__FMT__correlation_label"},
                "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.3)"}},
            }],
        }


@register_chart("matrix_heatmap")
class MatrixHeatmapChartStrategy(BaseChartStrategy):
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

        if len(numeric_cols) == 0:
            return empty_chart_config("矩阵热力图需要数值列")

        row_col = x_field
        col_col = series_field
        if not row_col and len(non_num_cols) >= 1:
            row_col = non_num_cols[0]
        if not col_col and len(non_num_cols) >= 2:
            col_col = non_num_cols[1]
        elif not col_col and y_fields and len(y_fields) >= 2:
            col_col = y_fields[1] if y_fields[1] in non_num_cols else None

        value_col = y_fields[0] if y_fields and y_fields[0] in numeric_cols else numeric_cols[0]

        if not row_col or not col_col:
            return HeatmapChartStrategy().build(df, x_field, y_fields, series_field, options)

        try:
            pivot = df.pivot_table(index=row_col, columns=col_col, values=value_col, aggfunc='sum', fill_value=0)
        except Exception:
            pivot = df.pivot_table(index=row_col, columns=col_col, values=value_col, aggfunc='mean', fill_value=0)

        row_labels = [str(r) for r in pivot.index.tolist()]
        col_labels = [str(c) for c in pivot.columns.tolist()]

        heatmap_data = []
        all_values: list = []
        for ri, _ in enumerate(row_labels):
            for ci, _ in enumerate(col_labels):
                val = float(pivot.iloc[ri, ci])
                if not (math.isnan(val) or math.isinf(val)):
                    heatmap_data.append([ci, ri, round(val, 2)])
                    all_values.append(val)
                else:
                    heatmap_data.append([ci, ri, None])

        min_val = min(all_values) if all_values else 0
        max_val = max(all_values) if all_values else 1

        return {
            "tooltip": {**make_enhanced_tooltip("item"), "formatter": "__FMT__matrix_heatmap_tooltip"},
            "grid": {"left": "15%", "right": "12%", "top": "8%", "bottom": "20%"},
            "xAxis": {"type": "category", "data": col_labels, "splitArea": {"show": True}, "axisLabel": {"rotate": 30, "fontSize": 11, "hideOverlap": True}},
            "yAxis": {"type": "category", "data": row_labels, "splitArea": {"show": True}, "axisLabel": {"fontSize": 11}},
            "visualMap": {
                "min": round(min_val, 2), "max": round(max_val, 2), "calculable": True,
                "orient": "horizontal", "left": "center", "bottom": 0,
                "inRange": {"color": ["#f0f9ff", "#bae6fd", "#38bdf8", "#0284c7", "#2D8B57"]},
                "textStyle": {"fontSize": 11},
            },
            "series": [{
                "type": "heatmap", "data": heatmap_data,
                "label": {"show": len(row_labels) * len(col_labels) <= 100, "fontSize": 10},
                "emphasis": {"itemStyle": {"borderColor": "#333", "borderWidth": 2}},
            }],
        }
