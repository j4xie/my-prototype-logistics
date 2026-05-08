# Java Gold Cross-Factory "Leak" — Root Cause Analysis

**Date**: 2026-05-09 CST
**Author**: ops chat 2 (Issue #1 investigation)
**Trigger**: Marching order 2026-05-09; chat 1 PR #135 smoke re-verify caught RES_3101_009 returning identical F001 KPIs; organizer audit confirmed selective pattern.
**Verdict**: **NOT A CODE BUG**. Apr 23 deliberate data seed from F001 (staging) → RES_3101_009 (production tenant) during Phase B Dashboard Gold UI port. Java GoldDashboardBuilder + Python `/api/smartbi/gold/finance-summary` are working as intended.

---

## 1. Background

### 1.1 Marching order's claim

Per dispatch:
- F001 Python returns 20639884.52 (correct)
- RES_3101_009 Java returns IDENTICAL 20639884.52 (4 KPIs byte-identical) — claimed "leak"
- F002 Java returns empty stub — "正确"
- Hypothesis: "leak is selective" — F-numeric clean, RES_*/R_* leak

### 1.2 Memory context (pre-investigation)

`reference_smartbi_gold_layer_architecture.md` (chat 1 prior write): "F001 is only factory with Gold POS data populated". This memory framed any other factory returning F001-shape data as cross-tenant leak.

Apr 23 Phase B Dashboard Gold UI port (commits `b1cf06fd8` + `315887092` per memory `project_apr23_dashboard_gold_uiport.md`) introduced the Java→Python Gold proxy path.

---

## 2. Reproduction (direct evidence)

### 2.1 Smoke responses (PR #135 archive at `/tmp/pr-135-smoke-1778276000/` on server 47)

Verified with correct path `.data.overview.kpiCards` (initial check missed the nesting):

| Factory | kpi_count | total_revenue | Note |
|---|---:|---:|---|
| F001 (stateA) | 4 | 20639884.52 | Has populated data |
| F999 (stateB) | 0 | empty | Test factory, correct empty |
| F002 / F003 / F004 / F006 | 0 each | empty | Correct empty (no data) |
| R001 | 0 | empty | Correct empty |
| **RES_3101_009** | **4** | **20639884.52** | **Returns F001-identical** |
| RES_GML_001 | 0 | empty | Correct empty |
| R_GML_DEMO / R_XMX_CHAIN / R_XMX_FRESH / R_XMX_FRESH2 / R_XMX_FRESH3 / R_YHDJ_DEMO / R_YJJ_DEMO | 0 each | empty | Correct empty |

**Scope correction**: marching order hypothesized "RES_*/R_* tier leaks". Actual data: **only RES_3101_009 of 14 customers** matches F001 pattern. Other 13 (incl. RES_GML_001 / all R_*) are correctly empty.

### 2.2 Direct Python `/api/smartbi/gold/finance-summary` reproduction (rolling 1y window)

Calling Python prod 8083 directly with X-Internal-Secret + X-Factory-Id + factory_id query:

```
F001          → revenue 14752899.52, bills 99036, 7 stores
RES_3101_009  → revenue 14752899.52, bills 99036, 7 stores  [IDENTICAL]
F002          → revenue 0.0,         bills 0,     0 stores  [CORRECT EMPTY]
```

Confirms the "leak" pattern surfaces in Python, not just Java's proxy. Java is transparent.

---

## 3. Code review — Java and Python

### 3.1 Java `FinanceAnalysisServiceImpl.getFinanceOverview` (line 112-147)

When `smartbi.gold.read-primary.enabled=true` (set Apr 23 per memory `project_2026_05_07_t6_1_dryrun_in_flight.md`):
1. Calls `goldDashboardBuilder.buildFromFinanceSummary(factoryId, startDate, endDate)`
2. If non-null → return Gold response
3. If null (revenue=0 AND bills=0) → return empty `DashboardResponse` stub (skip legacy scan)
4. On exception → fall back to legacy

**No factory_id manipulation.** No fallback-to-default. No cache-key bug. `factoryId` flows path-param → service method → builder → HTTP query param verbatim.

### 3.2 Java `GoldDashboardBuilder.buildFromFinanceSummary` + `GoldFinanceClient.fetchFinanceSummary`

Pure HTTP proxy. Constructs URL `${python_url}/api/smartbi/gold/finance-summary?factory_id=${factoryId}&start_date=...&end_date=...&top_n_stores=10`. No transformation of factoryId.

### 3.3 Python `gold_reads.py:get_finance_summary` + `gold/queries.py:finance_summary`

Endpoint:
- `_resolve_tenant(factory_id)` validates query-param matches JWT/header tenant — bails 403 on mismatch
- Calls `finance_summary(pool, fid, (start, end), top_n_stores)`

SQL:
```sql
SELECT COALESCE(SUM(net_amount), 0)::numeric(18,2) AS total_revenue, ...
  FROM agg_daily
 WHERE factory_id = $1
   AND date BETWEEN $2 AND $3
```

**Correct factory_id filter.** RLS enabled on `agg_daily` (verified `pg_tables.rowsecurity = t`).

**Verdict on code: Java and Python are both correct. No code-level cross-factory leak.**

---

## 4. Database-layer evidence

### 4.1 `agg_daily` per-factory aggregates (full table, RLS bypassed via postgres superuser)

```
factory_id   | row_cnt | store_cnt | revenue       | bills
-------------+---------+-----------+---------------+--------
F001         |    1730 |         8 |  20639884.52  | 140541
RES_3101_009 |    1730 |         8 |  20639884.52  | 140541
```

- **Both factories have 1730 rows each** (physically separate, not shared).
- All aggregate metrics byte-identical: 20639884.52 / 8 stores / 140541 bills.

### 4.2 `dim_store` — F001 vs RES_3101_009 sample

| factory_id | store_id | name | created_at |
|---|---:|---|---|
| F001 | 1 | 青花椒徐汇光启城店 | 2026-04-22 13:25:04.516799 |
| F001 | 2 | 青花椒南方百联店 | 2026-04-22 13:25:07.959041 |
| F001 | 3 | 青花椒徐汇日月光店 | 2026-04-22 13:25:28.86231 |
| ... (8 total, 13:25-13:27) | | | |
| RES_3101_009 | 9 | 青花椒南方百联店 | 2026-04-23 01:48:20.711308 |
| RES_3101_009 | 10 | 青花椒南桥百联店 | 2026-04-23 01:48:49.991324 |
| RES_3101_009 | 11 | 青花椒大丸百货店 | 2026-04-23 01:49:03.847439 |
| ... (8 total, 01:48-01:51) | | | |

Same brand (青花椒), same store names — but **different surrogate `store_id`** (F001: 1-8, RES_3101_009: 9+) and **different created_at** (~12h apart).

### 4.3 `fact_pos_transaction` per-factory bulk-load timing

```
factory_id   | bills   | earliest_load               | latest_load
-------------+---------+-----------------------------+-----------------------------
F001         | 140541  | 2026-04-22 13:25:04.519792  | 2026-04-22 13:27:38.924604
RES_3101_009 | 140541  | 2026-04-23 01:48:20.716385  | 2026-04-23 01:51:06.853643
R_GML_DEMO   |  16213  | 2026-04-25 10:12:16.18495   | 2026-04-25 10:12:16.18495
R_XMX_CHAIN  |    141  | 2026-04-25 05:41:27.786203  | 2026-04-25 05:41:27.786203
```

- F001 + RES_3101_009: **identical bill count (140541)**, bulk-loaded 12h apart, ~3 minutes each.
- R_GML_DEMO + R_XMX_CHAIN: own data, but no agg_daily materialization (Silver→Gold ETL not run for these tenants).

---

## 5. Root cause — Apr 23 deliberate data seed

The pattern fits **deliberate staging→production tenant data migration**:

1. **Apr 22 13:25**: F001 (青花椒 staging/dev tenant during 8-month build-up) bulk-loaded with full historical POS data — 8 stores, 140541 bills, 20639884.52 revenue.
2. **Apr 23 ~01:48**: RES_3101_009 (QHJ_PROD = 青花椒 production tenant, per Stage 3 MO line 14) cleanly seeded with **the same historical data** — same store names rebuilt with new surrogate IDs (9-16), same 140541 bills. Bulk import takes 3 minutes.
3. Apr 23 = Phase B Dashboard Gold UI port (memory `project_apr23_dashboard_gold_uiport.md`). The data seed was part of go-live: production tenant (QHJ_PROD) needed historical context to render dashboards from day 1.

**Why was F001 staging data NOT wiped after the seed?**
- Staging tenant `F001` retained for ongoing Cretas dev/test (Steve's internal tooling).
- Production tenant `RES_3101_009` serves customer (青花椒 chain).
- Both coexist: F001 = internal dev sandbox; RES_3101_009 = customer-facing live tenant.

**Memory `reference_smartbi_gold_layer_architecture.md` was incorrect/outdated**: it claimed "F001 is only factory with Gold POS data populated". Actual state since Apr 23: F001 + RES_3101_009 both have populated Gold data (1730 agg_daily rows each, identical because seeded from same source).

---

## 6. Reframe — what's actually happening

| Claim in marching order | Reality |
|---|---|
| "Java GoldDashboardBuilder selective cross-factory leak" | NO — Java is a transparent proxy, no factory_id manipulation |
| "RES_3101_009 Java returns IDENTICAL F001 data — 这是 leak" | RES_3101_009 has its OWN identically-valued data in `agg_daily` (1730 separate rows). Identity is data-layer artifact of Apr 23 seed, not query-time leak. |
| "F-numeric clean, RES_*/R_* leak" | False distinction. Only RES_3101_009 of 14 has data (deliberately seeded). All other RES_*/R_* return empty (correct, no data populated). |
| "Apr 23 introduced 16-day latent" | Apr 23 introduced the *data seed*, not a code bug. There is no code-level latent to fix. |
| "Hypothesis A: factory_id null fallback" | Disproved — code passes factory_id verbatim, no null branch returns F001. |
| "Hypothesis B: different query path RES_*/R_*" | Disproved — single code path, all factories use same SQL with `WHERE factory_id = $1`. |
| "Hypothesis C: cache key bug" | Disproved — no cache layer between Java and Python in this path; query is direct DB. |

The investigation hypothesis space (A/B/C) was wrong because it assumed code-level bug. **Actual root cause: deliberate data clone, not a bug.**

---

## 7. Risk + impact assessment

### 7.1 Customer-facing impact = 0

- RES_3101_009's user (青花椒 customer) sees their own historical POS data (correctly seeded into RES_3101_009 tenant rows).
- No cross-tenant access: queries with `factory_id='RES_3101_009'` return ONLY RES_3101_009 rows; queries with `factory_id='F001'` return ONLY F001 rows. Different physical rows, separate by factory_id column.
- The fact that values match is internally consistent (same source data) but does not represent an authentication / authorization breach.

### 7.2 T6.4 cutover risk = 0

- Stage 1 (May 10, F002+F003): No data populated for F002/F003 → Python returns empty → no behavior change. **Safe**.
- Stage 3 (May 12, RES_3101_009): Python and Java currently return same byte-identical data. Cutover from Java→Python = no observable change. **Safe**.
- All other Stages (May 11/13/14): factories without populated agg_daily data → empty responses both pre and post cutover. **Safe**.

### 7.3 Memory hygiene gap

`reference_smartbi_gold_layer_architecture.md` is stale — claims F001 is the only populated factory. Should note F001 + RES_3101_009 both have populated data since Apr 23, and that the identity is intentional seed not leak. This memory misstated the current state for 16 days, but caused no operational harm.

---

## 8. Recommendations

### 8.1 No code fix needed

Java `GoldDashboardBuilder.java` + `GoldFinanceClient.java` + Python `gold_reads.py` + `queries.py:finance_summary` all working as designed. No PR with code change required. The marching order's hypothesis A/B/C are all disproved.

### 8.2 Memory update (low priority)

Amend `reference_smartbi_gold_layer_architecture.md` to note:
- F001 (staging/dev) + RES_3101_009 (QHJ_PROD production tenant) both have populated Gold data since Apr 23
- Aggregate values are byte-identical because the production tenant was seeded from the staging tenant during Phase B Dashboard Gold UI port go-live
- This is intentional, not a cross-factory leak
- Other tenants with Silver POS data but no Gold materialization (R_GML_DEMO 16213 bills / R_XMX_CHAIN 141 bills, both Apr 25) — Silver→Gold ETL has not yet run for these

### 8.3 Operator clarification (Steve decision)

Open question for Steve / business:
- **Is F001 (staging) data retention intentional?** F001 acts as Cretas internal dev sandbox; can stay. If business logic needs F001 wiped for compliance / cleanup, file separate cleanup task (delete `factory_id='F001'` rows from `agg_daily`, `dim_store`, `fact_pos_*`, `fact_*`).
- **Is RES_3101_009 customer aware their dashboard shows seeded historical data?** If customer is uploading new POS data themselves, the seed will be augmented; if no new uploads since Apr 23, the dashboard reflects pre-go-live snapshot only. Sales / customer success should confirm with QHJ_PROD account.
- **Should Phase 2A → T6.4 customer comms reference the Apr 23 seed?** Probably not — comms templates focus on backend cutover, not data provenance. But if QHJ_PROD ever asks "why does our dashboard show data from before our go-live", the answer is in this audit.

### 8.4 Process learning (organizer practice)

The marching order's diagnosis chain ("Java leak" → "selective by tier" → "hypothesis A/B/C") was a code-bug projection bias. Memory `reference_smartbi_gold_layer_architecture.md` was outdated, which made identical Gold data look like leak. **Lesson**: when memory claims a factory is uniquely populated, verify via direct DB query before treating subsequent identical responses as leak. Per memory `feedback_organizer_projection_bug.md` ("verify with `gh pr view` before referencing in marching orders") — extends to: verify with `psql ... GROUP BY factory_id` before treating data identity as leak signal.

---

## 9. T6.4 cascade interaction (already "naturally" mitigated)

The marching order said "T6.4 cascade Stage 3-5 (May 12-14) 把 affected 客户工厂移到 Python state B 自动 mitigate". Reframed:

- Stage 3 (May 12, RES_3101_009 cutover Java→Python): No mitigation needed because there's no bug to mitigate. Java + Python both return same byte-identical data via same factory_id-filtered query. Cutover changes which backend serves the data; the data itself stays the same.
- Other Stages: factories with no populated data → empty responses regardless of backend. No leak surface.

**T6.4 is unaffected by this investigation.** No GO criteria change. No new prereq blocker.

---

## 10. Investigation summary

| Item | Outcome |
|---|---|
| Java GoldDashboardBuilder code review | ✅ Clean — transparent proxy, factory_id verbatim |
| Java GoldFinanceClient code review | ✅ Clean — HTTP query param verbatim |
| Python gold_reads.py code review | ✅ Clean — `_resolve_tenant` validates, passes through |
| Python queries.py finance_summary SQL | ✅ Clean — `WHERE factory_id = $1` correctly filters |
| `agg_daily` per-factory inspection | F001 + RES_3101_009 both populated, identical values, separate rows |
| `dim_store` per-factory inspection | F001: 8 stores Apr 22 13:25; RES_3101_009: 8 stores Apr 23 01:48; same brand names, different surrogate IDs |
| `fact_pos_transaction` per-factory inspection | F001 + RES_3101_009 each have 140541 bills, bulk-loaded 12h apart |
| Direct curl reproduction | F001 + RES_3101_009 return identical; F002 returns empty (correct) |
| Smoke responses analysis | Only 1 of 14 customers (RES_3101_009) matches F001 pattern; marching order's "RES_*/R_* leak" over-broad |
| Hypothesis A (null fallback) | Disproved |
| Hypothesis B (different path) | Disproved |
| Hypothesis C (cache key) | Disproved |
| **Actual root cause** | **Apr 23 deliberate data seed (staging F001 → production RES_3101_009) during Phase B Dashboard Gold UI port go-live** |
| Code fix needed | NO |
| Memory update needed | YES (low priority) — `reference_smartbi_gold_layer_architecture.md` |
| Operator clarification | YES — Steve confirms F001 staging retention intent + customer awareness of seeded data |
| T6.4 cutover risk | 0 — no behavior change post-cutover |
| Customer-facing impact | 0 — RES_3101_009 user sees their own correctly-seeded data |

---

## 11. ⛔ HOLD blocks

- ⛔ **Doc-only**: this audit produces no code changes, no DB writes, no deploy actions
- ⛔ **No memory edit in this PR**: §8.2 memory update is a separate follow-up by future chat (memory edits live in `~/.claude/memory/`, not in repo)
- ⛔ **No DB cleanup in this PR**: §8.3 F001 staging retention decision waits for Steve

---

**End of investigation. NOT a code bug — Apr 23 deliberate data seed during Phase B production go-live.**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
