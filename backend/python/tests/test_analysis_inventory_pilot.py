"""Phase 2B-1 inventory analysis pilot tests — Tier 1 critical (food safety).

Backfill for the Python port of /api/mobile/{factoryId}/smart-bi/analysis/inventory
plus 5 of its key sub-services (turnover / expiry-risk / aging / 4 alert-level
helpers). Pattern mirrors ``test_config_thresholds_pilot.py`` (gold standard).

Audit source: docs/qa-audits/2026-05-12-python-migration-test-coverage-audit.md §8.1
Rule checklist (per .claude/rules/python-java-port.md):
* Rule 1 — Decimal("0") not falsy: ``total_cost`` iteration in turnover analysis
* Rule 4 — _decimal_to_number int-collapse Pattern A (Decimal("100.00") → int(100))
* Rule 6 — None date / None factory_id raises ValueError (not silent zero-result)
* Rule 7 — Threshold edge: turnover 6/12, inventory_days 30/60, expiry_risk 10/15,
  loss_rate 2/5 (strict-`>` vs `<` direction)
* Rule 9 — MetricResult Lombok @Data emits all 11 keys including nulls

Coverage scope:
* GET /api/mobile/{factory_id}/smart-bi/analysis/inventory dispatcher
* 5 helpers — _get_turnover_analysis / _get_expiry_risk_analysis / _get_aging_metrics
  + 4 alert-level functions (_determine_turnover|inventory_days|expiry_risk|loss_rate)
* _metric_result_of envelope shape
* Auth (verify_jwt_and_factory) — 401 / 403 boundaries
"""
from __future__ import annotations

import os
from datetime import date, datetime, time
from decimal import Decimal

import jwt
import pytest

# Must be set before importing analysis_inventory so verify_jwt_and_factory
# (called at request time) can find the secret.
os.environ.setdefault("JWT_SECRET", "phase-2b1-inventory-pilot-test-secret")

from smartbi_compat.api import analysis_inventory as mod  # noqa: E402
from smartbi_compat.api.analysis_inventory import (  # noqa: E402
    _determine_turnover_alert_level,
    _determine_inventory_days_alert_level,
    _determine_expiry_risk_alert_level,
    _determine_loss_rate_alert_level,
    _get_turnover_analysis,
    _get_expiry_risk_analysis,
    _get_aging_metrics,
    _metric_result_of,
    _query_material_consumptions_in_range,
    _query_material_batches_by_status,
    router,
)
from smartbi_compat.api.analysis_finance import _decimal_to_number  # noqa: E402
from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402

# Phase 2B endpoint coverage marker (see conftest.py KNOWN_ENDPOINTS).
pytestmark = [pytest.mark.api_endpoint("analysis_inventory")]


# ============================================================
# Fixtures — JWT, TestClient, mock row helpers
# ============================================================


JWT_SECRET = "phase-2b1-inventory-pilot-test-secret"


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


def _make_batch(**overrides) -> dict:
    """Mimic a material_batches row (post-alias: inbound_date AS receipt_date)."""
    base = {
        "id": "batch-uuid-001",
        "factory_id": "F001",
        "batch_number": "B-001",
        "status": "AVAILABLE",
        "receipt_quantity": Decimal("100"),
        "used_quantity": Decimal("0"),
        "reserved_quantity": Decimal("0"),
        "current_quantity": Decimal("100"),
        "unit_price": Decimal("50"),
        "receipt_date": date(2026, 4, 1),  # alias from inbound_date
        "expire_date": date(2026, 6, 1),
        "deleted_at": None,
    }
    base.update(overrides)
    return base


def _make_consumption(**overrides) -> dict:
    base = {
        "id": "cons-uuid-001",
        "factory_id": "F001",
        "consumption_time": datetime(2026, 5, 1, 10, 0, 0),
        "total_cost": Decimal("1000"),
    }
    base.update(overrides)
    return base


_INV_PATH = "/api/mobile/F001/smart-bi/analysis/inventory"
_DEFAULT_QS = {"startDate": "2026-05-01", "endDate": "2026-05-31"}


# ============================================================
# Section 1 — Alert-level helper tests (synchronous, direct)
# Covers Rule 7 thresholds for 4 alert functions: turnover (regular dir),
# inventory_days (inverse), expiry_risk (inverse strict), loss_rate (inverse strict)
# ============================================================


