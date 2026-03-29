from __future__ import annotations
import math
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, make_enhanced_tooltip
from ..registry import register_chart


@register_chart("scatter")
class ScatterChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
        if not y_fields and len(numeric_cols) < 2:
            return empty_chart_config("散点图需要至少2个数值列")
        if len(numeric_cols) == 0:
            return empty_chart_config("散点图需要数值列")

        x_col = x_field if x_field and x_field in df.columns else numeric_cols[0]
        y_col = y_fields[0] if y_fields else (numeric_cols[1] if len(numeric_cols) > 1 else numeric_cols[0])

        remaining_numeric = [c for c in numeric_cols if c not in (x_col, y_col)]
        size_col = None
        color_col = None
        if y_fields and len(y_fields) >= 2 and y_fields[1] in df.columns:
            size_col = y_fields[1]
            if len(y_fields) >= 3 and y_fields[2] in df.columns:
                color_col = y_fields[2]
        elif len(remaining_numeric) >= 1:
            size_col = remaining_numeric[0]
            if len(remaining_numeric) >= 2:
                color_col = remaining_numeric[1]

        is_bubble = size_col is not None

        non_numeric_cols = [c for c in df.columns if c not in numeric_cols]
        label_col = non_numeric_cols[0] if non_numeric_cols else None

        size_min_val, size_max_val = 0, 1
        if is_bubble:
            size_series = pd.to_numeric(df[size_col], errors='coerce').dropna()
            if len(size_series) > 0:
                size_min_val = float(size_series.min())
                size_max_val = float(size_series.max())
                if size_max_val == size_min_val:
                    size_max_val = size_min_val + 1

        all_x: list = []
        all_y: list = []
        series: list = []

        def _make_point(row):
            try:
                xv = float(row[x_col])
                yv = float(row[y_col])
            except (ValueError, TypeError):
                return None
            if not (math.isfinite(xv) and math.isfinite(yv)):
                return None
            all_x.append(xv)
            all_y.append(yv)
            point = [xv, yv]
            if is_bubble:
                try:
                    sv = float(row[size_col])
                    point.append(sv if math.isfinite(sv) else 0)
                except (ValueError, TypeError):
                    point.append(0)
            if color_col:
                try:
                    cv = float(row[color_col])
                    point.append(cv if math.isfinite(cv) else 0)
                except (ValueError, TypeError):
                    point.append(0)
            return point

        if series_field and series_field in df.columns:
            for name, group in df.groupby(series_field):
                data = [pt for pt in ((_make_point(row) for _, row in group.iterrows())) if pt]
                s = {"name": str(name), "type": "scatter", "data": data}
                if is_bubble:
                    s["symbolSize"] = "__FMT__bubble_size"
                    s["_sizeRange"] = [size_min_val, size_max_val]
                else:
                    s["symbolSize"] = 10
                if label_col and len(group) <= 20:
                    s["label"] = {"show": True, "formatter": "__FMT__scatter_label", "fontSize": 10, "color": "#666", "position": "right"}
                series.append(s)
        else:
            data = []
            labels = []
            for _, row in df.iterrows():
                pt = _make_point(row)
                if pt:
                    data.append(pt)
                    if label_col:
                        labels.append(str(row.get(label_col, '')))
            s = {"name": f"{x_col} vs {y_col}", "type": "scatter", "data": data}
            if is_bubble:
                s["symbolSize"] = "__FMT__bubble_size"
                s["_sizeRange"] = [size_min_val, size_max_val]
            else:
                s["symbolSize"] = 10
            if label_col and len(df) <= 20:
                s["label"] = {"show": True, "formatter": "__FMT__scatter_label", "fontSize": 10, "color": "#666", "position": "right"}
                s["_labels"] = labels
            series.append(s)

        # Regression / trend line
        if len(all_x) >= 3:
            try:
                coeffs = np.polyfit(all_x, all_y, 1)
                slope, intercept = coeffs[0], coeffs[1]
                x_min, x_max = min(all_x), max(all_x)
                y_pred = np.array(all_x) * slope + intercept
                ss_res = np.sum((np.array(all_y) - y_pred) ** 2)
                ss_tot = np.sum((np.array(all_y) - np.mean(all_y)) ** 2)
                r_squared = round(1 - ss_res / ss_tot, 4) if ss_tot > 0 else 0
                series.append({
                    "name": f"趋势线 (R\u00b2={r_squared})",
                    "type": "line",
                    "data": [
                        [round(x_min, 2), round(slope * x_min + intercept, 2)],
                        [round(x_max, 2), round(slope * x_max + intercept, 2)],
                    ],
                    "smooth": False, "symbol": "none",
                    "lineStyle": {"type": "dashed", "color": "#ff7875", "width": 2},
                    "tooltip": {"show": False},
                })
            except Exception:
                pass

        # Quadrant lines
        if len(all_x) >= 3:
            mean_x = round(float(np.mean(all_x)), 2)
            mean_y = round(float(np.mean(all_y)), 2)
            for s in series:
                if s.get("type") == "scatter":
                    s["markLine"] = {
                        "silent": True, "symbol": ["none", "none"],
                        "lineStyle": {"type": "dashed", "color": "#c0c4cc", "width": 1},
                        "label": {"fontSize": 10, "color": "#909399"},
                        "data": [
                            {"xAxis": mean_x, "name": f"均值: {mean_x}"},
                            {"yAxis": mean_y, "name": f"均值: {mean_y}"},
                        ],
                    }
                    break

        config = {
            "xAxis": {"type": "value", "name": x_col, "nameLocation": "center", "nameGap": 30},
            "yAxis": {"type": "value", "name": y_col},
            "series": series,
            "tooltip": {**make_enhanced_tooltip("item"), "formatter": "__FMT__scatter_tooltip"},
        }

        if color_col:
            color_series = pd.to_numeric(df[color_col], errors='coerce').dropna()
            c_min = float(color_series.min()) if len(color_series) > 0 else 0
            c_max = float(color_series.max()) if len(color_series) > 0 else 1
            config["visualMap"] = {
                "show": True, "dimension": 3, "min": c_min, "max": c_max,
                "calculable": True, "orient": "vertical", "right": 10, "top": "center",
                "text": [color_col, ""],
                "inRange": {"color": ["#57D9A3", "#FFAB00", "#FF5630"]},
                "textStyle": {"fontSize": 11},
            }
            config["grid"] = {"right": "15%"}

        if is_bubble:
            config["_bubbleMeta"] = {"sizeColumn": size_col, "sizeMin": size_min_val, "sizeMax": size_max_val}

        return config
