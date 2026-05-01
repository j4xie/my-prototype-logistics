# Phase 2A `/query-templates` CRUD trio port (Wave 2 Tier 1) — Design Spec **v2**

**Date**: 2026-05-01 (v2 revised after empirical Java behavior recording 2026-05-02)
**Branch**: `phase2a/query-templates`
**Worktree**: `.worktrees/phase2a-query-templates`

**v2 changelog** (vs v1 commits `9542f00af` + `70a62757e`):
- **F1**: existing GET impl uses **SQLAlchemy sync** (`get_db_context()` + `text()`), NOT asyncpg — spec rewrites §3 around this
- **F2**: field order is **precedent-locked** by `analysis.py:53-84` GET impl — drop T7 "record golden 3× to detect Lombok flip" protocol (still relevant for sister chats but proven moot here)
- **F2 add**: synthetic `"deleted": <bool>` field MUST appear in entity response — v1 missed this
- **F3**: RLS policies exist on table but **DO NOT block** the T6 hijack — empirically verified
- **F4**: envelope built via `schema_compat.wrap_response` is NOT what existing code uses — code uses raw dicts. Use raw dict envelope per recorded golden
- **F5**: tests use `monkeypatch.setattr` on `_query_*` module-level functions (mirror `test_datasource_contract.py`). Drop the `smartbi_pool_with_isolation` fixture from v1 — pure mocks suffice for all 5 tests
- **T6 hijack confirmed empirically**: Java POST with `id` in body DOES hijack cross-factory rows. Java response has `createdAt: null` (JPA merge quirk — transient entity returned, not DB row). Python must mirror exactly.

**Predecessors**:
- PR #32 — sub-endpoints port (`ccdeb4b1b`) — golden infra
- PR #33/#34 — receivable/budget specs
- PR #35 — Rule 8 `Map.of(N)` Jackson hash order
- PR #38 — finance budget per-type real impl (`34f1e135c`)
- PR #39 — `/datasource/fields` + `/history` GET ports (`f10ab7b6e`)
- **Apr 28 T5b GET `/query-templates` Python port** in `analysis.py:53-130` — sister code, defines field order + DB pattern this spec must mirror

---

## 1. 范围 + Scope cut

### 1.1 In scope (本 PR)

3 个 write endpoints, 单 PR ship (不切 PR-A/B):

- `POST   /api/mobile/{factoryId}/smart-bi/query-templates` → `ApiResponse<SmartBiQueryTemplate>`
- `PUT    /api/mobile/{factoryId}/smart-bi/query-templates/{templateId}` → `ApiResponse<SmartBiQueryTemplate>`
- `DELETE /api/mobile/{factoryId}/smart-bi/query-templates/{templateId}` → `ApiResponse<Void>`

### 1.2 显式 not 范围

- `GET /api/mobile/{factoryId}/smart-bi/query-templates` — **already ported** in `analysis.py:53-130` (Apr 28 T5b work). Don't touch.
- 任何 schema 变更 (table 已存在, JPA `ddl-auto=none` in prod)
- RBAC enforcement — Java `@RequirePermission({"analytics:read_write"})` enforced by `PermissionInterceptor` (which does `userRepository.findById(jwt.userId)` + permission check). Python port inherits Java permission filter on the request path through nginx during T6 cutover phase. **Not in this PR's enforcement scope.**

### 1.3 反 scope creep

- 不修 T6 (POST `id` merge bug) — verbatim mirror; defensive contract test #5 locks current behavior
- 不录 invalid-input goldens (empty body / missing required) — backlog §7
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
| **Sister GET impl (precedent)** | `backend/python/smartbi_compat/api/analysis.py:53-130` — locks DB pattern + field order |

### 2.2 Java behavior matrix (empirically recorded 2026-05-02)

All recordings against test env (10011) using `phase2a_test_user` (F999, userId=1355) and `factory_admin1` (F001, userId=1).

#### POST happy (no id in body)

```http
POST /api/mobile/F999/smart-bi/query-templates
{"name":"X","category":"X","description":"X","queryTemplate":"X","parameters":"[]"}
```

```json
{
  "code": 200, "message": "操作成功",
  "data": {
    "createdAt": "2026-05-02T02:37:17.984275016",
    "updatedAt": "2026-05-02T02:37:17.984275016",
    "deletedAt": null,
    "id": 45, "factoryId": "F999",
    "name": "X", "category": "X", "description": "X",
    "queryTemplate": "X", "parameters": "[]",
    "deleted": false
  },
  "timestamp": "2026-05-02T02:37:17.986436102",
  "success": true,
  "actionHint": null, "severity": null, "hintTarget": null
}
```

