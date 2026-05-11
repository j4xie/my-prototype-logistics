"""chat-A2 Wave 2 tests for restaurant branch of ``/analysis/production``.

Synthetic-data unit tests covering:

* M1 builder always emits ``MISSING_KITCHEN_STATION_DATA`` (Q-DEC-1 = A1)
* M2 builder always emits ``MISSING_ORDER_TIMESTAMP_SPLIT`` (Q-DEC-2 = B1)
* M3 proxy compute: happy path, zero data, NULL columns, none row
* M3 Rule 10 intermediate quantize parity (4-digit → 2-digit)
* M3 Rule 6 precondition (start_date/end_date None)
* M3 SQL parameter binding (factory_id, start_date, end_date order)
* Dispatch envelope shape per analysisType (oee/efficiency/equipment/overview)
* Dispatch graceful degradation when smartbi pool unavailable
* Dispatch uses get_pg_pool (smartbi_db), not get_cretas_pool (cretas_db)

Spec: docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md §3
Pilot factory_id: ``R_ILTEATRO_REAL`` (real data deferred to Steve upload;
synthetic data used here per chat-A2 MO).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from smartbi_compat.api import analysis_production
from smartbi_compat.api.analysis_production import (
    _AVAILABILITY_MISSING_KITCHEN_STATION,
    _AVAILABILITY_MISSING_ORDER_TIMESTAMP,
    _AVAILABILITY_PROXY_BILLS,
    _build_avg_prep_time_metric,
    _build_kitchen_station_utilization_metric,
    _compute_table_turnover_proxy,
    _empty_table_turnover_proxy,
    _query_pos_transaction_aggregate,
    _restaurant_production_dispatch,
    _restaurant_production_overview,
)


# ============================================================
# Fake conn / pool for monkeypatch
# ============================================================


class _FakeConn:
    """Minimal asyncpg.Connection stub recording fetchrow args."""

    def __init__(self, row):
        self._row = row
        self.last_sql = None
        self.last_args = None

    async def fetchrow(self, sql, *args):
        self.last_sql = sql
        self.last_args = args
        return self._row


class _FakePool:
    """Minimal asyncpg.Pool stub returning a fixed _FakeConn from ``acquire``."""

    def __init__(self, row):
        self._conn = _FakeConn(row)

    def acquire(self):
        pool = self

        class _Ctx:
            async def __aenter__(self_inner):
                return pool._conn

            async def __aexit__(self_inner, *exc):
                return False

        return _Ctx()


# ============================================================
# M1 — Kitchen Station Utilization (always null)
# ============================================================


def test_m1_envelope_shape_and_marker():
    """M1 always emits the Q-DEC-1 = A1 marker, never a value."""
    m = _build_kitchen_station_utilization_metric()
    assert m == {
        "metricCode": "KITCHEN_STATION_UTILIZATION",
        "value": None,
        "unit": "%",
        "trend": None,
        "alertLevel": None,
        "dataAvailability": _AVAILABILITY_MISSING_KITCHEN_STATION,
    }
    assert m["dataAvailability"] == "MISSING_KITCHEN_STATION_DATA"


# ============================================================
# M2 — Avg Prep Time (always null)
# ============================================================


def test_m2_envelope_shape_and_marker():
    """M2 always emits the Q-DEC-2 = B1 marker, never a value."""
    m = _build_avg_prep_time_metric()
    assert m == {
        "metricCode": "AVG_PREP_TIME",
        "value": None,
        "unit": "minutes",
        "trend": None,
        "alertLevel": None,
        "dataAvailability": _AVAILABILITY_MISSING_ORDER_TIMESTAMP,
    }
    assert m["dataAvailability"] == "MISSING_ORDER_TIMESTAMP_SPLIT"


# ============================================================
# M3 — Empty proxy envelope (no data path)
# ============================================================


def test_empty_table_turnover_proxy_shape():
    """Empty path preserves the M3 envelope and nests a null proxyMetric."""
    m = _empty_table_turnover_proxy()
    assert m["metricCode"] == "TABLE_TURNOVER_RATE"
    assert m["value"] is None
    assert m["dataAvailability"] == _AVAILABILITY_PROXY_BILLS
    assert m["proxyMetric"]["metricCode"] == "BILLS_PER_STORE_PER_DAY"
    assert m["proxyMetric"]["value"] is None
    # proxyMetric envelope must mirror the outer (no dataAvailability field on
    # the nested proxy — that's per spec §1.5 — only outer carries it).
    assert "dataAvailability" not in m["proxyMetric"]


# ============================================================
# M3 — _query_pos_transaction_aggregate behaviour
# ============================================================


@pytest.mark.asyncio
async def test_query_pos_transaction_aggregate_passes_args_in_order():
    """SQL parameters are bound (factory_id, start_date, end_date)."""
    conn = _FakeConn({"bill_count": 100, "store_count": 1, "day_count": 30})
    result = await _query_pos_transaction_aggregate(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert result == {"bill_count": 100, "store_count": 1, "day_count": 30}
    assert conn.last_args == ("R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31))
    # Sanity: SQL targets fact_pos_transaction with WHERE factory_id + BETWEEN.
    assert "fact_pos_transaction" in conn.last_sql
    assert "factory_id = $1" in conn.last_sql
    assert "BETWEEN $2 AND $3" in conn.last_sql


@pytest.mark.asyncio
async def test_query_pos_transaction_aggregate_rejects_none_start_date():
    """Rule 6: precondition error preferred to silent zero rows."""
    conn = _FakeConn(None)
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_pos_transaction_aggregate(
            "R_ILTEATRO_REAL", None, date(2026, 5, 31), conn
        )


@pytest.mark.asyncio
async def test_query_pos_transaction_aggregate_rejects_none_end_date():
    """Rule 6: end_date NULL also raises (symmetric)."""
    conn = _FakeConn(None)
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_pos_transaction_aggregate(
            "R_ILTEATRO_REAL", date(2026, 5, 1), None, conn
        )


# ============================================================
# M3 — _compute_table_turnover_proxy branches
# ============================================================


@pytest.mark.asyncio
async def test_compute_proxy_happy_path():
    """1420 bills / 1 store / 30 days = 47.33 (rounded HALF_UP at scale 2)."""
    conn = _FakeConn({"bill_count": 1420, "store_count": 1, "day_count": 30})
    result = await _compute_table_turnover_proxy(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert result["metricCode"] == "TABLE_TURNOVER_RATE"
    assert result["value"] is None
    assert result["dataAvailability"] == "PROXY_AS_BILLS_PER_STORE"
    # 1420 / 30 = 47.3333... → quantize 4 → 47.3333 → quantize 2 → 47.33
    assert result["proxyMetric"]["value"] == 47.33
    assert result["proxyMetric"]["metricCode"] == "BILLS_PER_STORE_PER_DAY"


@pytest.mark.asyncio
async def test_compute_proxy_rule_10_intermediate_quantize():
    """Rule 10 — mirror Java divide(scale=4).multiply path.

    100 bills / 3 stores / 1 day:
      100 / 3 = 33.333333...
      quantize 4 → 33.3333
      quantize 2 → 33.33 (final)
    A single ``(n / d).quantize(0.01)`` would yield 33.33 too on this
    input, but the intermediate step ensures parity with Java rounding
    at scale 4 — see ``python-java-port.md`` Rule 10.
    """
    conn = _FakeConn({"bill_count": 100, "store_count": 3, "day_count": 1})
    result = await _compute_table_turnover_proxy(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 1), conn
    )
    assert result["proxyMetric"]["value"] == 33.33


@pytest.mark.asyncio
async def test_compute_proxy_integer_division_decimal_collapse():
    """Rule 4 dict-eq: integer-valued Decimal collapses to int."""
    conn = _FakeConn({"bill_count": 60, "store_count": 2, "day_count": 3})
    # 60 / (2*3) = 10.0
    result = await _compute_table_turnover_proxy(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 3), conn
    )
    assert result["proxyMetric"]["value"] == 10
    assert isinstance(result["proxyMetric"]["value"], int)


@pytest.mark.asyncio
async def test_compute_proxy_zero_bill_count_returns_empty():
    """Empty period: bill_count=0 falls through to empty envelope."""
    conn = _FakeConn({"bill_count": 0, "store_count": 0, "day_count": 0})
    result = await _compute_table_turnover_proxy(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert result == _empty_table_turnover_proxy()


@pytest.mark.asyncio
async def test_compute_proxy_null_columns_returns_empty():
    """Defensive: any NULL column collapses to empty envelope (no ZeroDivisionError)."""
    conn = _FakeConn({"bill_count": None, "store_count": 1, "day_count": 30})
    result = await _compute_table_turnover_proxy(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert result == _empty_table_turnover_proxy()


@pytest.mark.asyncio
async def test_compute_proxy_none_row_returns_empty():
    """fetchrow returning None (no rows) → empty envelope, not exception."""
    conn = _FakeConn(None)
    result = await _compute_table_turnover_proxy(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert result == _empty_table_turnover_proxy()


# ============================================================
# Overview helper
# ============================================================


def test_restaurant_production_overview_shape():
    metrics = [
        _build_kitchen_station_utilization_metric(),
        _build_avg_prep_time_metric(),
        _empty_table_turnover_proxy(),
    ]
    ov = _restaurant_production_overview(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), metrics
    )
    assert set(ov.keys()) == {"summary", "kpis", "recentChanges"}
    assert "R_ILTEATRO_REAL" in ov["summary"]
    assert ov["kpis"] == metrics
    assert ov["recentChanges"] == []


# ============================================================
# Dispatch — analysisType branches + envelope shape
# ============================================================


@pytest.fixture
def patched_pg_pool(monkeypatch):
    """Provide an in-memory _FakePool to _restaurant_production_dispatch.

    Returns a factory: ``patched_pg_pool({"bill_count": ...})`` patches the
    smartbi pool so the dispatch's M3 query receives the supplied row.
    """

    def _factory(row):
        pool = _FakePool(row)

        async def fake_get_pg_pool():
            return pool

        # The dispatch imports get_pg_pool lazily inside the function, so we
        # have to monkeypatch the symbol on smartbi.config module.
        import smartbi.config

        monkeypatch.setattr(smartbi.config, "get_pg_pool", fake_get_pg_pool)
        return pool

    return _factory


@pytest.mark.asyncio
async def test_dispatch_oee_returns_metrics_plus_trendchart(patched_pg_pool):
    patched_pg_pool({"bill_count": 1420, "store_count": 1, "day_count": 30})
    envelope = await _restaurant_production_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "oee"
    )
    data = envelope["data"]
    assert data["tenantType"] == "RESTAURANT"
    assert data["startDate"] == "2026-05-01"
    assert data["endDate"] == "2026-05-31"
    assert "metrics" in data
    assert len(data["metrics"]) == 3
    assert data["metrics"][0]["metricCode"] == "KITCHEN_STATION_UTILIZATION"
    assert data["metrics"][1]["metricCode"] == "AVG_PREP_TIME"
    assert data["metrics"][2]["metricCode"] == "TABLE_TURNOVER_RATE"
    assert data["trendChart"] is None
    assert "ranking" not in data
    assert "downtimeChart" not in data
    assert "overview" not in data


@pytest.mark.asyncio
async def test_dispatch_none_analysis_type_defaults_to_oee(patched_pg_pool):
    """Per spec §3.4: None analysisType behaves like "oee"."""
    patched_pg_pool({"bill_count": 1420, "store_count": 1, "day_count": 30})
    envelope = await _restaurant_production_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), None
    )
    data = envelope["data"]
    assert "metrics" in data
    assert data["trendChart"] is None


@pytest.mark.asyncio
async def test_dispatch_efficiency_returns_metrics_plus_empty_ranking(patched_pg_pool):
    patched_pg_pool({"bill_count": 1420, "store_count": 1, "day_count": 30})
    envelope = await _restaurant_production_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "efficiency"
    )
    data = envelope["data"]
    assert len(data["metrics"]) == 3
    assert data["ranking"] == []
    assert "trendChart" not in data
    assert "downtimeChart" not in data


@pytest.mark.asyncio
async def test_dispatch_equipment_returns_empty_metrics_and_ranking(patched_pg_pool):
    """Restaurant equipment branch omits M4 per PR #330 §1.2: empty metrics."""
    patched_pg_pool({"bill_count": 1420, "store_count": 1, "day_count": 30})
    envelope = await _restaurant_production_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "equipment"
    )
    data = envelope["data"]
    assert data["metrics"] == []
    assert data["ranking"] == []
    assert data["downtimeChart"] is None
    assert "trendChart" not in data


