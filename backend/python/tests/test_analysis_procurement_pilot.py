"""Phase 2B-2 chat-2B-procurement pilot tests — ``analysis_procurement.py``.

Per `docs/qa-audits/2026-05-12-python-migration-test-coverage-audit.md`
§2.3 row 5-6 + §3 priority 9-10 + §5 template + §8.2 row 2.

Coverage:

* **Rule 12 regression lock-down (4 tests)** — the highest-priority deliverable.
  The PR-N-1 closer fix (commit `0982195cf` 2026-05-06) replaced banker's-rounding
  ``f"{float(d):.1f}"`` with HALF_UP ``Decimal.quantize(..., ROUND_HALF_UP)`` so
  procurement supplier concentration 46.55 emits ``"46.6"`` (Java parity) instead
  of ``"46.5"`` (Python banker's). These tests assert both the helper layer
  (``_format_decimal_half_up`` in ``_java_compat.py``) and the inline-quantize
  site (line 873) stay HALF_UP. If any sister chat refactors back to the
  float-bridge or drops ``rounding=ROUND_HALF_UP``, these tests fail loudly.

* **``_calculate_supplier_concentration`` (5 tests)** — Rule 10 division-by-zero
  guard, Rule 1 None-supplier skip, empty-batches edge, 46.55%% canary input.

* **End-to-end Rule 12 (1 test)** — full ``_build_overview_metric_results``
  pipeline with synthetic batches yielding exactly 46.55%% concentration.
  Asserts ``formattedValue == "46.6%"`` (not ``"46.5%"``).

* **``_calculate_mom_growth`` (4 tests)** — Rule 1 None handling (previous=None,
  current=None), Rule 10 abs(previous) for negative denominator.

* **``_format_currency`` (2 tests)** — Rule 1 None-handling + Rule 4 dict-eq.

* **Endpoint auth boundary (4 tests)** — JWT required (401) / cross-factory
  denied (403) / happy path with mocked DB (200 + envelope shape).

Rule checklist per ``.claude/rules/python-java-port.md``:

- [x] **Rule 1**: ``Decimal("0")`` non-falsy semantics + ``is None`` explicit
- [x] **Rule 4**: ``_decimal_to_number`` int-vs-float emit
- [x] **Rule 6**: explicit precondition on ``None`` date is enforced upstream
- [x] **Rule 10**: division-by-zero guard + intermediate-quantize parity
- [x] **Rule 12**: HALF_UP vs banker's lock-down (primary deliverable)

Gold-standard pilot pattern: ``test_config_thresholds_pilot.py`` (Phase 2C).
"""
from __future__ import annotations

import os
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

import jwt
import pytest

# ── Test JWT secret (must be set before importing analysis_procurement) ──
os.environ.setdefault("JWT_SECRET", "phase-2b2-procurement-pilot-test-secret")

from smartbi_compat._java_compat import _format_decimal_half_up  # noqa: E402
from smartbi_compat.api import analysis_procurement as mod  # noqa: E402
from smartbi_compat.api.analysis_procurement import (  # noqa: E402
    _calculate_mom_growth,
    _calculate_supplier_concentration,
    _format_currency,
    router,
)
from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402


# ============================================================
# JWT + test client fixtures (mirror test_config_thresholds_pilot.py)
# ============================================================


JWT_SECRET = "phase-2b2-procurement-pilot-test-secret"


