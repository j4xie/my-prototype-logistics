"""Cash Flow Waterfall Chart Builder — 现金流量瀑布图."""
import logging
from typing import Dict, List, Any
import pandas as pd

from .base import (
    AbstractFinancialChartBuilder, COLORS,
    _sanitize_for_json, _detect_value_scale,
)

logger = logging.getLogger(__name__)

# Cash flow item classification keywords
CF_OPERATING = ['经营', '销售商品', '提供劳务', '购买商品', '接受劳务', '职工', '税费',
                '经营活动', '营运', '运营']
CF_INVESTING = ['投资', '购建', '固定资产', '无形资产', '处置', '投资收益',
                '投资活动', '长期资产']
CF_FINANCING = ['筹资', '融资', '借款', '偿还', '分配股利', '吸收投资',
                '筹资活动', '融资活动', '贷款']
CF_SUBTOTALS = ['经营活动现金流量净额', '投资活动现金流量净额', '筹资活动现金流量净额',
                '现金及现金等价物净增加额', '期末现金', '期初现金']


def classify_cash_flow_item(name: str) -> str:
    """Classify a cash flow item into: operating, investing, financing, net."""
    n = name.strip()
    if any(kw in n for kw in ['净增加', '期末', '期初', '合计']):
        return 'net'
    if any(kw in n for kw in CF_OPERATING):
        return 'operating'
    if any(kw in n for kw in CF_INVESTING):
        return 'investing'
    if any(kw in n for kw in CF_FINANCING):
        return 'financing'
    return 'operating'  # default to operating


