# Restaurant Tenant Kitchen Cost & Ops Analytics — Phase IIb Implementation Spec

**Status**: **READY for impl dispatch — Cycle-1 through cycle-4 audits all complete (2026-05-15). OQ-2 + OQ-IIB-NEW signed off (Hybrid). Spec frozen for impl.**
**Date**: 2026-05-15
**Last audit**: cycle-1 spec review (subagent, 2026-05-15, 4 CRITICAL + 7 IMPORTANT + 5 MINOR all fixed in this cycle-2 amend) + Pre-IIb data audit (subagent, 2026-05-15, 8 schema drift fixed)
**Author**: Architecture review (subagent draft for organizer review)
**Audience**: Backend Python engineer (subagent impl), frontend Vue engineer, product owner (Steve)
**Trigger**: Phase IIa shipped 2026-05-14 (PRs #633 backend / #634 frontend / #641 nginx / #644 close-out / #647 spec amendment + COALESCE follow-up). Restaurant tenants now see revenue-side analytics. Phase IIb fills the immediate next gap: *"我卖了多少钱看到了，但成本去哪了？"*

---

## STATUS (read first)

- **Phase IIa**: ✅ **SHIPPED** 2026-05-14. RES_3101_009 verified ¥20.6M in prod end-to-end. 14 R_*_REAL chains remain onboarding-blocked (no Bronze POS data). This spec assumes Phase IIa as completed prerequisite.
- **Phase IIb**: **DRAFT, cycle-1 through cycle-4 audits ALL complete** — OQ-2 + OQ-IIB-NEW signed off 2026-05-15 (Hybrid: ship empty-state-graceful + showcase R_XMX_CHAIN + RES_3101_009 wastage; 13 empty chains see SmartBIEmptyState; not gated on data). Cycle-4 verdict: **READY for impl dispatch** (0 CRITICAL, 2 IMPORTANT applied in this commit, 4 MINOR applied). Pre-IIb data audit complete.
- **Phase IIc**: Untouched by this spec; full P&L remains the Phase IIc scope per IIa spec §3 (gated on OQ-3 cost-ingestion decision and `fact_cost_line` having data — note: `fact_cost_line` confirmed empty for ALL factories per Pre-IIb audit, not just restaurants).
- **Next dispatch**: cycle-3 reviewer pass (mechanical re-audit, expected light), then subagent impl dispatch (backend / frontend / nginx PRs).
- **Pending Steve decisions**: OQ-2 ✅ signed off Hybrid; OQ-IIB-NEW ✅ signed off (accept est_cost + caveat); OQ-1 ✅ N/A (no fact_cost_line anywhere).

## Table of Contents

- [STATUS](#status-read-first)
- [§0 TL;DR](#0-tldr-for-product-owner)
- [§0.5 Pre-IIb Prerequisite: Restaurant Ops Data Audit](#05-pre-iib-prerequisite-restaurant-ops-data-audit)
- [§1 Background and Customer Needs](#1-background-and-customer-needs)
- [§2 Data Sources Inventory](#2-data-sources-inventory)
- [§3 Phasing — Shippable Chunks](#3-phasing--shippable-chunks)
- [§4 API Contracts](#4-api-contracts)
  - [§4.5 Edge Cases](#45-edge-cases)
- [§5 UI / Frontend Changes](#5-ui--frontend-changes)
  - [§5.6 Empty-State UX](#56-empty-state-ux-critical-section)
  - [§5.7 Rollback strategy](#57-rollback-strategy)
- [§6 Migration Plan](#6-migration-plan)
  - [§6.3 RLS Pattern Decision](#63-rls-pattern-decision)
- [§7 Risks and Open Questions](#7-risks-and-open-questions)
- [§8 Out of Scope](#8-out-of-scope-explicit-list)
- [§9 Implementation Map](#9-implementation-map-build-sequence)
- [§10 Cross-References](#10-cross-references)
- [§11 Sign-off](#11-sign-off-required-before-dispatch)

---

## 0. TL;DR for Product Owner

Phase IIa shipped a *revenue-side* dashboard for restaurant tenants — they can now see daily sales, dish rankings, payment channels, and 堂食/外卖 mix. The natural next question every restaurant operator asks is **"成本去哪了?"** ("Where did costs go?"). Phase IIb answers that question *using only data Cretas already collects today* — without requiring new ingestion flows or accounting-system integration (those remain the Phase IIc scope).

The data Cretas already collects via the materials/kitchen management module:
- **Wastage records** (`fact_restaurant_wastage`) — spoilage, expiry, damage events with `estimated_cost`
- **Requisition records** (`fact_restaurant_requisition`) — kitchen ingredient pulls with `est_cost`
- **Stocktaking records** (`fact_restaurant_stocktaking`) — inventory variance with `difference_cost`
- **POS revenue** (`agg_daily.actual_receive` with `gross_amount` COALESCE fallback per IIa shipped pattern) — Phase IIa denominator for ratio calculations

Phase IIb delivers **4 reports** in a single composite `/analysis/kitchen-cost` endpoint:
1. **食材损耗分析** — wastage trend, top-waste ingredients, wastage rate (loss / requisition cost)
2. **领料成本趋势** — requisition cost timeseries grouped by ingredient category
3. **盘点差异报告** — stocktaking variance by ingredient over period
4. **食材成本占比** — food cost ratio (requisition est_cost / POS actual_receive) with industry benchmark (30% healthy / 35% warning / 40% critical)

This is intentionally *not* a full P&L (that needs accounting data we don't have for restaurants — Phase IIc territory). Phase IIb is the cheapest, fastest "cost story" we can ship using only existing data. **The biggest risk is data availability**: prior audits (`docs/qa-audits/2026-05-11-restaurant-data-readiness-audit.md §1.4`) suggest most chains do not actively log wastage/requisition events through Cretas. The spec accepts this and mandates a fully graceful empty-state UX (§5.6).

**Effort**: 6-9 days total — 1 backend Python PR (new `analysis_restaurant_ops.py` module, 3 days) + 1 frontend Vue PR (new `RestaurantKitchenCostContent.vue` sub-component + AnalysisType enum extension + 3 force-redirect-to-profit guards removed in `FinanceAnalysis.vue`, 2-3 days incl. **+1 day for tab restructure** since IIa hides tab switcher for restaurant tenants and force-redirects to `'profit'`) + 1 nginx ops PR (extend single shared snippet `smart-bi-routing.conf`, 0.5 day).

**Gating**: Phase IIa ship ✅ + Steve OQ-2 ✅ (Hybrid signed off 2026-05-15) + Steve OQ-IIB-NEW ✅ (est_cost + caveat accepted 2026-05-15) + Pre-IIb data audit ✅ (§0.5).

---

## 0.5 Pre-IIb Prerequisite: Restaurant Ops Data Audit

### Why this is the immediate work

Phase IIa's pre-deploy audit (cycle-2, `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md §0.5`) ran OQ-4 SQL against `smartbi_prod_db` and revealed only 3 of 15 chains had Silver POS data; 14 R_*_REAL chains were onboarding-blocked. Phase IIb has an analogous data risk on the **ops side** — wastage, requisition, and stocktaking records. We must not repeat the IIa cycle-1→cycle-2 surprise where the spec premised "data is available" but prod query revealed gaps.

### Audit scope (Track P — Pre-IIb data audit, 0.5 day)

Run a single SQL query against `smartbi_prod_db` from server 47:

```sql
-- Track P1: Wastage coverage per chain
SELECT factory_id,
       COUNT(*) AS wastage_events,
       MIN(date) AS first_date,
       MAX(date) AS last_date,
       SUM(estimated_cost) AS total_cost
FROM fact_restaurant_wastage
GROUP BY factory_id
ORDER BY factory_id;

-- Track P2: Requisition coverage per chain
SELECT factory_id,
       COUNT(*) AS requisition_events,
       MIN(date) AS first_date,
       MAX(date) AS last_date,
       SUM(est_cost) AS total_cost
FROM fact_restaurant_requisition
GROUP BY factory_id
ORDER BY factory_id;

-- Track P3: Stocktaking coverage per chain
SELECT factory_id,
       COUNT(*) AS stocktaking_lines,
       COUNT(DISTINCT date) AS distinct_dates,
       MIN(date) AS first_date,
       MAX(date) AS last_date,
       SUM(ABS(difference_cost)) AS total_variance_cost
FROM fact_restaurant_stocktaking
GROUP BY factory_id
ORDER BY factory_id;

-- Track P4: Gold daily totals (for trend rendering performance hint)
SELECT factory_id,
       COUNT(*) AS days,
       MAX(wastage_cost_total) AS max_daily_wastage_cost,
       MAX(requisition_cost_total) AS max_daily_requisition_cost
FROM agg_restaurant_daily_totals
GROUP BY factory_id
ORDER BY factory_id;

-- Track P5: status enum distribution (drives WHERE-clause filter spec)
-- Run with GROUP BY status to verify spec'd filters land actual data
SELECT factory_id, status, COUNT(*) FROM fact_restaurant_wastage GROUP BY factory_id, status ORDER BY factory_id, status;
SELECT factory_id, status, COUNT(*) FROM fact_restaurant_requisition GROUP BY factory_id, status ORDER BY factory_id, status;
SELECT factory_id, status, COUNT(*) FROM fact_restaurant_stocktaking GROUP BY factory_id, status ORDER BY factory_id, status;
```

### Pre-IIb Data Audit Results (2026-05-15)

Subagent ran the audit. Coverage matrix (rows in `fact_restaurant_*` per chain):

| chain | wastage | requisition | stocktaking |
|---|---|---|---|
| RES_3101_009 (QHJ) | 6 (03-31→04-23) | 0 | 0 |
| R_XMX_CHAIN | 4 (04-15→04-23) | 8 (04-15→04-24) | 1 (04-24) |
| R_GML_DEMO | 0 | 0 | 0 |
| 13 其他 R_*_REAL | 0 | 0 | 0 |

**Track P3 / fact_cost_line**: empty for ALL factories (not just restaurants — OQ-1 / OQ-3 closure: no alternate path).

**Track P5 status enum actual values** (prod, all factories combined):
- `fact_restaurant_wastage.status`: `APPROVED`, `DRAFT`, `REJECTED`, `SUBMITTED` (spec'd in §2.1 was wrong — only 3 enum values assumed; actual = 4)
- `fact_restaurant_requisition.status`: `APPROVED`, `REJECTED` (no `PENDING`, no `SUBMITTED`, no `DRAFT`)
- `fact_restaurant_stocktaking.status`: `APPROVED`, `CANCELLED`, `COMPLETED`, `IN_PROGRESS`

**`wastage_type` actual enum** (prod): `DAMAGED`, `EXPIRED`, `OTHER`, `PROCESSING`, `SPOILED` (5 values; spec'd in old §2.1/§4.2/§5 as `SPOILAGE/EXPIRY/DAMAGE/OTHER` — wrong, now corrected throughout).

**`dim_ingredient.category` reality**: 20 messy free-text values + 31 NULL rows. Top categories: 肉类(12), 蔬菜(10), 水产(9), 调味料(8). Synonym pollution: 蔬菜/蔬菜类, 调味料/调料, 主食/主粮类. NOT the "5 clean categories" originally spec'd. Implementation must normalize via Python-side dict mapping + NULL → "其他" (see §2.1 normalization rules + §1.4 caveat).

**Steve OQ-2 verdict (signed off 2026-05-15)**: **Hybrid path**:
- Showcase chains: R_XMX_CHAIN renders 3-table real data; RES_3101_009 renders wastage real data + ratio/requisition/stocktaking empty-state per-section
- 13 empty chains (R_GML_DEMO + 12 others): render whole-tab `SmartBIEmptyState` (mirrors 14 R_*_REAL onboarding-blocked pattern from IIa)
- **NOT gate on ETL populating data** — ETL doesn't push events; we wait indefinitely if we gate. Ship empty-state-graceful + showcase the chains that DO have data.

**Steve OQ-IIB-NEW verdict (signed off 2026-05-15)**: accept `est_cost` as denominator + ratio numerator, surface caveat in `foodCostRatio.dataCaveats` (§7.2).

**Steve OQ-1 verdict (signed off 2026-05-15)**: N/A — `fact_cost_line` confirmed empty for ALL factories (not restaurant-specific); no fallback path exists for any tenant. Phase IIc remains gated until cost ingestion implemented.

### Acceptance criteria (gate Phase IIb dispatch)

The audit output fed the **OQ-2 decision** (resolved 2026-05-15 — see Hybrid block above). Below is the original branch enumeration kept for historical context; the actual outcome was effectively **Branch A** (`R_XMX_CHAIN` has all 3 fact-table types) + **Branch B1** for the 14 dark chains.

<details><summary>Original branch enumeration (decision input — now resolved)</summary>

- **Branch A (any chain has real data)**: If ≥1 chain has non-zero rows in both `fact_restaurant_wastage` AND `fact_restaurant_requisition` (with overlapping date range so wastage rate can compute), Phase IIb dispatchable as full-feature. That chain becomes the Phase IIb verification target.
- **Branch B (only QHJ seed has data)**: If only `RES_3101_009` (seeded by `backend/python/smartbi/database/migrations/2026_04_25_qhj_demo_seed.sql` and its v2-v5 follow-ups) has wastage rows but no R_*_REAL chain does, Steve decides:
  - **B1**: ship empty-state-graceful (UI renders empty CTA for 14 onboarding-blocked chains, real charts for QHJ demo) — recommended, low-risk
  - **B2**: defer Phase IIb until ≥1 R_*_REAL chain has real ops data (gates on customer adoption, not engineering work)
- **Branch C (no chain has any ops data at all, including QHJ)**: Defer Phase IIb entirely. Phase IIb spec stays valid as design artifact; no dispatch.

**Resolution**: prod has `R_XMX_CHAIN` (all 3 fact types) → Branch A path active for that chain. `RES_3101_009` (wastage-only) → partial-data path. 13 R_*_REAL chains → B1 empty-state-graceful path. No Branch C trigger.

</details>

### What this audit answers for OQ-2

OQ-2 from IIa spec §3 was carried forward as "Gate Phase IIb on at least one chain having real ops data, or ship empty-state-graceful?" The Track P audit gives the factual basis. **Engineering recommendation**: ship empty-state-graceful (Branch B1) unless Track P3 returns zero rows for every chain (Branch C). Rationale:
- Phase IIa cost was already paid to add restaurant branch + nginx routing — incremental cost of IIb backend is small
- Empty-state UX with CTA "在领料管理/损耗记录模块录入数据后，此处将自动分析" is itself product value (educates customers on what data Cretas can analyze)
- Once a chain starts logging ops events, charts auto-populate with zero engineering involvement

### Out of scope for Pre-IIb audit

- Bronze→Silver→Gold backfill for new wastage/requisition data (no analog to IIa Track B — these tables are written directly by mobile app + ERP UI, not from Bronze parsing)
- New ingestion flows for accounting cost data (Phase IIc territory)
- Customer outreach to ask chains to start logging events (Operations/Product responsibility, not engineering)

---

## 1. Background and Customer Needs

### 1.1 What Phase IIa Delivered

Per `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md §3 Phase IIa` and ship PRs (#633 backend, #634 frontend, #641 nginx, #644 acceptance memo, #647 spec amendment + COALESCE follow-up):

- `/smart-bi/sales` and `/smart-bi/finance?analysisType=overview` now serve restaurant tenants with revenue dashboards
- Backend: `_restaurant_sales_dispatch()` + `_restaurant_finance_overview()` in `analysis_sales.py` / `analysis_finance.py`
- Frontend: restaurant blocks in `SalesAnalysis.vue` + `FinanceAnalysis.vue` (under `v-if="isRestaurantTenant"`)
- Nginx: `(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales)` allowlist
- RLS pattern: WHERE-clause + `auth_middleware.py:220 (set_factory_id ContextVar)` + `smartbi/tenant_ctx.py` pool-setup-callback that issues `set_config('app.factory_id', ...)` per connection (per `reference_smartbi_rls_via_auth_middleware_guc.md` + HARD rule `feedback_test_rls_with_real_pool_not_psql_reset.md` — psql RESET tests do NOT exercise pool sentinel branch)

Customer verified: `RES_3101_009` QHJ chain shows ¥20.6M revenue end-to-end in prod after PR #647 COALESCE follow-up.

### 1.2 What Restaurants Need Next (PRD-style Gap Analysis)

Anchored in recurring asks from `docs/qa-audits/2026-05-11-customer-transcript-vs-shipped-audit.md` and `docs/qa-audits/2026-05-10-customer-meeting-9bug-audit.md`:

Restaurant operators consistently care about food cost control. The questions:

- **损耗率多少?** ("What's my wastage rate?") — total wastage / total food cost
- **哪个食材损耗最严重?** ("Which ingredients waste the most?")
- **领料花了多少?** ("How much did I pull from inventory?")
- **盘点差异大吗?** ("Are we losing/finding inventory?")
- **食材成本占营收多少?** ("Food cost as % of revenue?") — *the* benchmark KPI for restaurants

Industry benchmark for food cost ratio (well-established in restaurant operations):
- **<30%**: healthy / 优秀
- **30-35%**: acceptable / 良好
- **35-40%**: warning / 警戒
- **>40%**: critical / 危险

This benchmark is built into Phase IIb's alert logic (§4.2 `foodCostRatio.alertLevel`).

### 1.3 Why This Is Not Phase IIc (Full P&L)

Phase IIc would deliver true gross margin: `(revenue - all_costs) / revenue`. That needs accounting-system cost data (`fact_cost_line`) with labor, rent, utilities, taxes — none of which Cretas ingests for restaurants today. Phase IIc remains gated on OQ-3 from IIa spec (cost ingestion strategy decision).

Phase IIb deliberately stays in the **operational cost** lane — the costs the kitchen manager *enters into Cretas every day*. This:
- Avoids the data gap that blocks Phase IIc
- Surfaces immediate value from data that *already exists*
- Lets restaurants see *part* of the cost picture (the part Cretas captures) without waiting for accounting integration
- Establishes the UX pattern for the future Phase IIc full P&L view

### 1.4 Explicit Gap Summary (Phase IIb additions)

| Report type | Data available today | Phase | Notes |
|---|---|---|---|
| 食材损耗趋势 (daily/weekly) | `fact_restaurant_wastage` + `agg_restaurant_daily_totals.wastage_cost_total` | IIb | Gracefully empty for chains not logging |
| Top-waste 食材 (ingredient ranking) | `fact_restaurant_wastage` JOIN `dim_ingredient` | IIb | Limit top 10 |
| 损耗率 (% of requisition cost) | `wastage_cost / requisition_cost` per period | IIb | Estimated denominator (see OQ-IIB-NEW) |
| 领料成本趋势 by category | `fact_restaurant_requisition.est_cost` GROUP BY `dim_ingredient.category` | IIb | Category is free-text in prod (20 distinct values + 31 NULL rows); Python-side normalization required: synonym merge (蔬菜+蔬菜类→蔬菜, 调味料+调料→调味料, 主食+主粮类→主食), NULL→"其他", Top-5 + "其他" bucket. UI tooltip: "类别基于食材主数据，部分门店未分类项归入 '其他'." |
| 盘点差异报告 | `fact_restaurant_stocktaking.difference_qty/cost` | IIb | Pos = surplus, Neg = shortage |
| 食材成本占比 (food cost ratio) | `requisition.est_cost / pos.actual_receive` | IIb | Benchmark alert GREEN/YELLOW/RED |
| 毛利率 (P&L gross margin) | **Data gap**: `fact_cost_line` confirmed empty for ALL factories (not just restaurants) per 2026-05-15 Pre-IIb audit. No replacement source. | IIc | OQ-3 still unresolved; OQ-1 closed N/A. Phase IIb uses `est_cost` + caveat instead. |
| 人工/租金/水电 cost breakdown | **Data gap**: same | IIc | OQ-3 unresolved |

---

## 2. Data Sources Inventory

### 2.1 Silver Layer (read from)

All tables already exist; no schema migrations required for Phase IIb. Source: `backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql`.

**`fact_restaurant_wastage`** — kitchen spoilage/damage events
- Columns used: `factory_id`, `date`, `ingredient_id`, `wastage_type` (actual prod enum 2026-05-15: `DAMAGED`, `EXPIRED`, `OTHER`, `PROCESSING`, `SPOILED` — 5 values; old spec wrote `SPOILAGE/EXPIRY/DAMAGE/OTHER`, was wrong), `quantity`, `estimated_cost`, `reason`, `status` (actual prod enum: `APPROVED`, `DRAFT`, `REJECTED`, `SUBMITTED`)
- Index: `idx_fact_wastage_factory_date`, `idx_fact_wastage_factory_type`, `idx_fact_wastage_factory_ingredient`
- RLS: `tenant_isolation` policy USING `factory_id = current_setting('app.factory_id', true)`
- Grain: 1 row per wastage event (typically 0-50 events/day per chain)
- **Status filter**: `status IN ('APPROVED', 'SUBMITTED')` — include approved + submitted-not-yet-rejected events. Exclude `DRAFT` (incomplete) and `REJECTED`.

**`fact_restaurant_requisition`** — kitchen ingredient pull orders
- Columns used: `factory_id`, `date`, `ingredient_id`, `type` (PRODUCTION/MANUAL), `status` (actual prod enum 2026-05-15: `APPROVED`, `REJECTED` — only 2 values; no `PENDING`/`SUBMITTED`/`DRAFT`), `requested_qty`, `actual_qty`, `est_cost`
- Index: `idx_fact_req_factory_date`, `idx_fact_req_factory_ingredient`, `idx_fact_req_factory_status`
- RLS: same `tenant_isolation` pattern
- Grain: 1 row per requisition line item
- **Status filter**: `status = 'APPROVED'` — only approved requisitions contribute to cost trend (`REJECTED` excluded).

**`fact_restaurant_stocktaking`** — inventory variance
- Columns used: `factory_id`, `date`, `ingredient_id`, `status` (actual prod enum 2026-05-15: `APPROVED`, `CANCELLED`, `COMPLETED`, `IN_PROGRESS`), `system_qty`, `actual_qty`, `difference_qty`, `difference_cost`
- Index: `idx_fact_stock_factory_date`, `idx_fact_stock_factory_ingredient`
- **Status filter**: `status IN ('COMPLETED', 'APPROVED')` — both are real completion signals (`COMPLETED` = stocktaking finished; `APPROVED` = reviewed/locked). Exclude `IN_PROGRESS` (counts not final) and `CANCELLED`.
- `difference_qty < 0` means shortage (missing inventory); `difference_qty > 0` means surplus
- `difference_cost` is always positive: `ABS(difference_qty) × unit_price` per Silver schema comment

**`dim_ingredient`** — ingredient metadata for joins
- Columns used: `ingredient_id` (PK), `factory_id`, `name`, `category`, `unit_price`, `shelf_life_days`
- **Category reality (prod 2026-05-15)**: 20 distinct free-text values + 31 NULL rows. Top values: `肉类`(12), `蔬菜`(10), `水产`(9), `调味料`(8). Synonym pollution: `蔬菜` vs `蔬菜类`, `调味料` vs `调料`, `主食` vs `主粮类`. The "5 clean categories" originally spec'd does NOT match prod.
- **Category normalization in Python (REQUIRED for `byCategory` aggregation)**:
  ```python
  CATEGORY_NORMALIZE = {
      "蔬菜类": "蔬菜",
      "调料": "调味料",
      "主粮类": "主食",
      # ...extend as new synonyms surface
  }
  def _normalize_category(raw: Optional[str]) -> str:
      if raw is None or raw.strip() == "":
          return "其他"
      raw = raw.strip()
      return CATEGORY_NORMALIZE.get(raw, raw)
  ```
- After normalization: Top-5 categories + `"其他"` bucket. UI tooltip: "类别基于食材主数据，部分门店未分类项归入 '其他'."
- RLS: same `tenant_isolation`

**`fact_pos_transaction`** (Phase IIa already reads this) — NOT read directly by Phase IIb; see §2.2 `agg_daily` for revenue source.

### 2.2 Gold Layer (read from when available)

Source: `backend/python/smartbi/database/migrations/2026_04_24_gold_restaurant_ops.sql`.

**`agg_restaurant_daily_totals`** — pre-aggregated daily scalars (PRIMARY read path for IIb trends)
- Columns: `factory_id`, `date`, `requisition_count`, `requisition_qty_total`, `requisition_cost_total`, `wastage_count`, `wastage_qty_total`, `wastage_cost_total`, `stocktaking_count`, `stocktaking_shortage_total`, `stocktaking_surplus_total`
- PK: `(factory_id, date)`
- **Phase IIb uses this for daily trend charts** — much faster than scanning Silver

**`agg_restaurant_daily_ops`** — EAV-style per-ingredient/category breakdowns
- Columns: `factory_id`, `date`, `kpi_kind`, `dim_value_id` (BIGINT, ingredient_id or 0), `dim_value_str` (VARCHAR, category or ''), `value_num`
- PK: `(factory_id, date, kpi_kind, dim_value_id, dim_value_str)`
- Used for Top-N rankings and category breakdowns where pre-aggregated
- **`kpi_kind` codes — migration declared vs prod actual (DRIFT)**:
  - Migration `2026_04_24_gold_restaurant_ops.sql:9-16` declares 7 codes: `requisition_qty`, `requisition_cost`, `wastage_qty`, `wastage_cost`, `stocktaking_diff_qty`, `stocktaking_diff_cost`, `recipe_line_count`
  - Pre-IIb prod audit (2026-05-15) shows materializer actually emits **5 codes**: `requisition_cost`, `requisition_qty`, `stocktaking_shortage_qty`, `wastage_cost_by_type`, `wastage_qty`
  - **Migration comment ↔ materializer emit are out of sync** (`wastage_cost` vs `wastage_cost_by_type`; `stocktaking_diff_qty` vs `stocktaking_shortage_qty`). Follow-up tracking issue recommended (organizer to file).
  - **Spec locks IIb on prod actual 5 codes** (data is the truth, not the comment). IIb consumes 4 of them: `requisition_cost` (Section C category trend), `wastage_cost_by_type` (Section B byType pie), `wastage_qty` (Section B top-waste qty), `stocktaking_shortage_qty` (Section D variance summary).

**`agg_daily`** (Phase IIa Gold revenue rollup) — **PRIMARY revenue source for `foodCostRatio` denominator**
- Columns used: `factory_id`, `date`, `actual_receive`, `gross_amount` (fallback)
- **Phase IIb queries `agg_daily` not `fact_pos_transaction` directly** — mirrors IIa shipped pattern (`_get_restaurant_finance_kpi` in `analysis_finance.py:3312-3328` uses `COALESCE(SUM(actual_receive), SUM(gross_amount), 0)`). Mixing Silver POS + Gold ops breaks parity and breaks IIa's COALESCE fallback discipline.

**`agg_restaurant_product_cost`** — food cost per dish (snapshot)
- Columns: `factory_id`, `product_id`, `food_cost`, `has_price_data`
- **Phase IIb does NOT use this** — Phase IIc territory (margin per dish). Listed for completeness only.

### 2.3 Materializer State (read-write boundary clarification)

Per IIa spec §0.5 finding: `GoldMaterializer` (gated by `SMARTBI_ENABLE_SILVER_DUAL_WRITE=1` env flag) writes Gold tables incrementally on each Bronze upload. Restaurant ops Silver tables (`fact_restaurant_wastage` etc.) are written **directly by the ERP UI** when kitchen staff log events — not through Bronze upload.

**Restaurant ops Gold ETL — actual prod impl (verified 2026-05-15)**:
- Code path: **module function** `run_full_etl(...)` in `backend/python/smartbi/gold/restaurant_ops_etl.py:746` (NOT a class — the cycle-0 draft incorrectly named it `RestaurantOpsMaterializer`).
- Orchestration: hourly leader-only task `_run_restaurant_ops_etl_forever()` in `backend/python/main.py:464`, spawned via `asyncio.create_task(...)` at line 567.
- Env flag: `RESTAURANT_OPS_ETL_ENABLED` (default `"true"` per `main.py:456`). Disabled = no Gold materialization; Phase IIb falls to Silver.
- Retry wrapper: `run_full_etl_with_retry` at line 817 — 3 retries + failure persistence to `restaurant_etl_failures` table.

**Phase IIb read strategy**:
- **Main path**: Gold-first query (`agg_restaurant_daily_totals` for daily totals trend; `agg_restaurant_daily_ops` for EAV breakdowns by category / wastage_type / shortage).
- **Silver fallback**: **only** when the hourly leader task has crashed mid-cycle or is disabled (non-routine condition). At 0-50 events/day per chain, indexed scans on Silver are <100ms — acceptable temporary fallback.
- **Fallback trigger**: if `agg_restaurant_daily_totals` returns 0 rows for the date range AND `fact_restaurant_wastage` has rows in that range, log WARN `restaurant_ops_etl_drift_detected` and fall through to Silver scan.

### 2.4 What Is Missing for Each Sub-Report

| Sub-report | Data available | Risk |
|---|---|---|
| 食材损耗分析 | `fact_restaurant_wastage` rows + `agg_restaurant_daily_totals.wastage_cost_total` | Most chains zero rows; empty-state UX critical |
| 领料成本趋势 | `fact_restaurant_requisition` rows | Same risk as wastage |
| 盘点差异报告 | `fact_restaurant_stocktaking` rows | Same risk; stocktakings are episodic (monthly?), not daily |
| 食材成本占比 | needs BOTH `fact_restaurant_requisition.est_cost` AND `agg_daily.actual_receive` (Gold with `gross_amount` COALESCE fallback per IIa) | If requisition data missing, denominator broken |

---

## 3. Phasing — Shippable Chunks

### Phase IIb — Kitchen Cost & Ops Analytics (this spec)

**Customer value**: Restaurant tenants see a new "成本运营" tab on `/smart-bi/finance` with food cost insights backed by data Cretas already collects. Even chains with zero ops data see an educational empty-state with CTA to start logging via the materials/kitchen module.

**Reports in scope** (all 4 in a single composite endpoint response):
1. **食材损耗分析** (`wastageAnalytics`)
2. **领料成本趋势** (`requisitionTrend`)
3. **盘点差异报告** (`stocktakingVariance`)
4. **食材成本占比** (`foodCostRatio`) with benchmark alert level

**Data sources**: existing Silver + Gold restaurant ops tables (no migrations). Joins `dim_ingredient` for names/categories. Reads **`agg_daily`** (not `fact_pos_transaction`) for the ratio denominator — mirrors IIa shipped pattern (`analysis_finance.py:3312-3328`).

**Effort**: 6-9 days = 1 backend Python PR (3 days) + 1 frontend Vue PR (2-3 days incl. **+1 day for §5.2 tab restructure** since IIa hides tab switcher + force-redirects restaurant tenants to 'profit') + 1 nginx ops PR (0.5 day, single shared-snippet edit) + Pre-IIb data audit ✅ done (0.5 day) + active E2E + cycle-1/cycle-2/cycle-3 audit buffers (1-2 days).

**Gating to start Phase IIc**: IIb deployed + Steve OQ-3 sign-off on cost-data ingestion strategy + `fact_cost_line` has rows for ≥1 chain.

### Phase IIc — Full P&L (out of scope for this spec)

Unchanged from IIa spec §3 Phase IIc. Listed here for boundary clarity only. Hard prerequisite remains accounting-system cost data ingestion (OQ-3).

---

## 4. API Contracts

### 4.1 Dispatch Pattern

Mirrors Phase IIa polymorphic dispatch pattern from `backend/python/smartbi_compat/api/analysis_production.py:446-506`. Single URL; tenant type detected via `get_tenant_type()` + `TenantType.is_restaurant_tenant`. Factory tenants get a "not applicable" envelope (kitchen-cost is restaurant-specific).

**Endpoint**: `GET /api/mobile/{factory_id}/smart-bi/analysis/kitchen-cost`

**Query parameters**:
- `startDate: date` (required) — ISO YYYY-MM-DD
- `endDate: date` (required) — ISO YYYY-MM-DD
- `groupBy: str` (optional, default `day`) — one of `day` / `week` / `month`

**Auth**: `require_analytics_read` dependency (same as IIa). `strip_price_for_role()` applies to monetary fields if role doesn't include `canViewPrice`.

### 4.2 Phase IIb — Kitchen Cost Endpoint Response Shape

```jsonc
{
  "success": true,
  "data": {
    "tenantType": "RESTAURANT",
    "factoryId": "RES_3101_009",
    "dateRange": {
      "startDate": "2026-04-15",
      "endDate": "2026-05-15",
      "days": 31,
      "groupBy": "day"
    },
    "wastageAnalytics": {
      "totalWastageCost": 8420.50,
      "totalWastageEvents": 142,
      "wastageRate": 0.034,
      "wastageRatePercent": 3.40,
      "topWasteIngredients": [
        {"ingredientId": 1042, "name": "三文鱼", "category": "肉类",
         "totalCost": 1850.00, "quantity": 4.500, "unit": "kg",
         "eventCount": 18}
      ],
      "wastageByType": [
        {"type": "EXPIRED", "totalCost": 4200.00, "eventCount": 62},
        {"type": "DAMAGED", "totalCost": 1820.50, "eventCount": 38},
        {"type": "SPOILED", "totalCost": 1620.00, "eventCount": 28},
        {"type": "PROCESSING", "totalCost": 580.00, "eventCount": 10},
        {"type": "OTHER", "totalCost": 200.00, "eventCount": 4}
      ],
      "_note": "wastage_type enum (verified prod 2026-05-15): DAMAGED / EXPIRED / OTHER / PROCESSING / SPOILED — 5 values. Old draft listed SPOILAGE/EXPIRY/DAMAGE/OTHER which was wrong.",
      "trend": [
        {"period": "2026-04-15", "totalCost": 280.00, "eventCount": 5}
      ],
      "dataSource": "agg_restaurant_daily_totals+fact_restaurant_wastage"
    },
    "requisitionTrend": {
      "totalCost": 247500.00,
      "totalEvents": 894,
      "byCategory": [
        {"category": "肉类", "totalCost": 124000.00, "eventCount": 280, "share": 0.501},
        {"category": "蔬菜", "totalCost": 62500.00, "eventCount": 320, "share": 0.253},
        {"category": "主食", "totalCost": 31200.00, "eventCount": 154, "share": 0.126},
        {"category": "汤料", "totalCost": 18800.00, "eventCount": 84, "share": 0.076},
        {"category": "调料", "totalCost": 11000.00, "eventCount": 56, "share": 0.044}
      ],
      "trend": [
        {"period": "2026-04-15", "totalCost": 7820.00, "eventCount": 28}
      ],
      "dataSource": "agg_restaurant_daily_totals+fact_restaurant_requisition"
    },
    "stocktakingVariance": {
      "totalShortageQty": -42.500,
      "totalShortageCost": 3850.00,
      "totalSurplusQty": 18.250,
      "totalSurplusCost": 1240.50,
      "netVarianceCost": 2609.50,
      "byIngredient": [
        {"ingredientId": 1042, "name": "三文鱼", "category": "肉类",
         "diffQty": -8.250, "diffCost": 1650.00}
      ],
      "lastStocktakingDate": "2026-05-10",
      "stocktakingCount": 4,
      "dataSource": "fact_restaurant_stocktaking"
    },
    "foodCostRatio": {
      "totalRequisitionCost": 247500.00,
      "totalRevenue": 720000.00,
      "ratio": 0.344,
      "ratioPercent": 34.4,
      "benchmark": {
        "healthy": 0.30,
        "warning": 0.35,
        "critical": 0.40
      },
      "alertLevel": "YELLOW",
      "alertMessage": "食材成本占比偏高（34.4%），建议优化领料计划",
      "dataCaveats": ["使用领料估算成本（est_cost），非会计实际成本"],
      "dataSource": "agg_daily+fact_restaurant_requisition"
    },
    "generatedAt": "2026-05-15T10:30:00"
  },
  "message": "ok"
}
```

**Key contract decisions**:

- `tenantType: "RESTAURANT"` discriminator (mirror IIa convention)
- All monetary values are plain numbers via `_decimal_to_number()` (Rule 4)
- All percentages provided in BOTH ratio form (0-1 decimal) AND percent form (0-100) — frontend chooses
- `generatedAt` uses `_java_isoformat()` (Rule 11)
- `dataSource` field per sub-section transparently shows which table powered the numbers (helps debugging + customer trust). **`foodCostRatio.dataSource` MUST be `"agg_daily+fact_restaurant_requisition"`** — mirror IIa shipped pattern (`analysis_finance.py:3312-3328`) which uses `agg_daily` (Gold) with `COALESCE(SUM(actual_receive), SUM(gross_amount), 0)` fallback. **Do NOT mix `fact_pos_transaction` (Silver) with Gold ops tables** — that breaks parity with IIa and breaks the COALESCE fallback discipline confirmed in PR #647.
- `groupBy` parameter shapes the `trend.period` granularity: `day` → `YYYY-MM-DD`, `week` → `YYYY-Www` (Rule 2 calendar-year + ISO-week), `month` → `YYYY-MM`
- **Key order policy**: Response envelope is built from a Python literal dict in `_restaurant_kitchen_cost_dispatch()`. Python dict insertion order = JSON serialization order. **Frontend MUST NOT depend on key order** — `RestaurantKitchenCostContent.vue` should only read named fields. No Java Map.of analog (Phase IIb is Python-native; Rule 8 N/A).
- **Alert level computation** (mirror Rule 7 for non-integer thresholds — use Decimal comparison, NOT `float()`):
  - `ratio < 0.30` → `GREEN`
  - `0.30 ≤ ratio < 0.35` → `GREEN` with neutral message
  - `0.35 ≤ ratio < 0.40` → `YELLOW` with warning message
  - `ratio ≥ 0.40` → `RED` with critical message

### 4.3 Factory Tenant Branch (not-applicable envelope)

When `tenant_type != RESTAURANT`, return:

```jsonc
{
  "success": true,
  "data": {
    "tenantType": "FACTORY",
    "factoryId": "F001",
    "notApplicable": true,
    "code": "FACTORY_BRANCH_NOT_APPLICABLE",
    "message": "厨房成本运营分析仅适用于餐饮租户。工厂租户请使用利润/成本/应收/应付分析。"
  }
}
```

This is intentionally different from raising 404 — it lets the frontend show a friendly "wrong tenant type" notice without an error toast. Mirrors `analysis_production.py` factory-branch handling.

### 4.4 Auth / Permissions

Same as Phase IIa: `require_analytics_read` dependency. Restaurant analytics access role required. `strip_price_for_role` applies to all monetary fields when role lacks `canViewPrice` — strips `totalWastageCost`, `totalCost` per ingredient, `est_cost` etc., leaving qty + counts visible.

### 4.5 Edge Cases

| Condition | Response | Why |
|---|---|---|
| Restaurant chain has no wastage rows in date range | `wastageAnalytics.totalWastageCost: 0.0`, `totalWastageEvents: 0`, empty arrays for `topWasteIngredients` / `wastageByType` / `trend`, `wastageRate: null` (denominator may exist but ratio meaningless). Frontend renders empty-state per §5.6. | Honest "no data" without breaking v-for |
| Requisition data exists but POS revenue is 0 (closed period) | `foodCostRatio.totalRequisitionCost: <sum est_cost>` (preserved, NOT zeroed), `totalRevenue: 0.0`, `ratio: null`, `ratioPercent: null`, `alertLevel: null`, `alertMessage: "暂无营收数据，无法计算占比"`. Frontend renders requisition cost number + ratio-area shows §5.6 empty-state-3 ("营收数据缺失"). | Div-by-zero hazard; null is honest signal (Rule 1). Requisition sum is still meaningful even without revenue denominator (drives §5.6 empty-state-3 partial render). |
| POS revenue exists but no requisition rows | `foodCostRatio.totalRequisitionCost: 0.0`, `totalRevenue: <sum>`, `ratio: 0.0`, `ratioPercent: 0.0`, `alertLevel: "GREEN"`, `alertMessage: "暂无领料数据"`. NOT null (0% is meaningful "no waste"). | Ratio of 0 is the honest answer when no cost was incurred; differs from null which means "denominator missing". |
| `startDate > endDate` (caller bug) | HTTP 400, `code: "INVALID_DATE_RANGE"`, message `"开始日期不能晚于结束日期"` | Mirror IIa edge-case §4.5 + Rule 6 |
| Date range > 1 year | Allow, but warn `dateRange.warning: "日期范围超过 1 年，加载可能较慢"`. No hard cap. | Customer use case (annual review); cap would block legitimate analyses |
| Deleted ingredient (ingredient_id not in `dim_ingredient`) | JOIN with `COALESCE(dim_ingredient.name, '(已删除食材 #' \|\| ingredient_id \|\| ')')`. Costs preserved. | Mirror IIa edge-case §4.5 for `dim_product` |
| Stocktaking event with `difference_cost = NULL` (data quality issue) | Exclude from totals (treat as 0 contribution); include in `stocktakingCount` for audit transparency | NULL ≠ 0 (Rule 1) — but excluding from totals avoids polluting the variance number |
| Same `factory_id` + `date` has both Silver rows AND Gold row (consistency check) | Prefer Gold (faster); WARN log if Silver SUM ≠ Gold value within ±1% tolerance | Detects materializer drift without breaking the response |

Subagent impl must add unit tests covering each of these 8 conditions before merge.

**API contract numeric caps** (lock to avoid frontend silently slicing):
- `wastageAnalytics.topWasteIngredients`: API returns up to **`topN: 10`** ingredients (configurable via query param `topN`, default 10, max 50). Frontend renders all returned rows.
- `stocktakingVariance.byIngredient`: same `topN: 10` rule, sorted by `abs(diff_cost) DESC`.
- `requisitionTrend.byCategory`: normalized to **5 buckets max + "其他"** per §2.1 CATEGORY_NORMALIZE dict (no `topN` slicing — bucketing already caps).

**`wastageAnalytics.wastageRate` formula** (restated for impl clarity): `wastageRate = totalWastageCost / totalRequisitionCost`. Returns `null` if `totalRequisitionCost == 0`. Returns float in [0, 1] range (NOT percent — frontend multiplies by 100 for display). Mirror Rule 10 `divide.quantize().multiply` semantic if intermediate-step rounding needed.

### 4.6 Divergences from Factory Contract Justified

| Factory contract | Restaurant divergence | Justification |
|---|---|---|
| `/analysis/finance` has `cost` tab with `materialCost / laborCost / overheadCost` from `smart_bi_finance_data` | `/analysis/kitchen-cost` separate endpoint with operational-only cost view | Factory cost data comes from accounting Excel; restaurants don't have that — Phase IIc territory |
| Factory `cost` tab includes budget variance | No budget concept for restaurants in current data model | Phase IIc territory if Steve adopts restaurant budgets |

---

## 5. UI / Frontend Changes

### 5.1 Strategy: New Sub-Component, New Tab

Phase IIa added restaurant blocks inline to `FinanceAnalysis.vue` + `SalesAnalysis.vue`. Per IIa §5.8 LOC concern, both files are now approaching 3000 LOC (2984 lines). **Phase IIb extracts a sub-component** rather than further bloating the parent file:

**Decision**: Create new `web-admin/src/components/smartbi/RestaurantKitchenCostContent.vue`. Add a new "成本运营" tab to `FinanceAnalysis.vue` (restaurant view only) that mounts this sub-component when active. Keeps `FinanceAnalysis.vue` parent small — only an `<el-tab-pane>` import addition + the existing `v-if="isRestaurantTenant"` block adjustment.

### 5.2 FinanceAnalysis.vue Changes

⚠️ **Structural UX change required**. Phase IIa intentionally **hides the tab switcher for restaurant tenants** and force-redirects `analysisType` to `'profit'` in 3 places. Phase IIb must reverse this for restaurant tenants:

**Required edits to `web-admin/src/views/smart-bi/FinanceAnalysis.vue`**:

1. **Extend `AnalysisType` enum** (line 78-79): add `'kitchen-cost'`:
   ```ts
   type AnalysisType = 'profit' | 'cost' | 'receivable' | 'payable' | 'budget' | 'kitchen-cost';
   const validTabs: AnalysisType[] = ['profit', 'cost', 'receivable', 'payable', 'budget', 'kitchen-cost'];
   ```

2. **Remove / whitelist the 3 force-redirect-to-profit guards** (current lines 85-87, 88-92, 95-99):
   - Line 85-87 (initial mount): change to allow `'profit'` OR `'kitchen-cost'` for restaurant tenants
   - Lines 88-92 (`watch route.query.tab`): same whitelist
   - Lines 95-99 (`watch analysisType`): same whitelist
   - Pattern: replace `if (isRestaurantTenant.value && analysisType.value !== 'profit')` with `if (isRestaurantTenant.value && !['profit', 'kitchen-cost'].includes(analysisType.value))`

3. **Restore tab switcher visibility for restaurant tenants** (verify ~line 581 `allAnalysisTypes` + the v-if guarding tab switcher template). Restaurant tenants must see **TWO** tab choices: 营收概览 (profit) + 成本运营 (kitchen-cost). They must NOT see cost/receivable/payable/budget.

4. **Add `'kitchen-cost'` entry to `allAnalysisTypes`** (~line 581):
   ```ts
   { type: 'kitchen-cost' as AnalysisType, label: '成本运营', icon: <suitable icon>, restaurantOnly: true },
   ```
   Then filter to only show `restaurantOnly` tabs for restaurant tenants and `!restaurantOnly` tabs for factory tenants.

5. **Mount `RestaurantKitchenCostContent` under `v-else-if="isRestaurantTenant && phaseIIbEnabled && analysisType === 'kitchen-cost'"`** — sibling to the existing `<RestaurantFinanceContent v-else-if="isRestaurantTenant && phaseIIaEnabled" />` block. Phase IIa block becomes effectively gated by `analysisType === 'profit'` (the 营收概览 tab).

6. **Add import**: `import RestaurantKitchenCostContent from '@/components/smartbi/RestaurantKitchenCostContent.vue'`

7. **Cross-link** from the Phase IIa `phaseIIbPreview` block (in 营收概览 tab) → switch `analysisType.value = 'kitchen-cost'` button "查看 成本运营详情 →"

**Effort impact**: +1 day frontend (tab restructure + 3 guard rewrites + Phase IIa block re-gating). Reflected in §0 TL;DR effort 6-9 days.

### 5.3 New Component: RestaurantKitchenCostContent.vue

**Props**:
- `factoryId: string` (required)
- `dateRange: { startDate: string, endDate: string }` (required)
- `groupBy?: 'day' | 'week' | 'month'` (optional, default `'day'`)

**Layout (top to bottom)**:

1. **KPI strip** (4 cards, full-width row):
   - 食材成本占比 (with benchmark alert badge GREEN/YELLOW/RED)
   - 总损耗成本
   - 总领料成本
   - 净盘点差异

2. **Section A: 食材成本占比** (with benchmark band visualization):
   - Number prominently displayed
   - Horizontal band chart showing 30% / 35% / 40% thresholds with current ratio as marker
   - Alert message text below

3. **Section B: 食材损耗分析**:
   - Trend chart (`DynamicChartRenderer` line/bar): daily/weekly/monthly wastage cost
   - Top 10 ingredients table (`el-table`): ingredient × cost × qty × event count
   - Pie chart: wastage by type (DAMAGED / EXPIRED / OTHER / PROCESSING / SPOILED — verified prod 2026-05-15)

4. **Section C: 领料成本趋势**:
   - Trend chart: daily/weekly/monthly requisition cost
   - Stacked bar or pie: by normalized category (synonyms merged via Python-side `CATEGORY_NORMALIZE` per §2.1; Top-5 + "其他" bucket; NULL rows folded into "其他")

5. **Section D: 盘点差异报告**:
   - Summary KPIs: 总短缺金额 / 总盈余金额 / 净差异
   - Table: top 10 ingredients by variance cost
   - Last stocktaking date display

6. **Section E: groupBy switcher** — top-right toggle pill `日/周/月` triggering re-fetch with different `groupBy` param

**Reusable components**:
- `DynamicChartRenderer` — all trend/pie charts
- `SmartBIEmptyState` — when any section returns zero rows (see §5.6)
- `CapabilityGate` — gates monetary values behind `canViewPrice`

### 5.4 Tab Structure (final)

**FinanceAnalysis.vue** restaurant view (post Phase IIb):
- Restaurant tenants now see a tab switcher with **TWO** options (reversing the IIa "hide tab switcher + force profit" pattern):
  - Tab: **营收概览** (`analysisType === 'profit'`, Phase IIa) — renders `RestaurantFinanceContent.vue` block via `v-else-if="isRestaurantTenant && phaseIIaEnabled && analysisType === 'profit'"`
  - Tab: **成本运营** (`analysisType === 'kitchen-cost'`, Phase IIb, NEW) — mounts `RestaurantKitchenCostContent.vue` via `v-else-if="isRestaurantTenant && phaseIIbEnabled && analysisType === 'kitchen-cost'"`
- ~~利润/成本/应收/应付/预算~~ — still hidden for restaurant tenants (factory-only). Tab switcher entries filtered via `restaurantOnly` flag per §5.2.

**SalesAnalysis.vue** restaurant view: unchanged from IIa (no Phase IIb additions to sales surface).

### 5.5 Reusable Components

| Component | File | Usage |
|---|---|---|
| `DynamicChartRenderer` | `web-admin/src/components/smartbi/DynamicChartRenderer.vue` | Trend / pie / bar charts in §5.3 sections B/C |
| `SmartBIEmptyState` | `web-admin/src/components/smartbi/SmartBIEmptyState.vue` | Empty-state for chains with no ops data |
| `CapabilityGate` | `web-admin/src/components/CapabilityGate.vue` | Gates monetary values |
| `ChartTypeSelector` | `web-admin/src/components/smartbi/ChartTypeSelector.vue` | Optional per-chart bar/line switch |

### 5.6 Empty-State UX (CRITICAL SECTION)

**Why this section gets its own heading**: Per `docs/qa-audits/2026-05-11-restaurant-data-readiness-audit.md §1.4`, 14 R_*_REAL chains expected to return `WASTAGE_NOT_TRACKED`. Phase IIb must render gracefully or it ships visibly broken UI to most customers.

**Empty-state hierarchy** (most specific → most generic):

1. **Whole tab empty** (all 4 reports have zero rows): Render `SmartBIEmptyState` covering the entire tab with **single** primary CTA:
   ```
   暂无厨房运营数据

   在领料管理 / 损耗记录 / 盘点管理模块录入业务数据后，此处将自动分析。

   [前往运营管理]
   ```
   - **Single CTA only**. The shared `SmartBIEmptyState` component (`web-admin/src/components/smartbi/SmartBIEmptyState.vue:163-178`) Props expose `actionText?: string` (singular) and emit `action: []` (singular). It does NOT support dual buttons. Saves ~30 LOC vs. inventing dual-button variant.
   - Button click → `router.push('/restaurant/requisitions')` (the 领料管理 list view, verified path in `web-admin/src/router/index.ts:828`). This is the most likely first action a restaurant operator will take.
   - Companion module routes for in-text deeplinks (used in Section-level empty states if needed): `/restaurant/wastage` (损耗管理, router line 834), `/restaurant/stocktaking` (盘点管理, router line 846).
   - Don't use external links.

2. **Single section empty** (e.g. wastage has data but stocktaking doesn't): Section renders its title + a small inline empty state:
   ```
   暂无盘点数据
   建议每月至少进行一次盘点，以掌握真实库存
   ```

3. **Food cost ratio edge case** — denominator missing (no POS revenue in period): Section renders the requisition-cost number but ratio area shows:
   ```
   暂无营收数据，无法计算占比
   ```

4. **Stocktaking sparse but recent** (only 1-2 events in period): Render normally. Add tooltip on `lastStocktakingDate`: "上次盘点于 N 天前，建议定期盘点保持准确"

### 5.7 Rollback strategy

If Phase IIb ships and customers report wrong numbers / broken UX:

1. **Backend rollback**: revert nginx allowlist change for `kitchen-cost` — restaurants get 404 on that path. Phase IIa surfaces (`/sales`, `/finance?analysisType=overview`) remain intact.
2. **Frontend rollback**: feature-flag the 成本运营 tab via `phaseIIbEnabled` computed (analogous to IIa §5.7 `phaseIIaEnabled`). Source from env (`VITE_PHASE_IIB_ENABLED`), default `true`. Flip to `false` to hide the tab without code revert. Tab gone = users back to IIa-only finance experience.
3. **Code revert**: `git revert <phase-iib-merge-commits>` is safe — Phase IIa code is untouched (new endpoint, new component file, new tab pane).

### 5.8 File LOC impact

- `FinanceAnalysis.vue`: currently approaching 3000 LOC (2984 lines). +60-80 LOC (tab pane + import + AnalysisType enum + 3 guard rewrites + Phase IIa block re-gating per §5.2). Stays under 3500 LOC ceiling.
- `RestaurantKitchenCostContent.vue` (new file): estimated 600-800 LOC.

No risk to compile/HMR thresholds.

---

## 6. Migration Plan

### 6.1 Nginx Routing Required for Phase IIb

Phase IIa added the `(finance|sales)` allowlist to a **shared snippet** that all 3 vhosts include. Phase IIb edits **ONE file** and all 3 vhosts pick up the change automatically.

**Phase IIb nginx change** — edit **one** file:

- Repo path: `ops/nginx-vhosts-139/smart-bi-routing.conf`
- Server path: `/www/server/nginx/conf/snippets/smart-bi-routing.conf`
- Block 5 (line ~89-101): current regex is `(finance|sales)`; change to `(finance|sales|kitchen-cost)`.

```nginx
# 5. Phase IIa restaurant finance/sales (2026-05-14) → IIb adds kitchen-cost (2026-05-15+)
location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales|kitchen-cost)(/.*)?$ {
    proxy_pass http://cretas_python;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 900s;
    client_max_body_size 500m;
}
```

**Why only one edit** (vs. IIa's 3-vhost separate edits): the 2026-05-15 May 15 nginx incident fix (`feedback_nginx_3_vhost_sync.md` HARD rule) refactored to a shared snippet included from all 3 vhosts (`web-admin.conf` + `api.cretaceousfuture.com.conf` + `admin.cretaceousfuture.com.conf`). Edit the snippet once → all 3 vhosts pick up the change on `nginx -s reload`.

**Backward compatibility note**: The HARD rule `feedback_nginx_3_vhost_sync.md` is still in force for anyone who bypasses the snippet and inlines location blocks directly into vhost files. If a vhost has its own inline `/smart-bi/analysis/` block (audit: `grep -rn 'smart-bi/analysis' /www/server/panel/vhost/nginx/ /www/server/nginx/conf/`), that inline block must also be synced. Phase IIb impl should grep first to confirm no inline drift before relying solely on the snippet edit.

**Post-edit verification**:
- `nginx -t` (config syntax check)
- `nginx -s reload` (apply)
- **2 smoke curls** (NOT 3 — `api.cretaceousfuture.com` DNS is NXDOMAIN, vhost dormant): one via IP `http://139.196.165.140:8086/...` (web-admin.conf) + one via DNS `https://admin.cretaceousfuture.com/...` (real customer path) hitting `/api/mobile/RES_3101_009/smart-bi/analysis/kitchen-cost?startDate=2026-04-15&endDate=2026-05-15` and checking the response routes to Python (not the SPA fallback). Both should return identical JSON.

**Deploy order** (mirror IIa §6.1 pattern — avoid race where backend ready but frontend not):

0. Frontend PR stays unmerged until backend + nginx complete.
1. Python deploy to test env (8084) with kitchen-cost endpoint + factory branch both functional.
2. Verify factory tenants still work (regression smoke).
3. Update nginx test config for kitchen-cost (or test by directly hitting Python 8084).
4. Smoke test against `RES_3101_009` (test env Gold data should exist).
5. Python deploy to prod (8083, Blue-Green).
6. Update nginx prod config — edit single shared snippet `ops/nginx-vhosts-139/smart-bi-routing.conf` block 5 to add `kitchen-cost` to allowlist; `scp` to server `/www/server/nginx/conf/snippets/smart-bi-routing.conf`; `nginx -t && nginx -s reload`. All 3 vhosts pick up via `include` automatically (per `feedback_nginx_3_vhost_sync.md` shared-include refactor 2026-05-15).
7. Verify prod backend healthy: curl direct from server bypassing browser.
8. **Final**: merge frontend PR + deploy web-admin. Tab appears for all restaurant tenants simultaneously.

If any step 1-7 fails: backend revert, frontend stays at IIa state (no user-visible regression).

### 6.2 No Schema Migrations Required for Phase IIb

All Silver + Gold restaurant ops tables already exist. No `V2026xxxx` migrations needed.

### 6.3 RLS Pattern Decision

Same decision as IIa §6.3.1: use the WHERE-clause + middleware-GUC belt-and-suspenders pattern. Per `reference_smartbi_rls_via_auth_middleware_guc.md` + HARD rule `feedback_test_rls_with_real_pool_not_psql_reset.md`:

- `smartbi_user` pool role does NOT have `BYPASSRLS`
- `auth_middleware.py:220 (set_factory_id ContextVar)` is the entrypoint. The actual SQL `set_config('app.factory_id', $1, true)` is issued by the asyncpg pool setup-callback in `backend/python/smartbi/tenant_ctx.py` (per connection from JWT).
- Pool default: when ContextVar is unset (bg tasks / system flush paths), the setup-callback writes `INTERNAL_SENTINEL = '__internal__'`. RLS policies branching only on `IS NULL OR = ''` will silently never fire for those paths (see `reference_internal_sentinel_guc.md` — 16-day outage closed by V20260514_01/V20260515_01).
- RLS policies on `fact_restaurant_wastage` / `fact_restaurant_requisition` / `fact_restaurant_stocktaking` / `agg_restaurant_daily_totals` / `agg_restaurant_daily_ops` / `dim_ingredient` all use `factory_id = current_setting('app.factory_id', true)`.

Subagent impl does **NOT** need to add explicit `set_config` calls in restaurant kitchen-cost helpers. Any `/api/mobile/*` request enters via auth middleware → ContextVar set → pool setup-callback issues `set_config` → RLS auto-scopes. WHERE-clause is added for belt-and-suspenders consistency with IIa pattern (analysis_production.py:190).

**Testing RLS**: per HARD rule `feedback_test_rls_with_real_pool_not_psql_reset.md`, **do NOT** verify RLS policies via `psql RESET app.factory_id` — that doesn't exercise the pool setup-callback sentinel branch. Use the real asyncpg pool (or in psql, explicitly `SELECT set_config('app.factory_id', '__internal__', true)` before INSERT verification) to catch the sentinel branch.

### 6.4 Phase IIb Data Backfill

Not required (no backfill — these tables are populated by ERP UI as events occur, not from Bronze parsing). Pre-IIb audit (§0.5) is read-only inventory, not backfill.

### 6.5 Factory Tenant Isolation

Polymorphic dispatch check `tenant.is_restaurant_tenant` short-circuits at the top of `get_kitchen_cost_analysis()`. Factory tenants receive the `FACTORY_BRANCH_NOT_APPLICABLE` envelope (§4.3). They are NEVER allowed to reach restaurant ops query helpers. Defensive: if `get_tenant_type()` fails or returns `FACTORY`, the factory branch fires (which returns the not-applicable envelope — safe).

---

## 7. Risks and Open Questions

### 7.1 Data Availability Risk (HIGH)

Phase IIb risk is HIGH — same scenario as IIb-side of IIa spec §7.1. The Pre-IIb audit (§0.5 Track P) will quantify exactly which chains have data. Mitigation: empty-state UX (§5.6).

`RES_3101_009` (QHJ seed) has 1730 days of POS + likely seeded wastage data — guaranteed verification target. R_*_REAL chains likely return all-empty.

### 7.2 Estimated-Cost Denominator Accuracy

`fact_restaurant_requisition.est_cost` is `requested_qty × ingredient.unit_price` per Silver schema comment. `ingredient.unit_price` is "last-known unit price" (snapshot from moving avg). This is **not** true accounting cost — it's an estimate. Implications for the food cost ratio:

- If unit prices drift between requisition and actual purchase, ratio is biased
- If some ingredients don't have `unit_price` populated, their requisition cost is NULL → excluded from SUM (Rule 1) → biases down

**Subagent impl must**:
- Apply Rule 1: `WHERE est_cost IS NOT NULL` when summing requisitions
- Surface this caveat in API response: add `foodCostRatio.dataCaveats: ["使用领料估算成本，非会计实际成本"]` (array, frontend renders as tooltip)
- Discuss with Steve via OQ-IIB-NEW (§7.5) whether estimated cost is acceptable for Phase IIb

### 7.3 Performance — Silver Scan Fallback

Phase IIb reads Gold (`agg_restaurant_daily_totals`) as primary path; falls back to Silver scans (`fact_restaurant_wastage` / `fact_restaurant_requisition` / `fact_restaurant_stocktaking`) if Gold rows are missing (materializer drift, see §2.3).

For a single chain with 365 days × 50 events/day = ~18,000 rows per table, indexed scans on `(factory_id, date)` are <100ms. Top-N rankings with JOIN to `dim_ingredient` add ~50ms. No materialized-view need.

For a chain with 5+ years of data (~90K rows), scans approach 500ms — still acceptable. If a chain exceeds 100K events, revisit with caching layer.

### 7.4 Stocktaking Sparsity

Stocktakings are episodic — typically weekly or monthly, not daily. A query against `fact_restaurant_stocktaking` for a 1-month period might return 1-4 events. Phase IIb response handles this with the `lastStocktakingDate` field and CTA "建议定期盘点".

### 7.5 Rule 1-12 Compliance for New Python Code

All new Python code must follow `.claude/rules/python-java-port.md`. Phase IIb has no Java equivalent to mirror (the analysis endpoints are Python-native per Phase 2A architecture), so Rules 8 and 9 (Map.of key order / Lombok serialization) do not apply. But these Rules DO apply:

- **Rule 1**: Use `is not None` for null checks on `wastage_cost_total`, `requisition_cost_total`, `est_cost`, `difference_cost`, `actual_receive`. **CRITICAL** — `Decimal("0")` is falsy in Python but means "zero cost" not "no data". Examples in §7.2.
- **Rule 4**: All monetary values returned to JSON go through `_decimal_to_number()`. This includes `totalWastageCost`, `totalCost`, `est_cost`, `actual_receive`, etc.
- **Rule 6**: Raise `ValueError` if `start_date` or `end_date` is None in any new query helper.
- **Rule 8**: N/A (Python-native, no Java Map.of to mirror). But: be aware Python dict insertion order is the serialization order; spec the API response shape in §4.2 explicitly to lock the order.
- **Rule 10**: Food cost ratio computation MUST use intermediate quantize at scale 4 before final scale 2:
  ```python
  # Correct: mirror Java BigDecimal divide(4, HALF_UP).multiply(100)
  if total_revenue == 0:
      ratio = None
      ratio_percent = None
  else:
      intermediate = (total_requisition / total_revenue).quantize(
          Decimal("0.0001"), ROUND_HALF_UP
      )
      ratio = intermediate
      ratio_percent = (intermediate * Decimal("100")).quantize(
          Decimal("0.01"), ROUND_HALF_UP
      )
  ```
  Same pattern for `wastageRate` and category `share`.
- **Rule 11**: Use `_java_isoformat()` for `generatedAt` and `lastStocktakingDate` timestamps. Not `.isoformat()` directly.
- **Rule 12**: Display formatting in alert messages — use `Decimal.quantize(Decimal("0.1"), ROUND_HALF_UP)` or `_format_decimal_half_up(ratio_percent, 1)` for the "34.4%" rendering, NOT f-string `:.1f`. Python f-string uses banker's rounding; Java `String.format("%.1f", d)` uses HALF_UP. Mismatch at boundaries like 34.55 → "34.5" vs "34.6".

---

## 8. Out of Scope (Explicit List)

The following are explicitly excluded from Phase IIb:

- **Full P&L / 毛利率** — Phase IIc territory; requires `fact_cost_line` with accounting data + OQ-3 decision
- **Labor cost / rent / utilities breakdown** — Phase IIc territory; data gap
- **Recipe-level food cost analysis** — `agg_restaurant_product_cost` exists, but margin-per-dish UX is Phase IIc
- **Real accounting cost ingestion** — same as OQ-3 — Phase IIc spec required
- **Supplier-side AP aging for ingredients** — restaurants don't use Cretas AR/AP modules
- **Cross-tenant comparison** ("集团视角") — same OOS as IIa spec §8
- **Mobile RN SmartBI views** — SmartBI is web-admin only
- **Multi-language i18n** — project has no `vue-i18n` (verified 2026-05-15: `grep -E '"vue-i18n"' web-admin/package.json` returns 0 hits)
- **业务日 vs 自然日 reconciliation for ops events** — wastage/requisition events use `date` field at 00:00 boundary (civil day). Most kitchens log events during business hours, so boundary impact is minimal. Same OOS as IIa
- **预测 / forecast on wastage trend** — Phase IIb shows historical; ARIMA/seasonal forecast deferred
- **告警 / alert push notifications** — Phase IIb computes `alertLevel` GREEN/YELLOW/RED inline; no separate alert subsystem
- **分店 (store-level) breakdown** — `fact_restaurant_wastage` does NOT have `store_id` (verify via Silver schema). Phase IIb aggregates at factory_id level only. Per-store breakdown if/when `store_id` added to Silver tables — separate spec
- **What-if analysis ("如果减少 10% 损耗，节省多少?")** — interactive simulation deferred
- **Audit log of who entered which wastage event** — handled by Cretas ERP module's own audit log, not by SmartBI analytics
- **Industry benchmark beyond food cost ratio** — only the 30/35/40 thresholds are spec'd; wastage rate / requisition share benchmarks not included (no industry consensus to anchor to)

---

## 9. Implementation Map (Build Sequence)

### Phase IIb Build Checklist

**Pre-dispatch (organizer):**
- [x] **Pre-IIb data audit** (§0.5 Track P) — completed 2026-05-15 (subagent). Results in §0.5 "Pre-IIb Data Audit Results" sub-section. Coverage matrix: R_XMX_CHAIN has 3-table data; RES_3101_009 has wastage-only; 13 empty chains.
- [x] Steve sign-off on OQ-2 — ✅ Hybrid (signed 2026-05-15): ship empty-state-graceful + showcase R_XMX_CHAIN + RES_3101_009.
- [x] Steve sign-off on OQ-IIB-NEW — ✅ accept `est_cost` + caveat (signed 2026-05-15).
- [x] **Cycle-1 audit on this spec** — completed 2026-05-15 (subagent). 4 CRITICAL + 7 IMPORTANT + 5 MINOR findings consolidated into this cycle-2 amend.
- [ ] **Cycle-3 reviewer pass** (independent mechanical re-audit, expected light)
- [ ] **Cycle-4 impl-readiness review** (last check before subagent impl dispatch)

**Backend (1 PR):**
- [ ] Create `backend/python/smartbi_compat/api/analysis_restaurant_ops.py`
- [ ] Implement `get_kitchen_cost_analysis()` router with polymorphic dispatch (mirror **router pattern** `analysis_production.py:446-506`)
- [ ] Implement `_restaurant_kitchen_cost_dispatch()` orchestrator (mirror **IIa restaurant dispatcher impl** `analysis_finance.py:3412-3500 (_restaurant_finance_overview)` — including `agg_daily` COALESCE pattern for revenue denominator)
- [ ] Implement `_get_wastage_analytics()` — query Gold `agg_restaurant_daily_totals` first, fall back to Silver `fact_restaurant_wastage` scan if Gold sparse
- [ ] Implement `_get_requisition_trend()` — Gold + Silver fallback, GROUP BY `dim_ingredient.category`
- [ ] Implement `_get_stocktaking_variance()` — Silver scan (no Gold pre-aggregation needed for episodic data)
- [ ] Implement `_get_food_cost_ratio()` — sum `fact_restaurant_requisition.est_cost` + sum `agg_daily.actual_receive` (with `COALESCE(SUM(actual_receive), SUM(gross_amount), 0)` per IIa shipped `_get_restaurant_finance_kpi` `analysis_finance.py:3312-3328`); apply Rule 10 intermediate quantize at scale 4 before final scale 2
- [ ] Implement `_compute_alert_level()` helper — Decimal comparison (Rule 7) for 0.30/0.35/0.40 thresholds
- [ ] Apply Rule 1/4/6/10/11/12 audit checklist per `.claude/rules/python-java-port.md`
- [ ] Register router in `main.py` (mirror existing analysis modules)
- [ ] Unit tests: empty-state branch (zero rows in all 3 fact tables) + partial-data branch (only wastage) + full-data branch (all tables + POS denominator)
- [ ] Edge case tests for each row in §4.5 (7 conditions)

**Nginx (1 ops PR):**
- [ ] Edit ONE file: `ops/nginx-vhosts-139/smart-bi-routing.conf` block 5 — change regex `(finance|sales)` → `(finance|sales|kitchen-cost)`. Shared snippet is `include`d by all 3 vhosts (per `feedback_nginx_3_vhost_sync.md` HARD rule + 2026-05-15 shared-include refactor); single edit propagates to all 3 vhosts on `nginx -s reload`.
- [ ] `scp` updated snippet to server: `/www/server/nginx/conf/snippets/smart-bi-routing.conf`
- [ ] Backup before edit (timestamped `.bak` on server)
- [ ] `nginx -t` + `nginx -s reload`
- [ ] Smoke 2 curls (web-admin.conf IP + admin.cretaceousfuture.com DNS) post-reload — `api.cretaceousfuture.com` DNS is NXDOMAIN, vhost dormant
- [ ] Commit snippet file change in repo (`ops/nginx-vhosts-139/smart-bi-routing.conf`) for drift policy compliance

**Frontend (1 PR):**
- [ ] Create `web-admin/src/components/smartbi/RestaurantKitchenCostContent.vue` (~600-800 LOC)
- [ ] **§5.2 7-step structural change** to `FinanceAnalysis.vue` (NOT a drop-in tab add — IIa hides tab switcher + force-redirects restaurant tenants to 'profit'):
  1. Extend `AnalysisType` enum to include `'kitchen-cost'`
  2. Update / remove the 3 force-redirect-to-'profit' guards (lines 85-99 area) to whitelist `'kitchen-cost'`
  3. Add `allAnalysisTypes` entry for kitchen-cost with `restaurantOnly: true` flag
  4. Restore tab switcher visibility for restaurant tenants (currently hidden via v-if guard)
  5. Re-gate the existing `<RestaurantFinanceContent v-else-if="isRestaurantTenant && phaseIIaEnabled" />` render path to switch on `analysisType.value`
  6. Add component import + render block `<RestaurantKitchenCostContent v-else-if="isRestaurantTenant && phaseIIbEnabled && analysisType === 'kitchen-cost'" />`
  7. Cross-link from 营收概览 `phaseIIbPreview` block → 成本运营 tab (router.push or analysisType switch)
- [ ] Add cross-link from 营收概览 `phaseIIbPreview` block → 成本运营 tab
- [ ] Wire `RestaurantKitchenCostContent` props to the parent `factoryId` + `dateRange`
- [ ] Implement empty-state hierarchy per §5.6 (whole tab / single section / ratio-only-missing)
- [ ] Reuse `DynamicChartRenderer` + `SmartBIEmptyState` + `CapabilityGate`
- [ ] Add `phaseIIbEnabled` feature flag (env-sourced, default `true`) for rollback (§5.7)
- [ ] `vite build` must pass (per HARD rule `feedback_vite_build_only_catches_vue_ts_import_paths.md`)
- [ ] `npx vitest run` must pass (per HARD rule `feedback_vitest_invariant_tests_not_run_by_vite_build.md` — invariant tests aren't run by vite build)

**Pre-deploy checklist:**
- [ ] Confirm `auth_middleware.py:220` ContextVar entrypoint + `smartbi/tenant_ctx.py` pool setup-callback active in prod (per `reference_smartbi_rls_via_auth_middleware_guc.md`)
- [ ] Confirm hourly leader-only `_run_restaurant_ops_etl_forever()` (`main.py:464`, env `RESTAURANT_OPS_ETL_ENABLED`) is running → `agg_restaurant_daily_totals` + `agg_restaurant_daily_ops` populating; if not, Silver fallback path accepted per §2.3
- [ ] EXPLAIN query plans on `RES_3101_009` for each of the 4 sub-queries; confirm indexed scans, no seq scans
- [ ] **F002 dev smoke** (D8 finding): F002 manuf factory has the most complete IIb data shape in prod (13 wastage / 14 requisition / 9 stocktaking rows, range 02-11→05-07). Subagent may use F002 to dev-smoke all query paths (wastage / requisition / stocktaking / ratio). **Prod cutover does NOT include F002** — factory tenant branch will return `FACTORY_BRANCH_NOT_APPLICABLE` envelope per §4.3 (kitchen-cost is restaurant-only).
- [ ] Active E2E 15-30 min per stage (HARD rule `feedback_active_e2e_replaces_passive_soak.md`)

**Post-deploy verification:**
- [ ] Hit prod endpoint for `RES_3101_009` — confirm 4 sub-objects present with non-zero data
- [ ] Hit prod endpoint for one R_*_REAL chain — confirm graceful empty-state response (status 200, all 4 sub-objects with zeros + null ratios)
- [ ] Hit prod endpoint for one factory chain (e.g. `F001`) — confirm `FACTORY_BRANCH_NOT_APPLICABLE` envelope returned (not 404)
- [ ] Open `FinanceAnalysis.vue` 成本运营 tab in browser for QHJ + 1 R_*_REAL — confirm both render correctly (charts for QHJ, empty-state CTA for R_*_REAL)
- [ ] Update Phase IIb close-out acceptance memo (analog to `docs/qa-audits/2026-05-14-phase-iia-shipped-acceptance-memo.md`)

### Phase IIc Prerequisites (Not Yet Dispatchable)

Unchanged from IIa spec §9. Phase IIc requires OQ-3 decision + cost ingestion path.

---

## 10. Cross-References

| Document | Path | Relationship |
|---|---|---|
| Phase IIa spec | `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md` | Parent design — this Phase IIb spec extends it |
| Phase IIa close-out memo | `docs/superpowers/dispatch/2026-05-14-phase-iia-shipped-acceptance-memo.md` | Confirms IIa shipped baseline |
| Phase IIa backend ship PR | (PR #633) | Establishes restaurant branch pattern |
| Phase IIa frontend ship PR | (PR #634) | Establishes `isRestaurantTenant` Vue branching |
| Phase IIa nginx PR | (PR #641) | 3-vhost allowlist pattern |
| Phase IIa close-out PR | (PR #644) | Acceptance memo + spec amendment |
| Phase IIa spec/COALESCE follow-up | (PR #647) | Final COALESCE fix on RES_3101_009 verification |
| QHJ Revenue Report design | `docs/qa-specs/2026-05-12-qhj-revenue-report-design.md` | Phase I spec — predecessor |
| Q4/Q5 restaurant semantics | `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` | Sister spec for production/quality |
| Restaurant data readiness audit | `docs/qa-audits/2026-05-11-restaurant-data-readiness-audit.md` | Per-chain ops data coverage baseline (basis for OQ-2) |
| Silver restaurant ops migration | `backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql` | fact_restaurant_wastage/requisition/recipe/stocktaking + dim_ingredient schema |
| Gold restaurant ops migration | `backend/python/smartbi/database/migrations/2026_04_24_gold_restaurant_ops.sql` | agg_restaurant_daily_totals / agg_restaurant_daily_ops / agg_restaurant_product_cost schema |
| Silver cost migration | `backend/python/smartbi/database/migrations/2026_05_20_silver_cost.sql` | fact_cost_line schema (Phase IIc prerequisite, not used by IIb) |
| Polymorphic dispatch pattern (router) | `backend/python/smartbi_compat/api/analysis_production.py:446-506` | Router pattern this spec mirrors |
| Restaurant dispatcher impl (IIa) | `backend/python/smartbi_compat/api/analysis_finance.py:3412-3500 (_restaurant_finance_overview)` | IIb dispatcher (`_restaurant_kitchen_cost_dispatch`) mirrors this — incl. `agg_daily` COALESCE pattern at lines 3312-3328 |
| Restaurant ops ETL (Gold materializer) | `backend/python/smartbi/gold/restaurant_ops_etl.py:746 (run_full_etl)` + `backend/python/main.py:464 (_run_restaurant_ops_etl_forever)` | Hourly leader-only module function (NOT a class). `RESTAURANT_OPS_ETL_ENABLED` env default true |
| Tenant detection module | `backend/python/smartbi_compat/tenant.py` | `get_tenant_type()` + `TenantType.is_restaurant_tenant` |
| Python port rules | `.claude/rules/python-java-port.md` | Rules 1-12 compliance requirements (esp. 1/4/6/10/11/12 for IIb) |
| Nginx shared snippet | `ops/nginx-vhosts-139/smart-bi-routing.conf` (server: `/www/server/nginx/conf/snippets/smart-bi-routing.conf`) | Single edit → 3 vhosts pick up via include |
| Nginx 3-vhost sync rule | `~/.claude/projects/.../memory/feedback_nginx_3_vhost_sync.md` | HARD rule — applies to anyone bypassing the snippet (inline location blocks in vhost files) |
| Nginx vhost sync checklist | `docs/superpowers/runbooks/nginx-vhost-sync-checklist.md` | Operational runbook |
| RLS via auth_middleware GUC | `~/.claude/projects/.../memory/reference_smartbi_rls_via_auth_middleware_guc.md` | RLS pattern reference |
| RLS test with real pool | `~/.claude/projects/.../memory/feedback_test_rls_with_real_pool_not_psql_reset.md` | HARD rule — psql RESET tests miss sentinel branch |
| INTERNAL_SENTINEL GUC | `~/.claude/projects/.../memory/reference_internal_sentinel_guc.md` | `'__internal__'` pool default; RLS policies branching only on NULL/'' miss bg-task path |
| Vite build CI rule | `~/.claude/projects/.../memory/feedback_vite_build_only_catches_vue_ts_import_paths.md` | HARD rule |
| Vitest CI rule | `~/.claude/projects/.../memory/feedback_vitest_invariant_tests_not_run_by_vite_build.md` | HARD rule |
| Active E2E rule | `~/.claude/projects/.../memory/feedback_active_e2e_replaces_passive_soak.md` | HARD rule — 15-30 min per stage |
| FinanceAnalysis.vue | `web-admin/src/views/smart-bi/FinanceAnalysis.vue` | Parent file getting new tab pane (post Phase IIa) |
| RestaurantPhaseIIPlaceholder.vue | `web-admin/src/components/smartbi/RestaurantPhaseIIPlaceholder.vue` | Phase IIa placeholder (kept per IIa §5.7 rollback) |

---

## 11. Sign-off Required Before Dispatch

### 11.1 Decisions made (closed)

- ✅ Phase IIa shipped 2026-05-14 (PRs #633/#634/#641/#644/#647). RES_3101_009 prod-verified ¥20.6M.
- ✅ Phase IIb scope locked to 4 reports using existing Silver+Gold restaurant ops tables; full P&L stays Phase IIc.

### 11.2 Open questions / pending dispatch

- [x] **Steve OQ-2**: ✅ **Hybrid** (signed off 2026-05-15) — ship empty-state-graceful + showcase R_XMX_CHAIN (3-table real data) + RES_3101_009 (wastage real, others empty-state per-section). 13 empty chains see whole-tab `SmartBIEmptyState`. NOT gated on ETL populating events.
- [x] **Steve OQ-IIB-NEW**: ✅ **Accept est_cost + caveat** (signed off 2026-05-15) — `fact_restaurant_requisition.est_cost` acceptable for IIb food cost ratio. Caveat surfaced in `foodCostRatio.dataCaveats: ["使用领料估算成本（est_cost），非会计实际成本"]`.
- [x] **Steve OQ-1**: ✅ **N/A** (signed off 2026-05-15) — Pre-IIb audit confirmed `fact_cost_line` empty for ALL factories (not restaurant-specific). No fallback path for any tenant. Phase IIc remains gated on cost ingestion implementation, independent of IIb.
- [x] **Engineering — Pre-IIb Data Audit**: ✅ completed 2026-05-15 (subagent). Results in §0.5.
- [x] **Engineering — cycle-1 audit**: ✅ completed 2026-05-15 (subagent). 4 CRITICAL + 7 IMPORTANT + 5 MINOR findings consolidated into this cycle-2 amend.
- [ ] **Engineering — cycle-3 reviewer pass**: independent mechanical re-audit (expected light, 1-2 hours).
- [ ] **Engineering — cycle-4 impl-readiness**: final check before subagent impl dispatch.
- [ ] **Engineering — impl dispatch**: after cycle-3 + cycle-4, Phase IIb ready for subagent impl dispatch (backend PR / frontend PR / nginx PR).

### 11.3 Flagged for cycle-3 / future tracking

- **Migration vs materializer drift** (§2.2 `agg_restaurant_daily_ops`): `kpi_kind` codes declared in migration comment (`wastage_cost`, `stocktaking_diff_qty`, `stocktaking_diff_cost`) do not match prod-emitted codes (`wastage_cost_by_type`, `stocktaking_shortage_qty`). **Organizer recommended to file follow-up tracking issue** to either (a) update migration comment to match materializer, or (b) update materializer to match declared schema. Phase IIb spec locks on prod actual; tracking issue is non-blocking.
- **`dim_ingredient.category` data hygiene**: prod has 20 free-text values + 31 NULL rows. Phase IIb works around with Python-side normalization (§2.1), but a longer-term cleanup migration (free-text → enum or controlled vocab) is product-side work, not engineering.
- **`fact_restaurant_wastage.store_id` absence**: §8 OOS claim verified by subagent (D6). Per-store breakdown deferred to a future spec when/if `store_id` is added.

---

*Spec authored 2026-05-15 as cycle-0 draft by subagent at organizer request. Based on survey of `backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql` + `2026_04_24_gold_restaurant_ops.sql`, `backend/python/smartbi_compat/api/analysis_production.py` (polymorphic dispatch pattern), `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md` (parent design), `docs/qa-audits/2026-05-11-restaurant-data-readiness-audit.md` (data coverage baseline), `.claude/rules/python-java-port.md` Rules 1-12.*

### Audit history

| Cycle | Date | Auditor | Findings | Disposition |
|---|---|---|---|---|
| Cycle-0 | 2026-05-15 | Architecture review (initial draft) | — | 840 lines initial draft |
| Cycle-1 | 2026-05-15 | Subagent spec audit | 4 CRITICAL + 7 IMPORTANT + 5 MINOR | All fixed in cycle-2 amend |
| Pre-IIb data audit | 2026-05-15 | Subagent prod SQL | 8 schema drift + Hybrid OQ-2 verdict | Schema fixes in cycle-2 amend; Steve signed off Hybrid 2026-05-15 |
| Cycle-2 (this) | 2026-05-15 | Organizer + subagent amend | Cycle-1 + data-audit consolidated fix | This commit |
| Cycle-3 | 2026-05-15 | Subagent re-audit | 0 CRITICAL + 2 IMPORTANT + 3 MINOR | All 5 fixed in cycle-3 fixup commit (`2c37f8f6e`) |
| Cycle-4 | 2026-05-15 | Subagent impl-readiness | 0 CRITICAL + 2 IMPORTANT + 4 MINOR | All 6 fixed in cycle-4 fixup commit (this HEAD). **READY for impl dispatch.** |
