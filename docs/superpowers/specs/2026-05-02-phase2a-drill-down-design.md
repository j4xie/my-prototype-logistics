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
3. `_drilldown_*` prefix prevents future cross-import collision (lessons from procurement spec PR #40 I6 fix).

#### H1 — `_drilldown_get_province_ranking`

Java reference: `regionService.getProvinceRanking(factoryId, region, startDate, endDate)` (`RegionAnalysisService.java` interface; called from `SmartBIServiceImpl.java:1985-1986`).

Find line in impl:

```java
// In RegionAnalysisServiceImpl.java (line numbers TBD via grep — locate during impl)
public List<RankingItem> getProvinceRanking(String factoryId, String region,
                                              LocalDate startDate, LocalDate endDate) { ... }
```

**Sub-spec**: impl chat MUST grep `RegionAnalysisServiceImpl.java` for `public.*getProvinceRanking` and port the SQL aggregation + `RankingItem` build logic verbatim.

Python signature (D2 prefix, sync-conn-bound for T8 transaction):

```python
def _drilldown_get_province_ranking(
    conn,                    # SQLAlchemy connection (inside _process_drilldown_tx tx)
    factory_id: str,
    region: str,             # parent filter from DrillDownRequest.value
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Mirror RegionAnalysisServiceImpl.getProvinceRanking.

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
    ...
```

Implementation details (SQL shape, ranking iteration, alert computation) are sub-spec'd in PR-A plan — golden recording + sister `analysis_region.py:_build_region_ranking` provides the template.

#### H2 — `_drilldown_get_city_ranking` (T2 dead but ported)

Java reference: `regionService.getCityRanking(factoryId, province, startDate, endDate)` (called from `SmartBIServiceImpl.java:1990-1991`, behind `level > 1` branch).

Per T2 LOCK: `level` always 1 in API reality. This helper is **dead code in production** but ported for byte parity. Frontend never sends level=2 to drill-down. PR-A test still records F999 golden with `level=2` to lock parity.

```python
def _drilldown_get_city_ranking(
    conn,
    factory_id: str,
    province: str,           # parent filter from DrillDownRequest.value (province name from region L2)
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Mirror RegionAnalysisServiceImpl.getCityRanking.

    T2 NOTE: dead in API reality (frontend never level>1). Ported for byte parity.

    SQL: aggregate by city where province=:province.
    KEY-ORDER from RankingItem (same as H1): VERIFY from drill-down-F999-region-L3-dead.json golden.
    """
    ...
```

#### H3 — `_drilldown_get_department_detail`

Java reference: `deptService.getDepartmentDetail(factoryId, deptName, startDate, endDate)` (called from `SmartBIServiceImpl.java:2011-2012`).

Returns `DepartmentDetail` DTO (NOT a list — different shape from RankingItem).

```python
def _drilldown_get_department_detail(
    conn,
    factory_id: str,
    dept_name: str,          # from DrillDownRequest.value
    start_date: date,
    end_date: date,
) -> dict:
    """Mirror DepartmentAnalysisServiceImpl.getDepartmentDetail.

    Returns single DepartmentDetail dict, NOT list. Includes:
    - Department aggregate metrics (total_amount, total_target, completion_rate, alert_level)
    - Salesperson breakdown list (per-person rankings within dept)
    - Other DepartmentDetail Lombok @Data fields TBD via golden

    KEY-ORDER from DepartmentDetail: VERIFY from drill-down-F999-department-L2.json golden.
    """
    ...
```

#### H4 — `_drilldown_get_product_distribution_chart`

Java reference: `salesService.getProductDistributionChart(factoryId, startDate, endDate)` (called from `SmartBIServiceImpl.java:2028`).

Returns `ChartConfig` — same DTO as sister `_build_geographic_heatmap` in `analysis_region.py`. Per Rule 8 (and **upcoming Rule 9** sister-spec quirks identified by organizer):
- `chartType`/`title`/`data`/`options` Lombok @Data declaration order
- **`xaxisField` / `yaxisField` LOWERCASE** (Lombok-Jackson quirk; sister-spec discovery — NOT camelCase as field name suggests)
- **Empty case emits nulls for ChartConfig**, NOT skip (no `@JsonInclude(NON_NULL)` annotation; sister-spec discovery)
- `options` Map.of(N) sites: KEY-ORDER-FROM-GOLDEN per Rule 8

```python
def _drilldown_get_product_distribution_chart(
    conn,
    factory_id: str,
    start_date: date,
    end_date: date,
) -> dict:
    """Mirror SalesAnalysisServiceImpl.getProductDistributionChart.

    Returns ChartConfig (chart_type=PIE or BAR — verify via golden).
    Output dict keys per Rule 8 + Rule 9 (lowercase xaxis/yaxis, empty-emits-nulls).

    KEY-ORDER from ChartConfig: VERIFY from drill-down-F999-product.json golden.
    """
    ...
```

#### H5 — `_drilldown_get_salesperson_metrics`

Java reference: `salesService.getSalespersonMetrics(factoryId, salesperson, startDate, endDate)` (called from `SmartBIServiceImpl.java:2071-2072`).

Returns `MetricResult` — Lombok @Data class used in sister specs (e.g., `analysis_region.py` `_build_region_target_completion`).

```python
def _drilldown_get_salesperson_metrics(
    conn,
    factory_id: str,
    salesperson: str,        # from DrillDownRequest.value
    start_date: date,
    end_date: date,
) -> dict:
    """Mirror SalesAnalysisServiceImpl.getSalespersonMetrics.

    Returns single MetricResult dict (10 fields per Lombok @Data):
    metricCode, metricName, value, formattedValue, unit, changePercent,
    changeDirection, alertLevel, dimensionValue, description.

    metric_code likely "SALESPERSON_<name>" — verify via golden.
    KEY-ORDER from drill-down-F999-salesperson-L1.json (when filter_value present).
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

Python mirror (Rule 1 explicit None+empty checks; T9 HashMap insertion order via Python dict literal):

```python
def _process_region_drilldown(
    conn, factory_id: str, request, start_date: date, end_date: date
) -> dict:
    """Mirror processRegionDrillDown (service line 1975-1996).

    Branching matches Java exactly:
      filter_value None/empty             → L1 ranking + nextLevel=province
      level None or level <= 1            → L2 province + nextLevel=city
      else (T2 dead)                      → L3 city + nextLevel=null
    """
    filter_value = request.value
    level = request.level
    # KEY-ORDER from drill-down-F999-region-L*.json golden (Rule 8 — HashMap):
    # tentative source order [data, nextLevel] but VERIFY via golden.
    if filter_value is None or filter_value == "":
        return {
            "data": _get_region_ranking(conn, factory_id, start_date, end_date),
            "nextLevel": "province",
        }
    if level is None or level <= 1:
        return {
            "data": _drilldown_get_province_ranking(
                conn, factory_id, filter_value, start_date, end_date
            ),
            "nextLevel": "city",
        }
    # T2 dead branch — port for parity
    return {
        "data": _drilldown_get_city_ranking(
            conn, factory_id, filter_value, start_date, end_date
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

Python mirror:

```python
def _process_department_drilldown(
    conn, factory_id: str, request, start_date: date, end_date: date
) -> dict:
    """Mirror processDepartmentDrillDown (service line 2001-2017).

    L1 (no filter)  → ranking + nextLevel=salesperson
    L2 (filter set) → detail + nextLevel=null
    """
    filter_value = request.value
    if filter_value is None or filter_value == "":
        return {
            "data": _get_department_ranking(conn, factory_id, start_date, end_date),
            "nextLevel": "salesperson",
        }
    return {
        "data": _drilldown_get_department_detail(
            conn, factory_id, filter_value, start_date, end_date
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

Python mirror — single layer, no branching:

```python
def _process_product_drilldown(
    conn, factory_id: str, request, start_date: date, end_date: date
) -> dict:
    """Mirror processProductDrillDown (service line 2022-2032). Single-layer.

    Adds extra `chart` key not in other dim shapes (per-dim shape variance T6).
    KEY-ORDER from drill-down-F999-product.json golden (HashMap source: data, chart, nextLevel).
    """
    return {
        "data": _get_product_ranking(conn, factory_id, start_date, end_date),
        "chart": _drilldown_get_product_distribution_chart(
            conn, factory_id, start_date, end_date
        ),
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

Python mirror (T2 lock: level always 1 in production, but switch ports for parity; D8 dead branch verbatim):

```python
def _process_time_drilldown(
    conn, factory_id: str, request, start_date: date, end_date: date
) -> dict:
    """Mirror processTimeDrillDown (service line 2037-2059).

    Adds extra `period` key (per-dim shape variance T6).
    Period mapping: level=None→DAY (Java init default before switch),
                    level=1→MONTH, level=2→WEEK, level>=3→DAY (T2 dead default branch).

    Note: when level=None, Java switch is skipped, period stays "DAY" from line 2041 init.
    """
    level = request.level
    if level is None:
        period = "DAY"
    elif level == 1:
        period = "MONTH"
    elif level == 2:
        period = "WEEK"
    else:  # T2 dead default
        period = "DAY"
    return {
        "data": _get_sales_trend_chart(
            conn, factory_id, start_date, end_date, period
        ),
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
def _process_salesperson_drilldown(
    conn, factory_id: str, request, start_date: date, end_date: date
) -> dict:
    """Mirror processSalespersonDrillDown (service line 2064-2076).

    Note: NO `nextLevel` key in this shape (per Java line 2064-2076 — only `data`).
    Per-dim shape variance T6: salesperson dim shape differs from region/department.
    """
    filter_value = request.value
    if filter_value is None or filter_value == "":
        return {
            "data": _get_salesperson_ranking(conn, factory_id, start_date, end_date),
        }
    return {
        "data": _drilldown_get_salesperson_metrics(
            conn, factory_id, filter_value, start_date, end_date
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
    user_id: Optional[int] = None,       # from JWT payload userId; Java passes null at line 1066
    action_type: str = "DRILLDOWN",      # Java ActionType.DRILLDOWN.name()
    query_text: Optional[str] = None,    # Java passes null at line 1066
    token_count: int = 0,                # Java passes 0 at line 1066
    cost_amount: Decimal = Decimal("0"),
    cache_hit: bool = False,             # Java passes false at line 1066
    response_time_ms: Optional[int] = None,
    success: bool = True,                # Java recordUsage default
) -> None:
    """Mirror SmartBIServiceImpl.recordUsage (called at service line 1066).

    Java call signature at line 1066: recordUsage(factoryId, null, "DRILLDOWN", 0, false).
    Default args here match that call site exactly.

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

Python wrapper — D3+D4 (mixed read-write transaction via SQLAlchemy `engine.begin()` + `_to_thread` shim):

```python
async def _process_drilldown_tx(
    factory_id: str,
    request,                  # DrillDownRequestModel (Pydantic)
    user_id: Optional[int],   # from JWT payload (passed but unused per Java behavior)
) -> dict:
    """Mirror SmartBIServiceImpl.processDrillDown @Transactional (line 1018-1069).

    D4: REQUIRED propagation, READ_COMMITTED isolation (asyncpg defaults match Java).
    Read dispatch + write recordUsage in one transaction.
    BusinessException raised BEFORE recordUsage call → tx rolled back, no usage row written.

    T8: engine.begin() context — autocommit on success, rollback on exception.
        NOT engine.connect() — that's read-only mode.

    Python 3.8 compat: wrapped in _to_thread shim (sync SQLAlchemy → async via executor).
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.begin() as conn:    # D4: tx scope
            # T5: default date range
            start_date = request.startDate
            end_date = request.endDate
            if start_date is None or end_date is None:
                start_date, end_date = _default_date_range_this_month()

            # T3: case-insensitive dispatch
            dim_lower = request.dimension.lower()
            if dim_lower == "region":
                result = _process_region_drilldown(conn, factory_id, request, start_date, end_date)
            elif dim_lower == "department":
                result = _process_department_drilldown(conn, factory_id, request, start_date, end_date)
            elif dim_lower == "product":
                result = _process_product_drilldown(conn, factory_id, request, start_date, end_date)
            elif dim_lower == "time":
                result = _process_time_drilldown(conn, factory_id, request, start_date, end_date)
            elif dim_lower == "salesperson":
                result = _process_salesperson_drilldown(conn, factory_id, request, start_date, end_date)
            else:
                # T10: BusinessException equivalent (caught by handler → ApiResponse.error)
                raise DrilldownBusinessException(
                    code=400,
                    message=f"不支持的下钻维度: {request.dimension}",
                )

            # T9: HashMap mutation order — drillPath, level, dimension
            # Python dict insertion order ≡ Java LinkedHashMap insertion order.
            # But Java line 1024 used `new HashMap<>()` not LinkedHashMap → Java emits
            # in HashMap hash-bucket order, NOT source order. Per Rule 8, the actual
            # output key order MUST be derived from F999 goldens. The Python additions
            # below APPEND to the per-dim result dict; their position in JSON output
            # is determined by Jackson serializing Java HashMap's hash buckets.
            #
            # → Spec §4.2 mandates impl chat to inspect each F999 golden and reorder
            #   per-dim result dict + these top-level keys to match.
            result["drillPath"] = _compute_drill_path(
                request.parentContext, request.value
            )
            result["level"] = request.level                       # T2 passthrough
            result["dimension"] = request.dimension               # T3: ORIGINAL casing

            # T7: write side-effect — INSIDE the same tx
            _drilldown_record_usage(
                conn=conn,
                factory_id=factory_id,
                user_id=None,            # Java passes null at line 1066 (D7)
                action_type="DRILLDOWN",
                query_text=None,
                token_count=0,
                cost_amount=Decimal("0"),
                cache_hit=False,
                success=True,
            )
        # tx auto-commits on context exit (or rollbacks on exception)

        return result

    return await _to_thread(_exec)
```

**SQLAlchemy sync vs asyncpg native — design decision**:
- **Choice**: Sync SQLAlchemy + `_to_thread` shim
- **Rationale**: Matches sister `analysis_region.py` / `analysis_sales.py` patterns (Phase 2A consistency). asyncpg native would add a parallel client + connection pool management overhead.
- **Rejected alternative**: asyncpg native (`async with pool.acquire() as conn`).
- **Rejected because**: Phase 2A standardized on sync SQLAlchemy + `_to_thread`. Diverging here adds maintenance surface area.

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

Python mirror:

```python
class DrilldownBusinessException(Exception):
    """Internal exception → caught at route handler → wrapped to ApiResponse.error envelope.

    Mirrors Java BusinessException(code, message) — but withHint/withHintTarget
    are NOT exposed to client per T10 (controller catch flattens to message-only).
    Python omits these setters entirely.
    """
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def _wrap_drilldown_error(message: str, code: int = 400) -> dict:
    """Mirror ApiResponse.error envelope — 5 fields, no hint/hintTarget.

    Mirrors controller catch behavior: prepends "Drill-down failed: " to the
    underlying exception message, matching Java line 584.
    """
    return {
        "code": code,
        "message": f"Drill-down failed: {message}",
        "data": None,
        "timestamp": _utc_now_iso(),    # sister-shared helper from analysis_finance.py
        "success": False,
    }
```

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
        result = await _process_drilldown_tx(
            factory_id=auth.factory_id,
            request=request,
            user_id=auth.user_id,
        )
        return wrap_response(result)        # sister-shared helper, ApiResponse success envelope
    except DrilldownBusinessException as e:
        # T10: visible body matches ApiResponse.error (5 fields, no hint/hintTarget)
        return _wrap_drilldown_error(message=e.message, code=e.code)
```

**HTTP status decision**: returning 200 even for business errors matches Java controller behavior. If sister-spec convention (or Python wrap_response handler) requires 4xx for `success: false`, adjust during impl. **Verify**: how do sister Python endpoints (region/department/sales) handle BusinessException? Does FastAPI default exception handler return 500 for unexpected exceptions, breaking the Java parity? Spec §5 test plan must lock this.

### 3.10 Pydantic request model

```python
from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import date

class DrillDownRequestModel(BaseModel):
    """Mirror controller-level DrillDownRequestDTO (NOT service-level DrillDownRequest).

    Field name mapping (controller DTO → service DTO at SmartBIAnalysisController.java:541-550):
      value         → filterValue
      filters       → additionalFilters
      Other fields pass through unchanged.

    Python receives controller-level field names from JSON body, internally uses
    same names for clarity. Service-level mapping happens implicitly inside
    _process_*_drilldown helpers via .value / .filters property access.
    """
    dimension: str = Field(..., min_length=1, description="下钻维度")
    value: Optional[str] = None              # controller field; equiv to filter_value
    parentContext: Optional[str] = None       # service-level field — sometimes set by callers
    parentDimension: Optional[str] = None
    parentValue: Optional[str] = None
    filters: dict = Field(default_factory=dict)
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    level: Optional[int] = None              # @Builder.Default 1 in service DTO; controller may pass None
    # Out-of-scope fields ACCEPTED (for compat) but IGNORED by dispatch:
    sortBy: Optional[str] = None
    sortDirection: Optional[str] = None
    limit: Optional[int] = None
    includeChildren: Optional[bool] = None
    parentValue2: Optional[str] = None       # potential future field
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

JWT_SECRET="<test>" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-region-L3-dead.json \
    --method POST --data-json '{"dimension":"region","value":"上海","level":2,"startDate":"2024-01-01","endDate":"2024-12-31"}'

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


# 9 golden compare tests — example for region L1
@pytest.mark.parametrize("golden_name,request_body", [
    ("drill-down-F999-region-L1", {"dimension": "region", "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-region-L2", {"dimension": "region", "value": "华东", "level": 1,
                                     "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-region-L3-dead", {"dimension": "region", "value": "上海", "level": 2,
                                         "startDate": "2024-01-01", "endDate": "2024-12-31"}),
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
    """T10 error envelope shape: 5 fields, no hint/hintTarget."""
    resp = client.post(
        "/api/mobile/F999/smart-bi/drill-down",
        json={"dimension": "invalid", "startDate": "2024-01-01", "endDate": "2024-12-31"},
        headers={"Authorization": f"Bearer {_make_token('F999')}"},
    )
    # HTTP 200 (Java controller returns ResponseEntity.ok even on error)
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert body["code"] == 400
    assert "不支持的下钻维度" in body["message"]
    assert body["data"] is None
    # T10: NO hint/hintTarget keys
    assert "hint" not in body
    assert "hintTarget" not in body

    with io.open(GOLDEN_DIR / "drill-down-F999-error-unknown-dim.json", encoding="utf-8") as f:
        golden = json.load(f)
        golden_body = _strip_volatile(golden.get("data", golden) if isinstance(golden, dict) else golden)
    assert _strip_volatile(body) == golden_body
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
    """9 golden tests parameterized — each dim × layer state."""
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
    """Mock 5 sister + 5 owned helpers + recordUsage for unit + contract tests."""
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
- Drill-down does NOT emit DateRange in response (composite endpoints do; drill-down response has no top-level dateRange field)

---




