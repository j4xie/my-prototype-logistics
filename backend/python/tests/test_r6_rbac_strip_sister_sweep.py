"""R6 cascade — RBAC strip + gate sister sweep across 5 Python modules.

Follow-up to PR #483 (R4 region L4 deep) which fixed
``analysis_region.py:789`` missing ``strip_price_for_role`` wrap. PR #483
§3.2 scheduled five sibling Python modules with the same gap; this file
locks the fixes.

| Module | Endpoint | Pre-fix gap |
|---|---|---|
| ``analysis_department`` | ``/analysis/department`` | strip wrap missing (gate already via PR #480) |
| ``analysis_production`` | ``/analysis/production`` | gate + strip wrap missing |
| ``analysis_quality`` | ``/analysis/quality`` | gate + strip wrap missing |
| ``incentive_plan`` | ``/incentive-plan/{type}/{id}`` | gate + strip wrap missing |
| ``analysis`` (4 legacy) | ``/query-templates``, ``/datasource/list``, ``/alerts``,
  ``/recommendations`` | gate + strip wrap missing |

Each test mocks the data-fetch seam so the gate / strip behavior can be
isolated without hitting the database. Pattern mirrors
``test_analysis_region_pilot.py`` PR #483 §1300-1466 (R4 borrow RBAC
strip lock-down).

Test matrix (≥10 regressions):

* warehouse_manager → 403 at gate (one per endpoint, 8 total)
* viewer → 200 with money carriers nulled (one per money-bearing endpoint)

Skipped (deliberate, scheduled per Rule 8.4):

* Strip-helper recognition gaps (``ranking[].value``, etc.) not covered
  here — see PR #483 §3.3 Option A/B/C discussion.
"""
from __future__ import annotations

import os
from typing import Optional

import jwt
import pytest

os.environ.setdefault("JWT_SECRET", "r6-sister-sweep-test-secret")
_JWT_SECRET = "r6-sister-sweep-test-secret"

from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402

pytestmark = [pytest.mark.api_endpoint("r6_rbac_strip_sister_sweep")]


# ============================================================
# Shared helpers
# ============================================================


def _make_token(*, factory_id: Optional[str] = "F001", role: str = "factory_super_admin",
                exp_offset: int = 3600) -> str:
    from time import time

    payload: dict = {
        "userId": 22,
        "username": "r6-sweep",
        "role": role,
        "exp": int(time()) + exp_offset,
    }
    if factory_id is not None:
        payload["factoryId"] = factory_id
    return jwt.encode(payload, _JWT_SECRET, algorithm=JWT_ALGORITHM)


def _auth_header(**kwargs) -> dict:
    return {"Authorization": f"Bearer {_make_token(**kwargs)}"}


def _build_client(router, monkeypatch):
    """TestClient with the requested router mounted + RbacForbiddenException
    handler registered so the gate produces 4-位一体 403 bodies (mirrors
    main.py wiring).
    """
    monkeypatch.setenv("JWT_SECRET", _JWT_SECRET)
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from smartbi_compat._rbac_role import (
        RbacForbiddenException,
        rbac_forbidden_handler,
    )

    app = FastAPI()
    app.add_exception_handler(RbacForbiddenException, rbac_forbidden_handler)
    app.include_router(router)
    return TestClient(app)


class _FakeConn:
    """asyncpg.Connection stub yielding a fixed row from fetchrow."""

    def __init__(self, row):
        self._row = row

    async def fetchrow(self, sql, *args):
        return self._row


class _FakePool:
    """asyncpg.Pool stub yielding a single _FakeConn from acquire()."""

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


def _money_payload() -> dict:
    """Generic money-bearing payload with multiple strip-helper recognized
    carriers. Reused across modules — strip helper is content-agnostic so
    each module's actual return shape doesn't matter for the strip test.
    """
    return {
        "totalAmount": 12345.67,
        "totalRevenue": 9876.54,
        "kpiCards": [
            {
                "metricCode": "SALES_TOTAL",
                "metricName": "销售总额",
                "value": 1000.0,
                "unit": "元",
            }
        ],
        "salesByCategory": [
            {"name": "A", "revenue": 100.0, "count": 5},
        ],
    }


