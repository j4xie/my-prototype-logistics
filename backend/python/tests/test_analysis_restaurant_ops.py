"""Phase IIb restaurant kitchen-cost & ops analytics unit tests.

Covers spec §4.2 / §4.3 / §4.5 (8 edge case rows). Mocks the asyncpg
pool with ``_FakeConn`` / ``_FakePool`` pattern reused from
``test_analysis_finance_restaurant.py``.

Edge cases (§4.5):
1. Restaurant chain has no wastage rows in date range
2. Requisition data exists but POS revenue is 0 (REQ_OK + POS_EMPTY)
3. POS revenue exists but no requisition rows (POS_OK + REQ_EMPTY)
4. startDate > endDate (caller bug → HTTP 400)
5. Date range > 1 year (allow, no hard cap — spec §4.5 implicit)
6. Deleted ingredient (ingredient_id not in dim_ingredient) → COALESCE
7. Stocktaking event with difference_cost = NULL (excluded from totals,
   included in stocktakingCount)
8. Same factory_id + date has both Silver rows AND Gold row → prefer Gold
   (this is an architectural decision; not directly testable without
   integration; we cover the Silver-direct path which is the impl
   default per §2.3)

Also tests:
* Factory branch returns FACTORY_BRANCH_NOT_APPLICABLE envelope
* Full data branch (R_XMX_CHAIN-shape) → all 4 sub-reports populated
* Partial data (wastage only, no requisition) → wastage rate null
* Rule 1: Decimal("0") preserved (NOT treated as None)
* Rule 4: monetary values are JSON numbers (int / float, not strings)
* Rule 6: None dates raise ValueError
* Rule 7: alert thresholds use Decimal comparison
* Rule 10: ratio uses divide(4) → multiply → quantize(2)
* Rule 11: generatedAt uses _java_isoformat
* Rule 12: percent display uses HALF_UP, not banker's
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional

import pytest
from fastapi import HTTPException

from smartbi_compat.api.analysis_restaurant_ops import (
    BENCHMARK_CRITICAL,
    BENCHMARK_HEALTHY,
    BENCHMARK_WARNING,
    CATEGORY_OTHER,
    FACTORY_BRANCH_NOT_APPLICABLE,
    _compute_alert_level,
    _empty_kitchen_cost_envelope,
    _factory_branch_not_applicable_envelope,
    _format_percent_half_up,
    _get_food_cost_ratio,
    _get_requisition_trend,
    _get_stocktaking_variance,
    _get_wastage_analytics,
    _normalize_category,
    _period_key,
    _ratio_with_intermediate_quantize,
    _restaurant_kitchen_cost_dispatch,
    _safe_topn,
)


# ============================================================
# Fake asyncpg infrastructure (reused from test_analysis_finance_restaurant.py)
# ============================================================


class _FakeConn:
    """SQL-fragment-keyed mock conn. Match queries via substring in SQL."""

    def __init__(
        self,
        *,
        fetch_map: Optional[Any] = None,
        fetchrow_map: Optional[Any] = None,
    ):
        self._fetch_map = fetch_map or {}
        self._fetchrow_map = fetchrow_map or {}

    async def fetch(self, sql, *args):
        if isinstance(self._fetch_map, list):
            return self._fetch_map
        for key, rows in self._fetch_map.items():
            if key in sql:
                return rows
        return []

    async def fetchrow(self, sql, *args):
        if isinstance(self._fetchrow_map, dict):
            # Try keyed match first.
            for key, row in self._fetchrow_map.items():
                if key in sql:
                    return row
            return None
        return self._fetchrow_map


class _FakePool:
    def __init__(self, conn):
        self._conn = conn

    def acquire(self):
        conn = self._conn

        class _Ctx:
            async def __aenter__(self):
                return conn

            async def __aexit__(self, *exc):
                return False

        return _Ctx()


# ============================================================
# Pure helpers — no DB
# ============================================================


def test_normalize_category_synonyms():
    """Spec §2.1: synonym pollution merged into canonical form."""
    assert _normalize_category("蔬菜类") == "蔬菜"
    assert _normalize_category("调料") == "调味料"
    assert _normalize_category("主粮类") == "主食"
    assert _normalize_category("肉类") == "肉类"  # not in synonym map → as-is


def test_normalize_category_null_and_whitespace():
    """NULL / empty / whitespace-only → "其他"."""
    assert _normalize_category(None) == CATEGORY_OTHER
    assert _normalize_category("") == CATEGORY_OTHER
    assert _normalize_category("   ") == CATEGORY_OTHER


def test_normalize_category_strips_whitespace():
    """Surrounding whitespace stripped before synonym match."""
    assert _normalize_category("  蔬菜类  ") == "蔬菜"
    assert _normalize_category(" 肉类 ") == "肉类"


def test_safe_topn_clamps():
    """topN clamps to [1, 50] with default 10 fallback for None / <= 0."""
    assert _safe_topn(None) == 10
    assert _safe_topn(0) == 10
    assert _safe_topn(-5) == 10
    assert _safe_topn(5) == 5
    assert _safe_topn(50) == 50
    assert _safe_topn(100) == 50  # clamp to MAX_TOP_N


def test_period_key_day():
    assert _period_key(date(2026, 5, 15), "day") == "2026-05-15"


def test_period_key_week_calendar_year_boundary():
    """Rule 2: WEEK uses calendar year (d.year), NOT ISO year."""
    # 2024-12-30 is a Monday; ISO calendar says it's week 01 of ISO year 2025
    # but Java date.getYear() says 2024 → period key "2024-W01".
    d = date(2024, 12, 30)
    iso_year, iso_week, _ = d.isocalendar()
    assert iso_year == 2025  # ISO year differs
    assert iso_week == 1
    assert _period_key(d, "week") == "2024-W01"  # calendar year used


def test_period_key_month():
    assert _period_key(date(2026, 5, 15), "month") == "2026-05"
    assert _period_key(date(2026, 1, 1), "month") == "2026-01"


def test_compute_alert_level_thresholds():
    """Rule 7: Decimal comparison for 0.30 / 0.35 / 0.40 thresholds."""
    # < 0.30 — GREEN with optimistic msg
    level, msg = _compute_alert_level(Decimal("0.25"))
    assert level == "GREEN"
    assert "健康" in msg

    # 0.30 <= ratio < 0.35 — GREEN with neutral msg
    level, msg = _compute_alert_level(Decimal("0.30"))
    assert level == "GREEN"
    assert "正常" in msg
    level, msg = _compute_alert_level(Decimal("0.349"))
    assert level == "GREEN"

    # 0.35 <= ratio < 0.40 — YELLOW
    level, msg = _compute_alert_level(Decimal("0.35"))
    assert level == "YELLOW"
    assert "偏高" in msg

    # >= 0.40 — RED
    level, msg = _compute_alert_level(Decimal("0.40"))
    assert level == "RED"
    assert "严重偏高" in msg
    level, msg = _compute_alert_level(Decimal("0.55"))
    assert level == "RED"

    # None → no alert + null message
    level, msg = _compute_alert_level(None)
    assert level is None
    assert "暂无营收" in msg


def test_compute_alert_level_message_includes_percent_half_up():
    """Rule 12: percent in YELLOW / RED messages uses HALF_UP, not banker's."""
    # Decimal("0.3545") → 35.45% → quantize HALF_UP at 0.1 → "35.5"
    level, msg = _compute_alert_level(Decimal("0.3545"))
    assert level == "YELLOW"
    assert "35.5%" in msg


