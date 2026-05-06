# PR-N-2 Investigation: sales structural diffs root cause

**Date**: 2026-05-06
**Investigator**: Chat (PR-N-2)
**Status**: STOP — root cause confirmed, awaiting organizer/spec decision before fix

---

## TL;DR

**6 of 6 structural diffs** (3 LISTLEN + 3 P_ONLY) all trace to **one root cause**: Python's `_get_sales_overview` falls back to legacy SQL when the Gold path returns None, but Java explicitly does NOT — Java emits `buildEmptyDashboard()` to skip legacy entirely (Phase B4 cutover decision, 2026-04-22).

This is **PATH B** per the marching order — Python port is incomplete, NOT a Java DB-wiring bug. Recommended fix is a 2-line change in `_get_sales_overview` to skip the legacy fallback when Gold returns None.

The 1 VALUE diff (`productRanking[*].completionRate 15.28 vs 15.29`) is a separate Cat B math semantic issue, already covered by PR-M-2 in flight.

---

## Reproduction

`GET /api/mobile/F001/smart-bi/analysis/sales?startDate=2026-01-01&endDate=2026-12-31` on prod (10010 vs 8083).

| Field | Java (10010) | Python (8083) |
|---|---|---|
| `data.overview.kpiCards` | `[]` (0 items) | 5 cards (SALES_AMOUNT/ORDER_COUNT/AVG_ORDER_VALUE/TARGET_COMPLETION/MOM_GROWTH) |
| `data.overview.charts` | `{}` (0 keys) | 2 keys (`销售趋势`, `产品分布`) |
| `data.overview.rankings` | `{}` (0 keys) | 1 key (`salesperson`) |
| `data.overview.aiInsights` | 1 entry ("当前时间范围内暂无销售数据") | 2 entries (legacy aggregated insights) |
| `data.overview.suggestions` | 1 entry ("请先上传销售数据以开始分析") | `[]` |
| `data.customerRanking` | 10 items | 10 items (identical) |
| `data.productRanking` | 7 items | 7 items (identical) |
| `data.salespersonRanking` | 313 items | 313 items (identical) |
| `data.trendChart` | non-empty | non-empty (identical) |
| `data.dateRange` | identical | identical |

Outside-overview fields (customerRanking/productRanking/salespersonRanking/trendChart) match exactly. The divergence is **inside `overview`** only.

---

## Root cause

### Java (correct as designed)

`SalesAnalysisServiceImpl.getSalesOverview()` lines 80-112:

```java
if (goldReadPrimaryEnabled && goldDashboardBuilder != null) {
    try {
        DashboardResponse goldResponse = goldDashboardBuilder.buildFromGoldWithCharts(...);
        if (goldResponse != null) {
            return goldResponse;
        }
        // Gold returned null = revenue=0 AND bills=0 in Silver. Gold is authoritative
        // under primary flag, so skip the slow legacy scan (~50s on empty ranges per
        // Bug #417) and return empty directly. Fallback to legacy only triggers on
        // actual Gold failures (exception branch below).
        log.info("[gold-primary] sales factory={} range={}..{} Gold empty — skipping legacy", ...);
        return buildEmptyDashboard();  // ← KEY: skip legacy on Gold-null
    } catch (Exception e) {
        log.warn("[gold-primary] sales factory={} failed, falling back to legacy: ...", ...);
    }
}
// (only reached when flag off OR exception above; falls through to legacy SQL)
```

`buildEmptyDashboard()` (lines 1145-1159) emits exactly the shape Java prod returns:
- kpiCards: `Collections.emptyList()` → `[]`
- charts: `Collections.emptyMap()` → `{}`
- rankings: `Collections.emptyMap()` → `{}`
- aiInsights: 1 entry ("当前时间范围内暂无销售数据")
- suggestions: 1 entry ("请先上传销售数据以开始分析")

**`SMARTBI_GOLD_READ_PRIMARY_ENABLED=true`** is set in `/www/wwwroot/cretas/.env.prod` (confirmed). F001 has no POS data → Silver tables empty → Gold returns null → Java emits buildEmptyDashboard.

