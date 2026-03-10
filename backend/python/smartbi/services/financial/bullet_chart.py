"""Bullet Chart Builder — 目标达成进度 Bullet Chart."""
import logging
from typing import Dict, List, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS, MONTH_LABELS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)

# Bullet chart band colors (差/良/优 background ranges)
BAND_COLORS = ['#f0f0f0', '#e0e0e0', '#d0d0d0']
BAND_LABELS = ['差 (0-60%)', '良 (60-80%)', '优 (80-100%)']
BAND_RATIOS = [0.60, 0.20, 0.20]  # each band's width fraction of target

# Actual bar color
ACTUAL_COLOR = COLORS['primary']
# Target marker color
TARGET_COLOR = '#333333'


class BulletChartBuilder(AbstractFinancialChartBuilder):
    """Horizontal bullet charts showing budget achievement per metric/category.

    Each bullet displays:
    - 3 background bands (差/良/优: 0-60%, 60-80%, 80-100% of budget)
    - Narrower coloured bar for actual value
    - Marker line for target (budget)

    If category data exists, one bullet per category; otherwise one for total.
    """

    chart_type = "bullet_chart"
    display_name = "目标达成进度"
    description = "Bullet Chart 展示各项目/类别的预算目标达成进度，含差/良/优区间"
    required_columns = ['budget', 'actual']
    display_order = 16

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        try:
            return self._do_build(df, column_mapping, period, year)
        except Exception as e:
            logger.error(f"BulletChartBuilder failed: {e}", exc_info=True)
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": f"目标达成进度构建失败: {str(e)}",
                "metadata": {"period": period, "dataQuality": "error"},
            }

    def _do_build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int) -> Dict[str, Any]:
        # --- Determine grouping ---
        has_category = 'category' in df.columns and df['category'].notna().any()

        if has_category:
            grouped = df.groupby('category').agg(
                budget=('budget', 'sum'),
                actual=('actual', 'sum'),
            ).reset_index()
            metrics = []
            for _, row in grouped.iterrows():
                budget_val = float(row['budget']) if pd.notna(row['budget']) else 0
                actual_val = float(row['actual']) if pd.notna(row['actual']) else 0
                rate = self._calc_achievement_rate(actual_val, budget_val)
                metrics.append({
                    "name": str(row['category']),
                    "budget": budget_val,
                    "actual": actual_val,
                    "rate": rate if rate is not None else 0,
                })
        else:
            total_budget = float(df['budget'].sum()) if 'budget' in df.columns else 0
            total_actual = float(df['actual'].sum()) if 'actual' in df.columns else 0
            rate = self._calc_achievement_rate(total_actual, total_budget)
            metrics = [{
                "name": "总计",
                "budget": total_budget,
                "actual": total_actual,
                "rate": rate if rate is not None else 0,
            }]

        if not metrics:
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": "无可用数据构建Bullet Chart",
                "metadata": {"period": period, "dataQuality": "insufficient"},
            }

        # Sort by achievement rate descending
        metrics.sort(key=lambda m: m['rate'], reverse=True)

        # --- KPIs ---
        rates = [m['rate'] for m in metrics]
        achieved_count = sum(1 for r in rates if r >= 100)
        total_count = len(metrics)
        avg_rate = sum(rates) / max(total_count, 1)
        max_rate = max(rates) if rates else 0
        min_rate = min(rates) if rates else 0

        kpis = [
            {
                "label": "达标项目数",
                "value": f"{achieved_count}/{total_count}",
                "unit": "项",
                "trend": "up" if achieved_count > total_count / 2 else "down",
            },
            {
                "label": "平均达成率",
                "value": f"{avg_rate:.1f}",
                "unit": "%",
                "trend": "up" if avg_rate >= 100 else "down",
            },
            {
                "label": "最高达成",
                "value": f"{max_rate:.1f}",
                "unit": "%",
                "trend": "up",
            },
            {
                "label": "最低达成",
                "value": f"{min_rate:.1f}",
                "unit": "%",
                "trend": "down" if min_rate < 80 else "up",
            },
        ]

        # --- Scale detection ---
        all_budget_vals = [m['budget'] for m in metrics]
        all_actual_vals = [m['actual'] for m in metrics]
        scale = _detect_value_scale(all_budget_vals + all_actual_vals)
        divisor = scale['divisor']

        # --- Build ECharts option ---
        # Bullet chart via stacked horizontal bars
        categories = [m['name'] for m in metrics]
        max_budget = max((m['budget'] for m in metrics), default=1)
        # Use 120% of max budget as axis max to give room for over-achievers
        axis_max = round(max_budget * 1.2 / divisor, 2)

        option = self._base_echarts_option()
        option["grid"] = {"left": "5%", "right": "8%", "bottom": "5%", "top": "10%", "containLabel": True}
        option["tooltip"] = {
            "trigger": "axis",
            "axisPointer": {"type": "shadow"},
            "confine": True,
        }

        # Y-axis = categories (horizontal bullet)
        option["yAxis"] = {
            "type": "category",
            "data": categories,
            "axisLabel": {"fontSize": 11},
            "axisTick": {"show": False},
            "inverse": True,
        }
        option["xAxis"] = {
            "type": "value",
            "name": f"金额{scale['name_suffix']}",
            "nameTextStyle": {"fontSize": 11},
            "axisLabel": {"fontSize": 10},
            "max": axis_max if axis_max > 0 else None,
            "splitLine": {"lineStyle": {"type": "dashed", "color": "#e8e8e8"}},
        }

        # Build series: 3 background bands (stacked) + 1 actual bar + target markLines
        band_series = []
        for band_idx in range(3):
            band_data = []
            for m in metrics:
                budget_scaled = m['budget'] / divisor
                band_width = budget_scaled * BAND_RATIOS[band_idx]
                band_data.append(round(band_width, 2))

            band_series.append({
                "name": BAND_LABELS[band_idx],
                "type": "bar",
                "stack": "bands",
                "data": band_data,
                "itemStyle": {
                    "color": BAND_COLORS[band_idx],
                    "borderColor": "#fff",
                    "borderWidth": 0,
                },
                "barWidth": "60%",
                "barMaxWidth": 40,
                "silent": True,
                "tooltip": {"show": False},
            })

        # Actual bar (narrower, overlaid)
        actual_data = [round(m['actual'] / divisor, 2) for m in metrics]
        actual_series = {
            "name": f"实际{scale['name_suffix']}",
            "type": "bar",
            "data": [
                {
                    "value": v,
                    "itemStyle": {
                        "color": ACTUAL_COLOR if metrics[i]['rate'] >= 60 else COLORS['danger'],
                    },
                }
                for i, v in enumerate(actual_data)
            ],
            "barWidth": "30%",
            "barMaxWidth": 20,
            "barGap": "-100%",  # Overlay on same position
            "z": 10,
            "label": {
                "show": True,
                "position": "right",
                "formatter": "{c}",
                "fontSize": 10,
                "color": "#333",
            },
            "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
        }

        # Target markers via markLine on the actual series
        target_mark_data = []
        for i, m in enumerate(metrics):
            target_scaled = round(m['budget'] / divisor, 2)
            target_mark_data.append({
                "xAxis": target_scaled,
                "label": {
                    "show": True,
                    "formatter": f"目标: {target_scaled}",
                    "fontSize": 9,
                    "color": TARGET_COLOR,
                    "position": "end",
                },
            })

        # Use a single markLine with average of targets (ECharts limitation per-category)
        # Instead, add achievement rate annotation via label
        actual_series_with_rates = {
            **actual_series,
            "label": {
                "show": True,
                "position": "right",
                "formatter": lambda_unavailable_use_static(metrics, divisor),
                "fontSize": 10,
                "color": "#333",
                "rich": {
                    "rate": {"fontSize": 9, "color": COLORS['muted']},
                },
            },
        }

        # Target line (single reference line at 100% scaled as average budget)
        avg_budget_scaled = round(sum(m['budget'] for m in metrics) / max(len(metrics), 1) / divisor, 2)

        option["series"] = band_series + [actual_series]

        # Add target markLines per metric on actual series
        mark_lines = []
        for m in metrics:
            target_val = round(m['budget'] / divisor, 2)
            mark_lines.append({
                "xAxis": target_val,
                "label": {"show": False},
                "lineStyle": {"color": TARGET_COLOR, "width": 2, "type": "solid"},
            })
        if mark_lines:
            # Use unique target lines — one per the most prominent metric
            option["series"][-1]["markLine"] = {
                "silent": True,
                "symbol": ["none", "none"],
                "data": [mark_lines[0]],  # Show overall target reference
                "lineStyle": {"color": TARGET_COLOR, "width": 2, "type": "solid"},
                "label": {"formatter": "目标", "fontSize": 10, "position": "end"},
            }

        # Override label on actual series to show rate
        actual_labels = [
            f"{actual_data[i]}  ({metrics[i]['rate']:.0f}%)"
            for i in range(len(metrics))
        ]
        option["series"][-1]["data"] = [
            {
                "value": actual_data[i],
                "label": {
                    "show": True,
                    "position": "right",
                    "formatter": actual_labels[i],
                    "fontSize": 10,
                    "color": ACTUAL_COLOR if metrics[i]['rate'] >= 80 else COLORS['danger'],
                },
                "itemStyle": {
                    "color": ACTUAL_COLOR if metrics[i]['rate'] >= 60 else COLORS['danger'],
                },
            }
            for i in range(len(metrics))
        ]

        option["legend"] = {
            "data": [BAND_LABELS[0], BAND_LABELS[1], BAND_LABELS[2], f"实际{scale['name_suffix']}"],
            "top": "2%",
            "textStyle": {"fontSize": 10},
        }

        # --- Table data ---
        table_data = {
            "headers": ["项目", f"预算{scale['name_suffix']}", f"实际{scale['name_suffix']}", "达成率(%)"],
            "rows": [
                {
                    "label": m['name'],
                    "values": [
                        round(m['budget'] / divisor, 2),
                        round(m['actual'] / divisor, 2),
                        round(m['rate'], 1),
                    ],
                }
                for m in metrics
            ],
        }

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": table_data,
            "analysisContext": self.get_analysis_context({"title": f"{year}年{self.display_name}", "kpis": kpis}),
            "metadata": {
                "period": period,
                "scale": scale,
                "dataQuality": "good",
                "metricCount": len(metrics),
            },
        }
        return _sanitize_for_json(result)


def lambda_unavailable_use_static(metrics: List[Dict], divisor: float) -> str:
    """ECharts formatters must be strings, not Python lambdas.
    Return a simple string placeholder — actual labels are set per data point.
    """
    return "{c}"