def test_format_percent_half_up_boundary():
    """Rule 12: 0.5 boundary rounds UP (HALF_UP), not to even (banker's)."""
    # 34.55% → "34.6" with HALF_UP, would be "34.5" or "34.6" depending on
    # banker's vs binary float quirks. _format_percent_half_up uses Decimal
    # HALF_UP — predictable.
    # Decimal("0.3455") * 100 = Decimal("34.55") → quantize(0.1, HALF_UP) → "34.6"
    assert _format_percent_half_up(Decimal("0.3455")) == "34.6"
    # Decimal("0.3445") * 100 = Decimal("34.45") → "34.5"
    assert _format_percent_half_up(Decimal("0.3445")) == "34.5"


def test_ratio_with_intermediate_quantize_rule_10():
    """Rule 10: divide(4, HALF_UP) → multiply(100) → quantize(2, HALF_UP)."""
    # 1 / 3 → 0.3333 (quantize 4) → 33.33 (×100 quantize 2)
    ratio, percent = _ratio_with_intermediate_quantize(Decimal("1"), Decimal("3"))
    assert ratio == Decimal("0.3333")
    assert percent == Decimal("33.33")

    # Denominator zero → (None, None) per Rule 1 honest signal
    ratio, percent = _ratio_with_intermediate_quantize(Decimal("0"), Decimal("0"))
    assert ratio is None
    assert percent is None


def test_benchmark_constants_are_decimal():
    """Rule 7: thresholds must be Decimal, NOT float (avoid IEEE 754 boundary)."""
    assert isinstance(BENCHMARK_HEALTHY, Decimal)
    assert isinstance(BENCHMARK_WARNING, Decimal)
    assert isinstance(BENCHMARK_CRITICAL, Decimal)
    assert BENCHMARK_HEALTHY == Decimal("0.30")
    assert BENCHMARK_WARNING == Decimal("0.35")
    assert BENCHMARK_CRITICAL == Decimal("0.40")


