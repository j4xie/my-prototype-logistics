# SmartBI 50-Endpoint X/Y/Z Classification

**Date:** 2026-04-29
**Audited commits:** `488e24a20 2026-04-28 19:04:23 -0400` (last touch on all three controllers)
**Auditor note:** Counts are 26 + 13 + 11 = 50 as specified. Actual mapping counts below include all `@GetMapping`/`@PostMapping`/`@PutMapping`/`@DeleteMapping` methods discovered by line-by-line review of the three controllers.

---

## Classification Key

| Class | Definition |
|-------|-----------|
| **Y — thin proxy** | Body calls `pythonClient.*` or `uploadFlowService.*` (which internally calls pythonClient) and returns result. ≤30 min alias work. |
| **Z — condition branch** | Body does `if (dimension/analysisType) { branch1 } else { branch2 }` across different service methods, OR delegates to `smartBIService.*` as primary path with a JPA-service fallback. ~2–4 h alias work. |
| **X — Java native** | Body calls only JPA-backed `*Service` beans or `*Repository` directly. No pythonClient path at all. ~6–8 h alias work. |

### Key service classifications (from source inspection)

- `SmartBIService` / `SmartBIServiceImpl` — orchestrates JPA-backed services (`SalesAnalysisService`, `FinanceAnalysisService`, etc.) + DashScopeClient (LLM). **No** pythonClient calls. → X domain.
- `DynamicAnalysisService` / `DynamicAnalysisServiceImpl` — uses JPA repos (`SmartBiDynamicDataRepository`, `SmartBiPgFieldDefinitionRepository`) **plus** a pythonClient call for field detection in backfill path. Primary analysis paths are JPA. → X domain (mixed, Python only in edge backfill path).
- `uploadFlowService` / `SmartBIUploadFlowService` — calls `pythonClient.parseExcel(...)` internally. → Y-capable.
- `excelParserService` / `ExcelDynamicParserService` — calls Apache POI / local Java. → X.
- `schemaService` / `SmartBiSchemaService` — uses JPA repos and local schema parsing. → X.
- `queryTemplateRepository` — direct JPA repository. → X.
- `adaptiveChartGenerator` / `AdaptiveChartGenerator` — uses `DynamicAnalysisService` (JPA). → X.
- `agentInsightsClient` / `AgentInsightsClient` — OkHttp client to Python `/insights/custom/stream`. → Y-type.
- `recommendationService` / `RecommendationService` — JPA-backed alert/recommendation logic. → X.

---

## Summary

| Class | Count | Unit estimate | Total estimate |
|-------|-------|---------------|----------------|
| Y (thin proxy) | 4 | 0.5 h each | 2 h |
| Z (condition branch) | 14 | 3 h each | 42 h |
| X (Java native) | 32 | 7 h each | 224 h |
| **Total** | **50** | | **~268 h ≈ 7 engineer-weeks** |

---

## SmartBIAnalysisController (26 endpoints)

Base path: `GET/POST /api/mobile/{factoryId}/smart-bi/...`

