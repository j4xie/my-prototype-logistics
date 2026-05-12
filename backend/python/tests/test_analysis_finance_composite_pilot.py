"""Phase 2B-2 chat-2B-finance pilot tests — ``analysis_finance.py`` composite.

Per ``docs/qa-audits/2026-05-12-python-migration-test-coverage-audit.md`` §8.2
row 1 ("chat-2B-finance"). Backfills tests for the Phase 2A SmartBI Python
port of ``/api/mobile/{factoryId}/smart-bi/analysis/finance`` composite endpoint
plus two Rule-10-critical helpers.

Coverage:

* **Site 1 — ``get_finance_analysis`` route dispatcher** (line 3282):
  6-branch dispatch (empty / payable / profit / cost / budget / receivable),
  501 envelope for unknown ``analysisType``, 422 validation, plus auth
  boundary (401 missing / 401 expired / 403 cross-factory).

* **Site 2 — ``_safe_growth_rate`` Rule 10 lockdown** (line 559, 29 LOC):
  Java ``BigDecimal.divide(scale=4, HALF_UP).multiply(100)`` parity. Pinning
  test ``(1, 3) → Decimal("-66.6700")`` exposes any drift back to the
  ``(n/d*K).quantize(scale)`` antipattern (which yields ``-66.6667``).

* **Site 3 — ``_calculate_month_yoy_mom`` year-boundary + Rule 10**
  (line 721, 32 LOC): mid-year happy path, January-wraps-to-December,
  zero values, division-by-zero propagation, result shape.

Rule checklist per ``.claude/rules/python-java-port.md``:

- [x] **Rule 2**: year-boundary correctness (January wraps to (year-1, 12),
      NOT (year, 0) — same bug family as ISO-vs-calendar year wrap)
- [x] **Rule 4**: ``_decimal_to_number`` int-vs-float emit (Pattern A
      int-collapse: ``Decimal("100.00")`` → ``int(100)``, not float ``100.00``)
- [x] **Rule 10**: BigDecimal divide-then-multiply intermediate quantize
      at scale 4 (PRIMARY deliverable — ``_safe_growth_rate`` is the
      canonical example of the rule)

Gold-standard pilot pattern: ``test_analysis_inventory_pilot.py`` (PR #411).
"""
from __future__ import annotations

import os
from decimal import Decimal

import jwt
import pytest

# Must be set before importing analysis_finance so verify_jwt_and_factory
# (called at request time via _get_secret()) can find the secret.
os.environ.setdefault("JWT_SECRET", "phase-2b2-finance-composite-pilot-test-secret")

from smartbi_compat.api import analysis_finance as mod  # noqa: E402
from smartbi_compat.api.analysis_finance import (  # noqa: E402
    _calculate_month_yoy_mom,
    _safe_growth_rate,
    router,
)
from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402


# ============================================================
# Fixtures — JWT, TestClient
# ============================================================


JWT_SECRET = "phase-2b2-finance-composite-pilot-test-secret"


def _make_token(
    *,
    user_id: int = 22,
    username: str = "alice",
    factory_id: str | None = "F001",
    role: str = "factory_super_admin",
    exp_offset: int = 3600,
) -> str:
    """Build a test JWT mirroring production token shape."""
    from time import time as _time

    payload: dict = {
        "userId": user_id,
        "username": username,
        "role": role,
        "exp": int(_time()) + exp_offset,
    }
    if factory_id is not None:
        payload["factoryId"] = factory_id
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _auth_header(token: str | None = None, **token_kwargs) -> dict:
    if token is None:
        token = _make_token(**token_kwargs)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


_FINANCE_PATH = "/api/mobile/F001/smart-bi/analysis/finance"
_DEFAULT_QS = {"startDate": "2026-05-01", "endDate": "2026-05-31"}


# ============================================================
# Section 1 — _safe_growth_rate (Rule 10 lockdown)
# Java: BigDecimal.divide(divisor, 4, HALF_UP).multiply(BigDecimal.valueOf(100))
# Python MUST mirror divide-then-quantize-then-multiply (NOT (n/d*K).quantize).
# ============================================================


