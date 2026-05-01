# Phase 2A `/query-templates` CRUD trio port (Wave 2 Tier 1) — Design Spec

**Date**: 2026-05-01
**Branch**: `phase2a/query-templates`
**Worktree**: `.worktrees/phase2a-query-templates`
**Predecessors**:
- PR #32 — sub-endpoints port merged (`ccdeb4b1b`) — `_decimal_to_number` helper + golden infra
- PR #33/#34 — receivable/budget specs merged (sister chats impl in flight)
- PR #35 — Rule 8 `Map.of(N)` Jackson hash order rules merged (`5d284d38d`)
- PR #38 — finance budget per-type real impl merged (`34f1e135c`)
- PR #39 — `/datasource/fields` + `/history` GET ports merged (`f10ab7b6e`) — closest sibling pattern (entity-list responses, soft-delete annotations, cross-factory checks)

---

## 1. 范围 + Scope cut

### 1.1 In scope (本 PR)

3 个 write endpoints, 单 PR ship (不切 PR-A/B):

- `POST   /api/mobile/{factoryId}/smart-bi/query-templates` → `ApiResponse<SmartBiQueryTemplate>`
- `PUT    /api/mobile/{factoryId}/smart-bi/query-templates/{templateId}` → `ApiResponse<SmartBiQueryTemplate>`
- `DELETE /api/mobile/{factoryId}/smart-bi/query-templates/{templateId}` → `ApiResponse<Void>`

### 1.2 显式 not 范围

- `GET /api/mobile/{factoryId}/smart-bi/query-templates` (list) → **stays Java**, nginx cutover scope handled separately (T6 in Phase 2A roadmap)
- 任何 schema 变更 (table 已存在, JPA `ddl-auto=none` in prod)
- RBAC enforcement — Java 端 `@RequirePermission({"analytics:read_write"})` 由 Java middleware 验证, Python port 信任已通过 (nginx cutover 时 Java 仍在链路上 / T6 之后由 Python sidecar middleware 接管 — out of scope this PR)

### 1.3 反 scope creep

- 不修 T6 (POST `id` merge bug) — verbatim mirror, defensive contract test only (§5)
- 不录 T5 invalid-input goldens (empty body / missing required) — backlog §7
- 不改 Java 端任何代码 — 纯 Python port

---

## 2. Java 引用 + JSON shape

### 2.1 引用位置

| 元素 | 位置 |
|---|---|
| Controller `createQueryTemplate` | `SmartBIAnalysisController.java:965-973` |
| Controller `updateQueryTemplate` | `SmartBIAnalysisController.java:976-994` |
| Controller `deleteQueryTemplate` | `SmartBIAnalysisController.java:997-1009` |
| Class `@RequestMapping` | `SmartBIAnalysisController.java:48` (`/api/mobile/{factoryId}/smart-bi`) |
| Entity `SmartBiQueryTemplate` | `entity/smartbi/SmartBiQueryTemplate.java` (52 LOC, 7 own fields + 3 BaseEntity audit) |
| Repository | `SmartBiQueryTemplateRepository.java` (JpaRepository<…, Long> + 1 finder, no custom delete) |
| ApiResponse envelope | `dto/common/ApiResponse.java` — `error(String)` resolves to `error(400, msg)`; HTTP status remains 200 |

### 2.2 Java behavior summary (verbatim mirror checklist)

**POST** (`createQueryTemplate`, line 965-973):

```java
template.setFactoryId(factoryId);   // T3: silent override of body's factoryId
SmartBiQueryTemplate saved = queryTemplateRepository.save(template);
return ResponseEntity.ok(ApiResponse.success(saved));
```

- Body's `factoryId` **silently overridden** from path (T3). No error, no warning.
- No `@Valid` annotation. Required-field violations (`name`, `category`, `queryTemplate` per `nullable=false`) hit DB constraint → `GlobalExceptionHandler` → return shape **unverified, deferred to PR-B** (§7 T5).
- Body's `id` is honored if non-null → JPA `save()` performs MERGE (UPSERT) → **T6 latent bug**: client can overwrite arbitrary `id` (including cross-factory).

