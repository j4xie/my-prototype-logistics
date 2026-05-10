# T6.5 Phase C Sub-I — `ProcurementAnalysisServiceImpl` Method-Level Audit

**Date**: 2026-05-10
**Author**: Chat 4 (organizer dispatch — Sub-I reuse after Sub-H template, v3 protocol)
**Branch**: `ops-t6-5-phase-c-sub-i-procurement`
**Worktree base**: `origin/main` HEAD = `571a0b4ddf` (post Sub-E merge `571a0b4ddf`, post Phase B PR #205 stub-out + Sub-A controller cleanup PR #236)
**Scope**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ProcurementAnalysisServiceImpl.java` (1144 LOC)
**Per Phase C MO**: `docs/superpowers/dispatch/2026-05-15-t6-5-phase-c-method-level-audit-marching-order.md` §1 + §2.3 + §2.4 + §2.5

⚠️ **`/analysis/procurement` SAFE_NGINX_ROUTED context**: Per PR #178 audit v3.1 row line 121, `getProcurementAnalysis` (`GET /analysis/procurement`) was classified `SAFE_NGINX_ROUTED` — Python-routed for all 75 factories, Java endpoint stubbed to 410 in PR #205 and controller method body deleted in Sub-A PR #236. Java `procurementAnalysisService` retains only **2 alive callers**:

1. `SmartBIDashboardController:554` (composite Dashboard `setProcurement`, KEEP_FOR_COMPOSITE_DASHBOARD per spec §C.1.2)
2. `SmartBIAnalysisController:415` (`generateProcurementQueryResponse` — private NL helper, called from `/query` endpoint, NOT_SAFE_FALLTHROUGH for that surface)

**Both** alive callers invoke ONLY `getProcurementOverview` — none of the other 8 public methods has a single caller anywhere in `backend/java/cretas-api/src/main/`.

---

## 0. TL;DR

| Outcome | Count | Detail |
|---|---|---|
| Public methods enumerated | **9** | `getProcurementOverview` + 8 supporting methods |
| KEEP (alive callers) | **1** | `getProcurementOverview` (Dashboard composite + `/query` NL helper) |
| DELETE candidates | **8** | `getSupplierEvaluation`, `getSupplierDetailMetrics`, `getPurchaseCostAnalysis`, `getCostMetrics`, `getSupplierRanking`, `getMaterialCategoryRanking`, `getProcurementTrendChart`, `getSupplierTrendComparison` — 0 controller / 0 internal-impl / 0 test callers each |
| Private helpers exclusive to dead methods | **5** | `calculatePriceScore`, `calculateDeliveryScore`, `calculateServiceScore`, `calculateStabilityScore`, `determineDeliveryAlertLevel` — all called only from now-dead public methods |
| Test methods to delete | **0** | `find backend/java/cretas-api/src/test -name "ProcurementAnalysis*Test.java"` returns empty — no test file exists |
| Interface declarations to delete | **8** | `ProcurementAnalysisService.java` lines 101 / 112 / 130 / 140 / 160 / 170 / 186 / 197 (the 8 dead method signatures) |

**Estimated source-delete diff**: ~415 LOC removed (8 method bodies ~280 LOC + 5 helper bodies ~85 LOC + 8 interface decls + javadoc ~50 LOC).

**Per spec §C.1.3 pattern**: this is a **"large removable surface"** Sub-I — biggest removal in Phase C so far (~36% of impl file body). Most of the impl was built for the now-stubbed `/analysis/procurement` analysisType branching surface which is fully owned by Python.

---

## 1. Method Inventory + Caller Classification (v3 protocol)

Per MO §2.3 + v3 protocol (internal self-reference grep mandatory) — for each public method, run BOTH:
1. **External caller grep** across `src/main/` excluding the impl file + interface file
2. **Internal self-reference grep** within the impl file (catches intra-Impl callers — none for this Sub-I, but mandatory check)

### 1.1 KEEP (1 method, alive callers)

| # | Method | Impl line | External callers | Internal self-ref | Caller sites |
|---|---|---|---|---|---|
| 1 | `getProcurementOverview(String, LocalDate, LocalDate) → DashboardResponse` | 78 | **2** | 0 | `SmartBIDashboardController:554` (composite `setProcurement` KEEP_FOR_COMPOSITE_DASHBOARD) + `SmartBIAnalysisController:415` (alive `/query` NL `generateProcurementQueryResponse` private helper, branches `QUERY_PROCUREMENT_OVERVIEW` / `QUERY_SUPPLIER_EVALUATION` / `QUERY_PURCHASE_COST` all converge to this single method) |

### 1.2 DELETE (8 methods, 0 callers anywhere)

| # | Method | Impl line | External callers | Internal self-ref | Notes |
|---|---|---|---|---|---|
| 2 | `getSupplierEvaluation(...) → ChartConfig` | 128 | **0** | 0 | Interface decl ref at `ProcurementAnalysisService.java:101`; calls 5 dead helpers (price/quality/delivery/service/stability score) |
| 3 | `getSupplierDetailMetrics(...) → List<MetricResult>` | 191 | **0** | 0 | Interface decl ref at `ProcurementAnalysisService.java:112`; calls quality/delivery score + alert-level helpers |
| 4 | `getPurchaseCostAnalysis(...) → ChartConfig` | 243 | **0** | 0 | Interface decl ref at `ProcurementAnalysisService.java:130`; only uses `getBatchesInDateRange` (SHARED — stays) |
| 5 | `getCostMetrics(...) → List<MetricResult>` | 284 | **0** | 0 | Interface decl ref at `ProcurementAnalysisService.java:140`; uses `calculateAverageUnitPrice` (SHARED — also called from `generateSuggestions:995` KEEP path) + `determineChangeDirection` (SHARED — also `calculateKpiCards:520` KEEP path) |
| 6 | `getSupplierRanking(...) → List<RankingItem>` | 335 | **0** | 0 | Interface decl ref at `ProcurementAnalysisService.java:160`; thin wrapper around `calculateSupplierRankingFromData(batches)` private helper which is ALSO called by KEEP path `getProcurementOverview:104` — so the helper stays |
| 7 | `getMaterialCategoryRanking(...) → List<RankingItem>` | 344 | **0** | 0 | Interface decl ref at `ProcurementAnalysisService.java:170`; only uses `getBatchesInDateRange` (SHARED) |
| 8 | `getProcurementTrendChart(...) → ChartConfig` | 389 | **0** | 0 | Interface decl ref at `ProcurementAnalysisService.java:186`; thin wrapper around `buildProcurementTrendChartFromData(batches, period)` private helper which is ALSO called by KEEP path `getProcurementOverview:96` — so the helper stays |
| 9 | `getSupplierTrendComparison(...) → ChartConfig` | 398 | **0** | 0 | Interface decl ref at `ProcurementAnalysisService.java:197`; uses `calculateTotalValue` (SHARED) |

### 1.3 Verification grep commands (reproducible — v3 protocol)

```bash
WT=.worktrees/t6-5-phase-c-sub-i-procurement
F=$WT/backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ProcurementAnalysisServiceImpl.java

# 1. Public method enumeration
grep -nE "^\s*(public|@Override\s+public)" $F

# 2. Per-method external + internal self-reference caller grep
for m in getProcurementOverview getSupplierEvaluation getSupplierDetailMetrics \
         getPurchaseCostAnalysis getCostMetrics getSupplierRanking \
         getMaterialCategoryRanking getProcurementTrendChart getSupplierTrendComparison; do
  ext=$(grep -rnE "\.${m}\(" $WT/backend/java/cretas-api/src/main/java/ \
        | grep -v "ProcurementAnalysisServiceImpl.java:" \
        | grep -v "ProcurementAnalysisService.java:" \
        | grep -c .)
  internal=$(grep -nE "\.${m}\(|\b${m}\(" $F \
             | grep -v "^[0-9]*:    public " \
             | grep -v "^[0-9]*:public class" \
             | grep -c .)
  echo "$m: ext=$ext internal=$internal"
done

# 3. Test file presence (returns empty — no test file exists)
find $WT/backend/java/cretas-api/src/test -name "ProcurementAnalysis*Test.java"

# 4. Cross-cutting: `procurementAnalysisService.<anything>` total caller scan
grep -rn "procurementAnalysisService\." $WT/backend/java/cretas-api/src/main/java/ \
    | grep -v "ProcurementAnalysisServiceImpl\|ProcurementAnalysisService\.java:"
```

Expected output verbatim:
- `getProcurementOverview: ext=2 internal=0`
- All 8 other methods: `ext=0 internal=0`
- `find` returns no path
- Step 4 returns exactly 2 lines (Dashboard composite + /query NL helper, both invoking only `getProcurementOverview`)

---

## 2. Private Helper Chase-Down (MO §2.5)

Per MO §2.5: "Delete each method classified 'removable', plus its private helpers (chase down `private` methods called only by the now-deleted public method — grep within same file)."

### 2.1 Helpers used ONLY by dead methods (DELETE)

| Helper | Decl line | Total refs | Caller analysis | Action |
|---|---|---|---|---|
| `calculatePriceScore(Supplier, List<MaterialBatch>)` | 595 | 2 (1 decl + 1 call at line 150) | Only call site: `getSupplierEvaluation:150` (DEAD) | **DELETE** |
| `calculateDeliveryScore(Supplier, List<MaterialBatch>)` | 623 | 3 (1 decl + 2 calls at lines 158 + 225) | Both call sites in DEAD methods (`getSupplierEvaluation:158`, `getSupplierDetailMetrics:225`) | **DELETE** |
| `calculateServiceScore(Supplier)` | 637 | 2 (1 decl + 1 call at line 162) | Only call site: `getSupplierEvaluation:162` (DEAD) | **DELETE** |
| `calculateStabilityScore(List<MaterialBatch>)` | 648 | 2 (1 decl + 1 call at line 166) | Only call site: `getSupplierEvaluation:166` (DEAD) | **DELETE** |
| `determineDeliveryAlertLevel(BigDecimal)` | 1083 | 2 (1 decl + 1 call at line 227) | Only call site: `getSupplierDetailMetrics:227` (DEAD) | **DELETE** |

### 2.2 Helpers SHARED with KEEP paths (STAY)

| Helper | Decl line | KEEP-path caller(s) | Action |
|---|---|---|---|
| `getBatchesInDateRange` | 451 | `getProcurementOverview:82` + 5 KEEP-path internal callers | **STAY** |
| `calculateKpiCards` | 462 | `getProcurementOverview:90` | **STAY** |
| `calculateTotalValue` | 540 | `calculateKpiCards:467` (KEEP chain) + `generateAiInsights` + multiple | **STAY** |
| `calculateAverageUnitPrice` | 550 | `generateSuggestions:995` (KEEP path via `getProcurementOverview:111`) | **STAY** (also used by DEAD `getCostMetrics:298` but KEEP-path keeps it alive) |
| `calculateSupplierConcentration` | 568 | `calculateKpiCards:500` (KEEP path) | **STAY** |
| `calculateQualityScore` | 606 | `calculateSupplierRankingFromData:726` (KEEP via `getProcurementOverview:104`) | **STAY** (also used by 2 DEAD method call sites) |
| `calculateSupplierRankingFromData` | 684 | `getProcurementOverview:104` | **STAY** |
| `buildProcurementTrendChartFromData` | 744 | `getProcurementOverview:96` | **STAY** |
| `aggregateByDay` / `aggregateByWeek` / `aggregateByMonth` | 787 / 802 / 821 | Chained from `buildProcurementTrendChartFromData` (KEEP) | **STAY** |
| `buildSupplierPieChart` | 837 | `getProcurementOverview:97` | **STAY** |
| `buildMaterialCategoryChart` | 877 | `getProcurementOverview:98` | **STAY** |
| `generateAiInsights` | 914 | `getProcurementOverview:108` | **STAY** |
| `generateSuggestions` | 980 | `getProcurementOverview:111` | **STAY** |
| `buildEmptyDashboard` | 1011 | `getProcurementOverview:87` | **STAY** |
| `convertToKPICards` | 1030 | `getProcurementOverview:91` | **STAY** |
| `determineQualityAlertLevel` | 1096 | `calculateSupplierRankingFromData:734` (KEEP) | **STAY** (also used by DEAD `getSupplierDetailMetrics:222`) |
| `determineConcentrationAlertLevel` | 1109 | `calculateKpiCards` chain (KEEP) | **STAY** |
| `determineChangeDirection` | 1122 | `calculateKpiCards:520` (KEEP) | **STAY** (also used by DEAD `getCostMetrics:325`) |
| `formatCurrency` | 1138 | `calculateKpiCards` (KEEP) + `generateAiInsights` (KEEP) | **STAY** |

### 2.3 Result: 5 helper deletions in this Sub-I

Source-side removal scope:
- **8 public method bodies** in `ProcurementAnalysisServiceImpl.java` (lines 128-187, 191-238, 243-280, 284-331, 335-342, 344-385, 389-395, 398-444) including `@Override` + `@Transactional(readOnly = true)` + javadoc/comment block above each
- **5 private helpers** (lines 595-604, 623-636, 637-647, 648-683, 1083-1095)
- **8 interface declarations** in `ProcurementAnalysisService.java` (lines 101, 112, 130, 140, 160, 170, 186, 197) including their javadoc
- **0 test methods** (no test file exists for this Impl)
- **Section comment cleanup** (organizer discretion):
  - line 124 `// ==================== 供应商评估 ====================` (entire section becomes empty if both methods removed)
  - line 240 `// ==================== 采购成本分析 ====================` (entire section empty)
  - line 333 `// ==================== 供应商排名 ====================` (entire section empty)
  - line 387 `// ==================== 趋势分析 ====================` (entire section empty)
- **0 imports** (Impl uses many shared imports; no import becomes unused after the 8 method + 5 helper removal — all referenced types like `Supplier`, `MetricResult`, `RankingItem`, `ChartConfig`, `MaterialBatch` remain in use by KEEP path)

---

## 3. Pre-flight Build Gate Status

Per MO §2.2 — **NOT YET RUN** in this audit-only commit (audit doc commit is documentation-only, not source edit).

**Required BEFORE source-delete commit** (Step 2.5 of MO):

```bash
cd backend/java/cretas-api
mvn clean compile -DskipTests          # MUST pass — pre-edit baseline
mvn clean test -DskipTests=false       # MUST pass — record green test count
```

Steve / next-step chat must run + record baseline test count + log it in source-delete PR description.

---

## 4. Proposed Source-Delete Plan (FOR ORGANIZER GO ONLY — DO NOT EXECUTE FROM THIS PR)

Per MO §2.4 ⛔ STOP-and-ping — this audit-only PR is the gate; source delete happens in a separate commit on this same branch AFTER organizer GO.

### 4.1 Files modified

```
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/ProcurementAnalysisService.java
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ProcurementAnalysisServiceImpl.java
```

### 4.2 Diff shape (~415 LOC removed)

**Interface (`ProcurementAnalysisService.java`)** — remove 8 method declarations + their javadoc:
- Lines around 95-103 (`getSupplierEvaluation` decl + javadoc)
- Lines around 105-115 (`getSupplierDetailMetrics` decl + javadoc)
- Lines around 124-132 (`getPurchaseCostAnalysis` decl + javadoc)
- Lines around 134-142 (`getCostMetrics` decl + javadoc)
- Lines around 154-162 (`getSupplierRanking` decl + javadoc)
- Lines around 164-172 (`getMaterialCategoryRanking` decl + javadoc)
- Lines around 180-188 (`getProcurementTrendChart` decl + javadoc)
- Lines around 190-199 (`getSupplierTrendComparison` decl + javadoc)

**Impl (`ProcurementAnalysisServiceImpl.java`)** — remove 8 public method bodies + 5 private helpers + section-comment cleanup:
- Section `供应商评估` lines 124-187 (~64 LOC: 1 comment + getSupplierEvaluation + getSupplierDetailMetrics)
- Section `采购成本分析` lines 240-331 (~92 LOC: 1 comment + getPurchaseCostAnalysis + getCostMetrics)
- Section `供应商排名` lines 333-385 (~53 LOC: 1 comment + getSupplierRanking + getMaterialCategoryRanking)
- Section `趋势分析` lines 387-444 (~58 LOC: 1 comment + getProcurementTrendChart + getSupplierTrendComparison)
- 5 private helpers ~85 LOC (lines 595-604, 623-636, 637-647, 648-683, 1083-1095)

KEEP all SHARED helpers per §2.2 table.

### 4.3 Post-edit verification gate (MO §2.6)

```bash
# Compile
cd backend/java/cretas-api && mvn clean compile -DskipTests   # MUST pass

# Tests
mvn clean test -DskipTests=false                              # MUST pass; count unchanged (no test file deleted)

# Package
mvn clean package -DskipTests                                 # MUST produce aims-0.0.1-SNAPSHOT.jar

# Method-level orphan grep — sanity re-verify post-removal
for m in getSupplierEvaluation getSupplierDetailMetrics getPurchaseCostAnalysis \
         getCostMetrics getSupplierRanking getMaterialCategoryRanking \
         getProcurementTrendChart getSupplierTrendComparison \
         calculatePriceScore calculateDeliveryScore calculateServiceScore \
         calculateStabilityScore determineDeliveryAlertLevel; do
  hits=$(grep -rnE "\.${m}\(|\b${m}\(" backend/java/cretas-api/src/main/java/ | wc -l)
  [ "$hits" -eq 0 ] || { echo "FAIL: $m still has $hits caller(s)"; exit 1; }
done
echo "All 13 dead methods + helpers verified zero references post-delete."
```

### 4.4 Safe-commit pattern (MO §2.7 + concurrent-edit-safety Rule 5b)

```bash
./scripts/safe-commit.sh "feat(t6-5-phase-c-sub-i): ProcurementAnalysisServiceImpl 8 dead methods + 5 helpers delete (interface + impl)" \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/ProcurementAnalysisService.java \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ProcurementAnalysisServiceImpl.java
```

---

## 5. ⛔ STOP-and-Ping Gate (MO §2.4)

This audit-only commit is the FIRST commit on branch `ops-t6-5-phase-c-sub-i-procurement`. Per Phase C MO §2.4:

> After Sub-B-I audit doc is committed — **STOP**. Do NOT delete any methods yet. Push the audit-only commit, open a draft PR with title `audit(t6-5-phase-c-sub-<X>): <ServiceImpl> method-level inventory`, and ping organizer in the dispatch thread. Wait for explicit GO before proceeding to Step 2.5.

Steve's MO PR title `feat(t6-5-phase-c-sub-i): ProcurementAnalysisServiceImpl dead method delete (Sub-I)` implies bundled audit + delete in one PR (per Sub-G/Sub-E precedent). **Following Sub-G template literally** — opening this PR as `audit(...)` first per §2.4, awaiting GO before commit-2 source-delete. Steve can confirm preference (single bundled vs split commits).

---

## 6. Open Questions for Organizer

1. **PR style**: per MO template §2.4, audit-only PR + ping-and-wait. Per Sub-E (PR #248) and Sub-G (PR #242) precedent, single bundled `feat(...)` PR shipped with both audit doc + source delete. **Recommend bundled** per Sub-E/Sub-G precedent (8 dead methods is a clean self-contained removable surface).
2. **Section comments** at lines 124, 240, 333, 387 — recommend remove entirely since each section becomes empty after deletion (4 sections → 0 methods each). Cleaner than orphaned section delimiters.
3. **Pre-flight build gate** — defer to source-delete commit per Sub-G precedent (audit PR doesn't touch Java; source-delete commit will run + log baseline).
4. **Sub-D dead-chain precedent** — Sub-D had 3 methods deferred to "Sub-L" (cross-Sub coordination via `SmartBIServiceImpl.getComprehensiveAnalysis`). Sub-I has NONE such — all 8 dead methods are truly orphan (zero callers anywhere). Clean removal.

---

## Cross-References

- **Phase C umbrella MO**: `docs/superpowers/dispatch/2026-05-15-t6-5-phase-c-method-level-audit-marching-order.md` §1 + §2.3 + §2.4 + §2.5 + §2.6 + §2.7 + §2.8
- **PR #178 audit v3.1** §3.1.a: `/analysis/procurement` classified `SAFE_NGINX_ROUTED` — Python alive for all 75 factories, Java stub 410
- **PR #205** (`be5959c504`): Phase B 23-endpoint stub-out (includes `/analysis/procurement`)
- **PR #213**: Phase B prod cutover live + chat4 active E2E 12/12 PASS
- **PR #236** (`c8d509b8d1`): Sub-A controller method-body delete (445 LOC controller post-Sub-A; `getProcurementAnalysis` controller method body removed there)
- **PR #248** (`571a0b4ddf`): Sub-E FinanceAnalysisServiceImpl 10 dead methods delete — bundled audit+impl precedent
- **PR #242** (`c322ece399`): Sub-G QualityAnalysisServiceImpl 3 dead methods delete — bundled precedent
- **Spec**: `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` §C.1.1 + §C.1.2 + §C.1.3 (FinanceAnalysisServiceImpl worked example)
- **Java**:
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ProcurementAnalysisServiceImpl.java` (1144 LOC, this Sub-I scope)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/ProcurementAnalysisService.java` (interface, 8 decls to remove)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java:415` (alive `/query` NL `generateProcurementQueryResponse` caller — only uses `getProcurementOverview`)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java:554` (composite `setProcurement` caller — only uses `getProcurementOverview`)
- **Rules**:
  - `concurrent-edit-safety.md` Rule 5b — safe-commit `--only` paths-only mode for source-delete commit
  - `feedback_pause_before_deploy_or_push.md` — STOP-and-ping organizer before push (this PR)
  - `feedback_marching_order_method_name_grep.md` — every method name in this audit grep-verified against actual source (no paraphrased names)
  - `feedback_audit_endpoint_impl_not_router.md` — caller classification verified across controller + main + test (not just one file)
