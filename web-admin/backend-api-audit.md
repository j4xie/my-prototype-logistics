# Backend API Audit Report (A4)
Date: 2026-02-11

## Executive Summary

| Metric | Count |
|--------|-------|
| Java endpoints audited | 42 (SmartBIController: 37, SmartBIConfigController: ~20, ReportController: ~15) |
| Python endpoints audited | 25+ (across 5 API modules + main.py routes) |
| Critical issues | 5 |
| High issues | 8 |
| Medium issues | 12 |
| Low / Informational | 7 |

The SmartBI backend is a large, feature-rich module spanning two languages (Java + Python). The architecture is generally well-structured with a clear facade pattern. However, the audit uncovered several critical security gaps (unauthenticated admin endpoints, no auth on Python service, missing file size validation on uploads), significant performance concerns (N+1 queries, sequential dashboard aggregation, unbounded list returns), and three frontend API calls that have no corresponding backend handler.

---

## 1. Endpoint Coverage Matrix

### Frontend (web-admin/src/api/smartbi.ts) to Java Backend Mapping

| Frontend Call | HTTP Method | URL Path | Java Handler | Status |
|---|---|---|---|---|
| `uploadExcel` | POST | `/{factoryId}/smart-bi/upload` | `SmartBIController.uploadExcel` L154 | OK |
| `uploadAndAnalyze` | POST | `/{factoryId}/smart-bi/upload-and-analyze` | `SmartBIController.uploadAndAnalyze` L209 | OK |
| `getSalesAnalysis` | GET | `/{factoryId}/smart-bi/analysis/sales` | `SmartBIController.getSalesAnalysis` L900 | OK |
| `getDepartmentAnalysis` | GET | `/{factoryId}/smart-bi/analysis/department` | `SmartBIController.getDepartmentAnalysis` L953 | OK |
| `getRegionAnalysis` | GET | `/{factoryId}/smart-bi/analysis/region` | `SmartBIController.getRegionAnalysis` L1001 | OK |
| `getFinanceAnalysis` | GET | `/{factoryId}/smart-bi/analysis/finance` | `SmartBIController.getFinanceAnalysis` L1053 | OK |
| `drillDown` | POST | `/{factoryId}/smart-bi/drill-down` | `SmartBIController.drillDown` L1409 | OK |
| `getTrendAnalysis` | GET | `/{factoryId}/smart-bi/analysis/trend` | **MISSING** | **CRITICAL** |
| `getComparisonAnalysis` | POST | `/{factoryId}/smart-bi/analysis/comparison` | **MISSING** | **CRITICAL** |
| `exportData` | POST | `/{factoryId}/smart-bi/export` | **MISSING** | **HIGH** |
| `confirmMapping` | POST | `/{factoryId}/smart-bi/upload/confirm` | `SmartBIController` L257 | OK |
| `getDatasourceList` | GET | `/{factoryId}/smart-bi/datasource/list` | `SmartBIController` L1896 | OK |

### Frontend to Python Backend Direct Calls

| Frontend Call | HTTP Method | Python URL | Python Handler | Status |
|---|---|---|---|---|
| `chatGeneralAnalysis` | POST | `/api/chat/general-analysis` | `chat.router` (main.py L146) | OK |
| `chatDrillDown` | POST | `/api/chat/drill-down` | `chat.router` | OK |
| `chatBenchmark` | POST | `/api/chat/benchmark` | `chat.router` | OK |
| `crossSheetAnalysis` | POST | `/api/smartbi/cross-sheet-analysis` | `cross_sheet.router` (main.py L147) | OK |
| `yoyComparison` | POST | `/api/smartbi/yoy-comparison` | `yoy.router` (main.py L148) | OK |
| `buildChart` | POST | `/api/chart/build` | `chart.router` (main.py L142) | OK |
| `recommendChart` | POST | `/api/chart/recommend` | `chart.router` | OK |
| `generateInsights` | POST | `/api/insight/generate` | `insight.router` (main.py L141) | OK |
| `getCachedAnalysis` | GET | `/api/smartbi/analysis-cache/{uploadId}` | `analysis_cache.router` L37 | OK |
| `saveAnalysisToCache` | POST | `/api/smartbi/analysis-cache/{uploadId}` | `analysis_cache.router` L81 | OK |
| `invalidateAnalysisCache` | DELETE | `/api/smartbi/analysis-cache/{uploadId}` | `analysis_cache.router` L137 | OK |
| `batchBuildCharts` | POST | `/api/chart/batch` | `chart.router` | OK |
| `quickSummary` | POST | `/api/insight/quick-summary` | `insight.router` | OK |
| `forecastPredict` | POST | `/api/forecast/predict` | `forecast.router` (main.py L140) | OK |
| `statisticalAnalyze` | POST | `/api/statistical/analyze` | `statistical.router` (main.py L149) | OK |
| `statisticalCorrelations` | POST | `/api/statistical/correlations` | `statistical.router` | OK |

