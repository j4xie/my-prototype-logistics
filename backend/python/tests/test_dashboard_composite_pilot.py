"""Phase 2C Tier 2 PILOT — composite dashboard tests.

Covers ``backend/python/smartbi_compat/api/dashboard_composite.py``:

* ``_resolve_period`` — today/week/month/quarter/year date arithmetic
  + unknown-period default to month (Java line 162-163 parity)
* ``_empty_dashboard_response`` — 16-key Lombok null-emit parity
* ``_empty_production_dashboard`` / ``_empty_quality_dashboard`` —
  Phase 2D deferred placeholder with INFO aiInsight
* Sub-fetcher graceful degradation — primitive raise → empty placeholder
* ``_build_executive_dashboard`` — single-primitive happy path +
  envelope metadata defensive fill
* ``_build_unified_dashboard`` — 4-primitive parallel fanout + 2
  empty placeholders + envelope shape
* Router endpoints — period default, unknown period fallback, custom
  range, response wrap

Mocks the Phase 2A primitives via monkeypatch on the public symbols
imported into ``dashboard_composite``.
"""
from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from smartbi_compat.api import dashboard_composite as dc
from smartbi_compat.date_range import DateRange


# ============================================================
# _resolve_period
# ============================================================


def test_resolve_period_today():
    today = date(2026, 5, 11)  # Monday
    r = dc._resolve_period("today", today=today)
    assert r.start_date == today
    assert r.end_date == today
    assert r.days == 1


def test_resolve_period_week_monday():
    # 2026-05-11 is Monday — week should be 2026-05-11 → 2026-05-17.
    r = dc._resolve_period("week", today=date(2026, 5, 11))
    assert r.start_date == date(2026, 5, 11)
    assert r.end_date == date(2026, 5, 17)


def test_resolve_period_week_friday():
    # 2026-05-15 is Friday — week start should be Monday 2026-05-11.
    r = dc._resolve_period("week", today=date(2026, 5, 15))
    assert r.start_date == date(2026, 5, 11)
    assert r.end_date == date(2026, 5, 17)


def test_resolve_period_month_mid_month():
    r = dc._resolve_period("month", today=date(2026, 5, 15))
    assert r.start_date == date(2026, 5, 1)
    assert r.end_date == date(2026, 5, 31)


def test_resolve_period_month_december_boundary():
    """Year-rollover for December — verify end is 12-31, not into Jan."""
    r = dc._resolve_period("month", today=date(2026, 12, 15))
    assert r.start_date == date(2026, 12, 1)
    assert r.end_date == date(2026, 12, 31)


def test_resolve_period_month_january():
    """Year-rollback for January previous-month — verify 01-01 start."""
    r = dc._resolve_period("month", today=date(2026, 1, 15))
    assert r.start_date == date(2026, 1, 1)
    assert r.end_date == date(2026, 1, 31)


def test_resolve_period_quarter_q1():
    r = dc._resolve_period("quarter", today=date(2026, 2, 15))
    assert r.start_date == date(2026, 1, 1)
    assert r.end_date == date(2026, 3, 31)


def test_resolve_period_quarter_q2():
    r = dc._resolve_period("quarter", today=date(2026, 5, 15))
    assert r.start_date == date(2026, 4, 1)
    assert r.end_date == date(2026, 6, 30)


def test_resolve_period_quarter_q3():
    r = dc._resolve_period("quarter", today=date(2026, 8, 15))
    assert r.start_date == date(2026, 7, 1)
    assert r.end_date == date(2026, 9, 30)


def test_resolve_period_quarter_q4_year_boundary():
    """Q4 end must be 12-31, not into next year."""
    r = dc._resolve_period("quarter", today=date(2026, 11, 15))
    assert r.start_date == date(2026, 10, 1)
    assert r.end_date == date(2026, 12, 31)


def test_resolve_period_year():
    r = dc._resolve_period("year", today=date(2026, 5, 15))
    assert r.start_date == date(2026, 1, 1)
    assert r.end_date == date(2026, 12, 31)
    assert r.days == 365


def test_resolve_period_unknown_falls_back_to_month():
    """Java line 162-163: unknown values default to month."""
    r = dc._resolve_period("unknown_period", today=date(2026, 5, 15))
    assert r.start_date == date(2026, 5, 1)
    assert r.end_date == date(2026, 5, 31)


def test_resolve_period_empty_string_falls_back_to_month():
    r = dc._resolve_period("", today=date(2026, 5, 15))
    assert r.start_date == date(2026, 5, 1)


# ============================================================
# _empty_dashboard_response — Rule 9.2 16-field emit
# ============================================================


