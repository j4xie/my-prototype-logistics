# T6.5 Phase C — Sub-D `RegionAnalysisServiceImpl` Method-Level Audit

**Date**: 2026-05-10
**Sub-batch**: D (chat 5)
**Service**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RegionAnalysisServiceImpl.java` (1209 LOC)
**Interface**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/RegionAnalysisService.java` (190 LOC)
**Test file**: ❌ NONE — no `RegionAnalysisServiceImplTest.java` / `RegionAnalysisServiceTest.java` in `src/test/`
**Predecessor**: PR #236 (Sub-A — 23 controller method declarations deleted) merged at `c8d509b8d1`
**Worktree base**: `origin/main` HEAD `99772213aa`
**Pre-flight build**: ✅ `mvn clean compile -DskipTests` PASS

**STATUS**: ⛔ AUDIT-ONLY — awaiting organizer GO before any code delete (per Phase C MO §2.4).

---

## 1. Method enumeration

12 public methods (interface-mirror, all `@Override`):

| # | Method | Impl line | Signature |
|---|---|---|---|
| 1 | `getRegionRanking` | 55 | `(String factoryId, LocalDate start, LocalDate end) → List<RankingItem>` |
| 2 | `getProvinceRanking` | 97 | `(String factoryId, String region, LocalDate start, LocalDate end) → List<RankingItem>` |
| 3 | `getCityRanking` | 146 | `(String factoryId, String province, LocalDate start, LocalDate end) → List<RankingItem>` |
| 4 | `getRegionDetail` | 172 | `(String factoryId, String region, LocalDate start, LocalDate end) → DashboardResponse` |
| 5 | `getRegionTrendChart` | 229 | `(String factoryId, LocalDate start, LocalDate end, String period) → ChartConfig` |
| 6 | `getRegionTargetCompletion` | 270 | `(String factoryId, LocalDate start, LocalDate end) → List<MetricResult>` |
| 7 | `getGeographicHeatmapData` | 319 | `(String factoryId, LocalDate start, LocalDate end) → ChartConfig` |
| 8 | `getRegionOpportunityScores` | 386 | `(String factoryId, LocalDate start, LocalDate end) → List<RegionOpportunityScore>` |
| 9 | `getRegionProvinceTreemap` | 469 | `(String factoryId, LocalDate start, LocalDate end) → ChartConfig` |
| 10 | `getAllRegions` | 559 | `(String factoryId) → List<String>` |
| 11 | `getProvincesByRegion` | 572 | `(String factoryId, String region) → List<String>` |
| 12 | `getCitiesByProvince` | 586 | `(String factoryId, String province) → List<String>` |

22 private helpers + 1 inner class `RegionAggregation` (line 1175). Private-helper chase-down deferred to §2.5 source-removal step (compile + post-edit grep verifies orphans).

---

## 2. Caller sweep — main-source tree

Per protocol §2.3 — for each public method, `grep -rnE "\.${m}\("` excluding `RegionAnalysisServiceImpl.java` + `RegionAnalysisService.java`:

| # | Method | External hits | Where |
|---|---|---|---|
| 1 | `getRegionRanking` | 8 | AnalysisController (drillDown helper) + DashboardController (getUnifiedDashboard) + SmartBIServiceImpl (5 sites in 4 methods) |
| 2 | `getProvinceRanking` | 2 | AnalysisController.drillDown + SmartBIServiceImpl.generateAIInsights |
| 3 | `getCityRanking` | 2 | AnalysisController.drillDown + SmartBIServiceImpl.generateAIInsights |
| 4 | `getRegionDetail` | 1 | SmartBIServiceImpl.generateAIInsights |
| 5 | `getRegionTrendChart` | **0** | — |
| 6 | `getRegionTargetCompletion` | 1 | SmartBIServiceImpl.getComprehensiveAnalysis |
| 7 | `getGeographicHeatmapData` | 1 | SmartBIServiceImpl.getComprehensiveAnalysis |
| 8 | `getRegionOpportunityScores` | 1 | SmartBIServiceImpl.getComprehensiveAnalysis |
| 9 | `getRegionProvinceTreemap` | **0** | — |
| 10 | `getAllRegions` | **0** | — |
| 11 | `getProvincesByRegion` | **0** | — |
| 12 | `getCitiesByProvince` | **0** | — |