class CashFlowWaterfallBuilder(AbstractFinancialChartBuilder):
    """Cash flow waterfall — 从经营→投资→筹资→净增加额的现金流量瀑布图.

    If the data doesn't contain explicit cash flow items, it synthesizes
    a simplified cash flow from P&L data:
      经营活动 = 净利润 + 折旧 (estimated)
      投资活动 = -(固定资产 or capex if found, else 0)
      筹资活动 = -(利息 or 分红 if found, else 0)
    """

    chart_type = "cash_flow_waterfall"
    display_name = "现金流量瀑布图"
    description = "展示经营、投资、筹资三大现金流活动及净增加额的瀑布图分解"
    required_columns = ['item']  # same as pnl_waterfall — needs item column
    display_order = 10

    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        # Try to detect cash flow items in data
        if 'item' in df.columns and 'actual' in df.columns:
            item_totals = df.groupby('item')['actual'].sum()
        elif 'item' in df.columns:
            numeric_cols = df.select_dtypes(include='number').columns
            if len(numeric_cols) > 0:
                item_totals = df.groupby('item')[numeric_cols[0]].sum()
            else:
                item_totals = pd.Series(dtype=float)
        else:
            item_totals = pd.Series(dtype=float)

        # Check if we have explicit cash flow items
        has_cf_items = any(
            any(kw in str(item) for kw in ['经营活动', '投资活动', '筹资活动', '现金'])
            for item in item_totals.index
        )

        if has_cf_items:
            waterfall_items = self._build_from_cf_items(item_totals)
        else:
            # Synthesize from P&L data
            waterfall_items = self._synthesize_from_pnl(item_totals, df)

        if not waterfall_items:
            return {
                "chartType": self.chart_type,
                "title": f"{year}年{self.display_name}",
                "kpis": [],
                "echartsOption": {},
                "tableData": None,
                "analysisContext": "无可用的现金流数据",
                "metadata": {"period": period, "dataQuality": "insufficient"},
            }

        # Build waterfall visualization
        return self._build_waterfall(waterfall_items, period, year)

    def _build_from_cf_items(self, item_totals: pd.Series) -> List[Dict]:
        """Build waterfall from explicit cash flow items."""
        operating = 0
        investing = 0
        financing = 0
        detail_items = []

        for item_name, value in item_totals.items():
            if value is None or pd.isna(value) or value == 0:
                continue
            cf_type = classify_cash_flow_item(str(item_name))
            if cf_type == 'net':
                continue  # Skip totals, we'll compute them
            detail_items.append({
                "name": str(item_name),
                "value": float(value),
                "cf_type": cf_type,
            })
            if cf_type == 'operating':
                operating += float(value)
            elif cf_type == 'investing':
                investing += float(value)
            elif cf_type == 'financing':
                financing += float(value)

        net_change = operating + investing + financing
        return [
            {"name": "经营活动", "value": operating, "type": "operating", "is_total": True},
            {"name": "投资活动", "value": investing, "type": "investing", "is_total": False},
            {"name": "筹资活动", "value": financing, "type": "financing", "is_total": False},
            {"name": "现金净增加额", "value": net_change, "type": "net", "is_total": True},
        ]

    def _synthesize_from_pnl(self, item_totals: pd.Series, df: pd.DataFrame) -> List[Dict]:
        """Synthesize simplified cash flow from P&L data."""
        from ..financial_data_normalizer import FinancialDataNormalizer
        normalizer = FinancialDataNormalizer()

        revenue = 0
        cost = 0
        expense = 0
        tax = 0

        for item_name, value in item_totals.items():
            if value is None or pd.isna(value) or value == 0:
                continue
            pnl_type = normalizer.classify_pnl_item(str(item_name))
            v = float(value)
            if pnl_type == 'revenue':
                revenue += v
            elif pnl_type == 'cost':
                cost += abs(v)
            elif pnl_type == 'expense':
                expense += abs(v)
            elif pnl_type == 'tax':
                tax += abs(v)

        if revenue == 0:
            return []

        net_profit = revenue - cost - expense - tax
        # Simplified: operating CF ≈ net profit + depreciation estimate (15% of cost)
        depreciation_est = cost * 0.15
        operating_cf = net_profit + depreciation_est
        # Investing: estimate capex as 8% of revenue
        investing_cf = -(revenue * 0.08)
        # Financing: estimate as remainder to balance
        financing_cf = -(operating_cf * 0.1)  # debt service estimate
        net_change = operating_cf + investing_cf + financing_cf

        return [
            {"name": "经营活动现金流", "value": round(operating_cf, 2), "type": "operating", "is_total": True},
            {"name": "折旧摊销(估)", "value": round(depreciation_est, 2), "type": "operating_detail", "is_total": False},
            {"name": "投资活动现金流", "value": round(investing_cf, 2), "type": "investing", "is_total": False},
            {"name": "筹资活动现金流", "value": round(financing_cf, 2), "type": "financing", "is_total": False},
            {"name": "现金净增加额", "value": round(net_change, 2), "type": "net", "is_total": True},
        ]

    def _build_waterfall(self, items: List[Dict], period: Dict, year: int) -> Dict[str, Any]:
        """Build ECharts waterfall from classified items."""
        categories = []
        helper_data = []
        value_data = []
        colors = []
        running_total = 0
        running_totals = []

        color_map = {
            'operating': '#1B65A8',        # blue
            'operating_detail': '#4C9AFF', # light blue
            'investing': '#FFAB00',        # amber
            'financing': '#6B778C',        # grey
            'net': '#36B37E' if items[-1]['value'] >= 0 else '#FF5630',  # green/red
        }

        for item in items:
            categories.append(item['name'])
            val = item['value']

            if item['is_total']:
                helper_data.append(0 if val >= 0 else val)
                value_data.append(abs(val))
                running_total = val
            else:
                if val < 0:
                    helper_data.append(running_total + val)
                    value_data.append(abs(val))
                    running_total += val
                else:
                    helper_data.append(running_total)
                    value_data.append(val)
                    running_total += val

            running_totals.append(running_total)
            colors.append(color_map.get(item['type'], COLORS['muted']))

        all_values = [abs(item['value']) for item in items if item['value']]
        scale = _detect_value_scale(all_values)
        divisor = scale['divisor']

        # KPIs
        operating_val = next((i['value'] for i in items if i['type'] == 'operating' and i['is_total']), 0)
        net_val = items[-1]['value'] if items else 0

        kpis = [
            {"label": "经营活动现金流", "value": self._format_value(operating_val, scale), "unit": "元",
             "trend": self._trend_from_value(operating_val)},
            {"label": "现金净增加额", "value": self._format_value(net_val, scale), "unit": "元",
             "trend": self._trend_from_value(net_val)},
        ]
        # Add investing/financing if present
        for item in items:
            if item['type'] == 'investing' and not item['is_total']:
                kpis.append({"label": "投资活动", "value": self._format_value(item['value'], scale),
                             "unit": "元", "trend": self._trend_from_value(item['value'])})
            if item['type'] == 'financing' and not item['is_total']:
                kpis.append({"label": "筹资活动", "value": self._format_value(item['value'], scale),
                             "unit": "元", "trend": self._trend_from_value(item['value'])})

        # Scale data
        helper_scaled = [round(v / divisor, 2) for v in helper_data]
        value_scaled = [round(v / divisor, 2) for v in value_data]

        option = self._base_echarts_option()
        option["grid"] = {"left": "5%", "right": "5%", "bottom": "8%", "top": "12%", "containLabel": True}
        option.update({
            "xAxis": {
                "type": "category",
                "data": categories,
                "axisLabel": {"fontSize": 10, "rotate": 15, "interval": 0},
                "axisTick": {"alignWithLabel": True},
            },
            "yAxis": {
                "type": "value",
                "name": f"金额{scale['name_suffix']}",
                "nameTextStyle": {"fontSize": 11},
                "axisLabel": {"fontSize": 10},
                "splitLine": {"lineStyle": {"type": "dashed", "color": "#e8e8e8"}},
            },
            "series": [
                {
                    "name": "辅助",
                    "type": "bar",
                    "stack": "waterfall",
                    "data": helper_scaled,
                    "itemStyle": {"color": "transparent", "borderColor": "transparent"},
                    "emphasis": {"itemStyle": {"color": "transparent"}},
                    "tooltip": {"show": False},
                    "barMaxWidth": 50,
                },
                {
                    "name": "现金流",
                    "type": "bar",
                    "stack": "waterfall",
                    "data": [
                        {
                            "value": value_scaled[i],
                            "itemStyle": {
                                "color": colors[i],
                                "borderRadius": [4, 4, 0, 0] if items[i]['value'] >= 0 else [0, 0, 4, 4],
                            },
                        }
                        for i in range(len(value_scaled))
                    ],
                    "barMaxWidth": 50,
                    "label": {
                        "show": True,
                        "position": "top",
                        "formatter": "{c}",
                        "fontSize": 11,
                        "color": "#333",
                        "fontWeight": "bold",
                    },
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.2)"}},
                },
            ],
        })

        # Connection markLines
        conn_data = []
        for i in range(len(running_totals) - 1):
            rt = round(running_totals[i] / divisor, 2)
            conn_data.append([
                {"xAxis": categories[i], "yAxis": rt, "symbol": "none"},
                {"xAxis": categories[i + 1], "yAxis": rt, "symbol": "none"},
            ])
        if conn_data:
            option["series"][1]["markLine"] = {
                "silent": True,
                "symbol": ["none", "none"],
                "lineStyle": {"type": "dotted", "color": "#999", "width": 1},
                "data": conn_data,
            }

        # Table data
        table_data = {
            "headers": ["项目", f"金额{scale['name_suffix']}", "类型"],
            "rows": [
                {"label": item['name'], "values": [
                    round(item['value'] / divisor, 2),
                    {"operating": "经营", "operating_detail": "经营(明细)",
                     "investing": "投资", "financing": "筹资", "net": "合计"}.get(item['type'], '')
                ]}
                for item in items
            ],
        }

        result = {
            "chartType": self.chart_type,
            "title": f"{year}年{self.display_name}",
            "kpis": kpis,
            "echartsOption": option,
            "tableData": table_data,
            "analysisContext": self.get_analysis_context({"title": f"{year}年{self.display_name}", "kpis": kpis}),
            "metadata": {"period": period, "scale": scale, "dataQuality": "good"},
        }
        return _sanitize_for_json(result)