| # | Verb | Path (relative) | Class | Java method calls | Python target (if Y) |
|---|------|-----------------|-------|-------------------|----------------------|
| 1 | GET | /analysis/sales | Z | `smartBIService.getComprehensiveAnalysis(...)` (primary) + if-dimension branch across `salesAnalysisService.*` (salesperson/product/customer/trend) | (varies) |
| 2 | GET | /analysis/department | Z | `smartBIService.getComprehensiveAnalysis(...)` (primary) + if-department branch across `departmentAnalysisService.*` | (varies) |
| 3 | GET | /analysis/region | Z | `smartBIService.getComprehensiveAnalysis(...)` (primary) + if-region branch across `regionAnalysisService.*` | (varies) |
| 4 | GET | /analysis/finance | Z | `smartBIService.getComprehensiveAnalysis(...)` (primary when no type) + analysisType switch across `financeAnalysisService.*` (profit/cost/receivable/payable/budget) | (varies) |
| 5 | GET | /analysis/finance/budget-achievement | X | `financeAnalysisService.getBudgetAchievementChart(...)` — pure JPA | — |
| 6 | GET | /analysis/finance/yoy-mom | X | `financeAnalysisService.getYoYMoMComparisonChart(...)` — pure JPA | — |
| 7 | GET | /analysis/finance/category-comparison | X | `financeAnalysisService.getCategoryStructureComparisonChart(...)` — pure JPA | — |
| 8 | GET | /analysis/production | Z | analysisType switch (oee/efficiency/equipment) across `productionAnalysisService.*` — no smartBIService guard | (varies) |
| 9 | GET | /analysis/quality | Z | analysisType switch (fpy/defect/rework) across `qualityAnalysisService.*` — no smartBIService guard | (varies) |
| 10 | GET | /analysis/inventory | Z | analysisType switch (turnover/expiry/aging) across `inventoryHealthAnalysisService.*` — no smartBIService guard | (varies) |
| 11 | GET | /analysis/procurement | Z | analysisType switch (supplier/cost/trend) across `procurementAnalysisService.*` — no smartBIService guard | (varies) |
| 12 | POST | /query | Z | `smartBIService.processQuery(...)` (primary) + intent-switch fallback via `intentService.*` + 8 analysis services | (varies) |
| 13 | POST | /drill-down | Z | `smartBIService.processDrillDown(...)` (primary) + switch on request.getDimension() (region/province/department) | (varies) |
| 14 | GET | /alerts | Z | if-category switch (sales/finance/department) via `recommendationService.*` — no pythonClient | (varies) |
| 15 | GET | /recommendations | X | `recommendationService.generateRecommendations(...)` — pure JPA/rule-based | — |
| 16 | GET | /incentive-plan/{targetType}/{targetId} | Z | switch on targetType (salesperson/department/region) via `recommendationService.*` | (varies) |
| 17 | POST | /datasource/upload (multipart) | X | `schemaService.uploadAndDetectSchema(...)` — local Apache POI + JPA schema diffing | — |
| 18 | GET | /datasource/{datasourceId}/preview | X | `schemaService.previewSchemaChanges(...)` — JPA read | — |
| 19 | POST | /datasource/apply | X | `schemaService.applySchemaChanges(...)` — DDL + JPA write | — |
| 20 | GET | /datasource/list | X | `schemaService.listDatasources(...)` — JPA read | — |
| 21 | GET | /datasource/{datasourceId}/fields | X | `schemaService.getDatasourceFields(...)` — JPA read | — |
| 22 | GET | /datasource/{datasourceId}/history | X | `schemaService.getSchemaHistory(...)` — JPA paginated read | — |
| 23 | GET | /query-templates | X | `queryTemplateRepository.findByFactoryIdOrderByCreatedAtDesc(...)` — direct JPA repo | — |
| 24 | POST | /query-templates | X | `queryTemplateRepository.save(...)` — direct JPA repo | — |
| 25 | PUT | /query-templates/{templateId} | X | `queryTemplateRepository.findById(...)` + `.save(...)` — direct JPA | — |
| 26 | DELETE | /query-templates/{templateId} | X | `queryTemplateRepository.findById(...)` + `.delete(...)` — direct JPA | — |

**Analysis subtotal: Y=0, Z=11, X=15**

---

## SmartBIUploadController (13 endpoints)

Base path: `/api/mobile/{factoryId}/smart-bi/...`