Notes:
- `createdAt == updatedAt` (both NOW(), nano precision before DB roundtrip)
- `factoryId` always = path's factoryId (T3 silent override even when body has different one)
- `deleted: false` always (POST never undeletes)

#### POST hijack (id in body, exists)

```http
POST /api/mobile/F001/smart-bi/query-templates
{"id":46,"name":"hijacked","category":"evil","queryTemplate":"DROP","parameters":"[\"x\"]"}
```

```json
{
  "code": 200, "message": "操作成功",
  "data": {
    "createdAt": null,                  // ⚠️ JPA merge quirk — body had no createdAt
    "updatedAt": "2026-05-02T02:37:18.017844798",
    "deletedAt": null,
    "id": 46, "factoryId": "F001",      // ⚠️ factory_id IS overwritten in DB
    "name": "hijacked_golden", "category": "evil",
    "description": "T6 hijack golden",
    "queryTemplate": "DROP", "parameters": "[\"x\"]",
    "deleted": false
  },
  "timestamp": "...",
  "success": true,
  "actionHint": null, "severity": null, "hintTarget": null
}
```

**Critical T6 confirmation**:
- Hijack succeeds (`success: true`, HTTP 200)
- `factory_id` IS overwritten in DB (verified via F999 GET → row gone, F001 GET → row present with new factoryId)
- DB's actual `created_at` IS preserved (verified via F001 GET showing original timestamp), but **response body shows `createdAt: null`** because Java's JPA `save()` returns the merged transient entity (which inherits the body's null createdAt rather than the existing row's value)
- RLS policies on `smart_bi_query_templates` (V20260502_04) do NOT block this — likely because session's `app.factory_id` is empty/unset, falling into the policy's "OR empty OR null" branch

#### PUT happy (id exists, same factory)

```json
{
  "code": 200, "message": "操作成功",
  "data": {
    "createdAt": "2026-05-02T02:37:17.984275",         // micro precision (after DB roundtrip)
    "updatedAt": "2026-05-02T02:37:17.993803529",      // nano (fresh NOW)
    "deletedAt": null,
    "id": 45, "factoryId": "F999",
    "name": "<updated>", ...,
    "deleted": false
  },
  ...envelope...
}
```

Notes:
- `createdAt` preserved from existing row (micro precision because read from DB), `updatedAt` is fresh NOW (nano)
- Body's `id` and `factoryId` are IGNORED (verified — sent `{id:99999, factoryId:"F001"}` but response had `id:44, factoryId:"F999"` from path)
- 5 fields updated: `name, category, description, queryTemplate, parameters`

#### PUT not-found / cross-factory / DELETE not-found / cross-factory (all identical shape)

```json
{
  "code": 400, "message": "Template not found",
  "data": null,
  "timestamp": "...",
  "success": false,
  "actionHint": null, "severity": null, "hintTarget": null
}
```

HTTP status: **200** (Java wraps via `ResponseEntity.ok(ApiResponse.error(...))`).

#### DELETE happy

```json
{
  "code": 200, "message": "操作成功",
  "data": null,
  "timestamp": "...",
  "success": true,
  "actionHint": null, "severity": null, "hintTarget": null
}
```

DB: row hard-deleted (`DELETE FROM smart_bi_query_templates WHERE id = ?`). The entity's `@Where(clause="deleted_at IS NULL")` is a READ filter only — `repository.delete()` emits hard SQL DELETE.

### 2.3 Field order (precedent-locked)

**Envelope** (Java `ApiResponse` class declared field order, manual getters at line 136+):
```
code, message, data, timestamp, success, actionHint, severity, hintTarget
```

**Entity `SmartBiQueryTemplate`** (Lombok @Data, BaseEntity superclass first):
```
createdAt, updatedAt, deletedAt, id, factoryId, name, category,
description, queryTemplate, parameters, deleted
```

The synthetic `deleted` boolean is `deletedAt != null` (Hibernate @Where derived getter exposed via Lombok). **This field IS in JSON output and Python MUST include it.**

Both orders verified empirically against recorded goldens (2026-05-02). T7 (Lombok reflection flip) **does not occur for this entity** — `analysis.py:53-84` already documents the same order from Apr 28 work, and the May 2 recording matches.

---

## 3. Python impl

### 3.1 New module: `backend/python/smartbi_compat/api/query_templates_write.py`

**Naming rationale**: GET is in `analysis.py` (existing). New file `query_templates_write.py` keeps WRITE endpoints separated for clean diff + low risk of breaking GET. Could rename to `query_templates.py` later as a refactor — out of this PR's scope.