---

## 3. Caller chain liveness verification

The 7 non-zero-hit methods cascade-depend on whether **their callers** are themselves alive after Sub-A. Full chain audit:

### 3.1 `SmartBIAnalysisController.java` (post-Sub-A surviving methods)

```
public method                        line   STATUS
getProductionAnalysis                82     NOT_SAFE_FALLTHROUGH (HARD KEEP per spec §C.1.2)
getQualityAnalysis                  121     NOT_SAFE_FALLTHROUGH (HARD KEEP)
query                               160     NOT_SAFE_FALLTHROUGH (HARD KEEP)
drillDown                           200     NOT_SAFE_FALLTHROUGH (HARD KEEP)
```

| Region call site | Owning method | Liveness |
|---|---|---|
| `AnalysisController.java:233` (`getProvinceRanking` in drillDown switch) | `drillDown` | ✅ ALIVE |
| `AnalysisController.java:237` (`getCityRanking` in drillDown switch) | `drillDown` | ✅ ALIVE |
| `AnalysisController.java:352` (`getRegionRanking` in `generateRegionQueryResponse` private helper) | `query` | ✅ ALIVE |

### 3.2 `SmartBIDashboardController.java`

```
public method                                       line   STATUS
generateAdaptiveCharts                              95     KEEP
generateSingleChart                                120     KEEP
getExecutiveDashboard                              158     KEEP
getDashboardLLMInsights                            190     KEEP
getDashboardLLMInsightsCustomRange                 212     KEEP
getExecutiveDashboardCustomRange                   317     KEEP
getUnifiedDashboard                                345     KEEP (Region call at line 562)
getKPIsOnly                                        431     KEEP
analyzeDynamicData                                 455     KEEP
```

| Region call site | Owning method | Liveness |
|---|---|---|
| `DashboardController.java:562` (`getRegionRanking` in CompletableFuture fan-out) | `getUnifiedDashboard` | ✅ ALIVE |

### 3.3 `SmartBIServiceImpl.java` callers — chain analysis

```
SmartBIServiceImpl method               line  External callers
getExecutiveDashboard                   263   2 (alive — Dashboard endpoints)
getDashboardLLMInsights                 480   1 (alive — DashboardController:190)
getDashboardLLMInsightsCustomRange      528   1 (alive — DashboardController:212)
getComprehensiveAnalysis                570   ⚠️ 0 (DEAD — no internal or external caller)
processQuery                            621   1 (alive — AnalysisController.query)
processDrillDown                       1020   1 (alive — AnalysisController.drillDown)
generateAIInsights                     1279   ⚠️ 0 external, but 1 internal at line 516 inside getDashboardLLMInsights → ALIVE indirectly
```

| Region call site | Owning method | Caller liveness |
|---|---|---|
| `SmartBIServiceImpl.java:340` (`getRegionRanking`) | `getExecutiveDashboard` | ✅ ALIVE |
| `SmartBIServiceImpl.java:361` (`getRegionRanking`) | `getExecutiveDashboard` | ✅ ALIVE |
| `SmartBIServiceImpl.java:594` (`getRegionRanking`) | `getComprehensiveAnalysis` | ⚠️ DEAD-CHAIN |
| `SmartBIServiceImpl.java:595` (`getRegionTargetCompletion`) | `getComprehensiveAnalysis` | ⚠️ DEAD-CHAIN |
| `SmartBIServiceImpl.java:596` (`getGeographicHeatmapData`) | `getComprehensiveAnalysis` | ⚠️ DEAD-CHAIN |
| `SmartBIServiceImpl.java:597` (`getRegionOpportunityScores`) | `getComprehensiveAnalysis` | ⚠️ DEAD-CHAIN |
| `SmartBIServiceImpl.java:1576` (`getRegionRanking`) | `generateAIInsights` | ✅ ALIVE (indirect via Dashboard) |
| `SmartBIServiceImpl.java:1716` (`getRegionRanking`) | `generateAIInsights` | ✅ ALIVE (indirect) |
| `SmartBIServiceImpl.java:1720` (`getRegionDetail`) | `generateAIInsights` | ✅ ALIVE (indirect) |
| `SmartBIServiceImpl.java:1981` (`getRegionRanking`) | `generateAIInsights` | ✅ ALIVE (indirect) |
| `SmartBIServiceImpl.java:1985` (`getProvinceRanking`) | `generateAIInsights` | ✅ ALIVE (indirect) |
| `SmartBIServiceImpl.java:1990` (`getCityRanking`) | `generateAIInsights` | ✅ ALIVE (indirect) |

