"""Schema helpers — detect equivalent columns across different POS brands.

Different POS systems name the same concept differently. Templates should
reach for these helpers instead of hardcoding one name, so a template that
works on qhj (门店名称) also works on 东门口/桂满陇 (店铺名称).
"""
from __future__ import annotations

from typing import Iterable, Optional, Tuple


# Ordered by specificity — first match wins.
# Apr 24 P0-3 fix: expand aliases — 不二君 CSV used column name 分店 which
# the narrower list missed, returning 0 stores despite having 营收 5024.5万.
# Add common variants from real 大众点评 merchant exports (桂满陇/唏嘛香/
# IL TEATRO/上马火锅/御九井/不二君 all tested).
_STORE_COL_CANDIDATES: Tuple[str, ...] = (
    "门店名称", "店铺名称", "分店名称", "店名称",
    "门店", "店铺", "分店", "店名",
    "门市", "branch_name", "store_name", "shop_name",
    "Store", "Branch", "Outlet", "Shop",
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

# Table/channel column — qhj splits 桌位 and 订单来源; other POS exports
# (e.g., 大张鸽) combine them into 桌位或订单来源.
_TABLE_COL_CANDIDATES: Tuple[str, ...] = (
    "桌位", "桌位或订单来源", "订单来源", "桌号",
)


# ─── Review-domain candidates (大众点评 / 美团 / 抖音 / 小红书 export naming) ───
# Ordered by specificity; first match wins via _first_present.
# Excludes deliberately:
#   _TASTE_SCORE_CANDIDATES does NOT contain bare "口味" (overlaps 口味标签 csv list)
#   _VIP_FLAG_CANDIDATES does NOT contain "会员" (matches 会员卡 measure col on POS)

_REVIEW_STORE_CANDIDATES: Tuple[str, ...] = (
    "具体门店",            # 大众点评 standard (qhj Q3/Q4 exports)
    "评价门店",            # 大众点评 alternate
    "门店名称", "店铺名称",  # POS-style names some merchants reuse
    "分店", "门市",          # 美团 / regional variants
    # Post-mapper internal standard — Java/Python excel parser renames
    # several store-like vendor names (e.g. 分店) to "region" before
    # persistence. T6 multi-merchant test (Apr 24 2026) revealed this:
    # row_data keys are "region", not the original 分店. Fallback last.
    "region",
)

_STAR_CANDIDATES: Tuple[str, ...] = ("星级分", "评分", "星级")
_TASTE_SCORE_CANDIDATES: Tuple[str, ...] = ("口味分",)
_ENV_SCORE_CANDIDATES: Tuple[str, ...] = ("环境分",)
_SERVICE_SCORE_CANDIDATES: Tuple[str, ...] = ("服务分",)

_REVIEW_TIME_CANDIDATES: Tuple[str, ...] = (
    "评价时间", "评论时间", "发表时间", "创建时间",
    # Post-mapper internal standard — Java/Python excel parser renames
    # the primary review-time vendor variant to "time_period". Other
    # time-like cols (投诉时间, 最新回复时间) become time_period_2/_3 but
    # are NOT review timestamps so deliberately excluded.
    "time_period",
)
_REVIEW_CONTENT_CANDIDATES: Tuple[str, ...] = (
    "评价详情", "评价内容", "评论详情", "评论内容",
)

_VIP_FLAG_CANDIDATES: Tuple[str, ...] = ("是否vip", "是否VIP", "VIP")
_COMPLAINT_STATUS_CANDIDATES: Tuple[str, ...] = ("投诉状态",)
_REVIEW_PLATFORM_CANDIDATES: Tuple[str, ...] = (
    "平台", "评价来源", "渠道", "来源",
)
_DISH_TAG_CANDIDATES: Tuple[str, ...] = ("菜品标签",)
_COMPLAINT_TITLE_CANDIDATES: Tuple[str, ...] = ("投诉标题",)


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


def find_table_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding table/channel info.

    qhj splits this into 桌位 (physical table) and 订单来源 (channel). Other
    POS exports (大张鸽/dzp) combine them into 桌位或订单来源 which carries
    both semantics in one column. The classify_table() heuristic recognizes
    both formats (无桌位(外卖)/纯数字/包厢/VIP), so a single column is fine.
    """
    return _first_present(cols, _TABLE_COL_CANDIDATES)


# ─── Review-domain helpers (added 2026-04-24, Slice 4 D-1 POC) ───

def find_review_store_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding the reviewed store identity, or None.

    Searches 具体门店 → 评价门店 → 门店名称 → 店铺名称 → 分店 → 门市.
    Distinct from find_store_col() which is POS-domain (transaction store).
    """
    return _first_present(cols, _REVIEW_STORE_CANDIDATES)


def find_star_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding overall star rating (1-5 scale), or None.

    Priority: 星级分 (qualified) → 评分 (synonym) → 星级 (bare).
    """
    return _first_present(cols, _STAR_CANDIDATES)


def find_taste_score_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding 口味 rating score, or None.

    Deliberately does NOT match bare 口味 — that overlaps with 口味标签
    (csv tag list); we want the rating score column only.
    """
    return _first_present(cols, _TASTE_SCORE_CANDIDATES)


def find_env_score_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding 环境 rating score, or None."""
    return _first_present(cols, _ENV_SCORE_CANDIDATES)


def find_service_score_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding 服务 rating score, or None.

    `_score` suffix disambiguates from POS 服务费 (service charge measure).
    """
    return _first_present(cols, _SERVICE_SCORE_CANDIDATES)


def find_review_time_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding review/comment timestamp, or None.

    Distinct from find_date_col() which is POS business-date semantics.
    """
    return _first_present(cols, _REVIEW_TIME_CANDIDATES)


def find_review_content_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding review free-text content, or None."""
    return _first_present(cols, _REVIEW_CONTENT_CANDIDATES)


def find_vip_flag_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding VIP boolean flag, or None.

    Boolean-flag column only — does NOT match 会员卡 (measure col on POS).
    """
    return _first_present(cols, _VIP_FLAG_CANDIDATES)


def find_complaint_status_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding complaint status, or None.

    Strict literal — only 投诉状态. Does NOT match 投诉时间 / 投诉内容 /
    投诉标题 which are different complaint columns.
    """
    return _first_present(cols, _COMPLAINT_STATUS_CANDIDATES)


def find_review_platform_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding review platform/source, or None."""
    return _first_present(cols, _REVIEW_PLATFORM_CANDIDATES)


def find_dish_tag_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding csv-comma-separated dish tags, or None.

    Strict literal — only 菜品标签. Does NOT match 口味标签 / 服务标签.
    """
    return _first_present(cols, _DISH_TAG_CANDIDATES)


def find_complaint_title_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding complaint title text, or None."""
    return _first_present(cols, _COMPLAINT_TITLE_CANDIDATES)


def preferred_revenue_col(cols: Iterable[str], primary_measure: Optional[str] = None) -> Optional[str]:
    """Return the best revenue column for user-facing questions.

    User asks "营业额"/"销售额"/"业绩" etc. For actionable insights, **actually
    received** (实收额) is usually more honest than gross (应收金额). qhj data
    has a ~25-30% gap: 应收 vs 实收 after platform commission + discounts.

    Preference order:
      1. 实收额 / 实收 / 实收金额 (net — what the restaurant actually received)
      2. primary_measure from schema (whatever domain_detector picked)
      3. 应收金额 / 营业额 (gross — listed price before deductions)

    Returns None if none of these exist.
    """
    col_set = set(cols)
    net = _first_present(col_set, _NET_REVENUE_CANDIDATES)
    if net:
        return net
    if primary_measure and primary_measure in col_set:
        return primary_measure
    gross = _first_present(col_set, _GROSS_REVENUE_CANDIDATES)
    if gross:
        return gross
    return None


def measure_annotation(col: Optional[str]) -> str:
    """Return a short annotation string for user-facing insights noting which
    measure was used. Example: '(按实收额统计)' or '(按应收金额统计)'."""
    if col is None:
        return ""
    if col in _NET_REVENUE_CANDIDATES:
        return f"(按{col}统计)"
    if col in _GROSS_REVENUE_CANDIDATES:
        return f"(按{col}统计 - 含扣减前)"
    return f"(按{col}统计)"
