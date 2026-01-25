from __future__ import annotations
"""
Finance Analysis Service

Provides comprehensive financial analysis including:
- Profit trend analysis (monthly/quarterly)
- Cost structure breakdown
- Budget waterfall visualization
- Budget vs Actual comparison
- Year-over-Year and Month-over-Month comparison
- Category comparison between years
- Financial overview KPIs
"""
import logging
from typing import Any, Optional, List, Dict, Tuple
from datetime import datetime
from enum import Enum

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class PeriodType(str, Enum):
    """Period types for time-based analysis"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class FinanceAnalysisService:
    """
    Financial analysis service for SmartBI

    Provides methods for analyzing financial data including profit trends,
    cost structures, budget comparisons, and YoY/MoM analysis.
    """

    def __init__(self):
        """Initialize the finance analysis service"""
        pass

    def get_profit_trend(
        self,
        data: List[dict],
        period_type: str = 'monthly'
    ) -> dict:
        """
        Calculate profit trend over time

        Args:
            data: List of data records with revenue, cost, and date fields
            period_type: Aggregation period ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')

        Returns:
            Dict with success status and profit trend data
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return {
                    "success": True,
                    "data": {
                        "periods": [],
                        "revenue": [],
                        "cost": [],
                        "profit": [],
                        "profitMargin": []
                    }
                }

            # Find relevant columns
            date_col = self._find_column(df, ["date", "time", "period", "日期", "时间", "月份", "年月"])
            revenue_col = self._find_column(df, ["revenue", "sales", "amount", "收入", "销售额", "金额", "销售收入"])
            cost_col = self._find_column(df, ["cost", "expense", "total_cost", "成本", "费用", "支出", "总成本"])

            if not date_col:
                logger.warning("No date column found for profit trend analysis")
                return {"success": False, "error": "No date column found", "data": None}

            if not revenue_col:
                logger.warning("No revenue column found for profit trend analysis")
                return {"success": False, "error": "No revenue column found", "data": None}

            # Convert date column
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])

            # Create period column based on period_type
            df['period'] = self._create_period_column(df, date_col, period_type)

            # Calculate metrics by period
            revenue = df.groupby('period')[revenue_col].sum()

            if cost_col:
                cost = df.groupby('period')[cost_col].sum()
                profit = revenue - cost
            else:
                # Try to find profit directly
                profit_col = self._find_column(df, ["profit", "利润", "毛利", "净利润"])
                if profit_col:
                    profit = df.groupby('period')[profit_col].sum()
                    cost = revenue - profit
                else:
                    cost = pd.Series(0, index=revenue.index)
                    profit = revenue

            # Calculate profit margin
            profit_margin = (profit / revenue * 100).replace([np.inf, -np.inf], 0).fillna(0)

            # Sort by period
            periods = sorted(revenue.index.tolist())

            return {
                "success": True,
                "data": {
                    "periods": [str(p) for p in periods],
                    "revenue": [round(float(revenue.get(p, 0)), 2) for p in periods],
                    "cost": [round(float(cost.get(p, 0)), 2) for p in periods],
                    "profit": [round(float(profit.get(p, 0)), 2) for p in periods],
                    "profitMargin": [round(float(profit_margin.get(p, 0)), 2) for p in periods],
                    "periodType": period_type,
                    "summary": {
                        "totalRevenue": round(float(revenue.sum()), 2),
                        "totalCost": round(float(cost.sum()), 2),
                        "totalProfit": round(float(profit.sum()), 2),
                        "avgProfitMargin": round(float(profit_margin.mean()), 2)
                    }
                }
            }

        except Exception as e:
            logger.error(f"Failed to calculate profit trend: {e}", exc_info=True)
            return {"success": False, "error": str(e), "data": None}

    def get_cost_structure(self, data: List[dict]) -> dict:
        """
        Analyze cost structure breakdown by category

        Args:
            data: List of data records with cost category information

        Returns:
            Dict with success status and cost structure data
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return {
                    "success": True,
                    "data": {
                        "categories": [],
                        "values": [],
                        "percentages": [],
                        "total": 0
                    }
                }

            # Find category and cost columns
            category_col = self._find_column(df, [
                "category", "cost_type", "type", "name",
                "类别", "成本类别", "费用类型", "名称", "项目"
            ])
            cost_col = self._find_column(df, [
                "cost", "amount", "value", "expense",
                "成本", "金额", "费用", "支出"
            ])

            if not cost_col:
                logger.warning("No cost column found for cost structure analysis")
                return {"success": False, "error": "No cost column found", "data": None}

            # If no category column, try to detect structure from multiple cost columns
            if not category_col:
                cost_columns = self._find_cost_breakdown_columns(df)
                if cost_columns:
                    categories = []
                    values = []
                    for col in cost_columns:
                        categories.append(col)
                        values.append(float(df[col].sum()))

                    total = sum(values)
                    percentages = [round(v / total * 100, 2) if total > 0 else 0 for v in values]

                    return {
                        "success": True,
                        "data": {
                            "categories": categories,
                            "values": [round(v, 2) for v in values],
                            "percentages": percentages,
                            "total": round(total, 2)
                        }
                    }
                else:
                    return {"success": False, "error": "No category column found", "data": None}

            # Group by category
            grouped = df.groupby(category_col)[cost_col].sum()
            total = grouped.sum()

            # Sort by value descending
            grouped = grouped.sort_values(ascending=False)

            categories = grouped.index.tolist()
            values = grouped.values.tolist()
            percentages = [(v / total * 100) if total > 0 else 0 for v in values]

            return {
                "success": True,
                "data": {
                    "categories": categories,
                    "values": [round(float(v), 2) for v in values],
                    "percentages": [round(float(p), 2) for p in percentages],
                    "total": round(float(total), 2)
                }
            }

        except Exception as e:
            logger.error(f"Failed to analyze cost structure: {e}", exc_info=True)
            return {"success": False, "error": str(e), "data": None}

    def get_budget_waterfall(self, data: List[dict]) -> dict:
        """
        Generate waterfall chart data for budget analysis

        Args:
            data: List of data records with budget and actual values

        Returns:
            Dict with waterfall chart data (budget, increases, decreases, actual)
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return {
                    "success": True,
                    "data": {
                        "categories": [],
                        "values": [],
                        "types": [],
                        "running_total": []
                    }
                }

            # Find relevant columns
            category_col = self._find_column(df, [
                "category", "item", "name", "type",
                "类别", "项目", "名称", "科目"
            ])
            budget_col = self._find_column(df, ["budget", "planned", "预算", "计划"])
            actual_col = self._find_column(df, ["actual", "realized", "实际", "执行"])

            # Try alternative: variance-based waterfall
            variance_col = self._find_column(df, ["variance", "difference", "delta", "差异", "偏差"])

            categories = []
            values = []
            types = []  # 'start', 'increase', 'decrease', 'end'

            if budget_col and actual_col:
                total_budget = float(df[budget_col].sum())
                total_actual = float(df[actual_col].sum())

                # Start with budget
                categories.append("预算")
                values.append(total_budget)
                types.append("start")

                # Calculate variance by category if available
                if category_col:
                    df['variance'] = df[actual_col] - df[budget_col]
                    grouped = df.groupby(category_col)['variance'].sum()

                    for cat, var in grouped.items():
                        if abs(var) > 0.01:  # Skip negligible values
                            categories.append(str(cat))
                            values.append(round(float(var), 2))
                            types.append("increase" if var > 0 else "decrease")
                else:
                    # Single variance
                    variance = total_actual - total_budget
                    if abs(variance) > 0.01:
                        categories.append("差异")
                        values.append(round(variance, 2))
                        types.append("increase" if variance > 0 else "decrease")

                # End with actual
                categories.append("实际")
                values.append(round(total_actual, 2))
                types.append("end")

            elif variance_col and category_col:
                # Variance-based waterfall
                grouped = df.groupby(category_col)[variance_col].sum()
                start_value = 0

                for cat, var in grouped.items():
                    categories.append(str(cat))
                    values.append(round(float(var), 2))
                    types.append("increase" if var > 0 else "decrease")

            else:
                return {
                    "success": False,
                    "error": "Missing required columns (budget/actual or variance)",
                    "data": None
                }

            # Calculate running total
            running_total = []
            current = 0
            for i, (val, typ) in enumerate(zip(values, types)):
                if typ == "start":
                    current = val
                elif typ == "end":
                    current = val
                else:
                    current += val
                running_total.append(round(current, 2))

            return {
                "success": True,
                "data": {
                    "categories": categories,
                    "values": values,
                    "types": types,
                    "running_total": running_total
                }
            }

        except Exception as e:
            logger.error(f"Failed to generate budget waterfall: {e}", exc_info=True)
            return {"success": False, "error": str(e), "data": None}

    def get_budget_vs_actual(self, data: List[dict]) -> dict:
        """
        Compare budget vs actual values by category

        Args:
            data: List of data records with budget and actual values

        Returns:
            Dict with budget vs actual comparison data
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return {
                    "success": True,
                    "data": {
                        "categories": [],
                        "budget": [],
                        "actual": [],
                        "variance": [],
                        "completionRate": []
                    }
                }

            # Find relevant columns
            category_col = self._find_column(df, [
                "category", "item", "name", "department", "type",
                "类别", "项目", "名称", "部门", "科目"
            ])
            budget_col = self._find_column(df, ["budget", "planned", "target", "预算", "计划", "目标"])
            actual_col = self._find_column(df, ["actual", "realized", "completed", "实际", "执行", "完成"])

            if not budget_col or not actual_col:
                return {
                    "success": False,
                    "error": "Missing budget or actual column",
                    "data": None
                }

            if category_col:
                grouped = df.groupby(category_col).agg({
                    budget_col: 'sum',
                    actual_col: 'sum'
                })

                categories = grouped.index.tolist()
                budget = grouped[budget_col].tolist()
                actual = grouped[actual_col].tolist()
            else:
                categories = ["总计"]
                budget = [float(df[budget_col].sum())]
                actual = [float(df[actual_col].sum())]

            # Calculate variance and completion rate
            variance = [round(a - b, 2) for a, b in zip(actual, budget)]
            completion_rate = [
                round(a / b * 100, 2) if b > 0 else 0
                for a, b in zip(actual, budget)
            ]

            # Summary statistics
            total_budget = sum(budget)
            total_actual = sum(actual)

            return {
                "success": True,
                "data": {
                    "categories": categories,
                    "budget": [round(float(b), 2) for b in budget],
                    "actual": [round(float(a), 2) for a in actual],
                    "variance": variance,
                    "completionRate": completion_rate,
                    "summary": {
                        "totalBudget": round(total_budget, 2),
                        "totalActual": round(total_actual, 2),
                        "totalVariance": round(total_actual - total_budget, 2),
                        "overallCompletionRate": round(
                            total_actual / total_budget * 100 if total_budget > 0 else 0, 2
                        )
                    }
                }
            }

        except Exception as e:
            logger.error(f"Failed to compare budget vs actual: {e}", exc_info=True)
            return {"success": False, "error": str(e), "data": None}

    def get_yoy_mom_comparison(
        self,
        data: List[dict],
        period_type: str = 'monthly'
    ) -> dict:
        """
        Calculate Year-over-Year and Month-over-Month comparisons

        Args:
            data: List of data records with date and value fields
            period_type: Period type for aggregation ('monthly', 'quarterly')

        Returns:
            Dict with YoY and MoM comparison data
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return {
                    "success": True,
                    "data": {
                        "periods": [],
                        "current": [],
                        "previous": [],
                        "yoyChange": [],
                        "yoyPercent": [],
                        "momChange": [],
                        "momPercent": []
                    }
                }

            # Find relevant columns
            date_col = self._find_column(df, ["date", "time", "period", "日期", "时间", "月份", "年月"])
            value_col = self._find_column(df, [
                "value", "amount", "revenue", "sales", "profit",
                "金额", "数值", "收入", "销售额", "利润"
            ])

            if not date_col or not value_col:
                return {
                    "success": False,
                    "error": "Missing date or value column",
                    "data": None
                }

            # Convert date
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])

            # Create year and month columns
            df['year'] = df[date_col].dt.year
            df['month'] = df[date_col].dt.month

            if period_type == 'quarterly':
                df['quarter'] = df[date_col].dt.quarter
                df['period_key'] = df['year'].astype(str) + '-Q' + df['quarter'].astype(str)
                df['period_in_year'] = df['quarter']
            else:  # monthly
                df['period_key'] = df[date_col].dt.to_period('M').astype(str)
                df['period_in_year'] = df['month']

            # Aggregate by period
            period_data = df.groupby(['year', 'period_in_year', 'period_key'])[value_col].sum().reset_index()
            period_data = period_data.sort_values(['year', 'period_in_year'])

            # Calculate YoY and MoM
            results = []
            unique_periods = period_data['period_key'].unique()

            for period_key in unique_periods:
                current_row = period_data[period_data['period_key'] == period_key].iloc[0]
                current_value = float(current_row[value_col])
                current_year = current_row['year']
                period_in_year = current_row['period_in_year']

                # Find previous year same period for YoY
                prev_year_data = period_data[
                    (period_data['year'] == current_year - 1) &
                    (period_data['period_in_year'] == period_in_year)
                ]

                if not prev_year_data.empty:
                    prev_year_value = float(prev_year_data.iloc[0][value_col])
                    yoy_change = current_value - prev_year_value
                    yoy_percent = (yoy_change / prev_year_value * 100) if prev_year_value != 0 else 0
                else:
                    prev_year_value = None
                    yoy_change = None
                    yoy_percent = None

                # Find previous period for MoM
                period_idx = list(unique_periods).index(period_key)
                if period_idx > 0:
                    prev_period_key = unique_periods[period_idx - 1]
                    prev_period_data = period_data[period_data['period_key'] == prev_period_key]
                    if not prev_period_data.empty:
                        prev_period_value = float(prev_period_data.iloc[0][value_col])
                        mom_change = current_value - prev_period_value
                        mom_percent = (mom_change / prev_period_value * 100) if prev_period_value != 0 else 0
                    else:
                        prev_period_value = None
                        mom_change = None
                        mom_percent = None
                else:
                    prev_period_value = None
                    mom_change = None
                    mom_percent = None

                results.append({
                    "period": period_key,
                    "current": round(current_value, 2),
                    "previousYear": round(prev_year_value, 2) if prev_year_value is not None else None,
                    "previousPeriod": round(prev_period_value, 2) if prev_period_value is not None else None,
                    "yoyChange": round(yoy_change, 2) if yoy_change is not None else None,
                    "yoyPercent": round(yoy_percent, 2) if yoy_percent is not None else None,
                    "momChange": round(mom_change, 2) if mom_change is not None else None,
                    "momPercent": round(mom_percent, 2) if mom_percent is not None else None
                })

            return {
                "success": True,
                "data": {
                    "periodType": period_type,
                    "periods": results,
                    "summary": {
                        "latestYoY": results[-1]["yoyPercent"] if results and results[-1]["yoyPercent"] is not None else None,
                        "latestMoM": results[-1]["momPercent"] if results and results[-1]["momPercent"] is not None else None,
                        "avgYoY": round(np.mean([r["yoyPercent"] for r in results if r["yoyPercent"] is not None]), 2) if any(r["yoyPercent"] is not None for r in results) else None,
                        "avgMoM": round(np.mean([r["momPercent"] for r in results if r["momPercent"] is not None]), 2) if any(r["momPercent"] is not None for r in results) else None
                    }
                }
            }

        except Exception as e:
            logger.error(f"Failed to calculate YoY/MoM comparison: {e}", exc_info=True)
            return {"success": False, "error": str(e), "data": None}

    def get_category_comparison(
        self,
        data: List[dict],
        year1: int,
        year2: int
    ) -> dict:
        """
        Compare category values between two years

        Args:
            data: List of data records with category, year, and value fields
            year1: First year for comparison (typically earlier year)
            year2: Second year for comparison (typically later year)

        Returns:
            Dict with category comparison data
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return {
                    "success": True,
                    "data": {
                        "categories": [],
                        "year1Values": [],
                        "year2Values": [],
                        "change": [],
                        "changePercent": []
                    }
                }

            # Find relevant columns
            category_col = self._find_column(df, [
                "category", "name", "item", "type", "product",
                "类别", "名称", "项目", "产品", "科目"
            ])
            date_col = self._find_column(df, ["date", "year", "period", "日期", "年份", "年度"])
            value_col = self._find_column(df, [
                "value", "amount", "revenue", "sales", "cost",
                "金额", "数值", "收入", "销售额", "成本"
            ])

            if not category_col or not value_col:
                return {
                    "success": False,
                    "error": "Missing category or value column",
                    "data": None
                }

            # Extract year if date column exists
            if date_col:
                df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                df['year'] = df[date_col].dt.year.fillna(0).astype(int)
            else:
                # Try to find year column directly
                year_col = self._find_column(df, ["year", "年份", "年度"])
                if year_col:
                    df['year'] = df[year_col].astype(int)
                else:
                    return {
                        "success": False,
                        "error": "No date or year column found",
                        "data": None
                    }

            # Filter data for the two years
            df_year1 = df[df['year'] == year1].groupby(category_col)[value_col].sum()
            df_year2 = df[df['year'] == year2].groupby(category_col)[value_col].sum()

            # Get all categories
            all_categories = set(df_year1.index.tolist() + df_year2.index.tolist())

            categories = []
            year1_values = []
            year2_values = []
            change = []
            change_percent = []

            for cat in sorted(all_categories):
                val1 = float(df_year1.get(cat, 0))
                val2 = float(df_year2.get(cat, 0))
                diff = val2 - val1
                pct = (diff / val1 * 100) if val1 != 0 else (100 if val2 > 0 else 0)

                categories.append(str(cat))
                year1_values.append(round(val1, 2))
                year2_values.append(round(val2, 2))
                change.append(round(diff, 2))
                change_percent.append(round(pct, 2))

            # Summary
            total_year1 = sum(year1_values)
            total_year2 = sum(year2_values)

            return {
                "success": True,
                "data": {
                    "year1": year1,
                    "year2": year2,
                    "categories": categories,
                    "year1Values": year1_values,
                    "year2Values": year2_values,
                    "change": change,
                    "changePercent": change_percent,
                    "summary": {
                        "totalYear1": round(total_year1, 2),
                        "totalYear2": round(total_year2, 2),
                        "totalChange": round(total_year2 - total_year1, 2),
                        "totalChangePercent": round(
                            (total_year2 - total_year1) / total_year1 * 100 if total_year1 != 0 else 0, 2
                        )
                    }
                }
            }

        except Exception as e:
            logger.error(f"Failed to compare categories between years: {e}", exc_info=True)
            return {"success": False, "error": str(e), "data": None}

    def get_finance_overview(self, data: List[dict]) -> dict:
        """
        Generate comprehensive financial overview with key KPIs

        Args:
            data: List of data records with financial information

        Returns:
            Dict with key financial KPIs and metrics
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return {
                    "success": True,
                    "data": {
                        "kpis": {},
                        "trends": {},
                        "alerts": []
                    }
                }

            kpis = {}
            trends = {}
            alerts = []

            # Find columns
            revenue_col = self._find_column(df, [
                "revenue", "sales", "income", "amount",
                "收入", "销售额", "营业收入", "金额"
            ])
            cost_col = self._find_column(df, [
                "cost", "expense", "cogs",
                "成本", "费用", "销售成本"
            ])
            profit_col = self._find_column(df, [
                "profit", "gross_profit", "net_profit",
                "利润", "毛利", "净利润"
            ])
            budget_col = self._find_column(df, ["budget", "预算", "计划"])
            actual_col = self._find_column(df, ["actual", "实际", "执行"])
            target_col = self._find_column(df, ["target", "目标"])
            date_col = self._find_column(df, ["date", "time", "period", "日期", "时间"])

            # Calculate Revenue KPIs
            if revenue_col:
                total_revenue = float(df[revenue_col].sum())
                kpis["totalRevenue"] = {
                    "value": round(total_revenue, 2),
                    "label": "总收入",
                    "unit": "元"
                }

                # Calculate average revenue
                count = len(df)
                if count > 0:
                    kpis["avgRevenue"] = {
                        "value": round(total_revenue / count, 2),
                        "label": "平均收入",
                        "unit": "元"
                    }

            # Calculate Cost KPIs
            if cost_col:
                total_cost = float(df[cost_col].sum())
                kpis["totalCost"] = {
                    "value": round(total_cost, 2),
                    "label": "总成本",
                    "unit": "元"
                }

                # Cost ratio
                if revenue_col and total_revenue > 0:
                    cost_ratio = total_cost / total_revenue * 100
                    kpis["costRatio"] = {
                        "value": round(cost_ratio, 2),
                        "label": "成本率",
                        "unit": "%"
                    }

            # Calculate Profit KPIs
            if profit_col:
                total_profit = float(df[profit_col].sum())
            elif revenue_col and cost_col:
                total_profit = total_revenue - total_cost
            else:
                total_profit = None

            if total_profit is not None:
                kpis["totalProfit"] = {
                    "value": round(total_profit, 2),
                    "label": "总利润",
                    "unit": "元"
                }

                # Profit margin
                if revenue_col and total_revenue > 0:
                    profit_margin = total_profit / total_revenue * 100
                    kpis["profitMargin"] = {
                        "value": round(profit_margin, 2),
                        "label": "利润率",
                        "unit": "%"
                    }

                    # Alert for low profit margin
                    if profit_margin < 10:
                        alerts.append({
                            "type": "warning",
                            "message": f"利润率偏低 ({round(profit_margin, 1)}%)，建议关注成本控制"
                        })

            # Budget execution rate
            if budget_col and actual_col:
                total_budget = float(df[budget_col].sum())
                total_actual = float(df[actual_col].sum())

                if total_budget > 0:
                    execution_rate = total_actual / total_budget * 100
                    kpis["budgetExecutionRate"] = {
                        "value": round(execution_rate, 2),
                        "label": "预算执行率",
                        "unit": "%"
                    }

                    kpis["budgetVariance"] = {
                        "value": round(total_actual - total_budget, 2),
                        "label": "预算偏差",
                        "unit": "元"
                    }

                    # Alert for budget overrun
                    if execution_rate > 100:
                        alerts.append({
                            "type": "alert",
                            "message": f"预算超支 {round(execution_rate - 100, 1)}%"
                        })
                    elif execution_rate < 80:
                        alerts.append({
                            "type": "info",
                            "message": f"预算执行率较低 ({round(execution_rate, 1)}%)"
                        })

            # Target completion
            if target_col and actual_col:
                total_target = float(df[target_col].sum())
                total_actual_target = float(df[actual_col].sum())

                if total_target > 0:
                    completion_rate = total_actual_target / total_target * 100
                    kpis["targetCompletionRate"] = {
                        "value": round(completion_rate, 2),
                        "label": "目标完成率",
                        "unit": "%"
                    }

            # Calculate trends if date column exists
            if date_col and revenue_col:
                df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                df = df.dropna(subset=[date_col])

                if not df.empty:
                    df['month'] = df[date_col].dt.to_period('M')
                    monthly = df.groupby('month')[revenue_col].sum()

                    if len(monthly) >= 2:
                        latest = float(monthly.iloc[-1])
                        previous = float(monthly.iloc[-2])

                        if previous > 0:
                            mom_growth = (latest - previous) / previous * 100
                            trends["monthlyGrowth"] = {
                                "value": round(mom_growth, 2),
                                "label": "月环比增长",
                                "unit": "%",
                                "trend": "up" if mom_growth > 0 else "down"
                            }

            return {
                "success": True,
                "data": {
                    "kpis": kpis,
                    "trends": trends,
                    "alerts": alerts,
                    "generatedAt": datetime.now().isoformat()
                }
            }

        except Exception as e:
            logger.error(f"Failed to generate finance overview: {e}", exc_info=True)
            return {"success": False, "error": str(e), "data": None}

    def _find_column(self, df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
        """
        Find a column from candidate names (case-insensitive, partial match)

        Args:
            df: DataFrame to search
            candidates: List of candidate column names (Chinese and English)

        Returns:
            Found column name or None
        """
        for col in df.columns:
            col_lower = col.lower().strip()
            for candidate in candidates:
                candidate_lower = candidate.lower().strip()
                # Exact match or partial match
                if candidate_lower == col_lower or candidate_lower in col_lower or col_lower in candidate_lower:
                    return col
        return None

    def _find_cost_breakdown_columns(self, df: pd.DataFrame) -> List[str]:
        """
        Find columns that represent cost breakdown categories

        Args:
            df: DataFrame to search

        Returns:
            List of column names representing cost categories
        """
        cost_keywords = [
            "cost", "expense", "fee", "charge",
            "成本", "费用", "支出",
            "材料", "人工", "制造", "管理", "销售", "财务",
            "material", "labor", "overhead", "admin", "selling"
        ]

        cost_columns = []
        for col in df.columns:
            col_lower = col.lower()
            for keyword in cost_keywords:
                if keyword in col_lower:
                    # Verify it's numeric
                    if pd.api.types.is_numeric_dtype(df[col]):
                        cost_columns.append(col)
                        break

        return cost_columns

    def _create_period_column(
        self,
        df: pd.DataFrame,
        date_col: str,
        period_type: str
    ) -> pd.Series:
        """
        Create period column based on period type

        Args:
            df: DataFrame with date column
            date_col: Name of date column
            period_type: Type of period aggregation

        Returns:
            Series with period values
        """
        if period_type == 'daily':
            return df[date_col].dt.date.astype(str)
        elif period_type == 'weekly':
            return df[date_col].dt.to_period('W').astype(str)
        elif period_type == 'monthly':
            return df[date_col].dt.to_period('M').astype(str)
        elif period_type == 'quarterly':
            return df[date_col].dt.to_period('Q').astype(str)
        elif period_type == 'yearly':
            return df[date_col].dt.year.astype(str)
        else:
            # Default to monthly
            return df[date_col].dt.to_period('M').astype(str)

    def _round_value(self, value: Optional[float], decimals: int = 2) -> Optional[float]:
        """Round value to specified decimals"""
        if value is None:
            return None
        return round(float(value), decimals)
