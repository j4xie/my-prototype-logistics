"""Contract tests: each Python alias response must match its Java golden sample.

Goldens recorded by scripts/phase2a/record-java-golden.mjs into
tests/fixtures/java-smartbi-golden/<name>-<factory>.json
Each file: {"verb": "...", "path": "...", "factory": "...", "response": {...},
"_meta": {...}}

Test app construction
---------------------
The fixture imports the production ``main:app`` so contract tests
exercise the same FastAPI process that runs in prod (route registration,
auth middleware, optional-router gating, exception handlers). The DB
seam ``_query_date_range`` is monkey-patched at module scope so the
assertion is deterministic without a Postgres dependency. Optional
modules that aren't on this branch (e.g. ``smartbi.api.llm_router_admin``)
are guarded by try/except in main.py and skipped with a warning.

PoC scope (T5a, single endpoint)
--------------------------------
- Route registration: real APIRouter from smartbi_compat.api.dashboard,
  mounted by main.py alongside the other alias routers.
- JWT middleware: real verify_jwt_and_factory dependency.
- Response shape: real wrap_response envelope; granularity computed by
  the real _infer_granularity port of Java DateRange.inferGranularity.
- DB layer: monkey-patched at the _query_date_range seam — Postgres is
  not provisioned in this test environment. Production hits the real
  smart_bi_sales_data table via smartbi.database.connection.

Schema-match notes
------------------
The golden response carries a ``httpStatus`` field at the top level
(recorded by the Phase 2A golden tool); production Java's ApiResponse
wrapper does not actually emit it, so we compare only the business
``data`` payload — the recorder's metadata field is benign. The
``success`` and ``message`` envelope keys are still asserted directly.
"""
from __future__ import annotations

