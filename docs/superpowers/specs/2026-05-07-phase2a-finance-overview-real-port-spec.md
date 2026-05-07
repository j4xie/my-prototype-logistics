# Phase 2A — Finance Overview Real Port Spec (Pattern B fix)

**Date**: 2026-05-07
**Trigger**: PR #124 chat 2 investigation — Pattern B (Java legacy fallback path that Python's port omits) requires real port for T6.4 readiness.
**Scope**: Phase A spec discovery only. PR-B impl + PR-C tests are separate scope (estimate ~半天 sister-chat).
**Reference**: PR #124 (`f356e3168`), task #24 spec discovery pattern (`docs/superpowers/specs/2026-05-07-phase2a-finance-past-year-fallback-spec.md`).

---

## TL;DR

Port Java `FinanceAnalysisServiceImpl.getFinanceOverview` legacy fallback path (`backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java:149-189`) into Python `_get_finance_overview` (`backend/python/smartbi_compat/api/analysis_finance.py:1584`), replacing the current empty stub. **All 7 needed primitives already exist in Python**; only 3 small composer helpers need to be added. PR-B impl estimated **~150-250 LOC** (smaller than typical Phase 2A port due to high primitive reuse).

---

## 1. Context

### 1.1 Java side — legacy fallback path

`FinanceAnalysisServiceImpl.getFinanceOverview(factoryId, startDate, endDate)` has THREE possible response shapes depending on `goldReadPrimaryEnabled` flag and Gold call result:

```java
// FinanceAnalysisServiceImpl.java:111-189

if (goldReadPrimaryEnabled && goldDashboardBuilder != null) {
    try {
        DashboardResponse goldResponse = goldDashboardBuilder
                .buildFromFinanceSummary(factoryId, startDate, endDate);
        if (goldResponse != null) {
            return goldResponse;          // STATE A: Gold-populated (~1000-2000B)
        }
        return DashboardResponse.builder()
                .kpiCards(emptyList())
                .charts(new LinkedHashMap<>())
                .rankings(new LinkedHashMap<>())
                .aiInsights(new ArrayList<>())
                .suggestions(new ArrayList<>())
                .lastUpdated(LocalDateTime.now())
                .build();                  // STATE B: empty (~298B, current Python parity)
    } catch (Exception e) {
        log.warn("[gold-primary] failed, falling back to legacy");
        // FALLS THROUGH to STATE C ↓
    }
}

// STATE C: legacy fallback (~5000-7000B) — line 149-189
List<MetricResult> metricResults = new ArrayList<>();
metricResults.addAll(getProfitMetrics(factoryId, startDate, endDate));        // 5 metrics
metricResults.addAll(getReceivableMetrics(factoryId, endDate));               // 5 metrics
List<KPICard> kpiCards = convertToKPICards(metricResults);                    // 10 cards

List<ChartConfig> chartList = new ArrayList<>();
chartList.add(getProfitTrendChart(factoryId, startDate, endDate, "MONTH"));
chartList.add(getCostStructureChart(factoryId, startDate, endDate));
chartList.add(getReceivableAgingChart(factoryId, endDate));
Map<String, ChartConfig> charts = new LinkedHashMap<>();
for (ChartConfig chart : chartList) {
    charts.put(chart.getTitle().replace(" ", "_"), chart);                    // key = title
}

List<RankingItem> overdueRankings = getOverdueCustomerRanking(factoryId, endDate);
Map<String, List<RankingItem>> rankings = new LinkedHashMap<>();
rankings.put("overdue_customers", overdueRankings);

List<AIInsight> aiInsights = generateFinanceInsights(metricResults, overdueRankings);
List<String> suggestions = generateFinanceSuggestions(metricResults, overdueRankings);

fireGoldShadowRead(factoryId, startDate, endDate);  // fire-and-forget; logs only

return DashboardResponse.builder()
        .kpiCards(kpiCards)
        .charts(charts)
        .rankings(rankings)
        .aiInsights(aiInsights)
        .suggestions(suggestions)
        .lastUpdated(LocalDateTime.now())
        .build();
```

