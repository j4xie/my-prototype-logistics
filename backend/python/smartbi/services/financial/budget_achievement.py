"""Budget Achievement Chart Builder — 预算完成情况."""
import logging
from typing import Dict, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS, _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)

# Enhanced quarter background colors — much higher opacity for visible separation
# (Steven's Power BI uses 4 separate chart areas; we simulate with bold markArea)
QUARTER_BG_COLORS = [
    'rgba(45,139,87,0.09)',     # Q1 — green tint
    'rgba(54,179,126,0.08)',    # Q2 — teal tint
    'rgba(232,185,49,0.09)',    # Q3 — gold tint
    'rgba(169,209,142,0.08)',   # Q4 — light green tint
]

QUARTER_BORDER_COLORS = [
    'rgba(45,139,87,0.25)',     # Q1
    'rgba(54,179,126,0.22)',    # Q2
    'rgba(232,185,49,0.25)',    # Q3
    'rgba(169,209,142,0.22)',   # Q4
]

QUARTER_LABELS = ['1季度', '2季度', '3季度', '4季度']


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

        # KPIs — first 3 are primary (larger in Vue), 4th is secondary
        total_budget = sum(v or 0 for v in budget_vals)
        total_actual = sum(v or 0 for v in actual_vals)
        total_rate = self._calc_achievement_rate(total_actual, total_budget)
        scale = _detect_value_scale(budget_vals + actual_vals)

        # Best month
        best_month_idx = max(range(len(achievement_rates)), key=lambda i: achievement_rates[i]) if achievement_rates else 0
        best_month_label = labels[best_month_idx] if best_month_idx < len(labels) else '-'
        best_month_rate = achievement_rates[best_month_idx] if best_month_idx < len(achievement_rates) else 0

        kpis = [
            {"label": "年度目标", "value": self._format_value(total_budget, scale), "unit": "元", "trend": "flat",
             "primary": True,
             "sparkline": [round(v / scale['divisor'], 2) if v else 0 for v in budget_vals]},
            {"label": "年度实际", "value": self._format_value(total_actual, scale), "unit": "元",
             "trend": self._trend_from_value((total_actual or 0) - (total_budget or 0)),
             "primary": True,
             "sparkline": [round(v / scale['divisor'], 2) if v else 0 for v in actual_vals]},
            {"label": "年度达成率", "value": f"{total_rate:.1f}" if total_rate else '-', "unit": "%",
             "trend": 'up' if total_rate and total_rate >= 100 else 'down',
             "primary": True,
             "sparkline": [round(r, 1) for r in achievement_rates]},
            {"label": "最佳月份", "value": f"{best_month_label} ({best_month_rate:.1f}%)", "unit": "", "trend": "up",
             "primary": False},
        ]

        # Scale values for display
        divisor = scale['divisor']
        budget_scaled = [round(v / divisor, 2) if v else 0 for v in budget_vals]
        actual_scaled = [round(v / divisor, 2) if v else 0 for v in actual_vals]
        cum_budget_scaled = [round(v / divisor, 2) for v in cum_budget]
        cum_actual_scaled = [round(v / divisor, 2) for v in cum_actual]

        # --- Compute quarterly totals for markLine annotations ---
        quarterly_actuals_scaled = {}  # q_index -> scaled actual total
        quarterly_rates = {}           # q_index -> achievement rate
        for q in range(4):
            q_start_m = q * 3 + 1
            q_end_m = q * 3 + 3
            if q_start_m < start_month or q_end_m > end_month:
                continue
            q_actual = sum(
                actual_vals[m - start_month]
                for m in range(q_start_m, q_end_m + 1)
                if start_month <= m <= end_month
            )
            q_budget = sum(
                budget_vals[m - start_month]
                for m in range(q_start_m, q_end_m + 1)
                if start_month <= m <= end_month
            )
            quarterly_actuals_scaled[q] = round(q_actual / divisor, 2)
            quarterly_rates[q] = round((self._calc_achievement_rate(q_actual, q_budget) or 0), 1)

        # ECharts option
        option = self._base_echarts_option()
        option.update({
            "grid": {"left": "3%", "right": "5%", "bottom": "10%", "top": "18%", "containLabel": True},
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
                    "itemStyle": {"color": self._gradient_color(COLORS['budget']), "borderRadius": [2, 2, 0, 0]},
                    "barGap": "10%",
                    "barMaxWidth": 28,
                    "label": {
                        "show": True,
                        "position": "top",
                        "formatter": "{c}",
                        "fontSize": 9,
                        "color": "#2D8B57",
                        "fontWeight": "bold",
                    },
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
                },
                {
                    "name": f"实际{scale['name_suffix']}",
                    "type": "bar",
                    "data": actual_scaled,
                    "itemStyle": {"color": self._gradient_color(COLORS['actual']), "borderRadius": [2, 2, 0, 0]},
                    "barMaxWidth": 28,
                    "label": {
                        "show": True,
                        "position": "top",
                        "formatter": "{c}",
                        "fontSize": 9,
                        "color": "#B37700",
                        "fontWeight": "bold",
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
        self._apply_datazoom(option)

        # === Enhanced quarterly markArea — high-visibility backgrounds ===
        mark_areas = self._enhanced_quarter_mark_areas(start_month, end_month, quarterly_rates)
        if mark_areas:
            option["series"][0]["markArea"] = {"silent": True, "data": mark_areas}

        # === Quarterly actual total markLines (yellow dashed horizontal lines) ===
        quarterly_mark_lines = self._quarterly_actual_mark_lines(
            start_month, end_month, quarterly_actuals_scaled, quarterly_rates
        )
        if quarterly_mark_lines:
            # Add markLine to actual (2nd) series so lines are visually tied to actual bars
            if "markLine" not in option["series"][1]:
                option["series"][1]["markLine"] = {"silent": True, "data": []}
            option["series"][1]["markLine"] = {
                "silent": True,
                "symbol": "none",
                "data": quarterly_mark_lines,
            }

        # === Monthly achievement timeline (colored dots + rate%) ===
        num_months = len(labels)
        timeline_graphics = []
        for i, rate in enumerate(achievement_rates):
            x_pct = 8 + i * (84 / max(num_months - 1, 1)) if num_months > 1 else 50
            if rate >= 100:
                dot_color = COLORS['success']
            elif rate >= 80:
                dot_color = COLORS.get('warning', '#FFAB00')
            else:
                dot_color = COLORS['danger']
            # Colored dot — larger radius (r=7)
            timeline_graphics.append({
                "type": "circle",
                "shape": {"r": 7, "cx": 0, "cy": 0},
                "style": {"fill": dot_color, "stroke": "#fff", "lineWidth": 2},
                "left": f"{x_pct}%",
                "top": "6%",
                "silent": True,
            })
            # Rate text below dot — larger font (10px)
            timeline_graphics.append({
                "type": "text",
                "style": {
                    "text": f"{rate:.0f}%",
                    "fontSize": 10,
                    "fill": dot_color,
                    "textAlign": "center",
                    "fontWeight": "bold",
                },
                "left": f"{x_pct}%",
                "top": "9.5%",
                "silent": True,
            })
        if timeline_graphics:
            option["graphic"] = timeline_graphics

        # === Quarterly progress data (for Vue rendering) ===
        quarterly_progress = []
        for q in range(4):
            q_start_m = q * 3 + 1
            q_end_m = q * 3 + 3
            if q_start_m < start_month or q_end_m > end_month:
                continue
            q_budget = sum(
                budget_vals[m - start_month]
                for m in range(q_start_m, q_end_m + 1)
                if start_month <= m <= end_month
            )
            q_actual = sum(
                actual_vals[m - start_month]
                for m in range(q_start_m, q_end_m + 1)
                if start_month <= m <= end_month
            )
            q_rate = self._calc_achievement_rate(q_actual, q_budget) or 0
            quarterly_progress.append({
                "quarter": f"Q{q + 1}",
                "budget": round(q_budget / divisor, 2),
                "actual": round(q_actual / divisor, 2),
                "rate": round(q_rate, 1),
            })

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
            "quarterlyProgress": quarterly_progress,
            "metadata": {"period": period, "scale": scale, "dataQuality": "good"},
        }
        return _sanitize_for_json(result)

    def _enhanced_quarter_mark_areas(self, start_month: int, end_month: int,
                                     quarterly_rates: Dict[int, float]) -> list:
        """Build highly visible quarterly markArea backgrounds with labels.

        Compared to base _quarter_mark_areas():
        - Opacity 0.08-0.10 (was 0.03-0.04)
        - Visible border on each area
        - Quarter label at top: "1季度 (XX.X%)"
        """
        areas = []
        for q in range(4):
            q_start = q * 3       # 0-indexed month position
            q_end = q * 3 + 2
            if q_start > end_month - 1 or q_end < start_month - 1:
                continue
            actual_start = max(q_start, start_month - 1) - (start_month - 1)
            actual_end = min(q_end, end_month - 1) - (start_month - 1)
            rate_str = f" ({quarterly_rates[q]}%)" if q in quarterly_rates else ""
            areas.append([
                {
                    "xAxis": actual_start - 0.5,
                    "itemStyle": {
                        "color": QUARTER_BG_COLORS[q],
                        "borderWidth": 1,
                        "borderColor": QUARTER_BORDER_COLORS[q],
                        "borderType": "dashed",
                    },
                    "label": {
                        "show": True,
                        "position": "insideTop",
                        "formatter": f"{QUARTER_LABELS[q]}{rate_str}",
                        "fontSize": 11,
                        "fontWeight": "bold",
                        "color": "rgba(0,0,0,0.45)",
                        "padding": [4, 0, 0, 0],
                    },
                },
                {"xAxis": actual_end + 0.5},
            ])
        return areas

    def _quarterly_actual_mark_lines(self, start_month: int, end_month: int,
                                     quarterly_actuals: Dict[int, float],
                                     quarterly_rates: Dict[int, float]) -> list:
        """Build yellow dashed horizontal markLine segments per quarter.

        Each quarter gets a short horizontal line at its actual total level,
        mimicking Steven's yellow bar annotations.

        Returns list of markLine data items (pairs of start/end points).
        """
        lines = []
        for q in range(4):
            if q not in quarterly_actuals:
                continue
            q_start_m = q * 3 + 1
            q_end_m = q * 3 + 3
            if q_start_m < start_month or q_end_m > end_month:
                continue
            actual_start_idx = max(q_start_m, start_month) - start_month
            actual_end_idx = min(q_end_m, end_month) - start_month
            avg_actual = quarterly_actuals[q] / 3 if quarterly_actuals[q] else 0
            if avg_actual <= 0:
                continue
            rate_label = f"Q{q+1}: {quarterly_rates.get(q, 0)}%"
            lines.append([
                {
                    "xAxis": actual_start_idx,
                    "yAxis": avg_actual,
                    "symbol": "none",
                    "lineStyle": {
                        "type": "dashed",
                        "color": "#E8B931",
                        "width": 2,
                    },
                    "label": {
                        "show": True,
                        "formatter": rate_label,
                        "fontSize": 10,
                        "fontWeight": "bold",
                        "color": "#B37700",
                        "position": "insideEndTop",
                    },
                },
                {
                    "xAxis": actual_end_idx,
                    "yAxis": avg_actual,
                    "symbol": "none",
                },
            ])
        return lines

    @staticmethod
    def _achievement_label_formatter():
        """Return JS-style formatter string for achievement rate labels on bars."""
        # ECharts rich text formatter — shows achievement rate below bar value
        return "{c}"
