"""Small Multiples Chart Builder — 多维度对比矩阵."""
import logging
import math
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS, MONTH_LABELS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)

# Layout constraints
MAX_CATEGORIES = 9
GRID_LAYOUTS = {
    1: (1, 1),
    2: (1, 2),
    3: (1, 3),
    4: (2, 2),
    5: (2, 3),
    6: (2, 3),
    7: (3, 3),
    8: (3, 3),
    9: (3, 3),
}

# Area fill base color (will be per-category)
SPARKLINE_COLORS = COLORS['charts']  # reuse chart palette


class SmallMultiplesBuilder(AbstractFinancialChartBuilder):
    """Grid layout of small line/area charts, one per category.

    Uses ECharts grid + xAxis + yAxis arrays for multi-chart layout.
    Each small chart shows monthly trend for one category.
    Highlights category with max growth in green, min in red.
    """

    chart_type = "small_multiples"
    display_name = "多维度对比矩阵"
    description = "Small Multiples 小图矩阵，每个品类/维度一个迷你趋势图，快速对比各维度月度走势"
    required_columns = ['actual', 'category', 'period']
    display_order = 17

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        try:
            return self._do_build(df, column_mapping, period, year)
        except Exception as e:
            logger.error(f"SmallMultiplesBuilder failed: {e}", exc_info=True)
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": f"多维度对比矩阵构建失败: {str(e)}",
                "metadata": {"period": period, "dataQuality": "error"},
            }

    def _do_build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int) -> Dict[str, Any]:
        start_month = period.get('start_month', 1)
        end_month = period.get('end_month', 12)
        labels = self._month_labels(start_month, end_month)
        month_range = list(range(start_month, end_month + 1))

        # --- Group by category and month ---
        categories = [c for c in df['category'].dropna().unique().tolist()
                      if str(c).strip() and str(c).lower() not in ('nan', 'none', '')]
        if not categories:
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": "无品类数据可构建矩阵图",
                "metadata": {"period": period, "dataQuality": "insufficient"},
            }

        # Limit to MAX_CATEGORIES (take top by total actual, filtered)
        cat_totals = df.groupby('category')['actual'].sum().sort_values(ascending=False)
        valid_categories = set(categories)
        selected_cats = [c for c in cat_totals.index.tolist()
                         if str(c) in valid_categories and cat_totals[c] > 0][:MAX_CATEGORIES]
        num_cats = len(selected_cats)
        if num_cats == 0:
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": "无有效品类数据可构建矩阵图",
                "metadata": {"period": period, "dataQuality": "insufficient"},
            }

        # --- Build per-category monthly data ---
        cat_data: List[Dict[str, Any]] = []
        for cat in selected_cats:
            cat_df = df[df['category'] == cat]
            monthly = cat_df.groupby('month')['actual'].sum().reindex(month_range).fillna(0)
            values = monthly.tolist()

            # Calculate YoY growth if last_year data available
            yoy_growth: Optional[float] = None
            if 'last_year' in cat_df.columns and cat_df['last_year'].notna().any():
                ly_total = cat_df['last_year'].sum()
                cy_total = cat_df['actual'].sum()
                yoy_growth = self._calc_growth_rate(cy_total, ly_total)

            # Trend growth: compare first-half vs second-half of non-zero data
            non_zero_vals = [v for v in values if v > 0]
            if len(non_zero_vals) >= 2:
                mid = len(non_zero_vals) // 2
                first_half_avg = sum(non_zero_vals[:mid]) / mid
                second_half_avg = sum(non_zero_vals[mid:]) / (len(non_zero_vals) - mid)
                growth = self._calc_growth_rate(second_half_avg, first_half_avg)
            else:
                growth = yoy_growth  # fallback to YoY

            cat_data.append({
                "name": str(cat),
                "values": values,
                "total": float(cat_totals.get(cat, 0)),
                "growth": growth,
                "yoy_growth": yoy_growth,
            })

        # --- Identify best/worst ---
        growths = [(c['name'], c['growth']) for c in cat_data if c['growth'] is not None]
        best_cat = max(growths, key=lambda x: x[1]) if growths else (None, None)
        worst_cat = min(growths, key=lambda x: x[1]) if growths else (None, None)

        avg_growth = (
            sum(g for _, g in growths) / len(growths) if growths else 0
        )

        # Monthly totals across all categories for sparkline
        monthly_totals = [
            sum(c['values'][m] for c in cat_data)
            for m in range(len(month_range))
        ]

        # --- KPIs ---
        kpis = [
            {
                "label": "品类总数",
                "value": str(num_cats),
                "unit": "个",
                "trend": "flat",
            },
            {
                "label": "增长最快品类",
                "value": f"{best_cat[0]} ({best_cat[1]:+.1f}%)" if best_cat[0] else "-",
                "unit": "",
                "trend": "up",
                "sparkline": next(
                    ([round(v / divisor, 2) for v in c['values']] for c in cat_data if c['name'] == best_cat[0]),
                    None,
                ) if best_cat[0] else None,
            },
            {
                "label": "下降最快品类",
                "value": f"{worst_cat[0]} ({worst_cat[1]:+.1f}%)" if worst_cat[0] else "-",
                "unit": "",
                "trend": "down",
                "sparkline": next(
                    ([round(v / divisor, 2) for v in c['values']] for c in cat_data if c['name'] == worst_cat[0]),
                    None,
                ) if worst_cat[0] else None,
            },
            {
                "label": "平均增长率",
                "value": f"{avg_growth:+.1f}",
                "unit": "%",
                "trend": self._trend_from_value(avg_growth),
                "sparkline": [round(v / divisor, 2) for v in monthly_totals],
            },
        ]

        # --- Grid layout calculation ---
        rows, cols = GRID_LAYOUTS.get(num_cats, (3, 3))
        grid_width = 1.0 / cols
        grid_height = 1.0 / rows
        padding_x = 0.04  # horizontal padding between grids
        padding_y = 0.08  # vertical padding (room for sub-title)

        # Scale detection (global across all categories)
        all_values = [v for c in cat_data for v in c['values']]
        scale = _detect_value_scale(all_values)
        divisor = scale['divisor']

        # --- Build ECharts option with multiple grids ---
        option = {
            "animation": True,
            "animationDuration": 600,
            "animationEasing": "cubicOut",
            "tooltip": {"trigger": "axis", "confine": True},
        }

        grids = []
        x_axes = []
        y_axes = []
        series_list = []
        titles = []

        for idx, cat in enumerate(cat_data):
            row = idx // cols
            col = idx % cols

            # Grid position in percentage
            left_pct = col * grid_width * 100 + padding_x * 100 / 2
            top_pct = row * grid_height * 100 + padding_y * 100
            width_pct = grid_width * 100 - padding_x * 100
            height_pct = grid_height * 100 - padding_y * 100 - 2  # room for title

            grids.append({
                "left": f"{left_pct:.1f}%",
                "top": f"{top_pct:.1f}%",
                "width": f"{width_pct:.1f}%",
                "height": f"{height_pct:.1f}%",
            })

            # Minimal x-axis (only show on bottom row)
            x_axes.append({
                "type": "category",
                "gridIndex": idx,
                "data": labels,
                "axisLabel": {
                    "show": row == rows - 1,
                    "fontSize": 8,
                    "interval": 2,
                },
                "axisTick": {"show": False},
                "axisLine": {"lineStyle": {"color": "#ddd"}},
                "splitLine": {"show": False},
            })

            # Minimal y-axis (only show on leftmost column)
            y_axes.append({
                "type": "value",
                "gridIndex": idx,
                "axisLabel": {
                    "show": col == 0,
                    "fontSize": 8,
                },
                "axisTick": {"show": False},
                "axisLine": {"show": False},
                "splitLine": {
                    "show": True,
                    "lineStyle": {"type": "dashed", "color": "#f0f0f0"},
                },
            })

            # Determine color based on growth
            growth_val = cat['growth']
            if best_cat[0] and cat['name'] == best_cat[0]:
                line_color = COLORS['success']  # green
                area_color = "rgba(54,179,126,0.15)"
            elif worst_cat[0] and cat['name'] == worst_cat[0]:
                line_color = COLORS['danger']  # red
                area_color = "rgba(255,86,48,0.15)"
            else:
                color_idx = idx % len(SPARKLINE_COLORS)
                line_color = SPARKLINE_COLORS[color_idx]
                # Parse hex to rgba
                area_color = self._hex_to_rgba(line_color, 0.12)

            # Scaled data
            scaled_values = [round(v / divisor, 2) for v in cat['values']]

            series_list.append({
                "name": cat['name'],
                "type": "line",
                "xAxisIndex": idx,
                "yAxisIndex": idx,
                "data": scaled_values,
                "itemStyle": {"color": line_color},
                "lineStyle": {"width": 2},
                "symbol": "none",
                "areaStyle": {"color": area_color},
                "smooth": True,
            })

            # Sub-chart title (category name + growth%)
            growth_text = f" {cat['growth']:+.1f}%" if cat['growth'] is not None else ""
            yoy_text = ""
            if cat['yoy_growth'] is not None:
                yoy_text = f" (YoY {cat['yoy_growth']:+.1f}%)"

            titles.append({
                "text": f"{cat['name']}{growth_text}{yoy_text}",
                "left": f"{left_pct + width_pct / 2:.1f}%",
                "top": f"{top_pct - padding_y * 50:.1f}%",
                "textAlign": "center",
                "textStyle": {
                    "fontSize": 11,
                    "fontWeight": "bold",
                    "color": line_color,
                },
            })

        option["title"] = titles
        option["grid"] = grids
        option["xAxis"] = x_axes
        option["yAxis"] = y_axes
        option["series"] = series_list

        # --- Table data ---
        table_headers = ["品类"] + labels + ["合计", "增长率(%)"]
        table_rows = []
        for cat in cat_data:
            scaled = [round(v / divisor, 2) for v in cat['values']]
            total_scaled = round(cat['total'] / divisor, 2)
            growth_str = f"{cat['growth']:.1f}" if cat['growth'] is not None else "-"
            table_rows.append({
                "label": cat['name'],
                "values": scaled + [total_scaled, growth_str],
            })

        table_data = {
            "headers": table_headers,
            "rows": table_rows,
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
                "gridLayout": f"{rows}x{cols}",
                "categoryCount": num_cats,
            },
        }
        return _sanitize_for_json(result)

    @staticmethod
    def _hex_to_rgba(hex_color: str, alpha: float) -> str:
        """Convert hex color to rgba string."""
        try:
            hex_clean = hex_color.lstrip('#')
            if len(hex_clean) == 6:
                r = int(hex_clean[0:2], 16)
                g = int(hex_clean[2:4], 16)
                b = int(hex_clean[4:6], 16)
                return f"rgba({r},{g},{b},{alpha})"
        except (ValueError, IndexError):
            pass
        return f"rgba(27,101,168,{alpha})"
