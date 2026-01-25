from __future__ import annotations
"""
Metric Calculator Service

Calculates 30+ business metrics including:
- Sales metrics (amount, count, average)
- Profitability metrics (margin, ROI)
- Cost metrics (ratios)
- Financial metrics (AR, collection rate)
- Budget metrics (execution rate, variance)
"""
import logging
from typing import Any, Optional, List, Dict
from enum import Enum
from decimal import Decimal, ROUND_HALF_UP

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class MetricType(str, Enum):
    """Business metric types"""
    # Sales Metrics
    SALES_AMOUNT = "sales_amount"
    ORDER_COUNT = "order_count"
    AVG_ORDER_VALUE = "avg_order_value"
    DAILY_AVG_SALES = "daily_avg_sales"
    MONTHLY_SALES = "monthly_sales"
    SALES_GROWTH_RATE = "sales_growth_rate"
    SALES_YOY = "sales_yoy"  # Year over Year
    SALES_MOM = "sales_mom"  # Month over Month

    # Target Metrics
    TARGET_COMPLETION = "target_completion"
    TARGET_VARIANCE = "target_variance"
    TARGET_GAP = "target_gap"

    # Profitability Metrics
    GROSS_PROFIT = "gross_profit"
    GROSS_MARGIN = "gross_margin"
    NET_PROFIT = "net_profit"
    NET_MARGIN = "net_margin"
    ROI = "roi"
    CONTRIBUTION_MARGIN = "contribution_margin"

    # Cost Metrics
    MATERIAL_COST_RATIO = "material_cost_ratio"
    LABOR_COST_RATIO = "labor_cost_ratio"
    OVERHEAD_COST_RATIO = "overhead_cost_ratio"
    UNIT_COST = "unit_cost"
    COST_VARIANCE = "cost_variance"

    # Financial Metrics
    AR_BALANCE = "ar_balance"
    COLLECTION_RATE = "collection_rate"
    OVERDUE_RATIO = "overdue_ratio"
    DSO = "dso"  # Days Sales Outstanding

    # Budget Metrics
    BUDGET_EXECUTION_RATE = "budget_execution_rate"
    BUDGET_VARIANCE = "budget_variance"
    BUDGET_UTILIZATION = "budget_utilization"

    # Inventory Metrics
    INVENTORY_TURNOVER = "inventory_turnover"
    STOCK_DAYS = "stock_days"

    # Customer Metrics
    CUSTOMER_COUNT = "customer_count"
    NEW_CUSTOMER_COUNT = "new_customer_count"
    REPEAT_PURCHASE_RATE = "repeat_purchase_rate"
    CUSTOMER_RETENTION_RATE = "customer_retention_rate"


class AggregationType(str, Enum):
    """Aggregation methods"""
    SUM = "sum"
    AVG = "avg"
    COUNT = "count"
    MIN = "min"
    MAX = "max"
    FIRST = "first"
    LAST = "last"


