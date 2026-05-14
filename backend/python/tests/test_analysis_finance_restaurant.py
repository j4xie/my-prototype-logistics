"""Phase IIa restaurant branch unit tests — ``/analysis/finance``.

Covers spec §4.3 envelope shape + the subset of §4.5 edge cases that apply
to the finance overview path (3 of 6 — the rest are sales-only):

* 1 (zero bills): kpi all 0 / null, revenueChart empty
* 2 (customer_count == 0 but bill_count > 0): avgPerCapita None
* 4 (start > end): HTTP 400 INVALID_DATE_RANGE (validator reused from sales)

Plus the finance-specific contracts:
* ``phaseIIbPreview`` returns ``{wastageRate: null, dataAvailability: WASTAGE_NOT_TRACKED}``
* ``coverageStart`` / ``coverageEnd`` reflect actual MIN/MAX agg_daily.date
* All restaurant requests route through the overview branch regardless of
  ``analysisType`` (spec §4.5.1 — restaurants have overview-only in Phase IIa)
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from smartbi_compat.api.analysis_finance import (
    _get_restaurant_finance_kpi,
    _get_restaurant_finance_revenue_chart,
    _restaurant_finance_overview,
    _restaurant_finance_phase_iib_preview,
)


# ============================================================
# Fake asyncpg infrastructure (reused pattern from sales tests)
# ============================================================


class _FakeConn:
    def __init__(self, *, fetch_map=None, fetchrow_map=None):
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
            for key, row in self._fetchrow_map.items():
                if key in sql:
                    return row
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
# phaseIIbPreview — static placeholder
# ============================================================


def test_phase_iib_preview_static_shape():
    """Per spec §4.3: {wastageRate: null, dataAvailability: WASTAGE_NOT_TRACKED}."""
    preview = _restaurant_finance_phase_iib_preview()
    assert preview == {
        "wastageRate": None,
        "dataAvailability": "WASTAGE_NOT_TRACKED",
    }


# ============================================================
# kpi block — coverage MIN/MAX + edge cases 1 + 2
# ============================================================


@pytest.mark.asyncio
async def test_kpi_zero_bills_all_zero_coverage_null():
    """Edge case 1: zero rows → all 0, coverage None."""
    conn = _FakeConn(fetchrow_map={
        "FROM agg_daily": {
            "total_revenue": Decimal("0"),
            "bill_count": 0,
            "customer_count": 0,
            "store_count": 0,
            "coverage_start": None,
            "coverage_end": None,
        },
    })
    kpi = await _get_restaurant_finance_kpi(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert kpi == {
        "totalRevenue": 0,
        "billCount": 0,
        "avgPerCapita": None,
        "storeCount": 0,
        "coverageStart": None,
        "coverageEnd": None,
    }


@pytest.mark.asyncio
async def test_kpi_bills_without_customers_avg_per_capita_none():
    """Edge case 2: bills > 0 but customer_count == 0 → avgPerCapita None."""
    conn = _FakeConn(fetchrow_map={
        "FROM agg_daily": {
            "total_revenue": Decimal("50000.00"),
            "bill_count": 500,
            "customer_count": 0,
            "store_count": 4,
            "coverage_start": date(2026, 5, 1),
            "coverage_end": date(2026, 5, 31),
        },
    })
    kpi = await _get_restaurant_finance_kpi(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert kpi["billCount"] == 500
    assert kpi["totalRevenue"] == 50000
    assert kpi["avgPerCapita"] is None  # explicit None per Rule 1


@pytest.mark.asyncio
async def test_kpi_coverage_dates_reflect_actual_data_span():
    """Coverage MIN/MAX surface actual data span (NOT the requested range).
    Critical for UI 'data coverage' badge accuracy."""
    conn = _FakeConn(fetchrow_map={
        "FROM agg_daily": {
            "total_revenue": Decimal("284650.00"),
            "bill_count": 3420,
            "customer_count": 3420,  # 1 customer per bill
            "store_count": 4,
            # User asks 2026-01-01 to 2026-12-31 but data spans 2026-05-01 to 2026-05-31
            "coverage_start": date(2026, 5, 1),
            "coverage_end": date(2026, 5, 31),
        },
    })
    kpi = await _get_restaurant_finance_kpi(
        "R_TEST", date(2026, 1, 1), date(2026, 12, 31), conn
    )
    assert kpi["coverageStart"] == "2026-05-01"
    assert kpi["coverageEnd"] == "2026-05-31"
    # 284650 / 3420 = 83.2310... → quantize 0.01 HALF_UP → 83.23
    assert kpi["avgPerCapita"] == 83.23


# ============================================================
# revenueChart — BAR monthly
# ============================================================


@pytest.mark.asyncio
async def test_revenue_chart_monthly_aggregation():
    """xAxis = YYYY-MM, series 总营收 ascending by month."""
    conn = _FakeConn(fetch_map={"agg_daily": [
        {"month": date(2026, 1, 1), "amount": Decimal("240000.00")},
        {"month": date(2026, 2, 1), "amount": Decimal("275000.00")},
    ]})
    chart = await _get_restaurant_finance_revenue_chart(
        "R_TEST", date(2026, 1, 1), date(2026, 2, 28), conn
    )
    assert chart["chartType"] == "BAR"
    assert chart["title"] == "月度营收"
    assert chart["xAxis"] == ["2026-01", "2026-02"]
    assert chart["series"][0]["name"] == "总营收"
    # _decimal_to_number turns integral Decimals into ints
    assert chart["series"][0]["data"] == [240000, 275000]


@pytest.mark.asyncio
async def test_revenue_chart_empty_when_no_rows():
    """Edge case 1: zero rows → empty xAxis and series.data."""
    conn = _FakeConn(fetch_map={"agg_daily": []})
    chart = await _get_restaurant_finance_revenue_chart(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31), conn
    )
    assert chart["xAxis"] == []
    assert chart["series"][0]["data"] == []


@pytest.mark.asyncio
async def test_revenue_chart_rule_6_raises_on_none_dates():
    """Rule 6: None dates → explicit ValueError, not silent zero-row."""
    conn = _FakeConn(fetch_map={"agg_daily": []})
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _get_restaurant_finance_revenue_chart(
            "R_TEST", None, date(2026, 5, 31), conn
        )


# ============================================================
# Dispatcher integration
# ============================================================


@pytest.mark.asyncio
async def test_dispatcher_envelope_keys(monkeypatch):
    """End-to-end: dispatcher returns wrap_response with spec §4.3 keys."""
    conn = _FakeConn(
        fetchrow_map={
            "FROM agg_daily\n        WHERE factory_id = $1\n          AND date BETWEEN": {
                "total_revenue": Decimal("100.00"),
                "bill_count": 1,
                "customer_count": 1,
                "store_count": 1,
                "coverage_start": date(2026, 5, 1),
                "coverage_end": date(2026, 5, 31),
            },
        },
        fetch_map={"agg_daily": []},
    )
    pool = _FakePool(conn)

    async def _fake_get_pg_pool():
        return pool

    import smartbi.config as cfg
    monkeypatch.setattr(cfg, "get_pg_pool", _fake_get_pg_pool)

    envelope = await _restaurant_finance_overview(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31)
    )
    assert envelope["success"] is True
    data = envelope["data"]
    assert data["tenantType"] == "RESTAURANT"
    assert data["analysisType"] == "overview"
    assert set(data.keys()) == {
        "tenantType", "analysisType", "kpi", "revenueChart",
        "phaseIIbPreview", "generatedAt",
    }
    assert data["phaseIIbPreview"] == {
        "wastageRate": None,
        "dataAvailability": "WASTAGE_NOT_TRACKED",
    }


@pytest.mark.asyncio
async def test_dispatcher_pool_unavailable_returns_empty(monkeypatch):
    """Defensive: pool failure → empty envelope, not 500."""

    async def _fake_get_pg_pool():
        return None

    import smartbi.config as cfg
    monkeypatch.setattr(cfg, "get_pg_pool", _fake_get_pg_pool)

    envelope = await _restaurant_finance_overview(
        "R_TEST", date(2026, 5, 1), date(2026, 5, 31)
    )
    data = envelope["data"]
    assert data["tenantType"] == "RESTAURANT"
    assert data["analysisType"] == "overview"
    assert data["kpi"]["totalRevenue"] == 0
    assert data["kpi"]["coverageStart"] is None
    assert data["revenueChart"]["xAxis"] == []
    assert data["phaseIIbPreview"]["dataAvailability"] == "WASTAGE_NOT_TRACKED"


@pytest.mark.asyncio
async def test_dispatcher_invalid_date_range_400():
    """Edge case 4: dispatcher validates before any DB work."""
    with pytest.raises(HTTPException) as exc_info:
        await _restaurant_finance_overview(
            "R_TEST", date(2026, 6, 1), date(2026, 5, 1)
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_DATE_RANGE"