def test_empty_dashboard_response_has_16_keys():
    """Lombok @Data without @JsonInclude → all 16 fields explicit."""
    d = dc._empty_dashboard_response("month", date(2026, 5, 1), date(2026, 5, 31))
    assert set(d.keys()) == {
        "period", "startDate", "endDate",
        "kpiCards", "metricCards",
        "rankings", "charts", "chartList",
        "aiInsights", "alerts", "recommendations", "suggestions",
        "generatedAt", "lastUpdated",
        "fromCache", "cacheExpireAt",
    }


def test_empty_dashboard_response_dates_iso():
    d = dc._empty_dashboard_response("month", date(2026, 5, 1), date(2026, 5, 31))
    assert d["startDate"] == "2026-05-01"
    assert d["endDate"] == "2026-05-31"


def test_empty_dashboard_response_from_cache_explicit_false():
    """Rule 9.3 — boolean field must emit explicit false, not be absent."""
    d = dc._empty_dashboard_response("month", date(2026, 5, 1), date(2026, 5, 31))
    assert d["fromCache"] is False
    assert d["lastUpdated"] is None
    assert d["cacheExpireAt"] is None


def test_empty_dashboard_response_collections_empty_not_null():
    d = dc._empty_dashboard_response("month", date(2026, 5, 1), date(2026, 5, 31))
    assert d["kpiCards"] == []
    assert d["metricCards"] == []
    assert d["rankings"] == {}
    assert d["charts"] == {}
    assert d["chartList"] == []
    assert d["aiInsights"] == []
    assert d["alerts"] == []
    assert d["recommendations"] == []
    assert d["suggestions"] == []


# ============================================================
# Production / Quality Phase 2D placeholders
# ============================================================


def test_empty_production_dashboard_has_deferred_insight():
    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    d = dc._empty_production_dashboard("month", range_)
    assert len(d["aiInsights"]) == 1
    assert d["aiInsights"][0]["level"] == "INFO"
    assert d["aiInsights"][0]["category"] == "DEFERRED"
    assert "Production analysis pending Phase 2D" in d["aiInsights"][0]["message"]


def test_empty_quality_dashboard_has_deferred_insight():
    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    d = dc._empty_quality_dashboard("month", range_)
    assert d["aiInsights"][0]["category"] == "DEFERRED"
    assert "Quality analysis pending Phase 2D" in d["aiInsights"][0]["message"]


# ============================================================
# Sub-fetcher graceful degradation
# ============================================================


@pytest.mark.asyncio
async def test_fetch_sales_safe_happy_path(monkeypatch):
    async def fake_sales(factory_id, range_):
        return {"period": "month", "kpiCards": [{"key": "REVENUE"}]}

    monkeypatch.setattr(dc, "_get_sales_overview", fake_sales)
    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._fetch_sales_safe("F001", "month", range_)
    assert result["kpiCards"] == [{"key": "REVENUE"}]


@pytest.mark.asyncio
async def test_fetch_sales_safe_returns_empty_on_exception(monkeypatch, caplog):
    async def boom(factory_id, range_):
        raise RuntimeError("primitive crashed")

    monkeypatch.setattr(dc, "_get_sales_overview", boom)
    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    import logging
    with caplog.at_level(logging.WARNING, logger=dc.logger.name):
        result = await dc._fetch_sales_safe("F001", "month", range_)
    # Empty placeholder shape — 16 keys, fromCache=False.
    assert set(result.keys()) >= {"period", "startDate", "endDate", "fromCache"}
    assert result["fromCache"] is False
    assert result["kpiCards"] == []
    assert any("sales overview failed" in rec.message for rec in caplog.records)


@pytest.mark.asyncio
async def test_fetch_finance_safe_returns_empty_on_exception(monkeypatch):
    async def boom(factory_id, range_):
        raise ValueError("finance broken")
    monkeypatch.setattr(dc, "_get_finance_overview", boom)
    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._fetch_finance_safe("F001", "month", range_)
    assert result["kpiCards"] == []


@pytest.mark.asyncio
async def test_fetch_inventory_safe_signature_matches_primitive(monkeypatch):
    """Inventory primitive uses (factory_id, start_date, end_date) not DateRange."""
    received_args: dict[str, Any] = {}

    async def fake_inv(factory_id, start_date, end_date):
        received_args["factory_id"] = factory_id
        received_args["start_date"] = start_date
        received_args["end_date"] = end_date
        return {"period": "month", "kpiCards": [{"key": "INV_HEALTH"}]}

    monkeypatch.setattr(dc, "_get_inventory_health", fake_inv)
    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._fetch_inventory_safe("F001", "month", range_)
    assert received_args == {
        "factory_id": "F001",
        "start_date": date(2026, 5, 1),
        "end_date": date(2026, 5, 31),
    }
    assert result["kpiCards"][0]["key"] == "INV_HEALTH"


