from __future__ import annotations
import math
from typing import List, Optional

import numpy as np
import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, get_palette, make_enhanced_tooltip
from ..registry import register_chart


@register_chart("sankey")
class SankeyChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        palette = get_palette()["charts"]

        source_col, target_col, value_col = None, None, None
        col_lower_map = {c.lower().strip(): c for c in df.columns}

        for alias, target_name in [
            (('source', '来源', 'from', '源'), 'source'),
            (('target', '目标', 'to', '去向', '流向'), 'target'),
            (('value', '金额', '数值', 'amount', 'weight'), 'value'),
        ]:
            for a in alias:
                if a in col_lower_map:
                    if target_name == 'source':
                        source_col = col_lower_map[a]
                    elif target_name == 'target':
                        target_col = col_lower_map[a]
                    elif target_name == 'value':
                        value_col = col_lower_map[a]
                    break

        if not source_col or not target_col:
            non_num = [c for c in df.columns if c not in df.select_dtypes(include=[np.number]).columns]
            num_cols = list(df.select_dtypes(include=[np.number]).columns)
            if len(non_num) >= 2 and len(num_cols) >= 1:
                source_col = source_col or non_num[0]
                target_col = target_col or non_num[1]
                value_col = value_col or num_cols[0]

        if not source_col or not target_col or not value_col:
            return self._build_pnl_auto(df, x_field, y_fields, palette)

        node_set: set = set()
        links: list = []
        for _, row in df.iterrows():
            src = str(row.get(source_col, '')).strip()
            tgt = str(row.get(target_col, '')).strip()
            try:
                val = abs(float(pd.to_numeric(row.get(value_col), errors='coerce')))
            except (ValueError, TypeError):
                continue
            if not src or not tgt or val == 0 or not math.isfinite(val):
                continue
            node_set.add(src)
            node_set.add(tgt)
            links.append({"source": src, "target": tgt, "value": round(val, 2)})

        if not links:
            return empty_chart_config("桑基图无有效流向数据")

        nodes = [{"name": name, "itemStyle": {"color": palette[i % len(palette)]}} for i, name in enumerate(sorted(node_set))]
        total_value = sum(lk["value"] for lk in links)
        orient = "horizontal" if len(nodes) <= 10 else "vertical"

        return {
            "series": [{
                "type": "sankey", "layout": "none", "orient": orient,
                "nodeWidth": 20, "nodeGap": 12, "draggable": True,
                "emphasis": {"focus": "adjacency", "blurScope": "global"},
                "lineStyle": {"color": "gradient", "curveness": 0.5, "opacity": 0.4},
                "label": {"show": True, "fontSize": 11, "color": "#333", "formatter": "__FMT__sankey_node_label"},
                "data": nodes, "links": links,
                "tooltip": {"trigger": "item", "formatter": "__FMT__sankey_tooltip"},
                "levels": [
                    {"depth": 0, "itemStyle": {"borderWidth": 1, "borderColor": "#aaa"}, "lineStyle": {"opacity": 0.5}},
                    {"depth": 1, "itemStyle": {"borderWidth": 1, "borderColor": "#aaa"}, "lineStyle": {"opacity": 0.4}},
                    {"depth": 2, "itemStyle": {"borderWidth": 1, "borderColor": "#aaa"}, "lineStyle": {"opacity": 0.3}},
                ],
            }],
            "tooltip": {**make_enhanced_tooltip("item"), "formatter": "__FMT__sankey_tooltip"},
            "_sankeyMeta": {"totalValue": round(total_value, 2), "nodeCount": len(nodes), "linkCount": len(links)},
        }

    # ---- P&L auto-sankey ----

    def _build_pnl_auto(self, df, x_field, y_fields, palette):
        item_col = x_field
        if not item_col:
            for c in df.columns:
                if c.lower() in ('item', '项目', '科目', 'name', '名称'):
                    item_col = c
                    break
        if not item_col:
            non_num = [c for c in df.columns if c not in df.select_dtypes(include=[np.number]).columns]
            item_col = non_num[0] if non_num else None

        numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
        val_col = y_fields[0] if y_fields and y_fields[0] in df.columns else (numeric_cols[0] if numeric_cols else None)

        if not item_col or not val_col:
            return empty_chart_config("桑基图需要分类列和数值列")

        grouped = df.groupby(item_col)[val_col].sum()

        revenue_items, cost_items, expense_items, tax_items = {}, {}, {}, {}
        revenue_kw = ['收入', '营收', 'revenue', 'income', 'sales']
        cost_kw = ['成本', 'cost', 'cogs']
        expense_kw = ['费用', '管理', '销售', '研发', '财务', 'expense', 'admin', 'selling']
        tax_kw = ['税', 'tax']

        for item_name, val in grouped.items():
            name_lower = str(item_name).lower()
            abs_val = abs(float(val))
            if abs_val == 0:
                continue
            if any(kw in name_lower for kw in revenue_kw):
                revenue_items[str(item_name)] = abs_val
            elif any(kw in name_lower for kw in cost_kw):
                cost_items[str(item_name)] = abs_val
            elif any(kw in name_lower for kw in expense_kw):
                expense_items[str(item_name)] = abs_val
            elif any(kw in name_lower for kw in tax_kw):
                tax_items[str(item_name)] = abs_val
            else:
                expense_items[str(item_name)] = abs_val

        total_revenue = sum(revenue_items.values()) or 1
        total_cost = sum(cost_items.values())
        total_expense = sum(expense_items.values())
        total_tax = sum(tax_items.values())
        gross_profit = total_revenue - total_cost
        net_profit = gross_profit - total_expense - total_tax

        node_colors = {"营业收入": "#FF5630", "毛利润": "#2D8B57", "净利润": "#2D8B57"}
        node_names = ["营业收入"]
        links: list = []

        for name, val in cost_items.items():
            node_names.append(name)
            node_colors[name] = "#36B37E"
            links.append({"source": "营业收入", "target": name, "value": round(val, 2)})

        if gross_profit > 0:
            node_names.append("毛利润")
            links.append({"source": "营业收入", "target": "毛利润", "value": round(gross_profit, 2)})
            for name, val in expense_items.items():
                node_names.append(name)
                node_colors[name] = "#57D9A3"
                links.append({"source": "毛利润", "target": name, "value": round(val, 2)})
            for name, val in tax_items.items():
                node_names.append(name)
                node_colors[name] = "#6B778C"
                links.append({"source": "毛利润", "target": name, "value": round(val, 2)})
            if net_profit > 0:
                node_names.append("净利润")
                links.append({"source": "毛利润", "target": "净利润", "value": round(net_profit, 2)})

        if not links:
            return empty_chart_config("无法构建损益流向，请确保数据包含收入和成本项")

        nodes = []
        seen: set = set()
        for name in node_names:
            if name not in seen:
                seen.add(name)
                nodes.append({"name": name, "itemStyle": {"color": node_colors.get(name, palette[len(seen) % len(palette)])}})

        return {
            "series": [{
                "type": "sankey", "layout": "none", "orient": "horizontal",
                "nodeWidth": 20, "nodeGap": 14, "draggable": True,
                "emphasis": {"focus": "adjacency"},
                "lineStyle": {"color": "gradient", "curveness": 0.5, "opacity": 0.4},
                "label": {"show": True, "fontSize": 11, "formatter": "__FMT__sankey_node_label"},
                "data": nodes, "links": links,
                "levels": [
                    {"depth": 0, "itemStyle": {"borderWidth": 1, "borderColor": "#aaa"}},
                    {"depth": 1, "lineStyle": {"opacity": 0.4}},
                    {"depth": 2, "lineStyle": {"opacity": 0.3}},
                ],
            }],
            "tooltip": {**make_enhanced_tooltip("item"), "formatter": "__FMT__sankey_tooltip"},
        }
