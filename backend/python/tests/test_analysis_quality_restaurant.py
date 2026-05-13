"""chat-B2 Wave 2 tests for restaurant branch of ``/analysis/quality``.

Synthetic-data unit tests covering N1-N4 + defect ranking + 4 analysisType
dispatch shape + Rule 1/4/6/10 audit + pool degradation + factory branch
preservation + chat-A1/B1 misroute regression.

* N1 builder always emits ``MISSING_FOOD_SAFETY_INCIDENT_LOG`` (Q-DEC-4 D1)
* N2 builder: happy / empty / null / Rule 10 quantize / Rule 6 None-check
* N3 builder: happy / empty / null / int-collapse Rule 4
* N4 builder: happy / empty wastage_row_count=0 / null requisition / zero requisition
* Defect ranking: TOP 10 / tied / empty
* Dispatch envelope shape per analysisType (fpy/None/defect/rework/overview)
* Dispatch graceful degradation when smartbi pool unavailable
* Controlled-vocabulary discipline (every emitted ∈ _RESTAURANT_DATA_AVAILABILITY_VOCAB)
* Factory branch preserved (raises NotImplementedError)
* Regression: factory_id starting with ``F`` does not misroute through restaurant dispatcher

Spec: docs/superpowers/specs/2026-05-12-t6-6-sub-b-quality-impl-spec.md §3
Pilot factory_ids: ``R_QINGHUAJIAO_REAL`` (with reviews) + ``R_ILTEATRO_REAL``
(without reviews). Real golden recording deferred to chat-AB-1 against
live prod data; synthetic mocks used here per chat-B2 MO.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from smartbi_compat.api import analysis_quality
from smartbi_compat.api.analysis_quality import (
    _AVAILABILITY_MISSING_FOOD_SAFETY,
    _AVAILABILITY_NO_POS_DATA,
    _AVAILABILITY_NO_REVIEW_DATA,
    _AVAILABILITY_RETURN_QTY_NOT_INGESTED,
    _AVAILABILITY_WASTAGE_NOT_TRACKED,
    _RESTAURANT_DATA_AVAILABILITY_VOCAB,
    _build_complaint_rate_metric,
    _build_dish_return_rate_metric,
    _build_food_safety_incident_metric,
    _build_return_rate_ranking,
    _build_wastage_rate_metric,
    _compute_rate_pct,
    _empty_complaint_rate_metric,
    _empty_dish_return_rate_metric,
    _empty_wastage_rate_metric,
    _factory_quality_dispatch,
    _query_complaint_rate,
    _query_dish_return_rate,
    _query_return_rate_ranking,
    _query_wastage_rate,
    _restaurant_quality_dispatch,
    _restaurant_quality_overview,
)


# ============================================================
# Fake conn / pool for monkeypatch
# ============================================================


class _FakeConn:
    """Minimal asyncpg.Connection stub recording fetchrow/fetch args.

    A single conn returns a fixed row from any ``fetchrow`` call and a
    fixed list from any ``fetch`` call — sufficient because each test
    exercises one helper at a time.
    """

    def __init__(self, *, fetchrow=None, fetch=None):
        self._fetchrow = fetchrow
        self._fetch = fetch if fetch is not None else []
        self.last_sql = None
        self.last_args = None
        self.fetchrow_call_count = 0

    async def fetchrow(self, sql, *args):
        self.last_sql = sql
        self.last_args = args
        self.fetchrow_call_count += 1
        return self._fetchrow

    async def fetch(self, sql, *args):
        self.last_sql = sql
        self.last_args = args
        return self._fetch


class _DispatchConn:
    """Conn that returns different rows per SQL fingerprint.

    Used by the dispatch tests where N2/N3/N4 (+ optional ranking) all
    flow through a single ``pool.acquire`` block.
    """

    def __init__(self, complaint=None, return_rate=None, wastage=None, ranking=None):
        self._complaint = complaint
        self._return_rate = return_rate
        self._wastage = wastage
        self._ranking = ranking if ranking is not None else []

    async def fetchrow(self, sql, *args):
        if "restaurant_reviews" in sql:
            return self._complaint
        if "fact_pos_item" in sql and "fact_pos_transaction" in sql:
            return self._return_rate
        if "fact_restaurant_wastage" in sql:
            return self._wastage
        raise AssertionError(f"unexpected fetchrow SQL: {sql[:100]}")

    async def fetch(self, sql, *args):
        if "dim_product" in sql:
            return self._ranking
        raise AssertionError(f"unexpected fetch SQL: {sql[:100]}")


class _FakePool:
    """Minimal asyncpg.Pool stub returning a fixed conn from ``acquire``."""

    def __init__(self, conn):
        self._conn = conn

    def acquire(self):
        pool = self

        class _Ctx:
            async def __aenter__(self_inner):
                return pool._conn

            async def __aexit__(self_inner, *exc):
                return False

        return _Ctx()


# ============================================================
# N1 — Food Safety Incident Rate (always null)
# ============================================================


def test_n1_envelope_shape_and_marker():
    """N1 always emits the Q-DEC-4 = D1 marker, never a value."""
    m = _build_food_safety_incident_metric()
    assert m == {
        "metricCode": "FOOD_SAFETY_INCIDENT_RATE",
        "value": None,
        "unit": "incidents_per_period",
        "trend": None,
        "alertLevel": None,
        "dataAvailability": _AVAILABILITY_MISSING_FOOD_SAFETY,
    }
    assert m["dataAvailability"] == "MISSING_FOOD_SAFETY_INCIDENT_LOG"


# ============================================================
# N2 — Complaint Rate
# ============================================================


def test_empty_complaint_rate_metric_shape():
    """N2 empty envelope uses NO_REVIEW_DATA_FOR_CHAIN marker."""
    m = _empty_complaint_rate_metric()
    assert m["metricCode"] == "COMPLAINT_RATE"
    assert m["value"] is None
    assert m["dataAvailability"] == _AVAILABILITY_NO_REVIEW_DATA


@pytest.mark.asyncio
async def test_query_complaint_rate_passes_args_in_order():
    """SQL parameters bound (factory_id, start_date, end_date)."""
    conn = _FakeConn(fetchrow={"total_reviews": 100, "complaint_count": 15})
    result = await _query_complaint_rate(
        "R_QINGHUAJIAO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert result == {"total_reviews": 100, "complaint_count": 15}
    assert conn.last_args == (
        "R_QINGHUAJIAO_REAL", date(2026, 5, 1), date(2026, 5, 31)
    )
    assert "restaurant_reviews" in conn.last_sql
    assert "rating < 3.0" in conn.last_sql


@pytest.mark.asyncio
async def test_query_complaint_rate_rejects_none_start_date():
    """Rule 6: precondition error preferred to silent zero rows."""
    conn = _FakeConn(fetchrow=None)
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_complaint_rate(
            "R_QINGHUAJIAO_REAL", None, date(2026, 5, 31), conn
        )


@pytest.mark.asyncio
async def test_query_complaint_rate_rejects_none_end_date():
    """Rule 6: end_date NULL also raises (symmetric)."""
    conn = _FakeConn(fetchrow=None)
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_complaint_rate(
            "R_QINGHUAJIAO_REAL", date(2026, 5, 1), None, conn
        )


@pytest.mark.asyncio
async def test_n2_happy_path_real_value():
    """100 reviews, 15 complaints → 15.00% rate, dataAvailability omitted."""
    conn = _FakeConn(fetchrow={"total_reviews": 100, "complaint_count": 15})
    m = await _build_complaint_rate_metric(
        "R_QINGHUAJIAO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m["metricCode"] == "COMPLAINT_RATE"
    # 15/100 = 0.15 → quantize 4 → 0.1500 → × 100 = 15.0000 → quantize 2 → 15.00
    # Rule 4 dict-eq: 15.00 == 15 (integer-valued Decimal collapse)
    assert m["value"] == 15
    assert "dataAvailability" not in m  # Q-DEC-9 omit when value present


@pytest.mark.asyncio
async def test_n2_rule_10_intermediate_quantize_parity():
    """Rule 10 — 1/3 * 100 via intermediate quantize.

    1 / 3 = 0.333333... → quantize 4 → 0.3333 → × 100 = 33.3300 → quantize 2 → 33.33.
    A single ``(n / d * 100).quantize(0.01)`` would yield 33.33 too on this
    input; the intermediate step is the documented Java parity guard.
    """
    conn = _FakeConn(fetchrow={"total_reviews": 3, "complaint_count": 1})
    m = await _build_complaint_rate_metric(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 1), conn
    )
    assert m["value"] == 33.33


@pytest.mark.asyncio
async def test_n2_zero_reviews_returns_empty():
    """No reviews for chain → null value + NO_REVIEW_DATA_FOR_CHAIN."""
    conn = _FakeConn(fetchrow={"total_reviews": 0, "complaint_count": 0})
    m = await _build_complaint_rate_metric(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m == _empty_complaint_rate_metric()


@pytest.mark.asyncio
async def test_n2_null_complaint_count_becomes_zero_rate():
    """SUM(CASE...) returns NULL when no rows match — coerce to 0."""
    conn = _FakeConn(fetchrow={"total_reviews": 50, "complaint_count": None})
    m = await _build_complaint_rate_metric(
        "R_QINGHUAJIAO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m["value"] == 0  # 0 complaints / 50 reviews * 100 = 0.00 → int 0
    assert "dataAvailability" not in m


@pytest.mark.asyncio
async def test_n2_none_row_returns_empty():
    """fetchrow returning None (no rows) → empty envelope."""
    conn = _FakeConn(fetchrow=None)
    m = await _build_complaint_rate_metric(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m == _empty_complaint_rate_metric()


# ============================================================
# N3 — Dish Return Rate
# ============================================================


def test_empty_dish_return_rate_metric_shape_default():
    """Default empty envelope uses NO_POS_DATA_FOR_PERIOD."""
    m = _empty_dish_return_rate_metric()
    assert m["metricCode"] == "DISH_RETURN_RATE"
    assert m["value"] is None
    assert m["dataAvailability"] == _AVAILABILITY_NO_POS_DATA


def test_empty_dish_return_rate_metric_fallback_marker():
    """Pre-migration drift fallback marker (should not occur post V20260511_03)."""
    m = _empty_dish_return_rate_metric(
        availability=_AVAILABILITY_RETURN_QTY_NOT_INGESTED
    )
    assert m["dataAvailability"] == "RETURN_QTY_NOT_INGESTED"


@pytest.mark.asyncio
async def test_query_dish_return_rate_passes_args_in_order():
    conn = _FakeConn(fetchrow={
        "total_sales_qty": Decimal("1000"), "total_return_qty": Decimal("34.5"),
    })
    await _query_dish_return_rate(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert conn.last_args == (
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31)
    )
    assert "fact_pos_item" in conn.last_sql
    assert "fact_pos_transaction" in conn.last_sql


@pytest.mark.asyncio
async def test_query_dish_return_rate_rejects_none_dates():
    """Rule 6 — symmetric None-check."""
    conn = _FakeConn(fetchrow=None)
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_dish_return_rate(
            "R_TEST", None, date(2026, 5, 31), conn
        )
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_dish_return_rate(
            "R_TEST", date(2026, 5, 1), None, conn
        )


@pytest.mark.asyncio
async def test_n3_happy_path_real_value():
    """1000 sales / 34.5 returns → 3.45% rate."""
    conn = _FakeConn(fetchrow={
        "total_sales_qty": Decimal("1000"), "total_return_qty": Decimal("34.5"),
    })
    m = await _build_dish_return_rate_metric(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m["value"] == 3.45
    assert "dataAvailability" not in m


@pytest.mark.asyncio
async def test_n3_zero_sales_returns_empty():
    """No POS rows → null + NO_POS_DATA_FOR_PERIOD marker."""
    conn = _FakeConn(fetchrow={
        "total_sales_qty": Decimal("0"), "total_return_qty": Decimal("0"),
    })
    m = await _build_dish_return_rate_metric(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m == _empty_dish_return_rate_metric()


@pytest.mark.asyncio
async def test_n3_integer_rate_decimal_collapse():
    """Rule 4 — integer-valued Decimal rate collapses to int."""
    conn = _FakeConn(fetchrow={
        "total_sales_qty": Decimal("100"), "total_return_qty": Decimal("5"),
    })
    m = await _build_dish_return_rate_metric(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    # 5 / 100 * 100 = 5.00 → int 5
    assert m["value"] == 5
    assert isinstance(m["value"], int)


@pytest.mark.asyncio
async def test_n3_none_row_returns_empty():
    """Defensive: fetchrow None → empty envelope, not crash."""
    conn = _FakeConn(fetchrow=None)
    m = await _build_dish_return_rate_metric(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m == _empty_dish_return_rate_metric()


# ============================================================
# N4 — Wastage Rate
# ============================================================


def test_empty_wastage_rate_metric_shape():
    m = _empty_wastage_rate_metric()
    assert m["metricCode"] == "WASTAGE_RATE"
    assert m["value"] is None
    assert m["dataAvailability"] == _AVAILABILITY_WASTAGE_NOT_TRACKED


@pytest.mark.asyncio
async def test_query_wastage_rate_passes_args_in_order():
    conn = _FakeConn(fetchrow={
        "total_wastage_cost": Decimal("100"),
        "total_requisition_cost": Decimal("5000"),
        "wastage_row_count": 5,
    })
    await _query_wastage_rate(
        "RES_3101_009", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert conn.last_args == (
        "RES_3101_009", date(2026, 5, 1), date(2026, 5, 31)
    )
    assert "fact_restaurant_wastage" in conn.last_sql
    assert "fact_restaurant_requisition" in conn.last_sql


@pytest.mark.asyncio
async def test_query_wastage_rate_rejects_none_dates():
    """Rule 6 — symmetric None-check."""
    conn = _FakeConn(fetchrow=None)
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_wastage_rate(
            "RES_3101_009", None, date(2026, 5, 31), conn
        )


@pytest.mark.asyncio
async def test_n4_happy_path_real_value():
    """100 wastage cost / 5000 requisition → 2.00% rate."""
    conn = _FakeConn(fetchrow={
        "total_wastage_cost": Decimal("100"),
        "total_requisition_cost": Decimal("5000"),
        "wastage_row_count": 5,
    })
    m = await _build_wastage_rate_metric(
        "RES_3101_009", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    # 100 / 5000 * 100 = 2.00 → int 2
    assert m["value"] == 2
    assert "dataAvailability" not in m


@pytest.mark.asyncio
async def test_n4_zero_wastage_rows_returns_empty():
    """14 REAL chains: wastage_row_count == 0 → WASTAGE_NOT_TRACKED."""
    conn = _FakeConn(fetchrow={
        "total_wastage_cost": Decimal("0"),
        "total_requisition_cost": Decimal("5000"),
        "wastage_row_count": 0,
    })
    m = await _build_wastage_rate_metric(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m == _empty_wastage_rate_metric()


@pytest.mark.asyncio
async def test_n4_null_wastage_row_count_returns_empty():
    """Defensive: NULL wastage_row_count → empty envelope."""
    conn = _FakeConn(fetchrow={
        "total_wastage_cost": Decimal("0"),
        "total_requisition_cost": Decimal("5000"),
        "wastage_row_count": None,
    })
    m = await _build_wastage_rate_metric(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m == _empty_wastage_rate_metric()


@pytest.mark.asyncio
async def test_n4_zero_requisition_cost_returns_empty():
    """Rule 1 — Decimal('0') still triggers empty (no meaningful denominator)."""
    conn = _FakeConn(fetchrow={
        "total_wastage_cost": Decimal("100"),
        "total_requisition_cost": Decimal("0"),
        "wastage_row_count": 5,
    })
    m = await _build_wastage_rate_metric(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m == _empty_wastage_rate_metric()


@pytest.mark.asyncio
async def test_n4_none_row_returns_empty():
    """Defensive: fetchrow None → empty envelope."""
    conn = _FakeConn(fetchrow=None)
    m = await _build_wastage_rate_metric(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert m == _empty_wastage_rate_metric()


# ============================================================
# Defect-mode ranking
# ============================================================


@pytest.mark.asyncio
async def test_ranking_query_passes_args_in_order():
    conn = _FakeConn(fetch=[])
    await _query_return_rate_ranking(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert conn.last_args == (
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31)
    )
    assert "dim_product" in conn.last_sql
    assert "LIMIT 10" in conn.last_sql


@pytest.mark.asyncio
async def test_ranking_query_rejects_none_dates():
    """Rule 6 — ranking helper symmetric None-check."""
    conn = _FakeConn(fetch=[])
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_return_rate_ranking(
            "R_TEST", None, date(2026, 5, 31), conn
        )


@pytest.mark.asyncio
async def test_ranking_top_n_envelope_shape():
    """Each row produces rank + envelope keys + Rule 4 number collapse."""
    rows = [
        {"product_id": 1, "product_name": "宫保鸡丁",
         "total_sales_qty": Decimal("100"), "total_return_qty": Decimal("10")},
        {"product_id": 2, "product_name": "麻婆豆腐",
         "total_sales_qty": Decimal("200"), "total_return_qty": Decimal("10")},
    ]
    conn = _FakeConn(fetch=rows)
    ranking = await _build_return_rate_ranking(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert len(ranking) == 2
    assert ranking[0] == {
        "rank": 1,
        "productId": 1,
        "productName": "宫保鸡丁",
        "returnRate": 10,   # 10/100*100 = 10.00 → int collapse
        "totalSalesQty": 100,
        "totalReturnQty": 10,
    }
    assert ranking[1]["rank"] == 2
    assert ranking[1]["returnRate"] == 5  # 10/200*100 = 5.00


@pytest.mark.asyncio
async def test_ranking_empty_list():
    """No qualifying products → empty list, no exception."""
    conn = _FakeConn(fetch=[])
    ranking = await _build_return_rate_ranking(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert ranking == []


@pytest.mark.asyncio
async def test_ranking_tied_rates_preserve_order():
    """Tied return rates retain SQL order (rank assignment is positional)."""
    rows = [
        {"product_id": 1, "product_name": "A",
         "total_sales_qty": Decimal("100"), "total_return_qty": Decimal("10")},
        {"product_id": 2, "product_name": "B",
         "total_sales_qty": Decimal("50"),  "total_return_qty": Decimal("5")},
    ]
    conn = _FakeConn(fetch=rows)
    ranking = await _build_return_rate_ranking(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    # Both are 10% — ranks are 1, 2 in SQL-provided order.
    assert ranking[0]["rank"] == 1
    assert ranking[1]["rank"] == 2
    assert ranking[0]["returnRate"] == ranking[1]["returnRate"] == 10


# ============================================================
# _compute_rate_pct — Rule 10 parity edge cases
# ============================================================


def test_compute_rate_pct_zero_denominator():
    """Defensive ``denominator==0`` returns Decimal('0'), no ZeroDivisionError."""
    assert _compute_rate_pct(Decimal("5"), Decimal("0")) == Decimal("0")


def test_compute_rate_pct_none_denominator():
    """``denominator is None`` also returns Decimal('0')."""
    assert _compute_rate_pct(Decimal("5"), None) == Decimal("0")


def test_compute_rate_pct_intermediate_quantize_matches_java():
    """1/3 → 0.3333 → ×100 = 33.3300 → quantize 2 = 33.33."""
    rate = _compute_rate_pct(Decimal("1"), Decimal("3"))
    assert rate == Decimal("33.33")


# ============================================================
# Overview helper
# ============================================================


def test_restaurant_quality_overview_shape():
    metrics = [
        _build_food_safety_incident_metric(),
        _empty_complaint_rate_metric(),
        _empty_dish_return_rate_metric(),
        _empty_wastage_rate_metric(),
    ]
    ov = _restaurant_quality_overview(
        "R_QINGHUAJIAO_REAL", date(2026, 5, 1), date(2026, 5, 31), metrics
    )
    assert set(ov.keys()) == {"summary", "kpis", "recentChanges"}
    assert "R_QINGHUAJIAO_REAL" in ov["summary"]
    assert ov["kpis"] == metrics
    assert ov["recentChanges"] == []


# ============================================================
# Dispatch — analysisType branches + envelope shape
# ============================================================


@pytest.fixture
def patched_pg_pool(monkeypatch):
    """Provide an in-memory _FakePool to _restaurant_quality_dispatch."""

    def _factory(*, complaint=None, return_rate=None, wastage=None, ranking=None):
        conn = _DispatchConn(
            complaint=complaint, return_rate=return_rate,
            wastage=wastage, ranking=ranking,
        )
        pool = _FakePool(conn)

        async def fake_get_pg_pool():
            return pool

        import smartbi.config

        monkeypatch.setattr(smartbi.config, "get_pg_pool", fake_get_pg_pool)
        return pool

    return _factory


# Synthetic row defaults consistent with R_QINGHUAJIAO_REAL pilot:
#   * N2 has reviews → real value
#   * N3 has POS data → real value
#   * N4 has no wastage rows → empty
_QHJ_COMPLAINT = {"total_reviews": 100, "complaint_count": 15}
_QHJ_RETURN_RATE = {
    "total_sales_qty": Decimal("1000"),
    "total_return_qty": Decimal("34.5"),
}
_QHJ_WASTAGE = {
    "total_wastage_cost": Decimal("0"),
    "total_requisition_cost": Decimal("0"),
    "wastage_row_count": 0,
}


@pytest.mark.asyncio
async def test_dispatch_fpy_returns_metrics_plus_trendchart(patched_pg_pool):
    patched_pg_pool(
        complaint=_QHJ_COMPLAINT, return_rate=_QHJ_RETURN_RATE,
        wastage=_QHJ_WASTAGE,
    )
    envelope = await _restaurant_quality_dispatch(
        "R_QINGHUAJIAO_REAL", date(2026, 5, 1), date(2026, 5, 31), "fpy"
    )
    data = envelope["data"]
    assert data["tenantType"] == "RESTAURANT"
    assert data["startDate"] == "2026-05-01"
    assert data["endDate"] == "2026-05-31"
    assert len(data["metrics"]) == 4
    codes = [m["metricCode"] for m in data["metrics"]]
    assert codes == [
        "FOOD_SAFETY_INCIDENT_RATE",
        "COMPLAINT_RATE",
        "DISH_RETURN_RATE",
        "WASTAGE_RATE",
    ]
    # N2 has real value (R_QINGHUAJIAO_REAL pilot path)
    assert data["metrics"][1]["value"] == 15
    # N3 has real value (post V20260511_03 ship for all 14 chains)
    assert data["metrics"][2]["value"] == 3.45
    # N4 empty for 14 REAL chains
    assert data["metrics"][3]["dataAvailability"] == "WASTAGE_NOT_TRACKED"
    assert data["trendChart"] is None
    assert "ranking" not in data
    assert "paretoChart" not in data
    assert "costChart" not in data
    assert "overview" not in data


@pytest.mark.asyncio
async def test_dispatch_none_analysis_type_defaults_to_fpy(patched_pg_pool):
    """Per spec §3.6: None analysisType behaves like 'fpy'."""
    patched_pg_pool(
        complaint=_QHJ_COMPLAINT, return_rate=_QHJ_RETURN_RATE,
        wastage=_QHJ_WASTAGE,
    )
    envelope = await _restaurant_quality_dispatch(
        "R_QINGHUAJIAO_REAL", date(2026, 5, 1), date(2026, 5, 31), None
    )
    data = envelope["data"]
    assert "metrics" in data
    assert data["trendChart"] is None


@pytest.mark.asyncio
async def test_dispatch_defect_returns_ranking_plus_paretochart(patched_pg_pool):
    """defect branch: ranking + paretoChart, no metrics."""
    ranking_rows = [
        {"product_id": 1, "product_name": "宫保鸡丁",
         "total_sales_qty": Decimal("100"), "total_return_qty": Decimal("10")},
    ]
    patched_pg_pool(
        complaint=_QHJ_COMPLAINT, return_rate=_QHJ_RETURN_RATE,
        wastage=_QHJ_WASTAGE, ranking=ranking_rows,
    )
    envelope = await _restaurant_quality_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "defect"
    )
    data = envelope["data"]
    assert "metrics" not in data
    assert "trendChart" not in data
    assert len(data["ranking"]) == 1
    assert data["ranking"][0]["productName"] == "宫保鸡丁"
    assert data["paretoChart"] is None


@pytest.mark.asyncio
async def test_dispatch_rework_returns_metrics_plus_costchart(patched_pg_pool):
    patched_pg_pool(
        complaint=_QHJ_COMPLAINT, return_rate=_QHJ_RETURN_RATE,
        wastage=_QHJ_WASTAGE,
    )
    envelope = await _restaurant_quality_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "rework"
    )
    data = envelope["data"]
    assert len(data["metrics"]) == 4
    assert data["costChart"] is None
    assert "trendChart" not in data
    assert "ranking" not in data


@pytest.mark.asyncio
async def test_dispatch_overview_returns_overview_body(patched_pg_pool):
    patched_pg_pool(
        complaint=_QHJ_COMPLAINT, return_rate=_QHJ_RETURN_RATE,
        wastage=_QHJ_WASTAGE,
    )
    envelope = await _restaurant_quality_dispatch(
        "R_QINGHUAJIAO_REAL", date(2026, 5, 1), date(2026, 5, 31), "overview"
    )
    data = envelope["data"]
    assert "overview" in data
    assert data["overview"]["summary"].startswith("Restaurant quality analytics")
    assert len(data["overview"]["kpis"]) == 4
    assert data["overview"]["recentChanges"] == []
    assert "metrics" not in data
    assert "ranking" not in data


@pytest.mark.asyncio
async def test_dispatch_unknown_analysis_type_defaults_to_overview(patched_pg_pool):
    """Defensive: unknown analysisType falls through to overview branch."""
    patched_pg_pool(
        complaint=_QHJ_COMPLAINT, return_rate=_QHJ_RETURN_RATE,
        wastage=_QHJ_WASTAGE,
    )
    envelope = await _restaurant_quality_dispatch(
        "R_QINGHUAJIAO_REAL", date(2026, 5, 1), date(2026, 5, 31), "unknown_type"
    )
    data = envelope["data"]
    assert "overview" in data


@pytest.mark.asyncio
async def test_dispatch_envelope_uses_wrap_response_shape(patched_pg_pool):
    patched_pg_pool(
        complaint=_QHJ_COMPLAINT, return_rate=_QHJ_RETURN_RATE,
        wastage=_QHJ_WASTAGE,
    )
    envelope = await _restaurant_quality_dispatch(
        "R_QINGHUAJIAO_REAL", date(2026, 5, 1), date(2026, 5, 31), "fpy"
    )
    assert envelope["code"] == 200
    assert envelope["success"] is True
    assert "data" in envelope
    assert "timestamp" in envelope


@pytest.mark.asyncio
async def test_dispatch_pilot_without_reviews(patched_pg_pool):
    """R_ILTEATRO_REAL path: N2 empty + NO_REVIEW_DATA_FOR_CHAIN."""
    patched_pg_pool(
        complaint={"total_reviews": 0, "complaint_count": 0},
        return_rate=_QHJ_RETURN_RATE, wastage=_QHJ_WASTAGE,
    )
    envelope = await _restaurant_quality_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "fpy"
    )
    data = envelope["data"]
    n2 = data["metrics"][1]
    assert n2["value"] is None
    assert n2["dataAvailability"] == "NO_REVIEW_DATA_FOR_CHAIN"


# ============================================================
# Dispatch — graceful degradation when pool unavailable
# ============================================================


@pytest.mark.asyncio
async def test_dispatch_no_pool_falls_back_to_all_empty(monkeypatch):
    """If get_pg_pool returns None, all N2/N3/N4 emit empty (N1 unaffected)."""

    async def fake_get_pg_pool():
        return None

    import smartbi.config

    monkeypatch.setattr(smartbi.config, "get_pg_pool", fake_get_pg_pool)

    envelope = await _restaurant_quality_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "fpy"
    )
    data = envelope["data"]
    assert data["metrics"][0]["dataAvailability"] == "MISSING_FOOD_SAFETY_INCIDENT_LOG"
    assert data["metrics"][1] == _empty_complaint_rate_metric()
    assert data["metrics"][2] == _empty_dish_return_rate_metric()
    assert data["metrics"][3] == _empty_wastage_rate_metric()


@pytest.mark.asyncio
async def test_dispatch_pool_exception_logs_and_falls_back(monkeypatch, caplog):
    """If get_pg_pool raises, dispatch logs warning and emits all empty."""
    import logging

    async def boom():
        raise RuntimeError("smartbi pool boom")

    import smartbi.config

    monkeypatch.setattr(smartbi.config, "get_pg_pool", boom)

    with caplog.at_level(logging.WARNING, logger=analysis_quality.logger.name):
        envelope = await _restaurant_quality_dispatch(
            "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "fpy"
        )
    data = envelope["data"]
    assert data["metrics"][1] == _empty_complaint_rate_metric()
    assert any(
        "smartbi pool acquisition failed" in rec.message for rec in caplog.records
    )


@pytest.mark.asyncio
async def test_dispatch_defect_no_pool_returns_empty_ranking(monkeypatch):
    """defect branch + no pool → empty ranking (no exception)."""

    async def fake_get_pg_pool():
        return None

    import smartbi.config

    monkeypatch.setattr(smartbi.config, "get_pg_pool", fake_get_pg_pool)

    envelope = await _restaurant_quality_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "defect"
    )
    data = envelope["data"]
    assert data["ranking"] == []
    assert data["paretoChart"] is None


# ============================================================
# Controlled-vocabulary discipline (spec §4)
# ============================================================


def test_vocab_tuple_matches_implementation_constants():
    """Sanity guard: the 5 controlled-vocabulary constants exactly populate the tuple."""
    assert _AVAILABILITY_MISSING_FOOD_SAFETY in _RESTAURANT_DATA_AVAILABILITY_VOCAB
    assert _AVAILABILITY_NO_REVIEW_DATA in _RESTAURANT_DATA_AVAILABILITY_VOCAB
    assert _AVAILABILITY_RETURN_QTY_NOT_INGESTED in _RESTAURANT_DATA_AVAILABILITY_VOCAB
    assert _AVAILABILITY_NO_POS_DATA in _RESTAURANT_DATA_AVAILABILITY_VOCAB
    assert _AVAILABILITY_WASTAGE_NOT_TRACKED in _RESTAURANT_DATA_AVAILABILITY_VOCAB
    assert len(_RESTAURANT_DATA_AVAILABILITY_VOCAB) == 5


@pytest.mark.asyncio
async def test_all_emitted_dataAvailability_strings_are_in_vocab(monkeypatch):
    """Every dataAvailability emitted in fpy branch ∈ vocab tuple.

    Dispatcher with pool=None forces all metric helpers into their empty
    branches — covers N2/N3/N4 markers in one pass. N1 is exercised
    inline (always emits).
    """

    async def fake_get_pg_pool():
        return None

    import smartbi.config

    monkeypatch.setattr(smartbi.config, "get_pg_pool", fake_get_pg_pool)

    envelope = await _restaurant_quality_dispatch(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), "fpy"
    )
    for m in envelope["data"]["metrics"]:
        avail = m.get("dataAvailability")
        if avail is not None:
            assert avail in _RESTAURANT_DATA_AVAILABILITY_VOCAB, (
                f"dataAvailability={avail!r} on metricCode={m['metricCode']!r} "
                f"is not in controlled vocabulary"
            )


# ============================================================
# Factory branch preservation (Phase 2D Subagent B empty-envelope rewire)
# ============================================================


@pytest.mark.asyncio
async def test_factory_branch_returns_phase_2d_envelope():
    """Phase 2D guard: factory dispatch returns the empty-envelope marker.

    Subagent B rewired the factory branch from a raising stub into an
    empty-envelope response carrying ``FACTORY_SILVER_PHASE_2D_PENDING``.
    Restaurant impl tests must keep verifying that FACTORY tenants don't
    leak into the restaurant code path.
    """
    from smartbi_compat.api.analysis_quality import FACTORY_PHASE_2D_PENDING_MARKER

    result = await _factory_quality_dispatch(
        "F001", date(2026, 5, 1), date(2026, 5, 31), "fpy"
    )
    assert isinstance(result, dict)
    assert result["dataAvailability"] == FACTORY_PHASE_2D_PENDING_MARKER


# ============================================================
# Regression: factory_id does not misroute to restaurant dispatcher
# ============================================================


@pytest.mark.asyncio
async def test_factory_msg_does_not_misroute_to_chat_b1(monkeypatch):
    """Sister-chat guard: a FACTORY tenant must hit ``_factory_quality_dispatch``.

    Mirrors chat-A1/A2's symmetric guard in test_analysis_production_restaurant.py.
    Phase 2D Subagent B rewired the factory branch to return an empty
    envelope (no longer raises). The router must still route FACTORY tenants
    into the factory dispatcher — proven by the Phase 2D marker appearing
    on the returned response.
    """
    from smartbi_compat.api.analysis_quality import (
        FACTORY_PHASE_2D_PENDING_MARKER,
        get_quality_analysis,
    )

    class _FactoryConn:
        async def fetchrow(self, sql, *args):
            return {"type": "FACTORY"}

    class _FactoryPool:
        def acquire(self):
            class _Ctx:
                async def __aenter__(self_inner):
                    return _FactoryConn()

                async def __aexit__(self_inner, *exc):
                    return False

            return _Ctx()

    async def fake_get_cretas_pool():
        return _FactoryPool()

    import smartbi.config

    monkeypatch.setattr(smartbi.config, "get_cretas_pool", fake_get_cretas_pool)

    class _AuthStub:
        factory_id = "F001"
        # role added for R6 strip-wrap fix (PR following #483) — handler
        # now calls strip_price_for_role(raw, auth.role). Using a
        # PRICE_VIEW_ROLES member so the strip is a no-op for this test.
        role = "factory_super_admin"

    result = await get_quality_analysis(
        factory_id="F001",
        startDate=date(2026, 5, 1),
        endDate=date(2026, 5, 31),
        analysisType="fpy",
        auth=_AuthStub(),
    )
    # FastAPI / wrap_response semantics: pluck the dataAvailability marker
    # whether the response is a raw dict or wrapped in {"data": {...}}.
    payload = result
    if isinstance(payload, dict) and "data" in payload and isinstance(
        payload["data"], dict
    ):
        payload = payload["data"]
    assert isinstance(payload, dict)
    assert payload.get("dataAvailability") == FACTORY_PHASE_2D_PENDING_MARKER
