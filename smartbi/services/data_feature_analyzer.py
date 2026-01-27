from __future__ import annotations
"""
Data Feature Analyzer Service

Analyzes column data to detect:
- Data types (DATE, NUMERIC, CATEGORICAL, ID, TEXT)
- Numeric subtypes (AMOUNT, PERCENTAGE, QUANTITY, GENERAL)
- Date formats
- Statistical features

Equivalent to Java's ExcelDynamicParserServiceImpl.analyzeColumn()
"""
import logging
import re
from typing import List, Optional, Dict, Any, Set
from datetime import datetime
from enum import Enum
from decimal import Decimal, InvalidOperation

logger = logging.getLogger(__name__)


class DataType(str, Enum):
    """Data type classifications"""
    DATE = "DATE"
    NUMERIC = "NUMERIC"
    CATEGORICAL = "CATEGORICAL"
    ID = "ID"
    TEXT = "TEXT"


class NumericSubType(str, Enum):
    """Numeric data subtypes"""
    AMOUNT = "AMOUNT"       # Currency/monetary values
    PERCENTAGE = "PERCENTAGE"  # Percentage values
    QUANTITY = "QUANTITY"   # Count/quantity values
    GENERAL = "GENERAL"     # General numeric


class DataFeatureResult:
    """Result of column data analysis"""

    def __init__(
        self,
        column_name: str,
        column_index: int = 0,
        data_type: DataType = DataType.TEXT,
        numeric_sub_type: Optional[NumericSubType] = None,
        date_format: Optional[str] = None,
        non_null_count: int = 0,
        null_count: int = 0,
        unique_count: int = 0,
        sample_values: Optional[List[str]] = None,
        unique_values: Optional[List[str]] = None,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        confidence: float = 70.0
    ):
        self.column_name = column_name
        self.column_index = column_index
        self.data_type = data_type
        self.numeric_sub_type = numeric_sub_type
        self.date_format = date_format
        self.non_null_count = non_null_count
        self.null_count = null_count
        self.unique_count = unique_count
        self.sample_values = sample_values or []
        self.unique_values = unique_values or []
        self.min_value = min_value
        self.max_value = max_value
        self.confidence = confidence

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "columnName": self.column_name,
            "columnIndex": self.column_index,
            "dataType": self.data_type.value,
            "numericSubType": self.numeric_sub_type.value if self.numeric_sub_type else None,
            "dateFormat": self.date_format,
            "nonNullCount": self.non_null_count,
            "nullCount": self.null_count,
            "uniqueCount": self.unique_count,
            "sampleValues": self.sample_values,
            "uniqueValues": self.unique_values,
            "minValue": self.min_value,
            "maxValue": self.max_value,
            "confidence": self.confidence
        }