def test_safe_growth_rate_rule10_intermediate_quantize_scale_4():
    """Rule 10 canonical pin: (1, 3) → -66.6700 (NOT -66.6667).

    Java ``BigDecimal.ONE.subtract(THREE).divide(THREE, 4, HALF_UP).multiply(100)``:
      = ((1 - 3) / 3).quantize(scale=4, HALF_UP) * 100
      = Decimal("-0.6667") * 100
      = Decimal("-66.6700")

    The antipattern ``(n/d*K).quantize(scale=4)`` instead yields
    Decimal("-66.6667") — collapses the intermediate-quantize step and
    introduces +0.0003 drift per call. Any regression to that form trips
    this assertion.
    """
    result = _safe_growth_rate(Decimal("1"), Decimal("3"))
    assert result == Decimal("-66.6700")


def test_safe_growth_rate_positive_growth_exact_scale_4():
    """Positive growth (110 vs 100) → exact Decimal("10.0000")."""
    result = _safe_growth_rate(Decimal("110"), Decimal("100"))
    assert result == Decimal("10.0000")


def test_safe_growth_rate_46_55_boundary():
    """46.55%% canary (mirrors Rule 12 procurement supplier-concentration case).

    (146.55 - 100) / 100 = 0.4655 (exact) → quantize(scale=4) → 0.4655
    * 100 → Decimal("46.5500").
    """
    result = _safe_growth_rate(Decimal("146.55"), Decimal("100"))
    assert result == Decimal("46.5500")


def test_safe_growth_rate_zero_base_returns_zero():
    """base == 0 → return Decimal("0") (division-by-zero guard at line 580)."""
    assert _safe_growth_rate(Decimal("100"), Decimal("0")) == Decimal("0")


def test_safe_growth_rate_zero_base_with_explicit_scale_returns_zero():
    """Decimal("0.00") still NOT > 0 → returns Decimal("0")."""
    assert _safe_growth_rate(Decimal("100"), Decimal("0.00")) == Decimal("0")


def test_safe_growth_rate_negative_base_returns_zero():
    """Negative base NOT > 0 per ``if base > Decimal("0")`` → returns Decimal("0").

    Java mirror: line 1839-1850 guards on ``base.compareTo(BigDecimal.ZERO) > 0``.
    """
    assert _safe_growth_rate(Decimal("100"), Decimal("-50")) == Decimal("0")


def test_safe_growth_rate_result_scale_locked_at_minus_4():
    """Lockdown: result Decimal exponent == -4.

    Intermediate quantize at scale 4 produces ``Decimal("-0.6667")``;
    multiply by exact ``Decimal("100")`` (scale 0) yields ``Decimal("-66.6700")``
    with exponent ``-4`` (scale carries through Decimal arithmetic).

    If the impl refactors to (n/d*K).quantize(scale=2), this exponent
    flips to -2 — test fails loudly.
    """
    result = _safe_growth_rate(Decimal("1"), Decimal("3"))
    assert result.as_tuple().exponent == -4


# ============================================================
# Section 2 — _calculate_month_yoy_mom (year-boundary + Rule 10)
# Java: FinanceAnalysisServiceImpl.calculateMonthYoYMoM (line 1825-1864).
# Monkeypatch _get_metric_value_for_period to isolate arithmetic from DB.
# ============================================================


async def test_calculate_month_yoy_mom_mid_year_happy_path(monkeypatch):
    """period='2026-05' → calls (2026,5), (2025,5), (2026,4).

    Asserts call args + 8-key result + numeric Pattern A int-collapse
    (Decimal("100.00") → int(100), Rule 4).
    """
    call_args: list[tuple] = []

    async def fake_get_metric(factory_id, year_month, metric):
        call_args.append((factory_id, year_month, metric))
        # Return distinct values keyed by year_month for assertion clarity
        return {
            (2026, 5): Decimal("100"),  # currentValue
            (2025, 5): Decimal("80"),   # lastYearValue
            (2026, 4): Decimal("90"),   # lastPeriodValue
        }[year_month]

    monkeypatch.setattr(mod, "_get_metric_value_for_period", fake_get_metric)

    result = await _calculate_month_yoy_mom("F001", "2026-05", "revenue")

    # Verify the 3 call args (current / last_year / last_period)
    assert call_args == [
        ("F001", (2026, 5), "revenue"),
        ("F001", (2025, 5), "revenue"),
        ("F001", (2026, 4), "revenue"),
    ]

    # Verify result shape: list of 1 dict with 8 keys
    assert isinstance(result, list)
    assert len(result) == 1
    point = result[0]

    # Rule 4 Pattern A: Decimal("100.00") → int(100), Decimal("80.00") → int(80).
    # (100-80)/80 = 0.25 → quantize(scale=4) → 0.2500 * 100 = 25.0000 → int(25)
    # (100-90)/90 = 0.1111... → quantize(scale=4) → 0.1111 * 100 = 11.1100
    #   → quantize(0.01) → 11.11 (Pattern A2 trailing-zero loss) → float(11.11)
    assert point["period"] == "2026-05"
    assert point["currentValue"] == 100
    assert point["lastYearValue"] == 80
    assert point["lastPeriodValue"] == 90
    assert point["yoyGrowthRate"] == 25
    assert point["momGrowthRate"] == 11.11
    assert point["yoyChange"] == 20
    assert point["momChange"] == 10


