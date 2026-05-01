# Phase 2A `/datasource` GET endpoints port (Wave 2 Tier 1) — Design Spec

**Date**: 2026-05-01
**Branch**: `phase2a/datasource-gets`
**Worktree**: `.worktrees/phase2a-datasource-gets`
**Predecessors**:
- PR #32 — sub-endpoints port merged (`ccdeb4b1b`)
- PR #33/#34 — receivable/budget specs merged (sister chats impl in flight)
- PR #35 — Rule 8 Map.of(N) hash order rules merged (`5d284d38d`)

---

## 1. 范围 + Scope cut

### 1.1 In scope (本 PR)

2 个 GET endpoints, 单 PR ship:

- `GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/fields` → `ApiResponse<List<SmartBiFieldDefinition>>`
- `GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/history?page=N&size=N` → `ApiResponse<Page<SmartBiSchemaHistory>>` (paginated)

### 1.2 显式 deferred to Wave 3 (Tier 2 — 单独 spec)

- `GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/preview` → `ApiResponse<SchemaChangePreview>`

**推迟理由** (固化决策, 别人问起也是这个答案):
- `SchemaChangePreview` 嵌套 DTO + LLM mapping suggestions = Tier 2 复杂度, 不是 Tier 1
- LLM mapping suggestions 触 Phase 2A out-of-scope (跟 `/query` NL→SQL 一样 LLM 链路耦合)
- byte-shape parity 难: LLM 输出非 deterministic, F001 真窗 golden 需要 LLM 模型固定 + seed 控制
- 单独 spec 价值: `/preview` 配得上 4-cycle audit, 被 `SchemaChangePreview` 套件 impl 撑起来
- backlog map §3 估时 "1-2h each" 错了, `/preview` 应 re-tier 到 Tier 2 (8-12h)

**Backlog map 待 update** (本 PR ship 后由 orchestrator chat 派人处理, 本 chat 不做):
- `/preview` 从 Tier 1 降到 Tier 2, 加 8-12h 估时 + LLM 耦合风险标注
- `/fields` + `/history` 标 ✅ shipped (本 PR)

### 1.3 显式 not 范围

- 任何 POST/PUT/DELETE datasource endpoints (write 路径有 RBAC + DDL 副作用)
- `/datasource/list` (sister Tier 1 task — 另起 PR)
- `/datasource/upload` (POST, Tier 2 — schema detect)
- `/datasource/apply` (POST, Tier 2 — DDL exec)

---

## 2. Java 引用 + JSON shape

### 2.1 引用位置

| 元素 | 位置 |
|---|---|
| Controller `getDatasourceFields` | `SmartBIAnalysisController.java:747-762` |
| Controller `getSchemaHistory` | `SmartBIAnalysisController.java:764-780` |
| Service `getDatasourceFields` | `SmartBiSchemaServiceImpl.java:225-234` |
| Service `getSchemaHistory` | `SmartBiSchemaServiceImpl.java:289-298` |
| Entity `SmartBiFieldDefinition` | `entity/smartbi/SmartBiFieldDefinition.java` (144 LOC, 14 fields + audit) |
| Entity `SmartBiSchemaHistory` | `entity/smartbi/SmartBiSchemaHistory.java` (119 LOC, 13 fields + audit) |
| Repository `findByDatasourceIdOrderByDisplayOrderAsc` | `SmartBiFieldDefinitionRepository.java` |
| Repository `findByDatasourceIdOrderByCreatedAtDesc` | `SmartBiSchemaHistoryRepository.java` (Spring Data Pageable) |

### 2.2 Java service 行为 (datasource exists check)

**关键行为** (Java line 229-231 + 293-295):

```java
if (!datasourceRepository.existsById(datasourceId)) {
    throw new EntityNotFoundException("数据源不存在: " + datasourceId);
}
```

Controller catches → `ApiResponse.error("...failed: " + ErrorSanitizer.sanitize(e))` → HTTP 200, `success: false`.

**Python 必须 mirror**: 不存在的 datasourceId 返 200 + success=false + sanitized error message. **不要返 404** (会 break 现有 frontend client error handling).

### 2.3 SmartBiFieldDefinition JSON shape (Lombok @Data, JPA entity)

字段 (按 BaseEntity 继承 + @Data getter 顺序, JPA 默认 Jackson 序列化):

