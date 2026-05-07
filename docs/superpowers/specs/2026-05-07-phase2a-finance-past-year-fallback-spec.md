# Phase 2A — Finance Past-Year Fallback (Discovery Findings)

**Author**: Phase 2A finance past-year discovery chat
**Date**: 2026-05-07
**Task**: #24 finance past-year fallback content (Java emits kpiCards/top_stores Python omits)
**Status**: Phase A discovery only — **dormant risk, no impl needed today**

---

## TL;DR

Task #24 was originally framed as an active gap ("Java emits kpiCards/top_stores Python omits"). Phase A discovery (recorded F999 + F001 past-year goldens against Java prod 10010 with `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true`, plus curl Python prod 8083) shows **both sides currently return identical empty `overview` shape** for past-year date ranges. The gap is **latent** — it would only manifest if some factory ever populates Silver/Gold POS data, which has not happened on prod for any tenant including F001 canary.

**Recommendation**: ship this discovery doc + 2 goldens, do not write impl PR-B/C/D. Revisit Phase B when (1) a factory's POS Excel is uploaded for past-year and Silver→Gold ETL populates `fact_pos_transaction`, OR (2) T6.4 100% factories cutover surfaces a real divergence on a tenant other than F001.

---

## 1. Background — What task #24 actually means

### 1.1 Java path: Gold-primary via Python Gold endpoints

`FinanceAnalysisServiceImpl.getFinanceOverview` (line 112-190) — when `goldReadPrimaryEnabled=true` (prod env has it ON via `.env.prod`):

1. Try `goldDashboardBuilder.buildFromFinanceSummary(factoryId, startDate, endDate)`.
2. `GoldDashboardBuilder` (`backend/java/.../service/smartbi/GoldDashboardBuilder.java`) is a **Java client** that calls **Python's** `/api/smartbi/gold/finance-summary` via `GoldFinanceClient`. It's not reading `fact_pos_transaction` directly from Java side.
3. If non-null: return 4 KPI cards (`total_revenue` / `bill_count` / `avg_bill_value` / `store_count`) + `rankings.top_stores` (from `gold.top_stores`).
4. If null (revenue=0 AND bills=0 in Silver): return CLEAN empty `DashboardResponse` (line 135-142) — skip slow legacy.
5. On exception: fall through to legacy `getProfitMetrics` + `getReceivableMetrics` + 3 charts + insights + suggestions.

**Note on the original task wording**: "Java reads fact_pos_transaction Gold; Python doesn't" was inverted. The Gold layer is **Python-side** (`/api/smartbi/gold/*`); Java's `GoldDashboardBuilder` is a downstream consumer. Both Java's primary path AND the Python `analysis_finance` port depend on the same upstream Gold endpoints.

### 1.2 Python path: bare empty stub for `overview`

`backend/python/smartbi_compat/api/analysis_finance.py`:

- Endpoint `@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance")` (line 2939) with empty `analysisType` → `_get_comprehensive_finance_analysis` (line 2509).
- Composite returns 6-key dict: `{overview, costStructure, dateRange, generatedAt, profitMetrics, receivableAging}`.
- `overview` field is populated by `_get_finance_overview` (line 1584) which is a **constant empty stub**: returns `_new_dashboard_response_dict(last_updated=_utc_now_iso(), suggestions=[])`. No Gold call. No legacy ORM call. Always empty.
- Other composite fields (`profitMetrics`, `costStructure`, `receivableAging`) ARE real impls querying `SmartBiFinanceData` ORM.

**Why empty stub was OK at Phase 2A port time**: the F999 golden recording (per docstring line 1585-1592) showed Java's Gold-primary path returning empty when `buildFromFinanceSummary` returns null — which is the case for F999 (no data factory) by definition. The stub matches. The stub was never updated to reflect what Java would emit *when Gold has data*.

### 1.3 Empirical shape check (recorded 2026-05-07)

Recorded against Java prod 10010 (with `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true`):

| Factory + range | `overview.kpiCards` | `overview.rankings` | `overview.charts` |
|---|---|---|---|
| F999 past-year (2024-01-01 → 2024-12-31) | `[]` | `{}` | `{}` |
| F001 past-year (2024-01-01 → 2024-12-31) | `[]` | `{}` | `{}` |
| F001 current year (2026-01-01 → 2026-05-07) | `[]` | `{}` | `{}` |

Python prod 8083 (curl localhost via SSH, F001 past-year): identical empty shape (modulo `lastUpdated` timestamp which is volatile).

**Both sides are byte-shape equivalent** under current data conditions. T6.1 dryrun's reported 100% parity holds.

Goldens checked into `tests/fixtures/java-smartbi-golden/`:
- `analysis-finance-F999-past-year.json`
- `analysis-finance-F001-past-year.json`

---

## 2. Why the gap is dormant

The gap requires `goldDashboardBuilder.buildFromFinanceSummary` to return **non-null**. That requires Python's `/api/smartbi/gold/finance-summary` to return data with `total_revenue > 0` OR `bill_count > 0`. That in turn requires:

1. POS Excel uploaded for the factory + date range (Bronze → Silver ingestion path).
2. Silver→Gold ETL having run for that range (`fact_pos_transaction` materialized).
3. Gold `finance_summary` view populated.

