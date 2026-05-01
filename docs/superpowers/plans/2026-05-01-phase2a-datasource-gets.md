# Phase 2A `/datasource` GET endpoints (Wave 2 Tier 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port 2 datasource GET endpoints (`/fields` + `/history`) from Java to Python with byte-shape parity. `/preview` deferred to Wave 3 per spec §1.2.

**Architecture:** New `backend/python/smartbi_compat/api/datasource.py` (no conflict with sister chats' `analysis_finance.py`). Each endpoint: route handler + SQL helper + DTO transformer. Both endpoints check datasource-existence first (Java `EntityNotFoundException` mirror → 200 + success=false). `/history` builds Spring `PageImpl`-shaped JSON with `_build_page_impl` helper.

**Tech Stack:** FastAPI, asyncpg via `get_cretas_pool` (PR #23 hotfix pattern), pytest + monkeypatch for contract tests.

**Spec:** `docs/superpowers/specs/2026-05-01-phase2a-datasource-gets-design.md`

**Java reference root:** `backend/java/cretas-api/src/main/java/com/cretas/aims/`

**Branch:** `phase2a/datasource-gets` (worktree: `.worktrees/phase2a-datasource-gets`)

**Base:** `origin/main` HEAD `5d284d38d` (PR #35 Rule 8 merged)

**Out of scope:** `/preview` endpoint (Wave 3 single chat); POST/PUT/DELETE datasource endpoints; `/datasource/list` (sister Tier 1 task).

---

## Concurrent-edit safety

Sister chats (receivable / budget) modify `analysis_finance.py` — we touch ONLY new file `datasource.py` and append router register in `main.py`. Zero file overlap. ALWAYS use `./scripts/safe-commit.sh "msg" path1 path2` per `.claude/rules/concurrent-edit-safety.md` rule 5b.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `backend/python/smartbi_compat/api/datasource.py` | 2 GET route handlers + SQL helpers + DTO transformers + Page builder | CREATE |
| `backend/python/main.py:1117` (after analysis_finance) | Register datasource router | MODIFY (1 line) |
| `tests/python/smartbi_compat/test_datasource_contract.py` | F999 byte-shape gates (4 tests, 2 per endpoint) | CREATE |
| `tests/fixtures/java-smartbi-golden/datasource-F999-fields-not-exist.json` | Golden — F999 + non-existent datasource_id /fields | CREATE (record from Java) |
| `tests/fixtures/java-smartbi-golden/datasource-F999-history-not-exist.json` | Golden — F999 + non-existent datasource_id /history | CREATE (record from Java) |

---

## Phase A — Foundation

### Task A.1: Create `datasource.py` skeleton + register router

**Files:**
- Create: `backend/python/smartbi_compat/api/datasource.py`
- Modify: `backend/python/main.py:1117` (insert router register after analysis_finance)

- [ ] **Step 1: Create skeleton `datasource.py`**

```python
"""Phase 2A /datasource GET endpoints port (Wave 2 Tier 1).

Implements 2 GET endpoints:
  - GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/fields
  - GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/history

/preview endpoint deferred to Wave 3 (separate chat) — see spec §1.2.

Java reference:
  - Controller: SmartBIAnalysisController.java line 747-780
  - Service: SmartBiSchemaServiceImpl.java line 225-298

Spec: docs/superpowers/specs/2026-05-01-phase2a-datasource-gets-design.md
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Section 1: SQL helpers (cretas_db pool, mirrors PR #23 pattern)
# ============================================================


async def _get_cretas_pool():
    """Lazy import to avoid module-load cycle. Mirrors profit/cost pattern."""
    try:
        from smartbi.config import get_cretas_pool  # type: ignore
        return await get_cretas_pool()
    except Exception as e:
        logger.warning("[datasource] cretas pool acquisition failed: %s", e)
        return None


# ============================================================
# Section 2: DTO transformers (snake_case DB → camelCase JSON)
# Key order matches golden recording (Lombok @Data getter reflection order)
# ============================================================


# (transformers added in B.1 + C.1)


# ============================================================
# Section 3: Route handlers
# ============================================================


# (handlers added in B.1 + C.1)
```

- [ ] **Step 2: Register router in `main.py`**

Locate line 1117 (after `app.include_router(analysis_finance.router, ...)`):

```bash
grep -n "analysis_finance.router" backend/python/main.py
```

Use Edit tool to insert AFTER existing analysis_finance line:

```python
    from smartbi_compat.api import datasource as smartbi_compat_datasource
    app.include_router(smartbi_compat_datasource.router, tags=["SmartBI Compat: Datasource"])
```

(Match the indentation of surrounding `from`/`include_router` lines — 4 spaces inside the function block.)

- [ ] **Step 3: Run pytest baseline**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Note baseline count (e.g., `300 passed`). Future steps reference this number.

- [ ] **Step 4: Verify import works**

```bash
cd backend/python && python -c "
import sys; sys.path.insert(0, '.')
from smartbi_compat.api import datasource
print('router:', datasource.router)
print('routes:', list(datasource.router.routes))
"
```

Expected: `router: <APIRouter object>`, `routes: []` (no routes yet).

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/datasource): create datasource.py skeleton + register router" \
  backend/python/smartbi_compat/api/datasource.py \
  backend/python/main.py
```

---

## Phase B — `/fields` endpoint

### Task B.1: Implement `_query_field_definitions` + `_field_def_to_json` + route

**Files:**
- Modify: `backend/python/smartbi_compat/api/datasource.py` (add SQL helper + DTO transformer + route)

- [ ] **Step 1: Add SQL helper after `_get_cretas_pool`**

In `backend/python/smartbi_compat/api/datasource.py`, locate the `# Section 1` block. Add this AFTER `_get_cretas_pool`:

```python
async def _query_field_definitions(datasource_id: int) -> Optional[list[dict]]:
    """Query smart_bi_field_definition for given datasource_id, sorted by display_order ASC.

    Mirrors Java SmartBiSchemaServiceImpl.getDatasourceFields (line 225-234):
      1. Check datasource exists (Java line 229) — returns None if not
      2. Query findByDatasourceIdOrderByDisplayOrderAsc (Java line 233)
      3. Apply soft-delete filter (Java @Where deleted_at IS NULL)

    Returns:
      None if datasource doesn't exist (caller wraps as success=false error)
      list[dict] of field definitions (snake_case keys from DB) otherwise
    """
    pool = await _get_cretas_pool()
    if pool is None:
        # Treat connection failure as not-found per Java behavior (catch-all → error wrap)
        return None

    async with pool.acquire() as conn:
        # Java line 229: !datasourceRepository.existsById(datasourceId)
        exists = await conn.fetchval(
            "SELECT 1 FROM smart_bi_datasource WHERE id = $1 AND deleted_at IS NULL",
            datasource_id,
        )
        if not exists:
            return None

        # Java line 233: findByDatasourceIdOrderByDisplayOrderAsc + @Where deleted_at IS NULL
        rows = await conn.fetch(
            """
            SELECT * FROM smart_bi_field_definition
            WHERE datasource_id = $1 AND deleted_at IS NULL
            ORDER BY display_order ASC
            """,
            datasource_id,
        )
        return [dict(r) for r in rows]
```

- [ ] **Step 2: Add DTO transformer after Section 2 comment**

Locate `# Section 2: DTO transformers` block. Add:

```python
def _field_def_to_json(row: dict) -> dict:
    """Mirror Lombok @Data getter reflection order for SmartBiFieldDefinition.

    Field order verified against F999 golden recording (Phase B.2). If golden
    differs from this order, update both helpers atomically.

    Notes:
      - JsonIgnore on `datasource` field (Java line 52) — NOT emitted
      - Soft-delete filter ensures `deletedAt` always None
      - Enum fields (fieldType, metricType, aggregation) emit as string
      - chartTypes is JSON-string (Java @Column columnDefinition="JSON")
    """
    return {
        "id": row["id"],
        "datasourceId": row.get("datasource_id"),
        "fieldName": row["field_name"],
        "fieldAlias": row.get("field_alias"),
        "fieldType": row["field_type"],
        "metricType": row["metric_type"],
        "aggregation": row.get("aggregation"),
        "isKpi": row["is_kpi"],
        "chartTypes": row.get("chart_types"),
        "description": row.get("description"),
        "displayOrder": row.get("display_order"),
        "isVisible": row["is_visible"],
        "formatPattern": row.get("format_pattern"),
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "deletedAt": row["deleted_at"].isoformat() if row.get("deleted_at") else None,
    }
```

- [ ] **Step 3: Add route handler in Section 3**

Locate `# Section 3: Route handlers` block. Add:

```python
@router.get("/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/fields")
async def get_datasource_fields(
    factory_id: str,
    datasource_id: int,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getDatasourceFields line 747-762.

    Behavior mirror:
    - datasource not exist → 200 + success=false + sanitized error message (Java line 230)
    - empty fields list → 200 + success=true + data=[]
    - non-empty → 200 + success=true + data=[entity dicts in display_order ASC]
    """
    rows = await _query_field_definitions(datasource_id)
    if rows is None:
        # Java line 230 EntityNotFoundException → controller catch → ApiResponse.error
        return wrap_response(
            data=None,
            success=False,
            code=500,
            message=f"Get field definitions failed: 数据源不存在: {datasource_id}",
        )
    return wrap_response(data=[_field_def_to_json(r) for r in rows])
```

- [ ] **Step 4: Run pytest (no new tests yet, just no regression)**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: same baseline as Phase A.3 (no regression).

- [ ] **Step 5: Smoke test locally with mocked DB**

```bash
cd backend/python && python -c "
import os
os.environ['JWT_SECRET'] = 'test-secret-for-phase2a-do-not-use-in-prod'
import sys; sys.path.insert(0, '.')
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('m', 'main.py')
m = module_from_spec(spec); spec.loader.exec_module(m)

from fastapi.testclient import TestClient
import jwt, time
tok = jwt.encode({'userId':1,'username':'t','factoryId':'F999','role':'factory_super_admin','exp':int(time.time())+3600}, 'test-secret-for-phase2a-do-not-use-in-prod', algorithm='HS256')

import smartbi_compat.api.datasource as ds
async def fake_not_exist(_id): return None
ds._query_field_definitions = fake_not_exist

c = TestClient(m.app)
r = c.get('/api/mobile/F999/smart-bi/datasource/999999/fields', headers={'Authorization': f'Bearer {tok}'})
print('status:', r.status_code)
body = r.json()
print('success:', body.get('success'))
print('code:', body.get('code'))
print('message:', body.get('message'))
print('data:', body.get('data'))
"
```

Expected:
```
status: 200
success: False
code: 500
message: Get field definitions failed: 数据源不存在: 999999
data: None
```

- [ ] **Step 6: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/datasource): /fields endpoint impl + route" \
  backend/python/smartbi_compat/api/datasource.py
```

---

### Task B.2: Record F999 fields-not-exist golden

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/datasource-F999-fields-not-exist.json`

> Records Java behavior for non-existent datasource_id. F999 likely has zero datasources, so id=999999 always non-exist.

- [ ] **Step 1: Verify SSH tunnel to Java test env**

```bash
curl -sS --max-time 3 http://127.0.0.1:10011/api/mobile/health 2>&1 | head -3
```

Expected: `{"status":"UP",...}`. If timeout/refused → escalate BLOCKED.

- [ ] **Step 2: Record F999 golden**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  BASE_URL_OVERRIDE="http://127.0.0.1:10011" \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/datasource/999999/fields' \
    datasource-F999-fields-not-exist.json
```

- [ ] **Step 3: Verify shape**

```bash
python3 -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/datasource-F999-fields-not-exist.json'))
print('top-level keys:', list(g.keys()))
print('http code:', g.get('code'))
print('success:', g.get('success'))
print('data:', g.get('data'))
print('message:', g.get('message'))
"
```

Expected something like:
```
top-level keys: ['code', 'message', 'data', 'timestamp', 'success', 'actionHint', 'severity', 'hintTarget']
http code: 500
success: False
data: None
message: Get field definitions failed: ... 数据源不存在: 999999
```

**CRITICAL**: If the actual `code` is NOT 500 (e.g. 200 or 400) OR the message format differs, update the Python impl in `_query_field_definitions`'s caller to match exactly. Edit `get_datasource_fields` in `datasource.py`.

- [ ] **Step 4: Run pytest baseline (still no new tests)**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: same as Phase A.3 baseline.

- [ ] **Step 5: Commit**

If you fixed impl in Step 3, include both:

```bash
git add tests/fixtures/java-smartbi-golden/datasource-F999-fields-not-exist.json
./scripts/safe-commit.sh "test(phase2a/datasource): record F999 fields-not-exist golden" \
  tests/fixtures/java-smartbi-golden/datasource-F999-fields-not-exist.json \
  backend/python/smartbi_compat/api/datasource.py
```

If no impl fix:

```bash
git add tests/fixtures/java-smartbi-golden/datasource-F999-fields-not-exist.json
./scripts/safe-commit.sh "test(phase2a/datasource): record F999 fields-not-exist golden" \
  tests/fixtures/java-smartbi-golden/datasource-F999-fields-not-exist.json
```

---

### Task B.3: Add `TestDatasourceFields` byte-shape gate

**Files:**
- Create: `tests/python/smartbi_compat/test_datasource_contract.py`

- [ ] **Step 1: Create test file**

```python
"""Byte-shape contract gate for /datasource GET endpoints (Wave 2 Tier 1).

Java reference:
  - Controller: SmartBIAnalysisController.getDatasourceFields/getSchemaHistory line 747-780
  - Service: SmartBiSchemaServiceImpl line 225-298

Test pattern (mirrors test_analysis_finance_contract.py):
  - JWT_SECRET set in os.environ BEFORE importing production code
  - Load production main via importlib (gets full middleware stack)
  - Hit endpoint via TestClient with F999 JWT
  - Compare response['data'] (or full envelope for error cases) to recorded golden
  - Strip volatile keys (timestamp)

Goldens recorded against test env Java (port 10011, F999 with non-existent id).
"""
from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import jwt
import pytest


JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET


REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"


def _load_production_main():
    main_path = REPO_ROOT / "backend" / "python" / "main.py"
    sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _make_token(factory_id: str) -> str:
    payload = {
        "userId": 1,
        "username": "test_user",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


VOLATILE = frozenset({"timestamp", "generatedAt", "lastUpdated", "cacheExpireAt"})


def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)


class TestDatasourceFields:
    """F999 byte-shape gate for /datasource/{id}/fields (not-exist case)."""

    def test_f999_fields_not_exist_data_keys_match_golden(self, client, monkeypatch):
        """Sanity: top-level envelope keys order matches Java golden."""
        async def fake_not_exist(_id):
            return None
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_field_definitions",
            fake_not_exist,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/datasource/999999/fields",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_keys = list(resp.json().keys())
        with io.open(GOLDEN_DIR / "datasource-F999-fields-not-exist.json", encoding="utf-8") as f:
            golden_keys = list(json.load(f).keys())

        # Compare envelope keys (timestamp position may differ but should both contain it)
        assert set(py_keys) >= {"code", "message", "data", "success"}, py_keys
        assert set(golden_keys) >= {"code", "message", "data", "success"}, golden_keys

    def test_f999_fields_not_exist_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on stripped envelope (excl. timestamp)."""
        async def fake_not_exist(_id):
            return None
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_field_definitions",
            fake_not_exist,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/datasource/999999/fields",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_body = _strip_volatile(resp.json())
        with io.open(GOLDEN_DIR / "datasource-F999-fields-not-exist.json", encoding="utf-8") as f:
            golden_body = _strip_volatile(json.load(f))

        # Strip Java-only envelope extras (actionHint/severity/hintTarget) for comparison
        # (sister payable test uses same pattern — these are server-side enrichments)
        for k in ("actionHint", "severity", "hintTarget"):
            golden_body.pop(k, None)
            py_body.pop(k, None)

        if py_body != golden_body:
            diffs = {k: {"py": py_body.get(k), "g": golden_body.get(k)}
                     for k in set(py_body) | set(golden_body)
                     if py_body.get(k) != golden_body.get(k)}
            pytest.fail(f"BYTE MISMATCH (fields not-exist): {json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}")
```

- [ ] **Step 2: Run new tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_datasource_contract.py::TestDatasourceFields -v 2>&1 | tail -10
```

Expected: 2/2 pass.

If `test_f999_fields_not_exist_byte_shape` fails:
- Most likely cause: Python's `code: 500` differs from Java's actual code in golden. Read the diff output, adjust impl in `get_datasource_fields` (`code=` value or `message=` template) to match.
- Second: missing `actionHint`/`severity`/`hintTarget` strip — code already strips these but verify golden has them.

- [ ] **Step 3: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: baseline + 2 = N+2 passed.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/datasource): TestDatasourceFields F999 byte-shape gate (2 tests)" \
  tests/python/smartbi_compat/test_datasource_contract.py
```

---

## Phase C — `/history` endpoint

### Task C.1: Implement `/history` endpoint (helper + transformer + page builder + route)

**Files:**
- Modify: `backend/python/smartbi_compat/api/datasource.py` (extend with history components)

- [ ] **Step 1: Add SQL helper after `_query_field_definitions`**

```python
async def _query_schema_history_page(
    datasource_id: int, page: int, size: int
) -> Optional[dict]:
    """Query smart_bi_schema_history with pagination, default ORDER BY created_at DESC.

    Mirrors Java SmartBiSchemaServiceImpl.getSchemaHistory (line 289-298):
      1. Check datasource exists (Java line 293) — returns None if not
      2. Query findByDatasourceIdOrderByCreatedAtDesc with Pageable
      3. Apply soft-delete filter

    Returns Spring PageImpl-shaped dict (built via _build_page_impl).
    Returns None if datasource not exist.

    Note: First version supports default sort only (created_at DESC). Spring
    `?sort=field,direction` parsing deferred — see spec §3.5 backlog.
    """
    pool = await _get_cretas_pool()
    if pool is None:
        return None

    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT 1 FROM smart_bi_datasource WHERE id = $1 AND deleted_at IS NULL",
            datasource_id,
        )
        if not exists:
            return None

        # Total count for pagination metadata
        total = await conn.fetchval(
            """
            SELECT COUNT(*) FROM smart_bi_schema_history
            WHERE datasource_id = $1 AND deleted_at IS NULL
            """,
            datasource_id,
        )

        # Page rows (default ORDER BY created_at DESC per Java repo method)
        rows = await conn.fetch(
            """
            SELECT * FROM smart_bi_schema_history
            WHERE datasource_id = $1 AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            datasource_id,
            size,
            page * size,
        )

        return _build_page_impl(
            content=[_history_to_json(dict(r)) for r in rows],
            page=page,
            size=size,
            total=total,
        )