```
id, datasourceId, fieldName, fieldAlias, fieldType (enum string),
metricType (enum string), aggregation (enum string), isKpi (bool),
chartTypes (string, JSON-encoded), description, displayOrder, isVisible,
formatPattern, createdAt, updatedAt, deletedAt (null when not soft-deleted)
```

`@JsonIgnore datasource` field — NOT in JSON output (避免循环引用).

**字段顺序不可凭直觉** — Lombok @Data 生成的 getter 顺序通常按声明顺序但 Jackson 反射顺序不保证稳定. **F999 + invalid_id 录 golden 反推真实 order**.

### 2.4 Spring Page<SmartBiSchemaHistory> JSON shape

Spring Data 的 `PageImpl` 序列化为 JSON 通常含:

```json
{
  "content": [...],
  "pageable": {...},
  "totalElements": 0,
  "totalPages": 0,
  "last": true,
  "size": 20,
  "number": 0,
  "sort": {...},
  "first": true,
  "numberOfElements": 0,
  "empty": true
}
```

**字段顺序也不可凭直觉** — Spring `PageImpl` 没用 `@JsonPropertyOrder`, Jackson 默认按 getter 反射顺序. 必须录 golden.

### 2.5 Pagination query params

Java 用 `@PageableDefault(size = 20)` — 默认 `page=0&size=20`. 客户端可传:
- `?page=N` (0-based)
- `?size=N` (max ~ 配置)
- `?sort=field,direction` (Spring 自动解析)

Python 必须接受同 query params, 翻成 SQL `LIMIT/OFFSET + ORDER BY`.

### 2.6 BaseEntity audit fields

`SmartBiFieldDefinition` + `SmartBiSchemaHistory` 都继承 `BaseEntity` (有 `createdAt` / `updatedAt` / `deletedAt`). Soft-delete 通过 `@Where(clause = "deleted_at IS NULL")` — **Python SQL 必须加 `WHERE deleted_at IS NULL`** 镜像同行为.

---

## 3. Python impl 架构

### 3.1 文件位置

**新建** `backend/python/smartbi_compat/api/datasource.py` — 跟 sister chats 改的 `analysis_finance.py` 完全分离, 零冲突. 现有 `analysis.py` 保持不动 (那是另一类 endpoint).

### 3.2 Route handlers (pseudo-code)

```python
# backend/python/smartbi_compat/api/datasource.py
from datetime import date, datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/fields")
async def get_datasource_fields(
    factory_id: str,
    datasource_id: int,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getDatasourceFields line 747-762.

    Behavior mirror:
    - datasource not exist → 200 + success=false + sanitized error message (Java line 230)
    - empty fields list (datasource exists, no fields) → 200 + success=true + data=[]
    - non-empty → 200 + success=true + data=[entity dicts in display_order ASC]
    """
    fields = await _query_field_definitions(datasource_id)
    if fields is None:
        # datasource not found
        return wrap_response(
            data=None,
            success=False,
            code=500,
            message=f"Get field definitions failed: 数据源不存在: {datasource_id}",
        )
    return wrap_response(data=fields)


@router.get("/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/history")
async def get_schema_history(
    factory_id: str,
    datasource_id: int,
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    sort: Optional[str] = Query(None),  # "field,direction" Spring format
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getSchemaHistory line 764-780.

    Behavior mirror:
    - datasource not exist → 200 + success=false + sanitized error message
    - empty history (datasource exists, no history) → 200 + success=true + data=PageImpl(content=[])
    - default sort: createdAt DESC (Java findByDatasourceIdOrderByCreatedAtDesc)
    """
    page_data = await _query_schema_history_page(datasource_id, page, size, sort)
    if page_data is None:
        return wrap_response(
            data=None,
            success=False,
            code=500,
            message=f"Get history failed: 数据源不存在: {datasource_id}",
        )
    return wrap_response(data=page_data)
```

### 3.3 SQL helpers (pseudo-code)

