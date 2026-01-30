from __future__ import annotations
"""
Region Analysis Service

Provides comprehensive regional sales analytics including:
- Region/Province/City ranking with hierarchy
- Regional opportunity scoring (growth + market size + penetration)
- Geographic heatmap data for ECharts map visualization
- Regional trends over time
- Hierarchical treemap data
"""
import logging
from typing import List, Optional, Dict, Any

import pandas as pd
import numpy as np

from .base import BaseAnalysisService

logger = logging.getLogger(__name__)


class RegionAnalysisService(BaseAnalysisService):
    """Regional sales analysis service with hierarchy support"""

    # Standard China regions mapping
    CHINA_REGIONS = {
        "华东": ["上海", "江苏", "浙江", "安徽", "福建", "江西", "山东"],
        "华北": ["北京", "天津", "河北", "山西", "内蒙古"],
        "华中": ["河南", "湖北", "湖南"],
        "华南": ["广东", "广西", "海南"],
        "西南": ["重庆", "四川", "贵州", "云南", "西藏"],
        "西北": ["陕西", "甘肃", "青海", "宁夏", "新疆"],
        "东北": ["辽宁", "吉林", "黑龙江"],
    }

    # Province name normalization mapping
    PROVINCE_ALIASES = {
        "内蒙古自治区": "内蒙古",
        "广西壮族自治区": "广西",
        "西藏自治区": "西藏",
        "宁夏回族自治区": "宁夏",
        "新疆维吾尔自治区": "新疆",
        "香港特别行政区": "香港",
        "澳门特别行政区": "澳门",
    }

    def __init__(self):
        super().__init__()

    def _clean_value(self, value: Any) -> Any:
        """Clean NaN/NaT values to None for JSON serialization"""
        if value is None:
            return None
        if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
            return None
        if pd.isna(value):
            return None
        return value

    def _round_clean(self, value: Optional[float], decimals: int = 2) -> Optional[float]:
        """Round value and clean NaN to None"""
        cleaned = self._clean_value(value)
        if cleaned is None:
            return None
        return self._round_value(cleaned, decimals)

    def get_region_ranking(
        self,
        data: List[dict],
        top_n: int = 10,
        rank_by: str = "sales",
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get region performance ranking

        Args:
            data: Sales data list
            top_n: Number of top regions to return
            rank_by: Ranking metric - 'sales', 'orders', or 'growth'
            field_mapping: Optional custom field name mapping

        Returns:
            Ranked list with: region, sales, orders, growth_rate, percentage
        """
        try:
            if not data:
                return self._success_response({
                    "ranking": [],
                    "total_regions": 0,
                    "total_sales": 0
                })

            df = self._to_dataframe(data)
            if df.empty:
                return self._success_response({
                    "ranking": [],
                    "total_regions": 0,
                    "total_sales": 0
                })

            # Find columns
            region_col = self._find_region_column(df, field_mapping)
            amount_col = self._find_amount_column(df, field_mapping)
            order_col = self._find_order_column(df, field_mapping)
            date_col = self._find_date_column(df, field_mapping)

            if not region_col:
                return self._error_response("Region column not found")
            if not amount_col:
                return self._error_response("Amount/Sales column not found")

            # Prepare data
            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)
            df[region_col] = df[region_col].fillna("Unknown").astype(str)

            # Aggregate by region
            agg_dict = {amount_col: 'sum'}
            grouped = df.groupby(region_col).agg(agg_dict).reset_index()
            grouped.columns = [region_col, 'total_sales']

            # Add order count
            if order_col:
                order_counts = df.groupby(region_col)[order_col].nunique().reset_index()
                order_counts.columns = [region_col, 'order_count']
                grouped = grouped.merge(order_counts, on=region_col, how='left')
            else:
                row_counts = df.groupby(region_col).size().reset_index(name='order_count')
                grouped = grouped.merge(row_counts, on=region_col, how='left')

            # Calculate growth rate if date column exists
            if date_col:
                growth_rates = self._calculate_region_growth_rates(df, region_col, amount_col, date_col)
                grouped = grouped.merge(growth_rates, on=region_col, how='left')
            else:
                grouped['growth_rate'] = None

            # Sort by specified metric
            sort_col = 'total_sales'
            if rank_by == 'orders':
                sort_col = 'order_count'
            elif rank_by == 'growth' and 'growth_rate' in grouped.columns:
                sort_col = 'growth_rate'
                grouped = grouped.dropna(subset=['growth_rate'])

            grouped = grouped.sort_values(by=sort_col, ascending=False)

            # Calculate totals for percentage
            total_sales = grouped['total_sales'].sum()

            # Build ranking list
            ranking = []
            for idx, row in grouped.head(top_n).iterrows():
                sales = float(row['total_sales'])
                percentage = self._safe_divide(sales * 100, total_sales)
                ranking.append({
                    "rank": len(ranking) + 1,
                    "region": str(row[region_col]),
                    "sales": self._round_value(sales),
                    "orders": int(row.get('order_count', 0)),
                    "growth_rate": self._round_clean(row.get('growth_rate')),
                    "percentage": self._round_value(percentage)
                })

            return self._success_response({
                "ranking": ranking,
                "total_regions": int(grouped[region_col].nunique()),
                "total_sales": self._round_value(total_sales)
            })

        except Exception as e:
            logger.error(f"Failed to calculate region ranking: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_province_ranking(
        self,
        data: List[dict],
        region: Optional[str] = None,
        top_n: int = 10,
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get province ranking, optionally filtered by region

        Args:
            data: Sales data list
            region: Optional region filter (e.g., "华东", "华北")
            top_n: Number of top provinces to return
            field_mapping: Optional custom field name mapping

        Returns:
            Ranked list with: province, region, sales, orders, percentage
        """
        try:
            if not data:
                return self._success_response({
                    "ranking": [],
                    "total_provinces": 0,
                    "filtered_by_region": region
                })

            df = self._to_dataframe(data)
            if df.empty:
                return self._success_response({
                    "ranking": [],
                    "total_provinces": 0,
                    "filtered_by_region": region
                })

            # Find columns
            province_col = self._find_province_column(df, field_mapping)
            region_col = self._find_region_column(df, field_mapping)
            amount_col = self._find_amount_column(df, field_mapping)
            order_col = self._find_order_column(df, field_mapping)

            if not province_col:
                return self._error_response("Province column not found")
            if not amount_col:
                return self._error_response("Amount/Sales column not found")

            # Prepare data
            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)
            df[province_col] = df[province_col].fillna("Unknown").astype(str)

            # Filter by region if specified
            if region and region_col:
                normalized_region = self._normalize_region_name(region)
                df = df[df[region_col].apply(
                    lambda x: normalized_region in self._normalize_region_name(str(x)) or
                              self._normalize_region_name(str(x)) in normalized_region
                )]

            if df.empty:
                return self._success_response({
                    "ranking": [],
                    "total_provinces": 0,
                    "filtered_by_region": region
                })

            # Aggregate by province
            agg_dict = {amount_col: 'sum'}
            if region_col:
                grouped = df.groupby([province_col, region_col]).agg(agg_dict).reset_index()
                grouped.columns = [province_col, 'region', 'total_sales']
            else:
                grouped = df.groupby(province_col).agg(agg_dict).reset_index()
                grouped.columns = [province_col, 'total_sales']
                grouped['region'] = self._infer_region_from_province(grouped[province_col])

            # Add order count
            if order_col:
                order_counts = df.groupby(province_col)[order_col].nunique().reset_index()
                order_counts.columns = [province_col, 'order_count']
                grouped = grouped.merge(order_counts, on=province_col, how='left')
            else:
                row_counts = df.groupby(province_col).size().reset_index(name='order_count')
                grouped = grouped.merge(row_counts, on=province_col, how='left')

            # Sort by sales descending
            grouped = grouped.sort_values(by='total_sales', ascending=False)

            # Calculate total for percentage
            total_sales = grouped['total_sales'].sum()

            # Build ranking list
            ranking = []
            for idx, row in grouped.head(top_n).iterrows():
                sales = float(row['total_sales'])
                percentage = self._safe_divide(sales * 100, total_sales)
                ranking.append({
                    "rank": len(ranking) + 1,
                    "province": str(row[province_col]),
                    "region": str(row.get('region', '')),
                    "sales": self._round_value(sales),
                    "orders": int(row.get('order_count', 0)),
                    "percentage": self._round_value(percentage)
                })

            return self._success_response({
                "ranking": ranking,
                "total_provinces": int(grouped[province_col].nunique()),
                "total_sales": self._round_value(total_sales),
                "filtered_by_region": region
            })

        except Exception as e:
            logger.error(f"Failed to calculate province ranking: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_city_ranking(
        self,
        data: List[dict],
        province: Optional[str] = None,
        top_n: int = 10,
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get city ranking, optionally filtered by province

        Args:
            data: Sales data list
            province: Optional province filter
            top_n: Number of top cities to return
            field_mapping: Optional custom field name mapping

        Returns:
            Ranked list with: city, province, sales, orders, percentage
        """
        try:
            if not data:
                return self._success_response({
                    "ranking": [],
                    "total_cities": 0,
                    "filtered_by_province": province
                })

            df = self._to_dataframe(data)
            if df.empty:
                return self._success_response({
                    "ranking": [],
                    "total_cities": 0,
                    "filtered_by_province": province
                })

            # Find columns
            city_col = self._find_city_column(df, field_mapping)
            province_col = self._find_province_column(df, field_mapping)
            amount_col = self._find_amount_column(df, field_mapping)
            order_col = self._find_order_column(df, field_mapping)

            if not city_col:
                return self._error_response("City column not found")
            if not amount_col:
                return self._error_response("Amount/Sales column not found")

            # Prepare data
            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)
            df[city_col] = df[city_col].fillna("Unknown").astype(str)

            # Filter by province if specified
            if province and province_col:
                df = df[df[province_col].astype(str).str.contains(province, na=False)]

            if df.empty:
                return self._success_response({
                    "ranking": [],
                    "total_cities": 0,
                    "filtered_by_province": province
                })

            # Aggregate by city
            group_cols = [city_col]
            if province_col:
                group_cols.append(province_col)

            agg_dict = {amount_col: 'sum'}
            grouped = df.groupby(group_cols).agg(agg_dict).reset_index()

            if province_col:
                grouped.columns = [city_col, 'province', 'total_sales']
            else:
                grouped.columns = [city_col, 'total_sales']
                grouped['province'] = ''

            # Add order count
            if order_col:
                order_counts = df.groupby(city_col)[order_col].nunique().reset_index()
                order_counts.columns = [city_col, 'order_count']
                grouped = grouped.merge(order_counts, on=city_col, how='left')
            else:
                row_counts = df.groupby(city_col).size().reset_index(name='order_count')
                grouped = grouped.merge(row_counts, on=city_col, how='left')

            # Sort by sales descending
            grouped = grouped.sort_values(by='total_sales', ascending=False)

            # Calculate total for percentage
            total_sales = grouped['total_sales'].sum()

            # Build ranking list
            ranking = []
            for idx, row in grouped.head(top_n).iterrows():
                sales = float(row['total_sales'])
                percentage = self._safe_divide(sales * 100, total_sales)
                ranking.append({
                    "rank": len(ranking) + 1,
                    "city": str(row[city_col]),
                    "province": str(row.get('province', '')),
                    "sales": self._round_value(sales),
                    "orders": int(row.get('order_count', 0)),
                    "percentage": self._round_value(percentage)
                })

            return self._success_response({
                "ranking": ranking,
                "total_cities": int(grouped[city_col].nunique()),
                "total_sales": self._round_value(total_sales),
                "filtered_by_province": province
            })

        except Exception as e:
            logger.error(f"Failed to calculate city ranking: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_region_detail(
        self,
        data: List[dict],
        region: str,
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get detailed metrics for a specific region

        Args:
            data: Sales data list
            region: Region name to analyze
            field_mapping: Optional custom field name mapping

        Returns:
            KPIs, top provinces, trend data for the region
        """
        try:
            if not data:
                return self._success_response({
                    "region": region,
                    "kpis": {},
                    "top_provinces": [],
                    "trend": []
                })

            df = self._to_dataframe(data)
            if df.empty:
                return self._success_response({
                    "region": region,
                    "kpis": {},
                    "top_provinces": [],
                    "trend": []
                })

            # Find columns
            region_col = self._find_region_column(df, field_mapping)
            province_col = self._find_province_column(df, field_mapping)
            amount_col = self._find_amount_column(df, field_mapping)
            cost_col = self._find_cost_column(df, field_mapping)
            target_col = self._find_target_column(df, field_mapping)
            order_col = self._find_order_column(df, field_mapping)
            customer_col = self._find_customer_column(df, field_mapping)
            date_col = self._find_date_column(df, field_mapping)

            if not region_col:
                return self._error_response("Region column not found")
            if not amount_col:
                return self._error_response("Amount/Sales column not found")

            # Prepare data
            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)

            # Filter by region
            normalized_region = self._normalize_region_name(region)
            region_df = df[df[region_col].apply(
                lambda x: normalized_region in self._normalize_region_name(str(x)) or
                          self._normalize_region_name(str(x)) in normalized_region
            )].copy()

            if region_df.empty:
                return self._success_response({
                    "region": region,
                    "kpis": {},
                    "top_provinces": [],
                    "trend": []
                })

            # Calculate KPIs
            total_sales = float(region_df[amount_col].sum())
            order_count = int(region_df[order_col].nunique()) if order_col else len(region_df)

            kpis = {
                "total_sales": self._round_value(total_sales),
                "order_count": order_count,
                "avg_order_value": self._round_value(self._safe_divide(total_sales, order_count))
            }

            # Add cost and margin if available
            if cost_col:
                region_df[cost_col] = pd.to_numeric(region_df[cost_col], errors='coerce').fillna(0)
                total_cost = float(region_df[cost_col].sum())
                gross_profit = total_sales - total_cost
                gross_margin = self._safe_divide(gross_profit * 100, total_sales)
                kpis["total_cost"] = self._round_value(total_cost)
                kpis["gross_profit"] = self._round_value(gross_profit)
                kpis["gross_margin"] = self._round_value(gross_margin)

            # Add target completion if available
            if target_col:
                region_df[target_col] = pd.to_numeric(region_df[target_col], errors='coerce').fillna(0)
                total_target = float(region_df[target_col].sum())
                completion_rate = self._safe_divide(total_sales * 100, total_target)
                kpis["target"] = self._round_value(total_target)
                kpis["completion_rate"] = self._round_value(completion_rate)

            # Add customer count if available
            if customer_col:
                customer_count = int(region_df[customer_col].nunique())
                kpis["customer_count"] = customer_count

            # Get top provinces
            top_provinces = []
            if province_col:
                prov_grouped = region_df.groupby(province_col)[amount_col].sum().reset_index()
                prov_grouped.columns = ['province', 'sales']
                prov_grouped = prov_grouped.sort_values('sales', ascending=False).head(5)
                for idx, row in prov_grouped.iterrows():
                    top_provinces.append({
                        "province": str(row['province']),
                        "sales": self._round_value(float(row['sales'])),
                        "percentage": self._round_value(
                            self._safe_divide(float(row['sales']) * 100, total_sales)
                        )
                    })

            # Get trend data
            trend = []
            if date_col:
                region_df[date_col] = pd.to_datetime(region_df[date_col], errors='coerce')
                region_df = region_df.dropna(subset=[date_col])
                if not region_df.empty:
                    region_df['month'] = region_df[date_col].dt.to_period('M')
                    monthly = region_df.groupby('month')[amount_col].sum().reset_index()
                    monthly = monthly.sort_values('month')
                    for idx, row in monthly.iterrows():
                        trend.append({
                            "period": str(row['month']),
                            "sales": self._round_value(float(row[amount_col]))
                        })

            return self._success_response({
                "region": region,
                "kpis": kpis,
                "top_provinces": top_provinces,
                "trend": trend
            })

        except Exception as e:
            logger.error(f"Failed to get region detail: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_region_trend(
        self,
        data: List[dict],
        period_type: str = "monthly",
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get regional trends over time

        Args:
            data: Sales data list
            period_type: 'daily', 'weekly', or 'monthly'
            field_mapping: Optional custom field name mapping

        Returns:
            Time series with: period, region1_value, region2_value, ...
        """
        try:
            if not data:
                return self._success_response({
                    "trend": [],
                    "regions": [],
                    "period_type": period_type
                })

            df = self._to_dataframe(data)
            if df.empty:
                return self._success_response({
                    "trend": [],
                    "regions": [],
                    "period_type": period_type
                })

            # Find columns
            region_col = self._find_region_column(df, field_mapping)
            amount_col = self._find_amount_column(df, field_mapping)
            date_col = self._find_date_column(df, field_mapping)

            if not region_col:
                return self._error_response("Region column not found")
            if not amount_col:
                return self._error_response("Amount/Sales column not found")
            if not date_col:
                return self._error_response("Date column not found")

            # Prepare data
            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])

            if df.empty:
                return self._success_response({
                    "trend": [],
                    "regions": [],
                    "period_type": period_type
                })

            df[region_col] = df[region_col].fillna("Unknown").astype(str)

            # Create period column
            if period_type == "weekly":
                df['period'] = df[date_col].dt.to_period('W').apply(lambda x: x.start_time.strftime('%Y-%m-%d'))
            elif period_type == "daily":
                df['period'] = df[date_col].dt.strftime('%Y-%m-%d')
            else:  # monthly
                df['period'] = df[date_col].dt.to_period('M').astype(str)

            # Get all regions
            regions = sorted(df[region_col].unique().tolist())

            # Pivot to get region values by period
            pivot = df.pivot_table(
                index='period',
                columns=region_col,
                values=amount_col,
                aggfunc='sum',
                fill_value=0
            ).reset_index()

            # Build trend list
            trend = []
            for idx, row in pivot.iterrows():
                item = {"period": row['period']}
                for region in regions:
                    if region in row:
                        item[region] = self._round_value(float(row[region]))
                    else:
                        item[region] = 0
                trend.append(item)

            return self._success_response({
                "trend": trend,
                "regions": regions,
                "period_type": period_type
            })

        except Exception as e:
            logger.error(f"Failed to calculate region trend: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_geographic_heatmap_data(
        self,
        data: List[dict],
        level: str = "province",
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get data for geographic heatmap visualization (ECharts map)

        Args:
            data: Sales data list
            level: Geographic level - 'province' or 'city'
            field_mapping: Optional custom field name mapping

        Returns:
            List of {name, value} for ECharts map
        """
        try:
            if not data:
                return self._success_response({
                    "heatmap_data": [],
                    "level": level,
                    "max_value": 0,
                    "min_value": 0
                })

            df = self._to_dataframe(data)
            if df.empty:
                return self._success_response({
                    "heatmap_data": [],
                    "level": level,
                    "max_value": 0,
                    "min_value": 0
                })

            # Find columns
            if level == "city":
                geo_col = self._find_city_column(df, field_mapping)
            else:
                geo_col = self._find_province_column(df, field_mapping)

            amount_col = self._find_amount_column(df, field_mapping)
            order_col = self._find_order_column(df, field_mapping)

            if not geo_col:
                return self._error_response(f"{level.capitalize()} column not found")
            if not amount_col:
                return self._error_response("Amount/Sales column not found")

            # Prepare data
            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)
            df[geo_col] = df[geo_col].fillna("Unknown").astype(str)

            # Aggregate by geographic unit
            agg_dict = {amount_col: 'sum'}
            grouped = df.groupby(geo_col).agg(agg_dict).reset_index()
            grouped.columns = [geo_col, 'value']

            # Add order count if available
            if order_col:
                order_counts = df.groupby(geo_col)[order_col].nunique().reset_index()
                order_counts.columns = [geo_col, 'order_count']
                grouped = grouped.merge(order_counts, on=geo_col, how='left')
            else:
                grouped['order_count'] = 0

            # Calculate statistics
            max_value = float(grouped['value'].max()) if not grouped.empty else 0
            min_value = float(grouped['value'].min()) if not grouped.empty else 0

            # Build heatmap data for ECharts
            heatmap_data = []
            for idx, row in grouped.iterrows():
                name = str(row[geo_col])
                value = float(row['value'])

                # Normalize province names for ECharts map matching
                if level == "province":
                    name = self._normalize_province_for_map(name)

                # Calculate heat level (0-1)
                heat_value = self._safe_divide(value, max_value) if max_value > 0 else 0

                heatmap_data.append({
                    "name": name,
                    "value": self._round_value(value),
                    "orderCount": int(row.get('order_count', 0)),
                    "heatValue": self._round_value(heat_value, 4),
                    "colorLevel": self._determine_color_level(heat_value)
                })

            # Sort by value descending
            heatmap_data.sort(key=lambda x: x['value'], reverse=True)

            return self._success_response({
                "heatmap_data": heatmap_data,
                "level": level,
                "max_value": self._round_value(max_value),
                "min_value": self._round_value(min_value)
            })

        except Exception as e:
            logger.error(f"Failed to generate heatmap data: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_region_opportunity_scores(
        self,
        data: List[dict],
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Calculate opportunity scores for regions

        Score based on: growth_rate, market_size, penetration_rate

        Args:
            data: Sales data list
            field_mapping: Optional custom field name mapping

        Returns:
            List with: region, opportunity_score, growth_score, size_score, penetration_score
        """
        try:
            if not data:
                return self._success_response({
                    "scores": [],
                    "total_regions": 0
                })

            df = self._to_dataframe(data)
            if df.empty:
                return self._success_response({
                    "scores": [],
                    "total_regions": 0
                })

            # Find columns
            region_col = self._find_region_column(df, field_mapping)
            amount_col = self._find_amount_column(df, field_mapping)
            cost_col = self._find_cost_column(df, field_mapping)
            customer_col = self._find_customer_column(df, field_mapping)
            order_col = self._find_order_column(df, field_mapping)
            date_col = self._find_date_column(df, field_mapping)

            if not region_col:
                return self._error_response("Region column not found")
            if not amount_col:
                return self._error_response("Amount/Sales column not found")

            # Prepare data
            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)
            df[region_col] = df[region_col].fillna("Unknown").astype(str)

            # Aggregate by region
            regions = df[region_col].unique()
            total_sales = df[amount_col].sum()

            scores = []
            for region in regions:
                region_df = df[df[region_col] == region].copy()

                # Current sales
                current_sales = float(region_df[amount_col].sum())

                # Market size score (based on percentage of total)
                size_ratio = self._safe_divide(current_sales, total_sales)
                size_score = min(size_ratio * 300, 100)  # Scale: 33% share = 100 score

                # Growth score
                growth_score = 50  # Default
                growth_rate = None
                if date_col:
                    growth_result = self._calculate_single_region_growth(
                        region_df, amount_col, date_col
                    )
                    if growth_result is not None:
                        growth_rate = growth_result
                        # Growth > 50% = 100, 0% = 50, < -50% = 0
                        growth_score = max(0, min(100, growth_rate + 50))

                # Penetration score (based on customer count and order frequency)
                penetration_score = 50  # Default
                customer_count = 0
                order_count = len(region_df)

                if customer_col:
                    customer_count = int(region_df[customer_col].nunique())
                    # Simple formula: customers * 10 + orders / 10, max 100
                    penetration_score = min(100, customer_count * 10 + order_count / 10)

                if order_col:
                    order_count = int(region_df[order_col].nunique())

                # Margin score
                margin_score = 50  # Default
                gross_margin = None
                if cost_col:
                    region_df[cost_col] = pd.to_numeric(region_df[cost_col], errors='coerce').fillna(0)
                    total_cost = float(region_df[cost_col].sum())
                    if current_sales > 0:
                        gross_margin = (current_sales - total_cost) / current_sales * 100
                        # Margin > 30% = 100, 15% = 50, 0% = 0
                        margin_score = max(0, min(100, gross_margin * 3.33))

                # Calculate total opportunity score (weighted average)
                # Weights: growth=30%, size=25%, margin=25%, penetration=20%
                total_score = (
                    growth_score * 0.30 +
                    size_score * 0.25 +
                    margin_score * 0.25 +
                    penetration_score * 0.20
                )

                # Determine opportunity level
                if total_score >= 70:
                    opportunity_level = "HIGH"
                elif total_score >= 40:
                    opportunity_level = "MEDIUM"
                else:
                    opportunity_level = "LOW"

                # Generate recommendation
                recommendation = self._generate_opportunity_recommendation(
                    region, total_score, growth_score, size_score,
                    margin_score, penetration_score
                )

                scores.append({
                    "region": region,
                    "opportunity_score": self._round_value(total_score),
                    "opportunity_level": opportunity_level,
                    "growth_score": self._round_value(growth_score),
                    "size_score": self._round_value(size_score),
                    "margin_score": self._round_value(margin_score),
                    "penetration_score": self._round_value(penetration_score),
                    "current_sales": self._round_value(current_sales),
                    "growth_rate": self._round_value(growth_rate) if growth_rate is not None else None,
                    "gross_margin": self._round_value(gross_margin) if gross_margin is not None else None,
                    "customer_count": customer_count,
                    "order_count": order_count,
                    "recommendation": recommendation
                })

            # Sort by opportunity score descending
            scores.sort(key=lambda x: x['opportunity_score'], reverse=True)

            return self._success_response({
                "scores": scores,
                "total_regions": len(scores)
            })

        except Exception as e:
            logger.error(f"Failed to calculate opportunity scores: {e}", exc_info=True)
            return self._error_response(str(e))

    def get_hierarchy_data(
        self,
        data: List[dict],
        field_mapping: Optional[Dict[str, str]] = None
    ) -> dict:
        """
        Get hierarchical data for treemap (region > province > city)

        Args:
            data: Sales data list
            field_mapping: Optional custom field name mapping

        Returns:
            Nested structure for ECharts treemap
        """
        try:
            if not data:
                return self._success_response({
                    "hierarchy": [],
                    "total_value": 0
                })

            df = self._to_dataframe(data)
            if df.empty:
                return self._success_response({
                    "hierarchy": [],
                    "total_value": 0
                })

            # Find columns
            region_col = self._find_region_column(df, field_mapping)
            province_col = self._find_province_column(df, field_mapping)
            city_col = self._find_city_column(df, field_mapping)
            amount_col = self._find_amount_column(df, field_mapping)

            if not amount_col:
                return self._error_response("Amount/Sales column not found")

            # Prepare data
            df[amount_col] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)

            # Fill missing geographic columns
            if region_col:
                df[region_col] = df[region_col].fillna("Unknown").astype(str)
            else:
                # Try to infer region from province
                if province_col:
                    df['_region'] = self._infer_region_from_province(df[province_col])
                    region_col = '_region'
                else:
                    df['_region'] = "Unknown"
                    region_col = '_region'

            if province_col:
                df[province_col] = df[province_col].fillna("Unknown").astype(str)
            else:
                df['_province'] = "Unknown"
                province_col = '_province'

            if city_col:
                df[city_col] = df[city_col].fillna("Unknown").astype(str)
            else:
                df['_city'] = "Unknown"
                city_col = '_city'

            # Build hierarchy
            hierarchy = []
            total_value = float(df[amount_col].sum())

            # Group by region
            for region in df[region_col].unique():
                region_df = df[df[region_col] == region]
                region_value = float(region_df[amount_col].sum())

                region_node = {
                    "name": region,
                    "value": self._round_value(region_value),
                    "children": []
                }

                # Group by province within region
                for province in region_df[province_col].unique():
                    prov_df = region_df[region_df[province_col] == province]
                    prov_value = float(prov_df[amount_col].sum())

                    prov_node = {
                        "name": province,
                        "value": self._round_value(prov_value),
                        "children": []
                    }

                    # Group by city within province
                    city_grouped = prov_df.groupby(city_col)[amount_col].sum().reset_index()
                    city_grouped = city_grouped.sort_values(amount_col, ascending=False)

                    for idx, row in city_grouped.iterrows():
                        city_node = {
                            "name": str(row[city_col]),
                            "value": self._round_value(float(row[amount_col]))
                        }
                        prov_node["children"].append(city_node)

                    # Sort province children by value
                    prov_node["children"].sort(key=lambda x: x["value"], reverse=True)
                    region_node["children"].append(prov_node)

                # Sort region children by value
                region_node["children"].sort(key=lambda x: x["value"], reverse=True)
                hierarchy.append(region_node)

            # Sort regions by value
            hierarchy.sort(key=lambda x: x["value"], reverse=True)

            return self._success_response({
                "hierarchy": hierarchy,
                "total_value": self._round_value(total_value)
            })

        except Exception as e:
            logger.error(f"Failed to build hierarchy data: {e}", exc_info=True)
            return self._error_response(str(e))

    # ==================== Helper Methods ====================

    def _find_region_column(
        self, df: pd.DataFrame, field_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Find region column"""
        if field_mapping and 'region' in field_mapping:
            return field_mapping['region']
        return self._find_column(df, [
            "region", "area", "zone", "territory", "market",
            "区域", "大区", "地区", "销售区域", "市场区域"
        ])

    def _find_province_column(
        self, df: pd.DataFrame, field_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Find province column"""
        if field_mapping and 'province' in field_mapping:
            return field_mapping['province']
        return self._find_column(df, [
            "province", "state", "prov",
            "省份", "省", "省区"
        ])

    def _find_city_column(
        self, df: pd.DataFrame, field_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Find city column"""
        if field_mapping and 'city' in field_mapping:
            return field_mapping['city']
        return self._find_column(df, [
            "city", "town", "municipality",
            "城市", "市", "地级市"
        ])

    def _find_amount_column(
        self, df: pd.DataFrame, field_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Find amount/sales column"""
        if field_mapping and 'amount' in field_mapping:
            return field_mapping['amount']
        if field_mapping and 'sales' in field_mapping:
            return field_mapping['sales']
        return self._find_column(df, [
            "amount", "sales", "revenue", "total", "sales_amount",
            "金额", "销售额", "销售金额", "收入", "营业额"
        ])

    def _find_cost_column(
        self, df: pd.DataFrame, field_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Find cost column"""
        if field_mapping and 'cost' in field_mapping:
            return field_mapping['cost']
        return self._find_column(df, [
            "cost", "total_cost", "cogs",
            "成本", "总成本", "销售成本"
        ])

    def _find_target_column(
        self, df: pd.DataFrame, field_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Find target column"""
        if field_mapping and 'target' in field_mapping:
            return field_mapping['target']
        return self._find_column(df, [
            "target", "goal", "budget", "monthly_target",
            "目标", "销售目标", "预算", "月度目标"
        ])

    def _find_order_column(
        self, df: pd.DataFrame, field_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Find order column"""
        if field_mapping and 'order' in field_mapping:
            return field_mapping['order']
        return self._find_column(df, [
            "order_id", "order_no", "order_number", "id",
            "订单号", "订单ID", "单号"
        ])

    def _find_customer_column(
        self, df: pd.DataFrame, field_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Find customer column"""
        if field_mapping and 'customer' in field_mapping:
            return field_mapping['customer']
        return self._find_column(df, [
            "customer", "customer_id", "customer_name", "client",
            "客户", "客户ID", "客户名称", "客户编号"
        ])

    def _find_date_column(
        self, df: pd.DataFrame, field_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Find date column"""
        if field_mapping and 'date' in field_mapping:
            return field_mapping['date']
        return self._find_column(df, [
            "date", "order_date", "sale_date", "time", "created_at",
            "日期", "订单日期", "销售日期", "时间"
        ])

    def _normalize_region_name(self, region: str) -> str:
        """Normalize region name for matching"""
        if not region:
            return ""
        return (region
                .replace("地区", "")
                .replace("区域", "")
                .replace("大区", "")
                .strip())

    def _normalize_province_for_map(self, province: str) -> str:
        """Normalize province name for ECharts map matching"""
        if not province:
            return "Unknown"

        # Check aliases first
        if province in self.PROVINCE_ALIASES:
            return self.PROVINCE_ALIASES[province]

        # Remove common suffixes
        result = (province
                  .replace("省", "")
                  .replace("市", "")
                  .replace("自治区", "")
                  .replace("特别行政区", "")
                  .replace("壮族", "")
                  .replace("回族", "")
                  .replace("维吾尔", "")
                  .strip())

        return result if result else province

    def _infer_region_from_province(self, provinces: pd.Series) -> pd.Series:
        """Infer region from province names using CHINA_REGIONS mapping"""
        def get_region(province: str) -> str:
            if not province:
                return "Unknown"
            normalized = self._normalize_province_for_map(str(province))
            for region, prov_list in self.CHINA_REGIONS.items():
                if normalized in prov_list or any(
                    normalized in p or p in normalized for p in prov_list
                ):
                    return region
            return "Other"

        return provinces.apply(get_region)

    def _calculate_region_growth_rates(
        self,
        df: pd.DataFrame,
        region_col: str,
        amount_col: str,
        date_col: str
    ) -> pd.DataFrame:
        """Calculate growth rates for all regions"""
        try:
            df = df.copy()
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])

            if df.empty:
                return pd.DataFrame(columns=[region_col, 'growth_rate'])

            # Group by month and region
            df['month'] = df[date_col].dt.to_period('M')
            monthly = df.groupby(['month', region_col])[amount_col].sum().reset_index()

            if len(monthly['month'].unique()) < 2:
                return pd.DataFrame(columns=[region_col, 'growth_rate'])

            # Get last two months
            months = sorted(monthly['month'].unique())
            current_month = months[-1]
            previous_month = months[-2]

            current = monthly[monthly['month'] == current_month][[region_col, amount_col]]
            current.columns = [region_col, 'current']

            previous = monthly[monthly['month'] == previous_month][[region_col, amount_col]]
            previous.columns = [region_col, 'previous']

            merged = current.merge(previous, on=region_col, how='outer').fillna(0)
            merged['growth_rate'] = merged.apply(
                lambda row: self._safe_divide(
                    (row['current'] - row['previous']) * 100,
                    row['previous']
                ) if row['previous'] > 0 else None,
                axis=1
            )

            return merged[[region_col, 'growth_rate']]

        except Exception as e:
            logger.warning(f"Failed to calculate growth rates: {e}")
            return pd.DataFrame(columns=[region_col, 'growth_rate'])

    def _calculate_single_region_growth(
        self,
        df: pd.DataFrame,
        amount_col: str,
        date_col: str
    ) -> Optional[float]:
        """Calculate growth rate for a single region"""
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

            sorted_monthly = monthly.sort_index()
            current = float(sorted_monthly.iloc[-1])
            previous = float(sorted_monthly.iloc[-2])

            if previous == 0:
                return None

            return (current - previous) / previous * 100

        except Exception:
            return None

    def _determine_color_level(self, heat_value: float) -> str:
        """Determine color level for heatmap"""
        if heat_value >= 0.7:
            return "HIGH"
        elif heat_value >= 0.3:
            return "MEDIUM"
        else:
            return "LOW"

    def _generate_opportunity_recommendation(
        self,
        region: str,
        total_score: float,
        growth_score: float,
        size_score: float,
        margin_score: float,
        penetration_score: float
    ) -> str:
        """Generate recommendation based on opportunity scores"""
        scores = {
            "growth": growth_score,
            "market_size": size_score,
            "margin": margin_score,
            "penetration": penetration_score
        }

        # Find strongest and weakest dimensions
        strongest = max(scores, key=scores.get)
        weakest = min(scores, key=scores.get)

        # Map to Chinese names
        dimension_names = {
            "growth": "growth_rate",
            "market_size": "market_size",
            "margin": "profit_margin",
            "penetration": "market_penetration"
        }

        # Determine opportunity level
        if total_score >= 70:
            level_desc = f"{region} is a high-potential region"
        elif total_score >= 40:
            level_desc = f"{region} has moderate development potential"
        else:
            level_desc = f"{region} currently has limited potential"

        return (
            f"{level_desc}. "
            f"Strength: {dimension_names[strongest]}. "
            f"Recommend improving: {dimension_names[weakest]}."
        )