def _assert_money_stripped(data: dict) -> None:
    """Assertions used by every strip test — strip helper recognized
    carriers MUST be None, non-money fields preserved.
    """
    assert data["totalAmount"] is None, "money-named leaf stripped"
    assert data["totalRevenue"] is None, "money-named leaf stripped"
    # KPI card via unit=元
    assert data["kpiCards"][0]["value"] is None, "KPI card value nulled via unit=元"
    assert data["kpiCards"][0]["unit"] == "元", "non-money preserved"
    assert data["kpiCards"][0]["metricCode"] == "SALES_TOTAL", "non-money preserved"
    # Nested money-key leaf
    assert data["salesByCategory"][0]["revenue"] is None, "money-named leaf stripped"
    assert data["salesByCategory"][0]["count"] == 5, "non-money preserved"
    assert data["salesByCategory"][0]["name"] == "A", "non-money preserved"


# ============================================================
# Module 1 — analysis_department.py (gate via PR #480, strip new)
# ============================================================


@pytest.fixture
def dept_client(monkeypatch):
    from smartbi_compat.api import analysis_department as mod
    return mod, _build_client(mod.router, monkeypatch)


def test_department_warehouse_manager_denied_at_gate_returns_403(dept_client):
    """PR #480 contract guard — warehouse_manager NOT in ANALYTICS_READ_ROLES
    must be denied before handler. Regression lock against future refactor
    that drops ``require_analytics_read`` from /analysis/department.
    """
    _mod, client = dept_client
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/department"
        "?startDate=2026-04-12&endDate=2026-05-12",
        headers=_auth_header(role="warehouse_manager"),
    )
    assert r.status_code == 403, r.text
    body = r.json()
    assert body.get("success") is False
    meta = body.get("meta") or {}
    assert meta.get("module") == "analytics"


def test_department_viewer_role_strips_money_via_helper(dept_client, monkeypatch):
    """R6 primary lock for department — viewer (analytics:read but NOT
    PRICE_VIEW_ROLES) gets strip_price_for_role applied to result.
    """
    mod, client = dept_client

    async def _fake(factory_id, start_date, end_date):
        return _money_payload()

    monkeypatch.setattr(mod, "_get_department_analysis", _fake)

    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/department"
        "?startDate=2026-04-12&endDate=2026-05-12",
        headers=_auth_header(role="viewer"),
    )
    assert r.status_code == 200, r.text
    _assert_money_stripped(r.json()["data"])


def test_department_factory_super_admin_sees_raw_money_baseline(
    dept_client, monkeypatch
):
    """Baseline — admin (in PRICE_VIEW_ROLES) gets unmodified money fields.
    Locks the white-list short-circuit in strip_price_for_role.
    """
    mod, client = dept_client

    async def _fake(factory_id, start_date, end_date):
        return _money_payload()

    monkeypatch.setattr(mod, "_get_department_analysis", _fake)

    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/department"
        "?startDate=2026-04-12&endDate=2026-05-12",
        headers=_auth_header(role="factory_super_admin"),
    )
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["totalAmount"] == 12345.67
    assert data["kpiCards"][0]["value"] == 1000.0


# ============================================================
# Module 2 — analysis_production.py (factory branch)
# ============================================================


@pytest.fixture
def production_factory_client(monkeypatch):
    """Mock cretas_db tenant lookup to return FACTORY so factory branch fires."""
    monkeypatch.setenv("JWT_SECRET", _JWT_SECRET)
    import smartbi.config

    async def _fake_get_cretas_pool():
        return _FakePool({"type": "FACTORY"})

    monkeypatch.setattr(smartbi.config, "get_cretas_pool", _fake_get_cretas_pool)

    from smartbi_compat.api import analysis_production as mod
    return mod, _build_client(mod.router, monkeypatch)


def test_production_warehouse_manager_denied_at_gate_returns_403(
    production_factory_client,
):
    """R6 gate-change lock for /analysis/production — warehouse_manager
    must hit 403 at the require_analytics_read dependency, not 200.
    """
    _mod, client = production_factory_client
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/production"
        "?startDate=2026-04-12&endDate=2026-05-12",
        headers=_auth_header(role="warehouse_manager"),
    )
    assert r.status_code == 403, r.text


def test_production_factory_viewer_role_strips_money(
    production_factory_client, monkeypatch
):
    """R6 strip-wrap lock for /analysis/production factory branch."""
    mod, client = production_factory_client

    async def _fake_factory(factory_id, start_date, end_date, analysis_type):
        return _money_payload()

    monkeypatch.setattr(mod, "_factory_production_dispatch", _fake_factory)

    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/production"
        "?startDate=2026-04-12&endDate=2026-05-12",
        headers=_auth_header(role="viewer"),
    )
    assert r.status_code == 200, r.text
    _assert_money_stripped(r.json()["data"])