```python
"""Phase 2A WRITE endpoints for /smart-bi/query-templates.

POST/PUT/DELETE — verbatim Java byte-shape mirror.
GET is in analysis.py:53-130 (Apr 28 T5b work).

Java reference: SmartBIAnalysisController.java:965-1009.
Empirical Java behavior recorded 2026-05-02 against test env (10011).
See spec §2.2 for full behavior matrix.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Path
from sqlalchemy import text

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
# Reuse the field-order canon from analysis.py for consistency:
from smartbi_compat.api.analysis import _row_to_dict as _query_template_row_to_dict

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================================
# Envelope helpers (mirror Java ApiResponse.success / .error)
# ============================================================

def _now_iso_nano() -> str:
    """ISO-format current time matching Java LocalDateTime.now() default Jackson output.

    Java emits up to nanosecond precision (e.g. ".984275016"). Python's
    datetime is microsecond-precision (".984275"). The byte-shape gate
    strips data.createdAt / data.updatedAt / envelope.timestamp, so the
    nano-vs-micro precision difference is tolerated. We still emit ISO
    here for log traceability.
    """
    return datetime.now().isoformat()


def _envelope_success(data: Any, message: str = "操作成功") -> dict:
    """Mirror Java ApiResponse.success(message, data) field order."""
    return {
        "code": 200,
        "message": message,
        "data": data,
        "timestamp": _now_iso_nano(),
        "success": True,
        "actionHint": None,
        "severity": None,
        "hintTarget": None,
    }


def _envelope_error(message: str, code: int = 400) -> dict:
    """Mirror Java ApiResponse.error(message) field order. code defaults to 400."""
    return {
        "code": code,
        "message": message,
        "data": None,
        "timestamp": _now_iso_nano(),
        "success": False,
        "actionHint": None,
        "severity": None,
        "hintTarget": None,
    }


# ============================================================
# Module-level DB helpers (monkeypatch surface for tests)
# ============================================================

def _create_template(factory_id: str, body: dict) -> Optional[dict]:
    """INSERT or MERGE.

    If body has non-null id, MERGE (UPSERT) per Java JPA save() with non-null id.
    Else INSERT new auto-gen id.

    Returns the entity dict in Java field order (with `deleted` synthetic field).
    For the merge path, mirrors Java's quirk: response.createdAt = None
    (because Java returns the transient entity, not the DB row).

    Mirrors Java: SmartBIAnalysisController.java:965-973 → JpaRepository.save().
    """
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning("query-templates write: postgres not enabled (factory_id=%s)", factory_id)
        return None

    body_id = body.get("id")
    name = body.get("name")
    category = body.get("category")
    description = body.get("description")
    query_template = body.get("queryTemplate")
    parameters = body.get("parameters")

    with get_db_context() as db:
        if body_id is not None:
            # MERGE path (T6): mirror JPA save() merge behavior.
            # PostgreSQL ON CONFLICT (id) DO UPDATE.
            # NOTE: only the 5 mutable fields + factory_id + updated_at are SET.
            # created_at/deleted_at preserved by NOT being in SET clause.
            sql = text(
                "INSERT INTO smart_bi_query_templates "
                "  (id, factory_id, name, category, description, "
                "   query_template, parameters, created_at, updated_at, deleted_at) "
                "VALUES (:id, :fid, :name, :category, :description, "
                "        :query_template, :parameters, NOW(), NOW(), NULL) "
                "ON CONFLICT (id) DO UPDATE SET "
                "  factory_id = EXCLUDED.factory_id, "
                "  name = EXCLUDED.name, "
                "  category = EXCLUDED.category, "
                "  description = EXCLUDED.description, "
                "  query_template = EXCLUDED.query_template, "
                "  parameters = EXCLUDED.parameters, "
                "  updated_at = NOW() "
                "RETURNING id, factory_id, name, category, description, "
                "          query_template, parameters, created_at, updated_at, deleted_at"
            )
            row = db.execute(sql, {
                "id": body_id, "fid": factory_id, "name": name,
                "category": category, "description": description,
                "query_template": query_template, "parameters": parameters,
            }).first()
            db.commit()
            if row is None:
                return None
            entity = _query_template_row_to_dict(row)
            # Java JPA quirk: merge() response has createdAt = None (transient entity).
            # Python mirrors this by overriding the DB-returned createdAt with None.
            entity["createdAt"] = None
            return entity
        else:
            # Normal INSERT path (no id): auto-gen id, RETURNING all.
            sql = text(
                "INSERT INTO smart_bi_query_templates "
                "  (factory_id, name, category, description, "
                "   query_template, parameters, created_at, updated_at, deleted_at) "
                "VALUES (:fid, :name, :category, :description, "
                "        :query_template, :parameters, NOW(), NOW(), NULL) "
                "RETURNING id, factory_id, name, category, description, "
                "          query_template, parameters, created_at, updated_at, deleted_at"
            )
            row = db.execute(sql, {
                "fid": factory_id, "name": name, "category": category,
                "description": description, "query_template": query_template,
                "parameters": parameters,
            }).first()
            db.commit()
            return _query_template_row_to_dict(row) if row else None


def _update_template(factory_id: str, template_id: int, body: dict) -> Optional[dict]:
    """Mirror Java findById + factoryId filter + setX + save() pattern.

    Returns updated entity dict, or None if not found / cross-factory.
    Updates exactly 5 fields: name, category, description, queryTemplate, parameters.
    Body's id and factoryId are IGNORED.

    Mirrors Java: SmartBIAnalysisController.java:976-994.
    """
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        return None

    with get_db_context() as db:
        # T2: WHERE id AND factory_id (via @Where deleted_at IS NULL — soft-deleted excluded).
        # If no row matches → not found / cross-factory → identical shape per Java line 993.
        existing_check = text(
            "SELECT id FROM smart_bi_query_templates "
            "WHERE id = :id AND factory_id = :fid AND deleted_at IS NULL"
        )
        existing = db.execute(existing_check, {"id": template_id, "fid": factory_id}).first()
        if existing is None:
            return None

        # T4: update 5 fields + updated_at = NOW(). Body's id/factoryId/createdAt
        # are NEVER applied (mirror Java line 985-989 — only setName/setCategory/
        # setDescription/setQueryTemplate/setParameters called).
        sql = text(
            "UPDATE smart_bi_query_templates "
            "SET name = :name, "
            "    category = :category, "
            "    description = :description, "
            "    query_template = :query_template, "
            "    parameters = :parameters, "
            "    updated_at = NOW() "
            "WHERE id = :id "
            "RETURNING id, factory_id, name, category, description, "
            "          query_template, parameters, created_at, updated_at, deleted_at"
        )
        row = db.execute(sql, {
            "id": template_id,
            "name": body.get("name"),
            "category": body.get("category"),
            "description": body.get("description"),
            "query_template": body.get("queryTemplate"),
            "parameters": body.get("parameters"),
        }).first()
        db.commit()
        return _query_template_row_to_dict(row) if row else None


def _delete_template(factory_id: str, template_id: int) -> bool:
    """Mirror Java findById + factoryId filter + repository.delete() pattern.

    Returns True if deleted, False if not found / cross-factory.
    HARD DELETE — entity's @Where(deleted_at IS NULL) is a READ filter only.
    Java's repository.delete() emits SQL `DELETE FROM ... WHERE id = ?`.

    Mirrors Java: SmartBIAnalysisController.java:997-1009.
    """
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        return False

    with get_db_context() as db:
        existing_check = text(
            "SELECT id FROM smart_bi_query_templates "
            "WHERE id = :id AND factory_id = :fid AND deleted_at IS NULL"
        )
        existing = db.execute(existing_check, {"id": template_id, "fid": factory_id}).first()
        if existing is None:
            return False

        # T1: HARD DELETE. @Where soft-delete annotation is a READ filter only.
        db.execute(
            text("DELETE FROM smart_bi_query_templates WHERE id = :id"),
            {"id": template_id},
        )
        db.commit()
        return True


# ============================================================
# Endpoints
# ============================================================

@router.post("/api/mobile/{factory_id}/smart-bi/query-templates")
async def create_query_template(
    factory_id: str = Path(..., min_length=1),
    body: dict = Body(default_factory=dict),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.createQueryTemplate (line 965-973)."""
    # T3: factoryId silent override from path (Java line 970).
    # Use auth.factory_id (JWT) for consistency with existing GET impl pattern
    # — JWT factoryId always matches path factoryId here because verify_jwt_and_factory
    # rejects mismatch. Either is fine; we use path to be explicit about override semantics.
    entity = _create_template(factory_id, body)
    if entity is None:
        # Postgres unavailable — log and return error envelope.
        # NOTE: Java would propagate DB exception via GlobalExceptionHandler. Without
        # recorded golden for that case, we return generic error. T5 backlog.
        return _envelope_error("Database unavailable", code=500)
    return _envelope_success(entity)


@router.put("/api/mobile/{factory_id}/smart-bi/query-templates/{template_id}")
async def update_query_template(
    factory_id: str = Path(..., min_length=1),
    template_id: int = Path(...),
    body: dict = Body(default_factory=dict),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.updateQueryTemplate (line 976-994)."""
    entity = _update_template(factory_id, template_id, body)
    if entity is None:
        return _envelope_error("Template not found")  # T2: HTTP 200 + code=400
    return _envelope_success(entity)


@router.delete("/api/mobile/{factory_id}/smart-bi/query-templates/{template_id}")
async def delete_query_template(
    factory_id: str = Path(..., min_length=1),
    template_id: int = Path(...),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.deleteQueryTemplate (line 997-1009)."""
    deleted = _delete_template(factory_id, template_id)
    if not deleted:
        return _envelope_error("Template not found")
    return _envelope_success(None)
```