def test_determine_turnover_alert_level_green():
    """Turnover rate >= 12 → GREEN (regular dir, Java `< _TURNOVER_YELLOW` strict)."""
    assert _determine_turnover_alert_level(Decimal("15")) == "GREEN"
    # Boundary: exactly 12 → GREEN
    assert _determine_turnover_alert_level(Decimal("12")) == "GREEN"


def test_determine_turnover_alert_level_yellow():
    """6 <= turnover_rate < 12 → YELLOW."""
    assert _determine_turnover_alert_level(Decimal("10")) == "YELLOW"
    # Boundary: exactly 6 → YELLOW (Java `< _TURNOVER_RED` strict)
    assert _determine_turnover_alert_level(Decimal("6")) == "YELLOW"


def test_determine_turnover_alert_level_red():
    """Turnover rate < 6 → RED."""
    assert _determine_turnover_alert_level(Decimal("3")) == "RED"
    assert _determine_turnover_alert_level(Decimal("0")) == "RED"


def test_turnover_alert_at_exact_red_boundary():
    """Rule 7 boundary: Java `< 6` for RED → exact 6 falls into YELLOW band.

    One-ULP step below is still RED.
    """
    assert _determine_turnover_alert_level(Decimal("6")) == "YELLOW"
    assert _determine_turnover_alert_level(Decimal("5.9999")) == "RED"


def test_turnover_alert_at_exact_yellow_boundary():
    """Rule 7 boundary: Java `< 12` for YELLOW → exact 12 falls into GREEN."""
    assert _determine_turnover_alert_level(Decimal("12")) == "GREEN"
    assert _determine_turnover_alert_level(Decimal("11.9999")) == "YELLOW"


def test_determine_inventory_days_alert_level_green():
    """Inverse direction: inventory_days <= 30 → GREEN."""
    assert _determine_inventory_days_alert_level(Decimal("20")) == "GREEN"
    # Boundary: exactly 30 → GREEN (Java strict `>`)
    assert _determine_inventory_days_alert_level(Decimal("30")) == "GREEN"


def test_inventory_days_alert_at_exact_red_boundary():
    """Rule 7 boundary: Java strict `> 60` for RED → exact 60 is YELLOW."""
    assert _determine_inventory_days_alert_level(Decimal("60")) == "YELLOW"
    assert _determine_inventory_days_alert_level(Decimal("60.01")) == "RED"


def test_inventory_days_alert_at_exact_yellow_boundary():
    """Rule 7 boundary: Java strict `> 30` for YELLOW → exact 30 is GREEN."""
    assert _determine_inventory_days_alert_level(Decimal("30")) == "GREEN"
    assert _determine_inventory_days_alert_level(Decimal("30.01")) == "YELLOW"


def test_determine_expiry_risk_alert_level_strict_boundary():
    """Strict `>` semantics: 15 → YELLOW (not RED), 10 → GREEN (not YELLOW)."""
    assert _determine_expiry_risk_alert_level(Decimal("20")) == "RED"
    assert _determine_expiry_risk_alert_level(Decimal("15")) == "YELLOW"
    assert _determine_expiry_risk_alert_level(Decimal("10")) == "GREEN"


def test_expiry_risk_alert_strict_15_01_is_red():
    """Rule 7: just-above-threshold (15.01 / 10.01) flips one level worse."""
    assert _determine_expiry_risk_alert_level(Decimal("15.01")) == "RED"
    assert _determine_expiry_risk_alert_level(Decimal("10.01")) == "YELLOW"


def test_determine_loss_rate_alert_level_strict_boundary():
    """Strict `>` for loss rate: 5 → YELLOW (not RED), 2 → GREEN (not YELLOW)."""
    assert _determine_loss_rate_alert_level(Decimal("8")) == "RED"
    assert _determine_loss_rate_alert_level(Decimal("5")) == "YELLOW"
    assert _determine_loss_rate_alert_level(Decimal("2")) == "GREEN"


def test_loss_rate_alert_at_strict_boundary():
    """Rule 7 dual: just-above-threshold flips one level worse."""
    assert _determine_loss_rate_alert_level(Decimal("5.01")) == "RED"
    assert _determine_loss_rate_alert_level(Decimal("2.01")) == "YELLOW"