For F001 (canary) and all other factories on prod today: **none of these are populated for past-year ranges**. The empirically observed empty-everywhere state is consistent with that.

---

## 3. Conditions that would activate the gap

Phase B/C/D should be triggered if any of:

1. A factory begins uploading POS Excel for past-year ranges and Silver→Gold ETL populates `fact_pos_transaction`. New POS data on prod = surface check needed.
2. Silver→Gold backfill job runs for historic data (a Phase 4.5 work item per retrospective doc).
3. T6.4 100% factories cutover surfaces a non-empty `kpiCards` from Java that Python omits — e.g., for a non-F001 factory whose Gold endpoint already has data.
4. Manual Gold seeding for a demo / pilot tenant.

Detection signal: T6 dryrun-compare or post-cutover monitoring shows `overview.kpiCards.length` diverging between Java and Python for the same `(factory, date range)`.

---

## 4. If/when Phase B is triggered — sketch (not impl spec)

When the trigger fires, Phase B impl would mirror Java's gold-primary branch in Python:

```python
# In analysis_finance.py, replace _get_finance_overview stub with:
async def _get_finance_overview(factory_id: str, range_: DateRange) -> dict:
    # Mirror Java FinanceAnalysisServiceImpl.getFinanceOverview gold-primary branch.
    # 1. Call internal Gold endpoint (same URL Java's GoldFinanceClient uses)
    # 2. If non-null: build 4-KPI dashboard response
    # 3. If null: return current empty stub (matches Java line 135-142 empty)
    ...
```

Open questions deferred until trigger:
- Should Python call its own `/api/smartbi/gold/finance-summary` (HTTP self-call, ugly) OR call the Gold service function directly (cleaner)?
- KPI card field-level shape (per Rule 9: Lombok `@Builder` for `KPICard.java` — emit nulls, decapitalize quirks).
- `top_stores` `RankingItem` shape (Rule 9 again).
- `lastUpdated` ISO format (Rule 11: `_java_isoformat` to drop trailing-zero microseconds).

These are spec gaps that can be left for Phase B's own design pass — premature to enumerate here without test data.

---

## 5. Out of scope (for both Phase A and any future Phase B)

- Java side changes (no edits to `FinanceAnalysisServiceImpl` or `GoldDashboardBuilder`).
- `fact_pos_transaction` schema, Gold view definitions, Silver→Gold ETL frequency.
- The `analysisType=profit/cost/receivable/budget/payable` per-type sub-endpoints (those are real impls, not the empty stub).
- Java legacy fallback path (the non-Gold-primary branch line 149-189 of `FinanceAnalysisServiceImpl`) — not exercised on prod with the flag ON.

---

## 6. Risks of doing nothing

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| New tenant onboards with POS data → divergence on first request | Medium (depends on customer pipeline) | Low (graceful fallback emits 200 OK with simplified shape) | T6 monitoring alarm on `overview.kpiCards.length` divergence between Java and Python |
| Silver→Gold backfill populates F001 historic data | Low (no announced backfill plan) | Medium (canary diverges, T6.2 metrics noisy) | Same monitoring; rollback canary route to Java if alert fires |
| Data fabric Sub-Project D adds Gold-data on a quiet schedule | Low (visible in deploy reviews) | Medium | Cross-reference Phase 4.5 plans before merging Gold-write changes |

All three risks are detection-oriented, not blocking. Phase A's cost is < 1 hour. Phase B impl would be 100-200 LOC + 1-2 PRs IF/when triggered.

---

## 7. Phase B trigger checklist (if revisiting)

When a real divergence appears:

1. Re-record F001 (or affected factory) past-year + current-year goldens with current Java prod settings.
2. Confirm Java's `overview.kpiCards.length > 0` for the affected case.
3. Read `GoldFinanceClient` to confirm the wire format Python would consume from its own Gold service.
4. Decide call mechanism: HTTP self-call vs direct Gold service module import (likely the latter — Python's Gold service is `backend/python/smartbi/gold/...` which `analysis_finance.py` can import directly).
5. Mirror per Rules 4/8/9/11/12 of `python-java-port.md` on KPICard + RankingItem shapes.
6. Add F001 past-year + current-year goldens to byte-shape parity gate.

---

## 8. Resumption checklist (Phase A → done; Phase B → dormant)

- [x] Java path discovery — confirmed Gold-primary via Python Gold endpoints, NOT direct fact_pos_transaction read
- [x] Python current state — confirmed `_get_finance_overview` is constant empty stub, never calls Gold
- [x] F999 + F001 past-year goldens recorded against Java prod 10010 with prod flag settings
- [x] Cross-checked Python prod 8083 returns matching empty shape
- [x] Spec / discovery doc written (this file)
- [ ] Phase B impl — **DO NOT START** until trigger condition fires (see §3)

---

## 9. Coordination notes

- Independent of task #29 (uvicorn workers, sister chat). No file overlap.
- Independent of T6.2 canary route. Did not modify nginx vhost.
- Did not call Python through 139 nginx route (used SSH localhost:8083 to avoid polluting T6.2 metrics).
- Did not modify any prod state (read-only golden recording + curl).
