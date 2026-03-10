"""Variance Analysis Chart Builder — Zebra BI风格预算vs实际差异分析."""
import logging
import math
from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np

from .base import (
    AbstractFinancialChartBuilder, COLORS, MONTH_LABELS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)


class VarianceAnalysisBuilder(AbstractFinancialChartBuilder):
    """Zebra BI-style integrated bar + waterfall variance analysis.

    For each period (month), shows actual bar + variance waterfall segment.
    Absolute variance (actual - budget) as colored segments: positive=green, negative=red.
    Relative variance (%) as labels on each bar.
    Cumulative variance line on secondary axis.
    Table below: budget, actual, abs variance, rel variance rows.
    """

    chart_type = "variance_analysis"
    display_name = "方差分析图"
    description = "Zebra BI风格的预算vs实际差异分析"
    required_columns = ['budget', 'actual', 'period']
    display_order = 9

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        start_month = period.get('start_month', period.get('startMonth', 1))
        end_month = period.get('end_month', period.get('endMonth', 12))
        months = self._month_labels(start_month, end_month)

        # Use normalized column names (month, budget, actual)
        monthly = df.groupby('month').agg(
            budget=('budget', 'sum'),
            actual=('actual', 'sum'),
        ).reindex(range(start_month, end_month + 1)).fillna(0)

        budget_values = monthly['budget'].tolist()
        actual_values = monthly['actual'].tolist()

        # Calculate variances
        abs_variances = []
        rel_variances = []
        cumulative_variances = []
        cum_var = 0

        for b, a in zip(budget_values, actual_values):
            abs_var = a - b
            abs_variances.append(abs_var)
            rel_var = round((a - b) / abs(b) * 100, 1) if b != 0 else 0
            rel_variances.append(rel_var)
            cum_var += abs_var
            cumulative_variances.append(cum_var)

        # Scale
        all_values = budget_values + actual_values + [abs(v) for v in abs_variances]
        scale = _detect_value_scale(all_values)
        divisor = scale['divisor']

        # Scaled data
        budget_scaled = [round(v / divisor, 2) for v in budget_values]
        actual_scaled = [round(v / divisor, 2) for v in actual_values]
        abs_var_scaled = [round(v / divisor, 2) for v in abs_variances]
        cum_var_scaled = [round(v / divisor, 2) for v in cumulative_variances]

        # Variance bar colors
        var_bar_data = []
        for i, var_val in enumerate(abs_var_scaled):
            var_bar_data.append({
                "value": var_val,
                "itemStyle": {
                    "color": COLORS['secondary'] if var_val >= 0 else COLORS['danger'],
                    "borderRadius": [3, 3, 0, 0] if var_val >= 0 else [0, 0, 3, 3],
                },
                "label": {
                    "show": True,
                    "position": "top" if var_val >= 0 else "bottom",
                    "formatter": f"{'+' if rel_variances[i] > 0 else ''}{rel_variances[i]}%",
                    "fontSize": 10,
                    "color": COLORS['secondary'] if var_val >= 0 else COLORS['danger'],
                    "fontWeight": "bold",
                },
            })

        # KPIs
        total_budget = sum(budget_values)
        total_actual = sum(actual_values)
        total_variance = total_actual - total_budget
        achievement_rate = self._calc_achievement_rate(total_actual, total_budget)

        kpis = [
            {
                "label": "总预算",
                "value": self._format_value(total_budget, scale),
                "unit": "元",
                "trend": "flat",
            },
            {
                "label": "总实际",
                "value": self._format_value(total_actual, scale),
                "unit": "元",
                "trend": self._trend_from_value(total_variance),
            },
            {
                "label": "总差异",
                "value": self._format_value(total_variance, scale),
                "unit": "元",
                "trend": self._trend_from_value(total_variance),
            },
            {
                "label": "达成率",
                "value": f"{achievement_rate}%" if achievement_rate is not None else "-",
                "unit": "",
                "trend": self._trend_from_value((achievement_rate or 0) - 100),
            },
        ]

        # ECharts option
        option = self._base_echarts_option()
        option["grid"] = {"left": "5%", "right": "5%", "bottom": "25%", "top": "12%", "containLabel": True}
        option.update({
            "legend": {
                "data": ["预算", "实际", "差异", "累计差异"],
                "bottom": "18%",
                "left": "center",
                "textStyle": {"fontSize": 11},
            },
            "xAxis": {
                "type": "category",
                "data": months,
                "axisLabel": {"fontSize": 11, "interval": 0},
                "axisTick": {"alignWithLabel": True},
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
                    "name": f"累计差异{scale['name_suffix']}",
                    "nameTextStyle": {"fontSize": 11},
                    "axisLabel": {"fontSize": 10},
                    "splitLine": {"show": False},
                },
            ],
            "series": [
                {
                    "name": "预算",
                    "type": "bar",
                    "data": budget_scaled,
                    "barMaxWidth": 28,
                    "itemStyle": {
                        "color": COLORS['budget'],
                        "opacity": 0.35,
                        "borderColor": COLORS['budget'],
                        "borderWidth": 1,
                        "borderType": "dashed",
                        "borderRadius": [3, 3, 0, 0],
                    },
                    "barGap": "-100%",  # Overlay on same position
                    "z": 1,
                },
                {
                    "name": "实际",
                    "type": "bar",
                    "data": actual_scaled,
                    "barMaxWidth": 28,
                    "itemStyle": {
                        "color": COLORS['actual'],
                        "borderRadius": [3, 3, 0, 0],
                    },
                    "z": 2,
                },
                {
                    "name": "差异",
                    "type": "bar",
                    "data": var_bar_data,
                    "barMaxWidth": 16,
                    "barGap": "20%",
                    "z": 3,
                    "emphasis": {
                        "itemStyle": {"shadowBlur": 8, "shadowColor": "rgba(0,0,0,0.15)"},
                    },
                },
                {
                    "name": "累计差异",
                    "type": "line",
                    "data": cum_var_scaled,
                    "yAxisIndex": 1,
                    "smooth": True,
                    "symbol": "circle",
                    "symbolSize": 6,
                    "lineStyle": {
                        "color": COLORS['accent'],
                        "width": 2.5,
                        "type": "solid",
                    },
                    "itemStyle": {"color": COLORS['accent']},
                    "label": {
                        "show": True,
                        "position": "top",
                        "fontSize": 10,
                        "color": COLORS['accent'],
                        "formatter": "{c}",
                    },
                    "areaStyle": {
                        "color": {
                            "type": "linear",
                            "x": 0, "y": 0, "x2": 0, "y2": 1,
                            "colorStops": [
                                {"offset": 0, "color": "rgba(255,171,0,0.15)"},
                                {"offset": 1, "color": "rgba(255,171,0,0.02)"},
                            ],
                        },
                    },
                },
            ],
        })

        # Quarter background markAreas
        mark_areas = self._quarter_mark_areas(start_month, end_month)
        if mark_areas:
            option["series"][0]["markArea"] = {
                "silent": True,
                "data": mark_areas,
            }

        # Zero reference line
        option["series"][0]["markLine"] = {
            "silent": True,
            "symbol": ["none", "none"],
            "lineStyle": {"type": "solid", "color": "#ddd", "width": 1},
            "label": {"show": False},
            "data": [{"yAxis": 0}],
        }

        # Table data (Zebra BI style detail table)
        table_data = {
            "headers": ["指标"] + months,
            "rows": [
                {"label": "预算", "values": budget_scaled},
                {"label": "实际", "values": actual_scaled},
                {"label": "绝对差异", "values": abs_var_scaled},
                {"label": "相对差异", "values": [f"{v}%" for v in rel_variances]},
            ],
        }

        # Analysis context
        best_month_idx = rel_variances.index(max(rel_variances)) if rel_variances else 0
        worst_month_idx = rel_variances.index(min(rel_variances)) if rel_variances else 0
        analysis_parts = [
            f"{year}年预实差异分析:",
            f"总预算{self._format_value(total_budget, scale)}元",
            f"总实际{self._format_value(total_actual, scale)}元",
            f"达成率{achievement_rate}%",
        ]
        if len(months) > 1:
            analysis_parts.extend([
                f"最佳月份{months[best_month_idx]}(+{rel_variances[best_month_idx]}%)",
                f"最差月份{months[worst_month_idx]}({rel_variances[worst_month_idx]}%)",
            ])

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": table_data,
            "analysisContext": " ".join(analysis_parts),
            "metadata": {
                "period": period,
                "scale": scale,
                "achievementRate": achievement_rate,
                "totalVariance": round(total_variance, 2),
                "relVariances": rel_variances,
                "dataQuality": "good",
            },
        }
        return _sanitize_for_json(result)