### Python (port incomplete)

`backend/python/smartbi_compat/api/analysis_sales.py:1460-1490`:

```python
async def _get_sales_overview(factory_id: str, range_: DateRange) -> dict:
    pool = None
    try:
        from smartbi.config import get_pg_pool
        pool = await get_pg_pool()
    except Exception as e:
        logger.warning("[gold-builder] pool acquisition failed ...")
        return await _build_legacy_sales_overview(factory_id, range_)

    try:
        gold_dashboard = await _build_from_gold_with_charts(factory_id, range_, pool=pool)
        if gold_dashboard is not None:
            return gold_dashboard
    except Exception as e:
        logger.warning("[gold-builder] Gold fetch failed ...")
    return await _build_legacy_sales_overview(factory_id, range_)  # ← BUG: falls back on Gold-null
```

Python's docstring on `_build_empty_dashboard` (line 1353) **explicitly claims** "Gold-empty fallback (gold spec already returns this shape via _get_sales_overview)" — but the actual `_get_sales_overview` code does NOT call `_build_empty_dashboard()` on Gold-None. The comment matches Java's intent; the code does not.

Additionally, Python doesn't honor the `SMARTBI_GOLD_READ_PRIMARY_ENABLED` flag at all (verified via grep — no env-var read anywhere in `smartbi_compat`). For F001 with flag=true, both Java + Python attempt Gold; Java skips legacy on Gold-null, Python falls back. Same end-state divergence regardless of flag value, because Python always tries Gold.

---

## Per-diff mapping (all 6 trace to same root cause)

| Diff | Java emit (buildEmptyDashboard) | Python emit (legacy fallback) | Cause |
|---|---|---|---|
| LISTLEN kpiCards 0 vs 5 | `[]` | 5 legacy KPI cards | Gold-null → Java empty / Python legacy |
| LISTLEN aiInsights 1 vs 2 | 1 ("暂无销售数据") | 2 (legacy insights) | same |
| LISTLEN suggestions 1 vs 0 | 1 ("请先上传销售数据") | `[]` (legacy generates none) | same |
| P_ONLY /charts/销售趋势 | charts={} | legacy trend chart | same |
| P_ONLY /charts/产品分布 | charts={} | legacy pie chart | same |
| P_ONLY /rankings/salesperson | rankings={} | legacy salesperson ranking | same |

The 1 VALUE diff (`productRanking[*].completionRate 15.28 vs 15.29`) is unrelated — productRanking is queried directly via `salesService.getProductRanking()` which works correctly in both Java + Python; the 15.28/15.29 mismatch is the BigDecimal `divide(scale,rounding).multiply(K)` vs Python `(n/d*K).quantize(scale)` math semantic gap (PR-M doc Cat B, PR-M-2 territory). **Do NOT touch as instructed.**

---

## PATH A vs PATH B recommendation

### PATH A (Java DB wiring bug) — REJECTED

The marching order suggested this might be a Java DB-wiring bug similar to PR-A through PR-H. **It is not.** The Java code is doing exactly what the Phase B4 cutover designed (2026-04-22). The empty dashboard for F001 is the **intentional** behavior:
- F001 doesn't use POS → Silver empty → Gold null → emit empty dashboard (don't show stale legacy data).
- This is documented in code comments AND the `[gold-primary] sales factory=F001 range=... Gold empty — skipping legacy` log line (verifiable in prod logs).

No Java fix is needed.

### PATH B (Python port incomplete) — RECOMMENDED

**Recommended fix scope**: 2-line change in `backend/python/smartbi_compat/api/analysis_sales.py:1481-1490`.

