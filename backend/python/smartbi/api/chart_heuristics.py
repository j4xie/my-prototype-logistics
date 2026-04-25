"""chart_heuristics.py — pure helpers for chart auto-detection guards.

Phase 11 G2 added pd.to_datetime numeric guard. This module adds the next layer:
  - ID-suffix guard: columns named 账单号/编号/ID/uuid never become measure/time
  - Cardinality guard: high-cardinality columns are poor xField candidates

Used by chart.py recommend_chart / smart_recommend_chart to filter
numeric_cols / date_cols / categorical_cols before chart-type recommendation.
"""
from __future__ import annotations

from typing import List, Tuple

# Mirror of field_classifier._ID_LIKE_KEYWORDS — kept in sync to avoid
# importing the heavier classifier module from request hot path.
_ID_LIKE_KEYWORDS: Tuple[str, ...] = (
    "账单号", "单号", "编号", "流水号", "发票号", "会员号", "员工号", "房号",
    "id", "uuid", "code",
)


def is_id_like_column_name(name: str) -> bool:
    """True when a column NAME suggests it identifies a record (never measure/time).

    Examples:
        is_id_like_column_name("账单号") → True
        is_id_like_column_name("订单ID") → True
        is_id_like_column_name("uuid") → True
        is_id_like_column_name("营业额") → False
        is_id_like_column_name("门店") → False
    """
    if not name:
        return False
    lower = name.lower()
    return any(kw.lower() in lower for kw in _ID_LIKE_KEYWORDS)


def is_high_cardinality_column(series, threshold: float = 0.5) -> bool:
    """True when a column has too many distinct values to be a useful xField/series.

    A column with distinct/total ratio above threshold is more like an identifier
    than a category (e.g. 客户名 with 5000 distinct values in 10000 rows).

    Args:
        series: pandas Series
        threshold: ratio above which column is considered high-cardinality (default 0.5)
    """
    total = len(series)
    if total == 0:
        return False
    distinct = series.dropna().nunique()
    return distinct / total > threshold


def filter_id_like_columns(column_names: List[str]) -> List[str]:
    """Return column_names with ID-named entries removed."""
    return [c for c in column_names if not is_id_like_column_name(c)]


def pick_categorical_xfield(df, categorical_cols: List[str], threshold: float = 0.5) -> str:
    """Pick the best categorical column for xField, preferring low-cardinality.

    Returns first column with cardinality below threshold, else falls back to
    first column (preserves prior behavior when ALL cols are high-cardinality).
    """
    if not categorical_cols:
        return None
    for col in categorical_cols:
        if col in df.columns and not is_high_cardinality_column(df[col], threshold):
            return col
    return categorical_cols[0]