### Backend Endpoints with No Frontend Caller

| Java Endpoint | HTTP Method | Path | Purpose |
|---|---|---|---|
| `uploadBatch` | POST | `/upload-batch` | Batch multi-sheet upload |
| `uploadBatchStream` | POST | `/upload-batch-stream` | SSE streaming batch upload |
| `retrySheet` | POST | `/retry-sheet/{uploadId}` | Retry failed sheet |
| `generateAdaptiveCharts` | POST | `/generate-adaptive-charts` | Adaptive chart gen |
| `generateChart` | POST | `/generate-chart` | Single chart gen |
| `getExecutiveDashboard` | GET | `/dashboard/executive` | Executive dashboard |
| `getCustomExecutiveDashboard` | GET | `/dashboard/executive/custom` | Custom dashboard |
| `getDataDateRange` | GET | `/data-date-range` | Available data range |
| `getDashboard` (legacy) | GET | `/dashboard` | Unified dashboard |
| `getBudgetAchievementChart` | GET | `/analysis/finance/budget-achievement` | Budget chart |
| `getYoYMoMComparisonChart` | GET | `/analysis/finance/yoy-mom` | YoY comparison |
| `getCategoryStructureComparisonChart` | GET | `/analysis/finance/category-comparison` | Category comparison |
| `getProductionAnalysis` | GET | `/analysis/production` | Production OEE |
| `getQualityAnalysis` | GET | `/analysis/quality` | Quality FPY |
| `getInventoryAnalysis` | GET | `/analysis/inventory` | Inventory health |
| `getProcurementAnalysis` | GET | `/analysis/procurement` | Procurement analysis |
| `query` | POST | `/query` | NL query |
| `getAlerts` | GET | `/alerts` | Alert list |
| `getRecommendations` | GET | `/recommendations` | Recommendations |
| `getIncentivePlan` | GET | `/incentive-plan/{targetType}/{targetId}` | Incentive plan |
| All SmartBIConfigController CRUD | Various | `/api/admin/smartbi-config/*` | Config management |
| `uploadAndDetectSchema` | POST | `/datasource/upload` | Schema detect |
| `previewSchemaChanges` | GET | `/datasource/{datasourceId}/preview` | Schema preview |
| `applySchemaChanges` | POST | `/datasource/apply` | Schema apply |
| `getDatasourceFields` | GET | `/datasource/{datasourceId}/fields` | Field defs |
| `getSchemaHistory` | GET | `/datasource/{datasourceId}/history` | Schema history |
| `getUploadHistory` | GET | `/uploads` | Upload list |
| `analyzeDynamicData` | GET | `/analysis/dynamic` | Dynamic analysis |
| `getUploadFields` | GET | `/uploads/{uploadId}/fields` | Upload fields |
| `getUploadData` | GET | `/uploads/{uploadId}/data` | Upload data preview |
| `getUploadsMissingFields` | GET | `/uploads-missing-fields` | Diagnostic |
| `backfillFieldDefinitions` | POST | `/backfill/fields/{uploadId}` | Backfill |
| `batchBackfill` | POST | `/backfill/batch` | Batch backfill |
| `getProductionAnalysisDashboard` | GET | `/production-analysis/dashboard` | Production dash |
| `getProductionAnalysisData` | GET | `/production-analysis/data` | Production data |

