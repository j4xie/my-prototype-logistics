# SmartBI KPI Card UX Optimization Plan

**Date**: 2026-04-25
**Discovered by**: Real-window Playwright verification of agg_strategy persistence work (Task B, commit `d802f52fa`)
**Source plan**: `docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md` (Task C)

---

## Background

The Apr 25 agg_strategy persistence work added `aggStrategy` (sum/mean/none) to `smart_bi_pg_field_definitions`, fed it through Python `/api/insight/quick-summary`, and made `getSmartKPIs` (`web-admin/src/api/smartbi/analysis.ts:551`) honor it. Goal: ID columns get filtered out of KPI cards, rating columns become "平均X = 4.83 分".

Real-window Playwright test on prod (qhj_prod / RES_3101_009) on Apr 24:
- Upload **4172** (qhj_q3_real.xlsx, 12,903 review rows): **PASS** — 4 KPI cards rendered, 3 of 4 are 平均 ratings (服务/星级/环境). The 4th card is broken (PROD-2).
- Upload **4169** (qhj_order_detail.csv, 200,003 POS rows): **FAIL** — full enrichment timed out at 120s, FE shows red toast + "该 Sheet 暂无可分析的数据" empty state. The agg_strategy work is invisible to all POS users on this page.

This plan documents root causes + ranked fix options so the user can prioritize.

---

## Issues + Root Causes

### PROD-1 (P0): SmartBI Analysis enrichment times out for large uploads

**Symptom**: Upload 4169 (200K POS rows) → 2 red toasts "timeout of 120000ms exceeded" + empty state. Customer never sees KPIs/charts/AI insights for the most common upload type.

**Root cause**: The FE enrichment pipeline at `web-admin/src/api/smartbi/analysis.ts:1395-1810` runs in series: cache check → load 2000 rows from Java → quickSummary (Python) **AND in parallel** smartRecommendChart (Python LLM) → recommendChart fallback (Python LLM) → buildChartPlan → batchBuildCharts (Python LLM per chart) → generateInsights stream (Python LLM). The slowest single hop is **smartRecommendChart**, measured at **~28s on prod for trivial input** (`/api/chart/smart-recommend`, see investigation log). With 6 LLM calls in series, p95 easily exceeds 120s.

**Why 4172 still works**: 4172 has a row in `smart_bi_pg_analysis_results` with `analysis_type='enrichment_cache'` (size 24KB, created 2026-04-24 03:01:38). The first call in `_doEnrichSheetAnalysis` is `getCachedAnalysis(uploadId)` → cache hit → returns instantly, skipping the LLM pipeline.

**Why 4169 doesn't**: 4169 has 25+ rows in `smart_bi_pg_analysis_results` but **all** are `analysis_type='materialized:*'` (template results). It has ZERO `analysis_type='enrichment_cache'` row. So every load triggers the full LLM pipeline → timeout.

**Evidence**:
- FE timeout source: `web-admin/src/api/request.ts:86` (`timeout: 120000`) — global axios default.
- Pipeline source: `web-admin/src/api/smartbi/analysis.ts:1395-1810`.
- LLM hop measurements (prod, Apr 24):
  - `POST /api/insight/quick-summary` (upload 4169): **6.2s** (capped LIMIT 50000)
  - `POST /api/chart/smart-recommend` (trivial 1-row input): **28.4s**
  - `POST /api/insight/generate-stream`: 5-15s (SSE, streams chunks)
- Cache check: `GET /api/smartbi/analysis-cache/4172` → `cached:true`. `/4169` → `cached:false`.
- `getCachedAnalysis` filter at `backend/python/smartbi/api/analysis_cache.py:50-52` only matches `analysis_type='enrichment_cache'`, ignores all `materialized:*` rows.

**Impact**: Affects ~100% of POS uploads (large datasets are the norm for restaurant POS exports). Affects the SmartBI 智能数据分析 page entry point — the most prominent SmartBI feature for new users.

---

### PROD-2 (P1): "评价门店 = 4,955 亿" — text column rendered as currency KPI

**Symptom**: First KPI card on upload 4172 shows "评价门店" with value "4,955" and unit "亿". 评价门店 (review store name) is text — not a count, not a currency. Reads as nonsensical.

**Root cause**: Two-bug compound at `web-admin/src/api/smartbi/analysis.ts`:

