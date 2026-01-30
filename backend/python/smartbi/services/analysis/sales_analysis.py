from __future__ import annotations
"""
Sales Analysis Service

Provides comprehensive sales analytics including:
- Sales KPIs (total sales, order count, average order value, growth rate)
- Salesperson performance ranking
- Product performance ranking
- Sales trend analysis (daily/weekly/monthly)
- Regional distribution analysis
- Customer analysis (new vs returning)
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

import pandas as pd
import numpy as np

from .base import BaseAnalysisService

logger = logging.getLogger(__name__)


class SalesAnalysisService(BaseAnalysisService):
    """Sales analytics service with comprehensive metrics and rankings"""

    def __init__(self):
        super().__init__()

    def get_sales_kpis(self, data: List[dict]) -> dict:
        """
        Calculate key sales performance indicators

        Returns:
            - total_sales: Total sales amount
            - order_count: Number of orders
            - avg_order_value: Average order value
            - growth_rate: Sales growth rate (MoM or vs previous period)
            - daily_avg_sales: Daily average sales
        """
        try:
            if not data:
                return self._success_response({
                    "total_sales": 0,
                    "order_count": 0,
                    "avg_order_value": 0,
                    "growth_rate": None,
                    "daily_avg_sales": 0
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "total_sales": 0,
                    "order_count": 0,
                    "avg_order_value": 0,
                    "growth_rate": None,
                    "daily_avg_sales": 0
                })

            # Find relevant columns
            amount_col = self._find_column(df, [
                "amount", "sales", "revenue", "total", "sales_amount",
                "金额", "销售额", "销售金额", "收入", "营业额"
            ])
            order_col = self._find_column(df, [
                "order_id", "order_no", "order_number", "id",
                "订单号", "订单ID", "单号"
            ])
            date_col = self._find_column(df, [
                "date", "order_date", "sale_date", "time", "created_at",
                "日期", "订单日期", "销售日期", "时间"
            ])

            # Calculate total sales
            total_sales = 0
            if amount_col:
                df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)
                total_sales = float(df[amount_col].sum())

            # Calculate order count
            if order_col:
                order_count = int(df[order_col].nunique())
            else:
                order_count = len(df)

            # Calculate average order value
            avg_order_value = self._safe_divide(total_sales, order_count)

            # Calculate daily average sales
            daily_avg_sales = 0
            if date_col and amount_col:
                df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                valid_dates = df[date_col].dropna()
                if len(valid_dates) > 0:
                    days = valid_dates.nunique()
                    daily_avg_sales = self._safe_divide(total_sales, days)

            # Calculate growth rate (MoM)
            growth_rate = None
            if date_col and amount_col:
                growth_rate = self._calculate_growth_rate(df, amount_col, date_col)

            return self._success_response({
                "total_sales": self._round_value(total_sales),
                "order_count": order_count,
                "avg_order_value": self._round_value(avg_order_value),
                "growth_rate": self._round_value(growth_rate) if growth_rate is not None else None,
                "daily_avg_sales": self._round_value(daily_avg_sales)
            })

        except Exception as e:
            logger.error(f"Failed to calculate sales KPIs: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_salesperson_ranking(self, data: List[dict], top_n: int = 10) -> dict:
        """
        Get top salespeople by sales amount

        Args:
            data: Sales data
            top_n: Number of top salespeople to return

        Returns:
            Ranked list of salespeople with sales metrics
        """
        try:
            if not data:
                return self._success_response({
                    "ranking": [],
                    "total_salespeople": 0
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "ranking": [],
                    "total_salespeople": 0
                })

            # Find relevant columns
            salesperson_col = self._find_column(df, [
                "salesperson", "sales_rep", "seller", "employee", "staff",
                "salesperson_name", "rep_name", "sales_name",
                "销售员", "业务员", "销售人员", "销售代表", "员工", "业务代表"
            ])
            amount_col = self._find_column(df, [
                "amount", "sales", "revenue", "total", "sales_amount",
                "金额", "销售额", "销售金额", "收入"
            ])
            order_col = self._find_column(df, [
                "order_id", "order_no", "order_number",
                "订单号", "订单ID", "单号"
            ])

            if not salesperson_col:
                return self._error_response("Salesperson column not found")

            if not amount_col:
                return self._error_response("Amount column not found")

            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)

            # Group by salesperson
            grouped = df.groupby(salesperson_col).agg({
                amount_col: 'sum'
            }).reset_index()

            # Add order count if available
            if order_col:
                order_counts = df.groupby(salesperson_col)[order_col].nunique().reset_index()
                order_counts.columns = [salesperson_col, 'order_count']
                grouped = grouped.merge(order_counts, on=salesperson_col, how='left')
            else:
                row_counts = df.groupby(salesperson_col).size().reset_index(name='order_count')
                grouped = grouped.merge(row_counts, on=salesperson_col, how='left')

            # Sort by sales amount descending
            grouped = grouped.sort_values(by=amount_col, ascending=False)

            # Calculate total for percentage
            total_sales = grouped[amount_col].sum()

            # Build ranking list
            ranking = []
            for idx, row in grouped.head(top_n).iterrows():
                sales_amount = float(row[amount_col])
                percentage = self._safe_divide(sales_amount * 100, total_sales)
                ranking.append({
                    "rank": len(ranking) + 1,
                    "salesperson": str(row[salesperson_col]),
                    "sales_amount": self._round_value(sales_amount),
                    "order_count": int(row.get('order_count', 0)),
                    "avg_order_value": self._round_value(
                        self._safe_divide(sales_amount, row.get('order_count', 1))
                    ),
                    "percentage": self._round_value(percentage)
                })

            return self._success_response({
                "ranking": ranking,
                "total_salespeople": int(grouped[salesperson_col].nunique()),
                "total_sales": self._round_value(total_sales)
            })

        except Exception as e:
            logger.error(f"Failed to calculate salesperson ranking: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_product_ranking(self, data: List[dict], top_n: int = 10) -> dict:
        """
        Get top products by sales amount

        Args:
            data: Sales data
            top_n: Number of top products to return

        Returns:
            Ranked list of products with sales metrics
        """
        try:
            if not data:
                return self._success_response({
                    "ranking": [],
                    "total_products": 0
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "ranking": [],
                    "total_products": 0
                })

            # Find relevant columns
            product_col = self._find_column(df, [
                "product", "product_name", "item", "item_name", "goods", "sku",
                "产品", "产品名称", "商品", "商品名称", "品名", "货品"
            ])
            amount_col = self._find_column(df, [
                "amount", "sales", "revenue", "total", "sales_amount",
                "金额", "销售额", "销售金额", "收入"
            ])
            quantity_col = self._find_column(df, [
                "quantity", "qty", "count", "units", "num",
                "数量", "件数", "销量"
            ])

            if not product_col:
                return self._error_response("Product column not found")

            if not amount_col:
                return self._error_response("Amount column not found")

            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)

            # Build aggregation dict
            agg_dict = {amount_col: 'sum'}
            if quantity_col:
                df[quantity_col] = pd.to_numeric(df[quantity_col], errors='coerce').fillna(0)
                agg_dict[quantity_col] = 'sum'

            # Group by product
            grouped = df.groupby(product_col).agg(agg_dict).reset_index()

            # Sort by sales amount descending
            grouped = grouped.sort_values(by=amount_col, ascending=False)

            # Calculate total for percentage
            total_sales = grouped[amount_col].sum()

            # Build ranking list
            ranking = []
            for idx, row in grouped.head(top_n).iterrows():
                sales_amount = float(row[amount_col])
                percentage = self._safe_divide(sales_amount * 100, total_sales)
                item = {
                    "rank": len(ranking) + 1,
                    "product": str(row[product_col]),
                    "sales_amount": self._round_value(sales_amount),
                    "percentage": self._round_value(percentage)
                }
                if quantity_col:
                    quantity = float(row[quantity_col])
                    item["quantity"] = self._round_value(quantity)
                    item["unit_price"] = self._round_value(
                        self._safe_divide(sales_amount, quantity)
                    )
                ranking.append(item)

            return self._success_response({
                "ranking": ranking,
                "total_products": int(grouped[product_col].nunique()),
                "total_sales": self._round_value(total_sales)
            })

        except Exception as e:
            logger.error(f"Failed to calculate product ranking: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_sales_trend(self, data: List[dict], period_type: str = "daily") -> dict:
        """
        Get sales trend over time

        Args:
            data: Sales data
            period_type: "daily", "weekly", or "monthly"

        Returns:
            Time series data for sales trend
        """
        try:
            if not data:
                return self._success_response({
                    "trend": [],
                    "period_type": period_type,
                    "summary": {}
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "trend": [],
                    "period_type": period_type,
                    "summary": {}
                })

            # Find relevant columns
            date_col = self._find_column(df, [
                "date", "order_date", "sale_date", "time", "created_at",
                "日期", "订单日期", "销售日期", "时间"
            ])
            amount_col = self._find_column(df, [
                "amount", "sales", "revenue", "total", "sales_amount",
                "金额", "销售额", "销售金额", "收入"
            ])
            order_col = self._find_column(df, [
                "order_id", "order_no", "order_number",
                "订单号", "订单ID", "单号"
            ])

            if not date_col:
                return self._error_response("Date column not found")

            if not amount_col:
                return self._error_response("Amount column not found")

            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])

            if df.empty:
                return self._success_response({
                    "trend": [],
                    "period_type": period_type,
                    "summary": {}
                })

            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)

            # Create period column based on period_type
            if period_type == "weekly":
                df['period'] = df[date_col].dt.to_period('W').apply(lambda x: x.start_time)
            elif period_type == "monthly":
                df['period'] = df[date_col].dt.to_period('M').apply(lambda x: x.start_time)
            else:  # daily
                df['period'] = df[date_col].dt.date

            # Aggregate by period
            agg_dict = {amount_col: 'sum'}
            grouped = df.groupby('period').agg(agg_dict).reset_index()
            grouped = grouped.sort_values('period')

            # Add order count if available
            if order_col:
                order_agg = df.groupby('period')[order_col].nunique().reset_index()
                order_agg.columns = ['period', 'order_count']
                grouped = grouped.merge(order_agg, on='period', how='left')
            else:
                count_agg = df.groupby('period').size().reset_index(name='order_count')
                grouped = grouped.merge(count_agg, on='period', how='left')

            # Build trend list
            trend = []
            prev_amount = None
            for idx, row in grouped.iterrows():
                period_val = row['period']
                if isinstance(period_val, pd.Timestamp):
                    period_str = period_val.strftime('%Y-%m-%d')
                else:
                    period_str = str(period_val)

                sales_amount = float(row[amount_col])
                order_count = int(row.get('order_count', 0))

                # Calculate period-over-period growth
                growth = None
                if prev_amount is not None and prev_amount > 0:
                    growth = self._round_value((sales_amount - prev_amount) / prev_amount * 100)

                trend.append({
                    "period": period_str,
                    "sales_amount": self._round_value(sales_amount),
                    "order_count": order_count,
                    "avg_order_value": self._round_value(
                        self._safe_divide(sales_amount, order_count)
                    ),
                    "growth": growth
                })
                prev_amount = sales_amount

            # Calculate summary statistics
            amounts = grouped[amount_col]
            summary = {
                "total": self._round_value(float(amounts.sum())),
                "average": self._round_value(float(amounts.mean())),
                "max": self._round_value(float(amounts.max())),
                "min": self._round_value(float(amounts.min())),
                "periods_count": len(trend)
            }

            return self._success_response({
                "trend": trend,
                "period_type": period_type,
                "summary": summary
            })

        except Exception as e:
            logger.error(f"Failed to calculate sales trend: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_region_distribution(self, data: List[dict]) -> dict:
        """
        Get sales distribution by region/area

        Returns:
            Regional breakdown with sales amounts and percentages
        """
        try:
            if not data:
                return self._success_response({
                    "distribution": [],
                    "total_regions": 0
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "distribution": [],
                    "total_regions": 0
                })

            # Find relevant columns
            region_col = self._find_column(df, [
                "region", "area", "district", "province", "city", "location",
                "zone", "territory", "market",
                "区域", "地区", "省份", "城市", "区", "市场", "大区"
            ])
            amount_col = self._find_column(df, [
                "amount", "sales", "revenue", "total", "sales_amount",
                "金额", "销售额", "销售金额", "收入"
            ])
            order_col = self._find_column(df, [
                "order_id", "order_no", "order_number",
                "订单号", "订单ID", "单号"
            ])

            if not region_col:
                return self._error_response("Region column not found")

            if not amount_col:
                return self._error_response("Amount column not found")

            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)

            # Group by region
            grouped = df.groupby(region_col).agg({
                amount_col: 'sum'
            }).reset_index()

            # Add order count
            if order_col:
                order_counts = df.groupby(region_col)[order_col].nunique().reset_index()
                order_counts.columns = [region_col, 'order_count']
                grouped = grouped.merge(order_counts, on=region_col, how='left')
            else:
                row_counts = df.groupby(region_col).size().reset_index(name='order_count')
                grouped = grouped.merge(row_counts, on=region_col, how='left')

            # Sort by sales amount descending
            grouped = grouped.sort_values(by=amount_col, ascending=False)

            # Calculate total for percentage
            total_sales = grouped[amount_col].sum()

            # Build distribution list
            distribution = []
            for idx, row in grouped.iterrows():
                sales_amount = float(row[amount_col])
                percentage = self._safe_divide(sales_amount * 100, total_sales)
                distribution.append({
                    "region": str(row[region_col]),
                    "sales_amount": self._round_value(sales_amount),
                    "order_count": int(row.get('order_count', 0)),
                    "percentage": self._round_value(percentage),
                    "avg_order_value": self._round_value(
                        self._safe_divide(sales_amount, row.get('order_count', 1))
                    )
                })

            return self._success_response({
                "distribution": distribution,
                "total_regions": len(distribution),
                "total_sales": self._round_value(total_sales)
            })

        except Exception as e:
            logger.error(f"Failed to calculate region distribution: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_customer_analysis(self, data: List[dict]) -> dict:
        """
        Analyze customer metrics including new vs returning customers

        Returns:
            Customer count, new customer count, returning customer metrics
        """
        try:
            if not data:
                return self._success_response({
                    "total_customers": 0,
                    "new_customers": 0,
                    "returning_customers": 0,
                    "new_customer_ratio": 0,
                    "customer_breakdown": []
                })

            df = self._to_dataframe(data)

            if df.empty:
                return self._success_response({
                    "total_customers": 0,
                    "new_customers": 0,
                    "returning_customers": 0,
                    "new_customer_ratio": 0,
                    "customer_breakdown": []
                })

            # Find relevant columns
            customer_col = self._find_column(df, [
                "customer", "customer_id", "customer_name", "client", "buyer",
                "客户", "客户ID", "客户名称", "客户编号", "买家"
            ])
            customer_type_col = self._find_column(df, [
                "customer_type", "type", "is_new", "new_customer",
                "客户类型", "类型", "是否新客户", "新老客户"
            ])
            amount_col = self._find_column(df, [
                "amount", "sales", "revenue", "total", "sales_amount",
                "金额", "销售额", "销售金额", "收入"
            ])
            date_col = self._find_column(df, [
                "date", "order_date", "sale_date", "time", "created_at",
                "日期", "订单日期", "销售日期", "时间"
            ])
            order_col = self._find_column(df, [
                "order_id", "order_no", "order_number",
                "订单号", "订单ID", "单号"
            ])

            if not customer_col:
                return self._error_response("Customer column not found")

            # Calculate total unique customers
            total_customers = int(df[customer_col].nunique())

            # Initialize counts
            new_customers = 0
            returning_customers = 0
            new_customer_sales = 0
            returning_customer_sales = 0

            if amount_col:
                df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)

            # Try to determine new vs returning customers
            if customer_type_col:
                # Use explicit customer type column
                df_new = df[df[customer_type_col].astype(str).str.lower().isin([
                    'new', 'yes', '1', 'true', '新客户', '新', '是'
                ])]
                df_returning = df[~df.index.isin(df_new.index)]

                new_customers = int(df_new[customer_col].nunique())
                returning_customers = int(df_returning[customer_col].nunique())

                if amount_col:
                    new_customer_sales = float(df_new[amount_col].sum())
                    returning_customer_sales = float(df_returning[amount_col].sum())

            elif date_col:
                # Infer new vs returning based on first purchase date
                df[date_col] = pd.to_datetime(df[date_col], errors='coerce')

                # Get first purchase date for each customer
                first_purchase = df.groupby(customer_col)[date_col].min().reset_index()
                first_purchase.columns = [customer_col, 'first_purchase_date']

                # Determine analysis period
                max_date = df[date_col].max()
                min_date = df[date_col].min()

                if pd.notna(max_date) and pd.notna(min_date):
                    # Consider customers whose first purchase is in the last 30 days as new
                    new_threshold = max_date - pd.Timedelta(days=30)

                    new_customer_ids = first_purchase[
                        first_purchase['first_purchase_date'] >= new_threshold
                    ][customer_col].tolist()

                    new_customers = len(new_customer_ids)
                    returning_customers = total_customers - new_customers

                    if amount_col:
                        new_customer_sales = float(
                            df[df[customer_col].isin(new_customer_ids)][amount_col].sum()
                        )
                        returning_customer_sales = float(
                            df[~df[customer_col].isin(new_customer_ids)][amount_col].sum()
                        )
            else:
                # No way to determine new vs returning
                returning_customers = total_customers
                if amount_col:
                    returning_customer_sales = float(df[amount_col].sum())

            # Calculate ratios
            new_customer_ratio = self._safe_divide(new_customers * 100, total_customers)
            total_sales = new_customer_sales + returning_customer_sales

            # Build customer breakdown by sales
            customer_breakdown = []
            if amount_col:
                customer_sales = df.groupby(customer_col).agg({
                    amount_col: 'sum'
                }).reset_index()

                if order_col:
                    order_counts = df.groupby(customer_col)[order_col].nunique().reset_index()
                    order_counts.columns = [customer_col, 'order_count']
                    customer_sales = customer_sales.merge(order_counts, on=customer_col, how='left')
                else:
                    row_counts = df.groupby(customer_col).size().reset_index(name='order_count')
                    customer_sales = customer_sales.merge(row_counts, on=customer_col, how='left')

                customer_sales = customer_sales.sort_values(by=amount_col, ascending=False)

                # Top 10 customers
                for idx, row in customer_sales.head(10).iterrows():
                    sales = float(row[amount_col])
                    customer_breakdown.append({
                        "customer": str(row[customer_col]),
                        "sales_amount": self._round_value(sales),
                        "order_count": int(row.get('order_count', 0)),
                        "percentage": self._round_value(
                            self._safe_divide(sales * 100, total_sales)
                        )
                    })

            return self._success_response({
                "total_customers": total_customers,
                "new_customers": new_customers,
                "returning_customers": returning_customers,
                "new_customer_ratio": self._round_value(new_customer_ratio),
                "new_customer_sales": self._round_value(new_customer_sales),
                "returning_customer_sales": self._round_value(returning_customer_sales),
                "avg_sales_per_customer": self._round_value(
                    self._safe_divide(total_sales, total_customers)
                ),
                "customer_breakdown": customer_breakdown
            })

        except Exception as e:
            logger.error(f"Failed to analyze customers: {e}", exc_info=True)
            return self._error_response(str(e))

    def _calculate_growth_rate(
        self,
        df: pd.DataFrame,
        amount_col: str,
        date_col: str
    ) -> Optional[float]:
        """
        Calculate month-over-month growth rate

        Returns:
            Growth rate as percentage, or None if insufficient data
        """
        try:
            df = df.copy()
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])

            if df.empty:
                return None

            # Group by month
            df['month'] = df[date_col].dt.to_period('M')
            monthly = df.groupby('month')[amount_col].sum()

            if len(monthly) < 2:
                return None

            # Get last two months
            sorted_monthly = monthly.sort_index()
            current = float(sorted_monthly.iloc[-1])
            previous = float(sorted_monthly.iloc[-2])

            if previous == 0:
                return None

            return (current - previous) / previous * 100

        except Exception as e:
            logger.warning(f"Failed to calculate growth rate: {e}")
            return None
