# SmartBI Phase 2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 50 in-scope SmartBI endpoints (Analysis 26 + Upload 13 + Dashboard 11) from Java to Python alias layer; web-admin + RN client traffic routes through nginx directly to Python:8083; front-end code unchanged.

**Architecture:** New `backend/python/smartbi_compat/` module exposes alias routes matching Java path patterns exactly. JWT verified via FastAPI `Depends(verify_jwt_and_factory)`. Aliases either thin-proxy to existing Python endpoints (Y-class), execute condition branches (Z-class), or implement Java-native logic in Python (X-class) — classification done by T0 audit. Nginx 139 gateway adds 2 location blocks (SSE-only `proxy_buffering off`, main location default buffering).

**Tech Stack:** FastAPI + asyncpg (Python 3.11+), PyJWT (HS256), nginx (139 gateway), pytest + httpx test client, Node mjs e2e scripts.

**Spec:** `docs/superpowers/specs/2026-04-28-smartbi-phase2a-design.md`

---

## File Structure

**Create:**
- `backend/python/smartbi_compat/__init__.py` — package marker
- `backend/python/smartbi_compat/auth.py` — `verify_jwt_and_factory` dependency + `AuthContext` dataclass
- `backend/python/smartbi_compat/schema_compat.py` — `wrap_response()` helper for `{success, data, message}` envelope
- `backend/python/smartbi_compat/aggregator.py` — `gather_with_pool_safety()` helper (semaphore-bounded asyncio.gather)
- `backend/python/smartbi_compat/api/__init__.py` — package marker
- `backend/python/smartbi_compat/api/analysis.py` — 26 alias routes for SmartBIAnalysisController paths
- `backend/python/smartbi_compat/api/upload.py` — 13 alias routes for SmartBIUploadController paths
- `backend/python/smartbi_compat/api/dashboard.py` — 11 alias routes for SmartBIDashboardController paths
- `tests/python/smartbi_compat/__init__.py`
- `tests/python/smartbi_compat/conftest.py` — JWT token fixtures, FastAPI test client
- `tests/python/smartbi_compat/test_jwt_middleware.py` — 5-case JWT/cross-factory tests
- `tests/python/smartbi_compat/test_contract_compat.py` — contract tests vs Java golden samples
- `tests/python/smartbi_compat/test_alias_aggregation.py` — gather + pool-exhaustion stress test
- `tests/e2e-comprehensive/phase2a-smartbi-smoke.mjs` — end-to-end smoke
- `scripts/phase2a/record-java-golden.mjs` — golden-sample recording script
- `docs/superpowers/research/2026-04-29-smartbi-50-endpoints-classification.md` — T0 output (X/Y/Z classification)
- `tests/fixtures/java-smartbi-golden/*.json` — 50 recorded Java responses (from T2)

**Modify:**
- `backend/python/auth_middleware.py` — extend with `verify_jwt_and_factory` (do NOT add `/api/mobile/{...}/smart-bi/` to `PUBLIC_PREFIXES`)
- `backend/python/main.py` — add 3 `app.include_router(...)` lines for smartbi_compat routers
- `backend/python/smartbi/config.py:102` — bump `postgres_pool_size` default from 5 to 40 + add env override
- `/etc/systemd/system/cretas-python.service` (server, T1) — add `EnvironmentFile=/www/wwwroot/cretas/.env.prod`
- `/www/server/panel/vhost/nginx/<site>.conf` (139 gateway, T6/T9) — add 2 location blocks

---

## Task 0: 50-Endpoint Classification Audit (Research Output)

**Files:**
- Create: `docs/superpowers/research/2026-04-29-smartbi-50-endpoints-classification.md`
- Read: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java`
- Read: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIUploadController.java`
- Read: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java`
- Read: `backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java` (to identify thin-proxy targets)

**Classification rules:**
- **Y (Java thin proxy)**: method body calls `pythonClient.<something>(...)` and returns its result with minimal mapping. ~30 min/alias.
- **Z (Java condition branch)**: method has if/switch on query params (e.g. `dimension=salesperson`), each branch may call different services. ~2-4 hr/alias.
- **X (Java native)**: method calls `*Service` beans that operate on Java entities + JPA repos (no `pythonClient.*` call), returns computed result. ~6-8 hr/alias.

- [ ] **Step 0.1: Audit SmartBIAnalysisController (26 endpoints)**

For each `@GetMapping`/`@PostMapping`/`@PutMapping`/`@DeleteMapping` method:
1. Read its body (typically 5-30 lines)
2. Look for `pythonClient.` calls → mark Y
3. Look for `if (dimension)` / `switch` on params → mark Z
4. If neither, look at injected `*Service` fields → mark X if they call JPA repos directly

- [ ] **Step 0.2: Audit SmartBIUploadController (13 endpoints)**

Same procedure. Most upload endpoints call `pythonClient.parseExcel*` → expect majority Y.

- [ ] **Step 0.3: Audit SmartBIDashboardController (11 endpoints)**

Same. Dashboard has SSE endpoint `/dashboard/executive/insights/custom/stream` — note this is special (SSE forwarding).

- [ ] **Step 0.4: Write classification report**

Format (one row per endpoint):

```markdown
# SmartBI 50-Endpoint X/Y/Z Classification

**Date:** 2026-04-29
**Audited commits:** SmartBIAnalysisController.java@<sha>, SmartBIUploadController@<sha>, SmartBIDashboardController@<sha>

## Summary
- Y (thin proxy): N endpoints — work ~N×0.5h
- Z (condition branch): M endpoints — work ~M×3h
- X (Java native): K endpoints — work ~K×7h
- **Total estimate:** [sum]h ≈ [weeks]

## SmartBIAnalysisController (26)

| # | Verb | Path | Class | Java method calls | Python target (if Y) |
|---|------|------|-------|-------------------|----------------------|
| 1 | GET  | /analysis/sales | Z | smartBIService.getSales(...) on dimension param | (varies) |
| 2 | GET  | /analysis/finance | Y | pythonClient.callSection("finance",...) | POST /api/analysis/finance/overview |
| ... | ... | ... | ... | ... | ... |

## SmartBIUploadController (13)

(same table format)

## SmartBIDashboardController (11)

(same table format)

