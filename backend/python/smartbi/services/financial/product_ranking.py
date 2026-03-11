"""Product Ranking Pareto Chart Builder — 重点产品排名."""
import logging
from typing import Dict, List, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS, MONTH_LABELS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)


class ProductRankingParetoBuilder(AbstractFinancialChartBuilder):
    """Pareto chart: descending revenue bars + cumulative percentage line."""

    chart_type = "product_ranking"
    display_name = "重点产品排名"
    description = "按收入降序排列产品/品类，叠加累计占比曲线，突出80/20法则"
    required_columns = ['actual', 'category']
    display_order = 12

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        try:
            return self._do_build(df, column_mapping, period, year)
        except Exception as e:
            logger.error(f"ProductRankingParetoBuilder failed: {e}", exc_info=True)
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": f"产品排名构建失败: {str(e)}",
                "metadata": {"period": period, "dataQuality": "error"},
            }

    def _do_build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int) -> Dict[str, Any]:
        # Aggregate revenue by category/product
        cat_col = 'category'
        if cat_col not in df.columns:
            return self._empty_result(period, year)

        cat_totals = df.groupby(cat_col).agg(
            revenue=('actual', 'sum')
        ).reset_index()
        cat_totals.columns = ['product', 'revenue']

        # Clean: remove empty/zero entries
        cat_totals = cat_totals[
            (cat_totals['product'].notna()) &
            (cat_totals['product'].astype(str).str.strip() != '') &
            (cat_totals['product'].astype(str).str.strip().str.lower() != 'nan') &
            (cat_totals['revenue'].fillna(0) > 0)
        ]

        if cat_totals.empty:
            return self._empty_result(period, year)

        # Sort descending
        cat_totals = cat_totals.sort_values('revenue', ascending=False).reset_index(drop=True)

        products = cat_totals['product'].tolist()
        revenues = cat_totals['revenue'].tolist()
        total_revenue = sum(revenues)

        # Calculate cumulative percentages
        cumulative = []
        running = 0.0
        for rev in revenues:
            running += rev
            pct = round(running / total_revenue * 100, 1) if total_revenue else 0
            cumulative.append(pct)

        # Detect value scale
        scale = _detect_value_scale(revenues)
        scaled_revenues = [round(v / scale['divisor'], 2) for v in revenues]

        # Generate gradient colors from primary to lighter shades
        primary = COLORS['primary']  # "#1B65A8"
        bar_colors = self._generate_gradient_colors(primary, len(products))

        # --- KPIs ---
        top1_product = products[0] if products else "-"
        top1_revenue = revenues[0] if revenues else 0
        top3_pct = cumulative[min(2, len(cumulative) - 1)] if cumulative else 0

        kpis = [
            {
                "label": "Top 1 产品",
                "value": top1_product,
                "unit": "",
                "trend": "flat",
            },
            {
                "label": "Top 1 收入",
                "value": self._format_value(top1_revenue, scale),
                "unit": "元",
                "trend": "flat",
            },
            {
                "label": "Top 3 占比",
                "value": f"{top3_pct}",
                "unit": "%",
                "trend": "up" if top3_pct > 60 else "flat",
            },
            {
                "label": "产品总数",
                "value": str(len(products)),
                "unit": "个",
                "trend": "flat",
            },
        ]

        # --- ECharts Pareto option ---
        option = self._base_echarts_option()
        option.pop("dataZoom", None)
        option.pop("toolbox", None)

        bar_data = []
        for i, val in enumerate(scaled_revenues):
            bar_data.append({
                "value": val,
                "itemStyle": {"color": self._gradient_color(bar_colors[i])},
            })

        option.update({
            "title": {
                "text": f"{year}年重点产品排名 (Pareto)",
                "left": "center",
                "textStyle": {"fontSize": 14, "fontWeight": "bold"},
            },
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "cross"},
                "confine": True,
            },
            "legend": {
                "data": ["收入", "累计占比"],
                "bottom": 0,
            },
            "grid": {
                "left": "3%",
                "right": "4%",
                "bottom": "12%",
                "top": "15%",
                "containLabel": True,
            },
            "xAxis": {
                "type": "category",
                "data": products,
                "axisLabel": {
                    "rotate": 30 if len(products) > 6 else 0,
                    "fontSize": 11,
                    "interval": 0,
                },
            },
            "yAxis": [
                {
                    "type": "value",
                    "name": f"金额{scale['name_suffix']}",
                    "position": "left",
                    "axisLabel": {"formatter": "{value}"},
                },
                {
                    "type": "value",
                    "name": "累计占比",
                    "position": "right",
                    "min": 0,
                    "max": 100,
                    "axisLabel": {"formatter": "{value}%"},
                    "splitLine": {"show": False},
                },
            ],
            "series": [
                {
                    "name": "收入",
                    "type": "bar",
                    "yAxisIndex": 0,
                    "data": bar_data,
                    "barWidth": "55%",
                    "label": {
                        "show": True,
                        "position": "top",
                        "fontSize": 10,
                        "formatter": "{c}",
                    },
                    "itemStyle": {
                        "borderRadius": [4, 4, 0, 0],
                    },
                },
                {
                    "name": "累计占比",
                    "type": "line",
                    "yAxisIndex": 1,
                    "data": cumulative,
                    "smooth": True,
                    "symbol": "circle",
                    "symbolSize": 6,
                    "lineStyle": {
                        "color": COLORS['accent'],
                        "width": 2,
                    },
                    "itemStyle": {"color": COLORS['accent']},
                    "label": {
                        "show": True,
                        "formatter": "{c}%",
                        "fontSize": 10,
                        "color": COLORS['accent'],
                    },
                    "markLine": {
                        "silent": True,
                        "lineStyle": {
                            "type": "dashed",
                            "color": COLORS['danger'],
                            "width": 1,
                        },
                        "data": [
                            {
                                "yAxis": 80,
                                "label": {
                                    "formatter": "80%",
                                    "position": "end",
                                    "color": COLORS['danger'],
                                },
                            }
                        ],
                    },
                },
            ],
        })

        # --- Table data ---
        table_data = {
            "headers": ["排名", "产品", f"收入{scale['name_suffix']}", "占比", "累计占比"],
            "rows": [],
        }
        for i, (prod, val, cum) in enumerate(zip(products, scaled_revenues, cumulative)):
            individual_pct = round(val / sum(scaled_revenues) * 100, 1) if sum(scaled_revenues) else 0
            table_data["rows"].append([
                str(i + 1),
                prod,
                f"{val:,.2f}",
                f"{individual_pct}%",
                f"{cum}%",
            ])

        # --- Analysis context ---
        ctx = (
            f"{year}年产品排名: 共{len(products)}个产品, "
            f"Top1 {top1_product} 贡献{round(revenues[0]/total_revenue*100, 1) if total_revenue else 0}%, "
            f"Top3 累计贡献{top3_pct}%"
        )

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": table_data,
            "analysisContext": ctx,
            "metadata": {
                "period": period,
                "dataQuality": "good",
                "productCount": len(products),
                "scale": scale['suffix'],
                "paretoTop3Pct": top3_pct,
            },
        }
        return _sanitize_for_json(result)

    def _empty_result(self, period: Dict, year: int) -> Dict:
        return {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": [],
            "echartsOption": {},
            "tableData": None,
            "analysisContext": "无产品排名数据",
            "metadata": {"period": period, "dataQuality": "insufficient"},
        }

    @staticmethod
    def _generate_gradient_colors(base_hex: str, count: int) -> List[str]:
        """Generate gradient colors from base color to lighter shades."""
        if count <= 0:
            return []

        # Parse hex
        base_hex = base_hex.lstrip('#')
        r = int(base_hex[0:2], 16)
        g = int(base_hex[2:4], 16)
        b = int(base_hex[4:6], 16)

        colors = []
        for i in range(count):
            # Lerp toward white (255, 255, 255)
            ratio = i / max(count, 1) * 0.6  # max 60% toward white
            nr = int(r + (255 - r) * ratio)
            ng = int(g + (255 - g) * ratio)
            nb = int(b + (255 - b) * ratio)
            colors.append(f"#{nr:02x}{ng:02x}{nb:02x}")

        return colors