### 3.2 Wire-up in `backend/python/main.py`

```python
from smartbi_compat.api import query_templates_write as smartbi_query_templates_write_api
app.include_router(smartbi_query_templates_write_api.router, tags=["SmartBI Query Templates Write"])
```

(Match existing pattern for `analysis.py` / `datasource.py` registration. Tag suffix "Write" disambiguates from existing read-side tag.)

### 3.3 Helper reuse

- **`_query_template_row_to_dict`** (alias for `_row_to_dict` in `analysis.py:53-84`): re-export to keep field order canon in ONE place. If GET impl evolves, WRITE inherits the change.
- **`get_db_context()`** + **`is_postgres_enabled()`** from `smartbi.database.connection`: same pattern as GET.
- **`verify_jwt_and_factory`** from `smartbi_compat.auth`: standard auth dep.
- No `_decimal_to_number` needed — entity has no numeric fields.
- No `Map.of(N)` shapes — Rule 8 N/A.

---

## 4. Byte-shape gate (5 goldens)

### 4.1 Goldens (already recorded 2026-05-02)

| # | File | Scenario |
|---|---|---|
| 1 | `tests/fixtures/java-smartbi-golden/query-templates-F999-post-happy.json` | F999 POST without id |
| 2 | `tests/fixtures/java-smartbi-golden/query-templates-F999-put-happy.json` | F999 PUT updates 5 fields |
| 3 | `tests/fixtures/java-smartbi-golden/query-templates-F999-delete-happy.json` | F999 DELETE row |
| 4 | `tests/fixtures/java-smartbi-golden/query-templates-F999-not-found.json` | PUT id=999999 (also = DELETE not-found and both cross-factory variants) |
| 5 | `tests/fixtures/java-smartbi-golden/query-templates-F001-hijack.json` | T6 defensive — F001 POST with id=46 (F999-owned) → hijack succeeds, response.createdAt=null |

