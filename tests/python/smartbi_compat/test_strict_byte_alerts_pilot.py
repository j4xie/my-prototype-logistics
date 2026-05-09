"""Week 2 strict-byte pilot — Python /alerts frozen-snapshot regression test.

## Pivot context

The original Week 2 marching order suggested using ``/alerts`` for a
**Java byte-shape parity** pilot. PR #205 (T6.5 Phase B, 2026-05-08) stubbed
22 ``SmartBIAnalysisController`` method bodies to return HTTP 410 Gone for
**all factories including F999**. ``/alerts`` is one of the 22.

→ Java parity recording for ``/alerts`` is **no longer possible** after T6.5
Phase B. Java SmartBI Analysis is decommissioned; Python is the sole source
of truth for these endpoints post-T6.4 cascade.

## New pilot purpose

Strict-byte gate's purpose pivots from "Phase 2A Java parity QA" to
**"frozen Python snapshot regression detection"** — exactly the use case
PR #155 §0 identified for Phase 3+ frontend-hash-compare scenarios and
PR #152 Tier 3 Upload binary-fidelity contracts.

This pilot:

1. Records Python ``/alerts`` raw response bytes once (golden file) given
   deterministic monkey-patched seams (mirroring V20260430_02 trip rows).
2. On every test run, replays the same TestClient call and asserts
   byte-for-byte equality against the golden, with volatile patterns
   (UUID ``id`` / ``createdAt`` / envelope ``timestamp``) masked.
3. Detects any future regression in Python serialization (Decimal scale,
   key order, encoding) **even when dict-eq would tolerate it** (Pattern
   A/A2 per python-java-port.md Rule 4).

## Recording the golden

If you change the alerts response shape intentionally, regenerate via::

    python -m tests.python.smartbi_compat.test_strict_byte_alerts_pilot --record

(See ``_record_golden`` at the bottom of this file.)
"""
from __future__ import annotations

import importlib.util
import os
import pathlib
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
    / "python-strict-byte-golden"
)
GOLDEN_PATH = GOLDEN_DIR / "alerts-F999-aggregator.json.bytes"


# Volatile byte-pattern set for /alerts — UUIDs + datetimes per alert + envelope.
# Each pattern matches the field-and-value JSON sub-string verbatim; the
# comparator substitutes ``<MASKED>`` before byte compare.
_ALERTS_VOLATILE_BYTE_PATTERNS = [
    rb'"id":"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"',
    rb'"createdAt":"[^"]+"',
    rb'"timestamp":"[^"]+"',
]


# Mirror tests/python/smartbi_compat/test_alerts_contract.py V20260430_02 trip-rows
# fixture data. Keeping this in-file (rather than importing) avoids cross-test
# coupling — pilot stands alone if the contract test is later refactored.
_F999_FINANCE_TRIP_ROWS = [
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


def _load_production_main() -> Any:
    main_py = (
        pathlib.Path(__file__).resolve().parents[3] / "backend" / "python" / "main.py"
    )
    spec = importlib.util.spec_from_file_location(
        "phase2a_strict_byte_pilot_main", main_py
    )
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_production_main = _load_production_main()


@pytest.fixture
def app_with_all_seams(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """Production app with /alerts seams monkey-patched to V20260430_02 trip rows."""
    from smartbi_compat.api import analysis as analysis_router

    monkeypatch.setattr(analysis_router, "_query_sales_data", lambda fid, range_: [])
    monkeypatch.setattr(
        analysis_router, "_query_finance_data", lambda fid, range_: _F999_FINANCE_TRIP_ROWS
    )
    monkeypatch.setattr(
        analysis_router, "_query_department_data", lambda fid, range_: _F999_DEPT_TRIP_ROWS
    )
    return _production_main.app


@pytest.fixture
def f999_token() -> str:
    payload = {
        "userId": 1355,
        "username": "phase2a_strict_byte_pilot",
        "role": "factory_super_admin",
        "factoryId": "F999",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _hit_alerts(app: FastAPI, token: str) -> bytes:
    """Single TestClient call → raw response bytes (no parse-emit roundtrip)."""
    client = TestClient(app)
    resp = client.get(
        "/api/mobile/F999/smart-bi/alerts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"alerts pilot expected 200, got {resp.status_code}"
    return resp.content


# ─── Pilot — strict-byte parity against frozen Python snapshot ─────────────────


@pytest.mark.strict_byte
def test_alerts_python_self_byte_stability_F999(
    app_with_all_seams: FastAPI, f999_token: str, assert_response_match
) -> None:
    """Python /alerts emits byte-stable response across runs (volatile masked).

    Detects regressions invisible to dict-eq:
      • Pattern A int-collapse (Decimal('100.00') → int(100))
      • Pattern A2 scale-4 trailing-zero loss
      • Map.of key reordering
      • _java_isoformat trailing-zero microsecond drift
      • Field name casing (Lombok decapitalize quirks)
      • Any change in serializer output beyond volatile UUID/timestamp.
    """
    if not GOLDEN_PATH.exists():
        pytest.fail(
            f"strict-byte golden missing: {GOLDEN_PATH}\n"
            f"Recreate via: python tests/python/smartbi_compat/test_strict_byte_alerts_pilot.py --record"
        )

    actual_bytes = _hit_alerts(app_with_all_seams, f999_token)
    expected_bytes = GOLDEN_PATH.read_bytes()

    assert_response_match(
        actual_bytes,
        expected_bytes,
        volatile_byte_patterns=_ALERTS_VOLATILE_BYTE_PATTERNS,
    )


@pytest.mark.strict_byte
def test_alerts_volatile_pattern_truly_volatile_across_runs(
    app_with_all_seams: FastAPI, f999_token: str
) -> None:
    """Two consecutive /alerts calls produce divergent UUIDs + timestamps —
    confirming volatile masking is necessary, not cosmetic."""
    bytes_a = _hit_alerts(app_with_all_seams, f999_token)
    bytes_b = _hit_alerts(app_with_all_seams, f999_token)

    # Without masking → diverge (UUIDs + timestamps differ per call)
    assert bytes_a != bytes_b, (
        "Expected /alerts to produce different bytes across runs (UUID/datetime). "
        "If equal, check whether _query_finance_data seam or alert generator changed."
    )


# ─── Recording entry point ─────────────────────────────────────────────────────


def _record_golden() -> None:
    """Standalone recorder — run via ``python <this_file> --record`` to refresh.

    Uses the same monkey-patched seams + JWT as the test, writing
    ``alerts-F999-aggregator.json.bytes``. Inspect diff before committing.
    """
    from smartbi_compat.api import analysis as analysis_router

    analysis_router._query_sales_data = lambda fid, range_: []
    analysis_router._query_finance_data = lambda fid, range_: _F999_FINANCE_TRIP_ROWS
    analysis_router._query_department_data = lambda fid, range_: _F999_DEPT_TRIP_ROWS

    token = jwt.encode(
        {
            "userId": 1355,
            "username": "phase2a_strict_byte_pilot",
            "role": "factory_super_admin",
            "factoryId": "F999",
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    bytes_ = _hit_alerts(_production_main.app, token)
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    GOLDEN_PATH.write_bytes(bytes_)
    print(f"wrote {GOLDEN_PATH} ({len(bytes_)} bytes)")


if __name__ == "__main__":
    import sys

    if "--record" in sys.argv:
        _record_golden()
    else:
        print("Use --record to regenerate the golden.")
        sys.exit(1)