```python
# CURRENT (wrong):
try:
    gold_dashboard = await _build_from_gold_with_charts(factory_id, range_, pool=pool)
    if gold_dashboard is not None:
        return gold_dashboard
except Exception as e:
    logger.warning("[gold-builder] Gold fetch failed ...")
return await _build_legacy_sales_overview(factory_id, range_)

# PROPOSED (matches Java):
try:
    gold_dashboard = await _build_from_gold_with_charts(factory_id, range_, pool=pool)
    if gold_dashboard is not None:
        return gold_dashboard
    # Gold returned None → Silver empty for this factory.
    # Mirror Java line 105-107: skip legacy, return buildEmptyDashboard.
    logger.info("[gold-primary] sales factory=%s gold empty — skipping legacy", factory_id)
    return _build_empty_dashboard()
except Exception as e:
    logger.warning("[gold-builder] Gold fetch failed factory=%s: %s; falling back to legacy", factory_id, e)
    return await _build_legacy_sales_overview(factory_id, range_)
```

Note the structural change:
- **Gold returns None → `_build_empty_dashboard()`** (NEW, mirrors Java line 105-107)
- **Gold raises exception → `_build_legacy_sales_overview()`** (UNCHANGED, mirrors Java line 108-111)
- **Pool acquisition fails → `_build_legacy_sales_overview()`** (UNCHANGED — defensive)

### Open question for organizer/spec call

**Should Python also honor `SMARTBI_GOLD_READ_PRIMARY_ENABLED` flag?**

Currently Python ignores the flag and always attempts Gold first. Java skips Gold entirely when flag=false, going directly to legacy. For F001 prod where flag=true, this doesn't matter (both go to Gold first). But for F002 or future tenants where someone might toggle the flag off, Python wouldn't follow. This is a separate latent gap — out of PR-N-2 scope unless organizer wants to bundle.

Recommended: ship just the 2-line fix as PR-N-2; file a follow-up issue for the flag honor as a minor latent gap.

---

## STOP signals raised

1. **STOP per marching order — investigative task, no code change without organizer/spec OK.** Branch pushed empty (no commits).
2. The marching order's PATH A (Java DB wiring bug) hypothesis is **wrong**. This is PATH B (Python port incomplete). Suggest organizer update the PR-N-2 ticket scope to "Python Gold-null fallback fix" before assigning impl chat.
3. The 1 VALUE diff (`productRanking[*].completionRate 15.28 vs 15.29`) is independent — left for PR-M-2 in flight.
4. Latent gap: Python doesn't honor `SMARTBI_GOLD_READ_PRIMARY_ENABLED` flag. Out of PR-N-2 scope but worth filing.

---

## Verification commands (for impl chat)

After fix lands on test env:

```bash
ssh root@47.100.235.168 "JWT_SECRET=\$(grep '^JWT_SECRET=' /www/wwwroot/cretas/.env.test | cut -d= -f2); TOKEN=\$(JWT_SECRET=\"\$JWT_SECRET\" python3 -c \"import jwt, time; t=jwt.encode({'userId':1,'username':'v','factoryId':'F001','role':'factory_super_admin','exp':int(time.time())+3600}, '\$JWT_SECRET', algorithm='HS256'); t=t.decode('utf-8') if isinstance(t,bytes) else t; print(t)\"); EP='/api/mobile/F001/smart-bi/analysis/sales?startDate=2026-01-01&endDate=2026-12-31'; for base in 10011 8084; do curl -sS -H \"Authorization: Bearer \$TOKEN\" \"http://localhost:\$base\$EP\" | python3 -c 'import json, sys; d=json.load(sys.stdin)[\"data\"][\"overview\"]; print(\"  kpi:\",len(d[\"kpiCards\"]),\"charts:\",len(d[\"charts\"]),\"rankings:\",len(d[\"rankings\"]),\"insights:\",len(d[\"aiInsights\"]),\"sugg:\",len(d[\"suggestions\"]))'; done"
```

Expected post-fix:
- Java: `kpi: 0 charts: 0 rankings: 0 insights: 1 sugg: 1`
- Python (post-fix): `kpi: 0 charts: 0 rankings: 0 insights: 1 sugg: 1` (matches Java)
- Pre-fix Python: `kpi: 5 charts: 2 rankings: 1 insights: 2 sugg: 0` (legacy)