class MetricCalculator:
    """Business metrics calculation engine"""

    # Metric definitions with required fields and formulas
    METRIC_DEFINITIONS = {
        MetricType.SALES_AMOUNT: {
            "name": "销售额",
            "required_fields": ["amount"],
            "formula": "SUM(amount)",
            "unit": "元"
        },
        MetricType.ORDER_COUNT: {
            "name": "订单数",
            "required_fields": ["order_id"],
            "formula": "COUNT(DISTINCT order_id)",
            "unit": "笔"
        },
        MetricType.AVG_ORDER_VALUE: {
            "name": "客单价",
            "required_fields": ["amount", "order_id"],
            "formula": "SUM(amount) / COUNT(DISTINCT order_id)",
            "unit": "元"
        },
        MetricType.GROSS_PROFIT: {
            "name": "毛利",
            "required_fields": ["amount", "cost"],
            "formula": "SUM(amount) - SUM(cost)",
            "unit": "元"
        },
        MetricType.GROSS_MARGIN: {
            "name": "毛利率",
            "required_fields": ["amount", "cost"],
            "formula": "(SUM(amount) - SUM(cost)) / SUM(amount) * 100",
            "unit": "%"
        },
        MetricType.TARGET_COMPLETION: {
            "name": "目标完成率",
            "required_fields": ["actual", "target"],
            "formula": "SUM(actual) / SUM(target) * 100",
            "unit": "%"
        },
        MetricType.BUDGET_EXECUTION_RATE: {
            "name": "预算执行率",
            "required_fields": ["actual", "budget"],
            "formula": "SUM(actual) / SUM(budget) * 100",
            "unit": "%"
        }
    }

    def __init__(self):
        pass

    def calculate(
        self,
        data: List[dict],
        metrics: List[str],
        group_by: Optional[List[str]] = None,
        time_field: Optional[str] = None,
        field_mapping: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Calculate specified metrics from data

        Args:
            data: List of data records
            metrics: List of metric types to calculate
            group_by: Fields to group by
            time_field: Time dimension field
            field_mapping: Mapping from standard field names to actual column names

        Returns:
            Calculation results
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return {
                    "success": True,
                    "results": [],
                    "summary": {}
                }

            # Apply field mapping
            if field_mapping:
                df = df.rename(columns={v: k for k, v in field_mapping.items()})

            results = []
            summary = {}

            # Calculate each metric
            for metric in metrics:
                metric_type = MetricType(metric) if isinstance(metric, str) else metric
                result = self._calculate_metric(df, metric_type, group_by, time_field)
                results.append(result)

                # Add to summary if not grouped
                if not group_by and result.get("success"):
                    summary[metric] = result.get("value")

            return {
                "success": True,
                "results": results,
                "summary": summary,
                "groupBy": group_by,
                "timeField": time_field
            }

        except Exception as e:
            logger.error(f"Metric calculation failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "results": []
            }

    def _calculate_metric(
        self,
        df: pd.DataFrame,
        metric_type: MetricType,
        group_by: Optional[List[str]],
        time_field: Optional[str]
    ) -> dict:
        """Calculate a single metric"""
        try:
            value = None
            breakdown = None

            if metric_type == MetricType.SALES_AMOUNT:
                value, breakdown = self._calc_sales_amount(df, group_by, time_field)

            elif metric_type == MetricType.ORDER_COUNT:
                value, breakdown = self._calc_order_count(df, group_by, time_field)

            elif metric_type == MetricType.AVG_ORDER_VALUE:
                value, breakdown = self._calc_avg_order_value(df, group_by, time_field)

            elif metric_type == MetricType.DAILY_AVG_SALES:
                value, breakdown = self._calc_daily_avg_sales(df, group_by, time_field)

            elif metric_type == MetricType.GROSS_PROFIT:
                value, breakdown = self._calc_gross_profit(df, group_by, time_field)

            elif metric_type == MetricType.GROSS_MARGIN:
                value, breakdown = self._calc_gross_margin(df, group_by, time_field)

            elif metric_type == MetricType.NET_PROFIT:
                value, breakdown = self._calc_net_profit(df, group_by, time_field)

            elif metric_type == MetricType.NET_MARGIN:
                value, breakdown = self._calc_net_margin(df, group_by, time_field)

            elif metric_type == MetricType.TARGET_COMPLETION:
                value, breakdown = self._calc_target_completion(df, group_by, time_field)

            elif metric_type == MetricType.BUDGET_EXECUTION_RATE:
                value, breakdown = self._calc_budget_execution(df, group_by, time_field)

            elif metric_type == MetricType.BUDGET_VARIANCE:
                value, breakdown = self._calc_budget_variance(df, group_by, time_field)

            elif metric_type == MetricType.SALES_YOY:
                value, breakdown = self._calc_sales_yoy(df, time_field)

            elif metric_type == MetricType.SALES_MOM:
                value, breakdown = self._calc_sales_mom(df, time_field)

            elif metric_type == MetricType.MATERIAL_COST_RATIO:
                value, breakdown = self._calc_material_cost_ratio(df, group_by, time_field)

            elif metric_type == MetricType.LABOR_COST_RATIO:
                value, breakdown = self._calc_labor_cost_ratio(df, group_by, time_field)

            elif metric_type == MetricType.UNIT_COST:
                value, breakdown = self._calc_unit_cost(df, group_by, time_field)

            elif metric_type == MetricType.ROI:
                value, breakdown = self._calc_roi(df, group_by, time_field)

            elif metric_type == MetricType.COLLECTION_RATE:
                value, breakdown = self._calc_collection_rate(df, group_by, time_field)

            elif metric_type == MetricType.OVERDUE_RATIO:
                value, breakdown = self._calc_overdue_ratio(df, group_by, time_field)

            else:
                return {
                    "success": False,
                    "metric": metric_type.value,
                    "error": f"Metric {metric_type.value} not implemented"
                }

            definition = self.METRIC_DEFINITIONS.get(metric_type, {})

            return {
                "success": True,
                "metric": metric_type.value,
                "name": definition.get("name", metric_type.value),
                "value": self._round_value(value),
                "unit": definition.get("unit", ""),
                "breakdown": breakdown
            }

        except Exception as e:
            logger.error(f"Failed to calculate {metric_type}: {e}")
            return {
                "success": False,
                "metric": metric_type.value,
                "error": str(e)
            }

    def _calc_sales_amount(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate total sales amount"""
        amount_col = self._find_column(df, ["amount", "sales", "revenue", "金额", "销售额"])
        if not amount_col:
            return None, None

        if group_by:
            grouped = df.groupby(group_by)[amount_col].sum()
            return float(df[amount_col].sum()), grouped.to_dict()

        return float(df[amount_col].sum()), None

    def _calc_order_count(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate order count"""
        order_col = self._find_column(df, ["order_id", "order_no", "订单号", "订单ID"])
        if order_col:
            if group_by:
                grouped = df.groupby(group_by)[order_col].nunique()
                return int(df[order_col].nunique()), grouped.to_dict()
            return int(df[order_col].nunique()), None
        else:
            # Fallback to row count
            if group_by:
                grouped = df.groupby(group_by).size()
                return len(df), grouped.to_dict()
            return len(df), None

    def _calc_avg_order_value(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate average order value"""
        amount_col = self._find_column(df, ["amount", "sales", "revenue", "金额", "销售额"])
        order_col = self._find_column(df, ["order_id", "order_no", "订单号", "订单ID"])

        if not amount_col:
            return None, None

        total_amount = df[amount_col].sum()
        order_count = df[order_col].nunique() if order_col else len(df)

        if order_count == 0:
            return 0, None

        return float(total_amount / order_count), None

    def _calc_daily_avg_sales(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate daily average sales"""
        amount_col = self._find_column(df, ["amount", "sales", "revenue", "金额", "销售额"])
        date_col = time_field or self._find_column(df, ["date", "time", "日期", "时间"])

        if not amount_col or not date_col:
            return None, None

        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
        days = df[date_col].nunique()

        if days == 0:
            return 0, None

        return float(df[amount_col].sum() / days), None

    def _calc_gross_profit(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate gross profit"""
        amount_col = self._find_column(df, ["amount", "sales", "revenue", "金额", "销售额"])
        cost_col = self._find_column(df, ["cost", "cogs", "成本"])

        if not amount_col or not cost_col:
            return None, None

        profit = df[amount_col].sum() - df[cost_col].sum()

        if group_by:
            grouped_revenue = df.groupby(group_by)[amount_col].sum()
            grouped_cost = df.groupby(group_by)[cost_col].sum()
            breakdown = (grouped_revenue - grouped_cost).to_dict()
            return float(profit), breakdown

        return float(profit), None

    def _calc_gross_margin(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate gross margin percentage"""
        amount_col = self._find_column(df, ["amount", "sales", "revenue", "金额", "销售额"])
        cost_col = self._find_column(df, ["cost", "cogs", "成本"])

        if not amount_col or not cost_col:
            return None, None

        revenue = df[amount_col].sum()
        if revenue == 0:
            return 0, None

        margin = (revenue - df[cost_col].sum()) / revenue * 100
        return float(margin), None

    def _calc_net_profit(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate net profit"""
        amount_col = self._find_column(df, ["amount", "sales", "revenue", "金额", "销售额"])
        cost_col = self._find_column(df, ["cost", "total_cost", "成本", "总成本"])
        expense_col = self._find_column(df, ["expense", "费用", "支出"])

        if not amount_col:
            return None, None

        revenue = df[amount_col].sum()
        cost = df[cost_col].sum() if cost_col else 0
        expense = df[expense_col].sum() if expense_col else 0

        return float(revenue - cost - expense), None

    def _calc_net_margin(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate net margin percentage"""
        amount_col = self._find_column(df, ["amount", "sales", "revenue", "金额", "销售额"])

        if not amount_col:
            return None, None

        revenue = df[amount_col].sum()
        if revenue == 0:
            return 0, None

        net_profit, _ = self._calc_net_profit(df, group_by, time_field)
        if net_profit is None:
            return None, None

        return float(net_profit / revenue * 100), None

    def _calc_target_completion(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate target completion rate"""
        actual_col = self._find_column(df, ["actual", "实际", "完成"])
        target_col = self._find_column(df, ["target", "目标", "计划"])

        if not actual_col or not target_col:
            return None, None

        target_sum = df[target_col].sum()
        if target_sum == 0:
            return 0, None

        completion = df[actual_col].sum() / target_sum * 100

        if group_by:
            grouped_actual = df.groupby(group_by)[actual_col].sum()
            grouped_target = df.groupby(group_by)[target_col].sum()
            breakdown = ((grouped_actual / grouped_target) * 100).to_dict()
            return float(completion), breakdown

        return float(completion), None

    def _calc_budget_execution(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate budget execution rate"""
        actual_col = self._find_column(df, ["actual", "实际", "执行"])
        budget_col = self._find_column(df, ["budget", "预算", "计划"])

        if not actual_col or not budget_col:
            return None, None

        budget_sum = df[budget_col].sum()
        if budget_sum == 0:
            return 0, None

        return float(df[actual_col].sum() / budget_sum * 100), None

    def _calc_budget_variance(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate budget variance"""
        actual_col = self._find_column(df, ["actual", "实际", "执行"])
        budget_col = self._find_column(df, ["budget", "预算", "计划"])

        if not actual_col or not budget_col:
            return None, None

        variance = df[actual_col].sum() - df[budget_col].sum()
        return float(variance), None

    def _calc_sales_yoy(self, df: pd.DataFrame, time_field: Optional[str]):
        """Calculate year-over-year sales growth"""
        amount_col = self._find_column(df, ["amount", "sales", "revenue", "金额", "销售额"])
        date_col = time_field or self._find_column(df, ["date", "time", "日期", "时间"])

        if not amount_col or not date_col:
            return None, None

        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
        df['year'] = df[date_col].dt.year

        yearly = df.groupby('year')[amount_col].sum()
        if len(yearly) < 2:
            return None, None

        current = yearly.iloc[-1]
        previous = yearly.iloc[-2]

        if previous == 0:
            return None, None

        yoy = (current - previous) / previous * 100
        return float(yoy), {"current": float(current), "previous": float(previous)}

    def _calc_sales_mom(self, df: pd.DataFrame, time_field: Optional[str]):
        """Calculate month-over-month sales growth"""
        amount_col = self._find_column(df, ["amount", "sales", "revenue", "金额", "销售额"])
        date_col = time_field or self._find_column(df, ["date", "time", "日期", "时间"])

        if not amount_col or not date_col:
            return None, None

        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
        df['month'] = df[date_col].dt.to_period('M')

        monthly = df.groupby('month')[amount_col].sum()
        if len(monthly) < 2:
            return None, None

        current = monthly.iloc[-1]
        previous = monthly.iloc[-2]

        if previous == 0:
            return None, None

        mom = (current - previous) / previous * 100
        return float(mom), {"current": float(current), "previous": float(previous)}

    def _calc_material_cost_ratio(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate material cost ratio"""
        material_col = self._find_column(df, ["material_cost", "材料成本", "原材料"])
        total_col = self._find_column(df, ["total_cost", "cost", "总成本", "成本"])

        if not material_col or not total_col:
            return None, None

        total = df[total_col].sum()
        if total == 0:
            return 0, None

        return float(df[material_col].sum() / total * 100), None

    def _calc_labor_cost_ratio(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate labor cost ratio"""
        labor_col = self._find_column(df, ["labor_cost", "人工成本", "工资"])
        total_col = self._find_column(df, ["total_cost", "cost", "总成本", "成本"])

        if not labor_col or not total_col:
            return None, None

        total = df[total_col].sum()
        if total == 0:
            return 0, None

        return float(df[labor_col].sum() / total * 100), None

    def _calc_unit_cost(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate unit cost"""
        cost_col = self._find_column(df, ["cost", "total_cost", "成本", "总成本"])
        qty_col = self._find_column(df, ["quantity", "qty", "数量", "件数"])

        if not cost_col or not qty_col:
            return None, None

        qty = df[qty_col].sum()
        if qty == 0:
            return 0, None

        return float(df[cost_col].sum() / qty), None

    def _calc_roi(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate ROI"""
        profit, _ = self._calc_gross_profit(df, None, None)
        cost_col = self._find_column(df, ["cost", "investment", "成本", "投入"])

        if profit is None or not cost_col:
            return None, None

        investment = df[cost_col].sum()
        if investment == 0:
            return 0, None

        return float(profit / investment * 100), None

    def _calc_collection_rate(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate collection rate"""
        collected_col = self._find_column(df, ["collected", "回款", "已收"])
        total_col = self._find_column(df, ["total", "应收", "总额"])

        if not collected_col or not total_col:
            return None, None

        total = df[total_col].sum()
        if total == 0:
            return 0, None

        return float(df[collected_col].sum() / total * 100), None

    def _calc_overdue_ratio(self, df: pd.DataFrame, group_by: Optional[list], time_field: Optional[str]):
        """Calculate overdue ratio"""
        overdue_col = self._find_column(df, ["overdue", "逾期", "过期"])
        total_col = self._find_column(df, ["total", "应收", "总额"])

        if not overdue_col or not total_col:
            return None, None

        total = df[total_col].sum()
        if total == 0:
            return 0, None

        return float(df[overdue_col].sum() / total * 100), None

    def _find_column(self, df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
        """Find a column from candidate names"""
        for col in df.columns:
            col_lower = col.lower()
            for candidate in candidates:
                if candidate.lower() in col_lower or col_lower in candidate.lower():
                    return col
        return None

    def _round_value(self, value: Optional[float], decimals: int = 2) -> Optional[float]:
        """Round value to specified decimals"""
        if value is None:
            return None
        return round(float(value), decimals)

    def get_available_metrics(self) -> List[dict]:
        """Get list of all available metrics"""
        return [
            {
                "id": metric.value,
                "name": self.METRIC_DEFINITIONS.get(metric, {}).get("name", metric.value),
                "unit": self.METRIC_DEFINITIONS.get(metric, {}).get("unit", ""),
                "formula": self.METRIC_DEFINITIONS.get(metric, {}).get("formula", ""),
                "required_fields": self.METRIC_DEFINITIONS.get(metric, {}).get("required_fields", [])
            }
            for metric in MetricType
        ]
