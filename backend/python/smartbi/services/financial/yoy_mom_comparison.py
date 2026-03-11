"""YoY/MoM Comparison Chart Builder — 同比环比情况."""
import logging
from typing import Dict, List, Any, Optional
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS, MONTH_LABELS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)


class YoyMomComparisonBuilder(AbstractFinancialChartBuilder):
    """Grouped bar (current vs last year) + YoY% line + MoM% line."""

    chart_type = "yoy_mom_comparison"
    display_name = "同比环比情况"
    description = "展示本年与上年同期对比，含同比增长率及环比变化趋势"
    required_columns = ['actual', 'last_year', 'period']
    display_order = 2

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        start_month = period.get('start_month', 1)
        end_month = period.get('end_month', 12)
        labels = self._month_labels(start_month, end_month)

        # Aggregate by month
        monthly = df.groupby('month').agg(
            actual=('actual', 'sum'),
            last_year=('last_year', 'sum'),
        ).reindex(range(start_month, end_month + 1)).fillna(0)

        actual_vals = monthly['actual'].tolist()
        last_year_vals = monthly['last_year'].tolist()

        # YoY growth rate per month
        yoy_rates = []
        for a, ly in zip(actual_vals, last_year_vals):
            rate = self._calc_growth_rate(a, ly)
            yoy_rates.append(rate if rate is not None else 0)

        # MoM growth rate
        mom_rates = [0]  # First month has no previous
        for i in range(1, len(actual_vals)):
            rate = self._calc_growth_rate(actual_vals[i], actual_vals[i - 1])
            mom_rates.append(rate if rate is not None else 0)

        # Quarter totals for star markPoints
        quarter_points = []
        for q in range(4):
            q_start = q * 3 + 1
            q_end = q * 3 + 3
            if q_start < start_month or q_end > end_month:
                continue
            q_actual = sum(actual_vals[m - start_month] for m in range(q_start, q_end + 1) if start_month <= m <= end_month)
            q_ly = sum(last_year_vals[m - start_month] for m in range(q_start, q_end + 1) if start_month <= m <= end_month)
            q_yoy = self._calc_growth_rate(q_actual, q_ly)
            quarter_points.append({
                "coord": [q_end - start_month, q_yoy or 0],
                "value": f"Q{q+1}: {q_yoy:.1f}%" if q_yoy is not None else f"Q{q+1}",
                "symbol": "pin",
                "symbolSize": 40,
                "itemStyle": {"color": COLORS['yoy_up'] if (q_yoy or 0) > 0 else COLORS['yoy_down']},
                "label": {"fontSize": 9},
            })

        # KPIs
        total_actual = sum(v or 0 for v in actual_vals)
        total_last_year = sum(v or 0 for v in last_year_vals)
        total_yoy_amount = total_actual - total_last_year
        total_yoy_rate = self._calc_growth_rate(total_actual, total_last_year)
        scale = _detect_value_scale(actual_vals + last_year_vals)

        kpis = [
            {"label": "上年累计", "value": self._format_value(total_last_year, scale), "unit": "元", "trend": "flat",
             "sparkline": [round(v / scale['divisor'], 2) if v else 0 for v in last_year_vals]},
            {"label": "本年累计", "value": self._format_value(total_actual, scale), "unit": "元",
             "trend": self._trend_from_value(total_yoy_amount),
             "sparkline": [round(v / scale['divisor'], 2) if v else 0 for v in actual_vals]},
            {"label": "同比增长额", "value": self._format_value(total_yoy_amount, scale), "unit": "元",
             "trend": self._trend_from_value(total_yoy_amount)},
            {"label": "同比增长率", "value": f"{total_yoy_rate:.1f}" if total_yoy_rate is not None else '-',
             "unit": "%", "trend": self._trend_from_value(total_yoy_rate),
             "sparkline": [round(r, 1) for r in yoy_rates]},
        ]

        # Scale values
        divisor = scale['divisor']
        actual_scaled = [round(v / divisor, 2) if v else 0 for v in actual_vals]
        ly_scaled = [round(v / divisor, 2) if v else 0 for v in last_year_vals]

        # ECharts option
        option = self._base_echarts_option()
        option.update({
            "grid": {"left": "3%", "right": "5%", "bottom": "12%", "top": "16%", "containLabel": True},
            "legend": {
                "data": [f"本年{scale['name_suffix']}", f"上年{scale['name_suffix']}", "同比增长率", "环比增长率"],
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
                    "name": "增长率 (%)",
                    "nameTextStyle": {"fontSize": 11},
                    "axisLabel": {"formatter": "{value}%", "fontSize": 10},
                    "splitLine": {"show": False},
                },
            ],
            "series": [
                {
                    "name": f"本年{scale['name_suffix']}",
                    "type": "bar",
                    "data": actual_scaled,
                    "itemStyle": {"color": self._gradient_color(COLORS['current_year']), "borderRadius": [2, 2, 0, 0]},
                    "barGap": "10%",
                    "barMaxWidth": 28,
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
                },
                {
                    "name": f"上年{scale['name_suffix']}",
                    "type": "bar",
                    "data": ly_scaled,
                    "itemStyle": {"color": self._gradient_color(COLORS['last_year']), "borderRadius": [2, 2, 0, 0]},
                    "barMaxWidth": 28,
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
                },
                {
                    "name": "同比增长率",
                    "type": "line",
                    "yAxisIndex": 1,
                    "data": [round(r, 1) for r in yoy_rates],
                    "itemStyle": {"color": COLORS['danger']},
                    "lineStyle": {"width": 2.5},
                    "symbol": "circle",
                    "symbolSize": 8,
                    "label": {
                        "show": True,
                        "position": "top",
                        "fontSize": 10,
                        "color": COLORS['danger'],
                        "formatter": "{c}%",
                        "backgroundColor": "rgba(255,255,255,0.85)",
                        "borderRadius": 3,
                        "padding": [2, 4],
                    },
                    "markLine": {
                        "silent": True,
                        "data": [{"yAxis": 0, "label": {"show": False}}],
                        "lineStyle": {"type": "dashed", "color": "#aaa", "width": 1},
                    },
                    "markPoint": {
                        "data": quarter_points,
                        "label": {"fontSize": 9, "color": "#fff"},
                    } if quarter_points else {},
                },
                {
                    "name": "环比增长率",
                    "type": "line",
                    "yAxisIndex": 1,
                    "data": [round(r, 1) for r in mom_rates],
                    "itemStyle": {"color": COLORS['accent']},
                    "lineStyle": {"width": 1.5, "type": "dashed"},
                    "symbol": "triangle",
                    "symbolSize": 6,
                    "label": {"show": False},
                },
            ],
        })
        self._apply_datazoom(option)

        # Quarter markArea
        mark_areas = self._quarter_mark_areas(start_month, end_month)
        if mark_areas:
            option["series"][0]["markArea"] = {"silent": True, "data": mark_areas}

        # === Monthly MoM rate row (top of chart) ===
        mom_row_graphics = []
        for i, mom_rate in enumerate(mom_rates):
            x_pct = 8 + i * (84 / max(len(labels) - 1, 1)) if len(labels) > 1 else 50
            if i == 0:
                text = "—"
                color = "#999"
            else:
                text = f"{mom_rate:+.1f}%"
                color = COLORS['yoy_up'] if mom_rate >= 0 else COLORS['yoy_down']
            mom_row_graphics.append({
                "type": "text",
                "style": {
                    "text": text,
                    "fontSize": 8,
                    "fill": color,
                    "fontWeight": "bold",
                    "textAlign": "center",
                },
                "left": f"{x_pct}%",
                "top": "7%",
                "silent": True,
            })

        # Difference arrows as graphic elements
        graphic_elements = []
        for i, (a, ly) in enumerate(zip(actual_scaled, ly_scaled)):
            diff = a - ly
            if abs(diff) > 0:
                color = COLORS['yoy_up'] if diff > 0 else COLORS['yoy_down']
                arrow = "▲" if diff > 0 else "▼"
                graphic_elements.append({
                    "type": "text",
                    "left": f"{8 + i * (84 / max(len(labels) - 1, 1)) if len(labels) > 1 else 50}%",
                    "top": "88%",
                    "style": {
                        "text": f"{arrow}{abs(diff):.1f}",
                        "fontSize": 8,
                        "fill": color,
                        "textAlign": "center",
                    },
                    "silent": True,
                })

        # === Quarterly summary red boxes ===
        quarter_summary_graphics = []
        month_range = list(range(start_month, end_month + 1))
        for q in range(4):
            q_end = q * 3 + 3
            q_start_m = q * 3 + 1
            if q_end not in month_range or q_start_m not in month_range:
                continue
            q_idx = month_range.index(q_end)
            q_actual_total = sum(
                actual_vals[m - start_month]
                for m in range(q_start_m, q_end + 1)
                if start_month <= m <= end_month
            )
            q_formatted = f"{round(q_actual_total / divisor, 1)}"
            x_pct = 8 + q_idx * (84 / max(len(labels) - 1, 1)) if len(labels) > 1 else 50
            # Red border box
            quarter_summary_graphics.append({
                "type": "rect",
                "shape": {"x": -28, "y": -10, "width": 56, "height": 20, "r": 3},
                "style": {
                    "fill": "rgba(255,86,48,0.06)",
                    "stroke": COLORS['danger'],
                    "lineWidth": 1.5,
                },
                "left": f"{x_pct}%",
                "bottom": "1%",
                "silent": True,
            })
            # Quarterly total text
            quarter_summary_graphics.append({
                "type": "text",
                "style": {
                    "text": f"Q{q + 1}:{q_formatted}",
                    "fontSize": 8,
                    "fill": COLORS['danger'],
                    "fontWeight": "bold",
                    "textAlign": "center",
                },
                "left": f"{x_pct}%",
                "bottom": "1.5%",
                "silent": True,
            })

        # Merge all graphic elements
        all_graphics = mom_row_graphics + graphic_elements + quarter_summary_graphics
        if all_graphics:
            option["graphic"] = all_graphics

        # Table data
        table_data = {
            "headers": ["月份"] + labels,
            "rows": [
                {"label": "本年", "values": actual_scaled},
                {"label": "上年", "values": ly_scaled},
                {"label": "同比(%)", "values": [round(r, 1) for r in yoy_rates]},
                {"label": "环比(%)", "values": [round(r, 1) for r in mom_rates]},
            ],
        }

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": table_data,
            "analysisContext": self.get_analysis_context({"title": f"{year}年{self.display_name}", "kpis": kpis}),
            "monthlyDataRows": {
                "currentYear": actual_scaled,
                "lastYear": ly_scaled,
                "labels": labels,
            },
            "metadata": {"period": period, "scale": scale, "dataQuality": "good"},
        }
        return _sanitize_for_json(result)
