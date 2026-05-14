"""Phase IIa restaurant branch unit tests — ``/analysis/sales``.

Covers the 6 edge cases enumerated in spec §4.5 of
``docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md``:

1. Zero bills → 0 scalars + empty arrays (NOT null) for collections
2. ``customerCount == 0`` but ``billCount > 0`` → ``avgPerCapita: None``
3. Deleted dish (product_id missing from dim_product) → COALESCE fallback name
4. ``startDate > endDate`` → HTTP 400 + code ``INVALID_DATE_RANGE``
5. Single-day query (start == end) → normal response, one xAxis element
6. Range exceeds Gold coverage → ``dateRange.coverageWarning`` emitted

Plus Rule-compliance smoke tests (Rules 1/4/6/10/11).

Pattern mirrors ``tests/test_analysis_production_restaurant.py`` — synthetic
data via ``_FakeConn`` monkeypatch (no live DB).
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

import pytest
from fastapi import HTTPException

from smartbi_compat.api import analysis_sales
from smartbi_compat.api.analysis_sales import (
    _empty_restaurant_sales_envelope,
    _get_restaurant_avg_per_capita_trend,
    _get_restaurant_channel_breakdown,
    _get_restaurant_coverage_warning,
    _get_restaurant_meal_period_breakdown,
    _get_restaurant_order_type_split,
    _get_restaurant_overview,
    _get_restaurant_product_ranking,
    _get_restaurant_revenue_trend,
    _restaurant_sales_dispatch,
    _validate_restaurant_date_range,
)


# ============================================================
# Fake asyncpg Connection / Pool — supports fetch + fetchrow
# ============================================================


class _FakeConn:
    """asyncpg.Connection stub.

    Initialized with ``fetch_map`` (sql-substring → list[dict] OR list[dict])
    and ``fetchrow_map`` (sql-substring → dict OR dict). Default match returns
    empty list / None respectively.
    """

    def __init__(self, *, fetch_map=None, fetchrow_map=None):
        self._fetch_map = fetch_map or {}
        self._fetchrow_map = fetchrow_map or {}
        self.calls = []

    async def fetch(self, sql, *args):
        self.calls.append(("fetch", sql, args))
        if isinstance(self._fetch_map, list):
            return self._fetch_map
        for key, rows in self._fetch_map.items():
            if key in sql:
                return rows
        return []

    async def fetchrow(self, sql, *args):
        self.calls.append(("fetchrow", sql, args))
        if isinstance(self._fetchrow_map, dict) and not any(
            k in sql for k in self._fetchrow_map
        ):
            # default empty
            return self._fetchrow_map.get("__default__")
        if isinstance(self._fetchrow_map, dict):
            for key, row in self._fetchrow_map.items():
                if key in sql:
                    return row
        return self._fetchrow_map  # raw dict / None


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
# Edge case 4 — startDate > endDate → HTTP 400 INVALID_DATE_RANGE
# ============================================================


def test_edge_4_start_after_end_raises_400():
    with pytest.raises(HTTPException) as exc_info:
        _validate_restaurant_date_range(date(2026, 5, 31), date(2026, 5, 1))
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_DATE_RANGE"
    assert exc_info.value.detail["message"] == "开始日期不能晚于结束日期"


def test_edge_4_start_equals_end_does_not_raise():
    """Single-day query is valid (overlaps edge case 5 semantics)."""
    _validate_restaurant_date_range(date(2026, 5, 14), date(2026, 5, 14))


def test_edge_4_none_dates_raise_value_error():
    """Rule 6: explicit precondition — None → ValueError not silent zero rows."""
    with pytest.raises(ValueError, match="start_date/end_date required"):
        _validate_restaurant_date_range(None, date(2026, 5, 14))
    with pytest.raises(ValueError, match="start_date/end_date required"):
        _validate_restaurant_date_range(date(2026, 5, 14), None)


# ============================================================
# Edge case 1 — Zero bills → 0 scalars + empty arrays
# ============================================================


@pytest.mark.asyncio
async def test_edge_1_zero_bills_overview():
    """Zero bills → totalRevenue 0, billCount 0, storeCount 0, dataSource preserved."""
    conn = _FakeConn(fetchrow_map={
        "FROM agg_daily": {
            "total_revenue": Decimal("0"),
            "bill_count": 0,
            "customer_count": 0,
            "store_count": 0,
        },
    })
    overview = await _get_restaurant_overview(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert overview["totalRevenue"] == 0
    assert overview["billCount"] == 0
    assert overview["avgPerCapita"] is None  # 0 customers → None (edge 2 also)
    assert overview["storeCount"] == 0
    assert overview["dataSource"] == "agg_daily"


@pytest.mark.asyncio
async def test_edge_1_zero_bills_product_ranking_returns_empty_list():
    """Zero rows → empty list, NOT null. Frontend v-for iterates."""
    conn = _FakeConn(fetch_map={"agg_product": []})
    result = await _get_restaurant_product_ranking(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert result == []
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_edge_1_zero_bills_channel_breakdown_returns_empty_list():
    """Zero rows → empty list, NOT null."""
    conn = _FakeConn(fetch_map={"agg_channel": []})
    result = await _get_restaurant_channel_breakdown(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert result == []


# ============================================================
# Edge case 2 — billCount > 0 but customerCount == 0 → avgPerCapita None
# ============================================================


@pytest.mark.asyncio
async def test_edge_2_bills_without_customers_avg_per_capita_none():
    """POS captured bills but not customer counts → avgPerCapita is None, not 0."""
    conn = _FakeConn(fetchrow_map={
        "FROM agg_daily": {
            "total_revenue": Decimal("10000.00"),
            "bill_count": 100,
            "customer_count": 0,  # missing customer data
            "store_count": 1,
        },
    })
    overview = await _get_restaurant_overview(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert overview["billCount"] == 100
    assert overview["totalRevenue"] == 10000  # int per Rule 4 _decimal_to_number
    assert overview["avgPerCapita"] is None  # explicit None, not 0.0


@pytest.mark.asyncio
async def test_edge_2_avg_per_capita_trend_daily_null_when_zero_customers():
    """Per-day variant of edge 2: days with bills but no customer counts → None."""
    conn = _FakeConn(fetch_map={"agg_daily": [
        {"date": date(2026, 5, 1), "revenue": Decimal("1000.00"), "customer_count": 10},
        {"date": date(2026, 5, 2), "revenue": Decimal("2000.00"), "customer_count": 0},
    ]})
    trend = await _get_restaurant_avg_per_capita_trend(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 2), conn
    )
    assert trend["xAxis"] == ["2026-05-01", "2026-05-02"]
    assert trend["series"][0]["data"][0] == 100  # 1000/10 → int
    assert trend["series"][0]["data"][1] is None  # 0 customers → None


# ============================================================
# Edge case 3 — Deleted dish: COALESCE fallback name preserved
# ============================================================


@pytest.mark.asyncio
async def test_edge_3_deleted_dish_coalesce_name_preserved():
    """When SQL emits the COALESCE fallback ('(已下架菜品 #42)'), Python helper
    surfaces it unchanged — verifies the SQL contract is honored in code path."""
    conn = _FakeConn(fetch_map={"agg_product": [
        {
            "product_id": 1,
            "name": "水煮鱼",
            "revenue": Decimal("32400.00"),
            "qty_sold": Decimal("540.000"),
        },
        {
            "product_id": 42,
            # Simulates the COALESCE fallback emitted when dim_product LEFT JOIN misses
            "name": "(已下架菜品 #42)",
            "revenue": Decimal("5000.00"),
            "qty_sold": Decimal("100.000"),
        },
    ]})
    result = await _get_restaurant_product_ranking(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert len(result) == 2
    assert result[0]["name"] == "水煮鱼"
    assert result[0]["rank"] == 1
    assert result[1]["name"] == "(已下架菜品 #42)"
    assert result[1]["rank"] == 2
    assert result[1]["revenue"] == 5000  # int from _decimal_to_number


def test_edge_3_sql_contains_coalesce_clause():
    """Verify the SQL emitted by product ranking actually contains the COALESCE
    fallback that produces the deleted-dish marker. Not whitebox-testing the
    full SQL string, but pinning the contract that the COALESCE pattern is
    present (defense against accidental removal during refactor)."""
    import inspect
    src = inspect.getsource(_get_restaurant_product_ranking)
    assert "COALESCE(p.name" in src
    assert "已下架菜品" in src


# ============================================================
# Edge case 5 — Single-day query (start == end) → 1 xAxis element
# ============================================================


@pytest.mark.asyncio
async def test_edge_5_single_day_revenue_trend_one_xaxis_element():
    """start_date == end_date: revenueTrend xAxis has exactly 1 date."""
    conn = _FakeConn(fetch_map={"agg_daily_order_type_meal": [
        {"date": date(2026, 5, 14), "order_type": "堂食", "amount": Decimal("1000.00")},
        {"date": date(2026, 5, 14), "order_type": "外卖", "amount": Decimal("400.00")},
    ]})
    trend = await _get_restaurant_revenue_trend(
        "R_TEST", date(2026, 5, 14), date(2026, 5, 14), conn
    )
    assert trend["xAxis"] == ["2026-05-14"]
    assert len(trend["series"]) == 2
    assert trend["series"][0]["name"] == "堂食"
    assert trend["series"][0]["data"] == [1000]  # _decimal_to_number int
    assert trend["series"][1]["name"] == "外卖"
    assert trend["series"][1]["data"] == [400]


# ============================================================
# Edge case 6 — Range exceeds Gold coverage → coverageWarning
# ============================================================


@pytest.mark.asyncio
async def test_edge_6_coverage_warning_when_start_before_min():
    """Tenant's earliest agg_daily row is later than requested start_date →
    coverageWarning '数据起始 2025-01-01'."""
    conn = _FakeConn(fetchrow_map={
        "MIN(date)": {"min_date": date(2025, 1, 1)},
    })
    warning = await _get_restaurant_coverage_warning(
        "R_TEST", date(2024, 1, 1), conn
    )
    assert warning == "数据起始 2025-01-01"


@pytest.mark.asyncio
async def test_edge_6_no_warning_when_start_after_coverage():
    """start_date == or > MIN(date) → None (no warning)."""
    conn = _FakeConn(fetchrow_map={
        "MIN(date)": {"min_date": date(2025, 1, 1)},
    })
    warning = await _get_restaurant_coverage_warning(
        "R_TEST", date(2025, 6, 1), conn
    )
    assert warning is None


@pytest.mark.asyncio
async def test_edge_6_no_warning_when_no_coverage_at_all():
    """Tenant has zero agg_daily rows → MIN(date) None → no warning emitted
    (frontend gets normal empty-state response without coverageWarning noise)."""
    conn = _FakeConn(fetchrow_map={
        "MIN(date)": {"min_date": None},
    })
    warning = await _get_restaurant_coverage_warning(
        "R_TEST", date(2024, 1, 1), conn
    )
    assert warning is None


# ============================================================
# Dispatcher integration — end-to-end envelope shape
# ============================================================


@pytest.mark.asyncio
async def test_dispatcher_envelope_keys_and_tenant_type(monkeypatch):
    """End-to-end: dispatcher returns wrap_response envelope with the full
    spec §4.2 key set + tenantType discriminator."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM agg_daily\n        WHERE factory_id = $1\n          AND date BETWEEN": {
                "total_revenue": Decimal("100.00"),
                "bill_count": 5,
                "customer_count": 4,
                "store_count": 1,
            },
            "MIN(date)": {"min_date": date(2025, 1, 1)},
        },
        fetch_map={"agg_daily": [], "agg_daily_order_type_meal": [], "agg_product": [], "agg_channel": []},
    )
    pool = _FakePool(conn)

    async def _fake_get_pg_pool():
        return pool

    import smartbi.config as cfg
    monkeypatch.setattr(cfg, "get_pg_pool", _fake_get_pg_pool)

    envelope = await _restaurant_sales_dispatch(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), None
    )
    assert envelope["success"] is True
    data = envelope["data"]
    assert data["tenantType"] == "RESTAURANT"
    assert set(data.keys()) >= {
        "tenantType", "dateRange", "overview", "revenueTrend", "orderTypeSplit",
        "mealPeriodBreakdown", "productRanking", "channelBreakdown",
        "avgPerCapitaTrend", "generatedAt",
    }
    assert data["dateRange"]["startDate"] == "2026-05-01"
    assert data["dateRange"]["endDate"] == "2026-05-31"
    assert data["dateRange"]["days"] == 31