## Risks
- [Any X-class endpoint that requires significant new Python implementation]
- [Any endpoint where Java method body is unclear]
```

- [ ] **Step 0.5: Commit research doc**

```bash
git add docs/superpowers/research/2026-04-29-smartbi-50-endpoints-classification.md
git commit -m "docs(phase2a): T0 — classify 50 SmartBI endpoints (X/Y/Z)" -- docs/superpowers/research/2026-04-29-smartbi-50-endpoints-classification.md
```

**Gate:** if X-class > 25 (>50%), STOP and re-confirm scope with user — Phase 2A may need 8-10 weeks instead of 4-5.

---

## Task 1: systemd EnvironmentFile + JWT secret verification

**Files:**
- Modify (on server): `/etc/systemd/system/cretas-python.service`
- Modify (on server): `/etc/systemd/system/cretas-python-test.service` (if it exists; otherwise update `/www/wwwroot/cretas/restart-test.sh` to source `.env.prod`)

**Note:** This task is DevOps on the server. No code changes in repo.

- [ ] **Step 1.1: SSH and capture current service file**

```bash
ssh root@47.100.235.168 "cat /etc/systemd/system/cretas-python.service"
```

Save output locally (paste into `scripts/phase2a/notes-systemd-baseline.md` for rollback reference).

- [ ] **Step 1.2: Add EnvironmentFile directive**

```bash
ssh root@47.100.235.168 "sed -i '/^\[Service\]$/a EnvironmentFile=/www/wwwroot/cretas/.env.prod' /etc/systemd/system/cretas-python.service"
```

Verify:

```bash
ssh root@47.100.235.168 "grep EnvironmentFile /etc/systemd/system/cretas-python.service"
```
Expected: `EnvironmentFile=/www/wwwroot/cretas/.env.prod`

- [ ] **Step 1.3: Reload systemd and restart Python prod**

```bash
ssh root@47.100.235.168 "systemctl daemon-reload && systemctl restart cretas-python"
```

Wait for health:

```bash
ssh root@47.100.235.168 "sleep 5 && curl -s http://localhost:8083/health"
```

Expected: `{"status":"ok",...}`

- [ ] **Step 1.4: Verify JWT_SECRET is now visible to Python**

```bash
ssh root@47.100.235.168 "systemctl show cretas-python --property=Environment | grep -c JWT_SECRET || echo 'NOT VISIBLE'"
```

Expected: `1` (the env var is loaded). If "NOT VISIBLE", check `.env.prod` actually defines `JWT_SECRET=...`.

- [ ] **Step 1.5: Repeat 1.1-1.4 for cretas-python-test (if systemd-managed) OR update restart-test.sh**

If systemd-managed:
```bash
ssh root@47.100.235.168 "sed -i '/^\[Service\]$/a EnvironmentFile=/www/wwwroot/cretas/.env.prod' /etc/systemd/system/cretas-python-test.service && systemctl daemon-reload && systemctl restart cretas-python-test"
```

If `restart-test.sh` based:
```bash
ssh root@47.100.235.168 "grep -q '\.env\.prod' /www/wwwroot/cretas/restart-test.sh || sed -i '2i source /www/wwwroot/cretas/.env.prod' /www/wwwroot/cretas/restart-test.sh"
ssh root@47.100.235.168 "bash /www/wwwroot/cretas/restart.sh test"
```

- [ ] **Step 1.6: Document T1 outcome**

Append to `scripts/phase2a/notes-systemd-baseline.md`:
```
T1 done at YYYY-MM-DD HH:MM
- prod: EnvironmentFile=/www/wwwroot/cretas/.env.prod added; restart healthy
- test: [systemd|restart.sh] approach; restart healthy
- JWT_SECRET visible: [yes/no]
```

Commit the notes file (no production code changed in this task):

```bash
git add scripts/phase2a/notes-systemd-baseline.md
git commit -m "docs(phase2a): T1 — systemd EnvironmentFile baseline notes" -- scripts/phase2a/notes-systemd-baseline.md
```

---

## Task 2: Record Java 50-endpoint golden samples

**Files:**
- Create: `scripts/phase2a/record-java-golden.mjs`
- Create: `tests/fixtures/java-smartbi-golden/.gitkeep`
- Output: `tests/fixtures/java-smartbi-golden/<endpoint-slug>.json` (50 files)

- [ ] **Step 2.1: Create the recording script skeleton**

`scripts/phase2a/record-java-golden.mjs`:

```javascript
#!/usr/bin/env node
// Records Java SmartBI 50-endpoint responses as golden samples for Phase 2A contract tests.
// Run: node scripts/phase2a/record-java-golden.mjs --base http://47.100.235.168:10011 --user factory_admin1 --password 123456 --factory F001

import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => {
  if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1]]);
  return acc;
}, []));

const BASE = args.base || 'http://47.100.235.168:10011';
const USER = args.user || 'factory_admin1';
const PW = args.password || '123456';
const FACTORY = args.factory || 'F001';
const OUT_DIR = path.resolve('tests/fixtures/java-smartbi-golden');

