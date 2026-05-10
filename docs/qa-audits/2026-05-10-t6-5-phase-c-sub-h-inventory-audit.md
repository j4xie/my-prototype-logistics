# T6.5 Phase C Sub-H — `InventoryHealthAnalysisServiceImpl` Method-Level Audit

**Date**: 2026-05-10
**Branch**: `ops-t6-5-phase-c-sub-h-inventory`
**Author**: Chat 1 (Sub-H dispatch — round 2 reuse, post Sub-E v3 protocol graduation)
**Predecessor**: PR #236 (Sub-A controller body delete merged), PR #248 (Sub-E v3 audit + 10-method delete merged), PR #150 (T6.5 deprecation spec, §C.1.3 worked example)
**Scope**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/InventoryHealthAnalysisServiceImpl.java` (1352 LOC) + interface (279 LOC)
**Worktree base**: `origin/main` HEAD `571a0b4ddf` (post Sub-E `571a0b4ddf` + post all round-1 sister merges)

---

## §0 TL;DR

**Classification (v3 protocol — internal-self-reference grep MANDATORY per Sub-E lesson)**:
**15 public methods → 10 KEEP / 0 DEFER (Sub-L) / 5 DELETE.**

### KEEP rationale (10 methods)

| # | Method | Path 1 (alive ext) | Path 2 (internal driver) |
|---|---|---|---|
| 1 | `getInventoryHealth` | ✅ `SmartBIDashboardController:542` (Dashboard executive composite) + `SmartBIAnalysisController:403` (alive `/query` NL `generateInventoryQueryResponse`, dispatched from `executeQueryByIntent:312` case `QUERY_INVENTORY_HEALTH`) | (drives 4 internal-only KEEP) |
| 2 | `getInventoryAgingChart` | — | ✅ `getInventoryHealth:106` (chartList composite) |
| 3 | `getExpiryRiskChart` | — | ✅ `getInventoryHealth:107` (chartList composite) |
| 4 | `getExpiringBatchesRanking` | — | ✅ `getInventoryHealth:115` (rankings composite) |
| 5 | `getLongAgingBatchesRanking` | — | ✅ `getInventoryHealth:116` (rankings composite) |
| 6 | `getTurnoverAnalysis` | — | ✅ `getHealthScore:830` + `calculateKpiCards:1031` (private helper called from `getInventoryHealth:101`) |
| 7 | `getExpiryRiskAnalysis` | — | ✅ `getHealthScore:847` + `calculateKpiCards:1040` |
| 8 | `getHealthScore` | — | ✅ `calculateKpiCards:1049` (driven by `getInventoryHealth`) |
| 9 | `getLossAnalysis` | — | ✅ `getHealthScore:866` |
| 10 | `getAgingMetrics` | — | ✅ `getHealthScore:885` |

All 10 KEEP methods chain back to `getInventoryHealth` (the sole external entry point). Removing any internal-only KEEP method would either drop visible Dashboard content (KEEP #2-#5) or break the composite KPI / health-score / radar logic (KEEP #6-#10).

### DELETE rationale (5 methods, pure 0 callers anywhere)

| # | Method | Java line | Interface line | Approx LOC |
|---|---|---:|---:|---:|
| 1 | `getTurnoverTrendChart(factoryId, startDate, endDate, period)` | 207-251 | 125 | ~45 |
| 2 | `getTurnoverByCategory(factoryId, startDate, endDate)` | 255-288 | 135 | ~34 |
| 3 | `getLossReasonChart(factoryId, startDate, endDate)` | 549-618 | 207 | ~70 |
| 4 | `getLossTrendChart(factoryId, startDate, endDate)` | 622-654 | 217 | ~33 |
| 5 | `getHealthRadarChart(factoryId, startDate, endDate)` | 925-998 | 278 | ~74 |

All 5 methods returned `(no external callers)` AND `(no internal calls)` in §2.2 grep. Their prior callers were `@*Mapping` endpoints inside `SmartBIAnalysisController.java` whose method bodies were stubbed out by Sub-A PR #236, leaving these service methods orphaned.

### DEFER to Sub-L

**0 methods**. Unlike Sub-E (where `getReceivableAgingChart` was the sole call site of `SmartBIServiceImpl::getComprehensiveAnalysis` orphan), `SmartBIServiceImpl::getComprehensiveAnalysis` does **not** call any `InventoryHealth*` method (verified §2.3). No dead-chain via getComprehensiveAnalysis exists for inventory. Therefore no Sub-L deferral.

### Tests removed

**0 tests**. There is **no test file** for `InventoryHealthAnalysisServiceImpl` — `find backend/java/cretas-api/src/test -name "InventoryHealth*"` returned 0 hits, and no other test file references any of the 5 DELETE method names (verified via `xargs grep -l` returning exit 123).

### Private helper orphans

**0 private helpers** become orphaned by deleting the 5 DELETE methods. All 12 private helpers in this impl file are exclusively called by KEEP methods (verified §2.4 caller mapping). No transitive orphan cascade.

### Removal scope (Sub-H this PR)

- Impl methods: 5 `public` methods (`@Override` + `@Transactional`) + their Javadoc
- Interface declarations: 5 entries + Javadoc
- Tests: 0 (no test file exists)
- Private helpers: 0 (all stay)
- LOC delta estimate: ~256 LOC removed from impl + ~32 LOC from interface = **~288 LOC removed source** + ~310 LOC docs added

⚠️ **Per dispatch + spec §C.1.2**: `InventoryHealthAnalysisServiceImpl` does **not** inject `GoldDashboardBuilder` / `GoldFinanceClient` (verified — only `MaterialBatchRepository`, `MaterialConsumptionRepository`, `MaterialBatchAdjustmentRepository`, `MetricCalculatorService`). The impl class stays alive with 10 KEEP'd methods; Spring bean registration unaffected.

---

## §1 Methodology (per MO §2.3 + spec §C.1.3 + Sub-E v3 protocol)

### Step 1a — External grep (across full main-source tree)

For each public method `m`:

```bash
grep -rn "\.${m}(" backend/java/cretas-api/src/main/java/ \
  | grep -v "InventoryHealthAnalysisServiceImpl.java\|InventoryHealthAnalysisService.java"