import importlib.util
import json
import math
import os
import pathlib
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional, Tuple

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
    """Load backend/python/main.py by absolute path.

    A naive ``from main import app`` is ambiguous in this repo: pytest's
    backend/python/conftest.py adds ``backend/python/smartbi/`` to sys.path,
    and that directory also contains a legacy ``main.py``. Resolving by
    absolute path forces the production entry point regardless of sys.path
    order.
    """
    main_py = (
        pathlib.Path(__file__).resolve().parents[3]
        / "backend"
        / "python"
        / "main.py"
    )
    spec = importlib.util.spec_from_file_location(
        "phase2a_production_main", main_py
    )
    assert spec is not None and spec.loader is not None, (
        f"could not build importlib spec for {main_py}"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Load the production main module once for the whole test module so each
# test reuses the same FastAPI app (route registration is expensive).
_production_main = _load_production_main()


@pytest.fixture(scope="module")
def goldens() -> dict[str, Any]:
    out: dict[str, Any] = {}
    for f in GOLDEN_DIR.glob("*.json"):
        out[f.stem] = json.loads(f.read_text(encoding="utf-8"))
    return out


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """Production main:app — same FastAPI process that runs in prod."""
    # Force the data-date-range query to return the golden's recorded range
    # so the contract assertion is deterministic in CI.
    from smartbi_compat.api import dashboard as dashboard_router

    def _fake_query_date_range(factory_id: str) -> Optional[Tuple[date, date]]:
        return date(2026, 1, 1), date(2026, 12, 28)

    monkeypatch.setattr(dashboard_router, "_query_date_range", _fake_query_date_range)

    return _production_main.app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture
def factory_token() -> str:
    payload = {
        "userId": 42,
        "username": "alice",
        "role": "factory_admin",
        "factoryId": "F001",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _types_compatible(actual: Any, expected: Any) -> bool:
    """JSON-equivalent type check for schema comparison.

    int and float are interchangeable here because JSON does not
    distinguish 42 from 42.0, and Python deserialisation of a Java
    BigDecimal often surfaces as float on one side and int on the
    other depending on rounding/scale.

    bool is treated as distinct from numeric, even though
    ``isinstance(True, int)`` is True in Python: a golden field
    recorded as a number must not silently match a boolean response,
    and vice versa.
    """
    if actual is None and expected is None:
        return True
    # Reject bool <-> int/float confusion in either direction.
    if isinstance(expected, bool) or isinstance(actual, bool):
        return type(actual) is type(expected)
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return True
    return isinstance(actual, type(expected))


# Java's LocalDateTime via Jackson default looks like
# "2026-04-29T12:43:08.971343681" (nanoseconds, no timezone). Python's
# datetime.now().isoformat() produces "2026-04-29T12:43:08.971343"
# (microseconds, no timezone). Both fit this pattern; the precision
# difference is the documented compromise — recorded goldens cannot
# byte-equal a freshly emitted timestamp anyway, so we assert shape only.
_ISO_LOCAL_DATETIME_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$"
)


def assert_envelope(
    body: Any, *, expected_code: int = 200, expected_success: bool = True
) -> None:
    """Assert the response is a Java-compatible ApiResponse envelope (5 keys).

    The envelope mirrors com.cretas.aims.dto.common.ApiResponse declared
    field order: code, message, data, timestamp, success. Phase 2A's
    ``wrap_response`` MUST emit all five so RN/web-admin clients see a
    byte-shape-equivalent response after T6 nginx cutover.

    The current golden recorder (scripts/phase2a/record-java-golden.mjs)
    drops ``code`` and ``timestamp`` when persisting goldens, so this
    helper hardcodes the success-case ``code`` (200) rather than reading
    it from the golden. When the recorder is upgraded to capture all
    five envelope keys, callers can pass ``expected_code=g["response"]["code"]``.
    """
    assert isinstance(body, dict), f"body not a dict: {type(body).__name__}"
    missing = {"code", "message", "data", "timestamp", "success"} - set(body.keys())
    assert not missing, f"envelope missing keys: {missing}"
    assert body["code"] == expected_code, (
        f"envelope.code: {body['code']!r} (expected {expected_code})"
    )
    assert isinstance(body["message"], str), (
        f"envelope.message not str: {type(body['message']).__name__}"
    )
    ts = body["timestamp"]
    assert isinstance(ts, str), f"envelope.timestamp not str: {ts!r}"
    assert _ISO_LOCAL_DATETIME_RE.match(ts), (
        f"envelope.timestamp not ISO 8601 LocalDateTime: {ts!r}"
    )
    assert body["success"] is expected_success, (
        f"envelope.success: {body['success']!r} (expected {expected_success})"
    )


def assert_schema_match(actual: Any, expected: Any, *, path: str = "$") -> None:
    """Recursive structural comparison of actual vs expected JSON.

    Semantics:
    - dict: expected keys must exist in actual; extra actual keys are allowed.
    - list: lengths must match; element-wise comparison.
    - float: 1e-6 absolute or 1% relative tolerance, whichever larger.
    - NaN: matches None or NaN.
    - numeric: int and float are interchangeable (see _types_compatible);
      bool is distinct from numeric.

    Known limitation (null-as-wildcard, accepted for Phase 2A PoC):
        When ``expected`` is None, ANY actual value passes (None, 0, "",
        {}, structurally wrong nested objects, etc).
        Reason: Java often emits ``{"trend": null}`` where Python may
        emit nothing or a different shape; without knowing whether
        Java's null means "field absent" or "field present and null",
        we cannot pick a strict comparison.
        Risk: regressions in null-valued fields are silently masked.
        Future fix (T5+): the golden recorder must mark provenance
        ("Java emitted null" vs "Java omitted key") so this function
        can pick the right semantics. Tracked as follow-up; do NOT
        remove this limitation without first updating the recorder.
    """
    if expected is None:
        return  # See "Known limitation" in docstring.
    assert _types_compatible(actual, expected), (
        f"type mismatch at {path}: "
        f"{type(actual).__name__} vs {type(expected).__name__}"
    )
    if isinstance(expected, dict):
        non_null_expected = {k: v for k, v in expected.items() if v is not None}
        actual_keys = set(actual.keys())
        missing = set(non_null_expected.keys()) - actual_keys
        assert not missing, f"missing keys at {path}: {missing}"
        for k, v in non_null_expected.items():
            assert_schema_match(actual.get(k), v, path=f"{path}.{k}")
    elif isinstance(expected, list):
        assert len(actual) == len(expected), (
            f"list length mismatch at {path}: {len(actual)} vs {len(expected)}"
        )
        for i, (a, e) in enumerate(zip(actual, expected)):
            assert_schema_match(a, e, path=f"{path}[{i}]")
    elif isinstance(expected, float):
        if math.isnan(expected):
            assert actual is None or math.isnan(actual), f"NaN mismatch at {path}"
        else:
            tol = max(1e-6, abs(expected) * 0.01)
            assert abs(actual - expected) <= tol, (
                f"float mismatch at {path}: {actual} vs {expected}"
            )


# Contract tests (one per alias endpoint) ---


def test_data_date_range_F001_matches_golden(client, factory_token, goldens):
    g = goldens["data-date-range-F001"]
    r = client.get(
        g["path"].replace("{factory_id}", g["factory"]),
        headers={"Authorization": f"Bearer {factory_token}"},
    )
    assert r.status_code == 200, f"unexpected status {r.status_code}: {r.text}"
    body = r.json()
    expected = g["response"]
    expected_data = expected["data"]
    # Envelope: 5-key Java ApiResponse shape (code/message/data/timestamp/success).
    # `httpStatus` in the golden is recorder metadata, not Java's ApiResponse
    # wrapper, so we don't assert on it here.
    assert_envelope(body, expected_code=200, expected_success=True)
    assert body["message"] == expected.get("message")
    # Business payload.
    assert_schema_match(body["data"], expected_data)


# Schema-helper unit tests (I-1 review fix) ---


def test_assert_schema_match_accepts_int_float_interchange():
    """JSON does not distinguish 42 from 42.0 — schema match must allow
    either side to come back as int or float (Java BigDecimal often
    deserialises to float on the Python side, vice versa)."""
    # Should not raise in either direction.
    assert_schema_match({"x": 42.0}, {"x": 42})
    assert_schema_match({"x": 42}, {"x": 42.0})


def test_assert_schema_match_rejects_bool_int_confusion():
    """bool is a subclass of int in Python but for schema purposes True
    and 1 are distinct values — silently matching them would mask
    regressions in flag-shaped fields like hasData."""
    with pytest.raises(AssertionError, match="type mismatch"):
        assert_schema_match({"x": True}, {"x": 1})
    with pytest.raises(AssertionError, match="type mismatch"):
        assert_schema_match({"x": 1}, {"x": True})


# False-branch contract test (I-3 review fix) ---


def test_data_date_range_F001_no_data_returns_no_data_envelope(
    client, factory_token, monkeypatch
):
    """Monkey-patch the DB seam to simulate a factory with no sales data.

    Verifies the hasData=false branch matches Java
    SmartBIDashboardController.java:367-369:
        ApiResponse.success(
            "No sales data detected",
            {"hasData": false, "message": "No sales data detected"})
    """
    from smartbi_compat.api import dashboard

    monkeypatch.setattr(
        dashboard, "_query_date_range", lambda fid: None
    )

    r = client.get(
        "/api/mobile/F001/smart-bi/data-date-range",
        headers={"Authorization": f"Bearer {factory_token}"},
    )
    assert r.status_code == 200, f"unexpected status {r.status_code}: {r.text}"
    body = r.json()
    assert_envelope(body, expected_code=200, expected_success=True)
    assert body["message"] == "No sales data detected"
    assert body["data"]["hasData"] is False
    assert body["data"]["message"] == "No sales data detected"


# ---------------------------------------------------------------------------
# T5b: GET /query-templates contract test
# ---------------------------------------------------------------------------
#
# Java reference: SmartBIAnalysisController.getQueryTemplates (line 954-962)
# backed by SmartBiQueryTemplateRepository.findByFactoryIdOrderByCreatedAtDesc,
# which returns a List<SmartBiQueryTemplate> (BaseEntity + 7 fields). Lombok
# @Data on BaseEntity then SmartBiQueryTemplate yields Jackson key order:
#     createdAt, updatedAt, deletedAt, id, factoryId, name, category,
#     description, queryTemplate, parameters, deleted
# where ``deleted`` is the @Where soft-delete flag (deletedAt is None).
#
# DB seam ``_query_templates`` is monkey-patched at module scope so the
# assertion is deterministic without a Postgres dependency. Production hits
# the real smart_bi_query_templates table via smartbi.database.connection.


def test_query_templates_F001_matches_golden(
    client, factory_token, goldens, monkeypatch
):
    """Mirror Java's GET /query-templates list shape against the recorded golden.

    The DB seam returns the post-_row_to_dict shape (already a list of
    JSON-ready dicts), so monkey-patching with the golden's ``data`` array
    directly exercises the full envelope/route/serialisation path without
    a Postgres dependency.

    Note: this means the schema match is strong against the envelope and
    list framing, but weak against per-row serialisation correctness
    (the helper isn't actually exercised in this test). The PoC accepts
    that — the seam itself is unit-testable separately, and a live-
    backend integration test is out of scope for the PoC contract phase.
    """
    g = goldens["query-templates-F001"]
    expected = g["response"]
    expected_data = expected["data"]

    from smartbi_compat.api import analysis as analysis_router

    monkeypatch.setattr(
        analysis_router,
        "_query_templates",
        lambda factory_id: expected_data,
    )

    r = client.get(
        g["path"].replace("{factory_id}", g["factory"]),
        headers={"Authorization": f"Bearer {factory_token}"},
    )
    assert r.status_code == 200, f"unexpected status {r.status_code}: {r.text}"
    body = r.json()
    assert_envelope(body, expected_code=200, expected_success=True)
    assert body["message"] == expected.get("message")
    assert_schema_match(body["data"], expected_data)