**Per-state response sizes** (per PR #124 reproduce):
- **State A** (Gold-populated, restaurant POS factories): observed Gold response shape with 4 KPIs (total_revenue / bill_count / avg_bill_value / store_count) + top_stores rankings. Restaurant-specific.
- **State B** (empty): observed at 2772B vs Python current 2734B. Currently parity match (the 7 fields that diverge are Rule 4/9/11 noise).
- **State C** (legacy populated): observed once at 7265B during T6.1 dryrun (PR #119). 4493B larger than State B due to populated kpiCards / charts / rankings / aiInsights / suggestions.

**Gold-primary fail trigger conditions**:
- Python overload (concurrent dryrun stress hammering Python at 19 endpoints/min)
- Network blip / connection reset between Java and Python
- Python service restart during a request
- `goldReadPrimaryEnabled=false` config (skips State A/B entirely → always State C)

PR #124 confirmed: at 2026-05-07T01:30:01.975 UTC, Java's Gold HTTP call to Python threw `IOException` → Java fell to State C → +4493B vs Python's State B stub.

### 1.2 Python side — current empty stub

`backend/python/smartbi_compat/api/analysis_finance.py:1584-1597`:

```python
async def _get_finance_overview(factory_id: str, range_: DateRange) -> dict:
    """F999 empty-state — Java FinanceAnalysisServiceImpl.getFinanceOverview Gold-primary
    path returns CLEAN empty DashboardResponse when buildFromFinanceSummary returns null
    (no revenue + no bills). A.5 golden verified shape.

    Differs from sister sales which emitted YELLOW insight + 1 suggestion. Finance does NOT.
    Golden shows: kpiCards=[], metricCards=null, rankings={}, charts={}, chartList=null,
    aiInsights=[], alerts=null, recommendations=null, suggestions=[], generatedAt=null,
    lastUpdated=volatile, fromCache=false, cacheExpireAt=null.
    """
    return _new_dashboard_response_dict(
        last_updated=_utc_now_iso(),
        suggestions=[],
    )
```

**Python only emits State B**, regardless of factory data state. Missing State A and State C entirely. PR #124's investigation surfaced this as a real port gap.

### 1.3 Existing Python primitives (high reuse)

All 7 sub-primitives needed by the legacy path **already exist** in `backend/python/smartbi_compat/api/analysis_finance.py`:

| Java legacy call | Python primitive | Line | Returns |
|---|---|---:|---|
| `getProfitMetrics(factoryId, startDate, endDate)` | `_get_profit_metrics(factory_id, range_)` | 1600 | `list[dict]` of 5 MetricResult dicts |
| `getReceivableMetrics(factoryId, endDate)` | `_get_receivable_metrics(factory_id, end_date)` | 2153 | `list[dict]` of 5 MetricResult dicts |
| `getProfitTrendChart(factoryId, ...)` | `_get_profit_trend_chart(factory_id, ...)` | 1940 | `dict` ChartConfig |
| `getCostStructureChart(factoryId, ...)` | `_get_cost_structure_chart(factory_id, ...)` | 2000 | `dict` ChartConfig |
| `getReceivableAgingChart(factoryId, end)` | `_get_receivable_aging_chart(factory_id, end)` | 2105 | `dict` ChartConfig |
| `getOverdueCustomerRanking(factoryId, end)` | `_get_overdue_customer_ranking(factory_id, end)` | 2251 | `list[dict]` RankingItem dicts |
| KPICard / MetricResult / AIInsight / RankingItem DTO factories | `_new_kpi_card_dict` / `_new_metric_result_dict` / `_new_ai_insight_dict` / `_new_ranking_item_dict` | 341 / 1329 / 321 / 190 | `dict` matching Java shape |

### 1.4 Missing Python helpers (must add in PR-B)

3 small composer helpers needed (none of these exist in Python today):

1. **`_convert_metrics_to_kpi_cards(metrics: list[dict]) -> list[dict]`**
   Mirror Java `convertToKPICards` (line 1372-1418). Maps each MetricResult dict → KPICard dict via:
   - `key = metric.metricCode`
   - `title = metric.metricName`
   - `rawValue = metric.value`
   - `value = metric.formattedValue || str(metric.value) || "-"`
   - `unit = metric.unit`
   - `change = metric.changeValue`
   - `changeRate = metric.changePercent`
   - `trend = "up" if changeDirection=="UP" else "down" if "DOWN" else "flat"`
   - `status = "red" if alertLevel=="RED" else "yellow" if "YELLOW" else "green"`
   - `description = metric.description`

2. **`_generate_finance_insights(metrics: list[dict], rankings: list[dict]) -> list[dict]`**
   Mirror Java `generateFinanceInsights` (line 1659-1711). Conditional logic:
   - If `GROSS_MARGIN` metric is RED → emit RED insight "毛利率偏低" with formatted value in message
   - If `AGING_90_RATIO` metric is RED → emit RED insight "应收账款风险预警"
   - If `rankings` non-empty AND any RED ranking item → emit YELLOW insight "高风险客户" with red count
   - Fixed Chinese strings (verbatim from Java source)

3. **`_generate_finance_suggestions(metrics: list[dict], rankings: list[dict]) -> list[str]`**
   Mirror Java `generateFinanceSuggestions` (line 2085-2114). Per-metric switch:
   - `GROSS_MARGIN` RED → "建议审视产品定价策略，优化采购成本以提升毛利率"
   - `AGING_90_RATIO` RED → "建议对90天以上逾期客户启动专项催收，必要时考虑法律手段"
   - `COLLECTION_RATE` RED → "建议加强应收账款管理，缩短回款周期"
   - `BUDGET_EXECUTION` RED → "预算超支严重，建议立即审核支出合理性并控制后续开支"
   - If empty → ["财务指标整体健康，建议继续保持良好的成本控制和收款管理"]

---

## 2. Implementation plan

### 2.1 PR-A — this spec (this PR)

Doc-only. Scope: spec at `docs/superpowers/specs/2026-05-07-phase2a-finance-overview-real-port-spec.md`. **No code changes.**

### 2.2 PR-B — real port impl

Replace empty stub `_get_finance_overview` (line 1584) with a populated body that mirrors Java legacy fallback (State C).

**Files modified**: 1
- `backend/python/smartbi_compat/api/analysis_finance.py` (~150-250 LOC added)

**LOC breakdown**:
- `_convert_metrics_to_kpi_cards` ~30 LOC
- `_generate_finance_insights` ~50 LOC
- `_generate_finance_suggestions` ~30 LOC
- `_get_finance_overview` rewrite ~40-60 LOC (calls primitives + composers, builds DashboardResponse dict)

**Pseudocode** (PR-B impl skeleton — informational only, NOT in this PR):

```python
async def _get_finance_overview(factory_id: str, range_: DateRange) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.getFinanceOverview legacy path
    (line 149-189). Replaces former empty stub per PR #124 finding."""

    # Step 1: gather metrics (Java line 150-153)
    profit_metrics = await _get_profit_metrics(factory_id, range_)
    receivable_metrics = await _get_receivable_metrics(factory_id, range_.end_date)
    metric_results = profit_metrics + receivable_metrics
    kpi_cards = _convert_metrics_to_kpi_cards(metric_results)

    # Step 2: gather charts (Java line 156-163)
    chart_list = [
        await _get_profit_trend_chart(factory_id, range_.start_date, range_.end_date, "MONTH"),
        await _get_cost_structure_chart(factory_id, range_.start_date, range_.end_date),
        await _get_receivable_aging_chart(factory_id, range_.end_date),
    ]
    charts = {chart["title"].replace(" ", "_"): chart for chart in chart_list}

    # Step 3: rankings (Java line 166-168)
    overdue_rankings = await _get_overdue_customer_ranking(factory_id, range_.end_date)
    rankings = {"overdue_customers": overdue_rankings}

    # Step 4: insights + suggestions (Java line 171-174)
    ai_insights = _generate_finance_insights(metric_results, overdue_rankings)
    suggestions = _generate_finance_suggestions(metric_results, overdue_rankings)

    # Step 5: fireGoldShadowRead is fire-and-forget log-only — Python skips
    # (Python is the Gold layer per memory reference_smartbi_gold_layer_architecture.md)

    return _new_dashboard_response_dict(
        kpi_cards=kpi_cards,
        charts=charts,
        rankings=rankings,
        ai_insights=ai_insights,
        suggestions=suggestions,
        last_updated=_utc_now_iso(),
    )
```

### 2.3 PR-C — tests + goldens

**Files added/modified**:
- `tests/fixtures/java-smartbi-golden/analysis-finance-overview-{F999|F001}-legacy.json` — record from Java :10020 `goldReadPrimaryEnabled=false` path (or any factory where Gold returns empty triggering legacy fallback)
- `tests/test_analysis_finance.py` (or new `test_finance_overview.py`) — byte-shape parity tests against goldens, edge cases (empty data / partial data / RED metrics / YELLOW metrics)

**Estimated**: ~100-200 LOC test code + 1-2 golden JSON files.

---

## 3. Risk + edge cases

### 3.1 Java legacy fallback trigger conditions (PR-B's port responsibility)

Java falls to State C (legacy) under any of:
- (a) `goldReadPrimaryEnabled=false` config
- (b) `goldReadPrimaryEnabled=true` BUT `goldDashboardBuilder=null` (Spring DI miss)
- (c) `goldDashboardBuilder.buildFromFinanceSummary` throws any exception (HTTP fail, timeout, JSON parse error, etc)

Python's port has NO Gold-primary HTTP self-call (Python IS the Gold producer per `reference_smartbi_gold_layer_architecture.md`). Therefore Python should ALWAYS emit the State C shape — the legacy-equivalent populated DashboardResponse — regardless of factory data state.

### 3.2 Factory data state matrix

| Factory data state | Legacy path behavior | Python port output |
|---|---|---|
| **No revenue, no bills, no AR data** | Empty profit metrics (5 zero metrics), empty receivable metrics (5 zero metrics), empty charts (3 empty chart skeletons), empty rankings, empty insights, fixed-string "财务指标整体健康..." suggestion | Populated shape with **zero-valued KPI cards** + **chart skeletons** + **healthy-message suggestion**. ~3000-4000B (much bigger than current empty stub's 2734B). |
| **Has revenue/cost (REVENUE/COST records)** | Populated profit metrics (real values), profit trend chart with data points, possibly RED gross_margin → insight | Populated KPIs with real values + populated chart data + conditional RED insights |
| **Has AR data (collection records)** | Populated receivable metrics, aging chart with bucket data, overdue ranking | Populated AR metrics + aging chart + ranking |
| **All categories populated** | Full ~5000-7000B (matches PR #124 observed 7265B) | Full ~5000-7000B parity |

### 3.3 Decimal / Date / Map.of patterns (Phase 2A Rules cross-check)

Per `.claude/rules/python-java-port.md`:
- **Rule 4** (Decimal serialization): `_decimal_to_number` already used in Python primitives (`_get_profit_metrics`, `_get_receivable_metrics`). New helpers (`_convert_metrics_to_kpi_cards`) must pass through values without re-wrapping.
- **Rule 8** (Map.of key order): The `charts` map uses `LinkedHashMap` (Java line 160) → Python dict insertion order is fine (no Map.of(N) hash quirks). Order = order of `chartList.add()` calls = profit trend / cost structure / receivable aging.
- **Rule 9** (Lombok DTO emit): KPICard.java / MetricResult.java / AIInsight.java / RankingItem.java DTO factories already in Python (lines 341 / 1329 / 321 / 190) and verified parity.
- **Rule 11** (LocalDateTime trailing-zero microsecond): Python's `_utc_now_iso()` should already use `_java_isoformat`. Verify in PR-B impl.
- **Rule 12** (HALF_UP vs banker's): N/A in this composition path — `_convert_metrics_to_kpi_cards` only passes through pre-formatted strings from primitives. The display-formatting Rule 12 risk is in the upstream primitives, not the composer.

### 3.4 Distinction from PR #122 Pattern A (chat 1)

| | Pattern A (PR #122 H1) | Pattern B (this spec) |
|---|---|---|
| Endpoint | `/analysis/finance?analysisType=budget` (per-type) | `/analysis/finance` (composite, no analysisType) |
| Diverge size | +105…+108B per sample | +4531B (single sample observed) |
| Comparator verdict | diverge under strict-byte, **dict-eq tolerates** (Java `0.00` vs Python `0` Rule 4 expected) | diverge — top-level keys match but sections differ in size |
| Root cause | Decimal serialization trailing-zero (Rule 4 candidate latent) | Java legacy fallback Python omits (this spec) |
| Fix scope | Officialize Rule (chat 1 PR pending) | Real port (this spec PR-B) |

Both findings live in same file (`analysis_finance.py`) but address completely different bugs. Implementing this spec does NOT close PR #122.

### 3.5 Gold-populated path (State A) — explicitly OUT OF SCOPE

This spec covers ONLY State C (legacy fallback). State A (Gold-populated, restaurant POS factories with `top_stores` ranking) is a separate concern:
- Trigger: factory uploads POS Excel → Silver POS data → Gold finance-summary aggregates fire → KPIs from Gold
- Currently unreachable (no factories have populated POS data per memory `reference_smartbi_gold_layer_architecture.md`)
- Port would need to call Python's Gold finance-summary endpoint internally (or directly query Gold tables)
- Spec scope: deferred until Phase B trigger (factory uploads POS Excel) or T6.4 surfaces non-F001 divergence

### 3.6 Other sub-endpoints (profit / cost / payable / receivable / budget per-type) — explicitly OUT OF SCOPE

These have separate Python ports (`_get_profit_analysis`, `_get_cost_analysis`, `_get_payable_analysis`, `_get_receivable_analysis`, `_get_budget_analysis` at lines 2538-2964 in `analysis_finance.py`). They have their own diverges (e.g. PR #122 H1 budget +107B Rule 4 candidate). Out of scope for this spec.

### 3.7 Schema changes — explicitly OUT OF SCOPE

No DB migrations. No new tables. Pure code-level port reusing existing Silver/Gold queries.

### 3.8 fireGoldShadowRead fire-and-forget — explicitly OUT OF SCOPE

Java's `fireGoldShadowRead` (line 200-215) asynchronously calls Python Gold via `goldFinanceClient.fetchFinanceSummary` and logs the result for offline divergence review. Python is the Gold producer — there's no equivalent to mirror. Skip entirely.

---

## 4. Reproducible test method

### 4.1 Trigger Java fallback for golden recording (PR-C)

Approach 1 — config flip:
```bash
# Disable Gold-primary in Java config to force legacy path on every call
# (test env only; never on prod)
ssh root@47.100.235.168 "
  echo 'smartbi.gold.read-primary.enabled=false' >> /www/wwwroot/cretas/.env.test
  systemctl restart cretas-backend-test
"
# Then record:
./scripts/record-java-golden.sh F999 F999 \
  '/api/mobile/F999/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31' \
  > tests/fixtures/java-smartbi-golden/analysis-finance-overview-F999-legacy.json
# Restore:
ssh root@47.100.235.168 "
  sed -i '/smartbi.gold.read-primary.enabled=false/d' /www/wwwroot/cretas/.env.test
  systemctl restart cretas-backend-test
"
```

Approach 2 — find a factory where Gold returns empty + Gold call deterministically empty (Python returns null for revenue=0+bills=0). Java still hits the empty branch (State B), NOT legacy. So Approach 1 is required to record State C.

Approach 3 — record from production Java :10020 during a high-load window where Gold throws (impractical, transient).

**Recommended**: Approach 1 in test env (port 10011) only. Record 2 goldens: F999 (empty data) and F001 (with data) for parity-test variety.

### 4.2 Byte-shape parity test (PR-C)

```python
@pytest.mark.parametrize("factory_id,golden_file", [
    ("F999", "tests/fixtures/java-smartbi-golden/analysis-finance-overview-F999-legacy.json"),
    ("F001", "tests/fixtures/java-smartbi-golden/analysis-finance-overview-F001-legacy.json"),
])
async def test_finance_overview_byte_shape_parity(factory_id, golden_file, ...mocks):
    expected = json.load(open(golden_file))
    actual = await _get_finance_overview(factory_id, DateRange.custom(...))
    assert actual == expected["data"]["overview"]  # dict-eq gate per Phase 2A
```

### 4.3 Edge case unit tests (PR-C)

| Case | Mock setup | Expected |
|---|---|---|
| Empty data | `_query_finance_data` returns `[]` | 10 zero-value KPIs, 3 empty chart skeletons, empty rankings, empty insights, healthy-message suggestion |
| RED gross_margin | `_get_profit_metrics` returns 1 metric with `alertLevel="RED"` and `metricCode="GROSS_MARGIN"` | 1 RED insight + 1 specific suggestion |
| RED aging_90 | similar | 1 RED insight + 1 specific suggestion |
| Multiple RED | both gross_margin RED + aging_90 RED | 2 RED insights + 2 suggestions |
| Overdue rankings with RED items | mock 3 rankings, 2 RED | 1 YELLOW "高风险客户" insight with `redCount=2` |

---

## 5. Out of scope

- ❌ State A (Gold-populated path with top_stores ranking — restaurant POS factories)
- ❌ Other sub-endpoints (`profit`/`cost`/`payable`/`receivable`/`budget` per-type)
- ❌ Schema changes (no migrations)
- ❌ `fireGoldShadowRead` log-only emulation
- ❌ Existing primitive modifications (`_get_profit_metrics` etc — reuse only, don't modify)
- ❌ PR #122 H1 budget +107B Rule 4 fix (different sub-endpoint, different bug)
- ❌ Wrapper hardcoded `:10010` fix (PR #119 bonus finding — separate follow-up)

---

## 6. Acceptance criteria for PR-B

- [ ] `_get_finance_overview` no longer returns empty stub for non-empty factories
- [ ] All 3 new helpers (`_convert_metrics_to_kpi_cards`, `_generate_finance_insights`, `_generate_finance_suggestions`) implemented per spec §1.4
- [ ] No modification to existing primitives (`_get_profit_metrics`, `_get_receivable_metrics`, `_get_*_chart`, etc.)
- [ ] No new pip dependencies
- [ ] Phase 2A rules (4/8/9/11) compliance verified in PR-B reviewer audit
- [ ] PR-C golden parity test passes against F999 + F001 legacy goldens
- [ ] PR-C edge case unit tests cover all rows in §4.3 table

---

## 7. Parallel work suggestion

**Subagent within single chat**: ❌ Not applicable — PR-B is a single-file modification, sequential edits work fine.
**Multi-chat**: ✅ PR-B impl + PR-C tests can be one chat (recommended) OR split (PR-B impl chat + PR-C test chat). Test golden recording requires server access which is shared resource — coordinate via marching order.

---

## 8. References

- PR #124 investigation: `docs/qa-audits/2026-05-07-finance-composite-diverge-investigation.md`
- PR #119 T6.1 dryrun analysis: `docs/qa-audits/2026-05-08-t6-1-dryrun-analysis.md`
- Phase 2A Rules: `.claude/rules/python-java-port.md` (Rules 4/8/9/11/12)
- Java implementation: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java:111-189`
- Python current stub: `backend/python/smartbi_compat/api/analysis_finance.py:1584-1597`
- Memory: `reference_smartbi_gold_layer_architecture.md` (Gold layer is Python-side)
- Memory: `reference_blue_green_java_deploy.md` (10010↔10020 Blue-Green confirms PR #124 bonus finding)
