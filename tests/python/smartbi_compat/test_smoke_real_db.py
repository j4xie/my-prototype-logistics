"""Real-DB integration smoke gate for Phase 2A SmartBI Python endpoints.

Closes the integration testing gap identified in
``docs/superpowers/specs/2026-05-05-phase2a-db-pool-wiring-fix.md`` §1.2.
The 4-cycle audit pattern operates on spec/code layers and existing CI
tests mock the SQLAlchemy engine; neither catches the case where Python
SQL references tables that live in a database the bound engine does not
point at. T6.0 nginx prep surfaced 1100+ ``UndefinedTableError`` in the
prod log only after a real-JWT request hit the live service.

This module hits each in-scope T6 endpoint with a real JWT against a
running Python service and asserts HTTP 200 + non-empty payload. It is
expected to FAIL on the 7 endpoints listed in spec §1.4 until PR-A/B/C/D
ship — that is the gate. Once those PRs land and the deploy is healthy,
this test passes and protects against regressions.

Default behaviour: skipped (CI does not have a live service or DB).
Enable via ``SMOKE_REAL_DB=1`` plus the env vars wired in the auth
fixture below.

Usage::

    SMOKE_REAL_DB=1 \\
    PYTHON_BASE=http://localhost:8084 \\
    JAVA_BASE=http://localhost:10011 \\
    PHASE2A_TEST_USER_PASSWORD=<pwd> \\
    pytest tests/python/smartbi_compat/test_smoke_real_db.py -v
"""
from __future__ import annotations

import os
import pathlib

import httpx
import pytest


pytestmark = pytest.mark.skipif(
    not os.environ.get("SMOKE_REAL_DB"),
    reason=(
        "set SMOKE_REAL_DB=1 to run "
        "(needs running cretas-python service + real factory data)"
    ),
)

# Endpoints list lives at the repo root. parents[3] = repo root
# (test file -> smartbi_compat -> python -> tests -> repo root).
_REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
ENDPOINTS_FILE = _REPO_ROOT / "scripts" / "phase2a" / "t6-in-scope-endpoints.txt"

# F999 is the dedicated phase2a_test_factory (V20260430_01 migration).
# Per spec §3.2 prod backfill (V20260506_01) is a coupled prereq before
# this smoke gate is run against the prod env.
TEST_FACTORY_ID = "F999"


def _load_endpoints() -> list[str]:
    """Parse the T6 in-scope endpoints file.

    Format: one endpoint path per line. ``{factoryId}`` placeholder
    filled at request time. Blank lines and ``#`` comments ignored.
    Resolves at parametrize time so a missing file fails loudly rather
    than silently producing 0 cases.
    """
    if not ENDPOINTS_FILE.exists():
        raise FileNotFoundError(
            f"T6 endpoints file missing: {ENDPOINTS_FILE} "
            "(expected committed in scripts/phase2a/, see commit dc8bafa9d)"
        )
    paths: list[str] = []
    for raw in ENDPOINTS_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        paths.append(line)
    if not paths:
        raise RuntimeError(f"No endpoints parsed from {ENDPOINTS_FILE}")
    return paths


@pytest.fixture(scope="session")
def auth_token() -> str:
    """Acquire a real JWT via the Java unified-login endpoint.

    Session-scoped so the login round-trip happens once per pytest run.
    The user must already exist in the target env (test env: cretas_db
    seeded by V20260430_01; prod env: cretas_prod_db seeded by spec §3.2
    V20260506_01 — gated, runs after this test's PR).
    """
    java_base = os.environ.get("JAVA_BASE", "http://localhost:10011")
    password = os.environ.get("PHASE2A_TEST_USER_PASSWORD")
    if not password:
        pytest.fail(
            "PHASE2A_TEST_USER_PASSWORD env var required when "
            "SMOKE_REAL_DB=1 (see scripts/systemd/.env.test.template)"
        )
    resp = httpx.post(
        f"{java_base}/api/mobile/auth/unified-login",
        json={
            "username": "phase2a_test_user",
            "password": password,
            "deviceInfo": {"deviceId": "phase2a-smoke-test"},
        },
        timeout=15,
    )
    if resp.status_code != 200:
        pytest.fail(
            f"unified-login failed: HTTP {resp.status_code} "
            f"body={resp.text[:300]}"
        )
    body = resp.json()
    token = (body.get("data") or {}).get("token") or (body.get("data") or {}).get("accessToken")
    if not token:
        pytest.fail(f"unified-login response missing token: {body}")
    return token


@pytest.mark.parametrize("path", _load_endpoints())
def test_endpoint_returns_2xx(path: str, auth_token: str) -> None:
    """Endpoint must return HTTP 200 + non-null payload.

    A wiring bug surfaces here as HTTP 500 ``UndefinedTableError`` (the
    smoking gun from spec §1.1). A latent data bug (factory has no rows)
    surfaces as HTTP 200 with ``{"success": false, "data": null}`` — we
    accept that as PASS only if at least one of the success/data flags
    is positive.

    Baseline before PR-A/B/C/D land (test env, 2026-05-06): **12 of 19
    endpoints fail** with HTTP 500. Spec §1.4's audit-based estimate
    listed 7 broken endpoints — the live gate found 5 more (department,
    inventory, procurement, alerts, recommendations, datasource/list,
    finance sub-endpoints) that grep didn't catch. This wider blast
    radius is the integration gap this gate closes; sister fix PRs
    should re-run this test to confirm each ships with green pass count.
    """
    python_base = os.environ.get("PYTHON_BASE", "http://localhost:8084")
    full_path = path.replace("{factoryId}", TEST_FACTORY_ID)
    url = f"{python_base}{full_path}"
    resp = httpx.get(
        url,
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=30,
    )
    assert resp.status_code == 200, (
        f"{path}: HTTP {resp.status_code} body={resp.text[:300]}"
    )
    try:
        body = resp.json()
    except ValueError as exc:
        pytest.fail(f"{path}: response is not JSON ({exc}); body={resp.text[:300]}")
    assert body.get("success") is True or body.get("data") is not None, (
        f"{path}: success={body.get('success')!r} data={body.get('data')!r} "
        f"message={body.get('message')!r}"
    )