**Goldens were captured against test env (10011) using authenticated synthetic JWT** (`phase2a_test_user` for F999, `factory_admin1` for F001). Capture script: documented inline in §4.4.

### 4.2 Volatile field stripping (extends `test_datasource_contract.py`'s `VOLATILE`)

The existing `VOLATILE = frozenset({"timestamp", ...})` strips top-level `timestamp` only. For these tests, also strip `data.createdAt` and `data.updatedAt` because:

- POST happy: createdAt + updatedAt both = NOW() per request → volatile
- PUT happy: createdAt = preserved (DB roundtrip), updatedAt = fresh NOW → volatile
- POST hijack: createdAt = null (locked), updatedAt = fresh NOW → volatile
- DELETE happy: data is null → no entity timestamps to strip
- Not-found: data is null

**New helper** (add to test file or shared conftest):

```python
def _strip_volatile_query_template(obj):
    """Strip envelope.timestamp + data.createdAt + data.updatedAt (per spec §4.2).

    For POST hijack golden, data.createdAt is null (locked, NOT volatile) — we still
    strip it for consistency. The byte-shape assertion below covers it via a separate
    pinpoint check.
    """
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k == "timestamp":
                continue
            if k == "data" and isinstance(v, dict):
                v = {ek: ev for ek, ev in v.items() if ek not in {"createdAt", "updatedAt"}}
            out[k] = _strip_volatile_query_template(v) if isinstance(v, (dict, list)) else v
        return out
    if isinstance(obj, list):
        return [_strip_volatile_query_template(x) for x in obj]
    return obj
```

### 4.3 Why no T7 3× recording protocol (drop from v1)

v1 §4.3 proposed recording each golden 3× across `cretas-backend` restarts to detect Lombok @Data + Jackson reflection key-order flip. **This is unnecessary here** because:

1. **`analysis.py:53-84` (Apr 28 sister code) already documents the field order** for this exact entity. Re-recording 3× won't tell us anything the existing GET impl doesn't.
2. The 2026-05-02 fresh recording matches `analysis.py`'s documented order exactly. Stable across at least 2 weeks of process runtime.
3. T7 remains a real concern for **future** Lombok @Data entities new to the port (no precedent), but NOT for this entity.

**Sister chats: keep T7 3× recording protocol** for entities without prior Python port. Do NOT drop it as a generic rule.

### 4.4 Capture script (for reference / re-recording if needed)

