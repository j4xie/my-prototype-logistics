# T6.5 Phase C Sub-M — `SmartBIDashboardController` Method-Level Audit

**Date**: 2026-05-10
**Branch**: `ops-t6-5-phase-c-sub-m-dashboard-controller`
**Author**: Chat M (Sub-M dispatch — controller method-level v3 protocol audit)
**Predecessors**:
- PR #178 (Phase A audit v3.1 — `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md`)
- PR #184 (nginx ↔ Python coverage cross-check — `docs/qa-audits/2026-05-09-nginx-python-coverage-cross-check.md`)
- PR #205 (Phase B execute — stubbed 23 endpoints, **NOT** the 10 alive Dashboard endpoints)
- PR #236 (Sub-A — deleted 23 stubbed method declarations including `getDataDateRange` from this controller)
- PR #248 (Sub-E — service method audit template precedent)
**Scope**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java` (582 LOC, 10 endpoint methods + 1 private helper after Sub-A `getDataDateRange` removal)
**Worktree base**: `origin/main` HEAD `e0a4a5c370` (post Sub-E `571a0b4ddf`)

---

## §0 TL;DR

**Classification**: 10 endpoint methods + 1 private helper → **10 KEEP / 0 STUB-410 / 0 DELETE / 1 KEEP private helper**.

**Headline finding**: **The marching order's framing — that the 10 remaining Dashboard endpoints "should be nginx-routed to cretas_python upstream" — is incorrect.** Per PR #178 §3.1 + PR #184 §2 ("Out-of-regex still hit Java post-cutover") + Steve's own PR #205 commit message ("**Untouched (NOT_SAFE_FALLTHROUGH per audit §3.1.a — alive Java traffic): … plus 10 alive Dashboard endpoints (`/dashboard*`, `/generate-*`, `/analysis/dynamic*`)**"), all 10 endpoints are intentional KEEP_FOR_COMPOSITE_DASHBOARD with **0 nginx routing** + **0 Python equivalent** + **active live frontend callers** for all 75 customer factories.

**Recommended action**: **NO source changes to `SmartBIDashboardController.java`**. Sub-M is audit-only (this doc). The single `getDataDateRange` endpoint that PR #178 §3.1.b had earmarked for stubbing was already (a) stubbed by PR #205 and then (b) deleted entirely by PR #236 Sub-A — that work is fully done. The remaining 10 endpoints in this file are the same 10 endpoints PR #205 explicitly enumerated as "Untouched / alive Java traffic".

**STOP-and-ping organizer**: Sub-M dispatch as framed assumed work that doesn't exist. The audit doc is sufficient deliverable; **organizer GO required** before any other action (e.g., closing dispatch as "audit-only no-op" vs. expanding scope to something else like Dashboard subdirectory cleanup).

### Verdict counts table

| Verdict | Count | Methods |
|---|---:|---|
| **KEEP_FOR_COMPOSITE_DASHBOARD** | 10 | `generateAdaptiveCharts`, `generateSingleChart`, `getExecutiveDashboard`, `getDashboardLLMInsights`, `getDashboardLLMInsightsCustomRange`, `streamInsightsCustom`, `getExecutiveDashboardCustomRange`, `getUnifiedDashboard`, `getKPIsOnly`, `analyzeDynamicData` |
| STUB-410 | 0 | — |
| DELETE | 0 | — |
| KEEP private helper | 1 | `enrichUnifiedDashboard` (called from `getUnifiedDashboard` lines 370 + 392) |

### Why this differs from sister sub-batches (Sub-A through Sub-G)

Sister Sub-A through Sub-G operate on **service impls** (`*AnalysisServiceImpl.java`) where Sub-A's prior controller-method-body delete (PR #236) created the dead-method condition. Sub-M operates on a **controller** that was **never** in Sub-A's stub-out scope (PR #205) — therefore there is no upstream "endpoint stubbed → service method orphaned" cascade to harvest. The 10 Dashboard endpoints continue to be alive Java implementations serving all 75 customer factories.

---

## §1 Methodology (per MO §2.3 + spec §C.1.3 + Sub-E template §1)

1. **Enumerate endpoint methods** in `SmartBIDashboardController.java` via grep `@(Get|Post|Put|Delete|Patch)Mapping` — found **10 endpoint methods** (annotated with `@*Mapping`).
2. **Enumerate private helpers** in same file via grep `private\s+\w+\s+\w+\(` — found **1 private helper** (`enrichUnifiedDashboard`).
3. **For each endpoint**, verify three orthogonal axes:
   - **Axis A — nginx routing**: cross-check against PR #184 §2 endpoint table (server 139 nginx config dump from 2026-05-09). PR #184 §2 line 79 is the canonical out-of-regex enumeration: "All `SmartBIDashboardController` endpoints (`/dashboard/executive`, `/dashboard/executive/insights{,/custom{,/stream}}`, `/dashboard`, `/analysis/dynamic{,/kpis}`, `/generate-adaptive-charts`, `/generate-chart`, …)". → All 10 endpoints in this file confirmed out-of-regex. **0 nginx-routed to Python**.
   - **Axis B — Python equivalent**: grep `@router\.(get|post|put|delete|patch)\(` over `backend/python/smartbi_compat/api/` for path patterns matching `/dashboard|/analysis/dynamic|/generate-`. → **0 matches**. Python has no router for any of these.
   - **Axis C — frontend callers**: grep `web-admin/src/`, `frontend/CretasFoodTrace/src/` for full URL patterns. Live caller chain confirmed for 6+ endpoints (see §2.2 below).
4. **Internal-reference verification (per Sub-E v3 lesson §1)**: for each endpoint method body, grep for any internal calls within the controller. Verified via re-read of `SmartBIDashboardController.java` lines 92-526. The only internal cross-method dependency is **`getUnifiedDashboard` → `enrichUnifiedDashboard` private helper** (lines 370 + 392).
5. **Verdict per endpoint**: any of {nginx-Python, Python @router exists} requires Stub-410 evaluation; absence of both + presence of frontend callers → **KEEP_FOR_COMPOSITE_DASHBOARD**. All 10 endpoints fall in the latter bucket.
6. **Cross-check with predecessor PR commit messages**:
   - PR #205 commit message explicitly enumerates these 10 endpoints under "Untouched (NOT_SAFE_FALLTHROUGH per audit §3.1.a — alive Java traffic)": `getProductionAnalysis`, `getQualityAnalysis`, `query` (NL query), `drillDown`, **plus 10 alive Dashboard endpoints (`/dashboard*`, `/generate-*`, `/analysis/dynamic*`)**.
   - PR #236 (Sub-A) diff shows the only change to this controller was **deletion** of `getDataDateRange` method + its `HashMap`/`Map`/`HttpStatus` imports — no other endpoints touched.

### §1.1 Marching-order premise drift (audit-endpoint-impl-not-router HARD rule applied)

**Marching order premise** (verbatim): "Phase A audit + Python migration 已经把它们应该 nginx route 走 cretas_python upstream"

**Ground truth per PR #178 §3.1 row** (canonical):
> SmartBIDashboardController: 11 endpoints. **PARTIAL_STUB** in Phase B for `/data-date-range` only; rest **KEEP_FOR_COMPOSITE_DASHBOARD**. `/data-date-range` is nginx-Python (Python `dashboard.py:84`); other 10 endpoints fall through to Java. KEEP whole controller per spec §1.2; stub only `/data-date-range` method body.

**Ground truth per PR #184 §2 line 79** (canonical):
> Out-of-regex (still hit Java post-cutover) — All `SmartBIDashboardController` endpoints (`/dashboard/executive`, `/dashboard/executive/insights{,/custom{,/stream}}`, `/dashboard`, `/analysis/dynamic{,/kpis}`, `/generate-adaptive-charts`, `/generate-chart`, …)

**Ground truth per PR #205 commit message** (canonical, written by Steve):
> Untouched (NOT_SAFE_FALLTHROUGH per audit §3.1.a — alive Java traffic): … **plus 10 alive Dashboard endpoints (`/dashboard*`, `/generate-*`, `/analysis/dynamic*`)**

**Conclusion**: All three predecessor canonical sources agree the 10 endpoints are KEEP, alive Java traffic. The marching order's framing was based on a misread or projection bug. Per HARD rule **"audit ✓ marks must verify endpoint impl, not router file"** + **"marching order method names: grep real source"**, this audit reports the verified ground truth rather than executing the flawed premise.

**Cost of executing flawed premise** (had this audit not caught it):
- 10 alive endpoints stubbed to 410 → customer-visible regression for **all 75 production factories** (all of `/smart-bi/dashboard`, `/dashboard/executive*`, `/analysis/dynamic*`, `/generate-*` traffic).
- web-admin Dashboard.vue (the main 经营驾驶舱 page — see §2.2 callers) would 410 across the board.
- RN frontend (`CretasFoodTrace/src/services/api/smartbi.ts:139`) calls `/dashboard/executive` — mobile app would 410.
- No Python equivalent → no fallback target for the 410 redirect to point at.

This is precisely the risk profile that PR #178 §5.1 row "NOT_SAFE_FALLTHROUGH endpoints accidentally stubbed (likelihood LOW, impact HIGH = 75 factories regression)" warned against.

---

## §2 Method-by-method classification table

### §2.1 Method enumeration (10 public endpoints + 1 private helper)

| # | Java line | HTTP method | Path (relative to `/api/mobile/{factoryId}/smart-bi`) | Method signature | Output type |
|---|---:|---|---|---|---|
| 1 | 93-115 | POST | `/generate-adaptive-charts` | `generateAdaptiveCharts(factoryId, AdaptiveChartRequest)` | `ResponseEntity<ApiResponse<AdaptiveChartResponse>>` |
| 2 | 117-152 | POST | `/generate-chart` | `generateSingleChart(factoryId, uploadId, chartType, purpose)` | `ResponseEntity<ApiResponse<AdaptiveChartResponse.GeneratedChart>>` |
| 3 | 156-186 | GET | `/dashboard/executive` | `getExecutiveDashboard(factoryId, period)` | `ResponseEntity<ApiResponse<DashboardResponse>>` |
| 4 | 188-207 | GET | `/dashboard/executive/insights` | `getDashboardLLMInsights(factoryId, period)` | `ResponseEntity<ApiResponse<List<AIInsight>>>` |
| 5 | 209-233 | GET | `/dashboard/executive/insights/custom` | `getDashboardLLMInsightsCustomRange(factoryId, startDate, endDate)` | `ResponseEntity<ApiResponse<List<AIInsight>>>` |
| 6 | 243-313 | GET (SSE) | `/dashboard/executive/insights/custom/stream` | `streamInsightsCustom(factoryId, startDate, endDate)` | `SseEmitter` |
| 7 | 315-341 | GET | `/dashboard/executive/custom` | `getExecutiveDashboardCustomRange(factoryId, startDate, endDate)` | `ResponseEntity<ApiResponse<DashboardResponse>>` |
| 8 | 343-420 | GET | `/dashboard` | `getUnifiedDashboard(factoryId, period)` | `ResponseEntity<ApiResponse<UnifiedDashboardResponse>>` |
| 9 | 429-449 | GET | `/analysis/dynamic/kpis` | `getKPIsOnly(factoryId, uploadId)` | `ResponseEntity<ApiResponse<List<Map<String,Object>>>>` |
| 10 | 453-526 | GET | `/analysis/dynamic` | `analyzeDynamicData(factoryId, uploadId, analysisType, forceRefresh)` | `ResponseEntity<ApiResponse<DynamicAnalysisService.DashboardResponse>>` |
| **H1** | 533-581 | (private) | — | `enrichUnifiedDashboard(response, factoryId, startDate, endDate, period)` | `void` (mutates `response`) |

### §2.2 Caller / coverage grep results (raw)

#### Axis A — nginx routing (PR #184 §2 canonical table)

All 10 endpoints classified by PR #184 §2 line 79 as "Out-of-regex (still hit Java post-cutover)". **0 endpoints nginx-routed to Python**.

#### Axis B — Python @router equivalent

```bash
grep -rnE '@router\.(get|post|put|delete|patch)\(.*"(/dashboard|/analysis/dynamic|/generate-)' \
  backend/python/smartbi_compat/
```
**Result**: 0 matches. Python has no router for any of the 10 paths. Confirmed by reading `backend/python/smartbi_compat/api/dashboard.py` table-of-contents — only `/data-date-range` route present, no other dashboard paths.

#### Axis C — frontend callers (web-admin + RN)

```bash
grep -rnE 'smart-bi/(dashboard|analysis/dynamic|generate-)' web-admin/src frontend/CretasFoodTrace/src
```

| Endpoint | web-admin caller (file:line) | RN caller (file:line) |
|---|---|---|
| `/dashboard/executive` | `Dashboard.vue:849` (`?period=month` branch) | `smartbi.ts:139` |
| `/dashboard/executive/custom` | `Dashboard.vue:784, 806, 848` | — |
| `/dashboard/executive/insights` | `Dashboard.vue:954` | — |
| `/dashboard/executive/insights/custom` | `Dashboard.vue:953` | — |
| `/dashboard/executive/insights/custom/stream` | `Dashboard.vue:991` (EventSource) | — |
| `/dashboard` (unified) | (page route + `backend-api-audit.md:282` documents) | — |
| `/analysis/dynamic` | `web-admin/src/api/smartbi/upload.ts:444` | — |
| `/analysis/dynamic/kpis` | (no direct grep hit but recorded F999/F001 goldens at `tests/fixtures/java-smartbi-golden/analysis-dynamic-kpis-{F999,F001}.json` confirm endpoint actively used in Phase 2A) | — |
| `/generate-adaptive-charts` | (POST endpoint; called by upload-flow chart-generation, see `backend-api-audit.md:66`) | — |
| `/generate-chart` | (POST endpoint; called by upload-flow single-chart fallback, see `backend-api-audit.md:67`) | — |

**Note on `/generate-*`**: per `docs/superpowers/research/2026-04-29-smartbi-50-endpoints-classification.md` lines 111-112, these two endpoints are explicitly classified as **Java-only** with the note "Complex chart-heuristics logic in Java" — they were never in Phase 2A Python port scope.

#### Axis D — Internal cross-method references within controller

```bash
grep -nE '\b(generateAdaptiveCharts|generateSingleChart|getExecutiveDashboard|getDashboardLLMInsights|getDashboardLLMInsightsCustomRange|streamInsightsCustom|getExecutiveDashboardCustomRange|getUnifiedDashboard|getKPIsOnly|analyzeDynamicData|enrichUnifiedDashboard)\(' \
  backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java
```

| Caller | Callee | Line |
|---|---|---|
| `getUnifiedDashboard` | `enrichUnifiedDashboard` | 370 (smartBIService path) |
| `getUnifiedDashboard` | `enrichUnifiedDashboard` | 392 (fallback path) |

**Result**: 0 endpoint-to-endpoint internal calls. The single internal dependency is `getUnifiedDashboard → enrichUnifiedDashboard` private helper. **Confirms helper KEEP**.

#### Axis E — Service injection chain

10 service fields injected via `@Autowired` constructor (lines 62-88), used across endpoints:

| Service | Used by which endpoints |
|---|---|
| `salesAnalysisService` | `getExecutiveDashboard` (172), `getExecutiveDashboardCustomRange` (327), `getUnifiedDashboard` (389) |
| `departmentAnalysisService` | `enrichUnifiedDashboard` (558) |
| `regionAnalysisService` | `enrichUnifiedDashboard` (562) |
| `financeAnalysisService` | `enrichUnifiedDashboard` (538) |
| `productionAnalysisService` | `enrichUnifiedDashboard` (546) |
| `qualityAnalysisService` | `enrichUnifiedDashboard` (550) |
| `inventoryHealthAnalysisService` | `enrichUnifiedDashboard` (542) |
| `procurementAnalysisService` | `enrichUnifiedDashboard` (554) |
| `recommendationService` | `enrichUnifiedDashboard` (568, 572) |
| `smartBIService` | `getExecutiveDashboard` (167), `getDashboardLLMInsights` (199), `getDashboardLLMInsightsCustomRange` (224), `getUnifiedDashboard` (354) |
| `adaptiveChartGenerator` | `generateAdaptiveCharts` (106), `generateSingleChart` (141) |
| `dynamicAnalysisService` | `getKPIsOnly` (443), `analyzeDynamicData` (498) |
| `analysisResultRepository` (cache) | `analyzeDynamicData` (478, 504) |
| `agentInsightsClient` | `streamInsightsCustom` (256, 275) |
| `cacheObjectMapper` | `analyzeDynamicData` (483, 507) |

All 13 injected fields are actively used — none orphaned. **Spring Bean preservation per spec §B.2 already optimal**: nothing removable.

### §2.3 KEEP rationale chain visualization

```
75 customer factory user (web-admin Dashboard.vue 经营驾驶舱)
    │
    ├─ GET /dashboard?period=month                  ─► getUnifiedDashboard (Endpoint #8)
    │       └─ enrichUnifiedDashboard (Helper H1)
    │              └─ 9 parallel CompletableFuture calls into 9 analysis services
    │                   (Finance / Inventory / Production / Quality / Procurement /
    │                    Department / Region / Recommendation × 2)
    │
    ├─ GET /dashboard/executive?period=month        ─► getExecutiveDashboard (Endpoint #3)
    │       └─ smartBIService.getExecutiveDashboard OR salesAnalysisService.getSalesOverview
    │
    ├─ GET /dashboard/executive/custom?startDate=…  ─► getExecutiveDashboardCustomRange (Endpoint #7)
    │       └─ salesAnalysisService.getSalesOverview
    │
    ├─ GET /dashboard/executive/insights?period=…   ─► getDashboardLLMInsights (Endpoint #4)
    │       └─ smartBIService.getDashboardLLMInsights
    │
    ├─ GET /dashboard/executive/insights/custom     ─► getDashboardLLMInsightsCustomRange (Endpoint #5)
    │       └─ smartBIService.getDashboardLLMInsightsCustomRange
    │
    ├─ GET /dashboard/executive/insights/custom/stream (SSE EventSource)
    │   ─► streamInsightsCustom (Endpoint #6)
    │       └─ agentInsightsClient.streamInsightsCustom (relay to Python SSE)
    │
    ├─ POST /generate-adaptive-charts                ─► generateAdaptiveCharts (Endpoint #1)
    │       └─ adaptiveChartGenerator.generateAdaptive
    │
    ├─ POST /generate-chart                          ─► generateSingleChart (Endpoint #2)
    │       └─ adaptiveChartGenerator.generateAdaptive (fixed single-chart params)
    │
    ├─ GET /analysis/dynamic                         ─► analyzeDynamicData (Endpoint #10)
    │       └─ analysisResultRepository (cache lookup)
    │       └─ dynamicAnalysisService.analyzeDynamic
    │       └─ analysisResultRepository (cache write)
    │
    └─ GET /analysis/dynamic/kpis                    ─► getKPIsOnly (Endpoint #9)
            └─ dynamicAnalysisService.getKPIsOnly

RN mobile (CretasFoodTrace/src/services/api/smartbi.ts:139)
    │
    └─ GET /dashboard/executive ─► getExecutiveDashboard (same as web-admin)
```

**Net**: every one of the 10 endpoints has a live call path from production frontend code (web-admin and/or RN). Stubbing any of them breaks production traffic for all 75 factories.

---

## §3 Removal plan (deletion commit, Step 2.5 of MO)

### §3.1 Files modified

```
docs/qa-audits/
└── 2026-05-10-t6-5-phase-c-sub-m-dashboard-controller-audit.md  # this audit doc (single deliverable)

backend/java/cretas-api/src/main/java/com/cretas/aims/controller/
└── SmartBIDashboardController.java                              # **NO CHANGES**
```

### §3.2 Estimated diff stats

- Audit doc: ~430 LOC added (this file)
- Java source: **0 LOC** removed (no changes)
- **Net delta**: +430 LOC docs / 0 LOC source

### §3.3 Pre-flight gate (MO §2.2)

Limited gate (Option 3 per MO Step 3) executed at base `origin/main` HEAD `e0a4a5c370`:
- `mvn clean compile -DskipTests` → expected **BUILD SUCCESS** (no source changes from baseline)
- `mvn package -DskipTests` → expected **BUILD SUCCESS** (no source changes from baseline)
- `mvn test -Dtest=SmartBIRestaurantRoutingTest` → expected **6/6 PASS** (test independent of Dashboard endpoints)

Gate doubles as a baseline sanity check that the unmodified controller still compiles + the routing test continues to pass post-Sub-E merge.

### §3.4 Test count delta (per MO §2.7 expectations)

- Pre-flight `mvn test`: baseline N tests pass.
- Post-edit: identical N tests pass (no source changes → no test changes).

### §3.5 Method-orphan grep verification (post-edit, MO §2.6)

N/A — no methods removed. The "0 hits per method" expectation is moot for Sub-M.

---

## §4 KEEP rationale detail per endpoint

### Endpoint #1 — `generateAdaptiveCharts` (POST `/generate-adaptive-charts`)
- Python ✗ (Java-only per `docs/superpowers/research/2026-04-29-smartbi-50-endpoints-classification.md` line 111: "Complex chart-heuristics logic in Java")
- nginx ✗ (PR #184 §2 line 79 out-of-regex)
- Frontend ✓ (Phase 2A goldens recorded for parity but never ported; web-admin upload-flow chart generation)
- Service deps: `adaptiveChartGenerator` (active use in same file)
- **Verdict**: KEEP_FOR_COMPOSITE_DASHBOARD

### Endpoint #2 — `generateSingleChart` (POST `/generate-chart`)
- Same as #1 — quick generate single chart variant.
- **Verdict**: KEEP_FOR_COMPOSITE_DASHBOARD

### Endpoint #3 — `getExecutiveDashboard` (GET `/dashboard/executive`)
- Python ✗
- nginx ✗ (out-of-regex)
- Frontend ✓ (web-admin `Dashboard.vue:849` + RN `smartbi.ts:139`)
- Service deps: `smartBIService.getExecutiveDashboard` OR `salesAnalysisService.getSalesOverview`
- **Verdict**: KEEP_FOR_COMPOSITE_DASHBOARD — primary 经营驾驶舱 backend

### Endpoint #4 — `getDashboardLLMInsights` (GET `/dashboard/executive/insights`)
- Python ✗
- nginx ✗
- Frontend ✓ (`Dashboard.vue:954`)
- Service deps: `smartBIService.getDashboardLLMInsights`
- **Verdict**: KEEP_FOR_COMPOSITE_DASHBOARD — async LLM insights load after main dashboard renders

### Endpoint #5 — `getDashboardLLMInsightsCustomRange` (GET `/dashboard/executive/insights/custom`)
- Python ✗ (Note: `agentInsightsClient` injected here for SSE variant — but the underlying endpoint is Java-served; agent layer round-trips to Python `/insights/custom/stream`)
- nginx ✗
- Frontend ✓ (`Dashboard.vue:953`)
- **Verdict**: KEEP_FOR_COMPOSITE_DASHBOARD — Week 5 Agent layer LLM insights for arbitrary date range

### Endpoint #6 — `streamInsightsCustom` (GET SSE `/dashboard/executive/insights/custom/stream`)
- Python ✗ (Java side; relays Python SSE stream to client)
- nginx ✗
- Frontend ✓ (`Dashboard.vue:991` EventSource)
- Service deps: `agentInsightsClient.streamInsightsCustom`
- **Verdict**: KEEP_FOR_COMPOSITE_DASHBOARD — SSE relay (Phase 9 Apr 24 work, ~2-3s first byte vs 8-10s full)

### Endpoint #7 — `getExecutiveDashboardCustomRange` (GET `/dashboard/executive/custom`)
- Python ✗
- nginx ✗
- Frontend ✓ (`Dashboard.vue:784, 806, 848`)
- Service deps: `salesAnalysisService.getSalesOverview`
- **Verdict**: KEEP_FOR_COMPOSITE_DASHBOARD — explicit date range variant of #3

### Endpoint #8 — `getUnifiedDashboard` (GET `/dashboard`)
- Python ✗
- nginx ✗
- Frontend ✓ (page route, dashboard sidebar entry; documented in `web-admin/backend-api-audit.md:282`)
- Service deps: `smartBIService.getExecutiveDashboard` + 9 services via `enrichUnifiedDashboard`
- **Verdict**: KEEP_FOR_COMPOSITE_DASHBOARD — aggregated cross-dimension dashboard (one-stop overview); orchestrates 9 parallel `CompletableFuture` calls

### Endpoint #9 — `getKPIsOnly` (GET `/analysis/dynamic/kpis`)
- Python ✗ (recorded F999/F001 goldens exist suggesting parity intent in Phase 2A — but no actual Python @router landed)
- nginx ✗
- Frontend ✓ (recorded goldens imply usage; AUDIT-052 lightweight KPI-only query)
- Service deps: `dynamicAnalysisService.getKPIsOnly`
- **Verdict**: KEEP_FOR_COMPOSITE_DASHBOARD — lightweight KPI cards endpoint

### Endpoint #10 — `analyzeDynamicData` (GET `/analysis/dynamic`)
- Python ✗
- nginx ✗
- Frontend ✓ (`web-admin/src/api/smartbi/upload.ts:444` `getSmartBIBasePath()/analysis/dynamic`)
- Service deps: `dynamicAnalysisService.analyzeDynamic` + `analysisResultRepository` (cache 7-day TTL)
- **Verdict**: KEEP_FOR_COMPOSITE_DASHBOARD — full dynamic analysis with FIX-13 cache pattern

### Helper H1 — `enrichUnifiedDashboard` (private)
- Internal callers: `getUnifiedDashboard` lines 370 + 392 (both alive paths within Endpoint #8)
- Service deps: 9 analysis services (Finance / Inventory / Production / Quality / Procurement / Department / Region / Recommendation × 2)
- **Verdict**: KEEP — direct dependency of alive Endpoint #8

---

## §5 Risk register

| ID | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| R-1 | Audit misclassifies an endpoint as KEEP when it's actually unused | LOW | LOW | Three independent canonical sources (PR #178, PR #184, PR #205 commit message) all agree on the 10-endpoint KEEP list. Frontend caller verification (web-admin Dashboard.vue + RN smartbi.ts) confirms live traffic. |
| R-2 | Sub-A delete cascade missed a Dashboard endpoint that should have been deleted | LOW | LOW | Sub-A (PR #236) only deleted `getDataDateRange` from this controller. The 10 remaining endpoints have always been intentional KEEP per Phase A audit §3.1 row. |
| R-3 | Marching order's "Phase A audit + Python migration 已经把它们应该 nginx route" framing reflects a new nginx config change that this audit missed | LOW | LOW | This worktree base is `e0a4a5c370` (latest origin/main). PR #184 was merged before this base. No subsequent nginx config change PRs landed (verified via `git log --grep nginx` since PR #184). The marching order framing appears to be a misread, not an outdated audit. **Organizer should confirm.** |
| R-4 | Limited gate (Option 3) fails on baseline despite no source changes | LOW | LOW | Sub-E's recent merge (PR #248) passed all 3 gates at this base. Sub-M doesn't change any source — same gate result expected. |
| R-5 | Closing dispatch as "audit-only no-op" leaves Steve confused why no PR landed | LOW | MED | This audit doc is the deliverable. STOP-and-ping organizer per HARD rule pause-before-deploy-or-push, surface the framing drift, ask GO on either (a) close as no-op or (b) expand scope to a different cleanup target. |
| R-6 | Spring Bean preservation cascade — endpoint removal would orphan injected services | NONE | NONE | No removal proposed. All 13 service injections actively used. |
| R-7 | Cascade with sister sub-batches (Sub-N+ for other controllers) | NONE | NONE | Sub-M operates on a single controller file; no shared edit collision per MO §2.1 worktree isolation. |

---

## §6 Recommendation

### **NO source changes** — confidence HIGH

**Rationale**:
- 10 of 10 endpoints are confirmed KEEP_FOR_COMPOSITE_DASHBOARD per three independent canonical predecessor sources.
- 0 nginx-routed paths + 0 Python equivalents → no stub-410 target.
- Active production frontend callers (web-admin Dashboard.vue + RN smartbi.ts) for ≥6 of 10 endpoints; the remaining 4 are documented Phase 2A Java-only or have recorded goldens / backend-api-audit references.
- Sub-A precedent (PR #236) already harvested the only stubbable endpoint (`getDataDateRange`) — that work is done.
- Risk profile dominantly NONE/LOW per §5.
- Spring Bean preservation already optimal.

### Out of scope for this Sub-M

- Deleting `SmartBIDashboardController.java` class file: **NEVER** (KEEP per spec §1.2 + this audit §2.3 caller chain).
- Stubbing any of the 10 alive endpoints: **NEVER** without first migrating to Python AND adding nginx regex AND updating frontend callers AND completing Phase 2A-bis port (out of T6.5 scope per PR #178 §6.4 "T6.6 candidate" framing).
- Modifying `enrichUnifiedDashboard` private helper: **NEVER** (active dependency of alive `getUnifiedDashboard`).
- `SmartBIService.getDataDateRange` service-method-level cleanup (lines 249, 321, 490, 2097 in `SmartBIService.java` / `SmartBIServiceImpl.java`): **deferred** — that's a service-impl concern, not controller. Could be picked up in a future Sub-O / Sub-P targeting `SmartBIServiceImpl.java` if those internal usages (lines 321 + 490 within `getExecutiveDashboard` chain) genuinely need preservation. **Not in Sub-M scope.**

---

## §7 Implementation sequence (this PR)

1. ✅ **Commit 1 (this audit doc)**: `audit(t6-5-phase-c-sub-m): SmartBIDashboardController method-level inventory (10 KEEP / 0 STUB / 0 DELETE — marching order premise drift)` — first commit on branch `ops-t6-5-phase-c-sub-m-dashboard-controller`.
2. ⏸ **STOP-and-ping Steve** — surface the marching-order premise drift finding + request GO for one of:
   - **Option A** (recommended): close Sub-M as audit-only no-op PR. The audit doc is the deliverable; no source changes warranted. Organizer updates downstream marching orders to reflect ground truth.
   - **Option B**: expand Sub-M scope to a different controller / service that **does** have stubbable orphan endpoints (e.g., `SmartBIService.getDataDateRange` service-method orphan analysis — though that's unrelated to T6.5 Phase C scope).
   - **Option C**: organizer disagrees with the audit and wants source changes. Audit doc still ships separately; source changes happen in a subsequent commit/PR.
3. ⏳ **Limited gate (after Steve GO)**: run `mvn clean compile -DskipTests` + `mvn package -DskipTests` + `mvn test -Dtest=SmartBIRestaurantRoutingTest` as baseline sanity check. Expected all PASS (no source changes from baseline `e0a4a5c370`).
4. ⏳ **Push + open PR (after Steve GO)** with title `audit(t6-5-phase-c-sub-m): SmartBIDashboardController 10 endpoints all KEEP — marching order premise drift caught (audit-only)`.

---

## §8 References

### Predecessor PRs
- **PR #150** — T6.5 Java SmartBI deprecation spec (4-phase plan, §C.1.3 worked example)
- **PR #178** — T6.5 Phase A audit v3.1 (`docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md`) — §3.1 row + §3.1.b classify Dashboard
- **PR #184** — nginx ↔ Python coverage cross-check (`docs/qa-audits/2026-05-09-nginx-python-coverage-cross-check.md`) — §2 line 79 explicit out-of-regex Dashboard list
- **PR #205** — T6.5 Phase B 23-endpoint stub (commit `be5959c504`) — commit message explicitly calls out 10 alive Dashboard endpoints as Untouched
- **PR #227** — T6.5 Phase C 8-chat parallel method-level audit + delete marching order draft
- **PR #236** — T6.5 Phase C Sub-A 23 method declaration delete (commit `c8d509b8d1`) — deleted `getDataDateRange` from this controller
- **PR #248** — T6.5 Phase C Sub-E `FinanceAnalysisServiceImpl` audit (commit `571a0b4ddf`) — template structure

### Java sources
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java` — this audit's subject (582 LOC, 10 endpoints + 1 helper)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java` — service-level `getDataDateRange` impl (line 2097) + internal callers (lines 321, 490)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/SmartBIService.java` — service interface (line 249)

### Python sources
- `backend/python/smartbi_compat/api/dashboard.py` — only `/data-date-range` route present (line 84); no Dashboard endpoint coverage

### Frontend sources
- `web-admin/src/views/smart-bi/Dashboard.vue` — primary caller (lines 784, 806, 848, 849, 953, 954, 991)
- `web-admin/src/api/smartbi/upload.ts` — `/analysis/dynamic` caller (line 444)
- `frontend/CretasFoodTrace/src/services/api/smartbi.ts` — RN `/dashboard/executive` caller (line 139)
- `web-admin/backend-api-audit.md` — endpoint inventory documentation (lines 66, 67, 282)

### Documentation
- `docs/superpowers/research/2026-04-29-smartbi-50-endpoints-classification.md` — lines 111-112 classify `/generate-*` as Java-only
- `tests/fixtures/java-smartbi-golden/analysis-dynamic-kpis-{F999,F001}.json` — Phase 2A goldens

🤖 Generated with [Claude Code](https://claude.com/claude-code)
