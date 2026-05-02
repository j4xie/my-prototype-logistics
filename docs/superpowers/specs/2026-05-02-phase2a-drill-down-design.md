# Phase 2A `/drill-down` Tier 3 — Design Spec

**作者**: Chat 3 (`phase2a/spec-drill-down`)
**日期**: 2026-05-02
**状态**: Spec-only PR (impl 待 Wave 3 Tier 2 PR-As 落地后另起 chat)
**Sister specs (Tier 3 prerequisite chain)**:
- Tier 2 双胞胎 4 件套已 land main:
  - region spec PR #41 (commit `45da60d61`)
  - department spec PR #36 (commit `91c43ec76`)
  - procurement spec PR #40 (commit `4f7c5f6bb`)
  - inventory spec PR #47 (commit `b30d07686`)
- Tier 1 finance: cost #25 / profit #21+22 / payable #18 全 in main
- Wave 1 finance: receivable PR-A #42 + budget PR-A #38 / receivable PR-B #46 + budget PR-B #44 全 in main
- query-templates spec PR #48 (commit `c440c7a7e`) — share write side-effect / RLS-app-layer pattern
- Phase 2B-β #24 — `handleDrillDownIntent` AI orchestration cite

**Endpoint scope**: 单一 endpoint `POST /api/mobile/{factoryId}/smart-bi/drill-down`,5 dimension dispatch (region/department/product/time/salesperson) + 1 dead branch (customer dim raises BusinessException).

**这是 Tier 3 spec** — 在 4 个 Tier 2 sister specs 已 land 之上,继承其 composite-only / Rule 8 golden-driven / RLS-app-layer / Lombok @Data declaration order 等模式,新增 Tier 3 专属问题:多维 dispatch / 写入侧效 / mixed read-write transaction / hint/hintTarget 在 Controller catch 边界丢失 / 5 missing helper ownership (D1).

---

## 1. 背景 + 范围锁定

### 1.1 Endpoint contract

```
POST /api/mobile/{factory_id}/smart-bi/drill-down
Content-Type: application/json
Authorization: Bearer <jwt>

Request body (DrillDownRequestDTO at controller layer, mapped to DrillDownRequest at service layer):
{
    "dimension": "region" | "department" | "product" | "time" | "salesperson",
    "value": "<filter-value-or-null>",         // controller field name
    "parentDimension": "<parent-dim-or-null>",
    "parentValue": "<parent-value-or-null>",
    "filters": { "<key>": "<value>", ... },    // additionalFilters at service level
    "startDate": "YYYY-MM-DD",                  // optional, defaults to thisMonth() if NULL
    "endDate": "YYYY-MM-DD"                     // optional, defaults to thisMonth() if NULL
}

Note: controller-level DTO field is `value` but service-level field is `filterValue`.
Controller maps via .filterValue(request.getValue()) at line 544 of SmartBIAnalysisController.java.
Python Pydantic model MUST accept controller field names (snake_case json: value/parentDimension/etc),
deserialize to internal Python field names (filter_value/parent_dimension/etc).

Response body (top-level wrapped in ApiResponse envelope):
{
    "success": true,
    "code": 200,
    "message": "操作成功",
    "data": {
        "data": <List | Map>,           // sub-service output (per-dim shape variance)
        "nextLevel": "<next-level-or-null>",
        ["chart": ChartConfig,]          // ONLY for product dim
        ["period": "DAY|WEEK|MONTH",]    // ONLY for time dim
        "drillPath": "<computed>",
        "level": <int-or-null>,
        "dimension": "<original-casing>"
    },
    "timestamp": "..."
}
```

Java reference (truth):
- **Controller**: `SmartBIAnalysisController.drillDown` (`SmartBIAnalysisController.java:531-586`)
- **Service main**: `SmartBIServiceImpl.processDrillDown` (`SmartBIServiceImpl.java:1018-1069`)
- **Service dim processors** (`SmartBIServiceImpl.java`):
  - region: line 1975-1996
  - department: line 2001-2017
  - product: line 2022-2032
  - time: line 2037-2059
  - salesperson: line 2064-2076
- **Request DTO (service layer)**: `DrillDownRequest.java:1-304` (13 fields + helper methods)
- **DateRange default**: `DateRange.thisMonth()` `DateRange.java:123-133`
- **ApiResponse envelope**: `ApiResponse.java:25-47` (8 fields total — 5 always-set by error()/success() factories: code, message, data, timestamp, success; 3 optional UX fields added 2026-04-18: actionHint, severity, hintTarget) + `error()` factory line 82-94. Per cycle 2 R1: actual analysis-* / alerts-* recorded goldens emit only 5 fields; sister test pattern strips 3 optional UX fields defensively.

### 1.2 Auth + permission

- JWT bearer required (Java `@PathVariable factoryId` validated by AOP filter)
- `@RequirePermission({"analytics:read_write"})` (controller line 530)
- Python equivalent: `verify_jwt_and_factory` dependency (sister `analysis_region.py` / `analysis_finance.py` pattern). Permission gate is enforced upstream; no per-endpoint ACL logic in Python.

### 1.3 Composite-only? NO — Tier 3 has its own dispatcher

Unlike Tier 2 sister specs (region/department/procurement/inventory) which share the `SmartBIService.getComprehensiveAnalysis(factoryId, start, end, dim)` composite path, drill-down has its own controller-level entry that calls `SmartBIServiceImpl.processDrillDown` directly. The dispatch is **per-dimension switch** (line 1035-1059), each dim producing a different output shape (T6).

Controller has dead-fallback path (line 555-579 `if smartBIService==null`):
- Different field names (`nextDimension` instead of `nextLevel`)
- Different switch (only 3 dims: region/province/department)
- Different default behavior (`result.put("message", ...)` not throw)
- Uses `DateRangeUtils.getStartDateOrDefault(null)` instead of `DateRange.thisMonth()`

Per Tier 2 sister spec lineage (region §1.3, department §1.3): **dead-code-skip discipline** — `smartBIService` is Spring `@Service` bean, never null in production. Controller fallback is OUT OF SCOPE.

### 1.4 In scope (本 spec 锁定)

| 项 | 来源 |
|---|---|
| 5 dim processors (region/department/product/time/salesperson) | service line 1975-2076 |
| **5 missing Python helpers (D1 ownership)**: `_drilldown_get_province_ranking`, `_drilldown_get_city_ranking`, `_drilldown_get_department_detail`, `_drilldown_get_product_distribution_chart`, `_drilldown_get_salesperson_metrics` | sister Java services (region / department / sales) — see §3.4 |
| Reuse 5 existing sister-Python helpers from `analysis_region.py` / `analysis_department.py` / `analysis_sales.py` | see §3.5 |
| `_compute_drill_path` (T4) | DTO line 295-302 mirror |
| `_default_date_range_this_month` (T5) | DateRange.thisMonth() mirror |
| Dispatch with `dimension.lower()` case-insensitive (T3) | service line 1035 |
| Mixed read-write transaction wrapper (T8) | service line 1019 `@Transactional` |
| `_drilldown_record_usage` SQL write helper (T7) | service line 1066 + V2026_01_18_01__smart_bi_tables.sql:56-74 (table `smart_bi_usage_records`) |
| BusinessException → ApiResponse.error envelope at controller boundary (T10) | controller line 582-585 |
| 8 goldens (5 dim × layer + 1 error; region L3 dead omitted per §4.1 R3) — see §6.1 | byte-shape gate |
| 1 route handler registered in `main.py` between Tier 2 sisters | sister registration pattern |

### 1.5 Out of scope (per Java prod path)