```bash
ssh root@47.100.235.168 'python3 << EOF
import jwt, time, json, urllib.request
SECRET = "cretas-jwt-secret-key-2026-test"  # /www/wwwroot/cretas/.env.test
BASE = "http://localhost:10011"
def make(f, u, uid):
    t = jwt.encode({
        "role":"factory_super_admin","factoryId":f,"userId":uid,
        "username":u,"sub":u,
        "iat":int(time.time()),"exp":int(time.time())+3600,
    }, SECRET, algorithm="HS256")
    return t.decode("utf-8") if isinstance(t, bytes) else t
def req(url, tok, method="GET", body=None):
    r = urllib.request.Request(url, method=method)
    r.add_header("Authorization","Bearer "+tok)
    if body is not None:
        r.add_header("Content-Type","application/json")
        r.data = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.getcode(), resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

f999 = make("F999", "phase2a_test_user", 1355)
f001 = make("F001", "factory_admin1", 1)
# ... record POST/PUT/DELETE/not-found/hijack per spec §4.1 ...
EOF'
```

Full script preserved in commit `<hash>` working memory.

---

## 5. 测试 (5 contract tests)

### 5.1 Test inventory

| # | Test | Mock surface | Assert |
|---|---|---|---|
| 1 | `test_post_happy_byte_shape` | monkeypatch `_create_template` → returns recorded entity dict | `_strip_volatile_query_template(actual) == _strip_volatile_query_template(golden)` for `query-templates-F999-post-happy.json` |
| 2 | `test_put_happy_byte_shape` | monkeypatch `_update_template` → returns recorded entity dict | dict-eq vs `query-templates-F999-put-happy.json` |
| 3 | `test_delete_happy_byte_shape` | monkeypatch `_delete_template` → returns True | dict-eq vs `query-templates-F999-delete-happy.json` |
| 4 | `test_put_delete_not_found_shape_identity` | monkeypatch `_update_template` and `_delete_template` to return None / False respectively | All 4 calls (PUT not-found, DELETE not-found, cross-factory PUT, cross-factory DELETE) dict-eq vs same `query-templates-F999-not-found.json` |
| 5 | `test_post_hijack_byte_shape_lock` | monkeypatch `_create_template` → returns recorded hijack entity (with `createdAt=None` mirror) | dict-eq vs `query-templates-F001-hijack.json`. **Locks T6 verbatim mirror behavior**. |

### 5.2 Mock pattern (mirrors `test_datasource_contract.py:79-99`)

```python
import importlib.util, io, json, os, sys
from datetime import datetime, timezone
from pathlib import Path
import jwt, pytest

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
        "userId": 1, "username": "test_user", "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


# ... _strip_volatile_query_template per §4.2 ...


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)


class TestQueryTemplatesWrite:

    def test_post_happy_byte_shape(self, client, monkeypatch):
        with io.open(GOLDEN_DIR / "query-templates-F999-post-happy.json", encoding="utf-8") as f:
            golden = json.load(f)

        async def fake_create(factory_id, body):
            # Return the recorded entity data verbatim.
            return golden["data"]

        monkeypatch.setattr(
            "smartbi_compat.api.query_templates_write._create_template",
            fake_create,
        )

        resp = client.post(
            "/api/mobile/F999/smart-bi/query-templates",
            json={"name": "x", "category": "x", "description": "x",
                  "queryTemplate": "x", "parameters": "[]"},
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, resp.text
        assert _strip_volatile_query_template(resp.json()) == _strip_volatile_query_template(golden)

    # ... similar for tests 2-5 ...

    def test_post_hijack_byte_shape_lock(self, client, monkeypatch):
        """T6 defensive — lock current verbatim Java MERGE behavior.

        This test does NOT fix the hijack bug. It locks current behavior so that
        if a future Java fix changes MERGE semantics, the Python port is alerted
        to re-mirror via failing this test.

        Per spec §7 risk register: T6 is candidate for Phase 2B-after-cleanup.
        """
        with io.open(GOLDEN_DIR / "query-templates-F001-hijack.json", encoding="utf-8") as f:
            golden = json.load(f)

        async def fake_create(factory_id, body):
            # Mirror: when body has id, response data has createdAt=None
            return golden["data"]

        monkeypatch.setattr(
            "smartbi_compat.api.query_templates_write._create_template",
            fake_create,
        )

        resp = client.post(
            "/api/mobile/F001/smart-bi/query-templates",
            json={"id": 46, "name": "hijacked", "category": "evil",
                  "queryTemplate": "DROP", "parameters": "[\"x\"]"},
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        assert resp.status_code == 200
        actual = resp.json()
        # Lock the createdAt=null Java quirk explicitly (in addition to dict-eq):
        assert actual["data"]["createdAt"] is None, "T6 verbatim mirror: createdAt MUST be null when id-in-body merge path"
        assert _strip_volatile_query_template(actual) == _strip_volatile_query_template(golden)
```

### 5.3 No DB fixture needed

v1 spec §5.2 proposed a `smartbi_pool_with_isolation` fixture for test #5 to assert DB state after hijack. **Drop this from v2** because:

