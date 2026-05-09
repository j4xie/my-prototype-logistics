# T6.5 Phase C Sub-T — SmartBI Test Class Orphan Sweep Audit

**Date**: 2026-05-10
**Branch**: `ops-t6-5-phase-c-sub-t-test-orphan-sweep`
**Worktree base**: `origin/main` HEAD `e0a4a5c370` (post Sub-A `8b16cd60` + Sub-B `4e9c41` + Sub-C `2dde72` + Sub-D `c87b34` + Sub-E `571a0b4` + Sub-F `b6428a` + Sub-G `4d381` + PR #247 `4f1e843`)
**Author**: Chat 6 reuse (Sub-T dispatch per Phase C MO PR #227)
**Scope**: `backend/java/cretas-api/src/test/java/` orphan sweep — tests referencing production code deleted by Sub-A through Sub-G
**Predecessors**:
- PR #236 (Sub-A: 23 controller method bodies + `SmartBiQueryTemplateRepository` deleted)
- PR #243 (Sub-B: SalesAnalysisServiceImpl -352 LOC)
- PR #244 (Sub-C: DepartmentAnalysisServiceImpl -188 LOC)
- PR #245 (Sub-D: RegionAnalysisServiceImpl 5 dead methods)
- PR #248 (Sub-E: FinanceAnalysisServiceImpl 10 dead methods)
- PR #246 (Sub-F: ProductionAnalysisServiceImpl)
- PR #242 (Sub-G: QualityAnalysisServiceImpl 3 dead methods)
- PR #247 (test partial cleanup — subagent killed mid-work, 137→? fail count)

---

## §0 TL;DR — STOP-AND-PING FINDING

**Sub-T dispatch premise is empirically FALSE.** Round 1-2 + Round 3 (= Phase C Sub-A through Sub-G) deletions did **NOT** create orphan test classes. No test files reference deleted production code, no compile errors, no runtime regressions in SmartBI test surface.

| Audit step | Expected (per MO) | Actual |
|---|---|---|
| `mvn test-compile` | "cannot find symbol" / "class .* does not exist" errors | **BUILD SUCCESS** — 126/126 test sources compile clean |
| Tests referencing deleted Sales/Department/Region/Production/Quality/Inventory/Procurement service methods | Some — to be deleted | **0** — none of these services ever had a test file |
| Tests referencing 10 deleted Finance methods (per Sub-E PR #248) | Some — to be deleted | **0** — `FinanceAnalysisServiceImplTest` only had tests for 5 KEEP methods |
| Tests referencing deleted `SmartBiQueryTemplateRepository` (per Sub-A PR #236) | Some — to be deleted | **0** — companion test never existed (verified in Sub-A PR description) |
| Tests referencing deleted `getDataDateRange` Dashboard method (per Sub-A) | Some — to be deleted | **0** — no test file targets `SmartBIDashboardController` |
| `mvn test` SmartBI test surface (Finance/Forecast/Recommendation/Routing) | At least some FAIL after Sub-* deletions | **19/19 PASS** clean |
| Full `mvn test` fail count vs PR #247 `137→5` baseline | Sub-T to clear "some of the 5" | **12/2487 fail** (10 intent classifier drift + 1 optimistic lock + 1 DB constraint isolation; **0 SmartBI orphan**) |

**Verdict**: Sub-T cannot make any meaningful changes — there are no orphan tests to delete because the deleted production code was never test-covered (or the existing tests were curated to KEEP-only methods at deletion time, e.g. Sub-E `FinanceAnalysisServiceImplTest` had its 5 tests retained because they cover 5 KEEP'd methods).

**Recommended actions** (per dispatch §4 STOP-and-ping organizer):
1. Close Sub-T PR as **NO-OP scope** with this audit doc as the artifact (bake the lesson: Phase C Sub-* deletions are test-orphan-free because the original SmartBI 75-endpoint Java surface was barely test-covered — ~4 tests across 8 services).
2. **Re-scope Sub-T** if organizer's intent was broader (e.g. clear Sub-K orphan ENTITY (`SmartBiQueryTemplate`) test references, or sweep PR #247's residual ~5 `mvn test` failures regardless of orphan status).
3. **Dispatch Sub-K** entity orphan sweep (`SmartBiQueryTemplate` JPA entity per Sub-A PR #236 §"Out of scope"). Independent of Sub-T's premise.

This doc preserves the empirical investigation so future Phase C-similar work doesn't burn a chat on a same-shape false premise.

---

## §1 Methodology

### §1.1 Production deletions inventory (input to orphan grep)

Sub-* PRs deleted the following identifiers (collected from PR file lists + body):

**Sub-A (#236)** — Controllers + Repository:
- `SmartBIAnalysisController` 22 method declarations: `getSalesAnalysis`, `getDepartmentAnalysis`, `getRegionAnalysis`, `getFinanceAnalysis`, `getBudgetAchievementChart`, `getYoYMoMComparisonChart`, `getCategoryStructureComparisonChart`, `getInventoryAnalysis`, `getProcurementAnalysis`, `getAlerts`, `getRecommendations`, `getIncentivePlan`, `uploadAndDetectSchema`, `previewSchemaChanges`, `applySchemaChanges`, `listDatasources`, `getDatasourceFields`, `getSchemaHistory`, `getQueryTemplates`, `createQueryTemplate`, `updateQueryTemplate`, `deleteQueryTemplate`
- `SmartBIDashboardController` 1 method: `getDataDateRange`
- `SmartBiQueryTemplateRepository` — entire file deleted

**Sub-B (#243)** — SalesAnalysisServiceImpl method bodies (-336 LOC impl + interface)

**Sub-C (#244)** — DepartmentAnalysisServiceImpl method bodies (-155 LOC impl + interface)

**Sub-D (#245)** — RegionAnalysisServiceImpl 5 method bodies (-228 LOC impl + interface, 3 deferred to Sub-L)

**Sub-E (#248)** — FinanceAnalysisServiceImpl 10 method bodies + `PERIOD_TYPE_*` constants:
- `getCostTrendChart`, `getReceivableTrendChart`, `getPayableAgingChart`, `getPayableMetrics`, `getBudgetExecutionWaterfall`, `getBudgetVsActualChart`, `getBudgetMetrics`, `getBudgetAchievementChart`, `getYoYMoMComparisonChart`, `getCategoryStructureComparisonChart`
- (`getReceivableAgingChart` deferred to Sub-L)

**Sub-F (#246)** — ProductionAnalysisServiceImpl (-9 LOC impl + interface)

**Sub-G (#242)** — QualityAnalysisServiceImpl 3 method bodies (-67 LOC impl + interface)

### §1.2 Audit grep matrix

For each deletion, `grep -rn '<identifier>' backend/java/cretas-api/src/test/`:

| Identifier | Test refs | Notes |
|---|---|---|
| `getSalesAnalysis` | **0** | No test |
| `getDepartmentAnalysis` | **0** | No test |
| `getRegionAnalysis` | **0** | No test |
| `getFinanceAnalysis` | **0** | No test (entry-point method; Sub-E tests target sub-methods of finance-impl, all KEEP'd) |
| `getInventoryAnalysis` | **0** | No test |
| `getProcurementAnalysis` | **0** | No test |
| `getProductionAnalysis` | **0** | Production analysis controller endpoint kept alive per Sub-A HARD KEEP; impl interface trimmed |
| `getQualityAnalysis` | **0** | Quality analysis controller endpoint kept alive per Sub-A HARD KEEP; impl interface trimmed |
| `SalesAnalysisService` | **0** | No test file references the interface or impl class |
| `DepartmentAnalysisService` | **0** | No test |
| `RegionAnalysisService` | **0** | No test |
| `ProductionAnalysisService` | **0** | No test |
| `QualityAnalysisService` | **0** | No test |
| `InventoryHealthAnalysisService` | **0** | No test |
| `ProcurementAnalysisService` | **0** | No test |
| `getCostTrendChart` (Sub-E) | **0** | No test |
| `getReceivableTrendChart` | **0** | No test |
| `getPayableAgingChart` | **0** | No test |
| `getPayableMetrics` | **0** | No test |
| `getBudgetExecutionWaterfall` | **0** | No test |
| `getBudgetVsActualChart` | **0** | No test |
| `getBudgetMetrics` | **0** | No test |
| `getBudgetAchievementChart` | **0** | No test |
| `getYoYMoMComparisonChart` | **0** | No test |
| `getCategoryStructureComparisonChart` | **0** | No test |
| `getReceivableAgingChart` (Sub-L deferred) | **0** | No test |
| `SmartBiQueryTemplateRepository` (Sub-A deleted) | **0** | Per Sub-A PR §"Verification": "Companion test file does NOT exist (verified)" |
| `SmartBIAnalysisController` (Sub-A 22 methods stripped) | **0** | No `@WebMvcTest` for this controller |
| `SmartBIDashboardController.getDataDateRange` | **0** | No test |

**Total identifier references in test layer: 0.**

### §1.3 SmartBI test surface inventory

`grep -rln "SmartBI\|smartbi" src/test/java/com/cretas/aims/`:

| Test file | Test count | Status |
|---|---:|---|
| `service/smartbi/impl/FinanceAnalysisServiceImplTest.java` | 5 | ALIVE — covers 5 of 6 KEEP methods (per Sub-E PR #248 §"Test plan") |
| `service/smartbi/impl/ForecastServiceImplTest.java` | 6 | ALIVE — `ForecastService` not touched by Phase C |
| `service/smartbi/impl/RecommendationServiceImplTest.java` | 2 | ALIVE — `RecommendationService` HARD KEEP per Sub-A |
| `service/smartbi/impl/SmartBIRestaurantRoutingTest.java` | 6 | ALIVE — routing logic tests |
| `client/GoldFinanceClientTest.java` | n/a | ALIVE — Gold layer KEEP forever |
| `client/PythonSmartBIClientTest.java` | n/a | ALIVE — Python proxy client |
| `client/PythonSmartBIClientSectionTest.java` | n/a | ALIVE — Python proxy client |
| `service/skill/RestaurantSkillsRegistrationTest.java` | n/a | ALIVE — restaurant skills |
| `integration/RestaurantP35IntegrationTest.java` | n/a | ALIVE — restaurant integration |
| `ai/tool/impl/restaurant/diagnostic/AbstractRestaurantDiagnosticToolTest.java` | n/a | ALIVE — restaurant diagnostic tool |

The 4 SmartBI service-level tests (19 @Test methods total) all run clean: `mvn test -Dtest=FinanceAnalysisServiceImplTest,ForecastServiceImplTest,RecommendationServiceImplTest,SmartBIRestaurantRoutingTest` → **Tests run: 19, Failures: 0, Errors: 0, Skipped: 0**.

### §1.4 `mvn test-compile` BUILD SUCCESS

```
[INFO] --- compiler:3.11.0:testCompile (default-testCompile) @ cretas-backend-system ---
[INFO] Changes detected - recompiling the module! :dependency
[INFO] Compiling 126 source files with javac [debug release 21] to target\test-classes
[INFO] BUILD SUCCESS
[INFO] Total time:  01:39 min
```

Only deprecation/unchecked warnings emitted (pre-existing). Zero `cannot find symbol`, zero `class … does not exist`, zero `package … does not exist`. The marching order's grep pattern (`mvn test 2>&1 | grep -E "cannot find symbol|class .* does not exist"`) returns no matches.

---

## §2 Why orphan tests don't exist after Sub-* deletions

### §2.1 Phase C deletions targeted *interface methods*, not classes

Per Phase C MO PR #227 + Sub-E spec §C.1.2: each Sub-* PR removes only public method declarations from a service interface + their `@Override` impl bodies. The class file itself stays alive, because Dashboard composite paths + `/query` NL dispatcher continue calling KEEP'd methods. Tests written against the surviving methods (e.g. `getProfitTrendChart_*` 2 tests in `FinanceAnalysisServiceImplTest`) remain valid; tests against deleted methods would have caused compile fail and were either:
- Never written (most services), OR
- Curated KEEP-only at the time of writing (Finance, by lucky alignment).

### §2.2 The 7 dead-method services were never test-covered

Phase A audit (PR #178) and Phase B PR #213 revealed that the Java SmartBI 75-endpoint surface was largely **synthetic** — Phase 2A Pattern B real-port mostly happened on the Python side (commits `131`/`135`/`137` etc.). The original Java methods were stub-shaped placeholders rarely exercised by tests. Hence:
- `SalesAnalysisService` had no test file
- `DepartmentAnalysisService` had no test file
- `RegionAnalysisService` had no test file
- `ProductionAnalysisService` had no test file
- `QualityAnalysisService` had no test file
- `InventoryHealthAnalysisService` had no test file
- `ProcurementAnalysisService` had no test file

Only `FinanceAnalysisService` had a test file, and Sub-E PR #248 §"Verification" §"Test file: UNCHANGED" confirmed those 5 tests target 5 of the 6 KEEP'd methods (the one method without a test is `getReceivableMetrics`, which is alive but uncovered — not orphan, just under-covered).

### §2.3 Sub-A's orphan repo had no companion test

Sub-A PR #236 §"Verification": *"Companion test file does NOT exist (verified)"* for `SmartBiQueryTemplateRepository`. Confirmed by `grep -rn "SmartBiQueryTemplateRepository" backend/java/cretas-api/src/test/` returning 0 hits.

### §2.4 PR #247's "137 fails" are not orphan-related

PR #247 body identifies the 137-fail population:
> *"The remaining ~137 pre-existing test failures are addressed (Mockito UnnecessaryStubbingException + ToolRegistry mock wiring + a handful of spec/data drift cases)."*

These categories are **test quality issues**, not orphan-class issues:
- `Mockito UnnecessaryStubbingException` — mock setups that aren't used by `verify()` (Mockito strict mode)
- `ToolRegistry mock wiring` — DI mock setup drift (Tool-Skill architecture changes, not Phase C deletions)
- `Spec/data drift` — assertion values that no longer match spec (e.g. localized strings, fixture changes)

PR #247's 28-file modification list (per its body) includes:
- `SyntheticDataServiceTest`, `OrderUsageWhitelistsTest`, `GlobalExceptionHandlerBusinessTest`, `AttendanceWorkTimeFlowTest`, `DepartmentManagementFlowTest`, `ProcessModeApiContractTest`, `ProcessTaskAIToolsIT`, `IntentParityTest`, `IntentResponseE2EV9Test`, `TwoStageIntentClassifierV9*Test` (4 files), `UserServiceImplSearchTest`, `ExternalVerifierServiceTest`, `TimeZoneSensitiveTest`, `FactoryConfigAutoGenerateTest`, `IntentExecutorStreamIT`, `LlmIntentFallbackClientImplClarificationTest`, `ProcessTaskServiceImplTest`, `ProcessWorkReportingServiceImplTest`, `SemanticCacheServiceTest`, `ProtocolMatcherTest`, `AgentCollaborationE2ETest`, `AnalysisFlowIntegrationTest`, `SkuComplexityEventListenerTest`, `ToolExecutionTest`, `ToolRegistryTest`

**Zero of these 28 are SmartBI service tests.** They are all unrelated test layers (intent classifier, process tasks, calibration, tools, etc.). Sub-T cannot help them by deleting orphan SmartBI tests, because Sub-T's premise (orphan SmartBI tests) is empty.

---

## §3 Empirical evidence

### §3.1 Test-compile gate

Command: `./mvnw.cmd test-compile`

Result: **BUILD SUCCESS** (1:39 min). Log: `.tmp-transcripts/sub-t-test-compile.log` (~6KB).

### §3.2 SmartBI test surface gate

Command: `./mvnw.cmd test -Dtest=FinanceAnalysisServiceImplTest,ForecastServiceImplTest,RecommendationServiceImplTest,SmartBIRestaurantRoutingTest`

Result:
```
Tests run: 19, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS  Total time: 1:45 min
```

Log: `.tmp-transcripts/sub-t-smartbi-tests.log` (~12KB).

### §3.3 Full `mvn test` gate (Step 3 of dispatch — COMPLETED)

Command: `./mvnw.cmd test -fae` (fail-at-end). Log: `.tmp-transcripts/sub-t-mvn-test-full.log` (~12 MB, 75 surefire reports under `target/surefire-reports/`).

**Result**:

```
Tests run: 2487, Failures: 11, Errors: 1, Skipped: 40
BUILD FAILURE  Total time: 3:53 min
```

**Failure tally vs PR #247 baseline**:

| Source | Tests run | Failures | Errors | Total fails | Status |
|---|---:|---:|---:|---:|---|
| PR #247 baseline (per body) | (not reported) | (not reported) | (not reported) | **~137** (pre-247) → **~5** (post-247 expected) | Subagent killed mid-work, no final count |
| This audit (Sub-T no-op state) | 2487 | 11 | 1 | **12** | Confirmed |

PR #247 partial cleanup achieved ~125 fail reduction (~137→12) — significantly better than its expected `~5` floor but still positive. Sub-T cannot improve this further via orphan sweep because none of the 12 fails are orphan-related (see §3.3.1).

#### §3.3.1 Failure category breakdown (all 12 fails)

| # | Test class | Test method | Category | Orphan? |
|---|---|---|---|---|
| 1 | `ProcessModeFlowTest` | `testOptimisticLock:479` | Spec/data drift (`Expecting 0L to be greater than 0L`) | **NO** |
| 2 | `ProcessModeFlowTest` | `testStateMachinePublish:613` (ERROR) | DB unique constraint `uk_state_machines_INDEX_4` on `(factory_id='F001', entity_type='PRODUCTION_WORKFLOW_IT09')` — test cleanup/isolation issue | **NO** |
| 3 | `IntentResponseE2EV9Test$BusinessQueryResponseTests` | `testMaterialQueryResponse:231` (2 sub-failures) | Intent classifier drift: domain `MATERIAL`→`PROCESSING`, intent `MATERIAL_BATCH_QUERY`→`PROCESSING_BATCH_LIST` | **NO** (classifier model behavior changed, not orphan) |
| 4-7 | `TwoStageIntentClassifierV9ComplexScenariosTest` | `testLongSentences:138` (4 sub-failures) | Intent classifier domain drift: `MATERIAL`→`PROCESSING`, `MATERIAL`→`SUPPLIER`, `ORDER`→`CUSTOMER`, `MATERIAL`→`PROCESSING` on long-sentence inputs | **NO** |
| 8-9 | `TwoStageIntentClassifierV9ComplexScenariosTest` | `testMultipleModifiers:72` (2 sub-failures) | Intent classifier intent drift: `MATERIAL_STATS`→`PROCESSING_STATS` (2 sentence variants) | **NO** |
| 10 | `TwoStageIntentClassifierV9ComplexScenariosTest` | `testNumberAndUnit:280` | Intent classifier domain drift: `ORDER`→`CUSTOMER` for "订单金额超过10万的客户" | **NO** |
| 11-12 | `TwoStageIntentClassifierV9ComprehensiveTest` | `testMaterialDomain:70` (2 sub-failures) | Intent classifier domain drift: `MATERIAL`→`PROCESSING` for "录入原材料批次" / "查询原料批次" | **NO** |

**Aggregate**: 0/12 fails are orphan-class issues. Categories:
- **10/12**: Intent classifier model drift — Python BERT classifier (171-class V9 model, ONNX QUInt8 103MB) returning different domain/intent than the test fixtures expect. Root cause is model retraining drift since fixtures were authored, NOT Phase C deletion. Sub-T cannot fix these by deleting orphans.
- **1/12**: Optimistic lock test data drift (`ProcessModeFlowTest.testOptimisticLock`).
- **1/12**: DB unique constraint test isolation (`ProcessModeFlowTest.testStateMachinePublish` — `uk_state_machines_INDEX_4` violated, suggests prior test run left rows).

None of these can be resolved by orphan-test deletion. They require either:
- Updating fixtures to match current classifier output (risk: masks regressions)
- Retraining classifier to old behavior (out of scope)
- Updating optimistic-lock assertion (`>0L` → `>=0L` if meant to allow no-op)
- Adding `@Sql` cleanup or `@Transactional` rollback to state machine test
- (For test isolation) — investigation of which test wrote the seed row first

**Conclusion (re-confirmed)**: Sub-T scope is empty. Recommend NO-OP PR + this audit doc as the artifact + organizer dispatch separate "test debt cleanup" task for the 12 fails (not orphan work).

### §3.4 Identifier grep matrix

Reference §1.2 — all 28 identifiers (deleted methods + deleted classes) return 0 hits in `src/test/`.

---

## §4 Recommendation

### §4.1 Close Sub-T as NO-OP

The orphan sweep premise yields 0 deletions. Sub-T should ship as a documentation-only PR containing **only this audit doc** (`docs/qa-audits/2026-05-10-t6-5-phase-c-sub-t-test-orphan-sweep-audit.md`). No `.java` files modified. No `git rm` invocations.

This preserves the audit findings in repo history and saves future Phase C-similar work from re-running the same null investigation.

### §4.2 Pivot scope (alternative — requires organizer GO)

If organizer intended Sub-T to include the **5 residual `mvn test` failures from PR #247** (regardless of orphan status), that's a different scope:
- "Test debt cleanup" — Mockito strict / mock wiring / spec drift fixes
- Not blocked by Sub-L (which is cross-Sub orphan sweep on production code)

This would require:
- Re-dispatch with explicit fail list (run `mvn test -fae` first to enumerate)
- Categorize each fail (Mockito-strict / mock-wiring / spec-drift)
- Per-fail fix strategy (lenient stub / update mock / realign assertion)

### §4.3 Sub-K dispatch (parallel — independent of Sub-T)

Sub-K (per Sub-A PR #236 §"Out of scope") = orphan **entity** sweep for `SmartBiQueryTemplate.java` (the JPA entity, separate from the deleted `SmartBiQueryTemplateRepository.java` interface). Verify entity is no longer referenced anywhere alive, then `git rm`. This is **NOT** test orphan work — it's production code orphan, parallel to the Sub-* method-level deletes but at the entity level.

---

## §5 Outstanding items

| Item | Status | Owner |
|---|---|---|
| Bg `mvn test -fae` final result | **DONE** — 12 fails, 0 orphan | Logged in §3.3 |
| STOP-and-ping organizer | **READY** — Sub-T disposition decision | This chat → Organizer |
| Sub-T disposition (NO-OP vs pivot vs split) | **AWAITING ORGANIZER** | Organizer |
| Sub-K entity sweep dispatch (`SmartBiQueryTemplate.java` JPA entity) | Out of scope for Sub-T; independent | Organizer |
| Sub-L cross-Sub orphan sweep dispatch (production-side) | Per dispatch ⛔ HOLD on chat6, overridden by Steve `做呀` for Sub-T audit; chat6 ETA ~2h once GO | Organizer / chat6 |
| Test debt cleanup (12 non-orphan fails: 10 classifier + 1 lock + 1 DB) | Not Sub-T scope per audit; recommend separate dispatch | Organizer |

---

## §6 References

- PR #150 (T6.5 spec, §C.1.3 worked example)
- PR #178 (Phase A audit v3.1)
- PR #213 (Phase B 23-endpoint stub)
- PR #227 (Phase C MO draft — dispatch source)
- PR #236 (Sub-A controller body delete + orphan repo delete)
- PR #243 (Sub-B SalesAnalysis)
- PR #244 (Sub-C DepartmentAnalysis)
- PR #245 (Sub-D RegionAnalysis)
- PR #246 (Sub-F ProductionAnalysis)
- PR #242 (Sub-G QualityAnalysis)
- PR #248 (Sub-E FinanceAnalysis — sister with retained tests)
- PR #247 (test partial cleanup — Mockito-strict / mock-wiring / spec-drift)
- `.claude/rules/concurrent-edit-safety.md` (commit safety per Steve)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
