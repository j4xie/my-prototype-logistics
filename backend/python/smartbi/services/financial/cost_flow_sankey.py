"""Cost Flow Sankey Chart Builder — 成本流向桑基图."""
import logging
import math
from typing import Dict, List, Any
import pandas as pd
import numpy as np

from .base import (
    AbstractFinancialChartBuilder, COLORS,
    _sanitize_for_json, _detect_value_scale,
)
from ..financial_data_normalizer import FinancialDataNormalizer

logger = logging.getLogger(__name__)


class CostFlowSankeyBuilder(AbstractFinancialChartBuilder):
    """Sankey chart showing P&L cost flow from revenue to net profit."""

    chart_type = "cost_flow_sankey"
    display_name = "成本流向桑基图"
    description = "展示从收入到净利润的成本流转路径"
    required_columns = ['item']
    display_order = 8

    # Node colors by P&L type
    NODE_COLORS = {
        'revenue': '#FF5630',
        'cost': '#36B37E',
        'expense': '#57D9A3',
        'profit': '#1B65A8',
        'tax': '#6B778C',
        'other': '#FFAB00',
    }

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        normalizer = FinancialDataNormalizer()

        # Group by item and sum actuals
        if 'actual' in df.columns:
            item_totals = df.groupby('item')['actual'].sum()
        else:
            numeric_cols = df.select_dtypes(include='number').columns
            if len(numeric_cols) > 0:
                item_totals = df.groupby('item')[numeric_cols[0]].sum()
            else:
                item_totals = pd.Series(dtype=float)

        # Classify items by P&L type
        classified = {}  # type -> {name: value}
        for item_name, value in item_totals.items():
            if value is None or pd.isna(value) or value == 0:
                continue
            pnl_type = normalizer.classify_pnl_item(str(item_name))
            if pnl_type not in classified:
                classified[pnl_type] = {}
            classified[pnl_type][str(item_name)] = abs(float(value))

        # Calculate summary figures
        revenue_total = sum(classified.get('revenue', {}).values())
        cost_total = sum(classified.get('cost', {}).values())
        expense_total = sum(classified.get('expense', {}).values())
        tax_total = sum(classified.get('tax', {}).values())

        if revenue_total == 0:
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": "营业收入为零，无法生成成本流向桑基图",
                "metadata": {"period": period, "dataQuality": "insufficient"},
            }

        gross_profit = revenue_total - cost_total
        operating_profit = gross_profit - expense_total
        net_profit = operating_profit - tax_total

        # --- Build nodes and links ---
        nodes = []
        links = []
        node_set = set()

        def _add_node(name, pnl_type):
            if name not in node_set:
                node_set.add(name)
                nodes.append({
                    "name": name,
                    "itemStyle": {"color": self.NODE_COLORS.get(pnl_type, '#FFAB00')},
                })

        # Level 0: Revenue
        _add_node("营业收入", 'revenue')

        # Level 1: Revenue -> Cost items + Gross Profit
        for item_name, val in sorted(classified.get('cost', {}).items(), key=lambda x: -x[1]):
            _add_node(item_name, 'cost')
            links.append({"source": "营业收入", "target": item_name, "value": round(val, 2)})

        if gross_profit > 0:
            _add_node("毛利润", 'profit')
            links.append({"source": "营业收入", "target": "毛利润", "value": round(gross_profit, 2)})

            # Level 2: Gross Profit -> Expense items + Operating Profit
            for item_name, val in sorted(classified.get('expense', {}).items(), key=lambda x: -x[1]):
                _add_node(item_name, 'expense')
                links.append({"source": "毛利润", "target": item_name, "value": round(val, 2)})

            # Other items
            for item_name, val in sorted(classified.get('other', {}).items(), key=lambda x: -x[1]):
                _add_node(item_name, 'other')
                links.append({"source": "毛利润", "target": item_name, "value": round(val, 2)})

            if operating_profit > 0:
                _add_node("营业利润", 'profit')
                links.append({"source": "毛利润", "target": "营业利润", "value": round(operating_profit, 2)})

                # Level 3: Operating Profit -> Tax + Net Profit
                for item_name, val in sorted(classified.get('tax', {}).items(), key=lambda x: -x[1]):
                    _add_node(item_name, 'tax')
                    links.append({"source": "营业利润", "target": item_name, "value": round(val, 2)})

                if net_profit > 0:
                    _add_node("净利润", 'profit')
                    links.append({"source": "营业利润", "target": "净利润", "value": round(net_profit, 2)})
                elif net_profit < 0:
                    _add_node("净亏损", 'revenue')
                    links.append({"source": "营业利润", "target": "净亏损", "value": round(abs(net_profit), 2)})
                else:
                    # net_profit == 0: add a zero-value node to avoid dangling edge
                    _add_node("净利润", 'profit')
                    links.append({"source": "营业利润", "target": "净利润", "value": 0.01})

        if not links:
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": "数据不足以构建成本流向图",
                "metadata": {"period": period, "dataQuality": "insufficient"},
            }

        # Scale
        scale = _detect_value_scale([revenue_total, cost_total, expense_total, abs(net_profit)])

        # KPIs
        expense_ratio = round((cost_total + expense_total + tax_total) / revenue_total * 100, 1) if revenue_total else 0
        net_margin = round(net_profit / revenue_total * 100, 1) if revenue_total else 0

        kpis = [
            {"label": "营业收入", "value": self._format_value(revenue_total, scale), "unit": "元", "trend": "flat"},
            {"label": "费用占比", "value": f"{expense_ratio}%", "unit": "", "trend": self._trend_from_value(-expense_ratio + 70)},
            {"label": "净利率", "value": f"{net_margin}%", "unit": "", "trend": self._trend_from_value(net_margin)},
        ]

        # ECharts option
        option = self._base_echarts_option()
        option["animationEasing"] = "elasticOut"
        option["animationDuration"] = 1000
        option.update({
            "series": [{
                "type": "sankey",
                "layout": "none",
                "orient": "horizontal",
                "nodeWidth": 22,
                "nodeGap": 14,
                "draggable": True,
                "emphasis": {
                    "focus": "adjacency",
                    "blurScope": "global",
                },
                "lineStyle": {
                    "color": "gradient",
                    "curveness": 0.5,
                    "opacity": 0.45,
                },
                "label": {
                    "show": True,
                    "fontSize": 11,
                    "color": "#333",
                    "fontWeight": "bold",
                    "formatter": "__FMT__sankey_financial_label",
                },
                "data": nodes,
                "links": links,
                "levels": [
                    {
                        "depth": 0,
                        "itemStyle": {"borderWidth": 2, "borderColor": "#fff"},
                        "lineStyle": {"opacity": 0.5},
                    },
                    {
                        "depth": 1,
                        "itemStyle": {"borderWidth": 1, "borderColor": "#fff"},
                        "lineStyle": {"opacity": 0.4},
                    },
                    {
                        "depth": 2,
                        "itemStyle": {"borderWidth": 1, "borderColor": "#fff"},
                        "lineStyle": {"opacity": 0.35},
                    },
                    {
                        "depth": 3,
                        "itemStyle": {"borderWidth": 1, "borderColor": "#fff"},
                        "lineStyle": {"opacity": 0.3},
                    },
                ],
            }],
            "tooltip": {
                "trigger": "item",
                "confine": True,
                "backgroundColor": "rgba(255,255,255,0.96)",
                "borderColor": "#e5e7eb",
                "borderWidth": 1,
                "borderRadius": 8,
                "padding": [12, 16],
                "textStyle": {"color": "#374151", "fontSize": 13},
                "extraCssText": "box-shadow: 0 4px 20px rgba(0,0,0,0.12);",
                "formatter": "__FMT__sankey_financial_tooltip",
            },
        })

        # Margin annotation
        option["graphic"] = [{
            "type": "text",
            "right": "5%",
            "top": "3%",
            "style": {
                "text": f"毛利率: {round(gross_profit / revenue_total * 100, 1)}%  |  净利率: {net_margin}%",
                "fontSize": 12,
                "fill": COLORS['primary'],
                "fontWeight": "bold",
            },
            "silent": True,
        }]

        # Analysis context
        analysis_parts = [
            f"{year}年成本流向分析:",
            f"营业收入{self._format_value(revenue_total, scale)}元",
            f"营业成本占收入{round(cost_total / revenue_total * 100, 1)}%",
            f"费用合计占收入{round(expense_total / revenue_total * 100, 1)}%",
            f"净利率{net_margin}%",
        ]

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": {
                "headers": ["流向", "金额", "占收入比"],
                "rows": [{"label": lk["source"] + " → " + lk["target"], "values": [
                    round(lk["value"] / scale["divisor"], 2),
                    f"{round(lk['value'] / revenue_total * 100, 1)}%"
                ]} for lk in links],
            },
            "analysisContext": " ".join(analysis_parts),
            "metadata": {
                "period": period,
                "scale": scale,
                "grossMargin": round(gross_profit / revenue_total * 100, 1),
                "netMargin": net_margin,
                "expenseRatio": expense_ratio,
                "dataQuality": "good",
            },
        }
        return _sanitize_for_json(result)