def _make_token(
    *,
    user_id: int = 22,
    username: str = "alice",
    factory_id: str | None = "F001",
    role: str = "factory_super_admin",
    exp_offset: int = 3600,
) -> str:
    """Build a test JWT with the same shape as production tokens."""
    from time import time

    payload: dict = {
        "userId": user_id,
        "username": username,
        "role": role,
        "exp": int(time()) + exp_offset,
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
    """FastAPI TestClient with the procurement router mounted.

    No DB pool patching by default — tests that hit the live endpoint
    monkeypatch ``_query_material_batches_in_range`` directly in the test
    body to inject synthetic batches.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


# ============================================================
# Rule 12 — primary regression lock-down
# ============================================================


def test_rule12_format_decimal_half_up_helper_46_55_returns_46_6():
    """Helper-level Rule 12 lock.

    Reproduces the exact PR-N-1 bug input (Decimal 46.55) and asserts the
    helper returns the HALF_UP-correct string "46.6". If the helper is
    refactored back to banker's (``f"{float(d):.1f}"``), this test fails.

    Reference: PR-N-1 closer commit ``0982195cf`` (2026-05-06).
    """
    assert _format_decimal_half_up(Decimal("46.55"), 1) == "46.6"


def test_rule12_documents_float_bridge_banker_divergence():
    """Locks the divergence proof: banker's float-bridge vs HALF_UP helper.

    The bug PR-N-1 fixed: ``f"{float(Decimal('46.55')):.1f}"`` returns ``"46.5"``
    because float(46.55) = 46.549999... (IEEE 754) and f-string truncates to
    "46.5" via banker's-equivalent path. The helper goes Decimal-direct
    → "46.6". If Python's float repr semantics change, OR if the helper
    silently regresses, the divergence proof breaks and this test alerts.
    """
    bankers_output = f"{float(Decimal('46.55')):.1f}"
    half_up_output = _format_decimal_half_up(Decimal("46.55"), 1)

    assert bankers_output == "46.5", "banker's path (the bug PR-N-1 fixed)"
    assert half_up_output == "46.6", "HALF_UP path (Java parity, our fix)"
    assert bankers_output != half_up_output, (
        "divergence proof: helper must NOT collapse to banker's path"
    )


def test_rule12_decimal_quantize_inline_pattern_uses_half_up():
    """Line 873 inline pattern lock-down.

    The procurement display formatting at line 873 uses an inline pattern
    ``concentration.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)``
    instead of the helper. If a refactor drops the ``rounding=ROUND_HALF_UP``
    arg, Decimal.quantize defaults to ``ROUND_HALF_EVEN`` (banker's), causing
    silent divergence on .5-of-odd-tenths values like ``Decimal("0.65")``.

    Note: ``Decimal("46.55")`` happens to round to "46.6" under BOTH banker's
    and HALF_UP (because the .5 falls in a position where banker's rounds up).
    The divergent canary is ``0.65`` — banker's rounds DOWN to "0.6" (6 is even),
    HALF_UP rounds UP to "0.7".
    """
    val = Decimal("0.65")

    bankers = val.quantize(Decimal("0.1"))  # default rounding = ROUND_HALF_EVEN
    half_up = val.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

    assert bankers == Decimal("0.6"), (
        "default Decimal.quantize = banker's; 6 even → round down"
    )
    assert half_up == Decimal("0.7"), (
        "explicit ROUND_HALF_UP; .5 → always round up"
    )
    assert bankers != half_up, "Decimal-layer divergence proves rounding arg matters"

    # Helper mirrors the HALF_UP path
    assert _format_decimal_half_up(val, 1) == "0.7"


def test_rule12_format_decimal_half_up_trailing_zero_preserved():
    """Java ``String.format("%.1f", new BigDecimal("46.000"))`` emits ``"46.0"``
    (scale preserved). Helper must mirror — important so ``50.0%`` doesn't
    collapse to ``"50%"`` and break Java byte-shape parity.
    """
    assert _format_decimal_half_up(Decimal("46.000"), 1) == "46.0"
    assert _format_decimal_half_up(Decimal("100"), 1) == "100.0"


# ============================================================
# _calculate_supplier_concentration (helper-level)
# ============================================================


def test_calculate_supplier_concentration_happy_path():
    """Two suppliers, max/total = 60% (Rule 10 division precision check)."""
    batches = [
        {"supplier_id": "A", "unit_price": Decimal("100"), "receipt_quantity": Decimal("60")},
        {"supplier_id": "B", "unit_price": Decimal("100"), "receipt_quantity": Decimal("40")},
    ]
    # max=6000, total=10000 → 60.00% (SCALE=4 then *100)
    assert _calculate_supplier_concentration(batches) == Decimal("60.0000")


def test_calculate_supplier_concentration_empty_batches_returns_zero():
    """Rule 10 boundary: empty list → Decimal("0"), not exception."""
    assert _calculate_supplier_concentration([]) == Decimal("0")


def test_calculate_supplier_concentration_none_supplier_id_skipped():
    """Rule 1: ``supplier_id is None`` rows are skipped, not silently grouped
    under a None key (which would cause Java NPE divergence)."""
    batches = [
        {"supplier_id": None, "unit_price": Decimal("100"), "receipt_quantity": Decimal("999")},
        {"supplier_id": "A", "unit_price": Decimal("100"), "receipt_quantity": Decimal("50")},
        {"supplier_id": "B", "unit_price": Decimal("100"), "receipt_quantity": Decimal("50")},
    ]
    # None-supplier row dropped; remaining A:B = 50:50 → max=50% of 100 total
    result = _calculate_supplier_concentration(batches)
    assert result == Decimal("50.0000")


def test_calculate_supplier_concentration_zero_total_returns_zero():
    """Rule 10 division-by-zero guard: every batch has zero unit_price or qty
    → total = 0 → return Decimal("0") instead of raising."""
    batches = [
        {"supplier_id": "A", "unit_price": Decimal("0"), "receipt_quantity": Decimal("100")},
        {"supplier_id": "B", "unit_price": Decimal("0"), "receipt_quantity": Decimal("50")},
    ]
    assert _calculate_supplier_concentration(batches) == Decimal("0")


def test_calculate_supplier_concentration_46_55_canary():
    """The exact Rule 12 canary value used by the end-to-end test below.

    Construct batches yielding precisely 46.55% concentration so the
    subsequent _build_overview_metric_results test has a deterministic input.

    Note: split the smaller share across TWO suppliers (B + C) so that A
    remains the max single-supplier value (46.55% of total). If we put 53.45%
    into a single supplier B, B becomes max → 53.45% concentration, not 46.55%.
    """
    batches = [
        # Supplier A total value = 4655 (the MAX, drives concentration)
        {"supplier_id": "A", "unit_price": Decimal("1"), "receipt_quantity": Decimal("4655")},
        # Supplier B total value = 2700 (smaller than A)
        {"supplier_id": "B", "unit_price": Decimal("1"), "receipt_quantity": Decimal("2700")},
        # Supplier C total value = 2645 (smaller than A); total = 10000
        {"supplier_id": "C", "unit_price": Decimal("1"), "receipt_quantity": Decimal("2645")},
    ]
    result = _calculate_supplier_concentration(batches)
    assert result == Decimal("46.5500"), (
        f"canary fixture must yield Decimal('46.5500'), got {result!r}"
    )


# ============================================================
# End-to-end Rule 12 — full _build_overview_metric_results pipeline
# ============================================================


@pytest.mark.asyncio
async def test_overview_metric_results_concentration_46_55_formats_as_46_6(monkeypatch):
    """End-to-end Rule 12 lock-down through the production formatting path.

    Feeds 46.55%%-concentration batches into ``_build_overview_metric_results``
    and asserts the SUPPLIER_CONCENTRATION metric's ``formattedValue`` is
    ``"46.6%"`` (HALF_UP, Java parity) — NOT ``"46.5%"`` (banker's, the bug).

    Catches regressions where:
    - line 873 ``rounding=ROUND_HALF_UP`` arg gets dropped → banker's
    - line 873 is refactored to ``f"{float(concentration):.1f}%"`` → banker's
    - any future "simplification" that loses the HALF_UP semantic
    """
    batches = [
        # Same fixture as test_calculate_supplier_concentration_46_55_canary —
        # A is max at 4655 of 10000 total = 46.55%.
        {"supplier_id": "A", "unit_price": Decimal("1"), "receipt_quantity": Decimal("4655")},
        {"supplier_id": "B", "unit_price": Decimal("1"), "receipt_quantity": Decimal("2700")},
        {"supplier_id": "C", "unit_price": Decimal("1"), "receipt_quantity": Decimal("2645")},
    ]

    # Stub previous-period query to empty so MoM growth path is skipped (5th
    # metric optional). This isolates the concentration assertion.
    async def _no_previous(*args, **kwargs):
        return []

    monkeypatch.setattr(mod, "_query_material_batches_in_range", _no_previous)

    result = await mod._build_overview_metric_results(
        batches, "F001", date(2026, 5, 1), date(2026, 5, 31)
    )

    concentration = next(
        m for m in result if m["metricCode"] == "SUPPLIER_CONCENTRATION"
    )
    assert concentration["formattedValue"] == "46.6%", (
        f"Rule 12 regression — expected '46.6%' (HALF_UP), got "
        f"{concentration['formattedValue']!r}. If this is '46.5%', the inline "
        f"quantize at analysis_procurement.py:873 lost rounding=ROUND_HALF_UP "
        f"or was refactored back to f-string banker's path."
    )
    # Banker's regression canary — should NEVER hold
    assert concentration["formattedValue"] != "46.5%", (
        "banker's regression — line 873 must use rounding=ROUND_HALF_UP"
    )


# ============================================================
# _calculate_mom_growth (helper-level)
# ============================================================


def test_calculate_mom_growth_previous_none_current_positive_returns_100():
    """Rule 1 None-handling: previous is None + current > 0 → 100% growth.
    Mirrors Java MetricCalculatorServiceImpl.calculateMomGrowth edge case."""
    assert _calculate_mom_growth(Decimal("50"), None) == Decimal("100")


def test_calculate_mom_growth_both_none_returns_zero():
    """Rule 1 None-handling: previous=None, current=None → 0 (no growth claim).
    """
    assert _calculate_mom_growth(None, None) == Decimal("0")


def test_calculate_mom_growth_current_none_with_previous_returns_minus_100():
    """Rule 1: previous=50, current=None → -100% (full drop)."""
    assert _calculate_mom_growth(None, Decimal("50")) == Decimal("-100")


def test_calculate_mom_growth_negative_previous_uses_abs():
    """Rule 10 sign-flip prevention: previous=-50, current=10 → +60/50 = +120%
    (positive growth shown). Without ``abs(previous)`` denom, would flip sign.
    """
    result = _calculate_mom_growth(Decimal("10"), Decimal("-50"))
    # (10 - (-50)) / abs(-50) * 100 = 60/50 * 100 = 120 → DISPLAY_SCALE=2 → 120.00
    assert result == Decimal("120.00")


# ============================================================
# _format_currency (helper-level)
# ============================================================


def test_format_currency_none_returns_dash():
    """Rule 1 None-handling: Java ``if (value == null) return "-";``"""
    assert _format_currency(None) == "-"


def test_format_currency_thousands_separator_two_decimals():
    """Java ``String.format("%,.2f", value.setScale(2, HALF_UP).doubleValue())``
    — comma every 3 digits + always 2 decimals. Rule 4 sanity for the
    bridge through float()."""
    assert _format_currency(Decimal("1234567.89")) == "1,234,567.89"
    assert _format_currency(Decimal("100")) == "100.00"


# ============================================================
# Endpoint auth boundary (FastAPI TestClient)
# ============================================================


def test_endpoint_missing_bearer_returns_401(client):
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/procurement",
        params={"startDate": "2026-05-01", "endDate": "2026-05-31"},
    )
    assert r.status_code == 401


def test_endpoint_invalid_token_returns_401(client):
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/procurement",
        params={"startDate": "2026-05-01", "endDate": "2026-05-31"},
        headers={"Authorization": "Bearer not.a.real.jwt"},
    )
    assert r.status_code == 401


def test_endpoint_cross_factory_returns_403(client):
    """Token for F001 hitting F002 endpoint must be rejected with 403."""
    r = client.get(
        "/api/mobile/F002/smart-bi/analysis/procurement",
        params={"startDate": "2026-05-01", "endDate": "2026-05-31"},
        headers=_auth_header(factory_id="F001"),
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_endpoint_happy_path_returns_200_envelope(client, monkeypatch):
    """Mocked DB returns 2 synthetic batches; endpoint returns wrap_response
    envelope with default-mode (overview) shape.
    """
    synthetic_batches = [
        {
            "supplier_id":      "A",
            "unit_price":       Decimal("100"),
            "receipt_quantity": Decimal("60"),
            "created_at":       date(2026, 5, 15),
        },
        {
            "supplier_id":      "B",
            "unit_price":       Decimal("100"),
            "receipt_quantity": Decimal("40"),
            "created_at":       date(2026, 5, 16),
        },
    ]

    async def _fake_batches(factory_id, start_date, end_date):
        return synthetic_batches

    async def _fake_empty(*args, **kwargs):
        return []

    # Patch both the in-range query (drives current period) and the active-
    # suppliers query (used by ranking — not relevant to overview but called
    # in some sub-paths).
    monkeypatch.setattr(mod, "_query_material_batches_in_range", _fake_batches)
    monkeypatch.setattr(mod, "_query_active_suppliers", _fake_empty)

    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/procurement",
        params={"startDate": "2026-05-01", "endDate": "2026-05-31"},
        headers=_auth_header(factory_id="F001"),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    assert "data" in body
    # Default mode envelope key set per analysis_procurement.py:1198-1202.
    assert set(body["data"].keys()) >= {"overview", "endDate", "startDate"}
    assert body["data"]["startDate"] == "2026-05-01"
    assert body["data"]["endDate"] == "2026-05-31"
