"""Contract tests: Python /alerts must match Java byte-shape goldens.

Goldens recorded against F999 (Phase 2A synthetic test factory) by
scripts/phase2a/record-alerts-goldens.sh into tests/fixtures/java-smartbi-golden/.

For chat 2 milestone close-out: covers /alerts and /alerts?category=sales routes,
asserting envelope shape (5-key Java ApiResponse) and data array.

Both F999 alerts fixtures recorded with `data: []` because F999 (= F001 clone)
has ~90% completion rate that does not trip any threshold. The contract test
therefore validates route registration + envelope shape + data type, not the
alert-object byte-shape (deferred to chat 3 once finance/department thresholds
are also ported and F999 has data that trips at least one alert).
"""
from __future__ import annotations

import importlib.util
import json
import os
import pathlib
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET

GOLDEN_DIR = (
    pathlib.Path(__file__).resolve().parents[2]
    / "fixtures"
    / "java-smartbi-golden"
)


def _load_production_main() -> Any:
    main_py = (
        pathlib.Path(__file__).resolve().parents[3]
        / "backend"
        / "python"
        / "main.py"
    )
    spec = importlib.util.spec_from_file_location("phase2a_production_main_alerts", main_py)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_production_main = _load_production_main()


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """Production main:app with `_query_sales_data` monkey-patched to return [].

    Mirrors the F999 golden recording where current-month data does not trip
    any alert threshold (~90% completion). Empty input → `_generate_sales_alerts`
    returns [] early per its implementation.
    """
    from smartbi_compat.api import analysis as analysis_router

    monkeypatch.setattr(analysis_router, "_query_sales_data", lambda fid, range_: [])
    return _production_main.app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture
