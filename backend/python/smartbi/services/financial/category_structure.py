"""Category Structure Donut Chart Builder — 品类结构同比饼图."""
import logging
from typing import Dict, List, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)


class CategoryStructureDonutBuilder(AbstractFinancialChartBuilder):
    """Nested donut chart: inner=last year, outer=current year."""

    chart_type = "category_structure_donut"
    display_name = "品类结构同比饼图"
    description = "展示品类收入/成本结构的同比变化，内环上年、外环本年"
    required_columns = ['actual', 'last_year', 'category']
    display_order = 7

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        # Aggregate by category
        cat_totals = df.groupby('category').agg(
            actual=('actual', 'sum'),
            last_year=('last_year', 'sum'),
        ).reset_index()

        # Remove empty/zero/NaN categories
        cat_totals = cat_totals[
            (cat_totals['category'].notna()) &
            (cat_totals['category'].str.strip() != '') &
            (cat_totals['category'].str.strip().str.lower() != 'nan') &
            ((cat_totals['actual'].fillna(0) != 0) | (cat_totals['last_year'].fillna(0) != 0))
        ]

        if cat_totals.empty:
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": "无品类结构数据",
                "metadata": {"period": period, "dataQuality": "insufficient"},
            }

        categories = cat_totals['category'].tolist()
        actual_vals = cat_totals['actual'].fillna(0).tolist()
        ly_vals = cat_totals['last_year'].fillna(0).tolist()

        total_actual = sum(actual_vals)
        total_ly = sum(ly_vals)
        scale = _detect_value_scale([total_actual, total_ly])
        divisor = scale['divisor']

        chart_colors = COLORS['charts']

        # Find largest category and biggest change
        max_cat_idx = actual_vals.index(max(actual_vals)) if actual_vals else 0
        max_cat = categories[max_cat_idx] if max_cat_idx < len(categories) else '-'
        max_cat_pct = round(actual_vals[max_cat_idx] / total_actual * 100, 1) if total_actual else 0

        # Biggest structure change
        structure_changes = []
        for i, cat in enumerate(categories):
            pct_actual = (actual_vals[i] / total_actual * 100) if total_actual else 0
            pct_ly = (ly_vals[i] / total_ly * 100) if total_ly else 0
            change = pct_actual - pct_ly
            structure_changes.append({"cat": cat, "change": change, "actual_pct": pct_actual, "ly_pct": pct_ly})

        max_change = max(structure_changes, key=lambda x: abs(x['change'])) if structure_changes else None
        max_change_label = (
            f"{max_change['cat']} ({max_change['change']:+.1f}pp)"
            if max_change else '-'
        )

        kpis = [
            {"label": "本年总额", "value": self._format_value(total_actual, scale), "unit": "元", "trend": "flat"},
            {"label": "上年总额", "value": self._format_value(total_ly, scale), "unit": "元", "trend": "flat"},
            {"label": "最大品类", "value": f"{max_cat} ({max_cat_pct:.1f}%)", "unit": "", "trend": "flat"},
            {"label": "最大变化品类", "value": max_change_label, "unit": "", "trend": "flat"},
        ]

        # Build donut data
        # Outer ring: current year
        outer_data = []
        for i, cat in enumerate(categories):
            val = round(actual_vals[i] / divisor, 2)
            pct = round(actual_vals[i] / total_actual * 100, 1) if total_actual else 0
            outer_data.append({
                "name": cat,
                "value": val,
                "itemStyle": {"color": chart_colors[i % len(chart_colors)]},
                "label": {
                    "formatter": f"{cat}\n{self._format_value(actual_vals[i], scale)}\n{pct}%",
                },
            })

        # Inner ring: last year (70% opacity)
        inner_data = []
        for i, cat in enumerate(categories):
            val = round(ly_vals[i] / divisor, 2)
            base_color = chart_colors[i % len(chart_colors)]
            pct = round(ly_vals[i] / total_ly * 100, 1) if total_ly else 0
            inner_data.append({
                "name": cat,
                "value": val,
                "itemStyle": {"color": base_color, "opacity": 0.55},
                "label": {
                    "formatter": f"{pct}%",
                },
            })

        # ECharts option
        option = self._base_echarts_option()
        option["tooltip"] = {
            "trigger": "item",
            "formatter": "{a} <br/>{b}: {c} ({d}%)",
            "confine": True,
        }
        option["grid"] = {"left": "0%", "right": "0%", "bottom": "0%", "top": "0%"}
        option.update({
            "legend": {
                "orient": "vertical",
                "right": "5%",
                "top": "center",
                "data": categories,
                "textStyle": {"fontSize": 11},
                "type": "scroll",
            },
            "series": [
                {
                    "name": f"{year - 1}年(上年)",
                    "type": "pie",
                    "radius": ["25%", "42%"],
                    "center": ["40%", "50%"],
                    "data": inner_data,
                    "label": {
                        "show": True,
                        "position": "inside",
                        "fontSize": 9,
                        "color": "#fff",
                        "fontWeight": "bold",
                    },
                    "labelLine": {"show": False},
                    "itemStyle": {"borderColor": "#fff", "borderWidth": 2},
                    "emphasis": {
                        "itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.3)"},
                        "label": {"fontSize": 11, "fontWeight": "bold"},
                    },
                    "animationType": "scale",
                    "animationEasing": "elasticOut",
                },
                {
                    "name": f"{year}年(本年)",
                    "type": "pie",
                    "radius": ["50%", "72%"],
                    "center": ["40%", "50%"],
                    "data": outer_data,
                    "label": {
                        "show": True,
                        "fontSize": 10,
                        "lineHeight": 15,
                        "overflow": "truncate",
                        "width": 100,
                    },
                    "labelLine": {
                        "length": 15,
                        "length2": 10,
                        "smooth": True,
                    },
                    "itemStyle": {"borderColor": "#fff", "borderWidth": 2},
                    "emphasis": {
                        "itemStyle": {"shadowBlur": 15, "shadowColor": "rgba(0,0,0,0.3)"},
                        "label": {"fontSize": 12, "fontWeight": "bold"},
                    },
                    "animationType": "scale",
                    "animationEasing": "elasticOut",
                    "animationDelay": 200,
                },
            ],
        })

        # Center year labels using graphic elements
        option["graphic"] = [
            {
                "type": "text",
                "left": "37%",
                "top": "46%",
                "style": {
                    "text": f"{year}年",
                    "fontSize": 14,
                    "fill": COLORS['primary'],
                    "textAlign": "center",
                    "fontWeight": "bold",
                },
                "silent": True,
            },
            {
                "type": "text",
                "left": "37%",
                "top": "52%",
                "style": {
                    "text": f"vs {year - 1}年",
                    "fontSize": 10,
                    "fill": COLORS['muted'],
                    "textAlign": "center",
                },
                "silent": True,
            },
        ]

        # Table data: category breakdown comparison
        table_rows = []
        for sc in structure_changes:
            table_rows.append({
                "label": sc['cat'],
                "values": [
                    f"{sc['ly_pct']:.1f}%",
                    f"{sc['actual_pct']:.1f}%",
                    f"{sc['change']:+.1f}pp",
                ],
            })

        table_data = {
            "headers": ["品类", f"{year-1}年占比", f"{year}年占比", "变化"],
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
