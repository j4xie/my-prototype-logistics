# PR #181 Phase B Marching Order — Dry-Run Accuracy Audit

**Audit date**: 2026-05-09
**Auditor**: Chat B (independent verify, organizer-dispatched)
**Subject**: `docs/superpowers/dispatch/2026-05-15-t6-5-phase-b-stub-marching-order.md` (PR #181)
**Verdict**: **HIGH confidence — accurate, dispatch-ready** (1 minor count drift, no blocking findings)
**Scope**: Verify method-name + line-number drift, Spring Bean preservation feasibility, test-removal scope, pre-flight gate cross-check. No code edits. Audit-only PR.

---

## §1 Methodology

1. Worktree `ops-pr181-mo-dry-run` cut from `origin/main` HEAD `0452e52948` (current `main`, **18 commits ahead** of MO's claimed verification HEAD `0f80b14b20`).
2. **Independent grep** of `@(Get|Post|Put|Delete|Patch)Mapping` against both controllers — no reading of MO's claimed mapping table first.
3. Cross-reference each MO row against grep output (path → line, line → method name).
4. Verify all referenced supporting docs exist (audit doc, spec doc).
5. Cross-check `SmartBIAnalysisControllerTest.java` non-existence claim via `find … -name 'SmartBI*Test*'`.
6. Spring Bean preservation: read field declarations + constructor body, identify which `@Autowired` services the 4 NOT_SAFE_FALLTHROUGH methods + 9 private helpers actually call.

Per `feedback_marching_order_method_name_grep.md` + `feedback_audit_endpoint_impl_not_router.md` HARD rules: **no inference from path or naming convention**; every claim verified against literal source.

---

## §2 22 endpoint method audit (`SmartBIAnalysisController.java`)

Independent grep of `@(Get|Post|Put|Delete|Patch)Mapping` produced 26 hits. After deducting 4 NOT_SAFE_FALLTHROUGH (verified §3) the 22 stub candidates resolve as:

| # | MO claim — Path | MO claim — Method (line) | Actual Java | Match? |
|---|------|---------------|---------|---|
| 1 | `GET /analysis/sales` | `getSalesAnalysis` (98) | `@GetMapping` line 98, method body line 100 | ✅ |
| 2 | `GET /analysis/department` | `getDepartmentAnalysis` (142) | line 142 / 144 | ✅ |
| 3 | `GET /analysis/region` | `getRegionAnalysis` (181) | line 181 / 183 | ✅ |
| 4 | `GET /analysis/finance` | `getFinanceAnalysis` (222) | line 222 / 224 | ✅ |
| 5 | `GET /analysis/finance/budget-achievement` | `getBudgetAchievementChart` (276) | line 276 / 278 | ✅ |
| 6 | `GET /analysis/finance/yoy-mom` | `getYoYMoMComparisonChart` (294) | line 294 / 296 | ✅ |
| 7 | `GET /analysis/finance/category-comparison` | `getCategoryStructureComparisonChart` (314) | line 314 / 316 | ✅ |
| 8 | `GET /analysis/inventory` | `getInventoryAnalysis` (411) | line 411 / 413 | ✅ |
| 9 | `GET /analysis/procurement` | `getProcurementAnalysis` (452) | line 452 / 454 | ✅ |
| 10 | `GET /alerts` | `getAlerts` (590) | line 590 / 592 | ✅ |
| 11 | `GET /recommendations` | `getRecommendations` (621) | line 621 / 623 | ✅ |
| 12 | `GET /incentive-plan/{targetType}/{targetId}` | `getIncentivePlan` (641) | line 641 / 643 | ✅ |
| 13 | `POST /datasource/upload` | `uploadAndDetectSchema` (678) | line 678 (with `consumes=MULTIPART_FORM_DATA_VALUE`) / 680 | ✅ |
| 14 | `GET /datasource/{datasourceId}/preview` | `previewSchemaChanges` (696) | line 696 / 698 | ✅ |
| 15 | `POST /datasource/apply` | `applySchemaChanges` (714) | line 714 / 716 | ✅ |
| 16 | `GET /datasource/list` | `listDatasources` (731) | line 731 / 733 | ✅ |
| 17 | `GET /datasource/{datasourceId}/fields` | `getDatasourceFields` (747) | line 747 / 749 | ✅ |
| 18 | `GET /datasource/{datasourceId}/history` | `getSchemaHistory` (764) | line 764 / 766 | ✅ |
| 19 | `GET /query-templates` | `getQueryTemplates` (956) | line 956 / 958 | ✅ |
| 20 | `POST /query-templates` | `createQueryTemplate` (965) | line 965 / 967 | ✅ |
| 21 | `PUT /query-templates/{templateId}` | `updateQueryTemplate` (976) | line 976 / 978 | ✅ |
| 22 | `DELETE /query-templates/{templateId}` | `deleteQueryTemplate` (997) | line 997 / 999 | ✅ |

**22 of 22 method names + line numbers match exactly.**

### NOT_SAFE_FALLTHROUGH 4 (DO NOT TOUCH)

| Path | Method (line) | Actual | Match? |
|------|---------------|---------|---|
| `GET /analysis/production` | `getProductionAnalysis` (334) | line 334 / 336 | ✅ |
| `GET /analysis/quality` | `getQualityAnalysis` (373) | line 373 / 375 | ✅ |
| `POST /query` | `query` (491) — note `query`, not `nlQuery` | line 491 / 493 (method name **`query`** confirmed) | ✅ |
| `POST /drill-down` | `drillDown` (531) | line 531 / 533 | ✅ |

MO correctly disambiguates `POST /query` method name (`query` not `nlQuery`) — preempts a likely sister-chat assumption.

---

## §3 23rd Dashboard endpoint audit (`SmartBIDashboardController.java`)

| MO claim | Actual | Match? |
|---|---|---|
| `GET /data-date-range` | `getDataDateRange` (345) | `@GetMapping("/data-date-range")` line 345, method body line 347 | ✅ |
| 10 other methods stay alive (DO NOT TOUCH) | grep'd 11 `@*Mapping` total → 10 non-stub-target | ✅ — confirmed: `/generate-adaptive-charts` (95) / `/generate-chart` (120) / `/dashboard/executive` (158) / `/dashboard/executive/insights` (190) / `/dashboard/executive/insights/custom` (211) / `/dashboard/executive/insights/custom/stream` (245) / `/dashboard/executive/custom` (317) / `/dashboard` (376) / `/analysis/dynamic/kpis` (462) / `/analysis/dynamic` (486) — 10 alive, matches MO |

Both controllers share `@RequestMapping("/api/mobile/{factoryId}/smart-bi")` (Analysis line 48, Dashboard line 38). Path overlap is structural, not accidental — `/data-date-range` lands on Dashboard via class-level mapping, not Analysis.

---

## §4 Spring Bean preservation feasibility

MO §B.2 / Step 3 claim: keep all field declarations + `@Autowired` constructor; the 4 NOT_SAFE methods + 9 helpers depend on injected services.

Verified field declarations `SmartBIAnalysisController.java:52-64` (13 fields):

| Field (line) | Used by NOT_SAFE method or helper |
|---|---|
| `salesAnalysisService` (52) | `getSalesAnalysis` (stub) + `generateSalesQueryResponse` helper (line 853) |
| `departmentAnalysisService` (53) | stub + `generateDepartmentQueryResponse` (866) |
| `regionAnalysisService` (54) | stub + `generateRegionQueryResponse` (878) |
| `financeAnalysisService` (55) | stub + `generateFinanceQueryResponse` (890) |
| `intentService` (56) | **`query`** NOT_SAFE method line 493 + `executeQueryByIntent` helper line 802 |
| `recommendationService` (57) | `getRecommendations` (stub only) — see §7 F-MINOR-2 below |
| `schemaService` (58) | datasource/* stubs + (potentially) F999 fallthrough — see F-MINOR-2 |
| `productionAnalysisService` (59) | **`getProductionAnalysis`** NOT_SAFE (line 336) + `generateProductionQueryResponse` (903) |
| `qualityAnalysisService` (60) | **`getQualityAnalysis`** NOT_SAFE (line 375) + `generateQualityQueryResponse` (916) |
| `inventoryHealthAnalysisService` (61) | stub + `generateInventoryQueryResponse` (929) |
| `procurementAnalysisService` (62) | stub + `generateProcurementQueryResponse` (941) |
| `smartBIService` (63, `@Autowired(required=false)`) | **`drillDown`** NOT_SAFE method line 533 — confirmed via grep `smartBIService` |
| `queryTemplateRepository` (64) | query-templates/* stubs (lines 960/971/982/990 use it) |

Constructor `SmartBIAnalysisController.java:67-94` ✅ verified — single `@Autowired` constructor, 13 params 1:1 with fields.

**Spring Bean preservation conclusion**: MO's §B.2 claim is **safe and necessary**. Removing any field would break either a NOT_SAFE method (`query` / `drillDown` / `getProductionAnalysis` / `getQualityAnalysis`) or a private helper still wired into `executeQueryByIntent` (line 802). Even fields used only by stub methods (e.g. `recommendationService`, `queryTemplateRepository`) must stay because `@Autowired` constructor signature must remain stable for Spring DI; removing a constructor param would be a separate refactor outside Phase B scope (Phase C method-level audit per spec §B.4).

---

## §5 Test removal scope

MO §Step 4 claim: `SmartBIAnalysisControllerTest.java` does NOT exist; only `SmartBIRestaurantRoutingTest.java` exists at service-impl scope.

Independent verification:

```
$ find backend/java/cretas-api/src/test -name 'SmartBI*Test*.java' -type f
backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/SmartBIRestaurantRoutingTest.java
```

✅ Confirmed:
- 0 controller-level tests for `SmartBIAnalysisController`
- 0 controller-level tests for `SmartBIDashboardController`
- 1 service-impl test for restaurant routing (different scope, KEEP)

MO claim accurate. **No test files to amend or delete in Phase B impl.** Phase C method-level audit (per spec §B.4) revisits testing scope for service impls.

---

## §6 Pre-flight gates cross-check

MO §Pre-flight gates (organizer responsibility, not Phase B impl):

| Gate | MO claim | Audit observation |
|---|---|---|
| PR #178 audit merged into `main` | required | NOT verified in this audit (organizer responsibility per `feedback_organizer_dispatch_not_handson.md`); however supporting doc `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` **does exist** in worktree at HEAD `0452e52948` (42415 bytes) — implies merge or local presence |
| PR-X spec amend merged | required (TBD) | NOT verified; spec `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` **does exist** (59047 bytes) — exact "amended" version status not within audit scope |
| F999 T-72h notification | organizer-owned | NOT auditable from repo state |
| T6.4 5-stage cascade complete | "verified per memory" | per memory `project_2026_05_09_phase_2a_complete.md` — out of scope (memory access only) |
| No P1 customer reports open | organizer-owned | NOT auditable from repo state |

**Audit position**: pre-flight gates are organizer-side check at dispatch time. MO clearly delineates ownership ("organizer responsibility — verify BEFORE dispatching this MO"). No drift detected in the *expression* of these gates.

Cross-reference of audit doc § against MO claims:
- Audit §3.1.b confirms `/data-date-range` is the 23rd stub candidate via Python `dashboard.py:84` route ✅
- Audit §3.1 row for `SmartBIDashboardController` confirms 10 other methods fall through to Java for all 75 factories ✅
- Audit §6 Phase B refined recommendation: stub 23 endpoints, no service-class touches ✅

MO scope refinement consistent with audit doc.

---

## §7 Findings + recommendations

### F-MINOR-1: helper count drift `× 7` → actual `× 8`

**MO §Step 1 / Helpers + DTOs section**: "lines ~802 onwards: `executeQueryByIntent` + `generate*QueryResponse` × 7 + `generateFollowUpQuestions`".

**Actual** (independent grep `private .* generate\w+Response`):

```
853 generateSalesQueryResponse
866 generateDepartmentQueryResponse
878 generateRegionQueryResponse
890 generateFinanceQueryResponse
903 generateProductionQueryResponse
916 generateQualityQueryResponse
929 generateInventoryQueryResponse
941 generateProcurementQueryResponse
```

= **8 helpers, not 7**. MO undercounts by 1 (likely missing `procurement` in the count).

**Impact**: Cosmetic. The MO instruction "keep — they're called from the 4 NOT_SAFE methods" applies to all 8 either way (they're all reachable from `executeQueryByIntent` switch at line 802). No code-edit ambiguity introduced.

**Recommendation**: minor MO patch from `× 7` → `× 8` for accuracy. Not a blocker.

### F-CONFIRMED-1: `HttpStatus` import flag is correct

MO §Step 3: "Add new import if not present: `import org.springframework.http.HttpStatus;` (verify before edit)."

Independent verification of imports in `SmartBIAnalysisController.java:1-34`: **0 occurrences of `HttpStatus`**. Currently imports `MediaType` (line 23) + `ResponseEntity` (line 24) but not `HttpStatus`. MO correctly anticipates the need to add it before the 410 stub pattern can compile.

### F-CONFIRMED-2: `SmartBiQueryTemplateRepository` import preservation is correct

MO §Step 3: "Do NOT delete `SmartBiQueryTemplateRepository` import — even though templates endpoints stub out, it's still field-injected. Phase C will remove the field + import together."

Verified: import line 10, field declaration line 64, constructor param line 80, used in 4 stub methods (lines 960/971/982/990). Even after stubbing the 4 query-template method bodies, the field + import remain referenced in field declarations + constructor + Spring DI graph. MO correctly defers removal to Phase C.

### F-CONFIRMED-3: NOT_SAFE method name disambiguation `query` vs `nlQuery`

MO §NOT_SAFE_FALLTHROUGH table: "POST /query — actual method name is `query`, not `nlQuery`".

Verified: `@PostMapping("/query")` line 491 → `public ResponseEntity<...> query(` line 493. Method name is **`query`**. Sister chat assumption "method probably called `nlQuery`" would be wrong; MO preempts.

### F-CONFIRMED-4: HEAD reference drift acceptable

MO claims line numbers verified against HEAD `0f80b14b20`. Current `main` HEAD is `0452e52948` (~18 commits ahead).

**Audit observation**: All 22 + 4 + 1 line numbers still match exactly at `0452e52948` despite the gap. Implies no commits in the gap touched these methods structurally. **Safe to dispatch from current main without re-verification of line numbers**, but Phase B impl chat should re-grep at its worktree base before each `Edit` (per `feedback_concurrent_edit_safety.md` Rule 3).

---

## §8 Confidence verdict

**HIGH** — MO is dispatch-ready.

Summary:
- **22 of 22** SmartBIAnalysisController stub-target method names + line numbers: ✅ match
- **4 of 4** NOT_SAFE_FALLTHROUGH method names + line numbers: ✅ match
- **1 of 1** SmartBIDashboardController stub-target (`/data-date-range`): ✅ match
- **10 of 10** SmartBIDashboardController DO_NOT_TOUCH endpoints: ✅ match
- **13 of 13** field declarations on Analysis controller: ✅ all justified for preservation
- Constructor `lines 66-94`: ✅ stable, mandatory for DI
- `SmartBIAnalysisControllerTest.java` non-existence: ✅ confirmed
- `HttpStatus` import flag: ✅ valid
- `SmartBiQueryTemplateRepository` preservation logic: ✅ valid

**1 cosmetic finding** (F-MINOR-1: `× 7` → `× 8` helper count).
**0 functional findings.**
**0 blocker findings.**

Recommended pre-dispatch action by organizer: optional 1-line MO edit for F-MINOR-1. If skipped, no impact on Phase B impl chat correctness.

---

## §9 Out-of-scope items (audit-discipline reminders)

Per `feedback_organizer_dispatch_not_handson.md` + `feedback_audit_endpoint_impl_not_router.md`:

- Did NOT modify `2026-05-15-t6-5-phase-b-stub-marching-order.md` (MO doc) — out of scope, organizer-owned.
- Did NOT verify pre-flight gates (PR #178 merge state, T-72h notification status, P1 reports) — those require organizer/external state, not source-code grep.
- Did NOT run `mvn compile` or any build to verify the 410 stub pattern compiles — Phase B impl chat's Step 5 owns that. Static-only analysis here.
- Did NOT verify Python sister-side endpoint coverage at `/api/smartbi/*` — that was PR #178's audit + PR #184 (nginx-Python coverage) scope.
- Did NOT independently validate audit §3.1.a's "SAFE_NGINX_ROUTED" classification against nginx vhost regex — Trust audit doc per its merged state, plus PR #143 baseline metrics established 200/410/regression baselines.

---

**End of audit.**