class DataFeatureAnalyzer:
    """
    Analyzes data columns to detect types and features.

    Python equivalent of Java ExcelDynamicParserServiceImpl's
    analyzeColumn(), detectDateFormat(), detectNumericSubType() methods.
    """

    # Date formats to try (ordered by priority)
    DATE_FORMATS = [
        "%Y-%m-%d",      # 2025-01-15
        "%Y/%m/%d",      # 2025/01/15
        "%Y%m%d",        # 20250115
        "%m/%d/%Y",      # 01/15/2025
        "%Y-%m-%d %H:%M:%S",  # With time
        "%d/%m/%Y",      # European format
        "%Y年%m月%d日",   # Chinese format
    ]

    DATE_FORMAT_PATTERNS = [
        "yyyy-MM-dd",
        "yyyy/MM/dd",
        "yyyyMMdd",
        "MM/dd/yyyy",
        "yyyy-MM-dd HH:mm:ss",
        "dd/MM/yyyy",
        "yyyy年MM月dd日",
    ]

    # Numeric pattern (with currency symbols)
    NUMERIC_PATTERN = re.compile(r'^[¥$€£]?\s*-?[\d,]+\.?\d*[%]?$')

    # Keywords for subtype detection
    AMOUNT_KEYWORDS = [
        "金额", "成本", "收入", "费用", "价格", "单价", "总价", "利润", "营收",
        "amount", "cost", "revenue", "price", "profit", "fee", "budget", "actual",
        "预算", "实际", "净利", "毛利", "销售额"
    ]

    PERCENTAGE_KEYWORDS = [
        "率", "比例", "占比", "百分比", "增长率", "达成率",
        "rate", "ratio", "percentage", "percent", "growth", "margin"
    ]

    QUANTITY_KEYWORDS = [
        "数量", "件数", "个数", "人数", "次数", "天数",
        "count", "quantity", "qty", "number", "total"
    ]

    ID_KEYWORDS = [
        "id", "编号", "工号", "编码", "代码", "号码",
        "code", "no", "number", "序号"
    ]

    # Thresholds
    DATE_DETECTION_THRESHOLD = 0.90
    NUMERIC_DETECTION_THRESHOLD = 0.95
    CATEGORICAL_UNIQUE_RATIO = 0.20
    CATEGORICAL_MAX_UNIQUE = 50
    MAX_SAMPLE_VALUES = 5
    MAX_UNIQUE_VALUES = 50

    def analyze_column(
        self,
        column_name: str,
        values: List[Any],
        column_index: int = 0
    ) -> DataFeatureResult:
        """
        Analyze a column's data to determine its type and features.

        Args:
            column_name: Name of the column
            values: List of column values
            column_index: Index of the column

        Returns:
            DataFeatureResult with detected type and statistics
        """
        logger.debug(f"Analyzing column: {column_name}, value_count={len(values)}")

        # Basic statistics
        null_count = 0
        unique_values: Set[str] = set()
        sample_values: List[str] = []

        for value in values:
            if value is None or (isinstance(value, str) and not value.strip()):
                null_count += 1
            else:
                str_value = str(value).strip()
                unique_values.add(str_value)
                if len(sample_values) < self.MAX_SAMPLE_VALUES:
                    sample_values.append(str_value)

        non_null_count = len(values) - null_count
        unique_count = len(unique_values)

        # Try to detect date format
        date_format = self.detect_date_format(values)
        if date_format:
            return DataFeatureResult(
                column_name=column_name,
                column_index=column_index,
                data_type=DataType.DATE,
                date_format=date_format,
                non_null_count=non_null_count,
                null_count=null_count,
                unique_count=unique_count,
                sample_values=sample_values,
                confidence=95.0
            )

        # Check if numeric column
        if self._is_numeric_column(values):
            sub_type = self.detect_numeric_sub_type(column_name, values)
            min_val, max_val = self._calculate_numeric_stats(values)

            return DataFeatureResult(
                column_name=column_name,
                column_index=column_index,
                data_type=DataType.NUMERIC,
                numeric_sub_type=sub_type,
                non_null_count=non_null_count,
                null_count=null_count,
                unique_count=unique_count,
                sample_values=sample_values,
                min_value=min_val,
                max_value=max_val,
                confidence=90.0
            )

        # Check if ID column
        if self._is_id_column(column_name, values, unique_count, non_null_count):
            return DataFeatureResult(
                column_name=column_name,
                column_index=column_index,
                data_type=DataType.ID,
                non_null_count=non_null_count,
                null_count=null_count,
                unique_count=unique_count,
                sample_values=sample_values,
                confidence=85.0
            )

        # Check if categorical column
        if self._is_categorical_column(unique_count, non_null_count):
            limited_unique = list(unique_values)[:self.MAX_UNIQUE_VALUES]
            return DataFeatureResult(
                column_name=column_name,
                column_index=column_index,
                data_type=DataType.CATEGORICAL,
                non_null_count=non_null_count,
                null_count=null_count,
                unique_count=unique_count,
                sample_values=sample_values,
                unique_values=limited_unique,
                confidence=80.0
            )

        # Default to TEXT
        return DataFeatureResult(
            column_name=column_name,
            column_index=column_index,
            data_type=DataType.TEXT,
            non_null_count=non_null_count,
            null_count=null_count,
            unique_count=unique_count,
            sample_values=sample_values,
            confidence=70.0
        )

    def detect_date_format(self, values: List[Any]) -> Optional[str]:
        """
        Try to detect the date format of a column.

        Args:
            values: List of column values

        Returns:
            Java-style date format pattern if detected, None otherwise
        """
        if not values:
            return None

        # Filter non-null values
        non_null_values = [
            str(v).strip() for v in values
            if v is not None and str(v).strip()
        ]

        if not non_null_values:
            return None

        # Try each date format
        for i, py_format in enumerate(self.DATE_FORMATS):
            java_format = self.DATE_FORMAT_PATTERNS[i]
            success_count = 0

            for value in non_null_values:
                if self._try_parse_date(value, py_format):
                    success_count += 1

            success_rate = success_count / len(non_null_values)
            if success_rate >= self.DATE_DETECTION_THRESHOLD:
                logger.debug(f"Detected date format: {java_format}, rate={success_rate:.2%}")
                return java_format

        return None

    def detect_numeric_sub_type(
        self,
        column_name: str,
        values: List[Any]
    ) -> NumericSubType:
        """
        Detect the subtype of a numeric column.

        Args:
            column_name: Name of the column
            values: List of column values

        Returns:
            Detected NumericSubType
        """
        lower_name = column_name.lower()

        # Check keywords in column name
        for keyword in self.AMOUNT_KEYWORDS:
            if keyword.lower() in lower_name:
                return NumericSubType.AMOUNT

        for keyword in self.PERCENTAGE_KEYWORDS:
            if keyword.lower() in lower_name:
                return NumericSubType.PERCENTAGE

        for keyword in self.QUANTITY_KEYWORDS:
            if keyword.lower() in lower_name:
                return NumericSubType.QUANTITY

        # Check value patterns
        numeric_values = self._parse_numeric_values(values)
        if not numeric_values:
            return NumericSubType.GENERAL

        # Check for currency symbols
        has_currency = any(
            v is not None and
            any(c in str(v) for c in "¥$€£")
            for v in values
        )
        if has_currency:
            return NumericSubType.AMOUNT

        # Check for percentage
        has_percent = any(
            v is not None and "%" in str(v)
            for v in values
        )
        all_in_range = all(
            (0 <= v <= 100) or (0 <= v <= 1)
            for v in numeric_values
        )
        if has_percent and all_in_range:
            return NumericSubType.PERCENTAGE

        # Check if mostly integers (quantity)
        integer_count = sum(
            1 for v in numeric_values
            if v == int(v)
        )
        if integer_count / len(numeric_values) > 0.9:
            return NumericSubType.QUANTITY

        return NumericSubType.GENERAL

    def _try_parse_date(self, value: str, format_str: str) -> bool:
        """Try to parse a string as a date with the given format"""
        try:
            datetime.strptime(value, format_str)
            return True
        except (ValueError, TypeError):
            return False

    def _is_numeric_column(self, values: List[Any]) -> bool:
        """Check if a column contains mostly numeric values"""
        if not values:
            return False

        non_null_values = [
            str(v).strip() for v in values
            if v is not None and str(v).strip()
        ]

        if not non_null_values:
            return False

        numeric_count = sum(
            1 for v in non_null_values
            if self._is_numeric_value(v)
        )

        return numeric_count / len(non_null_values) >= self.NUMERIC_DETECTION_THRESHOLD

    def _is_numeric_value(self, value: str) -> bool:
        """Check if a string represents a numeric value"""
        if not value or not value.strip():
            return False

        # Remove currency symbols and formatting
        cleaned = re.sub(r'[¥$€£%,\s]', '', value)

        try:
            Decimal(cleaned)
            return True
        except (InvalidOperation, ValueError):
            return False

    def _is_id_column(
        self,
        column_name: str,
        values: List[Any],
        unique_count: int,
        non_null_count: int
    ) -> bool:
        """Check if a column is an ID column"""
        lower_name = column_name.lower()

        # Check keywords
        for keyword in self.ID_KEYWORDS:
            if keyword.lower() in lower_name:
                return True

        # High uniqueness ratio suggests ID
        if non_null_count > 0:
            unique_ratio = unique_count / non_null_count
            return unique_ratio > 0.95

        return False

    def _is_categorical_column(self, unique_count: int, non_null_count: int) -> bool:
        """Check if a column is categorical"""
        if non_null_count == 0:
            return False

        unique_ratio = unique_count / non_null_count
        return unique_ratio < self.CATEGORICAL_UNIQUE_RATIO and unique_count <= self.CATEGORICAL_MAX_UNIQUE

    def _parse_numeric_values(self, values: List[Any]) -> List[float]:
        """Parse a list of values to floats"""
        result = []
        for v in values:
            if v is None:
                continue
            cleaned = re.sub(r'[¥$€£%,\s]', '', str(v))
            try:
                result.append(float(Decimal(cleaned)))
            except (InvalidOperation, ValueError):
                pass
        return result

    def _calculate_numeric_stats(self, values: List[Any]) -> tuple:
        """Calculate min and max for numeric values"""
        numeric_values = self._parse_numeric_values(values)
        if not numeric_values:
            return None, None
        return min(numeric_values), max(numeric_values)