**Note**: Many of these "uncalled" endpoints are used by the mobile React Native frontend (`frontend/CretasFoodTrace`) or are internal/diagnostic endpoints. The web-admin frontend only uses a subset.

---

## 2. Response Format Analysis

### Java Controllers

**File**: `backend-java/src/main/java/com/cretas/aims/controller/SmartBIController.java`

**Pattern Used**: All endpoints return `ResponseEntity<ApiResponse<T>>` wrapping `{ success, data, message }`. This is consistent with the project standard.

**Issue S-RES-1 (Medium): HTTP 200 returned for errors**
- Location: All error handlers across the entire SmartBIController (69 occurrences)
- Pattern: `return ResponseEntity.ok(ApiResponse.error("..."))`
- Problem: All errors return HTTP 200 with `success: false` in the body. While the frontend can parse this, it violates REST conventions and prevents standard HTTP error monitoring (load balancers, APM tools cannot distinguish success from failure).
- Example (line 947): `return ResponseEntity.ok(ApiResponse.error("获取销售分析失败: " + e.getMessage()));`
- Recommendation: Use `ResponseEntity.status(500)` for server errors, `ResponseEntity.badRequest()` for validation errors.

**Issue S-RES-2 (Medium): Error messages leak internal details**
- Location: Multiple catch blocks
- Pattern: `"获取销售分析失败: " + e.getMessage()` directly exposes Java exception messages to the client
- Example (line 947, 996, 1048, 1110, etc.)
- Risk: Stack trace info, class names, SQL errors could leak to the client
- Recommendation: Log full error server-side, return generic user-facing message

**Issue S-RES-3 (Low): Inconsistent empty-data handling in dashboard**
- Location: Lines 877-895 (unified dashboard endpoint)
- Comment says "返回空的 UnifiedDashboardResponse 而不是错误" but this swallows all errors
- This violates the project rule "禁止降级处理 - 不返回假数据"

### Python Endpoints

**File**: `backend/python/smartbi/api/analysis_cache.py`, `insight.py`, `classifier.py`, `ai_proxy.py`

**Issue S-RES-4 (Medium): Inconsistent response format across Python endpoints**
- `analysis_cache.py` returns `{"success": True/False, "cached": True/False, ...}` (no `data` wrapper)
- `ai_proxy.py` returns `{"success": True, "data": {...}, "elapsed_ms": ...}`
- `classifier.py` returns `{"success": True, "predictions": [...], "top_intent": ...}`
- `insight.py` uses Pydantic `InsightResponse` model with `success`, `insights`, etc.
- None of these match the Java `ApiResponse` format of `{success, data, message}`

**Issue S-RES-5 (Low): Python error responses expose internal info**
- `analysis_cache.py` L76: `"message": str(e)` exposes raw exception strings
- `ai_proxy.py` L169: `"message": str(e)`

### Cross-Service Response Issues

**Issue S-RES-6 (High): Double-wrapped response in dashboard flow**
- When Java calls SmartBIService facade (line 919), the result is already a Map, then wrapped in `ApiResponse.success(result)`.
- If the facade internally calls Python and the Python response also contains `{"success": true, "data": {...}}`, the final response becomes `{success: true, data: {success: true, data: {...}}}`.
- The frontend `smartbi.ts` appears to handle some of this with manual unwrapping, but it is fragile.
- This is the root cause of the "double-wrapped response" issue referenced in the audit instructions.

---

## 3. Error Handling

**Issue S-ERR-1 (High): SmartBIController has 69 catch blocks that all return HTTP 200**
- File: `SmartBIController.java`
- Every endpoint catches `Exception` and returns `ResponseEntity.ok(ApiResponse.error(...))`.
- This means the frontend cannot use HTTP status codes for error handling; it must always parse the body.
- Impact: Load balancers, CDNs, and monitoring tools will report 0% error rate even when the service is broken.

