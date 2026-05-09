# Phase 2C Tier 2 — `SmartBIDashboardController` 11 Endpoints Port Design

**Phase**: 2C Tier 2 (Dashboard — read-heavy composite + adaptive chart + dynamic analysis + 1 SSE)
**Status**: Design / planning doc only — kickoff blocked on Phase 2C trigger gates (T6.5 Phase C complete)
**Date**: 2026-05-09
**Predecessor**: PR #152 scoping spec (`docs/superpowers/specs/2026-05-15-phase2b-port-pipeline-scoping-spec.md`), Tier 1 design (Chat E worktree, in flight)
**Sister docs**:
- `.claude/rules/python-java-port.md` (Rules 1–12 from Phase 2A)
- `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` (KEEP list source)
- `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` (PR #178 v3.1 — endpoint inventory ground truth)

> ⚠️ **Naming clarification**: Per PR #152 prefix `phase2b-` is repo-checked-in but per Tier 1 design's
> canonical reconciliation, the **non-analysis SmartBI port pipeline is Phase 2C** (Phase 2B is reserved
> for the BGE / classifier / chat-side enablement work that already shipped end-Apr/early-May 2026).
> This doc uses Phase 2C consistently; references to PR #152 retain its on-disk filename.

> ⚠️ **Endpoint count drift caught at design-time**: marching order of this design task said
> **17 endpoints**. Actual count from `grep -c '@(Get|Post|Put|Delete|Patch)Mapping'` on
> `SmartBIDashboardController.java` (615 LOC, commit `0f80b14b20`) = **11 endpoints**. PR #152 §2.2
> ("11"), PR #178 §3.1 ("11 endpoints; `/data-date-range` is the 23rd Phase B stub candidate") agree.
> Per HARD rule `feedback_marching_order_method_name_grep` graduated 2026-05-09, this doc uses
> the verified count 11. Marching order surface drift flagged to organizer at handoff.

---

## 0. TL;DR

**Scope**: Port the 11 endpoints currently served by `SmartBIDashboardController.java`
(`/api/mobile/{factoryId}/smart-bi/*`) to Python (`backend/python/smartbi_compat/`),
preserving JSON byte-shape parity (dict-eq gate per Rule 4 Phase 2A standard) and existing
frontend contracts. After cutover, Java controller deleted; the 12 Java service classes
that back it (10 analysis + `SmartBIService` + `AdaptiveChartGenerator` + `DynamicAnalysisService`
+ 1 LLM relay client) split into 3 outcomes per PR #178 §3.2.a:

- **Already on Python (Phase 2A)**: 8 of 10 analysis services have functioning Python equivalents (sales / department / region / finance / inventory / procurement) + drilldown — composite endpoints orchestrate these primitives.
- **NOT_SAFE_FALLTHROUGH (deferred)**: production + quality (Java mock-only per PR #37, can't byte-port).
- **Tier 2 NEW Python implementations**: `SmartBIService.getExecutiveDashboard` + `getDashboardLLMInsights*` + `getDataDateRange` (latter already shipped Phase 2A as PoC), `AdaptiveChartGenerator.generateAdaptive`, `DynamicAnalysisService.analyzeDynamic` + `getKPIsOnly`, plus an SSE alias route.

**Endpoint inventory** (`/api/mobile/{factoryId}/smart-bi/*`):

| # | Verb | Path suffix | Java method | Phase 2C Tier 2 disposition |
|---|:---:|---|---|---|
| 1 | POST | `/generate-adaptive-charts` | `generateAdaptiveCharts` | NEW Python port (read-heavy LLM) |
| 2 | POST | `/generate-chart` | `generateSingleChart` | NEW Python port (delegates to #1) |
| 3 | GET | `/dashboard/executive` | `getExecutiveDashboard` | Composite — orchestrate Phase 2A primitives |
| 4 | GET | `/dashboard/executive/insights` | `getDashboardLLMInsights` | NEW Python port (LLM async) |
| 5 | GET | `/dashboard/executive/insights/custom` | `getDashboardLLMInsightsCustomRange` | Alias to existing Python `agent.api`/custom |
| 6 | GET | `/dashboard/executive/insights/custom/stream` | `streamInsightsCustom` (SSE) | Alias to existing Python `agent.api`/custom/stream — **infra reuse** |
| 7 | GET | `/dashboard/executive/custom` | `getExecutiveDashboardCustomRange` | Composite — sales overview path |
| 8 | GET | `/data-date-range` | `getDataDateRange` | **Already shipped Phase 2A** (`smartbi_compat/api/dashboard.py:84`) — re-verify + Phase B 410 stub-out |
| 9 | GET | `/dashboard` | `getUnifiedDashboard` | Composite — 7 services parallel-fanout |
| 10 | GET | `/analysis/dynamic/kpis` | `getKPIsOnly` | NEW Python port (dataset-driven KPI builder) |
| 11 | GET | `/analysis/dynamic` | `analyzeDynamicData` | NEW Python port (dataset-driven full analysis + DB cache) |

Endpoint-counts source: `SmartBIDashboardController.java` (615 LOC, all 11 endpoints inline; grep `@(Get|Post|Put|Delete|Patch)Mapping` returns 11).

**Estimated effort**: **~5–7 weeks** of port impl + ~2 weeks dryrun + ~1 week cutover (T6-pattern). Detailed in §7.
The original PR #152 §6.2 estimate of "2 months" is consistent with this; the slight increase reflects:
- composite endpoint golden-recording effort (each composite = N+1 sub-aspect goldens)
- DynamicAnalysisService DB cache shape parity (FIX-13 LRU-via-`smart_bi_pg_analysis_results` table)
- proactive Production+Quality empty-mirror handling (still Java in dispatch, must coordinate envelope)

**Hard prerequisites** (will not start before):
1. T6.5 Phase C complete (Java analysis controller files removed, `smartbi_compat/` module layout settled, no test-vs-prod schema drift unresolved).
2. Phase 2A retrospective (PR #151) sign-off.
3. Tier 1 design (Chat E PR-W) sign-off — Tier 2 mirrors its router-registration + JWT middleware pattern.
4. Frontend code-path map snapshot (Web-Admin Vue Dashboard.vue + RN factory user dashboard — operator deliverable).
5. Phase 2B ↔ Phase 2C naming reconciled in canonical retrospective (Tier 1 has flagged this).

---

## 1. Endpoint inventory (group by sub-domain)

Source of truth: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java`
(615 LOC, commit `0f80b14b20` 2026-05-09 main HEAD).

The 11 endpoints fall into 4 sub-domains by code structure:

| Sub-domain | # | Java line range | Python module (proposed) |
|---|---:|---|---|
| Adaptive chart generation | 2 | 95–154 | `dashboard_adaptive_chart.py` |
| Executive dashboard (composite + insights + SSE) | 7 | 158–453 | `dashboard_executive.py` |
| Data date range | 1 | 345–374 | **already in `dashboard.py:84`** (Phase 2A PoC) |
| Dynamic analysis (KPI-only + full) | 2 | 462–559, 484–559 | `dashboard_dynamic.py` |
| **TOTAL** | **11** | — | 3 new sub-modules + reuse 1 existing |

Composite endpoints (#3 / #7 / #9) orchestrate the 10 analysis services (per PR #178 §3.2.a — all
shared with Tier 2). They contribute the highest LOC + highest test surface despite being
"glue" code semantically.

### 1.1 Endpoint-by-endpoint detail

#### Adaptive chart generation (2 endpoints, lines 95–154)

| Endpoint | Verb | Java method | Java service | Python equivalent |
|---|:---:|---|---|---|
| `/generate-adaptive-charts` | POST | `generateAdaptiveCharts(factoryId, AdaptiveChartRequest)` | `AdaptiveChartGenerator.generateAdaptive(uploadId, request)` | NEW: `adaptive_chart_generator.py` (Python LLM-orchestrated chart builder) |
| `/generate-chart` | POST | `generateSingleChart(factoryId, uploadId, chartType, purpose?)` | Delegates to #1 with `maxCharts=1, fusionEnabled=false, preferredChartType=chartType` | NEW: thin alias internal to `dashboard_adaptive_chart.py` |

**Java contract**:
- Request: `AdaptiveChartRequest` (18 LOC DTO, `dto/smartbi/chart/`)
- Response: `ApiResponse<AdaptiveChartResponse>` for #1, `ApiResponse<AdaptiveChartResponse.GeneratedChart>` for #2
- Auth: `@RequirePermission("analytics:read_write")` on both

**Python design**: `adaptiveChartGenerator` is a Spring `@RequiredArgsConstructor` Java service
(`AdaptiveChartGeneratorImpl.generateAdaptive(uploadId, request)`); under the hood it drives an LLM
chain (DashScope) to evaluate dataset → recommend chart types → render configs. **Python already
has overlapping infra in `smartbi/services/chart_builder.py` and `smartbi/api/chart.py`** but
with a different contract. Two impl options:

- **Option A (preferred)**: write a new Python `adaptive_chart_generator.py` mirroring Java service
  byte-for-byte (same prompt, same LLM model, same response schema). Reuse `smartbi/services/insight_generator.py`'s
  DashScope client instance to avoid duplicate HTTP wiring.
- **Option B**: port frontend caller path to call existing `/api/smartbi/chart/*` instead, retire
  this endpoint at Phase 2C-Tier-2-D cleanup. Frontend code-path map (prereq #4) determines feasibility.

PR #152 §6.2 implies Option A. Confirmed by Q-1 §10 below.

#### Executive dashboard (7 endpoints, lines 158–453)

| Endpoint | Verb | Java method | Java service | Python equivalent |
|---|:---:|---|---|---|
| `/dashboard/executive` | GET | `getExecutiveDashboard(factoryId, period?='month')` | `SmartBIService.getExecutiveDashboard(factoryId, period)` (line 263) | Composite over Phase 2A `_get_sales_overview` + 9 sister services |
| `/dashboard/executive/insights` | GET | `getDashboardLLMInsights(factoryId, period?='month')` | `SmartBIService.getDashboardLLMInsights(factoryId, period)` (line 480) | Mostly LLM-driven; Python infra exists in `smartbi/agent/api.py` (`/insights/custom`) |
| `/dashboard/executive/insights/custom` | GET | `getDashboardLLMInsightsCustomRange(factoryId, startDate, endDate)` | `SmartBIService.getDashboardLLMInsightsCustomRange(factoryId, startDate, endDate)` (line 528) | **Alias** to existing Python `/api/smartbi/insights/custom` (Phase 2A Week 5 ship) |
| `/dashboard/executive/insights/custom/stream` | GET | `streamInsightsCustom(factoryId, startDate, endDate)` (SseEmitter, 120s) | `AgentInsightsClient.streamInsightsCustom(factoryId, startDate, endDate, null)` line 127 — relays to Python `/api/smartbi/insights/custom/stream` | **Alias** to existing Python `/api/smartbi/insights/custom/stream` (Phase 2A Week 5 ship) |
| `/dashboard/executive/custom` | GET | `getExecutiveDashboardCustomRange(factoryId, startDate, endDate)` | `salesAnalysisService.getSalesOverview(factoryId, startDate, endDate)` direct | Already exists internally in Phase 2A: `_get_sales_overview(factory_id, range_)` |
| `/data-date-range` | GET | `getDataDateRange(factoryId)` | `SmartBIService.getDataDateRange(factoryId)` (line 2097) | **Already shipped Phase 2A**: `smartbi_compat/api/dashboard.py:84` |
| `/dashboard` | GET | `getUnifiedDashboard(factoryId, period?='month')` | `SmartBIService.getExecutiveDashboard` + 9 parallel fanout via `enrichUnifiedDashboard()` | Composite — Python orchestrates Phase 2A primitives + production/quality empty stubs |

**Critical SSE finding** (changes Tier 2 effort estimate):

The Java `streamInsightsCustom` method (`SmartBIDashboardController.java:249–315`) is already a **proxy**.
It calls `AgentInsightsClient.streamInsightsCustom` (line 127–169) which in turn HTTPs to the existing
Python endpoint `POST {PYTHON_SMARTBI_URL}/api/smartbi/insights/custom/stream` (line 143). Python's
`backend/python/smartbi/agent/api.py:83 @router.get("/custom/stream")` already implements
`StreamingResponse` over `orchestrator.stream_insight()`. **Tier 2's port for endpoint #6 is
therefore a thin alias route, NOT new SSE infrastructure.** PR #152 §6.2 implies novel SSE
build — that estimate is outdated; Tier 2 inherits proven Phase 2A SSE plumbing.

The same applies to endpoint #5 (`/insights/custom`): Python `/api/smartbi/insights/custom` already
exists in `agent/api.py:48 @router.get("/custom")`. Endpoint #5 becomes a thin alias too.

**Tier 2 net SSE work**: register two new alias routes (`/api/mobile/{factoryId}/smart-bi/dashboard/executive/insights/custom*`)
that proxy to Python's existing agent endpoints. ~50–100 LOC alias + JWT-rewrite-to-X-Internal-Secret.

#### Data date range (1 endpoint, lines 345–374)

Already shipped as Phase 2A T5 PoC (PR predates Phase 2C). Per PR #178 §3.1.b, `/data-date-range` is
**the 23rd Phase B stub candidate** — Java side stays through T6.5 Phase B then 410-stub. Python side
needs only a re-verify of byte-shape parity at Tier 2 cutover (no new code). Treat as a no-op for Tier 2
impl scope; document in §6 as the Tier 2 acceptance baseline.

#### Dynamic analysis (2 endpoints, lines 462–559)

| Endpoint | Verb | Java method | Java service | Python equivalent |
|---|:---:|---|---|---|
| `/analysis/dynamic/kpis` | GET | `getKPIsOnly(factoryId, uploadId)` | `DynamicAnalysisService.getKPIsOnly(factoryId, uploadId)` (line 141) | NEW: `dashboard_dynamic.py:_get_kpis_only` |
| `/analysis/dynamic` | GET | `analyzeDynamicData(factoryId, uploadId, analysisType?='auto', forceRefresh?=false)` | `DynamicAnalysisService.analyzeDynamic(factoryId, uploadId, analysisType)` (line 61) + `SmartBiPgAnalysisResultRepository` 7-day cache | NEW: `dashboard_dynamic.py:_analyze_dynamic` + Python equivalent of FIX-13 cache |

`DynamicAnalysisService` is Spring conditional-on-property `smartbi.postgres.enabled` (visible at
line 470/497 — `if (dynamicAnalysisService == null) return error`). It services the per-upload
ad-hoc analysis use case (user uploads Excel → click "analyze" → dataset-driven KPI / chart / insight).
The 7-day persistent cache (`smart_bi_pg_analysis_results` table) was added FIX-13 Apr 16 2026 to
amortize the LLM cost per upload.

**Python design considerations**:
- The `smart_bi_pg_analysis_results` table needs Python-side accessor (likely SQLAlchemy ORM in `smartbi/database/models/`).
- `getKPIsOnly` returns `List<Map<String, Object>>` — **Rule 8 risk**: any `Map.of(N)` in the
  Java service that builds these dicts must be golden-recorded for Jackson key order.
- `analyzeDynamic` returns `DynamicAnalysisService.DashboardResponse` (Java-internal nested class
  distinct from `dto/smartbi/DashboardResponse`) — verify shape divergence at golden time.

---

## 2. Java service-dependency map

Per PR #178 §3.2.a, all 12 services injected by the controller are shared with at least one
OUT-OF-SCOPE controller, so wholesale Java service deletion is **infeasible** until Tier 2 + Tier 3 +
Tier 4 also complete. Python-side parity is the path forward.

### 2.1 Service injection inventory

| Java service | Where used in Tier 2 | Phase 2A Python primitive | Phase 2C Tier 2 strategy |
|---|---|---|---|
| `salesAnalysisService` | #3 fallback, #7 direct, #9 enrichment | `_get_sales_overview` ✓ (`analysis_sales.py:1466`) | Reuse Phase 2A primitive directly. |
| `departmentAnalysisService` | #9 enrichment | `_get_department_ranking` ✓ (`analysis_department.py:373`) | Reuse Phase 2A primitive directly. |
| `regionAnalysisService` | #9 enrichment | `_get_region_analysis` ✓ (`analysis_region.py:737`) — exposes `_build_region_ranking` (line 478) | Add a thin `_get_region_ranking` extractor wrapper — region's existing public is `_get_region_analysis` whose ranking field is the only thing #9 uses. |
| `financeAnalysisService` | #9 enrichment | `_get_finance_overview` ✓ (`analysis_finance.py:1848`) | Reuse Phase 2A primitive directly. |
| `productionAnalysisService` | #9 enrichment | **MISSING** (NOT_SAFE_FALLTHROUGH per PR #178; Java mock per PR #37) | **Empty-mirror strategy**: return `DashboardResponse.builder().kpiCards([]).charts({}).rankings({}).aiInsights([]).suggestions([]).lastUpdated(now()).build()` — same shape as Java fallback (line 178–187). Document at §6.4 as `production_quality_empty_mirror.py`. |
| `qualityAnalysisService` | #9 enrichment | **MISSING** (same as production) | Same empty-mirror strategy. |
| `inventoryHealthAnalysisService` | #9 enrichment | `_get_inventory_health` ✓ (`analysis_inventory.py:1802`) | Reuse Phase 2A primitive directly. |
| `procurementAnalysisService` | #9 enrichment | `_get_procurement_overview` ✓ (`analysis_procurement.py:1076`) | Reuse Phase 2A primitive directly. |
| `recommendationService` | #9 enrichment (`generateAllAlerts` + `generateRecommendations`) | partial (recommend exists in `analysis_*.py` per-domain; `generateAllAlerts` aggregator missing as a single function) | **NEW Python aggregator**: `dashboard_recommendation.py` orchestrates per-domain `recommend_*` functions to produce the full alerts list. ~150 LOC. |
| `smartBIService` | #3 / #4 / #5 / #8 / #9 (orchestrator) | partial (`getDataDateRange` ✓; `getExecutiveDashboard`/`getDashboardLLMInsights` MISSING) | **NEW Python orchestrator**: `dashboard_orchestrator.py` mirrors Java service composite responsibilities. |
| `adaptiveChartGenerator` | #1 / #2 | **MISSING** (Java-only LLM chain) | NEW Python port per §1.1. |
| `dynamicAnalysisService` | #10 / #11 | **MISSING** (Java-only PG-backed) | NEW Python port per §1.1; FIX-13 cache mirror. |
| `agentInsightsClient` | #6 | N/A (alias only, see SSE finding) | Skip — Python is the upstream already. |
| `analysisResultRepository` (`SmartBiPgAnalysisResultRepository`) | #11 cache (line 56) | **MISSING** (no Python ORM) | NEW Python ORM mapping: `smartbi/database/models/smart_bi_pg_analysis_result.py`. |
| `cacheObjectMapper` | #11 cache value (de)serialization (line 62) | N/A (Pydantic / `json.dumps` equivalent) | Use Python `json` stdlib + Pydantic schema. |

**Per-service signature mirror (Rule 3)**:

```java
// Java (verified by grep 2026-05-09)
public DashboardResponse getSalesOverview(String factoryId, LocalDate startDate, LocalDate endDate);
public DashboardResponse getFinanceOverview(String factoryId, LocalDate startDate, LocalDate endDate);
public DashboardResponse getInventoryHealth(String factoryId, LocalDate startDate, LocalDate endDate);
public DashboardResponse getProcurementOverview(String factoryId, LocalDate startDate, LocalDate endDate);
public List<RankingItem> getDepartmentRanking(String factoryId, LocalDate startDate, LocalDate endDate);
public List<RankingItem> getRegionRanking(String factoryId, LocalDate startDate, LocalDate endDate);
public List<Alert> generateAllAlerts(String factoryId, DateRange range);
public List<Recommendation> generateRecommendations(String factoryId, String analysisType);
public AdaptiveChartResponse generateAdaptive(Long uploadId, AdaptiveChartRequest request);
public DashboardResponse analyzeDynamic(String factoryId, Long uploadId, String analysisType);
public List<Map<String, Object>> getKPIsOnly(String factoryId, Long uploadId);
public DashboardResponse getExecutiveDashboard(String factoryId, String period);
public List<AIInsight> getDashboardLLMInsights(String factoryId, String period);
public List<AIInsight> getDashboardLLMInsightsCustomRange(String factoryId, LocalDate startDate, LocalDate endDate);
public DateRange getDataDateRange(String factoryId);
```

```python
# Python (Tier 2 ports — Rule 3 1:1 mirror)
async def _get_sales_overview(factory_id: str, start_date: date, end_date: date) -> dict: ...
async def _get_finance_overview(factory_id: str, start_date: date, end_date: date) -> dict: ...
async def _get_inventory_health(factory_id: str, start_date: date, end_date: date) -> dict: ...
async def _get_procurement_overview(factory_id: str, start_date: date, end_date: date) -> dict: ...
async def _get_department_ranking(factory_id: str, start_date: date, end_date: date) -> list: ...
async def _get_region_ranking(factory_id: str, start_date: date, end_date: date) -> list: ...
async def _generate_all_alerts(factory_id: str, range_: DateRange) -> list: ...   # Note: Rule 3 exception, range_ matches Java DateRange envelope
async def _generate_recommendations(factory_id: str, analysis_type: str) -> list: ...
async def _generate_adaptive(upload_id: int, request: dict) -> dict: ...
async def _analyze_dynamic(factory_id: str, upload_id: int, analysis_type: str) -> dict: ...
async def _get_kpis_only(factory_id: str, upload_id: int) -> list: ...
async def _get_executive_dashboard(factory_id: str, period: str) -> dict: ...
async def _get_dashboard_llm_insights(factory_id: str, period: str) -> list: ...
async def _get_dashboard_llm_insights_custom_range(factory_id: str, start_date: date, end_date: date) -> list: ...
async def _get_data_date_range(factory_id: str) -> Optional[dict]: ...
```

⚠️ **Phase 2A Rule 3 mismatch carried over**: existing `_get_sales_overview` and `_get_finance_overview`
in `analysis_sales.py` / `analysis_finance.py` accept `range_: DateRange` (the wrapper Rule 3 says is
forbidden). Tier 2 has two choices:
- **Option I**: bake a `_get_sales_overview_byrange(factory_id, start_date, end_date)` thin adapter over
  the existing function. Adapter is `range_ = DateRange.custom(start, end)` + delegate. Net 5 LOC, no
  Rule 3 violation introduced (the wrapper is still inside Phase 2A scope — Tier 2 contract is the new
  adapter).
- **Option II**: refactor `_get_sales_overview` to take `start_date, end_date` and patch all Phase 2A
  callers. Larger blast radius but cleaner.

Recommend Option I to keep Tier 2 scope bounded; flag Option II as Phase 2A retrospective backlog item.

### 2.2 SmartBIService.getExecutiveDashboard (#3) decomposition

`SmartBIServiceImpl.getExecutiveDashboard(factoryId, period)` at line 263 (~217 LOC) does:

1. `DateRangeUtils.getDateRangeByPeriod(period)` → `[startDate, endDate]` (period parsing)
2. `salesAnalysisService.getSalesOverview(factoryId, startDate, endDate)` → base `DashboardResponse`
3. KPI card augmentation, chart enrichment (Java internal logic ~80 LOC)
4. `recommendationService.generateAllAlerts(factoryId, range)` → alerts list (line ~390)
5. `recommendationService.generateRecommendations(factoryId, "all")` → recommendations list
6. (LLM insights are NOT in this endpoint — see #4 instead, deliberately split for async loading)

**Python `_get_executive_dashboard` design**:
```python
async def _get_executive_dashboard(factory_id: str, period: str) -> dict:
    start, end = _resolve_period_range(period)  # mirror DateRangeUtils.getDateRangeByPeriod
    base = await _get_sales_overview_byrange(factory_id, start, end)  # Phase 2A reuse
    base = _augment_kpi_cards(base, factory_id, start, end)            # Tier 2 NEW
    base = _augment_charts(base, factory_id, start, end)               # Tier 2 NEW
    base["alerts"] = await _generate_all_alerts(factory_id, DateRange.custom(start, end))
    base["recommendations"] = await _generate_recommendations(factory_id, "all")
    return base
```

The augmentation steps (3) need golden-recording — Java-internal logic at lines ~290–470 is dense
and must be ported byte-for-byte. Estimate ~2 weeks for this single endpoint's port + golden parity.

### 2.3 enrichUnifiedDashboard (#9) parallel fanout (line 567–614)

Java uses `CompletableFuture.runAsync(...)` on 9 independent enrichments, then `allOf().join()`.
Python equivalent: `asyncio.gather(*tasks, return_exceptions=True)`. Each fanout target wraps
a Phase 2A primitive (or production/quality empty-mirror).

```python
async def _get_unified_dashboard(factory_id: str, period: str) -> dict:
    start, end = _resolve_period_range(period)
    sales_task = _get_sales_overview_byrange(factory_id, start, end)
    finance_task = _get_finance_overview_byrange(factory_id, start, end)
    inventory_task = _get_inventory_health(factory_id, start, end)
    production_task = _empty_dashboard_response()    # NOT_SAFE_FALLTHROUGH placeholder
    quality_task = _empty_dashboard_response()       # ditto
    procurement_task = _get_procurement_overview(factory_id, start, end)
    dept_rank_task = _get_department_ranking(factory_id, start, end)
    region_rank_task = _get_region_ranking(factory_id, start, end)
    alerts_task = _generate_all_alerts(factory_id, DateRange.custom(start, end))
    recs_task = _generate_recommendations(factory_id, "all")

    results = await asyncio.gather(
        sales_task, finance_task, inventory_task, production_task,
        quality_task, procurement_task, dept_rank_task, region_rank_task,
        alerts_task, recs_task,
        return_exceptions=True,  # mirror Java per-task try-catch (line 568–613)
    )

    return _build_unified_response(period, start, end, results)
```

**Java per-task `try { ... } catch (Exception e) { log.warn(...); }`** must mirror as Python
`isinstance(result, Exception)` → log.warn + leave field unset/null. This preserves Java's
"degraded but successful" envelope behavior (line 433–451) which returns 200 with empty fields
on partial failure rather than 500.

---

## 3. DTO mapping

### 3.1 Java DTOs touched (6 distinct)

| Java DTO | LOC | Lombok flags | Phase 2A status |
|---|---:|---|---|
| `dto/smartbi/DashboardResponse.java` | 163 | `@Data @Builder @NoArgsConstructor @AllArgsConstructor` (no `@JsonInclude`) | already golden-recorded multiple times in Phase 2A inventory + finance + region specs (Rule 9.2) |
| `dto/smartbi/UnifiedDashboardResponse.java` | 176 | `@Data @Builder @NoArgsConstructor @AllArgsConstructor` (no `@JsonInclude`) + 3 derived getters (`getAlertCount`, `getUrgentAlertCount`, `getHighPriorityRecommendationCount`) per Rule 9.3 | NEW Tier 2 — must record golden + DTO-derived-getter audit |
| `dto/smartbi/DateRange.java` | 322 | `@Data` + 2 derived getters (`getDays`, `isValid`) per Rule 9.3 | already golden-recorded in Phase 2A department spec (Rule 9.3 case) |
| `dto/smartbi/AIInsight.java` | 46 | `@Data @Builder @NoArgsConstructor @AllArgsConstructor` (no `@JsonInclude`) | already golden-recorded in Phase 2A inventory PR-B spec |
| `dto/smartbi/chart/AdaptiveChartRequest.java` | 18 | `@Data @Builder` | NEW Tier 2 |
| `dto/smartbi/chart/AdaptiveChartResponse.java` | 33 | `@Data @Builder` + nested `GeneratedChart` class | NEW Tier 2 |

**Rule 9 audit checklist for Tier 2 NEW DTOs** (per `python-java-port.md` Rule 9):
- [ ] `grep -n "@JsonInclude" dto/smartbi/UnifiedDashboardResponse.java` → expected 0 hits → emit nulls
- [ ] `grep -nE "public.*get[A-Z]|public.*is[A-Z]" dto/smartbi/UnifiedDashboardResponse.java` → confirm 3 derived getters listed (`getAlertCount`, `getUrgentAlertCount`, `getHighPriorityRecommendationCount`); these MUST appear as fields in Python dict literal output
- [ ] same audit for `AdaptiveChartRequest` + `AdaptiveChartResponse` + nested `GeneratedChart`
- [ ] golden-record F999 + F001 + 1 typical-customer factory for each composite endpoint output (#3 / #7 / #9)

### 3.2 UnifiedDashboardResponse Lombok-derived field gotcha (Rule 9.3)

Java source (verified `dto/smartbi/UnifiedDashboardResponse.java:158–175`):
```java
public int getAlertCount() {
    return alerts != null ? alerts.size() : 0;
}
public long getUrgentAlertCount() {
    return alerts != null ? alerts.stream().filter(Alert::isUrgent).count() : 0;
}
public long getHighPriorityRecommendationCount() {
    return recommendations != null ? recommendations.stream().filter(Recommendation::isHighPriority).count() : 0;
}
```

These will Jackson-emit as `"alertCount": <int>`, `"urgentAlertCount": <long>`,
`"highPriorityRecommendationCount": <long>`. Python dict literal MUST include these computed fields:

```python
def _build_unified_response(period, start, end, results) -> dict:
    sales, finance, inventory, production, quality, procurement, \
        dept_rank, region_rank, alerts, recs = (
            r if not isinstance(r, Exception) else None for r in results
        )

    return {
        "period": period,
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "sales": sales,
        "finance": finance,
        "inventory": inventory,
        "production": production,
        "quality": quality,
        "procurement": procurement,
        "departmentRanking": dept_rank,
        "regionRanking": region_rank,
        "alerts": alerts,
        "recommendations": recs,
        "aiInsights": None,                      # Java field, not used in non-streaming endpoints
        "generatedAt": _java_isoformat(datetime.now()),  # Rule 11 trailing-zero microsecond
        "fromCache": False,                      # Java @Builder.Default false
        "cacheExpireAt": None,                   # null per Rule 9.2
        "dataVersion": str(int(time.time() * 1000)),  # Java line 401 / 449: String.valueOf(System.currentTimeMillis())
        "alertCount": len(alerts) if alerts else 0,                  # Lombok derived
        "urgentAlertCount": sum(1 for a in (alerts or []) if a.get("urgent")),       # ditto
        "highPriorityRecommendationCount": sum(1 for r in (recs or []) if r.get("highPriority")),  # ditto
    }
```

**Order mirror caveat (Rule 8 / 9)**: Lombok derived getters in Java appear AFTER the regular field getters
in `Method[] getDeclaredMethods()` iteration in Jackson's `BeanIntrospector`. Net effect: derived fields
serialize at the END of the JSON object, after all regular fields. Python dict insertion order must match
this. **Mandatory: golden-record at impl time, do not trust this design assumption.** (Rule 8 graduate
2026-05-01 sub-endpoints PR #32 directly addresses this category of bug.)

### 3.3 AIInsight wire shape

Java source (`dto/smartbi/AIInsight.java`, 46 LOC, verified):
- 12 fields including `level` (RED/YELLOW/GREEN/INFO), `severity`, `metric`, `value`, `unit`,
  `description`, `actionableInsights` (list)
- No `@JsonInclude` → Python emits all nulls (Rule 9.2)
- All getters are direct field access (no Rule 9.3 derived risk)

Python dict literal pattern:
```python
{"id": ..., "category": ..., "level": ..., "severity": ..., "metric": ...,
 "value": ..., "unit": ..., "description": ..., "actionableInsights": [...],
 "createdAt": _java_isoformat(...), "updatedAt": _java_isoformat(...), "factoryId": ...}
```

### 3.4 AdaptiveChartRequest / AdaptiveChartResponse (NEW)

`AdaptiveChartRequest.java` (18 LOC):
```java
@Data
@Builder
public class AdaptiveChartRequest {
    private Long uploadId;
    private Boolean evaluateFirst;
    private Integer maxCharts;
    private Boolean fusionEnabled;
    private String preferredChartType;
}
```

`AdaptiveChartResponse.java` (33 LOC) has nested `GeneratedChart` inner class. Tier 2 must
record goldens at impl time per Rule 9 checklist above; this design doc does NOT speculate on
field shape (PR #178 v3.1 lessons: source-only audit drifts).

---

## 4. SSE relay design (endpoint #6)

**Critical finding**: Java's SSE endpoint is already a relay to Python — Tier 2 keeps the relay,
just registers a Python alias route at the Tier 2 controller-equivalent path.

### 4.1 Current state (verified `AgentInsightsClient.java:127–169`)

```
Frontend (Vue/RN)
    │ GET /api/mobile/{factoryId}/smart-bi/dashboard/executive/insights/custom/stream
    ▼
nginx (139)
    │ regex match → cretas_backend (Java 10010)
    ▼
Java SmartBIDashboardController.streamInsightsCustom (line 249)
    │ instantiates SseEmitter(120s)
    │ launches Thread to pump from upstream Python SSE
    ▼
Java AgentInsightsClient.streamInsightsCustom (line 127)
    │ HTTP GET PYTHON_SMARTBI_URL + /api/smartbi/insights/custom/stream
    │ headers: X-Internal-Secret + X-Factory-Id + Accept: text/event-stream
    ▼
Python smartbi/agent/api.py:83 @router.get("/custom/stream")
    │ StreamingResponse over orchestrator.stream_insight()
    │ X-Accel-Buffering: no (disable nginx buffering)
    ▼
DashScope LLM token stream
```

### 4.2 Tier 2 cutover state (post-Phase-2C-Tier-2)

```
Frontend (Vue/RN)
    │ GET /api/mobile/{factoryId}/smart-bi/dashboard/executive/insights/custom/stream
    ▼
nginx (139)
    │ NEW regex location → cretas_python (Python 8083)  ← Tier 2 nginx update
    ▼
Python smartbi_compat/api/dashboard_executive.py NEW alias route
    │ Authenticate JWT → derive factoryId → re-issue X-Internal-Secret
    │ ProxyResponse / pass-through to existing /api/smartbi/insights/custom/stream
    ▼
Python smartbi/agent/api.py:83 @router.get("/custom/stream")
    │ (unchanged from Phase 2A)
    ▼
DashScope LLM token stream
```

**Pass-through implementation sketch**:
```python
# smartbi_compat/api/dashboard_executive.py
@router.get("/api/mobile/{factory_id}/smart-bi/dashboard/executive/insights/custom/stream")
async def relay_insights_custom_stream(
    factory_id: str,
    start_date: date,
    end_date: date,
    auth: AuthContext = Depends(verify_jwt_and_factory),
):
    """Tier 2 alias to Phase 2A agent SSE endpoint. JWT-authenticated frontend caller
    is rewritten to internal X-Internal-Secret + X-Factory-Id for the agent layer."""
    # Direct in-process call instead of HTTP roundtrip — saves ~10ms + avoids socket leak risk
    from smartbi.agent.api import get_insights_custom_stream
    return await get_insights_custom_stream(
        factory_id=auth.factory_id,
        start_date=start_date,
        end_date=end_date,
    )
```

**Why in-process call instead of HTTP relay**:
- Same Python process (uvicorn N=2 workers per `feedback_uvicorn_workers` Phase 2A
  May 7 cutover). HTTP self-call is wasteful + risks SO_REUSEPORT round-tripping to a
  different worker that doesn't share session state.
- Java's HTTP relay was necessary because Java + Python are different processes; Python alias
  doesn't have that constraint.
- StreamingResponse buffers / chunks transparently when called as a coroutine.

### 4.3 SSE byte-shape parity gate

Per PR #152 §5 (per-tier gate recommendation):
- **JSON event payload**: dict-eq (per Phase 2A standard)
- **Stream framing** (chunk boundaries / `data:` line spacing): **strict-byte** for safety —
  client EventSource is sensitive to `\n\n` event delimiter

The Tier 2 acceptance test:
```bash
# Capture Java prod SSE response with raw chunks preserved
curl -N -H "Authorization: Bearer $TOKEN" \
  "http://47.100.235.168:10010/api/mobile/F001/smart-bi/dashboard/executive/insights/custom/stream?startDate=2025-12-01&endDate=2026-01-01" \
  > tests/fixtures/sse-golden/exec-insights-stream-F001-java.txt

# Capture Python equivalent
curl -N -H "Authorization: Bearer $TOKEN" \
  "http://47.100.235.168:8083/api/mobile/F001/smart-bi/dashboard/executive/insights/custom/stream?startDate=2025-12-01&endDate=2026-01-01" \
  > tests/fixtures/sse-golden/exec-insights-stream-F001-python.txt

# Compare event-by-event:
python scripts/compare-sse-streams.py \
  tests/fixtures/sse-golden/exec-insights-stream-F001-java.txt \
  tests/fixtures/sse-golden/exec-insights-stream-F001-python.txt \
  --frame-strict --payload dict-eq
```

`scripts/compare-sse-streams.py` is NEW Tier 2 tooling. Estimate ~200 LOC, see §11 risks.

⚠️ **LLM nondeterminism risk**: DashScope token stream is non-deterministic per request (temperature
> 0). Two consecutive calls to the same prompt produce different `delta` events. The golden-shape
test must compare **structure**, not **content** — match `event` types (`meta` / `delta` / `done` /
`error`), payload **schema**, and **delimiter framing**, but not actual generated text.

---

## 5. Composite endpoint design

### 5.1 `/dashboard/executive` (#3) — single-service composite

Java entry point at `SmartBIDashboardController.java:158–188` falls back to `salesAnalysisService.getSalesOverview`
when `smartBIService == null`. In normal config, it calls `smartBIService.getExecutiveDashboard(factoryId, period)`
(line 263 — 217 LOC of business logic).

**Python design**:
```python
# smartbi_compat/api/dashboard_executive.py
@router.get("/api/mobile/{factory_id}/smart-bi/dashboard/executive")
async def get_executive_dashboard(
    factory_id: str,
    period: str = "month",
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    try:
        result = await _get_executive_dashboard(auth.factory_id, period)
        return wrap_response(result)
    except Exception as e:
        logger.error("get_executive_dashboard failed: factoryId=%s period=%s err=%s", factory_id, period, e)
        return wrap_response(_empty_dashboard_response(period=period))  # Java line 178–187 mirror
```

**Period parsing** (`_resolve_period_range` mirroring `DateRangeUtils.getDateRangeByPeriod`):
| period value | start | end |
|---|---|---|
| `today` | today | today |
| `week` | start of current ISO week (Mon) | today |
| `month` | first of current month | today |
| `quarter` | first of current quarter | today |
| `year` | Jan 1 current year | today |

Java reference: `util/DateRangeUtils.java`. Python port: simple `date` arithmetic + per Rule 2
calendar-year (NOT ISO-year) handling.

### 5.2 `/dashboard` (#9) — multi-service parallel composite

Already detailed in §2.3. Key implementation note: `asyncio.gather(..., return_exceptions=True)`
with per-task try-catch wrapping at the call-site.

### 5.3 `/dashboard/executive/custom` (#7) — single-service direct

Lightweight: `salesAnalysisService.getSalesOverview(factoryId, startDate, endDate)` direct, no
augmentation. Python: thin alias to `_get_sales_overview_byrange`.

### 5.4 Cache strategy for composites

Java side currently has NO cache for #3 / #7 / #9 (only #11 has FIX-13 7-day cache).

**Design recommendation**: keep no-cache parity for Tier 2; add Redis-backed 5-min cache as a
Phase 2C-Tier-2-D follow-up if dryrun reveals composite latency issues. Q-2 §10 below.

### 5.5 Empty-dashboard envelope (Java fallback line 178–187, line 333–342, line 437–451)

Three Java fallback envelopes exist with subtly different shapes (verified by re-reading controller):

```java
// Pattern 1: line 178–187 (in #3 fallback)
DashboardResponse.builder()
    .kpiCards([]).charts({}).rankings({})
    .aiInsights([]).suggestions([])
    .lastUpdated(LocalDateTime.now()).build();

// Pattern 2: line 333–342 (in #7 fallback) — IDENTICAL to Pattern 1

// Pattern 3: line 437–451 (in #9 fallback) — wraps Pattern 1 inside UnifiedDashboardResponse
```

Tier 2 Python `_empty_dashboard_response()` helper:
```python
def _empty_dashboard_response(period: Optional[str] = None,
                              start: Optional[date] = None,
                              end: Optional[date] = None) -> dict:
    return {
        "period": period,                              # null in Pattern 1; set in Pattern 3
        "startDate": start.isoformat() if start else None,
        "endDate": end.isoformat() if end else None,
        "kpiCards": [],
        "metricCards": None,        # Java @Deprecated field, emit null per Rule 9.2
        "rankings": {},
        "charts": {},
        "chartList": None,          # Java @Deprecated, null per Rule 9.2
        "aiInsights": [],
        "alerts": None,
        "recommendations": None,
        "suggestions": [],
        "generatedAt": None,
        "lastUpdated": _java_isoformat(datetime.now()),
        "fromCache": False,         # Java @Builder.Default
        "cacheExpireAt": None,
    }
```

Per Rule 9.2, every field of `DashboardResponse` (`@Data` + no `@JsonInclude`) MUST appear in
Python output, including the @Deprecated fields. Verify against golden at impl time.

---

## 6. Multi-factory routing strategy

Tier 2 endpoints are factory-scoped via path (`/api/mobile/{factoryId}/smart-bi/*`), unlike Tier 1
which is JWT-scoped only. nginx regex routing pattern from Phase 2A applies directly.

### 6.1 Current nginx state (post Phase 2A T6.4)

Per `server-operations.md`, server 139 has 3 location regex blocks routing subsets of
`/api/mobile/{factoryId}/smart-bi/*` to `cretas_python` (47:8083) for the 75 customer factories.
Current state (post T6.4 May 9 06:34 CST):
- 22 SmartBIAnalysisController paths route to Python (per PR #178 §3.1.a)
- 1 SmartBIDashboardController path routes to Python (`/data-date-range`, per PR #178 §3.1.b)
- F999 + future test factories fall through to Java for everything

### 6.2 Tier 2 cutover nginx update

After Tier 2 impl complete + dryrun GO + cutover GO:
- Add 10 new path regexes (matching `/dashboard*`, `/generate-*`, `/analysis/dynamic*`) to
  the nginx Python upstream block.
- Apply same factory-cohort progression as Phase 2A (T6-style 5-stage cascade per
  `2026-05-08-t6-3-execution-marching-order.md` model):
  - Stage 1: F002 + F003 (~1 day soak)
  - Stage 2: F004 + F006 + R001 (~1 day)
  - Stage 3: RES_GML_001 + RES_3101_009 (~1 day)
  - Stage 4: 3 customer-restaurant factories (~1 day)
  - Stage 5: 4 remaining factories — 100% (final stage)

Per HARD rule `feedback_active_e2e_replaces_passive_soak` (May 9 graduate), each stage should
use active Playwright/curl probing (Web-Admin Dashboard.vue / RN factory dashboard) instead
of 24h passive soak window when Tier 2 cutover happens (assumes no customer-return spike yet).
Estimated cutover compressed window: ~3–5 hours total instead of 5 days passive soak.

### 6.3 Python module file layout

```
backend/python/smartbi_compat/
├── api/
│   ├── analysis_*.py             # Phase 2A (50 endpoints, untouched)
│   ├── dashboard.py              # /data-date-range existing (Phase 2A T5 PoC, KEEP)
│   ├── dashboard_executive.py    # NEW Tier 2 (#3, #4, #5, #6, #7, #9)
│   ├── dashboard_adaptive_chart.py  # NEW Tier 2 (#1, #2)
│   └── dashboard_dynamic.py      # NEW Tier 2 (#10, #11)
├── services/
│   ├── dashboard_orchestrator.py    # NEW Tier 2 (composite logic for #3 / #7 / #9)
│   ├── adaptive_chart_generator.py  # NEW Tier 2 (LLM chain for #1)
│   ├── dynamic_analysis.py          # NEW Tier 2 (dataset analyzer for #10 / #11)
│   ├── dashboard_recommendation.py  # NEW Tier 2 (alerts + recs aggregator)
│   └── empty_response.py            # NEW Tier 2 (Pattern 1/2/3 empty envelopes per §5.5)
└── (existing Phase 2A files unchanged)

backend/python/smartbi/database/models/
└── smart_bi_pg_analysis_result.py   # NEW Tier 2 ORM (FIX-13 cache for #11)
```

### 6.4 Production+Quality NOT_SAFE_FALLTHROUGH handling

Per PR #178 §3.1.a, `/analysis/production` and `/analysis/quality` are still served by Java for
all 75 factories. Tier 2 composite #9 (`/dashboard`) calls these services for enrichment.

**Two strategies**:
- **A**: Tier 2 #9 enriches production+quality from Java via internal HTTP call (Java-Python `/api/mobile/{factoryId}/smart-bi/analysis/production` HTTP call from Python). Pro: real data. Con: HTTP roundtrip + breaks Tier 2 self-containment.
- **B**: Tier 2 #9 enriches production+quality with empty `_empty_dashboard_response()` placeholders. Pro: self-contained, Tier 2-only. Con: production+quality fields look empty in the unified dashboard (matches Java fallback line 568–613 try-catch behavior, which logs warn + leaves field unset on exception — semantically equivalent).

**Recommend Strategy B** — Tier 2 self-contained. PR #37 already decided that production + quality
mock generators can't be byte-ported (Java LCG seeded sequence ≠ Python Mersenne Twister), so
Java-side data is itself synthetic. Empty fields are no-info-loss.

⚠️ **Frontend impact check (Q-3 §10)**: Web-Admin Dashboard.vue may have UI elements that error
when `production`/`quality` fields are missing/empty. Operator must confirm at Tier 2 kickoff.

---

## 7. Phase 2C-Tier-2 Phases A–D plan

T6-style staged execution per Phase 2A precedent.

### 7.1 Phase 2C-Tier-2-A — Spec finalization (1–2 weeks)

This doc + 4-cycle audit:
- Round 1: self-review (this doc, complete)
- Round 2: evidence-based grep verify (all method names verified per HARD rule today)
- Round 3: subagent reviewer audit on §1+§2+§3 + §5
- Round 4: cross-spec audit (cite Tier 1 design + PR #178 + PR #152 + Rule 1–12)
- Round 5: fresh subagent audit post-write before push

Deliverable: this design doc lock-in.

### 7.2 Phase 2C-Tier-2-B — Impl PR chain (~3–4 weeks)

Per-endpoint or per-sub-domain PR slicing (parallel sister chats):

| PR | Scope | LOC est | Dryrun goldens needed |
|---|---|---:|---|
| PR-A | `dashboard_executive.py` skeleton + #7 (custom range) impl + tests | ~400 | F999 + F001 |
| PR-B | #3 (`getExecutiveDashboard`) full composite impl + augmentation logic | ~800 | F999 + F001 + 1 customer |
| PR-C | #9 (`getUnifiedDashboard`) parallel fanout + UnifiedDashboardResponse Lombok 9.3 audit | ~600 | F999 + F001 + 1 customer |
| PR-D | #4 + #5 + #6 (insights endpoints + SSE alias) | ~300 | SSE structure goldens |
| PR-E | `dashboard_adaptive_chart.py` + #1 + #2 (LLM chart generator port) | ~700 | LLM-output structure goldens |
| PR-F | `dashboard_dynamic.py` + #10 + #11 + FIX-13 cache table ORM + migration | ~600 | F999 + F001 |
| PR-G | `dashboard_recommendation.py` (`generateAllAlerts` aggregator) | ~300 | F001 |
| PR-H | empty-response helpers + Pattern 1/2/3 envelope tests | ~200 | F999 (empty case) |
| PR-I | F1 (impl) golden cross-tier audit (Rule 9.2 / 9.3 / Map.of order swept) | doc | — |
| PR-J | nginx Tier 2 regex update (pre-cutover, dry-run config) | ~30 | nginx -t pass |

Total est ~3,930 LOC across 10 PRs. Per Phase 2A precedent (Appendix A in PR #152): ~7 LOC/min in
spec-locked impl chats, ~2–3 weeks impl, ~1 week dryrun + golden recording.

### 7.3 Phase 2C-Tier-2-C — Cutover (~1 week)

T6-style 5-stage cascade per §6.2 above. Per HARD rule active-E2E, cutover compressed to
~3–5 hours actual when stages are sequential, with active Playwright probing at each stage.

Pre-cutover GO criteria:
- T6.1-equivalent dryrun match rate ≥99% sustained for 22h+ (sidecar Python on test factories)
- All composite endpoints' goldens match (Pattern 1/2/3 empty + Pattern A active)
- SSE structure parity verified (event types + framing per §4.3)
- Frontend Web-Admin Dashboard.vue + RN regression tested
- Rollback rehearsal documented (per T6.4 model)
- Operator + Steve sign-off

### 7.4 Phase 2C-Tier-2-D — Java cleanup (~3 days)

After 30-day soak post-cutover:
- Delete `controller/SmartBIDashboardController.java`
- Remove constructor injection of `adaptiveChartGenerator` + `dynamicAnalysisService` +
  `agentInsightsClient` from any other Java controller (they should have no other callers
  per PR #178 §3.2; verify pre-deletion)
- Delete `service/smartbi/chart/AdaptiveChartGenerator.java` + `AdaptiveChartGeneratorImpl.java`
- Delete `service/smartbi/DynamicAnalysisService.java` + `DynamicAnalysisServiceImpl.java`
- Delete `service/smartbi/SmartBIService.getExecutiveDashboard*` + `getDashboardLLMInsights*` +
  `getDataDateRange` methods (per PR #178 §3.2.a method-level audit recommendation, NOT
  whole-class deletion since `SmartBIService` is shared with PublicDemo)
- Delete `client/AgentInsightsClient.java` (only Tier 2 used it)
- Delete `dto/smartbi/chart/AdaptiveChartRequest.java` + `AdaptiveChartResponse.java`

Keep `dto/smartbi/UnifiedDashboardResponse.java` + `DashboardResponse.java` + `AIInsight.java` +
`DateRange.java` — used by PublicDemo + Upload (KEEP per spec §1.2).

---

## 8. Estimated effort

Per-component breakdown:

| Component | Spec | Impl | Dryrun | Cutover |
|---|---:|---:|---:|---:|
| §1.1 #1 + #2 adaptive chart | 1w | 2w | 0.5w | 0.5d |
| §1.1 #3 / #7 single-composite | 0.5w | 1.5w | 0.5w | 0.25d |
| §1.1 #9 multi-composite | 0.5w | 1.5w | 0.5w | 0.25d |
| §1.1 #4 / #5 / #6 LLM + SSE | 0.5w | 1w | 0.5w | 0.25d |
| §1.1 #8 data-date-range (re-verify) | — | — | — | — |
| §1.1 #10 / #11 dynamic analysis | 0.5w | 1.5w | 0.5w | 0.25d |
| Cross-tier audits + Rule 9 sweep | 0.5w | — | — | — |
| **Subtotal** | **~3w** | **~7w** | **~2.5w** | **~1.5d** |

Plus ~1 week T6-style cutover + 30-day soak window + ~3 days Java cleanup.

**Total wall-clock**: ~14 weeks (~3.5 months) from Phase 2C-Tier-2-A kickoff to Tier 2 fully retired.

PR #152 §6.2 estimated 2 months — that estimate didn't account for SSE infra (now reduced thanks
to Phase 2A reuse) but underestimated composite golden-recording effort (3 composite endpoints, each
~1 week effort). Net adjustment: ~2.5 months → ~3.5 months realistic, with ~6 parallel sister chats.

---

## 9. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|:-:|:-:|---|
| R-1 | Composite endpoint goldens diverge between F999 / F001 / production-customer due to data shape | M | M | Record at least 3 factories' goldens per composite (#3 / #7 / #9); cross-factor diff each |
| R-2 | UnifiedDashboardResponse Rule 9.3 derived getter order misses (alertCount / urgentAlertCount / highPriorityRecommendationCount appear in wrong order) | H | M | Mandatory golden-record + Map.of/Lombok order verify at impl PR-C; cite Rule 9.3 in spec checklist |
| R-3 | Production+Quality empty-mirror breaks frontend Web-Admin Dashboard.vue (UI components error on missing fields) | M | M | Q-3 prereq operator deliverable; if frontend breaks, port Production+Quality to Python in Tier 2 (out of scope today) |
| R-4 | DynamicAnalysisService LCG-seeded mock data divergence between Java (`Random(factoryId.hashCode())` LCG) and Python (Mersenne Twister) | L | M | Per PR #37 — production+quality already deferred for this reason; Tier 2 dynamic uses real DB query, not mocks |
| R-5 | LLM nondeterminism breaks endpoint #1 + #2 + #4 + #5 + #6 byte-shape parity tests | H | M | Use structure-only test for LLM endpoints (event type / schema / framing match); content not asserted (§4.3) |
| R-6 | SSE chunk timing regression (Python perceived slower than Java relay) | L | L | Python alias call is in-process (saves ~10ms over Java's HTTP relay); should be FASTER, not slower |
| R-7 | `smart_bi_pg_analysis_results` cache table column drift between Java JPA + Python ORM mappings | M | M | Use `apply-smartbi-migrations.sh` runner per HARD rule; goldens compare via SQL not ORM |
| R-8 | nginx regex update bumps a regex group ID and breaks unrelated existing routes | L | H | Pre-cutover: `nginx -t` + rollback rehearsal mandatory; backup vhost file `bak.t6_2c_pre.<ts>` |
| R-9 | Tier 2 + Tier 1 + Tier 3 + Tier 4 sister chats step on smartbi_compat module reorg | M | L | Worktree isolation per chat; coordination doc in `docs/superpowers/dispatch/`; module file layout per §6.3 prescriptive |
| R-10 | Java-side `generateAllAlerts` aggregator depends on per-domain helpers that may not exist in Python (Phase 2A scope was per-domain alerts only) | M | M | PR-G specifically tackles; cross-reference each Java per-domain alert call with Python equivalent at spec-write time |
| R-11 | FIX-13 cache invalidation behavior diverges (Java: cache HIT log includes age; Python may not) | L | L | Match log format byte-for-byte; goldens for cache HIT/MISS at impl PR-F |
| R-12 | LLM model migration mid-port (DashScope deprecates qwen-* model) | L | M | Pin exact model in Python alias; flag in Phase 2C ops doc |
| R-13 | F999 internal traffic for #3 / #7 / #9 still hits Java post-cutover (per PR #178 — F999 not in nginx regex), creating dual-implementation drift | M | M | Document F999-stays-Java explicitly in cutover doc; if F999 starts seeing usage, port F999 to Python as Phase 2C-Tier-2-D add-on |
| R-14 | DTO `dataVersion` Java emits `String.valueOf(System.currentTimeMillis())` (millisecond precision) — Python `time.time() * 1000` may round differently on some platforms | L | L | Use `int(time.time() * 1000)` then `str()` to mirror Java exactly |

---

## 10. Open questions for Phase 2C Tier 2 reviewer

These need explicit answers BEFORE Phase 2C-Tier-2-B kickoff:

### Q-1 — `AdaptiveChartGenerator` port strategy

§1.1 lists Option A (mirror Java byte-for-byte) vs Option B (retire endpoint, route frontend
to existing `/api/smartbi/chart/*`). Operator decision.

Recommendation: Option A (PR #152 §6.2 implies this), pending frontend code-path map
confirmation (Q-3).

### Q-2 — Composite endpoint cache strategy

§5.4 recommends no-cache parity for Tier 2 (Java currently no-caches #3 / #7 / #9). Reviewer:
do we need Redis-backed 5-min cache for Tier 2 to handle expected post-cutover traffic? Phase 2A
didn't benchmark composites.

### Q-3 — Frontend code-path map

Same as PR #152 Q-3 — operator deliverable for Tier 2:
- Vue Dashboard.vue / RN factory dashboard which Tier 2 endpoints they hit
- API call traces (browser DevTools / RN flipper) for top customer journeys
- Confirmation that frontend tolerates Production+Quality empty fields (Strategy B in §6.4)
- AdaptiveChartRequest exact shape verification (whether fusionEnabled / preferredChartType
  ever set by frontend or always default)

### Q-4 — Strict-byte gate for SSE framing

§4.3 recommends strict-byte for SSE framing; dict-eq for JSON event payload. Reviewer: confirm
or override? Strict-byte for `\n\n` delimiter is tightly scoped — only ~3–4 sites matter.

### Q-5 — DynamicAnalysisService PG cache table addition strategy

§1.1 + §6.3 propose adding a Python ORM mapping for `smart_bi_pg_analysis_results`. Phase 2C
must:
- Decide if this table stays in `smartbi_prod_db` (current Java location) or migrates to
  `cretas_prod_db` (Python's main DB).
- Run a migration through `apply-smartbi-migrations.sh` if schema changes (e.g., adding indexes
  for Python ORM fast-lookup).

### Q-6 — Tier 2 vs Tier 4 PublicDemo overlap

PR #178 §3.2.a notes `recommendationService` + `salesAnalysisService` + `departmentAnalysisService`
are shared between Tier 2 (Dashboard) and Tier 4 (PublicDemo). If Tier 4 sunsets per PR #152
recommendation, the shared services lose one consumer — does that change Tier 2's port priorities?
Operator decision, especially around Q-1 chart port (PublicDemo also calls AdaptiveChartGenerator).

### Q-7 — Tier 2 chat coordination model

Per PR #152 Q-6: same parallel-chat model as Phase 2A (4–6 chats with organizer)? Or sequential
1-chat-per-PR? Sister-chat coordination per HARD rules (May 9 graduates):
- Marching order method names: grep real source ✓
- Audit ✓ marks must verify endpoint impl, not router file ✓
- Sister-chat independent cross-verify high-value ✓
- Organizer dispatches sister chats, not hands-on ✓

Recommend: 4 parallel sister chats per Tier 2 — Chat A (PR-A + PR-B + PR-C composite series),
Chat B (PR-E adaptive chart), Chat C (PR-F dynamic analysis), Chat D (PR-D insights + SSE alias);
PR-G + PR-H assigned to whoever finishes first; PR-I cross-tier audit by organizer.

---

## 11. Parallel work analysis (per `parallel-work-analysis.md`)

### Subagent (single chat, this design):
- ✅ Endpoint inventory grep + Java service signature verify (all 13 + 6 verified)
- ✅ Phase 2A Python primitive coverage check (5/6 confirmed exist; region needs thin extractor)
- ✅ DTO Lombok flag audit (all 6 DTOs identified, derived-getter risk surfaced)
- ❌ Cross-tier coordination decisions (need organizer + sister chats)

### Multi-chat (Phase 2C-Tier-2-B impl):
- ✅ PR-A through PR-H impl PRs in parallel (different files / modules)
- ✅ Tier 1 + Tier 2 + Tier 3 spec writing in parallel (different docs)
- ❌ nginx regex update cutover (Tier 2-D PR-J — must serialize)
- ❌ FIX-13 cache table migration (Tier 2-B PR-F — uses smartbi-migrations runner, must serialize per HARD rule)

### Conflict risk:
- Low for spec drafts (different docs).
- Medium for impl (shared `smartbi_compat/api/dashboard*.py` files — file layout per §6.3 prescribes
  per-PR file ownership; sister chats stay in their assigned module).
- HIGH for cutover (single nginx vhost; per HARD rule pause-before-deploy, organizer-only).

---

## Appendix A — Phase 2A precedent reference

For Tier 2 sizing baseline:

| Metric | Phase 2A actual | Tier 2 Estimated |
|---|---|---|
| Total endpoints ported | 50 | 11 |
| Total LOC ported (Python) | ~10,000 | ~3,900 |
| Total spec docs | ~20 | 1 + per-PR appendices |
| Total PRs | ~150 | 10 (A–J) |
| Total chats coordinated | 4–6 parallel | 4 parallel |
| Duration (kickoff → cutover GO) | ~7 weeks (Apr 28 → May 14, 2026) | ~12 weeks (Phase 2C kickoff → Tier 2 cutover GO) |
| Codified rules graduated | 12 (Rule 1–12) | 0 expected (rules already mature) |
| Pattern B latents found | 2 (finance + sales) | 0 expected (composites use Phase 2A primitives) |
| Dryrun match rate target | ≥99.945% | ≥99% (composite + LLM nondeterminism degrades target) |
| Cutover stages | 5 | 5 |

Per-endpoint average: Tier 2 ~360 LOC + ~1 PR each (more concentrated than Phase 2A's per-endpoint
avg of ~200 LOC + ~3 PRs because composites pack more logic per route).

---

## Appendix B — File layout (post-Tier-2)

```
backend/python/smartbi_compat/
├── api/
│   ├── analysis_*.py             # Phase 2A (50 endpoints, untouched)
│   ├── config_*.py               # Phase 2C Tier 1 (41 endpoints, 8 sub-modules per Tier 1 design)
│   ├── dashboard.py              # /data-date-range Phase 2A T5 PoC (KEEP)
│   ├── dashboard_executive.py    # NEW Tier 2 (#3, #4, #5, #6, #7, #9)
│   ├── dashboard_adaptive_chart.py  # NEW Tier 2 (#1, #2)
│   └── dashboard_dynamic.py      # NEW Tier 2 (#10, #11)
├── services/
│   ├── dashboard_orchestrator.py    # NEW Tier 2 (composite logic)
│   ├── adaptive_chart_generator.py  # NEW Tier 2 (LLM chain)
│   ├── dynamic_analysis.py          # NEW Tier 2 (dataset analyzer)
│   ├── dashboard_recommendation.py  # NEW Tier 2 (alerts + recs aggregator)
│   └── empty_response.py            # NEW Tier 2 (Pattern 1/2/3 envelopes)
└── (Phase 2A unchanged + Tier 1 added per Tier 1 design)

backend/python/smartbi/database/models/
└── smart_bi_pg_analysis_result.py   # NEW Tier 2 ORM (FIX-13 cache for #11)

backend/java/cretas-api/src/main/java/com/cretas/aims/controller/
├── (analysis controllers REMOVED in T6.5)
├── (config controller removed end Phase 2C Tier 1)
├── (dashboard controller removed end Phase 2C Tier 2)  ← THIS DOC
├── (upload controller removed end Phase 2C Tier 3)
└── (public demo removed/redirected per Tier 4 decision)

backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/
├── chart/ (REMOVED — only Tier 2 used these)
├── DashboardResponse.java         # KEEP (used by PublicDemo + Upload)
├── UnifiedDashboardResponse.java  # KEEP (used by PublicDemo)
├── AIInsight.java                 # KEEP (used by PublicDemo + agent)
└── DateRange.java                 # KEEP (used widely)
```

---

## Status

This is a **design doc only**. Phase 2C-Tier-2-B kickoff requires:
- T6.5 Phase C complete.
- Tier 1 design sign-off (Chat E PR-W in flight).
- Q-1 through Q-7 above answered.
- Operator + Steve sign-off.
- Estimated kickoff: ~2026-09 to 2026-10, contingent on Tier 1 timeline.

Pre-push HOLD: per ⛔ HOLD in marching order, sister chat must STOP and ping Steve before
`git push`. Endpoint count drift (17 vs 11) and Tier 1 design path drift (file did exist in
worktree, just not on main yet) are flagged at handoff.