**PUT** (`updateQueryTemplate`, line 976-994):

```java
return queryTemplateRepository.findById(templateId)
        .filter(t -> factoryId.equals(t.getFactoryId()))   // T2: cross-factory → "not found"
        .map(existing -> {
            existing.setName(template.getName());
            existing.setCategory(template.getCategory());
            existing.setDescription(template.getDescription());
            existing.setQueryTemplate(template.getQueryTemplate());
            existing.setParameters(template.getParameters());   // T4: only 5 fields updated
            SmartBiQueryTemplate saved = queryTemplateRepository.save(existing);
            return ResponseEntity.ok(ApiResponse.success(saved));
        })
        .orElse(ResponseEntity.ok(ApiResponse.error("Template not found")));   // T2: HTTP 200 + code=400 + success=false
```

- Updates exactly 5 fields: `name`, `category`, `description`, `queryTemplate`, `parameters`.
- `id`, `factoryId`, `createdAt`, `updatedAt`, `deletedAt` **untouched** (T4). `updated_at` auto-updated by DB trigger (per `database-entity-sync.md`).
- Both "ID does not exist" and "ID exists but cross-factory" return **identical shape** (T2): `{code: 400, message: "Template not found", data: null, success: false}` wrapped in HTTP 200.

**DELETE** (`deleteQueryTemplate`, line 997-1009):

```java
return queryTemplateRepository.findById(templateId)
        .filter(t -> factoryId.equals(t.getFactoryId()))
        .map(existing -> {
            queryTemplateRepository.delete(existing);   // T1: HARD DELETE despite @Where soft-delete
            return ResponseEntity.ok(ApiResponse.<Void>success(null));
        })
        .orElse(ResponseEntity.ok(ApiResponse.error("Template not found")));
```

- **T1 explicit clarification**: Entity declares `@Where(clause = "deleted_at IS NULL")`. This is a **READ filter** (excludes soft-deleted rows from `findById` / finder methods). It does NOT translate `delete()` to soft-delete. `repository.delete(existing)` emits SQL `DELETE FROM smart_bi_query_templates WHERE id = ?`. **Python mirrors hard DELETE — this is intentional Java behavior, not a bug.**
- Success returns `data: null`. Not-found returns identical shape to PUT not-found (T2).

### 2.3 SmartBiQueryTemplate JSON shape

**Own fields (declared order in entity)**:

```
id          (Long, IDENTITY)
factoryId   (String, length 32, NOT NULL)
name        (String, length 100, NOT NULL)
category    (String, length 32, NOT NULL)
description (String, length 500, nullable)
queryTemplate (String, TEXT, NOT NULL)
parameters  (String, TEXT, nullable — JSON-encoded array as string, NOT JSONB)
```

**Inherited from `BaseEntity` (audit)**:

```
createdAt, updatedAt, deletedAt
```

**T7 — field order in Jackson output is NOT guaranteed**:
Lombok `@Data` + Jackson default reflection means field order between subclass own fields and BaseEntity audit fields depends on JVM reflection iteration. Common Jackson pattern is subclass-first then superclass, but not contractual. **Must record golden 3× across Java backend restarts** (§4) and lock down the observed stable order.

**T8 — `parameters` is TEXT, not JSONB**:
Java stores it as `String` (already JSON-encoded). Python must **pass through as string** — DO NOT `json.loads` then `json.dumps` (re-serialization may reorder JSON object keys → byte-shape break).

### 2.4 ApiResponse envelope shape (success + error)

**Success** (POST/PUT):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { /* SmartBiQueryTemplate JSON, see 2.3 */ },
  "timestamp": "2026-05-01T13:00:00.123",
  "success": true,
  "actionHint": null,
  "severity": null,
  "hintTarget": null
}
```

**Success** (DELETE happy):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": null,
  "timestamp": "...",
  "success": true,
  "actionHint": null,
  "severity": null,
  "hintTarget": null
}
```

