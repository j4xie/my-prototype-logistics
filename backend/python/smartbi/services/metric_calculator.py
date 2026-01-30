from __future__ import annotations
"""
Metric Calculator Service

Calculates 30+ business metrics including:
- Sales metrics (amount, count, average)
- Profitability metrics (margin, ROI)
- Cost metrics (ratios)
- Financial metrics (AR, collection rate)
- Budget metrics (execution rate, variance)

Enhanced with LLM-based dynamic metric inference (Mode A: Rule Self-Learning):
- Automatically infer calculable metrics from data columns
- Generate derived metrics and formulas
- Support YoY/MoM calculations when time dimension available
- **Auto-learn and save new metric rules for future reuse**
"""
import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field, asdict
from typing import Any, Optional, List, Dict, Union
from enum import Enum
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import httpx
import pandas as pd
import numpy as np

from config import get_settings
from services.utils.json_parser import robust_json_parse
from services.utils.dataframe_utils import safe_get_column, ensure_numeric_for_formula

logger = logging.getLogger(__name__)


# ============================================================
# Learned Metric Rule Storage (Mode A)
# ============================================================

@dataclass
class LearnedMetricRule:
    """
    A learned metric rule that can be reused.

    Stored in learned_metric_rules.json for persistence.
    """
    rule_id: str                        # Unique rule ID
    name: str                           # Metric name
    formula: str                        # Calculation formula
    required_columns: List[str]         # Required column patterns (not exact names)
    column_pattern_hash: str            # Hash of column pattern for matching
    description: str                    # Metric description
    metric_type: str = "derived"        # direct, derived, yoy, mom, ratio
    unit: str = ""                      # Unit
    aggregation: str = "sum"            # Aggregation method
    category: str = "custom"            # Category
    created_at: float = 0.0             # Creation timestamp
    used_count: int = 0                 # Number of times used
    success_rate: float = 1.0           # Success rate of calculations

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LearnedMetricRule":
        return cls(**data)