# ============================================================
# Section 2 — Rule 4 BigDecimal serialization (int-collapse Pattern A)
# ============================================================


def test_decimal_to_number_int_collapse_integer_decimal():
    """Rule 4 Pattern A: Decimal('100.00') is integral → int(100).

    Phase 2A dict-eq gate accepts this byte delta vs Java BigDecimal('100.00').
    """
    assert _decimal_to_number(Decimal("100.00")) == 100
    assert isinstance(_decimal_to_number(Decimal("100.00")), int)


def test_decimal_to_number_zero_is_int_zero():
    """Rule 4 Pattern A: Decimal('0.00') → int(0), NOT float(0.0) or str('0.00')."""
    result = _decimal_to_number(Decimal("0.00"))
    assert result == 0
    assert isinstance(result, int)
    assert not isinstance(result, float)


def test_decimal_to_number_integral_collapses_to_int():
    """Rule 4 Pattern A: Decimal('100.00') collapses to int(100)."""
    result = _decimal_to_number(Decimal("100.00"))
    assert result == 100
    assert isinstance(result, int)


def test_decimal_to_number_fractional_is_float():
    """Rule 4: Decimal('3.45') (non-integral) renders as float."""
    result = _decimal_to_number(Decimal("3.45"))
    assert isinstance(result, float)
    assert result == 3.45


# ============================================================
# Section 3 — Async helper tests with monkeypatched DB
# Targets _get_turnover_analysis / _get_expiry_risk_analysis / _get_aging_metrics
# ============================================================


async def test_get_turnover_analysis_returns_four_metrics(monkeypatch):
    """Happy: 4 metrics in fixed order with Rule 9 11-key envelope."""

    async def fake_total(factory_id):
        return Decimal("10000")

    async def fake_consumptions(factory_id, start_date, end_date):
        return [
            _make_consumption(total_cost=Decimal("3000")),
            _make_consumption(total_cost=Decimal("2000")),
        ]

    monkeypatch.setattr(mod, "_query_inventory_value_total", fake_total)
    monkeypatch.setattr(mod, "_query_material_consumptions_in_range", fake_consumptions)

    result = await _get_turnover_analysis(
        "F001", date(2026, 5, 1), date(2026, 5, 31)
    )

    assert len(result) == 4
    assert [m["metricCode"] for m in result] == [
        "TURNOVER_RATE",
        "INVENTORY_DAYS",
        "CONSUMPTION_AMOUNT",
        "INVENTORY_VALUE",
    ]

    # Rule 9: each MetricResult emits all 11 keys (Lombok @Data without @JsonInclude).
    expected_keys = {
        "metricCode", "metricName", "value", "formattedValue", "unit",
        "changePercent", "changeDirection", "changeValue", "alertLevel",
        "dimensionValue", "description",
    }
    for metric in result:
        assert set(metric.keys()) == expected_keys, (
            f"Metric {metric.get('metricCode')!r} missing/extra keys: "
            f"{set(metric.keys()) ^ expected_keys}"
        )
        # Rule 9: null fields emit explicitly (not omitted)
        assert "changePercent" in metric
        assert metric["changePercent"] is None

    inventory_value_metric = result[3]
    assert inventory_value_metric["metricCode"] == "INVENTORY_VALUE"
    assert inventory_value_metric["value"] == 10000  # Rule 4 int-collapse


async def test_get_turnover_analysis_zero_decimal_consumption_not_falsy(monkeypatch):
    """Rule 1 boundary: Decimal('0') row must iterate (is not None), not be
    truthy-skipped.

    Code path: _get_turnover_analysis L570-575 `if tc is not None`.
    """

    async def fake_inv_total(factory_id):
        return Decimal("1000")

    async def fake_consumptions(factory_id, start_date, end_date):
        return [
            {"total_cost": Decimal("0")},   # Rule 1: must iterate
            {"total_cost": Decimal("100")},
        ]

    monkeypatch.setattr(mod, "_query_inventory_value_total", fake_inv_total)
    monkeypatch.setattr(mod, "_query_material_consumptions_in_range", fake_consumptions)

    metrics = await _get_turnover_analysis(
        "F001", date(2026, 1, 1), date(2026, 1, 31)
    )
    assert len(metrics) == 4

    consumption_metric = next(m for m in metrics if m["metricCode"] == "CONSUMPTION_AMOUNT")
    # 0 + 100 = 100; _decimal_to_number(Decimal("100")) → int(100)
    assert consumption_metric["value"] == 100