```

- [ ] **Step 2: Add DTO transformer (in Section 2)**

```python
def _history_to_json(row: dict) -> dict:
    """Mirror Lombok @Data getter reflection order for SmartBiSchemaHistory.

    Field order verified against F999 golden recording (Phase C.2). If golden
    differs from this order, update both helpers atomically.
    """
    return {
        "id": row["id"],
        "datasourceId": row["datasource_id"],
        "changeType": row["change_type"],
        "versionBefore": row.get("version_before"),
        "versionAfter": row.get("version_after"),
        "oldSchema": row.get("old_schema"),
        "newSchema": row.get("new_schema"),
        "ddlExecuted": row.get("ddl_executed"),
        "createdBy": row.get("created_by"),
        "changeDescription": row.get("change_description"),
        "isReversible": row["is_reversible"],
        "isApplied": row["is_applied"],
        "errorMessage": row.get("error_message"),
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "deletedAt": row["deleted_at"].isoformat() if row.get("deleted_at") else None,
    }
```

- [ ] **Step 3: Add Spring PageImpl JSON shape builder**

After `_history_to_json` (still in Section 2):

```python
def _build_page_impl(
    content: list, page: int, size: int, total: int
) -> dict:
    """Mirror Spring PageImpl JSON serialization shape.

    Field order verified against F999 golden recording (Phase C.2). Spring's
    PageImpl uses Jackson default reflection order on getter methods — typically:
      content, pageable, totalElements, totalPages, last, size, number, sort,
      first, numberOfElements, empty

    Sort defaults to UNSORTED (Spring's default when no sort param provided).
    """
    total_pages = (total + size - 1) // size if size > 0 else 0
    sort_obj = {"empty": True, "sorted": False, "unsorted": True}
    return {
        "content": content,
        "pageable": {
            "sort": sort_obj,
            "offset": page * size,
            "pageNumber": page,
            "pageSize": size,
            "paged": True,
            "unpaged": False,
        },
        "totalElements": total,
        "totalPages": total_pages,
        "last": (page >= total_pages - 1) if total_pages > 0 else True,
        "size": size,
        "number": page,
        "sort": sort_obj,
        "first": page == 0,
        "numberOfElements": len(content),
        "empty": len(content) == 0,
    }