---

## 4. Classification + decision

| # | Method | Live callers | Dead-chain only | Classification |
|---|---|---|---|---|
| 1 | `getRegionRanking` | 8 | — | **KEEP** |
| 2 | `getProvinceRanking` | 2 | — | **KEEP** |
| 3 | `getCityRanking` | 2 | — | **KEEP** |
| 4 | `getRegionDetail` | 1 | — | **KEEP** |
| 5 | `getRegionTrendChart` | 0 | — | **REMOVABLE** |
| 6 | `getRegionTargetCompletion` | 0 | 1 (getComprehensiveAnalysis) | **REMOVABLE pending organizer call** |
| 7 | `getGeographicHeatmapData` | 0 | 1 (getComprehensiveAnalysis) | **REMOVABLE pending organizer call** |
| 8 | `getRegionOpportunityScores` | 0 | 1 (getComprehensiveAnalysis) | **REMOVABLE pending organizer call** |
| 9 | `getRegionProvinceTreemap` | 0 | — | **REMOVABLE** |
| 10 | `getAllRegions` | 0 | — | **REMOVABLE** |
| 11 | `getProvincesByRegion` | 0 | — | **REMOVABLE** |
| 12 | `getCitiesByProvince` | 0 | — | **REMOVABLE** |

**Tally**:
- 4 KEEP (chained to alive Dashboard / drillDown / query NOT_SAFE_FALLTHROUGH callers)
- 5 REMOVABLE NOW (truly zero callers)
- 3 REMOVABLE pending organizer call (only-called by `SmartBIServiceImpl.getComprehensiveAnalysis` which itself has 0 callers post-Sub-A)

---

## 5. ⚠️ Cross-Sub-batch finding — `SmartBIServiceImpl.getComprehensiveAnalysis` is dead post-Sub-A

`SmartBIServiceImpl.getComprehensiveAnalysis` (`SmartBIServiceImpl.java:570`) has **0 external callers** AND **0 internal callers** post-Sub-A's controller delete. It's a fully orphaned method that survived because Sub-A scoped to `controller/SmartBI*Controller.java` only, not `service/smartbi/impl/SmartBIServiceImpl.java`.

Three Region methods are in the same dead chain: `getRegionTargetCompletion` / `getGeographicHeatmapData` / `getRegionOpportunityScores` are called ONLY from `getComprehensiveAnalysis`.

This finding **affects multiple Sub-batches**:
- Sub-D (this PR — Region): 3 methods in the chain
- Sub-B (Sales): unverified — likely also has methods called from getComprehensiveAnalysis
- Sub-C (Department): unverified — `getDepartmentRanking` etc may share the chain
- Sub-E (Finance): unverified
- Sub-H (Inventory): unverified
- Sub-I (Procurement): unverified

**Cross-Sub coordination question for organizer**:

| Option | Description | Trade-off |
|---|---|---|
| **A** | Each Sub-batch removes its own dead-chain methods independently; `getComprehensiveAnalysis` is left as a partially-broken orphan that still references stubs across services until a follow-up PR removes it | Fast per-Sub progress; leaves dead code temporarily; risk of compile breakage if methods removed faster than the chain orphan |
| **B** | New Sub-batch `Sub-L` opened for `SmartBIServiceImpl.java` orphan cleanup (`getComprehensiveAnalysis` + any other dead public methods); each Sub-X keeps its dead-chain methods until Sub-L merges first | Cleaner; serializes dependency; slower but no half-deleted state |
| **C** | This PR (Sub-D) deletes the 3 dead-chain Region methods + `getComprehensiveAnalysis` itself + its dead-chain callers from sister services — out of scope expansion | Single-PR completeness; ⚠️ scope creep — touches files outside Sub-D mandate; risks Sub-B/C/E/H/I conflict |

