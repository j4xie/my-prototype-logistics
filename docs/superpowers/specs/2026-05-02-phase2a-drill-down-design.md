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
- **ApiResponse envelope**: `ApiResponse.java:25-37` (5 fields: code, message, data, timestamp, success) + `error()` factory line 82-94

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
| 9 goldens (5 dim × layer + 1 error) — see §6.1 | byte-shape gate |
| 1 route handler registered in `main.py` between Tier 2 sisters | sister registration pattern |

### 1.5 Out of scope (per Java prod path)

| 项 | 理由 |
|---|---|
| Controller `if smartBIService==null` fallback (line 555-579) | dead code (Tier 2 lineage §1.3) |
| `customer` dimension | listed in DrillDownRequest docstring but NOT in switch (line 1035-1059) → falls to BusinessException default. Acceptable byte-parity behavior (will return error envelope). No Python implementation of customer drill-down logic. |
| `salesperson` dim level>1 with filterValue (calls `getSalespersonMetrics`) | technically in switch (line 2068-2073) but falls into "T2 dead level>1" — frontend never sends. Python ports verbatim for parity (D8). |
| `customer` drill-down independent endpoint | If Wave 4+ wants this, separate spec. |
| PG-level RLS migrations on `smart_bi_sales_data` / `smart_bi_department_data` / `smart_bi_usage_records` (T11/T12) | Separate Phase 3+ concern. Aligns with Apr 28 P0 RLS gap finding (sister tables fixed in `V20260502_03/_04`). Application-layer factory_id WHERE is the sole isolation. |
| `handleDrillDownIntent` AI orchestration path (`SmartBIServiceImpl.java:1731-1741`) | Phase 2B-β scope, calls `processDrillDown` but is a SEPARATE entry point. This spec ports the HTTP `POST /drill-down` only. AI cite see §9.1. |
| Locale-dependent string formatting (`String.format("%,.2f", ...)` etc) inherited from sister specs | Already-known caveat; Python `f"{val:,.2f}"` matches en_US (production JVM Locale). |
| Sort/limit/includeChildren request fields (sortBy/sortDirection/limit/includeChildren) | Java `processDrillDown` does NOT use these fields (verify by grep — they're set as @Builder.Default but no `request.getSortBy()` call appears in dim processors). Python parses them but ignores in dispatch. Out-of-scope to honor. |

### 1.6 Side effects

- **1 row INSERT** to `smart_bi_usage_records` per request (T7 — service line 1066).
  - Args mirror Java exactly: `factoryId, queryText=null, actionType="DRILLDOWN", tokenCount=0, cacheHit=false, success=true`
  - Other defaults: `costAmount=0`, `responseTimeMs=null`, `userId=null` (Python may have user_id from JWT — TBD §3.6)
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
3. **D3+D4 — mixed read-write transaction wrapper** (`engine.begin()` async-via-`_to_thread`)
4. **T10 hint/hintTarget loss at controller catch boundary** — service `BusinessException.withHint().withHintTarget()` info dropped by `ApiResponse.error(code, msg)` envelope flattening; Python need NOT emit hint/hintTarget. Spec §4 locks the visible body shape (5 fields, no hint/hintTarget).
5. **T2 dead level>1 verbatim port** — port for byte parity even though frontend never sends.

---

## 2. 架构 + 文件 delta

### 2.1 New files (PR-A scope)

```
backend/python/smartbi_compat/api/analysis_drilldown.py         (~1500-1800 LOC PR-A impl)
tests/python/smartbi_compat/test_analysis_drilldown_contract.py (~500-800 LOC PR-A)
tests/fixtures/java-smartbi-golden/drill-down-F999-region-L1.json
tests/fixtures/java-smartbi-golden/drill-down-F999-region-L2.json
tests/fixtures/java-smartbi-golden/drill-down-F999-region-L3-dead.json
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
│   ├── from smartbi_compat.date_range import DateRange (Python equivalent class, sister-shared)
│   ├── from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
│   └── from smartbi_compat.schema_compat import wrap_response, wrap_error
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
│   ├── # 5 missing Python helpers (D1 + D2 prefix):
│   ├── _drilldown_get_province_ranking(conn, factory_id, region, start, end)
│   ├── _drilldown_get_city_ranking(conn, factory_id, province, start, end)  # T2 dead but ported
│   ├── _drilldown_get_department_detail(conn, factory_id, dept, start, end)
│   ├── _drilldown_get_product_distribution_chart(conn, factory_id, start, end)
│   ├── _drilldown_get_salesperson_metrics(conn, factory_id, salesperson, start, end)
│   └── _drilldown_record_usage(conn, factory_id, user_id, ...)      # T7 SQL INSERT
├── Sub-service dispatchers (5)
│   ├── _process_region_drilldown(conn, factory_id, request, start, end)
│   ├── _process_department_drilldown(conn, factory_id, request, start, end)
│   ├── _process_product_drilldown(conn, factory_id, request, start, end)
│   ├── _process_time_drilldown(conn, factory_id, request, start, end)
│   └── _process_salesperson_drilldown(conn, factory_id, request, start, end)
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
_process_drilldown_tx(factory_id, request, user_id)
  ├─ # T5: default date range
  ├─ start_date = request.startDate or _default_date_range_this_month()[0]
  ├─ end_date = request.endDate or _default_date_range_this_month()[1]
  ├─ # T8: open transaction (read + write atomicity)
  ├─ async with engine.begin() as conn:  # via _to_thread shim
  │     ├─ # T3: case-insensitive dispatch
  │     ├─ dim_lower = request.dimension.lower()
  │     ├─ if dim_lower == "region":
  │     │     ├─ result = _process_region_drilldown(conn, ..., start, end)
  │     │     │     ├─ if filter_value is None/empty: → _get_region_ranking (sister-Python)
  │     │     │     ├─ elif level == 1: → _drilldown_get_province_ranking (D1+D2)
  │     │     │     └─ else (T2 dead): → _drilldown_get_city_ranking (D1+D2)
  │     ├─ elif dim_lower == "department": → _process_department_drilldown
  │     ├─ elif dim_lower == "product": → _process_product_drilldown
  │     ├─ elif dim_lower == "time": → _process_time_drilldown
  │     ├─ elif dim_lower == "salesperson": → _process_salesperson_drilldown
  │     ├─ else (incl "customer"): raise DrilldownBusinessException(400, ...)
  │     ├─ # T9: HashMap mutation order — drillPath, level, dimension
  │     ├─ result["drillPath"] = _compute_drill_path(request.parentContext, request.value)
  │     ├─ result["level"] = request.level                     # T2 passthrough
  │     ├─ result["dimension"] = request.dimension             # T3 ORIGINAL casing
  │     ├─ # T7: write side-effect
  │     └─ _drilldown_record_usage(conn, factory_id, user_id, action_type="DRILLDOWN", ...)
  └─ return result

# Response wrapping
wrap_response(result) → ApiResponse envelope (5 fields)

# Error path (DrilldownBusinessException → handler)
catch → wrap_error(code=400, message="不支持的下钻维度: <dim>")
       → ApiResponse.error envelope (5 fields, no hint/hintTarget per T10)
```

**Optimization NOTE**: Python uses 1 transaction with single connection across read dispatch + write. Java uses `@Transactional` propagation REQUIRED with the JpaRepository auto-managing connection. Both achieve same atomicity (rollback on exception) but Python's single-connection model is more explicit. Output byte-shape unaffected.

---

**Step 6 progress: §1 + §2 written. Continuing §3+ in next commits.**