@pytest.mark.asyncio
async def test_fetch_procurement_safe_passes_raw_dates(monkeypatch):
    received_args: dict[str, Any] = {}

    async def fake_proc(factory_id, start_date, end_date):
        received_args["factory_id"] = factory_id
        received_args["start_date"] = start_date
        return {"period": "month", "kpiCards": [{"key": "PROC_AMOUNT"}]}

    monkeypatch.setattr(dc, "_get_procurement_overview", fake_proc)
    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._fetch_procurement_safe("F001", "month", range_)
    assert received_args["start_date"] == date(2026, 5, 1)
    assert result["kpiCards"][0]["key"] == "PROC_AMOUNT"


# ============================================================
# _build_executive_dashboard
# ============================================================


@pytest.mark.asyncio
async def test_build_executive_happy_path(monkeypatch):
    async def fake_sales(factory_id, range_):
        return {
            "period": "month",
            "startDate": "2026-05-01",
            "endDate": "2026-05-31",
            "kpiCards": [{"key": "REVENUE"}],
            "generatedAt": "2026-05-12T10:00:00",
        }
    monkeypatch.setattr(dc, "_get_sales_overview", fake_sales)
    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._build_executive_dashboard("F001", "month", range_)
    assert result["kpiCards"] == [{"key": "REVENUE"}]
    assert result["startDate"] == "2026-05-01"


@pytest.mark.asyncio
async def test_build_executive_fills_missing_envelope_metadata(monkeypatch):
    """If primitive omits period/startDate/endDate/generatedAt, fill defensively."""

    async def fake_sales(factory_id, range_):
        # Primitive returns minimal payload — composite must fill envelope.
        return {"kpiCards": []}

    monkeypatch.setattr(dc, "_get_sales_overview", fake_sales)
    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._build_executive_dashboard("F001", "month", range_)
    assert result["period"] == "month"
    assert result["startDate"] == "2026-05-01"
    assert result["endDate"] == "2026-05-31"
    assert result["generatedAt"] is not None


@pytest.mark.asyncio
async def test_build_executive_preserves_existing_metadata(monkeypatch):
    """If primitive already sets period/startDate/etc, don't overwrite."""
    async def fake_sales(factory_id, range_):
        return {
            "period": "CUSTOM",                # ← primitive's own value
            "startDate": "2026-04-30",          # ← primitive's own value (overrides range)
            "endDate": "2026-05-31",
            "kpiCards": [],
            "generatedAt": "primitive-set-value",
        }
    monkeypatch.setattr(dc, "_get_sales_overview", fake_sales)
    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._build_executive_dashboard("F001", "month", range_)
    assert result["period"] == "CUSTOM"
    assert result["startDate"] == "2026-04-30"
    assert result["generatedAt"] == "primitive-set-value"


# ============================================================
# _build_unified_dashboard
# ============================================================


@pytest.mark.asyncio
async def test_build_unified_envelope_shape(monkeypatch):
    """All 18 fields of UnifiedDashboardResponse must be present."""

    async def fake_primitive(factory_id, range_or_start, end_date=None):
        return {"kpiCards": [], "period": "month"}

    monkeypatch.setattr(dc, "_get_sales_overview", fake_primitive)
    monkeypatch.setattr(dc, "_get_finance_overview", fake_primitive)
    monkeypatch.setattr(dc, "_get_inventory_health", fake_primitive)
    monkeypatch.setattr(dc, "_get_procurement_overview", fake_primitive)

    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._build_unified_dashboard("F001", "month", range_)

    expected_keys = {
        "period", "startDate", "endDate",
        "sales", "finance", "inventory", "production", "quality", "procurement",
        "departmentRanking", "regionRanking",
        "alerts", "recommendations", "aiInsights",
        "generatedAt", "fromCache", "cacheExpireAt", "dataVersion",
    }
    assert set(result.keys()) == expected_keys
    # Sub-dashboards each have the 16-key envelope.
    for sub in ("sales", "finance", "inventory", "production", "quality", "procurement"):
        assert isinstance(result[sub], dict), f"{sub} is not a dict"


@pytest.mark.asyncio
async def test_build_unified_production_quality_are_placeholders(monkeypatch):
    """Production + Quality should always be placeholders per pilot scope."""
    async def fake_primitive(factory_id, *args):
        return {"kpiCards": [{"key": "REAL"}]}

    monkeypatch.setattr(dc, "_get_sales_overview", fake_primitive)
    monkeypatch.setattr(dc, "_get_finance_overview", fake_primitive)
    monkeypatch.setattr(dc, "_get_inventory_health", fake_primitive)
    monkeypatch.setattr(dc, "_get_procurement_overview", fake_primitive)

    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._build_unified_dashboard("F001", "month", range_)

    # Production/Quality always empty + DEFERRED insight regardless of primitive returns.
    assert result["production"]["kpiCards"] == []
    assert result["production"]["aiInsights"][0]["category"] == "DEFERRED"
    assert result["quality"]["aiInsights"][0]["category"] == "DEFERRED"