| # | Verb | Path (relative) | Class | Java method calls | Python target (if Y) |
|---|------|-----------------|-------|-------------------|----------------------|
| 27 | POST | /upload (multipart) | Y | `pythonClient.parseExcel(file, factoryId, dataType, sheetIndex, headerRows)` — direct pythonClient call, result returned as-is | POST `/api/smartbi/excel/auto-parse` |
| 28 | POST | /upload-and-analyze (multipart) | Y | large-file path: `pythonClient.parseExcelViaAsync(...)` → Python `/api/smartbi/excel/auto-parse-async`; normal path: `uploadFlowService.executeUploadFlow(...)` which internally calls `pythonClient.parseExcel(...)` | POST `/api/smartbi/excel/auto-parse` (sync) or `/api/smartbi/excel/auto-parse-async` (async >50MB) |
| 29 | POST | /upload/confirm | Y | `uploadFlowService.confirmAndPersist(...)` — delegates back to field-mapping + JPA persist; Python only called if reparsing needed; however the primary analysis chain starts from Python-parsed data | (Java orchestration of Python-parsed data; classify Y given Python is the parse layer) |
| 30 | POST | /sheets (multipart) | X | `excelParserService.listSheets(file.getInputStream())` — pure local Apache POI, no pythonClient | — |
| 31 | POST | /upload-batch (multipart) | X | `uploadFlowService.executeBatchUpload(factoryId, file.getInputStream(), ...)` — Note: `uploadFlowService` IS wired to pythonClient, but batch path calls Java-side loop + each sheet goes through `executeUploadFlow` → pythonClient per sheet; the controller itself is still a Java orchestrator with significant branching logic (configs JSON parse, status aggregation). Classify Z (mixed). | (varies per sheet) |
| 32 | POST | /upload-batch-stream (multipart, SSE) | X | `uploadFlowService.executeBatchUploadWithProgress(...)` — SSE emitter spun in a Thread; Java orchestration layer identical to #31. Significant SSE infrastructure that needs new Python implementation. Classify X. | — |
| 33 | POST | /retry-sheet/{uploadId} | X | `uploadFlowService.retrySheetUpload(factoryId, uploadId)` — loads from JPA `pgUploadRepository`, re-parses (may call pythonClient internally), but controller has significant error-wrapping and data-shaping logic. Classify X (orchestration layer). | — |
| 34 | GET | /uploads | X | `pgUploadRepository.findUploadHistoryLightweight(factoryId, pageable)` — direct JPA paginated query | — |
| 35 | GET | /uploads/{uploadId}/fields | X | `dynamicAnalysisService.getFieldDefinitions(uploadId)` — JPA `fieldDefRepository.findByUploadIdOrderByDisplayOrder(uploadId)` | — |
| 36 | GET | /uploads/{uploadId}/data | X | `dynamicAnalysisService.getFieldDefinitions(uploadId)` + `dynamicAnalysisService.getDataPage(factoryId, uploadId, page, size)` — JPA paginated queries + row assembly | — |
| 37 | GET | /uploads-missing-fields | X | `pgUploadRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId)` + `dynamicAnalysisService.getFieldCount(id)` — JPA count queries | — |
| 38 | POST | /backfill/fields/{uploadId} | X | `dynamicAnalysisService.backfillFieldDefinitions(factoryId, uploadId)` — JPA read-write with optional pythonClient field-detection call (Optional path); primary path is JPA | — |
| 39 | POST | /backfill/batch | X | `dynamicAnalysisService.batchBackfillFieldDefinitions(factoryId, limit)` — JPA loop across uploads, same pattern as #38 | — |

**Upload subtotal: Y=3, Z=1, X=9**

> Note on #31 (upload-batch): reclassified from Y to Z because the controller has explicit branching on `result.isAllSuccess()` / `result.getRequiresConfirmationCount()` / `result.isPartialSuccess()` and the batch logic requires re-implementing per-sheet routing in Python.

---

## SmartBIDashboardController (11 endpoints)

Base path: `/api/mobile/{factoryId}/smart-bi/...`