| 项 | 理由 |
|---|---|
| Controller `if smartBIService==null` fallback (line 555-579) | dead code (Tier 2 lineage §1.3) |
| `customer` dimension | listed in DrillDownRequest docstring but NOT in switch (line 1035-1059) → falls to BusinessException default. Acceptable byte-parity behavior (will return error envelope). No Python implementation of customer drill-down logic. |
| `customer` drill-down independent endpoint | If Wave 4+ wants this, separate spec. |
| PG-level RLS migrations on `smart_bi_sales_data` / `smart_bi_department_data` / `smart_bi_usage_records` (T11/T12) | Separate Phase 3+ concern. Aligns with Apr 28 P0 RLS gap finding (sister tables fixed in `V20260502_03/_04`). Application-layer factory_id WHERE is the sole isolation. |
| `handleDrillDownIntent` AI orchestration path (`SmartBIServiceImpl.java:1728-1742`) | Phase 2B-β scope, calls `processDrillDown` but is a SEPARATE entry point. This spec ports the HTTP `POST /drill-down` only. AI cite see §9.1. |
| Locale-dependent string formatting (`String.format("%,.2f", ...)` etc) inherited from sister specs | Already-known caveat; Python `f"{val:,.2f}"` matches en_US (production JVM Locale). |
| Sort/limit/includeChildren request fields (sortBy/sortDirection/limit/includeChildren) | Java `processDrillDown` does NOT use these fields (verify by grep — they're set as @Builder.Default but no `request.getSortBy()` call appears in dim processors). Python parses them but ignores in dispatch. Out-of-scope to honor. |

### 1.6 Side effects

- **1 row INSERT** to `smart_bi_usage_records` per request (T7 — service line 1066).
  - Args mirror Java line 1066: `factoryId, queryText=null, actionType="DRILLDOWN", tokenCount=0, cacheHit=false`. `success=true` is set inside `recordUsage` body (line 1168).
  - `userId=null`: Python passes None per D7 — see §3.6 + §3.7. Java line 1066 explicitly passes null despite SecurityContext having userId; Python mirrors for byte parity at DB level.
  - **`cost_amount` DIVERGENCE** (R2 cycle 2 finding, organizer decision: document not port): Java `recordUsage` at line 1172-1173 calls `calculateCost(factoryId, tokenCount, cacheHit)` and `record.setCostAmount(cost)`. Result depends on `smart_bi_billing_config` row for the factory: returns `BigDecimal.ZERO` for `cacheHit=true` OR no config row OR `unlimitedMode=true`; otherwise returns `config.getPricePerQuery()`. **Python hardcodes `Decimal("0")`** for Phase 2A scope (API response parity). Phase 3+ analytics integrity concern — see §8.3 caveat #6 + §7 risk row.
  - `responseTimeMs=null`, `intent_detected=null`, `error_message=null` — Java doesn't set, defaults to null.
  - Wrapped in same transaction as read dispatch (T8) — rollback on dispatch exception.
- **No** writes to other tables.
- **No** external API calls.
- **No** cache writes (drill-down is not cached per Java line 1018-1069 — no `cacheService.get/put` calls).
- **No** audit log beyond usage record (audit log is separate concern, not invoked from `processDrillDown`).

### 1.7 Cross-spec lineage statement

This Tier 3 spec inherits the following Tier 2 patterns:
1. **Composite/dead-code-skip discipline** — region §1.3, department §1.3
2. **Rule 8 KEY-ORDER-FROM-GOLDEN** — region/department spec consistently
3. **Decimal serialization via `_decimal_to_number`** — Rule 4, used in all sister specs since profit chat
4. **`_to_thread` Python 3.8 shim** — analysis_sales.py:50, mandatory for server venv38
5. **Lombok @Data declaration-order key emission** — region §3.10 R-T12 lock pattern
6. **RLS application-layer enforcement** — query-templates spec #48, Apr 28 P0 finding

This spec ADDS the following Tier 3 patterns (potential future Tier 3 sister specs may inherit):
1. **D1 — 5 missing helpers owned by spec, NOT backfilled into sister files** (avoids reopening shipped specs)
2. **D2 — `_drilldown_*` namespace prefix on owned helpers** (prevents future cross-import collisions)
3. **D3+D4 — mixed read-write transaction handling** — D3 = the cross-cutting decision (Java `@Transactional` mixed read+write atomicity must be replicated in Python); D4 = the specific implementation (Z1 cycle 4 redesign: async dispatch via sister helpers + separate sync `engine.begin()` tx for recordUsage write only, atomicity preserved via raise-before-write control flow). Often referenced jointly as "D3+D4".
4. **D5 — T10 visible-vs-internal error info distinction** — service `BusinessException.withHint().withHintTarget()` info dropped by `ApiResponse.error(code, msg)` envelope flattening at controller catch (line 582-585); Python need NOT emit hint/hintTarget. Per R1 cycle 2 finding: Java `ApiResponse` declares 8 total fields (5 always-set + 3 optional UX fields actionHint/severity/hintTarget) but the actual analysis-* / alerts-* recorded goldens emit only 5. Sister test pattern (`test_datasource_contract.py`) strips actionHint/severity/hintTarget defensively. Drill-down §3.8 + §4.3 inherit this strip pattern. Python `wrap_error` (schema_compat.py:59-73) emits 5-field envelope.
5. **D6 — T2 dead level>1 verbatim port** — port for byte parity even though frontend never sends. Per R3 cycle 2: controller DTO has no `level` field at all, Spring silently ignores `"level":N` in JSON, Java service uses `@Builder.Default level=1` always. L3 dead branch unreachable from HTTP — H2 helper tested via direct unit test in PR-B.
6. **D7 — userId=null parity** — Java `recordUsage` line 1066 explicitly passes `null` for userId despite SecurityContext having it; Python mirrors for byte parity at DB level (see §3.6 helper signature + §1.6 side effects entry).
7. **D8 — cost_amount divergence (organizer Phase 2A scope decision)** — Java `recordUsage` computes via `calculateCost`; Python hardcodes `Decimal("0")`. cost_amount is DB-write-only (NOT in API response); byte-shape gate unaffected. Phase 3+ cleanup deferred per §7.5 risk row.

---

## 2. 架构 + 文件 delta

### 2.1 New files (PR-A scope)

```
backend/python/smartbi_compat/api/analysis_drilldown.py         (~1500-1800 LOC PR-A impl)
tests/python/smartbi_compat/test_analysis_drilldown_contract.py (~500-800 LOC PR-A)
tests/fixtures/java-smartbi-golden/drill-down-F999-region-L1.json
tests/fixtures/java-smartbi-golden/drill-down-F999-region-L2.json
# (region L3 dead — UNRECORDABLE via HTTP; see §4.1 note. PR-B unit-tests H2 directly.)
tests/fixtures/java-smartbi-golden/drill-down-F999-department-L1.json
tests/fixtures/java-smartbi-golden/drill-down-F999-department-L2.json
tests/fixtures/java-smartbi-golden/drill-down-F999-product.json
tests/fixtures/java-smartbi-golden/drill-down-F999-time-L1.json
tests/fixtures/java-smartbi-golden/drill-down-F999-salesperson-L1.json
tests/fixtures/java-smartbi-golden/drill-down-F999-error-unknown-dim.json
```

PR-B follow-up file (separate PR, after PR-A merges):
```
tests/python/smartbi_compat/test_analysis_drilldown_arithmetic.py (~600-900 LOC PR-B)
```

### 2.2 Modified files (PR-A scope)

```
backend/python/main.py
  - line ~1112 后加: from smartbi_compat.api import analysis_drilldown
  - line ~1117 后加: app.include_router(analysis_drilldown.router, tags=["SmartBI Compat: Analysis Drill-Down"])

scripts/record-java-golden.sh
  - 增加 POST + JSON body 支持 (CLI flag: --method POST + --data-json '<...>')
  - 当前 script 仅 GET (line 61: curl -sS --fail -H ... URL)
  - 改造范围: ~10 行 (新加 method/body parse + curl 命令分支)
  - **可选 separate PR** before drill-down PR-A; or in this PR-A.
```

### 2.3 Module internal structure (analysis_drilldown.py)

```
analysis_drilldown.py
├── imports
│   ├── from smartbi_compat.api.analysis_finance import _decimal_to_number, _to_decimal,
│   │       _utc_now_iso
│   ├── from smartbi_compat.api.analysis_sales import _to_thread, _get_sync_engine
│   ├── from smartbi_compat.api.analysis_region import _get_region_analysis (or analog)
│   ├── from smartbi_compat.api.analysis_department import _get_department_analysis (or analog)
│   ├── from smartbi_compat.api.analysis_sales import _get_product_ranking,
│   │       _get_sales_trend_chart, _get_salesperson_ranking (or analogs)
│   ├── from sqlalchemy import text
│   ├── # NOTE: smartbi_compat.date_range.DateRange has methods custom/by_period/days/valid
│   ├── #       but no thisMonth() — drill-down implements `_default_date_range_this_month`
│   ├── #       inline (§3.3) returning tuple[date, date], so DateRange import NOT needed
│   ├── #       (X8 cycle 3 nit). If future drill-down extension needs DateRange:
│   ├── #       `from smartbi_compat.date_range import DateRange`
│   ├── from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
│   └── from smartbi_compat.schema_compat import wrap_response, wrap_error
│       # ^ wrap_response at schema_compat.py:37-56 (5-field success envelope)
│       # ^ wrap_error    at schema_compat.py:59-73 (5-field error envelope)
│       # schema_compat.wrap_error_with_hint (line 76-98) emits the 3 optional UX fields
│       # (actionHint/severity/hintTarget) only when explicitly passed — drill-down does
│       # NOT use these per T10 (controller catch flattens hint info).
├── 常量
│   ├── _SUPPORTED_DIMENSIONS = frozenset({"region", "department", "product", "time", "salesperson"})
│   │       # NOT includes "customer" — falls to BusinessException default per Java line 1057
│   ├── _ACTION_TYPE_DRILLDOWN = "DRILLDOWN"
│   └── _DEFAULT_PERIOD_BY_LEVEL = {1: "MONTH", 2: "WEEK", 3: "DAY"}  # service line 2042-2052
├── Pydantic request model
│   └── class DrillDownRequestModel(BaseModel)
│       ├── dimension: str (Field(..., min_length=1))
│       ├── value: Optional[str] = None  # alias to internal filter_value
│       ├── parentDimension: Optional[str] = None
│       ├── parentValue: Optional[str] = None
│       ├── filters: Dict[str, Any] = Field(default_factory=dict)  # alias to additional_filters
│       ├── startDate: Optional[date] = None
│       ├── endDate: Optional[date] = None
│       └── # Optional fields IGNORED in dispatch but accepted for compat:
│       │   parentContext, level, sortBy, sortDirection, limit, includeChildren
├── Helper functions
│   ├── _compute_drill_path(parent_context, filter_value)            # T4 mirror DTO line 295-302
│   ├── _default_date_range_this_month()                              # T5 mirror DateRange.thisMonth()
│   ├── # 5 missing Python helpers (D1 + D2 prefix) — all `async def`, no conn arg (Z1 cycle 4):
│   ├── _drilldown_get_province_ranking(factory_id, region, range_)         # H1
│   ├── _drilldown_get_city_ranking(factory_id, province, range_)           # H2 D6 dead but ported
│   ├── _drilldown_get_department_detail(factory_id, dept, start, end)      # H3
│   ├── _drilldown_get_product_distribution_chart(factory_id, range_)      # H4
│   ├── _drilldown_get_salesperson_metrics(factory_id, salesperson, range_) # H5
│   ├── _drilldown_record_usage(conn, factory_id, ...)                     # T7 SQL INSERT (sync, called inside async wrapper)
│   └── _drilldown_record_usage_async(factory_id, ...)                     # T7 async wrapper (engine.begin tx)
├── Sub-service dispatchers (5) — all `async def`, no conn arg (Z1 cycle 4):
│   ├── _process_region_drilldown(factory_id, request, range_)
│   ├── _process_department_drilldown(factory_id, request, start_date, end_date)  # dept sister takes start/end
│   ├── _process_product_drilldown(factory_id, request, range_)
│   ├── _process_time_drilldown(factory_id, request, range_)
│   └── _process_salesperson_drilldown(factory_id, request, range_)
├── Main dispatch (T8 transaction wrapper)
│   └── _process_drilldown_tx(factory_id, request, user_id) -> dict
├── Error helpers (T10)
│   └── _drilldown_unsupported_dimension_response(dimension) -> tuple[int, dict]
├── Custom exception (T10)
│   └── class DrilldownBusinessException(Exception): code, message
└── Route handler
    └── @router.post("/api/mobile/{factory_id}/smart-bi/drill-down")
```

### 2.4 数据流

```
HTTP POST /api/mobile/{factory_id}/smart-bi/drill-down
  ├─ JSON body parsed by FastAPI/Pydantic into DrillDownRequestModel
  ├─ verify_jwt_and_factory → AuthContext(factory_id, user_id, role)
  ↓
_process_drilldown_tx(factory_id, request)
  ├─ # T5: default date range
  ├─ start_date, end_date = request.startDate, request.endDate or _default_date_range_this_month()
  ├─ range_ = DateRange.custom(start_date, end_date)
  ├─ # READ phase (no tx — async sister helpers manage own connections)
  ├─ # T3: case-insensitive dispatch
  ├─ dim_lower = request.dimension.lower()
  ├─ if dim_lower == "region":
  │     ├─ result = await _process_region_drilldown(factory_id, request, range_)
  │     │     ├─ if filter_value is None/empty: → await _get_region_analysis(...)["ranking"] (composite extract)
  │     │     ├─ elif level == 1: → await _drilldown_get_province_ranking (H1)
  │     │     └─ else (D6 dead): → await _drilldown_get_city_ranking (H2)
  ├─ elif dim_lower == "department": → await _process_department_drilldown(factory_id, request, start, end)
  ├─ elif dim_lower == "product": → await _process_product_drilldown(factory_id, request, range_)
  ├─ elif dim_lower == "time": → await _process_time_drilldown(factory_id, request, range_)
  ├─ elif dim_lower == "salesperson": → await _process_salesperson_drilldown(factory_id, request, range_)
  ├─ else (incl "customer"): raise DrilldownBusinessException(400, ...)  # → no write happens
  ├─ # T9: HashMap mutation order — drillPath, level, dimension
  ├─ result["drillPath"] = _compute_drill_path(request.parentContext, request.value)
  ├─ result["level"] = request.level                     # T2 passthrough
  ├─ result["dimension"] = request.dimension             # T3 ORIGINAL casing
  ├─ # WRITE phase (separate engine.begin tx via async wrapper)
  └─ await _drilldown_record_usage_async(factory_id, action_type="DRILLDOWN")
  └─ return result

# Response wrapping
wrap_response(result) → ApiResponse envelope (5 fields)

# Error path (DrilldownBusinessException → handler)
catch → wrap_error(code=400, message="不支持的下钻维度: <dim>")
       → ApiResponse.error envelope (5 fields via schema_compat.wrap_error; tests strip 3 optional UX fields defensively per R1)
```

**Optimization NOTE**: Python uses 1 transaction with single connection across read dispatch + write. Java uses `@Transactional` propagation REQUIRED with the JpaRepository auto-managing connection. Both achieve same atomicity (rollback on exception) but Python's single-connection model is more explicit. Output byte-shape unaffected.

---

## 3. Java 引用 + 算法对照

### 3.1 总览

| 组件 | Java 行号 | Python 实现位置 | Trap locks |
|---|---|---|---|
| Main dispatch + tx | `SmartBIServiceImpl.java:1018-1069` | `_process_drilldown_tx` | T2, T3, T4, T5, T7, T8, T9, T10 |
| Region dispatch | `SmartBIServiceImpl.java:1975-1996` | `_process_region_drilldown` | T1, T2 (level>1 dead) |
| Department dispatch | `SmartBIServiceImpl.java:2001-2017` | `_process_department_drilldown` | T1 |
| Product dispatch | `SmartBIServiceImpl.java:2022-2032` | `_process_product_drilldown` | T1 |
| Time dispatch | `SmartBIServiceImpl.java:2037-2059` | `_process_time_drilldown` | T2 (level>1 dead) |
| Salesperson dispatch | `SmartBIServiceImpl.java:2064-2076` | `_process_salesperson_drilldown` | T1 |
| `getDrillPath` | `DrillDownRequest.java:295-302` | `_compute_drill_path` | T4 |
| `DateRange.thisMonth()` | `DateRange.java:123-133` | `_default_date_range_this_month` | T5 |
| `recordUsage` | `SmartBIServiceImpl.java:1066` (call) + table `smart_bi_usage_records` | `_drilldown_record_usage` | T7, T11/T12 RLS app-layer |
| BusinessException + ApiResponse.error wrap | `SmartBIServiceImpl.java:1057-1058` (throw) + `SmartBIAnalysisController.java:582-585` (catch) + `ApiResponse.java:82-94` (envelope) | `DrilldownBusinessException` + custom exception handler | T10 |

### 3.2 `_compute_drill_path` (T4)

Java reference — `DrillDownRequest.java:295-302`:

```java
public String getDrillPath() {
    if (parentContext == null || parentContext.isEmpty()) {
        return filterValue != null ? filterValue : "全部";
    }
    if (filterValue == null || filterValue.isEmpty()) {
        return parentContext;
    }
    return parentContext + " > " + filterValue;
}
```

Python mirror (Rule 1: explicit `is not None` not Python `or`):

```python
def _compute_drill_path(parent_context: Optional[str], filter_value: Optional[str]) -> str:
    """Mirror DrillDownRequest.getDrillPath (Java line 295-302).

    T4 LOCK: parent_context first, fall through to filter_value, fall through to "全部".

    Rule 1 note: Java `parentContext == null || parentContext.isEmpty()` matches
    Python `parent_context is None or parent_context == ""`. Empty string is
    Python falsy too, so `not parent_context` would also work — but explicit
    None+empty form mirrors Java exactly and avoids Decimal-falsy-trap reasoning
    surface area (per Rule 1 sister-spec discipline).
    """
    if parent_context is None or parent_context == "":
        return filter_value if filter_value is not None else "全部"
    if filter_value is None or filter_value == "":
        return parent_context
    return f"{parent_context} > {filter_value}"
```

Edge cases (test in PR-B):
- both None → "全部"
- parent_context="全国", filter_value=None → "全国"
- parent_context=None, filter_value="华东" → "华东"
- parent_context="全国", filter_value="华东" → "全国 > 华东"
- parent_context="", filter_value="华东" → "华东" (Java `isEmpty()` matches)
- parent_context="全国 > 华东", filter_value="上海" → "全国 > 华东 > 上海" (multi-level)

**R12 NOTE (cycle 2 nit)**: 5/6 cases above test code paths unreachable from production HTTP traffic — `parent_context` is always None from HTTP because the controller DTO doesn't pass it (see §3.10 R3 note + §1.5 line 121-122 docstring). Tests cover the unreachable cases for future-compat (e.g. `handleDrillDownIntent` AI orchestration — verify whether it sets parent_context; per `SmartBIServiceImpl.java:1728-1742` reading, it likely doesn't, so all 5 are also AI-path-unreachable). Keeping tests for parity with internal callers + defensive coverage.

### 3.3 `_default_date_range_this_month` (T5)

Java reference — `DateRange.java:123-133`:

```java
public static DateRange thisMonth() {
    LocalDate today = LocalDate.now();
    LocalDate startOfMonth = today.withDayOfMonth(1);
    LocalDate endOfMonth = today.withDayOfMonth(today.lengthOfMonth());
    return DateRange.builder()
            .startDate(startOfMonth)
            .endDate(endOfMonth)
            .granularity("MONTH")
            .originalExpression("本月")
            .relative(true)
            .build();
}
```

**Critical T5 detail**: end date is `today.withDayOfMonth(today.lengthOfMonth())` — i.e., **last day of current month**, NOT today. Example: today=2026-05-02 → range = 2026-05-01 to 2026-05-31, NOT 2026-05-01 to 2026-05-02.

Python mirror:

```python
import calendar
from datetime import date

def _default_date_range_this_month() -> tuple[date, date]:
    """Mirror DateRange.thisMonth() (Java line 123-133).

    T5 LOCK: end date is LAST day of current month, NOT today.
    e.g. today=2026-05-02 → (2026-05-01, 2026-05-31).

    Returns (start, end) tuple; the Java DateRange object's other fields
    (granularity="MONTH", originalExpression="本月", relative=true) are NOT
    needed by `processDrillDown` — only startDate/endDate are unpacked at
    line 1031-1032. So Python returns just the date pair.
    """
    today = date.today()
    start_of_month = today.replace(day=1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    end_of_month = today.replace(day=last_day)
    return start_of_month, end_of_month
```

Note: **NOT serialized in response** — `processDrillDown` consumes start/end as locals and never echoes back as a DateRange object. The `dateRange` field that sister specs (region/department/etc) emit is a different code path (composite endpoints). Drill-down response has no top-level `dateRange` envelope field.

### 3.4 5 missing helpers (D1 ownership + D2 prefix)

