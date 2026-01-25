from __future__ import annotations
"""
Field Detector Service

Detects field types from sample data including:
- Data type (numeric, string, date, boolean)
- Semantic type (amount, quantity, percentage, date, category, etc.)
- Statistical properties
"""
import logging
import re
from typing import Any, Optional, List, Dict
from enum import Enum
from datetime import datetime

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class DataType(str, Enum):
    """Basic data types"""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    UNKNOWN = "unknown"


class SemanticType(str, Enum):
    """Semantic field types for business intelligence"""
    # Numeric measures
    AMOUNT = "amount"  # Currency amounts (sales, revenue, cost)
    QUANTITY = "quantity"  # Count/quantity values
    PERCENTAGE = "percentage"  # Percentage values
    RATE = "rate"  # Rate values (growth rate, etc.)

    # Dimensions
    DATE = "date"  # Date dimension
    TIME = "time"  # Time dimension
    CATEGORY = "category"  # Categorical dimension
    GEOGRAPHY = "geography"  # Geographic dimension
    PRODUCT = "product"  # Product dimension
    CUSTOMER = "customer"  # Customer dimension

    # Identifiers
    ID = "id"  # Identifier fields
    CODE = "code"  # Code fields

    # Text
    NAME = "name"  # Name fields
    DESCRIPTION = "description"  # Description/text fields

    # Other
    UNKNOWN = "unknown"


class ChartRole(str, Enum):
    """Recommended chart roles for fields"""
    DIMENSION = "dimension"  # X-axis, grouping
    MEASURE = "measure"  # Y-axis, values
    TIME = "time"  # Time axis
    SERIES = "series"  # Series grouping
    TOOLTIP = "tooltip"  # Additional info


