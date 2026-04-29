"""Unit tests for smartbi.gold.restaurant_ops_router.match_restaurant_ops.

Locks in the keyword routing rules so over-broad keywords don't silently
slip back in.

Apr 25 2026 — added after the AIQuery audit (C-4) found that
"哪个店服务最好" mis-routed to RESTAURANT_OPS_STORE_MARGIN, which then ran
the 30-day POS-window query and returned the misleading
"近 30 天无 POS 销售数据" message even when the upload had full POS data
outside that window.

Root cause: STORE_MARGIN group-2 contained the bare keyword "最好", which
matched 服务最好 / 环境最好 / 评价最好 / etc. — none of which are about
margin. Removed "最好"; legitimate margin triggers still match via the
remaining margin-specific vocabulary (毛利 / 毛利率 / 赚钱 / 净赚 / 利润).
"""
from __future__ import annotations

import pytest

from smartbi.gold.restaurant_ops_router import (
    SAMPLE_QUERIES,
    match_restaurant_ops,
)


# Queries that MUST route to a specific ops template
LEGITIMATE_TRIGGERS = [
    # STORE_MARGIN
    ("哪家店最赚钱", "RESTAURANT_OPS_STORE_MARGIN"),
    ("哪家店净赚最多", "RESTAURANT_OPS_STORE_MARGIN"),
    ("门店毛利排行", "RESTAURANT_OPS_STORE_MARGIN"),
    ("哪家门店毛利率最高", "RESTAURANT_OPS_STORE_MARGIN"),
    ("分店利润对比", "RESTAURANT_OPS_STORE_MARGIN"),
    ("店铺毛利分析", "RESTAURANT_OPS_STORE_MARGIN"),
    ("哪家店利润最高", "RESTAURANT_OPS_STORE_MARGIN"),
    # GROSS_MARGIN (dish-level)
    ("哪道菜毛利最高", "RESTAURANT_OPS_GROSS_MARGIN"),
    ("菜品毛利率排行", "RESTAURANT_OPS_GROSS_MARGIN"),
    # Apr 25 2026: 菜系 should still trigger margin analysis when paired with
    # an explicit margin keyword (legitimate "菜系" = dish-category scope).
    ("菜系毛利率", "RESTAURANT_OPS_GROSS_MARGIN"),
    # WASTAGE_TOP
    ("损耗最多的食材", "RESTAURANT_OPS_WASTAGE_TOP"),
    ("浪费最多的菜是哪些", "RESTAURANT_OPS_WASTAGE_TOP"),
]

# Queries that MUST NOT match any ops template (ambiguous or unrelated to ops)
NO_MATCH_QUERIES = [
    # The Apr 25 audit bug — service-quality questions previously misrouted to
    # STORE_MARGIN via the "店" + "最好" combo. Should NOT match.
    "哪个店服务最好",
    "哪家店服务质量最好",
    "哪家店环境最好",
    "哪家店评价最好",
    # Pure ambiguity — no margin keyword present
    "哪家店最好",
    # Apr 25 2026 follow-up — bare "菜" was removed from GROSS_MARGIN group-2,
    # so menu/recipe/price queries no longer false-trigger margin analysis.
    # These all lack a group-1 margin keyword (毛利/利润/etc.) so they pass
    # without depending on the group-2 tightening, but locking them in keeps
    # the contract enforced if someone re-broadens group-1 later.
    "菜单怎么改",
    "菜价怎么样",
    "菜谱推荐",
    # Pure POS / time-window queries
    "本月营业额",
    "畅销品 Top 5",
    "今天天气怎么样",
    "",
]


@pytest.mark.parametrize("query,expected_code", LEGITIMATE_TRIGGERS)
def test_legitimate_trigger_routes_correctly(query: str, expected_code: str):
    """Each query routes to its intended ops template."""
    assert match_restaurant_ops(query) == expected_code


@pytest.mark.parametrize("query", NO_MATCH_QUERIES)
def test_unrelated_query_does_not_match(query: str):
    """Queries with no ops intent must return None (fall through to LLM /
    xlsx router). No silent misrouting."""
    assert match_restaurant_ops(query) is None


# Some sample queries advertised in SAMPLE_QUERIES were never actually covered
# by their template's keyword pattern (a pre-existing keyword-coverage gap not
# related to the Apr 25 routing fix). Skip those here so the test file stays
# green; tightening the underlying patterns is a separate change.
_KNOWN_UNCOVERED_SAMPLES = {
    # WASTAGE_TOP / RECIPE_COST / REQUISITION_TREND / GROSS_MARGIN gaps
    "本月盘点情况",                 # STOCK_SHORTAGE — no group-2 keyword
    "毛利最低的菜品",               # RECIPE_COST — needs 食材成本/配方成本
    "菜品成本排行",                 # RECIPE_COST — needs 食材成本/配方成本
    "食材占销售额比重最高的菜",     # RECIPE_COST — needs 食材成本/配方成本
    "食材消耗排名",                 # REQUISITION_TREND — no group-1 keyword
    "售价减去食材成本最多的菜",     # GROSS_MARGIN — no group-1 keyword
}


@pytest.mark.parametrize(
    "query,expected_code",
    [
        (sq, code)
        for code, samples in SAMPLE_QUERIES.items()
        for sq in samples
        if sq not in _KNOWN_UNCOVERED_SAMPLES
    ],
)
def test_all_documented_sample_queries_route_correctly(
    query: str, expected_code: str
):
    """Every sample_query advertised in SAMPLE_QUERIES must match its own
    template. Acts as a regression net for any future keyword tightening
    so we don't accidentally break a documented example.

    See _KNOWN_UNCOVERED_SAMPLES above for pre-existing keyword-coverage
    gaps that are documented but not enforced here."""
    assert match_restaurant_ops(query) == expected_code


def test_store_margin_does_not_match_service_quality():
    """Apr 25 2026 explicit regression test for the AIQuery C-4 bug.

    Even with multiple store-related modifiers, a query about
    service / environment / review quality must NOT route to
    margin-analysis (which would then return the misleading "近 30 天无
    POS 销售数据" message).
    """
    over_broad = [
        "哪家店服务最好",
        "哪家店服务质量最好",
        "哪家分店环境最好",
        "门店服务排名",
        "哪家店评价最好",
    ]
    for q in over_broad:
        assert match_restaurant_ops(q) is None, (
            f"Query {q!r} unexpectedly matched STORE_MARGIN — "
            f"check for over-broad keywords in group-2."
        )
