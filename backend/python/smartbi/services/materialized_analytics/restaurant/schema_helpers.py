"""Schema helpers — detect equivalent columns across different POS brands.

Different POS systems name the same concept differently. Templates should
reach for these helpers instead of hardcoding one name, so a template that
works on qhj (门店名称) also works on 东门口/桂满陇 (店铺名称).
"""
from __future__ import annotations

from typing import Iterable, Optional, Tuple


# Ordered by specificity — first match wins.
_STORE_COL_CANDIDATES: Tuple[str, ...] = (
    "门店名称", "店铺名称", "门店", "店铺", "店名",
)

_DATE_COL_CANDIDATES: Tuple[str, ...] = (
    # Business day (authoritative for daily aggregation)
    "营业日期", "交易日期", "业务日期", "单据业务日期", "日期",
    # Finer timestamps (fallback; slice to day when aggregating)
    "开单时间", "结单时间", "下单时间", "单据操作日期",
)

# Monetary columns by semantic role.
_GROSS_REVENUE_CANDIDATES: Tuple[str, ...] = (
    "应收金额", "营业额", "销售金额", "收款金额", "销售额",
)
_NET_REVENUE_CANDIDATES: Tuple[str, ...] = (
    "实收额", "实收金额", "实收", "实付", "折后金额",
)
_DISCOUNT_CANDIDATES: Tuple[str, ...] = (
    "折扣额", "优惠额", "优惠折扣", "分摊优惠",
)

# Order / customer count column candidates.
_CUSTOMER_COL_CANDIDATES: Tuple[str, ...] = (
    "客流量", "客数", "客单人数", "用餐人数", "就餐人数", "人数",
)

# Staff column candidates (extended beyond 服务员/销售员/收银员).
_STAFF_COL_CANDIDATES: Tuple[str, ...] = (
    "服务员", "销售员", "收银员", "店员", "员工",
)


def _first_present(cols: Iterable[str], candidates: Iterable[str]) -> Optional[str]:
    """Return first candidate that appears in cols, else None."""
    col_set = set(cols)
    for c in candidates:
        if c in col_set:
            return c
    return None


def find_store_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column name holding store identity, or None.

    Searches 门店名称 → 店铺名称 → 门店 → 店铺 → 店名.
    """
    return _first_present(cols, _STORE_COL_CANDIDATES)


def find_date_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column name holding business date, or None.

    Prefers explicit business-day columns (营业日期 / 交易日期) before
    falling back to operation/timestamp columns (开单时间 etc.).
    """
    return _first_present(cols, _DATE_COL_CANDIDATES)


def find_gross_revenue_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column name holding gross revenue (before deductions)."""
    return _first_present(cols, _GROSS_REVENUE_CANDIDATES)


def find_net_revenue_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column name holding net revenue (after deductions)."""
    return _first_present(cols, _NET_REVENUE_CANDIDATES)


def find_discount_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column name holding discount amount."""
    return _first_present(cols, _DISCOUNT_CANDIDATES)


def find_customer_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column name holding per-order customer count."""
    return _first_present(cols, _CUSTOMER_COL_CANDIDATES)


def find_staff_col(cols: Iterable[str]) -> Optional[str]:
    """Return the first staff-role column present (服务员 → 销售员 → ...)."""
    return _first_present(cols, _STAFF_COL_CANDIDATES)