1. **Lines 1466-1488 (positional rename)**: Iterates `Object.keys(cleanedData[0])` (which is **JSONB key order from PG**) and `fieldDefs[i]` (which is **`display_order` from `smart_bi_pg_field_definitions`**). The two orders differ — JSONB sorts by length-then-lex, fieldDefs by registration order. So position 3 in JSONB = `团购ID` (numeric ID), position 3 in fieldDefs = `评价门店` (text). The rename swaps them: data column `团购ID` is renamed to `评价门店`. Now the column "评价门店" in `cleanedData` actually contains 团购ID values like 1090349932.

2. **Lines 1773-1787 (force-numeric coercion)**: For columns where Python's `quick-summary` returned `type !== 'float64/...'` but FE's `detectNumericColumns` says it IS numeric, FE recomputes the sum: `for row of cleanedData; sum += parseFloat(v)` and **overwrites** `{ ...col, type: 'float64', sum }`. Critically, it does NOT carry over `aggStrategy` because the original col (text) had no `aggStrategy` set. So the new "评价门店" KPI col has `aggStrategy=undefined`, `type='float64'`, `sum=495,486,006,718`. `getSmartKPIs` filter at line 562 excludes only `aggStrategy==='none'` — `undefined` passes through. Sum gets `formatLargeNumber` → "4955 亿".

3. **Compounding**: This entire corrupted state was **cached** to `smart_bi_pg_analysis_results.enrichment_cache` on Apr 24 03:01. The raw cache JSON (just verified via `curl /api/smartbi/analysis-cache/4172`) shows:
   - `"name":"评价门店", "type":"float64", "sum":495486006718` (no aggStrategy)
   - `"name":"平台", "type":"float64", "sum":9618` (also a text col mislabeled as numeric — same bug, smaller scale because '点评'/'美团' parse as 0)

**Evidence**:
- DB schema: `smart_bi_pg_field_definitions` for 4172 — 评价门店: `is_measure=f, agg_strategy=none, field_type=TEXT`. Verified.
- Sample JSONB key order from PG: `城市, 平台, 省份, 团购ID, 评价ID, 口味分, 星级分, 是否vip, 服务分, 环境分, ...` — does NOT match fieldDefs display_order.
- Python `/api/insight/quick-summary` correctly returns 评价门店 with `type='object', aggStrategy=None, sum=None` (since data load uses raw JSONB keys, not FE rename). Verified via curl.
- Sum verification: `SUM(团购ID over first 2000 rows) / 1e8 = 4942 亿` — matches displayed "4,955 亿" within sampling variance. Confirms 评价门店 KPI is actually 团购ID's sum.
- Cache read (`curl /api/smartbi/analysis-cache/4172`): contains the corrupted column shape as documented above.

**Impact**: Affects every cached upload that has heterogeneous field types and went through the FE enrichment pipeline. Erodes user trust ("if 评价门店 = 4955 亿 is wrong, are the 4.83 ratings also wrong?"). All review-template uploads on prod likely affected. POS uploads (single column type per group) less likely to surface, but possible.

---

### PROD-3 (P2): Only 3 of 4 expected 平均X cards rendered (口味 missing)

**Symptom**: Spec promised 4 cards 平均服务分/星级分/环境分/口味分. Live shows only 3 (服务/星级/环境). 口味分 missing.

**Root cause**: **PROD-2 caused PROD-3.** Python correctly returns all 4 rating columns with `aggStrategy='mean', semanticType='rating', mean=4.82-4.83`. `getSmartKPIs` at line 806 returns `[...ratioKPIs, ...columnKPIs].slice(0, 4)` (hard cap of 4). When 评价门店 (the corrupted text-as-number col with `sum=4.95e11`) gets sorted to position 1 by score (PROD-2 bug), the 4 rating cols compete for 3 remaining slots. 口味分 has `mean=4.821` (smallest), loses tiebreak.

**Evidence**:
- Cache JSON shows 4 ratings present with correct aggStrategy='mean'. All 4 should be eligible.
- Score formula at `analysis.ts:683-690`: `score = Math.log10(Math.abs(mean) + 1) * 5 + 15` for ratings → ~18.5. Score for 评价门店 (corrupted): `Math.log10(4.95e11 + 1) * 5 ≈ 58.5`. Wins slot 1.
- Sort then dedupe at `analysis.ts:695-707`, then `slice(0, slotsNeeded)` where `slotsNeeded = 4 - ratioKPIs.length = 4 - 0 = 4` if no ratioKPIs, otherwise less.