# ============================================================
# Empty envelope — defensive pool-unavailable
# ============================================================


def test_empty_kitchen_cost_envelope_shape():
    """Pool unavailable → empty envelope with all 4 sub-reports zero/null."""
    env = _empty_kitchen_cost_envelope(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), "day"
    )
    assert env["tenantType"] == "RESTAURANT"
    assert env["factoryId"] == "R_TEST"
    assert env["dateRange"]["days"] == 31
    assert env["dateRange"]["groupBy"] == "day"
    assert env["wastageAnalytics"]["totalWastageCost"] == 0
    assert env["wastageAnalytics"]["wastageRate"] is None
    assert env["wastageAnalytics"]["topWasteIngredients"] == []
    assert env["requisitionTrend"]["byCategory"] == []
    assert env["stocktakingVariance"]["lastStocktakingDate"] is None
    assert env["foodCostRatio"]["ratio"] is None
    assert env["foodCostRatio"]["alertLevel"] is None
    assert env["foodCostRatio"]["dataCaveats"] == [
        "使用领料估算成本（est_cost），非会计实际成本"
    ]


# ============================================================
# Factory branch envelope (§4.3)
# ============================================================


def test_factory_branch_not_applicable_envelope():
    """Spec §4.3: factory tenants get success:true + notApplicable envelope."""
    env = _factory_branch_not_applicable_envelope("F001")
    assert env["success"] is True
    data = env["data"]
    assert data["tenantType"] == "FACTORY"
    assert data["factoryId"] == "F001"
    assert data["notApplicable"] is True
    assert data["code"] == FACTORY_BRANCH_NOT_APPLICABLE
    assert "餐饮租户" in data["message"]


# ============================================================
# Wastage analytics — Silver query path
# ============================================================


@pytest.mark.asyncio
async def test_wastage_analytics_empty_branch():
    """Edge case 1: zero wastage rows → totals 0, arrays empty, rate null."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_wastage": {
                "total_cost": Decimal("0"),
                "event_count": 0,
            },
        },
        fetch_map={"fact_restaurant_wastage": []},
    )
    result = await _get_wastage_analytics(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31),
        group_by="day", top_n=10,
        total_requisition_cost=Decimal("0"), conn=conn,
    )
    assert result["totalWastageCost"] == 0
    assert result["totalWastageEvents"] == 0
    assert result["wastageRate"] is None
    assert result["wastageRatePercent"] is None
    assert result["topWasteIngredients"] == []
    assert result["wastageByType"] == []
    assert result["trend"] == []
    assert result["dataSource"] == "agg_restaurant_daily_totals+fact_restaurant_wastage"


@pytest.mark.asyncio
async def test_wastage_analytics_full_data_with_rate():
    """Full data: rate computed against threaded total_requisition_cost (Rule 10)."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_wastage": {
                "total_cost": Decimal("8420.50"),
                "event_count": 142,
            },
        },
        fetch_map={
            "GROUP BY wastage_type": [
                {"type": "EXPIRED", "total_cost": Decimal("4200.00"), "event_count": 62},
                {"type": "DAMAGED", "total_cost": Decimal("1820.50"), "event_count": 38},
            ],
            "GROUP BY w.ingredient_id": [
                {
                    "ingredient_id": 1042, "name": "三文鱼", "category": "肉类",
                    "unit": "kg",
                    "total_cost": Decimal("1850.00"),
                    "quantity": Decimal("4.500"),
                    "event_count": 18,
                },
            ],
            "GROUP BY date": [
                {"day": date(2026, 5, 1), "total_cost": Decimal("280.00"), "event_count": 5},
            ],
        },
    )
    # Wastage / Requisition: 8420.50 / 247500.00 → 0.0340 → 3.40%
    result = await _get_wastage_analytics(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31),
        group_by="day", top_n=10,
        total_requisition_cost=Decimal("247500.00"), conn=conn,
    )
    # Rule 4: scale-2 Decimal 8420.50 → float 8420.5 (trailing zero lost — dict-eq gate)
    assert result["totalWastageCost"] == 8420.5
    assert result["totalWastageEvents"] == 142
    # Rule 10: 8420.50 / 247500.00 = 0.034022... → quantize 4 = 0.0340 → percent 3.40
    assert result["wastageRate"] == 0.034
    assert result["wastageRatePercent"] == 3.4
    assert len(result["topWasteIngredients"]) == 1
    top = result["topWasteIngredients"][0]
    assert top["name"] == "三文鱼"
    assert top["category"] == "肉类"
    assert top["totalCost"] == 1850
    assert top["unit"] == "kg"
    assert top["eventCount"] == 18
    assert len(result["wastageByType"]) == 2
    assert result["trend"][0]["period"] == "2026-05-01"