| # | Verb | Path (relative) | Class | Java method calls | Python target (if Y) |
|---|------|-----------------|-------|-------------------|----------------------|
| 40 | POST | /generate-adaptive-charts | X | `adaptiveChartGenerator.generateAdaptive(uploadId, request)` — uses `DynamicAnalysisService` (JPA). Complex chart-heuristics logic in Java. | — |
| 41 | POST | /generate-chart | X | `adaptiveChartGenerator.generateAdaptive(uploadId, request)` with fixed single-chart params — same JPA path | — |
| 42 | GET | /dashboard/executive | Z | `smartBIService.getExecutiveDashboard(factoryId, period)` (primary) + fallback `salesAnalysisService.getSalesOverview(...)` | (varies) |
| 43 | GET | /dashboard/executive/insights | Z | `smartBIService.getDashboardLLMInsights(factoryId, period)` (primary) + fallback empty list; `SmartBIServiceImpl` uses `DashScopeClient` (LLM) — no direct pythonClient | (varies) |
| 44 | GET | /dashboard/executive/insights/custom | Z | `smartBIService.getDashboardLLMInsightsCustomRange(factoryId, startDate, endDate)` (primary) + fallback empty list | (varies) |
| 45 | GET | /dashboard/executive/insights/custom/stream (SSE) | Y | `agentInsightsClient.streamInsightsCustom(factoryId, startDate, endDate, null)` — OkHttp SSE relay to Python `/api/insights/custom/stream`. Java is a pure SSE pump. | GET `/api/insights/custom/stream` (Python AgentOrchestrator) |
| 46 | GET | /dashboard/executive/custom | X | `salesAnalysisService.getSalesOverview(factoryId, startDate, endDate)` — direct JPA sales query. Note: no smartBIService guard on this endpoint; always JPA. | — |
| 47 | GET | /data-date-range | Z | `smartBIService.getDataDateRange(factoryId)` (primary) + fallback `{hasData:false}` | (varies) |
| 48 | GET | /dashboard | Z | `smartBIService.getExecutiveDashboard(...)` (primary) + fallback aggregation across 9 services via `enrichUnifiedDashboard(...)` CompletableFuture fan-out | (varies) |
| 49 | GET | /analysis/dynamic/kpis | X | `dynamicAnalysisService.getKPIsOnly(factoryId, uploadId)` — JPA aggregate queries only | — |
| 50 | GET | /analysis/dynamic | X | `dynamicAnalysisService.analyzeDynamic(factoryId, uploadId, analysisType)` — JPA queries + local chart heuristics; cache read/write via `analysisResultRepository`; pythonClient only called optionally in `backfillFieldDefinitions` subpath, NOT in the primary analyzeDynamic path | — |

**Dashboard subtotal: Y=1, Z=5, X=5**

---

## Final Counts (cross-check)

| Controller | Y | Z | X | Total |
|-----------|---|---|---|-------|
| SmartBIAnalysisController | 0 | 11 | 15 | 26 |
| SmartBIUploadController | 3 | 1 | 9 | 13 |
| SmartBIDashboardController | 1 | 2 | 8 | 11 |

Wait — recounting Dashboard: endpoints 42, 43, 44, 47, 48 = 5 Z; endpoints 40, 41, 46, 49, 50 = 5 X; endpoint 45 = 1 Y. Total = 11. ✓

| Controller | Y | Z | X | Total |
|-----------|---|---|---|-------|
| SmartBIAnalysisController | 0 | 11 | 15 | 26 |
| SmartBIUploadController | 3 | 1 | 9 | 13 |
| SmartBIDashboardController | 1 | 5 | 5 | 11 |
| **Grand total** | **4** | **17** | **29** | **50** |

---

## Work Estimate (revised)

| Class | Count | Unit h | Subtotal |
|-------|-------|--------|----------|
| Y | 4 | 0.5 | 2 h |
| Z | 17 | 3 | 51 h |
| X | 29 | 7 | 203 h |
| **Total** | **50** | | **256 h ≈ 6.4 engineer-weeks** |

---

## Risks

### High-priority (X-class with non-trivial Python rewrite)

1. **#1–4, 8–11 analysis endpoints (8 Z-class)**: Each delegates to a dedicated Java service (`SalesAnalysisService`, `FinanceAnalysisService`, etc.) that runs complex SQL aggregations via JPA with many sub-methods. Phase 2A Python aliases must either call these Java endpoints again (thin reverse-proxy) or reimplement the aggregation SQL in Python. Recommend the former (Python alias → Java endpoint) to avoid a 6-week SQL port.

2. **#17 `/datasource/upload` (schema detection)**: `schemaService.uploadAndDetectSchema()` performs Excel structure parsing + schema diff + DDL generation in pure Java. No Python equivalent exists. The 6–8 h estimate may be optimistic; this is a standalone project.