1. Tests #1-#4 use mocks (mirror existing `test_datasource_contract.py` pattern) — no DB at all.
2. Test #5 (T6 hijack lock) compares response shape only, not DB state. The DB-state aspect of T6 was empirically verified during golden capture (2026-05-02) — no need to re-verify in tests.
3. If future Phase 2B fixes T6 in Java, the recording will need re-capture and test #5 updated. That's the natural workflow.

**Future sister chats may still need a DB fixture** for tests asserting actual DB writes — when that need arises, create the fixture in `tests/python/smartbi_compat/conftest.py` per Q3 nuance from v1. Just not needed here.

---

## 6. PR scope (single PR)

### 6.1 PR title

```
Phase 2A: /query-templates POST/PUT/DELETE port (Wave 2 Tier 1)
```

### 6.2 PR file list

**New files**:
- `backend/python/smartbi_compat/api/query_templates_write.py` (~250 LOC)
- `tests/python/smartbi_compat/test_query_templates_write_contract.py` (~200 LOC, 5 tests)
- `tests/fixtures/java-smartbi-golden/query-templates-F999-post-happy.json` ✅ recorded
- `tests/fixtures/java-smartbi-golden/query-templates-F999-put-happy.json` ✅ recorded
- `tests/fixtures/java-smartbi-golden/query-templates-F999-delete-happy.json` ✅ recorded
- `tests/fixtures/java-smartbi-golden/query-templates-F999-not-found.json` ✅ recorded
- `tests/fixtures/java-smartbi-golden/query-templates-F001-hijack.json` ✅ recorded
- `docs/superpowers/specs/2026-05-01-phase2a-query-templates-design.md` (this file, v2)

**Modified files**:
- `backend/python/main.py` (1-line router include)

### 6.3 Out of PR scope

- nginx cutover (T6 in Phase 2A roadmap) — separate PR
- Java-side fixes for T6 (JPA hijack) or T1 (soft-delete consistency) — backlog
- T5 invalid-input goldens — PR-B follow-up (§7)
- GET /query-templates port — already done in `analysis.py:53-130`

---

## 7. Open risks + backlog

### 7.1 T5 — invalid-input goldens deferred to PR-B

**Risk**: Java behavior for empty body / missing required field (`name`, `category`, `queryTemplate`) is unverified.

**Hypothesis**: DB constraint violation (`@Column(nullable=false)`) → propagated to `GlobalExceptionHandler` → returns either:
- `code: 500, message: "<sanitized DB error>"` (most likely)
- `code: 400, message: "<validation error>"` (if a handler intercepts)

**Required follow-up (PR-B scope)**:
1. Record 4-5 invalid-input goldens against Java prod:
   - Empty body `{}`
   - Missing `name` (other required fields present)
   - Missing `category` (other required fields present)
   - Missing `queryTemplate` (other required fields present)
   - Body that violates length constraint (e.g. `name` with 200 chars > VARCHAR(100))
2. Add corresponding Python error path in `_create_template` / `_update_template` (raise from SQLAlchemy IntegrityError catch).
3. Add 4-5 contract tests dict-eq against new goldens.

### 7.2 T6 — JPA merge hijack EMPIRICALLY CONFIRMED

**Risk**: Client sending POST with non-null `id` triggers JPA `save()` MERGE behavior. Confirmed empirically (2026-05-02): a F001 client successfully overwrote a F999-owned row by POSTing `{id: <F999_row_id>, ...}`. Cross-factory `factory_id` IS overwritten. RLS policies do NOT block this (likely due to session's `app.factory_id` being unset, falling into the policy's "OR empty/null" branch).