```python
async def _query_field_definitions(datasource_id: int) -> Optional[list[dict]]:
    """Returns list of field definition dicts in display_order ASC.
    Returns None when datasource doesn't exist (caller handles error wrap).
    """
    pool = await _get_cretas_pool()  # cretas_db (per PR #23 hotfix pattern)
    if pool is None:
        return None  # treat connection failure as not-found per Java behavior

    async with pool.acquire() as conn:
        # First check datasource existence (Java line 229)
        exists = await conn.fetchval(
            "SELECT 1 FROM smart_bi_datasource WHERE id = $1 AND deleted_at IS NULL",
            datasource_id,
        )
        if not exists:
            return None

        rows = await conn.fetch(
            """
            SELECT * FROM smart_bi_field_definition
            WHERE datasource_id = $1 AND deleted_at IS NULL
            ORDER BY display_order ASC
            """,
            datasource_id,
        )
        return [_field_def_to_json(dict(r)) for r in rows]


async def _query_schema_history_page(
    datasource_id: int, page: int, size: int, sort: Optional[str]
) -> Optional[dict]:
    """Returns Spring PageImpl-shaped dict. None when datasource not exist."""
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

        # Total count for pagination
        total = await conn.fetchval(
            """
            SELECT COUNT(*) FROM smart_bi_schema_history
            WHERE datasource_id = $1 AND deleted_at IS NULL
            """,
            datasource_id,
        )

        # Page rows (default ORDER BY created_at DESC per Java repo method)
        order_clause = _parse_sort_param(sort) or "ORDER BY created_at DESC"
        rows = await conn.fetch(
            f"""
            SELECT * FROM smart_bi_schema_history
            WHERE datasource_id = $1 AND deleted_at IS NULL
            {order_clause}
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
            sort=sort,
        )


def _build_page_impl(
    content: list, page: int, size: int, total: int, sort: Optional[str]
) -> dict:
    """Mirror Spring PageImpl JSON shape — key order verified by golden recording.

    Default order (subject to golden verification):
      content, pageable, totalElements, totalPages, last, size, number, sort,
      first, numberOfElements, empty
    """
    total_pages = (total + size - 1) // size if size > 0 else 0
    sort_obj = _parse_sort_obj(sort)
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
        "last": page >= total_pages - 1 if total_pages > 0 else True,
        "size": size,
        "number": page,
        "sort": sort_obj,
        "first": page == 0,
        "numberOfElements": len(content),
        "empty": len(content) == 0,
    }
```

### 3.4 DTO transformers

`_field_def_to_json(row: dict) -> dict` and `_history_to_json(row: dict) -> dict` translate snake_case DB rows to camelCase JSON keys (per `.claude/rules/field-naming-convention.md`). **Key order matches golden** (Lombok `@Data` getter order — record golden first, mirror order in transformer).

Audit fields (`createdAt`, `updatedAt`, `deletedAt`): emit ISO 8601 datetime strings. `deletedAt` 永远 null (since soft-deleted rows filtered out).

---

## 4. F999 byte-shape gate

### 4.1 Test cases per endpoint

| Case | Description | Expected response shape |
|---|---|---|
| **F999, datasourceId=999999 (not exist)** | F999 factory likely has no datasources at all | 200 + `success: false` + sanitized error msg (Java line 230 EntityNotFoundException catch) |
| **F999, datasourceId=1 (likely not exist either)** | Same as above (F999 factory genuinely empty) | Same — 200 + success=false |
| **F001, datasourceId=<real one if exists>** | F001 has real datasources (per backlog map note) | 200 + success=true + non-empty data (post-deploy smoke only, not CI) |

**记录策略**: F999 with non-existent datasourceId IS the canonical empty case for this endpoint family — it's the only case Python can mock cleanly. F001 cases recorded for sister-chat reference + post-deploy smoke; not enforced in CI.

### 4.2 Goldens

```
tests/fixtures/java-smartbi-golden/
  ├─ datasource-F999-fields-not-exist.json    [NEW, F999/999999/fields]
  ├─ datasource-F999-history-not-exist.json   [NEW, F999/999999/history]
  ├─ datasource-F001-fields-real.json         [NEW, F001/<real_id>/fields, post-deploy]
  ├─ datasource-F001-history-real.json        [NEW, F001/<real_id>/history, post-deploy]
```

Naming convention follows `analysis-finance-F{factory}-{detail}.json` style.

### 4.3 Map.of(N) risk per Rule 8