def test_production_restaurant_viewer_role_strips_envelope_data(monkeypatch):
    """R6 strip-wrap lock for /analysis/production restaurant branch.

    Restaurant dispatch returns an already-wrapped envelope. The route
    handler strips envelope["data"] in-place before returning.
    """
    monkeypatch.setenv("JWT_SECRET", _JWT_SECRET)
    import smartbi.config

    async def _fake_get_cretas_pool():
        return _FakePool({"type": "RESTAURANT"})

    monkeypatch.setattr(smartbi.config, "get_cretas_pool", _fake_get_cretas_pool)

    from smartbi_compat.api import analysis_production as mod
    from smartbi_compat.schema_compat import wrap_response

    async def _fake_restaurant(factory_id, start_date, end_date, analysis_type):
        return wrap_response(_money_payload())

    monkeypatch.setattr(mod, "_restaurant_production_dispatch", _fake_restaurant)

    client = _build_client(mod.router, monkeypatch)
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/production"
        "?startDate=2026-04-12&endDate=2026-05-12",
        headers=_auth_header(role="viewer"),
    )
    assert r.status_code == 200, r.text
    _assert_money_stripped(r.json()["data"])


# ============================================================
# Module 3 — analysis_quality.py (factory branch)
# ============================================================


@pytest.fixture
def quality_factory_client(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", _JWT_SECRET)
    import smartbi.config

    async def _fake_get_cretas_pool():
        return _FakePool({"type": "FACTORY"})

    monkeypatch.setattr(smartbi.config, "get_cretas_pool", _fake_get_cretas_pool)

    from smartbi_compat.api import analysis_quality as mod
    return mod, _build_client(mod.router, monkeypatch)


def test_quality_warehouse_manager_denied_at_gate_returns_403(
    quality_factory_client,
):
    """R6 gate-change lock for /analysis/quality."""
    _mod, client = quality_factory_client
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/quality"
        "?startDate=2026-04-12&endDate=2026-05-12",
        headers=_auth_header(role="warehouse_manager"),
    )
    assert r.status_code == 403, r.text


def test_quality_factory_viewer_role_strips_money(
    quality_factory_client, monkeypatch
):
    """R6 strip-wrap lock for /analysis/quality factory branch."""
    mod, client = quality_factory_client

    async def _fake_factory(factory_id, start_date, end_date, analysis_type):
        return _money_payload()

    monkeypatch.setattr(mod, "_factory_quality_dispatch", _fake_factory)

    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/quality"
        "?startDate=2026-04-12&endDate=2026-05-12",
        headers=_auth_header(role="viewer"),
    )
    assert r.status_code == 200, r.text
    _assert_money_stripped(r.json()["data"])


# ============================================================
# Module 4 — incentive_plan.py (bonus carrier — highest leak severity)
# ============================================================


@pytest.fixture
def incentive_client(monkeypatch):
    from smartbi_compat.api import incentive_plan as mod
    return mod, _build_client(mod.router, monkeypatch)


def test_incentive_warehouse_manager_denied_at_gate_returns_403(incentive_client):
    """R6 gate-change lock — incentive plan exposes 奖金/bonus amounts
    which are the highest-severity leak category (per PR #483 §3.2 row).
    """
    _mod, client = incentive_client
    r = client.get(
        "/api/mobile/F001/smart-bi/incentive-plan/salesperson/sp_alice",
        headers=_auth_header(role="warehouse_manager"),
    )
    assert r.status_code == 403, r.text


def test_incentive_viewer_role_strips_bonus_money(incentive_client, monkeypatch):
    """R6 strip-wrap lock for incentive plan.

    Generic plan return contains money carriers (currentPerformance,
    targetGoal, gapAmount, estimatedReward, potentialReward) — strip helper
    recognizes "Amount"/"reward" (via 报酬 mapping not present — relies on
    money KPI carrier semantics or key-name pattern).

    Test asserts the more reliable money-key-name path on the generic
    payload — the helper recognizes "Amount" / "revenue" / "salary" /
    "wage" patterns. Real incentive plan keys (estimatedReward etc.)
    may or may not be caught by current helper; this test uses the
    helper's documented contract surface.
    """
    mod, client = incentive_client

    async def _fake_salesperson(factory_id, salesperson_id, range_):
        return _money_payload()

    monkeypatch.setattr(mod, "_generate_salesperson_plan", _fake_salesperson)

    r = client.get(
        "/api/mobile/F001/smart-bi/incentive-plan/salesperson/sp_alice",
        headers=_auth_header(role="viewer"),
    )
    assert r.status_code == 200, r.text
    _assert_money_stripped(r.json()["data"])