class FieldDetector:
    """Detects field types and properties from data"""

    # Patterns for semantic type detection
    AMOUNT_PATTERNS = [
        r'(sales|revenue|income|cost|expense|price|amount|payment|fee|total)',
        r'(金额|销售额|收入|成本|费用|价格|总计|营收)'
    ]

    QUANTITY_PATTERNS = [
        r'(count|quantity|number|qty|num|volume|units)',
        r'(数量|数目|件数|个数|总数)'
    ]

    PERCENTAGE_PATTERNS = [
        r'(rate|ratio|percent|pct|margin|growth)',
        r'(率|比|百分比|增长率|占比)'
    ]

    DATE_PATTERNS = [
        r'(date|time|day|month|year|period|quarter)',
        r'(日期|时间|月份|年份|季度|周期)'
    ]

    CATEGORY_PATTERNS = [
        r'(category|type|class|group|segment|channel)',
        r'(类别|类型|分类|分组|渠道|部门)'
    ]

    GEOGRAPHY_PATTERNS = [
        r'(region|country|city|province|area|location|address)',
        r'(地区|国家|城市|省份|区域|地址)'
    ]

    PRODUCT_PATTERNS = [
        r'(product|item|sku|goods|material)',
        r'(产品|商品|物料|货品)'
    ]

    ID_PATTERNS = [
        r'(id|code|no|number)$',
        r'(编号|编码|号码)$'
    ]

    def __init__(self):
        self.sample_size = 100  # Number of rows to sample for detection

    def detect_fields(self, headers: List[str], rows: List[List[Any]]) -> List[dict]:
        """
        Detect field types for all columns

        Args:
            headers: Column headers
            rows: Data rows

        Returns:
            List of field detection results
        """
        results = []

        # Convert to DataFrame for easier analysis
        df = pd.DataFrame(rows, columns=headers)

        for col in headers:
            field_info = self.detect_single_field(col, df[col])
            results.append(field_info)

        return results

    def detect_single_field(self, field_name: str, values: pd.Series) -> dict:
        """
        Detect type for a single field

        Args:
            field_name: Column name
            values: Column values

        Returns:
            Field detection result
        """
        # Sample values for analysis
        sample = values.dropna().head(self.sample_size)

        # Detect basic data type
        data_type = self._detect_data_type(sample)

        # Detect semantic type based on name and values
        semantic_type = self._detect_semantic_type(field_name, sample, data_type)

        # Determine chart role
        chart_role = self._determine_chart_role(data_type, semantic_type)

        # Calculate statistics for numeric fields
        statistics = self._calculate_statistics(values, data_type)

        # Get unique values for categorical fields
        unique_values = None
        if semantic_type in [SemanticType.CATEGORY, SemanticType.PRODUCT, SemanticType.GEOGRAPHY]:
            unique_count = values.nunique()
            if unique_count <= 50:
                unique_values = values.dropna().unique().tolist()[:50]

        return {
            "fieldName": field_name,
            "dataType": data_type.value,
            "semanticType": semantic_type.value,
            "chartRole": chart_role.value,
            "nullable": values.isna().any(),
            "nullCount": int(values.isna().sum()),
            "uniqueCount": int(values.nunique()),
            "sampleValues": sample.head(5).tolist(),
            "statistics": statistics,
            "uniqueValues": unique_values
        }

    def _detect_data_type(self, sample: pd.Series) -> DataType:
        """Detect basic data type from sample values"""
        if sample.empty:
            return DataType.UNKNOWN

        # Try to infer type
        # Check for boolean
        unique_lower = set(str(v).lower() for v in sample.dropna())
        if unique_lower.issubset({'true', 'false', '1', '0', 'yes', 'no', '是', '否'}):
            return DataType.BOOLEAN

        # Check for numeric FIRST (before date, because pd.to_datetime can parse numbers as timestamps)
        numeric_sample = pd.to_numeric(sample, errors='coerce')
        if numeric_sample.notna().sum() > len(sample) * 0.8:
            # Check if integer or float
            non_null = numeric_sample.dropna()
            if (non_null == non_null.astype(int)).all():
                return DataType.INTEGER
            return DataType.FLOAT

        # Check for date/datetime (only for non-numeric values)
        try:
            parsed_dates = pd.to_datetime(sample, errors='coerce')
            if parsed_dates.notna().sum() > len(sample) * 0.8:
                # Additional validation: check if dates are in reasonable range (1900-2100)
                valid_dates = parsed_dates.dropna()
                if len(valid_dates) > 0:
                    min_year = valid_dates.min().year
                    max_year = valid_dates.max().year
                    if 1900 <= min_year <= 2100 and 1900 <= max_year <= 2100:
                        # Check if it has time component
                        if any(d.hour != 0 or d.minute != 0 for d in valid_dates):
                            return DataType.DATETIME
                        return DataType.DATE
        except:
            pass

        return DataType.STRING

    def _detect_semantic_type(
        self,
        field_name: str,
        sample: pd.Series,
        data_type: DataType
    ) -> SemanticType:
        """Detect semantic type based on field name and values"""
        name_lower = field_name.lower()

        # Check patterns against field name
        for pattern in self.DATE_PATTERNS:
            if re.search(pattern, name_lower, re.IGNORECASE):
                return SemanticType.DATE

        if data_type in [DataType.DATE, DataType.DATETIME]:
            return SemanticType.DATE

        for pattern in self.AMOUNT_PATTERNS:
            if re.search(pattern, name_lower, re.IGNORECASE):
                return SemanticType.AMOUNT

        for pattern in self.QUANTITY_PATTERNS:
            if re.search(pattern, name_lower, re.IGNORECASE):
                return SemanticType.QUANTITY

        for pattern in self.PERCENTAGE_PATTERNS:
            if re.search(pattern, name_lower, re.IGNORECASE):
                return SemanticType.PERCENTAGE

        for pattern in self.CATEGORY_PATTERNS:
            if re.search(pattern, name_lower, re.IGNORECASE):
                return SemanticType.CATEGORY

        for pattern in self.GEOGRAPHY_PATTERNS:
            if re.search(pattern, name_lower, re.IGNORECASE):
                return SemanticType.GEOGRAPHY

        for pattern in self.PRODUCT_PATTERNS:
            if re.search(pattern, name_lower, re.IGNORECASE):
                return SemanticType.PRODUCT

        for pattern in self.ID_PATTERNS:
            if re.search(pattern, name_lower, re.IGNORECASE):
                return SemanticType.ID

        # Infer from data type if name patterns don't match
        if data_type in [DataType.INTEGER, DataType.FLOAT]:
            # Check if values look like percentages (0-1 or 0-100 range)
            numeric = pd.to_numeric(sample, errors='coerce').dropna()
            if not numeric.empty:
                if numeric.max() <= 1 and numeric.min() >= 0:
                    return SemanticType.PERCENTAGE
                if numeric.max() <= 100 and numeric.min() >= 0 and '%' in field_name:
                    return SemanticType.PERCENTAGE
            return SemanticType.AMOUNT

        if data_type == DataType.STRING:
            # Check cardinality for category detection
            unique_ratio = sample.nunique() / len(sample) if len(sample) > 0 else 0
            if unique_ratio < 0.3:  # Low cardinality suggests category
                return SemanticType.CATEGORY
            return SemanticType.NAME

        return SemanticType.UNKNOWN

    def _determine_chart_role(self, data_type: DataType, semantic_type: SemanticType) -> ChartRole:
        """Determine recommended chart role for the field"""
        # Time fields are time axis
        if semantic_type == SemanticType.DATE:
            return ChartRole.TIME

        # Numeric measure types
        if semantic_type in [SemanticType.AMOUNT, SemanticType.QUANTITY, SemanticType.PERCENTAGE, SemanticType.RATE]:
            return ChartRole.MEASURE

        # Categorical types are dimensions
        if semantic_type in [SemanticType.CATEGORY, SemanticType.GEOGRAPHY, SemanticType.PRODUCT, SemanticType.CUSTOMER]:
            return ChartRole.DIMENSION

        # IDs and codes are series grouping
        if semantic_type in [SemanticType.ID, SemanticType.CODE]:
            return ChartRole.SERIES

        # Text fields for tooltips
        if semantic_type in [SemanticType.NAME, SemanticType.DESCRIPTION]:
            return ChartRole.TOOLTIP

        # Default based on data type
        if data_type in [DataType.INTEGER, DataType.FLOAT]:
            return ChartRole.MEASURE

        return ChartRole.DIMENSION

    def _calculate_statistics(self, values: pd.Series, data_type: DataType) -> Optional[dict]:
        """Calculate statistics for numeric fields"""
        if data_type not in [DataType.INTEGER, DataType.FLOAT]:
            return None

        numeric = pd.to_numeric(values, errors='coerce')
        if numeric.isna().all():
            return None

        return {
            "min": float(numeric.min()) if pd.notna(numeric.min()) else None,
            "max": float(numeric.max()) if pd.notna(numeric.max()) else None,
            "mean": float(numeric.mean()) if pd.notna(numeric.mean()) else None,
            "median": float(numeric.median()) if pd.notna(numeric.median()) else None,
            "std": float(numeric.std()) if pd.notna(numeric.std()) else None,
            "sum": float(numeric.sum()) if pd.notna(numeric.sum()) else None
        }