```

This catches:
- Direct calls from `controller/` (`SmartBIDashboardController`, `SmartBIAnalysisController`, etc.)
- Indirect calls from `service/smartbi/impl/SmartBIServiceImpl.java` (facade)
- Sister service callers in `service/smartbi/impl/Other*ServiceImpl.java`

### Step 1b — Internal self-reference grep (mandatory per Sub-E v3 lesson)

```bash
grep -n "\b${m}(" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/InventoryHealthAnalysisServiceImpl.java
```

Filters out the declaration line, keeping caller lines. Catches calls within the impl file itself — including indirect calls via private helpers.

**v3 lesson reminder** (from Sub-E PR #248 §0): if a method has internal callers from KEEP methods (or from private helpers driven by KEEP methods), reclassify DELETE → KEEP via Option A — the KEEP method genuinely needs the helper. Removing internal helpers without this check breaks compile, surfaced as `mvn` FAIL.

### Step 1c — Test source grep

```bash
grep -rn "\.${m}(" backend/java/cretas-api/src/test/java/
```

Catches `@MockBean` setups and direct test invocations.

### Classification rule (per spec §C.1.3)

| Caller status | Decision |
|---|---|
| ≥1 alive external (controller / facade) | **KEEP** (driver entry) |
| 0 external + ≥1 internal from KEEP method | **KEEP** (Option A — helper for KEEP) |
| 0 external + ≥1 internal only from `getComprehensiveAnalysis` (orphan) | **DEFER to Sub-L** |
| 0 callers anywhere | **DELETE** |

### §1.1 KEEP'd controllers list (per spec §C.1.2 + post-PR #222)

- `SmartBIDashboardController.java` — alive (executive composite + KEEP_FOR_COMPOSITE_DASHBOARD endpoints)
- `SmartBIAnalysisController.java` — alive only for NOT_SAFE_FALLTHROUGH endpoints (`/analysis/production`, `/analysis/quality`, `/query`, `/drill-down`); the 22 stubbed `@*Mapping` methods were removed by Sub-A PR #236
- `SmartBIConfigController.java` — alive (config CRUD)
- `SmartBIUploadController.java` — alive (upload + schema)
- ~~`SmartBIPublicDemoController.java`~~ — **DELETED 2026-05-09** by PR #222 (Phase 2C Tier 4 sunset)

---

## §2 Method-by-method classification

### §2.1 Method enumeration (15 public methods)

| # | Java line | Method signature | Output type |
|---|---:|---|---|
| 1 | 89 | `getInventoryHealth(factoryId, startDate, endDate)` | `DashboardResponse` |
| 2 | 141 | `getTurnoverAnalysis(factoryId, startDate, endDate)` | `List<MetricResult>` |
| 3 | 207 | `getTurnoverTrendChart(factoryId, startDate, endDate, period)` | `ChartConfig` |
| 4 | 255 | `getTurnoverByCategory(factoryId, startDate, endDate)` | `List<RankingItem>` |
| 5 | 294 | `getExpiryRiskAnalysis(factoryId)` | `List<MetricResult>` |
| 6 | 375 | `getExpiringBatchesRanking(factoryId, daysToExpiry)` | `List<RankingItem>` |
| 7 | 421 | `getExpiryRiskChart(factoryId)` | `ChartConfig` |
| 8 | 484 | `getLossAnalysis(factoryId, startDate, endDate)` | `List<MetricResult>` |
| 9 | 549 | `getLossReasonChart(factoryId, startDate, endDate)` | `ChartConfig` |
| 10 | 622 | `getLossTrendChart(factoryId, startDate, endDate)` | `ChartConfig` |
| 11 | 660 | `getInventoryAgingChart(factoryId)` | `ChartConfig` |
| 12 | 720 | `getAgingMetrics(factoryId)` | `List<MetricResult>` |
| 13 | 774 | `getLongAgingBatchesRanking(factoryId, minDays)` | `List<RankingItem>` |
| 14 | 824 | `getHealthScore(factoryId, startDate, endDate)` | `MetricResult` |
| 15 | 925 | `getHealthRadarChart(factoryId, startDate, endDate)` | `ChartConfig` |

### §2.2 Caller grep results (raw)

External + internal grep results (raw text of callers, KEEP/DELETE classification right column):

| # | Method | External callers (main src) | Internal callers (impl file self) | Tests | Status |
|---|---|---|---|---|---|
| 1 | `getInventoryHealth` | `SmartBIAnalysisController:403` (alive `/query` NL) + `SmartBIDashboardController:542` (alive Dashboard composite) | (none) | (none) | **KEEP** (2 alive ext) |
| 2 | `getTurnoverAnalysis` | (none) | `getHealthScore:830` + `getHealthRadarChart:934` + `calculateKpiCards:1031` | (none) | **KEEP** (Option A — helper for KEEP) |
| 3 | `getTurnoverTrendChart` | (none) | (none) | (none) | **DELETE** (pure 0-caller) |
| 4 | `getTurnoverByCategory` | (none) | (none) | (none) | **DELETE** (pure 0-caller) |
| 5 | `getExpiryRiskAnalysis` | (none) | `getHealthScore:847` + `getHealthRadarChart:947` + `calculateKpiCards:1040` | (none) | **KEEP** (Option A) |
| 6 | `getExpiringBatchesRanking` | (none) | `getInventoryHealth:115` | (none) | **KEEP** (Option A) |
| 7 | `getExpiryRiskChart` | (none) | `getInventoryHealth:107` | (none) | **KEEP** (Option A) |
| 8 | `getLossAnalysis` | (none) | `getHealthScore:866` + `getHealthRadarChart:960` | (none) | **KEEP** (Option A) |
| 9 | `getLossReasonChart` | (none) | (none) | (none) | **DELETE** (pure 0-caller) |
| 10 | `getLossTrendChart` | (none) | (none) | (none) | **DELETE** (pure 0-caller) |
| 11 | `getInventoryAgingChart` | (none) | `getInventoryHealth:106` | (none) | **KEEP** (Option A) |
| 12 | `getAgingMetrics` | (none) | `getHealthScore:885` + `getHealthRadarChart:973` | (none) | **KEEP** (Option A) |
| 13 | `getLongAgingBatchesRanking` | (none) | `getInventoryHealth:116` | (none) | **KEEP** (Option A) |
| 14 | `getHealthScore` | (none) | `calculateKpiCards:1049` | (none) | **KEEP** (Option A) |
| 15 | `getHealthRadarChart` | (none) | (none) | (none) | **DELETE** (pure 0-caller) |

**Result**: 10 KEEP / 0 DEFER to Sub-L / 5 DELETE.

### §2.3 No `getComprehensiveAnalysis` dead-chain for inventory (DEFER check)

```bash
grep -n "getInventoryHealth\|inventoryHealthAnalysisService\." \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java
```

Result: **0 matches**. `SmartBIServiceImpl::getComprehensiveAnalysis` (line 570 declaration) does not call any inventory analysis method. Inventory is served exclusively via:
- Direct controller invocation (`SmartBIDashboardController:542`)
- Indirect via NL query path (`SmartBIAnalysisController::generateInventoryQueryResponse:403`, dispatched from `executeQueryByIntent:312` case `QUERY_INVENTORY_HEALTH`)

Neither path is dead-chain. No DEFER candidates → **0 methods deferred to Sub-L**.

### §2.4 Private helper caller mapping (orphan-cascade check)

`InventoryHealthAnalysisServiceImpl` declares **12 private helpers** (excluding `@RequiredArgsConstructor`-generated and constants). For each, grep showed callers:

| # | Helper (Java line) | Callers within impl |
|---|---|---|
| 1 | `calculateKpiCards` (1005) | `getInventoryHealth:101` |
| 2 | `calculateTotalInventoryValue` (1058) | `getExpiryRiskAnalysis:317-318` + `getLossAnalysis:491` + `getAgingMetrics:727` + `calculateKpiCards:1010` |
| 3 | `buildMaterialCategoryValueChart` (1068) | `getInventoryHealth:108` |
| 4 | `generateAiInsights` (1107) | `getInventoryHealth:122` |
| 5 | `generateSuggestions` (1182) | `getInventoryHealth:125` |
| 6 | `buildEmptyDashboard` (1222) | `getInventoryHealth:97` |
| 7 | `convertToKPICards` (1241) | `getInventoryHealth:102` |
| 8 | `determineTurnoverAlertLevel` (1294) | `getTurnoverAnalysis:179` |
| 9 | `determineInventoryDaysAlertLevel` (1307) | `getTurnoverAnalysis:193` |
| 10 | `determineExpiryRiskAlertLevel` (1320) | `getExpiryRiskAnalysis:329` |
| 11 | `determineLossRateAlertLevel` (1333) | `getLossAnalysis:536` |
| 12 | `formatCurrency` (1346) | `calculateKpiCards:1015` |

**All 12 callers fall in KEEP method line ranges**. None of the 5 DELETE methods (line ranges: 207-251, 255-288, 549-618, 622-654, 925-998) call any private helper. Therefore deleting the 5 DELETE methods leaves all 12 private helpers with their existing KEEP-driven callers intact. **No private-helper orphan cascade.**

Cross-checked: lines 97/101/102/108/122/125 are inside `getInventoryHealth` (KEEP); 179/193 inside `getTurnoverAnalysis` (KEEP); 317/318/329 inside `getExpiryRiskAnalysis` (KEEP); 491/536 inside `getLossAnalysis` (KEEP); 727 inside `getAgingMetrics` (KEEP); 1010/1015/1031/1040/1049 inside `calculateKpiCards` (private, called from KEEP `getInventoryHealth`).

### §2.5 Test method classification

`find backend/java/cretas-api/src/test -name "InventoryHealth*"` → **0 results**.
`xargs grep -l "InventoryHealthAnalysisService\|getTurnoverTrendChart\|getTurnoverByCategory\|getLossReasonChart\|getLossTrendChart\|getHealthRadarChart" backend/java/cretas-api/src/test/**` → **exit 123 (no matching files)**.

**No test removal needed.** Per spec §C.2 mirroring rule, since 0 tests reference the 5 DELETE methods, 0 tests are removed.

### §2.6 Interface (InventoryHealthAnalysisService.java) declarations to remove

5 interface declaration lines + their associated Javadoc blocks:

| # | Method | Interface line range | Javadoc block above |
|---|---|---:|---|
| 1 | `getTurnoverTrendChart` | 125 (declaration) | 116-124 |
| 2 | `getTurnoverByCategory` | 135 (declaration) | 127-134 |
| 3 | `getLossReasonChart` | 207 (declaration) | 199-206 |
| 4 | `getLossTrendChart` | 217 (declaration) | 209-216 |
| 5 | `getHealthRadarChart` | 278 (declaration) | 270-277 |

Total interface delta: ~32 LOC removed (5 declarations + 5 Javadoc blocks).

### §2.7 No Gold-layer impact (spec §C.1.2 / Phase A §4.3)

`InventoryHealthAnalysisServiceImpl` constructor injects only:
- `MaterialBatchRepository`
- `MaterialConsumptionRepository`
- `MaterialBatchAdjustmentRepository`
- `MetricCalculatorService`

Does **not** inject `GoldDashboardBuilder` or `GoldFinanceClient`. The Gold-layer dispatcher chain (Phase A §4.3) operates only on Finance — Inventory has no Gold path. Therefore Sub-H deletion has zero impact on the Gold-primary read path.

---

## §3 Removal plan (deletion commit, Step 2.5 of MO)

### §3.1 Files modified

```
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/
├── InventoryHealthAnalysisService.java                     # interface — 5 method declarations + Javadoc removed
└── impl/InventoryHealthAnalysisServiceImpl.java            # impl — 5 public methods + @Override + @Transactional + Javadoc removed

docs/qa-audits/
└── 2026-05-10-t6-5-phase-c-sub-h-inventory-audit.md       # this audit doc
```

No test file modifications (no test file exists for this impl).

### §3.2 Estimated diff stats

- Impl: **~256 LOC** removed (5 public methods × avg ~51 LOC each + Javadoc + @Override + @Transactional)
- Interface: **~32 LOC** removed (5 declarations + 5 Javadoc blocks)
- Audit doc: ~310 LOC added (this file)
- **Net delta**: ≈ −288 LOC source / +310 LOC docs / **+22 LOC** total (slight net add due to audit doc)

### §3.3 Pre-flight + post-edit limited gate (MO Step 3 — "Option 3")

```bash
# Pre-flight (at base origin/main HEAD 571a0b4ddf, before edit)
/c/tools/apache-maven-3.9.6/bin/mvn clean compile -DskipTests
/c/tools/apache-maven-3.9.6/bin/mvn package -DskipTests
/c/tools/apache-maven-3.9.6/bin/mvn test -Dtest=SmartBIRestaurantRoutingTest -DskipTests=false

# Post-edit (same 3 commands)
```

All three gates must PASS at both base and post-edit.

### §3.4 Test count delta (post-edit expectations)

- Pre-flight `mvn test -Dtest=SmartBIRestaurantRoutingTest`: baseline N tests pass (restaurant routing test independent of inventory).
- Post-edit: same N tests pass (no inventory test exists — no symmetric removal required).

### §3.5 Method-orphan grep verification (post-edit)

```bash
for method in \
    getTurnoverTrendChart getTurnoverByCategory \
    getLossReasonChart getLossTrendChart \
    getHealthRadarChart; do
    hits=$(grep -rnE "\.${method}\(" backend/java/cretas-api/src/main/java/ | wc -l)
    [ "$hits" -eq 0 ] || { echo "FAIL: $method still has $hits caller(s)"; exit 1; }
done
```

Expected: 0 hits per method.

---

## §4 KEEP rationale chain visualization

```
SmartBIDashboardController                 SmartBIAnalysisController
    │                                            │
    ├─ /dashboard/* (alive)                      ├─ /query (NOT_SAFE_FALLTHROUGH alive)
    ├─ Dashboard executive composite (line 542)  │   └─ executeQueryByIntent:309-312
    │   └─ inventoryHealthAnalysisService        │       case QUERY_INVENTORY_HEALTH
    │       .getInventoryHealth() ─► [KEEP #1]   │       └─ generateInventoryQueryResponse:402-411
    │                                            │           └─ inventoryHealthAnalysisService
    │                                            │               .getInventoryHealth() ─► [KEEP #1]
    │                                            │
    └────────────── KEEP #1 ─────────────────────┘
                        │
                        ├─ getInventoryAgingChart()       ─► [KEEP #2  via line 106]
                        ├─ getExpiryRiskChart()           ─► [KEEP #3  via line 107]
                        ├─ getExpiringBatchesRanking()    ─► [KEEP #4  via line 115]
                        ├─ getLongAgingBatchesRanking()   ─► [KEEP #5  via line 116]
                        ├─ buildMaterialCategoryValueChart()  (private helper line 108)
                        ├─ generateAiInsights()               (private helper line 122)
                        ├─ generateSuggestions()              (private helper line 125)
                        └─ calculateKpiCards()                (private helper line 101)
                              │
                              ├─ getTurnoverAnalysis()       ─► [KEEP #6  via line 1031]
                              ├─ getExpiryRiskAnalysis()     ─► [KEEP #7  via line 1040]
                              └─ getHealthScore()            ─► [KEEP #8  via line 1049]
                                    │
                                    ├─ getTurnoverAnalysis()      [KEEP #6  also via line 830]
                                    ├─ getExpiryRiskAnalysis()    [KEEP #7  also via line 847]
                                    ├─ getLossAnalysis()       ─► [KEEP #9  via line 866]
                                    └─ getAgingMetrics()       ─► [KEEP #10 via line 885]
```

All 10 KEEP methods chain transitively from the single external entry `getInventoryHealth`.

5 DELETE methods (`getTurnoverTrendChart`, `getTurnoverByCategory`, `getLossReasonChart`, `getLossTrendChart`, `getHealthRadarChart`) sit outside this chain — pure orphans.

---

## §5 Risk register

| ID | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| R-1 | Misclassified DELETE method (silent caller missed by grep) | HIGH | LOW | §1.2 v3 internal-self-grep added per Sub-E lesson; mvn compile post-edit catches any reflection / Spring AOP / `@Autowired by name` references |
| R-2 | Private helper chase removes a helper still used by KEEP'd public method | NONE | NONE | §2.4 helper-caller mapping shows all 12 helpers are exclusively driven by KEEP methods; no helper deletion in this PR |
| R-3 | Test removal breaks a `@SpringBootTest` context (autowire mismatch on `InventoryHealthAnalysisService` interface) | NONE | NONE | Interface keeps 10 KEEP'd declarations. Existing dependent tests (e.g. `SmartBIRestaurantRoutingTest`) wire the impl as a bean — bean still registers since class file stays + 10 methods alive |
| R-4 | A non-Inventory test indirectly references one of the 5 deleted method names via `@MockBean` setup | NONE | NONE | `xargs grep -l` returned exit 123 (no matching files in test/) |
| R-5 | Spring component scan break (entire impl class becomes unused) | NONE | NONE | 10 KEEP'd public methods keep impl class active. Per Phase A R-6. |
| R-6 | Reflection / AOP / `@Cacheable` / `@Scheduled` annotations on dead methods invoke them | LOW | LOW | Visual inspection: all 5 DELETE methods are vanilla `@Override @Transactional(readOnly = true)`. No reflection markers, no `@Cacheable`, no `@Scheduled`. |
| R-7 | Sister sub-batch (Sub-B/C/D/E/F/G) merging while Sub-H is in flight touches the same file | NONE | NONE | Round-1 of all 7 sister sub-batches already merged at base `571a0b4ddf`. Sub-H Round-2 worktree-isolated. |
| R-8 | `GoldDashboardBuilder` / `GoldFinanceClient` reference dead methods via reflection | NONE | NONE | §2.7 — Inventory impl does not inject Gold layer. No dynamic dispatch surface to inventory methods. |
| R-9 | Phase 2A Python `analysis_inventory.py` mirror has these 5 methods active | NONE | NONE | T6.4 cutover routes `/analysis/inventory*` to Python for all 75 customer factories. Python `analysis_inventory.py` exposes only the alive Dashboard composite path mirroring `getInventoryHealth`. The 5 deleted Java methods have **no** Python sister to break (they served stubbed-by-Sub-A `@*Mapping` controllers that were never ported). |
| R-10 | `getHealthRadarChart` deletion breaks a frontend chart somewhere | NONE | NONE | Chart was only emitted via stubbed `getHealthRadarChart` `@*Mapping` (per Sub-A scope). Frontend already received 410 / shape-empty fallback post-Sub-A merge for this endpoint. No regression. |

---

## §6 Recommendation

### **DELETE 5 methods + 5 interface declarations + 0 tests + 0 private helpers** — confidence HIGH

**Rationale**:
- 10 KEEP methods cover the full DASHBOARD_COMPOSITE + NL_QUERY_PATH alive surface (`getInventoryHealth` is the sole driver, with 9 internal helper-KEEP methods chained underneath)
- 5 DELETE methods are confirmed orphaned post-Sub-A merge (PR #236) — their controller endpoints were stubbed and method bodies removed
- Risk profile dominantly NONE per §5
- 0 tests to remove (no test file)
- 0 private helpers to remove (all 12 driven by KEEP methods)
- Class file stays, interface stays, Spring bean still registers — no architectural disruption

### Out of scope for this Sub-H (file separately if needed)

- Deleting `InventoryHealthAnalysisServiceImpl.java` class file: **NEVER** (KEEP per spec §C.1.2 — class shared with Dashboard composite)
- Deleting `InventoryHealthAnalysisService.java` interface file: **NEVER** (10 declarations remain)
- `MaterialBatchRepository` / `MaterialConsumptionRepository` / `MaterialBatchAdjustmentRepository` deletion: **NEVER** (KEEP — actively used by 10 KEEP methods)
- `MetricCalculatorService` deletion: **NEVER** (shared with sister analysis services)
- Other sister sub-batches (B/C/D/E/F/G/I/J/K/L): independent dispatches, separate worktrees, separate PRs

---

## §7 Implementation sequence (this PR)

1. ✅ **Audit doc written** — first artifact for this branch.
2. ⏳ **Source delete** — 5 public methods from impl + 5 declarations from interface, single combined commit per MO Step 5 `safe-commit.sh` template.
3. ⏳ **Post-edit limited gate** — mvn clean compile + package + SmartBIRestaurantRoutingTest, all PASS.
4. ⏸ **STOP-and-ping organizer** — share final diff stats + audit URL + post-edit mvn verify request, request GO before push.
5. ⏳ **Push + open PR** with title `feat(t6-5-phase-c-sub-h): InventoryHealthAnalysisServiceImpl dead method delete (Sub-H)` after organizer GO.

---

## §8 References

- PR #150 — T6.5 Java SmartBI deprecation spec (§C.1.3 worked example)
- PR #178 — T6.5 Phase A audit v3.1 (§3.2.a service shared list, §4.3 Gold layer)
- PR #213 — T6.5 Phase B 23-endpoint stub (predecessor that established the orphan condition for these 5 methods)
- PR #227 — T6.5 Phase C method-level audit + delete marching order draft (this Sub-H follows §2.3-§2.9)
- PR #236 — T6.5 Phase C Sub-A: 23 controller method body delete (immediate predecessor — created the dead-method condition for Sub-H)
- PR #248 — T6.5 Phase C Sub-E: FinanceAnalysisServiceImpl 10-method delete (v3 protocol graduation — internal self-reference grep mandatory)
- PR #222 — Phase 2C Tier 4: SmartBIPublicDemoController sunset (concurrent — removed 1 controller from §1.1 scope)
- Java sources:
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/InventoryHealthAnalysisService.java` (interface, 279 LOC pre-edit)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/InventoryHealthAnalysisServiceImpl.java` (impl, 1352 LOC pre-edit)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java` (facade — 0 inventory references; verified §2.3)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java` (alive caller line 542 in Dashboard composite)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java` (alive caller via `/query` → `executeQueryByIntent:312` → `generateInventoryQueryResponse:402-411` → line 403)
- Tests: no `InventoryHealth*` test file exists

🤖 Generated with [Claude Code](https://claude.com/claude-code)
