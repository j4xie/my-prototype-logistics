"""Gross Margin Trend Chart Builder — 毛利率趋势."""
import logging
from typing import Dict, List, Any, Optional
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS, MONTH_LABELS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)


class GrossMarginTrendBuilder(AbstractFinancialChartBuilder):
    """Line chart showing margin difference with annotations and data table."""

    chart_type = "gross_margin_trend"
    display_name = "毛利率趋势"
    description = "展示毛利率月度走势，对比本年与上年差异，含趋势标注"
    required_columns = ['actual', 'last_year', 'period']
    display_order = 6

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        start_month = period.get('start_month', 1)
        end_month = period.get('end_month', 12)
        labels = self._month_labels(start_month, end_month)

        # Strategy 1: Try to compute margin from P&L classified data (revenue vs cost)
        # Strategy 2: If values ≤ 100, treat as percentages directly
        # Strategy 3: Return insufficient data

        current_margins = None
        ly_margins = None

        # Strategy 1: Use item classification to separate revenue from cost
        if 'item' in df.columns:
            from ..financial_data_normalizer import FinancialDataNormalizer
            normalizer = FinancialDataNormalizer()
            df_classified = df.copy()
            df_classified['pnl_type'] = df_classified['item'].apply(
                lambda x: normalizer.classify_pnl_item(str(x)) if pd.notna(x) else 'other'
            )
            rev_df = df_classified[df_classified['pnl_type'] == 'revenue']
            cost_df = df_classified[df_classified['pnl_type'] == 'cost']

            if not rev_df.empty and not cost_df.empty:
                rev_monthly = rev_df.groupby('month')['actual'].sum().reindex(range(start_month, end_month + 1)).fillna(0)
                cost_monthly = cost_df.groupby('month')['actual'].sum().reindex(range(start_month, end_month + 1)).fillna(0)
                rev_ly = rev_df.groupby('month')['last_year'].sum().reindex(range(start_month, end_month + 1)).fillna(0)
                cost_ly = cost_df.groupby('month')['last_year'].sum().reindex(range(start_month, end_month + 1)).fillna(0)

                current_margins = []
                ly_margins_list = []
                for m in range(start_month, end_month + 1):
                    r = rev_monthly.get(m, 0)
                    c = cost_monthly.get(m, 0)
                    current_margins.append(round((r - c) / r * 100, 2) if r > 0 else 0)
                    rl = rev_ly.get(m, 0)
                    cl = cost_ly.get(m, 0)
                    ly_margins_list.append(round((rl - cl) / rl * 100, 2) if rl > 0 else 0)
                ly_margins = ly_margins_list

        # Strategy 2: If no P&L classification, try raw aggregation
        if current_margins is None:
            monthly = df.groupby('month').agg(
                actual=('actual', 'sum'),
                last_year=('last_year', 'sum'),
            ).reindex(range(start_month, end_month + 1)).fillna(0)

            actual_vals = monthly['actual'].tolist()
            last_year_vals = monthly['last_year'].tolist()

            max_val = max([abs(v) for v in actual_vals + last_year_vals if v] or [0])
            is_percentage = max_val <= 100 and max_val > 0

            if is_percentage:
                current_margins = [v if v else 0 for v in actual_vals]
                ly_margins = [v if v else 0 for v in last_year_vals]
            else:
                return {
                    "chartType": self.chart_type,
                    "title": f"{year}年{self.display_name}",
                    "kpis": [],
                    "echartsOption": {},
                    "tableData": None,
                    "analysisContext": "数据为绝对金额而非百分比，无法计算毛利率。需要毛利率百分比数据或独立的收入/成本数据。",
                    "metadata": {"period": period, "dataQuality": "insufficient"},
                }

        # Margin difference
        margin_diff = [round(c - ly, 2) for c, ly in zip(current_margins, ly_margins)]

        # Cumulative average margins
        cum_actual_margins = []
        cum_ly_margins = []
        for i in range(len(current_margins)):
            cum_actual_margins.append(round(sum(current_margins[:i+1]) / (i + 1), 2))
            cum_ly_margins.append(round(sum(ly_margins[:i+1]) / (i + 1), 2))

        # KPIs
        avg_current = round(sum(current_margins) / len(current_margins), 2) if current_margins else 0
        avg_ly = round(sum(ly_margins) / len(ly_margins), 2) if ly_margins else 0
        avg_diff = round(avg_current - avg_ly, 2)
        if current_margins:
            best_month_idx = max(range(len(current_margins)), key=lambda i: current_margins[i])
            best_month_label = labels[best_month_idx] if best_month_idx < len(labels) else '-'
            best_month_value = f"{best_month_label} ({current_margins[best_month_idx]:.1f}%)"
        else:
            best_month_value = '-'

        kpis = [
            {"label": "本年累计毛利率", "value": f"{avg_current:.1f}", "unit": "%",
             "trend": self._trend_from_value(avg_diff)},
            {"label": "上年累计毛利率", "value": f"{avg_ly:.1f}", "unit": "%", "trend": "flat"},
            {"label": "差异", "value": f"{avg_diff:+.1f}", "unit": "pp",
             "trend": self._trend_from_value(avg_diff)},
            {"label": "最佳月份", "value": best_month_value,
             "unit": "", "trend": "up"},
        ]

        # ECharts option
        option = self._base_echarts_option()
        option["grid"] = {"left": "3%", "right": "4%", "bottom": "25%", "top": "15%", "containLabel": True}
        option.update({
            "legend": {
                "data": ["本年毛利率", "上年毛利率", "差异"],
                "top": "2%",
                "textStyle": {"fontSize": 11},
            },
            "xAxis": {
                "type": "category",
                "data": labels,
                "axisLabel": {"fontSize": 11},
            },
            "yAxis": {
                "type": "value",
                "name": "毛利率 (%)",
                "nameTextStyle": {"fontSize": 11},
                "axisLabel": {"formatter": "{value}%", "fontSize": 10},
                "splitLine": {"lineStyle": {"type": "dashed", "color": "#e8e8e8"}},
            },
            "series": [
                {
                    "name": "本年毛利率",
                    "type": "line",
                    "data": [round(v, 1) for v in current_margins],
                    "itemStyle": {"color": COLORS['current_year']},
                    "lineStyle": {"width": 3},
                    "symbol": "circle",
                    "symbolSize": 8,
                    "label": {
                        "show": True,
                        "position": "top",
                        "formatter": "{c}%",
                        "fontSize": 10,
                        "color": COLORS['current_year'],
                        "fontWeight": "bold",
                        "backgroundColor": "rgba(255,255,255,0.8)",
                        "borderRadius": 3,
                        "padding": [2, 4],
                    },
                    "areaStyle": {"color": "rgba(27,101,168,0.08)"},
                    "smooth": 0.3,
                },
                {
                    "name": "上年毛利率",
                    "type": "line",
                    "data": [round(v, 1) for v in ly_margins],
                    "itemStyle": {"color": COLORS['last_year']},
                    "lineStyle": {"width": 2, "type": "dashed"},
                    "symbol": "triangle",
                    "symbolSize": 6,
                    "label": {
                        "show": True,
                        "position": "bottom",
                        "formatter": "{c}%",
                        "fontSize": 9,
                        "color": COLORS['last_year'],
                    },
                    "smooth": 0.3,
                },
                {
                    "name": "差异",
                    "type": "bar",
                    "data": [
                        {
                            "value": round(d, 2),
                            "itemStyle": {
                                "color": COLORS['yoy_up'] if d > 0 else COLORS['yoy_down'],
                                "borderRadius": [2, 2, 0, 0] if d >= 0 else [0, 0, 2, 2],
                                "opacity": 0.6,
                            },
                        }
                        for d in margin_diff
                    ],
                    "barMaxWidth": 20,
                    "label": {
                        "show": True,
                        "position": "top",
                        "formatter": "{c}pp",
                        "fontSize": 8,
                        "color": "#666",
                    },
                },
            ],
        })

        # Quarter markArea
        mark_areas = self._quarter_mark_areas(start_month, end_month)
        if mark_areas:
            option["series"][0]["markArea"] = {"silent": True, "data": mark_areas}

        # Annotations for significant changes
        graphic_elements = []
        for i, d in enumerate(margin_diff):
            if abs(d) >= 3:  # Significant change threshold: 3pp
                arrow = "^" if d > 0 else "v"
                color = COLORS['yoy_up'] if d > 0 else COLORS['yoy_down']
                graphic_elements.append({
                    "type": "text",
                    "left": f"{6 + i * (86 / max(len(labels), 1))}%",
                    "top": "10%",
                    "style": {
                        "text": f"{arrow}{abs(d):.1f}pp",
                        "fontSize": 9,
                        "fill": color,
                        "textAlign": "center",
                        "fontWeight": "bold",
                    },
                    "silent": True,
                })
        if graphic_elements:
            option["graphic"] = graphic_elements

        # Data table below chart
        table_data = {
            "headers": ["指标"] + labels,
            "rows": [
                {"label": "上年毛利率(%)", "values": [round(v, 1) for v in ly_margins]},
                {"label": "本年毛利率(%)", "values": [round(v, 1) for v in current_margins]},
                {"label": "差异(pp)", "values": [round(d, 2) for d in margin_diff]},
            ],
        }

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": table_data,
            "analysisContext": self.get_analysis_context({"title": f"{year}年{self.display_name}", "kpis": kpis}),
            "metadata": {"period": period, "dataQuality": "good"},
        }
        return _sanitize_for_json(result)
