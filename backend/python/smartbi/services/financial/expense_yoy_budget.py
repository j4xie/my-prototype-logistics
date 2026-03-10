"""Expense YoY & Budget Achievement Chart Builder — 费用同比及预算达成."""
import logging
from typing import Dict, List, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS, MONTH_LABELS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)


class ExpenseYoyBudgetBuilder(AbstractFinancialChartBuilder):
    """Dual axis: bars (last year vs current) + achievement rate line."""

    chart_type = "expense_yoy_budget"
    display_name = "费用同比及预算达成"
    description = "展示费用的同比变化趋势及预算达成率，双轴对比分析"
    required_columns = ['budget', 'actual', 'last_year', 'period']
    display_order = 4

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        start_month = period.get('start_month', 1)
        end_month = period.get('end_month', 12)
        labels = self._month_labels(start_month, end_month)

        # Aggregate by month
        monthly = df.groupby('month').agg(
            budget=('budget', 'sum'),
            actual=('actual', 'sum'),
            last_year=('last_year', 'sum'),
        ).reindex(range(start_month, end_month + 1)).fillna(0)

        budget_vals = monthly['budget'].tolist()
        actual_vals = monthly['actual'].tolist()
        last_year_vals = monthly['last_year'].tolist()

        # Achievement rate per month
        achievement_rates = []
        for b, a in zip(budget_vals, actual_vals):
            rate = self._calc_achievement_rate(a, b)
            achievement_rates.append(rate if rate is not None else 0)

        # YoY change per month
        yoy_changes = []
        for a, ly in zip(actual_vals, last_year_vals):
            change = (a or 0) - (ly or 0)
            yoy_changes.append(change)

        yoy_rates = []
        for a, ly in zip(actual_vals, last_year_vals):
            rate = self._calc_growth_rate(a, ly)
            yoy_rates.append(rate if rate is not None else 0)

        # KPIs
        total_actual = sum(v or 0 for v in actual_vals)
        total_last_year = sum(v or 0 for v in last_year_vals)
        total_budget = sum(v or 0 for v in budget_vals)
        total_yoy_change = total_actual - total_last_year
        total_yoy_rate = self._calc_growth_rate(total_actual, total_last_year)
        total_achievement = self._calc_achievement_rate(total_actual, total_budget)
        scale = _detect_value_scale(actual_vals + last_year_vals + budget_vals)

        kpis = [
            {"label": "本年费用合计", "value": self._format_value(total_actual, scale), "unit": "元",
             "trend": self._trend_from_value(total_yoy_change)},
            {"label": "上年费用合计", "value": self._format_value(total_last_year, scale), "unit": "元", "trend": "flat"},
            {"label": "同比变化", "value": f"{total_yoy_rate:.1f}" if total_yoy_rate is not None else '-',
             "unit": "%", "trend": self._trend_from_value(total_yoy_rate)},
            {"label": "预算达成率", "value": f"{total_achievement:.1f}" if total_achievement is not None else '-',
             "unit": "%", "trend": 'up' if total_achievement and total_achievement <= 100 else 'down'},
        ]

        # Scale values
        divisor = scale['divisor']
        actual_scaled = [round(v / divisor, 2) if v else 0 for v in actual_vals]
        ly_scaled = [round(v / divisor, 2) if v else 0 for v in last_year_vals]
        budget_scaled = [round(v / divisor, 2) if v else 0 for v in budget_vals]

        # ECharts option
        option = self._base_echarts_option()
        option.update({
            "legend": {
                "data": [
                    f"上年费用{scale['name_suffix']}",
                    f"本年费用{scale['name_suffix']}",
                    f"预算{scale['name_suffix']}",
                    "预算达成率",
                ],
                "top": "2%",
                "textStyle": {"fontSize": 11},
            },
            "xAxis": {
                "type": "category",
                "data": labels,
                "axisLabel": {"fontSize": 11},
            },
            "yAxis": [
                {
                    "type": "value",
                    "name": f"费用{scale['name_suffix']}",
                    "nameTextStyle": {"fontSize": 11},
                    "axisLabel": {"fontSize": 10},
                    "splitLine": {"lineStyle": {"type": "dashed", "color": "#e8e8e8"}},
                },
                {
                    "type": "value",
                    "name": "达成率 (%)",
                    "nameTextStyle": {"fontSize": 11},
                    "axisLabel": {"formatter": "{value}%", "fontSize": 10},
                    "min": 0,
                    "max": 150,
                    "splitLine": {"show": False},
                },
            ],
            "series": [
                {
                    "name": f"上年费用{scale['name_suffix']}",
                    "type": "bar",
                    "data": ly_scaled,
                    "itemStyle": {"color": COLORS['last_year'], "borderRadius": [2, 2, 0, 0]},
                    "barGap": "5%",
                    "barMaxWidth": 24,
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
                },
                {
                    "name": f"本年费用{scale['name_suffix']}",
                    "type": "bar",
                    "data": [
                        {
                            "value": v,
                            "itemStyle": {
                                "color": COLORS['accent'] if v > ly_scaled[i] else COLORS['success'],
                                "borderRadius": [2, 2, 0, 0],
                            },
                        }
                        for i, v in enumerate(actual_scaled)
                    ],
                    "barMaxWidth": 24,
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
                },
                {
                    "name": f"预算{scale['name_suffix']}",
                    "type": "line",
                    "data": budget_scaled,
                    "itemStyle": {"color": COLORS['budget']},
                    "lineStyle": {"width": 1.5, "type": "dashed"},
                    "symbol": "rect",
                    "symbolSize": 5,
                    "label": {"show": False},
                },
                {
                    "name": "预算达成率",
                    "type": "line",
                    "yAxisIndex": 1,
                    "data": [round(r, 1) for r in achievement_rates],
                    "itemStyle": {"color": COLORS['achievement']},
                    "lineStyle": {"width": 2.5},
                    "symbol": "circle",
                    "symbolSize": 7,
                    "label": {
                        "show": True,
                        "position": "top",
                        "fontSize": 9,
                        "formatter": "{c}%",
                        "color": COLORS['achievement'],
                    },
                    "markLine": {
                        "silent": True,
                        "data": [{"yAxis": 100, "label": {"formatter": "100%", "fontSize": 9}}],
                        "lineStyle": {"type": "dashed", "color": COLORS['target_line'], "width": 1.5},
                    },
                },
            ],
        })

        # Quarter markArea
        mark_areas = self._quarter_mark_areas(start_month, end_month)
        if mark_areas:
            option["series"][0]["markArea"] = {"silent": True, "data": mark_areas}

        # YoY change arrows as graphic elements
        graphic_elements = []
        for i, (a, ly) in enumerate(zip(actual_scaled, ly_scaled)):
            diff = a - ly
            if abs(diff) > 0.01:
                pct = yoy_rates[i]
                color = COLORS['yoy_up'] if diff > 0 else COLORS['yoy_down']
                arrow = "+" if diff > 0 else ""
                graphic_elements.append({
                    "type": "text",
                    "left": f"{7 + i * (84 / max(len(labels), 1))}%",
                    "bottom": "6%",
                    "style": {
                        "text": f"{arrow}{pct:.0f}%",
                        "fontSize": 8,
                        "fill": color,
                        "textAlign": "center",
                        "fontWeight": "bold",
                    },
                    "silent": True,
                })
        if graphic_elements:
            option["graphic"] = graphic_elements

        # Achievement checkmarks
        for i, rate in enumerate(achievement_rates):
            if rate <= 100 and rate > 0:
                # Under budget is good for expenses
                option["series"][3]["data"][i] = {
                    "value": round(rate, 1),
                    "symbol": "roundRect",
                    "symbolSize": 8,
                    "itemStyle": {"color": COLORS['success']},
                }

        # Table data
        table_data = {
            "headers": ["月份"] + labels,
            "rows": [
                {"label": "上年费用", "values": ly_scaled},
                {"label": "本年费用", "values": actual_scaled},
                {"label": "预算", "values": budget_scaled},
                {"label": "同比(%)", "values": [round(r, 1) for r in yoy_rates]},
                {"label": "达成率(%)", "values": [round(r, 1) for r in achievement_rates]},
            ],
        }

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": table_data,
            "analysisContext": self.get_analysis_context({"title": f"{year}年{self.display_name}", "kpis": kpis}),
            "metadata": {"period": period, "scale": scale, "dataQuality": "good"},
        }
        return _sanitize_for_json(result)
