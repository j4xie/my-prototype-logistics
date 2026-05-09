# T6.5 Phase C Sub-E — `FinanceAnalysisServiceImpl` Method-Level Audit

**Date**: 2026-05-10
**Branch**: `ops-t6-5-phase-c-sub-e-finance`
**Author**: Chat 6 (Sub-E dispatch — worked example per spec §C.1.3)
**Predecessor**: PR #236 (Sub-A controller body delete merged), PR #178 (Phase A audit v3.1), PR #150 (T6.5 deprecation spec, §C.1.3 worked example)
**Scope**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java` (2115 LOC) + interface + test file
**Worktree base**: `origin/main` HEAD `99772213aa` (post Sub-A `c8d509b8d1` + post PublicDemo sunset `b60ca6630b`)

---

## §0 TL;DR

**Classification (v3 — re-verified after compile FAIL on v2 plan)**: 17 public methods total → **6 KEEP / 1 DEFER (Sub-L) / 10 DELETE**.

### Audit revision history

- **v1** (2026-05-10 initial): 5 KEEP / 12 DELETE — based on external-only grep across `controller/` + `service/smartbi/impl/` (excluding self).
- **v2** (post chat5 Sub-D dead-chain finding): 4 KEEP / 1 DEFER / 12 DELETE — `getReceivableAgingChart` reclassified DEFER (sole caller in `SmartBIServiceImpl::getComprehensiveAnalysis` orphan).
- **v3** (post Steve mvn limited gate FAIL): 6 KEEP / 1 DEFER / 10 DELETE — **mvn caught two internal self-references missed by audit**:
  - `getFinanceOverview` line 157 calls `getProfitTrendChart`
  - `getFinanceOverview` line 166 calls `getOverdueCustomerRanking`
  - Both methods reclassified DELETE → KEEP (Option A — `getFinanceOverview` genuinely needs them for Dashboard composite chart/ranking output).

### v3 lesson — graduate to Phase C audit pattern

**Internal self-reference grep is mandatory** for method-level audits. The original §1 methodology grep'd `controller/` + `service/smartbi/impl/` excluding `<YourServiceImpl>.java` self — this missed methods called by KEEP methods *within the same impl file*. Sub-E Finance has historical artifact of method chains where `getFinanceOverview` (Dashboard composite) drives helpers via `addAll/.add(getXxx())` style, while sister sub-batches (Sales / Department / Region per chat5 Sub-D) had less interdependence and didn't surface this gap.

**Corrected methodology** (v3): for each candidate DELETE method, run BOTH grep patterns:
1. `grep -rn "\.${method}(" backend/java/cretas-api/src/main/java/` (external + internal, no exclusion)
2. Specifically inspect `<YourServiceImpl>.java` for any internal callers, decide A (reclassify KEEP) or B (remove internal call from KEEP method)

⚠️ **Per dispatch ⚠️ note + spec §C.1.2**: `FinanceAnalysisServiceImpl` injects `GoldDashboardBuilder` + `GoldFinanceClient` (Phase A audit §4.3) and serves `/dashboard/executive*` composite **for all 75 factories on Java**. Most methods that participate in that Gold-layer chain or in the alive `/query` rule-engine path **must KEEP**.

**Removal scope (Sub-E this PR — v3)**:
- Impl methods: 10 `public` methods (with `@Override`) + their `@Transactional` annotations + private helper chase
- Interface declarations: 10 entries (mirrors impl)
- Tests: 0 `@Test void` methods removed (the 2 `getProfitTrendChart_*` tests STAY, since `getProfitTrendChart` reclassified KEEP)
- LOC delta estimate: ~700 LOC removed from impl + ~70 LOC from interface = **~770 LOC removed**

**Deferred to Sub-L (dead-chain via `getComprehensiveAnalysis`)**:
- `getReceivableAgingChart` — sole external caller is `SmartBIServiceImpl:604` (`getComprehensiveAnalysis` finance branch). Cannot delete in Sub-E without breaking compile of `getComprehensiveAnalysis`. Sub-L removes `getComprehensiveAnalysis` first → `getReceivableAgingChart` becomes pure zero-caller → delete in Sub-L round 2.

**KEEP rationale (6 methods)**:
1. `getFinanceOverview` — `SmartBIDashboardController:538` (direct) + `SmartBIServiceImpl:1579` (`processQuery` QUERY_FINANCE_OVERVIEW)
2. `getProfitMetrics` — `SmartBIAnalysisController:364` (alive `/query` NL helper) + `SmartBIServiceImpl:1582` (`processQuery` QUERY_PROFIT_ANALYSIS)
3. `getCostStructureChart` — `SmartBIServiceImpl:1585` (`processQuery` QUERY_COST_ANALYSIS)
4. `getReceivableMetrics` — `SmartBIServiceImpl:1588` (`processQuery` QUERY_RECEIVABLE)
5. **`getProfitTrendChart`** — `getFinanceOverview:157` internal call (Dashboard chartList composite) **[v3 reclassified DELETE → KEEP]**
6. **`getOverdueCustomerRanking`** — `getFinanceOverview:166` internal call (Dashboard rankings composite) **[v3 reclassified DELETE → KEEP]**

Cascade safety check: neither newly-KEEP method (`getProfitTrendChart` / `getOverdueCustomerRanking`) calls any of the OTHER 10 DELETE methods. Verified via `sed -n 'X,Yp' | grep -oE '[a-zA-Z]+\('` on each method body — only private helpers + repo methods + Java stdlib called.

**Risks**: see §5. Lowest-risk per Phase A R-6 (Spring component scan break = NONE) since the class file stays alive with 6 KEEP'd methods.

---

## §1 Methodology (per MO §2.3 + spec §C.1.3)

1. **Enumerate public methods** in `FinanceAnalysisServiceImpl.java` via `grep -nE '^\s*(public|@Override\s+public)'` — found **17 public methods** (line 53 class declaration excluded).
2. **For each method**, grep callers across the **entire main-source tree** (excluding self file + interface file). Pattern: `grep -rn "\.${method}(" backend/java/cretas-api/src/main/java/`.
3. **Classify each call site** as:
   - **DASHBOARD_COMPOSITE**: caller in `SmartBIDashboardController` direct OR `SmartBIServiceImpl::getDashboardOverview` (Dashboard's `processDashboardOverview` facade route, line 600-604) OR `SmartBIServiceImpl::getExecutiveDashboard` (line ~140-220)
   - **NL_QUERY_PATH**: caller in `SmartBIServiceImpl::executeQueryByIntent` (alive `/query` facade dispatch, line 1578-1588) OR `SmartBIAnalysisController::executeQueryByIntent` (controller-side NL response helper, line 275-) OR `SmartBIAnalysisController::generateFinanceQueryResponse` (line 363, called by `executeQueryByIntent` line 300)
   - **GOLD_CHAIN**: indirect via `GoldDashboardBuilder` / `GoldFinanceClient` round-trip (Phase A §4.3 — KEEP forever per task #24)
   - **STUBBED_BY_SUB_A**: only caller was a `getFinanceAnalysis` / `getReceivableAnalysis` / `getPayableAnalysis` / `getBudgetAnalysis` / `getBudgetAchievementChart` / `getYoYMoMComparisonChart` / `getCategoryStructureComparisonChart` endpoint method **whose body was removed by Sub-A PR #236**.
   - **OTHER_DEAD**: 0 callers anywhere in main-source tree.
4. **Spec §C.1.3 classification rule**:
   - 0 callers in KEEP'd controllers AND 0 external callers in main-source → **method dead, removable**
   - ≥1 caller in any KEEP'd controller OR external main-source caller → **method stays**
5. **Rule of thumb for this audit**: any of {DASHBOARD_COMPOSITE, NL_QUERY_PATH, GOLD_CHAIN} → **KEEP**. STUBBED_BY_SUB_A or OTHER_DEAD with no other path → **DELETE**.

### §1.1 False positives encountered (filtered out)

- `ArApController.java:278` matched `getFinanceOverview` via grep but is `arApService.getFinanceOverview(factoryId)` — **different service, different signature** (single arg). FALSE POSITIVE. Not counted as caller.

### §1.2 KEEP'd controllers list (per spec §C.1.2 + post-PR #222)

- `SmartBIDashboardController.java` — alive (executive composite + KEEP_FOR_COMPOSITE_DASHBOARD endpoints)
- `SmartBIAnalysisController.java` — alive only for NOT_SAFE_FALLTHROUGH endpoints (`/analysis/production`, `/analysis/quality`, `/query`, `/drill-down`) per audit §3.1.a; the 22 stubbed `@*Mapping` methods were removed by Sub-A
- `SmartBIConfigController.java` — alive (config CRUD)
- `SmartBIUploadController.java` — alive (upload + schema)
- ~~`SmartBIPublicDemoController.java`~~ — **DELETED 2026-05-09** by PR #222 (Phase 2C Tier 4 sunset). Not a caller anymore.

---

## §2 Method-by-method classification table

### §2.1 Method enumeration (17 public methods)

| # | Java line | Method signature | Output type |
|---|---:|---|---|
| 1 | 112 | `getFinanceOverview(factoryId, startDate, endDate)` | `DashboardResponse` |
| 2 | 220 | `getProfitTrendChart(factoryId, startDate, endDate, period)` | `ChartConfig` |
| 3 | 352 | `getProfitMetrics(factoryId, startDate, endDate)` | `List<MetricResult>` |
| 4 | 500 | `getCostStructureChart(factoryId, startDate, endDate)` | `ChartConfig` |
| 5 | 543 | `getCostTrendChart(factoryId, startDate, endDate, period)` | `ChartConfig` |
| 6 | 586 | `getReceivableAgingChart(factoryId, date)` | `ChartConfig` |
| 7 | 627 | `getReceivableMetrics(factoryId, date)` | `List<MetricResult>` |
| 8 | 734 | `getOverdueCustomerRanking(factoryId, date)` | `List<RankingItem>` |
| 9 | 786 | `getReceivableTrendChart(factoryId, startDate, endDate)` | `ChartConfig` |
| 10 | 832 | `getPayableAgingChart(factoryId, date)` | `ChartConfig` |
| 11 | 870 | `getPayableMetrics(factoryId, date)` | `List<MetricResult>` |
| 12 | 923 | `getBudgetExecutionWaterfall(factoryId, year)` | `ChartConfig` |
| 13 | 982 | `getBudgetVsActualChart(factoryId, startDate, endDate)` | `ChartConfig` |
| 14 | 1031 | `getBudgetMetrics(factoryId, year, month)` | `List<MetricResult>` |
| 15 | 1121 | `getBudgetAchievementChart(factoryId, year, metric)` | `ChartConfig` |
| 16 | 1200 | `getYoYMoMComparisonChart(factoryId, periodType, startPeriod, endPeriod, metric)` | `ChartConfig` |
| 17 | 1259 | `getCategoryStructureComparisonChart(factoryId, year, compareYear)` | `ChartConfig` |

### §2.2 Caller grep results (raw)

```bash
grep -rn "\.${method}(" backend/java/cretas-api/src/main/java/ \
  | grep -v "FinanceAnalysisServiceImpl.java\|FinanceAnalysisService.java"
