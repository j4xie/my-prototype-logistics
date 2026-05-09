# Phase 2C Tier 1 — `SmartBIConfigController` 41 Endpoints Port Design

**Phase**: 2C Tier 1 (Config — pure CRUD + reload + chart-template recommend)
**Status**: Design / planning doc only — kickoff blocked on Phase 2C trigger gates (T6.5 Phase C complete)
**Date**: 2026-05-09
**Predecessor**: PR #152 scoping spec (`docs/superpowers/specs/2026-05-15-phase2b-port-pipeline-scoping-spec.md`)
**Sister docs**:
- `.claude/rules/python-java-port.md` (Rules 1–12 from Phase 2A)
- `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` (KEEP list source)
- `docs/superpowers/specs/2026-05-07-smartbi-migration-runner-spec.md` (schema-change protocol)

> ⚠️ **Naming clarification**: PR #152 file is named `phase2b-port-pipeline-scoping-spec.md`
> but per canonical project naming the **non-analysis** SmartBI port pipeline is **Phase 2C**
> (Phase 2B is reserved for the BGE / classifier / chat-side enablement work that
> already shipped end-Apr/early-May 2026). This doc uses the canonical Phase 2C name
> consistently. Filename references to the predecessor doc retain its original `phase2b`
> prefix to match what is actually checked into the repo.

---

## 0. TL;DR

**Scope**: Port the 41 endpoints currently served by `SmartBIConfigController.java`
(`/api/mobile/smartbi-config/*`) to Python (`backend/python/smartbi_compat/`),
preserving JSON byte-shape parity (dict-eq gate per Rule 4 Phase 2A standard) and
existing frontend contracts. After cutover, Java controller + 7 Java service classes
deleted (Phase 2C-Tier-1-D cleanup).

**Endpoint inventory** (`/api/mobile/smartbi-config/*`):

| Sub-domain | # endpoints | Java service | Python module (proposed) |
|---|---:|---|---|
| intents | 5 | `SmartBIConfigService` (intents path) | `config_intents.py` |
| thresholds | 5 | `AlertThresholdService` (delegated by ConfigService) | `config_thresholds.py` |
| incentive-rules | 5 | `IncentiveRuleService` (delegated) | `config_incentive_rules.py` |
| field-mappings | 5 | `SmartBIConfigService` (dictionary path) | `config_field_mappings.py` |
| metric-formulas | 5 | `MetricFormulaService` (delegated) | `config_metric_formulas.py` |
| chart-templates | 9 | `ChartTemplateService` (delegated) | `config_chart_templates.py` |
| reload-all + status | 2 | `SmartBIConfigService` (orchestrator) | `config_admin.py` |
| data-sources | 5 | `DataSourceRegistryService` (independent) | `config_data_sources.py` |
| **TOTAL** | **41** | 7 distinct services | 8 sub-modules |

Endpoint-counts source: `SmartBIConfigController.java` (834 LOC, all 41 endpoints inline).

**Estimated effort**: ~4–6 weeks of port impl + ~2 weeks dryrun + ~1 week cutover (T6-pattern).
Detailed in §7.

**Hard prerequisites** (will not start before):
1. T6.5 Phase C complete (Java analysis controller files removed, `smartbi_compat/` module
   layout settled, no test-vs-prod schema drift unresolved).