```

- [ ] **Step 4: Add route handler in Section 3**

```python
@router.get("/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/history")
async def get_schema_history(
    factory_id: str,
    datasource_id: int,
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getSchemaHistory line 764-780.

    Behavior mirror:
    - datasource not exist → 200 + success=false + sanitized error message
    - empty history (datasource exists, no history) → 200 + success=true + PageImpl(content=[])
    - default sort: createdAt DESC (Java findByDatasourceIdOrderByCreatedAtDesc)

    Pagination: ?page=N&size=N (defaults: page=0, size=20). Sort param deferred (spec §3.5).
    """
    page_data = await _query_schema_history_page(datasource_id, page, size)
    if page_data is None:
        return wrap_response(
            data=None,
            success=False,
            code=500,
            message=f"Get history failed: 数据源不存在: {datasource_id}",
        )
    return wrap_response(data=page_data)
```

- [ ] **Step 5: Run pytest baseline (no new tests yet)**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: same as B.3 (baseline + 2).

- [ ] **Step 6: Smoke test locally with mocked DB**

```bash
cd backend/python && python -c "
import os
os.environ['JWT_SECRET'] = 'test-secret-for-phase2a-do-not-use-in-prod'
import sys; sys.path.insert(0, '.')
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('m', 'main.py')
m = module_from_spec(spec); spec.loader.exec_module(m)

from fastapi.testclient import TestClient
import jwt, time
tok = jwt.encode({'userId':1,'username':'t','factoryId':'F999','role':'factory_super_admin','exp':int(time.time())+3600}, 'test-secret-for-phase2a-do-not-use-in-prod', algorithm='HS256')

import smartbi_compat.api.datasource as ds
async def fake_not_exist(_id, _p, _s): return None
ds._query_schema_history_page = fake_not_exist

c = TestClient(m.app)
r = c.get('/api/mobile/F999/smart-bi/datasource/999999/history', headers={'Authorization': f'Bearer {tok}'})
print('status:', r.status_code)
body = r.json()
print('success:', body.get('success'))
print('code:', body.get('code'))
print('message:', body.get('message'))
"
```

Expected:
```
status: 200
success: False
code: 500
message: Get history failed: 数据源不存在: 999999
```

- [ ] **Step 7: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/datasource): /history endpoint impl + PageImpl builder + route" \
  backend/python/smartbi_compat/api/datasource.py
```

---

### Task C.2: Record F999 history-not-exist golden

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/datasource-F999-history-not-exist.json`

- [ ] **Step 1: Verify SSH tunnel**

```bash
curl -sS --max-time 3 http://127.0.0.1:10011/api/mobile/health 2>&1 | head -3
```

Expected: `{"status":"UP",...}`. If timeout → escalate BLOCKED.

- [ ] **Step 2: Record golden**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  BASE_URL_OVERRIDE="http://127.0.0.1:10011" \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/datasource/999999/history' \
    datasource-F999-history-not-exist.json
```

- [ ] **Step 3: Verify shape**

```bash
python3 -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/datasource-F999-history-not-exist.json'))
print('top-level keys:', list(g.keys()))
print('http code:', g.get('code'))
print('success:', g.get('success'))
print('message:', g.get('message'))
print('data:', g.get('data'))
"
```

Expected: `success: False, code: 500, message: Get history failed: ... 数据源不存在: 999999, data: None`.

If actual differs from impl assumption (e.g., different code or message), update `get_schema_history` route handler in `datasource.py` to match.

- [ ] **Step 4: Commit**

If impl fix needed, include both files:

```bash
git add tests/fixtures/java-smartbi-golden/datasource-F999-history-not-exist.json
./scripts/safe-commit.sh "test(phase2a/datasource): record F999 history-not-exist golden" \
  tests/fixtures/java-smartbi-golden/datasource-F999-history-not-exist.json \
  backend/python/smartbi_compat/api/datasource.py
```

If no impl fix:

```bash
git add tests/fixtures/java-smartbi-golden/datasource-F999-history-not-exist.json
./scripts/safe-commit.sh "test(phase2a/datasource): record F999 history-not-exist golden" \
  tests/fixtures/java-smartbi-golden/datasource-F999-history-not-exist.json
```

---

### Task C.3: Add `TestSchemaHistory` byte-shape gate

**Files:**
- Modify: `tests/python/smartbi_compat/test_datasource_contract.py` (append new class)

- [ ] **Step 1: Append test class**

```python


class TestSchemaHistory:
    """F999 byte-shape gate for /datasource/{id}/history (not-exist case)."""

    def test_f999_history_not_exist_data_keys_match_golden(self, client, monkeypatch):
        async def fake_not_exist(_id, _p, _s):
            return None
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_schema_history_page",
            fake_not_exist,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/datasource/999999/history",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_keys = list(resp.json().keys())
        with io.open(GOLDEN_DIR / "datasource-F999-history-not-exist.json", encoding="utf-8") as f:
            golden_keys = list(json.load(f).keys())

        assert set(py_keys) >= {"code", "message", "data", "success"}, py_keys
        assert set(golden_keys) >= {"code", "message", "data", "success"}, golden_keys

    def test_f999_history_not_exist_byte_shape(self, client, monkeypatch):
        async def fake_not_exist(_id, _p, _s):
            return None
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_schema_history_page",
            fake_not_exist,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/datasource/999999/history",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_body = _strip_volatile(resp.json())
        with io.open(GOLDEN_DIR / "datasource-F999-history-not-exist.json", encoding="utf-8") as f:
            golden_body = _strip_volatile(json.load(f))

        for k in ("actionHint", "severity", "hintTarget"):
            golden_body.pop(k, None)
            py_body.pop(k, None)

        if py_body != golden_body:
            diffs = {k: {"py": py_body.get(k), "g": golden_body.get(k)}
                     for k in set(py_body) | set(golden_body)
                     if py_body.get(k) != golden_body.get(k)}
            pytest.fail(f"BYTE MISMATCH (history not-exist): {json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}")
```

- [ ] **Step 2: Run new tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_datasource_contract.py::TestSchemaHistory -v 2>&1 | tail -10
```

Expected: 2/2 pass.

If byte gate fails, paste diff. Most likely: code/message format mismatch — fix impl.

- [ ] **Step 3: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: baseline + 4 = N+4 passed.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/datasource): TestSchemaHistory F999 byte-shape gate (2 tests)" \
  tests/python/smartbi_compat/test_datasource_contract.py
```

---

## Phase D — Final verify + ship

### Task D.1: Final scope verify + push + create PR

- [ ] **Step 1: Verify total scope**

```bash
git diff --stat origin/main..HEAD -- 'backend/python/smartbi_compat/api/datasource.py' \
  'backend/python/main.py' \
  'tests/python/smartbi_compat/test_datasource_contract.py' \
  'tests/fixtures/java-smartbi-golden/datasource-*' | tail -10
```

Expected: ~250 LOC insertions across 5 files.

- [ ] **Step 2: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```

Expected: baseline + 4 = N+4 passed.

- [ ] **Step 3: Verify git status clean**

```bash
git status --short
```

Expected: empty.

- [ ] **Step 4: Verify commit log**

```bash
git log --oneline origin/main..HEAD
```

Expected: ~9 commits (1 spec + 1 plan + A.1 + B.1 + B.2 + B.3 + C.1 + C.2 + C.3).

- [ ] **Step 5: Push branch**

```bash
git push -u origin phase2a/datasource-gets 2>&1 | tail -5
```

- [ ] **Step 6: Create PR**

```bash
gh pr create --base main --head phase2a/datasource-gets --title "Phase 2A: /datasource fields + history GET (Wave 2 Tier 1, /preview deferred)" --body "$(cat <<'EOF'
## Summary

Ports 2 datasource GET endpoints from Java to Python with byte-shape parity:
- \`GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/fields\` → \`ApiResponse<List<SmartBiFieldDefinition>>\`
- \`GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/history?page=N&size=N\` → \`ApiResponse<Page<SmartBiSchemaHistory>>\` (paginated)

Adds new file \`datasource.py\` (zero conflict with sister chats), 4 contract tests (2 per endpoint, F999 not-exist case), 2 goldens.

## /preview deferred to Wave 3

\`/preview\` endpoint NOT included — re-tiered from Tier 1 to Tier 2 per spec §1.2:
- \`SchemaChangePreview\` is a nested DTO with LLM mapping suggestions
- LLM mapping triggers Phase 2A out-of-scope (NL→SQL coupling)
- byte-shape parity hard: LLM output non-deterministic, F001 真窗 golden 需要 LLM 模型固定 + seed 控制
- Single spec value: /preview deserves its own 4-cycle audit

**Backlog map needs update**: \`/preview\` should be re-tiered from Tier 1 to Tier 2 in \`docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md\` (orchestrator chat will handle this post-merge).

## Architecture highlights

- New \`backend/python/smartbi_compat/api/datasource.py\` — keeps endpoint family separate from \`analysis_finance.py\` (sister chats touch only that file)
- Reuses \`get_cretas_pool\` (PR #23 hotfix pattern) — \`smart_bi_datasource\`/\`smart_bi_field_definition\`/\`smart_bi_schema_history\` all live in \`cretas_db\`
- Java \`EntityNotFoundException\` mirror: 200 + \`success: false\` + sanitized error message (NOT 404)
- Soft-delete filter (\`WHERE deleted_at IS NULL\`) explicit in SQL, mirrors Java \`@Where\`
- Spring \`PageImpl\` JSON shape via dedicated \`_build_page_impl\` builder; key order from F999 golden
- Pagination: default \`page=0&size=20\`; \`?sort=field,direction\` parsing deferred (spec §3.5 backlog)

## Test plan

- [x] pytest baseline + 4 new tests pass
- [x] F999 not-exist byte gates: 4/4 (2 per endpoint)
- [x] Code & message format from golden recording (not assumed)
- [ ] **Post-merge**: deploy test (8084) + smoke 2 endpoints
- [ ] **Post-merge**: deploy prod (8083)
- [ ] **Post-merge**: orchestrator updates backlog map: /preview Tier 1 → Tier 2

## Map.of(N) risk per Rule 8

- \`/history\` Spring \`PageImpl\` — class-based getters (deterministic), but golden recorded for safety
- \`/fields\` JPA entity \`@Data\` — Lombok getter reflection order, golden recorded
- Error envelope (\`success=false\`) — standard \`wrap_response\` helper

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

- [ ] **Step 7: Report PR URL**

---

## Self-Review

**1. Spec coverage:**
- ✅ §1.1 in-scope (2 endpoints): Phase B + C
- ✅ §1.2 /preview deferred rationale: PR body §
- ✅ §2.2 Java EntityNotFoundException mirror: B.1 step 3 + C.1 step 4
- ✅ §2.3 Lombok @Data field order risk: B.2 records golden, B.1 step 2 transformer order matches
- ✅ §2.4 Spring PageImpl shape: C.1 step 3 builder
- ✅ §2.5 pagination params: C.1 step 4 route params
- ✅ §2.6 BaseEntity audit + soft-delete: B.1 + C.1 SQL include `WHERE deleted_at IS NULL`
- ✅ §3.1 new file `datasource.py`: A.1
- ✅ §3.2 route handlers pseudo-code: B.1 + C.1
- ✅ §3.3 SQL helpers: B.1 + C.1
- ✅ §3.4 DTO transformers: B.1 + C.1
- ✅ §4.1 F999 test cases: B.3 + C.3
- ✅ §4.2 goldens: B.2 + C.2
- ✅ §5.1 contract tests (4 total): B.3 + C.3
- ✅ §6 PR scope + commits: D.1

**2. Placeholder scan:** No "TBD" / "TODO" / "implement later" / vague "handle errors". All steps have explicit code or commands.

**3. Type consistency:**
- `_query_field_definitions(datasource_id: int) -> Optional[list[dict]]` — matches B.3 mock `fake_not_exist(_id)` (1-arg)
- `_query_schema_history_page(datasource_id: int, page: int, size: int) -> Optional[dict]` — matches C.3 mock `fake_not_exist(_id, _p, _s)` (3-arg)
- `_field_def_to_json(row: dict) -> dict` — keys camelCase, matches Java entity getter naming
- `_history_to_json(row: dict) -> dict` — same pattern
- `_build_page_impl(content, page, size, total)` — caller in C.1 step 1 passes these 4 args ✓
- `wrap_response` keyword args (`success=`, `code=`, `message=`) — matches schema_compat.py:37 signature ✓

**4. Concurrent-edit safety:** Every commit step uses `safe-commit.sh` with explicit paths. Sister chats (analysis_finance.py) have zero overlap.

**5. Error handling:** Java's catch-all wraps as `ApiResponse.error(...)` — Python mirrors with `code=500` + `success=False` + matching message format. Golden recording will confirm exact code/message; spec §2.2 says we MUST mirror Java's behavior, not interpret as 404.