@pytest.mark.asyncio
async def test_wastage_deleted_ingredient_coalesce():
    """Edge case 6: deleted ingredient → COALESCE label preserved."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_wastage": {
                "total_cost": Decimal("500.00"),
                "event_count": 3,
            },
        },
        fetch_map={
            "GROUP BY wastage_type": [],
            "GROUP BY w.ingredient_id": [
                {
                    # name is what the SQL COALESCE returns — for a deleted
                    # ingredient the DB hands us the synthesized label.
                    "ingredient_id": 9999, "name": "(已删除食材 #9999)",
                    "category": None, "unit": None,
                    "total_cost": Decimal("500.00"),
                    "quantity": Decimal("1.000"),
                    "event_count": 3,
                },
            ],
            "GROUP BY date": [],
        },
    )
    result = await _get_wastage_analytics(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31),
        group_by="day", top_n=10,
        total_requisition_cost=Decimal("10000"), conn=conn,
    )
    top = result["topWasteIngredients"][0]
    assert "(已删除食材 #9999)" == top["name"]
    # NULL category → normalized to "其他"
    assert top["category"] == CATEGORY_OTHER


@pytest.mark.asyncio
async def test_wastage_rule_6_none_dates_raises():
    """Rule 6: None dates → ValueError, NOT silent zero-row."""
    conn = _FakeConn()
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _get_wastage_analytics(
            "R_TEST", None, date(2026, 5, 31),
            group_by="day", top_n=10,
            total_requisition_cost=Decimal("0"), conn=conn,
        )


# ============================================================
# Requisition trend
# ============================================================


@pytest.mark.asyncio
async def test_requisition_trend_empty():
    """Empty rows → totals 0, byCategory empty, trend empty."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_requisition": {
                "total_cost": Decimal("0"),
                "event_count": 0,
            },
        },
        fetch_map={"fact_restaurant_requisition": []},
    )
    result = await _get_requisition_trend(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), "day", conn
    )
    assert result["totalCost"] == 0
    assert result["totalEvents"] == 0
    assert result["byCategory"] == []
    assert result["trend"] == []


@pytest.mark.asyncio
async def test_requisition_trend_synonym_merge_and_top5_rollup():
    """Spec §2.1: synonym merge + Top-5 + "其他" rollup.

    Distinct categories after merge:
      蔬菜    = 300 + 200 = 500
      肉类    = 250
      调味料  =  80 +  40 = 120
      主食    = 100
      水产    =  30
      鱼类    =  20  ← 6th category, must fall into rest → 其他 rollup
      豆制品  =  10  ← 7th category, also rolls into 其他
    """
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_requisition": {
                "total_cost": Decimal("1220.00"),
                "event_count": 8,
            },
        },
        fetch_map={
            "GROUP BY i.category": [
                {"raw_category": "蔬菜",   "total_cost": Decimal("300.00"), "event_count": 2},
                {"raw_category": "蔬菜类", "total_cost": Decimal("200.00"), "event_count": 1},
                {"raw_category": "肉类",   "total_cost": Decimal("250.00"), "event_count": 1},
                {"raw_category": "主食",   "total_cost": Decimal("100.00"), "event_count": 1},
                {"raw_category": "调料",   "total_cost": Decimal("80.00"),  "event_count": 1},
                {"raw_category": "调味料", "total_cost": Decimal("40.00"),  "event_count": 1},
                {"raw_category": "水产",   "total_cost": Decimal("30.00"),  "event_count": 1},
                # 6th distinct category (after merge) → rolls into 其他.
                {"raw_category": "鱼类",   "total_cost": Decimal("20.00"),  "event_count": 1},
                # 7th → also rolls into 其他.
                {"raw_category": "豆制品", "total_cost": Decimal("10.00"),  "event_count": 1},
            ],
            "GROUP BY date": [],
        },
    )
    result = await _get_requisition_trend(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), "day", conn
    )
    by_cat = {row["category"]: row for row in result["byCategory"]}

    # 蔬菜 should be 300+200 = 500.
    assert by_cat["蔬菜"]["totalCost"] == 500
    # 调味料 should be 80+40 = 120 (调料 merged in).
    assert by_cat["调味料"]["totalCost"] == 120
    # Top-5 are 蔬菜 / 肉类 / 调味料 / 主食 / 水产 — all should be present.
    for top_cat in ("蔬菜", "肉类", "调味料", "主食", "水产"):
        assert top_cat in by_cat
    # 鱼类 + 豆制品 fall out of top-5 → rolled into 其他.
    assert "鱼类" not in by_cat
    assert "豆制品" not in by_cat
    # 其他 rollup present with 20 + 10 = 30.
    assert CATEGORY_OTHER in by_cat
    assert by_cat[CATEGORY_OTHER]["totalCost"] == 30
    # Top-5 + 其他 = exactly 6 rows.
    assert len(result["byCategory"]) == 6