**Issue S-ERR-2 (Medium): Broad Exception catching**
- File: `SmartBIController.java`, all endpoints
- All endpoints catch `Exception` (the broadest possible type) rather than specific exceptions.
- This masks programming errors (NullPointerException, ClassCastException) that should crash loudly during development.

**Issue S-ERR-3 (Low): Python endpoints use mixed error handling**
- `analysis_cache.py`: Returns `{"success": False, "cached": False}` for errors (no HTTP error codes)
- `ai_proxy.py`: Some endpoints raise `HTTPException(status_code=503)` for missing API keys but return `{"success": False}` for other errors
- `classifier.py`: Returns `{"success": False, "error": "..."}` for model-not-loaded
- Inconsistency makes client-side error handling difficult

**Issue S-ERR-4 (Low): ReportController returns ApiResponse directly (not wrapped in ResponseEntity)**
- File: `ReportController.java` lines 49-99
- Pattern: `return ApiResponse.success(...)` instead of `ResponseEntity.ok(ApiResponse.success(...))`
- This works because Spring auto-serializes the return value, but it cannot set custom HTTP status codes

---

## 4. Performance Issues

| # | Location | Issue | Severity | Fix Suggestion |
|---|----------|-------|----------|----------------|
| P-1 | `SmartBIController.java` L804-865 | **Sequential dashboard aggregation**: 9 service calls (sales, finance, inventory, production, quality, procurement, department, region, alerts, recommendations) are executed sequentially, each wrapped in try-catch. Total response time = sum of all calls. | **High** | Use `CompletableFuture.allOf()` or `@Async` to parallelize. Comment on L803 even acknowledges this: "并行调用可优化性能". |
| P-2 | `SmartBIController.java` L2116-2127 | **N+1 query**: `getUploadsMissingFields` loads ALL uploads for a factory, then loops through each calling `dynamicAnalysisService.getFieldCount(upload.getId())`. For a factory with 100 uploads, this is 101 queries. | **High** | Write a single query with LEFT JOIN or COUNT subquery. |
| P-3 | `SmartBIController.java` L1973 | **Unbounded list return**: `getUploadHistory` calls `findByFactoryIdOrderByCreatedAtDesc(factoryId)` with no pagination. For factories with many uploads, this returns all records. | **Medium** | Add `Pageable` parameter or a default limit. |
| P-4 | `DynamicAnalysisServiceImpl.java` L70 | **Full table load**: `findByFactoryIdAndUploadId(factoryId, uploadId)` loads ALL data rows into memory. For large Excel files (10,000+ rows), this causes high memory pressure. | **Medium** | Use streaming/pagination for analysis, or compute aggregates via SQL. |
| P-5 | `SmartBIUploadFlowServiceImpl.java` L106 | **Static thread pool**: `Executors.newFixedThreadPool(5)` is created as a static field. If the service is restarted, old threads may not be cleaned up properly. Also, pool is not configurable. | **Low** | Use Spring-managed thread pool (`@Async` with `TaskExecutor`). |
| P-6 | `SmartBIConfigServiceImpl.java` L59-66 | **In-memory cache without eviction**: 7 `ConcurrentHashMap` caches with no size limits, no TTL, no eviction policy. Over time, these can grow unbounded. | **Medium** | Use Spring Cache with `@Cacheable` + TTL, or Caffeine cache. |
| P-7 | `SmartBIController.java` L1625-1777 | **Redundant queries in NL query response generation**: Methods like `generateSalesQueryResponse`, `generateDepartmentQueryResponse` etc. call the full analysis service just to extract a single KPI value from the response. | **Medium** | Create lightweight query methods that return only the needed KPI. |
| P-8 | `analysis_cache.py` L48 | **No cache index optimization**: Cache lookup queries `SmartBiPgAnalysisResult` by `upload_id` and `analysis_type`. There is no evidence of a composite index on these columns. | **Low** | Add composite index `(upload_id, analysis_type)`. |

---

## 5. Security Review