def f999_token() -> str:
    payload = {
        "userId": 1355,
        "username": "phase2a_test_user",
        "role": "factory_super_admin",
        "factoryId": "F999",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


_ISO_LOCAL_DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$")


def _assert_envelope(body: Any, *, expected_code: int = 200) -> None:
    """Java ApiResponse 5-key envelope assertion."""
    assert isinstance(body, dict)
    missing = {"code", "message", "data", "timestamp", "success"} - set(body.keys())
    assert not missing, f"envelope missing keys: {missing}"
    assert body["code"] == expected_code
    assert isinstance(body["message"], str)
    assert _ISO_LOCAL_DATETIME_RE.match(body["timestamp"])
    assert body["success"] is True


def _load_golden(name: str) -> dict:
    return json.loads((GOLDEN_DIR / f"{name}.json").read_text(encoding="utf-8"))


def test_alerts_default_route_registered_and_envelope(client: TestClient, f999_token: str) -> None:
    """GET /alerts (no category) returns Java-shape envelope with data array."""
    resp = client.get(
        "/api/mobile/F999/smart-bi/alerts",
        headers={"Authorization": f"Bearer {f999_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    _assert_envelope(body)
    assert isinstance(body["data"], list)


def test_alerts_sales_route_registered_and_envelope(client: TestClient, f999_token: str) -> None:
    """GET /alerts?category=sales returns Java-shape envelope with data array."""
    resp = client.get(
        "/api/mobile/F999/smart-bi/alerts?category=sales",
        headers={"Authorization": f"Bearer {f999_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    _assert_envelope(body)
    assert isinstance(body["data"], list)


def test_alerts_sales_data_matches_f999_golden_when_empty(client: TestClient, f999_token: str) -> None:
    """Python /alerts?category=sales data array matches F999 Java golden (empty)."""
    resp = client.get(
        "/api/mobile/F999/smart-bi/alerts?category=sales",
        headers={"Authorization": f"Bearer {f999_token}"},
    )
    body = resp.json()
    golden = _load_golden("alerts-category-sales-F999")
    assert body["data"] == golden["response"]["data"]


# NOTE: The empty-default-vs-golden test was removed in chat 3 after V20260430_02
# trip-rows migration made the F999 aggregator golden contain 7 alerts (4 finance +
# 3 dept). Task E2 (aggregator contract test) replaces it with a proper
# monkey-patched-all-seams + strip-volatile + deep-equal test.

# ─── Chat 3 contract tests: finance / department / aggregator vs F999 goldens ──
#
# These tests monkey-patch all 3 seams with the SAME data Java's V20260430_02
# trip-rows migration inserted, then compare Python output to recorded Java
# golden after stripping volatile fields (id, createdAt, envelope.timestamp).
#
# Volatile field rationale: id is fresh per Alert.builder() invocation;
# createdAt is datetime.now(); envelope.timestamp is wrap_response timestamp.
# All three are inherently non-byte-equal; stripped before deep-compare.
#
# value/threshold are sometimes ints in Java goldens (record-level fields like
# aging_days where Java passes Integer to BigDecimal); Python emits Decimal.
# JSON serialization renders both as numbers; FastAPI's default jsonable_encoder
# emits Decimal as float — we coerce both sides to float for compare.


_F999_FINANCE_TRIP_ROWS = [
    # Mirror V20260430_02__phase2a_F999_alert_trip_rows.sql
    SimpleNamespace(customer_name="逾期客户A", receivable_amount=Decimal("200000"),
                    aging_days=95, budget_amount=None, actual_amount=None),
    SimpleNamespace(customer_name="逾期客户B", receivable_amount=Decimal("800000"),
                    aging_days=100, budget_amount=None, actual_amount=None),
    SimpleNamespace(customer_name="大额客户C", receivable_amount=Decimal("1500000"),
                    aging_days=75, budget_amount=None, actual_amount=None),
]


_F999_DEPT_TRIP_ROWS = [
    SimpleNamespace(department="研发部", sales_amount=Decimal("100000"), headcount=5),
    SimpleNamespace(department="销售部", sales_amount=Decimal("150000"), headcount=5),
    SimpleNamespace(department="行政部", sales_amount=Decimal("50000"), headcount=5),
]


_VOLATILE_ALERT_KEYS = {"id", "createdAt"}


def _strip_volatile(alerts: list) -> list:
    """Strip per-alert volatile keys + coerce numerics to float for byte-shape compare."""
    out = []
    for a in alerts:
        stripped = {k: v for k, v in a.items() if k not in _VOLATILE_ALERT_KEYS}
        # Coerce numerics: Java BigDecimal renders as int/float in JSON, Python
        # Decimal renders as float via FastAPI's jsonable_encoder
        for numeric_key in ("value", "threshold", "gapPercent"):
            if numeric_key in stripped and stripped[numeric_key] is not None:
                stripped[numeric_key] = float(stripped[numeric_key])
        out.append(stripped)
    return out


@pytest.fixture
def app_with_finance_seam(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """Production app with _query_finance_data monkey-patched to F999 trip-rows."""
    from smartbi_compat.api import analysis as analysis_router
    monkeypatch.setattr(analysis_router, "_query_sales_data", lambda fid, range_: [])
    monkeypatch.setattr(analysis_router, "_query_finance_data", lambda fid, range_: _F999_FINANCE_TRIP_ROWS)
    monkeypatch.setattr(analysis_router, "_query_department_data", lambda fid, range_: [])
    return _production_main.app


@pytest.fixture
def app_with_dept_seam(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """Production app with _query_department_data monkey-patched to F999 trip-rows."""
    from smartbi_compat.api import analysis as analysis_router
    monkeypatch.setattr(analysis_router, "_query_sales_data", lambda fid, range_: [])
    monkeypatch.setattr(analysis_router, "_query_finance_data", lambda fid, range_: [])
    monkeypatch.setattr(analysis_router, "_query_department_data", lambda fid, range_: _F999_DEPT_TRIP_ROWS)
    return _production_main.app


@pytest.fixture
def app_with_all_seams(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """Production app with all 3 seams monkey-patched (aggregator test)."""
    from smartbi_compat.api import analysis as analysis_router
    monkeypatch.setattr(analysis_router, "_query_sales_data", lambda fid, range_: [])
    monkeypatch.setattr(analysis_router, "_query_finance_data", lambda fid, range_: _F999_FINANCE_TRIP_ROWS)
    monkeypatch.setattr(analysis_router, "_query_department_data", lambda fid, range_: _F999_DEPT_TRIP_ROWS)
    return _production_main.app


def test_alerts_finance_matches_f999_golden(app_with_finance_seam: FastAPI, f999_token: str) -> None:
    """Python /alerts?category=finance matches F999 Java golden (4 alerts: 2 RED aging + 1 YELLOW aging + 1 RED total)."""
    client = TestClient(app_with_finance_seam)
    resp = client.get(
        "/api/mobile/F999/smart-bi/alerts?category=finance",
        headers={"Authorization": f"Bearer {f999_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    _assert_envelope(body)
    actual = _strip_volatile(body["data"])
    expected = _strip_volatile(_load_golden("alerts-category-finance-F999")["response"]["data"])
    assert actual == expected


def test_alerts_department_matches_f999_golden(app_with_dept_seam: FastAPI, f999_token: str) -> None:
    """Python /alerts?category=department matches F999 Java golden (3 RED, sorted Unicode 研→行→销)."""
    client = TestClient(app_with_dept_seam)
    resp = client.get(
        "/api/mobile/F999/smart-bi/alerts?category=department",
        headers={"Authorization": f"Bearer {f999_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    _assert_envelope(body)
    actual = _strip_volatile(body["data"])
    expected = _strip_volatile(_load_golden("alerts-category-department-F999")["response"]["data"])
    assert actual == expected


def test_alerts_aggregator_matches_f999_golden(app_with_all_seams: FastAPI, f999_token: str) -> None:
    """Python /alerts (no category) matches F999 Java golden (7 alerts: 6 RED + 1 YELLOW, severity DESC)."""
    client = TestClient(app_with_all_seams)
    resp = client.get(
        "/api/mobile/F999/smart-bi/alerts",
        headers={"Authorization": f"Bearer {f999_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    _assert_envelope(body)
    actual = _strip_volatile(body["data"])
    expected = _strip_volatile(_load_golden("alerts-F999")["response"]["data"])
    assert actual == expected


def test_alerts_unauthorized_returns_401(client: TestClient) -> None:
    """Missing Bearer token returns 401."""
    resp = client.get("/api/mobile/F999/smart-bi/alerts")
    assert resp.status_code == 401


def test_alerts_cross_factory_returns_403(client: TestClient, f999_token: str) -> None:
    """F999 token attempting F001 path returns 403 (auth middleware enforced)."""
    resp = client.get(
        "/api/mobile/F001/smart-bi/alerts",
        headers={"Authorization": f"Bearer {f999_token}"},
    )
    assert resp.status_code == 403