@pytest.mark.asyncio
async def test_dispatch_overview_returns_overview_body(patched_pg_pool):
    patched_pg_pool({"bill_count": 1420, "store_count": 1, "day_count": 30})
    envelope = await _restaurant_production_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "overview"
    )
    data = envelope["data"]
    assert "overview" in data
    assert data["overview"]["summary"].startswith("Restaurant production analytics")
    assert len(data["overview"]["kpis"]) == 3
    assert data["overview"]["recentChanges"] == []
    # Spec §3.4: overview branch sets only `overview`, not `metrics`/`ranking`.
    assert "metrics" not in data
    assert "ranking" not in data


@pytest.mark.asyncio
async def test_dispatch_envelope_uses_wrap_response_shape(patched_pg_pool):
    """wrap_response adds {code, message, data, timestamp, success, ...}."""
    patched_pg_pool({"bill_count": 100, "store_count": 1, "day_count": 1})
    envelope = await _restaurant_production_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 1), "oee"
    )
    assert envelope["code"] == 200
    assert envelope["success"] is True
    assert "data" in envelope
    assert "timestamp" in envelope


# ============================================================
# Dispatch — graceful degradation when pool unavailable
# ============================================================


@pytest.mark.asyncio
async def test_dispatch_no_pool_falls_back_to_empty_proxy(monkeypatch):
    """If get_pg_pool returns None, M3 emits empty proxy envelope (no exception)."""

    async def fake_get_pg_pool():
        return None

    import smartbi.config

    monkeypatch.setattr(smartbi.config, "get_pg_pool", fake_get_pg_pool)

    envelope = await _restaurant_production_dispatch(
        "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "oee"
    )
    data = envelope["data"]
    m3 = data["metrics"][2]
    assert m3 == _empty_table_turnover_proxy()
    # M1 + M2 are unaffected — pool-independent.
    assert data["metrics"][0]["dataAvailability"] == "MISSING_KITCHEN_STATION_DATA"
    assert data["metrics"][1]["dataAvailability"] == "MISSING_ORDER_TIMESTAMP_SPLIT"