async def test_get_turnover_analysis_none_total_cost_is_skipped(monkeypatch):
    """Rule 1 dual: total_cost=None IS skipped per `is not None` check. Guards
    against regression that would replace with truthy-check and start accepting
    None rows.
    """

    async def fake_inv_total(factory_id):
        return Decimal("1000")

    async def fake_consumptions(factory_id, start_date, end_date):
        return [
            {"total_cost": None},        # MUST be skipped
            {"total_cost": Decimal("50")},
        ]

    monkeypatch.setattr(mod, "_query_inventory_value_total", fake_inv_total)
    monkeypatch.setattr(mod, "_query_material_consumptions_in_range", fake_consumptions)

    metrics = await _get_turnover_analysis(
        "F001", date(2026, 1, 1), date(2026, 1, 31)
    )
    consumption_metric = next(m for m in metrics if m["metricCode"] == "CONSUMPTION_AMOUNT")
    assert consumption_metric["value"] == 50


async def test_get_turnover_analysis_empty_consumptions_returns_metrics_with_zero_values(
    monkeypatch,
):
    """Boundary: empty consumptions + zero inventory_value.

    - TURNOVER_RATE value=0, alertLevel=RED (0 < 6)
    - INVENTORY_DAYS value=999 (Java fallback per L615 when turnover_rate <= 0),
      alertLevel=RED (999 > 60)
    - CONSUMPTION_AMOUNT value=0, INVENTORY_VALUE value=0
    """

    async def fake_inv_total(factory_id):
        return Decimal("0")

    async def fake_consumptions(factory_id, start_date, end_date):
        return []

    monkeypatch.setattr(mod, "_query_inventory_value_total", fake_inv_total)
    monkeypatch.setattr(mod, "_query_material_consumptions_in_range", fake_consumptions)

    metrics = await _get_turnover_analysis(
        "F001", date(2026, 1, 1), date(2026, 1, 31)
    )
    assert len(metrics) == 4

    by_code = {m["metricCode"]: m for m in metrics}
    assert by_code["TURNOVER_RATE"]["value"] == 0
    assert by_code["TURNOVER_RATE"]["alertLevel"] == "RED"

    # Java fallback: 999 when turnover_rate <= 0
    assert by_code["INVENTORY_DAYS"]["value"] == 999
    assert by_code["INVENTORY_DAYS"]["alertLevel"] == "RED"  # 999 > 60

    assert by_code["CONSUMPTION_AMOUNT"]["value"] == 0
    assert by_code["INVENTORY_VALUE"]["value"] == 0


async def test_get_expiry_risk_analysis_returns_five_metrics(monkeypatch):
    """Happy: 5 metrics with correct codes + counts mirror mocked input."""

    all_batches_mock = [
        _make_batch(id="b1", batch_number="B-1"),
        _make_batch(id="b2", batch_number="B-2"),
        _make_batch(id="b3", batch_number="B-3"),
    ]
    expiring_mock = [
        _make_batch(id="b1", batch_number="B-1"),
        _make_batch(id="b2", batch_number="B-2"),
    ]
    expired_mock = [
        _make_batch(id="b9", batch_number="B-9"),
    ]

    async def fake_all_batches(factory_id, status="AVAILABLE"):
        return list(all_batches_mock)

    async def fake_expiring(factory_id, warning_date):
        return list(expiring_mock)

    async def fake_expired(factory_id):
        return list(expired_mock)

    monkeypatch.setattr(mod, "_query_material_batches_by_status", fake_all_batches)
    monkeypatch.setattr(mod, "_query_expiring_batches", fake_expiring)
    monkeypatch.setattr(mod, "_query_expired_batches", fake_expired)

    result = await _get_expiry_risk_analysis("F001")

    assert len(result) == 5
    assert [m["metricCode"] for m in result] == [
        "EXPIRY_RISK_RATE",
        "EXPIRING_COUNT",
        "HIGH_RISK_COUNT",
        "EXPIRED_COUNT",
        "EXPIRING_VALUE",
    ]

    by_code = {m["metricCode"]: m for m in result}
    assert by_code["EXPIRING_COUNT"]["value"] == 2
    assert by_code["EXPIRED_COUNT"]["value"] == 1
    # EXPIRED_COUNT non-zero → RED (inline alert empty→GREEN else→RED)
    assert by_code["EXPIRED_COUNT"]["alertLevel"] == "RED"
    # EXPIRING_COUNT non-zero → YELLOW (inline alert empty→GREEN else→YELLOW)
    assert by_code["EXPIRING_COUNT"]["alertLevel"] == "YELLOW"


