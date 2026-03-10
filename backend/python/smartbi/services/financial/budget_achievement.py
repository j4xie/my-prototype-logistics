"""Budget Achievement Chart Builder — 预算完成情况."""
import logging
from typing import Dict, List, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS, MONTH_LABELS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)


class BudgetAchievementBuilder(AbstractFinancialChartBuilder):
    """Grouped bar (budget vs actual) + achievement rate line on secondary axis."""

    chart_type = "budget_achievement"
    display_name = "预算完成情况"
    description = "展示各月预算与实际完成情况对比，含达成率趋势线"
    required_columns = ['budget', 'actual', 'period']
    display_order = 1

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        start_month = period.get('start_month', 1)
        end_month = period.get('end_month', 12)
        labels = self._month_labels(start_month, end_month)

        # Aggregate by month
        monthly = df.groupby('month').agg(
            budget=('budget', 'sum'),
            actual=('actual', 'sum'),
        ).reindex(range(start_month, end_month + 1)).fillna(0)

        budget_vals = monthly['budget'].tolist()
        actual_vals = monthly['actual'].tolist()

        # Achievement rate per month
        achievement_rates = []
        for b, a in zip(budget_vals, actual_vals):
            rate = self._calc_achievement_rate(a, b)
            achievement_rates.append(rate if rate is not None else 0)

        # Cumulative achievement
        cum_budget = []
        cum_actual = []
        cum_b, cum_a = 0, 0
        for b, a in zip(budget_vals, actual_vals):
            cum_b += (b or 0)
            cum_a += (a or 0)
            cum_budget.append(cum_b)
            cum_actual.append(cum_a)
        cum_achievement = [
            self._calc_achievement_rate(a, b) or 0
            for a, b in zip(cum_actual, cum_budget)
        ]

        # KPIs
        total_budget = sum(v or 0 for v in budget_vals)
        total_actual = sum(v or 0 for v in actual_vals)
        total_rate = self._calc_achievement_rate(total_actual, total_budget)
        scale = _detect_value_scale(budget_vals + actual_vals)

        # Best month
        best_month_idx = max(range(len(achievement_rates)), key=lambda i: achievement_rates[i]) if achievement_rates else 0
        best_month_label = labels[best_month_idx] if best_month_idx < len(labels) else '-'
        best_month_rate = achievement_rates[best_month_idx] if best_month_idx < len(achievement_rates) else 0

        kpis = [
            {"label": "年度目标", "value": self._format_value(total_budget, scale), "unit": "元", "trend": "flat"},
            {"label": "年度实际", "value": self._format_value(total_actual, scale), "unit": "元",
             "trend": self._trend_from_value((total_actual or 0) - (total_budget or 0))},
            {"label": "年度达成率", "value": f"{total_rate:.1f}" if total_rate else '-', "unit": "%",
             "trend": 'up' if total_rate and total_rate >= 100 else 'down'},
            {"label": "最佳月份", "value": f"{best_month_label} ({best_month_rate:.1f}%)", "unit": "", "trend": "up"},
        ]

        # Scale values for display
        divisor = scale['divisor']
        budget_scaled = [round(v / divisor, 2) if v else 0 for v in budget_vals]
        actual_scaled = [round(v / divisor, 2) if v else 0 for v in actual_vals]
        cum_budget_scaled = [round(v / divisor, 2) for v in cum_budget]
        cum_actual_scaled = [round(v / divisor, 2) for v in cum_actual]

        # ECharts option
        option = self._base_echarts_option()
        option.update({
            "legend": {
                "data": [f"预算{scale['name_suffix']}", f"实际{scale['name_suffix']}", "达成率", "累计达成率"],
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
                    "name": f"金额{scale['name_suffix']}",
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
                    "name": f"预算{scale['name_suffix']}",
                    "type": "bar",
                    "data": budget_scaled,
                    "itemStyle": {"color": COLORS['budget'], "borderRadius": [2, 2, 0, 0]},
                    "barGap": "10%",
                    "barMaxWidth": 28,
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
                },
                {
                    "name": f"实际{scale['name_suffix']}",
                    "type": "bar",
                    "data": actual_scaled,
                    "itemStyle": {"color": COLORS['actual'], "borderRadius": [2, 2, 0, 0]},
                    "barMaxWidth": 28,
                    "label": {
                        "show": True,
                        "position": "top",
                        "formatter": self._achievement_label_formatter(),
                        "fontSize": 9,
                        "color": "#666",
                    },
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
                },
                {
                    "name": "达成率",
                    "type": "line",
                    "yAxisIndex": 1,
                    "data": [round(r, 1) for r in achievement_rates],
                    "itemStyle": {"color": COLORS['achievement']},
                    "lineStyle": {"width": 2, "type": "solid"},
                    "symbol": "circle",
                    "symbolSize": 6,
                    "label": {
                        "show": True,
                        "formatter": "{c}%",
                        "fontSize": 10,
                        "color": COLORS['achievement'],
                        "position": "top",
                    },
                    "markLine": {
                        "silent": True,
                        "data": [{"yAxis": 100, "label": {"formatter": "目标线", "fontSize": 10}}],
                        "lineStyle": {"type": "dashed", "color": COLORS['target_line'], "width": 2},
                    },
                },
                {
                    "name": "累计达成率",
                    "type": "line",
                    "yAxisIndex": 1,
                    "data": [round(r, 1) for r in cum_achievement],
                    "itemStyle": {"color": COLORS['danger']},
                    "lineStyle": {"width": 2, "type": "dashed"},
                    "symbol": "diamond",
                    "symbolSize": 5,
                    "label": {"show": False},
                },
            ],
        })

        # Quarter markArea on first series
        mark_areas = self._quarter_mark_areas(start_month, end_month)
        if mark_areas:
            option["series"][0]["markArea"] = {"silent": True, "data": mark_areas}

        # Table data
        table_data = {
            "headers": ["月份"] + labels,
            "rows": [
                {"label": "预算", "values": budget_scaled},
                {"label": "实际", "values": actual_scaled},
                {"label": "达成率(%)", "values": [round(r, 1) for r in achievement_rates]},
                {"label": "累计预算", "values": cum_budget_scaled},
                {"label": "累计实际", "values": cum_actual_scaled},
                {"label": "累计达成率(%)", "values": [round(r, 1) for r in cum_achievement]},
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

    @staticmethod
    def _achievement_label_formatter():
        """Return JS-style formatter string for achievement rate labels on bars."""
        # ECharts rich text formatter — shows achievement rate below bar value
        return "{c}"
