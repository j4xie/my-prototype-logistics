"""Contract tests: each Python alias response must match its Java golden sample.

Goldens recorded by scripts/phase2a/record-java-golden.mjs into
tests/fixtures/java-smartbi-golden/<name>-<factory>.json
Each file: {"verb": "...", "path": "...", "factory": "...", "response": {...},
"_meta": {...}}

Test app construction
---------------------
The Phase 2A T5 plan template imagines mounting the production
``main:app``. In this worktree the production app cannot be imported in
tests because ``backend/python/main.py`` line 755 imports
``smartbi.api.llm_router_admin`` which is created by a parallel branch
and is not part of the phase2a/t5-poc tree. Mounting just the alias
routers (the unit under test) is therefore both necessary and
preferable: it exercises the same FastAPI app the production process
mounts (smartbi_compat/api/dashboard.py), without hauling in the rest of
the Python service. This matches the pattern already used in
tests/python/smartbi_compat/test_jwt_middleware.py.

PoC scope (T5a, single endpoint)
--------------------------------
- Route registration: real APIRouter from smartbi_compat.api.dashboard.
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

import json
import math
import os
import pathlib
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


@pytest.fixture(scope="module")
def goldens() -> dict[str, Any]:
    out: dict[str, Any] = {}
    for f in GOLDEN_DIR.glob("*.json"):
        out[f.stem] = json.loads(f.read_text(encoding="utf-8"))
    return out


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """Minimal FastAPI app mounting just the Phase 2A alias routers.

    See module docstring for why ``main:app`` is not used here.
    """
    # Force the data-date-range query to return the golden's recorded range
    # so the contract assertion is deterministic in CI.
    from smartbi_compat.api import dashboard as dashboard_router

    def _fake_query_date_range(factory_id: str) -> Optional[Tuple[date, date]]:
        return date(2026, 1, 1), date(2026, 12, 28)

    monkeypatch.setattr(dashboard_router, "_query_date_range", _fake_query_date_range)

    a = FastAPI()
    a.include_router(dashboard_router.router)
    # Future PoC sub-tasks will mount analysis + upload routers here too.
    return a


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


def assert_schema_match(actual: Any, expected: Any, *, path: str = "$") -> None:
    """Recursive structural comparison.

    - Top-level keys must match (ignore expected keys whose value is None).
    - Lists: same length; element-wise key compare.
    - Floats: tolerate 1e-6 absolute or 1% relative.
    """
    if expected is None:
        return  # null in golden is treated as wildcard (Java often omits)
    assert isinstance(actual, type(expected)) or (
        actual is None and expected is None
    ), f"type mismatch at {path}: {type(actual).__name__} vs {type(expected).__name__}"
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
    # Verify envelope (success/message — httpStatus is golden-recorder metadata,
    # not part of Java's actual ApiResponse wrapper, so we don't assert on it).
    assert body.get("success") is True
    assert "data" in body
    assert body.get("message") == expected.get("message")
    # Verify the business payload.
    assert_schema_match(body["data"], expected_data)