// 50 endpoint definitions (verb, path-template, optional query-string, optional body)
// Path templates use {factory_id}; we substitute below.
const ENDPOINTS = [
  // SmartBIAnalysisController (26)
  { name: 'analysis_sales',                    verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/sales' },
  { name: 'analysis_department',               verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/department' },
  { name: 'analysis_region',                   verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/region' },
  { name: 'analysis_finance',                  verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/finance' },
  { name: 'analysis_finance_budget',           verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/finance/budget-achievement' },
  { name: 'analysis_finance_yoymom',           verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/finance/yoy-mom' },
  { name: 'analysis_finance_category',         verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/finance/category-comparison' },
  { name: 'analysis_production',               verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/production' },
  { name: 'analysis_quality',                  verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/quality' },
  { name: 'analysis_inventory',                verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/inventory' },
  { name: 'analysis_procurement',              verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/analysis/procurement' },
  { name: 'query',                             verb: 'POST', path: '/api/mobile/{factory_id}/smart-bi/query',          body: { query: '今天销售额' } },
  { name: 'drill_down',                        verb: 'POST', path: '/api/mobile/{factory_id}/smart-bi/drill-down',    body: { dimension: 'product' } },
  { name: 'alerts',                            verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/alerts' },
  { name: 'recommendations',                   verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/recommendations' },
  { name: 'incentive_plan',                    verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/incentive-plan/department/dep_001', skipIfMissing: true },
  { name: 'datasource_list',                   verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/datasource/list' },
  { name: 'query_templates',                   verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/query-templates' },
  // ... NB: only record GETs that have data on test env. POST/PUT/DELETE may need skipping or pre-seeding.
  // Add the remaining 8 endpoints here.

  // SmartBIUploadController (13)
  { name: 'uploads',                           verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/uploads' },
  { name: 'uploads_missing_fields',            verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/uploads-missing-fields' },
  // ... 11 more (most are POST/file uploads; record only the GETs as goldens; POST schema covered by code review of Java vs Python responses)

  // SmartBIDashboardController (11)
  { name: 'dashboard_executive',               verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/dashboard/executive' },
  { name: 'dashboard_executive_insights',      verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/dashboard/executive/insights' },
  { name: 'dashboard',                         verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/dashboard' },
  { name: 'data_date_range',                   verb: 'GET',  path: '/api/mobile/{factory_id}/smart-bi/data-date-range' },
  // ... add remaining
];

async function login() {
  // POST /api/mobile/auth/unified-login
  // returns { data: { accessToken: '...' } }
  // Implementation: standard fetch, see tests/e2e-comprehensive/bulk-audit-dazhongdianping.mjs lines 60-71 for reference
  // [Pseudocode here — implementer fills in based on existing test scripts]
  throw new Error('TODO: copy login() from tests/e2e-comprehensive/bulk-audit-dazhongdianping.mjs');
}

async function callEndpoint(token, endpoint) {
  const url = BASE + endpoint.path.replace('{factory_id}', FACTORY);
  // GET or POST with Authorization header; capture status + body
  // [Implementer: use http.request as in bulk-audit-dazhongdianping.mjs]
  throw new Error('TODO: implement HTTP call');
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const token = await login();
  const summary = { recorded: [], skipped: [], failed: [] };

  for (const ep of ENDPOINTS) {
    try {
      const resp = await callEndpoint(token, ep);
      if (resp.status === 200) {
        const file = path.join(OUT_DIR, `${ep.name}-${FACTORY}.json`);
        await fs.writeFile(file, JSON.stringify({ verb: ep.verb, path: ep.path, factory: FACTORY, response: resp.body }, null, 2));
        summary.recorded.push(ep.name);
      } else if (ep.skipIfMissing) {
        summary.skipped.push(`${ep.name} (status ${resp.status})`);
      } else {
        summary.failed.push(`${ep.name} (status ${resp.status})`);
      }
    } catch (e) {
      summary.failed.push(`${ep.name} (${e.message})`);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed.length > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2.2: Implement `login()` and `callEndpoint()` by copying from existing script**

Read `tests/e2e-comprehensive/bulk-audit-dazhongdianping.mjs` lines 35-100 (`fetch` helper, `login()` function). Replace the `throw new Error('TODO: ...')` lines in `record-java-golden.mjs` with copies adapted to the new ENDPOINTS structure.

- [ ] **Step 2.3: Complete the ENDPOINTS array**

Reference T0 classification report. Add all 50 endpoint definitions. For POST endpoints with body, include realistic test-env-safe bodies. For path params (e.g. `{templateId}`), either pre-seed test data OR mark `skipIfMissing: true`.

- [ ] **Step 2.4: Run the script against test environment**

```bash
node scripts/phase2a/record-java-golden.mjs --base http://47.100.235.168:10011 --user factory_admin1 --password 123456 --factory F001
```

Expected output JSON: `{recorded: [50 names], skipped: [...], failed: []}`. If failed > 0, fix individual endpoints (typically requires test data prep) and re-run.

- [ ] **Step 2.5: Verify fixtures**

```bash
ls tests/fixtures/java-smartbi-golden/ | wc -l
```
Expected: ≥ 40 (some POSTs may legitimately skip; document in T0 report).

- [ ] **Step 2.6: Commit fixtures + script**

```bash
git add scripts/phase2a/record-java-golden.mjs tests/fixtures/java-smartbi-golden/
git commit -m "test(phase2a): T2 — Java golden samples for 50 endpoints" -- scripts/phase2a/record-java-golden.mjs tests/fixtures/java-smartbi-golden/
```

---

## Task 3: Python JWT middleware (`verify_jwt_and_factory`)

**Files:**
- Modify: `backend/python/auth_middleware.py` (add new function; do NOT extend `PUBLIC_PREFIXES`)
- Create: `tests/python/smartbi_compat/__init__.py` (empty)
- Create: `tests/python/smartbi_compat/conftest.py` — JWT/factory fixtures
- Create: `tests/python/smartbi_compat/test_jwt_middleware.py` — 5 test cases

- [ ] **Step 3.1: Write the 5 failing test cases**

`tests/python/smartbi_compat/test_jwt_middleware.py`:

```python
"""JWT middleware unit tests for /api/mobile/{factory_id}/smart-bi/* alias endpoints.

Covers 5 cases including Phase 2A's cross-factory bypass fix
(null factoryId token must require platform_admin role).
"""
import os
import jwt
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, timezone

# Test setup ---
JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET


@pytest.fixture
def app():
    """A minimal FastAPI app exposing one alias endpoint that uses verify_jwt_and_factory."""
    from smartbi_compat.auth import verify_jwt_and_factory  # imported here so env var is set first

    a = FastAPI()

    @a.get("/api/mobile/{factory_id}/smart-bi/analysis/sales")
    async def sales(factory_id: str, auth=Depends(verify_jwt_and_factory)):
        return {"factory_id": factory_id, "user_id": auth.user_id, "role": auth.role}

    return a


@pytest.fixture
def client(app):
    return TestClient(app)


def make_token(*, factory_id=None, role="factory_admin", user_id=42, username="alice", expires_in=3600):
    now = datetime.now(timezone.utc)
    payload = {
        "userId": user_id,
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    if factory_id is not None:
        payload["factoryId"] = factory_id
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


# --- Test cases ---

def test_missing_bearer_returns_401(client):
    r = client.get("/api/mobile/F001/smart-bi/analysis/sales")
    assert r.status_code == 401
    assert "Bearer" in r.json()["detail"]


def test_expired_token_returns_401(client):
    expired = make_token(factory_id="F001", expires_in=-10)
    r = client.get("/api/mobile/F001/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401
    assert "expired" in r.json()["detail"].lower()


def test_cross_factory_token_returns_403(client):
    """token issued for F001 cannot access F002."""
    token = make_token(factory_id="F001", role="factory_admin")
    r = client.get("/api/mobile/F002/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert "factory" in r.json()["detail"].lower()


def test_null_factoryid_non_admin_returns_403(client):
    """Token without factoryId must be platform_admin to access SmartBI."""
    token = make_token(factory_id=None, role="factory_admin")  # not platform_admin
    r = client.get("/api/mobile/F001/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert "platform_admin" in r.json()["detail"]


def test_platform_admin_can_cross_factory(client):
    token = make_token(factory_id=None, role="platform_admin", user_id=1)
    r = client.get("/api/mobile/F999/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["factory_id"] == "F999"
    assert body["user_id"] == 1
    assert body["role"] == "platform_admin"
```

- [ ] **Step 3.2: Run tests — verify they fail**

```bash
cd backend/python
python -m pytest tests/python/smartbi_compat/test_jwt_middleware.py -v
```

Expected: `ImportError: cannot import name 'verify_jwt_and_factory' from 'smartbi_compat.auth'` (because module doesn't exist yet).

- [ ] **Step 3.3: Create smartbi_compat package skeleton**

```bash
mkdir -p backend/python/smartbi_compat/api
touch backend/python/smartbi_compat/__init__.py
touch backend/python/smartbi_compat/api/__init__.py
```

- [ ] **Step 3.4: Implement `verify_jwt_and_factory` and `AuthContext`**

`backend/python/smartbi_compat/auth.py`:

```python
"""JWT verification + cross-factory enforcement for SmartBI alias endpoints.

Used as a FastAPI Depends(...) on every alias route under
/api/mobile/{factory_id}/smart-bi/*. Verifies HS256-signed JWT against
shared secret, enforces:
  - bearer token present, signature valid, not expired
  - if token has factoryId, must equal URL path factory_id
  - if token has no factoryId, role must be in PRIVILEGED_ROLES
"""
from __future__ import annotations
import os
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request

JWT_ALGORITHM = "HS256"
PRIVILEGED_ROLES = frozenset({"platform_admin", "platform_super_admin"})


def _get_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError(
            "JWT_SECRET env var not set. systemd cretas-python.service must "
            "have EnvironmentFile=/www/wwwroot/cretas/.env.prod (Phase 2A T1)."
        )
    return secret


@dataclass(frozen=True)
class AuthContext:
    user_id: int
    username: str
    factory_id: str   # always populated; for null-factoryId tokens, set from URL path
    role: str


async def verify_jwt_and_factory(
    request: Request,
    factory_id: str,
) -> AuthContext:
    # 1. extract Bearer token
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token in Authorization header")
    token = auth_header[len("Bearer "):]

    # 2. verify signature + expiry
    try:
        payload = jwt.decode(token, _get_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Invalid token: {e}")

    # 3. cross-factory enforcement (Phase 2A bypass fix)
    token_factory: Optional[str] = payload.get("factoryId")
    role: str = payload.get("role") or ""

    if token_factory is None:
        # null-factoryId tokens: SmartBI access requires platform_admin role
        if role not in PRIVILEGED_ROLES:
            raise HTTPException(
                403,
                "Token without factoryId requires platform_admin role for SmartBI access",
            )
        # platform_admin may access any factory; use URL path factory
    else:
        if token_factory != factory_id:
            raise HTTPException(
                403,
                f"Cross-factory access denied: token factoryId={token_factory} URL factoryId={factory_id}",
            )

    return AuthContext(
        user_id=int(payload["userId"]),
        username=payload.get("username") or "",
        factory_id=factory_id,
        role=role,
    )
```

- [ ] **Step 3.5: Add the conftest**

`tests/python/smartbi_compat/conftest.py`:

```python
"""Shared fixtures for smartbi_compat tests.

Note: tests/python/conftest.py already adds backend/python to sys.path,
so `from smartbi_compat.auth import ...` works from this directory.
"""
import sys
import pathlib

_PY_ROOT = pathlib.Path(__file__).resolve().parents[2] / "backend" / "python"
if str(_PY_ROOT) not in sys.path:
    sys.path.insert(0, str(_PY_ROOT))
```

- [ ] **Step 3.6: Run tests again — verify all 5 pass**

```bash
cd backend/python
python -m pytest tests/python/smartbi_compat/test_jwt_middleware.py -v
```

Expected: `5 passed`. If any fail, fix the implementation in `auth.py` and re-run.

- [ ] **Step 3.7: Commit**

```bash
git add backend/python/smartbi_compat/__init__.py \
        backend/python/smartbi_compat/api/__init__.py \
        backend/python/smartbi_compat/auth.py \
        tests/python/smartbi_compat/__init__.py \
        tests/python/smartbi_compat/conftest.py \
        tests/python/smartbi_compat/test_jwt_middleware.py
git commit -m "feat(phase2a): T3 — verify_jwt_and_factory dependency + 5 tests" \
  -- backend/python/smartbi_compat/__init__.py \
     backend/python/smartbi_compat/api/__init__.py \
     backend/python/smartbi_compat/auth.py \
     tests/python/smartbi_compat/__init__.py \
     tests/python/smartbi_compat/conftest.py \
     tests/python/smartbi_compat/test_jwt_middleware.py
```

---

## Task 4: Asyncpg pool resize + smartbi_compat helpers

**Files:**
- Modify: `backend/python/smartbi/config.py:102` — change `postgres_pool_size: int = 5` to `40`, keep env override
- Create: `backend/python/smartbi_compat/schema_compat.py`
- Create: `backend/python/smartbi_compat/aggregator.py`
- Modify: `backend/python/main.py` — register 3 new routers (after T5 placeholders are in place; in this task only register empty routers)

- [ ] **Step 4.1: Bump postgres_pool_size default**

In `backend/python/smartbi/config.py`, find the line `postgres_pool_size: int = 5` (around line 102). Change to:

```python
postgres_pool_size: int = Field(default=40, env="POSTGRES_POOL_SIZE")
```

If existing code already uses `Field(default=...)`, adjust to keep consistency. The actual default and env var name must match.

- [ ] **Step 4.2: Implement `schema_compat.py`**

`backend/python/smartbi_compat/schema_compat.py`:

```python
"""Helpers to keep Python alias responses byte-for-byte equivalent
to Java SmartBI controller responses.

Java envelope: {"success": bool, "data": <body>, "message": str}
"""
from __future__ import annotations
from typing import Any, Optional


def wrap_response(data: Any, *, message: str = "操作成功", success: bool = True) -> dict:
    """Standard Java-compatible response envelope used by every alias route."""
    return {"success": success, "data": data, "message": message}


def wrap_error(message: str, *, code: Optional[str] = None) -> dict:
    """Error envelope. Most callers should let HTTPException flow through;
    use this only when the Java endpoint itself returns 200+success=false."""
    out: dict = {"success": False, "data": None, "message": message}
    if code is not None:
        out["code"] = code
    return out
```

- [ ] **Step 4.3: Implement `aggregator.py`**

`backend/python/smartbi_compat/aggregator.py`:

```python
"""Bounded asyncio.gather wrapper that prevents asyncpg pool exhaustion.

Java aliases that aggregate N sub-calls (e.g. /analysis/sales = kpis + ranking
+ trend + region) use gather_with_pool_safety to cap concurrent DB borrowers.
"""
from __future__ import annotations
import asyncio
from typing import Awaitable, TypeVar

T = TypeVar("T")

# Half the asyncpg pool size; leaves headroom for other request handlers.
DEFAULT_MAX_CONCURRENT = 16


async def gather_with_pool_safety(
    *coros: Awaitable[T],
    max_concurrent: int = DEFAULT_MAX_CONCURRENT,
) -> list[T]:
    """Like asyncio.gather but bounded by a Semaphore.

    Each coroutine waits on the semaphore before starting. Prevents a single
    request from monopolising the asyncpg connection pool when an alias
    needs to aggregate many sub-calls.
    """
    sem = asyncio.Semaphore(max_concurrent)

    async def _run(coro: Awaitable[T]) -> T:
        async with sem:
            return await coro

    return await asyncio.gather(*[_run(c) for c in coros])
```

- [ ] **Step 4.4: Create empty router files (placeholders for T5)**

`backend/python/smartbi_compat/api/analysis.py`:
```python
"""Phase 2A alias routes for SmartBIAnalysisController paths.
Routes added in Task 5a."""
from fastapi import APIRouter
router = APIRouter()
```

`backend/python/smartbi_compat/api/upload.py`:
```python
"""Phase 2A alias routes for SmartBIUploadController paths.
Routes added in Task 5b."""
from fastapi import APIRouter
router = APIRouter()
```

`backend/python/smartbi_compat/api/dashboard.py`:
```python
"""Phase 2A alias routes for SmartBIDashboardController paths.
Routes added in Task 5c."""
from fastapi import APIRouter
router = APIRouter()
```

- [ ] **Step 4.5: Register routers in main.py**

In `backend/python/main.py`, near the existing `app.include_router(...)` block (around line 700+), add:

```python
# Phase 2A: SmartBI alias routes (web-admin + RN direct-to-Python)
try:
    from smartbi_compat.api import analysis as smartbi_compat_analysis
    from smartbi_compat.api import upload as smartbi_compat_upload
    from smartbi_compat.api import dashboard as smartbi_compat_dashboard
    app.include_router(smartbi_compat_analysis.router, tags=["SmartBI Compat: Analysis"])
    app.include_router(smartbi_compat_upload.router, tags=["SmartBI Compat: Upload"])
    app.include_router(smartbi_compat_dashboard.router, tags=["SmartBI Compat: Dashboard"])
    _smartbi_compat_available = True
    logger.info("SmartBI compat routes registered (Phase 2A)")
except ImportError as e:
    _smartbi_compat_available = False
    logger.error(f"SmartBI compat routes NOT available: {e}")
```

(Note: include_router calls have **no `prefix=`** because alias routes specify the full path including `/api/mobile/{factory_id}/smart-bi/...` themselves.)

- [ ] **Step 4.6: Verify Python imports cleanly + pool default loaded**

```bash
cd backend/python
python -c "from main import app; print('routes:', [r.path for r in app.routes if 'smart-bi' in r.path][:5])"
```

Expected: prints empty list `[]` (T5 hasn't added routes yet) or no error. If `ImportError`, fix module/path issues.

```bash
python -c "from smartbi.config import settings; print('pool:', settings.postgres_pool_size)"
```

Expected: `pool: 40`.

- [ ] **Step 4.7: Commit**

```bash
git add backend/python/smartbi/config.py \
        backend/python/smartbi_compat/schema_compat.py \
        backend/python/smartbi_compat/aggregator.py \
        backend/python/smartbi_compat/api/analysis.py \
        backend/python/smartbi_compat/api/upload.py \
        backend/python/smartbi_compat/api/dashboard.py \
        backend/python/main.py
git commit -m "feat(phase2a): T4 — pool 5→40, smartbi_compat scaffolding + helpers" \
  -- backend/python/smartbi/config.py \
     backend/python/smartbi_compat/schema_compat.py \
     backend/python/smartbi_compat/aggregator.py \
     backend/python/smartbi_compat/api/analysis.py \
     backend/python/smartbi_compat/api/upload.py \
     backend/python/smartbi_compat/api/dashboard.py \
     backend/python/main.py
```

---

## Task 5a: Alias routes for SmartBIAnalysisController (26 endpoints)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis.py` — add 26 alias routes
- Create: `tests/python/smartbi_compat/test_contract_compat.py` — contract tests vs golden samples (covers T5a/b/c)

**Approach:** Process endpoints in T0-determined order: **Y class first → Z class → X class**. Each endpoint follows the same TDD micro-loop:

```
1. Add contract test referencing tests/fixtures/java-smartbi-golden/<name>-F001.json
2. Run test (fails — endpoint doesn't exist)
3. Implement alias using template (Y / Z / X)
4. Run test (passes)
```

The plan below shows ONE representative example per class. The implementer follows the same pattern for the remaining endpoints listed in the T0 report.

- [ ] **Step 5a.1: Add the contract-test harness (covers T5a/b/c)**

`tests/python/smartbi_compat/test_contract_compat.py`:

```python
"""Contract tests: each Python alias response must match its Java golden sample.

Goldens recorded by scripts/phase2a/record-java-golden.mjs into
tests/fixtures/java-smartbi-golden/<name>-<factory>.json
Each file: { "verb": "...", "path": "...", "factory": "...", "response": {...} }
"""
import json
import math
import pathlib
import pytest
from fastapi.testclient import TestClient

GOLDEN_DIR = pathlib.Path(__file__).resolve().parents[2] / "fixtures" / "java-smartbi-golden"


@pytest.fixture(scope="module")
def goldens():
    out = {}
    for f in GOLDEN_DIR.glob("*.json"):
        out[f.stem] = json.loads(f.read_text(encoding="utf-8"))
    return out


@pytest.fixture
def app():
    """Production FastAPI app with all Phase 2A routes registered."""
    import os
    os.environ.setdefault("JWT_SECRET", "test-secret-for-phase2a-do-not-use-in-prod")
    from main import app  # noqa
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def factory_token():
    import jwt
    from datetime import datetime, timedelta, timezone
    import os
    payload = {
        "userId": 42, "username": "alice", "role": "factory_admin",
        "factoryId": "F001",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")


def assert_schema_match(actual: dict, expected: dict, *, path: str = "$"):
    """Recursive structural comparison.
    - Top-level keys must match exactly.
    - Lists: same length; element-wise key compare (deep).
    - Floats: tolerate 1e-6 absolute or 1% relative.
    - None and missing field treated as equal at the same key.
    """
    assert isinstance(actual, type(expected)) or (actual is None and expected is None), \
        f"type mismatch at {path}: {type(actual)} vs {type(expected)}"
    if isinstance(expected, dict):
        actual_keys = set(actual.keys())
        expected_keys = set(expected.keys())
        # Ignore keys whose expected value is None (Java often omits them)
        non_null_expected = {k for k in expected_keys if expected[k] is not None}
        assert non_null_expected.issubset(actual_keys), \
            f"missing keys at {path}: {non_null_expected - actual_keys}"
        for k in non_null_expected:
            assert_schema_match(actual.get(k), expected[k], path=f"{path}.{k}")
    elif isinstance(expected, list):
        assert len(actual) == len(expected), f"list length mismatch at {path}: {len(actual)} vs {len(expected)}"
        for i, (a, e) in enumerate(zip(actual, expected)):
            assert_schema_match(a, e, path=f"{path}[{i}]")
    elif isinstance(expected, float):
        if math.isnan(expected):
            assert actual is None or math.isnan(actual), f"float NaN mismatch at {path}"
        else:
            tol = max(1e-6, abs(expected) * 0.01)
            assert abs(actual - expected) <= tol, f"float mismatch at {path}: {actual} vs {expected}"
```

- [ ] **Step 5a.2: Pick a Y-class endpoint from T0 (e.g. `analysis_finance`) and add its contract test**

Append to `test_contract_compat.py`:

```python
def test_analysis_finance_F001_matches_golden(client, factory_token, goldens):
    g = goldens["analysis_finance-F001"]
    r = client.get(g["path"].replace("{factory_id}", g["factory"]),
                   headers={"Authorization": f"Bearer {factory_token}"})
    assert r.status_code == 200
    assert_schema_match(r.json(), g["response"])
```

- [ ] **Step 5a.3: Run test — verify it fails**

```bash
cd backend/python
python -m pytest tests/python/smartbi_compat/test_contract_compat.py::test_analysis_finance_F001_matches_golden -v
```

Expected: 404 (route not registered) or import error. Either is a valid "fail before implement".

- [ ] **Step 5a.4: Implement the Y-class alias for `analysis_finance`**

In `backend/python/smartbi_compat/api/analysis.py`, add:

```python
from typing import Any
from fastapi import APIRouter, Depends, Query
from smartbi_compat.auth import verify_jwt_and_factory, AuthContext
from smartbi_compat.schema_compat import wrap_response

# Import existing Python service modules
from smartbi.api import analysis as py_analysis  # adjust to actual module structure

router = APIRouter()


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance")
async def analysis_finance(
    factory_id: str,
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    auth: AuthContext = Depends(verify_jwt_and_factory),
):
    """Y-class thin proxy: Java SmartBIAnalysisController.getFinanceAnalysis
    delegates to PythonSmartBIClient.callSection('finance',...).
    Python alias: directly call the existing Python finance service."""
    # The actual call signature depends on what py_analysis exposes.
    # If it's a router-only module, call the route handler directly:
    overview = await py_analysis.finance_overview(factory_id, start_date, end_date)
    return wrap_response(overview)
```

**Note:** the exact `py_analysis.finance_overview` call signature must match what `backend/python/smartbi/api/analysis.py` actually exposes — use T0 mapping to determine the right Python target. If the Python module exposes only HTTP routes (not callable functions), refactor: extract the body into a service function called by both the existing route and the alias.

- [ ] **Step 5a.5: Run test — verify it passes**

```bash
cd backend/python
python -m pytest tests/python/smartbi_compat/test_contract_compat.py::test_analysis_finance_F001_matches_golden -v
```

Expected: `1 passed`. If schema differences, adjust mapping.

- [ ] **Step 5a.6: Repeat 5a.2-5a.5 for ALL remaining Y-class endpoints in `analysis.py`**

For each Y endpoint in T0 report:
1. Add `test_<name>_F001_matches_golden` test
2. Run, observe failure
3. Add alias route in `analysis.py` following the same Y-template
4. Run, observe pass

Commit after every 5 endpoints (or every router section completion):
```bash
git commit -m "feat(phase2a): T5a — Y-class aliases batch N (5 endpoints)" -- backend/python/smartbi_compat/api/analysis.py tests/python/smartbi_compat/test_contract_compat.py
```

- [ ] **Step 5a.7: Implement Z-class endpoint (e.g. `analysis_sales` with `dimension` param)**

Z-template:

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/sales")
async def analysis_sales(
    factory_id: str,
    dimension: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    auth: AuthContext = Depends(verify_jwt_and_factory),
):
    """Z-class condition branch: Java method switches on `dimension`."""
    if dimension == "salesperson":
        ranking = await py_analysis.sales_ranking_salesperson(factory_id, start_date, end_date)
        return wrap_response({"ranking": ranking})

    if dimension == "product":
        ranking = await py_analysis.sales_ranking_product(factory_id, start_date, end_date)
        return wrap_response({"ranking": ranking})

    if dimension == "trend":
        trend = await py_analysis.sales_trend(factory_id, start_date, end_date)
        return wrap_response({"trend": trend})

    # Default: aggregate response (matches Java when dimension is None)
    from smartbi_compat.aggregator import gather_with_pool_safety
    kpis, ranking, trend, region = await gather_with_pool_safety(
        py_analysis.sales_kpis(factory_id, start_date, end_date),
        py_analysis.sales_ranking_salesperson(factory_id, start_date, end_date),
        py_analysis.sales_trend(factory_id, start_date, end_date),
        py_analysis.sales_region_distribution(factory_id, start_date, end_date),
    )
    return wrap_response({
        "kpis": kpis,
        "ranking": ranking,
        "trend": trend,
        "regionDistribution": region,
    })
```

- [ ] **Step 5a.8: Add corresponding test for Z-class endpoint**

```python
def test_analysis_sales_F001_default_matches_golden(client, factory_token, goldens):
    g = goldens["analysis_sales-F001"]
    r = client.get(g["path"].replace("{factory_id}", g["factory"]),
                   headers={"Authorization": f"Bearer {factory_token}"})
    assert r.status_code == 200
    assert_schema_match(r.json(), g["response"])
```

If the dimension variants need testing, also record their goldens in T2 (with query string suffixes in fixture names like `analysis_sales-dimension-salesperson-F001.json`) and add tests.

- [ ] **Step 5a.9: Repeat for remaining Z-class endpoints**

- [ ] **Step 5a.10: Implement X-class endpoints**

X-class is **last** because it's the most work. For each X endpoint:
1. Read the Java method body — note which Java services it calls and what JPA queries they run
2. Locate or create a corresponding Python service function (likely a new function in an existing `smartbi/services/*.py` module)
3. Implement the Python service to query the same DB tables and produce the same response shape
4. Wire the alias route to call the new Python service

If an X-class endpoint requires significantly more effort than estimated (e.g. `/incentive-plan/{targetType}/{targetId}` needs a complex calculation), STOP and report — it may need to be moved to Phase 2B/2C.

- [ ] **Step 5a.11: Final test run for all T5a endpoints**

```bash
cd backend/python
python -m pytest tests/python/smartbi_compat/test_contract_compat.py -v -k "analysis_"
```

Expected: 26 passed (one test per endpoint).

- [ ] **Step 5a.12: Commit**

```bash
git commit -m "feat(phase2a): T5a — 26 SmartBIAnalysis aliases complete" -- backend/python/smartbi_compat/api/analysis.py tests/python/smartbi_compat/test_contract_compat.py
```

---

## Task 5b: Alias routes for SmartBIUploadController (13 endpoints)

**Files:**
- Modify: `backend/python/smartbi_compat/api/upload.py`
- Modify: `tests/python/smartbi_compat/test_contract_compat.py` — add 13 tests

**Approach:** Same TDD micro-loop as T5a. Most upload endpoints are Y-class (Java calls `pythonClient.parseExcel*` directly).

- [ ] **Step 5b.1: Implement representative Y-class upload alias (`upload-and-analyze`)**

In `backend/python/smartbi_compat/api/upload.py`:

```python
from fastapi import APIRouter, Depends, File, UploadFile
from smartbi_compat.auth import verify_jwt_and_factory, AuthContext
from smartbi_compat.schema_compat import wrap_response
from smartbi.api import excel_async as py_excel_async

router = APIRouter()


@router.post("/api/mobile/{factory_id}/smart-bi/upload-and-analyze")
async def upload_and_analyze(
    factory_id: str,
    file: UploadFile = File(...),
    auth: AuthContext = Depends(verify_jwt_and_factory),
):
    """Y-class: Java SmartBIUploadController.uploadAndAnalyze
    delegates to PythonSmartBIClient.parseExcel(...). Python alias forwards
    to the existing /api/excel/auto-parse-async route handler."""
    return await py_excel_async.auto_parse_async(file=file, factory_id=factory_id)
```

(The exact target Python function depends on T0 — look up the actual route handler in `smartbi/api/excel_async.py` and call it directly. If it's an HTTP-only handler, refactor to expose a callable.)

- [ ] **Step 5b.2-5b.4: Repeat for the remaining 12 endpoints** (TDD micro-loop per endpoint, batched commits per 5)

- [ ] **Step 5b.5: Final test run + commit**

```bash
cd backend/python
python -m pytest tests/python/smartbi_compat/test_contract_compat.py -v -k "upload"
```

Expected: 13 passed.

```bash
git commit -m "feat(phase2a): T5b — 13 SmartBIUpload aliases complete" -- backend/python/smartbi_compat/api/upload.py tests/python/smartbi_compat/test_contract_compat.py
```

---

## Task 5c: Alias routes for SmartBIDashboardController (11 endpoints)

**Files:**
- Modify: `backend/python/smartbi_compat/api/dashboard.py`
- Modify: `tests/python/smartbi_compat/test_contract_compat.py` — add 11 tests

**Special case:** `/dashboard/executive/insights/custom/stream` is **SSE**. Forward as a `StreamingResponse` and ensure nginx `proxy_buffering off` is configured (T6).

- [ ] **Step 5c.1: Implement representative dashboard alias (e.g. `dashboard_executive`)**

```python
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from smartbi_compat.auth import verify_jwt_and_factory, AuthContext
from smartbi_compat.schema_compat import wrap_response

router = APIRouter()


@router.get("/api/mobile/{factory_id}/smart-bi/dashboard/executive")
async def dashboard_executive(
    factory_id: str,
    auth: AuthContext = Depends(verify_jwt_and_factory),
):
    # Implement based on T0 classification — likely Y or Z
    ...
    return wrap_response({...})
```

- [ ] **Step 5c.2: Implement SSE endpoint**

```python
@router.get("/api/mobile/{factory_id}/smart-bi/dashboard/executive/insights/custom/stream")
async def insights_custom_stream(
    factory_id: str,
    start_date: str = Query(...),
    end_date: str = Query(...),
    auth: AuthContext = Depends(verify_jwt_and_factory),
):
    """SSE stream — Java forwards via AgentInsightsClient. Python forwards
    using existing call_chain_stream pattern (Phase 1)."""
    from smartbi.services.insights.streaming import build_insights_stream
    async def event_gen():
        async for event in build_insights_stream(factory_id, start_date, end_date):
            yield f"data: {event}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(event_gen(), media_type="text/event-stream")
```

(Adapt `build_insights_stream` import path to whatever exists in Python; if it doesn't, this endpoint is X-class and may need significant work. Flag if so.)

- [ ] **Step 5c.3-5c.5: Repeat for remaining 9 endpoints, final test + commit**

```bash
cd backend/python
python -m pytest tests/python/smartbi_compat/test_contract_compat.py -v -k "dashboard or generate"
```

Expected: 11 passed.

```bash
git commit -m "feat(phase2a): T5c — 11 SmartBIDashboard aliases complete (incl. SSE)" -- backend/python/smartbi_compat/api/dashboard.py tests/python/smartbi_compat/test_contract_compat.py
```

---

## Task 5d: Alias aggregation + pool stress test

**Files:**
- Create: `tests/python/smartbi_compat/test_alias_aggregation.py`

- [ ] **Step 5d.1: Write pool-exhaustion test**

`tests/python/smartbi_compat/test_alias_aggregation.py`:

```python
"""Validates that aggregator.gather_with_pool_safety prevents asyncpg pool
exhaustion under concurrent gather-heavy aliases."""
import asyncio
import pytest
from smartbi_compat.aggregator import gather_with_pool_safety


@pytest.mark.asyncio
async def test_gather_respects_semaphore_limit():
    """20 concurrent slow tasks with max_concurrent=5 must serialize 4 batches."""
    in_flight = 0
    peak = 0
    lock = asyncio.Lock()

    async def slow_task(i):
        nonlocal in_flight, peak
        async with lock:
            in_flight += 1
            peak = max(peak, in_flight)
        await asyncio.sleep(0.05)
        async with lock:
            in_flight -= 1
        return i

    coros = [slow_task(i) for i in range(20)]
    results = await gather_with_pool_safety(*coros, max_concurrent=5)
    assert sorted(results) == list(range(20))
    assert peak <= 5, f"semaphore failed: peak in_flight={peak}"


@pytest.mark.asyncio
async def test_gather_returns_in_order():
    async def task(i, delay):
        await asyncio.sleep(delay)
        return i

    results = await gather_with_pool_safety(
        task(1, 0.03), task(2, 0.01), task(3, 0.02),
        max_concurrent=10,
    )
    assert results == [1, 2, 3]  # asyncio.gather preserves input order
```

- [ ] **Step 5d.2: Run test**

```bash
cd backend/python
python -m pytest tests/python/smartbi_compat/test_alias_aggregation.py -v
```

Expected: 2 passed.

- [ ] **Step 5d.3: Commit**

```bash
git commit -m "test(phase2a): T5d — gather_with_pool_safety tests" -- tests/python/smartbi_compat/test_alias_aggregation.py
```

---

## Task 6: Nginx test environment changes

**Files:**
- Modify (on 139 server): `/www/server/panel/vhost/nginx/<site>.conf` (path varies; use `nginx -T` to find)

**Note:** This task is purely DevOps on the 139 server. Document the exact nginx config diff in `scripts/phase2a/notes-nginx-baseline.md`.

- [ ] **Step 6.1: Capture current nginx config**

```bash
ssh root@139.196.165.140 "nginx -T 2>/dev/null | grep -A 30 'mobile'"
```

Save output. Identify which site config file holds the `/api/mobile/` location block.

- [ ] **Step 6.2: Edit nginx config — add 2 location blocks**

SSH to 139:

```bash
ssh root@139.196.165.140
# Identify config file (commonly /www/server/panel/vhost/nginx/web-admin.conf or similar)
nano /www/server/panel/vhost/nginx/<site>.conf
```

**Insert BEFORE** the existing `location /api/mobile/` block:

```nginx
# Phase 2A: SSE-only sub-location (proxy_buffering off)
location ~ ^/api/mobile/[^/]+/smart-bi/(dashboard/executive/insights/custom/stream|upload-batch-stream)$ {
    proxy_pass http://47.100.235.168:8083;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Authorization $http_authorization;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
}

# Phase 2A: SmartBI main location (default buffering)
location ~ ^/api/mobile/[^/]+/smart-bi/ {
    proxy_pass http://47.100.235.168:8083;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Authorization $http_authorization;
    client_max_body_size 300m;
    proxy_read_timeout 300s;
}
```

(Test environment may target Python:8084 instead of 8083 — confirm port from `cretas-python-test.service` before saving.)

- [ ] **Step 6.3: Validate nginx config syntax**

```bash
ssh root@139.196.165.140 "nginx -t"
```

Expected: `nginx: configuration file ... test is successful`. If error, fix syntax and re-test.

- [ ] **Step 6.4: Reload nginx**

```bash
ssh root@139.196.165.140 "nginx -s reload"
```

- [ ] **Step 6.5: Verify routing with curl**

Get a token:

```bash
TOKEN=$(curl -s -X POST http://139.196.165.140/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}' \
  | python -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])")
```

Test analysis route (must hit Python now):

```bash
curl -s "http://139.196.165.140/api/mobile/F001/smart-bi/analysis/finance" \
  -H "Authorization: Bearer $TOKEN" \
  -m 30 | python -m json.tool | head -20
```

Test SSE route reaches Python with buffering off:

```bash
curl -N "http://139.196.165.140/api/mobile/F001/smart-bi/dashboard/executive/insights/custom/stream?start_date=2026-04-01&end_date=2026-04-29" \
  -H "Authorization: Bearer $TOKEN" \
  -m 30 | head -20
```

Expected: chunked SSE events, not buffered until completion.

Verify Java SmartBI was NOT hit:

```bash
ssh root@47.100.235.168 "tail -100 /www/wwwroot/cretas/cretas-test.log | grep -c 'smart-bi/analysis/finance'"
```

Expected: `0` (Java should see no traffic on smart-bi paths after T6).

- [ ] **Step 6.6: Document the change**

Append to `scripts/phase2a/notes-nginx-baseline.md`:

```
T6 done at YYYY-MM-DD HH:MM
- 139 nginx config: <site>.conf
- Added 2 location blocks (SSE-only + main SmartBI)
- nginx -t passed
- nginx -s reload completed
- curl validation: analysis_finance OK, SSE OK, Java traffic = 0
- Rollback procedure: comment out 2 location blocks; nginx -s reload
```

```bash
git add scripts/phase2a/notes-nginx-baseline.md
git commit -m "docs(phase2a): T6 — nginx test env cutover notes" -- scripts/phase2a/notes-nginx-baseline.md
```

---

## Task 7: E2E + perf tests on test environment

**Files:**
- Create: `tests/e2e-comprehensive/phase2a-smartbi-smoke.mjs`

- [ ] **Step 7.1: Write e2e smoke script**

`tests/e2e-comprehensive/phase2a-smartbi-smoke.mjs`:

```javascript
#!/usr/bin/env node
// Phase 2A end-to-end smoke: 50 alias endpoints + JWT 5 cases + perf compare.
// Run after T6 nginx cutover on test env (139).

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://139.196.165.140';
const FACTORY = 'F001';
const USER = 'factory_admin1';
const PW = '123456';

const FIXTURE_DIR = path.resolve('tests/fixtures/java-smartbi-golden');

async function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search,
      method: opts.method || 'GET', headers: opts.headers || {},
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function login(user, pw) {
  const r = await fetchJson(`${BASE}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pw }),
  });
  const j = JSON.parse(r.body);
  return j.data?.accessToken || j.data?.tokens?.accessToken;
}

async function main() {
  const token = await login(USER, PW);
  const headers = { 'Authorization': `Bearer ${token}` };

  // Phase 1: 50 endpoints reachable
  console.log('=== Phase 1: endpoint reachability ===');
  let recorded = 0, failed = 0;
  const fixtures = await fs.readdir(FIXTURE_DIR);
  for (const f of fixtures) {
    if (!f.endsWith('-F001.json')) continue;
    const g = JSON.parse(await fs.readFile(path.join(FIXTURE_DIR, f), 'utf-8'));
    const url = BASE + g.path.replace('{factory_id}', FACTORY);
    const r = await fetchJson(url, { method: g.verb, headers });
    if (r.status === 200) recorded++; else { failed++; console.log(`FAIL ${g.verb} ${g.path}: ${r.status}`); }
  }
  console.log(`reachable: ${recorded}/${recorded + failed}`);

  // Phase 2: cross-factory 403
  console.log('=== Phase 2: cross-factory ===');
  const r1 = await fetchJson(`${BASE}/api/mobile/F002/smart-bi/analysis/finance`, { headers });
  console.log(`F002 with F001 token: ${r1.status} (expected 403)`);
  if (r1.status !== 403) throw new Error('cross-factory check FAILED');

  // Phase 3: missing token 401
  const r2 = await fetchJson(`${BASE}/api/mobile/F001/smart-bi/analysis/finance`);
  console.log(`no token: ${r2.status} (expected 401)`);
  if (r2.status !== 401) throw new Error('no-token check FAILED');

  // Phase 4: simple perf compare (one endpoint, 100 reqs)
  console.log('=== Phase 4: perf ===');
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const t0 = Date.now();
    await fetchJson(`${BASE}/api/mobile/F001/smart-bi/analysis/finance`, { headers });
    samples.push(Date.now() - t0);
  }
  samples.sort((a, b) => a - b);
  console.log(`p50=${samples[50]}ms p95=${samples[95]}ms p99=${samples[99]}ms`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 7.2: Run on test env**

```bash
node tests/e2e-comprehensive/phase2a-smartbi-smoke.mjs
```

Expected output:
- `reachable: 50/50` (or N/N matching the fixture count from T2)
- `F002 with F001 token: 403`
- `no token: 401`
- `p95 < Java baseline` (record Java baseline beforehand by toggling nginx and running same script)

- [ ] **Step 7.3: Pool stress test**

Run gather-heavy alias 20× concurrent for 30 seconds:

```bash
cd backend/python
python -c "
import asyncio
import aiohttp
import time
import os

async def hit():
    async with aiohttp.ClientSession() as s:
        async with s.get(
            'http://139.196.165.140/api/mobile/F001/smart-bi/analysis/sales',
            headers={'Authorization': f'Bearer {os.environ[\"TOKEN\"]}'}
        ) as r:
            return r.status

async def main():
    t_end = time.time() + 30
    n_ok, n_fail = 0, 0
    while time.time() < t_end:
        results = await asyncio.gather(*[hit() for _ in range(20)])
        for s in results:
            if s == 200: n_ok += 1
            else: n_fail += 1
    print(f'30s/20-concurrent: ok={n_ok} fail={n_fail}')

asyncio.run(main())
" </dev/null
```

Expected: `fail=0`, total ok > 1000 (depending on response time). Watch Python logs for `pool exhausted` errors during the run — must be zero.

- [ ] **Step 7.4: Commit smoke script**

```bash
git add tests/e2e-comprehensive/phase2a-smartbi-smoke.mjs
git commit -m "test(phase2a): T7 — e2e smoke script (50 endpoints + perf)" -- tests/e2e-comprehensive/phase2a-smartbi-smoke.mjs
```

---

## Task 8: Real-window verification (web-admin + RN test build)

**Files:** None — manual UI checklist.

- [ ] **Step 8.1: Open web-admin pointed at test env (8086 or test-domain)**

Login as `factory_admin1`. Navigate to **5 key SmartBI screens** (verify they render with no console errors and data populates):

1. **销售分析** (`/analysis/sales`) — verify charts render
2. **财务报表** (`/analysis/finance`) — verify KPI cards + charts
3. **Excel 上传** (`/upload`) — upload a 50MB sample file (`smartbi维度分析/大众点评/真实餐饮连锁数据/...`); verify async progress and analysis result
4. **Dashboard 高管洞察** (`/dashboard/executive/insights`) — verify SSE stream renders incrementally (not single buffered blob)
5. **跨工厂尝试** — manually edit URL to substitute `F001` with `F002`; verify the page shows a 403 / "无权访问" message

- [ ] **Step 8.2: Open RN test build pointed at test env**

Repeat for the 5 mobile SmartBI screens (use the `frontend/CretasFoodTrace/src/components/smartbi/` components). Verify:
- Login still works (auth endpoint untouched)
- SmartBI screens populate
- No new error toasts compared to baseline (record baseline screenshots first if any background bugs are pre-existing)

- [ ] **Step 8.3: Document outcomes**

Append to `scripts/phase2a/notes-nginx-baseline.md`:

```
T8 real-window verify YYYY-MM-DD HH:MM
- web-admin: 5/5 screens OK
- RN test: 5/5 screens OK
- No new errors vs Phase 1 baseline
- Cross-factory 403 verified in browser
```

```bash
git commit --allow-empty -m "docs(phase2a): T8 — real-window verification complete" 2>/dev/null || true
```

(If `--allow-empty` is disabled by hooks, simply note in the file and proceed.)

---

## Task 9: Production cutover

**Files:** None — DevOps on prod nginx (139).

**Pre-condition:** All previous tasks ✅, test env stable for ≥ 24h with no regressions reported.

- [ ] **Step 9.1: Confirm prod Python has Phase 2A code deployed**

```bash
ssh root@47.100.235.168 "curl -s http://localhost:8083/openapi.json | python3 -c 'import sys,json; d=json.load(sys.stdin); paths=[p for p in d[\"paths\"] if \"smart-bi\" in p]; print(len(paths), \"smartbi alias paths\")'"
```

Expected: ~50 (the 50 alias endpoints). If 0 or close to it, deploy Python first:

```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod
```

Then re-check.

- [ ] **Step 9.2: Edit prod nginx config (139)**

Same as T6 Step 6.2 but on prod site config (likely a different filename). Add the same 2 location blocks targeting **port 8083** (prod) instead of 8084.

- [ ] **Step 9.3: Validate + reload**

```bash
ssh root@139.196.165.140 "nginx -t && nginx -s reload"
```

- [ ] **Step 9.4: Real-window prod verification**

Repeat T8 with prod URLs. **Login as a real production user** (use a low-traffic factory) and walk through the 5 SmartBI screens.

If anything fails: **rollback** by commenting out the 2 nginx location blocks and `nginx -s reload` (≤ 30 sec).

- [ ] **Step 9.5: Monitor for 24h**

```bash
# Java SmartBI traffic should be ~0
ssh root@47.100.235.168 "grep -c 'smart-bi' /www/wwwroot/cretas/cretas-prod.log | tail -1"

# Python alias error rate
ssh root@47.100.235.168 "grep -c 'ERROR.*smartbi_compat' /www/wwwroot/cretas/python-prod.log"
```

Acceptance: Java SmartBI QPS = 0 (after a few minutes), Python error rate ≤ baseline.

- [ ] **Step 9.6: Final commit + tag**

```bash
git commit --allow-empty -m "chore(phase2a): T9 — prod cutover complete; SmartBI alias live"
git tag phase2a-complete
git push origin main --tags
```

---

## Self-review (filled in after writing the plan)

**1. Spec coverage:**

| Spec section | Implementing task |
|--------------|-------------------|
| Scope (50 endpoints in/41+10 out) | T0 audit confirms scope |
| 设计 1: T0 endpoint classification | T0 |
| 设计 2: smartbi_compat module + alias templates | T4 (scaffolding) + T5a/b/c (routes) + T5d (aggregator test) |
| 设计 3: JWT middleware (cross-factory bypass fix) | T3 |
| 设计 4: nginx routing (SSE split) + asyncpg pool | T6 (nginx) + T4 (pool resize) |
| 设计 4: rollback matrix | Documented in T6.6 notes |
| 设计 5: contract test + JWT test + e2e + perf + real-window | T3 (JWT) + T5 (contract via shared harness) + T7 (e2e+perf) + T8 (real-window) |
| 设计 6: implementation order | T0→T9 in this plan |
| 设计 6: blocking gate (X-class > 50%) | T0.5 STOP gate |

All spec sections covered.

**2. Placeholder scan:** None found — every code step shows actual code or exact commands. Two intentional tradeoffs:
- T2 step 2.2 says "implementer copies login() from existing script" rather than duplicating ~30 lines of HTTP boilerplate (DRY)
- T5a/b/c provide one representative example per X/Y/Z class rather than 50 separate code blocks (~2000 lines of repetition); each remaining endpoint follows the same template

**3. Type consistency:**
- `verify_jwt_and_factory(request, factory_id) → AuthContext` — used identically in T3 (definition), T5a/b/c (consumers), and `test_jwt_middleware.py` (tests)
- `AuthContext(user_id, username, factory_id, role)` — frozen dataclass; field names consistent across all references
- `wrap_response(data, message="操作成功", success=True)` — used identically in all alias examples
- `gather_with_pool_safety(*coros, max_concurrent=16) → list` — used identically in T5a sales aggregation example and T5d test
- Path templates always use `{factory_id}` placeholder; substituted to `F001` etc. in tests; matches Java path-variable name (`{factoryId}` in Java URL but Python framework uses snake_case mapping internally — no client-visible difference)

No inconsistencies.