**Impact**: Always 1 rating missing whenever the positional-rename bug coincides with a text col that has high parseFloat-able digits. Restaurant 口味 (taste) is arguably the most important review dimension; missing it erodes the whole ratings panel value.

---

## Optimization Options (ranked by priority)

Priority scoring: `priority = customer_impact (1-10) / effort_hours`. Higher is better.

### Option A: Fix PROD-2 root cause — abandon positional rename, use displayNameMap only at display time (priority 9.0)

**Fix**:
1. Delete `analysis.ts:1466-1488` (positional rename) entirely. The root assumption ("data keys correspond by POSITION to fieldDefs") is broken whenever JSONB key order ≠ field_def display_order.
2. Delete or guard `analysis.ts:1773-1787` (force-numeric coercion). It's a band-aid that creates more bugs than it fixes (PROD-2 is a direct consequence). If it must stay, **carry `aggStrategy` through** in the spread: `{ ...col, type: 'float64', sum, aggStrategy: col.aggStrategy ?? 'none' }`.
3. Use `displayNameMap` only at the moment of display (KPI title via `humanizeColumnName(col.name)` already works in `getSmartKPIs:772`). FE consumes Python's `kpiSummary.columns` whose names are the original JSONB keys → no rename ever needed.

**Effort**: ~2h
- Files: `web-admin/src/api/smartbi/analysis.ts` (delete 22 lines + 14 lines), `tests/e2e-comprehensive/agg-strategy-realwindow-prod.mjs` (re-verify)
- LOC: ~36 lines deleted + 0 added
- Plus: invalidate corrupted cache rows via `DELETE FROM smart_bi_pg_analysis_results WHERE analysis_type='enrichment_cache'` (one-shot, ~13 rows on prod)

**Risk**: **Med**. The positional rename was added to fix a different bug ("2025年各部门预算完成情况_2"-style raw column names appearing in charts when fieldDefs have humanized labels). Need to verify chart titles still display human-readable names without the rename. The displayNameMap is still passed downstream to `buildChartPlan` and KPIs which already do `displayNameMap?.[col.name] || humanizeColumnName(col.name)` — so display should still work.

**Customer benefit**: Fixes PROD-2 and PROD-3 in one shot. 评价门店 disappears from KPI strip; all 4 平均X ratings show. Restores trust in KPI panel.

---

### Option B: Pre-materialize enrichment_cache at upload-ingest (PROD-1 root fix) (priority 7.5)

**Fix**: When an upload completes ingestion (`SmartBIUploadController` upload-confirm path), immediately enqueue a background job to call the Python enrichment pipeline and persist the result to `smart_bi_pg_analysis_results.enrichment_cache`. By the time the user navigates to /smart-bi/analysis and selects the upload, cache is hit and KPIs render in <1s.

**Effort**: ~6-8h
- Files: `backend/python/smartbi/api/excel.py` (post-confirm hook), `backend/python/smartbi/api/analysis_cache.py` (new sync endpoint that runs the pipeline server-side instead of FE), or new `backend/python/smartbi/services/enrichment_worker.py`
- LOC: ~150-200 (worker + endpoint + queue/threading)
- Plus: backfill existing 360+ uncached uploads via batch script

**Risk**: **Med**. New background work pattern to maintain. Need to handle worker failures, retries, partial caches. Cache write contention with FE-side cache write needs serialization. May want a feature flag to enable per-tenant.

**Customer benefit**: All POS uploads visible immediately. Eliminates timeout fail mode entirely. Pre-warming saves the 30-90s wait per first-load. This is the proper architectural fix for PROD-1.

---

### Option C: Raise FE timeout from 120s to 300s for enrichment (PROD-1 stop-gap) (priority 6.0)

**Fix**: Change `web-admin/src/api/request.ts:86` from `timeout: 120000` to either (a) 300_000 globally, or (b) per-call override at `analysis.ts:1424` (`getUploadTableData`) or via a new `enrichmentTimeoutMs` constant.