| # | Location | Issue | Severity | Fix Suggestion |
|---|----------|-------|----------|----------------|
| SEC-1 | `WebMvcConfig.java` L41 | **SmartBIConfigController has NO authentication**: The JWT interceptor only covers `/api/mobile/**` and `/api/platform/**`. SmartBIConfigController is at `/api/admin/smartbi-config/**` which is completely unprotected. Anyone can CRUD intent configs, alert thresholds, incentive rules without any token. | **CRITICAL** | Add `/api/admin/**` to `addPathPatterns` in WebMvcConfig. |
| SEC-2 | All Python endpoints | **No authentication on Python service**: The Python FastAPI service at port 8083 has zero authentication. All endpoints (analysis cache, insight generation, AI proxy, chart building, classifier) are publicly accessible on the network. The service is exposed on port 8083 on the public IP 47.100.235.168. | **CRITICAL** | Either: (1) Add JWT verification middleware to Python, (2) Only bind to localhost and let Java proxy all calls, or (3) Use network firewall to restrict 8083 to localhost only. |
| SEC-3 | `SmartBIController.java` L154-202 | **File upload: no file size limit enforcement at controller level**: The upload endpoint accepts `MultipartFile` without checking file size. While Spring Boot has a default `spring.servlet.multipart.max-file-size`, it is not explicitly configured and the default (1MB) may be overridden. Large files could cause OOM. | **HIGH** | Add explicit `@RequestParam("file") MultipartFile file` size check, e.g. `if (file.getSize() > 50 * 1024 * 1024) return error`. |
| SEC-4 | `SmartBIController.java` L154 | **File upload: content type not validated**: Only filename extension (.xlsx/.xls) is checked (L146), but file content type (MIME type) is not validated. An attacker could upload a malicious file renamed to .xlsx. | **HIGH** | Validate `file.getContentType()` matches `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `application/vnd.ms-excel`. |
| SEC-5 | `SmartBIController.java` L67 | **factoryId from URL path, not JWT**: All SmartBI endpoints use `@PathVariable String factoryId` from the URL. While the JWT interceptor does factory validation (L129-147 in JwtAuthInterceptor), the validation only sends 403 on mismatch. But if a request arrives without a token, the interceptor still lets it through for non-platform endpoints (it only blocks non-public endpoints). | **Medium** | Strengthen by requiring JWT for all SmartBI endpoints explicitly. |
| SEC-6 | `analysis_cache.py` L163 | **Clear-all cache endpoint with no auth**: `DELETE /api/smartbi/analysis-cache-clear-all` deletes ALL analysis caches across ALL factories. No authentication, no factory isolation. Any user can wipe all caches. | **CRITICAL** | Add authentication check, restrict to admin role. |
| SEC-7 | `SmartBiDynamicDataRepository.java` L99-113 | **JSONB query parameter injection risk**: The `aggregateByField` native query uses `:groupField` and `:measureField` parameters in JSONB operators. While Spring Data parameterization should prevent SQL injection, the field names come from user input and are used in JSON path expressions. | **Medium** | Validate field names against the known field definitions before passing to repository. |
| SEC-8 | `analysis_cache.py` L82 | **No factory_id ownership check on cache save**: `save_analysis_cache` accepts any `factory_id` in the body. There is no validation that the caller owns this factory. An attacker could overwrite another factory's cache. | **High** | Validate factory_id from JWT/auth context. |

---

## 6. Data Flow Analysis

### Excel Upload Flow

```
Frontend (web-admin)
  |-- POST /api/mobile/{factoryId}/smart-bi/upload-and-analyze (multipart file)
  |
Java SmartBIController.uploadAndAnalyze()  [L209]
  |-- validates file extension (.xlsx/.xls)
  |-- SmartBIUploadFlowService.executeUploadFlow()  [L128]
       |-- ExcelDynamicParserService.parseExcelWithFallback()
       |     |-- PythonSmartBIClient.parseExcel() --> Python /api/excel/parse
       |     |-- (fallback to Java POI parser if Python unavailable)
       |
       |-- detectDataType() - classifies as SALES/FINANCE/etc.
       |
       |-- DynamicDataPersistenceService.persistDynamic()  (if PostgreSQL enabled)
       |   |-- creates SmartBiPgExcelUpload record
       |   |-- saves field definitions to SmartBiPgFieldDefinition
       |   |-- saves data rows as JSONB to SmartBiDynamicData
       |
       |-- ChartTemplateService.buildChartWithAnalysis() - generates charts
       |
       |-- Returns UploadFlowResult with parseResult + chartConfig + aiAnalysis
  |
  v