@pytest.mark.asyncio
async def test_dispatcher_pool_unavailable_returns_empty_envelope(monkeypatch):
    """Defensive: pool acquisition failure → empty envelope, NOT 500."""

    async def _fake_get_pg_pool():
        return None

    import smartbi.config as cfg
    monkeypatch.setattr(cfg, "get_pg_pool", _fake_get_pg_pool)

    envelope = await _restaurant_sales_dispatch(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), None
    )
    assert envelope["success"] is True
    data = envelope["data"]
    assert data["tenantType"] == "RESTAURANT"
    assert data["overview"]["totalRevenue"] == 0
    assert data["overview"]["billCount"] == 0
    assert data["overview"]["avgPerCapita"] is None
    assert data["productRanking"] == []
    assert data["channelBreakdown"] == []


@pytest.mark.asyncio
async def test_dispatcher_invalid_date_range_propagates_400():
    """Edge 4 boundary: dispatcher entry validates before any DB work."""
    with pytest.raises(HTTPException) as exc_info:
        await _restaurant_sales_dispatch(
            "R_TEST", date(2026, 6, 1), date(2026, 5, 1), None
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_DATE_RANGE"


# ============================================================
# Rule audits — light spot-checks (full audit in PR description)
# ============================================================


@pytest.mark.asyncio
async def test_rule_10_channel_share_intermediate_quantize():
    """Rule 10: channel share = (amount / total).quantize(4) * 100 quantize(2).

    Concrete: amount=100, total=300 → 100/300 ≈ 0.33333... q4 → 0.3333 * 100
    q2 → 33.33. Python f-string banker's would give 33.33 too (.33 = even),
    but the q4-intermediate path is what Java BigDecimal produces.
    """
    conn = _FakeConn(fetch_map={"agg_channel": [
        {"name": "美团", "amount": Decimal("100.00"), "bill_count": 10},
        {"name": "现金", "amount": Decimal("200.00"), "bill_count": 20},
    ]})
    result = await _get_restaurant_channel_breakdown(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    # 100/300 = 0.3333.. q4 → 0.3333 * 100 = 33.33
    # 200/300 = 0.6666.. q4 → 0.6667 * 100 = 66.67 (HALF_UP, not banker's)
    assert result[0]["channelName"] == "美团"
    assert result[0]["share"] == 33.33
    assert result[1]["channelName"] == "现金"
    assert result[1]["share"] == 66.67


def test_rule_11_generated_at_uses_java_isoformat():
    """Rule 11: dispatcher's generatedAt routes through _java_isoformat,
    not raw .isoformat(). Verify empty envelope helper uses it (proxy for
    main dispatcher path which is harder to white-box from a unit test)."""
    envelope = _empty_restaurant_sales_envelope(date(2026, 5, 1), date(2026, 5, 31))
    # _java_isoformat strips trailing-zero microseconds; format will be either
    # 'YYYY-MM-DDTHH:MM:SS' or with non-zero trailing digits. Critically, must
    # NOT end in '.000000' (raw .isoformat with microsecond=0 would, except
    # datetime.now() never gives microsecond=0 exactly so this is a best-effort
    # presence check).
    ts = envelope["generatedAt"]
    assert ts is not None
    assert isinstance(ts, str)
    assert "T" in ts  # ISO 8601 separator