**Error** (PUT/DELETE not-found, all variants — missing ID OR cross-factory):
```json
{
  "code": 400,
  "message": "Template not found",
  "data": null,
  "timestamp": "...",
  "success": false,
  "actionHint": null,
  "severity": null,
  "hintTarget": null
}
```

**Note on null fields**: Spring Boot default Jackson serializes nulls. If the app has `@JsonInclude(NON_NULL)` configured globally, `actionHint`/`severity`/`hintTarget` will be omitted. **Golden recording will reveal which** — Python must match.

---

## 3. Python impl pseudo-code

### 3.1 New module: `backend/python/smartbi_compat/api/query_templates.py`

```python
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, HTTPException, Path, Request
from pydantic import BaseModel, Field

from smartbi_compat.api.analysis_finance import _decimal_to_number  # NOT used here; envelope only
from smartbi_compat.db import get_smartbi_pool   # existing pool helper used by sub-endpoints / datasource

router = APIRouter()


# ============================================================
# Pydantic body model (POST/PUT request body)
# ============================================================

class QueryTemplateBody(BaseModel):
    """Permissive body — mirror Java `@RequestBody SmartBiQueryTemplate template` with no @Valid."""
    id: Optional[int] = None              # T6: honored by Java JPA save() merge — verbatim mirror
    factoryId: Optional[str] = None       # T3: ignored on POST (path overrides), ignored on PUT (preserved)
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    queryTemplate: Optional[str] = None
    parameters: Optional[str] = None      # T8: pass-through TEXT (already-JSON string)
    # Inherited audit fields — Java entity accepts them but PUT preserves existing + POST relies on DB defaults
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    deletedAt: Optional[datetime] = None

    class Config:
        extra = "allow"   # Java Lombok @Data ignores unknown fields; mirror permissive shape


# ============================================================
# Envelope helpers (mirror Java ApiResponse static factories)
# ============================================================

def _envelope_success(data: Any, message: str = "操作成功") -> dict:
    return {
        "code": 200,
        "message": message,
        "data": data,
        "timestamp": _now_iso(),
        "success": True,
        "actionHint": None,
        "severity": None,
        "hintTarget": None,
    }


def _envelope_error(message: str, code: int = 400) -> dict:
    return {
        "code": code,
        "message": message,
        "data": None,
        "timestamp": _now_iso(),
        "success": False,
        "actionHint": None,
        "severity": None,
        "hintTarget": None,
    }


def _now_iso() -> str:
    """ISO format matching Java LocalDateTime.now() Jackson default.

    Java LocalDateTime serializes via ISO_LOCAL_DATE_TIME by default
    (no timezone, microsecond precision varies). Recording goldens will
    reveal exact format — adjust this helper to match if needed.
    """
    return datetime.now().isoformat(timespec="microseconds")


# ============================================================
# Row → entity dict (mirror Lombok @Data Jackson output)
# ============================================================

def _row_to_entity(row: asyncpg.Record) -> dict:
    """Build dict matching Java SmartBiQueryTemplate JSON shape.

    Field order is locked per F999 golden recording (§4). Suspected order:
    own fields (declared) then BaseEntity audit (createdAt, updatedAt, deletedAt).
    Adjust to match recorded golden — DO NOT trust this initial guess.
    """
    return {
        "id": row["id"],
        "factoryId": row["factory_id"],
        "name": row["name"],
        "category": row["category"],
        "description": row["description"],
        "queryTemplate": row["query_template"],
        "parameters": row["parameters"],   # T8: pass-through string
        "createdAt": _datetime_to_iso(row["created_at"]),
        "updatedAt": _datetime_to_iso(row["updated_at"]),
        "deletedAt": _datetime_to_iso(row["deleted_at"]),   # nullable
    }


def _datetime_to_iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat(timespec="microseconds") if dt is not None else None


# ============================================================
# POST /api/mobile/{factoryId}/smart-bi/query-templates
# ============================================================

@router.post("/api/mobile/{factory_id}/smart-bi/query-templates")
async def create_query_template(
    factory_id: str = Path(..., min_length=1),
    body: QueryTemplateBody = ...,
):
    """Mirror Java line 965-973 verbatim.

    Behavior:
    - body.factoryId silently overridden from path (T3)
    - body.id, if non-null, is passed through to INSERT — JPA save() does MERGE (T6)
    - Required fields (name, category, queryTemplate) NOT validated here — DB NOT NULL constraint will throw
    """
    # T3: override factoryId
    factory_id_to_use = factory_id

    pool = await get_smartbi_pool()
    async with pool.acquire() as conn:
        if body.id is not None:
            # T6 verbatim mirror: client-supplied id triggers JPA MERGE behavior.
            # Implement as INSERT ... ON CONFLICT (id) DO UPDATE — matches JPA persist-or-update.
            sql = """
                INSERT INTO smart_bi_query_templates
                    (id, factory_id, name, category, description, query_template, parameters,
                     created_at, updated_at, deleted_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NULL)
                ON CONFLICT (id) DO UPDATE SET
                    factory_id = EXCLUDED.factory_id,
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    description = EXCLUDED.description,
                    query_template = EXCLUDED.query_template,
                    parameters = EXCLUDED.parameters,
                    updated_at = NOW()
                RETURNING *
            """
            row = await conn.fetchrow(
                sql, body.id, factory_id_to_use, body.name, body.category,
                body.description, body.queryTemplate, body.parameters,
            )
        else:
            sql = """
                INSERT INTO smart_bi_query_templates
                    (factory_id, name, category, description, query_template, parameters,
                     created_at, updated_at, deleted_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NULL)
                RETURNING *
            """
            row = await conn.fetchrow(
                sql, factory_id_to_use, body.name, body.category,
                body.description, body.queryTemplate, body.parameters,
            )

    return _envelope_success(_row_to_entity(row))


# ============================================================
# PUT /api/mobile/{factoryId}/smart-bi/query-templates/{templateId}
# ============================================================

@router.put("/api/mobile/{factory_id}/smart-bi/query-templates/{template_id}")
async def update_query_template(
    factory_id: str = Path(..., min_length=1),
    template_id: int = Path(...),
    body: QueryTemplateBody = ...,
):
    """Mirror Java line 976-994 verbatim.

    T2: not-found AND cross-factory both return identical {code: 400, success: false} HTTP 200.
    T4: only 5 fields updated (name, category, description, queryTemplate, parameters).
    """
    pool = await get_smartbi_pool()
    async with pool.acquire() as conn:
        # findById + factoryId filter (T2): WHERE id AND factory_id AND deleted_at IS NULL (T1: @Where READ filter)
        existing = await conn.fetchrow(
            """
            SELECT * FROM smart_bi_query_templates
            WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL
            """,
            template_id, factory_id,
        )
        if existing is None:
            return _envelope_error("Template not found")

        # T4: update exactly 5 fields. updated_at set explicitly to NOW()
        # (do not rely on DB trigger presence — set explicitly to guarantee parity
        # with Java JPA Hibernate's @PreUpdate audit lifecycle).
        updated = await conn.fetchrow(
            """
            UPDATE smart_bi_query_templates
            SET name = $1,
                category = $2,
                description = $3,
                query_template = $4,
                parameters = $5,
                updated_at = NOW()
            WHERE id = $6
            RETURNING *
            """,
            body.name, body.category, body.description,
            body.queryTemplate, body.parameters,
            template_id,
        )

    return _envelope_success(_row_to_entity(updated))


# ============================================================
# DELETE /api/mobile/{factoryId}/smart-bi/query-templates/{templateId}
# ============================================================

@router.delete("/api/mobile/{factory_id}/smart-bi/query-templates/{template_id}")
async def delete_query_template(
    factory_id: str = Path(..., min_length=1),
    template_id: int = Path(...),
):
    """Mirror Java line 997-1009 verbatim.

    T1: HARD DELETE (Java repository.delete() emits DELETE SQL despite @Where soft-delete annotation).
    @Where only filters READ — does NOT translate delete() to soft-delete.
    """
    pool = await get_smartbi_pool()
    async with pool.acquire() as conn:
        # findById + factoryId filter (T2 mirror)
        existing = await conn.fetchrow(
            """
            SELECT id FROM smart_bi_query_templates
            WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL
            """,
            template_id, factory_id,
        )
        if existing is None:
            return _envelope_error("Template not found")

        # T1: HARD DELETE
        await conn.execute(
            "DELETE FROM smart_bi_query_templates WHERE id = $1",
            template_id,
        )

    return _envelope_success(None)
```