async def test_get_aging_metrics_returns_at_least_two_metrics(monkeypatch):
    """Happy: SLOW_MOVING_RATE + SLOW_MOVING_VALUE always emitted.

    AVG_AGING_DAYS conditionally emitted when batches with receipt_date exist.
    Note: monkeypatch ``mod.date`` (not ``datetime.date``) since module binds
    ``from datetime import date`` at import-time.
    """
    fixed_today = date(2026, 5, 11)

    class _FixedDate(date):
        @classmethod
        def today(cls):
            return fixed_today

    monkeypatch.setattr(mod, "date", _FixedDate)

    batches = [
        _make_batch(id="b1", receipt_date=date(2026, 4, 1)),  # 40 days old
        _make_batch(id="b2", receipt_date=date(2026, 3, 1)),  # 71 days old
    ]

    async def fake_all_batches(factory_id, status="AVAILABLE"):
        return list(batches)

    monkeypatch.setattr(mod, "_query_material_batches_by_status", fake_all_batches)

    result = await _get_aging_metrics("F001")

    codes = [m["metricCode"] for m in result]
    assert "SLOW_MOVING_RATE" in codes
    assert "SLOW_MOVING_VALUE" in codes
    # At least one batch has receipt_date → AVG_AGING_DAYS appears
    assert "AVG_AGING_DAYS" in codes

    rate_metric = next(m for m in result if m["metricCode"] == "SLOW_MOVING_RATE")
    assert set(rate_metric.keys()) >= {
        "metricCode", "metricName", "value", "formattedValue", "unit",
        "alertLevel", "description",
    }


async def test_get_aging_metrics_no_batches_returns_two_zero_metrics(monkeypatch):
    """Boundary: no batches → SLOW_MOVING_RATE + SLOW_MOVING_VALUE only.

    AVG_AGING_DAYS is conditionally emitted (L1095 `if age_days_list`) — must
    be ABSENT when batch list is empty.
    """

    async def fake_batches(factory_id, status="AVAILABLE"):
        return []

    monkeypatch.setattr(mod, "_query_material_batches_by_status", fake_batches)

    metrics = await _get_aging_metrics("F001")

    codes = [m["metricCode"] for m in metrics]
    assert "SLOW_MOVING_RATE" in codes
    assert "SLOW_MOVING_VALUE" in codes
    assert "AVG_AGING_DAYS" not in codes
    assert len(metrics) == 2

    by_code = {m["metricCode"]: m for m in metrics}
    assert by_code["SLOW_MOVING_RATE"]["value"] == 0
    # 0 not > 20 and not > 10 → GREEN (inline thresholds in L1064-1070)
    assert by_code["SLOW_MOVING_RATE"]["alertLevel"] == "GREEN"
    assert by_code["SLOW_MOVING_VALUE"]["value"] == 0


def test_metric_result_emits_eleven_keys_with_nulls():
    """Rule 9: MetricResult.of must emit 11 keys including the null/None ones,
    in golden order. Code: _metric_result_of L534-556.
    """
    result = _metric_result_of("X", "name", Decimal("10"), "元")

    expected_keys = [
        "metricCode",
        "metricName",
        "value",
        "formattedValue",
        "unit",
        "changePercent",
        "changeDirection",
        "changeValue",
        "alertLevel",
        "dimensionValue",
        "description",
    ]
    assert list(result.keys()) == expected_keys
    assert len(result) == 11

    assert result["metricCode"] == "X"
    assert result["metricName"] == "name"
    assert result["value"] == 10            # Rule 4 Pattern A
    assert result["formattedValue"] is None
    assert result["unit"] == "元"
    assert result["changePercent"] is None
    assert result["changeDirection"] is None
    assert result["changeValue"] is None
    assert result["alertLevel"] == "GREEN"  # MetricResult.of default
    assert result["dimensionValue"] is None
    assert result["description"] is None