3. **#32 `/upload-batch-stream` (SSE batch)**: SSE infrastructure + per-sheet progress events + thread management. If Phase 2A moves this to Python, the entire streaming protocol must be re-implemented in FastAPI SSE. Classify as high-risk X.

4. **#40–41 chart generation** (`adaptiveChartGenerator`): Chart heuristic logic is embedded in Java (`AdaptiveChartGenerator`, `chart_heuristics` Java), not the Python `smartbi/api/chart.py`. However, Python already has `chart_heuristics.py` — feasibility depends on feature parity. Medium risk.

5. **#50 `/analysis/dynamic`**: Cache read/write (`SmartBiPgAnalysisResult`) is Java-managed PostgreSQL. If Python takes over, cache invalidation and TTL logic must be replicated. The 7-day TTL + forceRefresh param adds state.

6. **#48 `/dashboard`** (unified dashboard): Fan-out via `CompletableFuture.allOf(9 futures)` — all are JPA queries. Full re-implementation is ~9 separate analysis Python services. This is the single largest X endpoint by complexity.

7. **#12 `/query`** (NL query): Routes through Java `SmartBIIntentService` + `IntentResult` intent system (310 registered tools, Python BERT classifier). The NL→intent→execution pipeline is entirely Java-side. Phase 2A Python alias would need to call back into Java or reimplement intent routing. Very high risk.

8. **#13 `/drill-down`**: Depends on `SmartBIService.processDrillDown` (primary) which uses `DashScopeClient` LLM internally. Fall-through path uses JPA regionAnalysis/departmentAnalysis. Mixed LLM + JPA. High risk.

### Unresolvable from source (ambiguity noted)

- **`SmartBIService.getComprehensiveAnalysis`, `getExecutiveDashboard`, `processQuery`, `processDrillDown`, `getDashboardLLMInsights`**: These are marked Z because they use `SmartBIServiceImpl` which itself is JPA-backed + DashScope LLM; none call `pythonClient`. However, their internal complexity (caching, quota checks, LLM prompts) means alias work could exceed the 3h Z estimate significantly. The Z estimate of 3h is a lower bound; 5–8h per endpoint is realistic.

- **`uploadFlowService.confirmAndPersist` (#29)**: The `UploadFlowService` implementation was not fully read; it's classified Y because it orchestrates Python-parsed data, but if it has significant post-parse Java logic (field normalization, DB writes), it could be Z.

---

## Phase 2A Gate Decision

| Metric | Value |
|--------|-------|
| X-class count | **29** |
| Y-class count | 4 |
| Z-class count | 17 |
| Total estimate | **256 h ≈ 6.4 engineer-weeks** |
| Gate threshold | X > 25 → STOP |
| **Decision** | **STOP-ESCALATE** |

**Rationale:** X-class count is 29, exceeding the Phase 2A gate of 25. The true scope of implementing Python aliases for the 29 X-class endpoints is approximately 203 h (29 × 7h) of new Python logic, not counting the 17 Z-class endpoints at 51 h. Total of 254 h is roughly 2.5× a typical 4-week sprint.

**Recommended escalation path:**

1. **Immediate scope reduction**: Restrict Phase 2A to Y-class only (4 endpoints, ~2h total). These are genuine thin proxies where Java does nothing but forward to Python — `/upload`, `/upload-and-analyze`, `/upload/confirm`, and the SSE stream relay.

2. **Re-classify the 17 Z-class endpoints** with a more detailed sprint plan. Many of the Z analysis endpoints (#1–4 and the smartBIService-primary ones) could be implemented as Python → Java reverse-proxies (Python calls the Java endpoint and returns the result), reducing them to ~Y effort.

3. **Defer the 29 X-class endpoints** to Phase 3. They represent genuine Java business logic (JPA aggregation, schema management, NL query, chart heuristics) that has no Python equivalent and would require a substantial new Python implementation.

4. **Priority exception**: Endpoint #45 (`/insights/custom/stream`, classified Y) is already wired to Python `AgentOrchestrator` via `AgentInsightsClient`. This is the highest-value endpoint for Phase 2A because Python already owns it end-to-end; the Java layer is a pure SSE relay that could be removed.