### 3.2 Wire-up in `backend/python/main.py`

```python
from smartbi_compat.api import query_templates as smartbi_query_templates_api
app.include_router(smartbi_query_templates_api.router, tags=["SmartBI Query Templates"])
```

(Match existing pattern for `datasource.py` registration.)

### 3.3 Helper reuse

- `get_smartbi_pool()` — existing helper from `smartbi_compat/db.py` (same pool used by datasource + sub-endpoints). **Impl phase**: verify exact name + import path during plan task `T-impl-1` (existing module discovery).
- No `_decimal_to_number` needed — entity has no numeric fields.
- No `Map.of(N)` shapes anywhere — Rule 8 N/A.

---

## 4. Byte-shape gate (4 goldens, T7 nuance)

### 4.1 Golden recording

**Total: 4 goldens** (per simplified spec template — PUT not-found shape ≡ DELETE not-found shape, single fixture double-used):

| # | Endpoint | Scenario | Filename |
|---|---|---|---|
| 1 | POST | F999 happy create | `tests/fixtures/java-smartbi-golden/query-templates-F999-post-happy.json` |
| 2 | PUT | F999 happy update (template created in step 1) | `tests/fixtures/java-smartbi-golden/query-templates-F999-put-happy.json` |
| 3 | DELETE | F999 happy delete (template created in step 1, after step 2) | `tests/fixtures/java-smartbi-golden/query-templates-F999-delete-happy.json` |
| 4 | PUT | F999 not-found (templateId=999999) | `tests/fixtures/java-smartbi-golden/query-templates-F999-not-found.json` |