- `/history` Spring `PageImpl` JSON: NOT `Map.of` based — `PageImpl` is a class with getters, Jackson reflects deterministically. Order should be stable across requests. **Still record golden + mirror order in `_build_page_impl`** — don't assume.
- `/fields` Lombok `@Data` entity list: each item is a JPA entity with @Column-annotated fields, Jackson reflects via getter order. Stable but **record golden to confirm**.
- Error envelope (success=false case): standard `{success, data, message, code}` from existing `wrap_response` helper.

---

## 5. 测试策略

### 5.1 Contract tests (CI-enforced)

`tests/python/smartbi_compat/test_datasource_contract.py` (new file):

```python
class TestDatasourceFields:
    def test_f999_fields_not_exist_data_keys_match_golden(self, client):
        # No mocks needed — real DB query against test DB will return None
        # for non-existent datasource_id=999999, mirroring Java
        ...

    def test_f999_fields_not_exist_byte_shape(self, client):
        ...


class TestSchemaHistory:
    def test_f999_history_not_exist_data_keys_match_golden(self, client):
        ...

    def test_f999_history_not_exist_byte_shape(self, client):
        ...
```

4 tests total (2 per endpoint).

**Mock strategy**: Use `monkeypatch.setattr` on `_query_field_definitions` / `_query_schema_history_page` to return `None` (mirrors not-exist case). Don't hit real DB — test isolation.

### 5.2 Post-deploy smoke (not CI)

After PR merged + deployed:
1. `record-java-golden.sh` against F001 real datasource (need to find a valid `datasource_id` first)
2. Hit Python 8084 same endpoint
3. dict-eq compare F001 goldens

If F001 doesn't have any datasource, skip smoke. F999 goldens are sufficient for CI.

---

## 6. PR scope + commits

**Commits estimate** (~6-8):
1. spec + plan
2. `_get_cretas_pool` import + datasource.py skeleton + router register in `main.py`
3. `_query_field_definitions` + `_field_def_to_json` + `/fields` route
4. `_query_schema_history_page` + `_history_to_json` + `_build_page_impl` + `/history` route
5. record F999 goldens (2 files)
6. `TestDatasourceFields` + `TestSchemaHistory` (4 tests)
7. final scope verify + push + PR

**LOC budget**: ~250 (impl 150 + tests 60 + spec/plan 40).

**CI gate**: pytest baseline + 4 new = N+4 全过.

**PR title**: "Phase 2A: /datasource fields + history GET (Wave 2 Tier 1, /preview deferred)"

**PR body 关键 note**:
- 解释 /preview 推迟原因 (引用本 spec §1.2)
- 提一句 "Backlog map 需要 update: /preview re-tier to Tier 2" (orchestrator 后续处理)
- F001 post-deploy smoke 标 unchecked

---

## 7. Open risks + mitigations

| 风险 | Mitigation |
|---|---|
| F999 没 datasource → 所有 case 都走 not-exist 分支, golden 都是 error wrap | acceptable — error wrap shape 是有效契约, F001 smoke 兜底真窗 |
| Spring `PageImpl` 字段顺序假设错 | 强制录 golden 反推, 不写 hardcoded order |
| Lombok `@Data` getter 反射顺序 across JVM/Jackson 版本变化 | golden 录死现状 (2026-05-01 JVM/Jackson combo); 升级 Java 时 re-record |
| Soft-delete `@Where` 没 mirror 到 Python SQL | 显式 `WHERE deleted_at IS NULL` 加在 helper 里, code review 抓 |
| 错误信息含中文 + datasource_id (PII?) | Java already sanitizes via `ErrorSanitizer.sanitize`; Python mirror exact behavior, 不二次 sanitize |
| `?sort=field,dir` 参数 Spring 多种写法 | 第一版只支持 default sort + 单字段; 复杂 sort spec §3.5 backlog |

---

## 8. References

- Java reference root: `backend/java/cretas-api/src/main/java/com/cretas/aims/`
  - Controller: `controller/SmartBIAnalysisController.java`
  - Service: `service/smartbi/impl/SmartBiSchemaServiceImpl.java`
  - Entities: `entity/smartbi/SmartBi{FieldDefinition,SchemaHistory}.java`
- PR #23 hotfix (`get_cretas_pool` pattern): `b6a536086`
- Backlog map: `docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md` §3 Tier 1
- Rule 8 (Map.of order): `.claude/rules/python-java-port.md`
- Live Java backend: `47.100.235.168:10011` (test env)