**Effort**: ~1h
- Files: `web-admin/src/api/request.ts` (1 line) or `web-admin/src/api/smartbi/upload.ts:385-389` (add timeout option)
- LOC: 1-5

**Risk**: **Low** for per-call override; **Med** for global change (affects 1442+ API endpoints). Recommend per-call.

**Customer benefit**: Most 200K-row enrichments complete in 60-180s, so 300s catches the tail. Customer sees longer skeleton/spinner but eventually gets KPIs. **Does not fix the bad UX of 60-90s blank wait** — just turns the failure into a slow success.

**Caveat**: Even if timeout raises, customer sees a blank skeleton/spinner for 60-90s before KPIs appear. UX is better than red toast but still poor. Should ideally pair with Option D (progressive KPI render).

---

### Option D: Decouple KPI render from chart/insight pipeline (priority 6.5)

**Fix**: `enrichSheetAnalysis` already emits a `phase: 'kpi'` progress event at line 1546 with KPI summary ready after only the quickSummary call (~6s). The Vue page should render KPIs as soon as this event fires, not wait for the full pipeline. Currently it's wired (line 3633), but the parent `enrichSheet` may be blocking display.

**Effort**: ~2-3h (verification + small fixes)
- Files: `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` around lines 3616-3700
- LOC: ~20-30 small touch-ups

**Risk**: **Low**.

**Customer benefit**: KPIs visible at ~6s instead of waiting for full pipeline (~60-120s). Much better perceived perf. Charts/insights still load behind, with their own skeletons.

**Caveat**: Doesn't fix the overall pipeline timeout if smartRecommendChart hangs >120s for charts/insights — but at least KPIs are visible.

---

### Option E: Suppress 万/亿 currency unit when column has no aggStrategy or is identifiably a count (PROD-2 stop-gap if Option A is too risky) (priority 5.0)

**Fix**: In `getSmartKPIs:730-744`, before applying `formatLargeNumber`, add a check:
```typescript
// PROD-2 guard: don't apply 亿/万 currency unit if no aggStrategy (means
// likely got force-coerced from a text col by analysis.ts:1773 bug).
if (!isRating && (!col.aggStrategy || col.aggStrategy === 'none')) {
  // Skip this column entirely — it shouldn't have been a KPI candidate.
  return null;
}
```
And filter `null` results from `columnKPIs` before slice.

**Effort**: ~30min
- Files: `web-admin/src/api/smartbi/analysis.ts:730-789`
- LOC: ~5

**Risk**: **Low**, but only treats the symptom. PROD-3 still happens if a force-coerced col steals slot 1 with high score. Plus invalidating the corrupted cache rows is still required.

**Customer benefit**: Stops the gibberish "评价门店 = 4955 亿" card from appearing. PROD-3 recovers (4 平均 cards visible) because the corrupt col is now filtered.

---

### Option F: Invalidate all `enrichment_cache` rows once Option A or E ships (priority 8.0)

**Fix**: One-shot SQL:
```sql
DELETE FROM smart_bi_pg_analysis_results
WHERE analysis_type = 'enrichment_cache'
  AND created_at < '<deploy_timestamp>';
```

**Effort**: ~15min (script + run on prod)
- Files: new `scripts/db/clear-enrichment-cache.sh`
- Rows: ~13 on prod (one per cached upload)

**Risk**: **Low**. Cache will rebuild on next user visit (taking 30-90s for first user).

**Customer benefit**: Fixes the persisted bad cache state for currently-affected uploads (4172 included). Required after Option A or E deploys.

---

### Option G: Add count column rendering (no 亿/万 unit) (priority 4.0)

**Fix**: Extend `aggStrategy` type from `'sum' | 'mean' | 'none'` to also include `'count'`. Update `field_classifier.infer_agg_strategy()` (Python) to return `'count'` for is_dimension cols + columns whose name matches `数|订单数|笔数|次数|门店数|人数`. Update `getSmartKPIs` to render count cols with raw integer + comma separator (no 亿/万 unit).

**Effort**: ~3-4h
- Files: `backend/python/smartbi/services/field_classifier.py`, `web-admin/src/api/smartbi/common.ts` (type update), `web-admin/src/api/smartbi/analysis.ts` (rendering branch)
- LOC: ~50

**Risk**: **Low-Med**. Adds value for legitimate count metrics (e.g. 评价数, 订单数) that the customer DOES want to see, but with proper formatting.