**Golden #4 double-use**: Contract test for DELETE not-found asserts dict-eq against the SAME `query-templates-F999-not-found.json` fixture (PUT/DELETE not-found shape identity). Test description: "PUT/DELETE not-found shape identity verified — single golden double-used".

### 4.2 Recording procedure

```bash
# Use existing scripts/record-java-golden.sh (or curl directly if script doesn't support write methods).
# Hit Java prod (10010) to record real Jackson output:
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ..." \
  http://localhost:10010/api/mobile/F999/smart-bi/query-templates \
  -d '{"name":"test","category":"sales","description":"d","queryTemplate":"SELECT 1","parameters":"[]"}' \
  > tests/fixtures/java-smartbi-golden/query-templates-F999-post-happy.json
# (similar for PUT happy, DELETE happy, PUT not-found)
```

### 4.3 T7 — record 3× across Java backend restarts

**Critical nuance**: `SmartBiQueryTemplate extends BaseEntity` with Lombok `@Data`. Jackson serialization order between subclass own fields and BaseEntity audit fields **may flip across JVM restarts** depending on hotspot reflection cache state. This is similar in spirit to Rule 8's `Map.of(N)` SALT issue, but for Jackson reflection (not collection hash).

**Procedure** (impl chat to follow):
1. Record golden #1 (POST happy) on cold Java backend.
2. Restart `cretas-backend` (or `cretas-backend-test`), record golden #1 again to second tempfile.
3. Restart again, record to third tempfile.
4. Diff the 3 files. If identical → field order stable, commit golden #1 as-is.
5. If field order flips between any pair → document accepted shape divergence in spec §7 + emit a Python-side **canonicalize-before-compare** helper that sorts the entity dict keys before dict-eq.