```

| Method | All callers (external + internal) | Status |
|---|---|---|
| `getFinanceOverview` | Dashboard:538 (alive direct) + SmartBIServiceImpl:1579 (alive `processQuery` QUERY_FINANCE_OVERVIEW) + ~~SmartBIServiceImpl:601 (dead-chain getComprehensiveAnalysis)~~ | **KEEP** (2 alive) |
| **`getProfitTrendChart`** | **`FinanceAnalysisServiceImpl:157` (internal call from `getFinanceOverview` Dashboard chartList composite)** + Tests:192,230 | **KEEP (v3 reclassified)** |
| `getProfitMetrics` | SmartBIAnalysisController:364 (alive `/query` NL helper) + SmartBIServiceImpl:1582 (alive `processQuery` QUERY_PROFIT_ANALYSIS) + ~~SmartBIServiceImpl:602 (dead-chain)~~ + 2 KEEP tests | **KEEP** (2 alive) |
| `getCostStructureChart` | SmartBIServiceImpl:1585 (alive `processQuery` QUERY_COST_ANALYSIS) + ~~SmartBIServiceImpl:603 (dead-chain)~~ + 1 KEEP test | **KEEP** (1 alive) |
| `getCostTrendChart` | (none) | **DELETE** (pure zero-caller) |
| `getReceivableAgingChart` | ~~SmartBIServiceImpl:604 (dead-chain getComprehensiveAnalysis)~~ — sole caller | **DEFER to Sub-L** (dead-chain) |
| `getReceivableMetrics` | SmartBIServiceImpl:1588 (alive `processQuery` QUERY_RECEIVABLE) | **KEEP** (1 alive) |
| **`getOverdueCustomerRanking`** | **`FinanceAnalysisServiceImpl:166` (internal call from `getFinanceOverview` Dashboard rankings composite)** | **KEEP (v3 reclassified)** |
| `getReceivableTrendChart` | (none) | **DELETE** (pure zero-caller) |
| `getPayableAgingChart` | (none) | **DELETE** (pure zero-caller) |
| `getPayableMetrics` | (none) | **DELETE** (pure zero-caller) |
| `getBudgetExecutionWaterfall` | (none) | **DELETE** (pure zero-caller) |
| `getBudgetVsActualChart` | (none) | **DELETE** (pure zero-caller) |
| `getBudgetMetrics` | (none) | **DELETE** (pure zero-caller) |
| `getBudgetAchievementChart` | (none) | **DELETE** (pure zero-caller) |
| `getYoYMoMComparisonChart` | (none) | **DELETE** (pure zero-caller) |
| `getCategoryStructureComparisonChart` | (none) | **DELETE** (pure zero-caller) |

**Result (v3)**: 6 KEEP / 1 DEFER to Sub-L / 10 DELETE in this Sub-E.

### §2.2.1 Internal-reference verification (post-v2 mvn FAIL → v3 fix)

```bash
# Per v3 corrected methodology: include self file in grep
for m in <12 v2-DELETE candidates>; do
    grep -n "\b${m}(" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java