# ============================================================
# Stocktaking variance
# ============================================================


@pytest.mark.asyncio
async def test_stocktaking_empty():
    """Empty rows → totals 0, byIngredient empty, lastDate None."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_stocktaking": {
                "shortage_qty": Decimal("0"),
                "shortage_cost": Decimal("0"),
                "surplus_qty": Decimal("0"),
                "surplus_cost": Decimal("0"),
                "last_date": None,
                "event_count": 0,
            },
        },
        fetch_map={"fact_restaurant_stocktaking": []},
    )
    result = await _get_stocktaking_variance(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), 10, conn
    )
    assert result["totalShortageCost"] == 0
    assert result["lastStocktakingDate"] is None
    assert result["stocktakingCount"] == 0
    assert result["byIngredient"] == []


@pytest.mark.asyncio
async def test_stocktaking_full_data():
    """Shortage + surplus aggregations, net variance, lastDate ISO format."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_stocktaking": {
                "shortage_qty": Decimal("-42.500"),
                "shortage_cost": Decimal("3850.00"),
                "surplus_qty": Decimal("18.250"),
                "surplus_cost": Decimal("1240.50"),
                "last_date": date(2026, 5, 10),
                "event_count": 4,
            },
        },
        fetch_map={
            "GROUP BY s.ingredient_id": [
                {
                    "ingredient_id": 1042, "name": "三文鱼", "category": "肉类",
                    "diff_qty": Decimal("-8.250"),
                    "diff_cost": Decimal("-1650.00"),
                },
            ],
        },
    )
    result = await _get_stocktaking_variance(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), 10, conn
    )
    # Net = shortage_cost - surplus_cost (positive = net loss).
    # 3850 - 1240.50 = 2609.50
    assert result["totalShortageCost"] == 3850
    assert result["totalSurplusCost"] == 1240.5
    assert result["netVarianceCost"] == 2609.5
    assert result["lastStocktakingDate"] == "2026-05-10"
    assert result["stocktakingCount"] == 4
    assert len(result["byIngredient"]) == 1