This nuance is NOT in Rule 8 (Rule 8 is Map.of, not Lombok reflection), but follows the same byte-shape parity defensive principle. Adding to `python-java-port.md` Rule history if T7 flip is observed.

### 4.4 Byte-shape gate test

```python
# tests/contract/test_query_templates_parity.py
import json
import pytest
from pathlib import Path

GOLDEN_DIR = Path("tests/fixtures/java-smartbi-golden")

@pytest.mark.parametrize("scenario,fixture", [
    ("post_happy", "query-templates-F999-post-happy.json"),
    ("put_happy", "query-templates-F999-put-happy.json"),
    ("delete_happy", "query-templates-F999-delete-happy.json"),
    ("put_not_found", "query-templates-F999-not-found.json"),
])
async def test_byte_shape_parity(scenario, fixture, python_app, mock_smartbi_pool):
    expected = json.loads((GOLDEN_DIR / fixture).read_text(encoding="utf-8"))
    # Strip volatile fields per existing parity helper convention
    expected_canon = canonicalize_envelope(expected)
    actual = await invoke_python_endpoint(scenario, python_app, mock_smartbi_pool)
    actual_canon = canonicalize_envelope(actual)
    assert actual_canon == expected_canon

# Bonus: DELETE not-found uses same fixture as PUT not-found
async def test_delete_not_found_shape_identity(python_app, mock_smartbi_pool):
    """Verify PUT/DELETE not-found shape identity per spec §4.1."""
    fixture = json.loads((GOLDEN_DIR / "query-templates-F999-not-found.json").read_text(encoding="utf-8"))
    actual = await invoke_python_endpoint("delete_not_found", python_app, mock_smartbi_pool)
    assert canonicalize_envelope(actual) == canonicalize_envelope(fixture)
```

`canonicalize_envelope` strips `timestamp` (always volatile) + `data.createdAt` / `data.updatedAt` (volatile when entity round-trip uses NOW()). **Impl phase**: check if such a helper already exists in `tests/contract/conftest.py` from sub-endpoints PR #32 / datasource PR #39 — reuse if present; create if absent (mark in plan task list).

---

## 5. 测试 (5 contract tests)

### 5.1 Test inventory

| # | Test | Scenario | Asserts |
|---|---|---|---|
| 1 | `test_post_happy_byte_shape` | POST F999 with valid body | dict-eq against `query-templates-F999-post-happy.json` (canonicalized) |
| 2 | `test_put_happy_byte_shape` | PUT F999 with valid update | dict-eq against `query-templates-F999-put-happy.json` (canonicalized) |
| 3 | `test_delete_happy_byte_shape` | DELETE F999 happy | dict-eq against `query-templates-F999-delete-happy.json` (canonicalized) |
| 4 | `test_put_delete_not_found_shape_identity` | PUT 999999 + DELETE 999999 + PUT cross-factory + DELETE cross-factory | All 4 invocations dict-eq against single `query-templates-F999-not-found.json` fixture |
| 5 | `test_post_with_id_does_not_overwrite_other_factory_template` | **T6 defensive contract test** — F999 creates template id=N → switch to F001 context POST `{id: N, name: "hijack", ...}` → assert response 200 (mirror Java MERGE) BUT assert F999's template at id=N is NOT modified in DB | Response success; DB row still owned by F999 + name unchanged |

### 5.2 T6 defensive contract test detail