@pytest.mark.asyncio
async def test_dispatch_pool_exception_logs_and_falls_back(monkeypatch, caplog):
    """If get_pg_pool raises, dispatch logs warning and emits empty proxy."""
    import logging

    async def boom():
        raise RuntimeError("smartbi pool boom")

    import smartbi.config

    monkeypatch.setattr(smartbi.config, "get_pg_pool", boom)

    with caplog.at_level(logging.WARNING, logger=analysis_production.logger.name):
        envelope = await _restaurant_production_dispatch(
            "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), "oee"
        )
    data = envelope["data"]
    assert data["metrics"][2] == _empty_table_turnover_proxy()
    assert any(
        "smartbi pool acquisition failed" in rec.message for rec in caplog.records
    )


# ============================================================
# Controlled-vocabulary discipline (PR #330 §3.4)
# ============================================================


def test_module_only_uses_three_controlled_markers():
    """Sanity guard: the controlled-vocabulary constants exactly match Sub-A scope."""
    assert _AVAILABILITY_MISSING_KITCHEN_STATION == "MISSING_KITCHEN_STATION_DATA"
    assert _AVAILABILITY_MISSING_ORDER_TIMESTAMP == "MISSING_ORDER_TIMESTAMP_SPLIT"
    assert _AVAILABILITY_PROXY_BILLS == "PROXY_AS_BILLS_PER_STORE"