def test_metric_result_zero_value_collapses_to_int_zero():
    """Rule 4 + Rule 9: _metric_result_of with Decimal('0') emits value=int(0)."""
    result = _metric_result_of("Z", "zero", Decimal("0"), "元")
    assert result["value"] == 0
    assert isinstance(result["value"], int)
    assert not isinstance(result["value"], float)


# ============================================================
# Section 4 — HTTP endpoint dispatch tests via FastAPI TestClient
# Mock high-level mode dispatcher; verify wrap_response envelope.
# ============================================================


def test_endpoint_dispatches_to_turnover_mode(client, monkeypatch):
    """analysisType=turnover → dispatcher calls _get_turnover_mode and wraps result."""
    sentinel = {
        "endDate":    "2026-05-31",
        "ranking":    [],
        "metrics":    [],
        "trendChart": {"chartType": "LINE", "title": "周转趋势"},
        "startDate":  "2026-05-01",
    }

    async def fake_turnover_mode(factory_id, start_date, end_date):
        return sentinel

    monkeypatch.setattr(mod, "_get_turnover_mode", fake_turnover_mode)

    response = client.get(
        _INV_PATH,
        params={**_DEFAULT_QS, "analysisType": "turnover"},
        headers=_auth_header(factory_id="F001"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert body["data"] == sentinel
    assert set(body["data"].keys()) == {
        "endDate", "ranking", "metrics", "trendChart", "startDate",
    }


def test_endpoint_dispatches_to_expiry_mode(client, monkeypatch):
    """analysisType=expiry → dispatcher calls _get_expiry_mode."""
    sentinel = {
        "riskAnalysis":    [],
        "endDate":         "2026-05-31",
        "riskChart":       {"chartType": "PIE", "title": "临期风险分布"},
        "expiringBatches": [],
        "startDate":       "2026-05-01",
    }

    async def fake_expiry_mode(factory_id, start_date, end_date):
        return sentinel

    monkeypatch.setattr(mod, "_get_expiry_mode", fake_expiry_mode)

    response = client.get(
        _INV_PATH,
        params={**_DEFAULT_QS, "analysisType": "expiry"},
        headers=_auth_header(factory_id="F001"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert body["data"] == sentinel
    assert set(body["data"].keys()) == {
        "riskAnalysis", "endDate", "riskChart", "expiringBatches", "startDate",
    }


def test_endpoint_dispatches_to_aging_mode(client, monkeypatch):
    """analysisType=aging → dispatcher calls _get_aging_mode."""
    sentinel = {
        "agingMetrics":     [],
        "endDate":          "2026-05-31",
        "longAgingBatches": [],
        "agingChart":       {"chartType": "BAR", "title": "库龄分布"},
        "startDate":        "2026-05-01",
    }

    async def fake_aging_mode(factory_id, start_date, end_date):
        return sentinel

    monkeypatch.setattr(mod, "_get_aging_mode", fake_aging_mode)

    response = client.get(
        _INV_PATH,
        params={**_DEFAULT_QS, "analysisType": "aging"},
        headers=_auth_header(factory_id="F001"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert body["data"] == sentinel
    assert set(body["data"].keys()) == {
        "agingMetrics", "endDate", "longAgingBatches", "agingChart", "startDate",
    }


# ============================================================
# Section 5 — Rule 6: query helper None-validation raises ValueError
# (not silent zero-result from asyncpg BETWEEN NULL AND NULL)
# ============================================================


async def test_query_consumptions_rejects_none_start_date():
    """Rule 6: _query_material_consumptions_in_range refuses None start_date."""
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_material_consumptions_in_range("F001", None, date(2026, 5, 31))


async def test_query_consumptions_rejects_none_end_date():
    """Rule 6: _query_material_consumptions_in_range refuses None end_date."""
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_material_consumptions_in_range("F001", date(2026, 5, 1), None)


async def test_query_consumptions_rejects_both_none():
    """Rule 6: both dates None → ValueError (not silent zero-result)."""
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await _query_material_consumptions_in_range("F001", None, None)


async def test_query_batches_by_status_rejects_none_factory_id():
    """Rule 6 sibling: factory_id None must raise, not silently NULL the filter."""
    with pytest.raises(ValueError, match="factory_id required"):
        await _query_material_batches_by_status(None, "AVAILABLE")


# ============================================================
# Section 6 — Auth boundary tests (verify_jwt_and_factory)
# 401: missing Bearer / invalid token / expired
# 403: cross-factory / no-factoryId + non-privileged role
# 200: no-factoryId + platform_admin (privileged)
# ============================================================


def test_endpoint_missing_bearer_returns_401(client):
    """No Authorization header → 401 (auth.py L45-46)."""
    r = client.get(_INV_PATH, params=_DEFAULT_QS)
    assert r.status_code == 401


def test_endpoint_invalid_token_returns_401(client):
    """Bearer garbage → InvalidTokenError → 401 (auth.py L53-54)."""
    r = client.get(
        _INV_PATH,
        params=_DEFAULT_QS,
        headers={"Authorization": "Bearer garbage.token.value"},
    )
    assert r.status_code == 401


def test_endpoint_expired_token_returns_401(client):
    """Expired JWT → ExpiredSignatureError → 401 (auth.py L51-52)."""
    expired = _make_token(exp_offset=-3600)
    r = client.get(_INV_PATH, params=_DEFAULT_QS, headers=_auth_header(expired))
    assert r.status_code == 401


def test_endpoint_cross_factory_token_returns_403(client):
    """Token factoryId=F999 but URL factory_id=F001 → 403 (auth.py L66-69)."""
    r = client.get(
        _INV_PATH,
        params=_DEFAULT_QS,
        headers=_auth_header(factory_id="F999", role="factory_super_admin"),
    )
    assert r.status_code == 403


def test_endpoint_no_factory_id_non_privileged_role_returns_403(client):
    """Token without factoryId AND role not in PRIVILEGED_ROLES → 403
    (auth.py L59-63)."""
    r = client.get(
        _INV_PATH,
        params=_DEFAULT_QS,
        headers=_auth_header(factory_id=None, role="operator"),
    )
    assert r.status_code == 403


def test_endpoint_no_factory_id_privileged_role_succeeds(client, monkeypatch):
    """Token without factoryId BUT role=platform_admin → auth allows through.

    Mock _get_default_mode so business logic doesn't hit DB — isolates the
    auth-only branch (auth.py L59-64 else-path).
    """

    async def _fake_default_mode(factory_id, start_date, end_date):
        return {
            "overview": {},
            "endDate": end_date.isoformat(),
            "startDate": start_date.isoformat(),
        }

    monkeypatch.setattr(mod, "_get_default_mode", _fake_default_mode)
    r = client.get(
        _INV_PATH,
        params=_DEFAULT_QS,
        headers=_auth_header(factory_id=None, role="platform_admin"),
    )
    assert r.status_code == 200


# ============================================================
# Section 7 — Endpoint error path (501 unknown type + 422 validation)
# ============================================================


def test_endpoint_unknown_analysis_type_returns_501_envelope(client):
    """analysisType=invalid → HTTP 200 (wrap_response) but body.success=False,
    body.code=501, message contains '尚未 port' (impl L1919-1925).
    """
    r = client.get(
        _INV_PATH,
        params={**_DEFAULT_QS, "analysisType": "invalid"},
        headers=_auth_header(factory_id="F001"),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is False
    assert body["code"] == 501
    assert "尚未 port" in body["message"]


def test_endpoint_missing_start_date_returns_422(client):
    """startDate is Query(...) required → FastAPI 422."""
    r = client.get(
        _INV_PATH,
        params={"endDate": "2026-05-31"},
        headers=_auth_header(factory_id="F001"),
    )
    assert r.status_code == 422


def test_endpoint_missing_end_date_returns_422(client):
    """endDate is Query(...) required → FastAPI 422."""
    r = client.get(
        _INV_PATH,
        params={"startDate": "2026-05-01"},
        headers=_auth_header(factory_id="F001"),
    )
    assert r.status_code == 422


def test_endpoint_invalid_date_format_returns_422(client):
    """startDate=not-a-date → Pydantic rejects before handler → 422."""
    r = client.get(
        _INV_PATH,
        params={"startDate": "not-a-date", "endDate": "2026-05-31"},
        headers=_auth_header(factory_id="F001"),
    )
    assert r.status_code == 422
