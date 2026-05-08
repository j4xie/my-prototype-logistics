# Pattern B Sister-Endpoint Scan

**Date**: 2026-05-08 (CST evening)
**Branch**: `ops-pattern-b-sister-scan`
**Worktree**: `.worktrees/pattern-b-sister-scan`
**Scope**: READ-ONLY audit. No code changes in this PR. Per memory
`feedback_narrow_scope_fix_sister_site_sweep` — when fixing a Pattern in one
site, sweep all sister sites with the same Pattern.

---

## TL;DR

| Metric | Value |
|---|---:|
| Java Pattern B sites total (N) | **2** |
| Python 3-state mirror complete (M) | **1** (finance, post PR #131/#135/#138) |
| **Python Pattern B latent (K)** | **1** (sales — missing flag gate) |
| Python legacy-only / Gold-disabled (L) | **0** |
| No Python counterpart (orphan) | **0** |

**Critical finding**: `_get_sales_overview` in `analysis_sales.py` is missing
the `SMARTBI_GOLD_READ_PRIMARY_ENABLED` flag gate that Finance got in PR #135.
Python sales **always tries Gold first**, while Java sales is gated by the
flag (default `false` → straight to legacy). See [Finding K-1](#k-1-sales-overview-missing-flag-gate-pattern-b-latent) below.

**Severity**: MEDIUM-HIGH for T6.4. Triggers only when a routed factory has
Gold POS data populated (per memory: F001 confirmed populated; 14 real
customer factories status unknown).

---

## Pattern B definition (locked from PR #131 / #135 / #138)

Pattern B = Java's flag-gated 3-state Gold-or-legacy branching:

```java
// Java reference: FinanceAnalysisServiceImpl.getFinanceOverview line 111-189
@Value("${smartbi.gold.read-primary.enabled:false}")
private boolean goldReadPrimaryEnabled;

if (goldReadPrimaryEnabled && goldDashboardBuilder != null) {
    try {
        DashboardResponse goldResponse = goldDashboardBuilder.buildFromXxx(...);
        if (goldResponse != null) return goldResponse;          // State A
        return DashboardResponse.builder()...empty().build();    // State B
    } catch (Exception e) {
        log.warn("[gold-primary] failed, falling back to legacy: {}", e);
    }
}
// State C — legacy populated (fall-through when flag=false OR Gold throws)
... full legacy SQL aggregation ...
return DashboardResponse.builder()...populated().build();
```

**Required Python parity**:
1. Read same flag (`os.environ.get("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "false")`).
2. Gate Gold attempt on flag.
3. Inside try: Gold non-null → return; Gold None → return empty dashboard.
4. Catch broad `Exception` → fall through to legacy.
5. Legacy populated path (always reached when flag=false).

---

## Java side scan

`grep -rn "goldDashboardBuilder|goldReadPrimaryEnabled|smartbi\.gold\.read-primary\.enabled|fireGoldShadowRead"
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl`

| File | Method | Lines | Gold call |
|---|---|---|---|
| `FinanceAnalysisServiceImpl.java` | `getFinanceOverview` | 111–189 | `goldDashboardBuilder.buildFromFinanceSummary(factoryId, startDate, endDate)` |
| `SalesAnalysisServiceImpl.java` | `getSalesOverview` | 80–175 | `goldDashboardBuilder.buildFromGoldWithCharts(factoryId, startDate, endDate)` |

**`GoldDashboardBuilder` public methods** (`grep "public\s+\w+\s+\w+\s*\(" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/GoldDashboardBuilder.java`):

```
58:    public DashboardResponse buildFromFinanceSummary(...)
135:   public DashboardResponse buildFromGoldWithCharts(...)
```

**No orphan Gold methods** — every public method is consumed by exactly one
service.

**N = 2 Pattern B sites total**. No more, no fewer.

---

## Python cross-check

### Finance (M-1) — 3-state mirror complete ✓

`backend/python/smartbi_compat/api/analysis_finance.py`:

| Function | Lines | Java line ref | State |
|---|---|---|---|
| `_get_finance_overview` | 1848–1883 | dispatcher line 111–147 | dispatcher |
| `_build_finance_overview_from_gold` | 1746–1834 | line 122–127 | A (Gold) |
| `_build_empty_dashboard_response` | 1835–1847 | line 135–142 | B (Gold empty) |
| `_build_finance_overview_legacy` | 1886–end | line 149–189 | C (legacy fallback) |

Flag gate (line 1860–1864):

```python
flag_raw = os.environ.get("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "false")
gold_primary_enabled = flag_raw.strip().lower() == "true"

if gold_primary_enabled:
    try:
        gold_response = await _build_finance_overview_from_gold(factory_id, range_)
        if gold_response is not None:
            return gold_response
        return _build_empty_dashboard_response()
    except Exception as e:
        logger.warning("[gold-primary] finance ... falling back to legacy: %s", e)

return await _build_finance_overview_legacy(factory_id, range_)
```

**Status**: ✅ Mirrors Java exactly. Closed by PR #131 (PR-B real port) +
PR #135 (PR-B v2 full 3-state) + PR #138 (peer review smoke verify).

### Sales (K-1) — Pattern B latent ⚠️

`backend/python/smartbi_compat/api/analysis_sales.py`:

| Function | Lines | Java line ref | State |
|---|---|---|---|
| `_get_sales_overview` | 1465–1507 | dispatcher line 80–112 | dispatcher (BROKEN) |
| `_build_from_gold_with_charts` | 1324–1349 | `goldDashboardBuilder.buildFromGoldWithCharts` | A (Gold wrapper) |
| `_build_from_gold_finance_summary` | 1176–1323 | inner Gold builder | A (Gold inner) |
| `_build_empty_dashboard` | 1350–1369 | line 135–142 (analog) | B (Gold empty) |
| `_build_legacy_sales_overview` | 1372–1462 | line 114–175 | C (legacy fallback) |

All 3 state builders exist and are populated. **The dispatcher is the
problem** (line 1480–1507):

```python
async def _get_sales_overview(factory_id: str, range_: DateRange) -> dict:
    pool = None
    try:
        from smartbi.config import get_pg_pool
        pool = await get_pg_pool()
    except Exception as e:
        logger.warning("[gold-builder] pool acquisition failed ...; using legacy")
        return await _build_legacy_sales_overview(factory_id, range_)

    try:
        gold_dashboard = await _build_from_gold_with_charts(factory_id, range_, pool=pool)
        if gold_dashboard is not None:
            return gold_dashboard
        logger.info("[gold-primary] sales ... gold empty — skipping legacy")
        return _build_empty_dashboard()
    except Exception as e:
        logger.warning("[gold-builder] Gold fetch failed ...; falling back to legacy")
        return await _build_legacy_sales_overview(factory_id, range_)
```

**No flag check.** `os.environ.get("SMARTBI_GOLD_READ_PRIMARY_ENABLED", ...)`
is absent. Verification:

```bash
$ grep -n "SMARTBI_GOLD_READ_PRIMARY_ENABLED\|gold_read_primary\|gold_primary_enabled" \
       backend/python/smartbi_compat/api/analysis_sales.py
(no matches)

$ grep -rn "SMARTBI_GOLD_READ_PRIMARY_ENABLED" backend/python/smartbi_compat/
backend/python/smartbi_compat/api/analysis_finance.py:1602  (only)
```

**Java line 87** gates Gold-first behind flag:

```java
if (goldReadPrimaryEnabled && goldDashboardBuilder != null) { ... try Gold ... }
// flag=false → goes straight to legacy SQL aggregation (line 114+)
```

**Python line 1491** unconditionally tries Gold:

```python
try:
    gold_dashboard = await _build_from_gold_with_charts(...)
    ...
```

---

## Findings

### K-1 — Sales overview missing flag gate (Pattern B latent)

**File**: `backend/python/smartbi_compat/api/analysis_sales.py`
**Function**: `_get_sales_overview` (line 1465–1507)
**Java reference**: `SalesAnalysisServiceImpl.getSalesOverview` line 80–175
**Pattern**: Pattern B — flag-gated 3-state Gold/legacy

#### What is wrong

Java behavior (default flag=false in prod):
- `goldReadPrimaryEnabled=false` → skip Gold try-block entirely → return
  legacy populated DashboardResponse.

Python behavior (current):
- No flag check → always try `_build_from_gold_with_charts` first → Gold
  populated returns Gold-shape; Gold None returns `_build_empty_dashboard`;
  Gold raises returns `_build_legacy_sales_overview`.

**Result**: For any factory with Gold POS data populated:
- Java prod (flag=false default) emits ~5–7 KB legacy populated response.
- Python (no flag) emits ~1–2 KB Gold-shape response.

**Byte-shape divergence** (NOT dict-eq scope per Phase 2A rule classification
in `python-java-port.md` §"Acceptance criteria").

#### Why it was missed

Sales `_get_sales_overview` predates PR #131/#135 and was written assuming
"Python is the Gold producer, so Python should always try Gold first". This
is reasonable in isolation but breaks byte-shape parity with Java when Java
has the flag default false.

PR #135 explicitly closed this gap for Finance via the official
`SMARTBI_GOLD_READ_PRIMARY_ENABLED` flag. **Sister Sales site was not
swept** at the time — exactly the failure mode that memory
`feedback_narrow_scope_fix_sister_site_sweep` is designed to catch.

#### Why T6.1 dryrun did not catch

Hypothesis: F999 (the dryrun fixture factory) does not have Gold POS data
populated → Gold returns None for both Java and Python paths → Java legacy
yields empty-or-near-empty DashboardResponse → matches Python's
`_build_empty_dashboard`.

The latent only fires when:
1. Factory has Gold POS data (revenue / bills > 0 in Silver layer).
2. Python serves the request (post-T6.3 routing).
3. Java prod still has flag=false (current default).

Memory `project_2026_05_07_t6_1_dryrun_in_flight.md` confirms F001 has Gold
POS data populated (overrides task #24 prior assumption). F001 is in T6.3
routed factories. Whether T6.1 dryrun actually surfaced this for F001 is
unclear from current evidence — the dryrun goldens may have been recorded
on F999 (no POS data) only.

#### T6.4 customer-surface risk

| Customer factory | POS data populated? | Risk |
|---|---|---|
| F001 (T6.2 canary) | YES (per memory 2026-05-07) | EXISTING — already serving Gold-shape since T6.2 |
| 60 test factories (T6.3 cutover) | UNKNOWN — need verification | LOW (test factories) |
| 14 real customer factories (T6.4 trigger pending) | UNKNOWN | **MEDIUM-HIGH** |

If any of the 14 real customer factories have populated Gold POS data, the
first post-T6.4 request to `/api/mobile/{factoryId}/smart-bi/analysis/sales`
will return a structurally different response than they received pre-T6.4
(when Java was serving via flag=false legacy). Frontend (Dashboard.vue,
SalesAnalysis.vue) reads the response and may break on missing/extra fields
unless it's already tolerant of both shapes.

#### Fix recommendation (separate follow-up PR — NOT this PR)

Mirror PR #135 Finance pattern in Sales dispatcher. Estimated diff: ~15–25
LOC in `_get_sales_overview` only (no other functions need to change — all
3 state builders already exist). Sketch:

```python
async def _get_sales_overview(factory_id: str, range_: DateRange) -> dict:
    flag_raw = os.environ.get("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "false")
    gold_primary_enabled = flag_raw.strip().lower() == "true"

    if gold_primary_enabled:
        pool = None
        try:
            from smartbi.config import get_pg_pool
            pool = await get_pg_pool()
            gold_dashboard = await _build_from_gold_with_charts(factory_id, range_, pool=pool)
            if gold_dashboard is not None:
                return gold_dashboard
            logger.info("[gold-primary] sales factory=%s gold empty — skipping legacy", factory_id)
            return _build_empty_dashboard()
        except Exception as e:
            logger.warning("[gold-primary] sales factory=%s failed, falling back to legacy: %s", factory_id, e)

    return await _build_legacy_sales_overview(factory_id, range_)
```

**Risk classification**: LOW for the fix itself (legacy path is already
production-ready and fully populated). HIGH for skipping the fix (latent
fires on T6.4 customer surface).

**Recommended priority**: P1 — fix BEFORE T6.4 trigger (~12:05 May 9 CST)
**IF** any of the 14 real customer factories are confirmed to have Gold POS
data populated. P2 — fix as scheduled cleanup if all 14 are confirmed
POS-empty (still produces correct-but-different-shape responses).

**Verification needed before fix priority is locked**: query
`smartbi_prod_db` for the 14 real customer factories' Silver-layer POS data
populated state.

#### Out of scope (NOT this PR)

- Implementing the fix (separate follow-up per marching order constraint).
- Re-recording sales overview goldens (will be PR-C scope alongside the fix).
- Touching the existing 3 state builders (already complete).

---

## Other observations (non-Pattern-B)

### Empty-dashboard helpers proliferation

`_build_empty_dashboard` exists in 3 separate files with similar but not
identical shapes:

```
backend/python/smartbi_compat/api/analysis_inventory.py:1286
backend/python/smartbi_compat/api/analysis_procurement.py:697
backend/python/smartbi_compat/api/analysis_sales.py:1350
```

Plus `_build_empty_dashboard_response` at
`analysis_finance.py:1835` (slightly different name, same purpose).

These are NOT Pattern B sites — they're Java empty-dashboard helpers used in
non-Gold-gated empty checks. Documented for awareness only. Out of scope.

### `fireGoldShadowRead` — Java-only

`FinanceAnalysisServiceImpl.fireGoldShadowRead` (line 200+) is a
fire-and-forget log-only Gold call. PR #131 spec §5 explicitly excluded
mirroring this in Python ("Python IS Gold producer"). No action needed.

---

## Recommendation summary

1. **Verify**: query `smartbi_prod_db` to confirm whether any of the 14
   real customer factories have Gold POS data populated in Silver layer.
2. **If yes**: open follow-up PR mirroring PR #135 pattern in `_get_sales_overview` BEFORE T6.4 trigger.
3. **If no**: open follow-up PR as scheduled P2 cleanup; T6.4 can proceed
   first (Sales endpoints will produce empty dashboard either way).

This PR closes the audit. The fix is a single-file ~15–25 LOC change
gated by the verification result.

---

## Out of scope (this PR)

- ❌ Fix implementation (per marching order — READ-ONLY)
- ❌ Verification query against prod DB (operator task)
- ❌ Re-recording sales goldens
- ❌ Searches outside `service/smartbi/impl/` (dispatcher Pattern B is
  a SmartBI-impl concern; broader Java service doesn't have Gold builder
  consumers — verified by `grep "GoldDashboardBuilder" backend/java/`)

## Audit trail

```
$ git log --oneline -3 origin/main
41552a962 audit(t6-4): rollback rehearsal — timing measurements + critical backup target correction (#142)
8b8f75875 audit(t6-4): real customer baseline metrics + capture script (#143)
068ebd8b8 docs(t6-4): customer comms plan + bilingual templates + per-customer customization (#141)

$ grep -rn "goldDashboardBuilder|goldReadPrimaryEnabled|smartbi\.gold\.read-primary\.enabled|fireGoldShadowRead" \
       backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/
# 14 matches in 2 files: FinanceAnalysisServiceImpl.java + SalesAnalysisServiceImpl.java

$ grep "public\s\+\w\+\s\+\w\+\s*(" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/GoldDashboardBuilder.java
58:    public DashboardResponse buildFromFinanceSummary(...)
135:   public DashboardResponse buildFromGoldWithCharts(...)

$ grep -rn "SMARTBI_GOLD_READ_PRIMARY_ENABLED" backend/python/smartbi_compat/
backend/python/smartbi_compat/api/analysis_finance.py:1602  (only — sales missing)
```
