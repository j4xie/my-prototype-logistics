"""Gross Margin Trend Chart Builder — 毛利率趋势."""
import logging
from typing import Dict, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, _sanitize_for_json,
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
                rev_monthly = rev_df.groupby('month')['actual'].sum().reindex(range(start_month, end_month + 1)).fillna(0)  # noqa: E501
                cost_monthly = cost_df.groupby('month')['actual'].sum().reindex(range(start_month, end_month + 1)).fillna(0)  # noqa: E501
                rev_ly = rev_df.groupby('month')['last_year'].sum().reindex(range(start_month, end_month + 1)).fillna(0)
                cost_ly = cost_df.groupby('month')['last_year'].sum().reindex(range(start_month, end_month + 1)).fillna(0)  # noqa: E501

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
        # Best diff month (largest positive improvement)
        if margin_diff:
            best_diff_idx = max(range(len(margin_diff)), key=lambda i: margin_diff[i])
            best_diff_label = labels[best_diff_idx] if best_diff_idx < len(labels) else '-'
            best_diff_value = f"{best_diff_label} ({margin_diff[best_diff_idx]:+.1f}%)"
        else:
            best_diff_value = '-'

        kpis = [
            {"label": "本年累计毛利率", "value": f"{avg_current:.1f}", "unit": "%",
             "trend": self._trend_from_value(avg_diff),
             "sparkline": [round(v, 1) for v in current_margins]},
            {"label": "上年累计毛利率", "value": f"{avg_ly:.1f}", "unit": "%", "trend": "flat",
             "sparkline": [round(v, 1) for v in ly_margins]},
            {"label": "平均差异", "value": f"{avg_diff:+.1f}", "unit": "%",
             "trend": self._trend_from_value(avg_diff),
             "sparkline": [round(d, 2) for d in margin_diff]},
            {"label": "最佳改善月", "value": best_diff_value,
             "unit": "", "trend": "up"},
        ]

        # ECharts option — single difference line (red line + yellow dots)
        option = self._base_echarts_option()
        option["grid"] = {"left": "3%", "right": "4%", "bottom": "15%", "top": "15%", "containLabel": True}

        # Build label data with positional formatting
        diff_series_data = []
        for d in margin_diff:
            arrow = "↑" if d >= 0 else "↓"
            color = "#36B37E" if d >= 0 else "#FF5630"
            diff_series_data.append({
                "value": round(d, 2),
                "label": {
                    "show": True,
                    "position": "top" if d >= 0 else "bottom",
                    "formatter": f"{arrow}{abs(d):.1f}%",
                    "fontSize": 10,
                    "color": color,
                    "fontWeight": "bold",
                },
            })

        option.update({
            "legend": {
                "data": ["毛利率差异"],
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
                "name": "差异 (%)",
                "nameTextStyle": {"fontSize": 11},
                "axisLabel": {"formatter": "{value}%", "fontSize": 10},
                "splitLine": {"lineStyle": {"type": "dashed", "color": "#e8e8e8"}},
            },
            "series": [
                {
                    "name": "毛利率差异",
                    "type": "line",
                    "data": diff_series_data,
                    "lineStyle": {"color": "#FF0000", "width": 2.5},
                    "itemStyle": {"color": "#E8B931", "borderColor": "#FF0000", "borderWidth": 2},
                    "symbol": "circle",
                    "symbolSize": 10,
                    "smooth": 0.3,
                },
            ],
        })
        self._apply_datazoom(option)

        # Data table below chart — with 合计 (average) column
        avg_ly_val = round(sum(ly_margins) / len(ly_margins), 1) if ly_margins else 0
        avg_cur_val = round(sum(current_margins) / len(current_margins), 1) if current_margins else 0
        avg_diff_val = round(sum(margin_diff) / len(margin_diff), 2) if margin_diff else 0

        table_data = {
            "headers": ["指标"] + labels + ["合计"],
            "rows": [
                {"label": "上年毛利率(%)", "values": [round(v, 1) for v in ly_margins] + [avg_ly_val]},
                {"label": "本年毛利率(%)", "values": [round(v, 1) for v in current_margins] + [avg_cur_val]},
                {"label": "差异(%)", "values": [round(d, 2) for d in margin_diff] + [avg_diff_val]},
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