done
```

Findings: 2 methods have internal callers within `FinanceAnalysisServiceImpl` itself:
- `getProfitTrendChart` — line 157 (inside `getFinanceOverview`)
- `getOverdueCustomerRanking` — line 166 (inside `getFinanceOverview`)

Decision: **Option A (reclassify KEEP)** for both, since `getFinanceOverview` Dashboard composite genuinely needs:
- profit trend chart in `chartList` (one of 3 charts shown to customers — alongside `getCostStructureChart` + `getReceivableAgingChart`)
- overdue customer ranking in `rankings` map (the only ranking shown — drives `aiInsights` + `suggestions` downstream via `generateFinanceInsights` and `generateFinanceSuggestions`)

Removing these calls (Option B) would:
- Drop visible Dashboard content for all 75 factories — UX regression
- Break `aiInsights` / `suggestions` generation logic that consumes `overdueRankings`

Option A is correct. Sub-E delete count revised 12 → 10.

### §2.3 KEEP justification detail

| Method | Path 1 (Dashboard) | Path 2 (NL Query) | Path 3 (Direct controller) |
|---|---|---|---|
| `getFinanceOverview` | ✅ `SmartBIServiceImpl::getDashboardOverview` finance branch (line 601) → reachable from `SmartBIDashboardController::getDashboardOverview*` | ✅ `SmartBIServiceImpl::executeQueryByIntent` QUERY_FINANCE_OVERVIEW case (line 1579) | ✅ `SmartBIDashboardController:538` direct call (executive composite) |
| `getProfitMetrics` | ✅ Same as above (line 602) | ✅ Same as above QUERY_PROFIT_ANALYSIS (line 1582) | ✅ `SmartBIAnalysisController::generateFinanceQueryResponse` (line 364, called by `executeQueryByIntent` line 300, called by `/query` POST line 184) |
| `getCostStructureChart` | ✅ Same as above (line 603) | ✅ Same as above QUERY_COST_ANALYSIS (line 1585) | — |
| `getReceivableAgingChart` | ✅ Same as above (line 604) | — | — |
| `getReceivableMetrics` | — | ✅ QUERY_RECEIVABLE case (line 1588) | — |

### §2.4 DELETE justification detail

All 12 DELETE methods have **0 external callers** in main source. Their only previous callers were `getFinanceAnalysis` / `getReceivableAnalysis` / `getPayableAnalysis` / `getBudgetAnalysis` / `getBudgetAchievementChart` / `getYoYMoMComparisonChart` / `getCategoryStructureComparisonChart` `@*Mapping` endpoints in `SmartBIAnalysisController.java` — **all of which were stubbed out and method bodies removed by Sub-A PR #236** (per §1.1.a 22-endpoint stub-out scope).

### §2.5 Test method classification

`backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImplTest.java` (5 `@Test` methods total):

| Test method | Java line | Covers method | Classification |
|---|---:|---|---|
| `getProfitMetrics_negativeCostFromExcel_isAbsolutized` | 86 | `getProfitMetrics` | **KEEP** |
| `getProfitMetrics_grossMarginAbove100_isCappedToNull` | 121 | `getProfitMetrics` | **KEEP** |
| `getCostStructureChart_negativeComponents_areAbsolutized` | 154 | `getCostStructureChart` | **KEEP** |
| `getProfitTrendChart_grossMarginOutOfRange_isCappedToNull` | 177 | `getProfitTrendChart` | **DELETE** |
| `getProfitTrendChart_normalGrossMargin_unchanged` | 218 | `getProfitTrendChart` | **DELETE** |

Per spec §C.2 mirroring rule: 2 test methods removed (mirroring `getProfitTrendChart` impl removal).

### §2.6 Interface (FinanceAnalysisService.java) declarations

12 interface declaration lines to remove (mirroring impl):
- Line 96 `getProfitTrendChart`
- Line 145 `getCostTrendChart`
- Line 191 `getOverdueCustomerRanking`
- Line 203 `getReceivableTrendChart`
- Line 217 `getPayableAgingChart`
- Line 230 `getPayableMetrics`
- Line 244 `getBudgetExecutionWaterfall`
- Line 256 `getBudgetVsActualChart`
- Line 272 `getBudgetMetrics`
- Line 293 `getBudgetAchievementChart`
- Line 330-336 `getYoYMoMComparisonChart` (multi-line param list)
- Line 352-356 `getCategoryStructureComparisonChart` (multi-line param list)

Plus their associated Javadoc blocks above each declaration.

### §2.7 Private helper chase plan (Step 4 of §C.1.3)

After removing the 12 public methods, grep for `private.*<helper>(` calls to chase down dead helpers. Candidate helper categories likely orphaned post-removal:

- Trend chart aggregation helpers used only by `getProfitTrendChart` / `getCostTrendChart` / `getReceivableTrendChart`
- Overdue computation helpers used only by `getOverdueCustomerRanking`
- Payable / Budget specific helpers
- YoY-MoM period iteration helpers
- Category comparison helpers

**Concrete chase-down protocol** (executed in deletion commit):
1. After deleting public methods, run `mvn clean compile -DskipTests`. Spring Boot Java compiler will fail on unused private methods only if `-Werror` is set (likely not). Instead, IDE warnings or manual grep needed.
2. For each `private` method in the impl file that exists post-deletion, grep its name within the file. If 0 callers remain, it's an orphan. Remove.
3. Repeat once (transitive closure): a 2nd-tier helper called only by 1st-tier helpers (now removed) is also orphan.
4. **Defensive**: if uncertain whether a helper supports KEEP'd or DELETE'd methods, leave it. False positive (keeping a dead helper) is a no-op cost; false negative (removing an alive helper) breaks compile.

**Estimate**: ~10-30 private helpers removable transitively. Will be reported in the deletion commit's PR description (not this audit).

---

## §3 Removal plan (deletion commit, Step 2.5 of MO)

### §3.1 Files modified

```
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/
├── FinanceAnalysisService.java                     # interface — 12 method declarations removed
└── impl/FinanceAnalysisServiceImpl.java            # impl — 12 public methods removed + private helper chase

backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/
└── FinanceAnalysisServiceImplTest.java             # 2 test methods removed

docs/qa-audits/
└── 2026-05-10-t6-5-phase-c-sub-e-finance-audit.md  # this audit doc (separate first commit)
```

### §3.2 Estimated diff stats

- Impl: **~1100 LOC** removed (12 public methods × avg ~80 LOC each + Javadoc + private helpers)
- Interface: **~80 LOC** removed (12 declarations + Javadoc per spec template)
- Tests: **~80 LOC** removed (2 `@Test` methods avg ~40 LOC each)
- Audit doc: ~330 LOC added (this file)
- **Net delta**: ≈ −1260 LOC source / +330 LOC docs / **−930 LOC** total

### §3.3 Pre-flight gate (MO §2.2)

⚠️ **Steve will run** `mvn clean compile -DskipTests` + `mvn clean test -DskipTests=false` at base `origin/main` HEAD `99772213aa` BEFORE I edit anything (per Tier 4 sunset workflow precedent — Steve runs mvn since `mvn` not on this dev box's PATH, no `mvnw` wrapper).

Same gate applied post-edit (MO §2.6) to validate compile + remaining tests pass.

### §3.4 Test count delta (per MO §2.7 expectations)

- Pre-flight `mvn test`: baseline N tests pass.
- Post-edit: N − 2 tests pass (2 `getProfitTrendChart` tests removed). All remaining tests for KEEP'd methods (`getProfitMetrics` ×2, `getCostStructureChart` ×1, plus any non-Finance tests) must stay green.

### §3.5 Method-orphan grep verification (post-edit, MO §2.6)

```bash
for method in \
    getProfitTrendChart getCostTrendChart \
    getOverdueCustomerRanking getReceivableTrendChart \
    getPayableAgingChart getPayableMetrics \
    getBudgetExecutionWaterfall getBudgetVsActualChart getBudgetMetrics \
    getBudgetAchievementChart getYoYMoMComparisonChart \
    getCategoryStructureComparisonChart; do
    hits=$(grep -rnE "\.${method}\(" backend/java/cretas-api/src/main/java/ | wc -l)
    [ "$hits" -eq 0 ] || { echo "FAIL: $method still has $hits caller(s)"; exit 1; }
done
```

Expected: 0 hits per method.

---

## §4 KEEP rationale chain visualization

```
SmartBIDashboardController                      SmartBIAnalysisController
    │                                                  │
    ├─ /dashboard/* (alive)                            ├─ /analysis/production (NOT_SAFE)
    ├─ /dashboard/executive (alive)                    ├─ /analysis/quality (NOT_SAFE)
    ├─ getFinanceOverview() ─► [KEEP #1]               ├─ /query (NOT_SAFE) ─┐
    │                                                  │                     │
    │                                                  ├─ /drill-down (NOT_SAFE)
    │                                                  │                     │
    └─ via composite path ──► SmartBIServiceImpl ◄─────┘                     │
                                  │                                          │
                                  ├─ getDashboardOverview                    │
                                  │   ├─ finance branch (line 600-604)       │
                                  │   │   ├─ getFinanceOverview() ──► [KEEP #1]
                                  │   │   ├─ getProfitMetrics() ────► [KEEP #3]
                                  │   │   ├─ getCostStructureChart() ► [KEEP #4]
                                  │   │   └─ getReceivableAgingChart() ► [KEEP #6]
                                  │   └─ (other branches don't touch finance)
                                  │                                          │
                                  ├─ executeQueryByIntent ◄──────────────────┘
                                  │   ├─ QUERY_FINANCE_OVERVIEW (line 1579) ► [KEEP #1]
                                  │   ├─ QUERY_PROFIT_ANALYSIS (line 1582) ► [KEEP #3]
                                  │   ├─ QUERY_COST_ANALYSIS (line 1585) ──► [KEEP #4]
                                  │   ├─ QUERY_RECEIVABLE (line 1588) ─────► [KEEP #7]
                                  │   └─ (other intents don't touch finance)
                                  │
                                  └─ getExecutiveDashboard (Gold-primary path)
                                      └─ goldDashboardBuilder ──► getFinanceOverview() ► [KEEP #1]
                                                                    (when Gold-empty fallback per Pattern B)
```

`SmartBIAnalysisController.executeQueryByIntent` (line 275) → `generateFinanceQueryResponse` (line 363) → `getProfitMetrics` (line 364) — separate inline NL response generator independent of `SmartBIServiceImpl::executeQueryByIntent`.

---

## §5 Risk register

| ID | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| R-1 | Misclassified DELETE method (silent caller missed by grep) | HIGH | LOW | §1.1 false-positive filter; mvn compile post-edit catches any reflection / Spring AOP / `@Autowired by name` references; grep also includes test sources to cover indirect callers |
| R-2 | Private helper chase removes a helper still used by KEEP'd public method | HIGH | MED | Defensive rule §2.7.4 — leave uncertain helpers; false positive (keep dead helper) is a no-op cost. mvn compile catches false negatives. |
| R-3 | Test removal breaks a `@SpringBootTest` context (e.g. autowire mismatch on `FinanceAnalysisService` interface) | LOW | LOW | Interface keeps 5 KEEP'd methods. Existing tests wire the impl as a bean — bean still registers since class file stays. Both Spring context init and Mockito wiring unaffected. |
| R-4 | A non-Finance test indirectly references one of the 12 deleted method names via `@MockBean` setup | LOW | LOW | Grep scope already includes test tree. Confirm during `mvn clean test` post-edit. |
| R-5 | Spring component scan break (entire impl class becomes unused) | NONE | NONE | 5 KEEP'd public methods keep impl class active. Per Phase A R-6. |
| R-6 | Reflection / AOP / `@Cacheable` / `@Scheduled` annotations on dead methods invoke them | LOW | LOW | Sample-checked: methods are vanilla `@Override @Transactional(readOnly = true)`. No reflection markers. Verified by visual inspection of impl file. |
| R-7 | `FinanceAnalysisServiceImplTest.java` has shared `@Setup` fixtures referencing deleted methods | LOW | LOW | Pre-edit visual inspection: all 5 tests are independent `@Test` methods, no `@BeforeEach` referencing the 2 doomed tests. |
| R-8 | Sister sub-batch (Sub-B / Sub-C / Sub-D) running in parallel touches the same file via shared base class / interface | NONE | NONE | Each sub-batch's `*ServiceImpl.java` is independent. No cross-file edit collision per MO §2.1 worktree isolation. |
| R-9 | `GoldDashboardBuilder` / `GoldFinanceClient` indirectly reference dead methods via reflection | NONE | NONE | Phase A audit §4.3 traced these — they call only `getFinanceOverview` (KEEP #1). No dynamic reference to the 12 dead methods. |
| R-10 | Deleted method names re-appear in unrelated Phase 2A Python `analysis_finance.py` mirror | NONE | NONE | T6.4 cutover routes `/analysis/finance` to Python for all 75 customer factories. Python impl already mirrors only the alive Dashboard composite path (`getFinanceOverview` + `getProfitMetrics` + `getCostStructureChart` + `getReceivableAgingChart`). The 12 deleted Java methods have NO Python sister to break. |

---

## §6 Recommendation

### **DELETE 12 methods + 2 tests + 12 interface declarations** — confidence HIGH

**Rationale**:
- 5 KEEP methods cover the full DASHBOARD_COMPOSITE + NL_QUERY_PATH alive surface
- 12 DELETE methods are confirmed orphaned post-Sub-A merge (PR #236) — their controller endpoints were stubbed and method bodies removed
- Risk profile dominantly NONE/LOW per §5
- Test removal symmetric (mirroring rule §C.2)
- Class file stays, interface stays, Spring bean still registers — no architectural disruption

### Out of scope for this Sub-E (file separately if needed)

- Deleting `FinanceAnalysisServiceImpl.java` class file: **NEVER** (KEEP per spec §C.1.2 — class shared with Dashboard)
- Deleting `FinanceAnalysisService.java` interface file: **NEVER** (5 declarations remain)
- Deleting `FinanceAnalysisServiceImplTest.java` test file: **NEVER** (3 KEEP tests remain)
- `GoldDashboardBuilder` / `GoldFinanceClient` deletion: **NEVER** (KEEP forever per task #24 / PR #178 §4.3)
- Other sister sub-batches (B/C/D/F/G/H/I): independent dispatches, separate worktrees, separate PRs

---

## §7 Implementation sequence (this PR)

1. ✅ **Commit 1 (this audit doc)**: `audit(t6-5-phase-c-sub-e): FinanceAnalysisServiceImpl method-level inventory (5 KEEP / 12 DELETE)` — first commit on branch `ops-t6-5-phase-c-sub-e-finance`.
2. ⏸ **STOP-and-ping Steve** — request audit review + GO before any source delete (per MO §2.4).
3. ⏳ **Commit 2 (after Steve GO)**: `feat(t6-5-phase-c-sub-e): FinanceAnalysisServiceImpl dead method delete (12 methods + private helpers + 2 tests + interface decls)` — separate commit covering the actual source delete.
4. ⏸ **STOP-and-ping Steve** — share final diff stats + audit URL + post-edit mvn verify request.
5. ⏳ **Push + open PR** with combined title `feat(t6-5-phase-c-sub-e): FinanceAnalysisServiceImpl dead method delete (Sub-E)` after Steve GO.

---

## §8 References

- PR #150 — T6.5 Java SmartBI deprecation spec (§C.1.3 worked example)
- PR #178 — T6.5 Phase A audit v3.1 (§3.2.a service shared list, §4.3 Gold layer)
- PR #213 — T6.5 Phase B 23-endpoint stub (predecessor that established the orphan condition for these 12 methods)
- PR #227 — T6.5 Phase C method-level audit + delete marching order draft (this Sub-E follows §2.3-§2.9)
- PR #236 — T6.5 Phase C Sub-A: 23 controller method body delete (immediate predecessor — created the dead-method condition for Sub-E)
- PR #222 — Phase 2C Tier 4: SmartBIPublicDemoController sunset (concurrent — removed 1 KEEP'd controller from §1.2 scope)
- Java sources:
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/FinanceAnalysisService.java` (interface, 357 LOC)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java` (impl, 2115 LOC)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java` (facade — alive callers: lines 600-604 + 1578-1588 + getExecutiveDashboard chain)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java` (alive direct caller line 538)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java` (alive caller via `/query` → `executeQueryByIntent` → `generateFinanceQueryResponse` line 363-364)
- Tests: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImplTest.java` (5 tests, 2 to delete)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
