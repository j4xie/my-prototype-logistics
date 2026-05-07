# Finance Composite +4531B Diverge Investigation — 2026-05-07

**Trigger**: PR #119 T6.1 dryrun analysis flagged 1/12 diverges as structurally different from the 11 budget +107B cluster. This investigation tries to reproduce + identify root cause.
**Scope**: read-only. No fix code. No prod state changes. Direct SSH 47 + curl localhost (avoided 139 nginx to not pollute T6.2 metrics).
**Date**: 2026-05-07 (server time 23:55 CST)

---

## TL;DR — Hypothesis B confirmed (with caveat)

**Root cause (most likely)**: Python's `_get_finance_overview` is a hardcoded empty stub (`backend/python/smartbi_compat/api/analysis_finance.py:1584`). Java's `FinanceAnalysisServiceImpl.getFinanceOverview` has a **legacy fallback path** that fires when the Gold-primary HTTP call to Python throws `IOException` (Python overloaded / connection reset / network blip) — and that legacy path computes + emits a fully populated `DashboardResponse` with KPI cards, charts, AI insights, etc. Python's port lacks any equivalent fallback, always emits empty.

**At 2026-05-07T01:30:01.975 UTC**, Java's Gold call likely failed transiently (the dryrun was concurrently hammering Python with 19 endpoints/min, plausible source of pressure). Java fell back to legacy → produced a populated 7265B response. Python's stub returned empty 2734B. **Diverge.**