```python
async def test_post_with_id_does_not_overwrite_other_factory_template(
    python_app, smartbi_pool_with_isolation
):
    """Lock current verbatim Java MERGE behavior (T6 latent bug).

    This test does NOT fix the bug. It locks current behavior so that if a future
    Java fix changes MERGE semantics, the Python port is alerted to re-mirror.

    Per spec §7 risk register: T6 is candidate for Phase 2B-after-cleanup.
    """
    # Setup: F999 creates template id=42 owned by F999
    pool = smartbi_pool_with_isolation
    await pool.execute(
        "INSERT INTO smart_bi_query_templates (id, factory_id, name, category, "
        "description, query_template, parameters, created_at, updated_at) "
        "VALUES (42, 'F999', 'original', 'sales', 'd', 'SELECT 1', '[]', NOW(), NOW())"
    )

    # Act: F001 POST with id=42 → mirror Java MERGE (overwrites F999's row)
    response = await python_app.post(
        "/api/mobile/F001/smart-bi/query-templates",
        json={"id": 42, "name": "hijack", "category": "sales",
              "queryTemplate": "DROP TABLE x", "parameters": "[]"},
    )

    # Java behavior: HTTP 200 success — request honored (T6 bug)
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Document the honored bug: F999's row IS now overwritten with F001 ownership.
    # If Python port DIVERGED from Java (e.g. silently kept F999 ownership), this would fail.
    row = await pool.fetchrow("SELECT factory_id, name FROM smart_bi_query_templates WHERE id = 42")
    assert row["factory_id"] == "F001"   # T6: Java behavior — factoryId overwritten
    assert row["name"] == "hijack"
```

### 5.3 Mock pattern (mirror sub-endpoints + datasource)

Use existing `mock_smartbi_pool` fixture from `tests/contract/conftest.py`. For test #5, use `smartbi_pool_with_isolation` (real test DB instance) since DB state assertion is required — pure mock cannot verify INSERT/UPDATE side effects.

---

## 6. PR scope (single PR)

### 6.1 PR title

```
Phase 2A: /query-templates POST/PUT/DELETE port (Wave 2 Tier 1)
```

### 6.2 PR file list

**New files**:
- `backend/python/smartbi_compat/api/query_templates.py` (~300 LOC)
- `tests/contract/test_query_templates_parity.py` (~150 LOC, 5 tests)
- `tests/fixtures/java-smartbi-golden/query-templates-F999-post-happy.json`
- `tests/fixtures/java-smartbi-golden/query-templates-F999-put-happy.json`
- `tests/fixtures/java-smartbi-golden/query-templates-F999-delete-happy.json`
- `tests/fixtures/java-smartbi-golden/query-templates-F999-not-found.json`
- `docs/superpowers/specs/2026-05-01-phase2a-query-templates-design.md` (this file)

**Modified files**:
- `backend/python/main.py` (1-line router include)

### 6.3 Out of PR scope

- nginx cutover (T6 in Phase 2A roadmap) — separate PR
- Java-side fixes for T6 (JPA merge bug) or T1 (soft-delete consistency) — backlog
- T5 invalid-input goldens — PR-B follow-up (§7)
- GET /query-templates port — stays Java

### 6.4 Single PR justification

Per simplified spec template: "CRUD trio is mechanical Java mirror, no algorithmic complexity, no Decimal/period/chart traps." Splitting into PR-A (spec-only) + PR-B (impl) adds review overhead without risk reduction. Single PR ship — same pattern as PR #39 (datasource GETs).

---

## 7. Open risks + backlog

### 7.1 T5 — invalid-input goldens deferred to PR-B

**Risk**: Java behavior for empty body / missing required field (`name`, `category`, `queryTemplate`) is unverified.

