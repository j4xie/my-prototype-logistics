"""Category YoY Comparison Chart Builder — 各品类同期对比."""
import logging
from typing import Dict, List, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS, MONTH_LABELS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)


class CategoryYoyComparisonBuilder(AbstractFinancialChartBuilder):
    """Stacked bar with category colors, current vs last year side by side per month."""

    chart_type = "category_yoy_comparison"
    display_name = "各品类同期对比"
    description = "展示各品类本年与上年同期对比，含品类分布及同比增减"
    required_columns = ['actual', 'last_year', 'category', 'period']
    display_order = 5

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        start_month = period.get('start_month', 1)
        end_month = period.get('end_month', 12)
        labels = self._month_labels(start_month, end_month)

        # Get unique categories
        categories = df['category'].dropna().unique().tolist()
        categories = [c for c in categories if c and str(c).strip() and str(c).lower() != 'nan'][:8]

        if not categories:
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": "无品类数据",
                "metadata": {"period": period, "dataQuality": "insufficient"},
            }

        # Pivot: month x category for actual and last_year
        cat_monthly_actual = {}
        cat_monthly_ly = {}
        for cat in categories:
            cat_df = df[df['category'] == cat]
            monthly = cat_df.groupby('month').agg(
                actual=('actual', 'sum'),
                last_year=('last_year', 'sum'),
            ).reindex(range(start_month, end_month + 1)).fillna(0)
            cat_monthly_actual[cat] = monthly['actual'].tolist()
            cat_monthly_ly[cat] = monthly['last_year'].tolist()

        # Category totals for KPIs
        cat_totals = {}
        for cat in categories:
            total_actual = sum(v or 0 for v in cat_monthly_actual[cat])
            total_ly = sum(v or 0 for v in cat_monthly_ly[cat])
            yoy_rate = self._calc_growth_rate(total_actual, total_ly)
            cat_totals[cat] = {
                "actual": total_actual,
                "last_year": total_ly,
                "yoy_rate": yoy_rate,
                "diff": total_actual - total_ly,
            }

        # Overall totals
        total_actual = sum(ct['actual'] for ct in cat_totals.values())
        total_ly = sum(ct['last_year'] for ct in cat_totals.values())
        total_yoy = self._calc_growth_rate(total_actual, total_ly)
        scale = _detect_value_scale([total_actual, total_ly])

        # Find biggest growth category
        max_growth_cat = max(cat_totals.items(), key=lambda x: x[1].get('yoy_rate', 0) or 0)

        # Scale values
        divisor = scale['divisor']

        # Monthly totals for sparkline
        monthly_total_actual_raw = [
            sum(cat_monthly_actual[cat][m] or 0 for cat in categories)
            for m in range(end_month - start_month + 1)
        ]
        monthly_total_ly_raw = [
            sum(cat_monthly_ly[cat][m] or 0 for cat in categories)
            for m in range(end_month - start_month + 1)
        ]

        kpis = [
            {"label": "本年总额", "value": self._format_value(total_actual, scale), "unit": "元",
             "trend": self._trend_from_value(total_actual - total_ly),
             "sparkline": [round(v / divisor, 2) if v else 0 for v in monthly_total_actual_raw]},
            {"label": "上年总额", "value": self._format_value(total_ly, scale), "unit": "元", "trend": "flat",
             "sparkline": [round(v / divisor, 2) if v else 0 for v in monthly_total_ly_raw]},
            {"label": "同比增长", "value": f"{total_yoy:.1f}" if total_yoy is not None else '-',
             "unit": "%", "trend": self._trend_from_value(total_yoy)},
            {"label": "最大增长品类", "value": f"{max_growth_cat[0]} ({max_growth_cat[1]['yoy_rate']:.1f}%)"
             if max_growth_cat[1].get('yoy_rate') is not None else max_growth_cat[0],
             "unit": "", "trend": "up"},
        ]
        chart_colors = COLORS['charts']

        # Build series: for each category, two bars (current year stacked, last year stacked)
        # Use grouped approach: x-axis has paired labels like "1月-本年", "1月-上年"
        # Simpler: use sub-categories per month
        series_list = []

        # Pre-calculate monthly totals for top-of-stack labels
        monthly_total_scaled = [
            round(sum(cat_monthly_actual[cat][m] or 0 for cat in categories) / divisor, 1)
            for m in range(end_month - start_month + 1)
        ]

        # Current year stacked bars
        for ci, cat in enumerate(categories):
            color = chart_colors[ci % len(chart_colors)]
            actual_scaled = [round(v / divisor, 2) if v else 0 for v in cat_monthly_actual[cat]]
            series_item = {
                "name": f"{cat}(本年)",
                "type": "bar",
                "stack": "current",
                "data": actual_scaled,
                "itemStyle": {"color": self._gradient_color(color), "borderRadius": [1, 1, 0, 0] if ci == len(categories) - 1 else [0, 0, 0, 0]},
                "barMaxWidth": 24,
                "barGap": "20%",
                "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
            }
            # Last category gets monthly total label on top of stack
            if ci == len(categories) - 1:
                series_item["data"] = [
                    {
                        "value": actual_scaled[m],
                        "label": {
                            "show": True,
                            "position": "top",
                            "formatter": f"{monthly_total_scaled[m]}",
                            "fontSize": 9,
                            "color": "#666",
                        },
                    }
                    for m in range(len(actual_scaled))
                ]
            series_list.append(series_item)

        # Last year stacked bars
        for ci, cat in enumerate(categories):
            color = chart_colors[ci % len(chart_colors)]
            ly_scaled = [round(v / divisor, 2) if v else 0 for v in cat_monthly_ly[cat]]
            series_list.append({
                "name": f"{cat}(上年)",
                "type": "bar",
                "stack": "lastyear",
                "data": ly_scaled,
                "itemStyle": {
                    "color": self._gradient_color(color),
                    "opacity": 0.45,
                    "borderRadius": [1, 1, 0, 0] if ci == len(categories) - 1 else [0, 0, 0, 0],
                },
                "barMaxWidth": 24,
                "emphasis": {"itemStyle": {"shadowBlur": 8, "shadowColor": "rgba(0,0,0,0.15)"}},
            })

        # Monthly total YoY% labels
        monthly_total_actual = [
            sum(cat_monthly_actual[cat][m] or 0 for cat in categories)
            for m in range(end_month - start_month + 1)
        ]
        monthly_total_ly = [
            sum(cat_monthly_ly[cat][m] or 0 for cat in categories)
            for m in range(end_month - start_month + 1)
        ]
        monthly_yoy = [
            self._calc_growth_rate(a, ly)
            for a, ly in zip(monthly_total_actual, monthly_total_ly)
        ]

        # ECharts option
        option = self._base_echarts_option()
        option["grid"] = {"left": "3%", "right": "5%", "bottom": "10%", "top": "15%", "containLabel": True}
        option.update({
            "legend": {
                "data": [f"{cat}(本年)" for cat in categories],
                "top": "2%",
                "textStyle": {"fontSize": 10},
                "type": "scroll",
            },
            "xAxis": {
                "type": "category",
                "data": labels,
                "axisLabel": {"fontSize": 11},
            },
            "yAxis": {
                "type": "value",
                "name": f"金额{scale['name_suffix']}",
                "nameTextStyle": {"fontSize": 11},
                "axisLabel": {"fontSize": 10},
                "splitLine": {"lineStyle": {"type": "dashed", "color": "#e8e8e8"}},
            },
            "series": series_list,
        })
        self._apply_datazoom(option)

        # Quarter markArea on first series
        mark_areas = self._quarter_mark_areas(start_month, end_month)
        if mark_areas and series_list:
            series_list[0]["markArea"] = {"silent": True, "data": mark_areas}

        # YoY arrows as graphic elements on top of current year bars
        graphic_elements = []
        for i, yoy in enumerate(monthly_yoy):
            if yoy is not None:
                color = COLORS['yoy_up'] if yoy > 0 else COLORS['yoy_down']
                arrow = "+" if yoy > 0 else ""
                graphic_elements.append({
                    "type": "text",
                    "left": f"{6 + i * (86 / max(len(labels), 1))}%",
                    "bottom": "4%",
                    "style": {
                        "text": f"{arrow}{yoy:.0f}%",
                        "fontSize": 8,
                        "fill": color,
                        "textAlign": "center",
                        "fontWeight": "bold",
                    },
                    "silent": True,
                })
        if graphic_elements:
            option["graphic"] = graphic_elements

        # Table data
        table_rows = []
        for cat in categories:
            ct = cat_totals[cat]
            table_rows.append({
                "label": cat,
                "values": [
                    round(ct['actual'] / divisor, 2),
                    round(ct['last_year'] / divisor, 2),
                    round(ct['diff'] / divisor, 2),
                    f"{ct['yoy_rate']:.1f}%" if ct['yoy_rate'] is not None else '-',
                ],
            })

        table_data = {
            "headers": ["品类", f"本年{scale['name_suffix']}", f"上年{scale['name_suffix']}", f"差异{scale['name_suffix']}", "同比"],
            "rows": table_rows,
        }

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": table_data,
            "analysisContext": self.get_analysis_context({"title": f"{year}年{self.display_name}", "kpis": kpis}),
            "metadata": {"period": period, "scale": scale, "categoryCount": len(categories), "dataQuality": "good"},
        }
        return _sanitize_for_json(result)
