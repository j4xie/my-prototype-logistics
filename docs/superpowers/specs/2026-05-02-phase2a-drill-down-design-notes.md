# Phase 2A `/drill-down` Tier 3 — Step 5 Design Notes (bake-then-write)

**作者**: Chat 3 (`phase2a/spec-drill-down`)
**日期**: 2026-05-02
**状态**: Pre-spec design scratchpad. NOT the spec itself. Step 5 of the bake-then-write workflow — bakes round-1 brainstorm output (12 traps) + 8 organizer decisions into a structured outline before writing the formal spec doc (step 6).
**Endpoint scope**: `POST /api/mobile/{factoryId}/smart-bi/drill-down` — single endpoint, composite path, 5 dimension dispatch.
**Java reference root**: `SmartBIServiceImpl.processDrillDown` (line 1018-1069) + 5 dimension processors (line 1975-2076).

---

## 1. Trap inventory — T1-T12 line-locked

All line numbers verified Apr 30 / May 2 2026 against `SmartBIServiceImpl.java` rev `c440c7a7e` and `DrillDownRequest.java` same rev.

### 1.1 Composition + behavior traps (T1-T8)

| Trap | Line lock | Description | Spec section |
|---|---|---|---|
| **T1** | dispatch line 1035-1059 | 5 dimension processors (region/department/product/time/salesperson) — 5 missing helpers vs sister Python files (province / city / dept-detail / product-distribution-chart / salesperson-metrics). Owned by drill-down spec, not backfilled. | §3 (helper design) |
| **T2** | line 1062 `result.put("level", request.getLevel())` + line 1042 region `level <= 1` + line 1988 region `level > 1` (dead-only) | `level` always 1 in API reality (frontend never sends level>1, controller has no validation default). All level>1 branches port verbatim for byte parity, flag as "known dead code". | §3, §7 |
| **T3** | line 1035 `request.getDimension().toLowerCase()` | Dimension name case-insensitive on dispatch. Python must `dimension.lower()` before switch; preserve original casing in response `result.put("dimension", request.getDimension())` line 1063 (NOT lowercased). | §3 |
| **T4** | `DrillDownRequest.java:295-302` `getDrillPath()` | drillPath derived: parentContext null/empty → filterValue (or "全部" if filterValue null) ; filterValue null/empty → parentContext ; else `parentContext + " > " + filterValue`. NOT a stored field. Result.put line 1061. | §3, §6 |
| **T5** | line 1029-1033 `if (startDate==null \|\| endDate==null) DateRange.thisMonth()` | Default range `thisMonth()` when EITHER startDate or endDate null. Python equivalent: `date.today().replace(day=1)` start, `date.today()` end (verify `DateRange.thisMonth()` Java impl at `DateRange.java`). Mirror semantics, not just first-day-of-month. | §3 |
| **T6** | dispatch produces 5 distinct shapes (per dimension processor); each layer of region/department/salesperson has different shape; product/time single-shape | Per-dimension output shape variance — empty data still yields different keys per dim. **9 goldens needed** (5 dims × layer states + dead-level cases). See §6.1. | §4 (byte-shape gate), §6 |
| **T7** | line 1066 `recordUsage(factoryId, null, ActionType.DRILLDOWN.name(), 0, false)` | Side-effect write to `smart_bi_usage_records` (note PLURAL — corrected from directive's singular). Args: `factoryId, queryText=null, actionType="DRILLDOWN", tokenCount=0, cacheHit=false`. **First Python endpoint to write `smart_bi_usage_records`** — needs new SQL helper `_drilldown_record_usage`. | §3, §5 |
| **T8** | line 1019 `@Transactional // 移除 readOnly=true，因为 recordUsage() 需要写入数据库` | Mixed read+write transaction. Python equivalent: `async with engine.begin() as conn:` (asyncpg/SQLAlchemy auto-commit on context exit, rollback on exception). NOT `engine.connect()` — that's read-only. **First Python endpoint mixing read+write @Transactional in Phase 2A**. | §3, §5, §7 |

### 1.2 Byte parity + error shape traps (T9-T10)

| Trap | Line lock | Description | Spec section |
|---|---|---|---|
| **T9** | line 1024 `new HashMap<>()` + line 1061-1063 mutation order (drillPath, level, dimension) + per-dim processors line 1977 / 2003 / 2024 / 2039 / 2066 each `new HashMap<>()` | HashMap key order. Top-level (after switch) inserts: `data, nextLevel, [chart \| period], drillPath, level, dimension`. Java HashMap hash-bucket order ≠ Python dict insertion order. **Rule 8 KEY-ORDER-FROM-GOLDEN** for all 5 dim shapes + top-level mutation. | §4 |
| **T10** | line 1057-1058 `BusinessException(400, "不支持的下钻维度: "+dim).withHint("请选择支持的下钻维度").withHintTarget("dimension")` | First Python endpoint returning BusinessException with hint+hintTarget body shape. Need to verify exact Jackson serialization — likely `{success:false, code:400, message, hint, hintTarget}` envelope but Java `BusinessException` may flatten differently. Record golden for unknown dimension to lock body shape. | §4, §5 |

### 1.3 RLS + cross-table traps (T11-T12)

| Trap | Line lock | Description | Spec section |
|---|---|---|---|
| **T11** | `SmartBiSalesData.java` (no `@Filter`/`@TenantId`/`@RowLevelSecurity` anywhere) + `SmartBiDepartmentData.java` same. Migration scan: zero `ROW LEVEL SECURITY` / `CREATE POLICY` in `db/migration/V*.sql`. | **No PG-level RLS on smart_bi_sales_data / smart_bi_department_data**. Application-layer factory_id WHERE clause is the ONLY tenant isolation. Aligns with Apr 28 P0 RLS gap finding (sister tables). Spec must mandate explicit `factory_id = $1` in every read SQL — and assume nothing about PG enforcement. | §7 (risks) |
| **T12** | `V2026_01_18_01__smart_bi_tables.sql:56-74` table `smart_bi_usage_records` (PLURAL!) — `factory_id VARCHAR(50) NOT NULL` (line 58), `idx_factory_date` index (line 71). No RLS policy. | **No PG-level RLS on smart_bi_usage_records**. Application-layer enforcement only. recordUsage write SQL must include `factory_id` value explicitly. **Table is PLURAL `smart_bi_usage_records`** — directive said singular `smart_bi_usage_record`, that's wrong; spec must say plural. | §3, §7 |

---

## 2. 8 organizer decisions baked

All 8 decisions confirmed from organizer Q1+Q2+Q3 directive. Spec § markers indicate where each lands.

| # | Decision | Spec section | Rationale |
|---|---|---|---|
| **D1** | **Option A ownership**: 5 missing helpers owned by drill-down spec, NOT backfilled into sister specs | §1, §3 | Mirror Java structure (composition layer owns dispatch helpers); avoids reopening shipped specs (region #41 / department #36 / sales 5/5); cleanest ownership |
| **D2** | **`_drilldown_*` namespace prefix** | §3 (all helper names) | Namespace isolation prevents future cross-import bugs (lessons from procurement spec PR #40 I6 naming-conflict fix). Helpers: `_drilldown_get_province_ranking`, `_drilldown_get_city_ranking`, `_drilldown_get_department_detail`, `_drilldown_get_product_distribution_chart`, `_drilldown_get_salesperson_metrics` |
| **D3** | **T7 SQL write helper**: new `_drilldown_record_usage(factory_id, action_type, ...)` for writing `smart_bi_usage_records` table | §3, §5 | First Python endpoint with side-effect write to this table. Helper sql: `INSERT INTO smart_bi_usage_records (factory_id, user_id, action_type, query_text, token_count, cost_amount, cache_hit, response_time_ms, success, created_at) VALUES (...)` — match column set from V2026_01_18_01 line 56-74 |
| **D4** | **T8 asyncpg @asynccontextmanager transaction**: wrap dispatch + write in `async with engine.begin() as conn` | §3, §7 | Mirror Java `@Transactional` (default propagation REQUIRED, default isolation READ_COMMITTED). asyncpg `engine.begin()` provides equivalent semantics; rollback on exception. Conservative defaults — no SERIALIZABLE / READ_UNCOMMITTED tuning |
| **D5** | **T10 BusinessException body shape**: lock via golden recording. Tentative shape `{success: false, code: 400, message, hint, hintTarget}` — verify via golden recording for unknown dimension | §4, §5 | First Python endpoint returning `hint`+`hintTarget`. Body shape exact serialization is Jackson-determined; can't infer without golden. Record one F999 unknown-dim error before finalizing wrap helper |
| **D6** | **T6 9 goldens**: 5 dimensions × layer states matrix | §4, §6 | Per §6.1 below — 5 success cases + 1 error + 3 layer/dead cases = 9 goldens |
| **D7** | **T8 conservative tx defaults**: REQUIRED propagation, READ_COMMITTED isolation, no nested savepoints | §7 (risks) | asyncpg defaults match. Phase 2A doesn't need finer tuning. Document deviation as "Phase 3+ cleanup if needed" |
| **D8** | **T2 dead level>1 verbatim port**: port region L3 (line 1988-1992) and time period mapping (line 2042-2052 level→DAY/MONTH/WEEK) verbatim despite frontend never sending level>1 | §3 | Byte parity requirement — Java path may flag the field even if frontend omits. Tests must include level=2 / level=3 cases for parity even though they're effectively dead |

---

## 3. 5 missing helpers — ownership locked

All 5 are owned by `analysis_drilldown.py`. NOT backfilled into sister files. `_drilldown_*` prefix mandatory.

| # | Java method | Java signature | Python helper (D2 prefix) | Sister sister-Python file (where it could live but won't) |
|---|---|---|---|---|
| H1 | `regionService.getProvinceRanking(factoryId, region, startDate, endDate)` | `(String, String, LocalDate, LocalDate) → List<RegionRanking>` | `_drilldown_get_province_ranking` | `analysis_region.py` (region PR-A pending; we don't backfill there) |
| H2 | `regionService.getCityRanking(factoryId, province, startDate, endDate)` | same shape, returns city items | `_drilldown_get_city_ranking` | `analysis_region.py` (T2: dead in API reality, level always 1) |
| H3 | `deptService.getDepartmentDetail(factoryId, deptName, startDate, endDate)` | `(String, String, LocalDate, LocalDate) → DepartmentDetail` | `_drilldown_get_department_detail` | `analysis_department.py` (composite #36 doesn't expose) |
| H4 | `salesService.getProductDistributionChart(factoryId, startDate, endDate)` | `(String, LocalDate, LocalDate) → ChartConfig` | `_drilldown_get_product_distribution_chart` | `analysis_sales.py` 5/5 (PRs #14/#15/#20 don't expose) |
| H5 | `salesService.getSalespersonMetrics(factoryId, salesperson, startDate, endDate)` | `(String, String, LocalDate, LocalDate) → MetricResult` | `_drilldown_get_salesperson_metrics` | `analysis_sales.py` 5/5 (don't expose) |

**Existing sister-Python helpers reused (NOT redefined)**:

| Sister helper | Source Python module | Java method |
|---|---|---|
| `_get_region_ranking` (or analog) | `analysis_region.py` (PR-A pending — drill-down depends on this PR-A landing first) | `regionService.getRegionRanking` (line 1981) |
| `_get_department_ranking` (analog) | `analysis_department.py` composite (#36) | `deptService.getDepartmentRanking` (line 2007) |
| `_get_product_ranking` (analog) | `analysis_sales.py` 5/5 | `salesService.getProductRanking` (line 2027) |
| `_get_sales_trend_chart` (analog) | `analysis_sales.py` 5/5 | `salesService.getSalesTrendChart(... period)` (line 2055) |
| `_get_salesperson_ranking` (analog) | `analysis_sales.py` 5/5 | `salesService.getSalespersonRanking` (line 2069) |

Implementation discipline: drill-down dispatch calls existing helpers via cross-module import, calls own `_drilldown_*` helpers for the 5 missing ones. Single-direction dependency — sister modules don't import from `analysis_drilldown.py`.

---

## 4. T7+T8 transaction + write helper Python design

### 4.1 SQL write helper (T7)

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


async def _drilldown_record_usage(
    conn,                    # SQLAlchemy connection (NOT engine — must be inside outer tx)
    factory_id: str,
    user_id: int | None,
    action_type: str = "DRILLDOWN",
    query_text: str | None = None,
    token_count: int = 0,
    cost_amount: Decimal = Decimal("0"),
    cache_hit: bool = False,
    response_time_ms: int | None = None,
    success: bool = True,
) -> None:
    """Mirror SmartBIServiceImpl.recordUsage(factoryId, queryText, actionType, tokenCount, cacheHit).

    Java line 1066: recordUsage(factoryId, null, "DRILLDOWN", 0, false).
    Default args mirror that call site exactly.

    NOT a top-level transaction — caller is responsible for wrapping in
    engine.begin() context. This helper just executes the INSERT.
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

### 4.2 Transaction wrapper (T8)

```python
async def _process_drilldown_tx(
    factory_id: str,
    request: dict,             # Pydantic-validated DrillDownRequest
    user_id: int | None,
) -> dict:
    """Mirror SmartBIServiceImpl.processDrillDown @Transactional semantics.

    REQUIRED propagation, READ_COMMITTED isolation (asyncpg defaults).
    Read dispatch + write recordUsage in one transaction; rollback on
    BusinessException (Python: HTTPException) — though business-validation
    errors typically thrown BEFORE recordUsage call, so rollback path is
    defensive only.
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.begin() as conn:    # autocommit on success, rollback on exception
            # Default startDate/endDate (T5)
            start_date = request["startDate"] or _date_range_this_month_start()
            end_date = request["endDate"] or date.today()

            dimension_lower = request["dimension"].lower()
            # Dispatch (T3)
            if dimension_lower == "region":
                result = _process_region_drilldown(conn, factory_id, request, start_date, end_date)
            elif dimension_lower == "department":
                result = _process_department_drilldown(conn, factory_id, request, start_date, end_date)
            elif dimension_lower == "product":
                result = _process_product_drilldown(conn, factory_id, request, start_date, end_date)
            elif dimension_lower == "time":
                result = _process_time_drilldown(conn, factory_id, request, start_date, end_date)
            elif dimension_lower == "salesperson":
                result = _process_salesperson_drilldown(conn, factory_id, request, start_date, end_date)
            else:
                # T10: raise BusinessException equivalent (HTTPException with body shape)
                raise _drilldown_business_exception(
                    code=400,
                    message=f"不支持的下钻维度: {request['dimension']}",
                    hint="请选择支持的下钻维度",
                    hint_target="dimension",
                )

            # T9: HashMap mutation order — drillPath, level, dimension
            result["drillPath"] = _compute_drill_path(
                request.get("parentContext"), request.get("filterValue")
            )
            result["level"] = request.get("level")     # T2: passthrough
            result["dimension"] = request["dimension"]  # T3: original casing

            # T7: write side-effect — INSIDE the same transaction
            _sync_record_usage(conn, factory_id, user_id)

        return result

    return await _to_thread(_exec)
```

**Open design Q (resolve in step 6)**: SQLAlchemy `engine.begin()` is sync; Python service uses `_to_thread` shim to run sync SQLAlchemy ops in an executor. asyncpg native is also viable but adds parallel client. **Decision lean: stick with sync SQLAlchemy + `_to_thread`** — matches sister `analysis_region.py` / `analysis_sales.py` pattern (D-consistent across Phase 2A).

### 4.3 BusinessException equivalent (T10)

```python
def _drilldown_business_exception(
    code: int, message: str, hint: str | None = None, hint_target: str | None = None,
) -> HTTPException:
    """Mirror Java BusinessException(code, msg).withHint().withHintTarget().

    BODY-SHAPE-FROM-GOLDEN: spec mandates recording an unknown-dimension F999
    error response BEFORE finalizing exact JSON shape. Tentative shape:
      { "success": false, "code": 400, "message": "...", "hint": "...", "hintTarget": "..." }
    """
    body = {"success": False, "code": code, "message": message}
    if hint is not None:
        body["hint"] = hint
    if hint_target is not None:
        body["hintTarget"] = hint_target
    return HTTPException(status_code=code, detail=body)
```

Phase 2A's existing `wrap_response` produces success envelope `{success, data, message}`. For errors, FastAPI's `HTTPException` produces `{detail}` body — so we may need a custom exception handler to flatten `detail` and emit Java-shaped body. Spec §5 will resolve.

---

## 5. T10 BusinessException body shape — golden record needed

**HARD prereq before finalizing spec §5**: record `F999` unknown-dimension error to lock body shape:

```bash
JWT_SECRET=... ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-error-unknown-dim.json
# Body: {"dimension": "invalid", "filterValue": null, "level": 1, "startDate": null, "endDate": null}
```

POST recording note: `record-java-golden.sh` currently does GET only (per script line 61 `curl -sS --fail -H ... URL`). Spec §5 must include either:
- (a) extending `record-java-golden.sh` to support POST + JSON body
- (b) ad-hoc POST recording for drill-down only

Decision lean: (a) — extend the script (one-line `--data-binary` + method flag). Improves all future POST endpoint records.

Body-shape candidates:
1. Standard envelope: `{success: false, code: 400, message: "...", hint: "...", hintTarget: "..."}`
2. Spring default: `{timestamp, status, error, message, path}` — unlikely since project has GlobalExceptionHandler
3. Custom: `{success: false, error: {code, message, hint, hintTarget}}` — possibly nested

Goldens resolve. Spec §5 contains a placeholder until step 6 records.

---

## 6. T6 — 9 goldens enumeration

5 dimensions × layer states + dead cases + error case.

| # | Filename | Request | Coverage |
|---|---|---|---|
| 1 | `drill-down-F999-region-L1.json` | `{dimension:"region", filterValue:null, level:1}` | Region L1 (大区) — calls `getRegionRanking` |
| 2 | `drill-down-F999-region-L2.json` | `{dimension:"region", filterValue:"华东", level:1}` | Region L2 (省份) — calls `getProvinceRanking` (H1) |
| 3 | `drill-down-F999-region-L3-dead.json` | `{dimension:"region", filterValue:"上海", level:2}` | Region L3 dead per T2 — calls `getCityRanking` (H2) |
| 4 | `drill-down-F999-department-L1.json` | `{dimension:"department", filterValue:null, level:1}` | Dept L1 — `getDepartmentRanking` |
| 5 | `drill-down-F999-department-L2.json` | `{dimension:"department", filterValue:"销售部", level:1}` | Dept L2 — `getDepartmentDetail` (H3) |
| 6 | `drill-down-F999-product.json` | `{dimension:"product", filterValue:null, level:1}` | Product (single layer) — `getProductRanking` + `getProductDistributionChart` (H4) |
| 7 | `drill-down-F999-time-L1.json` | `{dimension:"time", filterValue:null, level:1}` | Time L1 (period=MONTH) — `getSalesTrendChart` |
| 8 | `drill-down-F999-salesperson-L1.json` | `{dimension:"salesperson", filterValue:null, level:1}` | Salesperson L1 — `getSalespersonRanking` |
| 9 | `drill-down-F999-error-unknown-dim.json` | `{dimension:"invalid", filterValue:null, level:1}` | T10 error body shape gate |

**Optional 10th** if F001 produces non-empty data: re-record on prod for sanity smoke (skipped if test env enough).

**Open Q for spec §6**: dimension casing tests — `dimension:"REGION"` (uppercase) should produce same shape as `dimension:"region"` per T3. Add 10th golden? Or unit test only (since T3 is pure dispatch logic — golden cost may not be worth)? Decision lean: unit test only.

---

## 7. T11+T12 RLS finding — PG-layer assumptions

### 7.1 Finding

Zero PG RLS / policy on `smart_bi_sales_data`, `smart_bi_department_data`, `smart_bi_usage_records`. Verified by:
1. `find db/migration -name "V*.sql" | xargs grep -ilE "ENABLE ROW LEVEL|CREATE POLICY"` → no matches (only false positives on substring "url"/"rls" in unrelated comments).
2. Entity files `SmartBiSalesData.java` / `SmartBiDepartmentData.java` have no `@Filter` / `@TenantId` / `@RowLevelSecurity` annotations.
3. `smart_bi_usage_records` migration has `factory_id NOT NULL` + index but no policy.

### 7.2 Implications for spec

- **Mandate explicit `factory_id = $1` WHERE clause in every read SQL** — cannot rely on PG enforcement.
- **Mandate explicit `factory_id` value in INSERT** — cannot rely on default.
- **Cross-tenant test cases**: 4-corner RBAC tests (factory_super_admin own factory / factory_admin own / cross-factory request → 403).
- **Aligns with**: Apr 28 P0 RLS gap finding (sister tables `smart_bi_pg_excel_uploads`, `smart_bi_analysis_results`, `smart_bi_llm_fallback_log` had same gap; fixed in `V20260502_03` and `_04`). Drill-down spec should NOT add new RLS migrations — separate concern, Phase 3+.
- **Risk note**: if Java JPA layer somehow has `@Where` clause adding `factory_id` filter automatically, Python must replicate. Verify by grep `@Where` on entities.

### 7.3 Quick re-verify for risks section

```bash
grep -nE "@Where|@FilterDef" backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiSalesData.java backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiDepartmentData.java
```

(Will run this in step 6 spec write.)

---

## 8. Spec doc structural outline (step 6 writes this)

`docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md` — target ~2500-3000 LOC.

### §1. 背景 + 范围锁定 (~150 LOC)

- §1.1 Endpoint contract — `POST /api/mobile/{factoryId}/smart-bi/drill-down` body: `{dimension, filterValue, level, parentContext, startDate, endDate, additionalFilters}`
- §1.2 Java reference — controller path (TBD via grep), `SmartBIServiceImpl.processDrillDown:1018-1069`
- §1.3 Composite-only? NO — drill-down has its own controller path, not composite. But ports verbatim from `processDrillDown` Java method
- §1.4 In scope: 5 missing helpers (D1) + transaction (T7+T8) + 9 goldens
- §1.5 Out of scope:
  - PG RLS migrations (T11/T12 — separate Phase 3+ concern)
  - level>1 frontend support (T2 — dead, port for parity only)
  - Locale-dependent string formatting (already-known caveat from sister specs)
- §1.6 Side effects: 1 row INSERT to `smart_bi_usage_records` per request (T7)
- §1.7 Cross-spec lineage (D1 cite) + AI orchestration cite (Phase 2B-β `handleDrillDownIntent` line 1731-1741 calls `processDrillDown`)

### §2. 架构 + 文件 delta (~100 LOC)

- §2.1 New files:
  - `backend/python/smartbi_compat/api/analysis_drilldown.py` (~1500-1800 LOC PR-A impl)
  - `tests/python/smartbi_compat/test_analysis_drilldown_contract.py` (~500-800 LOC PR-A)
  - `tests/python/smartbi_compat/test_analysis_drilldown_arithmetic.py` (~600-900 LOC PR-B)
  - 9× `tests/fixtures/java-smartbi-golden/drill-down-F999-*.json`
- §2.2 Modified files: `backend/python/main.py` (+2 lines: import + include_router)
- §2.3 Module internal structure (helpers list + dispatcher + route handler outline)
- §2.4 Data flow diagram (HTTP → JWT auth → Pydantic validate → tx → dispatch → recordUsage → wrap_response)

### §3. Java 引用 + 算法对照 (~700 LOC)

- §3.1 总览 5 dim processors + main dispatch
- §3.2 `_compute_drill_path` (T4) — DrillDownRequest:295-302 mirror
- §3.3 `_default_date_range` (T5) — `DateRange.thisMonth()` mirror
- §3.4 5 missing helpers H1-H5 each gets a sub-section with Java line refs + Python pseudo-code
- §3.5 5 dim processors `_process_*_drilldown(conn, ...)` — each takes `conn` parameter for tx-bound exec
- §3.6 `_drilldown_record_usage` SQL helper (T7)
- §3.7 `_process_drilldown_tx` main wrapper (T8)
- §3.8 `_drilldown_business_exception` + custom exception handler (T10)
- §3.9 Route handler with Pydantic request model

### §4. F999 byte-shape gate (~200 LOC)

- §4.1 9 goldens recording (must extend record-java-golden.sh for POST first)
- §4.2 Gate semantics — dict-eq, strip volatile (none here since drill-down has no `generatedAt`? verify)
- §4.3 Test harness pattern mirror sister contract tests
- §4.4 Per-dim shape verification

### §5. 测试策略 (~250 LOC)

- §5.1 PR-A: contract tests (route + JWT + 9 dim cases + tx behavior + error shape)
- §5.2 PR-B: arithmetic depth tests (T1-T10 unit tests, e.g., drillPath edge cases for T4, dimension casing for T3, level>1 dead branch parity for T2)
- §5.3 Mock pattern (mock 5 sister Python helpers + new 5 helpers + recordUsage)
- §5.4 Smoke compare F001 manual (skipped in CI)
- §5.5 Cross-tenant 4-corner tests (T11+T12 enforcement gate)

### §6. Byte gate semantics (~100 LOC)

- §6.1 dict-eq vs strict-byte (Phase 2A standard)
- §6.2 `_decimal_to_number` Rule 4 reuse
- §6.3 Map.of(N) sites — what hash orders to verify (per dim processor's HashMap, top-level result HashMap)

### §7. PR 切片 + 顺序 (~100 LOC)

- §7.1 Spec PR — this doc
- §7.2 PR-A foundation + contract tests
  - **HARD prereq**: region PR-A ship + extend record-java-golden.sh for POST + 9 goldens recorded
- §7.3 PR-B arithmetic tests
- §7.4 Subsequent: none (this is last Tier 3 endpoint per scope)

### §8. Open risks + mitigations (~250 LOC)

- §8.1 Lock-in (T1, T3, T4, T5, T7, T8)
- §8.2 Verify-via-golden (T2 dead branch parity, T6 per-dim shape, T9 HashMap order, T10 BusinessException body shape, T11/T12 cross-tenant)
- §8.3 Already-known caveats (Locale-dependent strings inherited from sisters)
- §8.4 Spec-level open questions:
  1. POST golden recording method (extend script vs ad-hoc)
  2. SQLAlchemy sync engine.begin() vs asyncpg native pool
  3. T10 error envelope flattening (FastAPI HTTPException default vs custom handler)
  4. Phase 2B-β `handleDrillDownIntent` parity — separate scope or this spec?
- §8.5 Risk mitigation total strategy (HARD prereq list)

### §9. References (~150 LOC)

- §9.1 Cross-spec lineage:
  - **Tier 2 sisters** (department #36, region #41, procurement #40, inventory #47) — share composite-only / RLS-app-layer / Rule 8 patterns
  - **Wave 1 finance sisters** (cost #25, profit #21+22, payable #18, receivable #33+42, budget #34+38) — share Decimal serialization / Rule 1 / Rule 4
  - **query-templates spec #48** — share RLS + cross-factory + side-effects pattern (also write side-effect)
  - **Phase 2B-β #24** — `handleDrillDownIntent` line 1731-1741 AI orchestration cite
- §9.2 Rules cite (`.claude/rules/python-java-port.md` Rule 1-8)
- §9.3 Code refs table
- §9.4 Tier 3 lineage statement

### §10. Cross-spec audit citations (cycle 3)

Required citations for cross-spec audit:
1. department spec #36 — composite-only pattern
2. region spec #41 — Map.of(N) hash order discipline + Lombok @Data declaration order
3. procurement spec #40 — namespace-isolation naming convention (I6 fix)
4. inventory spec #47 — multi-mode dispatch pattern
5. query-templates spec #48 — RLS app-layer + write side-effect pattern
6. Phase 2B-β #24 — AI orchestration / `handleDrillDownIntent` cite
7. Apr 28 P0 RLS gap finding memory — sister tables RLS gap precedent
8. Apr 28 cross-tenant 4-corner test pattern — T11+T12 enforcement gate

---

## 9. Step 5 deliverables — what step 6 needs to do

After this design notes doc commits + pushes:

1. **Verify open Qs** (in worktree, before spec write):
   - [ ] `@Where` annotation grep on SmartBiSalesData / SmartBiDepartmentData entities (T11 detail)
   - [ ] `DrillDownController` Java path grep — confirm endpoint URL exact (POST or GET, /drill-down or /drilldown, factoryId in path)
   - [ ] `DateRange.thisMonth()` Java impl read — confirm semantic
   - [ ] `BusinessException` Java class read — confirm `withHint()` / `withHintTarget()` setter+serialization
   - [ ] `GlobalExceptionHandler` Java grep — confirm error envelope behavior

2. **Extend record-java-golden.sh** for POST + JSON body — pre-spec or part of PR-A? Decision lean: pre-spec (separate small PR or in spec PR), so step 6 can include working CLI in §4.1

3. **Step 6 write**: 2500-3000 LOC spec doc per §8 outline above. Push early after each section. Aim for §1+§2 first commit, then §3 by section, §4-§9 last.

4. **4-cycle audit dispatch** (subagent-driven):
   - Cycle 1: self-review (catch 5-10 issues)
   - Cycle 2: spec-reviewer subagent (catch 8-15 issues, line refs)
   - Cycle 3: cross-spec-reviewer subagent (cite list from §10 above)
   - Cycle 4: final-impl-reviewer subagent (read spec as if implementing)

5. **Spec PR ship**: --base main --head phase2a/spec-drill-down

---

## 10. Push-early checkpoint

**Now** (after step 5 design notes commit): push to `origin/phase2a/spec-drill-down` to:
- Lock work-in-progress visible to other chats
- Establish branch upstream tracking
- Allow concurrent reviewers to see direction before full spec lands

```bash
git add docs/superpowers/specs/2026-05-02-phase2a-drill-down-design-notes.md
git commit -m "WIP(spec-drill-down): step 5 design notes — bake T1-T12 + 8 decisions" -- \
    docs/superpowers/specs/2026-05-02-phase2a-drill-down-design-notes.md
git push -u origin phase2a/spec-drill-down
```

Step 6 commits will append to same branch.

---

**Step 5 end. Awaiting organizer review or GO step 6.**