**Recommendation**: Option B — open Sub-L for `SmartBIServiceImpl` orphan sweep separately. This Sub-D PR removes only the 5 truly-zero-caller methods now. The 3 dead-chain methods stay until Sub-L merges, then either Sub-D follow-up or Sub-L itself removes them.

Awaiting organizer decision before proceeding to source delete (§2.5).

---

## 6. Pre-removal scope summary (if Option A chosen — 8 methods)

If organizer chooses Option A (remove all 8 dead/dead-chain Region methods now), source delete scope:

- 8 public methods (~370 LOC body removed from the 1209 LOC file)
- N private helpers chased down (compile + post-edit grep determines exact count — likely 4-8 private helpers exclusively serving the 5 truly-removable methods; the 3 dead-chain methods may share helpers with KEEP'd methods)
- Interface `RegionAnalysisService.java` — 8 corresponding method declarations removed (~80 LOC)
- 0 test files (no Region test exists)

## 6'. Pre-removal scope summary (if Option B chosen — 5 methods)

5 public methods (~150 LOC body) + N private helpers + 5 interface declarations. Sub-L follow-up handles remaining 3.

---

## 7. Verification commands (for organizer cross-check)

Reviewer can re-derive every claim in this doc by running:

```bash
# Worktree base verification
git log --oneline -1 origin/main          # MUST equal 99772213aa or descendant of c8d509b8d1

# Public method enumeration (12 expected)
SVC=backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RegionAnalysisServiceImpl.java
grep -nE "^\s+(public|@Override\s+public)" "$SVC" | wc -l

# Caller sweep per method (replace <method>; expect counts in §2 above)
SRC=backend/java/cretas-api/src/main/java
INT=$SRC/com/cretas/aims/service/smartbi/RegionAnalysisService.java
SVCREL=com/cretas/aims/service/smartbi/impl/RegionAnalysisServiceImpl.java
INTREL=com/cretas/aims/service/smartbi/RegionAnalysisService.java
grep -rnE "\.getRegionRanking\(" "$SRC" | grep -v "$SVCREL" | grep -v "$INTREL" | wc -l   # expect 8
grep -rnE "\.getRegionTrendChart\(" "$SRC" | grep -v "$SVCREL" | grep -v "$INTREL" | wc -l   # expect 0
# ... (12 grep sweeps total)

# §5 dead-chain finding verification
grep -rnE "\.getComprehensiveAnalysis\(" "$SRC" | wc -l   # expect 0 (single self-declaration)

# Test file existence
find backend/java/cretas-api/src/test -name "*Region*"    # expect EMPTY
```

---

## 8. Predecessors

- PR #150 (T6.5 spec, Decision 4B amend) — §C.1.1 / §C.1.2 / §C.1.3 authoritative scope
- PR #178 (Phase A audit v3.1) — §3.1.a + §3.2.a service-shared classification
- PR #213 (Phase B 23-endpoint stub) — predecessor 410 stubs
- PR #227 (Phase C MO 8-chat parallel — this PR is Sub-D)
- PR #236 (Sub-A — 23 controller method declarations deleted) — base contains this commit `c8d509b8d1`

---

## 9. ⛔ STOP-and-ping organizer

Per Phase C MO §2.4 — audit-only commit shipped, no source delete yet. Pinging organizer with:

1. 5 truly-removable methods + 3 dead-chain methods (decision A/B/C needed per §5)
2. **Cross-sub finding**: `SmartBIServiceImpl.getComprehensiveAnalysis` orphan — affects coordination with Sub-B/C/E/H/I
3. Pre-flight build PASS at base; awaiting GO before source-removal step §2.5
