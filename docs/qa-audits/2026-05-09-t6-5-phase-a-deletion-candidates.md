# T6.5 Phase A — Java SmartBI Analysis Deletion Candidates Audit

**Phase**: T6.5 Phase A (dead-code discovery + deletion candidate audit)
**Status**: Audit doc only — no code changes
**Author**: T6.5 Phase A discovery chat
**Date**: 2026-05-09 (~07:30 CST, post Phase 2A 100% close)
**Predecessor**: PR #150 spec (T6.5 deprecation 4-phase plan), PR #175 organizer handoff (Phase 2A 100% close)

---

## 0. TL;DR

> **v3 amendment (post sister-chat review)**: 4 处 sister-chat-discovered fixes inlined per Chat 3 PR-Z (method name drift, Test.java 不存在) + Chat 4 PR-W (datasource POST Python missing, IncentivePlan name independent confirm). 详见 §3.1.a / §6.2.a / §3.2.d 各自 footnote。v2 → v3 LOC 增量 ~30 行 amendment annotations。
>
> **v3.1 framing correction (post-Chat 5 PR #184 cross-check)**: §3.1.a 之前 "latent T6.4 cutover bug" framing 过载 — Chat 5 evidence 反转事实:
> - Java 端这 3 个 endpoint 自身 TODO stub (PR #45/#49/#50 defer 到 Phase 3)
> - 0 frontend caller / 0 prod log hit (客户从未调用过)
> - Phase 2A 没真正 port (只 router-file 占位)
>
> 修订后 framing 反映 ground truth: deferred Phase 3 backlog, NOT prod regression。Steve 决定仍 impl Python (Chat G PR) for contract completeness — 跟 Phase 3 PR #45/#49/#50 plan 协调,不冲突。LOC 增量 ~10 行 amendment annotations。

Phase 2A cutover completed 2026-05-09 06:34 CST puts 75/75 customer factories on Python `/api/smartbi/analysis/*`. T6.5 spec (PR #150) was authored against an idealized "all analysis services dead" model; this Phase A audit reconciles that against actual nginx regex coverage and Java service-class sharing.

**Headline findings**:

1. **Only 22 of 26 SmartBIAnalysisController endpoint methods are nginx-routed to Python.** The remaining 4 (`/analysis/production`, `/analysis/quality`, `/query`, `/drill-down`) still serve Java for ALL 75 factories — they are NOT dead.
2. **All 10 analysis service classes (Sales/Department/Region/Finance/Production/Quality/Inventory/Procurement/Dynamic/Recommendation) are shared with at least one OUT-OF-SCOPE controller** (Dashboard/PublicDemo/Upload). PR #150 spec §1.2 is **internally inconsistent**: §1.2 IN-SCOPE silently assumes services are exclusively coupled to SmartBIAnalysisController, but §1.2 OUT-OF-SCOPE keeps the controllers that share them. This audit traces the consequence — wholesale service-impl deletion would break the KEEP'd controllers.
3. **GoldDashboardBuilder + GoldFinanceClient are NOT orphaned.** They serve `/dashboard/executive` (still on Java for 75 factories) and `/analysis/finance` F999 fallback. KEEP through Phase D — confirms PR #150 §1.2 OUT-OF-SCOPE classification.
4. **F999 (test factory) still routes to Java for everything**, including the 22 nginx-routed paths — Java code must continue to serve F999 even after Phase B 410 stub-out unless F999 is also migrated to Python.
5. **`/data-date-range` on SmartBIDashboardController is structurally identical** to the 22 SAFE_NGINX_ROUTED methods on SmartBIAnalysisController — nginx routes 75 factories to Python (`backend/python/smartbi_compat/api/dashboard.py:84`), F999 falls through to Java. It is the **23rd Phase B stub candidate**, even though SmartBIDashboardController is otherwise KEEP.
6. **`SmartBiQueryTemplateRepository` becomes a Phase C orphan** after Phase B stubs the 4 query-templates endpoints — it has zero non-self callers in Java post-stub. Spec §1.2 OUT-OF-SCOPE blanket "KEEP all repos until Phase D" is too broad.
7. **PR #150 spec §1.2 lists `IncentivePlanServiceImpl`** as a Phase C deletion candidate. **That class does not exist** in the codebase; the actual class is `IncentiveRuleServiceImpl`. Spec drift flagged.

**Recommendation**: Phase B scope should narrow to **stubbing 23 endpoint methods** (22 on SmartBIAnalysisController + 1 `/data-date-range` on SmartBIDashboardController), with explicit branching that returns 410 only when factoryId ≠ F999 (or after F999 migration). Phase C wholesale class removal is **not feasible** while shared callers exist; refine Phase C to method-level audit instead. Add `SmartBiQueryTemplateRepository` to Phase C orphan candidate list.

---

## 1. Background

### 1.1 Phase 2A close — current production state (verified 2026-05-09 ~07:00 CST)

- 75/75 customer factories on Python `/api/smartbi/analysis/*` via 139 nginx regex (T6.4 5-stage cascade 06:34 CST May 9).
- F999 (internal test factory) stays on Java — not in nginx regex.
- HARD rule `active-E2E-replaces-passive-soak` (memory `feedback_active_e2e_replaces_passive_soak.md`) compresses 24h+7d soak to active Playwright/curl verification. T6.5 Phase A unblocked **NOW**, not in 7-day-soak window.

### 1.2 PR #150 spec assumptions

PR #150 spec §1.2 enumerated:
- IN SCOPE: 26 SmartBIAnalysisController endpoints + ~10 analysis service impls (including the spec-named `IncentivePlanServiceImpl` which does not exist — see §3.2.d)
- OUT OF SCOPE (KEEP): GoldDashboardBuilder, GoldFinanceClient, SmartBIConfigController, SmartBIDashboardController, SmartBIUploadController, SmartBIPublicDemoController, all DTOs, entities, repos

§1.2 IN-SCOPE silently assumes service classes are exclusively coupled to SmartBIAnalysisController, but §1.2 OUT-OF-SCOPE keeps the controllers (Dashboard / Upload / PublicDemo) that share these services — so the spec is **internally inconsistent**. This audit traces the consequence — see §3 below.

### 1.3 Open questions from PR #150

- §A.3: "Does Python's analysis layer post-T6.4 still hit `/api/smartbi/gold/finance-summary` (Java)? Or did Phase 2A inline the equivalent into Python's own `_build_from_gold_finance_summary`?" — **Answered §4.3 below.**
- §13.1: "GoldDashboardBuilder caller verification" — **Answered §4.3 below.**

---

## 2. Methodology

### 2.1 Java SmartBI source tree inventory

`Glob` patterns under `backend/java/cretas-api/src/main/java/com/cretas/aims/`:
- `controller/SmartBI*.java` → 5 controllers
- `service/smartbi/**/*.java` → 76 files (interfaces + impls + chart sub-package + util + Gold layer)
- `dto/smartbi/**/*.java` → 56 DTOs
- `entity/smartbi/**/*.java` → 47 entities (16 enums + 4 postgres-specific + 27 root)
- `repository/smartbi/**/*.java` → 27 repositories
- `client/Gold*.java` + `service/smartbi/Gold*.java` → 2 Gold-specific files

### 2.2 Nginx routing inspection

Read `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` on server 139 — three location regex blocks route subsets of `/api/mobile/{factoryId}/smart-bi/*` to `cretas_python` upstream (47:8083). Other paths fall through to `location /` → `cretas_backend` (47 Java).

### 2.3 Cross-reference dependency map

For each Java SmartBI file:
- Grep `@RestController` declarations → controller routes
- Grep service injection (`@Autowired` / constructor) → controller-to-service edges
- Grep Python `@router.get/post(...)` → confirm Python coverage of nginx-routed paths
- Grep web-admin Vue source for endpoint URLs → frontend confirmation
- Grep `frontend/CretasFoodTrace/src` for RN endpoint URLs → mobile confirmation

### 2.4 Verdict categories

- **SAFE_NGINX_ROUTED**: nginx routes 75 factories to Python, only F999 + future test factories hit Java. Stub-able in Phase B.
- **NOT_SAFE_FALLTHROUGH**: nginx does NOT route — all 75 factories still hit Java. NOT dead code.
- **KEEP_FOR_F999_INTERNAL**: still serves F999 internal test traffic.
- **KEEP_FOR_COMPOSITE_DASHBOARD**: dependency for SmartBIDashboardController (KEEP per spec §1.2).
- **KEEP_FOR_OUT_OF_SCOPE_CONTROLLER**: dependency for SmartBIConfigController / Upload / PublicDemo (KEEP per spec §1.2).
- **KEEP_GOLD_INFRASTRUCTURE**: GoldDashboardBuilder / GoldFinanceClient (KEEP per spec §1.2).

---

## 3. Deletion Candidate Inventory

### 3.1 Controllers (5 files)

| File | Endpoints | Verdict | Reason |
|---|---|---|---|
| `controller/SmartBIAnalysisController.java` | 26 endpoint methods | **PARTIAL_DELETE** in Phase C; 22 stub-able in Phase B (see §3.1.a) | Mixed — some routes nginx-Python, some not. Cannot blanket-delete. |
| `controller/SmartBIConfigController.java` | 41 (`/api/mobile/smartbi-config/*`) | KEEP_FOR_OUT_OF_SCOPE_CONTROLLER | Different prefix, not in nginx regex → all factories Java. Per spec §1.2. |
| `controller/SmartBIDashboardController.java` | 11 (`/dashboard*`, `/data-date-range`, `/generate-*`, `/analysis/dynamic*`) | **PARTIAL_STUB** in Phase B for `/data-date-range` only; rest KEEP_FOR_COMPOSITE_DASHBOARD | `/data-date-range` is nginx-Python (Python `dashboard.py:84`); other 10 endpoints fall through to Java. Calls 10 analysis services. KEEP whole controller per spec §1.2; stub only `/data-date-range` method body. |
| `controller/SmartBIUploadController.java` | 13 (`/upload*`, `/sheets`, `/uploads*`, `/backfill/*`, `/retry-sheet/*`) | KEEP_FOR_OUT_OF_SCOPE_CONTROLLER | Not in nginx regex → all factories Java. Per spec §1.2. |
| `controller/SmartBIPublicDemoController.java` | 10 (`/api/public/smart-bi/*`) | KEEP_FOR_OUT_OF_SCOPE_CONTROLLER | Different prefix → all factories Java. Per spec §1.2. |

#### 3.1.a SmartBIAnalysisController endpoint-by-endpoint verdict

| Endpoint method | Path | Nginx route | Verdict | Phase B action |
|---|---|---|---|---|
| `getSalesAnalysis` | `GET /analysis/sales` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 (F999 fallback OR migrate F999 first) |
| `getDepartmentAnalysis` | `GET /analysis/department` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getRegionAnalysis` | `GET /analysis/region` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getFinanceAnalysis` | `GET /analysis/finance` | Python ✓ (regex `/finance(/.*)?`) | SAFE_NGINX_ROUTED | Stub 410 |
| `getBudgetAchievementChart` | `GET /analysis/finance/budget-achievement` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getYoYMoMComparisonChart` | `GET /analysis/finance/yoy-mom` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getCategoryStructureComparisonChart` | `GET /analysis/finance/category-comparison` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getInventoryAnalysis` | `GET /analysis/inventory` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getProcurementAnalysis` | `GET /analysis/procurement` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| **`getProductionAnalysis`** | `GET /analysis/production` | **Java for all 75** | **NOT_SAFE_FALLTHROUGH** | KEEP — port to Python first or accept dual code path |
| **`getQualityAnalysis`** | `GET /analysis/quality` | **Java for all 75** | **NOT_SAFE_FALLTHROUGH** | KEEP — port to Python first |
| **`query`** | `POST /query` | **Java for all 75** | **NOT_SAFE_FALLTHROUGH** | KEEP — NL query path stays Java (Python lacks intent service equivalent) |
| **`drillDown`** | `POST /drill-down` | **Java for all 75** | **NOT_SAFE_FALLTHROUGH** | KEEP — Python has `analysis_drilldown.py` but nginx doesn't route to it |
| `getAlerts` | `GET /alerts` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getRecommendations` | `GET /recommendations` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getIncentivePlan` | `GET /incentive-plan/{type}/{id}` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `uploadAndDetectSchema` | `POST /datasource/upload` | Python missing — **deferred per PR #45/#49/#50 (Phase 3 backlog), NOT latent bug**. Java side 也是 TODO stub (always returns `hasChanges:false` envelope). 0 frontend callers + 0 prod log hits per Chat 5 cross-check (PR #184 — `docs/qa-audits/2026-05-09-nginx-python-coverage-cross-check.md`). Steve 决定仍派 Chat G 做 Python contract-completeness stub mirror Java behavior。 | SAFE_NGINX_ROUTED | Stub 410 |
| `previewSchemaChanges` | `GET /datasource/{id}/preview` | Python missing — **deferred per PR #45/#49/#50 (Phase 3 backlog), NOT latent bug**. Java side 也是 TODO stub (always returns `hasChanges:false` envelope). 0 frontend callers + 0 prod log hits per Chat 5 cross-check (PR #184 — `docs/qa-audits/2026-05-09-nginx-python-coverage-cross-check.md`). Steve 决定仍派 Chat G 做 Python contract-completeness stub mirror Java behavior。 | SAFE_NGINX_ROUTED | Stub 410 |
| `applySchemaChanges` | `POST /datasource/apply` | Python missing — **deferred per PR #45/#49/#50 (Phase 3 backlog), NOT latent bug**. Java side 也是 TODO stub (always returns `hasChanges:false` envelope). 0 frontend callers + 0 prod log hits per Chat 5 cross-check (PR #184 — `docs/qa-audits/2026-05-09-nginx-python-coverage-cross-check.md`). Steve 决定仍派 Chat G 做 Python contract-completeness stub mirror Java behavior。 | SAFE_NGINX_ROUTED | Stub 410 |
| `listDatasources` | `GET /datasource/list` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getDatasourceFields` | `GET /datasource/{id}/fields` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getSchemaHistory` | `GET /datasource/{id}/history` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `getQueryTemplates` | `GET /query-templates` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `createQueryTemplate` | `POST /query-templates` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `updateQueryTemplate` | `PUT /query-templates/{id}` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |
| `deleteQueryTemplate` | `DELETE /query-templates/{id}` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 |

**Counts**: 22 SAFE_NGINX_ROUTED + 4 NOT_SAFE_FALLTHROUGH = **26 of 26 endpoints classified** (verified by `grep -c "@(Get|Post|Put|Delete|Patch)Mapping"` against `SmartBIAnalysisController.java`). Net **22 of 26 stub-able from this controller**; **+1 from SmartBIDashboardController** (`/data-date-range`, see §3.1.b) = **23 Phase B stub candidates total**.

> **v3 amendment (method names)**: 8 method names corrected from spec-paraphrased forms (`getFinanceBudgetAchievement`, `getFinanceYoYMoM`, `getFinanceCategoryComparison`, `nlQuery`, `uploadDatasource`, `previewDatasource`, `applyDatasource`, `listDatasource`) to actual class member names. Verified against `grep '@(Get|Post|Put|Delete|Patch)Mapping' SmartBIAnalysisController.java` post-Chat 3 PR-Z review.

> ⚠️ **v3 amendment (datasource POST Python missing — deferred Phase 3 backlog, NOT latent bug)** per Chat 4 cross-verify (PR-W §6.1) + Chat 5 cross-check (PR #184) reframing: nginx routes 75-cohort + F999 the 3 paths `POST /datasource/upload`, `GET /datasource/{id}/preview`, `POST /datasource/apply` to Python upstream, but Python `smartbi_compat/api/datasource.py` does **not** implement them — Returns 404 since T6.4 cutover (May 9 06:34 CST), with **0 frontend callers + 0 prod log hits** confirming customer-invisible.
>
> - **Chat 5 audit (PR #184)**: `docs/qa-audits/2026-05-09-nginx-python-coverage-cross-check.md` — evidence + recommendation matrix.
> - **Chat G (Python contract-completeness stub impl)**: PR `<chat-G-PR>` (placeholder; organizer 会在 admin-merge 前 sed 替换成实际 PR number).
> - **Truth**: 这 3 个 endpoint 既不在 Java 也不在 Python 真正实现 — 是 known Phase 3 backlog (PR #45/#49/#50 plan)。Java side 是 TODO stub (always returns `hasChanges:false` envelope), Phase 2A 没真正 port (router-file 占位 only)。
>
> The SAFE_NGINX_ROUTED + Stub 410 verdict still applies once Python contract-completeness stub lands (Chat G); in the interim Phase B stub-out is BLOCKED for these 3 rows so the framing reflects "deferred" rather than "broken".

#### 3.1.b SmartBIDashboardController — `/data-date-range` Phase B candidate

Per §3.1 row, SmartBIDashboardController is mostly KEEP, but the single `/data-date-range` endpoint method (`SmartBIDashboardController.java:345`) is nginx-routed to Python (`backend/python/smartbi_compat/api/dashboard.py:84` confirms route exists). Structurally identical to the 22 SAFE_NGINX_ROUTED endpoints on SmartBIAnalysisController:

| Endpoint method | Path | Nginx route | Verdict | Phase B action |
|---|---|---|---|---|
| `getDataDateRange` | `GET /data-date-range` | Python ✓ | SAFE_NGINX_ROUTED | Stub 410 (matches the 22 stubs on SmartBIAnalysisController) |

The other 10 endpoints on SmartBIDashboardController (`/dashboard*`, `/dashboard/executive*`, `/generate-*`, `/analysis/dynamic*`) stay alive — they fall through to Java for all 75 factories per current nginx regex.

### 3.2 Service classes (~76 files in `service/smartbi/`)

#### 3.2.a Analysis service classes (10 + 10 impls = 20 files) — all SHARED

Each of the 10 analysis services is injected by **multiple** controllers per `Grep` over `controller/`:

| Service | SmartBIAnalysisController | SmartBIDashboardController | SmartBIPublicDemoController | SmartBIUploadController | Verdict |
|---|---|---|---|---|---|
| `SalesAnalysisService` | ✓ | ✓ (`/dashboard/executive*`, `/dashboard/executive/custom`) | ✓ (PublicDemo composite) | — | **KEEP_FOR_COMPOSITE_DASHBOARD** |
| `DepartmentAnalysisService` | ✓ | ✓ | ✓ | — | **KEEP_FOR_COMPOSITE_DASHBOARD** |
| `RegionAnalysisService` | ✓ | ✓ | ✓ | — | **KEEP_FOR_COMPOSITE_DASHBOARD** |
| `FinanceAnalysisService` | ✓ | ✓ | ✓ | — | **KEEP_FOR_COMPOSITE_DASHBOARD** |
| `ProductionAnalysisService` | ✓ (NOT routed to Python) | ✓ | — | — | **KEEP_FOR_COMPOSITE_DASHBOARD + NOT_SAFE_FALLTHROUGH** |
| `QualityAnalysisService` | ✓ (NOT routed to Python) | ✓ | — | — | **KEEP_FOR_COMPOSITE_DASHBOARD + NOT_SAFE_FALLTHROUGH** |
| `InventoryHealthAnalysisService` | ✓ | ✓ | — | — | **KEEP_FOR_COMPOSITE_DASHBOARD** |
| `ProcurementAnalysisService` | ✓ | ✓ | — | — | **KEEP_FOR_COMPOSITE_DASHBOARD** |
| `DynamicAnalysisService` | ✓ (`/query`, `/drill-down` NOT routed) | ✓ (`/analysis/dynamic`) | — | ✓ (field defs / backfill) | **KEEP_FOR_COMPOSITE_DASHBOARD + NOT_SAFE_FALLTHROUGH** |
| `RecommendationService` | ✓ | ✓ | ✓ | — | **KEEP_FOR_COMPOSITE_DASHBOARD** |

**Verdict**: 0 of 20 analysis service files (10 interface + 10 impl) can be deleted in Phase C without first deprecating SmartBIDashboardController, SmartBIPublicDemoController, and SmartBIUploadController — those are explicitly OUT_OF_SCOPE per spec §1.2.

This reveals an **internal inconsistency in PR #150 spec**: §1.2 IN-SCOPE silently assumes service classes are exclusively coupled to SmartBIAnalysisController, but §1.2 OUT-OF-SCOPE keeps SmartBIDashboardController/PublicDemo/Upload — the controllers that share these services. Spec §2.3 §C.1 "REMOVE per audit" enumeration would therefore cause compile errors when the deletion of e.g. `SalesAnalysisServiceImpl` breaks `SmartBIDashboardController`'s constructor injection. This audit traces the consequence the spec didn't.

**Refined Phase C plan**: instead of file deletion, do **method-level audit** within service impls. For each method (`getSalesOverview`, `getSalespersonRanking`, etc.), grep for callers in OUT-OF-SCOPE controllers — if not called from any KEEP'd controller, the **method** can be removed. Service class file stays.

#### 3.2.b Gold layer (2 files) — KEEP

| File | Callers | Verdict |
|---|---|---|
| `service/smartbi/GoldDashboardBuilder.java` | `SalesAnalysisServiceImpl:52`, `FinanceAnalysisServiceImpl:59` (both inject as `goldDashboardBuilder`) | **KEEP_GOLD_INFRASTRUCTURE** — answers §4.3 open question. |
| `client/GoldFinanceClient.java` | `GoldDashboardBuilder:51`, `FinanceAnalysisServiceImpl:58` | **KEEP_GOLD_INFRASTRUCTURE** |

#### 3.2.c Other service files (~54 remaining) — KEEP

Spot-checked subsets:

| Category | Files | Verdict |
|---|---|---|
| Entity recognizers (`*EntityRecognizer.java`, 6 files) | Used by `SmartBIIntentService` for NL query routing | **KEEP** — `/query` endpoint stays Java |
| Chart sub-package (`chart/*.java`, 7 files: Adaptive/Fusion/Sufficiency + impls + DataFeature) | `SmartBIDashboardController:88` injects `adaptiveChartGenerator` for `/generate-adaptive-charts` | **KEEP_FOR_COMPOSITE_DASHBOARD** |
| `IncentiveRuleService` + impl | `SmartBIAnalysisController` (`/incentive-plan` Python-routed) + likely `SmartBIConfigController` (`/incentive-rules`) | **KEEP_FOR_OUT_OF_SCOPE_CONTROLLER** |
| `AlertThresholdService` + impl | `SmartBIAnalysisController` (`/alerts` Python-routed) + likely `SmartBIConfigController` (`/thresholds`) | **KEEP_FOR_OUT_OF_SCOPE_CONTROLLER** |
| `ChartTemplateService` + impl | `SmartBIDashboardController` + likely `SmartBIConfigController` (`/chart-templates`) | **KEEP_FOR_OUT_OF_SCOPE_CONTROLLER** |
| `MetricFormulaService` / `MetricCalculatorService` / `SmartBIPromptService` / `SmartBIIntentService` / `SmartBIIntentMapper` / `SmartBiSchemaService` / `LLMFieldMappingService` / `SmartBiSchemaService` / `ExcelDataPersistenceService` / `ExcelDynamicParserService` / `DynamicDataPersistenceService` / `DataSourceRegistryService` / `ProductionDataExportService` / `ChartFusionService` / `AnalysisPromptGenerator` / `SmartBIService` / `SmartBIConfigService` / `SmartBIUploadFlowService` / `ForecastService` / `MetricFormulaService` / `DimensionEntityRecognizer` / `BaseEntityRecognizer` etc. | Various OUT-OF-SCOPE controllers + intent service + upload flow | **KEEP** (require method-level audit in Phase C if optimization desired) |
| `util/DynamicDataParser.java` | Internal utility, used by `*Impl` classes | **KEEP** |

#### 3.2.d Spec drift flag — `IncentivePlanServiceImpl` does not exist

PR #150 spec §1.2 IN-SCOPE list (line 85) cites **`IncentivePlanServiceImpl`** as a deletion candidate. **This class does not exist** in the codebase. Verified via `Glob` over `service/smartbi/impl/`:

| Spec name | Actual class | Location |
|---|---|---|
| `IncentivePlanServiceImpl` (spec §1.2) | **does not exist** | — |
| (spec doesn't list) | `IncentiveRuleServiceImpl` | `service/smartbi/impl/IncentiveRuleServiceImpl.java` |
| (spec doesn't list) | `IncentiveRuleService` (interface) | `service/smartbi/IncentiveRuleService.java` |

Spec drift origin: likely paraphrased from the `/incentive-plan/{type}/{id}` endpoint name on SmartBIAnalysisController. The endpoint exists, the service is `IncentiveRuleService` (concept: rules drive plan generation). Phase B/C dispatch must reference the actual class name. Audit recommends amending PR #150 spec §1.2 to reflect the correct class name.

`IncentiveRuleService` is referenced from SmartBIAnalysisController (`/incentive-plan/*` Python-routed) AND likely from SmartBIConfigController (`/incentive-rules` config CRUD per `Grep` line 245-324) → **KEEP_FOR_OUT_OF_SCOPE_CONTROLLER** (already classified in §3.2.c).

> **v3 amendment (independent cross-confirmation)** per Chat 4 cross-verify (PR-W §6.4): `ls backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/Incentive*` returns only `IncentiveRuleServiceImpl.java`. PR #150 spec line 85 drift confirmed by independent grep. PR-X (Decision 4B spec amend) fixes the spec; this audit was already correct (no content change needed, just cross-confirmed).

### 3.3 DTOs (56 files in `dto/smartbi/`)

Per spec §1.2 OUT-OF-SCOPE: "All DTOs in `dto/smartbi/` — Cross-language contract via GoldDashboardBuilder. Keep."

Confirmed — DTOs are wire-shape contracts (DashboardResponse, KPICard, ChartConfig, etc.) consumed by remaining Java controllers + via Python's mirror dicts. **All 56 KEEP.**

### 3.4 Entities (47 files in `entity/smartbi/`)

Per spec §1.2 OUT-OF-SCOPE: "Entities in `entity/smartbi/` — Read by Java for legacy compat or by other Java services. Audit per Phase D."

Quick audit:
- 16 enums (`enums/*.java`) — used across Java + DTO contracts. **KEEP**.
- 4 postgres-specific entities (`postgres/Smart*.java`) — JPA entities for smart_bi schema, used by repositories. **KEEP** unless table dropped Phase D.
- 27 root entities — JPA mappings for smart_bi schema tables. **KEEP** until Phase D table-level audit confirms drop-able.

**Phase D scope**: confirm that all writes to `smart_bi*` tables originate from Python post-T6.5. If yes, entities still serve JPA reads but are read-only consumers — won't auto-trigger Phase D removal. Proceed with caution.

### 3.5 Repositories (27 files in `repository/smartbi/`)

Most repos provide JPA query layer for entities also referenced by OUT-OF-SCOPE controllers — **KEEP** until Phase D confirms entity table is drop-able.

**Exception — Phase C orphan candidate**: `SmartBiQueryTemplateRepository` is referenced in **only two files** per `Grep` over the full Java tree:

| File | Role |
|---|---|
| `controller/SmartBIAnalysisController.java` | Consumer — 4 query-templates endpoints (lines 956/965/976/997), all SAFE_NGINX_ROUTED, all stub-able in Phase B |
| `repository/smartbi/SmartBiQueryTemplateRepository.java` | The repo file itself (interface declaration) |

After Phase B stubs the 4 `/query-templates*` endpoints, `SmartBiQueryTemplateRepository` has **zero non-self callers in Java**. It becomes a Phase C orphan candidate alongside the 4 controller method bodies.

**Recommendation**: in Phase C, when removing the 4 stubbed query-templates controller method bodies, also delete `SmartBiQueryTemplateRepository.java` + its companion entity `SmartBiQueryTemplate.java` (entity used only via this repo, verify in Phase C grep).

This pattern (controller-method ↔ repo ↔ entity exclusively coupled) might exist for other repos too — Phase C method-level audit should look for the same "exclusively used by stubbed endpoints" signature.

---

## 4. Phase B kickoff readiness

### 4.1 Stub-out scope (refined from PR #150 spec §B.1)

**Recommendation**: Phase B stubs **23 endpoint methods total**: the 22 SmartBIAnalysisController endpoint methods marked SAFE_NGINX_ROUTED (§3.1.a) **+ 1 method on SmartBIDashboardController** (`getDataDateRange`, see §3.1.b). Two implementation options:

**Option A — Unconditional 410 (mirrors PR #150 §B.1)**:
```java
@GetMapping("/analysis/sales")
public ResponseEntity<...> getSalesAnalysis(...) {
    return ResponseEntity.status(HttpStatus.GONE).body(Map.of(
        "success", false,
        "code", "SMARTBI_MIGRATED",
        "message", "Moved to Python /api/smartbi/analysis/sales",
        "newPath", "/api/smartbi/analysis/sales"
    ));
}
```

**Risk**: F999 hits Java for everything (not in nginx regex) → F999 gets 410 for `/analysis/sales` after Phase B. F999 is internal test, low impact, but verify before stub.

**Option B — Conditional 410, F999 fallthrough**:
```java
@GetMapping("/analysis/sales")
public ResponseEntity<...> getSalesAnalysis(@PathVariable String factoryId, ...) {
    if (!"F999".equals(factoryId)) {  // legacy fallback for test factories
        return ResponseEntity.status(HttpStatus.GONE).body(...);
    }
    // existing implementation continues for F999
    return existingSalesLogic(...);
}
```

**Trade-off**: Option B keeps F999 working but adds branching code. Option A is cleaner but breaks F999 testing. Recommend **Option A** with explicit communication to F999 test users (only Cretas internal team) that F999 SmartBI Analysis endpoints will return 410 starting `<Phase B start date>`. F999 can be migrated to Python independently if needed (small follow-up task).

### 4.2 NOT-SAFE methods stay untouched in Phase B

The 4 NOT_SAFE_FALLTHROUGH methods (`/analysis/production`, `/analysis/quality`, `/query`, `/drill-down`) keep their existing Java implementations. They are NOT dead code:
- 75 customer factories actively hit them through nginx fall-through
- Stubbing them = customer-visible regression

To deprecate these in a future Phase, we need either:
- (a) Port the missing endpoints to Python + add nginx regex coverage, OR
- (b) Sunset feature (remove from frontend + backend simultaneously)

Phase A flags these as **deferred to Phase 2C-bis** or similar (not T6.5 scope).

### 4.3 Open questions from PR #150 — answered

#### §A.3 / §13.1: GoldDashboardBuilder caller chain

**Answer**: GoldDashboardBuilder is **NOT orphaned**. It has 2 active callers in Java:
- `service/smartbi/impl/SalesAnalysisServiceImpl.java:52` injects `goldDashboardBuilder`, calls `.buildFromGold...()` at line 94 inside the Gold-primary path (gated on `smartbi.gold.read-primary.enabled` flag).
- `service/smartbi/impl/FinanceAnalysisServiceImpl.java:59` same pattern (line 122).

Both `SalesAnalysisServiceImpl` and `FinanceAnalysisServiceImpl` are called by **SmartBIDashboardController** (`/dashboard/executive*` flows for all 75 factories) — so Java→Python round-trip via internal HTTP at `47:8083` is still active even after T6.4.

`GoldFinanceClient.java` similarly stays alive — injected by `GoldDashboardBuilder` and `FinanceAnalysisServiceImpl`.

**Verdict**: KEEP through Phase D. Spec §1.2 OUT-OF-SCOPE classification confirmed correct.

#### Phase 2A inlining check

Did Phase 2A inline the Java GoldDashboardBuilder logic into Python's `_build_from_gold_finance_summary`? **Yes** — `analysis_finance.py:1749` (and `analysis_sales.py:1180`) contain Python mirrors of `buildFromFinanceSummary`. They read directly from Python's local Gold layer (`smartbi/gold/finance_summary.py` via `gold_reads.py` router) without round-tripping to Java.

**Net architecture post-T6.4**:
- 75 factories `/api/mobile/{factory}/smart-bi/analysis/finance` → Python mirror (no Java involvement)
- All factories `/api/mobile/{factory}/smart-bi/dashboard/executive` → Java SmartBIDashboardController → Java FinanceAnalysisService → Java GoldDashboardBuilder → Java GoldFinanceClient → Python `/api/smartbi/gold/finance-summary`
- F999 `/api/mobile/F999/smart-bi/analysis/finance` → Java SmartBIAnalysisController → Java FinanceAnalysisService → Java GoldDashboardBuilder → Java GoldFinanceClient → Python Gold

The Java→Python round-trip is therefore active for 75 factories (via Dashboard composite) + F999 (via Analysis F999 fallback) + via PublicDemo if any traffic.

### 4.4 Metric monitoring scope (refined PR #150 §A.1)

PR #150 §A.1 daily monitoring command:
```bash
grep -E '/api/mobile/[^/]+/smart-bi/(analysis|alerts|recommendations|datasource|query|drill-down|query-templates)' \
  /www/wwwroot/cretas/cretas-prod.log
```

**Refined for Phase A reality**: this grep will match BOTH dead paths AND alive paths (`/query`, `/drill-down`, `/analysis/production`, `/analysis/quality` are alive). Refine to:

```bash
# Only the 22 nginx-routed SAFE_NGINX_ROUTED paths
grep -E '/api/mobile/(?!F999)[^/]+/smart-bi/(alerts|recommendations|data-date-range|datasource|incentive-plan|query-templates|analysis/(sales|department|region|finance|inventory|procurement))' \
  /www/wwwroot/cretas/cretas-prod.log
```

**Expected**: 0 matches over 14 days. Any hit → investigate (nginx miss-route, direct IP-bypass, F999 query template, etc.).

For NOT_SAFE_FALLTHROUGH paths, monitor traffic volume only — they are alive code, traffic is expected.

---

## 5. Risk Assessment

### 5.1 Risks introduced by this audit's findings

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase B Option A stub breaks F999 internal testing | HIGH (F999 will get 410 for SmartBI Analysis paths) | LOW (F999 = test factory) | Communicate to internal test team T-72h; offer F999 migration to Python if needed |
| PR #150 spec readers misinterpret "remove ~10 service impls" | HIGH (spec §1.2 IN-SCOPE / OUT-OF-SCOPE are internally inconsistent — IN-SCOPE assumes exclusive coupling, OUT-OF-SCOPE keeps the sharing controllers) | MED (could cause Phase C scope creep + compile errors) | This audit doc traces the consequence; Phase B/C dispatch must reference this audit alongside spec |
| NOT_SAFE_FALLTHROUGH endpoints accidentally stubbed | LOW (Phase B PR review) | HIGH (75 factories regression) | §3.1.a table explicit; PR review must check each stub against table |
| Phase D entity table drops break GoldDashboardBuilder JPA reads | LOW | HIGH | Phase D confined to schema audit, not table drops; Gold tables must stay if Java reads continue |

### 5.2 Risks NOT introduced (already in PR #150 §8 risk register)

- Internal tooling hits Java 10010 SmartBI Analysis directly during Phase A → unchanged from spec §8 row 1.
- GoldDashboardBuilder orphaned → REFUTED (this audit §4.3 confirms not orphaned).
- Phase B 410 breaks unknown legacy client → unchanged from spec §8 row 3.
- Phase C wholesale class removal causes compile error → **HIGH probability per this audit §3.2.a**, mitigation = Phase C method-level audit instead of file deletion.

---

## 6. Recommendation — Refined Phase B/C scoping

### 6.1 Phase B (~14 days, target start 2026-05-09 or after Phase A internal review)

- **Scope**: Stub **23 endpoint methods total** (Option A — unconditional 410):
  - 22 on SmartBIAnalysisController per §3.1.a SAFE_NGINX_ROUTED rows.
  - 1 on SmartBIDashboardController per §3.1.b (`getDataDateRange` only — other 10 endpoints on Dashboard stay alive).
- **Out-of-scope for Phase B**: All service classes (KEEP intact), all OUT_OF_SCOPE controllers' OTHER methods, all DTOs/entities/repos.
- **Pre-flight**:
  - Confirm F999 internal test traffic on Java SmartBI Analysis (read 14d prod log filter for `F999/smart-bi/analysis`).
  - Ping internal test team — accept 410 for F999 OR plan F999 migration.
- **Implementation**:
  - PR-1: Stub the 23 method bodies, return 410 with `code=SMARTBI_MIGRATED`, retain `@RestController` annotation + `@Autowired` constructor + service refs (Spring Bean preservation per spec §B.2).
  - PR-2: Refine prod log monitoring command per §4.4.
- **Rollback**: Git revert PR-1 + Java JAR redeploy. Per spec §B.3 — this audit doesn't change rollback procedure.

### 6.2 Phase C (post-30d Phase B soak — target ~mid-July 2026)

**Refined from PR #150 §C.1 / C.3**:

- **NOT** wholesale file deletion of analysis service impls.
- Instead, **method-level audit per service impl**:
  - For each public method in `SalesAnalysisServiceImpl` (e.g., `getSalesOverview`, `getSalespersonRanking`, `getProductRanking`, `getSalesTrendChart`):
    - Grep callers in OUT-OF-SCOPE controllers (Dashboard / PublicDemo / Upload).
    - If 0 callers post-stub-out → method is dead, can be removed.
    - If ≥1 caller → method stays.
- Possibly **remove the 22 public stubbed Controller methods entirely** (not just stub) — that's the only file-level deletion that's safely composable.
- **NOT_SAFE_FALLTHROUGH controller methods** (`/analysis/production`, `/quality`, `/query`, `/drill-down`) STAY in controller entirely. These are alive paths.

**Estimated Phase C effort**: ~5-10 person-days method-level audit + impl reduction. Lower scope than spec §C.1 implied.

#### 6.2.a v3 amendment — Test.java does not exist (PR #150 spec §C.2 obsolete)

> **v3 amendment per Chat 3 PR-Z review**: PR #150 spec §C.2 enumerates `SmartBIAnalysisControllerTest.java` as a Phase C test-file deletion candidate. **That test file does NOT exist** in the repo (verified via `Glob 'backend/java/cretas-api/src/test/**/SmartBIAnalysisControllerTest.java'` post-cutover — 0 matches). Phase B has no controller test deletion work. Smoke verification is handled at env-level (test env `curl` per stub list in PR-Z marching order) instead of unit test removal. PR #150 spec §C.2 should be amended (PR-X scope) to drop the `SmartBIAnalysisControllerTest.java` row; this audit retains the §6.2.a callout for traceability so future readers don't re-discover the same gap.

### 6.3 Phase D (ongoing, post-T6.5)

Unchanged from PR #150 spec §2.4 — confirm Python is canonical SmartBI writer. Audit JPA `@Modifying` queries in repositories. Quarterly schema-write audit.

### 6.4 NEW recommendation — Pre-T6.5 housekeeping ticket

Schedule a **separate, low-priority follow-up** ticket post-T6.5 Phase D:

- Migrate F999 to Python: F999 is 1 internal test factory. Adding it to nginx regex `(F00[1-46]|...|F999)` and ensuring Python serves `analysis/production` + `analysis/quality` + `query` + `drill-down` endpoints would let us delete those 4 NOT_SAFE_FALLTHROUGH methods in a future Phase E.
- This is **out of T6.5 scope** but worth tracking as "T6.6 candidate".

---

## 7. Summary Counts

| Category | Files / Methods | Verdict |
|---|---|---|
| SmartBIAnalysisController endpoint methods | 22 of 26 | **SAFE_NGINX_ROUTED** (Phase B stub-able) |
| SmartBIAnalysisController endpoint methods | 4 of 26 | **NOT_SAFE_FALLTHROUGH** (stay Java — production/quality/query/drill-down) |
| **SmartBIDashboardController endpoint methods** | **1 of 11** (`/data-date-range`) | **SAFE_NGINX_ROUTED** (Phase B stub-able, see §3.1.b) |
| SmartBIDashboardController endpoint methods | 10 of 11 | KEEP_FOR_COMPOSITE_DASHBOARD (alive Java paths) |
| SmartBIPublicDemoController | 10 endpoints | **KEEP per spec §1.2** (different prefix `/api/public/`) |
| SmartBIConfigController | 41 endpoints | **KEEP per spec §1.2** (different prefix `/api/mobile/smartbi-config`) |
| SmartBIUploadController | 13 endpoints | **KEEP per spec §1.2** (not in nginx regex) |
| Analysis service classes (interface + impl) | 0 of 20 deletable in Phase C | **All SHARED — KEEP** (method-level audit instead) |
| `IncentivePlanServiceImpl` (per spec §1.2) | does not exist | **Spec drift** — actual class is `IncentiveRuleServiceImpl` (KEEP, see §3.2.d) |
| Gold layer (GoldDashboardBuilder + GoldFinanceClient) | 2 files | **KEEP_GOLD_INFRASTRUCTURE** (NOT orphaned per §4.3) |
| Entity recognizers + chart sub-package + Excel/Schema/Intent services | ~54 files | **KEEP** (deps for KEEP'd controllers) |
| DTOs | 56 files | **KEEP per spec §1.2** |
| Entities | 47 files | **KEEP per spec §1.2** (Phase D audit) |
| Repositories (most) | 26 of 27 files | **KEEP per spec §1.2** (Phase D audit) |
| **`SmartBiQueryTemplateRepository`** | **1 of 27** | **Phase C orphan candidate** post-stub-out (see §3.5) — reclassify from blanket KEEP |

**Phase B scope (concrete)**: stub **23 controller endpoint methods total** (22 on SmartBIAnalysisController + 1 `/data-date-range` on SmartBIDashboardController) returning 410. No service-class touches.

**Net deletion scope (Phase C realistic)**:
- 23 controller method bodies removed (Phase B stub-out → Phase C delete).
- 1 repository file deletable (`SmartBiQueryTemplateRepository.java`) + likely its companion entity `SmartBiQueryTemplate.java` (verify by Phase C grep).
- 0 service class files deleted.
- N service methods deletable per method-level audit (TBD by Phase C dispatch — exemplar Phase C kickoff = pick FinanceAnalysisServiceImpl, enumerate public methods, grep callers per OUT-OF-SCOPE controller).
- 0 DTOs / entities (besides SmartBiQueryTemplate) deleted in Phase C (Phase D may flag more).

**Phase 2A → T6.5 → Phase 3 scope reduction**: PR #150 spec §1.2 IN-SCOPE list (controllers + ~10 service impls) is internally inconsistent with §1.2 OUT-OF-SCOPE (which keeps the sharing controllers). This audit traces the consequence and revises Phase C's realistic deletion scope down to **~23 method bodies + 1 repo + N service methods (TBD)**. **More conservative, less risky, more feasible.**

---

## 8. Next steps

### 8.1 For organizer (decision points)

1. **Approve this audit's reduced scope**: confirm SmartBIDashboardController + service classes stay intact, and Phase B targets only the 22 endpoint methods.
2. **Decide Option A vs B** for Phase B stub: unconditional 410 (Option A, recommended) vs F999 carve-out (Option B).
3. **Schedule T6.6 follow-up ticket** for F999 Python migration if internal team needs F999 SmartBI Analysis to keep working.
4. **Update PR #150 spec** §1.2 + §2.3 §C.1 to reflect this audit's findings (or annotate spec as "see Phase A audit override").

### 8.2 For Phase B implementation chat

1. Read this audit + PR #150 spec §B.1.
2. Reference §3.1.a table for exact 22 endpoint methods to stub.
3. Implement Option A unconditional 410 stubs (one PR, ~50-100 LOC across 22 method bodies).
4. Update prod log monitoring command per §4.4 to filter F999 + only target Python-routed paths.

### 8.3 For Phase C planning chat (~July 2026)

1. Method-level audit per service impl class (NOT file deletion).
2. Identify which `*ServiceImpl` public methods are now dead post-Phase-B (no callers in OUT-OF-SCOPE controllers).
3. Remove dead methods + their helpers (private), keeping public class structure intact.
4. Re-audit DTOs/entities/repos at method level for any newly-orphaned DTO fields.

### 8.4 For Phase D ongoing work

Continue per spec §2.4 — quarterly schema-write audit. No change from spec.

---

## 9. Confidence + caveats

### 9.1 Confidence

- **High** confidence in nginx routing analysis — read directly from prod nginx config on server 139.
- **High** confidence in Java service-class sharing — confirmed by `Grep` over `controller/` for service field declarations.
- **Medium-high** confidence in Python coverage — confirmed `analysis_*.py` routes for SAFE_NGINX_ROUTED paths but did not exhaustively verify response shape parity (covered by Phase 2A T6.1 dryrun 100.000% match).
- **Medium** confidence in service-method-level audit (§6.2 Phase C plan) — actual deletable method count needs Phase C deep dive, not this Phase A scan.

### 9.2 Caveats

- This audit is a **doc only** — no code changes or operational changes.
- Findings depend on current nginx config (`bak.t6_4_s5_pre.20260509_063332` + post-Stage-5 state). Future nginx regex changes (e.g., production/quality cutover, F999 migration) will shift verdicts.
- Service classes flagged KEEP may have refactor opportunities Phase C reveals (e.g., `EntityRecognizer` cluster only used by `SmartBIIntentService` for `/query`; if `/query` future deprecates, those become removable).
- DTOs flagged KEEP may have unused fields post-Phase-B that Phase D could prune.

### 9.3 Open questions for organizer

1. **F999 fate**: keep on Java indefinitely, OR migrate to Python in future T6.6?
2. **Phase B stub Option A vs B**: tolerate F999 SmartBI Analysis 410 OR add carve-out branching?
3. **Phase C realistic scope**: agreed to method-level audit instead of file deletion (per §6.2)?
4. **PR #150 spec amendments**: does this audit go into PR #150 spec doc as Phase A annotation, OR stay as standalone audit doc with cross-reference?

---

**End of T6.5 Phase A Java SmartBI Analysis Deletion Candidates Audit**