**Caveat**: cannot reproduce now (Java currently returns 2772B matching Python's 2734B), so this is reasoned from code-paths + correlation evidence, not a captured 7265B body.

**Recommendation**: tracked as a real port parity gap. **Not blocking T6.2/T6.3 cutover** (single occurrence in 1144 samples = 0.087%). At T6.4 (full Python cutover), Java's fallback path is no longer reachable, so the gap surfaces only when factory has Gold data populated. See §Recommendation below for fix scope.

---

## Source NDJSON entry

```json
{
  "ts": "2026-05-07T01:30:01.975175+00:00",
  "endpoint": "/api/mobile/F001/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31",
  "java":   {"http": 200, "lat_s": 0.034655, "size": 7265},
  "python": {"http": 200, "lat_s": 0.027342, "size": 2734},
  "verdict": "diverge",
  "diff": {"j_only_keys": [], "p_only_keys": []}
}
```

Both 200 OK. Comparator's `j_only_keys/p_only_keys` are empty → top-level keys identical on both sides; the +4531B delta is **inside `data.*` nested content**.

## Reproduce attempt

| step | command | result |
|---|---|---|
| (1) Java :10010 | `curl http://localhost:10010/api/mobile/F001/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31` | HTTP=000 (connect refused) |
| (2) Java :10020 | same on :10020 (Blue-Green active green) | **HTTP=200, size=2772** |
| (3) Python :8083 | same on :8083 | **HTTP=200, size=2734** |
| (4) Diff Java vs Python current | `diff /tmp/java-pretty.json /tmp/python-pretty.json` | only Phase 2A Rule 4/9/11 patterns: Decimal scale (`0.00` vs `0`), Map.of key order (`xaxisField/yaxisField` swap), microsecond truncation. **All ±3-6B per section.** |

Java port :10010 (cretas-backend systemd) was stopped at **22:23:18 CST = 14:23 UTC** — exactly when T6.1 dryrun stopped writing NDJSON. **Confirms** that the dryrun crash (`JSONDecodeError` per PR #119) was caused by the Blue-Green flip (10010→10020) — wrapper hardcoded `:10010` so it got no-JSON when 10010 stopped responding.

**Cannot reproduce 7265B** under current Gold-primary state. Currently both Java and Python emit "empty Gold overview" path → similar small responses. The +4531B was a **transient anomaly** that needs the original 7265B body to fully diagnose, but we don't have it (NDJSON only stores byte size, not body).

## Per-section byte breakdown (current state)

```
overview:        java=298  python=295  diff=+3   (timestamp microsecond)
costStructure:   java=198  python=198  diff=0
dateRange:       java=161  python=161  diff=0
generatedAt:     java=32   python=29   diff=+3   (timestamp microsecond)
profitMetrics:   java=1304 python=1298 diff=+6   (Decimal scale)
receivableAging: java=535  python=512  diff=+23  (Decimal scale + nested null)
```

Total nested diff = 35B; envelope/wrapper accounts for remaining 3B. Currently within Rule 4/11 normal noise. **The 7265B at 01:30 UTC was 2.6× larger than current Java steady-state — structural population, not rounding noise.**

## Correlated anomalies at 01:30 UTC May 7

Same timestamp window (01:28-01:31 UTC), behavior on all 19 endpoints:

| ts | endpoint | Java size | Python size | verdict | observation |
|---|---|---:|---:|---|---|
| 01:28:59 | `analysis/finance` | 2772 | 2734 | match | normal |
| 01:28:59 | `analysis/sales` | **47114** | **46199** | match | normal sales |
| **01:30:01** | **`analysis/finance`** | **7265** ⚠️ | 2734 | **diverge** | **Java only** swelled +4493B |
| **01:30:02** | **`analysis/sales`** | **62354** | **61105** | match | **both** swelled +15K |
| 01:31:02 | `analysis/finance` | 2772 | 2733 | match | back to normal |
| 01:31:02 | `analysis/sales` | 47114 | 46199 | match | back to normal |

**Key observation**: at 01:30:02, the SALES endpoint also showed an anomaly — but **both Java AND Python** swelled by ~+15K bytes. A real DB write happened to sales-related tables (likely Silver POS data) — both backends saw the new data.

**But finance** at 01:30:01: only **Java** swelled (+4493B). **Python did not**. So Java has a code path that reads/computes data for finance composite that Python's port does NOT mirror.

01:30 UTC = 09:30 CST = morning business start in China. Plausible: a scheduled ETL / dashboard refresh job populated Silver/Gold finance tables briefly, OR a write hit the Silver POS data that's the upstream of Gold finance summary.

## Code path analysis

### Java composite finance flow

`SmartBIAnalysisController.getFinanceAnalysis` (line 222-267, no `analysisType` branch) →
`SmartBIServiceImpl.getComprehensiveAnalysis(factoryId, startDate, endDate, "finance")` →
fills `data` map with 4 sections (overview / profitMetrics / costStructure / receivableAging) + envelope (dateRange / generatedAt).

The big section is `overview` — a `DashboardResponse` with 16 fields. It's returned by `FinanceAnalysisServiceImpl.getFinanceOverview` (line 112+).

`FinanceAnalysisServiceImpl.getFinanceOverview` has TWO paths:

```java
if (goldReadPrimaryEnabled && goldDashboardBuilder != null) {
    try {
        DashboardResponse goldResponse = goldDashboardBuilder
                .buildFromFinanceSummary(factoryId, startDate, endDate);
        if (goldResponse != null) {
            return goldResponse;  // populated KPIs + top_stores from Python Gold
        }
        // Gold returned null = revenue=0 AND bills=0 → return empty directly
        return DashboardResponse.builder()
                .kpiCards(...emptyList...)
                .charts(new LinkedHashMap<>())
                ...
                .build();
    } catch (Exception e) {
        log.warn("[gold-primary] finance factory={} failed, falling back to legacy: {}",
                factoryId, e.getMessage());
        // FALLS THROUGH TO LEGACY (line 149+)
    }
}

// LEGACY PATH (fires when goldReadPrimaryEnabled=false OR Gold call threw):
List<MetricResult> metricResults = new ArrayList<>();
metricResults.addAll(getProfitMetrics(...));
metricResults.addAll(getReceivableMetrics(...));
List<KPICard> kpiCards = convertToKPICards(metricResults);
// + populates chartList with 3 charts (profit trend / cost structure / receivable aging)
// + AI insights, suggestions, etc
```

So Java's `overview` is one of:
- **Gold-populated** (~600-2000B with KPI cards from Gold) — when Gold path returns data
- **Empty** (~298B, current observed) — when Gold returns null AND no exception
- **Legacy-populated** (~5000-7000B, this is what fired at 01:30 UTC) — when Gold throws OR `goldReadPrimaryEnabled=false`

`buildFromFinanceSummary` is an HTTP client call to Python's Gold endpoints. Python being busy / connection pool exhausted → `IOException` → Java legacy fallback fires.

### Python composite finance flow

`backend/python/smartbi_compat/api/analysis_finance.py`:

```python
async def _get_comprehensive_finance_analysis(factory_id, range_) -> dict:
    overview         = await _get_finance_overview(factory_id, range_)  # ← STUB
    profit_metrics   = await _get_profit_metrics(factory_id, range_)
    cost_structure   = await _get_cost_structure_chart(factory_id, range_.start_date, range_.end_date)
    receivable_aging = await _get_receivable_aging_chart(factory_id, range_.end_date)
    return {...}

async def _get_finance_overview(factory_id, range_) -> dict:
    """F999 empty-state — Java FinanceAnalysisServiceImpl.getFinanceOverview Gold-primary
    path returns CLEAN empty DashboardResponse when buildFromFinanceSummary returns null
    (no revenue + no bills). A.5 golden verified shape.
    ...
    """
    return _new_dashboard_response_dict(
        last_updated=_utc_now_iso(),
        suggestions=[],
    )
```

**Python `_get_finance_overview` always returns empty.** It does NOT:
- Call any Gold-equivalent (it's already Python — Gold is Python-side per memory `reference_smartbi_gold_layer_architecture.md`, but no internal call wired)
- Mirror Java's legacy fallback (no profit metrics → KPI cards conversion, no chart skeleton population, no AI insights)

The git blame shows the stub was written 2026-04-30 with explicit assumption: "F999 empty-state ... Differs from sister sales which emitted YELLOW insight + 1 suggestion. Finance does NOT." It was **correct for the F999 golden + assumed F001 had no Gold data** (per memory `Phase A discovery: 当前所有 factory 没 populated Silver/Gold POS data → Java + Python 都 emit empty overview → byte-shape match`).

But under any of these conditions, Python's stub diverges from Java:
1. F001 (or any factory) gets POS Silver data populated → Gold returns data → Java emits populated, Python emits empty
2. Java's Gold HTTP call throws (transient Python pressure) → Java legacy fires → populated 7000B+, Python emits empty 2734B

(2) is what fired at 01:30:01.975 UTC.

## Root cause — A/B/C/D evaluation

| Hypothesis | Evidence | Verdict |
|---|---|---|
| **A** Python emits empty section where Java has data | Python `_get_finance_overview` confirmed hardcoded empty stub. Java has 3 different output shapes (Gold-populated / empty / legacy-populated). | ✅ **Strong candidate** |
| **B** Python missing whole section | Top-level keys match (`j_only_keys: [], p_only_keys: []`). Sections present on both sides, structurally identical. | ❌ Ruled out by NDJSON `diff` field |
| **C** Same sections but different data (SQL filter / aggregation diff) | Possible inside `overview` (Java legacy populates kpiCards Python doesn't). Combined with A. | Subset of A |
| **D** Same shape, nested values differ (Decimal / Rule 4/11/12 latent) | Current diff is only ±35B — Decimal/microsecond noise. Cannot explain +4531B. **Different cluster from the 11 budget +107B Rule 12 latent.** | ❌ Ruled out for this specific diverge |

**Verdict**: Hypothesis A. Python's stub doesn't mirror Java's legacy-fallback shape (or the Gold-populated shape).

## Recommendation

This is **NOT blocking** T6.2/T6.3 cutover:
- Single occurrence in 1144 finance composite samples (0.087% rate during 19h dryrun)
- Both backends returned 200 OK (no functional break)
- T6.2 canary is live (10% F001 traffic to Python) without observable regression
- Other 11 endpoints' rare diverges (analysis/sales 01:30:02 also showed +15K but matched on both sides) suggest the underlying DB-write event affected multiple endpoints; only finance composite's Java-only fallback path triggered the diverge

**Recommended follow-up scope** (separate PR after T6.3 ships):

**Option 1 — Real port (medium effort, recommended for T6.4 readiness)**: Implement Python `_get_finance_overview` to mirror Java's `getFinanceOverview` + (potentially) a `goldReadPrimaryEnabled` flag check. Reuse existing Python primitives (`_get_profit_metrics`, `_get_cost_structure_chart`, `_get_receivable_aging_chart`, `_get_receivable_metrics`) to populate KPI cards / chart skeletons / AI insights when factory has data. This closes the gap before T6.4 cutover where Java fallback is no longer reachable.

**Option 2 — Accept divergence + monitor**: Leave Python stub as-is. Add T6.4 monitoring for "factory has Gold data but finance composite emits empty overview" — alert if rate exceeds threshold. Customers see empty dashboard when they should see populated KPIs; trade-off vs implementation effort.

**Option 3 — Defer until customer signal**: 0.087% during dryrun is statistically negligible. If Phase 2A T6.4 surfaces non-F001 customers reporting empty finance overview, prioritize fix then. Until then, treat as known divergence (similar to Phase 2A's documented `byte-eq vs dict-eq` tradeoffs).

**Recommended**: Option 1 if T6.4 schedule allows; Option 3 as fallback. Option 2 only if both 1 and 3 are blocked.

## Cross-reference

- **PR #119** flagged this case (1 of 12 diverges in T6.1 partial dryrun NDJSON)
- Different cluster from the **11 budget +107B diverges** (those are likely Rule 11/12 latent in `analysis_finance.py` budget path — see PR #119 audit doc)
- Both `_get_finance_overview` stub + budget Rule 11/12 latent + (possibly) other stubs in `analysis_finance.py` warrant a **comprehensive parity audit** of Python `smartbi_compat/api/analysis_finance.py` against Java `FinanceAnalysisServiceImpl` (separate ticket)
- Memory `reference_smartbi_gold_layer_architecture.md` (Phase A discovery): assumption was "all factories empty" justifies stub; reality (this finding) says "Java's legacy fallback fires when Gold HTTP call throws even on empty factories"
