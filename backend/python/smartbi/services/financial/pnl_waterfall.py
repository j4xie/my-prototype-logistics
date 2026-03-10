"""P&L Waterfall Chart Builder — 损益表瀑布图."""
import logging
from typing import Dict, List, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS,
    _sanitize_for_json, _detect_value_scale,
)
from ..financial_data_normalizer import FinancialDataNormalizer

logger = logging.getLogger(__name__)


class PnlWaterfallBuilder(AbstractFinancialChartBuilder):
    """Waterfall chart using stacked bars for P&L breakdown."""

    chart_type = "pnl_waterfall"
    display_name = "损益表瀑布图"
    description = "展示从营业收入到净利润的损益表层级分解，使用瀑布图展现各项增减"
    required_columns = ['item']
    display_order = 3

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        normalizer = FinancialDataNormalizer()

        # Group by item and sum actuals
        if 'actual' in df.columns:
            item_totals = df.groupby('item')['actual'].sum()
        else:
            # Try to find any numeric column
            numeric_cols = df.select_dtypes(include='number').columns
            if len(numeric_cols) > 0:
                item_totals = df.groupby('item')[numeric_cols[0]].sum()
            else:
                item_totals = pd.Series(dtype=float)

        # Classify items and build waterfall entries
        entries = []
        for item_name, value in item_totals.items():
            if value is None or pd.isna(value) or value == 0:
                continue
            pnl_type = normalizer.classify_pnl_item(str(item_name))
            entries.append({
                "name": str(item_name),
                "value": float(value),
                "type": pnl_type,
            })

        # Sort by P&L order: revenue -> cost -> expense -> tax -> profit
        type_order = {'revenue': 0, 'cost': 1, 'expense': 2, 'tax': 3, 'profit': 4, 'other': 5}
        entries.sort(key=lambda e: (type_order.get(e['type'], 5), -abs(e['value'])))

        if not entries:
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": "无可用的损益表数据",
                "metadata": {"period": period, "dataQuality": "insufficient"},
            }

        # Build waterfall data
        # Waterfall uses stacked bars: transparent helper + colored value
        categories = []
        helper_data = []      # Transparent base
        value_data = []       # Visible bar
        colors = []
        running_total = 0
        running_totals = []

        # Revenue items first (positive, build up)
        revenue_total = sum(e['value'] for e in entries if e['type'] == 'revenue')
        cost_total = sum(abs(e['value']) for e in entries if e['type'] == 'cost')
        expense_total = sum(abs(e['value']) for e in entries if e['type'] == 'expense')
        tax_total = sum(abs(e['value']) for e in entries if e['type'] == 'tax')

        # Early return if no revenue data
        if revenue_total == 0:
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": "营业收入为零，无法生成损益表瀑布图",
                "metadata": {"period": period, "dataQuality": "insufficient"},
            }

        # Calculate derived values
        gross_profit = revenue_total - cost_total
        operating_profit = gross_profit - expense_total
        net_profit = operating_profit - tax_total

        # Build waterfall items
        waterfall_items = [
            {"name": "营业收入", "value": revenue_total, "type": "revenue", "is_total": True},
        ]
        # Add individual cost items
        for e in entries:
            if e['type'] == 'cost':
                waterfall_items.append({"name": e['name'], "value": -abs(e['value']), "type": "cost", "is_total": False})

        waterfall_items.append({"name": "毛利润", "value": gross_profit, "type": "profit", "is_total": True})

        for e in entries:
            if e['type'] == 'expense':
                waterfall_items.append({"name": e['name'], "value": -abs(e['value']), "type": "expense", "is_total": False})

        if tax_total > 0:
            waterfall_items.append({"name": "税金及附加", "value": -tax_total, "type": "tax", "is_total": False})

        waterfall_items.append({"name": "净利润", "value": net_profit, "type": "profit", "is_total": True})

        # Compute stacked bar positions
        for i, item in enumerate(waterfall_items):
            categories.append(item['name'])
            val = item['value']

            if item['is_total']:
                # Total bars start from 0
                helper_data.append(0 if val >= 0 else val)
                value_data.append(abs(val))
                running_total = val
            else:
                # Incremental bars stack on running total
                if val < 0:
                    # Deduction: bar goes down from running_total
                    helper_data.append(running_total + val)
                    value_data.append(abs(val))
                    running_total += val
                else:
                    # Addition: bar goes up from running_total
                    helper_data.append(running_total)
                    value_data.append(val)
                    running_total += val

            running_totals.append(running_total)

            # Assign color based on type
            color_map = {
                'revenue': COLORS['revenue'],
                'cost': COLORS['cost'],
                'expense': COLORS['expense'],
                'profit': COLORS['profit'],
                'tax': COLORS['tax'],
            }
            colors.append(color_map.get(item['type'], COLORS['muted']))

        # Scale
        all_values = [abs(v) for v in [revenue_total, cost_total, expense_total, net_profit] if v]
        scale = _detect_value_scale(all_values)
        divisor = scale['divisor']

        # KPIs
        gross_margin = round(gross_profit / revenue_total * 100, 1) if revenue_total else 0
        net_margin = round(net_profit / revenue_total * 100, 1) if revenue_total else 0

        kpis = [
            {"label": "营业收入", "value": self._format_value(revenue_total, scale), "unit": "元", "trend": "flat"},
            {"label": "营业成本", "value": self._format_value(cost_total, scale), "unit": "元", "trend": "flat"},
            {"label": "费用合计", "value": self._format_value(expense_total, scale), "unit": "元", "trend": "flat"},
            {"label": "净利润", "value": self._format_value(net_profit, scale), "unit": "元",
             "trend": self._trend_from_value(net_profit)},
        ]

        # Scale bar data
        helper_scaled = [round(v / divisor, 2) for v in helper_data]
        value_scaled = [round(v / divisor, 2) for v in value_data]

        # ECharts option
        option = self._base_echarts_option()
        option["grid"] = {"left": "5%", "right": "5%", "bottom": "8%", "top": "12%", "containLabel": True}
        option.update({
            "xAxis": {
                "type": "category",
                "data": categories,
                "axisLabel": {"fontSize": 10, "rotate": 20, "interval": 0},
                "axisTick": {"alignWithLabel": True},
            },
            "yAxis": {
                "type": "value",
                "name": f"金额{scale['name_suffix']}",
                "nameTextStyle": {"fontSize": 11},
                "axisLabel": {"fontSize": 10},
                "splitLine": {"lineStyle": {"type": "dashed", "color": "#e8e8e8"}},
            },
            "series": [
                {
                    "name": "辅助",
                    "type": "bar",
                    "stack": "waterfall",
                    "data": helper_scaled,
                    "itemStyle": {"color": "transparent", "borderColor": "transparent"},
                    "emphasis": {"itemStyle": {"color": "transparent"}},
                    "tooltip": {"show": False},
                    "barMaxWidth": 40,
                },
                {
                    "name": "数值",
                    "type": "bar",
                    "stack": "waterfall",
                    "data": [
                        {
                            "value": value_scaled[i],
                            "itemStyle": {
                                "color": colors[i],
                                "borderRadius": [3, 3, 0, 0] if waterfall_items[i]['value'] >= 0 else [0, 0, 3, 3],
                            },
                        }
                        for i in range(len(value_scaled))
                    ],
                    "barMaxWidth": 40,
                    "label": {
                        "show": True,
                        "position": "top",
                        "formatter": "{c}",
                        "fontSize": 10,
                        "color": "#333",
                        "fontWeight": "bold",
                    },
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
                },
            ],
        })

        # Connection markLines between waterfall bars
        mark_lines = []
        for i in range(len(waterfall_items) - 1):
            if not waterfall_items[i]['is_total'] or not waterfall_items[i + 1].get('is_total', False):
                top_val = (helper_scaled[i] + value_scaled[i])
                mark_lines.append({
                    "0": {"xAxis": i, "yAxis": top_val, "symbol": "none"},
                    "1": {"xAxis": i + 1, "yAxis": top_val, "symbol": "none"},
                })

        if mark_lines:
            # Use series-level markLine for connections
            conn_data = []
            for i in range(len(running_totals) - 1):
                rt = round(running_totals[i] / divisor, 2)
                conn_data.append([
                    {"xAxis": categories[i], "yAxis": rt, "symbol": "none"},
                    {"xAxis": categories[i + 1], "yAxis": rt, "symbol": "none"},
                ])
            option["series"][1]["markLine"] = {
                "silent": True,
                "symbol": ["none", "none"],
                "lineStyle": {"type": "dotted", "color": "#999", "width": 1},
                "data": conn_data,
            }

        # Graphic annotations for margins
        graphic_elements = [
            {
                "type": "text",
                "right": "6%",
                "top": "14%",
                "style": {
                    "text": f"毛利率: {gross_margin}%  |  净利率: {net_margin}%",
                    "fontSize": 12,
                    "fill": COLORS['primary'],
                    "fontWeight": "bold",
                },
                "silent": True,
            },
        ]
        option["graphic"] = graphic_elements

        # Table data
        table_data = {
            "headers": ["项目", "金额", "占收入比"],
            "rows": [
                {"label": item['name'], "values": [
                    round(item['value'] / divisor, 2),
                    f"{round(item['value'] / revenue_total * 100, 1)}%" if revenue_total else '-'
                ]}
                for item in waterfall_items
            ],
        }

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": table_data,
            "analysisContext": self.get_analysis_context({"title": f"{year}年{self.display_name}", "kpis": kpis}),
            "metadata": {
                "period": period,
                "scale": scale,
                "grossMargin": gross_margin,
                "netMargin": net_margin,
                "dataQuality": "good",
            },
        }
        return _sanitize_for_json(result)