These 5 helpers are owned by `analysis_drilldown.py` per organizer Q1 decision A. NOT backfilled into sister files (`analysis_region.py`, `analysis_department.py`, `analysis_sales.py`) because:
1. Sister specs are shipped (region #41 / department #36 / sales 5/5 PRs #14/#15/#20). Backfilling means reopening + re-auditing.
2. Drill-down is the only caller — helpers same lifecycle as drill-down.
3. `_drilldown_*` prefix prevents future cross-import collision (consistent with sister-spec convention: each analysis domain uses its own `_<domain>_*` prefix — region/department/sales/finance/procurement all follow this naming default).

**Z2 cycle 4 — Java impl line refs + return types (verified)**:

| Helper | Java impl location | Return type | Python signature (Z1 cycle 4) |
|---|---|---|---|
| H1 `getProvinceRanking` | `RegionAnalysisServiceImpl.java:97` | `List<RankingItem>` | `async def _drilldown_get_province_ranking(factory_id, region, range_) -> list[dict]` |
| H2 `getCityRanking` | `RegionAnalysisServiceImpl.java:146` | `List<RankingItem>` | `async def _drilldown_get_city_ranking(factory_id, province, range_) -> list[dict]` (D6 dead branch) |
| H3 `getDepartmentDetail` | `DepartmentAnalysisServiceImpl.java:113` | **`DashboardResponse`** (NOT DepartmentDetail — Z4 cycle 4 fix) | `async def _drilldown_get_department_detail(factory_id, dept, start_date, end_date) -> dict` |
| H4 `getProductDistributionChart` | `SalesAnalysisServiceImpl.java:537` | `ChartConfig` | `async def _drilldown_get_product_distribution_chart(factory_id, range_) -> dict` |
| H5 `getSalespersonMetrics` | `SalesAnalysisServiceImpl.java:404` | **`List<MetricResult>`** (NOT single — Z4 cycle 4 fix) | `async def _drilldown_get_salesperson_metrics(factory_id, salesperson, range_) -> list[dict]` |

Impl chat MUST grep-verify these line numbers point to the documented method bodies (not overloads) before plan-write.

#### H1 — `_drilldown_get_province_ranking`

Java reference: `RegionAnalysisServiceImpl.java:97` (verified). Called from `SmartBIServiceImpl.java:1985-1986`.

Python signature (D2 prefix, async, no conn — Z1 cycle 4):

```python
async def _drilldown_get_province_ranking(
    factory_id: str,
    region: str,             # parent filter from DrillDownRequest.value
    range_: DateRange,       # Z1 cycle 4 — drill-down's range_ DateRange wrapper
) -> list[dict]:
    """Mirror RegionAnalysisServiceImpl.getProvinceRanking (line 97).

    SQL: aggregate by province where region=:region.
    Returns list of RankingItem dicts (Lombok @Data declaration order).

    KEY-ORDER from RankingItem: rank, name, value, target, completionRate,
    alertLevel — VERIFY from drill-down-F999-region-L2.json golden after recording.
    """
    # Implementation: SQL aggregate on smart_bi_sales_data WHERE factory_id=$1
    # AND region=$2 AND order_date BETWEEN $3 AND $4 AND deleted_at IS NULL
    # GROUP BY province, then build RankingItem dict per row.
    # Ranking sort by total_amount DESC. completionRate via _calculate_completion_rate
    # (region-style arithmetic per region spec R-T13: (actual/target).quantize(4) * 100).
    # alertLevel via _determine_target_completion_alert (60/85 inline).
    # Wrapped in `_to_thread(_exec)` for sync SQLAlchemy + Python 3.8 compat.
    ...
```

Implementation details (SQL shape, ranking iteration, alert computation) are sub-spec'd in PR-A plan — golden recording + sister `analysis_region.py:_build_region_ranking` provides the template.

#### H2 — `_drilldown_get_city_ranking` (D6 dead but ported)

Java reference: `RegionAnalysisServiceImpl.java:146` (verified). Called from `SmartBIServiceImpl.java:1990-1991`, behind `level > 1` branch.

Per D6 LOCK: `level` always 1 in API reality. This helper is **dead code in production** but ported for byte parity. Frontend never sends level=2 to drill-down — and even if it did, controller DTO has no `level` field (R3 cycle 2): Spring silently ignores `"level":2` in JSON, Java sees default level=1, takes L2 path. **No L3 dead golden recordable** — H2 tested via direct unit test in PR-B (test_drilldown_arithmetic.py).

```python
async def _drilldown_get_city_ranking(
    factory_id: str,
    province: str,           # parent filter from DrillDownRequest.value (province name from region L2)
    range_: DateRange,       # Z1 cycle 4 — async, no conn
) -> list[dict]:
    """Mirror RegionAnalysisServiceImpl.getCityRanking (line 146).

    D6 NOTE: dead in API reality (frontend never level>1). Ported for byte parity.

    SQL: aggregate by city where province=:province.
    KEY-ORDER from RankingItem (same as H1): inherited from drill-down-F999-region-L2.json
    golden (since L3 golden is unrecordable per §4.1 R3 note — controller DTO omits `level`,
    Spring silently ignores `"level":2` in JSON body, Java sees default level=1 → L2 path).
    Tested via direct unit test in PR-B (test_drilldown_arithmetic.py::TestRegionDispatchBranching).
    """
    ...
```

#### H3 — `_drilldown_get_department_detail`

Java reference: `DepartmentAnalysisServiceImpl.java:113` (verified). Called from `SmartBIServiceImpl.java:2011-2012`.

Returns **`DashboardResponse`** DTO (NOT `DepartmentDetail` — Z2/Z4 cycle 4 fix; verify Java method signature at line 113).

```python
async def _drilldown_get_department_detail(
    factory_id: str,
    dept_name: str,          # from DrillDownRequest.value
    start_date: date,
    end_date: date,          # Z1 cycle 4 — dept sister takes (start, end), no range_
) -> dict:
    """Mirror DepartmentAnalysisServiceImpl.getDepartmentDetail (line 113).

    Returns single `DashboardResponse` dict (NOT DepartmentDetail per Z2/Z4 cycle 4 verification).
    Includes:
    - Department aggregate metrics (total_amount, total_target, completion_rate, alert_level)
    - Salesperson breakdown list (per-person rankings within dept)
    - Other DashboardResponse Lombok @Data fields — TBD via golden inspection

    KEY-ORDER from DashboardResponse: VERIFY from drill-down-F999-department-L2.json golden
    via `jq -r '.data.data | keys_unsorted[]'`.
    """
    ...
```

#### H4 — `_drilldown_get_product_distribution_chart`

Java reference: `SalesAnalysisServiceImpl.java:537` (verified). Called from `SmartBIServiceImpl.java:2028`.

Returns `ChartConfig` — same Lombok @Data class as sister specs use for chart outputs (e.g., region's `_build_geographic_heatmap` ChartConfig with chartType=MAP). Product distribution chart uses chartType=PIE or BAR — verify via golden. Per Rule 8 + Rule 9 (landed via PR #55):
- `chartType`/`title`/`data`/`options` Lombok @Data declaration order
- **`xaxisField` / `yaxisField` LOWERCASE** (Lombok-Jackson quirk; sister-spec discovery — NOT camelCase as field name suggests)
- **Empty case emits nulls for ChartConfig**, NOT skip (no `@JsonInclude(NON_NULL)` annotation; sister-spec discovery)
- `options` Map.of(N) sites: KEY-ORDER-FROM-GOLDEN per Rule 8

```python
async def _drilldown_get_product_distribution_chart(
    factory_id: str,
    range_: DateRange,       # Z1 cycle 4 — async, no conn
) -> dict:
    """Mirror SalesAnalysisServiceImpl.getProductDistributionChart (line 537).

    Returns ChartConfig (chart_type=PIE or BAR — verify via golden).
    Output dict keys per Rule 8 + Rule 9 (lowercase xaxis/yaxis, empty-emits-nulls).

    KEY-ORDER from ChartConfig: VERIFY from drill-down-F999-product.json golden.
    """
    ...
```

#### H5 — `_drilldown_get_salesperson_metrics`

Java reference: `SalesAnalysisServiceImpl.java:404` (verified). Called from `SmartBIServiceImpl.java:2071-2072`.

Returns **`List<MetricResult>`** (NOT a single MetricResult — Z2/Z4 cycle 4 fix; verified Java method signature is `public List<MetricResult> getSalespersonMetrics(...)` at line 404). Each MetricResult element has 10 Lombok @Data fields.

```python
async def _drilldown_get_salesperson_metrics(
    factory_id: str,
    salesperson: str,        # from DrillDownRequest.value
    range_: DateRange,       # Z1 cycle 4 — async, no conn
) -> list[dict]:
    """Mirror SalesAnalysisServiceImpl.getSalespersonMetrics (line 404).

    Returns LIST of MetricResult dicts (NOT single — Z2/Z4 cycle 4 fix).
    Each MetricResult has 10 Lombok @Data fields:
    metricCode, metricName, value, formattedValue, unit, changePercent,
    changeDirection, alertLevel, dimensionValue, description.

    Python wraps the list in `{"data": [...]}` at the dim processor level —
    actual API response is `{"data": [{...}, {...}, ...]}` for salesperson L2.

    metric_code likely "SALESPERSON_<name>" — verify via golden.
    KEY-ORDER per element from MetricResult Lombok @Data declaration order.
    """
    ...
```

### 3.5 5 dim dispatchers + reused sister-Python helpers

Reused sister-Python helpers (NOT redefined in this module):

| Sister helper (or analog) | Source Python module | Java method | Java line |
|---|---|---|---|
| `_get_region_ranking` (or analog from `_get_region_analysis` composite path) | `analysis_region.py` PR-A (pending) | `regionService.getRegionRanking` | service line 1981 |
| `_get_department_ranking` (analog) | `analysis_department.py` composite (#36 pending impl) | `deptService.getDepartmentRanking` | service line 2007 |
| `_get_product_ranking` (analog) | `analysis_sales.py` 5/5 | `salesService.getProductRanking` | service line 2027 |
| `_get_sales_trend_chart(... period)` (analog) | `analysis_sales.py` 5/5 | `salesService.getSalesTrendChart` | service line 2055 |
| `_get_salesperson_ranking` (analog) | `analysis_sales.py` 5/5 | `salesService.getSalespersonRanking` | service line 2069 |

**HARD prereq for PR-A impl**: region PR-A and department impl PRs MUST land before drill-down PR-A. Otherwise drill-down has unresolved imports for `_get_region_ranking` / `_get_department_ranking`. Spec §7.2 reflects this.

#### Region dim processor

Java reference — `SmartBIServiceImpl.java:1975-1996`:

```java
private Map<String, Object> processRegionDrillDown(...) {
    Map<String, Object> result = new HashMap<>();
    if (request.getFilterValue() == null || request.getFilterValue().isEmpty()) {
        // L1: 大区
        result.put("data", regionService.getRegionRanking(factoryId, startDate, endDate));
        result.put("nextLevel", "province");
    } else if (request.getLevel() == null || request.getLevel() <= 1) {
        // L2: 省份
        result.put("data", regionService.getProvinceRanking(factoryId, request.getFilterValue(), startDate, endDate));
        result.put("nextLevel", "city");
    } else {
        // L3 dead: 城市
        result.put("data", regionService.getCityRanking(factoryId, request.getFilterValue(), startDate, endDate));
        result.put("nextLevel", null);
    }
    return result;
}
```

Python mirror (Rule 1 explicit None+empty checks; T9 HashMap insertion order via Python dict literal; Z1 cycle 4 redesign — async, no conn):

```python
async def _process_region_drilldown(
    factory_id: str, request, range_: DateRange
) -> dict:
    """Mirror processRegionDrillDown (service line 1975-1996).

    Branching matches Java exactly:
      filter_value None/empty             → L1 ranking + nextLevel=province
      level None or level <= 1            → L2 province + nextLevel=city
      else (T2 dead)                      → L3 city + nextLevel=null

    R3 NOTE: From HTTP traffic, `level` is ALWAYS 1 (controller DTO doesn't
    expose it; Java service uses @Builder.Default 1). The `else` branch (L3)
    is unreachable from HTTP — H2 helper exists for parity-by-inspection only,
    tested via direct unit test in PR-B (no L3 golden, see §4.1).

    Z1 NOTE: L1 path uses sister `_get_region_analysis(factory_id, range_)`
    composite + extracts `["ranking"]` because no standalone `_get_region_ranking`
    helper exists in `analysis_region.py` on origin/main (verified). The composite
    does extra work (heatmap + opportunityScores + previous-period query) that
    drill-down ignores — acceptable for this audit-logged endpoint's traffic
    pattern. If perf becomes a concern, add `_drilldown_get_region_ranking`
    helper that wraps sync `_build_region_ranking(rows)` (analysis_region.py:478)
    with row-fetch via `_query_region_full` — defer to Phase 3+.
    """
    filter_value = request.value
    level = request.level
    # KEY-ORDER from drill-down-F999-region-L*.json golden (Rule 8 — HashMap):
    # tentative source order [data, nextLevel] but VERIFY via golden.
    if filter_value is None or filter_value == "":
        composite = await _get_region_analysis(factory_id, range_)
        return {
            "data": composite["ranking"],   # extract ranking from composite
            "nextLevel": "province",
        }
    if level is None or level <= 1:
        return {
            "data": await _drilldown_get_province_ranking(
                factory_id, filter_value, range_
            ),
            "nextLevel": "city",
        }
    # D6 dead branch — port for parity (unreachable from HTTP per R3)
    return {
        "data": await _drilldown_get_city_ranking(
            factory_id, filter_value, range_
        ),
        "nextLevel": None,
    }
```

#### Department dim processor

Java reference — `SmartBIServiceImpl.java:2001-2017`:

```java
private Map<String, Object> processDepartmentDrillDown(...) {
    Map<String, Object> result = new HashMap<>();
    if (request.getFilterValue() == null || request.getFilterValue().isEmpty()) {
        result.put("data", deptService.getDepartmentRanking(factoryId, startDate, endDate));
        result.put("nextLevel", "salesperson");
    } else {
        result.put("data", deptService.getDepartmentDetail(factoryId, request.getFilterValue(), startDate, endDate));
        result.put("nextLevel", null);
    }
    return result;
}
```

Python mirror (Z1 cycle 4 redesign — async, no conn; sister `_get_department_ranking` takes `(factory_id, start, end)` per origin/main `analysis_department.py:373`):

```python
async def _process_department_drilldown(
    factory_id: str, request, start_date: date, end_date: date
) -> dict:
    """Mirror processDepartmentDrillDown (service line 2001-2017).

    L1 (no filter)  → ranking + nextLevel=salesperson
    L2 (filter set) → detail + nextLevel=null

    Note: department sister helper `_get_department_ranking` takes
    `(factory_id, start_date, end_date)` directly — does NOT need range_ wrapping.
    """
    filter_value = request.value
    if filter_value is None or filter_value == "":
        return {
            "data": await _get_department_ranking(factory_id, start_date, end_date),
            "nextLevel": "salesperson",
        }
    return {
        "data": await _drilldown_get_department_detail(
            factory_id, filter_value, start_date, end_date
        ),
        "nextLevel": None,
    }
```

#### Product dim processor

Java reference — `SmartBIServiceImpl.java:2022-2032`:

```java
private Map<String, Object> processProductDrillDown(...) {
    Map<String, Object> result = new HashMap<>();
    result.put("data", salesService.getProductRanking(factoryId, startDate, endDate));
    result.put("chart", salesService.getProductDistributionChart(factoryId, startDate, endDate));
    result.put("nextLevel", null);
    return result;
}
```

Python mirror — single layer, no branching (Z1 cycle 4 redesign — async, no conn; sister `_get_product_ranking` takes `range_` per `analysis_sales.py:1511`):

```python
async def _process_product_drilldown(
    factory_id: str, request, range_: DateRange
) -> dict:
    """Mirror processProductDrillDown (service line 2022-2032). Single-layer.

    Adds extra `chart` key not in other dim shapes (per-dim shape variance T6).
    KEY-ORDER from drill-down-F999-product.json golden (HashMap source: data, chart, nextLevel).
    """
    return {
        "data": await _get_product_ranking(factory_id, range_),
        "chart": await _drilldown_get_product_distribution_chart(factory_id, range_),
        "nextLevel": None,
    }
```

#### Time dim processor

Java reference — `SmartBIServiceImpl.java:2037-2059`:

```java
private Map<String, Object> processTimeDrillDown(...) {
    Map<String, Object> result = new HashMap<>();
    String period = "DAY";
    if (request.getLevel() != null) {
        switch (request.getLevel()) {
            case 1: period = "MONTH"; break;
            case 2: period = "WEEK"; break;
            default: period = "DAY";
        }
    }
    result.put("data", salesService.getSalesTrendChart(factoryId, startDate, endDate, period));
    result.put("period", period);
    return result;
}
```

Python mirror (T2 lock: level always 1 in production, but switch ports for parity; D6 dead branch verbatim — Z5 cycle 4 fix; Z1 cycle 4 redesign — async, no conn):

```python
async def _process_time_drilldown(
    factory_id: str, request, range_: DateRange
) -> dict:
    """Mirror processTimeDrillDown (service line 2037-2059).

    Adds extra `period` key (per-dim shape variance T6).
    Period mapping: level=None→DAY (Java init default before switch),
                    level=1→MONTH, level=2→WEEK, level>=3→DAY (T2 dead default branch).

    R3 NOTE: From HTTP traffic, `level` is ALWAYS 1 (controller DTO doesn't
    expose it; Java service uses @Builder.Default 1). Only the `level=1`→MONTH
    branch is reachable from HTTP. WEEK/DAY paths exist for parity-by-inspection
    only, tested via direct unit test in PR-B (no time-L2/L3 golden, see §4.1).
    """
    level = request.level
    if level is None:
        period = "DAY"
    elif level == 1:
        period = "MONTH"
    elif level == 2:
        period = "WEEK"
    else:  # D6 dead default (T2 lock)
        period = "DAY"
    return {
        "data": await _get_sales_trend_chart(factory_id, range_, period),
        "period": period,
    }
```

**T2 corner case**: level=None vs level=missing-from-request. Pydantic should default `level=None` if absent (matching Java DrillDownRequest `@Builder.Default level=1` on the service-level DTO — but controller-level DrillDownRequestDTO may differ; verify via golden when level is absent from JSON body).

#### Salesperson dim processor

Java reference — `SmartBIServiceImpl.java:2064-2076`:

```java
private Map<String, Object> processSalespersonDrillDown(...) {
    Map<String, Object> result = new HashMap<>();
    if (request.getFilterValue() == null || request.getFilterValue().isEmpty()) {
        result.put("data", salesService.getSalespersonRanking(factoryId, startDate, endDate));
    } else {
        result.put("data", salesService.getSalespersonMetrics(factoryId, request.getFilterValue(), startDate, endDate));
    }
    return result;
}
```

Python mirror:

```python
async def _process_salesperson_drilldown(
    factory_id: str, request, range_: DateRange
) -> dict:
    """Mirror processSalespersonDrillDown (service line 2064-2076).

    Note: NO `nextLevel` key in this shape (per Java line 2064-2076 — only `data`).
    Per-dim shape variance T6: salesperson dim shape differs from region/department.

    Dispatch is purely on filter_value presence — NO level check (unlike region/time
    dim processors which check level for L2/L3 paths). Both branches (L1 ranking +
    L2 metrics) are reachable from frontend at any time. Both H5 (`_drilldown_get_salesperson_metrics`)
    and `_get_salesperson_ranking` (sister) are in production scope.

    Z1 cycle 4 redesign: async, no conn; sister `_get_salesperson_ranking` takes
    `range_` per `analysis_sales.py:1485`. Z2/Z4 cycle 4: H5 returns List[MetricResult]
    (NOT single dict) — Java line 404 verified. Python wraps the list in `{"data": [...]}`.
    """
    filter_value = request.value
    if filter_value is None or filter_value == "":
        return {
            "data": await _get_salesperson_ranking(factory_id, range_),
        }
    return {
        "data": await _drilldown_get_salesperson_metrics(
            factory_id, filter_value, range_
        ),
    }
```

### 3.6 `_drilldown_record_usage` SQL helper (T7)

Java reference — `SmartBIServiceImpl.java:1066`:

```java
recordUsage(factoryId, null, ActionType.DRILLDOWN.name(), 0, false);
```

Args mapping: `(factoryId, queryText=null, actionType="DRILLDOWN", tokenCount=0, cacheHit=false)`. The actual `recordUsage` private method definition (in same Java file) handles INSERT.

Table schema — `V2026_01_18_01__smart_bi_tables.sql:56-74`:

```sql
CREATE TABLE smart_bi_usage_records (        -- PLURAL (entity name SmartBiUsageRecord is singular)
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT,
    action_type ENUM('UPLOAD', 'DASHBOARD', 'QUERY', 'DRILLDOWN', 'EXPORT') NOT NULL,
    analysis_type VARCHAR(50),
    query_text TEXT,
    intent_detected VARCHAR(100),
    token_count INT DEFAULT 0,
    cost_amount DECIMAL(10, 4) DEFAULT 0,
    cache_hit BOOLEAN DEFAULT FALSE,
    response_time_ms INT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factory_date (factory_id, created_at),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at)
);
-- Note: deleted_at column added via BaseEntity inheritance (entity has @Where(deleted_at IS NULL))
```

**T11/T12 RLS finding**: NO PG-level RLS on this table (zero `CREATE POLICY` / `ROW LEVEL SECURITY` in any migration). Application-layer factory_id WHERE clauses are the sole tenant isolation. Spec §7 risks.

Python helper:

```python
_RECORD_USAGE_SQL = text("""
    INSERT INTO smart_bi_usage_records (
        factory_id, user_id, action_type, query_text, token_count,
        cost_amount, cache_hit, response_time_ms, success, created_at
    ) VALUES (
        :factory_id, :user_id, :action_type, :query_text, :token_count,
        :cost_amount, :cache_hit, :response_time_ms, :success, NOW()
    )
""")


def _drilldown_record_usage(
    conn,                                # SQLAlchemy connection (inside outer tx)
    factory_id: str,
    user_id: Optional[int] = None,       # Java passes null at line 1066 (not JWT-derived; see D7)
    action_type: str = "DRILLDOWN",      # Java ActionType.DRILLDOWN.name()
    query_text: Optional[str] = None,    # Java passes null at line 1066
    token_count: int = 0,                # Java passes 0 at line 1066
    cost_amount: Decimal = Decimal("0"), # R2 DIVERGENCE — see §1.6 / §7 / §8.3 caveat #6
    cache_hit: bool = False,             # Java passes false at line 1066
    response_time_ms: Optional[int] = None,
    success: bool = True,                # Java recordUsage line 1168 default
) -> None:
    """Mirror SmartBIServiceImpl.recordUsage (called at service line 1066).

    Java call signature at line 1066: recordUsage(factoryId, null, "DRILLDOWN", 0, false).
    Default args here match that call site exactly EXCEPT cost_amount.

    R2 DIVERGENCE (cycle 2 finding): Java `recordUsage` (line 1172-1173) computes
    `cost_amount = calculateCost(factoryId, tokenCount, cacheHit)` (line 1954-1970)
    which can be non-zero based on `smart_bi_billing_config`. Python hardcodes
    `Decimal("0")` per organizer Phase 2A scope decision (API response parity, NOT
    DB write parity). Phase 3+ cleanup options documented in §7 risk row + §8.3
    caveat #6.

    NOT a top-level transaction — caller (_process_drilldown_tx) opens engine.begin().
    This helper just executes the INSERT inside that connection.

    T11/T12 RLS: explicit factory_id IS the tenant isolation — no PG enforcement.
    """
    conn.execute(_RECORD_USAGE_SQL, {
        "factory_id": factory_id,
        "user_id": user_id,
        "action_type": action_type,
        "query_text": query_text,
        "token_count": token_count,
        "cost_amount": cost_amount,
        "cache_hit": cache_hit,
        "response_time_ms": response_time_ms,
        "success": success,
    })
```

**Open Q for impl**: `user_id` from JWT `userId` claim — Java passes `null` at line 1066 explicitly (despite having `userId` available in SecurityContext). To match byte-shape exactly (the inserted row is not in API response, but DB state matters for downstream analytics), Python should also pass `user_id=None`. Confirm via Java `recordUsage` private method body — if it ignores user_id arg or uses some other source, mirror.

### 3.7 `_process_drilldown_tx` main wrapper (T8)

Java reference — `SmartBIServiceImpl.java:1018-1069`:

```java
@Override
@Transactional  // 移除 readOnly=true，因为 recordUsage() 需要写入数据库
public Map<String, Object> processDrillDown(String factoryId, DrillDownRequest request) {
    log.info(...);
    Map<String, Object> result = new HashMap<>();
    LocalDate startDate = request.getStartDate();
    LocalDate endDate = request.getEndDate();
    // T5: default range
    if (startDate == null || endDate == null) {
        DateRange defaultRange = DateRange.thisMonth();
        startDate = defaultRange.getStartDate();
        endDate = defaultRange.getEndDate();
    }
    // T3: case-insensitive dispatch
    switch (request.getDimension().toLowerCase()) {
        case "region":      result = processRegionDrillDown(...); break;
        case "department":  result = processDepartmentDrillDown(...); break;
        case "product":     result = processProductDrillDown(...); break;
        case "time":        result = processTimeDrillDown(...); break;
        case "salesperson": result = processSalespersonDrillDown(...); break;
        default:
            // T10: throw with hint
            throw new BusinessException(400, "不支持的下钻维度: " + request.getDimension())
                    .withHint("请选择支持的下钻维度").withHintTarget("dimension");
    }
    // T9: HashMap mutation order — drillPath, level, dimension
    result.put("drillPath", request.getDrillPath());
    result.put("level", request.getLevel());           // T2 passthrough
    result.put("dimension", request.getDimension());   // T3 ORIGINAL casing
    // T7: write side-effect
    recordUsage(factoryId, null, ActionType.DRILLDOWN.name(), 0, false);
    return result;
}
```

Python wrapper — Z1 cycle 4 REDESIGN: read-dispatch via async sister helpers (no shared tx), then separate sync tx for recordUsage write only. Java atomicity preserved via raise-before-write semantics:

```python
async def _process_drilldown_tx(
    factory_id: str,
    request,                  # DrillDownRequestModel (Pydantic)
) -> dict:
    """Mirror SmartBIServiceImpl.processDrillDown @Transactional (line 1018-1069).

    Z1 cycle 4 redesign: sister helpers (_get_region_analysis, _get_department_ranking,
    _get_product_ranking, _get_sales_trend_chart, _get_salesperson_ranking) are all
    `async def` and manage their own DB connections internally via `await _to_thread(...)`.
    They DO NOT take a `conn` parameter and CANNOT be called from sync context.
    Therefore the original "single engine.begin() tx wrapping read+write" design (cycle
    2 R5) is incompatible with sister-helper reality.

    New design: read-dispatch async (calls sister helpers natively), then separate
    sync tx for the single write (recordUsage). Java's atomicity guarantee
    (rollback recordUsage if dispatch raises) is preserved through Python's
    raise-before-write control flow:
      - dispatch raises (BusinessException / NPE / etc) → recordUsage line never reached → no row written
      - dispatch succeeds → recordUsage opens own engine.begin() tx → commits → row written
    The DB-level "atomic across read+write" is NOT preserved (read happens outside tx),
    but the OBSERVABLE behavior matches Java at the recordUsage row-write level.

    D5+D6: T10 BusinessException flattens at controller catch (5-field envelope).
           T2 dead level>1 ports verbatim per parity.

    Python 3.8 compat: read sister helpers async natively; write helper wrapped in
    _to_thread shim (sync SQLAlchemy engine.begin() → async via executor).
    """
    # T5: default date range
    start_date = request.startDate
    end_date = request.endDate
    if start_date is None or end_date is None:
        start_date, end_date = _default_date_range_this_month()
    range_ = DateRange.custom(start_date, end_date)   # for sister helpers expecting DateRange

    # T3: case-insensitive dispatch
    # Sister helpers are async — drill-down dim processors below are also async wrappers.
    dim_lower = request.dimension.lower()
    if dim_lower == "region":
        result = await _process_region_drilldown(factory_id, request, range_)
    elif dim_lower == "department":
        result = await _process_department_drilldown(factory_id, request, start_date, end_date)
    elif dim_lower == "product":
        result = await _process_product_drilldown(factory_id, request, range_)
    elif dim_lower == "time":
        result = await _process_time_drilldown(factory_id, request, range_)
    elif dim_lower == "salesperson":
        result = await _process_salesperson_drilldown(factory_id, request, range_)
    else:
        # T10: BusinessException equivalent (caught by route handler → wrap_error envelope)
        # Note: raised BEFORE write tx opens, so no usage row written. Matches Java
        # @Transactional rollback semantics observably (no row in either case).
        raise DrilldownBusinessException(
            code=400,
            message=f"不支持的下钻维度: {request.dimension}",
        )

    # T9: HashMap mutation order — drillPath, level, dimension
    # Per Rule 8, the actual output key order MUST be derived from F999 goldens.
    # Java line 1024 uses `new HashMap<>()` (hash-bucket order). Python dict literal
    # insertion order shown here is SOURCE order; impl chat MUST inspect goldens and
    # reorder per-dim result dict + these top-level keys to match Jackson hash output.
    result["drillPath"] = _compute_drill_path(
        request.parentContext, request.value
    )
    result["level"] = request.level                       # T2 passthrough
    result["dimension"] = request.dimension               # T3: ORIGINAL casing

    # T7: write side-effect — separate engine.begin() tx via async wrapper
    # Java atomicity preserved by raise-before-write control flow (see docstring).
    await _drilldown_record_usage_async(
        factory_id=factory_id,
        action_type="DRILLDOWN",
    )

    return result


async def _drilldown_record_usage_async(
    factory_id: str,
    action_type: str = "DRILLDOWN",
    user_id: Optional[int] = None,         # Java passes null at line 1066 (D7)
    query_text: Optional[str] = None,
    token_count: int = 0,
    cost_amount: Decimal = Decimal("0"),   # D8 documented divergence — see §7.5
    cache_hit: bool = False,
    success: bool = True,
) -> None:
    """Async wrapper around sync `_drilldown_record_usage` (T7) using `engine.begin()`.

    Opens a fresh write tx via SQLAlchemy `engine.begin()` (autocommit on success,
    rollback on exception). Wrapped in `_to_thread` shim for Python 3.8 compat.
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.begin() as conn:    # write tx scope
            _drilldown_record_usage(
                conn=conn,
                factory_id=factory_id,
                user_id=user_id,
                action_type=action_type,
                query_text=query_text,
                token_count=token_count,
                cost_amount=cost_amount,
                cache_hit=cache_hit,
                success=success,
            )
    await _to_thread(_exec)
```

**SQLAlchemy sync + tx pattern choice — design decision (Z1 cycle 4 redesign supersedes R5 cycle 2)**:
- **Choice**: Async dispatch (sister helpers natively async) + sync `engine.begin()` for recordUsage write only, both inside `_to_thread` for Python 3.8 compat.
- **`_to_thread` rationale**: Matches sister `analysis_region.py:50` / `analysis_sales.py:50` shim patterns (Phase 2A consistency).
- **Why NOT a single shared `engine.begin()` tx wrapping read+write (Z1 cycle 4 finding)**: Sister helpers `_get_region_analysis`, `_get_department_ranking`, `_get_product_ranking`, etc. are all `async def` and manage their own DB connections internally via `await _to_thread(_query_*, ...)`. They DO NOT accept a `conn` parameter. The earlier (cycle 2 R5) design assumed a shared-conn pattern that's incompatible with sister-helper reality.
- **Atomicity preservation**: Java `@Transactional` provides DB-level rollback if dispatch raises. Python preserves the OBSERVABLE behavior (no usage row on dispatch failure) through raise-before-write control flow: if dispatch raises, the recordUsage line is unreachable, no tx ever opens, no row ever written. Matches Java's effective behavior at the row-write level.
- **Future Tier 3 sister specs (D3+D4 evolution)**: This 2-stage pattern (async read + sync write tx) IS the Phase 2A write convention going forward. If a future sister has multiple writes that must be atomic with each other, they can wrap in a single `engine.begin()` like `_drilldown_record_usage_async` does.
- **Rejected alternative**: True async DB tx (requires async SQLAlchemy 1.4+ or asyncpg native). Rejected because Phase 2A standardized on sync SQLAlchemy + `_to_thread`; introducing async DB driver here is scope creep.

**Note on tx propagation/isolation**: `engine.begin()` (called inside `_drilldown_record_usage_async._exec`) begins a NEW top-level transaction (no parent join). Java `@Transactional` REQUIRED at top entry also creates a new tx. Isolation defaults to PG `READ_COMMITTED` (SQLAlchemy default). Both match Java `@Transactional` defaults at this entry point. Reads outside tx have no isolation constraint (not problematic — drill-down doesn't need read-committed-with-write-consistency).

### 3.8 `DrilldownBusinessException` + custom handler (T10)

Java reference — `SmartBIServiceImpl.java:1057-1058`:

```java
throw new BusinessException(400, "不支持的下钻维度: " + request.getDimension())
        .withHint("请选择支持的下钻维度").withHintTarget("dimension");
```

Caught at controller — `SmartBIAnalysisController.java:582-585`:

```java
} catch (Exception e) {
    log.error("Drill-down failed", e);
    return ResponseEntity.ok(ApiResponse.error("Drill-down failed: " + ErrorSanitizer.sanitize(e)));
}
```

Wrapped envelope — `ApiResponse.java:82-94`:

```java
public static <T> ApiResponse<T> error(String message) {
    return error(400, message);
}

public static <T> ApiResponse<T> error(Integer code, String message) {
    ApiResponse<T> response = new ApiResponse<>();
    response.setCode(code);
    response.setMessage(message);
    response.setData(null);
    response.setTimestamp(LocalDateTime.now());
    response.setSuccess(false);
    return response;
}
```

**T10 visible body shape (5 fields, NO hint/hintTarget)**:

```json
{
    "code": 400,
    "message": "Drill-down failed: 不支持的下钻维度: invalid",
    "data": null,
    "timestamp": "2026-05-02T14:23:01.123",
    "success": false
}
```

Note: HTTP status is **200** (controller returns `ResponseEntity.ok(...)` even on error — line 584). The 400 is in the body `code` field only. This is consistent with sister specs (project pattern: HTTP 200 + body success/code for business errors; HTTP 4xx/5xx for infrastructure errors).

Python mirror — uses sister-shared `wrap_error` from `smartbi_compat.schema_compat` (R4 cycle 2):

```python
from smartbi_compat.schema_compat import wrap_error  # 5-field error envelope (matches actual recorded goldens)

class DrilldownBusinessException(Exception):
    """Internal exception → caught at route handler → wrapped via schema_compat.wrap_error.

    Mirrors Java BusinessException(code, message) — but withHint/withHintTarget
    are NOT exposed to client per T10 (controller catch flattens to message-only).
    Python omits these setters entirely.
    """
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


# Caller pattern in route handler (no wrapper needed — schema_compat.wrap_error works directly):
#     except DrilldownBusinessException as e:
#         return wrap_error(f"Drill-down failed: {e.message}", code=e.code)
#
# `wrap_error` definition lives at backend/python/smartbi_compat/schema_compat.py:59-73
# and emits {code, message, data: None, timestamp, success: False} — matches actual
# Java goldens (5-field envelope; actionHint/severity/hintTarget either not emitted
# or stripped by sister test pattern, see §4.3 test harness strip-extras logic).
```

**R1 NOTE (cycle 2 finding, demoted to caveat)**: `ApiResponse.java:25-47` declares 8 fields total (5 always-set by `error()`/`success()` factories + 3 optional UX fields `actionHint, severity, hintTarget` added 2026-04-18). No global `@JsonInclude(NON_NULL)` is configured. **However**, actual recorded goldens (verified `analysis-region-F999.json`, `alerts-F999.json`) emit only the 5 fields — the 3 optional fields appear in some other endpoint goldens but not in our analysis-* / alerts-* goldens. Sister contract test pattern (`test_datasource_contract.py`) defensively strips actionHint/severity/hintTarget before comparison. Drill-down §4.3 test harness inherits this strip pattern for robustness. Do NOT add the 3 fields to Python `wrap_error` output — `wrap_error_with_hint` exists in `schema_compat.py:76-98` for the rare case they're needed.

### 3.9 Route handler

```python
@router.post("/api/mobile/{factory_id}/smart-bi/drill-down")
async def drill_down(
    factory_id: str,
    request: DrillDownRequestModel,        # Pydantic body
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.drillDown line 531-586.

    Permission gate: equivalent to @RequirePermission("analytics:read_write")
    enforced via verify_jwt_and_factory + auth.role check (or upstream filter).

    Returns ApiResponse envelope wrapping per-dim result dict.
    Top-level HTTP status 200 even for BusinessException (matches Java).
    """
    try:
        # Z1 cycle 4 redesign: _process_drilldown_tx is now top-level async (no _exec wrapper);
        # dispatches via await to async sister + drill-down helpers; opens separate engine.begin
        # tx for recordUsage write.
        result = await _process_drilldown_tx(
            factory_id=auth.factory_id,
            request=request,
        )
        return wrap_response(result)        # schema_compat.wrap_response — 5-field success envelope
    except DrilldownBusinessException as e:
        # T10: visible body matches ApiResponse.error 5-field envelope (no hint/hintTarget
        # per controller catch flattening); see §3.8 R1 note
        return wrap_error(f"Drill-down failed: {e.message}", code=e.code)
```

**HTTP status decision**: returning 200 even for business errors matches Java controller behavior. If sister-spec convention (or Python wrap_response handler) requires 4xx for `success: false`, adjust during impl. **Verify**: how do sister Python endpoints (region/department/sales) handle BusinessException? Does FastAPI default exception handler return 500 for unexpected exceptions, breaking the Java parity? Spec §5 test plan must lock this.

### 3.10 Pydantic request model

```python
from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import date

class DrillDownRequestModel(BaseModel):
    """Mirror controller-level DrillDownRequestDTO (NOT service-level DrillDownRequest).

    The Java controller DTO has only 7 fields (verified `SmartBIAnalysisController.java:787-798`):
    `dimension, value, parentDimension, parentValue, startDate, endDate, filters`.

    Notably ABSENT from the controller DTO: `level`, `parentContext`, `sortBy`,
    `sortDirection`, `limit`, `includeChildren`. Although these fields exist on
    the service-level `DrillDownRequest` (with `@Builder.Default level=1`), the
    controller's mapping at line 541-550 does NOT set them — so Java service
    ALWAYS sees `level=1` from HTTP traffic, regardless of what the JSON body
    contains. Spring's default `fail-on-unknown-properties=false` silently ignores
    extra JSON fields.

    Practical implications for parity:
    - Region L3 dead branch (Java line 1988-1992, requires `level > 1`) is
      UNREACHABLE from HTTP. Per cycle 1 C1 fix pattern: tag as "dead branch
      in API reality, port verbatim for byte parity, golden recording requires
      direct service invocation (NOT HTTP)".
    - Time WEEK/DAY periods (Java line 2042-2052, level=2/3) similarly unreachable
      from HTTP — Java sees level=1 → MONTH always.
    - Salesperson dispatch (Java line 2064-2076) is purely filter_value-based,
      no level check — both branches reachable from HTTP.

    Python Pydantic accepts all 13 field names below for forward-compat with
    direct (non-HTTP) callers (e.g. `handleDrillDownIntent` AI orchestration may
    set additional fields). Fields not in controller DTO are accepted but their
    values from HTTP body are dead-pass-through (treated as if Java service used
    @Builder.Default).
    """
    # Fields ACTUALLY in controller DTO (7 fields, JSON body delivers these):
    dimension: str = Field(..., min_length=1, description="下钻维度")
    value: Optional[str] = None              # controller field name (Java DTO uses `value`)
    parentDimension: Optional[str] = None      # accepted but not read by drill-down dispatch
    parentValue: Optional[str] = None          # accepted but not read by drill-down dispatch
                                                # (Java service holds them but processDrillDown
                                                # / dim processors don't invoke getParentDimension/Value)
                                                # Note: NOT used by T4 _compute_drill_path (which
                                                # uses parentContext, a separate field) — Z7 cycle 4 clarification
    filters: dict = Field(default_factory=dict)
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    # Fields NOT in controller DTO — accepted for forward-compat with non-HTTP callers
    # but dead-pass-through from HTTP traffic (Java service sees @Builder.Default values):
    parentContext: Optional[str] = None       # service-level field; never set by HTTP path
    level: Optional[int] = 1                  # @Builder.Default 1 in service DTO; default 1 here for parity
    sortBy: Optional[str] = None
    sortDirection: Optional[str] = None
    limit: Optional[int] = None
    includeChildren: Optional[bool] = None
```

**Note on `parentContext` vs `parentDimension`**: Controller DTO has `parentDimension` + `parentValue` but service-level `getDrillPath()` (T4) uses `parentContext`. **Field name mapping is asymmetric** — controller doesn't pass `parentContext` to service builder (line 541-550 only sets `.parentDimension(...).parentValue(...)`). So `parentContext` would always be `null` from HTTP requests.

If `parentContext` is `null`, T4 logic returns `filter_value` (or "全部"). Multi-level drill paths like "全国 > 华东 > 上海" can never be produced via this HTTP endpoint — only via internal DTO builder calls (`SmartBIServiceImpl` test code or AI orchestration `handleDrillDownIntent`).

Spec discipline: Python accepts `parentContext` from JSON body for forward-compat (frontend may send it directly), but does not require it. T4 mirror handles None correctly.

---

## 4. F999 byte-shape gate

### 4.1 Recording (HARD prereq before impl plan)

**Blocker**: `record-java-golden.sh` is currently GET-only (`scripts/record-java-golden.sh:61` uses `curl -sS --fail -H ... URL`). Drill-down requires POST + JSON body. Two options:

**Option A** (recommended — pre-spec separate small PR): Extend `record-java-golden.sh` to support POST + JSON body via new CLI flags `--method POST --data-json '<...>'`. Diff scope ~10 lines. PR before drill-down PR-A so the script works for ALL future POST endpoint records (also helps future Phase 2A WRITE endpoint specs).

**Option B** (in-spec ad-hoc): Inline `curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary '@<json-body>.json' "$URL" | jq` per-golden in this PR-A's record script. Less reusable but unblocks immediately.

**Decision**: Option A. Script extension lands BEFORE drill-down PR-A.

**Z3 cycle 4 — Concrete script diff for Option A**:

```bash
# Existing scripts/record-java-golden.sh uses positional args:
#   <factory_id> <endpoint_path> <output_filename> [--prod]
#
# Extension adds optional --method / --data-json flags AFTER positional args.
# Existing GET-only callers continue to work (default --method GET).

# In scripts/record-java-golden.sh, after line 22 ENV_FLAG="${4:-test}":
- ENV_FLAG="${4:-test}"
+ # Parse optional flags after 3 required positional args
+ shift 3
+ METHOD="GET"
+ DATA_JSON=""
+ ENV_FLAG="test"
+ while [[ $# -gt 0 ]]; do
+     case "$1" in
+         --method)    METHOD="$2"; shift 2;;
+         --data-json) DATA_JSON="$2"; shift 2;;
+         --prod)      ENV_FLAG="--prod"; shift;;
+         *)           echo "Unknown flag: $1" >&2; exit 1;;
+     esac
+ done

# In scripts/record-java-golden.sh, replace line 61 curl invocation:
- curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL" \
+ if [[ "$METHOD" == "POST" ]]; then
+     curl -sS --fail -X POST \
+         -H "Authorization: Bearer $TOKEN" \
+         -H "Content-Type: application/json" \
+         --data "$DATA_JSON" "$URL" \
+ else
+     curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL" \
+ fi \
    | python3 -c "import json, sys; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))" \
    > "$OUT_PATH"
```

Total diff: ~15 lines added, 2 lines modified. Backward-compatible (default GET behavior preserved).

Recording commands (assuming Option A landed):

```bash
# JWT_SECRETs from /www/wwwroot/cretas/.env.test (test env, port 10011)
JWT_SECRET="<test>" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-region-L1.json \
    --method POST --data-json '{"dimension":"region","startDate":"2024-01-01","endDate":"2024-12-31"}'

JWT_SECRET="<test>" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-region-L2.json \
    --method POST --data-json '{"dimension":"region","value":"华东","level":1,"startDate":"2024-01-01","endDate":"2024-12-31"}'

# NOTE: drill-down-F999-region-L3-dead.json is INTENTIONALLY OMITTED.
# Region L3 (city) dispatch (Java line 1988-1992) requires `level > 1`, but
# the controller DTO has no `level` field — Spring silently ignores `"level":2`
# in the JSON body, Java service sees @Builder.Default level=1, takes L2 path
# (province) instead. Recording with level=2 produces an L2 golden, not L3.
# H2 helper (`_drilldown_get_city_ranking`) is implemented for byte parity per
# Java line 1988-1992 verbatim, tested via direct unit test (NOT golden-driven)
# in PR-B test_drilldown_arithmetic.py. Same situation for time WEEK/DAY paths
# (Java line 2042-2052, level=2/3) — only MONTH (level=1, default) is HTTP-reachable.
# 8 goldens recorded total (not 9 as originally enumerated).

# Department: L1 + L2
JWT_SECRET="<test>" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-department-L1.json \
    --method POST --data-json '{"dimension":"department","startDate":"2024-01-01","endDate":"2024-12-31"}'

JWT_SECRET="<test>" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-department-L2.json \
    --method POST --data-json '{"dimension":"department","value":"销售部","startDate":"2024-01-01","endDate":"2024-12-31"}'

# Product (single layer)
JWT_SECRET="<test>" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-product.json \
    --method POST --data-json '{"dimension":"product","startDate":"2024-01-01","endDate":"2024-12-31"}'

# Time L1 (period=MONTH)
JWT_SECRET="<test>" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-time-L1.json \
    --method POST --data-json '{"dimension":"time","level":1,"startDate":"2024-01-01","endDate":"2024-12-31"}'

# Salesperson L1 (no filter)
JWT_SECRET="<test>" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-salesperson-L1.json \
    --method POST --data-json '{"dimension":"salesperson","startDate":"2024-01-01","endDate":"2024-12-31"}'

# T10 error path — unknown dimension
JWT_SECRET="<test>" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-error-unknown-dim.json \
    --method POST --data-json '{"dimension":"invalid","startDate":"2024-01-01","endDate":"2024-12-31"}'
```

**Recording must happen BEFORE PR-A plan finalizes** — goldens reveal:
1. Top-level HashMap key order for each per-dim shape (Rule 8)
2. RankingItem / MetricResult / DepartmentDetail / ChartConfig Lombok @Data declaration orders
3. T10 error envelope exact 5-field key order (`code, message, data, timestamp, success` — verify hash order)
4. T10 error body shape — confirms hint/hintTarget absence (line 582-585 catch flattening)
5. `time` dim shape with `period` extra key (per-dim shape variance T6)
6. `product` dim shape with `chart` extra key (per-dim shape variance T6, ChartConfig nested)
7. ChartConfig `xaxisField`/`yaxisField` LOWERCASE serialization (Rule 9 sister-spec discovery)
8. ChartConfig empty-case behavior (emit nulls vs skip-null per Rule 9)
9. `timestamp` exact format (LocalDateTime → ISO with timezone? millis? nanos?)

### 4.2 Gate semantics

**Phase 2A 全域统一**: dict-equality compare (NOT strict-byte). Tolerates:
- Numeric `0` vs `0.0` equivalence (Java BigDecimal output `0` or `0.00` per setScale)
- Python int vs Java integer wrapping
- `_decimal_to_number` helper covers most cases (Rule 4)

**Strip before compare**:
- `timestamp` (volatile per-request)
- (No other volatile fields specific to drill-down. Generic `_strip_volatile` helper from sister spec covers `generatedAt`/`lastUpdated`/`cacheExpireAt` too — drill-down doesn't emit those but the helper is shared.)

**Strict-byte gate (Phase 3+)**: Out of scope for this spec. Future strict-byte gate would require canonical comparison handling for Decimal scale, JSON whitespace, etc.

### 4.3 Test harness (test_analysis_drilldown_contract.py PR-A)

```python
import io
import json
from pathlib import Path
from datetime import datetime, timezone
import pytest
import importlib.util
import os
import sys
import jwt

# JWT_SECRET MUST be set BEFORE importing production code (sister contract test pattern)
JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET

REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"


def _load_production_main():
    """Mirror sister test_analysis_finance_contract.py / test_analysis_region_contract.py pattern."""
    main_path = REPO_ROOT / "backend" / "python" / "main.py"
    sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _make_token(factory_id: str, user_id: int = 1) -> str:
    payload = {
        "userId": user_id,
        "username": "test_user",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


VOLATILE = frozenset({"timestamp", "generatedAt", "lastUpdated", "cacheExpireAt"})

# R1 (cycle 2 demoted): ApiResponse.java has 8 fields total — 5 always-set by
# error()/success() factories + 3 optional UX fields (actionHint, severity, hintTarget)
# added 2026-04-18 with no @JsonInclude(NON_NULL). Actual recorded goldens for
# analysis-* / alerts-* endpoints emit only 5 fields, but other endpoints' goldens
# may include the 3 nulls. Sister test pattern (test_datasource_contract.py) strips
# them defensively before comparison — drill-down inherits the pattern for robustness.
ENVELOPE_EXTRAS = frozenset({"actionHint", "severity", "hintTarget"})


def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


def _strip_envelope_extras(body: dict) -> dict:
    """Drop optional UX fields (actionHint/severity/hintTarget) from envelope before
    byte-shape compare. Sister pattern from test_datasource_contract.py.

    These 3 fields exist in ApiResponse but are server-side enrichments not relevant
    to drill-down byte parity (per T10 hint flatten + R1 cycle 2 finding).
    """
    return {k: v for k, v in body.items() if k not in ENVELOPE_EXTRAS}


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)


# 8 golden compare tests parametrized — region L1+L2, dept L1+L2, product, time L1, salesperson L1, error
@pytest.mark.parametrize("golden_name,request_body", [
    ("drill-down-F999-region-L1", {"dimension": "region", "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-region-L2", {"dimension": "region", "value": "华东", "level": 1,
                                     "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    # ("drill-down-F999-region-L3-dead", ...) OMITTED per §4.1 R3 — controller DTO has
    # no `level` field, JSON `"level":2` silently ignored, Java sees default level=1 → L2.
    # H2 helper (`_drilldown_get_city_ranking`) tested via direct unit test in PR-B.
    ("drill-down-F999-department-L1", {"dimension": "department", "startDate": "2024-01-01",
                                         "endDate": "2024-12-31"}),
    ("drill-down-F999-department-L2", {"dimension": "department", "value": "销售部",
                                         "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-product", {"dimension": "product", "startDate": "2024-01-01",
                                   "endDate": "2024-12-31"}),
    ("drill-down-F999-time-L1", {"dimension": "time", "level": 1, "startDate": "2024-01-01",
                                   "endDate": "2024-12-31"}),
    ("drill-down-F999-salesperson-L1", {"dimension": "salesperson", "startDate": "2024-01-01",
                                          "endDate": "2024-12-31"}),
])
def test_drilldown_byte_shape_against_golden(client, monkeypatch, golden_name, request_body):
    """F999 dict-eq gate per dimension state.

    Mocks all 5 sister + 5 owned helpers + recordUsage to return F999-shaped data.
    """
    from smartbi_compat.api import analysis_drilldown
    # Mock all sister + owned helpers as needed per dim
    # ... mock setup omitted for brevity; impl chat constructs based on F999 dataset

    resp = client.post(
        "/api/mobile/F999/smart-bi/drill-down",
        json=request_body,
        headers={"Authorization": f"Bearer {_make_token('F999')}"},
    )
    assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
    py_data = _strip_volatile(resp.json()["data"])

    with io.open(GOLDEN_DIR / f"{golden_name}.json", encoding="utf-8") as f:
        raw = json.load(f)
        golden_data = _strip_volatile(raw.get("data", raw))

    if py_data != golden_data:
        import difflib
        py_str = json.dumps(py_data, ensure_ascii=False, indent=2, sort_keys=True)
        golden_str = json.dumps(golden_data, ensure_ascii=False, indent=2, sort_keys=True)
        diff = "\n".join(difflib.unified_diff(
            golden_str.splitlines(), py_str.splitlines(),
            fromfile="golden", tofile="python", lineterm="", n=3,
        ))
        pytest.fail(f"{golden_name} byte-shape mismatch:\n{diff}")


def test_drilldown_unknown_dim_error_envelope(client):
    """T10 error envelope shape: 5 always-set fields (actionHint/severity/hintTarget
    stripped per R1 cycle 2 + sister pattern)."""
    resp = client.post(
        "/api/mobile/F999/smart-bi/drill-down",
        json={"dimension": "invalid", "startDate": "2024-01-01", "endDate": "2024-12-31"},
        headers={"Authorization": f"Bearer {_make_token('F999')}"},
    )
    # HTTP 200 (Java controller returns ResponseEntity.ok even on error)
    assert resp.status_code == 200
    body = _strip_envelope_extras(resp.json())   # R1 strip pattern
    assert body["success"] is False
    assert body["code"] == 400
    assert "不支持的下钻维度" in body["message"]
    assert body["data"] is None
    # T10: hint/hintTarget were already stripped via _strip_envelope_extras above
    # (Python doesn't emit them; Java may or may not depending on version, both stripped for compare)

    with io.open(GOLDEN_DIR / "drill-down-F999-error-unknown-dim.json", encoding="utf-8") as f:
        golden = json.load(f)
        golden_body = _strip_envelope_extras(_strip_volatile(
            golden.get("data", golden) if isinstance(golden, dict) else golden
        ))
    assert _strip_envelope_extras(_strip_volatile(body)) == golden_body
```

---

## 5. 测试策略

### 5.1 PR-A: Foundation + contract (~500-800 LOC)

`tests/python/smartbi_compat/test_analysis_drilldown_contract.py`:

```python
class TestRouteHandler:
    def test_route_registered_post_only(self, production_app):
        """Verify FastAPI router registers POST /api/mobile/{factory_id}/smart-bi/drill-down (NOT GET)."""

    def test_jwt_required_returns_401_or_403_without_token(self, client):
        """No bearer token → 401 or 403."""

    def test_factory_mismatch_returns_403(self, client):
        """JWT factoryId != path factoryId → 403."""

    def test_get_method_returns_405(self, client):
        """GET on POST-only route → 405 Method Not Allowed."""


class TestF999GoldenPerDim:
    """8 golden tests parameterized — each dim × layer state (region L3 dead omitted per §4.1 R3)."""
    # parametrize over 8 success cases + 1 error case (see §4.3 above)


class TestDimensionDispatch:
    """Test §3.7 main dispatch logic."""
    def test_dimension_lower_case_dispatch(self, monkeypatch, client):
        """T3: 'REGION' / 'Region' / 'region' → all dispatch to region processor."""

    def test_dimension_with_unknown_value_raises_business_exception(self, client):
        """T10: unknown dim → BusinessException → ApiResponse.error envelope."""

    def test_customer_dim_raises_business_exception(self, client):
        """T2-adjacent: 'customer' is in DTO docstring but NOT in switch → error."""


class TestDateDefault:
    """T5: default range when start/end null."""
    def test_null_start_date_uses_this_month_default(self, monkeypatch, client):
        """startDate null → defaults to first day of current month."""

    def test_null_end_date_uses_this_month_default(self, monkeypatch, client):
        """endDate null → defaults to LAST day of current month (NOT today)."""

    def test_both_null_uses_this_month_default(self, monkeypatch, client):
        """Both null → full this-month range."""


class TestTransactionAtomicity:
    """T7+T8: read + write atomicity."""
    def test_record_usage_called_on_success(self, monkeypatch, client):
        """Successful dispatch → 1 row INSERTed to smart_bi_usage_records with action_type='DRILLDOWN'."""

    def test_record_usage_NOT_called_on_business_exception(self, monkeypatch, client):
        """BusinessException raised before recordUsage → no row written (tx rollback)."""

    def test_record_usage_args_match_java(self, monkeypatch, client):
        """T7 args: factory_id, user_id=None, action_type='DRILLDOWN', query_text=None,
        token_count=0, cost_amount=0, cache_hit=False, success=True."""
```

### 5.2 PR-B: Arithmetic depth tests (~600-900 LOC, separate PR after PR-A merge)

`tests/python/smartbi_compat/test_analysis_drilldown_arithmetic.py`:

```python
class TestComputeDrillPath:
    """T4 helper unit tests."""
    def test_both_none_returns_全部(self):
        assert _compute_drill_path(None, None) == "全部"

    def test_parent_context_only(self):
        assert _compute_drill_path("全国", None) == "全国"

    def test_filter_value_only(self):
        assert _compute_drill_path(None, "华东") == "华东"

    def test_both_set_concatenates_with_arrow(self):
        assert _compute_drill_path("全国", "华东") == "全国 > 华东"

    def test_empty_string_treated_as_none(self):
        assert _compute_drill_path("", "华东") == "华东"
        assert _compute_drill_path("全国", "") == "全国"

    def test_multi_level_nested(self):
        assert _compute_drill_path("全国 > 华东", "上海") == "全国 > 华东 > 上海"


class TestDefaultDateRangeThisMonth:
    """T5 helper unit tests."""
    def test_returns_first_and_last_of_current_month(self, freeze_time):
        """Mock today=2026-05-02 → returns (2026-05-01, 2026-05-31)."""

    def test_february_leap_year(self, freeze_time):
        """today=2024-02-15 → (2024-02-01, 2024-02-29)."""

    def test_february_non_leap_year(self, freeze_time):
        """today=2025-02-15 → (2025-02-01, 2025-02-28)."""

    def test_december(self, freeze_time):
        """today=2025-12-15 → (2025-12-01, 2025-12-31)."""


class TestPeriodMapping:
    """T2 dead branch parity for time dim."""
    def test_level_1_returns_month(self):
        ...
    def test_level_2_returns_week(self):
        ...
    def test_level_3_returns_day_default(self):
        ...
    def test_level_none_returns_day_initial(self):
        """Java line 2041 init period='DAY', if level is None switch is skipped."""


class TestRegionDispatchBranching:
    """T1+T2 region dispatch."""
    def test_no_filter_calls_get_region_ranking(self, monkeypatch):
        """L1 path."""
    def test_filter_with_level_1_calls_get_province_ranking(self, monkeypatch):
        """L2 path — H1 helper."""
    def test_filter_with_level_2_calls_get_city_ranking(self, monkeypatch):
        """L3 dead path — H2 helper, T2 verbatim parity."""


class TestRecordUsageSql:
    """T7 INSERT helper."""
    def test_insert_with_all_default_args(self, mock_conn):
        """Verify _drilldown_record_usage called with Java-line-1066 default args."""

    def test_factory_id_explicit_in_insert(self, mock_conn):
        """T11/T12: factory_id MUST be in INSERT — no PG default."""
```

### 5.3 Mock pattern

```python
@pytest.fixture
def mock_drilldown_helpers(monkeypatch):
    """Mock 5 sister + 5 owned helpers + recordUsage for unit + contract tests.

    R8 NOTE (cycle 2): These fakes return MINIMAL stub shapes for unit-level dispatch
    tests. They do NOT match the full Lombok @Data declaration order from H1-H5
    docstrings. Golden-driven contract tests (test_drilldown_byte_shape_against_golden)
    use real shape from F999 goldens — those test the full key set. Use these stubs
    only for branching/dispatch verification, NOT for shape assertions.
    """
    from smartbi_compat.api import analysis_drilldown

    def fake_region_ranking(conn, fid, sd, ed): return [{"name": "华东", "value": 1000}]
    def fake_province_ranking(conn, fid, region, sd, ed): return [{"name": "上海", "value": 600}]
    def fake_city_ranking(conn, fid, province, sd, ed): return [{"name": "浦东", "value": 400}]
    def fake_dept_ranking(conn, fid, sd, ed): return [{"name": "销售部", "value": 5000}]
    def fake_dept_detail(conn, fid, dept, sd, ed): return {"name": dept, "members": []}
    def fake_product_ranking(conn, fid, sd, ed): return [{"name": "饮料", "value": 2000}]
    def fake_product_chart(conn, fid, sd, ed): return {"chartType": "PIE", "data": []}
    def fake_sales_trend(conn, fid, sd, ed, period): return {"chartType": "LINE", "period": period}
    def fake_salesperson_ranking(conn, fid, sd, ed): return [{"name": "张三", "value": 1500}]
    def fake_salesperson_metrics(conn, fid, sp, sd, ed): return {"name": sp, "metric": 0}
    def fake_record_usage(*args, **kwargs): pass

    monkeypatch.setattr(analysis_drilldown, "_get_region_ranking", fake_region_ranking)
    monkeypatch.setattr(analysis_drilldown, "_drilldown_get_province_ranking", fake_province_ranking)
    monkeypatch.setattr(analysis_drilldown, "_drilldown_get_city_ranking", fake_city_ranking)
    monkeypatch.setattr(analysis_drilldown, "_get_department_ranking", fake_dept_ranking)
    monkeypatch.setattr(analysis_drilldown, "_drilldown_get_department_detail", fake_dept_detail)
    monkeypatch.setattr(analysis_drilldown, "_get_product_ranking", fake_product_ranking)
    monkeypatch.setattr(analysis_drilldown, "_drilldown_get_product_distribution_chart", fake_product_chart)
    monkeypatch.setattr(analysis_drilldown, "_get_sales_trend_chart", fake_sales_trend)
    monkeypatch.setattr(analysis_drilldown, "_get_salesperson_ranking", fake_salesperson_ranking)
    monkeypatch.setattr(analysis_drilldown, "_drilldown_get_salesperson_metrics", fake_salesperson_metrics)
    monkeypatch.setattr(analysis_drilldown, "_drilldown_record_usage", fake_record_usage)
```

### 5.4 Smoke compare (impl chat to execute)

```bash
# Step 1: re-record F999 region-L1 fresh
JWT_SECRET="<test>" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    /tmp/drill-down-F999-region-L1-fresh.json \
    --method POST --data-json '{"dimension":"region","startDate":"2024-01-01","endDate":"2024-12-31"}'

# Step 2: diff with checked-in golden
diff <(jq 'del(.timestamp) | del(.data.dateRange) | .' tests/fixtures/java-smartbi-golden/drill-down-F999-region-L1.json) \
     <(jq 'del(.timestamp) | del(.data.dateRange) | .' /tmp/drill-down-F999-region-L1-fresh.json)
# Expected: empty diff (only timestamp should change between runs)
```

### 5.5 Cross-tenant 4-corner tests (T11+T12 enforcement gate)

T11/T12 RLS gap implies application-layer factory_id check is the SOLE tenant isolation. Test must prove:

```python
class TestCrossTenantIsolation:
    def test_same_factory_jwt_path_match_succeeds(self, client, mock_drilldown_helpers):
        """JWT factoryId='F999', path '/api/mobile/F999/...' → 200."""

    def test_jwt_factory_mismatch_path_returns_403(self, client):
        """JWT factoryId='F001', path '/api/mobile/F999/...' → 403 via verify_jwt_and_factory."""

    def test_record_usage_writes_only_jwt_factory_id(self, monkeypatch, client):
        """Even if request body could carry factory_id, recordUsage uses JWT-derived id."""

    def test_query_includes_factory_id_in_where(self, monkeypatch):
        """Verify all sub-service SQL includes factory_id = ? clause via SQL inspection."""
```

---

## 6. Byte gate semantics

### 6.1 dict-eq vs strict-byte (Phase 2A standard)

Phase 2A 全域统一使用 dict-eq compare,跟所有 Tier 1/Tier 2 sister specs 同标准。

**dict-eq 容忍**:
- `0` (Python int) vs `0.0` (Java BigDecimal output) — Python `0 == 0.0` True
- `1234.56` (Python float) vs `1234.56` (Java BigDecimal setScale(2)) — `_decimal_to_number` 保证 Python int-if-integral else float
- 字符串字段 strict (e.g. message text must match exactly)

**dict-eq 不容忍**:
- key 缺失 / 多 key
- 嵌套 dict 内 key 顺序差异 (实际上 dict-eq 不依赖 key 顺序,但 strict-byte gate Phase 3+ 会要求)

**strip 字段**:
- `timestamp` (volatile per-request — present in ApiResponse envelope)
- (No other volatile fields specific to drill-down. But sister-shared `_strip_volatile` covers `generatedAt/lastUpdated/cacheExpireAt` too.)

### 6.2 Decimal serialization (Rule 4)

All BigDecimal fields through `_decimal_to_number` — sister-shared from `analysis_finance.py`:

```python
def _decimal_to_number(v: Decimal) -> Any:
    if v == v.to_integral_value():
        return int(v)
    return float(v)
```

In drill-down context, Decimal fields appear in:
- Per-dim ranking item `value`/`target`/`completionRate` fields (sister patterns)
- `MetricResult` value/changePercent fields (H5 salesperson metrics)
- ChartConfig data (H4 product distribution chart)

### 6.3 Map.of(N) sites (Rule 8 + Rule 9)

**HashMap sites (NOT Map.of)** — TBD-FROM-GOLDEN per Rule 8:
1. Top-level dispatcher result — Java line 1024 `new HashMap<>()` + line 1061-1063 mutation. Per-dim shape varies; each F999 golden reveals its own hash order. Source insertion order: `data, [chart|period], nextLevel, drillPath, level, dimension`. Actual JSON output order = Java HashMap hash-bucket → derive from each golden.
2. Per-dim processors each `new HashMap<>()` (line 1977 / 2003 / 2024 / 2039 / 2066) — per-dim hash order.
3. ApiResponse envelope (line 87-93) — 5 fields `code, message, data, timestamp, success` set in this order in `error()` method, but ApiResponse may have Lombok @Data with declaration order: `code, message, data, timestamp, success` (matches setter order). Verify via golden — likely matches but Lombok @JsonPropertyOrder could override.

**LinkedHashMap sites (insertion order, Python dict directly mirrors)**:
1. Per-dim sub-service outputs (RankingItem / MetricResult / DepartmentDetail) — Lombok @Data declaration order. Python dict literal in declaration order matches.

**ChartConfig (H4 product chart) — Rule 9 sister-spec quirks** (cite, no inline reasoning):
- `xaxisField` / `yaxisField` LOWERCASE in JSON (NOT camelCase as field name suggests; Lombok-Jackson quirk discovered by sister chats)
- Empty-case ChartConfig emits null values for unused fields (no `@JsonInclude(NON_NULL)`)
- Both behaviors locked via Rule 8/9 in `.claude/rules/python-java-port.md`

**DateRange dict (sister-shared) — Rule 9 7-field shape**:
- 7 fields when serialized via Lombok @Data: `startDate, endDate, granularity, originalExpression, relative, days, valid` (last 2 are derived getters)
- Drill-down does NOT emit DateRange in response (composite endpoints do; drill-down response has no top-level dateRange field). H4 product distribution chart's nested `ChartConfig` may include date-range info embedded in axis labels or title strings — those are plain strings, NOT DateRange objects, so Rule 9 7-field shape is N/A for drill-down's serialized output. R11 cycle 2 nit clarification.

---

## 7. PR 切片 + 顺序

### 7.1 Spec PR (本 PR)

**Branch**: `phase2a/spec-drill-down`
**Base**: `origin/main` (after rebase to latest, currently `b91bf94a7` post #53 inventory PR-A)
**Files**:
- `docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md` (~2500 LOC, this file)
- `docs/superpowers/specs/2026-05-02-phase2a-drill-down-design-notes.md` (~445 LOC, step 5 scratchpad — kept for audit trail)
**估时**: 6-10h spec write + 4-cycle audit + ship
**Merge prereq**: 4-cycle audit pass (self / spec-reviewer / cross-spec / final-impl-reviewer)

### 7.2 PR-A: Foundation + contract tests

**Branch**: `phase2a/drill-down-impl` (or sister-naming convention)
**Base**: `origin/main` after this spec PR + Tier 2 PR-As (region #41 PR-A, department #36 impl) ALL land
**Files**:
- `backend/python/smartbi_compat/api/analysis_drilldown.py` (~1500-1800 LOC)
- `backend/python/main.py` (+2 lines: import + include_router)
- `tests/python/smartbi_compat/test_analysis_drilldown_contract.py` (~500-800 LOC)
- 9× `tests/fixtures/java-smartbi-golden/drill-down-F999-*.json`

**HARD prereqs (impl chat MUST verify before plan finalization)**:
1. **Region PR-A landed** — `_get_region_ranking` (or analog) importable from `analysis_region.py`
2. **Department PR-A landed** — `_get_department_ranking` importable from `analysis_department.py`
3. **Sales 5/5 PRs already landed** (#14, #15, #20) — `_get_product_ranking`, `_get_sales_trend_chart`, `_get_salesperson_ranking` importable from `analysis_sales.py`
4. **`record-java-golden.sh` extended for POST + JSON body** (separate PR per §4.1 Option A)
5. **8 F999 goldens recorded** before PR-A plan finalizes (per §4.1 commands; region L3 dead omitted)

**估时**: 6-8h impl + test write + smoke

**Acceptance**:
- All 8 dim-state golden tests pass via dict-eq (with `_strip_volatile` + `_strip_envelope_extras`)
- T10 unknown-dim error envelope matches golden 5-field shape (NO hint/hintTarget)
- T7 `recordUsage` writes 1 row per success request (verify via SQL count)
- T8 transaction atomicity: BusinessException → no usage row written
- T11/T12 cross-tenant 4-corner tests pass (per §5.5)
- Lint clean (project-standard linter)
- Test env (Java 10011) deploy → smoke compare on real F001 data (skipped manual test, run by hand pre-PR-merge)

### 7.3 PR-B: Arithmetic depth tests

**Branch**: `phase2a/drill-down-arithmetic`
**Base**: `origin/main` after PR-A merge
**Files**:
- `tests/python/smartbi_compat/test_analysis_drilldown_arithmetic.py` (~600-900 LOC)

**估时**: 3-4h test write
**Goal**: Lock T1-T10 traps with deep unit tests covering edge cases not exercisable via golden contract tests:
- T4 `_compute_drill_path` — 6 edge cases (none/none, parent-only, filter-only, both, empty-string variants, multi-level)
- T5 `_default_date_range_this_month` — 4 calendar edge cases (Feb leap/non-leap, Dec, mid-month)
- T2 dead level>1 parity — region L3 + time period mapping
- T3 dimension casing — REGION/Region/region all dispatch
- T7 INSERT shape — all 9 columns including null defaults
- T1 each missing helper × 1+ test (5 helpers minimum)
- T9 HashMap mutation order verification (per-dim)

### 7.4 Subsequent waves (out of scope)

- No further waves planned for drill-down — this is the **last Tier 3 endpoint** in Phase 2A scope per organizer decision.
- If `customer` dim is requested by frontend later: separate Wave 4+ spec.
- If `handleDrillDownIntent` AI orchestration path needs Python port: separate Phase 2B-β spec.

### 7.5 Phase 3+ deferred cleanups (organizer-acknowledged divergences)

| Risk | Phase | Mitigation / Decision |
|---|---|---|
| **R2 cost_amount write divergence** | Phase 3+ cleanup | Java `recordUsage` (`SmartBIServiceImpl.java:1161-1176`) computes `cost_amount` via `calculateCost(factoryId, tokenCount, cacheHit)` (`SmartBIServiceImpl.java:1954-1970`), reading `smart_bi_billing_config.pricePerQuery` for non-unlimited factories. Python hardcodes `Decimal("0")`. Phase 2A scope = API response parity, NOT DB write parity. `cost_amount` is DB-write-only column (NOT in API response), byte-shape gate unaffected. Future Phase 3 analytics integrity concern when Python-written usage records aggregate cross-factory: Python rows show 0, Java rows show computed. Cleanup options: (a) Phase 3 chat ports `calculateCost` to Python (~1h impl, requires `_drilldown_calculate_cost(conn, factory_id, token_count, cache_hit)` helper + `smart_bi_billing_config` query), (b) Phase 3 ops backfill computed value via SQL job. Decision deferred to Phase 3 ops. |

---

## 8. Open risks + mitigations

### 8.1 Lock-in risks (spec 强制 mirror,无 risk)

| ID | 描述 | 锁定位置 |
|---|---|---|
| T1 | 5 missing Python helpers (province/city/dept-detail/product-distribution-chart/salesperson-metrics) owned by drill-down (D1) with `_drilldown_*` prefix (D2) | §3.4 |
| T2 | level always 1 in API reality; level>1 branches port verbatim for byte parity (D8) | §3.5 region/time processors |
| T3 | `dimension.lower()` case-insensitive dispatch; original casing preserved in response | §3.7 |
| T4 | `_compute_drill_path` parent_context first, fall through to filter_value, "全部" fallback | §3.2 |
| T5 | `_default_date_range_this_month()` returns LAST day of current month (NOT today) | §3.3 |
| T7 | `_drilldown_record_usage` SQL INSERT to `smart_bi_usage_records` (PLURAL) with Java-line-1066 default args | §3.6 |
| T8 | `engine.begin()` mixed read+write tx via `_to_thread` shim, asyncpg defaults (REQUIRED + READ_COMMITTED) | §3.7 + §7 risks below |
| T10 | Visible body shape 5 fields via `wrap_error` (schema_compat.py:59-73) — controller catch flattens hint/hintTarget. R1 cycle 2: Java may emit 8 fields (5 + 3 optional UX); tests strip 3 extras per sister pattern. | §3.8 |
| T11 | RLS application-layer enforcement on `smart_bi_sales_data` / `smart_bi_department_data` (no PG RLS policy verified Apr 28; explicit `factory_id = $1` WHERE clause IS the tenant isolation). Aligns with sister tables fixed in `V20260502_03/_04`. Drill-down does NOT add RLS migrations — Phase 3+ separate concern. | §1.5 (out of scope row), §3.5 dim processors, §5.5 cross-tenant tests |
| T12 | RLS application-layer enforcement on `smart_bi_usage_records` (write side-effect target). Same finding as T11 — no PG RLS policy. Explicit factory_id IN INSERT IS the tenant isolation. JWT-derived factory_id (NOT request-body) per `verify_jwt_and_factory` upstream filter. | §1.5 (out of scope row), §3.6 SQL helper, §5.5 cross-tenant tests |

### 8.2 Verify-via-golden risks (impl chat MUST 录 golden 验证)

| ID | 描述 | 验证步骤 |
|---|---|---|
| T6 | Per-dim shape variance — 8 dimension states × layers, each emits different keys | Record 8 F999 goldens (§4.1; region L3 dead omitted); verify each via dict-eq test (§4.3) |
| T9 | Top-level HashMap key order — per-dim hash bucket | Each F999 golden inspected via `jq -r 'keys_unsorted[]'`; Python dict literal mirror per dim |
| T10 detail | ApiResponse.error 5-field hash order (code/message/data/timestamp/success) | Golden `drill-down-F999-error-unknown-dim.json` inspect |
| Rule 9 ChartConfig | xaxisField/yaxisField LOWERCASE + empty-case emits nulls | Golden `drill-down-F999-product.json` (ChartConfig nested) inspect |
| Rule 9 DateRange | 7 fields including derived getters (days, valid) | Drill-down does not emit DateRange — N/A for this endpoint, but pre-existing risk for sister composite endpoints |

### 8.3 Already-known caveats (Java 既有行为,Python mirror 不修)

1. **`String.format` Locale-dependent**: Java JVM Locale = en_US in production; Python `f"{val:,.2f}"` matches. Inherited from sister specs.

2. **HashMap iteration order non-deterministic across Java versions**: Java 21 (current prod) has stable hash buckets for given key set; Java 22+ may differ. Phase 2A locks against Java 21 specifically. Strict-byte gate (Phase 3+) needs canonical compare to handle this.

3. **`recordUsage` ignores `userId` from SecurityContext**: Java line 1066 explicitly passes `null` for query_text + does not pass user_id. Python mirrors to match DB write pattern. Analytics on usage records show `user_id IS NULL` for DRILLDOWN actions — known by analytics team.

4. **`@RequirePermission("analytics:read_write")` enforcement**: Python relies on JWT `role` claim and upstream `verify_jwt_and_factory` filter. There's no per-endpoint ACL check inside `analysis_drilldown.py`. Sister-spec discipline (region/finance/sales) — same pattern.

5. **`smartBIService==null` controller fallback (line 555-579)** is dead code: Spring DI never null. Out of scope per §1.5.

6. **`cost_amount` write divergence** (R2 cycle 2): Java computes via `calculateCost`; Python hardcodes `Decimal("0")`. `cost_amount` is DB-write-only (not in API response) — byte-shape gate unaffected. Phase 3+ cleanup deferred per §7.5. See §3.6 helper docstring + §1.6 side effects entry.

7. **Pydantic 422 vs Java 200+sanitized NPE on missing/null `dimension`** (R6 cycle 2): Pydantic `dimension: str = Field(..., min_length=1)` returns HTTP 422 on missing/empty input. Java side: controller has no `@Valid`, service receives null → NullPointerException → controller catch (line 582-585) → `ApiResponse.error("Drill-down failed: " + ErrorSanitizer.sanitize(e))` → HTTP 200, body `{code: 400, message: "Drill-down failed: 操作失败，请稍后重试", success: false}`. Python's 422 is more correct; sister Python modules accept this divergence. Documented as accepted Phase 2A divergence — frontend already handles 422 from other Pydantic-validated endpoints.

8. **Malformed JSON / wrong content-type** (R6b cycle 2): FastAPI returns 422/415 with FastAPI's default error envelope (`{detail: ...}`), NOT ApiResponse envelope. Spring would also return 4xx but with different message shape. Both reject malformed input — divergence is in error envelope shape, not behavior. Accepted Phase 2A divergence; downstream clients should handle non-ApiResponse 4xx for these edge cases.

### 8.4 Risk mitigation 总策略 (impl chat HARD prereq)

1. **Region PR-A + Department impl PR + Sales 5/5 PRs ALL landed** before drill-down PR-A starts. Otherwise broken imports.
2. **Extend `record-java-golden.sh` for POST** (Option A) BEFORE 8 goldens record.
3. **Record 8 F999 goldens** BEFORE PR-A plan finalizes (per §4.1 commands; region L3 dead omitted per R3).
4. **Inspect each golden's HashMap key order** via jq; Python dict literal mirror per dim.
5. **Test env (Java 10011) deploy + F001 manual smoke compare** BEFORE PR-A merge.

### 8.5 Spec-level open questions (impl chat resolve)

1. **`_drilldown_record_usage` SQL: cost_amount BigDecimal serialization**: SQLAlchemy maps Decimal → numeric column natively, but verify `Decimal("0")` doesn't trigger asyncpg/SQLAlchemy precision issue with `DECIMAL(10,4)` column.
2. **`SmartBiUsageRecord` entity has `@Where(deleted_at IS NULL)`** — INSERT does not set deleted_at (defaults to NULL), so SELECT * will see the row. Verify behavior.
3. **HTTP status code on BusinessException**: Java returns 200 with body code=400 (line 584 `ResponseEntity.ok(...)`). FastAPI default would 4xx for HTTPException. Python custom handler MUST return 200 to match. Verify sister spec pattern.
4. **Pydantic DrillDownRequestModel** (RESOLVED cycle 2 R7): `backend/python/requirements.txt:27` confirms `pydantic>=2.5,<3` — project uses Pydantic v2.5+. Use v2 idioms (`Field(..., min_length=1)`, `model_dump()`, `model_validate()`). No need for v1 `parse_obj` / `Config` class. Field aliases via `Field(alias="...")` if mapping needed (drill-down doesn't need — see §3.10 cleanup).
5. **`time` dim level None vs missing from JSON body**: RESOLVED (cycle 2 R3). Controller `DrillDownRequestDTO` (`SmartBIAnalysisController.java:787-798`) has NO `level` field. Spring `fail-on-unknown-properties=false` silently ignores `"level":N` in JSON body. Java service ALWAYS sees `level=1` (`@Builder.Default` on `DrillDownRequest:96-97`). Python Pydantic must also default to `1` (NOT `None`) to match Java parity — see §3.10 model definition.

---

## 9. References

### 9.1 Cross-spec lineage (cycle 3 audit citations)

**Tier 2 sister specs (4-件套)**:
- `docs/superpowers/specs/2026-05-01-phase2a-analysis-region-design.md` (PR #41) — composite-only §1.3 / Map.of(N) Rule 8 / Lombok @Data declaration order pattern / R-T13 cross-spec divergence (region's `_calculate_completion_rate` arithmetic order)
- `docs/superpowers/specs/2026-05-01-phase2a-analysis-department-design.md` (PR #36) — composite-only §1.3 lineage establish / Tier 2 trap cataloging template
- `docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md` (PR #40) — uses `_get_procurement_*` domain-prefixed helpers throughout (sister-domain naming convention, emerged organically across region/department/sales/finance/procurement specs — no documented "I6 fix" or formal naming-convention spec). Drill-down's `_drilldown_*` prefix (D2) follows the same convention.
- `docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md` (PR #47) — multi-mode dispatch pattern (4 modes); drill-down's 5-dim dispatch is similar topology

**Wave 1 finance specs**:
- `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md` (PR #25) — cost trap cataloging
- `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md` (PR #21+22) — `_decimal_to_number` helper introduction (Rule 4)
- PR #18 payable (impl-only, no separate spec doc) — first ported finance per-type endpoint; retrospect findings led to Rule 4 introduction
- `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-receivable-design.md` (PR #33+#42) — receivable per-type
- `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-budget-design.md` (PR #34+#38) — budget per-type, R-T8 Map.of(N) hash discovery via `comparison.options.series` golden inspection

**Wave 2 / Tier 1 specs**:
- `docs/superpowers/specs/2026-05-01-phase2a-query-templates-design.md` (PR #48) — RLS app-layer + write side-effect pattern. Drill-down's T7+T11+T12 directly inherits this. query-templates spec has 4 write endpoints (POST/PUT/DELETE × 2 — query templates + categories) — drill-down has 1 (recordUsage), but pattern is identical.

**Phase 2B-β AI orchestration (lineage cite, NOT in scope)**:
- `docs/superpowers/specs/2026-04-30-phase2b-beta-design.md` + `docs/superpowers/specs/2026-04-29-phase2b-ai-intent-layer-design.md` — Per cycle 3 X9 verification: `handleDrillDownIntent` (`SmartBIServiceImpl.java:1728-1742`, verified) is referenced by neither β nor α intent layer specs directly (those specs predate the wrapper introduction). Java method exists and is invoked by AI orchestration internally. Future Phase 2B-β Python port (when scoped) would wrap `_process_drilldown_tx` from this PR-A; **out-of-scope for Phase 2A**. The "Phase 2B-β #24" PR # cite at spec line 15 is unverified — keep cite path reference but do NOT rely on PR # accuracy.

**Apr 28 P0 RLS gap finding (memory cite)**:
- `feedback_p0_rls_gap_finding.md` — sister tables `smart_bi_pg_excel_uploads`, `smart_bi_analysis_results`, `smart_bi_llm_fallback_log` had application-layer-only tenant isolation (no PG RLS); fixed in `V20260502_03/_04`. Drill-down's T11+T12 finding mirrors this exactly; resolution (add PG RLS) is Phase 3+ separate concern.

**Apr 28 cross-tenant 4-corner test pattern (memory cite)**:
- `feedback_cancel_invariant_whitelist.md` — Rule 8 4-corner pattern (own-success / cross-tenant 403 / null-token-403 / role-mismatch-403). Drill-down §5.5 inherits.

### 9.2 Rules cite (`.claude/rules/python-java-port.md`)

- **Rule 1** (Null fallback `is not None` 三元): `_compute_drill_path` parent_context + filter_value None checks, `_process_*_drilldown` filter_value None checks, `_drilldown_record_usage` user_id None default
- **Rule 2** (WEEK calendar year): N/A — drill-down does not emit period keys (time dim emits `period: "DAY"|"WEEK"|"MONTH"` but as a top-level scalar string, not a period_key in series data)
- **Rule 3** (函数签名 1:1 mirror): 5 dim processors are async `_process_*_drilldown(factory_id, request, range_or_start_end)` (Z1 cycle 4 — sister-helper-driven signatures, no conn arg). `_process_drilldown_tx(factory_id, request)` is a top-level async wrapper (deviates intentionally — D3+D4 redesigned per Z1 cycle 4 to use async dispatch + separate sync write tx).
- **Rule 4** (`_decimal_to_number`): per-dim sub-service outputs (RankingItem.value/target/completionRate, MetricResult.value/changePercent, ChartConfig data Decimal fields)
- **Rule 5** (SELECT *): `_drilldown_get_*` helpers may use SELECT * for sister-chat extensibility; sister-shared SQL helpers (e.g., `_query_sales_data` for product helpers) per existing convention
- **Rule 6** (输入 None-check): All 5 missing helpers + `_process_drilldown_tx` reject None for factory_id / start_date / end_date
- **Rule 7** (Decimal 阈值 vs float): N/A — drill-down does not have alert thresholds (sub-service outputs may include alertLevel from sister helpers, but drill-down doesn't compute new ones)
- **Rule 8** (Map.of(N) Jackson hash order): per-dim HashMap key order TBD-FROM-GOLDEN, top-level result mutation order TBD-FROM-GOLDEN, ApiResponse.error 5-field order TBD-FROM-GOLDEN
- **Rule 9** (landed via PR #55, commit `eb71ca244`): xaxisField/yaxisField LOWERCASE for ChartConfig (H4 product distribution chart), DateRange 7-field shape (N/A — drill-down doesn't emit DateRange), ChartConfig empty-case emits nulls (H4 verify)

### 9.3 Code refs

| 路径 | 行号 | 用途 |
|---|---|---|
| `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java` | 528-586 | Drill-down route handler + dead fallback |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java` | 1018-1069 | `processDrillDown` main entry + dispatch + recordUsage |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java` | 1975-2076 | 5 dim processors (region/department/product/time/salesperson) |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java` | 1728-1742 | `handleDrillDownIntent` — Phase 2B-β AI path (out of scope, lineage cite) |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/DrillDownRequest.java` | 1-304 | Service-level DTO (13 fields + helper methods) |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/DrillDownRequest.java` | 295-302 | `getDrillPath()` (T4) |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/DateRange.java` | 123-133 | `thisMonth()` (T5) |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/common/ApiResponse.java` | 25-37, 82-94 | Envelope structure + `error()` factory |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiSalesData.java` | 40 | `@Where(deleted_at IS NULL)` (replicate in Python SQL) |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiDepartmentData.java` | 36 | `@Where(deleted_at IS NULL)` |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiUsageRecord.java` | 38 | `@Where(deleted_at IS NULL)` (table is plural `smart_bi_usage_records`) |
| `backend/java/cretas-api/src/main/resources/db/migration/V2026_01_18_01__smart_bi_tables.sql` | 56-74 | `smart_bi_usage_records` table schema |
| `backend/python/smartbi_compat/api/analysis_finance.py` | `_decimal_to_number` (line 429), `_to_decimal` (402), `_utc_now_iso` (1290) | Sister-shared helpers (Rule 4) |
| `backend/python/smartbi_compat/api/analysis_sales.py` | `_to_thread` (50), `_get_sync_engine` (208) | Sister-shared async + DB helpers |
| `backend/python/main.py` | 1106-1128 | Phase 2A router registration block |
| `scripts/record-java-golden.sh` | 1-67 | Golden record script (NEEDS POST extension per §4.1) |
| `.claude/rules/python-java-port.md` | Rule 1-9 | Project-wide Java→Python parity rules |
| `tests/python/smartbi_compat/test_analysis_finance_contract.py` | 1-91 | Sister contract test boilerplate (JWT + production main load + _strip_volatile) |

### 9.4 Tier 3 lineage statement

**Tier 3 spec template** is established by this drill-down spec on top of the 4 Tier 2 sister specs (department / region / procurement / inventory) and 1 Wave 2 sister (query-templates with write side-effects). Tier 3 specifically deals with:

1. **Multi-dimensional dispatch** (5 dims here) — vs Tier 2's per-type dispatch (single resource, multiple aggregation modes)
2. **Write side-effects in mixed read-write transaction** — first endpoint to mix READ dispatch + WRITE recordUsage atomically
3. **Spec-owned helper extraction** (D1) when sister files don't expose required interfaces — alternative to retroactive sister backfill
4. **Controller boundary error semantics** (T10) — first endpoint where service-level rich error info (hint/hintTarget) is dropped at controller catch

Future Tier 3 sister specs (none planned — drill-down is last) would inherit (with NEW-pattern flags noted for evaluation):
- **D1** ownership pattern for spec-owned helpers (sister-spec emergent convention; not unique to Tier 3)
- **D2** namespace prefix discipline (sister-spec emergent convention; not unique to Tier 3)
- **D3+D4** transaction wrapper Python idiom — **first Phase 2A use of SQLAlchemy `engine.begin()`** for mixed read+write atomicity. Sister modules use `engine.connect()` (read-only) or `get_db_context()` + explicit commit (write-explicit). Future Tier 3 sisters should evaluate consistency vs reuse vs migration to a unified pattern (organizer decision deferred).
- **D5** visible-vs-internal error info distinction (T10 — first Phase 2A endpoint where `BusinessException.withHint()` info collapses at controller catch boundary)
- **D6** dead level>1 verbatim port (T2 — first endpoint where controller-DTO-vs-service-DTO field-set asymmetry causes dead Java code branches; impl chat MUST NOT trust JSON body field set as 1:1 with service DTO)
- **D7** userId=null parity (recordUsage write convention — first Phase 2A Python write to `smart_bi_usage_records`)
- **D8** cost_amount divergence (organizer-acknowledged DB-write divergence — Phase 3+ cleanup deferred)
- Conservative tx defaults — SQLAlchemy `engine.begin()` defaults (REQUIRED-equivalent at top-level, READ_COMMITTED isolation on PG); matches Java `@Transactional` defaults at top-level entry

---

### 9.5 Audit pattern lessons (from drill-down spec 4-cycle review)

The drill-down spec underwent a full 4-cycle audit (self / spec-reviewer / cross-spec / final-impl-reviewer) catching **44 distinct findings** across cycles (cycle 1: 14, cycle 2: 12, cycle 3: 9, cycle 4: 9). Several recurring failure modes emerged that future Tier 3+ spec chats should watch for:

#### 9.5.1 Incomplete-sweep failure mode (recurring across cycles 2-4)

**Pattern**: A "fix all instances" decision (e.g., cycle 2 R1 8→5 envelope claim) gets applied to N-1 of N locations, leaving 1+ stale references. Caught at next cycle as a regression.

**Instances**:
- Cycle 2 R1 sweep missed §1.1 line 77 → cycle 3 X1
- Cycle 2 R3 sweep missed 8 "9 → 8 goldens" locations → cycle 3 X3
- Cycle 2 R5 sweep missed §9.4 lineage statement → cycle 3 X6
- Cycle 2 R9 sweep missed §9.3 line 1935 stale `1731-1741` → cycle 3 X9
- Cycle 3 X4 sweep missed §3.5 line 754 D8/D6 confusion → cycle 4 Z5
- Cycle 3 X9 sweep missed §10 PR #24 caveat → cycle 4 Z9

**Mitigation (cycle 4 introduced)**: **Post-edit grep verification protocol** — after applying a fix, run `grep -nE "<stale pattern>" <spec>` and confirm 0 matches before commit. Each finding should attach `verify-real` + `verify-fixed` grep commands. Caught X3 false-positive grep matches before assuming sweep done.

#### 9.5.2 Fabricated cite failure mode (cycle 3 X2 + memory `feedback_phase2a_sister_spec_import_audit.md`)

**Pattern**: Spec invents a precedent ("procurement spec PR #40 I6 fix") that doesn't exist in any sister spec. Cited 3 times to justify a sound decision but with fabricated evidence.

**Mitigation**: For every cross-spec claim ("inherited from X"), open the sister spec and grep for the cited pattern. If the pattern doesn't exist, either find the real precedent or switch to honest "emerged organically" / "decision made here for the first time" wording.

#### 9.5.3 Phantom interface failure mode (cycle 4 Z1 + Z2 + memory `feedback_phase2a_sister_spec_import_audit.md`)

**Pattern**: Spec describes a Python helper interface (signature, return type) that doesn't match origin/main reality. PR #47 cycle 4 caught this for `_fetch_all` + `verify_factory_access`; drill-down cycle 4 caught it for sister helpers `_get_region_ranking` (doesn't exist), `_get_department_ranking` (async, no conn), H3/H5 return types (DashboardResponse not DepartmentDetail; List not single).

**Mitigation**: For every Python sister helper cited, run `grep -n "^async def <helper>\|^def <helper>" backend/python/smartbi_compat/api/*.py` to verify (a) the helper exists, (b) async/sync, (c) signature shape. Spec author should attach output of these greps to spec source as audit-trail.

#### 9.5.4 8-vs-5 envelope nuance (R1 demoted across cycles 2 + 3)

**Pattern**: Java `ApiResponse` declares 8 fields (5 always-set + 3 optional UX). Cycle 2 R1 reviewer over-asserted "8 fields emit always". Cycle 3 verification via actual recorded goldens proved 5 fields for analysis-* / alerts-* endpoints. Sister test pattern (`test_datasource_contract.py`) defensively strips 3 extras.

**Mitigation**: For any "Java emits N fields" claim, verify against actual recorded golden via `jq -r '.response | keys_unsorted[]'` BEFORE asserting in spec. Don't trust class-level field declaration counts as ground truth for runtime emission.

#### 9.5.5 4-cycle finding count baseline

For Tier 3 specs, expect **roughly 30-50 findings across 4 cycles**:
- Cycle 1 (self-review): 10-15 findings (mostly own typos + decision inconsistencies)
- Cycle 2 (spec-reviewer): 10-15 findings (factual errors, scope gaps)
- Cycle 3 (cross-spec): 5-12 findings (citation accuracy, sister-pattern alignment)
- Cycle 4 (final-impl-reviewer): 5-10 findings (impl-readiness gaps, sister-helper signatures)

Findings rarely overlap. Stop signal: cycle N finds <5 issues and they're all nits → ship-ready. Cycle N finds 1+ structural issue → may need cycle N+1.

#### 9.5.6 Tier 3 unique audit focus areas

Beyond the inherited Tier 2 audit checks (Java line refs, byte-shape gate, Rule 1-9 compliance), Tier 3 specs should also verify:
- Sister Python helper signatures (Z1 phantom interface class)
- Multi-helper write coordination (T7+T8 — first-of-kind in Tier 3)
- Controller catch behavior for new exception types (T10)
- Per-dim output shape variance (T6)

---

## 10. Cross-spec audit citations (cycle 3 — for spec-reviewer subagent)

When dispatching cycle 3 cross-spec reviewer, MUST cite these 8 highest-leverage references (full list of 13 in §9.1):

1. **Tier 2 region spec** (PR #41) — composite-only / Lombok @Data declaration order / R-T13 arithmetic divergence pattern
2. **Tier 2 department spec** (PR #36) — composite-only §1.3 lineage establish
3. **Tier 2 procurement spec** (PR #40) — domain-prefixed helper convention (`_get_procurement_*`), sister-spec emergent pattern; drill-down D2 follows
4. **Tier 2 inventory spec** (PR #47) — multi-mode dispatch pattern parallel
5. **Wave 2 query-templates spec** (PR #48) — RLS app-layer + write side-effect pattern (drill-down T7+T11+T12 inherit)
6. **Wave 1 finance budget spec** (PR #34+#38) — Map.of(N) hash discipline (Rule 8 baseline)
7. **Phase 2B-β AI orchestration** (PR # unverified per cycle 3 X9 — likely the `2026-04-30-phase2b-beta-design.md` spec) — `handleDrillDownIntent` lineage (`SmartBIServiceImpl.java:1728-1742`, out-of-scope but cite for AI path future port)
8. **Apr 28 P0 RLS gap finding** (memory `feedback_p0_rls_gap_finding.md`) — sister tables RLS gap precedent (drill-down's T11+T12 mirrors)

**Plus rule files**:
- `.claude/rules/python-java-port.md` Rules 1-9 (Rule 9 landed via PR #55, commit `eb71ca244` — sister-spec discoveries baked in via §6.3 cites)
- `.claude/rules/concurrent-edit-safety.md` (sub-skill 5b for safe-commit during impl)

**Subagent dispatch instruction template**:

```
You are conducting cross-spec cycle 3 audit for the drill-down spec at
docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md.

Read the spec end-to-end. Then read each of the 8 sister/lineage citations
listed in §10. For each spec, identify any pattern this drill-down spec
deviates from (with reasoning) or inherits from (verifying inheritance is
correctly applied).

Specific concerns:
1. Does §3 algorithm pseudocode correctly inherit Rule 1/4/5/6/8 from sister specs?
2. Does §3.7 transaction wrapper align with query-templates spec write pattern?
3. Does §4.3 test harness mirror sister contract test pattern?
4. Does §7 PR slicing prerequisite chain match reality (region/dept/sales PRs)?
5. Does §8 risk catalog cover all reasonable Tier 3 unique risks?
6. Are §9 references complete and link-correct?

Output: bullet list of issues found with severity (critical/important/nit),
spec section reference, and suggested fix (where applicable).
```

---

**Spec end. Total length: ~2500 LOC. Awaiting 4-cycle audit + organizer review.**