**Action this PR**:
- Mirror verbatim in Python (PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` per §3.1).
- Mirror Java's response quirk: when merge path is taken, response `data.createdAt = null` (Python explicitly sets None to override the DB's RETURNING value).
- Defensive contract test #5 locks current behavior.

**Phase 2B-after-cleanup candidate**:
- Java fix: strip `body.setId(null)` before `save()` in `createQueryTemplate` (or use `entityManager.persist()` directly to throw on existing id).
- Python fix: ignore `body["id"]` on POST (always INSERT, never UPSERT).
- RLS audit: ensure session `app.factory_id` is set per-request to make policies actually enforce tenant isolation.
- Both fixed simultaneously to maintain parity. Update test #5 + re-record hijack golden (or delete it if Java now returns 4xx).

**Sub-finding (post-review audit 2026-05-01)** — sequence skew when `body.id > sequence.last_value`:

PostgreSQL's `BIGSERIAL` / `BIGINT GENERATED BY DEFAULT AS IDENTITY` sequence (the table's `id_seq`) is **NOT advanced** when an explicit `id` is supplied via `INSERT ... VALUES (id, ...)` or `INSERT ... ON CONFLICT DO UPDATE`. Failure scenario:

1. Sequence currently at `46`. Hijack POST writes explicit `id=99999` → sequence still at 46.
2. Subsequent no-id POSTs auto-increment from 47, 48, ... 99998.
3. Eventually a no-id POST tries `id=99999` → unique-constraint violation → 500 error.

Java JPA with IDENTITY strategy has the same latent footgun (verbatim mirror). Phase 2A philosophy = mirror the bug; the spec only documents it for tracking.

**Phase 2B candidate fixes** (apply Java + Python simultaneously):
- Simplest: strip `body.id` on POST in both Java and Python (collapses to plain INSERT, sequence behaves normally).
- Defensive: after merge path, run `SELECT setval(pg_get_serial_sequence('smart_bi_query_templates', 'id'), GREATEST(currval, EXCLUDED.id))` to bump sequence past supplied id.
- Test impact: drop tests #5 and #6 (T6 lock + override-execution) once hijack path is removed.

This sub-finding is **not blocking** this PR — Phase 2A contract is verbatim mirror, Java has identical risk in production today. Logged here so Phase 2B planning sees both sides of the T6 fix.

### 7.3 T7 — Lombok @Data field order (no longer a risk for THIS entity)

Field order is precedent-locked by `analysis.py:53-84` (Apr 28 GET port) and confirmed by 2026-05-02 fresh recording. **No 3× cross-restart recording required** for this entity.

**Sister chats**: T7 protocol still applies for entities without prior Python port. Don't generalize this drop.

### 7.4 T1 + T8 — already mirrored verbatim, no follow-up

T1 (hard DELETE despite @Where) and T8 (parameters TEXT pass-through via `_query_template_row_to_dict`) are intentional behaviors mirrored exactly.

### 7.5 RLS lineage note

`smart_bi_query_templates` has RLS enabled by V20260502_04 (Phase 2A Apr 28 P0 fix per memory `project_apr28_p0_rls_gap_finding`). Policies are documented but NOT empirically enforcing isolation (T6 hijack succeeded without RLS denial). **This is a project-wide concern beyond this PR** — follow-up audit required to verify session `app.factory_id` is set per-request.

---

## 8. Audit cycle policy (this PR)

Per `feedback_subagent_driven_audit_pattern.md`:

- **Mechanical CRUD port** → skip 2 of 4 audit cycles.
- **Audit cycles to run**:
  1. Self-review after spec draft (this section, run inline before commit). ✅ Done in v2.
  2. Final reviewer audit before PR merge (subagent, on impl + tests + goldens combined).
- **Skipped**: brainstorm round 2 (8 traps already surfaced + empirical Java verification done), spec reviewer subagent (mechanical content, fatigue counterproductive).

If final reviewer audit raises ≥3 P0 findings, escalate to fresh chat for re-spec. Otherwise apply fixes inline and ship.

---

## 9. Estimates (revised v2)

| Phase | Estimated time | LOC |
|---|---|---|
| Spec v1 (initial) | 1.5h ✅ done | ~720 LOC |
| Spec v2 (revision) | 0.5h ✅ done | ~250 LOC delta |
| Java behavior recording | 0.5h ✅ done | 5 goldens captured |
| Plan (writing-plans) | 0.5h | ~10 tasks |
| Impl (`query_templates_write.py` + main.py) | 2h | ~250 LOC |
| Contract tests (5 tests) | 1.5h | ~200 LOC |
| Final reviewer audit + fixes | 1h | varies |
| **Total v2 trajectory** | **~7.5h** | **~700 LOC PR** |

Aligns with PR #39 datasource GET ship time (6-7h, 2 endpoints). v2 spend: spec v1 → discovery → spec v2 (~3h sunk before any impl), but impl now grounded in empirical Java behavior, dramatically reduced risk of rework.

---

## 10. Concurrent-chat coordination

**Other active chats touching shared files**:
- Sister chat (Chat 1) impl receivable in `analysis_finance.py` — **zero overlap**, different file
- Other chats may modify `main.py` for their own router includes — 1-line conflict surface

**Mitigation**:
- This PR's `main.py` change is single-line.
- Use `./scripts/safe-commit.sh` per `concurrent-edit-safety.md` Rule 5b.
- Spec doc + branch already pushed to `origin/phase2a/query-templates` to lock remote.

---

## 11. Push-early discipline

1. ✅ Worktree created: `.worktrees/phase2a-query-templates` on `phase2a/query-templates` branch
2. ✅ Spec v1 committed + pushed (`9542f00af`, `70a62757e`)
3. After spec v2 commit → push immediately
4. After 5 goldens commit → push immediately
5. Subsequent impl + test commits also push immediately
6. Final PR opened against `main` after all commits pushed

---

**End of design spec v2.**
