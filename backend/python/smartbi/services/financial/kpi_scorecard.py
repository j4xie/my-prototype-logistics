"""KPI Scorecard Chart Builder — 关键绩效指标记分卡."""
import logging
from typing import Dict, List, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)


class KpiScorecardBuilder(AbstractFinancialChartBuilder):
    """KPI Scorecard — 汇总关键财务指标卡片 (收入/毛利率/净利率/预算达成/同比增长).

    Produces a special chart type with no ECharts option — the frontend renders
    it as a row of KPI cards with trend indicators and sparklines.
    """

    chart_type = "kpi_scorecard"
    display_name = "关键指标记分卡"
    description = "汇总展示核心财务KPI：营收、毛利率、净利率、预算达成率、同比增长率等"
    required_columns = ['actual']  # only needs actual values
    display_order = 0  # always first

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        start_month = period.get('start_month', 1)
        end_month = period.get('end_month', 12)

        # Aggregate totals
        has_budget = 'budget' in df.columns
        has_ly = 'last_year' in df.columns
        has_item = 'item' in df.columns

        # Revenue items vs cost/expense items
        from ..financial_data_normalizer import FinancialDataNormalizer
        normalizer = FinancialDataNormalizer()

        revenue = 0
        cost = 0
        expense = 0
        tax = 0
        total_actual = 0
        total_budget = 0
        total_ly = 0

        if has_item:
            for item_name in df['item'].dropna().unique():
                item_df = df[df['item'] == item_name]
                actual_sum = item_df['actual'].sum() if 'actual' in item_df.columns else 0
                pnl_type = normalizer.classify_pnl_item(str(item_name))

                if pnl_type == 'revenue':
                    revenue += actual_sum
                elif pnl_type == 'cost':
                    cost += abs(actual_sum)
                elif pnl_type == 'expense':
                    expense += abs(actual_sum)
                elif pnl_type == 'tax':
                    tax += abs(actual_sum)
        else:
            # No item column — treat all actual as revenue
            revenue = df['actual'].sum() if 'actual' in df.columns else 0

        total_actual = df['actual'].sum() if 'actual' in df.columns else 0
        total_budget = df['budget'].sum() if has_budget else 0
        total_ly = df['last_year'].sum() if has_ly else 0

        gross_profit = revenue - cost
        net_profit = gross_profit - expense - tax
        gross_margin = round(gross_profit / revenue * 100, 1) if revenue > 0 else 0
        net_margin = round(net_profit / revenue * 100, 1) if revenue > 0 else 0
        budget_achievement = self._calc_achievement_rate(total_actual, total_budget)
        yoy_growth = self._calc_growth_rate(total_actual, total_ly)

        # Monthly sparkline data for revenue trend
        monthly_revenue = []
        if 'month' in df.columns and 'actual' in df.columns:
            if has_item:
                rev_df = df[df['item'].apply(lambda x: normalizer.classify_pnl_item(str(x)) == 'revenue' if pd.notna(x) else False)]
            else:
                rev_df = df
            monthly = rev_df.groupby('month')['actual'].sum().reindex(
                range(start_month, end_month + 1)
            ).fillna(0)
            monthly_revenue = monthly.tolist()

        scale = _detect_value_scale([revenue, total_actual, total_ly])

        # Monthly actual sparkline (scaled)
        monthly_actual_sparkline = []
        if 'month' in df.columns and 'actual' in df.columns:
            monthly_all = df.groupby('month')['actual'].sum().reindex(
                range(start_month, end_month + 1)
            ).fillna(0)
            monthly_actual_sparkline = [round(v / scale['divisor'], 2) for v in monthly_all.tolist()]

        # Monthly budget sparkline (scaled)
        monthly_budget_sparkline = []
        if has_budget and 'month' in df.columns:
            monthly_bgt = df.groupby('month')['budget'].sum().reindex(
                range(start_month, end_month + 1)
            ).fillna(0)
            monthly_budget_sparkline = [round(v / scale['divisor'], 2) for v in monthly_bgt.tolist()]

        # Monthly last_year sparkline (scaled)
        monthly_ly_sparkline = []
        if has_ly and 'month' in df.columns:
            monthly_ly = df.groupby('month')['last_year'].sum().reindex(
                range(start_month, end_month + 1)
            ).fillna(0)
            monthly_ly_sparkline = [round(v / scale['divisor'], 2) for v in monthly_ly.tolist()]

        # Build KPI cards
        cards = []

        # 1. Revenue
        cards.append({
            "label": "营业收入" if has_item else "实际总额",
            "value": self._format_value(revenue if has_item else total_actual, scale),
            "unit": "元",
            "trend": self._trend_from_value(yoy_growth),
            "subtitle": f"同比 {yoy_growth:+.1f}%" if yoy_growth is not None else None,
            "sparkline": monthly_revenue[:12] if monthly_revenue else None,
        })

        # 2. Gross Margin (only if we have P&L breakdown)
        if has_item and revenue > 0:
            cards.append({
                "label": "毛利率",
                "value": f"{gross_margin:.1f}",
                "unit": "%",
                "trend": "up" if gross_margin > 25 else ("down" if gross_margin < 15 else "flat"),
                "subtitle": f"毛利 {self._format_value(gross_profit, scale)}元",
            })

        # 3. Net Margin
        if has_item and revenue > 0:
            cards.append({
                "label": "净利率",
                "value": f"{net_margin:.1f}",
                "unit": "%",
                "trend": self._trend_from_value(net_profit),
                "subtitle": f"净利润 {self._format_value(net_profit, scale)}元",
            })

        # 4. Budget Achievement
        if has_budget and total_budget > 0:
            # Monthly achievement rates for sparkline
            monthly_ach_sparkline = []
            if monthly_budget_sparkline and monthly_actual_sparkline:
                monthly_ach_sparkline = [
                    round(a / b * 100, 1) if b > 0 else 0
                    for a, b in zip(monthly_actual_sparkline, monthly_budget_sparkline)
                ]
            cards.append({
                "label": "预算达成率",
                "value": f"{budget_achievement:.1f}" if budget_achievement is not None else "-",
                "unit": "%",
                "trend": "up" if (budget_achievement or 0) >= 100 else "down",
                "subtitle": f"预算 {self._format_value(total_budget, scale)}元",
                "sparkline": monthly_ach_sparkline if monthly_ach_sparkline else None,
            })

        # 5. YoY Growth
        if has_ly and total_ly > 0:
            cards.append({
                "label": "同比增长",
                "value": f"{yoy_growth:+.1f}" if yoy_growth is not None else "-",
                "unit": "%",
                "trend": self._trend_from_value(yoy_growth),
                "subtitle": f"上年 {self._format_value(total_ly, scale)}元",
                "sparkline": monthly_ly_sparkline if monthly_ly_sparkline else None,
            })

        # 6. Cost ratio
        if has_item and revenue > 0:
            cost_ratio = round(cost / revenue * 100, 1)
            cards.append({
                "label": "成本率",
                "value": f"{cost_ratio:.1f}",
                "unit": "%",
                "trend": "down" if cost_ratio < 70 else "up",  # lower is better
                "subtitle": f"成本 {self._format_value(cost, scale)}元",
            })

        # Build a simple gauge/indicator ECharts option for visual representation
        option = self._base_echarts_option()
        option.pop("dataZoom", None)
        option.pop("toolbox", None)
        option["tooltip"] = {"show": False}

        # Use a series of gauge charts arranged horizontally
        gauges = []
        for i, card in enumerate(cards[:6]):
            val = 0
            try:
                val = float(card['value'].replace(',', '').replace('+', '').rstrip('%').rstrip('万').rstrip('亿'))
            except (ValueError, AttributeError):
                pass

            # Determine gauge max based on unit
            gauge_max = 100 if card['unit'] == '%' else val * 1.5 if val > 0 else 100
            gauges.append({
                "type": "gauge",
                "center": [f"{8 + i * 17}%", "55%"],
                "radius": "40%",
                "min": 0,
                "max": gauge_max,
                "startAngle": 200,
                "endAngle": -20,
                "splitNumber": 4,
                "progress": {"show": True, "width": 8, "roundCap": True},
                "pointer": {"show": False},
                "axisLine": {"lineStyle": {"width": 8, "color": [[1, "#e8e8e8"]]}},
                "axisTick": {"show": False},
                "splitLine": {"show": False},
                "axisLabel": {"show": False},
                "title": {
                    "fontSize": 11,
                    "color": COLORS['muted'],
                    "offsetCenter": [0, "70%"],
                },
                "detail": {
                    "fontSize": 18,
                    "fontWeight": "bold",
                    "color": COLORS['primary'],
                    "offsetCenter": [0, "30%"],
                    "formatter": f"{{value}}{scale['suffix']}{card['unit']}" if card['unit'] == '元' else f"{{value}}{card['unit']}",
                },
                "data": [{"value": round(val, 1), "name": card['label']}],
            })

        option["series"] = gauges

        # KPIs for the standard card display
        kpis = [
            {"label": c['label'], "value": c['value'], "unit": c['unit'],
             "trend": c['trend'], "subtitle": c.get('subtitle'),
             **({"sparkline": c['sparkline']} if c.get('sparkline') else {})}
            for c in cards
        ]

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": None,
            "cards": cards,  # Extended card data with sparklines
            "analysisContext": self.get_analysis_context({"title": f"{year}年{self.display_name}", "kpis": kpis}),
            "metadata": {
                "period": period,
                "scale": scale,
                "dataQuality": "good",
                "revenue": revenue,
                "grossMargin": gross_margin,
                "netMargin": net_margin,
            },
        }
        return _sanitize_for_json(result)
