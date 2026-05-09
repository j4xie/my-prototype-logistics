# T6.5 Phase C Sub-C — `DepartmentAnalysisServiceImpl` method-level audit

**Date**: 2026-05-10
**Sub-batch**: Sub-C (chat-C / chat 4 reuse)
**Service**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/DepartmentAnalysisServiceImpl.java` (844 LOC)
**Interface**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/DepartmentAnalysisService.java` (159 LOC, 7 method declarations)
**Test file**: none (no `DepartmentAnalysisServiceImplTest.java` exists in `backend/java/cretas-api/src/test/`)
**Branch**: `ops-t6-5-phase-c-sub-c-dept`
**Base**: `99772213aa` (origin/main, post Sub-A merge `c8d509b8d1` PR #236)

---

## 1. Methodology

Per MO §2.3 (`docs/superpowers/dispatch/2026-05-15-t6-5-phase-c-method-level-audit-marching-order.md`) + spec §C.1.3 worked example.

For each public method on `DepartmentAnalysisServiceImpl`:

1. Grep callers in KEEP'd controllers (`SmartBIDashboardController`, `SmartBIPublicDemoController`, `SmartBIUploadController`, `SmartBIConfigController`).
2. Grep callers in entire `backend/java/cretas-api/src/main/java/` tree (excluding the impl file itself).
3. Grep callers in `backend/java/cretas-api/src/test/java/`.
4. Classify per spec §C.1.3 step 3:
   - 0 callers in KEEP'd controllers AND 0 external main-source callers → **REMOVABLE** (dead post-Phase-B)
   - ≥1 caller anywhere alive → **KEEP**

**Aliveness of intermediate callers**:
- `SmartBIServiceImpl` (`service/smartbi/impl/SmartBIServiceImpl.java`) is alive: called by `SmartBIDashboardController` (KEEP'd, line 49 `private final SmartBIService smartBIService` + 6 method invocations) and by `SmartBIAnalysisController` alive endpoints (`/query` line 173 `smartBIService.processQuery`, `/drill-down` line 219 `smartBIService.processDrillDown`). Therefore `deptService.<method>` calls inside `SmartBIServiceImpl` are LIVE callers.
- `SmartBIAnalysisController` post-Sub-A merge (PR #236): 23 method bodies removed, but 2 endpoints survive — `/query` (line 167-184) and `/drill-down` (line 198-264) — neither was in the 23-stub list (NOT_SAFE_FALLTHROUGH per PR #178 §3.1.a). Calls in those bodies are LIVE callers.

---

## 2. Method-level inventory

### Public methods (7 total)

| # | Method | KEEP'd ctlr | Other main-src | Test | Decision |
|---|---|---|---|---|---|
| 1 | `getDepartmentRanking` | `SmartBIDashboardController:558` (composite dashboard fallback) | `SmartBIAnalysisController:340` (`/query` helper `generateDepartmentQueryResponse`), `SmartBIServiceImpl` ×5 (lines 337, 360, 587, 1573, 1699, 2007) | 0 | **KEEP** |
| 2 | `getDepartmentDetail` | 0 | `SmartBIAnalysisController:241` (`/drill-down` department-dimension branch), `SmartBIServiceImpl` ×2 (lines 1704, 2011) | 0 | **KEEP** |
| 3 | `getDepartmentCompletionRates` | 0 | `SmartBIServiceImpl:588` | 0 | **KEEP** |
| 4 | `getDepartmentEfficiencyMatrix` | 0 | `SmartBIServiceImpl:589` | 0 | **KEEP** |
| 5 | `getDepartmentHeadcountChart` | **0** | **0** | 0 | **REMOVABLE** |
| 6 | `getDepartmentTrendComparison` | 0 | `SmartBIServiceImpl` ×3 (lines 343, 362, 590) | 0 | **KEEP** |
| 7 | `getDepartmentShareTrend` | **0** | **0** | 0 | **REMOVABLE** |

### Private helpers (14 total) — call-trace classification

Helper aliveness derived from caller method's classification above:

| Helper | In-file callers (line) | Alive? | Decision |
|---|---|---|---|
| `convertToKPICards` | 136 (in `getDepartmentDetail`, KEEP) | ✓ | KEEP |
| `aggregateDepartmentData` | 77 / 172 / 217 (all KEEP methods) | ✓ | KEEP |
| `aggregateTrendData` | 432 (`getDepartmentShareTrend` DEAD) + 732 (in `buildDepartmentCharts` → which serves KEEP `getDepartmentDetail`) | ✓ via 732 | KEEP |
| `getPeriodKey` | 374 (`getDepartmentTrendComparison` KEEP) + 580 (in `aggregateTrendData` KEEP) | ✓ | KEEP |
| `calculateCompletionRate` | 90 / 179 / 686 (all KEEP) | ✓ | KEEP |
| `determineQuadrant` | 242 (`getDepartmentEfficiencyMatrix` KEEP) | ✓ | KEEP |
| `buildDepartmentKpiCards` | 135 (`getDepartmentDetail` KEEP) | ✓ | KEEP |
| `buildDepartmentCharts` | 139 (`getDepartmentDetail` KEEP) | ✓ | KEEP |
| `buildSalespersonRankings` | 146 (`getDepartmentDetail` KEEP) | ✓ | KEEP |
| `createEmptyScatterChart` | 213 (`getDepartmentEfficiencyMatrix` KEEP) | ✓ | KEEP |
| `createEmptyPieChart` | **296 (`getDepartmentHeadcountChart` DEAD only)** | **✗** | **REMOVABLE** |
| `createEmptyLineChart` | 365 (`getDepartmentTrendComparison` KEEP) | ✓ | KEEP |
| `createEmptyAreaChart` | **428 (`getDepartmentShareTrend` DEAD only)** | **✗** | **REMOVABLE** |
| `DepartmentAggregation` (inner class) | line 77 + 172 + 217 + 546 (used by alive aggregator) | ✓ | KEEP |

### Interface (`DepartmentAnalysisService.java`) declarations

7 method declarations mirror the public-method classifications above. Removing impl methods 5 & 7 also removes the corresponding interface declarations (lines 123 `getDepartmentHeadcountChart` + 158 `getDepartmentShareTrend`).

---

## 3. Removal summary

**To remove**:
- 2 public methods on impl: `getDepartmentHeadcountChart` (lines 287-350, ~64 LOC) + `getDepartmentShareTrend` (lines 420-488, ~69 LOC)
- 2 corresponding interface declarations: `getDepartmentHeadcountChart` (lines 109-123) + `getDepartmentShareTrend` (lines 143-158) — including their JavaDoc + section dividers
- 2 private helpers exclusive to dead methods: `createEmptyPieChart` (lines 809-815, 7 LOC) + `createEmptyAreaChart` (lines 825-831, 7 LOC)
- 0 test methods (no test file exists for this service)

**Estimated removed LOC**: ~150 LOC impl + ~32 LOC interface = ~180 LOC total.

**To keep** (no change):
- 5 public methods on impl + their 5 interface declarations
- 12 private helpers + 1 inner class
- All field declarations (3 final repos/services + 6 constants) + imports

---

## 4. Verification protocol (per MO §2.6 — to run after source-level removal)

```bash
cd backend/java/cretas-api
mvn clean compile -DskipTests          # MUST pass
mvn clean test -DskipTests=false       # MUST pass; baseline test count unchanged (no test removed)
mvn clean package -DskipTests          # MUST produce aims-0.0.1-SNAPSHOT.jar

# Method-level orphan grep — sanity re-verify post-removal
for method in getDepartmentHeadcountChart getDepartmentShareTrend createEmptyPieChart createEmptyAreaChart; do
    hits=$(grep -rnE "\.${method}\(|\b${method}\(" backend/java/cretas-api/src/main/java/ | wc -l)
    [ "$hits" -eq 0 ] || { echo "FAIL: $method still has $hits caller(s)"; exit 1; }
done
```

**Pre-flight baseline (this audit)**:
- `mvn clean compile -DskipTests`: **PASS** (run 2026-05-10, exit 0)
- `mvn test`: in flight (background task, will record count in PR description after completion)

---

## 5. Risk + mitigation notes

- **No tests** exist for `DepartmentAnalysisServiceImpl`, so test-count delta is 0 — but post-edit `mvn test` still required to verify no other test regression (none expected since Sub-B/C/D/E/F/G/H/I are independent service files).
- **Interface declarations** must be removed in the same commit as impl methods (lockstep) — keeping declarations without impl would compile-break (interface contract violation) given `DepartmentAnalysisServiceImpl implements DepartmentAnalysisService`.
- **Imports may become unused** post-removal: review `LocalDateTime` (line 21) since `getDepartmentShareTrend` doesn't actually use it (audit re-grep: line 287/421 bodies don't reference `LocalDateTime`). Will verify post-edit via `mvn compile` (Lombok/IDE imports usually flagged; clean compile is the truth).
- **Inner class `DepartmentAggregation`** stays — used by `aggregateDepartmentData` which is KEEP.

---

## 6. Cross-refs

- **Predecessors**:
  - PR #150 (T6.5 spec, Decision 4B amend) — spec §C.1.3 method-level audit protocol
  - PR #178 (Phase A audit v3.1) — §3.1.a 22 SAFE_NGINX_ROUTED + 4 NOT_SAFE_FALLTHROUGH classification (defines which controller endpoints survive Phase B)
  - PR #213 (Phase B 23-endpoint stub `be5959c504`) — defines the 410 stub baseline
  - PR #227 (Phase C MO draft `e85e39d8c5`) — this MO
  - PR #236 (Sub-A merge `c8d509b8d1`) — 23 controller method bodies + orphan repo deleted
- **Sister Sub-batches** (parallel, independent service files): Sub-B `SalesAnalysisServiceImpl`, Sub-D `RegionAnalysisServiceImpl`, Sub-E-I (other `*AnalysisServiceImpl` files)

---

## 7. Status

- [x] Method-level audit complete (per MO §2.3)
- [x] Pre-flight `mvn clean compile` PASS (per MO §2.2)
- [ ] Pre-flight `mvn test` — running in background, will report count
- [ ] ⛔ **STOP-and-ping organizer** — awaiting GO before proceeding to Step 2.5 (source-level removal)