Frontend receives response, then calls:
  |-- Python /api/chart/build (to build ECharts config)
  |-- Python /api/insight/generate (to get AI insights)
  |-- Python /api/smartbi/analysis-cache/{uploadId} (POST to cache results)
```

**Issues in this flow**:
1. File is held entirely in memory during the Java-to-Python transfer (no streaming)
2. No virus/malware scanning on uploaded files
3. If PostgreSQL persistence fails, the data is lost but no cleanup of partial state occurs
4. The upload response can be very large (includes full parseResult with all preview data)

### AI Query Flow

```
Frontend
  |-- POST /api/mobile/{factoryId}/smart-bi/query  { query: "本月销售额" }
  |
Java SmartBIController.query()  [L1361]
  |-- SmartBIService.processQuery() (if facade available)
  |     |-- checks cache, quota, records usage
  |     |-- delegates to intent recognition + execution
  |
  |-- (fallback) SmartBIIntentService.recognizeIntent()
  |     |-- pattern matching or LLM-based intent classification
  |
  |-- executeQueryByIntent() [L1574]
       |-- calls appropriate analysis service based on intent
       |-- e.g., salesAnalysisService.getSalesOverview()
       |-- generates response text string
  |
  v
Frontend receives NLQueryResponse { intent, responseText, followUpQuestions }
```

**Issues in this flow**:
1. The NL query fallback path (lines 1382-1405) does intent recognition and execution in the same request thread, which can be slow
2. `executeQueryByIntent()` calls full analysis services just to build a one-sentence text response (P-7)
3. No rate limiting on the NL query endpoint

### Dashboard Data Flow

```
Frontend
  |-- GET /api/mobile/{factoryId}/smart-bi/dashboard?period=month
  |
Java SmartBIController.getDashboard()  [L696]
  |-- DateRangeUtils.getDateRangeByPeriod(period) - calculates date range
  |
  |-- SmartBIService.getDashboard() (if facade available)
  |     |-- cached in memory
  |
  |-- (fallback) Sequential calls to 9 services [L804-865]:
  |     salesAnalysisService.getSalesOverview()
  |     financeAnalysisService.getFinanceOverview()
  |     inventoryHealthAnalysisService.getInventoryHealth()
  |     productionAnalysisService.getOEEOverview()
  |     qualityAnalysisService.getQualitySummary()
  |     procurementAnalysisService.getProcurementOverview()
  |     departmentAnalysisService.getDepartmentRanking()
  |     regionAnalysisService.getRegionRanking()
  |     recommendationService.generateAllAlerts()
  |     recommendationService.generateRecommendations()
  |
  v
