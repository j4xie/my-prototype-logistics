# T6.5 Phase C Sub-L — Cross-Sub Orphan Sweep (Production-Side)

**Date**: 2026-05-10
**Branch**: `ops-t6-5-phase-c-sub-l-orphan-sweep`
**Worktree base**: `origin/main` HEAD `9ca97f46d8` (post Sub-T `9ca97f46d8` + memory hygiene `29131fbfb5` + frontend P3 `e0a4a5c370`)
**Author**: Chat 6 reuse (Sub-L dispatch per Phase C MO PR #227 + Steve Option A scope)
**Scope**: Cross-Sub production-side orphan sweep — methods that became dead-chain after Sub-A through Sub-G deletions
**Predecessors**:
- PR #236 (Sub-A: 23 controller methods + `SmartBiQueryTemplateRepository` deleted)
- PR #243 (Sub-B: SalesAnalysisServiceImpl)
- PR #244 (Sub-C: DepartmentAnalysisServiceImpl)
- PR #245 (Sub-D: RegionAnalysisServiceImpl 5 dead methods, **3 deferred to Sub-L**)
- PR #248 (Sub-E: FinanceAnalysisServiceImpl 10 dead methods, **1 deferred to Sub-L** — but reclassified to KEEP per this audit)
- PR #246 (Sub-F: ProductionAnalysisServiceImpl)
- PR #242 (Sub-G: QualityAnalysisServiceImpl)
- PR #253 (Sub-T: test orphan sweep — NO-OP audit)

---

## §0 TL;DR

**4 deletions** (Steve Option A scope, NOT 5):

| # | Method | File | LOC | Why |
|---|---|---|---:|---|
| 1 | `SmartBIServiceImpl.getComprehensiveAnalysis` + interface decl | `SmartBIServiceImpl.java` + `SmartBIService.java` | 50 + 20 | 0 external callers; was sole orchestration point for Sub-D's deferred 3 region methods |
| 2 | `RegionAnalysisServiceImpl.getRegionTargetCompletion` + interface decl | `RegionAnalysisServiceImpl.java` + `RegionAnalysisService.java` | ~46 + ~14 | Only caller was `SmartBIServiceImpl.getComprehensiveAnalysis:595` (deletion #1) |
| 3 | `RegionAnalysisServiceImpl.getGeographicHeatmapData` + interface decl | same | ~63 + ~14 | Only caller was `SmartBIServiceImpl.getComprehensiveAnalysis:596` (deletion #1) |
| 4 | `RegionAnalysisServiceImpl.getRegionOpportunityScores` + interface decl | same | ~80 + ~18 | Only caller was `SmartBIServiceImpl.getComprehensiveAnalysis:597` (deletion #1) |

**Total**: 4 files changed, **321 deletions**, 0 insertions.

### KEEP reclassification (vs Sub-E PR #248 deferred list)

`getReceivableAgingChart` was deferred from Sub-E to Sub-L. **This audit reclassifies it as KEEP**, contradicting Sub-E's defer-list assumption.

**Why**: Sub-E PR #248 audit assumed `getReceivableAgingChart`'s only caller was `SmartBIServiceImpl.getComprehensiveAnalysis:604` (dead-chain). But grep shows a **second caller** at `FinanceAnalysisServiceImpl.java:159` — inside the alive `getFinanceOverview` body (Dashboard composite chartList build). After Sub-L deletes `getComprehensiveAnalysis`, `getReceivableAgingChart` still has 1 alive caller via `getFinanceOverview` → must KEEP.

This is the same class of internal-self-reference miss that triggered Sub-E v3 audit revision. Sub-E §3.5 grep was external-only against `controller/` + `service/smartbi/impl/` excluding-self; it caught the `:604` external call site but the `:159` self-reference site was inside `FinanceAnalysisServiceImpl` itself which was excluded. Sub-L's grep widened to no-exclusion catches this.

**Steve's revised Option A scope ✅ verified empirically**.

### Verification

- `mvnw clean compile -DskipTests` → **BUILD SUCCESS**
- `mvnw test -Dtest=FinanceAnalysisServiceImplTest,ForecastServiceImplTest,RecommendationServiceImplTest,SmartBIRestaurantRoutingTest` → **19/19 PASS**
- Identifier grep for 4 deleted methods across `src/`: **0 hits** (no orphans created)

---

## §1 Audit methodology

### §1.1 Per-method caller verification

For each deletion candidate, ran `grep -rn '<method>(' backend/java/cretas-api/src/`:

#### `SmartBIServiceImpl.getComprehensiveAnalysis`

Pre-deletion grep:
```
SmartBIServiceImpl.java:570:    public Map<String, Object> getComprehensiveAnalysis(...)   ← self-define
SmartBIService.java:78:    Map<String, Object> getComprehensiveAnalysis(...)               ← interface decl
```
**0 external callers** → confirmed orphan.

Historical context: this method was the orchestration point for `analysisType=sales|department|region|finance` cross-domain composites. Phase 2A Pattern B real-port moved this orchestration to Python (`backend/python/smartbi_compat/api/analysis.py`); Sub-A PR #236 deleted the Java controller endpoint `getRegionAnalysis` / `getFinanceAnalysis` etc. that called this orchestrator. Once those controllers are gone, the impl method becomes pure orphan.

#### `RegionAnalysisServiceImpl.getRegionTargetCompletion`

Pre-deletion grep:
```
RegionAnalysisServiceImpl.java:228:    public List<MetricResult> getRegionTargetCompletion(...)   ← self-define
RegionAnalysisService.java:95:    List<MetricResult> getRegionTargetCompletion(...)               ← interface decl
SmartBIServiceImpl.java:595: result.put("targetCompletion", regionService.getRegionTargetCompletion(...));  ← inside getComprehensiveAnalysis (deletion #1)
```
**1 external caller, in deletion #1** → orphan-after-#1.

#### `RegionAnalysisServiceImpl.getGeographicHeatmapData`

Pre-deletion grep:
```
RegionAnalysisServiceImpl.java:277:    public ChartConfig getGeographicHeatmapData(...)
RegionAnalysisService.java:110:    ChartConfig getGeographicHeatmapData(...)
SmartBIServiceImpl.java:596: result.put("heatmap", regionService.getGeographicHeatmapData(...));  ← inside getComprehensiveAnalysis
```
**1 external caller, in deletion #1** → orphan-after-#1.

#### `RegionAnalysisServiceImpl.getRegionOpportunityScores`

Pre-deletion grep:
```
RegionAnalysisServiceImpl.java:344:    public List<RegionOpportunityScore> getRegionOpportunityScores(...)
RegionAnalysisService.java:131:    List<RegionOpportunityScore> getRegionOpportunityScores(...)
SmartBIServiceImpl.java:597: result.put("opportunityScores", regionService.getRegionOpportunityScores(...));  ← inside getComprehensiveAnalysis
```
**1 external caller, in deletion #1** → orphan-after-#1.

### §1.2 KEEP verification

#### `getReceivableAgingChart` — KEEP (reclassified from Sub-E DEFER)

Pre-deletion grep:
```
FinanceAnalysisService.java:148:    ChartConfig getReceivableAgingChart(...)               ← interface decl
FinanceAnalysisServiceImpl.java:545: public ChartConfig getReceivableAgingChart(...)        ← self-define
FinanceAnalysisServiceImpl.java:159:    chartList.add(getReceivableAgingChart(...));         ← INSIDE getFinanceOverview (alive!)
SmartBIServiceImpl.java:604: result.put("receivableAging", financeService.getReceivableAgingChart(...));  ← inside getComprehensiveAnalysis (deletion #1)
```
**2 callers, 1 alive after #1**. The alive caller is `FinanceAnalysisServiceImpl:159` — `getFinanceOverview` Dashboard composite chartList build. `getFinanceOverview` is a HARD KEEP per Sub-E PR #248 §"Final classification (v3)".

After deletion #1: `getReceivableAgingChart` retains 1 alive caller (`getFinanceOverview`) → must KEEP.

This corrects Sub-E PR #248 §"DEFER to Sub-L (1)" assumption that `getReceivableAgingChart` was dead-chain.

### §1.3 Private helper retention

Per Sub-E v3 lesson §2.7.4 (defensive rule): **private helpers stay**, even if their only public-facing callers are deleted. mvn compile may emit unused-private-method warnings but they aren't errors. Cleanup follow-up is out of scope.

`RegionAnalysisServiceImpl` private helpers used by deleted methods (lines 480-928):
- `aggregateByRegion` — ALIVE (also called by surviving `getRegionRanking:65` + `getRegionDetail:239`)
- `aggregateByProvince` — ALIVE (also called by surviving methods at lines 687, 772)
- `calculateCompletionRate` — ALIVE (also called by lines 561, 629)
- `calculateGrowthScore` / `calculateBaseScore` / `calculateMarginScore` / `calculatePenetrationScore` — orphaned by this Sub-L (only `getRegionOpportunityScores` used them); kept per defensive rule
- `generateOpportunityRecommendation` — orphaned (only `getRegionOpportunityScores`); kept per defensive rule
- `determineDirection` / `normalizeProvinceName` / `determineColorLevel` — orphaned/kept per defensive rule
- `RegionAggregation` inner class — ALIVE (still used by surviving methods + `RegionOpportunityScore` builder)

### §1.4 Section header retention

Section comment headers in `RegionAnalysisServiceImpl.java`:
- `// ==================== 目标完成分析 ====================` — REMOVED (only the deleted method)
- `// ==================== 地理分布分析 ====================` — REMOVED
- `// ==================== 机会评分分析 ====================` — REMOVED
- `// ==================== 私有辅助方法 ====================` — KEPT (still describes the surviving private helpers section)

Section comment headers in `SmartBIService.java` + `SmartBIServiceImpl.java`:
- `// ==================== 综合分析 ====================` — REMOVED (only the deleted method)

---

## §2 Edits

### §2.1 `SmartBIService.java` (interface, -20 LOC)

Removed lines 61-79: section header + Javadoc (16 lines) + interface decl (2 lines) + trailing blank.

```java
// REMOVED
//     // ==================== 综合分析 ====================
//     /** 获取综合分析数据 ... */
//     Map<String, Object> getComprehensiveAnalysis(String factoryId, LocalDate startDate,
//                                                    LocalDate endDate, String analysisType);
```

### §2.2 `SmartBIServiceImpl.java` (impl, -52 LOC)

Removed lines 566-616: section header (1) + `@Override`/`@Transactional` (2) + 47-line method body + trailing blank.

```java
// REMOVED
//     // ==================== 综合分析 ====================
//     @Override
//     @Transactional(readOnly = true)
//     public Map<String, Object> getComprehensiveAnalysis(...) { switch(analysisType) { ... } }
```

The `switch` block dispatched to:
- `salesService.getSalesOverview/...` — KEEP (Sales has alive surface)
- `deptService.getDepartmentRanking/...` — KEEP (Department has alive surface)
- `regionService.getRegion*` — 3 of 4 calls feed the deletions in §2.4 (the 4th `getRegionRanking` is alive elsewhere)
- `financeService.getFinanceOverview/getProfitMetrics/getCostStructureChart/getReceivableAgingChart` — all KEEP

### §2.3 `RegionAnalysisService.java` (interface, -50 LOC)

Removed lines 83-131: 3 section headers + 3 Javadocs (~38 lines) + 3 interface decls (~3 lines).

### §2.4 `RegionAnalysisServiceImpl.java` (impl, -199 LOC)

Removed lines 225-422: 3 section headers + 3 method bodies. End of edit reflows cleanly into `// ==================== 私有辅助方法 ====================` section.

---

## §3 Verification

### §3.1 mvn compile gate

```
PS> Set-Location ...\.worktrees\t6-5-phase-c-sub-l-orphan-sweep\backend\java\cretas-api
PS> .\mvnw.cmd clean compile -DskipTests
[INFO] Compiling 2305 source files with javac [debug release 21] to target\classes
[INFO] BUILD SUCCESS
[INFO] Total time:  ~1:35 min
```

(2 fewer source files than pre-Sub-L baseline because `RegionAnalysisService` + `SmartBIService` interface decls dropped — actually file count unchanged but interface declarations within them shrunk; no compile errors.)

Log: `.tmp-transcripts/sub-l-compile.log`.

### §3.2 SmartBI targeted tests

```
PS> .\mvnw.cmd test -Dtest=SmartBIRestaurantRoutingTest,FinanceAnalysisServiceImplTest,ForecastServiceImplTest,RecommendationServiceImplTest
[INFO] Tests run: 5,  ... FinanceAnalysisServiceImplTest
[INFO] Tests run: 6,  ... ForecastServiceImplTest
[INFO] Tests run: 2,  ... RecommendationServiceImplTest
[INFO] Tests run: 6,  ... SmartBIRestaurantRoutingTest
[INFO] Tests run: 19, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

Log: `.tmp-transcripts/sub-l-targeted-tests.log`.

`FinanceAnalysisServiceImplTest` PASS confirms `getReceivableAgingChart` KEEP retention worked — its 5 tests cover Finance methods including those depending on `getFinanceOverview` chain.

### §3.3 Identifier grep (post-edit)

```
SL=...; grep -rn 'getComprehensiveAnalysis|getRegionTargetCompletion|getGeographicHeatmapData|getRegionOpportunityScores' $SL/src/
(no output — 0 hits)
```

```
grep -rn 'ANALYSIS_COMPREHENSIVE|comprehensiveAnalysis' $SL/src/
(no output — 0 hits)
```

No residual references. No tests reference deleted methods (consistent with Sub-T audit findings — the original Java surface was largely synthetic, no test coverage on these methods).

### §3.4 Diff stat

```
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/RegionAnalysisService.java     | -50 LOC
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/SmartBIService.java            | -20 LOC
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RegionAnalysisServiceImpl.java | -199 LOC
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java   | -52 LOC

Total: 4 files changed, 321 deletions(-), 0 insertions(+).
```

---

## §4 Notes for downstream Sub-* dispatches

### §4.1 Triggers Sub-N (chat3) + Sub-P (chat8)

Per Steve message: "之后 Sub-L merge 触发 chat3 Sub-N + chat8 Sub-P unblock". Once this PR merges, those two sub-batches can proceed.

### §4.2 KEEP reclassification cross-references Sub-E

Sub-E PR #248 §"DEFER to Sub-L (1)" listed `getReceivableAgingChart`. This Sub-L audit empirically reclassifies it as KEEP via `getFinanceOverview:159` internal call. Sub-E's audit doc is historically correct (it was external-grep based) — this is just a refinement applying Sub-E v3 lesson (internal-self-reference grep is mandatory).

No Sub-E artifact needs amendment. The audit revision history correctly records v3 had FAIL caught before merge for 2 internal-self-references on Profit/OverdueRanking; same defect class applies to Receivable here, just outside Sub-E's scope.

### §4.3 Private helper cleanup follow-up

Per §1.3, `calculateGrowthScore` / `calculateBaseScore` / `calculateMarginScore` / `calculatePenetrationScore` / `generateOpportunityRecommendation` are now orphaned (their only caller `getRegionOpportunityScores` deleted). These could be cleaned in a follow-up "private helper sweep" task, but per Sub-E §2.7.4 defensive rule are out of scope here.

### §4.4 No frontend / DB / config impact

This is pure Java surface trim. No nginx route changes (none of these methods were exposed via controller — Sub-A already deleted those endpoints). No database query changes. No frontend impact (Phase 2A Python port already serves these). No deploy required (this only affects local Java compile / future jar; the prod jar at server 47 was built pre-Sub-A and will get this trim on next routine deploy).

---

## §5 Outstanding items

| Item | Status | Owner |
|---|---|---|
| mvn clean compile | **PASS** | Logged in §3.1 |
| 4 SmartBI tests (19/19) | **PASS** | Logged in §3.2 |
| Residual grep (0 hits) | **PASS** | Logged in §3.3 |
| safe-commit + push | **PENDING** | This chat |
| PR creation | **PENDING** | This chat |
| Ping organizer with PR # | **PENDING** | This chat → Steve |
| Sub-N (chat3) + Sub-P (chat8) unblock | Triggered by Sub-L merge | Organizer dispatches |
| Private helper sweep (calculateGrowth/Base/Margin/Penetration etc.) | Out of scope per §1.3 defensive rule | Future follow-up |

---

## §6 References

- PR #150 (T6.5 spec, §C.1.3 worked example)
- PR #178 (Phase A audit v3.1)
- PR #213 (Phase B 23-endpoint stub)
- PR #227 (Phase C MO draft — dispatch source)
- PR #236 (Sub-A controller body delete)
- PR #243 / #244 / #245 / #246 / #248 / #242 (Sub-B through Sub-G method-level deletes)
- PR #247 (test partial cleanup)
- PR #253 (Sub-T test orphan sweep — NO-OP audit, sister to this Sub-L)
- `.claude/rules/concurrent-edit-safety.md` Rule 5b (paths-only commit)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