**Hypothesis**: DB constraint violation (`@Column(nullable=false)`) → propagated to `GlobalExceptionHandler` → returns either:
- `code: 500, message: "<sanitized DB error>"` (most likely — Java's default for unhandled SQL exceptions)
- `code: 400, message: "<validation error>"` (if `MethodArgumentNotValidException` handler intercepts)

**Required follow-up (PR-B scope, not this PR)**:
1. Record 4-5 invalid-input goldens against Java prod:
   - Empty body `{}`
   - Missing `name` (other required fields present)
   - Missing `category` (other required fields present)
   - Missing `queryTemplate` (other required fields present)
   - Body that violates length constraint (e.g. `name` with 200 chars > VARCHAR(100))
2. Add corresponding Python error path code (raise from DB constraint catch).
3. Add 4-5 contract tests dict-eq against new goldens.

**Why deferred**: simplified spec scope is happy-path + not-found only. Invalid-input handling adds ~150 LOC + LLM-style decision tree (which exception → which envelope shape). Belongs in its own focused PR.

### 7.2 T6 — JPA merge bug (latent Java vulnerability) verbatim mirrored

**Risk**: Client sending POST with non-null `id` triggers JPA `save()` MERGE behavior. Can overwrite **any** template row (cross-factory). This is a **real authorization bypass** in Java code.

**Action this PR**:
- Mirror verbatim in Python (INSERT ... ON CONFLICT DO UPDATE per §3.1).
- Defensive contract test #5 locks current behavior.

**Phase 2B-after-cleanup candidate**:
- Java fix: strip `body.setId(null)` before `save()` in `createQueryTemplate`.
- Python fix: ignore `body.id` on POST (always INSERT, never UPSERT).
- Both fixed simultaneously to maintain parity.

### 7.3 T7 — Lombok @Data field order across JVM restarts

**Risk**: Subclass-vs-superclass Jackson reflection order may flip across `cretas-backend` restarts. If observed during golden recording (§4.3), need canonicalize-before-compare helper.

**Mitigation in this PR**:
- Record golden 3× across Java restarts during impl phase.
- If stable: commit golden as-is.
- If flips: document accepted divergence in this spec + emit canonicalize helper in `tests/contract/conftest.py` + add observation to `python-java-port.md` Rule history (potential Rule 9 candidate if seen across multiple sister chats).

### 7.4 T1 + T8 — already mirrored verbatim, no follow-up

T1 (hard DELETE despite @Where) and T8 (parameters TEXT pass-through) are intentional behaviors mirrored exactly. No backlog action.

---

## 8. Audit cycle policy (this PR)

Per `feedback_subagent_driven_audit_pattern.md`:

- **Mechanical CRUD port** → skip 2 of 4 audit cycles.
- **Audit cycles to run**:
  1. Self-review after spec draft (this section, run inline before commit).
  2. Final reviewer audit before PR merge (subagent, on impl + tests + goldens combined).
- **Skipped**: brainstorm round 2 (8 traps already surfaced with high quality), spec reviewer subagent (mechanical content, fatigue counterproductive).

If final reviewer audit raises ≥3 P0 findings, escalate to fresh chat for re-spec. Otherwise apply fixes inline and ship.

---

## 9. Estimates

| Phase | Estimated time | LOC |
|---|---|---|
| Spec doc | 1.5h | ~250 LOC (this file) |
| Plan (writing-plans) | 0.5h | 14 tasks |
| Impl (`query_templates.py` + main.py) | 2.5h | ~300 LOC |
| Goldens (4 files, T7 3× recording) | 0.5h | trivial |
| Contract tests (5 tests) | 1.5h | ~150 LOC |
| Final reviewer audit + fixes | 1h | varies |
| **Total** | **~7.5h** | **~700 LOC PR** |

Aligns with PR #39 datasource GET ship time (6-7h, 2 endpoints). 3 endpoints + 1 defensive test → +~1h.

---

## 10. Concurrent-chat coordination

**Other active chats touching shared files** (per task brief):
- Sister chat (Chat 1) impl receivable in `analysis_finance.py` — **zero overlap**, different file
- Other chats may modify `main.py` for their own router includes — **conflict surface**: 1-line include each, easy rebase

**Mitigation**:
- This PR's `main.py` change is single-line (`include_router(...)`).
- Use `./scripts/safe-commit.sh` per `concurrent-edit-safety.md` Rule 5b.
- Push spec doc to `origin/phase2a/query-templates` immediately after first commit (locks branch, prevents worktree confusion).

---

## 11. Push-early discipline

Per Chat 5 worktree-collision learning:

1. ✅ Worktree created: `.worktrees/phase2a-query-templates` on `phase2a/query-templates` branch.
2. After spec draft commit → **immediate `git push origin phase2a/query-templates`** to lock remote branch.
3. Subsequent impl + golden + test commits also push immediately (no batching).
4. Final PR opened against `main` after all commits pushed.

---

**End of design spec.**
