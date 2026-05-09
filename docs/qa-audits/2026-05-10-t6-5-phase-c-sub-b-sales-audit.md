# T6.5 Phase C Sub-B — `SalesAnalysisServiceImpl` method-level audit

**Date**: 2026-05-10
**Branch**: `ops-t6-5-phase-c-sub-b-sales` (worktree from `origin/main` HEAD `99772213aa`)
**Scope**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SalesAnalysisServiceImpl.java` + `service/smartbi/SalesAnalysisService.java` interface
**Predecessors**: PR #178 (Phase A audit v3.1), PR #150 (T6.5 spec amend, Decision 4B), PR #213 (Phase B 23-endpoint stubs), PR #236 (Sub-A — controller method declaration delete + orphan repo cleanup), PR #227 (Phase C marching order)

---

## §1 Objective

Per PR #227 marching order Sub-B, perform a method-level audit of `SalesAnalysisServiceImpl` against the post-Sub-A controller surface (4 NOT_SAFE_FALLTHROUGH endpoints — `/analysis/production`, `/analysis/quality`, `/query`, `/drill-down` — plus 11 `SmartBIDashboardController` endpoints). Identify dead public methods (0 reachable caller from a live controller) and stale private helpers, then delete in a single PR.

---

## §2 Method enumeration

`SalesAnalysisService` (interface) declares 8 public methods. `SalesAnalysisServiceImpl` mirrors all 8 plus 20 private helpers and 6 threshold constants.

| # | Public method (declared at line) | Returns |
|---|---|---|
| 1 | `getSalesOverview(factoryId, startDate, endDate)` (impl L80) | `DashboardResponse` |
| 2 | `getSalespersonRanking(factoryId, startDate, endDate)` (impl L371) | `List<RankingItem>` |
| 3 | `getSalespersonMetrics(factoryId, salespersonName, startDate, endDate)` (impl L404) | `List<MetricResult>` |
| 4 | `getProductRanking(factoryId, startDate, endDate)` (impl L491) | `List<RankingItem>` |
| 5 | `getProductDistributionChart(factoryId, startDate, endDate)` (impl L537) | `ChartConfig` |
| 6 | `getCustomerRanking(factoryId, startDate, endDate)` (impl L550) | `List<RankingItem>` |
| 7 | `getSalesTrendChart(factoryId, startDate, endDate, period)` (impl L599) | `ChartConfig` |
| 8 | `getSalespersonComparisonChart(factoryId, salespersonNames, startDate, endDate)` (impl L613) | `ChartConfig` |

Search command (reproducible):

```bash
grep -nE '^\s+public\s+\w' \
  backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SalesAnalysisServiceImpl.java