**Customer benefit**: Future-proofs against count-columns being misformatted. NOT a fix for PROD-2 (which is upstream column corruption, not formatting). Lower priority unless Options A/E ship first.

---

### Option H: Add stream/SSE variant for `/api/chart/smart-recommend` (priority 4.5)

**Fix**: New Python endpoint `POST /api/chart/smart-recommend-stream` that yields SSE events as the LLM streams chart suggestions. FE consumes incrementally.

**Effort**: ~5h
- Files: `backend/python/smartbi/api/chart.py`, `backend/python/smartbi/services/chart_recommender.py`, `web-admin/src/api/smartbi/python-service.ts`, `web-admin/src/api/smartbi/analysis.ts`
- LOC: ~150-200

**Risk**: **Med**. Streaming LLM responses for chart structure (vs free-form text) is more complex — need to parse partial JSON. Easy to introduce edge cases.

**Customer benefit**: Reduces perceived latency for chart-recommendation phase from 28s → ~3-5s first-paint. Doesn't help if upstream cache miss (PROD-1 root) — Option B is better for that.

---

### Option I: Cap upload selector to "Recent 30" with "Show all" expansion (PROD-5 from observations) (priority 3.0)

**Fix**: Default `getUploadHistory({ size: 30 })` and add expansion link.

**Effort**: ~2h
- Files: `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` upload selector, `web-admin/src/api/smartbi/upload.ts:357`
- LOC: ~30

**Risk**: **Low**.

**Customer benefit**: Reduces cognitive load. Not blocker but a nice polish for power users. Defer.

---

## Recommended sequence

1. **Option A (PROD-2/3 root fix)** — abandon the positional rename. ~2h, fixes 2 issues at once.
2. **Option F (cache invalidation)** — required after A. ~15min.
3. **Option D (decouple KPI render)** — KPIs visible at 6s for both 4169 and 4172. ~2-3h. Big perf perception win.
4. **Option B (pre-materialize enrichment_cache at ingest)** — ~6-8h. Eliminates PROD-1 entirely for new uploads, plus backfill script for existing 360+.
5. **Option C (raise timeout)** — ~1h. Cheap stop-gap if B is delayed.
6. **Option G (count column type)** — ~3-4h. After A is shipped, add proper count rendering.
7. **Option E (formatter guard)** — ~30min. Defensive backstop in case A regresses; can ship in same PR as A as "belt and suspenders".

Total to fix all 3 PROD issues at root: **~12-14h** of focused work.

If only 1 day available: Options A + F + D + C — fixes PROD-2 + PROD-3 + makes PROD-1 acceptable (KPIs visible at 6s, full pipeline 5min instead of 2min). ~6h.

---

## Out-of-scope (defer to v2)

- **Option I** (upload selector pagination) — UX polish, not blocking.
- **PROD-4 (4 cards cramped on 1920px)** — purely cosmetic, not affecting correctness.
- **PROD-5 (selector 360 options)** — see Option I.
- Replacing the entire enrichment pipeline with a server-side worker that runs detached and pushes results via WebSocket — long-term v2 architecture; current proposal (Option B) keeps it FE-orchestrated but pre-warmed.
- Smarter chart-type recommendations that don't require LLM (rule-based for the 80% case) — would speed up smartRecommendChart from 28s → <1s but is its own multi-day project.

---

## Notes for the implementer

- **Cache key sensitivity**: After Option A, the column shapes change. `kpiCache` in SmartBIAnalysis.vue:1818 keys by `uploadId-rowCount-columnCount-columnsLength-...`. Should still hit/miss correctly because column count doesn't change.
- **Chart titles use raw col names**: Several charts in the cached `chart_configs` have x-field labels like "表C-上海市", "表E-上海市", "表D-上海市" — these are 评价门店 store names (correct! the chart pipeline somehow recovered store names later). After Option A, verify chart titles + axis labels still humanize correctly — they likely do because chart pipeline reads `displayNameMap` separately.
- **Python's `field_classifier.infer_agg_strategy()`** correctly assigned `'none'` to 评价门店 — this is verified by the DB query. The bug is exclusively FE-side rename + force-coerce.
- **No Python changes needed** for Options A, C, D, E, F. Options B, G, H all touch Python.