async def test_calculate_month_yoy_mom_january_wraps_to_previous_december(monkeypatch):
    """Rule 2 family (year-boundary): period='2026-01' must wrap last_period to
    (2025, 12), NOT (2026, 0). Captures call args to verify wrap semantics."""
    call_args: list[tuple] = []

    async def fake_get_metric(factory_id, year_month, metric):
        call_args.append((factory_id, year_month, metric))
        return Decimal("100")

    monkeypatch.setattr(mod, "_get_metric_value_for_period", fake_get_metric)

    await _calculate_month_yoy_mom("F001", "2026-01", "revenue")

    # Expected order: current (2026,1) → last_year (2025,1) → last_period (2025,12)
    assert call_args == [
        ("F001", (2026, 1), "revenue"),
        ("F001", (2025, 1), "revenue"),
        ("F001", (2025, 12), "revenue"),  # wraps, NOT (2026, 0)
    ]


async def test_calculate_month_yoy_mom_december_no_wrap(monkeypatch):
    """period='2024-12' → last_year=(2023,12), last_period=(2024,11).

    Non-January path takes ``(year, month - 1)`` branch — December stays
    in the same year. Confirms Rule 2 family year-boundary handling does
    not over-wrap.
    """
    call_args: list[tuple] = []

    async def fake_get_metric(factory_id, year_month, metric):
        call_args.append((factory_id, year_month, metric))
        return Decimal("100")

    monkeypatch.setattr(mod, "_get_metric_value_for_period", fake_get_metric)

    await _calculate_month_yoy_mom("F001", "2024-12", "revenue")

    assert call_args == [
        ("F001", (2024, 12), "revenue"),
        ("F001", (2023, 12), "revenue"),
        ("F001", (2024, 11), "revenue"),
    ]


async def test_calculate_month_yoy_mom_zero_current_yields_minus_100_growth(monkeypatch):
    """current=0, lastYear=lastMonth=100 → growth rate -100%% in both directions."""

    async def fake_get_metric(factory_id, year_month, metric):
        if year_month == (2026, 5):
            return Decimal("0")
        return Decimal("100")

    monkeypatch.setattr(mod, "_get_metric_value_for_period", fake_get_metric)

    point = (await _calculate_month_yoy_mom("F001", "2026-05", "revenue"))[0]

    # (0 - 100)/100 = -1.0000 * 100 = -100.0000 → quantize(0.01) → -100.00 → int(-100)
    assert point["yoyGrowthRate"] == -100
    assert point["momGrowthRate"] == -100
    assert point["yoyChange"] == -100
    assert point["momChange"] == -100


async def test_calculate_month_yoy_mom_zero_base_division_guard(monkeypatch):
    """current=50, lastYear=lastMonth=0 → _safe_growth_rate returns 0 (guard).

    Rule 10 zero-base guard at line 580 (``if base > Decimal("0")``).
    yoyChange / momChange use plain subtract (not _safe_growth_rate) so they
    still report +50 — verifies the guard is local to growth-rate path.
    """

    async def fake_get_metric(factory_id, year_month, metric):
        if year_month == (2026, 5):
            return Decimal("50")
        return Decimal("0")

    monkeypatch.setattr(mod, "_get_metric_value_for_period", fake_get_metric)

    point = (await _calculate_month_yoy_mom("F001", "2026-05", "revenue"))[0]

    assert point["yoyGrowthRate"] == 0
    assert point["momGrowthRate"] == 0
    assert point["yoyChange"] == 50
    assert point["momChange"] == 50