class MetricRuleStore:
    """
    Storage for learned metric rules (Mode A: Rule Self-Learning).

    When LLM infers a new metric formula:
    1. Save the rule to this store
    2. Next time similar column structure is encountered, reuse the rule

    Rules are matched by column pattern (normalized column names).
    """

    RULES_FILE = "learned_metric_rules.json"

    def __init__(self, storage_dir: Optional[str] = None):
        """
        Initialize the rule store.

        Args:
            storage_dir: Directory to store rules file.
                        Defaults to smartbi/services/
        """
        if storage_dir is None:
            storage_dir = os.path.dirname(os.path.abspath(__file__))
        self._storage_dir = storage_dir
        self._rules_file = os.path.join(storage_dir, self.RULES_FILE)
        self._rules: Dict[str, LearnedMetricRule] = {}
        self._load_rules()

    def _convert_sql_to_pandas_formula(self, formula: str) -> str:
        """
        Convert SQL syntax to pandas-compatible syntax in formulas.

        Conversions:
        - COUNT(DISTINCT col) -> NUNIQUE(col)
        - Complex SQL (CASE WHEN, LAG, OVER) -> marked as unsupported
        """
        # COUNT(DISTINCT col) -> NUNIQUE(col)
        formula = re.sub(
            r'COUNT\s*\(\s*DISTINCT\s+([^)]+)\)',
            r'NUNIQUE(\1)',
            formula,
            flags=re.IGNORECASE
        )
        return formula

    def _is_formula_supported(self, formula: str) -> bool:
        """
        Check if a formula uses only supported syntax (no complex SQL).
        """
        unsupported_patterns = [
            r'\bCASE\s+WHEN\b',
            r'\bLAG\s*\(',
            r'\bLEAD\s*\(',
            r'\bOVER\s*\(',
            r'\bSELECT\b',
            r'\bFROM\b',
            r'\bWHERE\b',
            r'\bGROUP\s+BY\b',
            r'\bHAVING\b',
        ]
        for pattern in unsupported_patterns:
            if re.search(pattern, formula, re.IGNORECASE):
                return False
        return True

    def _load_rules(self):
        """Load rules from file, converting SQL syntax to pandas."""
        if os.path.exists(self._rules_file):
            try:
                with open(self._rules_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for rule_data in data.get("rules", []):
                        rule = LearnedMetricRule.from_dict(rule_data)
                        # Convert SQL syntax to pandas
                        rule.formula = self._convert_sql_to_pandas_formula(rule.formula)
                        # Skip rules with unsupported SQL syntax
                        if not self._is_formula_supported(rule.formula):
                            logger.debug(f"Skipping rule {rule.name}: unsupported SQL syntax")
                            continue
                        self._rules[rule.rule_id] = rule
                logger.info(f"Loaded {len(self._rules)} learned metric rules")
            except Exception as e:
                logger.error(f"Failed to load metric rules: {e}")
                self._rules = {}
        else:
            logger.info("No learned metric rules file found, starting fresh")

    def _save_rules(self):
        """Save rules to file."""
        try:
            data = {
                "version": "1.0",
                "updated_at": time.time(),
                "rules": [rule.to_dict() for rule in self._rules.values()]
            }
            with open(self._rules_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.debug(f"Saved {len(self._rules)} metric rules")
        except Exception as e:
            logger.error(f"Failed to save metric rules: {e}")

    def _normalize_column_name(self, col: str) -> str:
        """Normalize column name for pattern matching."""
        # Remove numbers and special chars, lowercase
        normalized = re.sub(r'[0-9_\-\s]+', '', col.lower())
        # Common synonyms
        synonyms = {
            "销售额": "sales", "金额": "amount", "收入": "revenue",
            "成本": "cost", "费用": "expense",
            "利润": "profit", "毛利": "grossprofit",
            "目标": "target", "实际": "actual", "完成": "actual",
            "预算": "budget", "计划": "plan",
            "数量": "qty", "订单": "order",
            "日期": "date", "时间": "time"
        }
        for cn, en in synonyms.items():
            if cn in normalized:
                normalized = normalized.replace(cn, en)
        return normalized

    def _generate_column_pattern_hash(self, columns: List[str]) -> str:
        """Generate a hash for column pattern matching."""
        normalized = sorted([self._normalize_column_name(c) for c in columns])
        pattern = "|".join(normalized[:20])  # Limit to 20 columns
        return hashlib.md5(pattern.encode()).hexdigest()[:12]

    def find_matching_rules(
        self,
        columns: List[str],
        data_types: Dict[str, str]
    ) -> List[LearnedMetricRule]:
        """
        Find learned rules that match the given columns.

        Returns rules whose required columns can be satisfied.
        """
        matching_rules = []
        normalized_cols = {self._normalize_column_name(c): c for c in columns}

        for rule in self._rules.values():
            # Check if all required columns have a match
            can_satisfy = True
            for req_col in rule.required_columns:
                req_normalized = self._normalize_column_name(req_col)
                if req_normalized not in normalized_cols:
                    # Try partial match
                    found = False
                    for norm_col in normalized_cols:
                        if req_normalized in norm_col or norm_col in req_normalized:
                            found = True
                            break
                    if not found:
                        can_satisfy = False
                        break

            if can_satisfy:
                matching_rules.append(rule)

        return matching_rules

    def add_rule(self, metric: "InferredMetric", columns: List[str]) -> str:
        """
        Add a new learned rule from an inferred metric.

        Args:
            metric: The inferred metric from LLM
            columns: Original column names

        Returns:
            The rule ID
        """
        pattern_hash = self._generate_column_pattern_hash(metric.required_columns)
        rule_id = f"metric_{pattern_hash}_{int(time.time())}"

        rule = LearnedMetricRule(
            rule_id=rule_id,
            name=metric.name,
            formula=metric.formula,
            required_columns=metric.required_columns,
            column_pattern_hash=pattern_hash,
            description=metric.description,
            metric_type=metric.metric_type,
            unit=metric.unit,
            aggregation=metric.aggregation,
            category=metric.category,
            created_at=time.time()
        )

        self._rules[rule_id] = rule
        self._save_rules()
        logger.info(f"Added new metric rule: {rule.name} ({rule_id})")
        return rule_id

    def update_rule_stats(self, rule_id: str, success: bool):
        """Update rule usage statistics."""
        if rule_id in self._rules:
            rule = self._rules[rule_id]
            rule.used_count += 1
            # Update success rate with exponential moving average
            rule.success_rate = 0.9 * rule.success_rate + (0.1 if success else 0.0)
            self._save_rules()

    def rule_to_inferred_metric(
        self,
        rule: LearnedMetricRule,
        actual_columns: List[str]
    ) -> "InferredMetric":
        """
        Convert a learned rule to an InferredMetric with actual column names.

        Args:
            rule: The learned rule
            actual_columns: The actual column names in the data

        Returns:
            InferredMetric with actual column names substituted
        """
        # Map rule's required columns to actual columns
        normalized_actual = {self._normalize_column_name(c): c for c in actual_columns}
        column_mapping = {}

        for req_col in rule.required_columns:
            req_normalized = self._normalize_column_name(req_col)
            # Find the actual column that matches
            for norm, actual in normalized_actual.items():
                if req_normalized == norm or req_normalized in norm or norm in req_normalized:
                    column_mapping[req_col] = actual
                    break

        # Substitute column names in formula
        formula = rule.formula
        actual_required = []
        for old_col, new_col in column_mapping.items():
            formula = re.sub(
                rf'\b{re.escape(old_col)}\b',
                new_col,
                formula
            )
            actual_required.append(new_col)

        return InferredMetric(
            name=rule.name,
            formula=formula,
            required_columns=actual_required,
            description=rule.description,
            metric_type=rule.metric_type,
            unit=rule.unit,
            aggregation=rule.aggregation,
            confidence=0.95,  # Higher confidence for learned rules
            category=rule.category
        )

    def get_stats(self) -> Dict[str, Any]:
        """Get rule store statistics."""
        return {
            "total_rules": len(self._rules),
            "total_usage": sum(r.used_count for r in self._rules.values()),
            "rules_by_category": {
                cat: len([r for r in self._rules.values() if r.category == cat])
                for cat in set(r.category for r in self._rules.values())
            }
        }

    def clear(self):
        """Clear all rules."""
        self._rules.clear()
        if os.path.exists(self._rules_file):
            os.remove(self._rules_file)
        logger.info("Metric rule store cleared")


# ============================================================
# Data Classes for Dynamic Metric Inference
# ============================================================

@dataclass
class InferredMetric:
    """LLM推断的指标"""
    name: str                           # 指标名称
    formula: str                        # 计算公式
    required_columns: List[str]         # 需要的列
    description: str                    # 指标说明
    metric_type: str = "derived"        # 类型: direct, derived, yoy, mom, ratio
    unit: str = ""                      # 单位
    aggregation: str = "sum"            # 聚合方式: sum, avg, count, min, max
    confidence: float = 0.8             # 置信度
    category: str = "custom"            # 类别: sales, cost, profit, efficiency, etc.


@dataclass
class MetricResult:
    """指标计算结果"""
    success: bool
    metric_name: str
    value: Optional[float] = None
    unit: str = ""
    formula: str = ""
    breakdown: Optional[Dict[str, float]] = None
    error: Optional[str] = None
    calculation_details: Dict[str, Any] = field(default_factory=dict)


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
    """
    Business metrics calculation engine

    Features:
    1. Built-in metric definitions (METRIC_DEFINITIONS)
    2. LLM-based dynamic metric inference
    3. Formula parsing and execution for inferred metrics
    """

    # Metric definitions with required fields and formulas
    # Note: Using pandas-compatible syntax (NUNIQUE instead of COUNT(DISTINCT))
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
            "formula": "NUNIQUE(order_id)",  # Changed from COUNT(DISTINCT order_id)
            "unit": "笔"
        },
        MetricType.AVG_ORDER_VALUE: {
            "name": "客单价",
            "required_fields": ["amount", "order_id"],
            "formula": "SUM(amount) / NUNIQUE(order_id)",  # Changed from COUNT(DISTINCT order_id)
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
        self.settings = get_settings()
        self._client: Optional[httpx.AsyncClient] = None
        # Initialize rule store for Mode A (Rule Self-Learning)
        self._rule_store = MetricRuleStore()

    @property
    def client(self) -> httpx.AsyncClient:
        """Lazy initialization of HTTP client"""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client

    async def close(self):
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None

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

    # ============================================================
    # LLM-based Dynamic Metric Inference with Rule Self-Learning (Mode A)
    # ============================================================

    async def infer_metrics(
        self,
        columns: List[str],
        data_types: Dict[str, str],
        scenario: Optional[str] = None,
        sample_data: Optional[List[Dict[str, Any]]] = None,
        use_learned_rules: bool = True
    ) -> List[InferredMetric]:
        """
        LLM 推断可计算的指标 (Mode A: Rule Self-Learning)

        流程:
        1. 先检查规则库是否有匹配的已学习规则
        2. 如果有匹配规则 → 直接使用（不调用 LLM）
        3. 如果没有匹配规则 → 调用 LLM 推断
        4. 保存 LLM 推断的新规则到规则库

        Args:
            columns: 数据列名列表
            data_types: 列名到数据类型的映射 {"column_name": "number|text|date|..."}
            scenario: 业务场景描述 (可选)
            sample_data: 样本数据 (可选，用于更精确的推断)
            use_learned_rules: 是否使用已学习的规则 (默认: True)

        Returns:
            List of InferredMetric with:
            - name: 指标名称
            - formula: 计算公式
            - required_columns: 需要的列
            - description: 指标说明
        """
        # Step 1: Check for matching learned rules
        if use_learned_rules:
            matching_rules = self._rule_store.find_matching_rules(columns, data_types)
            if matching_rules:
                logger.info(f"Found {len(matching_rules)} matching learned metric rules")
                metrics = []
                for rule in matching_rules:
                    try:
                        metric = self._rule_store.rule_to_inferred_metric(rule, columns)
                        metrics.append(metric)
                        # Update rule stats
                        self._rule_store.update_rule_stats(rule.rule_id, True)
                    except Exception as e:
                        logger.warning(f"Failed to apply rule {rule.rule_id}: {e}")
                        self._rule_store.update_rule_stats(rule.rule_id, False)

                if metrics:
                    logger.info(f"Using {len(metrics)} metrics from learned rules")
                    return metrics

        # Step 2: Fallback to rule-based inference if no LLM
        if not self.settings.llm_api_key:
            logger.info("LLM API key not configured, using rule-based inference")
            return self._rule_based_infer_metrics(columns, data_types, scenario)

        # Step 3: Call LLM for new metric inference
        prompt = self._build_metric_inference_prompt(columns, data_types, scenario, sample_data)

        try:
            response = await self._call_llm(prompt)
            metrics = self._parse_metric_inference_response(response, columns, data_types)

            # Step 4: Save newly inferred metrics as learned rules
            if metrics and use_learned_rules:
                saved_count = 0
                for metric in metrics:
                    try:
                        # Only save derived/ratio metrics (not direct metrics)
                        if metric.metric_type in ("derived", "ratio", "yoy", "mom"):
                            self._rule_store.add_rule(metric, columns)
                            saved_count += 1
                    except Exception as e:
                        logger.warning(f"Failed to save metric rule: {e}")

                if saved_count > 0:
                    logger.info(f"Saved {saved_count} new metric rules for future reuse")

            return metrics

        except Exception as e:
            logger.error(f"LLM metric inference failed: {e}", exc_info=True)
            return self._rule_based_infer_metrics(columns, data_types, scenario)

    def get_rule_store_stats(self) -> Dict[str, Any]:
        """Get statistics about learned metric rules."""
        return self._rule_store.get_stats()

    def clear_learned_rules(self):
        """Clear all learned metric rules."""
        self._rule_store.clear()

    def _build_metric_inference_prompt(
        self,
        columns: List[str],
        data_types: Dict[str, str],
        scenario: Optional[str],
        sample_data: Optional[List[Dict[str, Any]]]
    ) -> str:
        """构建指标推断的 LLM Prompt"""

        # 格式化列信息
        columns_info = []
        for col in columns:
            dtype = data_types.get(col, "unknown")
            columns_info.append(f"  - {col} ({dtype})")

        columns_str = "\n".join(columns_info)

        # 样本数据展示
        sample_str = ""
        if sample_data and len(sample_data) > 0:
            sample_str = f"\n\n样本数据 (前{min(5, len(sample_data))}行):\n"
            sample_str += json.dumps(sample_data[:5], ensure_ascii=False, indent=2)

        prompt = f"""基于以下数据列，推断可以计算的业务指标。

可用列:
{columns_str}

数据类型映射:
{json.dumps(data_types, ensure_ascii=False, indent=2)}

业务场景: {scenario or "通用业务分析"}
{sample_str}

请分析并列出：

1. **可直接使用的指标**（已有列可直接作为指标）
   - 哪些列本身就是有意义的指标？

2. **可计算的衍生指标**（通过公式计算）
   - 利润 = 收入 - 成本
   - 毛利率 = (收入 - 成本) / 收入 * 100
   - 客单价 = 销售额 / 订单数
   - 完成率 = 实际 / 目标 * 100
   - 等等...

3. **同比/环比指标**（如果有时间维度）
   - 同比增长率 = (本期 - 同期) / 同期 * 100
   - 环比增长率 = (本期 - 上期) / 上期 * 100

请返回 JSON 格式：
{{
    "inferred_metrics": [
        {{
            "name": "指标中文名称",
            "formula": "计算公式（使用列名，如 revenue - cost）",
            "required_columns": ["需要的列名"],
            "description": "指标含义说明",
            "metric_type": "direct/derived/yoy/mom/ratio",
            "unit": "单位（元、%、个等）",
            "aggregation": "sum/avg/count/min/max",
            "confidence": 0.0-1.0,
            "category": "sales/cost/profit/efficiency/financial/custom"
        }}
    ],
    "analysis_notes": "关于数据结构的分析说明"
}}

注意：
1. formula 中使用实际列名，支持的运算符: +, -, *, /, ()
2. 对于需要聚合的指标，formula 中可使用 SUM(), AVG(), COUNT(), MIN(), MAX(), NUNIQUE()
3. 只推断有意义且可计算的指标
4. confidence 表示推断的置信度
5. **禁止使用 SQL 语法**：不要使用 CASE WHEN、LAG、LEAD、OVER、SELECT 等 SQL 关键字
6. 公式必须是简单的数学表达式，如: revenue - cost, SUM(金额) / COUNT(订单), 实际 / 目标 * 100
"""
        return prompt

    async def _call_llm(self, prompt: str) -> str:
        """调用 LLM API"""
        headers = {
            "Authorization": f"Bearer {self.settings.llm_api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.settings.llm_model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个专业的数据分析师，擅长识别业务数据中可计算的指标和公式。请用JSON格式回复，确保JSON格式正确。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,
            "max_tokens": 3000
        }

        response = await self.client.post(
            f"{self.settings.llm_base_url}/chat/completions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()

        result = response.json()
        return result["choices"][0]["message"]["content"]

    def _parse_metric_inference_response(
        self,
        response: str,
        columns: List[str],
        data_types: Dict[str, str]
    ) -> List[InferredMetric]:
        """解析 LLM 推断响应"""
        try:
            # Fix: Use robust JSON parser to handle LLM output issues
            data = robust_json_parse(response, fallback={})

            if not data:
                logger.warning("Could not parse JSON from LLM metric inference response")
                return self._rule_based_infer_metrics(columns, data_types, None)

            metrics = []
            for item in data.get("inferred_metrics", []):
                # 验证 required_columns 是否存在
                required = item.get("required_columns", [])
                valid_required = [col for col in required if col in columns]

                if not valid_required:
                    logger.warning(f"Skipping metric {item.get('name')}: no valid required columns")
                    continue

                metrics.append(InferredMetric(
                    name=item.get("name", "未知指标"),
                    formula=item.get("formula", ""),
                    required_columns=valid_required,
                    description=item.get("description", ""),
                    metric_type=item.get("metric_type", "derived"),
                    unit=item.get("unit", ""),
                    aggregation=item.get("aggregation", "sum"),
                    confidence=item.get("confidence", 0.8),
                    category=item.get("category", "custom")
                ))

            return metrics

        except Exception as e:
            logger.error(f"Failed to parse LLM response: {e}")
            return self._rule_based_infer_metrics(columns, data_types, None)

    def _rule_based_infer_metrics(
        self,
        columns: List[str],
        data_types: Dict[str, str],
        scenario: Optional[str]
    ) -> List[InferredMetric]:
        """基于规则的指标推断（Fallback）"""
        metrics = []
        columns_lower = {col.lower(): col for col in columns}

        # 检测数值列
        numeric_cols = [col for col, dtype in data_types.items()
                       if dtype in ("number", "float", "int", "integer", "numeric")]

        # 1. 直接可用的指标
        for col in numeric_cols:
            col_lower = col.lower()
            name = col
            unit = ""
            category = "custom"

            # 识别常见指标
            if any(kw in col_lower for kw in ["金额", "收入", "sales", "revenue", "amount"]):
                name = f"{col}"
                unit = "元"
                category = "sales"
            elif any(kw in col_lower for kw in ["成本", "cost", "expense"]):
                name = f"{col}"
                unit = "元"
                category = "cost"
            elif any(kw in col_lower for kw in ["数量", "qty", "quantity", "count"]):
                name = f"{col}"
                unit = "个"
                category = "sales"
            elif any(kw in col_lower for kw in ["率", "rate", "ratio", "%"]):
                name = f"{col}"
                unit = "%"
                category = "efficiency"

            metrics.append(InferredMetric(
                name=name,
                formula=f"SUM({col})",
                required_columns=[col],
                description=f"直接使用 {col} 列作为指标",
                metric_type="direct",
                unit=unit,
                aggregation="sum",
                confidence=0.9,
                category=category
            ))

        # 2. 衍生指标推断
        # 利润 = 收入 - 成本
        revenue_col = None
        cost_col = None
        for col in columns:
            col_lower = col.lower()
            if any(kw in col_lower for kw in ["收入", "销售", "revenue", "sales", "amount"]):
                if revenue_col is None:
                    revenue_col = col
            if any(kw in col_lower for kw in ["成本", "cost"]):
                if cost_col is None:
                    cost_col = col

        if revenue_col and cost_col:
            metrics.append(InferredMetric(
                name="毛利润",
                formula=f"{revenue_col} - {cost_col}",
                required_columns=[revenue_col, cost_col],
                description="收入减去成本",
                metric_type="derived",
                unit="元",
                aggregation="sum",
                confidence=0.85,
                category="profit"
            ))

            metrics.append(InferredMetric(
                name="毛利率",
                formula=f"({revenue_col} - {cost_col}) / {revenue_col} * 100",
                required_columns=[revenue_col, cost_col],
                description="毛利润占收入的百分比",
                metric_type="ratio",
                unit="%",
                aggregation="custom",
                confidence=0.85,
                category="profit"
            ))

        # 完成率 = 实际 / 目标
        actual_col = None
        target_col = None
        for col in columns:
            col_lower = col.lower()
            if any(kw in col_lower for kw in ["实际", "actual", "完成"]):
                if actual_col is None:
                    actual_col = col
            if any(kw in col_lower for kw in ["目标", "target", "计划", "预算", "budget"]):
                if target_col is None:
                    target_col = col

        if actual_col and target_col:
            metrics.append(InferredMetric(
                name="完成率",
                formula=f"{actual_col} / {target_col} * 100",
                required_columns=[actual_col, target_col],
                description="实际完成值与目标的比率",
                metric_type="ratio",
                unit="%",
                aggregation="custom",
                confidence=0.85,
                category="efficiency"
            ))

        # 客单价 = 销售额 / 订单数
        order_col = None
        for col in columns:
            col_lower = col.lower()
            if any(kw in col_lower for kw in ["订单", "order", "单数", "笔数"]):
                if order_col is None:
                    order_col = col

        if revenue_col and order_col:
            metrics.append(InferredMetric(
                name="客单价",
                formula=f"SUM({revenue_col}) / COUNT({order_col})",
                required_columns=[revenue_col, order_col],
                description="平均每笔订单金额",
                metric_type="derived",
                unit="元",
                aggregation="custom",
                confidence=0.8,
                category="sales"
            ))

        # 3. 检测时间维度，推荐同比/环比
        time_col = None
        for col in columns:
            col_lower = col.lower()
            if any(kw in col_lower for kw in ["日期", "时间", "date", "time", "月", "年", "period"]):
                time_col = col
                break

        if time_col and revenue_col:
            metrics.append(InferredMetric(
                name="同比增长率",
                formula=f"YOY({revenue_col}, {time_col})",
                required_columns=[revenue_col, time_col],
                description="与去年同期相比的增长率",
                metric_type="yoy",
                unit="%",
                aggregation="custom",
                confidence=0.7,
                category="sales"
            ))

            metrics.append(InferredMetric(
                name="环比增长率",
                formula=f"MOM({revenue_col}, {time_col})",
                required_columns=[revenue_col, time_col],
                description="与上期相比的增长率",
                metric_type="mom",
                unit="%",
                aggregation="custom",
                confidence=0.7,
                category="sales"
            ))

        return metrics

    def calculate_inferred_metric(
        self,
        df: pd.DataFrame,
        metric: InferredMetric,
        group_by: Optional[List[str]] = None
    ) -> MetricResult:
        """
        执行 LLM 推断的指标计算

        Args:
            df: 数据 DataFrame
            metric: 推断的指标定义
            group_by: 分组字段 (可选) - can be List[str] or List[FieldInfo]

        Returns:
            MetricResult 包含计算结果
        """
        try:
            # Fix: Convert group_by from FieldInfo objects to strings if needed
            # This handles the "'FieldInfo' object is not callable" error
            if group_by:
                group_by = [
                    g.name if hasattr(g, 'name') else str(g)
                    for g in group_by
                ]

            # 验证必需列存在
            missing_cols = [col for col in metric.required_columns if col not in df.columns]
            if missing_cols:
                return MetricResult(
                    success=False,
                    metric_name=metric.name,
                    formula=metric.formula,
                    error=f"缺少必需列: {missing_cols}"
                )

            # 根据指标类型选择计算方法
            if metric.metric_type == "direct":
                value, breakdown = self._calc_direct_metric(df, metric, group_by)
            elif metric.metric_type in ("derived", "ratio"):
                value, breakdown = self._calc_formula_metric(df, metric, group_by)
            elif metric.metric_type == "yoy":
                value, breakdown = self._calc_yoy_metric(df, metric)
            elif metric.metric_type == "mom":
                value, breakdown = self._calc_mom_metric(df, metric)
            else:
                value, breakdown = self._calc_formula_metric(df, metric, group_by)

            return MetricResult(
                success=True,
                metric_name=metric.name,
                value=self._round_value(value),
                unit=metric.unit,
                formula=metric.formula,
                breakdown=breakdown,
                calculation_details={
                    "metric_type": metric.metric_type,
                    "aggregation": metric.aggregation,
                    "category": metric.category
                }
            )

        except Exception as e:
            logger.error(f"Failed to calculate inferred metric {metric.name}: {e}", exc_info=True)
            return MetricResult(
                success=False,
                metric_name=metric.name,
                formula=metric.formula,
                error=str(e)
            )

    def _calc_direct_metric(
        self,
        df: pd.DataFrame,
        metric: InferredMetric,
        group_by: Optional[List[str]]
    ) -> tuple:
        """计算直接指标（单列聚合）"""
        col = metric.required_columns[0]

        # Fix: Use safe_get_column to handle duplicate column names
        try:
            series = safe_get_column(df, col, as_numeric=True)
        except KeyError:
            series = pd.to_numeric(df[col], errors='coerce')

        # 根据聚合方式计算
        if metric.aggregation == "sum":
            value = series.sum()
        elif metric.aggregation == "avg":
            value = series.mean()
        elif metric.aggregation == "count":
            value = series.count()
        elif metric.aggregation == "min":
            value = series.min()
        elif metric.aggregation == "max":
            value = series.max()
        else:
            value = series.sum()

        breakdown = None
        if group_by:
            # Fix: Use safe column access for groupby as well
            from services.utils.dataframe_utils import safe_groupby_agg
            try:
                grouped = safe_groupby_agg(df, group_by, col, metric.aggregation or 'sum')
                breakdown = grouped.to_dict()
            except Exception as e:
                logger.warning(f"Groupby aggregation failed: {e}")
                # Fallback to standard groupby
                try:
                    if metric.aggregation == "sum":
                        grouped = df.groupby(group_by)[col].sum()
                    elif metric.aggregation == "avg":
                        grouped = df.groupby(group_by)[col].mean()
                    elif metric.aggregation == "count":
                        grouped = df.groupby(group_by)[col].count()
                    else:
                        grouped = df.groupby(group_by)[col].sum()
                    breakdown = grouped.to_dict()
                except Exception:
                    pass

        return float(value) if pd.notna(value) else None, breakdown

    def _convert_sql_to_pandas(self, formula: str) -> str:
        """
        Convert SQL syntax to pandas-compatible syntax.

        Conversions:
        - COUNT(DISTINCT col) -> NUNIQUE(col)
        - COUNT(*) -> ROWCOUNT()  (special marker for row count)
        - DISTINCT col -> col (strip DISTINCT keyword)
        """
        # COUNT(DISTINCT col) -> NUNIQUE(col)
        formula = re.sub(
            r'COUNT\s*\(\s*DISTINCT\s+([^)]+)\)',
            r'NUNIQUE(\1)',
            formula,
            flags=re.IGNORECASE
        )
        # COUNT(*) -> ROWCOUNT() special marker
        formula = re.sub(
            r'COUNT\s*\(\s*\*\s*\)',
            'ROWCOUNT()',
            formula,
            flags=re.IGNORECASE
        )
        return formula

    def _is_formula_calculable(self, formula: str) -> bool:
        """
        Check if a formula can be calculated (no complex SQL syntax).

        Returns False for formulas containing:
        - CASE WHEN / END
        - LAG / LEAD / OVER (window functions)
        - SELECT / FROM / WHERE (SQL statements)
        - GROUP BY / HAVING
        """
        unsupported_patterns = [
            r'\bCASE\s+WHEN\b',
            r'\bLAG\s*\(',
            r'\bLEAD\s*\(',
            r'\bOVER\s*\(',
            r'\bSELECT\b',
            r'\bFROM\b',
            r'\bWHERE\b',
            r'\bGROUP\s+BY\b',
            r'\bHAVING\b',
            r'\bEND\b',
            r'\bTHEN\b',
            r'\bELSE\b',
        ]
        for pattern in unsupported_patterns:
            if re.search(pattern, formula, re.IGNORECASE):
                return False
        return True

    def _validate_formula_ready(self, formula_exec: str) -> bool:
        """
        Validate that a formula is ready for evaluation.

        After column substitution, the formula should only contain:
        - Numbers (including decimals and negative)
        - Basic operators: + - * / ()
        - Whitespace

        Returns True if formula is ready, False if it still has unresolved references.
        """
        # Remove all valid characters
        cleaned = re.sub(r'[\d\.\+\-\*/\(\)\s]', '', formula_exec)
        # If anything remains, formula is not ready
        return len(cleaned) == 0

    def _calc_formula_metric(
        self,
        df: pd.DataFrame,
        metric: InferredMetric,
        group_by: Optional[List[str]]
    ) -> tuple:
        """计算公式指标"""
        # Convert SQL syntax to pandas syntax
        formula = self._convert_sql_to_pandas(metric.formula)

        # Check if formula uses unsupported SQL syntax
        if not self._is_formula_calculable(formula):
            logger.warning(f"Formula uses unsupported SQL syntax, skipping: {formula}")
            return None, {"note": "公式使用了不支持的 SQL 语法"}

        # 解析并执行公式
        try:
            # 替换聚合函数
            formula_exec = formula

            # 处理 ROWCOUNT() 特殊函数 (row count)
            formula_exec = re.sub(
                r'ROWCOUNT\(\)',
                str(float(len(df))),
                formula_exec,
                flags=re.IGNORECASE
            )

            # 处理 SUM(), AVG(), COUNT(), NUNIQUE() 等函数
            agg_pattern = r'(SUM|AVG|COUNT|MIN|MAX|NUNIQUE)\(([^)]+)\)'

            def replace_agg(match):
                func = match.group(1).upper()
                col = match.group(2).strip()
                if col not in df.columns:
                    # Try to find similar column (handle deduplicated names like col_1)
                    found_col = None
                    for c in df.columns:
                        if c.startswith(col) or col.startswith(c.split('_')[0]):
                            found_col = c
                            break
                    if found_col:
                        col = found_col
                    else:
                        raise ValueError(f"Column {col} not found")

                # Fix: Use safe_get_column and ensure numeric conversion
                # This fixes "unsupported operand type(s) for -: 'str' and 'str'"
                try:
                    series = safe_get_column(df, col, as_numeric=True)
                except KeyError:
                    series = pd.to_numeric(df[col], errors='coerce')

                if func == "SUM":
                    result = series.sum()
                elif func == "AVG":
                    result = series.mean()
                elif func == "COUNT":
                    result = series.count()
                elif func == "MIN":
                    result = series.min()
                elif func == "MAX":
                    result = series.max()
                elif func == "NUNIQUE":
                    result = series.nunique()
                else:
                    return match.group(0)

                # Return float string to ensure numeric operations work
                return str(float(result)) if pd.notna(result) else "0"

            formula_exec = re.sub(agg_pattern, replace_agg, formula_exec)

            # 对于不包含聚合函数的公式，先聚合再计算
            if formula_exec == formula:
                # Fix: Use ensure_numeric_for_formula for type-safe values
                # Also build mapping for actual column names in DataFrame
                actual_required_cols = []
                for col in metric.required_columns:
                    if col in df.columns:
                        actual_required_cols.append(col)
                    else:
                        # Try to find similar column (handle deduplicated names)
                        for c in df.columns:
                            if c.startswith(col) or col.startswith(c.rstrip('_0123456789')):
                                actual_required_cols.append(c)
                                break
                        else:
                            actual_required_cols.append(col)  # Keep original if not found

                col_values = ensure_numeric_for_formula(df, actual_required_cols)

                # Create mapping from original column names to actual values
                col_mapping = {}
                for orig_col, actual_col in zip(metric.required_columns, actual_required_cols):
                    if actual_col in col_values:
                        col_mapping[orig_col] = col_values[actual_col]
                    elif orig_col in col_values:
                        col_mapping[orig_col] = col_values[orig_col]
                    else:
                        col_mapping[orig_col] = 0.0

                # 替换列名为值 (使用更可靠的方式处理中文列名)
                # Sort by length (longest first) to avoid partial replacements
                sorted_cols = sorted(col_mapping.keys(), key=len, reverse=True)
                for col in sorted_cols:
                    val = col_mapping[col]
                    # 使用 word boundary 或直接替换（对于中文列名）
                    escaped_col = re.escape(col)
                    # Try word boundary first (for ASCII names)
                    new_formula = re.sub(
                        rf'\b{escaped_col}\b',
                        str(float(val)),
                        formula_exec
                    )
                    # If no change, try direct replacement (for Chinese names)
                    if new_formula == formula_exec:
                        new_formula = formula_exec.replace(col, str(float(val)))
                    formula_exec = new_formula

            # Validate formula is ready for evaluation
            if not self._validate_formula_ready(formula_exec):
                logger.warning(f"Formula still has unresolved references: {formula_exec}")
                return None, {"note": f"公式包含无法解析的引用: {formula_exec[:50]}..."}

            # 安全执行公式
            value = self._safe_eval(formula_exec)

            # 处理分组
            breakdown = None
            if group_by and not any(f in formula for f in ["SUM(", "AVG(", "COUNT(", "MIN(", "MAX("]):
                breakdown = self._calc_grouped_formula(df, metric, group_by)

            return value, breakdown

        except Exception as e:
            logger.error(f"Formula calculation failed: {formula}, error: {e}")
            return None, None

    def _calc_grouped_formula(
        self,
        df: pd.DataFrame,
        metric: InferredMetric,
        group_by: List[str]
    ) -> Dict[str, float]:
        """计算分组的公式指标"""
        result = {}
        for name, group in df.groupby(group_by):
            try:
                # 为每个分组计算公式
                col_values = {}
                for col in metric.required_columns:
                    # Ensure numeric conversion
                    series = pd.to_numeric(group[col], errors='coerce')
                    col_values[col] = float(series.sum())

                formula_exec = metric.formula
                # Sort by length to avoid partial replacements
                sorted_cols = sorted(col_values.keys(), key=len, reverse=True)
                for col in sorted_cols:
                    val = col_values[col]
                    escaped_col = re.escape(col)
                    # Try word boundary first
                    new_formula = re.sub(
                        rf'\b{escaped_col}\b',
                        str(val),
                        formula_exec
                    )
                    # If no change, try direct replacement (for Chinese)
                    if new_formula == formula_exec:
                        new_formula = formula_exec.replace(col, str(val))
                    formula_exec = new_formula

                # Validate before eval
                if not self._validate_formula_ready(formula_exec):
                    continue

                value = self._safe_eval(formula_exec)
                key = str(name) if not isinstance(name, tuple) else "_".join(str(n) for n in name)
                result[key] = self._round_value(value)
            except Exception:
                pass

        return result if result else None

    def _calc_yoy_metric(self, df: pd.DataFrame, metric: InferredMetric) -> tuple:
        """计算同比指标"""
        # 从公式中提取列名
        # YOY(revenue_col, time_col)
        match = re.match(r'YOY\(([^,]+),\s*([^)]+)\)', metric.formula)
        if not match:
            return None, None

        value_col = match.group(1).strip()
        time_col = match.group(2).strip()

        if value_col not in df.columns or time_col not in df.columns:
            return None, None

        df = df.copy()
        df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
        df['year'] = df[time_col].dt.year

        yearly = df.groupby('year')[value_col].sum()
        if len(yearly) < 2:
            return None, {"note": "需要至少两年数据"}

        current = yearly.iloc[-1]
        previous = yearly.iloc[-2]

        if previous == 0:
            return None, {"note": "去年数据为0，无法计算"}

        yoy = (current - previous) / previous * 100

        return float(yoy), {
            "current_year": int(yearly.index[-1]),
            "current_value": float(current),
            "previous_year": int(yearly.index[-2]),
            "previous_value": float(previous)
        }

    def _calc_mom_metric(self, df: pd.DataFrame, metric: InferredMetric) -> tuple:
        """计算环比指标"""
        # 从公式中提取列名
        # MOM(revenue_col, time_col)
        match = re.match(r'MOM\(([^,]+),\s*([^)]+)\)', metric.formula)
        if not match:
            return None, None

        value_col = match.group(1).strip()
        time_col = match.group(2).strip()

        if value_col not in df.columns or time_col not in df.columns:
            return None, None

        df = df.copy()
        df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
        df['month'] = df[time_col].dt.to_period('M')

        monthly = df.groupby('month')[value_col].sum()
        if len(monthly) < 2:
            return None, {"note": "需要至少两个月数据"}

        current = monthly.iloc[-1]
        previous = monthly.iloc[-2]

        if previous == 0:
            return None, {"note": "上月数据为0，无法计算"}

        mom = (current - previous) / previous * 100

        return float(mom), {
            "current_month": str(monthly.index[-1]),
            "current_value": float(current),
            "previous_month": str(monthly.index[-2]),
            "previous_value": float(previous)
        }

    def _safe_eval(self, expression: str) -> Optional[float]:
        """安全执行数学表达式"""
        # 只允许数字和基本运算符
        allowed_chars = set('0123456789.+-*/() ')
        if not all(c in allowed_chars for c in expression):
            raise ValueError(f"Invalid characters in expression: {expression}")

        try:
            # 使用 eval 但限制命名空间
            result = eval(expression, {"__builtins__": {}}, {})
            return float(result) if result is not None else None
        except (ZeroDivisionError, ValueError, TypeError):
            return None

    async def infer_and_calculate_all(
        self,
        df: pd.DataFrame,
        scenario: Optional[str] = None,
        group_by: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        一站式：推断指标并计算所有指标

        Args:
            df: 数据 DataFrame
            scenario: 业务场景
            group_by: 分组字段

        Returns:
            包含推断的指标列表和计算结果
        """
        # 获取列信息 (handle duplicate column names using iloc)
        columns = list(df.columns)
        data_types = {}
        for idx, col in enumerate(columns):
            # Use iloc to handle duplicate column names
            series = df.iloc[:, idx]
            if isinstance(series, pd.DataFrame):
                series = series.iloc[:, 0]
            dtype = series.dtype
            if pd.api.types.is_numeric_dtype(dtype):
                data_types[col] = "number"
            elif pd.api.types.is_datetime64_any_dtype(dtype):
                data_types[col] = "date"
            else:
                data_types[col] = "text"

        # 推断指标
        sample_data = df.head(5).to_dict('records') if len(df) > 0 else None
        inferred_metrics = await self.infer_metrics(columns, data_types, scenario, sample_data)

        # 计算所有推断的指标
        results = []
        for metric in inferred_metrics:
            result = self.calculate_inferred_metric(df, metric, group_by)
            results.append({
                "metric": {
                    "name": metric.name,
                    "formula": metric.formula,
                    "description": metric.description,
                    "type": metric.metric_type,
                    "unit": metric.unit,
                    "category": metric.category,
                    "confidence": metric.confidence
                },
                "result": {
                    "success": result.success,
                    "value": result.value,
                    "unit": result.unit,
                    "breakdown": result.breakdown,
                    "error": result.error
                }
            })

        return {
            "success": True,
            "total_metrics": len(inferred_metrics),
            "calculated_metrics": len([r for r in results if r["result"]["success"]]),
            "metrics": results,
            "columns_analyzed": columns,
            "data_types": data_types
        }