# ============================================================
# Module 5 — analysis.py (4 legacy routes)
# ============================================================


@pytest.fixture
def analysis_legacy_client(monkeypatch):
    from smartbi_compat.api import analysis as mod
    return mod, _build_client(mod.router, monkeypatch)


def test_query_templates_warehouse_manager_denied_at_gate_returns_403(
    analysis_legacy_client,
):
    """R6 gate-change lock for /query-templates legacy route."""
    _mod, client = analysis_legacy_client
    r = client.get(
        "/api/mobile/F001/smart-bi/query-templates",
        headers=_auth_header(role="warehouse_manager"),
    )
    assert r.status_code == 403, r.text


def test_datasource_list_warehouse_manager_denied_at_gate_returns_403(
    analysis_legacy_client,
):
    """R6 gate-change lock for /datasource/list legacy route."""
    _mod, client = analysis_legacy_client
    r = client.get(
        "/api/mobile/F001/smart-bi/datasource/list",
        headers=_auth_header(role="warehouse_manager"),
    )
    assert r.status_code == 403, r.text


def test_alerts_warehouse_manager_denied_at_gate_returns_403(
    analysis_legacy_client,
):
    """R6 gate-change lock for /alerts legacy route."""
    _mod, client = analysis_legacy_client
    r = client.get(
        "/api/mobile/F001/smart-bi/alerts",
        headers=_auth_header(role="warehouse_manager"),
    )
    assert r.status_code == 403, r.text


def test_recommendations_warehouse_manager_denied_at_gate_returns_403(
    analysis_legacy_client,
):
    """R6 gate-change lock for /recommendations legacy route."""
    _mod, client = analysis_legacy_client
    r = client.get(
        "/api/mobile/F001/smart-bi/recommendations",
        headers=_auth_header(role="warehouse_manager"),
    )
    assert r.status_code == 403, r.text


def test_alerts_viewer_role_strips_money_in_alert_list(
    analysis_legacy_client, monkeypatch
):
    """R6 strip-wrap lock for /alerts — alerts may contain money carriers
    (e.g. revenue spike alerts with amount fields).
    """
    mod, client = analysis_legacy_client

    def _fake(factory_id, range_):
        return [
            {
                "metricCode": "REVENUE_DROP",
                "title": "营收下滑警告",
                "value": 500000.0,
                "unit": "元",
                "severity": "HIGH",
                "totalRevenue": 1000000.0,
            }
        ]

    monkeypatch.setattr(mod, "_generate_all_alerts", _fake)

    r = client.get(
        "/api/mobile/F001/smart-bi/alerts",
        headers=_auth_header(role="viewer"),
    )
    assert r.status_code == 200, r.text
    alerts = r.json()["data"]
    assert alerts[0]["value"] is None, "KPI card via unit=元 stripped"
    assert alerts[0]["totalRevenue"] is None, "money-key leaf stripped"
    assert alerts[0]["severity"] == "HIGH", "non-money preserved"
    assert alerts[0]["metricCode"] == "REVENUE_DROP", "non-money preserved"


def test_recommendations_viewer_role_strips_money_in_rec_list(
    analysis_legacy_client, monkeypatch
):
    """R6 strip-wrap lock for /recommendations — recommendations may contain
    money carriers (e.g. cost-saving recs with savingAmount).
    """
    mod, client = analysis_legacy_client

    def _fake(factory_id, range_, analysis_type):
        return [
            {
                "id": "rec-1",
                "title": "降本建议",
                "priority": 1,
                "totalCost": 250000.0,
                "potentialRevenue": 50000.0,
            }
        ]

    monkeypatch.setattr(mod, "_generate_recommendations", _fake)

    r = client.get(
        "/api/mobile/F001/smart-bi/recommendations",
        headers=_auth_header(role="viewer"),
    )
    assert r.status_code == 200, r.text
    recs = r.json()["data"]
    # totalCost — pattern "cost" matches IGNORECASE
    assert recs[0]["totalCost"] is None, "money-key 'cost' substring stripped"
    # potentialRevenue — pattern "revenue" matches
    assert recs[0]["potentialRevenue"] is None, "money-key 'revenue' substring stripped"
    assert recs[0]["priority"] == 1, "non-money preserved"
    assert recs[0]["id"] == "rec-1", "non-money preserved"