```

---

## §3 Per-method caller analysis

### §3.1 `getSalesOverview` — **KEEP**

Direct controller call sites:
- `SmartBIDashboardController.java:172` (`/dashboard/executive` legacy fallback when `smartBIService==null`)
- `SmartBIDashboardController.java:327` (`/dashboard/executive/custom`)
- `SmartBIDashboardController.java:389` (`/dashboard` unified, fallback path)
- `SmartBIAnalysisController.java:327` (`generateSalesQueryResponse` — invoked by alive `/query` endpoint for `QUERY_SALES_*` intents)

Transitive call sites (via alive `SmartBIServiceImpl`, OUT-OF-SCOPE but reachable from `/dashboard/*` and `/query`):
- `SmartBIServiceImpl.java:334, 359` (`getExecutiveDashboard`)
- `SmartBIServiceImpl.java:463` (`computeRestaurantDashboard` Gold-aware path)
- `SmartBIServiceImpl.java:512` (`getDashboardLLMInsights`)
- `SmartBIServiceImpl.java:579` (`getComprehensiveAnalysis` switch case `"sales"`)
- `SmartBIServiceImpl.java:1564` (`executeIntent` case `QUERY_SALES_OVERVIEW`)
- `SmartBIServiceImpl.java:1681, 1683` (`handlePeriodComparison`)

**Verdict**: KEEP. Directly used by 4 alive controller endpoints + reached transitively from `/query` and `/drill-down`.

### §3.2 `getSalespersonRanking` — **KEEP**

Direct controller call sites: none.

Transitive call sites (alive paths):
- `SmartBIServiceImpl.java:580` (`getComprehensiveAnalysis` case `"sales"`)
- `SmartBIServiceImpl.java:1567` (`executeIntent` case `QUERY_SALES_RANKING` — reachable from `/query`)
- `SmartBIServiceImpl.java:2069` (`processSalespersonDrillDown` — reachable from `/drill-down`)

**Verdict**: KEEP. Reached by `/query` (intent routing) and `/drill-down`.

### §3.3 `getSalespersonMetrics` — **KEEP**

Direct controller call sites: none.

Transitive call sites:
- `SmartBIServiceImpl.java:2071` (`processSalespersonDrillDown` filtered branch — reachable from `/drill-down` when `filterValue` is non-empty)

**Verdict**: KEEP. Single transitive caller, reachable from alive `/drill-down`.

### §3.4 `getProductRanking` — **KEEP**

Direct controller call sites: none.

Transitive call sites:
- `SmartBIServiceImpl.java:581` (`getComprehensiveAnalysis`)
- `SmartBIServiceImpl.java:1591` (`executeIntent` case `QUERY_PRODUCT_ANALYSIS` — reachable from `/query`)
- `SmartBIServiceImpl.java:2027` (`processProductDrillDown` — reachable from `/drill-down`)

**Verdict**: KEEP. Reached by `/query` and `/drill-down`.

### §3.5 `getProductDistributionChart` — **KEEP**

Direct controller call sites: none.

Transitive call sites:
- `SmartBIServiceImpl.java:2028` (`processProductDrillDown` — reachable from `/drill-down`)

**Verdict**: KEEP. Single transitive caller, reachable from alive `/drill-down`.

### §3.6 `getCustomerRanking` — **KEEP** (with caveat)

Direct controller call sites: none.

Transitive call sites:
- `SmartBIServiceImpl.java:582` (`getComprehensiveAnalysis` case `"sales"`)

⚠️ **Caveat**: `getComprehensiveAnalysis` itself has zero controller callers (`grep` confirms: only the interface declaration in `SmartBIService.java:78` and the impl at line 570 — no `Controller.java` referencing). It is dead code on `SmartBIServiceImpl`, but `SmartBIServiceImpl` is OUT-OF-SCOPE for Sub-B. Per the marching order's KEEP/DELETE rule (a sales method DELETEs only when it has 0 caller post-Sub-A), `getCustomerRanking` retains a real caller and stays. Flag for follow-up below (§6.1).

**Verdict**: KEEP (defer disposition until SmartBIService cleanup is scoped — likely T6.5 Phase D follow-up).

### §3.7 `getSalesTrendChart` — **KEEP**

Direct controller call sites: none.

Transitive call sites:
- `SmartBIServiceImpl.java:583` (`getComprehensiveAnalysis`)
- `SmartBIServiceImpl.java:1570` (`executeIntent` case `QUERY_SALES_TREND` — reachable from `/query`)
- `SmartBIServiceImpl.java:2055` (`processTimeDrillDown` — reachable from `/drill-down`)

**Verdict**: KEEP. Reached by `/query` and `/drill-down`.

### §3.8 `getSalespersonComparisonChart` — **DELETE**

Direct controller call sites: none.
Transitive call sites: none.
Test references: none (`grep -r 'SalesAnalysis\|salesAnalysis' src/test/java` returns no hits on this method).
Doc references: 1 explicit "NOT this endpoint" disclaimer in `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-trend-design.md:50` confirming it was already excluded from Phase 2A port scope.

**Verdict**: DELETE. 0 reachable callers anywhere in the repo, including tests. Safe to remove entirely.

Search command (reproducible — covers entire worktree):

```bash
grep -rn 'getSalespersonComparisonChart\|salespersonComparisonChart' \
  --include='*.java' --include='*.md' .
```

---

## §4 Private helper / dead-helper analysis

`SalesAnalysisServiceImpl` was refactored at some point to favor DB-aggregation helpers (`buildKpiFromAggregates`, `buildTrendChartFromAggregates`, `buildPieChartFromAggregates`, `buildRankingsFromAggregates`, `generateAiInsightsFromMetrics`, `generateSuggestionsFromMetrics`) over the older "load all rows, then iterate" helpers. The legacy helpers were left in place. Audit confirms 4 of them are now orphaned.

| Helper (declared at line) | Callers found by `grep -n` | Verdict |
|---|---|---|
| `convertToKPICards` (L674) | `getSalesOverview` (L140) | KEEP |
| `calculateKpiCards` (L725) | none | **DELETE** |
| `calculateSalespersonRankingFromData` (L813) | none | **DELETE** |
| `calculateSalespersonTargets` (L854) | `getSalespersonRanking` (L380), `calculateSalespersonRankingFromData` (L823 — itself deleted) | KEEP (still has L380 caller) |
| `buildSalesTrendChartFromData` (L868) | `getSalesTrendChart` (L606) | KEEP |
| `aggregateByDay` (L911) | `buildSalesTrendChartFromData` (L880) | KEEP |
| `aggregateByWeek` (L926) | `buildSalesTrendChartFromData` (L873) | KEEP |
| `aggregateByMonth` (L945) | `buildSalesTrendChartFromData` (L876) | KEEP |
| `buildProductPieChart` (L961) | `getProductDistributionChart` (L543) | KEEP |
| `generateAiInsights(salesData, kpiCards)` (L998) | none | **DELETE** |
| `generateSuggestions(salesData, kpiCards)` (L1088) | none | **DELETE** |
| `buildEmptyDashboard` (L1145) | `getSalesOverview` (L107, L122, L133) | KEEP |
| `calculateCompletionRate` (L1166) | many | KEEP |
| `determineCompletionAlertLevel` (L1176) | `buildKpiFromAggregates` (L231), `getSalespersonRanking` (L395), `calculateKpiCards` (L773 deleted), `calculateSalespersonRankingFromData` (L844 deleted) | KEEP (alive callers remain) |
| `determineCompletionAlertLevelEnum` (L1189) | `getSalespersonMetrics` (L445) | KEEP |
| `determineMarginAlertLevelEnum` (L1202) | `getSalespersonMetrics` (L466) | KEEP |
| `determineGrowthAlertLevel` (L1215) | `buildKpiFromAggregates` (L259), `calculateKpiCards` (L793 deleted) | KEEP (alive caller remains) |
| `determineChangeDirection` (L1228) | many | KEEP |
| `sumField` (L1244) | `getSalespersonMetrics`, `getSalespersonComparisonChart` (deleted), `calculateKpiCards` (deleted), `getSalespersonComparisonChart` again (deleted) | KEEP (still used by `getSalespersonMetrics`) |
| `formatCurrency` (L1255) | many | KEEP |

Distinguishing the dead pair from the kept aggregation variants:

- `generateAiInsights(salesData, kpiCards)` — **DELETE** — takes `List<SmartBiSalesData>` (raw rows) + `List<MetricResult>`; pre-aggregation legacy.
- `generateAiInsightsFromMetrics(metrics, totalSales, totalProfit, orderCount)` — **KEEP** — used by `getSalesOverview` L164.
- `generateSuggestions(salesData, kpiCards)` — **DELETE** — same shape as above; legacy.
- `generateSuggestionsFromMetrics(metrics, totalSales, totalTarget)` — **KEEP** — used by `getSalesOverview` L165.

Threshold constants (`TARGET_RED_THRESHOLD`, `TARGET_YELLOW_THRESHOLD`, `MARGIN_RED_THRESHOLD`, `MARGIN_YELLOW_THRESHOLD`, `GROWTH_RED_THRESHOLD`, `GROWTH_YELLOW_THRESHOLD`): all retain at least one alive caller (the `determine*AlertLevel*` helpers). KEEP all 6.

Imports: re-checked after the planned deletes. `java.time.DayOfWeek`, `java.time.temporal.TemporalAdjusters`, `java.util.stream.Collectors`, `java.util.*` all retain other usages. No import deletions required.

Search command (reproducible):

```bash
grep -nE 'calculateKpiCards|calculateSalespersonRankingFromData|generateAiInsights\(|generateSuggestions\(' \
  backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SalesAnalysisServiceImpl.java
```

---

## §5 Change manifest

### §5.1 `SalesAnalysisService.java` (interface)

Delete the `getSalespersonComparisonChart` declaration (and its preceding `// ==================== 对比分析 ====================` section banner block + Javadoc). Lines 142–156. The method is the only member in the section, so the whole "对比分析" block goes.

### §5.2 `SalesAnalysisServiceImpl.java`

Delete:

- §5.2.a — `// ==================== 对比分析 ====================` section + `getSalespersonComparisonChart(...)` method (impl L609–L667). Includes the preceding banner.
- §5.2.b — `calculateKpiCards(...)` private method (impl L723–L808 — 86 LOC) including its Javadoc `/** 计算 KPI 卡片 */`.
- §5.2.c — `calculateSalespersonRankingFromData(...)` private method (impl L810–L849 — 40 LOC) including its Javadoc `/** 从数据构建销售员排名 */`.
- §5.2.d — `generateAiInsights(salesData, kpiCards)` private method (impl L995–L1083 — 89 LOC) including its Javadoc `/** 生成 AI 洞察 */`.
- §5.2.e — `generateSuggestions(salesData, kpiCards)` private method (impl L1085–L1140 — 56 LOC) including its Javadoc `/** 生成建议 */`.

Total expected `-LOC`: ≈59 (interface §5.1) + 59 (§5.2.a) + 86 (§5.2.b) + 40 (§5.2.c) + 89 (§5.2.d) + 56 (§5.2.e) = **≈389 LOC delete**. No additions.

No method signature changes on KEEP methods. No import changes. No constant deletions.

---

## §6 Open follow-ups (out of Sub-B scope)

### §6.1 `getCustomerRanking` is downstream of dead `SmartBIServiceImpl.getComprehensiveAnalysis`

`getComprehensiveAnalysis` (declared in `SmartBIService.java:78`, impl at `SmartBIServiceImpl.java:570`) has zero controller callers but currently keeps `getCustomerRanking` alive (§3.6). Once `SmartBIService` itself enters scope for cleanup (likely a Phase D pass per PR #150), `getComprehensiveAnalysis` should be removed. At that point, `getCustomerRanking` becomes a 0-caller method and should be removed in the same PR or a follow-up to Sub-B.

Recommendation: file as a Phase D ticket (or as Sub-B' if Steve prefers an immediate sweep).

### §6.2 `SmartBIServiceImpl.executeIntent` switch-case stale

Per the long-form Javadoc inside `executeIntent` (L1538–L1551), this whole switch is a pre-Tool-Skill artifact slated for migration to `IntentExecutorService`. Until that migration ships, every case (`QUERY_SALES_OVERVIEW`, `QUERY_SALES_RANKING`, etc.) keeps the corresponding sales method alive. Sub-B does not preempt that migration.

---

## §7 Build / test plan

Per PR #227 marching order Step 5:

```bash
/c/tools/apache-maven-3.9.6/bin/mvn clean compile -DskipTests
/c/tools/apache-maven-3.9.6/bin/mvn test -Dtest=SmartBIRestaurantRoutingTest -DskipTests=false
```

Expectations:
- `mvn clean compile` PASS — only 5 deletions (4 unused private + 1 unused public + interface mirror), no signature changes on KEEP methods, so no upstream compile break.
- `SmartBIRestaurantRoutingTest` PASS — uses reflection on `SmartBIServiceImpl` private static field + private static method; entirely untouched by Sub-B.

---

## §8 Process discipline

- Worktree: `.worktrees/t6-5-phase-c-sub-b-sales` from `origin/main` HEAD `99772213aa` (`fix(soak-monitor): quote journalctl timestamp args …`, PR #238).
- Branch: `ops-t6-5-phase-c-sub-b-sales`.
- Commit will use `safe-commit.sh` (Rule 5b — paths-only mode) and pre-stage will be confirmed via `git status --short` before invoking commit.
- ⛔ STOP-and-ping organizer (Steve) BEFORE `git push` per memory `feedback_pause_before_deploy_or_push.md`.
- ⛔ HARD HOLD: Blue-Green prod deploy is organizer-owned (batch GO after all Sub-B…Sub-I ship) per memory `reference_blue_green_java_deploy.md`.
