from __future__ import annotations
"""
Department Analysis Service

Provides comprehensive department performance analysis including:
- Department ranking by sales, orders, or other metrics
- Detailed metrics for specific departments
- Target completion rates by department
- Efficiency matrix (headcount vs output) for scatter plots
- Department trend comparison over time
- Department share trends for stacked area charts
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

import pandas as pd
import numpy as np

from .base import BaseAnalysisService

logger = logging.getLogger(__name__)


class DepartmentAnalysisService(BaseAnalysisService):
    """Department performance analysis service with comprehensive metrics"""

    # Column name candidates for field detection (Chinese and English)
    DEPARTMENT_COLUMNS = [
        "department", "dept", "division", "branch", "team", "unit",
        "部门", "分部", "事业部", "部门名称", "team", "组"
    ]

    SALES_COLUMNS = [
        "sales", "amount", "revenue", "sales_amount", "total_sales", "value",
        "销售额", "金额", "收入", "销售金额", "营业额", "销售收入"
    ]

    ORDER_COLUMNS = [
        "orders", "order_count", "order_id", "order_no", "order_number", "count",
        "订单数", "订单量", "订单", "单数", "订单号"
    ]

    DATE_COLUMNS = [
        "date", "order_date", "sale_date", "time", "period", "month", "year_month",
        "日期", "订单日期", "销售日期", "时间", "月份", "年月"
    ]

    HEADCOUNT_COLUMNS = [
        "headcount", "staff", "employees", "staff_count", "employee_count", "people",
        "人数", "员工数", "人员数", "人头", "员工人数"
    ]

    TARGET_COLUMNS = [
        "target", "goal", "budget", "plan", "planned",
        "目标", "预算", "计划", "指标"
    ]

    ACTUAL_COLUMNS = [
        "actual", "realized", "completed", "achieved",
        "实际", "完成", "达成", "实际完成"
    ]

    SALESPERSON_COLUMNS = [
        "salesperson", "sales_rep", "seller", "employee", "staff", "rep_name",
        "销售员", "业务员", "销售人员", "员工", "业务代表", "销售代表"
    ]

    def __init__(self):
        super().__init__()

    def _get_column(
        self,
        df: pd.DataFrame,
        candidates: List[str],
        field_mapping: Optional[Dict[str, str]] = None,
        mapping_key: Optional[str] = None
    ) -> Optional[str]:
        """
        Get column name using field mapping or auto-detection

        Args:
            df: DataFrame to search
            candidates: List of candidate column names
            field_mapping: Optional field mapping dict
            mapping_key: Key to look up in field_mapping

        Returns:
            Found column name or None
        """
        # First try field mapping if provided
        if field_mapping and mapping_key and mapping_key in field_mapping:
            mapped_col = field_mapping[mapping_key]
            if mapped_col in df.columns:
                return mapped_col

        # Fall back to auto-detection with exact match priority
        return self._find_column_with_priority(df, candidates)

    def _find_column_with_priority(
        self,
        df: pd.DataFrame,
        candidates: List[str]
    ) -> Optional[str]:
        """
        Find column with exact match priority, then partial match

        Args:
            df: DataFrame to search
            candidates: Candidate column names

        Returns:
            Found column name or None
        """
        # First pass: exact match (case-insensitive)
        for col in df.columns:
            col_lower = col.lower().strip()
            for candidate in candidates:
                if candidate.lower().strip() == col_lower:
                    return col

        # Second pass: candidate is prefix of column (e.g., "sales" matches "sales_amount")
        for col in df.columns:
            col_lower = col.lower().strip()
            for candidate in candidates:
                candidate_lower = candidate.lower().strip()
                if col_lower.startswith(candidate_lower + '_') or col_lower.startswith(candidate_lower + ' '):
                    return col

        # Third pass: partial match (column contains candidate)
        for col in df.columns:
            col_lower = col.lower().strip()
            for candidate in candidates:
                candidate_lower = candidate.lower().strip()
                # Only match if candidate is at least 3 chars to avoid false positives
                if len(candidate_lower) >= 3 and candidate_lower in col_lower:
                    return col

        return None

    def get_department_ranking(
        self,
        data: List[dict],
        top_n: int = 10,
        rank_by: str = 'sales',
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get department performance ranking

        Args:
            data: List of data records
            top_n: Number of top departments to return
            rank_by: Metric to rank by ('sales', 'orders', 'avg_order_value')
            field_mapping: Optional column name mapping

        Returns:
            Dict with department ranking:
            - department name
            - sales amount
            - order count
            - avg_order_value
            - growth_rate
            - percentage (share of total)
        """
        try:
            if not data:
                return self._success_response({
                    "ranking": [],
                    "total_departments": 0,
                    "total_sales": 0
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "ranking": [],
                    "total_departments": 0,
                    "total_sales": 0
                })

            # Find columns
            dept_col = self._get_column(df, self.DEPARTMENT_COLUMNS, field_mapping, "department")
            sales_col = self._get_column(df, self.SALES_COLUMNS, field_mapping, "sales")
            order_col = self._get_column(df, self.ORDER_COLUMNS, field_mapping, "orders")
            date_col = self._get_column(df, self.DATE_COLUMNS, field_mapping, "date")

            if not dept_col:
                return self._error_response("Department column not found")

            if not sales_col:
                return self._error_response("Sales column not found")

            # Convert to numeric
            df[sales_col] = pd.to_numeric(df[sales_col], errors='coerce').fillna(0)

            # Aggregate by department
            agg_dict = {sales_col: 'sum'}
            grouped = df.groupby(dept_col).agg(agg_dict).reset_index()
            grouped.columns = [dept_col, 'total_sales']

            # Add order count
            if order_col:
                order_counts = df.groupby(dept_col)[order_col].nunique().reset_index()
                order_counts.columns = [dept_col, 'order_count']
                grouped = grouped.merge(order_counts, on=dept_col, how='left')
            else:
                row_counts = df.groupby(dept_col).size().reset_index(name='order_count')
                grouped = grouped.merge(row_counts, on=dept_col, how='left')

            # Calculate average order value
            grouped['avg_order_value'] = grouped['total_sales'] / grouped['order_count'].replace(0, 1)

            # Sort by ranking metric
            if rank_by == 'orders':
                grouped = grouped.sort_values('order_count', ascending=False)
            elif rank_by == 'avg_order_value':
                grouped = grouped.sort_values('avg_order_value', ascending=False)
            else:  # default: sales
                grouped = grouped.sort_values('total_sales', ascending=False)

            # Calculate total for percentage
            total_sales = grouped['total_sales'].sum()

            # Calculate growth rate if date column exists
            growth_rates = {}
            if date_col:
                growth_rates = self._calculate_dept_growth_rates(df, dept_col, sales_col, date_col)

            # Build ranking list
            ranking = []
            for idx, row in grouped.head(top_n).iterrows():
                dept_name = str(row[dept_col])
                sales = float(row['total_sales'])
                orders = int(row['order_count'])
                avg_val = float(row['avg_order_value'])
                percentage = self._safe_divide(sales * 100, total_sales)
                growth = growth_rates.get(dept_name)

                ranking.append({
                    "rank": len(ranking) + 1,
                    "department": dept_name,
                    "sales": self._round_value(sales),
                    "orders": orders,
                    "avg_order_value": self._round_value(avg_val),
                    "growth_rate": self._round_value(growth) if growth is not None else None,
                    "percentage": self._round_value(percentage)
                })

            return self._success_response({
                "ranking": ranking,
                "total_departments": int(df[dept_col].nunique()),
                "total_sales": self._round_value(total_sales),
                "rank_by": rank_by
            })

        except Exception as e:
            logger.error(f"Failed to calculate department ranking: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_department_detail(
        self,
        data: List[dict],
        department: str,
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get detailed metrics for a specific department

        Args:
            data: List of data records
            department: Department name to get details for
            field_mapping: Optional column name mapping

        Returns:
            Dict with department details:
            - KPIs (total sales, orders, avg order value, growth)
            - Trend data (monthly/weekly performance)
            - Top salespeople in department
        """
        try:
            if not data:
                return self._error_response("No data provided")

            df = self._to_dataframe(data)

            if df.empty:
                return self._error_response("Empty data")

            # Find columns
            dept_col = self._get_column(df, self.DEPARTMENT_COLUMNS, field_mapping, "department")
            sales_col = self._get_column(df, self.SALES_COLUMNS, field_mapping, "sales")
            order_col = self._get_column(df, self.ORDER_COLUMNS, field_mapping, "orders")
            date_col = self._get_column(df, self.DATE_COLUMNS, field_mapping, "date")
            salesperson_col = self._get_column(df, self.SALESPERSON_COLUMNS, field_mapping, "salesperson")

            if not dept_col:
                return self._error_response("Department column not found")

            if not sales_col:
                return self._error_response("Sales column not found")

            # Filter to specific department
            df[sales_col] = pd.to_numeric(df[sales_col], errors='coerce').fillna(0)
            dept_df = df[df[dept_col].astype(str).str.lower() == department.lower()]

            if dept_df.empty:
                return self._error_response(f"Department '{department}' not found")

            # Calculate KPIs
            total_sales = float(dept_df[sales_col].sum())

            if order_col:
                order_count = int(dept_df[order_col].nunique())
            else:
                order_count = len(dept_df)

            avg_order_value = self._safe_divide(total_sales, order_count)

            # Calculate growth rate
            growth_rate = None
            if date_col:
                growth_rate = self._calculate_single_growth(dept_df, sales_col, date_col)

            kpis = {
                "total_sales": self._round_value(total_sales),
                "order_count": order_count,
                "avg_order_value": self._round_value(avg_order_value),
                "growth_rate": self._round_value(growth_rate) if growth_rate is not None else None
            }

            # Calculate trend data
            trend = []
            if date_col:
                dept_df = dept_df.copy()
                dept_df[date_col] = pd.to_datetime(dept_df[date_col], errors='coerce')
                dept_df = dept_df.dropna(subset=[date_col])

                if not dept_df.empty:
                    dept_df['period'] = dept_df[date_col].dt.to_period('M').apply(lambda x: x.start_time)
                    period_data = dept_df.groupby('period')[sales_col].sum().reset_index()
                    period_data = period_data.sort_values('period')

                    for _, row in period_data.iterrows():
                        trend.append({
                            "period": row['period'].strftime('%Y-%m'),
                            "sales": self._round_value(float(row[sales_col]))
                        })

            # Get top salespeople in department
            top_salespeople = []
            if salesperson_col:
                sp_sales = dept_df.groupby(salesperson_col)[sales_col].sum()
                sp_sales = sp_sales.sort_values(ascending=False)

                for sp_name, sales in sp_sales.head(5).items():
                    sales_val = float(sales)
                    top_salespeople.append({
                        "salesperson": str(sp_name),
                        "sales": self._round_value(sales_val),
                        "percentage": self._round_value(self._safe_divide(sales_val * 100, total_sales))
                    })

            return self._success_response({
                "department": department,
                "kpis": kpis,
                "trend": trend,
                "top_salespeople": top_salespeople
            })

        except Exception as e:
            logger.error(f"Failed to get department detail: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_department_completion_rates(
        self,
        data: List[dict],
        target_data: Optional[List[dict]] = None,
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get target completion rates by department

        Args:
            data: List of data records with actual values
            target_data: Optional separate target data (if not in main data)
            field_mapping: Optional column name mapping

        Returns:
            Dict with completion rates:
            - department
            - target
            - actual
            - completion_rate
            - variance
        """
        try:
            if not data:
                return self._success_response({
                    "completion_rates": [],
                    "summary": {}
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "completion_rates": [],
                    "summary": {}
                })

            # Find columns
            dept_col = self._get_column(df, self.DEPARTMENT_COLUMNS, field_mapping, "department")
            target_col = self._get_column(df, self.TARGET_COLUMNS, field_mapping, "target")
            actual_col = self._get_column(df, self.ACTUAL_COLUMNS, field_mapping, "actual")

            # If no actual column, try sales column
            if not actual_col:
                actual_col = self._get_column(df, self.SALES_COLUMNS, field_mapping, "sales")

            if not dept_col:
                return self._error_response("Department column not found")

            # Handle separate target data
            if target_data and not target_col:
                target_df = pd.DataFrame(target_data)
                target_col_in_target = self._get_column(target_df, self.TARGET_COLUMNS, field_mapping, "target")
                target_dept_col = self._get_column(target_df, self.DEPARTMENT_COLUMNS, field_mapping, "department")

                if target_col_in_target and target_dept_col:
                    # Merge target data
                    target_df = target_df.groupby(target_dept_col)[target_col_in_target].sum().reset_index()
                    target_df.columns = [dept_col, 'target']
                    target_col = 'target'

                    # Aggregate actuals
                    if actual_col:
                        df[actual_col] = pd.to_numeric(df[actual_col], errors='coerce').fillna(0)
                        df = df.groupby(dept_col)[actual_col].sum().reset_index()
                        df.columns = [dept_col, 'actual']
                        actual_col = 'actual'

                    df = df.merge(target_df, on=dept_col, how='outer').fillna(0)

            if not target_col:
                return self._error_response("Target column not found")

            if not actual_col:
                return self._error_response("Actual/Sales column not found")

            # Convert to numeric
            df[target_col] = pd.to_numeric(df[target_col], errors='coerce').fillna(0)
            df[actual_col] = pd.to_numeric(df[actual_col], errors='coerce').fillna(0)

            # Aggregate by department
            grouped = df.groupby(dept_col).agg({
                target_col: 'sum',
                actual_col: 'sum'
            }).reset_index()

            # Calculate completion rate and variance
            completion_rates = []
            total_target = 0
            total_actual = 0

            for _, row in grouped.iterrows():
                dept = str(row[dept_col])
                target = float(row[target_col])
                actual = float(row[actual_col])
                variance = actual - target
                rate = self._safe_divide(actual * 100, target) if target > 0 else 0

                completion_rates.append({
                    "department": dept,
                    "target": self._round_value(target),
                    "actual": self._round_value(actual),
                    "completion_rate": self._round_value(rate),
                    "variance": self._round_value(variance)
                })

                total_target += target
                total_actual += actual

            # Sort by completion rate descending
            completion_rates.sort(key=lambda x: x['completion_rate'], reverse=True)

            # Summary
            overall_rate = self._safe_divide(total_actual * 100, total_target) if total_target > 0 else 0

            return self._success_response({
                "completion_rates": completion_rates,
                "summary": {
                    "total_target": self._round_value(total_target),
                    "total_actual": self._round_value(total_actual),
                    "overall_completion_rate": self._round_value(overall_rate),
                    "total_variance": self._round_value(total_actual - total_target),
                    "departments_meeting_target": sum(1 for cr in completion_rates if cr['completion_rate'] >= 100)
                }
            })

        except Exception as e:
            logger.error(f"Failed to calculate department completion rates: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_department_efficiency_matrix(
        self,
        data: List[dict],
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get efficiency matrix (headcount vs output) for scatter plot visualization

        Args:
            data: List of data records with headcount and sales/output data
            field_mapping: Optional column name mapping

        Returns:
            Dict with efficiency matrix:
            - department
            - headcount
            - sales (output)
            - per_capita_sales
            - efficiency_score
        """
        try:
            if not data:
                return self._success_response({
                    "matrix": [],
                    "summary": {}
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "matrix": [],
                    "summary": {}
                })

            # Find columns
            dept_col = self._get_column(df, self.DEPARTMENT_COLUMNS, field_mapping, "department")
            sales_col = self._get_column(df, self.SALES_COLUMNS, field_mapping, "sales")
            headcount_col = self._get_column(df, self.HEADCOUNT_COLUMNS, field_mapping, "headcount")

            if not dept_col:
                return self._error_response("Department column not found")

            if not sales_col:
                return self._error_response("Sales column not found")

            if not headcount_col:
                return self._error_response("Headcount column not found")

            # Convert to numeric
            df[sales_col] = pd.to_numeric(df[sales_col], errors='coerce').fillna(0)
            df[headcount_col] = pd.to_numeric(df[headcount_col], errors='coerce').fillna(0)

            # Aggregate by department
            grouped = df.groupby(dept_col).agg({
                sales_col: 'sum',
                headcount_col: 'mean'  # Use average headcount if multiple records
            }).reset_index()

            # Calculate per capita sales
            grouped['per_capita_sales'] = grouped[sales_col] / grouped[headcount_col].replace(0, 1)

            # Calculate efficiency score (normalized)
            max_per_capita = grouped['per_capita_sales'].max()
            grouped['efficiency_score'] = (grouped['per_capita_sales'] / max_per_capita * 100) if max_per_capita > 0 else 0

            # Build matrix
            matrix = []
            for _, row in grouped.iterrows():
                matrix.append({
                    "department": str(row[dept_col]),
                    "headcount": int(row[headcount_col]),
                    "sales": self._round_value(float(row[sales_col])),
                    "per_capita_sales": self._round_value(float(row['per_capita_sales'])),
                    "efficiency_score": self._round_value(float(row['efficiency_score']))
                })

            # Sort by efficiency score
            matrix.sort(key=lambda x: x['efficiency_score'], reverse=True)

            # Summary statistics
            total_headcount = grouped[headcount_col].sum()
            total_sales = grouped[sales_col].sum()
            avg_per_capita = self._safe_divide(total_sales, total_headcount)

            return self._success_response({
                "matrix": matrix,
                "summary": {
                    "total_headcount": int(total_headcount),
                    "total_sales": self._round_value(total_sales),
                    "avg_per_capita_sales": self._round_value(avg_per_capita),
                    "highest_efficiency_dept": matrix[0]['department'] if matrix else None,
                    "lowest_efficiency_dept": matrix[-1]['department'] if matrix else None
                }
            })

        except Exception as e:
            logger.error(f"Failed to calculate department efficiency matrix: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_department_trend_comparison(
        self,
        data: List[dict],
        period_type: str = 'monthly',
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Compare department trends over time for line chart visualization

        Args:
            data: List of data records
            period_type: 'daily', 'weekly', or 'monthly'
            field_mapping: Optional column name mapping

        Returns:
            Dict with trend comparison:
            - periods: list of period labels
            - departments: dict of department -> values list
            For line chart with multiple series
        """
        try:
            if not data:
                return self._success_response({
                    "periods": [],
                    "departments": {},
                    "period_type": period_type
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "periods": [],
                    "departments": {},
                    "period_type": period_type
                })

            # Find columns
            dept_col = self._get_column(df, self.DEPARTMENT_COLUMNS, field_mapping, "department")
            sales_col = self._get_column(df, self.SALES_COLUMNS, field_mapping, "sales")
            date_col = self._get_column(df, self.DATE_COLUMNS, field_mapping, "date")

            if not dept_col:
                return self._error_response("Department column not found")

            if not sales_col:
                return self._error_response("Sales column not found")

            if not date_col:
                return self._error_response("Date column not found")

            # Convert data types
            df[sales_col] = pd.to_numeric(df[sales_col], errors='coerce').fillna(0)
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])

            if df.empty:
                return self._success_response({
                    "periods": [],
                    "departments": {},
                    "period_type": period_type
                })

            # Create period column
            if period_type == 'weekly':
                df['period'] = df[date_col].dt.to_period('W').apply(lambda x: x.start_time)
                period_format = '%Y-W%W'
            elif period_type == 'daily':
                df['period'] = df[date_col].dt.date
                period_format = '%Y-%m-%d'
            else:  # monthly
                df['period'] = df[date_col].dt.to_period('M').apply(lambda x: x.start_time)
                period_format = '%Y-%m'

            # Pivot to get departments as columns
            pivot = df.groupby(['period', dept_col])[sales_col].sum().reset_index()
            pivot_table = pivot.pivot(index='period', columns=dept_col, values=sales_col).fillna(0)
            pivot_table = pivot_table.sort_index()

            # Build result
            if period_type == 'daily':
                periods = [str(p) for p in pivot_table.index]
            else:
                periods = [p.strftime(period_format) for p in pivot_table.index]

            departments = {}
            for dept in pivot_table.columns:
                departments[str(dept)] = [self._round_value(float(v)) for v in pivot_table[dept].values]

            return self._success_response({
                "periods": periods,
                "departments": departments,
                "period_type": period_type
            })

        except Exception as e:
            logger.error(f"Failed to calculate department trend comparison: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_department_share_trend(
        self,
        data: List[dict],
        period_type: str = 'monthly',
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get department share trends over time for stacked area chart

        Args:
            data: List of data records
            period_type: 'daily', 'weekly', or 'monthly'
            field_mapping: Optional column name mapping

        Returns:
            Dict with share trends:
            - periods: list of period labels
            - shares: dict of department -> share percentages list
            For stacked area chart
        """
        try:
            if not data:
                return self._success_response({
                    "periods": [],
                    "shares": {},
                    "period_type": period_type
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "periods": [],
                    "shares": {},
                    "period_type": period_type
                })

            # Find columns
            dept_col = self._get_column(df, self.DEPARTMENT_COLUMNS, field_mapping, "department")
            sales_col = self._get_column(df, self.SALES_COLUMNS, field_mapping, "sales")
            date_col = self._get_column(df, self.DATE_COLUMNS, field_mapping, "date")

            if not dept_col:
                return self._error_response("Department column not found")

            if not sales_col:
                return self._error_response("Sales column not found")

            if not date_col:
                return self._error_response("Date column not found")

            # Convert data types
            df[sales_col] = pd.to_numeric(df[sales_col], errors='coerce').fillna(0)
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])

            if df.empty:
                return self._success_response({
                    "periods": [],
                    "shares": {},
                    "period_type": period_type
                })

            # Create period column
            if period_type == 'weekly':
                df['period'] = df[date_col].dt.to_period('W').apply(lambda x: x.start_time)
                period_format = '%Y-W%W'
            elif period_type == 'daily':
                df['period'] = df[date_col].dt.date
                period_format = '%Y-%m-%d'
            else:  # monthly
                df['period'] = df[date_col].dt.to_period('M').apply(lambda x: x.start_time)
                period_format = '%Y-%m'

            # Pivot to get departments as columns
            pivot = df.groupby(['period', dept_col])[sales_col].sum().reset_index()
            pivot_table = pivot.pivot(index='period', columns=dept_col, values=sales_col).fillna(0)
            pivot_table = pivot_table.sort_index()

            # Calculate period totals
            period_totals = pivot_table.sum(axis=1)

            # Calculate share percentages
            share_table = pivot_table.div(period_totals, axis=0) * 100
            share_table = share_table.fillna(0)

            # Build result
            if period_type == 'daily':
                periods = [str(p) for p in share_table.index]
            else:
                periods = [p.strftime(period_format) for p in share_table.index]

            shares = {}
            for dept in share_table.columns:
                shares[str(dept)] = [self._round_value(float(v)) for v in share_table[dept].values]

            return self._success_response({
                "periods": periods,
                "shares": shares,
                "period_type": period_type
            })

        except Exception as e:
            logger.error(f"Failed to calculate department share trend: {e}", exc_info=True)
            return self._error_response(str(e))

    def _calculate_dept_growth_rates(
        self,
        df: pd.DataFrame,
        dept_col: str,
        sales_col: str,
        date_col: str
    ) -> Dict[str, float]:
        """
        Calculate growth rates for each department (MoM)

        Returns:
            Dict mapping department name to growth rate
        """
        growth_rates = {}

        try:
            df = df.copy()
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])

            if df.empty:
                return growth_rates

            # Create month column
            df['month'] = df[date_col].dt.to_period('M')

            # Group by department and month
            monthly = df.groupby([dept_col, 'month'])[sales_col].sum().reset_index()

            # Calculate growth for each department
            for dept in monthly[dept_col].unique():
                dept_data = monthly[monthly[dept_col] == dept].sort_values('month')

                if len(dept_data) >= 2:
                    current = float(dept_data.iloc[-1][sales_col])
                    previous = float(dept_data.iloc[-2][sales_col])

                    if previous > 0:
                        growth = (current - previous) / previous * 100
                        growth_rates[str(dept)] = growth

        except Exception as e:
            logger.warning(f"Failed to calculate department growth rates: {e}")

        return growth_rates

    def _calculate_single_growth(
        self,
        df: pd.DataFrame,
        sales_col: str,
        date_col: str
    ) -> Optional[float]:
        """
        Calculate MoM growth rate for a single dataset

        Returns:
            Growth rate as percentage or None
        """
        try:
            df = df.copy()
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])

            if df.empty:
                return None

            df['month'] = df[date_col].dt.to_period('M')
            monthly = df.groupby('month')[sales_col].sum().sort_index()

            if len(monthly) < 2:
                return None

            current = float(monthly.iloc[-1])
            previous = float(monthly.iloc[-2])

            if previous == 0:
                return None

            return (current - previous) / previous * 100

        except Exception:
            return None
