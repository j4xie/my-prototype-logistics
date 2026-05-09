# T6.5 Java SmartBI Deprecation — Trigger Spec

**Phase**: T6.5 (post-T6.4 cleanup of Java SmartBI analysis layer)
**Status**: Spec / planning doc only — execution contingent on T6.4 100% GO + 14-day dead-time verification window
**Author**: chat 3 (T6.5 deprecation spec writer)
**Date**: 2026-05-08
**Target kickoff**: 2026-05-15+ (after T6.4 24h soak GO, ~2026-05-15)
**Predecessor**: T6.4 5-stage cutover (PR #144 stage MOs, May 10-14 CST)

---

## 0. TL;DR

> ⚠️ **Phase A audit amendment (2026-05-09, Decision 4B)**: This spec was authored against an idealized "all 26 SmartBIAnalysisController endpoints dead" model. Phase A discovery audit (`docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md`) reconciled the spec against actual nginx coverage and Java service-class sharing. Headline findings baked into the sections below:
>
> - **22 of 26** SmartBIAnalysisController endpoints are nginx-routed (SAFE_NGINX_ROUTED). The remaining **4 are NOT_SAFE_FALLTHROUGH** and stay alive for all 75 factories: `/analysis/production`, `/analysis/quality`, `POST /query`, `POST /drill-down` — **deferred to T6.6** (see `docs/superpowers/specs/<TBD>-t6-6-not-safe-fallthrough-spec.md`).
> - **+1 SmartBIDashboardController endpoint** (`GET /data-date-range`) is structurally identical to the 22 Analysis stubs — nginx-Python-routed for 75 factories, Java fall-through for F999. **Phase B stub-able as the 23rd candidate** even though SmartBIDashboardController is otherwise KEEP.
> - **GoldDashboardBuilder + GoldFinanceClient are NOT orphaned** (audit §4.3) — `SalesAnalysisServiceImpl:52` + `FinanceAnalysisServiceImpl:59` inject and call them in the Gold-primary path; both services are called by SmartBIDashboardController `/dashboard/executive*` flows for all 75 factories. KEEP through Phase D as currently scoped (§1.2 OUT-OF-SCOPE confirmed correct).
> - **All 10 analysis service classes are SHARED** with SmartBIDashboardController / SmartBIPublicDemoController / SmartBIUploadController. **Wholesale class-file deletion would cause compile errors.** Phase C scope refined to **method-level audit** (see §C.1 amendment).
>
> Phase B stub count revised: **23 endpoint methods** (22 SmartBIAnalysisController + 1 SmartBIDashboardController `/data-date-range`). Cross-references: audit doc above, plus T6.6 spec for the 4 NOT_SAFE_FALLTHROUGH endpoints.

After T6.4 routes 100% of factories' `/api/mobile/{factoryId}/smart-bi/analysis/*` to Python (8083), **22 of 26** Java SmartBIAnalysisController endpoints become operationally dead — plus 1 endpoint on SmartBIDashboardController (`/data-date-range`) — totaling **23 Phase B stub-able methods**. The other 4 endpoints (`production`, `quality`, `/query`, `/drill-down`) stay alive for 75 factories and are deferred to T6.6. T6.5 is the staged cleanup of the 23 dead methods:

- **Phase A** (14 days): Verify dead status — log monitoring (filtered to 22 SAFE_NGINX_ROUTED + 1 Dashboard path), operator query, no direct Java hits
- **Phase B** (14 days): Stub out the 23 endpoint methods to return 410 Gone (Option A — unconditional, per organizer decision; F999 internal test factory accepts 410), keep Spring Bean structure
- **Phase C** (after 30 days dead): **Method-level audit** of analysis service impls (NOT wholesale file deletion — service classes are SHARED with KEEP'd controllers). Remove the 23 stubbed controller method bodies + `SmartBiQueryTemplateRepository.java` + companion entity (post-stub orphans).
- **Phase D** (ongoing): DB-level audit confirming Python is canonical SmartBI writer

**Out of scope** (KEEP Java code): `GoldDashboardBuilder` + `GoldFinanceClient` (Python downstream consumers, NOT orphaned per audit §4.3); 10 analysis service class files (SHARED with KEEP'd controllers — method-level audit only); SmartBI Config / Upload / PublicDemo controllers entirely; SmartBIDashboardController **except** for `/data-date-range` method body (Phase 2B+ scope, separate decisions). The 4 NOT_SAFE_FALLTHROUGH endpoints stay until T6.6.

---

## 1. Pre-T6.5 state (trigger conditions)

### 1.1 T6.4 completion gate

T6.5 cannot kickoff until **all** of:

- [ ] T6.4 Stage 5 (May 14) 24h soak GO declared
- [ ] All 75 factories on Python `/api/smartbi/analysis/*` via 139 nginx vhost regex
- [ ] 0 P1 customer reports in 24h post-Stage-5 window
- [ ] T6 dryrun-compare ≥99% match rate sustained
- [ ] Phase 2A retrospective doc started (`docs/superpowers/retrospectives/2026-05-15-phase2a-complete.md`)
- [ ] Per-customer §3.5 baseline metrics within ±20% of pre-cutover (revenue / order / dashboard rate)

### 1.2 Java SmartBI deprecation scope

#### IN SCOPE (T6.5 deprecates)

The 26 analysis endpoints on `SmartBIAnalysisController.java` (the 50-endpoint Phase 2A port target after counting service-level methods):

```
@RequestMapping("/api/mobile/{factoryId}/smart-bi")
class SmartBIAnalysisController {
    @GetMapping("/analysis/sales")               // ported
    @GetMapping("/analysis/department")          // ported
    @GetMapping("/analysis/region")              // ported
    @GetMapping("/analysis/finance")             // ported
    @GetMapping("/analysis/finance/budget-achievement")
    @GetMapping("/analysis/finance/yoy-mom")
    @GetMapping("/analysis/finance/category-comparison")
    @GetMapping("/analysis/production")          // ported
    @GetMapping("/analysis/quality")             // ported
    @GetMapping("/analysis/inventory")           // ported
    @GetMapping("/analysis/procurement")         // ported
    @PostMapping("/query")                       // ported (drill-down)
    @PostMapping("/drill-down")                  // ported
    @GetMapping("/alerts")                       // ported (PR-M-1)
    @GetMapping("/recommendations")              // ported
    @GetMapping("/incentive-plan/{type}/{id}")   // ported
    @PostMapping("/datasource/upload")           // deferred per PR #45/#49/#50 (Phase 3 backlog), Java + Python 都是 TODO stub
    @GetMapping("/datasource/{id}/preview")      // deferred per PR #45/#49/#50 (Phase 3 backlog), Java + Python 都是 TODO stub
    @PostMapping("/datasource/apply")            // deferred per PR #45/#49/#50 (Phase 3 backlog), Java + Python 都是 TODO stub
    @GetMapping("/datasource/list")              // ported (PR-M-7 microsecond fix)
    @GetMapping("/datasource/{id}/fields")       // ported
    @GetMapping("/datasource/{id}/history")      // ported
    @GetMapping("/query-templates")              // ported
    @PostMapping("/query-templates")             // ported (write)
    // ... full list per controller line 48-1000+
}
```

Plus the **10 analysis service impls** in `service/smartbi/impl/` (corrected class names per Phase A audit §3.2.a / §3.2.d):
- `SalesAnalysisServiceImpl`
- `DepartmentAnalysisServiceImpl`
- `RegionAnalysisServiceImpl`
- `FinanceAnalysisServiceImpl`
- `ProductionAnalysisServiceImpl`
- `QualityAnalysisServiceImpl`
- **`InventoryHealthAnalysisServiceImpl`** ⚠️ (spec originally said `InventoryAnalysisServiceImpl` — that class does not exist; actual class name has `Health` infix per audit §3.2.a)
- `ProcurementAnalysisServiceImpl`
- `DynamicAnalysisServiceImpl` (drill-down / query)
- **`IncentiveRuleServiceImpl`** ⚠️ (spec originally said `IncentivePlanServiceImpl` — that class does not exist; actual class is `IncentiveRuleServiceImpl` per audit §3.2.d. Endpoint is `/incentive-plan/*` but the service generating plans is named `IncentiveRule*`.)

Note: `service/smartbi/impl/` contains ~30 .java files total — the 10 above are the analysis subset. The ~20 remaining (Excel parsers, chart builders, intent service, schema service, etc.) are SHARED with OUT-OF-SCOPE controllers and stay KEEP per Phase A audit §3.2.c.

> ⚠️ **Phase A audit amendment (Decision 4B)**: §1.2 IN-SCOPE silently assumes the 10 analysis service classes are *exclusively* coupled to SmartBIAnalysisController. Phase A audit §3.2.a confirms **all 10 are SHARED** with at least one OUT-OF-SCOPE controller (Dashboard/PublicDemo/Upload). Wholesale class-file deletion in Phase C would cause **compile errors** in the controllers explicitly KEPT by §1.2 OUT-OF-SCOPE below. **§1.2 IN-SCOPE / OUT-OF-SCOPE are internally inconsistent** as originally written.
>
> **Resolution**: Phase B touches *only* the 22+1=23 controller endpoint method bodies (no service-class touches). Phase C is refined to **method-level audit** within service impls (see §C.1 amendment) — service class files stay intact, only orphaned methods removed. The IN-SCOPE service-impl list above is **retained for traceability** of the port source but is **NOT a Phase C deletion list** — see §C.1.

> ⚠️ **Phase A audit Chat 5 follow-up correction (2026-05-09)**: The 3 datasource POST/preview/apply lines above (`POST /datasource/upload` + `GET /datasource/{id}/preview` + `POST /datasource/apply`) were originally tagged `// ported` — that label is wrong. These 3 endpoints' **Java side is itself a TODO stub** (per PR #45 / #49 / #50 backlog defer plan from 2026-05-01), and **customers have never called them** (0 frontend caller + 0 prod log hit per Chat 5 audit `docs/qa-audits/2026-05-09-nginx-python-coverage-cross-check.md`). Phase 2A did **not** actually port them. Phase 2A → T6.5 → Phase 3 full chain: see Chat G PR `<chat-G-PR>` (Python contract-completeness stub) + PR #45 / #49 / #50 (Phase 3 backlog defer docs). Other `/datasource/*` lines (`/list`, `/{id}/fields`, `/{id}/history`) are genuinely ported and remain `// ported`.

#### OUT OF SCOPE (T6.5 KEEPS Java code)

| Component | Why kept |
|---|---|
| `GoldDashboardBuilder.java` | Architectural role per task #24 — wraps Python `/api/smartbi/gold/finance-summary` HTTP via `GoldFinanceClient`. Java DTOs (KPICard / DashboardResponse) consumed downstream. NOT deprecated. |
| `GoldFinanceClient.java` (in `client/`) | HTTP client to Python Gold layer — needed by GoldDashboardBuilder. |
| `SmartBIConfigController.java` (41 endpoints `/api/mobile/smartbi-config/*`) | Config / settings endpoints, NOT analysis. Phase 2B+ may port; T6.5 does not touch. |
| `SmartBIDashboardController.java` (11 endpoints) | Dashboard layout / saved-config endpoints — UI state persistence. Mostly KEEP. ⚠️ **Phase A audit §3.1.b exception**: `GET /data-date-range` (line 345) is the **only nginx-Python-routed** method on this controller (mirrors `backend/python/smartbi_compat/api/dashboard.py:84`). It is the **23rd Phase B stub candidate** — same Option A 410 treatment as the 22 SmartBIAnalysisController stubs. The other 10 endpoints (`/dashboard*`, `/dashboard/executive*`, `/generate-*`, `/analysis/dynamic*`) stay alive Java for all 75 factories. |
| `SmartBIUploadController.java` (13 endpoints) | Excel upload pipeline (`/datasource/upload` overlap with Analysis controller — verify which controller actually routes; if duplicated may consolidate, but not deprecated). |
| `SmartBIPublicDemoController.java` (10 endpoints `/api/public/smart-bi/*`) | Public demo path, different route prefix, not in T6.4 nginx regex scope. |
| Java DTOs in `dto/smartbi/` (ChartConfig / DashboardResponse / KPICard / etc.) | Consumed by GoldDashboardBuilder for response shape; cross-language contract with Python. Keep. |
| Java entities in `entity/smartbi/postgres/` | Read by Java for legacy compat or by other Java services. Audit per Phase D. ⚠️ **Phase A audit §3.5 exception**: `entity/smartbi/SmartBiQueryTemplate.java` is the companion entity to `SmartBiQueryTemplateRepository` and shares the orphan fate after Phase B stubs the 4 query-templates endpoints. Phase C deletion candidate alongside the repo. |
| Java repositories in `repository/smartbi/postgres/` | Most KEEP per blanket Phase D audit. ⚠️ **Phase A audit §3.5 exception**: **`SmartBiQueryTemplateRepository`** has zero non-self callers in Java post-Phase-B (only consumer is the 4 stubbed SmartBIAnalysisController query-templates methods). Reclassify from blanket KEEP to **Phase C orphan candidate**. Companion entity `SmartBiQueryTemplate.java` likewise. Other 26 repos retain blanket KEEP-until-Phase-D treatment. |

**Key architectural invariant**: Python `/api/smartbi/gold/*` is the **upstream** writer. Java GoldDashboardBuilder is **downstream consumer** via HTTP. Per memory `reference_smartbi_gold_layer_architecture.md` (task #24 finding).

---

## 2. T6.5 phases

### 2.1 Phase A — Dead-time verification (14 days post T6.4 GO)

**Goal**: Confirm zero direct Java SmartBI analysis traffic before stub-out.

#### A.1 Java prod log monitoring

Daily check (auto-cron or manual). ⚠️ **Phase A audit refinement (Decision 4B)**: the original grep matched BOTH dead and alive paths. The 4 NOT_SAFE_FALLTHROUGH endpoints (`/analysis/production`, `/analysis/quality`, `POST /query`, `POST /drill-down`) stay Java for all 75 factories — they MUST NOT be alerted on (they're alive code; expected traffic). F999 is internal test factory and intentionally falls through to Java; filter it out.

```bash
# Refined per Phase A audit §4.4:
# - exclude F999 (intentional Java fall-through, internal test only)
# - match ONLY the 22 SmartBIAnalysisController SAFE_NGINX_ROUTED + 1 SmartBIDashboardController /data-date-range
# - exclude internal Java→Java GoldFinanceClient round-trip (still alive per audit §4.3)
ssh root@47.100.235.168 "
  tail -1000000 /www/wwwroot/cretas/cretas-prod.log | \
    grep -vE '/api/mobile/F999/' | \
    grep -E '/api/mobile/[^/]+/smart-bi/(alerts|recommendations|data-date-range|datasource|incentive-plan|query-templates|analysis/(sales|department|region|finance|inventory|procurement))' | \
    grep -v 'GoldFinanceClient' | \
    head -20
"
```

**Expected**: 0 matches over 14 days for the 23 SAFE_NGINX_ROUTED paths. Any hit → investigate (nginx miss-route, direct IP-bypass, internal Java→Java call, F999 leakage).

**NOT alerted on (alive code, T6.6 scope)** per audit §3.1.a / §4.2:
- `/api/mobile/{factoryId}/smart-bi/analysis/production` — all 75 factories
- `/api/mobile/{factoryId}/smart-bi/analysis/quality` — all 75 factories
- `POST /api/mobile/{factoryId}/smart-bi/query` — all 75 factories (NL query — Python lacks intent service equivalent)
- `POST /api/mobile/{factoryId}/smart-bi/drill-down` — all 75 factories (Python has `analysis_drilldown.py` but nginx doesn't route)

For these 4 NOT_SAFE_FALLTHROUGH paths, monitor traffic volume only as a Phase A baseline. Their deprecation is **deferred to T6.6** (`docs/superpowers/specs/<TBD>-t6-6-not-safe-fallthrough-spec.md`).

#### A.2 Operator query (manual)

Identify any internal tooling / automation hitting Java 10010 SmartBI directly:
- Confluence / wiki search for "10010 smart-bi" OR "47.100.235.168:10010"
- Slack / 内部群 search same
- Other Java services in cretas-api: `grep -r "smart-bi" backend/java/cretas-api/src/main/java/ | grep -v "smartbi/" | grep -v "test/"`
- Frontend (web-admin / RN): `grep -rn "smart-bi/analysis\|smart-bi/alerts" frontend/ web-admin/`

#### A.3 GoldDashboardBuilder dependency check

> ✅ **ANSWERED by Phase A audit §4.3** (`docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md`): GoldDashboardBuilder is **NOT orphaned**. KEEP through Phase D as currently scoped.

**Caller chain confirmed by audit**:
- `service/smartbi/impl/SalesAnalysisServiceImpl.java:52` injects `goldDashboardBuilder`, calls `.buildFromGold...()` at line 94 inside the Gold-primary path (gated on `smartbi.gold.read-primary.enabled` flag).
- `service/smartbi/impl/FinanceAnalysisServiceImpl.java:59` mirrors the same pattern at line 122.
- Both `SalesAnalysisServiceImpl` and `FinanceAnalysisServiceImpl` are called by **SmartBIDashboardController** for `/dashboard/executive*` flows (alive Java for all 75 factories per audit §3.1).
- `GoldFinanceClient.java` similarly stays alive — injected by `GoldDashboardBuilder` and `FinanceAnalysisServiceImpl`.

**Phase 2A inlining check** (audit §4.3): Python `analysis_finance.py:1749` / `analysis_sales.py:1180` contain Python mirrors of `buildFromFinanceSummary`, reading directly from Python's local Gold layer (`smartbi/gold/finance_summary.py`) without round-tripping to Java. So the **75-factory `/analysis/finance` path is Python-only** post-T6.4 — no Java involvement. The Java→Python round-trip via `/api/smartbi/gold/finance-summary` is reached **only** through:
- Java `SmartBIDashboardController.getExecutiveDashboard*` for all factories (alive path)
- Java `SmartBIAnalysisController.getFinanceAnalysis` for F999 (post-Phase-B 410 stub will end this)
- Possibly via PublicDemo composite

Conclusion: KEEP `GoldDashboardBuilder` + `GoldFinanceClient` through Phase D. Spec §1.2 OUT-OF-SCOPE classification confirmed correct. **No live monitoring needed for Phase A** beyond what audit §4.3 already established; the verification below is retained as a sanity probe but is informational, not gating.

```bash
# Optional sanity probe — confirm Gold builder still seeing traffic from Dashboard composite
ssh root@47.100.235.168 "
  tail -100000 /www/wwwroot/cretas/cretas-prod.log | \
    grep '\\[gold-builder\\]' | \
    head -20
"
```

**Expected**: continued activity from `/dashboard/executive*` requests (75 factories alive on this path).

#### A.4 GO → Phase B criteria

- [ ] 14 days continuous: 0 direct Java SmartBI analysis traffic in prod log
- [ ] Operator query results: no tooling/automation hits Java 10010 analysis paths
- [ ] GoldDashboardBuilder traffic confirmed (or scoped into deprecation if orphaned)
- [ ] Frontend code reviewed: 0 calls to deprecated paths from web-admin / RN
- [ ] Phase 2A retrospective doc complete

If any criterion fails → extend Phase A by 7 days, re-verify. Don't proceed to Phase B with active Java traffic.

### 2.2 Phase B — Stub-out Java analysis endpoints (14 days)

**Goal**: Java analysis endpoints return 410 Gone — operationally dead but Spring Bean structure intact for safe rollback.

#### B.1 Implementation

> ⚠️ **Phase A audit amendment (Decision 4B)**: Stub scope is **23 endpoint methods total** (NOT all 26 SmartBIAnalysisController methods).
>
> **Stub list** (per audit §3.1.a + §3.1.b):
> - **22 on SmartBIAnalysisController**: the SAFE_NGINX_ROUTED methods — `getSalesAnalysis`, `getDepartmentAnalysis`, `getRegionAnalysis`, `getFinanceAnalysis`, `getFinanceBudgetAchievement`, `getFinanceYoYMoM`, `getFinanceCategoryComparison`, `getInventoryAnalysis`, `getProcurementAnalysis`, `getAlerts`, `getRecommendations`, `getIncentivePlan`, `uploadDatasource`, `previewDatasource`, `applyDatasource`, `listDatasource`, `getDatasourceFields`, `getSchemaHistory`, `getQueryTemplates`, `createQueryTemplate`, `updateQueryTemplate`, `deleteQueryTemplate`.
> - **1 on SmartBIDashboardController**: `getDataDateRange` (line 345 — only this method on Dashboard controller; the other 10 stay alive).
> - **NOT stubbed** (4 NOT_SAFE_FALLTHROUGH on SmartBIAnalysisController, deferred to T6.6): `getProductionAnalysis`, `getQualityAnalysis`, `nlQuery` (`POST /query`), `drillDown` (`POST /drill-down`).
>
> **F999 fate — organizer decision (2026-05-09)**: **Option A (unconditional 410) confirmed**. F999 internal test factory will receive 410 for the 23 stubbed paths starting Phase B. Internal Cretas test team accepts this; F999 migration to Python is tracked as a follow-up (see §12 Q7). Option B (F999 carve-out branching) rejected as it adds permanent branching code for a transient compatibility need.

Add per-method 410 stubs (Option A) for the 23 endpoint methods enumerated above:

```java
// Option A: per-method 410 stub — applies to all 23 stubbed methods
@GetMapping("/analysis/sales")
public ResponseEntity<Map<String, Object>> getSalesAnalysis(...) {
    return ResponseEntity.status(HttpStatus.GONE).body(Map.of(
        "success", false,
        "code", "SMARTBI_MIGRATED",
        "message", "SmartBI analysis endpoints moved to Python /api/smartbi/analysis/*",
        "since", "2026-05-XX",  // Phase B start date
        "newPath", "/api/smartbi/analysis/sales"
    ));
}
```

The same pattern applies to all 23 methods. Service-class injection (`@Autowired` constructor refs) stays — Spring Bean structure preserved per §B.2. The 4 NOT_SAFE_FALLTHROUGH methods retain their existing implementations untouched.

> ⚠️ **Option B (F999 carve-out) NOT used.** The original spec sketched it as `if (!"F999".equals(factoryId))` branching. Per Phase A audit §6.1 + organizer decision, Option A is cleaner and the F999 internal test cost is acceptable.

#### B.2 Spring Bean preservation

- Keep `SmartBIAnalysisController` class declaration + Spring `@RestController` annotation
- Keep `@Autowired` service references in controller (don't remove constructor injection)
- Keep service Bean classes (`SalesAnalysisServiceImpl` etc.) as `@Service` — other services may inject them
- Service method bodies can be simplified (return null / empty) but signatures stay
- Goal: `mvn clean package` still succeeds without compile errors

#### B.3 Rollback procedure (if Python widespread fail)

If Python fails widely during Phase B:

1. Nginx vhost regex flip back to 10010: `cp api.cretaceousfuture.com.conf.bak.t6_4_s5_pre.<ts> api.cretaceousfuture.com.conf && nginx -s reload`
2. Customer comms: PR #141 §3.6 rollback notice
3. Java controller stub returns 410 → Python returns content via `cretas_python` upstream → ⚠️ Phase B stub means even if nginx flips, Java now returns 410 = customer-visible failure
4. **Therefore**: Phase B requires nginx still routing to Python. Java rollback target = pre-Phase-B Java JAR (not 410-stubbed)

⚠️ **Phase B rollback constraint**: Phase B and nginx routing are coupled. Rolling back Phase B requires either:
- Re-deploying pre-Phase-B Java JAR (full controller bodies restored), OR
- Keeping Phase B forward (don't roll back), and rolling back Python only if Python issue

Document in Phase B rollback runbook: prefer Python forward-fix > Java rollback for Phase B period.

#### B.4 GO → Phase C criteria

- [ ] 30 days continuous: 0 410 Gone hits in Java prod log (i.e. nobody calls deprecated paths)
- [ ] Phase B 14 days complete + 16 days additional dead-time monitoring
- [ ] No customer reports of "missing endpoint" or "service moved" errors
- [ ] Operator confirmation: no scheduled jobs / CI / automation hits 410 paths
- [ ] Test environment Phase C dry-run successful (rip out files in test JAR, smoke test 75 factories)

### 2.3 Phase C — Java code removal (irreversible)

**Goal**: Remove all dead Java analysis controller / service code. Free up codebase, eliminate dead-code maintenance burden.

#### C.1 Files to remove — refined to method-level audit (Phase A audit §3.2.a + §6.2)

> ⚠️ **Phase A audit amendment (Decision 4B)**: The original spec listed wholesale class-file deletion. Audit §3.2.a confirmed **all 10 analysis service classes are SHARED** with at least one OUT-OF-SCOPE controller (Dashboard/PublicDemo/Upload). Wholesale deletion would cause **compile errors** in KEEP'd controllers. Phase C scope is therefore refined to **method-level audit within service impls** + a few well-scoped file deletions.

##### C.1.1 Safe to delete (Phase C concrete scope)

| Item | Path | Reason |
|---|---|---|
| **23 controller endpoint method bodies** | `controller/SmartBIAnalysisController.java` (22 methods) + `controller/SmartBIDashboardController.java` (1 method `getDataDateRange`) | Phase B stubbed these to 410. Phase C removes the method bodies entirely (delete the `@*Mapping` methods themselves, not the controller files). |
| **`repository/smartbi/SmartBiQueryTemplateRepository.java`** | repository orphan post-Phase-B | Phase A audit §3.5: zero non-self callers in Java post-Phase-B (only consumer was the 4 stubbed query-templates methods). |
| **`entity/smartbi/SmartBiQueryTemplate.java`** | companion entity to the orphan repo | Phase A audit §3.5: entity used only via `SmartBiQueryTemplateRepository`. Verify by `Grep` in Phase C — if no other JPA reference, delete. |
| **N service methods** (TBD by Phase C dispatch) | `service/smartbi/impl/*ServiceImpl.java` | Method-level audit per §C.1.3 below. Public methods on the 10 analysis service impls that have **zero callers in OUT-OF-SCOPE controllers** post-Phase-B can be removed. **The class file stays.** |
| Tests covering the above (method-level) | `src/test/java/.../controller/*Test.java`, `src/test/java/.../service/smartbi/impl/*Test.java` | Per §C.2 — remove the test methods covering the deleted controller methods + repo + service methods. Test class files stay if other methods remain. |

##### C.1.2 ⛔ Forbidden to delete (Phase C HARD KEEP)

| Item | Why kept | Audit ref |
|---|---|---|
| **Controller files**: `SmartBIAnalysisController.java` + `SmartBIDashboardController.java` | Both retain method bodies for the NOT_SAFE_FALLTHROUGH and KEEP_FOR_COMPOSITE_DASHBOARD endpoints respectively. Class file structure stays. | §3.1, §3.1.a, §3.1.b |
| **`SmartBIConfigController.java`, `SmartBIUploadController.java`, `SmartBIPublicDemoController.java`** | OUT-OF-SCOPE entirely per §1.2; not touched in T6.5. | §3.1 |
| **All 10 analysis service classes** (interface + impl, 20 files): Sales / Department / Region / Finance / Production / Quality / InventoryHealth / Procurement / Dynamic / Recommendation | All SHARED with KEEP'd controllers. Wholesale deletion = compile errors. | §3.2.a |
| **EntityRecognizer cluster** (`*EntityRecognizer.java`, 6 files) | Used by `SmartBIIntentService` for NL `/query` routing — alive Java path (NOT_SAFE_FALLTHROUGH). | §3.2.c |
| **Chart sub-package** (`service/smartbi/chart/*.java`, 7 files) | `SmartBIDashboardController:88` injects `adaptiveChartGenerator` for `/generate-adaptive-charts` (alive Java path). | §3.2.c |
| **Intent service ecosystem** (`SmartBIIntentService`, `SmartBIIntentMapper`, `SmartBiSchemaService`, `LLMFieldMappingService`, `MetricFormulaService`, `MetricCalculatorService`, `SmartBIPromptService`, `AnalysisPromptGenerator`, `ChartFusionService`, `ForecastService`, `DimensionEntityRecognizer`, `BaseEntityRecognizer`, etc.) | Used by NL query path + intent routing + chart fusion. | §3.2.c |
| **`IncentiveRuleService` + impl** | Shared with SmartBIConfigController (`/incentive-rules` config CRUD). KEEP_FOR_OUT_OF_SCOPE_CONTROLLER. | §3.2.c, §3.2.d |
| **`AlertThresholdService` + impl** | Shared with SmartBIConfigController (`/thresholds`). KEEP_FOR_OUT_OF_SCOPE_CONTROLLER. | §3.2.c |
| **`ChartTemplateService` + impl** | Shared with SmartBIConfigController (`/chart-templates`). KEEP_FOR_OUT_OF_SCOPE_CONTROLLER. | §3.2.c |
| **Excel/Schema services** (`ExcelDataPersistenceService`, `ExcelDynamicParserService`, `DynamicDataPersistenceService`, `DataSourceRegistryService`, `ProductionDataExportService`, `SmartBIService`, `SmartBIConfigService`, `SmartBIUploadFlowService`) | Shared with SmartBIUploadController + SmartBIConfigController. | §3.2.c |
| **`util/DynamicDataParser.java`** | Internal utility, used by `*Impl` classes that stay. | §3.2.c |
| **Gold layer**: `GoldDashboardBuilder.java` + `client/GoldFinanceClient.java` | NOT orphaned per audit §4.3 — active callers in Sales/Finance impls + Dashboard composite. | §3.2.b, §4.3 |
| **All 56 DTOs** in `dto/smartbi/` | Cross-language wire-shape contract. | §3.3 |
| **All 47 entities** in `entity/smartbi/` (except `SmartBiQueryTemplate.java`) | JPA reads from KEEP'd controllers. Phase D table-level audit before any further removal. | §3.4 |
| **26 of 27 repositories** in `repository/smartbi/` (except `SmartBiQueryTemplateRepository.java`) | JPA query layer for KEEP'd entities. Phase D audit. | §3.5 |

##### C.1.3 Worked example — FinanceAnalysisServiceImpl method-level audit

Phase C dispatch should follow this template per service impl. Example: `FinanceAnalysisServiceImpl.java`.

1. **List public methods** in `FinanceAnalysisServiceImpl.java`:
   ```bash
   grep -nE "^\s*(public|@Override\s+public)" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java
   ```
   Expected: ~10-20 public methods (e.g. `getFinanceOverview`, `getFinanceCategoryComparison`, `getFinanceYoYMoM`, `getFinanceBudgetAchievement`, `getFinanceTrend`, `getCostAnalysis`, etc.).

2. **For each public method, grep callers** in OUT-OF-SCOPE controllers:
   ```bash
   for method in getFinanceOverview getFinanceCategoryComparison ...; do
     echo "=== $method ==="
     grep -rn "\.$method(" backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ \
       --include="SmartBIDashboardController.java" \
       --include="SmartBIPublicDemoController.java" \
       --include="SmartBIUploadController.java" \
       --include="SmartBIConfigController.java"
   done
   ```

3. **Classify**:
   - **0 callers in KEEP'd controllers** AND only caller was the now-stubbed SmartBIAnalysisController method → **method dead, can remove**.
   - **≥1 caller in KEEP'd controller** → method stays (still serves alive Dashboard/PublicDemo composite).

4. **Remove dead methods + their private helpers** (chase down `private` methods called only by the dead public method):
   ```bash
   # After removing public method foo(), grep for private helpers
   grep -nE "private.*<helper>(" FinanceAnalysisServiceImpl.java
   # Verify those helpers have no other callers in the same file → safe to remove
   ```

5. **Verify compile** + run `*ServiceImplTest.java` test methods that remain — they should still pass for KEEP'd methods.

**Estimated Phase C effort**: ~5-10 person-days method-level audit + reduction across 10 service impl files. Per audit §6.2.

##### C.1.4 Original wholesale-deletion list (RETAINED for traceability — DO NOT execute as-is)

The list below was the original spec §C.1 before Phase A audit. It is **superseded** by §C.1.1 + §C.1.2 above. **Do not execute file deletions per this block** — it would cause compile errors in KEEP'd controllers. Retained for git-history traceability and as the IN-SCOPE-list traceability anchor (matches §1.2 IN-SCOPE).

```
backend/java/cretas-api/src/main/java/com/cretas/aims/
├── controller/
│   └── SmartBIAnalysisController.java                      # ⚠️ DO NOT REMOVE — keeps NOT_SAFE_FALLTHROUGH method bodies
├── service/smartbi/
│   ├── DepartmentAnalysisService.java                      # ⚠️ DO NOT REMOVE — interface used by SmartBIDashboardController
│   ├── DynamicAnalysisService.java                         # ⚠️ DO NOT REMOVE — used by Dashboard /analysis/dynamic + Upload backfill
│   ├── FinanceAnalysisService.java                         # ⚠️ DO NOT REMOVE — used by Dashboard + PublicDemo
│   └── (other service interfaces)                          # ⚠️ See §C.1.2 above for KEEP rationale
└── service/smartbi/impl/
    ├── SalesAnalysisServiceImpl.java                       # ⚠️ DO NOT REMOVE — Dashboard/PublicDemo callers
    ├── DepartmentAnalysisServiceImpl.java                  # ⚠️ DO NOT REMOVE — Dashboard/PublicDemo callers
    ├── FinanceAnalysisServiceImpl.java                     # ⚠️ DO NOT REMOVE — Dashboard/PublicDemo callers + Gold layer chain
    ├── ProductionAnalysisServiceImpl.java                  # ⚠️ DO NOT REMOVE — alive code (NOT_SAFE_FALLTHROUGH) + Dashboard
    ├── QualityAnalysisServiceImpl.java                     # ⚠️ DO NOT REMOVE — alive code (NOT_SAFE_FALLTHROUGH) + Dashboard
    ├── InventoryHealthAnalysisServiceImpl.java             # ⚠️ DO NOT REMOVE — Dashboard caller
    ├── ProcurementAnalysisServiceImpl.java                 # ⚠️ DO NOT REMOVE — Dashboard caller
    ├── DynamicAnalysisServiceImpl.java                     # ⚠️ DO NOT REMOVE — alive code (NOT_SAFE_FALLTHROUGH) + Dashboard + Upload
    ├── IncentiveRuleServiceImpl.java                       # ⚠️ DO NOT REMOVE — SmartBIConfigController caller
    └── (others)                                            # ⚠️ See §C.1.2 above
```

Phase C executes per **§C.1.1 + §C.1.3** (method-level), NOT the block above.

**KEEP** (unchanged from §1.2 OUT-OF-SCOPE):
- `GoldDashboardBuilder.java`
- `client/GoldFinanceClient.java`
- `SmartBIConfigController.java`, `SmartBIDashboardController.java`, `SmartBIUploadController.java`, `SmartBIPublicDemoController.java`
- All DTOs in `dto/smartbi/`
- Entities in `entity/smartbi/` (except `SmartBiQueryTemplate.java` — see §C.1.1)
- Repositories in `repository/smartbi/` (except `SmartBiQueryTemplateRepository.java` — see §C.1.1)
- Tests for KEEP'd files

#### C.2 Test removal — refined to method-level

> ⚠️ **Phase A audit amendment (Decision 4B)**: Wholesale test-file deletion mirrors the wholesale-class deletion problem from §C.1. Test classes for analysis service impls cover BOTH stubbed methods AND KEEP'd methods (the ones that still serve Dashboard/PublicDemo callers). Remove only the **test methods** covering deleted controller methods + the orphan repo + the deleted service methods.

```
backend/java/cretas-api/src/test/java/com/cretas/aims/
├── controller/SmartBIAnalysisControllerTest.java           # KEEP file — remove only test methods covering the 22 stubbed Analysis controller methods
├── controller/SmartBIDashboardControllerTest.java          # KEEP file — remove only test method covering the 1 stubbed `/data-date-range`
├── repository/smartbi/SmartBiQueryTemplateRepositoryTest.java  # REMOVE entire file (orphan repo, see §C.1.1)
└── service/smartbi/impl/
    ├── SalesAnalysisServiceImplTest.java                   # KEEP file — remove only test methods covering deleted service methods (per §C.1.3 method-level audit)
    ├── DepartmentAnalysisServiceImplTest.java              # KEEP file — same pattern
    ├── FinanceAnalysisServiceImplTest.java                 # KEEP file — same pattern
    ├── ProductionAnalysisServiceImplTest.java              # KEEP file entirely (alive code, NOT_SAFE_FALLTHROUGH)
    ├── QualityAnalysisServiceImplTest.java                 # KEEP file entirely (alive code, NOT_SAFE_FALLTHROUGH)
    ├── InventoryHealthAnalysisServiceImplTest.java         # KEEP file — same pattern
    ├── ProcurementAnalysisServiceImplTest.java             # KEEP file — same pattern
    ├── DynamicAnalysisServiceImplTest.java                 # KEEP file entirely (alive code, NOT_SAFE_FALLTHROUGH for /query + /drill-down + Dashboard)
    ├── IncentiveRuleServiceImplTest.java                   # KEEP file entirely (SmartBIConfigController shared)
    └── (others)                                            # KEEP files — Phase C dispatch enumerates per audit §C.1.3 method-level
```

**Rule of thumb**: Phase C test removal **mirrors** Phase C source removal. If §C.1 removes a public method on `FinanceAnalysisServiceImpl`, §C.2 removes the corresponding `@Test` method on `FinanceAnalysisServiceImplTest`. Test class file deletion is reserved for the orphan repo case only (`SmartBiQueryTemplateRepositoryTest`).

#### C.3 Verification before Phase C ship — method-level orphan grep

> ⚠️ **Phase A audit amendment (Decision 4B)**: Original `import.*SmartBIAnalysisController` / `import.*SalesAnalysisService` grep is no longer applicable — those classes/interfaces stay (per §C.1.2). The verification shifts to **method-level orphan check** + **repo orphan check**.

```bash
cd backend/java/cretas-api

# 1. Compile + tests must pass after method-level deletion
mvn clean compile -DskipTests              # MUST pass
mvn clean test -DskipTests=false           # MUST pass (remaining tests green)
mvn clean package -DskipTests              # MUST produce aims-0.0.1-SNAPSHOT.jar

# 2. Method-level orphan grep — for each public method removed in §C.1.3,
#    confirm 0 callers in the entire main-source tree.
#    (Run this BEFORE deleting; it's the definition of "method is orphan")
for method in <list of public methods scheduled for removal per §C.1.3 audit>; do
    hits=$(grep -rnE "\.$method\(" backend/java/cretas-api/src/main/java/ | wc -l)
    echo "$method: $hits caller(s)"
done
# Expected: 0 callers for methods on the removal list (else they're not orphan — keep them)

# 3. SmartBiQueryTemplateRepository orphan verification — confirm zero non-self callers
grep -rnE "SmartBiQueryTemplateRepository" backend/java/cretas-api/src/main/java/ | \
  grep -v "repository/smartbi/SmartBiQueryTemplateRepository.java" | \
  grep -v "controller/SmartBIAnalysisController.java"  # the 4 stubbed methods reference it pre-removal
# Expected: 0 lines after Phase B has stubbed (removed bodies referencing the repo)

# 4. SmartBiQueryTemplate (entity) orphan verification
grep -rnE "SmartBiQueryTemplate[^a-zA-Z]" backend/java/cretas-api/src/main/java/ | \
  grep -v "entity/smartbi/SmartBiQueryTemplate.java" | \
  grep -v "repository/smartbi/SmartBiQueryTemplateRepository.java"
# Expected: 0 lines (else entity has another consumer — investigate before removing)

# 5. Verify analysis service classes still compile-link
#    (they stay per §C.1.2; no inbound-import grep needed)
grep -lE "@(Component|Service)" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/*AnalysisServiceImpl.java
# Expected: all 10 files still present and annotated
```

The original class-level inbound-import grep is **retained for reference** but should no longer return 0 — those classes stay:

```bash
# RETAINED FOR REFERENCE — DO NOT TREAT AS GATE.
# Phase C does NOT remove these classes (per §C.1.2 amendment).
grep -rE "(import.*SmartBIAnalysisController|import.*SalesAnalysisService|import.*FinanceAnalysisService|import.*DynamicAnalysisService)" backend/java/cretas-api/src/main/java/ | grep -v "/test/"
# Expected: nonzero matches (controllers + services have legitimate callers post-T6.5)
```

#### C.4 Phase C deployment

- Test env first: `./scripts/deploy/deploy-backend.sh --env test`
- Smoke test 75 factories via test env nginx (cretas-backend-test 10011)
- 7-day test env soak before prod
- Prod: `./scripts/deploy/deploy-backend.sh --env prod` (Blue-Green per memory `reference_blue_green_java_deploy.md`)

#### C.5 GO → Phase D criteria

- [ ] Phase C deploy stable for 7 days prod
- [ ] All 75 factories `/smart-bi/analysis/*` Python responses still healthy
- [ ] No Java compile errors / no Spring context startup errors
- [ ] Journalctl `cretas-backend.service` startup log clean
- [ ] CLAUDE.md updated to reflect new Java SmartBI surface area

### 2.4 Phase D — Database verification (ongoing)

**Goal**: Confirm Python is canonical SmartBI data writer; Java does NOT write to smartbi schema tables post-T6.5.

#### D.1 Schema audit

```bash
# On server 47, check for any Java JPA/JDBC writes to smartbi tables
# (post-Phase C, all writes should originate from Python only)

ssh root@47.100.235.168 "
  sudo -u postgres psql -d smartbi_prod_db -P pager=off <<'SQL'
  -- Identify recent writers via pg_stat_user_tables
  SELECT schemaname, relname, n_tup_ins + n_tup_upd + n_tup_del AS recent_writes,
         last_autoanalyze, last_autovacuum
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
    AND (relname LIKE 'smart_bi%' OR relname LIKE 'agg_%' OR relname LIKE 'fact_pos%')
  ORDER BY recent_writes DESC
  LIMIT 20;
SQL
"
```

#### D.2 Java JPA repository audit

```bash
# Confirm Java JPA repositories under smartbi don't have @Modifying queries that hit
# tables Python is canonical for
grep -rnE "@Modifying|@Query.*INSERT|@Query.*UPDATE|@Query.*DELETE" backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/
# Audit each result — should be 0 if Python is canonical writer
```

#### D.3 Cross-DB connection audit

Confirm no Java service in main Java post-Phase-C still has direct JDBC connection to `smartbi_prod_db`:

```bash
grep -rE "smartbi_prod_db|smartbi.postgres" backend/java/cretas-api/src/main/java/ | grep -v "/test/" | grep -v "GoldFinanceClient"
# GoldFinanceClient connects to Python HTTP, not direct DB — that's OK
```

#### D.4 GO criteria — Phase D ongoing

Phase D is ongoing monitoring (no terminal "done" state):

- Quarterly schema-write audit (per §D.1)
- New Java services adding smartbi DB queries → flagged as scope creep, requires architecture review
- Phase 2B+ ports may add new Phase D items if more services migrate

---

## 3. Rollback contingency

### 3.1 Phase-level rollback summary

| Phase | Rollback target | Rollback procedure | Constraints |
|---|---|---|---|
| **Phase A** | None (verification only) | N/A | Read-only monitoring; no state to roll back |
| **Phase B** | Pre-Phase-B Java JAR | `./scripts/deploy/deploy-backend.sh --env prod` with prior JAR | Coupled with nginx — see §B.3 |
| **Phase C** | Pre-Phase-C Java JAR (irreversible after 30 days) | Same as Phase B initially; after 30 days, reverting requires git restore + redeploy | Code archived in git history `before <phase-c-commit-sha>` |
| **Phase D** | Schema state | N/A — Phase D is read-only audit | Schema mutations gated by smartbi_migrations runner per `.claude/rules/server-operations.md` |

### 3.2 Test environment validation per phase

Before each phase deploy to prod:

- [ ] Phase change deployed to test env (`--env test`)
- [ ] 7-day test env soak period (catch issues unique to data state)
- [ ] Test env smoke: 75 representative factories × 19 analysis endpoints
- [ ] Cretas-backend-test systemd `NRestarts` unchanged in 7 days

### 3.3 Communication channels per phase

| Phase | Audience | Channel | When |
|---|---|---|---|
| A | Internal ops (organizer + chat 4) | 内部群 | Daily monitoring summary |
| B start | Sales team + chat 1/2/3/4 | 内部群 + email | T-72h: "Java SmartBI analysis endpoints will return 410 Gone starting <date>; ensure no internal tooling hits 10010 paths" |
| B during | Sales team | 内部群 | If 410 hits detected + analysis blocked → escalate |
| C start | Engineering team | Internal email | "Phase C code removal — review checklist before merge" |
| C deploy | Sales team | Internal 内部群 | T-24h: "Java JAR rebuild + redeploy — typical Blue-Green window" |
| D | Engineering | Quarterly retrospective | Schema audit results |

### 3.4 No customer-facing comms

T6.5 is internal cleanup. Customer-facing endpoints (`/api/smartbi/analysis/*` via 139 nginx → Python) **stay routed to Python throughout T6.5**. Customers should observe zero behavior change — same endpoints, same shapes (per Phase 2A dict-eq parity).

If anything is customer-visible during T6.5, it's a regression and rollback should trigger. PR #141 customer comms templates not used unless rollback fires.

---

## 4. Timeline (post-T6.4)

Assuming T6.4 Stage 5 GO declared 2026-05-15 (best case):

| Phase | Start | End | Duration | Activity |
|---|---|---|---|---|
| **Phase A** | 2026-05-15 | 2026-05-29 | 14 days | Dead-time verification, log monitoring, audit |
| **Phase B** | 2026-05-29 | 2026-06-12 | 14 days stub period | 410 Gone responses, monitor for hits |
| **Phase B + 16d soak** | 2026-06-12 | 2026-06-28 | 16 days additional | Extended dead-time before Phase C |
| **Phase C** (test deploy) | 2026-06-28 | 2026-07-05 | 7 days | Test env deploy + soak |
| **Phase C** (prod deploy) | 2026-07-05 | 2026-07-12 | 7 days | Prod Blue-Green deploy + soak |
| **Phase D** | 2026-07-12+ | ongoing | quarterly cadence | DB-level audit |

**Total time T6.4 GO → Phase C done: ~58 days** (~2 months for irreversible step). This is intentional — irreversible code removal warrants extended dead-time validation.

If T6.4 slipped (e.g. stage rollback adds 7+ days), all subsequent phases shift accordingly.

---

## 5. Out-of-scope (NOT T6.5)

> ⚠️ **Phase A audit amendment (Decision 4B)**: Several rows added/refined below per audit findings. Bold rows are new since the original spec.

| Item | Why not |
|---|---|
| Pattern B Gold-primary flag flip on prod | Separate Phase B work for Python's `_get_finance_overview` 3-state branching. Pattern B is Python-side decision; T6.5 is Java-side cleanup. |
| Strict-byte gate adoption | Phase 3+ decision (currently dict-eq per `python-java-port.md` Rule 4). Independent of Java deprecation. |
| Frontend code refactor | Frontend already endpoint-agnostic — calls 139 nginx, doesn't care which upstream answers. No refactor needed. |
| Java GoldDashboardBuilder deprecation | Architecture role per task #24. **Phase A audit §4.3 confirmed NOT orphaned** — active callers in `SalesAnalysisServiceImpl:52` + `FinanceAnalysisServiceImpl:59`, serving Dashboard `/dashboard/executive*` for all 75 factories. Stays as Python downstream HTTP consumer. |
| SmartBI Config / Dashboard / Upload / PublicDemo controllers | Phase 2B+ scope (separate ports if pursued). T6.5 narrow to analysis endpoints only. **Exception**: 1 method on SmartBIDashboardController (`getDataDateRange`) IS in Phase B stub scope per audit §3.1.b. |
| Java DTOs in `dto/smartbi/` | Cross-language contract via GoldDashboardBuilder. Keep. |
| Java entities `entity/smartbi/postgres/` | Phase D audit may flag, but not auto-removed. **Exception**: `SmartBiQueryTemplate.java` is a Phase C orphan candidate per audit §3.5. |
| `analysis_finance.py` / `analysis_sales.py` Python code | Python is the new canonical, not deprecated. |
| **`/api/mobile/{factoryId}/smart-bi/analysis/production`** | **NOT_SAFE_FALLTHROUGH** — alive code for all 75 factories per audit §3.1.a. Deferred to T6.6 (`docs/superpowers/specs/<TBD>-t6-6-not-safe-fallthrough-spec.md`). T6.5 leaves the controller method body untouched. |
| **`/api/mobile/{factoryId}/smart-bi/analysis/quality`** | **NOT_SAFE_FALLTHROUGH** — alive code per audit §3.1.a. Deferred to T6.6. |
| **`POST /api/mobile/{factoryId}/smart-bi/query`** (NL query) | **NOT_SAFE_FALLTHROUGH** — alive code per audit §3.1.a. Python lacks intent service equivalent. Deferred to T6.6. |
| **`POST /api/mobile/{factoryId}/smart-bi/drill-down`** | **NOT_SAFE_FALLTHROUGH** — alive code per audit §3.1.a. Python has `analysis_drilldown.py` but nginx doesn't route to it. Deferred to T6.6. |
| **F999 internal test factory** | Intentionally falls through to Java for everything (not in nginx regex). Phase B Option A unconditional 410 means F999 SmartBI Analysis paths return 410 starting Phase B — accepted internal cost (organizer decision 2026-05-09). Future T6.6 candidate: F999 migration to Python. |
| **10 analysis service class files** (Sales / Department / Region / Finance / Production / Quality / InventoryHealth / Procurement / Dynamic / Recommendation — interface + impl) | All **SHARED** with at least one OUT-OF-SCOPE controller (Dashboard / PublicDemo / Upload) per audit §3.2.a. Wholesale class-file deletion would cause compile errors in KEEP'd controllers. Phase C does **method-level audit** (§C.1.3) instead — class files stay. |

---

## 6. GO criteria summary (per phase)

### 6.1 T6.4 → Phase A

- T6.4 Stage 5 24h soak GO + 0 P1 customer reports + Phase 2A retrospective started

### 6.2 Phase A → Phase B

- 14 days continuous: 0 direct Java SmartBI analysis traffic in prod log
- Operator query: no tooling hits Java 10010 analysis
- GoldDashboardBuilder traffic confirmed (or scoped in if orphaned)
- Frontend code reviewed: 0 deprecated path calls

### 6.3 Phase B → Phase C

- 30 days continuous: 0 410 Gone hits in Java prod log
- Test env Phase C dry-run successful (test JAR with files removed, 75-factory smoke clean)
- No customer-reported "missing endpoint" errors
- Operator confirmation: no scheduled jobs / CI / automation hits 410 paths

### 6.4 Phase C complete

- `mvn clean package -DskipTests` succeeds without removed files
- All tests green
- Inbound dependency grep: 0 references to removed classes
- Prod 7-day soak post-deploy stable (NRestarts unchanged, no 5xx spike)

### 6.5 Phase D ongoing

- Quarterly schema-write audit clean (Python = canonical writer for smartbi tables)
- No new Java services adding direct smartbi DB connections without architecture review

---

## 7. Rules / patterns to follow

### 7.1 Per-phase pause-before-deploy (memory `feedback_pause_before_deploy_or_push`)

Each phase's deploy step **must** stop and ping organizer before executing:
- Phase B deploy (Java stub-out)
- Phase C test env deploy
- Phase C prod deploy

Allows organizer to coordinate worktree merges + sister chat work-in-flight.

### 7.2 Concurrent-edit safety (memory `feedback_concurrent_edit_safety` Rule 5b)

Phase C is large code removal touching 30+ files. **MUST use** `git commit -- F1 F2 ...` paths-only mode or `safe-commit.sh` to avoid scope creep from parallel sessions.

Recommended: split Phase C into per-domain commits:
- C.1: Sales analysis (controller method + service impl + tests)
- C.2: Department analysis
- C.3: Region analysis
- C.4: Finance analysis
- C.5: Production / Quality / Inventory / Procurement
- C.6: Drill-down / dynamic analysis
- C.7: Incentive plan + alerts + recommendations
- C.8: Datasource + query-templates

Each commit narrow scope, easier to review and rollback.

### 7.3 Pattern B 3-state stays Python-primary

Per memory `project_2026_05_07_t6_1_dryrun_in_flight.md`: Pattern B `_get_finance_overview` 3-state branching (HOT/COLD/empty) lives in Python `analysis_finance.py`. T6.5 does NOT remove Pattern B — it only removes the Java analysis endpoints that Pattern B made irrelevant.

### 7.4 Smartbi DB schema migration policy

Per `.claude/rules/server-operations.md` HARD RULE: any smartbi schema change goes through `apply-smartbi-migrations.sh` runner. Phase D audits respect this — if Phase D finds smartbi schema drift between Java and Python expectations, fix via migration file, not direct SQL.

### 7.5 Cross-reference T6.4 retrospective

T6.5 spec assumes Phase 2A retrospective doc captures:
- Final endpoint port count + dict-eq match rate
- Per-customer T6.4 stage outcomes
- Java surface area before/after (`find` counts of removed files)
- Lessons learned re: Pattern A/A2 byte deltas, Rule 1-12 graduation history

T6.5 Phase A reviews this retrospective to identify any caveats affecting deprecation timing.

---

## 8. Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Internal tooling hits Java 10010 analysis directly during Phase A | LOW (after 30+ days dead) | MED (false positive on 410) | Phase A operator audit catches; if found, schedule tooling migration before Phase B |
| GoldDashboardBuilder orphaned (Python doesn't call it post-T6.4) | MED (architectural ambiguity per task #24) | HIGH (keep dead Java code) | Phase A audit task §A.3 explicitly verifies; if orphaned, expand Phase B/C scope |
| Phase B 410 Gone breaks unknown legacy client | LOW | MED (customer-visible if any) | Stub response includes `newPath` field for migration; rollback to pre-Phase-B JAR if hit count > 0 |
| Phase C removes file with hidden inbound dependency | MED | HIGH (compile fail) | Pre-Phase-C `grep -r imports` check; test env 7-day soak |
| Pattern B Gold dependency on Java GoldDashboardBuilder broken | LOW | HIGH | Verify `GoldDashboardBuilder` stays — explicitly OUT OF SCOPE per §1.2 |
| Test env Phase C dry-run passes but prod fails | LOW | HIGH | Test data may not exercise all paths; per-customer monitoring during prod 7-day soak |
| Phase 2B port adds new Java analysis controller during T6.5 window | LOW | LOW | Phase 2B coord — separate from T6.5; if happens, rebase scope |
| Phase 2A dict-eq divergence emerges post-T6.5 | MED | HIGH (Java code already removed, no rollback) | T6.5 timing intentional 60+ day buffer; Phase 2A 99.945% baseline gives confidence |

---

## 9. ⛔ HOLD blocks

- ⛔ This is a **spec / planning doc only**. No code changes, no deploys, no nginx mutations.
- ⛔ Phase A kickoff requires T6.4 Stage 5 24h soak GO. Cannot start sooner.
- ⛔ Phase A→B advance requires explicit organizer GO (per §6.2 criteria all PASS).
- ⛔ Phase B→C advance requires 30-day dead-time + test env dry-run + organizer GO.
- ⛔ Phase C is **irreversible** after 30 days post-deploy (git history reverts get harder, downstream branches may rebase). Treat with care.
- ⛔ GoldDashboardBuilder explicitly KEPT — do NOT remove during Phase C without re-audit per §A.3.
- ⛔ Customer-facing comms templates NOT used in T6.5 unless rollback fires (per §3.4).

---

## 10. Coordination

### 10.1 Predecessors

- T6.4 Stage 5 (`docs/superpowers/dispatch/2026-05-14-t6-4-stage-5-marching-order.md`)
- Phase 2A retrospective (`docs/superpowers/retrospectives/2026-05-15-phase2a-complete.md` — to be created post-T6.4)
- T6.4 readiness runbook (`docs/superpowers/runbooks/2026-05-08-t6-4-real-customers-cutover-runbook.md`)
- Customer comms plan (`docs/superpowers/runbooks/2026-05-08-t6-4-customer-comms-plan.md`)

### 10.2 Successors / parallel work

- T6.6+ (hypothetical): Java SmartBI Config / Dashboard / Upload / PublicDemo deprecation — Phase 2B+ port-then-deprecate cycles
- Pattern B Gold-primary flag flip — Phase B follow-up, separate scope
- Python observability hardening — independent Phase 3 work

### 10.3 chat assignments (per phase)

| Phase | Recommended owner | Rationale |
|---|---|---|
| A | organizer + chat 4 | Daily log monitoring + Pattern B/Gold path expert |
| B (impl) | chat 4 (or new chat) | Java code surgical change, Pattern B familiarity |
| B (deploy) | chat 4 | Owns Java prod deploys per `feedback_deploy_pipeline.md` |
| C (impl) | new chat (~5 sub-domain commits) | Large scope, fresh context helpful |
| C (test deploy) | chat 4 | Test env smoke expertise |
| C (prod deploy) | chat 4 | Blue-Green prod deploy |
| D | organizer | Quarterly cadence, low ongoing |

---

## 11. Discovery findings baked into this spec

| Finding | Source | Implication |
|---|---|---|
| 26 endpoints in `SmartBIAnalysisController` (controller-level count) | `grep -cE "@(Get\|Post\|Put\|Delete\|Patch)Mapping"` | Phase 2A 50-endpoint scope counts service-level methods (e.g. drill-down expansion) — actual controller line count = 26 |
| 4 other SmartBI controllers exist (Config / Dashboard / Upload / PublicDemo) | `find` | OUT-OF-SCOPE for T6.5; Phase 2B+ separate decisions |
| `GoldDashboardBuilder` is Python downstream consumer | Java line 22-46 javadoc + memory `reference_smartbi_gold_layer_architecture.md` | KEEP through T6.5 |
| `service/smartbi/impl/` has 30 .java files | `find` | Phase C removes ~10 analysis-only impls; ~20 remain (Excel parsers / chart builders / etc.) |
| Phase 2A dict-eq parity 99.945% | T6.1 dryrun match rate | Provides confidence for irreversible Phase C |
| Pattern B PR #135 already shipped, prod-deploy prereq for T6.4 | `project_2026_05_07_t6_1_dryrun_in_flight.md` | Pattern B stays Python-side; Java side never had Pattern B |
| smartbi_migrations runner ships in PR #98/#100/#102/#104 | `reference_smartbi_migration_runner.md` | Phase D schema audit relies on tracker |
| Blue-Green Java deploy pattern | `reference_blue_green_java_deploy.md` | Phase B/C deploys use 10010 ↔ 10020 nginx upstream switch |

---

## 12. Open questions for Phase A reviewer

> Status updated 2026-05-09 by Phase A audit + Decision 4B amendment cycle. Remaining open items are organizer/Phase-C dispatch decisions, not Phase A blockers.

1. ✅ **ANSWERED** — **GoldDashboardBuilder caller verification**: Phase A audit §4.3 confirmed NOT orphaned. `SalesAnalysisServiceImpl:52` + `FinanceAnalysisServiceImpl:59` inject and call. Python `analysis_finance.py:1749` + `analysis_sales.py:1180` inline the Gold builder logic for the 75-factory `/analysis/finance` path → no Java round-trip on Python's path; Java→Python round-trip remains alive only via Dashboard composite + F999 + PublicDemo. KEEP through Phase D. See §A.3 amendment + audit §4.3.

2. ✅ **ADDRESSED** — **Service interface vs impl removal**: Per Phase A audit §3.2.a, all 10 analysis service interfaces + impls are SHARED with at least one OUT-OF-SCOPE controller. Wholesale interface/impl removal not feasible. Phase C handles via **method-level audit** (§C.1.3 worked example) — interfaces and impl class files stay; only orphan public methods are removed. Decision finalized.

3. ⚠️ **PARTIAL** — **Datasource upload duplication**: Phase A audit did not exhaustively trace whether `SmartBIAnalysisController.@PostMapping("/datasource/upload")` and `SmartBIUploadController.@PostMapping(...)` are functionally duplicated. The Analysis controller method IS in Phase B stub list (it's nginx-Python-routed). The Upload controller method stays per §1.2. **Phase B dispatch should verify**: post-stub, is the Upload-controller `/upload*` path still customer-reachable for the actual upload flow, or does the frontend rely on the Analysis-controller route? If the latter, frontend may need to switch to Python's `/api/smartbi/datasource/upload`. Recommend Phase B PR review to grep frontend for hardcoded `/smart-bi/datasource/upload` URLs.

4. **Test factory behavior post-Phase C**: TEST_0000_001 + 60 test factories on Python — will Phase C test deploy still smoke-test cleanly? Verify test env data state mirrors prod. (Unchanged from original spec.)

5. **Compatibility window with mobile app**: Are any older mobile app versions hitting Java directly (bypassing 139 nginx)? Should be 0 (mobile points to api.cretaceousfuture.com), but verify per ops. (Unchanged from original spec.)

6. **Phase 2B port pipeline timing**: If Phase 2B (port other SmartBI controllers) starts during T6.5 window, scope conflict — coordinate via separate ticket. (Unchanged from original spec.)

7. ✅ **ANSWERED (NEW, organizer decision 2026-05-09)** — **F999 fate**: Phase B uses **Option A (unconditional 410)**. F999 SmartBI Analysis endpoints (the 22 stubbed paths) will return 410 starting Phase B. Internal Cretas test team accepts this cost; F999 carve-out branching (Option B) rejected for code-cleanliness. **F999 migration to Python is tracked as a T6.6 follow-up** alongside the 4 NOT_SAFE_FALLTHROUGH endpoint ports — see audit §6.4. Cross-ref T6.6 spec when available.

---

## 13. Sign-off

Before Phase A kickoff this spec reviewed by:

- [ ] Engineering organizer (timing + scope acceptable)
- [ ] chat 4 (Pattern B owner — Phase A audit task §A.3 acceptable)
- [ ] chat 1 (Python prod deploy owner — coordination acceptable)
- [ ] On-call rotation lead (60+ day timeline staffing acceptable)

Sign-off recorded in PR description when this spec merges main.

---

**End of T6.5 Java SmartBI Deprecation Trigger Spec**