@pytest.mark.asyncio
async def test_build_unified_rankings_alerts_empty(monkeypatch):
    """Pilot HOLD — rankings + alerts + recommendations all empty list."""
    async def fake_primitive(factory_id, *args):
        return {"kpiCards": []}
    for name in ("_get_sales_overview", "_get_finance_overview",
                 "_get_inventory_health", "_get_procurement_overview"):
        monkeypatch.setattr(dc, name, fake_primitive)

    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._build_unified_dashboard("F001", "month", range_)
    assert result["departmentRanking"] == []
    assert result["regionRanking"] == []
    assert result["alerts"] == []
    assert result["recommendations"] == []
    assert result["aiInsights"] == []


@pytest.mark.asyncio
async def test_build_unified_partial_failure_graceful(monkeypatch):
    """If one primitive raises, that sub-dashboard becomes empty placeholder
    but others still populate."""
    async def fake_sales(factory_id, range_):
        return {"kpiCards": [{"key": "SALES_REAL"}]}

    async def fake_finance_broken(factory_id, range_):
        raise RuntimeError("finance pool down")

    async def fake_inv(factory_id, start, end):
        return {"kpiCards": [{"key": "INV_REAL"}]}

    async def fake_proc(factory_id, start, end):
        return {"kpiCards": [{"key": "PROC_REAL"}]}

    monkeypatch.setattr(dc, "_get_sales_overview", fake_sales)
    monkeypatch.setattr(dc, "_get_finance_overview", fake_finance_broken)
    monkeypatch.setattr(dc, "_get_inventory_health", fake_inv)
    monkeypatch.setattr(dc, "_get_procurement_overview", fake_proc)

    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._build_unified_dashboard("F001", "month", range_)
    assert result["sales"]["kpiCards"] == [{"key": "SALES_REAL"}]
    assert result["finance"]["kpiCards"] == []  # primitive raised → empty
    assert result["inventory"]["kpiCards"] == [{"key": "INV_REAL"}]
    assert result["procurement"]["kpiCards"] == [{"key": "PROC_REAL"}]


@pytest.mark.asyncio
async def test_build_unified_emits_metadata_dates(monkeypatch):
    async def fake_primitive(factory_id, *args):
        return {"kpiCards": []}
    for name in ("_get_sales_overview", "_get_finance_overview",
                 "_get_inventory_health", "_get_procurement_overview"):
        monkeypatch.setattr(dc, name, fake_primitive)

    range_ = DateRange.custom(date(2026, 5, 1), date(2026, 5, 31))
    result = await dc._build_unified_dashboard("F001", "month", range_)
    assert result["startDate"] == "2026-05-01"
    assert result["endDate"] == "2026-05-31"
    assert result["period"] == "month"
    assert result["fromCache"] is False
    assert result["dataVersion"] is None


# ============================================================
# Router endpoint smoke
# ============================================================


def test_router_declares_three_endpoints():
    paths = {route.path for route in dc.router.routes}
    assert "/api/mobile/{factory_id}/smart-bi/dashboard/executive" in paths
    assert "/api/mobile/{factory_id}/smart-bi/dashboard/executive/custom" in paths
    assert "/api/mobile/{factory_id}/smart-bi/dashboard" in paths


def test_router_endpoints_are_get_only():
    targets = {
        "/api/mobile/{factory_id}/smart-bi/dashboard/executive",
        "/api/mobile/{factory_id}/smart-bi/dashboard/executive/custom",
        "/api/mobile/{factory_id}/smart-bi/dashboard",
    }
    for route in dc.router.routes:
        if route.path in targets:
            assert set(route.methods) == {"GET"}, f"{route.path} accepts non-GET"


# ============================================================
# Module-level advertisement (stable boundaries for future chats)
# ============================================================


def test_module_exposes_public_helpers():
    """Spec / Phase 2D follow-up chats grep these."""
    assert hasattr(dc, "_resolve_period")
    assert hasattr(dc, "_empty_dashboard_response")
    assert hasattr(dc, "_build_executive_dashboard")
    assert hasattr(dc, "_build_unified_dashboard")
    assert hasattr(dc, "router")
    assert hasattr(dc, "get_executive_dashboard")
    assert hasattr(dc, "get_executive_dashboard_custom_range")
    assert hasattr(dc, "get_unified_dashboard")


def test_module_imports_phase_2a_primitives_directly():
    """Approach B verified — direct import, not HTTP sub-calls."""
    assert callable(dc._get_sales_overview)
    assert callable(dc._get_finance_overview)
    assert callable(dc._get_inventory_health)
    assert callable(dc._get_procurement_overview)