# Time patterns for detecting column-oriented data
TIME_PATTERNS = [
    # Year-month: 2025年1月, 2025年01月
    re.compile(r'\d{4}年\d{1,2}月'),
    # Quarter: 2025Q1, Q1 2025, 第一季度
    re.compile(r'\d{4}[Qq]\d'),
    re.compile(r'[Qq]\d\s*\d{4}'),
    re.compile(r'第[一二三四]季度'),
    # English months
    re.compile(r'(?i)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[-/]?\s*\d{2,4}'),
    re.compile(r'(?i)\d{2,4}\s*[-/]?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'),
    # Year-month: 2025-01, 2025/01
    re.compile(r'\d{4}[-/]\d{2}'),
    # Week: 第1周, W1
    re.compile(r'第\d{1,2}周'),
    re.compile(r'(?i)[Ww]\d{1,2}'),
    # Budget/Actual combinations
    re.compile(r'\d{4}年\d{1,2}月[_-]?(预算|实际|计划|完成)'),
    re.compile(r'(预算|实际|计划|完成)[_-]?\d{4}年\d{1,2}月'),
]


def is_time_pattern(value: str) -> bool:
    """Check if a string matches a time pattern"""
    if not value or not value.strip():
        return False
    trimmed = value.strip()
    for pattern in TIME_PATTERNS:
        if pattern.search(trimmed):
            return True
    return False


def count_time_pattern_headers(headers: List[str]) -> int:
    """Count how many headers match time patterns"""
    return sum(1 for h in headers if h and is_time_pattern(h))
