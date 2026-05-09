# T6.5 Phase C Sub-F — `ProductionAnalysisServiceImpl` method-level audit

**Date**: 2026-05-10
**Branch**: `ops-t6-5-phase-c-sub-f-production`
**Base**: `origin/main` @ `99772213aa` (Sub-A merged via PR #236)
**Predecessor docs**:
- PR #178 audit v3.1 (`docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md`) — §3.1.a (`/analysis/production` is `NOT_SAFE_FALLTHROUGH`, alive Java)
- PR #150 spec §C.1.1 / §C.1.2 / §C.1.3 (Decision 4B refined scope)
- PR #199 (`spec(t6-6): /analysis/production endpoint port detail`) — Chat M re-verified `/analysis/production` is alive Java with mock data; future Phase B port (~mid-Aug 2026) requires `_JavaRandom` + `_java_string_hashcode` Day-0 gate.
- MO PR #227 §3 Sub-F (`docs/superpowers/dispatch/2026-05-15-t6-5-phase-c-method-level-audit-marching-order.md`) — "minimal scope expected; if 0 removable, ship doc-only PR".

---

## §1 Service surface (interface + impl)

`backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/ProductionAnalysisService.java` — 9 public methods declared.
`backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ProductionAnalysisServiceImpl.java` — 1121 LOC, 9 public methods + private helpers.

Public method enumeration (verified per memory rule `feedback_marching_order_method_name_grep.md`):

| # | Signature | Impl line |
|---|---|---|
| 1 | `DashboardResponse getOEEOverview(String factoryId, LocalDate startDate, LocalDate endDate)` | 76 |
| 2 | `List<MetricResult> getOEEMetrics(String factoryId, LocalDate startDate, LocalDate endDate)` | 126 |
| 3 | `List<MetricResult> getProductionEfficiency(String factoryId, LocalDate startDate, LocalDate endDate)` | 143 |
| 4 | `List<RankingItem> getProductionLineRanking(String factoryId, LocalDate startDate, LocalDate endDate)` | 210 |
| 5 | `List<MetricResult> getEquipmentUtilization(String factoryId, LocalDate startDate, LocalDate endDate)` | 221 |
| 6 | `List<RankingItem> getEquipmentRanking(String factoryId, LocalDate startDate, LocalDate endDate)` | 306 |
| 7 | `ChartConfig getDowntimeDistributionChart(String factoryId, LocalDate startDate, LocalDate endDate)` | 315 |
| 8 | `ChartConfig getOEETrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period)` | 326 |
| 9 | `ChartConfig getProductionLineComparisonChart(String factoryId, LocalDate startDate, LocalDate endDate)` | 336 |

---

## §2 Caller scan (per spec §C.1.3 step 2 + step 3)

Performed on `99772213aa` (post-Sub-A) main-source tree:

```
backend/java/cretas-api/src/main/java/
```

Test tree contains zero `ProductionAnalysisService*` references (no test file exists for this service):

```
$ grep -rn ProductionAnalysisService backend/java/cretas-api/src/test  → 0 matches
```

### §2.1 Per-method caller table

| # | Method | Total external caller hits | Caller locations | Caller liveness |
|---|---|---:|---|---|
| 1 | `getOEEOverview` | **3** | `controller/SmartBIDashboardController.java:546` (inside `enrichUnifiedDashboard` → `@GetMapping("/dashboard")`); `controller/SmartBIAnalysisController.java:106` (inside `getProductionAnalysis` default branch); `controller/SmartBIAnalysisController.java:377` (inside `generateProductionQueryResponse` → reachable from `@PostMapping("/query")`) | All 3 callers are HARD KEEP per spec §C.1.2 (`/dashboard`, `/analysis/production` `NOT_SAFE_FALLTHROUGH`, `/query` `NOT_SAFE_FALLTHROUGH`). |
| 2 | `getOEEMetrics` | **1** | `controller/SmartBIAnalysisController.java:96` (inside `getProductionAnalysis` `"oee"` branch) | HARD KEEP. |
| 3 | `getProductionEfficiency` | **1** | `controller/SmartBIAnalysisController.java:99` (inside `getProductionAnalysis` `"efficiency"` branch) | HARD KEEP. |
| 4 | `getProductionLineRanking` | **1** | `controller/SmartBIAnalysisController.java:100` (inside `getProductionAnalysis` `"efficiency"` branch) | HARD KEEP. |
| 5 | `getEquipmentUtilization` | **1** | `controller/SmartBIAnalysisController.java:102` (inside `getProductionAnalysis` `"equipment"` branch) | HARD KEEP. |
| 6 | `getEquipmentRanking` | **1** | `controller/SmartBIAnalysisController.java:103` (inside `getProductionAnalysis` `"equipment"` branch) | HARD KEEP. |
| 7 | `getDowntimeDistributionChart` | **1** | `controller/SmartBIAnalysisController.java:104` (inside `getProductionAnalysis` `"equipment"` branch) | HARD KEEP. |
| 8 | `getOEETrendChart` | **1** | `controller/SmartBIAnalysisController.java:97` (inside `getProductionAnalysis` `"oee"` branch) | HARD KEEP. |
| 9 | **`getProductionLineComparisonChart`** | **0** | (none) | **DEAD** — no caller in main + test trees. |

### §2.2 Verification commands (re-runnable)

```bash
SVC_DIR=backend/java/cretas-api/src/main/java
TST_DIR=backend/java/cretas-api/src/test/java

for m in getOEEOverview getOEEMetrics getProductionEfficiency \
         getProductionLineRanking getEquipmentUtilization getEquipmentRanking \
         getDowntimeDistributionChart getOEETrendChart \
         getProductionLineComparisonChart; do
    main_hits=$(grep -rnE "\.${m}\(" "$SVC_DIR" | \
                grep -v "service/smartbi/impl/ProductionAnalysisServiceImpl.java" | \
                grep -v "service/smartbi/ProductionAnalysisService.java" | wc -l)
    test_hits=$(grep -rnE "\.${m}\(" "$TST_DIR" | wc -l)
    echo "$m: main=$main_hits test=$test_hits"
done
```

Re-run output (HEAD `99772213aa`):

```
getOEEOverview: main=3 test=0
getOEEMetrics: main=1 test=0
getProductionEfficiency: main=1 test=0
getProductionLineRanking: main=1 test=0
getEquipmentUtilization: main=1 test=0
getEquipmentRanking: main=1 test=0
getDowntimeDistributionChart: main=1 test=0
getOEETrendChart: main=1 test=0
getProductionLineComparisonChart: main=0 test=0
```

---

## §3 Classification + decisions (per spec §C.1.3 step 3)

| # | Method | Classification | Action | Reason |
|---|---|---|---|---|
| 1 | `getOEEOverview` | KEEP | none | 3 alive callers (Dashboard composite + `/analysis/production` default + `/query` NL helper). |
| 2 | `getOEEMetrics` | KEEP | none | 1 alive caller (`/analysis/production` "oee" branch). |
| 3 | `getProductionEfficiency` | KEEP | none | 1 alive caller (`/analysis/production` "efficiency" branch). |
| 4 | `getProductionLineRanking` | KEEP | none | 1 alive caller (`/analysis/production` "efficiency" branch). |
| 5 | `getEquipmentUtilization` | KEEP | none | 1 alive caller (`/analysis/production` "equipment" branch). |
| 6 | `getEquipmentRanking` | KEEP | none | 1 alive caller (`/analysis/production` "equipment" branch). |
| 7 | `getDowntimeDistributionChart` | KEEP | none | 1 alive caller (`/analysis/production` "equipment" branch). |
| 8 | `getOEETrendChart` | KEEP | none | 1 alive caller (`/analysis/production` "oee" branch). |
| 9 | **`getProductionLineComparisonChart`** | **REMOVABLE** | **delete impl + interface decl** | 0 callers anywhere; was likely intended for a UI panel that never shipped. |

**Public method removal count: 1**
**Test method removal count: 0** (no test class exists for this service)

---

## §4 Private helper sweep (per spec §C.1.3 step 4)

The dead method body is:

```java
public ChartConfig getProductionLineComparisonChart(String factoryId, LocalDate startDate, LocalDate endDate) {
    log.info(...);
    List<Map<String, Object>> productionData = generateMockProductionData(factoryId, startDate, endDate);
    return buildProductionLineComparisonFromData(productionData);
}
```

It calls 2 private helpers — verified each remains in use by **alive** code post-deletion:

| Private helper | Used by alive callers? | Action |
|---|---|---|
| `generateMockProductionData(String, LocalDate, LocalDate)` | YES — called by `getOEEOverview` (line 80), `getOEEMetrics` (impl line 130), `getProductionEfficiency` (impl line ~150), `getEquipmentUtilization` (impl line ~225), all alive. | KEEP. |
| `buildProductionLineComparisonFromData(List<Map<String,Object>>)` | YES — called by `getOEEOverview` line 94 (`charts.put("production_line_comparison", buildProductionLineComparisonFromData(productionData))`), alive. | KEEP. |

**Private helper removal count: 0**

This matches the `getProductionLineComparisonChart` design — it was a thin wrapper around the same chart-building helper that `getOEEOverview` already aggregates into its `charts` map. The dead public method is genuinely orphan but its supporting helpers are not.

---

## §5 Removal plan

After organizer (Steve) GO per protocol §2.4:

### §5.1 `ProductionAnalysisService.java` (interface)

Remove the method declaration + its preceding Javadoc block (lines 247–257):

```
    /**
     * 获取产线 OEE 对比图表配置
     *
     * 返回柱状图或雷达图配置，对比多条产线的 OEE 表现。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 图表配置
     */
    ChartConfig getProductionLineComparisonChart(String factoryId, LocalDate startDate, LocalDate endDate);
```

### §5.2 `ProductionAnalysisServiceImpl.java` (impl)

Remove the method body + `@Override` + `@Transactional(readOnly = true)` annotations (lines 334–341):

```
    @Override
    @Transactional(readOnly = true)
    public ChartConfig getProductionLineComparisonChart(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取产线对比图表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<Map<String, Object>> productionData = generateMockProductionData(factoryId, startDate, endDate);
        return buildProductionLineComparisonFromData(productionData);
    }
```

### §5.3 No test removal

`grep -rn 'ProductionAnalysisService' backend/java/cretas-api/src/test` → 0 matches. Spec §C.2 mirroring rule produces 0 test deletes.

### §5.4 Post-edit verification (per protocol §2.6)

```bash
cd backend/java/cretas-api
mvn clean compile -DskipTests
mvn clean test -DskipTests=false
mvn clean package -DskipTests

# Sister-site sanity (per memory feedback_narrow_scope_fix_sister_site_sweep.md)
grep -rnE "\.getProductionLineComparisonChart\(" backend/java/cretas-api/src/main/java/ | wc -l
# Expected: 0
```

---

## §6 HARD KEEP confirmation (spec §C.1.2)

This audit does NOT touch:

- `controller/SmartBIAnalysisController.java` — `getProductionAnalysis` (NOT_SAFE_FALLTHROUGH) / `query` (NOT_SAFE_FALLTHROUGH) / `drillDown` (NOT_SAFE_FALLTHROUGH) stay.
- `controller/SmartBIDashboardController.java` — all 10 KEEP_FOR_COMPOSITE_DASHBOARD methods stay.
- `service/smartbi/impl/ProductionAnalysisServiceImpl.java` — the OTHER 8 public methods + all private helpers stay; class file stays.
- `service/smartbi/ProductionAnalysisService.java` — interface file stays; the OTHER 8 method declarations + 15 string constant declarations (`OEE`, `AVAILABILITY`, ...) stay.
- All Phase B detail-spec assumptions in PR #199 hold — the alive `/analysis/production` Java implementation continues to back the future Python port.

---

## §7 Summary

- **Public methods audited**: 9
- **Removable**: 1 (`getProductionLineComparisonChart`)
- **Tests removable**: 0 (no test class exists)
- **Private helpers chased + dead**: 0
- **Net source LOC change**: −20 (interface 11 + impl 8 + 1 blank line, approximate)
- **Risk**: minimal — no public API surface change visible to nginx-routed traffic; alive `/analysis/production` controller dispatch (4 branches × `oee` / `efficiency` / `equipment` / default) does not invoke this method.

Per MO §3 Sub-F: this audit found 1 removable (not 0), so a `feat(t6-5-phase-c-sub-f)` delete-PR is warranted rather than the audit-only fallback.

---

## §8 Open items / handoff

- ⛔ This audit doc is committed FIRST per protocol §2.4. **No source delete has been staged in this commit.** Awaiting organizer GO before `§5` removal lands in a follow-up commit on the same branch.
- After delete commit + post-edit verification gate (§5.4) green, push branch + open PR titled `feat(t6-5-phase-c-sub-f): ProductionAnalysisServiceImpl dead method delete` per Steve's dispatch.
- Phase B port (PR #199 successor, ~Aug 2026) does not need to mirror this dead method — Python port spec §1 already enumerates only the 8 alive surface; `getProductionLineComparisonChart` is correctly absent there.

---

**End of Sub-F audit.**
