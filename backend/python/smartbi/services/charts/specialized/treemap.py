from __future__ import annotations
import math
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, get_palette, make_enhanced_tooltip
from ..registry import register_chart


@register_chart("treemap")
class TreemapChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        palette = get_palette()["charts"]
        numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
        if len(numeric_cols) == 0:
            return empty_chart_config("矩阵树图需要数值列")

        name_col = x_field
        if not name_col:
            non_num = [c for c in df.columns if c not in numeric_cols]
            name_col = non_num[0] if non_num else None

        value_col = y_fields[0] if y_fields and y_fields[0] in df.columns else numeric_cols[0]

        parent_col = None
        for c in df.columns:
            cl = c.lower().strip()
            if cl in ('parent', '父级', '上级', '大类', 'category', '分类', 'group', '组'):
                if c != name_col and c != value_col:
                    parent_col = c
                    break

        color_col = None
        if y_fields and len(y_fields) >= 2 and y_fields[1] in df.columns:
            color_col = y_fields[1]
        elif len(numeric_cols) >= 2:
            remaining = [c for c in numeric_cols if c != value_col]
            color_col = remaining[0] if remaining else None

        total_value = 0

        if parent_col and name_col:
            parent_map: dict = {}
            for _, row in df.iterrows():
                parent_name = str(row.get(parent_col, '其他')).strip() or '其他'
                child_name = str(row.get(name_col, '')).strip()
                try:
                    val = abs(float(pd.to_numeric(row.get(value_col), errors='coerce')))
                except (ValueError, TypeError):
                    val = 0
                if not child_name or val == 0 or not math.isfinite(val):
                    continue
                if parent_name not in parent_map:
                    parent_map[parent_name] = {"children": [], "value": 0}
                child_entry: dict = {"name": child_name, "value": round(val, 2)}
                if color_col:
                    try:
                        cv = float(pd.to_numeric(row.get(color_col), errors='coerce'))
                        if math.isfinite(cv):
                            child_entry["colorValue"] = round(cv, 2)
                    except (ValueError, TypeError):
                        pass
                parent_map[parent_name]["children"].append(child_entry)
                parent_map[parent_name]["value"] += val
                total_value += val

            tree_data = []
            for i, (pname, pdata) in enumerate(sorted(parent_map.items(), key=lambda x: -x["value"])):
                tree_data.append({
                    "name": pname, "value": round(pdata["value"], 2),
                    "children": sorted(pdata["children"], key=lambda c: -c["value"]),
                    "itemStyle": {"borderColor": palette[i % len(palette)], "borderWidth": 2},
                })
        else:
            if name_col:
                grouped = df.groupby(name_col)[value_col].sum()
            else:
                grouped = df[value_col]

            tree_data = []
            for i, (name, val) in enumerate(
                sorted(((str(k), abs(float(v))) for k, v in grouped.items() if pd.notna(v) and float(v) != 0), key=lambda x: -x[1])
            ):
                if not math.isfinite(val):
                    continue
                entry: dict = {"name": name, "value": round(val, 2)}
                total_value += val
                if color_col and name_col:
                    mask = df[name_col].astype(str) == name
                    cv_series = pd.to_numeric(df.loc[mask, color_col], errors='coerce').dropna()
                    if len(cv_series) > 0:
                        cv = float(cv_series.mean())
                        if math.isfinite(cv):
                            entry["colorValue"] = round(cv, 2)
                tree_data.append(entry)

        if not tree_data:
            return empty_chart_config("矩阵树图无有效数据")

        series_config = {
            "type": "treemap", "data": tree_data, "roam": True,
            "width": "92%", "height": "85%", "top": "5%", "left": "center",
            "breadcrumb": {
                "show": True, "bottom": 5, "left": "center",
                "itemStyle": {"color": "#f5f5f5", "borderColor": "#ddd", "borderWidth": 1, "shadowBlur": 2, "shadowColor": "rgba(0,0,0,0.05)", "textStyle": {"color": "#333", "fontSize": 12}},
                "emphasis": {"itemStyle": {"color": "#e0e0e0"}},
            },
            "label": {"show": True, "formatter": "__FMT__treemap_label", "fontSize": 12, "color": "#fff", "fontWeight": "bold", "textShadowBlur": 2, "textShadowColor": "rgba(0,0,0,0.3)"},
            "upperLabel": {"show": True, "height": 24, "color": "#fff", "fontSize": 12, "fontWeight": "bold", "backgroundColor": "transparent"},
            "itemStyle": {"borderColor": "#fff", "borderWidth": 2, "gapWidth": 2},
            "levels": [
                {"itemStyle": {"borderColor": "#999", "borderWidth": 3, "gapWidth": 3}, "upperLabel": {"show": True}},
                {"itemStyle": {"borderColor": "#ccc", "borderWidth": 2, "gapWidth": 2}, "label": {"show": True}, "upperLabel": {"show": False}},
                {"itemStyle": {"borderColor": "#ddd", "borderWidth": 1, "gapWidth": 1}, "label": {"show": True, "fontSize": 10}},
            ],
            "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
        }

        config = {
            "series": [series_config],
            "tooltip": {**make_enhanced_tooltip("item"), "formatter": "__FMT__treemap_tooltip"},
            "_treemapMeta": {"totalValue": round(total_value, 2), "nodeCount": len(tree_data), "hasHierarchy": parent_col is not None},
        }

        if color_col:
            all_cv: list = []

            def _collect_cv(nodes):
                for n in nodes:
                    if "colorValue" in n:
                        all_cv.append(n["colorValue"])
                    if "children" in n:
                        _collect_cv(n["children"])
            _collect_cv(tree_data)

            if all_cv:
                config["visualMap"] = {
                    "show": True, "type": "continuous", "min": min(all_cv), "max": max(all_cv),
                    "calculable": True, "orient": "horizontal", "left": "center", "bottom": 30,
                    "text": [f"高 ({color_col})", "低"],
                    "inRange": {"color": ["#57D9A3", "#FFAB00", "#FF5630"]},
                    "textStyle": {"fontSize": 11}, "dimension": "colorValue", "seriesIndex": 0,
                }

        return config