@pytest.mark.asyncio
async def test_stocktaking_null_difference_cost_excluded_from_totals():
    """Edge case 7: difference_cost = NULL → excluded from totals, included in count.

    SQL-side ``COALESCE(SUM(...), 0)`` already excludes NULL from totals
    (NULL rows don't contribute to SUM). ``COUNT(*)`` always includes
    them. The Python code just trusts the SQL aggregates."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_stocktaking": {
                # event_count = 5 but only 3 have non-null difference_cost.
                "shortage_qty": Decimal("-2.000"),
                "shortage_cost": Decimal("100.00"),
                "surplus_qty": Decimal("0"),
                "surplus_cost": Decimal("0"),
                "last_date": date(2026, 5, 5),
                "event_count": 5,
            },
        },
        fetch_map={"GROUP BY s.ingredient_id": []},
    )
    result = await _get_stocktaking_variance(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), 10, conn
    )
    # All 5 events counted, but totals only reflect the 3 non-null rows.
    assert result["stocktakingCount"] == 5
    assert result["totalShortageCost"] == 100


# ============================================================
# Food cost ratio — edge cases §4.5
# ============================================================


@pytest.mark.asyncio
async def test_food_cost_ratio_req_ok_pos_empty():
    """Edge case 2 (§4.5): REQ_OK + POS_EMPTY → totalRequisitionCost
    preserved, ratio null, alert null."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_requisition": {
                "total_cost": Decimal("247500.00"),
                "event_count": 894,
            },
            "FROM agg_daily": {"total_revenue": Decimal("0")},
        },
    )
    food_cost_ratio, total_req = await _get_food_cost_ratio(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    # Requisition cost preserved (NOT zeroed).
    assert food_cost_ratio["totalRequisitionCost"] == 247500
    assert food_cost_ratio["totalRevenue"] == 0
    # Ratio null + alert null + explanatory message.
    assert food_cost_ratio["ratio"] is None
    assert food_cost_ratio["ratioPercent"] is None
    assert food_cost_ratio["alertLevel"] is None
    assert "暂无营收" in food_cost_ratio["alertMessage"]
    # total_req threaded out for wastage rate denominator.
    assert total_req == Decimal("247500.00")


@pytest.mark.asyncio
async def test_food_cost_ratio_pos_ok_req_empty():
    """Edge case 3 (§4.5): POS_OK + REQ_EMPTY → ratio=0.0, alertLevel=GREEN."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_requisition": {
                "total_cost": Decimal("0"),
                "event_count": 0,
            },
            "FROM agg_daily": {"total_revenue": Decimal("100000.00")},
        },
    )
    food_cost_ratio, total_req = await _get_food_cost_ratio(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert food_cost_ratio["totalRequisitionCost"] == 0
    assert food_cost_ratio["totalRevenue"] == 100000
    # 0 ratio is meaningful "no waste".
    assert food_cost_ratio["ratio"] == 0
    assert food_cost_ratio["ratioPercent"] == 0
    assert food_cost_ratio["alertLevel"] == "GREEN"
    assert "暂无领料" in food_cost_ratio["alertMessage"]
    assert total_req == Decimal("0")


@pytest.mark.asyncio
async def test_food_cost_ratio_full_data_green_neutral_zone():
    """Standard path: ratio ≈ 0.3438 → GREEN (in [0.30, 0.35) neutral band).

    Spec §4.2 threshold table:
      ratio < 0.30          → GREEN (optimistic)
      0.30 ≤ ratio < 0.35   → GREEN (neutral)
      0.35 ≤ ratio < 0.40   → YELLOW (warning)
      ratio ≥ 0.40          → RED (critical)
    """
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_requisition": {
                "total_cost": Decimal("247500.00"),
                "event_count": 894,
            },
            "FROM agg_daily": {"total_revenue": Decimal("720000.00")},
        },
    )
    food_cost_ratio, _ = await _get_food_cost_ratio(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    # 247500 / 720000 = 0.34375 → Rule 10 quantize 4 → 0.3438 → 34.38%
    assert food_cost_ratio["ratio"] == 0.3438
    assert food_cost_ratio["ratioPercent"] == 34.38
    # 0.3438 ∈ [0.30, 0.35) → GREEN with neutral message ("正常").
    assert food_cost_ratio["alertLevel"] == "GREEN"
    assert "正常" in food_cost_ratio["alertMessage"]


@pytest.mark.asyncio
async def test_food_cost_ratio_yellow_warning_zone():
    """Ratio in [0.35, 0.40) → YELLOW."""
    # 380000 / 1000000 = 0.38 → YELLOW
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_requisition": {
                "total_cost": Decimal("380000.00"),
                "event_count": 1500,
            },
            "FROM agg_daily": {"total_revenue": Decimal("1000000.00")},
        },
    )
    food_cost_ratio, _ = await _get_food_cost_ratio(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert food_cost_ratio["ratio"] == 0.38
    assert food_cost_ratio["alertLevel"] == "YELLOW"
    # Rule 12: percent in message should be HALF_UP — 38.0% → "38.0".
    assert "38.0%" in food_cost_ratio["alertMessage"]


@pytest.mark.asyncio
async def test_food_cost_ratio_critical_red():
    """ratio ≥ 0.40 → RED."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_requisition": {
                "total_cost": Decimal("450000.00"),
                "event_count": 200,
            },
            "FROM agg_daily": {"total_revenue": Decimal("1000000.00")},
        },
    )
    food_cost_ratio, _ = await _get_food_cost_ratio(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert food_cost_ratio["ratio"] == 0.45
    assert food_cost_ratio["alertLevel"] == "RED"


@pytest.mark.asyncio
async def test_food_cost_ratio_both_zero():
    """All-zero branch: ratio null + alert null + neutral message."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_requisition": {
                "total_cost": Decimal("0"),
                "event_count": 0,
            },
            "FROM agg_daily": {"total_revenue": Decimal("0")},
        },
    )
    food_cost_ratio, _ = await _get_food_cost_ratio(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert food_cost_ratio["ratio"] is None
    assert food_cost_ratio["ratioPercent"] is None
    assert food_cost_ratio["alertLevel"] is None
    assert food_cost_ratio["dataCaveats"] == [
        "使用领料估算成本（est_cost），非会计实际成本"
    ]


# ============================================================
# Dispatcher integration
# ============================================================


@pytest.mark.asyncio
async def test_dispatcher_invalid_date_range_400():
    """Edge case 4 (§4.5): startDate > endDate → HTTP 400."""
    with pytest.raises(HTTPException) as exc_info:
        await _restaurant_kitchen_cost_dispatch(
            "R_TEST", date(2026, 6, 1), date(2026, 5, 1), "day", 10
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_DATE_RANGE"


@pytest.mark.asyncio
async def test_dispatcher_long_date_range_allowed():
    """Edge case 5 (§4.5): date range > 1 year is allowed (no hard cap)."""
    # Use the pool-unavailable fast path to avoid mocking 4 SQL fragments.
    async def _no_pool():
        return None

    import smartbi.config as cfg
    saved = cfg.get_pg_pool
    cfg.get_pg_pool = _no_pool
    try:
        env = await _restaurant_kitchen_cost_dispatch(
            "R_TEST", date(2025, 1, 1), date(2026, 12, 31), "month", 10
        )
    finally:
        cfg.get_pg_pool = saved
    assert env["success"] is True
    # 730+ days range allowed.
    assert env["data"]["dateRange"]["days"] >= 730


@pytest.mark.asyncio
async def test_dispatcher_pool_unavailable_returns_empty_envelope(monkeypatch):
    """Defensive: pool failure → empty envelope, not 500."""
    async def _no_pool():
        return None

    import smartbi.config as cfg
    monkeypatch.setattr(cfg, "get_pg_pool", _no_pool)
    env = await _restaurant_kitchen_cost_dispatch(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), "day", 10
    )
    assert env["success"] is True
    data = env["data"]
    assert data["tenantType"] == "RESTAURANT"
    assert data["dateRange"]["startDate"] == "2026-05-01"
    assert data["wastageAnalytics"]["totalWastageCost"] == 0
    assert data["foodCostRatio"]["ratio"] is None
    # generatedAt present + ISO-like.
    assert isinstance(data["generatedAt"], str)
    assert "T" in data["generatedAt"]


@pytest.mark.asyncio
async def test_dispatcher_full_data_all_sub_reports(monkeypatch):
    """Full data branch (R_XMX_CHAIN shape): all 4 sub-reports populated."""
    # Build a conn that responds to all 4 sub-report queries.
    conn = _FakeConn(
        fetchrow_map={
            # _get_food_cost_ratio — requisition summary
            "FROM fact_restaurant_requisition\n        WHERE factory_id": {
                "total_cost": Decimal("100000.00"),
                "event_count": 50,
            },
            # _get_food_cost_ratio — revenue
            "FROM agg_daily": {"total_revenue": Decimal("300000.00")},
            # _get_wastage_analytics — summary
            "FROM fact_restaurant_wastage\n        WHERE factory_id": {
                "total_cost": Decimal("5000.00"),
                "event_count": 20,
            },
            # _get_stocktaking_variance — summary
            "FROM fact_restaurant_stocktaking\n        WHERE factory_id": {
                "shortage_qty": Decimal("-5.000"),
                "shortage_cost": Decimal("500.00"),
                "surplus_qty": Decimal("2.000"),
                "surplus_cost": Decimal("200.00"),
                "last_date": date(2026, 5, 10),
                "event_count": 2,
            },
        },
        fetch_map={
            "GROUP BY wastage_type": [
                {"type": "EXPIRED", "total_cost": Decimal("3000.00"), "event_count": 12},
            ],
            "GROUP BY w.ingredient_id": [
                {
                    "ingredient_id": 1, "name": "三文鱼", "category": "肉类",
                    "unit": "kg",
                    "total_cost": Decimal("2000.00"),
                    "quantity": Decimal("3.500"),
                    "event_count": 6,
                },
            ],
            # _get_wastage trend
            "FROM fact_restaurant_wastage\n          AND factory_id": [],
            "GROUP BY i.category": [
                {"raw_category": "肉类", "total_cost": Decimal("60000.00"), "event_count": 25},
                {"raw_category": "蔬菜", "total_cost": Decimal("40000.00"), "event_count": 25},
            ],
            # _get_requisition trend
            "GROUP BY date\n        ORDER BY date": [],
            # _get_stocktaking top-N
            "GROUP BY s.ingredient_id": [
                {
                    "ingredient_id": 2, "name": "牛肉", "category": "肉类",
                    "diff_qty": Decimal("-2.500"),
                    "diff_cost": Decimal("-400.00"),
                },
            ],
        },
    )

    async def _fake_pool():
        return _FakePool(conn)

    import smartbi.config as cfg
    monkeypatch.setattr(cfg, "get_pg_pool", _fake_pool)

    env = await _restaurant_kitchen_cost_dispatch(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), "day", 10
    )
    assert env["success"] is True
    data = env["data"]
    # All 4 sub-reports keys present.
    assert "wastageAnalytics" in data
    assert "requisitionTrend" in data
    assert "stocktakingVariance" in data
    assert "foodCostRatio" in data

    # food cost ratio: 100000/300000 = 0.3333 → 33.33% → GREEN (in [0.30, 0.35))
    assert data["foodCostRatio"]["ratio"] == 0.3333
    assert data["foodCostRatio"]["alertLevel"] == "GREEN"
    # Wastage rate: 5000/100000 = 0.05 → 5%
    assert data["wastageAnalytics"]["wastageRate"] == 0.05
    assert data["wastageAnalytics"]["wastageRatePercent"] == 5
    # Stocktaking net: 500 - 200 = 300
    assert data["stocktakingVariance"]["netVarianceCost"] == 300


@pytest.mark.asyncio
async def test_dispatcher_partial_data_wastage_only(monkeypatch):
    """Partial data: wastage rows exist but no requisition. wastageRate null."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_requisition\n        WHERE factory_id": {
                "total_cost": Decimal("0"),
                "event_count": 0,
            },
            "FROM agg_daily": {"total_revenue": Decimal("50000.00")},
            "FROM fact_restaurant_wastage\n        WHERE factory_id": {
                "total_cost": Decimal("800.00"),
                "event_count": 6,
            },
            "FROM fact_restaurant_stocktaking\n        WHERE factory_id": {
                "shortage_qty": Decimal("0"), "shortage_cost": Decimal("0"),
                "surplus_qty": Decimal("0"), "surplus_cost": Decimal("0"),
                "last_date": None, "event_count": 0,
            },
        },
        fetch_map={
            "GROUP BY wastage_type": [
                {"type": "EXPIRED", "total_cost": Decimal("800.00"), "event_count": 6},
            ],
            "GROUP BY w.ingredient_id": [],
            "FROM fact_restaurant_wastage\n          AND factory_id": [],
            "GROUP BY i.category": [],
            "GROUP BY date\n        ORDER BY date": [],
            "GROUP BY s.ingredient_id": [],
        },
    )

    async def _fake_pool():
        return _FakePool(conn)

    import smartbi.config as cfg
    monkeypatch.setattr(cfg, "get_pg_pool", _fake_pool)

    env = await _restaurant_kitchen_cost_dispatch(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), "day", 10
    )
    data = env["data"]
    # Wastage data present.
    assert data["wastageAnalytics"]["totalWastageCost"] == 800
    assert data["wastageAnalytics"]["totalWastageEvents"] == 6
    # But no requisition cost → wastageRate null (Rule 1).
    assert data["wastageAnalytics"]["wastageRate"] is None
    # POS_OK + REQ_EMPTY → food cost ratio 0.0, GREEN.
    assert data["foodCostRatio"]["ratio"] == 0
    assert data["foodCostRatio"]["alertLevel"] == "GREEN"