async def test_calculate_month_yoy_mom_result_has_exactly_8_keys(monkeypatch):
    """Result shape lockdown: list[1] of dict with exactly 8 keys, no extras."""

    async def fake_get_metric(factory_id, year_month, metric):
        return Decimal("100")

    monkeypatch.setattr(mod, "_get_metric_value_for_period", fake_get_metric)

    result = await _calculate_month_yoy_mom("F001", "2026-05", "revenue")

    assert isinstance(result, list)
    assert len(result) == 1
    assert set(result[0].keys()) == {
        "period",
        "currentValue",
        "lastYearValue",
        "lastPeriodValue",
        "yoyGrowthRate",
        "momGrowthRate",
        "yoyChange",
        "momChange",
    }


# ============================================================
# Section 3 — Endpoint dispatcher tests (analysisType branches)
# Monkeypatch the per-type helper; verify dispatch + wrap_response envelope.
# ============================================================


def test_endpoint_empty_analysis_type_dispatches_to_composite(client, monkeypatch):
    """Empty analysisType → composite (6-key Jackson order).

    Envelope keys: overview / costStructure / dateRange / generatedAt /
    profitMetrics / receivableAging (verified F999 golden recording).
    """
    sentinel = {
        "overview":         {"period": "MONTH"},
        "costStructure":    {"chartType": "PIE"},
        "dateRange":        {"days": 30, "valid": True},
        "generatedAt":      "2026-05-01T00:00:00",
        "profitMetrics":    [],
        "receivableAging":  {"chartType": "BAR"},
    }

    async def fake_composite(factory_id, range_):
        return sentinel

    monkeypatch.setattr(mod, "_get_comprehensive_finance_analysis", fake_composite)

    response = client.get(
        _FINANCE_PATH,
        params=_DEFAULT_QS,
        headers=_auth_header(factory_id="F001"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert body["data"] == sentinel
    assert set(body["data"].keys()) == {
        "overview",
        "costStructure",
        "dateRange",
        "generatedAt",
        "profitMetrics",
        "receivableAging",
    }


def test_endpoint_analysis_type_payable_dispatches(client, monkeypatch):
    """analysisType=payable → _get_payable_analysis (4-key shape per PR #18)."""
    sentinel = {
        "endDate":    "2026-05-31",
        "startDate":  "2026-05-01",
        "metrics":    [],
        "agingChart": {"chartType": "BAR"},
    }

    async def fake_payable(factory_id, start_date, end_date):
        return sentinel

    monkeypatch.setattr(mod, "_get_payable_analysis", fake_payable)

    response = client.get(
        _FINANCE_PATH,
        params={**_DEFAULT_QS, "analysisType": "payable"},
        headers=_auth_header(factory_id="F001"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert body["data"] == sentinel


def test_endpoint_analysis_type_profit_dispatches(client, monkeypatch):
    """analysisType=profit → _get_profit_analysis (PR #21 + sales fallback)."""
    sentinel = {
        "endDate":    "2026-05-31",
        "metrics":    [],
        "trendChart": {"chartType": "LINE"},
        "startDate":  "2026-05-01",
    }

    async def fake_profit(factory_id, start_date, end_date):
        return sentinel

    monkeypatch.setattr(mod, "_get_profit_analysis", fake_profit)

    response = client.get(
        _FINANCE_PATH,
        params={**_DEFAULT_QS, "analysisType": "profit"},
        headers=_auth_header(factory_id="F001"),
    )

    assert response.status_code == 200, response.text
    assert response.json()["data"] == sentinel


def test_endpoint_analysis_type_cost_dispatches(client, monkeypatch):
    """analysisType=cost → _get_cost_analysis (PR #25 structure + trend)."""
    sentinel = {
        "endDate":        "2026-05-31",
        "trendChart":     {"chartType": "LINE"},
        "startDate":      "2026-05-01",
        "structureChart": {"chartType": "PIE"},
    }

    async def fake_cost(factory_id, start_date, end_date):
        return sentinel

    monkeypatch.setattr(mod, "_get_cost_analysis", fake_cost)

    response = client.get(
        _FINANCE_PATH,
        params={**_DEFAULT_QS, "analysisType": "cost"},
        headers=_auth_header(factory_id="F001"),
    )

    assert response.status_code == 200, response.text
    assert response.json()["data"] == sentinel


def test_endpoint_analysis_type_budget_dispatches(client, monkeypatch):
    """analysisType=budget → _get_budget_analysis (PR #38, 5-key dispatcher)."""
    sentinel = {
        "comparison": {"chartType": "BAR"},
        "endDate":    "2026-05-31",
        "waterfall":  {"chartType": "WATERFALL"},
        "metrics":    [],
        "startDate":  "2026-05-01",
    }

    async def fake_budget(factory_id, start_date, end_date):
        return sentinel

    monkeypatch.setattr(mod, "_get_budget_analysis", fake_budget)

    response = client.get(
        _FINANCE_PATH,
        params={**_DEFAULT_QS, "analysisType": "budget"},
        headers=_auth_header(factory_id="F001"),
    )

    assert response.status_code == 200, response.text
    assert response.json()["data"] == sentinel


def test_endpoint_analysis_type_receivable_dispatches(client, monkeypatch):
    """analysisType=receivable → _get_receivable_analysis (PR #42, 6-key shape)."""
    sentinel = {
        "endDate":      "2026-05-31",
        "metrics":      [],
        "topCustomers": [],
        "agingChart":   {"chartType": "BAR"},
        "startDate":    "2026-05-01",
        "trendChart":   {"chartType": "LINE"},
    }

    async def fake_receivable(factory_id, start_date, end_date):
        return sentinel

    monkeypatch.setattr(mod, "_get_receivable_analysis", fake_receivable)

    response = client.get(
        _FINANCE_PATH,
        params={**_DEFAULT_QS, "analysisType": "receivable"},
        headers=_auth_header(factory_id="F001"),
    )

    assert response.status_code == 200, response.text
    assert response.json()["data"] == sentinel


# ============================================================
# Section 4 — Unknown analysisType + Query validation
# ============================================================


def test_endpoint_unknown_analysis_type_returns_501_envelope(client):
    """analysisType=foo → HTTP 200 (wrap_response) but body.success=False,
    body.code=501, message contains '尚未 port' (impl L3327-3332).
    """
    response = client.get(
        _FINANCE_PATH,
        params={**_DEFAULT_QS, "analysisType": "foo"},
        headers=_auth_header(factory_id="F001"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["code"] == 501
    assert "尚未 port" in body["message"]


def test_endpoint_missing_start_date_returns_422(client):
    """startDate is Query(...) required → FastAPI 422."""
    response = client.get(
        _FINANCE_PATH,
        params={"endDate": "2026-05-31"},
        headers=_auth_header(factory_id="F001"),
    )
    assert response.status_code == 422


def test_endpoint_missing_end_date_returns_422(client):
    """endDate is Query(...) required → FastAPI 422."""
    response = client.get(
        _FINANCE_PATH,
        params={"startDate": "2026-05-01"},
        headers=_auth_header(factory_id="F001"),
    )
    assert response.status_code == 422


def test_endpoint_invalid_date_format_returns_422(client):
    """startDate=not-a-date → Pydantic rejects before handler → 422."""
    response = client.get(
        _FINANCE_PATH,
        params={"startDate": "not-a-date", "endDate": "2026-05-31"},
        headers=_auth_header(factory_id="F001"),
    )
    assert response.status_code == 422


# ============================================================
# Section 5 — Auth boundary (verify_jwt_and_factory)
# 401 missing / 401 invalid / 401 expired / 403 cross-factory
# ============================================================


def test_endpoint_missing_bearer_returns_401(client):
    """No Authorization header → 401."""
    response = client.get(_FINANCE_PATH, params=_DEFAULT_QS)
    assert response.status_code == 401


def test_endpoint_invalid_token_returns_401(client):
    """Bearer garbage → InvalidTokenError → 401."""
    response = client.get(
        _FINANCE_PATH,
        params=_DEFAULT_QS,
        headers={"Authorization": "Bearer garbage.token.value"},
    )
    assert response.status_code == 401


def test_endpoint_expired_token_returns_401(client):
    """Expired JWT → ExpiredSignatureError → 401."""
    expired = _make_token(exp_offset=-3600)
    response = client.get(
        _FINANCE_PATH,
        params=_DEFAULT_QS,
        headers=_auth_header(expired),
    )
    assert response.status_code == 401


def test_endpoint_cross_factory_token_returns_403(client):
    """Token factoryId=F999 but URL factory_id=F001 → 403."""
    response = client.get(
        _FINANCE_PATH,
        params=_DEFAULT_QS,
        headers=_auth_header(factory_id="F999", role="factory_super_admin"),
    )
    assert response.status_code == 403