Frontend receives UnifiedDashboardResponse
```

**Issues in this flow**:
1. **Sequential execution** of 9+ service calls (P-1) - response time is sum of all
2. **Outer catch returns empty data** (L877-895) rather than error - masks failures
3. Each sub-service silently catches its own errors (`log.warn` only) - partial data returned without indication

---

## 7. API Design Quality

### RESTful Conventions

| Issue | Details | Severity |
|-------|---------|----------|
| **Path naming inconsistency** | SmartBI uses kebab-case (`/smart-bi/upload-and-analyze`, `/drill-down`) which is correct REST convention. Config controller uses kebab-case (`/smartbi-config`). Report controller uses camelCase in path segments. Generally OK but not perfectly consistent. | Low |
| **GET vs POST misuse** | `POST /analysis/comparison` should be GET with query params (it's a read-only query). `POST /drill-down` could be GET since it's a query operation. | Medium |
| **Query param vs body** | Analysis endpoints correctly use query params for simple filters. NL query correctly uses POST body for complex input. Good. | OK |
| **Resource naming** | `/uploads-missing-fields` is not a resource; it's a diagnostic action. Better as `/uploads?missing_fields=true` or `/diagnostics/missing-fields`. | Low |
| **Nested DTO classes in controller** | `SmartBIController.java` defines 6 inner static classes (TableDataResponse, BackfillResult, BatchBackfillResult, UploadHistoryDTO, DrillDownRequest, ConfirmMappingRequest) at L2264-2398. These should be in dedicated DTO files. | Low |
| **Controller size** | `SmartBIController.java` is 2400+ lines with 37 endpoints. This is a "god controller" and should be split into sub-controllers (e.g., `SmartBIUploadController`, `SmartBIAnalysisController`, `SmartBIDashboardController`). | Medium |

---

## 8. Complete Issue Summary

| # | File | Line(s) | Issue | Severity | Effort |
|---|------|---------|-------|----------|--------|
| SEC-1 | `WebMvcConfig.java` | 41 | SmartBIConfigController (`/api/admin/**`) bypasses JWT auth entirely | **CRITICAL** | 5 min |
| SEC-2 | `main.py` (Python) | all | All Python endpoints (port 8083) have zero authentication | **CRITICAL** | 2-4 hrs |
| SEC-6 | `analysis_cache.py` | 163 | `clear-all-cache` endpoint deletes all factories' caches, no auth | **CRITICAL** | 30 min |
| COV-1 | `smartbi.ts` | 314 | Frontend calls `GET /analysis/trend` - no backend handler exists | **CRITICAL** | 2 hrs |
| COV-2 | `smartbi.ts` | 327 | Frontend calls `POST /analysis/comparison` - no backend handler exists | **CRITICAL** | 2 hrs |
| SEC-3 | `SmartBIController.java` | 154 | No file size limit check on upload | **HIGH** | 15 min |
| SEC-4 | `SmartBIController.java` | 146 | File content type not validated (only extension) | **HIGH** | 15 min |
| SEC-8 | `analysis_cache.py` | 82 | No factory ownership check on cache save | **HIGH** | 1 hr |
| P-1 | `SmartBIController.java` | 804-865 | Dashboard: 9 sequential service calls (should be parallel) | **HIGH** | 2 hrs |
| P-2 | `SmartBIController.java` | 2116-2127 | N+1 query: loops uploads calling getFieldCount per upload | **HIGH** | 1 hr |
| COV-3 | `smartbi.ts` | 340 | Frontend calls `POST /export` - no backend handler exists | **HIGH** | 4 hrs |
| S-RES-6 | `SmartBIController.java` | 919 | Double-wrapped response when facade calls Python | **HIGH** | 2 hrs |
| S-RES-1 | `SmartBIController.java` | all | All 69 error responses use HTTP 200 status | **MEDIUM** | 4 hrs |
| S-RES-2 | `SmartBIController.java` | multiple | Error messages leak Java exception details | **MEDIUM** | 2 hrs |
| S-RES-4 | Python API modules | multiple | Inconsistent response format across Python endpoints | **MEDIUM** | 4 hrs |
| S-ERR-2 | `SmartBIController.java` | all | All catch blocks catch generic Exception | **MEDIUM** | 3 hrs |
| P-3 | `SmartBIController.java` | 1973 | `getUploadHistory` returns unbounded list (no pagination) | **MEDIUM** | 30 min |
| P-4 | `DynamicAnalysisServiceImpl.java` | 70 | Loads all data rows into memory for analysis | **MEDIUM** | 4 hrs |
| P-6 | `SmartBIConfigServiceImpl.java` | 59-66 | 7 in-memory caches with no eviction/TTL | **MEDIUM** | 2 hrs |
| P-7 | `SmartBIController.java` | 1625-1777 | NL query response calls full analysis service for one KPI | **MEDIUM** | 3 hrs |
| SEC-5 | `SmartBIController.java` | 67 | factoryId from URL path potentially bypassable | **MEDIUM** | 1 hr |
| SEC-7 | `SmartBiDynamicDataRepository.java` | 99 | JSONB field names from user input in native queries | **MEDIUM** | 1 hr |
| API-1 | `SmartBIController.java` | all | God controller: 2400+ lines, 37 endpoints | **MEDIUM** | 8 hrs |
| S-RES-3 | `SmartBIController.java` | 877-895 | Dashboard returns empty data on error (violates "no fake data" rule) | **LOW** |  30 min |
| S-RES-5 | Python API modules | multiple | Python error responses expose internal exception strings | **LOW** | 1 hr |
| S-ERR-3 | Python API modules | multiple | Mixed error handling patterns (HTTPException vs dict returns) | **LOW** | 2 hrs |
| S-ERR-4 | `ReportController.java` | 49-99 | Returns ApiResponse directly instead of ResponseEntity | **LOW** | 30 min |
| P-5 | `SmartBIUploadFlowServiceImpl.java` | 106 | Static thread pool not managed by Spring | **LOW** | 1 hr |
| P-8 | `analysis_cache.py` | 48 | No composite index on (upload_id, analysis_type) | **LOW** | 15 min |
| API-2 | `SmartBIController.java` | 2264-2398 | 6 inner DTO classes defined inside controller | **LOW** | 1 hr |
| API-3 | `SmartBIController.java` | 2104 | Non-RESTful path `/uploads-missing-fields` | **LOW** | 15 min |
| API-4 | `smartbi.ts` / controller | 327 | POST used for read-only comparison query | **LOW** | 30 min |

---

## 9. Top 10 Priority Fixes

1. **[SEC-1] Add `/api/admin/**` to JWT interceptor path patterns** (CRITICAL, 5 min fix)
   - File: `backend-java/src/main/java/com/cretas/aims/config/WebMvcConfig.java` line 41
   - Change `addPathPatterns("/api/mobile/**", "/api/platform/**")` to include `"/api/admin/**"`

2. **[SEC-2] Secure Python service endpoints** (CRITICAL, 2-4 hrs)
   - Either restrict port 8083 to localhost via firewall/security group, or add JWT middleware to FastAPI
   - At minimum: block 8083 from public internet in Alibaba Cloud security group

3. **[SEC-6] Remove or auth-gate the clear-all-cache endpoint** (CRITICAL, 30 min)
   - File: `backend/python/smartbi/api/analysis_cache.py` line 163
   - Add authentication check or remove this endpoint entirely

4. **[COV-1/COV-2] Implement missing backend endpoints** (CRITICAL, 4 hrs total)
   - Add `GET /analysis/trend` handler in SmartBIController
   - Add `POST /analysis/comparison` handler in SmartBIController
   - Or: remove the dead frontend calls if these features are deprecated

5. **[SEC-3/SEC-4] Add file upload validation** (HIGH, 30 min)
   - Add file size check (e.g., max 50MB)
   - Add MIME type validation in `SmartBIController.uploadExcel()` and `uploadAndAnalyze()`

6. **[P-1] Parallelize dashboard aggregation** (HIGH, 2 hrs)
   - File: `SmartBIController.java` lines 804-865
   - Use `CompletableFuture.allOf()` for the 9 independent service calls

7. **[P-2] Fix N+1 query in uploads-missing-fields** (HIGH, 1 hr)
   - File: `SmartBIController.java` lines 2116-2127
   - Write a single JOIN query: `SELECT u.id FROM uploads u LEFT JOIN field_defs f ON u.id = f.upload_id WHERE f.id IS NULL`

8. **[S-RES-6] Fix double-wrapped response** (HIGH, 2 hrs)
   - Trace the SmartBIService facade's Python call chain
   - Ensure Python responses are unwrapped before re-wrapping in ApiResponse

9. **[COV-3] Implement export endpoint** (HIGH, 4 hrs)
   - Frontend calls `POST /export` for data export functionality
   - Need to implement Excel/CSV export in SmartBIController

10. **[S-RES-1] Use proper HTTP status codes for errors** (MEDIUM, 4 hrs)
    - Replace `ResponseEntity.ok(ApiResponse.error(...))` with appropriate HTTP status codes
    - 400 for validation errors, 500 for server errors, 503 for service unavailable