2. Phase 2A retrospective (PR #151) sign-off.
3. Frontend code-path map snapshot (Web-Admin Vue + RN — operator deliverable).
4. Phase 2B ↔ Phase 2C naming reconciled in canonical retrospective.

---

## 1. Endpoint inventory (group by sub-domain)

Source of truth: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIConfigController.java`
(unchanged in `origin/main` as of 2026-05-09 — no refactors expected before Phase 2C).

All endpoints share: `BASE = /api/mobile/smartbi-config`. **No `{factoryId}` in path.** Factory
context derived from JWT (see §5 — multi-factory routing).

### 1.1 Intents (5 endpoints) — `BASE/intents`

| # | Method | Path | Java line | Service method | Body / params |
|---:|:---:|---|---:|---|---|
| 1 | GET | `/intents?category=` | 56 | `listIntents(category)` | optional query: `category` |
| 2 | POST | `/intents` | 73 | `createIntent(config)` | `AiIntentConfig` body |
| 3 | PUT | `/intents/{id}` | 93 | `updateIntent(id, config)` | path: UUID; body: `AiIntentConfig` |
| 4 | DELETE | `/intents/{id}` | 114 | `deleteIntent(id)` | path: UUID (soft-delete) |
| 5 | POST | `/intents/reload` | 134 | `reloadIntents()` | (no body) — invalidate cache |

Write endpoints (POST/PUT/DELETE/reload) carry `@RequirePermission({"analytics:read_write"})`.

### 1.2 Thresholds (5 endpoints) — `BASE/thresholds`

| # | Method | Path | Java line | Service method |
|---:|:---:|---|---:|---|
| 6 | GET | `/thresholds?type=` | 150 | `listThresholds(type)` |
| 7 | POST | `/thresholds` | 167 | `createThreshold(threshold)` |
| 8 | PUT | `/thresholds/{id}` | 188 | `updateThreshold(id, threshold)` |
| 9 | DELETE | `/thresholds/{id}` | 209 | `deleteThreshold(id)` |
| 10 | POST | `/thresholds/reload` | 229 | `reloadThresholds()` |

Type enum: `SALES / FINANCE / DEPARTMENT / PRODUCTION / QUALITY`.

### 1.3 Incentive Rules (5 endpoints) — `BASE/incentive-rules`

| # | Method | Path | Java line | Service method |
|---:|:---:|---|---:|---|
| 11 | GET | `/incentive-rules?ruleCode=` | 245 | `listIncentiveRules(ruleCode)` |
| 12 | POST | `/incentive-rules` | 262 | `createIncentiveRule(rule)` |
| 13 | PUT | `/incentive-rules/{id}` | 283 | `updateIncentiveRule(id, rule)` — `id: Long` |
| 14 | DELETE | `/incentive-rules/{id}` | 304 | `deleteIncentiveRule(id)` |
| 15 | POST | `/incentive-rules/reload` | 324 | `reloadIncentiveRules()` |

Rule code examples: `SALES_TARGET / QUALITY_SCORE / ATTENDANCE_RATE`.

### 1.4 Field Mappings (5 endpoints) — `BASE/field-mappings`

| # | Method | Path | Java line | Service method |
|---:|:---:|---|---:|---|
| 16 | GET | `/field-mappings?dictType=` | 340 | `listFieldMappings(dictType)` |
| 17 | POST | `/field-mappings` | 357 | `createFieldMapping(mapping)` |
| 18 | PUT | `/field-mappings/{id}` | 378 | `updateFieldMapping(id, mapping)` — `id: Long` |
| 19 | DELETE | `/field-mappings/{id}` | 399 | `deleteFieldMapping(id)` |
| 20 | POST | `/field-mappings/reload` | 419 | `reloadFieldMappings()` |

Dict types: `region / department / metric / time / dimension`. Entity = `SmartBiDictionary`.

### 1.5 Metric Formulas (5 endpoints) — `BASE/metric-formulas`

| # | Method | Path | Java line | Service method |
|---:|:---:|---|---:|---|
| 21 | GET | `/metric-formulas?formulaType=` | 435 | `listMetricFormulas(formulaType)` |
| 22 | POST | `/metric-formulas` | 452 | `createMetricFormula(formula)` |
| 23 | PUT | `/metric-formulas/{id}` | 472 | `updateMetricFormula(id, formula)` — `id: Long` |
| 24 | DELETE | `/metric-formulas/{id}` | 493 | `deleteMetricFormula(id)` |
| 25 | POST | `/metric-formulas/reload` | 513 | `reloadMetricFormulas()` |

Formula types: `SIMPLE / DERIVED / CUSTOM`.

### 1.6 Chart Templates (9 endpoints) — `BASE/chart-templates`

| # | Method | Path | Java line | Service method |
|---:|:---:|---|---:|---|
| 26 | GET | `/chart-templates?category=&chartType=` | 529 | `listChartTemplates(category, chartType)` |
| 27 | GET | `/chart-templates/{code}?factoryId=` | 547 | `getChartTemplate(code, factoryId)` — supports factory override |
| 28 | POST | `/chart-templates` | 569 | `createChartTemplate(template)` |
| 29 | PUT | `/chart-templates/{id}` | 590 | `updateChartTemplate(id, template)` — `id: Long` |
| 30 | DELETE | `/chart-templates/{id}` | 611 | `deleteChartTemplate(id)` |
| 31 | POST | `/chart-templates/reload` | 631 | `reloadChartTemplates()` |
| 32 | GET | `/chart-templates/recommend?metricCode=&dataPoints=&hasTimeDimension=` | 645 | `recommendChartType(metricCode, dataPoints, hasTimeDimension)` |
| 33 | GET | `/chart-templates/for-metric/{metricCode}` | 668 | `getChartTemplatesForMetric(metricCode)` |
| 34 | POST | `/chart-templates/{code}/build-with-analysis?factoryId=` | 683 | `buildChartWithAnalysis(code, data, factoryId)` |

Chart-templates is the **only sub-domain with non-CRUD business logic**:
- `recommend` (#32): rule-based selection from data-shape signals.
- `for-metric` (#33): join chart_templates × metric_formulas.
- `build-with-analysis` (#34): builds an ECharts config + invokes
  `insight_generator` (LLM) for AI narrative — already in Python at
  `backend/python/smartbi/services/insight_generator.py`. **Strong reuse opportunity**:
  Python port can call the existing module directly instead of round-tripping to Java.

Categories: `SALES / FINANCE / PRODUCTION / QUALITY / HR`.
Chart types: `LINE / BAR / PIE / AREA / SCATTER / GAUGE / TABLE`.

### 1.7 Global admin (2 endpoints) — `BASE/{reload-all,status}`

| # | Method | Path | Java line | Service method |
|---:|:---:|---|---:|---|
| 35 | POST | `/reload-all` | 703 | `reloadAll()` — clears all named Spring caches via `CacheManager.getCacheNames().forEach(...).clear()` (Java line 900-905) |
| 36 | GET | `/status` | 718 | `getConfigStatus()` — returns counts + cacheEnabled boolean (Java line 970) |

### 1.8 Data Sources (5 endpoints) — `BASE/data-sources`

Different sub-system: served by `DataSourceRegistryService` (NOT `SmartBIConfigService`).
Returns Spring `Page<DataSourceDTO>` shape; controller wraps into
`{content, totalElements, totalPages, size, number}` map (Java `pageToMap` line 737-745) —
this exact key order must be preserved (Rule 8 Map.of-style consideration: `LinkedHashMap`
insertion order, but `HashMap` here is fine because keys are emitted in the order shown).

| # | Method | Path | Java line | Service method |
|---:|:---:|---|---:|---|
| 37 | GET | `/data-sources?factoryId=&keyword=&type=&isActive=&page=&size=` | 747 | `dataSourceService.list(...)` → `Page<DataSourceDTO>` |
| 38 | GET | `/data-sources/{id}?factoryId=` | 765 | `dataSourceService.getById(factoryId, id)` |
| 39 | POST | `/data-sources?factoryId=` | 774 | `dataSourceService.create(fid, dto)` — fid required |
| 40 | PUT | `/data-sources/{id}?factoryId=` | 793 | `dataSourceService.update(fid, id, dto)` |
| 41 | DELETE | `/data-sources/{id}?factoryId=` | 815 | `dataSourceService.delete(factoryId, id)` |

> **IMPORTANT**: `data-sources` overlaps in name with the Phase 2A
> `/api/mobile/{factoryId}/smart-bi/datasource/*` endpoints (`smartbi_compat/api/datasource.py`).
> They are **different**: this Tier 1 sub-domain manages a registry of declared
> connection sources (CRUD on `smart_bi_datasource`); Phase 2A's
> `datasource/*` endpoints manage Excel-derived schema discovery + history.
> Python module name MUST disambiguate: use `config_data_sources.py` (with
> underscore + `s`), not `datasource.py`.

---

## 2. Java service-dependency map

`SmartBIConfigController` declares only 2 service deps (Java line 51-52):
- `SmartBIConfigService configService` — **orchestrator** that internally delegates to
  the 5 specialized services for thresholds / incentive-rules / metric-formulas /
  chart-templates and handles intents + field-mappings directly.
- `DataSourceRegistryService dataSourceService` — independent; manages
  `smart_bi_datasource` table.

`SmartBIConfigServiceImpl.java` (1146 LOC) wires:

```text
SmartBIConfigServiceImpl
  ├── (direct CRUD on AiIntentConfig)        — intents path
  ├── (direct CRUD on SmartBiDictionary)     — field-mappings path
  ├── AlertThresholdService                  — thresholds path
  ├── IncentiveRuleService                   — incentive-rules path
  ├── MetricFormulaService                   — metric-formulas path
  ├── ChartTemplateService                   — chart-templates path (incl. recommend / for-metric / build-with-analysis)
  └── CacheManager                           — reload-all + per-domain reload
```

Confirmed from grep: `cacheManager.getCacheNames().forEach(cacheName -> cache.clear())`
(`SmartBIConfigServiceImpl.java:900-905`); `cacheEnabled` flag in status response
(`:970`).

### Python decomposition rationale

8 sub-modules under `smartbi_compat/api/`:
1. `config_intents.py` — direct CRUD + reload signal.
2. `config_thresholds.py`
3. `config_incentive_rules.py`
4. `config_field_mappings.py`
5. `config_metric_formulas.py`
6. `config_chart_templates.py` — includes recommend / for-metric / build-with-analysis.
7. `config_admin.py` — `reload-all` + `status` orchestrator.
8. `config_data_sources.py` — independent registry CRUD.

Shared support modules (new, under `smartbi_compat/`):
- `config_cache.py` — Python-side cache manager (replaces Spring `CacheManager`,
  see §4).
- `config_auth.py` — Tier-1-specific JWT dep (replaces `verify_jwt_and_factory`
  which requires `factory_id` in path; see §5).
- `config_models.py` — Pydantic models mirroring Java entities (`AiIntentConfig`,
  `SmartBiAlertThreshold`, etc.) for request body validation + golden-shape output.

Total estimated Python LOC: ~3,500 (controller layer ~600 + service layer ~2,500
+ models/helpers ~400). Smaller than Java's ~3,800 (controller 834 + impl 1146 +
5 specialized services ~2,000) due to Pydantic + asyncpg compactness.

---

## 3. DTO mapping

### 3.1 `ConfigOperationResult` (Java DTO — Lombok `@Data @Builder`)

Returned by every write endpoint (POST / PUT / DELETE / reload). Java fields
(`backend/java/cretas-api/.../ConfigOperationResult.java:32-66`):

```java
boolean success;
String message;
Object data;
String configType;          // "INTENT" / "THRESHOLD" / "INCENTIVE_RULE" / "FIELD_MAPPING" / "METRIC_FORMULA" / "ALL"
LocalDateTime timestamp;    // @Builder.Default LocalDateTime.now()
String operationType;       // "CREATE" / "UPDATE" / "DELETE" / "RELOAD"
Integer affectedCount;
```

⚠️ **Rule 9 audit required at impl time**: `ConfigOperationResult` has no
`@JsonInclude(NON_NULL)` — Jackson WILL emit `null` fields explicitly. Python dict
must mirror this:

```python
# ✅ GOOD — emit all fields including None per Rule 9.2
def _success(config_type: str, message: str, *, data=None, op_type=None, affected=None):
    return {
        "success": True,
        "message": message,
        "data": data,
        "configType": config_type,
        "timestamp": _java_isoformat(datetime.now()),  # Rule 11
        "operationType": op_type,
        "affectedCount": affected,
    }
```

⚠️ **Rule 8 audit required**: dict literal key order MUST match Java Jackson output
order, which for Lombok `@Data` DTO is **declaration order** (not Map.of hash).
Need golden record at impl time per `record-java-golden.sh`.

⚠️ **Rule 11 (LocalDateTime)**: `timestamp` field in Java emits trailing-zero
microseconds dropped. Use `_java_isoformat()` from `smartbi_compat/schema_compat.py`.

### 3.2 Entity DTOs (request body validation)

Each write endpoint receives a Java entity instance via `@RequestBody @Valid`.
The 6 entities involved:

| Java entity | Java file | PK type | Notable |
|---|---|---|---|
| `AiIntentConfig` | `entity/smartbi/AiIntentConfig.java` | `String` (UUID) | JSON columns: keywords / patterns / examples / followUpQuestions |
| `SmartBiAlertThreshold` | `entity/smartbi/SmartBiAlertThreshold.java` | `Long` | TBD at impl-time grep |
| `SmartBiIncentiveRule` | `entity/smartbi/SmartBiIncentiveRule.java` | `Long` | levelName + ruleCode unique pair |
| `SmartBiDictionary` | `entity/smartbi/SmartBiDictionary.java` | `Long` | dictType + name |
| `SmartBiMetricFormula` | `entity/smartbi/SmartBiMetricFormula.java` | `Long` | formula expression text |
| `SmartBiChartTemplate` | `entity/smartbi/SmartBiChartTemplate.java` | `Long` | templateCode + chartType, supports factory-override JSON |

⚠️ **PK type inconsistency**: `AiIntentConfig.id = String` (UUID), all others = `Long`.
Python Pydantic models must mirror — UUID intents need `str` validation; others
need `int` validation. URL `{id}` path param is `String` in Java for intents
(`@PathVariable String id`, line 96) but `Long` for others. **FastAPI will reject
non-int IDs as 422 before the handler executes**, so route declarations must use
correct types.

### 3.3 `DataSourceDTO`

Used by data-sources endpoints. NOT inspected in this design pass — defer to
impl-time grep + golden recording. Mirrors `SmartBiDatasource` entity 1:1
(`backend/java/cretas-api/.../entity/smartbi/SmartBiDatasource.java`).

### 3.4 `ApiResponse<T>` envelope

All responses wrapped in:

```json
{ "success": true, "data": <T>, "message": "..." }
```

Python helper exists: `smartbi_compat.schema_compat.wrap_response(data, message?)`.
Already used by all Phase 2A endpoints (see `smartbi_compat/api/datasource.py:51`).
Reuse without modification.

### 3.5 Error response shape

Java pattern (every endpoint):

```java
} catch (Exception e) {
    log.error("...", e);
    return ResponseEntity.ok(ApiResponse.error("失败: " + ErrorSanitizer.sanitize(e)));
}
```

Note: `ResponseEntity.ok(ApiResponse.error(...))` — HTTP 200 with `success: false`
in body. Python port MUST replicate (do NOT switch to HTTP 4xx/5xx; frontend
parses `body.success` per `api-response-handling.md`).

`ErrorSanitizer.sanitize(e)` strips stack traces and DB schema names. Python
needs equivalent helper — likely `smartbi_compat._java_compat.sanitize_error(e)`
to mirror byte-shape on common exceptions. Add to design TODO list.

---

## 4. Reload mechanism design

### 4.1 Java behavior (current state)

Spring `CacheManager` (likely Caffeine or ConcurrentMapCacheManager) keyed by
cache name. Per-domain reload (e.g., `reloadIntents()`) clears just one named
cache. Global `reloadAll()` iterates `cacheManager.getCacheNames()` and calls
`.clear()` on each (`SmartBIConfigServiceImpl.java:900-905`).

`status` endpoint exposes `cacheEnabled: boolean` flag (line 970) plus per-domain
counts (probably `intentCount`, `thresholdCount`, etc. — confirm at impl time).

Cache TTL: not visible from the controller — depends on Spring cache config
(`backend/java/cretas-api/.../config/CacheConfig.java`, recon at impl time).
Typical Spring setup: write methods carry `@CacheEvict`, read methods carry
`@Cacheable`, reload endpoints exist as fallback for out-of-band data changes
(e.g., admin manually edits DB).

### 4.2 Python design choices

Three approaches, ordered by recommendation:

#### Option A (RECOMMENDED): In-process TTL cache via `cachetools` + multi-worker invalidation via Redis pub/sub

```python
# config_cache.py
from cachetools import TTLCache
from threading import Lock
import redis.asyncio as redis

class ConfigCacheManager:
    def __init__(self):
        self._caches: dict[str, TTLCache] = {}
        self._locks: dict[str, Lock] = {}
        self._redis = redis.Redis(...)  # for cross-worker invalidation
        self._pubsub = self._redis.pubsub()

    def get_cache(self, name: str) -> TTLCache: ...
    async def clear(self, cache_name: str) -> int: ...    # publish "smartbi:cache:invalidate:<name>"
    async def clear_all(self) -> int: ...
    def names(self) -> list[str]: ...
```

**Pros**:
- Works across uvicorn workers (N=2 currently per `restart.sh`).
- Sub-millisecond reads on hits.
- Redis already running on server 47 (port 6379).

**Cons**:
- Pub/sub adds dependency complexity.
- Each worker holds its own copy — slight memory overhead (~few MB total, negligible).

**Cache names** (mirror Java exactly, golden-recorded from `cacheManager.getCacheNames()`
at impl time — likely `intents`, `thresholds`, `incentive-rules`, `field-mappings`,
`metric-formulas`, `chart-templates`).

#### Option B: Redis-only (no in-process cache)

Read every request from Redis. Acceptable latency for admin-only endpoints (low
QPS). Simpler invalidation: `DEL <cache_name>:*`.

**Pros**: zero cross-worker drift.
**Cons**: extra Redis hop on every read; misses cache when Redis cold-starts.

Reject unless §4.1 audit shows Java has no in-process cache (i.e., reads always
hit DB), in which case parity = no Python cache at all (Option C).

#### Option C: No cache (Phase 2A pattern)

Every read query DB directly. Java cache is decorative; reload endpoints become
no-ops returning success.

**Reject** unless audit confirms Java cache is effectively a no-op (unlikely —
SmartBI is heavily read-traffic'd; Spring cache is real).

#### 4.3 Reload endpoint impl pattern (Option A)

```python
# config_intents.py
@router.post("/intents/reload", dependencies=[Depends(require_analytics_write)])
async def reload_intents(cache: ConfigCacheManager = Depends(get_config_cache)):
    affected = await cache.clear("intents")
    return wrap_response(
        _operation_result("INTENT", "RELOAD", "重载成功", affected=affected),
        message="重载成功",
    )
```

#### 4.4 Status endpoint impl

`status` returns counts + cacheEnabled. Python:

```python
async def get_config_status(...):
    return {
        "intentCount": await _count("ai_intent_configs"),
        "thresholdCount": await _count("smart_bi_alert_thresholds"),
        "incentiveRuleCount": await _count("smart_bi_incentive_rules"),
        "fieldMappingCount": await _count("smart_bi_dictionaries"),
        "metricFormulaCount": await _count("smart_bi_metric_formulas"),
        "chartTemplateCount": await _count("smart_bi_chart_templates"),
        "cacheEnabled": True,  # or cache.is_enabled()
        "lastUpdated": _java_isoformat(datetime.now()),  # mirror Java field if present — confirm at impl
    }
```

⚠️ **Field set must match Java exactly** — golden-record `getConfigStatus()` output
at impl time. The above is an educated guess; impl reviewer must verify against
`SmartBIConfigServiceImpl.getConfigStatus()` (around line 940-980).

---

## 5. Multi-factory routing strategy

### 5.1 The problem

Phase 2A endpoints have `{factoryId}` in path: `/api/mobile/{factoryId}/smart-bi/...`
T6.X cutover used **per-factory regex** at nginx to route specific factories'
traffic to Python (`location ~ ^/api/mobile/(F001|F002|...)/smart-bi/ ...`).

Tier 1 endpoints have **NO `{factoryId}` in path**:

```
/api/mobile/smartbi-config/intents
/api/mobile/smartbi-config/thresholds/{id}
/api/mobile/smartbi-config/data-sources?factoryId=F001    ← factory in QUERY param only
```

Factory context comes from JWT claim (`factoryId`) or from the optional
`factoryId` query parameter (data-sources only). nginx **cannot route on
JWT claims** without adding LuaJIT or moving routing to the Python/Java app
itself.

### 5.2 Routing strategy options

#### Option A (RECOMMENDED): Big-bang cutover for Tier 1, no per-factory canary

Reasoning:
- Tier 1 is **admin-only** (per PR #152: "low customer blast radius").
- Path-level cutover (single nginx regex match → all Tier 1 traffic goes to Python)
  is feasible because `/api/mobile/smartbi-config/*` is a unique URL path prefix
  not shared with other tiers.
- Phase 2A T6.X factory canaries existed because customer factories had different
  data shapes; Tier 1 is config (uniform shape across factories).
- Admin user count is tiny (~5–10 platform admins + per-factory super-admins), so
  rollback latency tolerable if regression appears.

Cutover stages mirror T6.X but compressed (per "active E2E replaces passive soak"
HARD rule):

| Stage | Action | Verify |
|---|---|---|
| T6.1-equiv | Sidecar dryrun on F001+F999 admin endpoints | dict-eq match rate ≥99% sustained |
| T6.2-equiv | Cutover ALL `/smartbi-config/*` to Python (single nginx regex) | active E2E via Web-Admin (manual + Playwright) |
| T6.3-equiv | (skip — no per-factory phasing needed) | — |
| T6.4-equiv | Java endpoint deletion + DTO retention check (per task #24 KEEP list) | redeploy Java, smoke 100% on remaining controllers |

Estimated cutover window: ~3–5 hours active E2E (vs Phase 2A's 5-stage 40-min cascade).

#### Option B: Per-factory routing inside Python (rejected)

Add factory-id-extraction middleware that reads JWT and conditionally proxies to
Java for non-cutover factories. Adds Python→Java HTTP roundtrips during cutover —
ugly and slow.

#### Option C: nginx Lua scripting (rejected)

Install OpenResty + write Lua to extract JWT factoryId. Adds infra dependency
not currently used; rejected for marginal benefit.

### 5.3 Auth dependency

Phase 2A `verify_jwt_and_factory` uses URL `factory_id` path param. Tier 1
needs new dep:

```python
# config_auth.py
async def verify_jwt_admin(request: Request) -> AuthContext:
    """JWT verify for Tier-1 endpoints (no factoryId in path).

    factory_id derived from JWT claim. Privileged roles
    (platform_admin / platform_super_admin) bypass factory check entirely.
    """
    # ... extract bearer, decode JWT, return AuthContext with factory_id from token

async def require_analytics_write(ctx: AuthContext = Depends(verify_jwt_admin)) -> AuthContext:
    """Mirror Java @RequirePermission({"analytics:read_write"}).

    Phase 2A pre-existing analytics permission check is at Java filter level;
    Python equivalent likely simple role check or sub-role tuple match. Confirm
    permission semantics at impl-time grep of @RequirePermission usage.
    """
    if not ctx.has_permission("analytics:read_write"):
        raise HTTPException(403, "需要 analytics:read_write 权限")
    return ctx
```

⚠️ **`@RequirePermission` Java semantics need impl-time audit**: the annotation
is defined in `backend/java/.../annotation/RequirePermission.java` (not yet
inspected); permission resolution happens via aspect (`PermissionAspect.java`?)
that decodes role/permission claims. Python port must mirror exact semantics
to avoid 403/200 divergence.

### 5.4 Data-sources factoryId override

Endpoints 37–41 take `factoryId` as query param (not path), with fallback to
`dto.getFactoryId()` for create/update bodies:

```java
String fid = factoryId != null ? factoryId : dto.getFactoryId();  // line 781, 801
if (fid == null || fid.isBlank()) {
    return ResponseEntity.ok(ApiResponse.error("factoryId 必填"));
}
```

Python port must mirror exactly. `factoryId` from query takes precedence over
DTO body field. Both null/blank → error response with `success: false` + Chinese
message "factoryId 必填".

⚠️ **Cross-factory write security**: Java currently does NOT verify that JWT's
factoryId matches the query param `factoryId` for data-sources endpoints. This
is **likely a latent vulnerability** (platform admin token + arbitrary factoryId
= cross-tenant write). Python port should match Java behavior for parity, but
flag this as **PR-after-cutover security follow-up**. Do NOT fix in port impl
(byte-shape parity gate would fail).

---

## 6. Phase 2C-Tier-1 Phases A–D plan

Mirrors Phase 2A T6 nomenclature but for Tier 1 only.

### 6.1 Phase 2C-Tier-1-A: Spec + impl PR chain (~3–4 weeks)

Per sub-domain, repeat:

1. **Spec PR** (~1 week per spec, parallelizable):
   - 7 specs total: intents / thresholds / incentive-rules / field-mappings /
     metric-formulas / chart-templates / data-sources (admin endpoints share
     spec with the ConfigService orchestrator scope).
   - Apply Phase 2A 4-cycle audit: self-review → spec reviewer → cross-spec
     audit → final impl-reviewer signoff.
   - Each spec includes:
     - Endpoint list + Java line refs
     - Pydantic model (golden-recorded field order per Rule 8 + nulls per Rule 9)
     - SQL queries (table names, joins, filters)
     - Cache integration (which cache name, TTL)
     - Response golden goldens recorded for F999 + F001
     - Test scaffolding (mock pattern from `python-java-port.md`)

2. **Impl PR** (~3–4 days per sub-domain, parallel across 4–6 chats):
   - Pydantic models in `smartbi_compat/config_models.py`
   - Router file under `smartbi_compat/api/config_*.py`
   - Cache integration via shared `config_cache.py`
   - Pre-merge: byte-shape compare against goldens + dict-eq gate ≥99%

3. **Schema migration PRs** (if any):
   - Likely none for Tier 1 (entities already exist + populated).
   - Any new tables → use `apply-smartbi-migrations.sh` runner per HARD RULE.

### 6.2 Phase 2C-Tier-1-B: Sidecar dryrun (~1 week)

- Run `record-java-golden.sh` against prod 10010 for top admin endpoints
  (~150–250 endpoints × scenario combos for Tier 1's 41 endpoints).
- Sidecar Python responder mounted at `/api/mobile/smartbi-config/*` test
  port (e.g., 8084).
- nginx-side dryrun: tee request copies to test port, compare bodies
  via `record-java-golden.sh --compare` infrastructure.
- GO criterion: dict-eq match ≥99% sustained over 3-day continuous dryrun.

### 6.3 Phase 2C-Tier-1-C: Cutover (~3–5 hours active E2E per "active E2E replaces passive soak")

- nginx config: single regex `location ~ ^/api/mobile/smartbi-config/`
  → upstream `cretas_python` (port 8083).
- Backup vhost as `bak.tier_1_pre.<timestamp>` (mirror T6.X pattern).
- Smoke: GET each endpoint × 1 with admin token → 200 + dict-eq with
  Java prod baseline.
- Active E2E: Web-Admin Vue pages (SmartBI 配置中心 / 阈值管理 / etc.)
  exercised by a human admin or Playwright MCP. Verify CRUD round-trips +
  reload + status work end-to-end.
- Rollback: revert nginx config + reload (sub-2-min) — already proven by
  T6.X pattern.

### 6.4 Phase 2C-Tier-1-D: Java cleanup (~1 week)

- Delete `SmartBIConfigController.java`.
- Delete `SmartBIConfigServiceImpl.java` + `SmartBIConfigService.java` interface.
- Delete `AlertThresholdServiceImpl.java` + `IncentiveRuleServiceImpl.java` +
  `MetricFormulaServiceImpl.java` + `ChartTemplateServiceImpl.java` +
  service interfaces.
- Delete `DataSourceRegistryService.java` + impl.
- KEEP entities (used by `GoldDashboardBuilder` per task #24, plus
  Tier 2 `SmartBIDashboardController` likely consumes some).
- KEEP DTOs for the same reason.
- Verify Java compile + redeploy + smoke.

Total Tier 1 lifecycle: ~5–6 weeks (vs original PR #152 estimate of 3 months —
PR #152's estimate was conservative for parallel-chat scaling overhead; this
spec assumes Phase 2A's proven 4–6 chat parallel coordination model).

---

## 7. Estimated effort

| Phase | Duration | Parallelism | Owner |
|---|---|---|---|
| Phase 2C-Tier-1-A spec | 2 weeks | 7 chats parallel (1 per sub-domain) | Phase 2C kickoff org |
| Phase 2C-Tier-1-A impl | 2 weeks | 4–6 chats parallel | Phase 2C kickoff org |
| Phase 2C-Tier-1-B dryrun | 1 week | 1 chat (sidecar setup) | dryrun org |
| Phase 2C-Tier-1-C cutover | ~5 hours | 1 chat + Steve | cutover org |
| Phase 2C-Tier-1-D Java cleanup | 1 week | 1 chat | cleanup org |
| **TOTAL** | **~5–6 weeks** | | |

Buffer: +1 week for rule-sweep audits (Rules 1–12 likely surface new Tier 1
patterns, especially Rule 9 Lombok DTO nulls on `ConfigOperationResult`).

Reference Phase 2A baseline: 50 endpoints, ~7 weeks total. Tier 1 should be
faster (CRUD only, no analysis math) per endpoint — but extra coordination
time for 7 sub-domains' specs.

### 7.1 Tooling investment (one-time, applies to Tier 2 + Tier 3 also)

- Cache invalidation pub/sub harness: ~3–4 days
- Tier-1 auth dep + permission resolver: ~2–3 days
- `ConfigOperationResult` golden recorder + Pydantic schema: ~2 days
- Test fixtures for 6 entity types: ~3 days

Total tooling: ~2 weeks. Subtract from Phase 2C-Tier-1-A spec phase if done in
parallel.

---

## 8. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|:-:|:-:|---|
| R1 | Spring `CacheManager` semantics not 1:1 mirrorable in Python (e.g., Spring uses `@CacheEvict(allEntries=true)` patterns we don't notice) | M | M | Audit `SmartBIConfigServiceImpl.java` AND `CacheConfig.java` exhaustively in Phase 2C-Tier-1-A spec. Record cache hit/miss semantics via Java Actuator metrics if available. |
| R2 | `@RequirePermission({"analytics:read_write"})` aspect logic not transparent — Python port may diverge on edge cases (multi-permission, role hierarchy) | M | H | Read `PermissionAspect.java` (assume location) in spec phase. Write Pydantic model + permission resolver in shared `config_auth.py` with explicit unit tests covering each role × endpoint matrix. |
| R3 | `ConfigOperationResult` byte-shape divergence (Rule 8 + Rule 9 + Rule 11 all apply simultaneously) | H | M | Triple-rule audit at impl time. Record F999 goldens for all 4 op types (CREATE/UPDATE/DELETE/RELOAD) × all 6 config types = 24 goldens. |
| R4 | `chart-templates/build-with-analysis` LLM streaming path incompatible with Tier 1 plain-JSON port | M | M | Audit Java endpoint to confirm it returns plain JSON (not SSE). If SSE, defer #34 to Tier 2 SSE infrastructure (PR #152 Tier 2 scope). |
| R5 | data-sources cross-factory write security (Java doesn't verify JWT-vs-query factoryId mismatch) — Python parity replicates the gap | L | H | Match Java behavior in port; file post-cutover security PR (out-of-scope for Tier 1). |
| R6 | Spring Page<T> serialization shape (data-sources list) — `pageToMap` HashMap iteration order is JVM-dependent | L | M | Java code uses `java.util.HashMap` for the page wrapper (line 738) — Jackson serializes HashMap in arbitrary order BUT Tier 1 Java has shipped this code for ~3 weeks; observed order is stable. Record golden + match exactly. If JVM upgrade changes order, frontend may re-key by name (low impact). |
| R7 | `SmartBiDictionary` overlap with field-mappings semantics (entity name "Dictionary" but endpoint is "field-mappings") | L | L | Document the naming mismatch in Tier 1-A spec; Python uses `config_field_mappings.py` route prefix + Pydantic model name `SmartBiDictionary` (mirror Java entity name). |
| R8 | Frontend Web-Admin makes assumptions about Java-specific error formats (e.g., parses Chinese "失败: " prefix) | M | M | Phase 2A precedent: error format preserved char-by-char including Chinese prefixes. Maintain `"创建失败: " + sanitized_message` format exactly. |
| R9 | Migration runner ordering: if Tier 1 needs schema migrations, they must run BEFORE Tier 1 cutover | L | H | Include migration check in Tier 1-A spec phase; if any new tables / columns required, generate migration via runner per HARD RULE. |
| R10 | Tier-1 endpoint bypass: if a frontend route calls `/api/mobile/smartbi-config/...` AND directly to a backing service URL (e.g., misconfigured Vue page calling Java internal), cutover incomplete | L | H | Frontend code-path audit (operator deliverable) at Tier-1 kickoff; grep frontend for hardcoded `:10010/smartbi-config` references. |
| R11 | Java DTO field rename between spec date and cutover date (long Phase 2C duration risk) | L | M | Per task #24 KEEP list, DTOs are frozen. If a rename happens (unlikely), update Pydantic models accordingly. |
| R12 | Multi-worker (uvicorn N=2) cache invalidation race: reload from worker A, worker B serves stale until pub/sub propagates (~10ms) | M | L | Acceptable race window for admin-only endpoints. Worst case: admin sees stale data for 1 request after reload, retries succeed. Document in cache module; do not over-engineer. |

---

## 9. Out of scope (this design doc)

| Item | Why deferred |
|---|---|
| `SmartBIDashboardController` port (Tier 2) | Separate design doc per PR #152. Different complexity (SSE streaming). |
| `SmartBIUploadController` port (Tier 3) | Separate design doc; Excel parser parity audit needed. |
| `SmartBIPublicDemoController` (Tier 4) | Sunset-vs-port operator decision pending. |
| Strict-byte gate adoption | Per Rule 4 Phase 2A standard, dict-eq sufficient. Strict-byte deferred to Phase 3+. |
| Frontend Vue config page rewrites | Operator-owned; Tier 1 port preserves API contract. |
| Removing `SmartBiConfigService` interface from Java entirely (DTO retention only) | Cleanup phase D scope; depends on Tier 2 + Tier 3 not depending on the interface. Audit at cleanup time. |
| Adding new admin features (e.g., bulk import) | Out of port scope; file as separate Phase 2C+ feature work. |

---

## 10. Open questions for Phase 2C-Tier-1 reviewer

These need answers before Phase 2C-Tier-1-A spec phase kickoff:

### Q-1: Cache invalidation propagation latency tolerance

§4.2 Option A uses Redis pub/sub for cross-worker cache invalidation. Worst-case
~10ms staleness across uvicorn N=2 workers. Acceptable? OR do we need stronger
guarantee (e.g., Redis-only Option B)?

### Q-2: `@RequirePermission` Python equivalent

How does Java aspect resolve `{"analytics:read_write"}`? Is there a permissions
table joined on user? Or is the role string directly checked? Need
`PermissionAspect.java` audit before Phase 2C-Tier-1-A.

### Q-3: `chart-templates/build-with-analysis` (#34) LLM behavior

Does Java endpoint stream LLM response (SSE) or return final JSON? If SSE, this
endpoint moves to Tier 2 (Dashboard SSE scope per PR #152). Audit Java
implementation around `SmartBIConfigServiceImpl.buildChartWithAnalysis()`
(unmapped method line — find via grep).

### Q-4: `getConfigStatus()` exact field set

Educated-guess fields in §4.4 are unconfirmed. Need byte-faithful golden of
`GET /status` response from prod 10010 to lock down Pydantic model.

### Q-5: data-sources cross-factory write — fix as port-time PR or post-cutover?

Per §5.4 R5: Java currently allows JWT factoryId mismatch on data-sources
endpoints. Port-time fix breaks dict-eq parity for tests where mismatch returns
200 vs 403. Recommendation: port matches Java; file follow-up security PR
labeled "post-Tier-1 hardening". Confirm.

### Q-6: Tier 1 cutover timing window

§6.3 estimates 3–5 hours active E2E. Acceptable to schedule during business
hours given admin-only? Or off-hours like Phase 2A T6.X cascade?

### Q-7: Phase 2C-Tier-1-B dryrun infrastructure

Does Phase 2A's `record-java-golden.sh` already support Tier 1 endpoint paths
(`/smartbi-config/*`), or does it need extension? Believed already supports
arbitrary URL — confirm at infra audit.

### Q-8: Frontend code-path map deliverable owner

Per PR #152 §1.1 trigger gate, frontend code-path map is operator deliverable.
Who is operator at Phase 2C kickoff? Steve, or post-T6.5 designated lead?

---

## 11. Parallel work analysis (per `parallel-work-analysis.md`)

### Subagent (single-chat parallelism)

✅ **Suitable**:
- 7 sub-domain spec drafts (independent docs).
- Endpoint inventory grep + endpoint LOC counts.
- Java service-impl reading (parallel reads on 5 service files).

❌ **Not suitable**:
- Cache module design (cross-cutting, sequential review).
- Permission resolver design (touches all sub-domains).

### Multi-chat (cross-session parallelism)

✅ **Suitable**:
- 4–6 sister chats writing 4–6 sub-domain specs simultaneously (different files,
  no scope overlap).
- Frontend code-path audit (operator) parallel with Phase 2C-Tier-1-A spec drafting.

❌ **Not suitable**:
- Cache module + auth module concurrent edit (shared `config_cache.py` /
  `config_auth.py` files; serialize OR use git worktree isolation per HARD RULE).
- Cutover execution (single nginx config slot, sequential by definition).

### Conflict risk

| Risk | Likelihood | Mitigation |
|---|:-:|---|
| Sister chat writes overlapping Pydantic models in `config_models.py` | M | Split file: 1 model file per sub-domain (`config_models_intents.py`, etc.) OR worktree isolation. |
| Sister chat writes new helper to `_java_compat.py` (shared) concurrent with another | L | Per `concurrent-edit-safety.md` Rule 5b: `git commit -- <paths>` mandatory; status check before commit. |
| Test fixture files collide in `tests/fixtures/java-smartbi-golden/` | L | Naming convention: `tier1-config-{intents,thresholds,...}-{F999,F001}-{create,read,...}.json`. |

---

## Appendix A — Phase 2A precedent reference

Per memory `project_2026_05_09_phase_2a_complete.md` and PR #151:

| Phase 2A metric | Value | Tier 1 projection |
|---|---|---|
| Endpoints ported | 50 | 41 |
| Total LOC ported | ~10,000 | ~3,500 |
| Spec docs | ~20 | ~7 (1 per sub-domain) |
| PRs | ~150 | ~80 |
| Parallel chats | 4–6 | 4–6 |
| Duration | ~7 weeks | ~5–6 weeks |
| Codified rules | 12 | likely +1–2 from Tier 1 (cache patterns, permission patterns) |
| Pattern B latents | 2 | likely 0 (pure CRUD, no Java legacy fallback) |
| Dryrun match rate | 99.945% | target ≥99% (admin endpoints, lower variance) |

---

## Appendix B — File layout (post-Tier-1)

```
backend/python/smartbi_compat/
├── api/
│   ├── analysis_*.py                # Phase 2A (50 endpoints)
│   ├── config_intents.py            # Tier 1 — 5 endpoints
│   ├── config_thresholds.py         # Tier 1 — 5 endpoints
│   ├── config_incentive_rules.py    # Tier 1 — 5 endpoints
│   ├── config_field_mappings.py     # Tier 1 — 5 endpoints
│   ├── config_metric_formulas.py    # Tier 1 — 5 endpoints
│   ├── config_chart_templates.py    # Tier 1 — 9 endpoints
│   ├── config_admin.py              # Tier 1 — 2 endpoints (reload-all + status)
│   └── config_data_sources.py       # Tier 1 — 5 endpoints
├── config_auth.py                   # Tier 1 JWT + permission dep (NEW)
├── config_cache.py                  # Tier 1 cache manager (NEW)
├── config_models/                   # Pydantic models (NEW — split per sub-domain)
│   ├── intents.py
│   ├── thresholds.py
│   ├── incentive_rules.py
│   ├── field_mappings.py
│   ├── metric_formulas.py
│   ├── chart_templates.py
│   ├── data_sources.py
│   └── result.py                    # ConfigOperationResult shared model
└── _java_compat.py                  # extended with sanitize_error, etc.

backend/java/cretas-api/src/main/java/com/cretas/aims/
├── controller/SmartBIConfigController.java        ← DELETED in Phase 2C-Tier-1-D
├── service/smartbi/SmartBIConfigService.java      ← DELETED
├── service/smartbi/AlertThresholdService.java     ← DELETED
├── service/smartbi/IncentiveRuleService.java      ← DELETED
├── service/smartbi/MetricFormulaService.java      ← DELETED
├── service/smartbi/ChartTemplateService.java      ← DELETED
├── service/smartbi/DataSourceRegistryService.java ← DELETED
├── service/smartbi/impl/SmartBIConfigServiceImpl.java       ← DELETED
├── service/smartbi/impl/AlertThresholdServiceImpl.java      ← DELETED
├── service/smartbi/impl/IncentiveRuleServiceImpl.java       ← DELETED
├── service/smartbi/impl/MetricFormulaServiceImpl.java       ← DELETED
├── service/smartbi/impl/ChartTemplateServiceImpl.java       ← DELETED
├── service/smartbi/impl/(DataSourceRegistryServiceImpl)     ← DELETED if exists
└── entity/smartbi/(AiIntentConfig + 5 other config entities) ← KEEP per task #24
```

---

## Status

This is a **Phase 2C-Tier-1 design doc only**. No code changes here.

Phase 2C-Tier-1-A spec phase kickoff requires:
- T6.5 Phase C complete + Phase 2A retrospective signed-off.
- Open Questions Q-1 through Q-8 (§10) resolved.
- Operator + Steve sign-off on Phase 2C-Tier-1-A scope.
- Frontend code-path map snapshot.

Estimated kickoff: **~2026-08 to 2026-09**, contingent on T6.5 timeline and PR #152
Phase 2C trigger gates.