@pytest.mark.asyncio
async def test_dispatcher_rule_1_decimal_zero_preserved(monkeypatch):
    """Rule 1: Decimal("0") is a valid cost — NOT to be treated as missing.

    Requisition exists with all zero est_cost rows (legit Decimal("0")
    after WHERE est_cost IS NOT NULL). totalRequisitionCost should be 0,
    NOT preserved as None / null.
    """
    conn = _FakeConn(
        fetchrow_map={
            "FROM fact_restaurant_requisition\n        WHERE factory_id": {
                "total_cost": Decimal("0"),
                "event_count": 3,  # 3 rows all with est_cost=0
            },
            "FROM agg_daily": {"total_revenue": Decimal("10000.00")},
            "FROM fact_restaurant_wastage\n        WHERE factory_id": {
                "total_cost": Decimal("0"), "event_count": 0,
            },
            "FROM fact_restaurant_stocktaking\n        WHERE factory_id": {
                "shortage_qty": Decimal("0"), "shortage_cost": Decimal("0"),
                "surplus_qty": Decimal("0"), "surplus_cost": Decimal("0"),
                "last_date": None, "event_count": 0,
            },
        },
        fetch_map={
            "GROUP BY wastage_type": [],
            "GROUP BY w.ingredient_id": [],
            "FROM fact_restaurant_wastage\n          AND factory_id": [],
            "GROUP BY i.category": [],
            "GROUP BY date\n        ORDER BY date": [],
            "GROUP BY s.ingredient_id": [],
        },
    )

    async def _fake_pool():
        return _FakePool(conn)

    import smartbi.config as cfg
    monkeypatch.setattr(cfg, "get_pg_pool", _fake_pool)

    env = await _restaurant_kitchen_cost_dispatch(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), "day", 10
    )
    data = env["data"]
    # event_count > 0 + total_cost == 0 → "POS_OK + REQ_EMPTY-ish" branch (since
    # numerator is 0). Spec §4.5 lets this be ratio=0.0 GREEN — the path triggers
    # because total_revenue > 0 AND requisition_event_count > 0.
    # Actually with event_count=3 we go to the standard path with numerator=0.
    assert data["foodCostRatio"]["totalRequisitionCost"] == 0
    assert data["foodCostRatio"]["totalRevenue"] == 10000
    # 0 / 10000 = 0.0 → GREEN per standard path.
    assert data["foodCostRatio"]["ratio"] == 0
    assert data["foodCostRatio"]["alertLevel"] == "GREEN"
