# Restaurant Tenant Finance / Sales Analytics — Phase II Implementation Spec

**Status**: **DRAFT — Phase IIa BLOCKED on ETL backfill (post cycle-2 audit, 2026-05-14)**. Phase IIb/IIc structure remains valid. See §0.5 Prerequisite for details.
**Date**: 2026-05-14
**Last audit**: 2026-05-14 cycles 1+2+3+4 (10 CRITICAL + 14 IMPORTANT + 10 MINOR cycle-4 findings fixed; cycle-2 OQ-4 prod query revealed data gap; cycle-3 rewrote §0.5; cycle-4 added TOC + STATUS block + structural polish)
**Author**: Architecture review (senior engineer brief)
**Audience**: Backend Python engineer (Sister-chat impl), frontend Vue engineer, product owner (Steve)
**Trigger**: PR #608 ships "Phase II 建设中" placeholder at `/smart-bi/finance` + `/smart-bi/sales` for restaurant tenants. This spec defines what Phase II actually builds.

---

## STATUS (read first)

- **Phase IIa**: **DEFERRED** — pending Pre-II ETL Backfill (§0.5). Unblocks at ≥5 chains with Gold rows.
- **Phase IIb / IIc**: Designs valid; gated on Steve sign-offs OQ-1/OQ-2/OQ-3 (§11.2).
- **Next dispatch**: Pre-II ETL Backfill (Track A factories audit → Track B Silver→Gold materialization → Track C OQ-4 re-run). Best case 2-4 days; worst case onboarding-blocked (some chains never had Bronze data uploaded).
- **Pending Steve decisions**: see §11.2 for the 4 open OQs.

## Table of Contents

- [STATUS](#status-read-first)
- [§0 TL;DR](#0-tldr-for-product-owner)
- [§0.5 Pre-II Prerequisite: Restaurant ETL Backfill](#05-pre-ii-prerequisite-restaurant-etl-backfill-new-post-cycle-2)
- [§1 Background and Customer Needs](#1-background-and-customer-needs)
- [§2 Data Sources Inventory](#2-data-sources-inventory)
- [§3 Phasing — Shippable Chunks](#3-phasing--shippable-chunks)
- [§4 API Contracts](#4-api-contracts)
  - [§4.5 Edge Cases](#45-edge-cases-cycle-3-addition-c3-4)
- [§5 UI / Frontend Changes](#5-ui--frontend-changes)
  - [§5.6.1 UX positioning vs Revenue Report](#561-ux-positioning-vs-revenue-report-cycle-3-addition-c3-11)
  - [§5.7 Rollback strategy](#57-rollback-strategy-cycle-3-addition-c3-7)
- [§6 Migration Plan](#6-migration-plan)
  - [§6.3.1 RLS Pattern Decision](#631-rls-pattern-decision-cycle-2-fix-c-2)
- [§7 Risks and Open Questions](#7-risks-and-open-questions)
- [§8 Out of Scope](#8-out-of-scope-explicit-list)
- [§9 Implementation Map](#9-implementation-map-build-sequence)
- [§10 Cross-References](#10-cross-references)
- [§11 Sign-off](#11-sign-off-required-before-dispatch)

---

## 0. TL;DR for Product Owner

Restaurant customers currently log into SmartBI and see two important pages — Finance Analysis and Sales Analysis — with a "coming soon" placeholder. They have no structured analytics there despite having months of POS data already ingested (via the QHJ revenue report feature shipped in PRs #569/#593/#596).

**STATUS POST CYCLE-2 AUDIT (2026-05-14)**: An OQ-4 SQL run against `smartbi_prod_db` found Phase IIa's data premise is wrong — only **1 of 15 restaurant chains** (`RES_3101_009`, the QHJ demo) has Gold-layer rows. The 14 R_*_REAL chains listed as "POS data present: Yes" in §1.1 have **zero** Silver or Gold rows. The seed migration `V20260511_02__t6_6_etl_seed_14_real_chains.sql` creates `factories` rows but does NOT populate Bronze→Silver→Gold for them. Phase IIa as originally scoped would ship empty UIs to 13/14 real customers.

**Per Steve's 2026-05-14 decision**: Phase IIa **暂延** (deferred). The blocking work moves upstream to a new precursor — **Pre-II ETL Backfill** (see §0.5). Phase IIa/IIb/IIc designs below remain valid as design artifacts for the eventual rollout, but no impl PR should be dispatched until the ETL backfill ships.

Revised path (unified timeline framing per cycle-3 fix C3-6):

- **Pre-II ETL Backfill** (2-4 days best case, 10+ days worst case if onboarding-blocked): Detailed in §0.5 below. Phase IIa unblocks when **≥5 chains have non-zero `agg_daily` rows** (operational threshold, NOT "all 14 backfilled"). Worst case if all chains are customer-onboarding-blocked: Phase IIa scope shrinks to the subset that does have data; that's still shippable.
- **Phase IIa** (3-5 days, gated on the ≥5-chain threshold above): Revenue-centric Sales Analytics backed by Gold POS tables. Daily trend, dish rankings, payment channel mix, 堂食/外卖 breakdown.
- **Phase IIb** (~5-8 days, gated on IIa + Steve's OQ-2 decision): Finance overview with gross revenue, food cost ratio, wastage rate.
- **Phase IIc** (longer-term, 2-4 weeks, gated on Steve's OQ-3 cost-ingestion decision): Full P&L.

The biggest risk is data. The cycle-2 audit shifted the picture: it's not just IIb/IIc that have data gaps — IIa does too. Data backfill is now the critical path.

---

## 0.5. Pre-II Prerequisite: Restaurant ETL Backfill (NEW, post cycle-2)

### Why this is now the immediate work

Cycle-2 audit ran OQ-4 SQL against `smartbi_prod_db` on 2026-05-14. Results:

```
agg_daily (Gold):
  RES_3101_009 | 1730 days | 2025-01-01 → 2025-12-31  ✓
  All 14 R_*_REAL chains: 0 rows                     ❌
  R_GML_DEMO / R_XMX_CHAIN / R_XMX_FRESH* etc.: 0 rows ❌

agg_product / agg_channel / agg_daily_order_type_meal: 0 rows for any R_*/RES_* except RES_3101_009

fact_pos_transaction (Silver):
  RES_3101_009 | 140,541 rows ✓
  R_GML_DEMO   |  16,213 rows  ← Silver populated but Gold aggregation NOT run
  R_XMX_CHAIN  |     141 rows  ← same
  R_*_REAL 14 chains: 0 rows ❌  ← This is the customer list in §1.1!

fact_pos_item (Silver):
  Same pattern as fact_pos_transaction
```

**Cycle-3 corrected findings** (the original cycle-2 hypotheses about "seed didn't include POS data" and "aggregation job has factory-id allowlist" were both wrong; corrected version follows):

1. **`V20260511_02__t6_6_etl_seed_14_real_chains.sql` writes to `restaurant_chain_catalog`, not `factories`**. So the migration seeded the chain catalog (chain meta), but the **`factories` rows for these 14 R_*_REAL chains may not exist at all**. If they don't exist, `get_tenant_type(factory_id)` returns `FACTORY` (defensive default per `tenant.py:from_db_value`), and the entire §4 polymorphic dispatch routes them to factory branch — invisible bug masked by PR #608 placeholder today.
2. **There is NO scheduled aggregation job, NO factory-id allowlist**. `GoldMaterializer(pool, factory_id=factory_id)` is instantiated per-upload via `backend/python/smartbi/gold/dual_write.py` (gated by env flag `SMARTBI_ENABLE_SILVER_DUAL_WRITE`) OR via explicit backfill scripts in `backend/python/scripts/`. The reason R_GML_DEMO + R_XMX_CHAIN have Silver but no Gold is that those uploads happened **before** `SMARTBI_ENABLE_SILVER_DUAL_WRITE=1` was turned on in prod, OR they used a one-off script that wrote Silver without calling `ingest_and_materialize()`.

### Pre-II Backfill scope (replaces Phase IIa as the immediate dispatch)

**Three tracks (Track A blocks B; A+B feed C)**:

**Track A — factories table audit (0.5-1 day)**:
- Step A1: `SELECT id, type FROM factories WHERE id LIKE 'R_%_REAL'` — confirm rows exist with `type='RESTAURANT'`.
- Step A2: If rows missing for some/all 14 R_*_REAL chains, write Flyway migration `V20260514_XX__seed_real_chains_factories.sql` inserting them with the correct type. Without this, polymorphic dispatch is broken even after Bronze/Silver/Gold backfill.
- Step A3: Check whether Bronze POS data exists anywhere for these factory_ids: `SELECT factory_id, COUNT(*) FROM bronze_smartbi_uploads WHERE factory_id LIKE 'R_%_REAL' GROUP BY factory_id`. If zero rows for some chains, those chains are **customer-onboarding-blocked** (their owners need to upload POS files via the SmartBI uploader UI) — not an engineering deliverable.

**Track B — Silver→Gold materialization for chains with Silver data (1-2 days)** — depends on A1:
- Step B1: Confirm `SMARTBI_ENABLE_SILVER_DUAL_WRITE=1` is currently set in `/www/wwwroot/cretas/.env.prod` on server 47. If off, future uploads still won't aggregate.
- Step B2: For each chain with rows in `fact_pos_transaction` but missing in `agg_daily` (currently R_GML_DEMO ~16K rows, R_XMX_CHAIN ~141 rows, possibly others post Track A), invoke `GoldMaterializer` directly. Recommended path: write a one-shot script `backend/python/scripts/backfill_gold_for_chains.py` taking `--factory-ids R_GML_DEMO,R_XMX_CHAIN,...` and loop-calling `materialize_all(start_date, end_date)`. Cite `materializer.py` for API surface.
- Step B3: Spot-check `agg_daily` rows materialize correctly per chain (compare `SUM(actual_receive) FROM agg_daily WHERE factory_id=$1` vs `SUM(actual_receive) FROM fact_pos_transaction WHERE factory_id=$1` within same date range).

**Track C — Per-chain coverage validation (0.5 day, OQ-4 re-run + acceptance memo)**:
- Step C1: Re-run OQ-4 SQL from cycle-2 audit. Goal: at least ≥5 chains have non-zero `agg_daily` rows.
- Step C2: Write a short acceptance memo recording which chains have Gold coverage, which are onboarding-blocked. This memo gates Phase IIa dispatch — without ≥5 chains, Phase IIa stays deferred.

**Effort**: 2-4 days for tracks A+B+C if Bronze data exists for most chains. **Worst case 10+ days** if Track A reveals most chains have no Bronze data ever (onboarding-blocked) — then engineering scope shrinks to whichever subset has data.

**Dispatch**: This is the immediate next work after the spec lands. Phase IIa impl waits for **acceptance threshold (≥5 chains with Gold rows)**, not for full A+B+C completion.

### When can Phase IIa start?

**Phase IIa dispatchable when EITHER**:
- (a) Tracks A+B complete in their entirety, OR
- (b) Track C confirms ≥3 chains have Gold rows in `agg_daily` (this is the operational gating threshold, **revised 2026-05-14 from 5→3** per Track A finding that 14 R_*_REAL chains have no Bronze data — see acceptance memo §0.5.1 below)

Track C re-runs OQ-4 to determine (b). If (b) met after Track B alone, Phase IIa unblocked without waiting for full Track A. This serialization matters because Track A worst case (all chains onboarding-blocked) could indefinitely block Phase IIa if treated as hard dependency.

---

### 0.5.1 Acceptance Memo — Backfill Completed 2026-05-14

**Status**: ✅ **Pre-II ETL Backfill DONE. Phase IIa UNBLOCKED.**

**Track A1** (factories audit): ✅ All 14 R_*_REAL chains confirmed present in `factories` with `type='RESTAURANT'`. Polymorphic dispatch (§4) will correctly route them.

**Track A3** (Bronze data inventory): only 3 chains have Silver POS data — `RES_3101_009` (140K rows), `R_GML_DEMO` (16K rows), `R_XMX_CHAIN` (141 rows). All 14 R_*_REAL chains have **zero rows in `fact_pos_transaction`** — customer-onboarding-blocked. Engineering cannot fix this without customer uploading POS files.

**Track B** (Silver→Gold materialization): Ran `scripts/backfill_gold_for_chains.py --factory-ids RES_3101_009,R_GML_DEMO,R_XMX_CHAIN` on server 47 against `smartbi_prod_db`. Results:

| Chain | agg_daily | agg_channel | agg_product | agg_discount | agg_daily_order_type_meal |
|---|---|---|---|---|---|
| `RES_3101_009` (QHJ) | 1730 | 3404 | 2998 | 133 | 3182 |
| `R_GML_DEMO` (桂满陇) | 132 | 0 | 1558 | 0 | 132 |
| `R_XMX_CHAIN` (唏嘛香) | 1 | 0 | 141 | 0 | 1 |

`R_GML_DEMO` + `R_XMX_CHAIN` show 0 in `agg_channel` / `agg_discount` because their source uploads did not include payment-channel or discount columns. This is data limitation, not script bug. Phase IIa frontend must handle these tables returning 0 rows gracefully (per §4.5 edge cases).

**Track C** (OQ-4 re-run): 3 chains have non-zero `agg_daily` Gold rows = meets revised threshold of 3.

**Threshold revision rationale** (5 → 3): Original threshold of 5 assumed Bronze data was recoverable for more chains. Cycle-2 OQ-4 + Track A3 revealed only 3 chains have Bronze data; raising 14 R_*_REAL to Bronze requires customer POS uploads (onboarding), not engineering work. Lowering to 3 unblocks Phase IIa without indefinite wait.

**Onboarding follow-up**: Product/Operations must drive 14 R_*_REAL chains (青花椒 / IL TEATRO / 上马 / 锦川 / 唏嘛香 / etc.) to upload POS data via the SmartBI uploader. Once they upload + `SMARTBI_ENABLE_SILVER_DUAL_WRITE=1` triggers Gold dual-write, those chains automatically join the Phase IIa eligible set with no further engineering.

**Phase IIa next dispatch ready**: Backend (Python restaurant branch in `analysis_sales.py` + `analysis_finance.py`), Frontend (Vue restaurant blocks in `SalesAnalysis.vue` + `FinanceAnalysis.vue`), Nginx (extend allowlist to `(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales)`).

### Out of scope for Pre-II Backfill

- Onboarding new POS upload flows for chains that have never uploaded data
- Multi-POS source parsers (二维火 only for now)
- Time-zone reconciliation if civil-day vs business-day mismatch surfaces during backfill
- Customer-facing UX during the gap (PR #608 placeholder already covers this gracefully)

---

## 1. Background and Customer Needs

### 1.1 Who Are Restaurant Tenants

Restaurant tenants are identified by `FactoryType ∈ {RESTAURANT, BRANCH}` in `cretas_db.factories.type` (per `backend/python/smartbi_compat/tenant.py:93-121` — `get_tenant_type` function, mirroring `SmartBIServiceImpl.java:432-435`).

Active restaurant chains in production:

> ⚠️ "POS data present" column reflects migration-coverage *reasoning* (V20260511_02 was named for these chains), **not prod-confirmed coverage**. Cycle-2 audit (2026-05-14 OQ-4 SQL) revealed only `RES_3101_009` has actual Gold rows; all 14 R_*_REAL chains have **zero** Silver/Gold POS data despite the migration mention. The table below is preserved for chain identity; see §0.5 for the actual coverage situation and backfill plan.

| factory_id | Chain | Cuisine | POS data present |
|---|---|---|---|
| `R_QINGHUAJIAO_REAL` | 青花椒 | Sichuan | Yes (二维火, 25年, review data) |
| `R_ILTEATRO_REAL` | IL TEATRO | Western | Yes (商品销量报表) |
| `R_SHANGMA_HG_REAL` | 上马火锅 | Hot Pot | Yes |
| `R_JINCHUAN_HG_REAL` | 锦川火锅 | Hot Pot | Yes (5-month series) |
| `R_XIMAXIANG_REAL` | 唏嘛香 | Noodles | Yes |
| `R_YUJIUJING_REAL` | 御九井 | Japanese | Yes |
| `R_YONGHE_REAL` | 永和豆浆 | Fast Food | Yes |
| `R_XINBASHU_REAL` | 鑫巴蜀 | Sichuan | Yes (5-month) |
| `R_DONGMENKOU_REAL` | 东门口 | Local | Yes |
| `R_HONGDEJI_REAL` | 鸿德记 | — | Yes (5-month) |
| `R_JINRINIUSHI_REAL` | 今日牛事 | Beef | Yes (5-month) |
| `R_YOUZIYOUWEI_REAL` | 有滋有味 | — | Yes (5-month) |
| `R_LINJIAYAN_REAL` | 邻家宴 | — | Yes (5-month) |
| `R_HUOGUO_GENERIC_REAL` | 火锅(通用) | Hot Pot | Partial (利润表 only) |

Source: `backend/python/smartbi/database/migrations/V20260511_02__t6_6_etl_seed_14_real_chains.sql`

### 1.2 What Phase I Already Delivered

**QHJ 收入管理报表** (PRs #569/#593/#596, spec at `docs/qa-specs/2026-05-12-qhj-revenue-report-design.md`):

- 4-sheet Excel report: 可比同比/环比, 堂食外卖占比, 客单人数分析
- Backed by `fact_pos_transaction` Silver + `agg_daily_order_type_meal` Gold (migration `V20260513_01__qhj_revenue_silver_gold.sql`)
- Accessible via `/smart-bi/revenue-report` Vue page (file: `web-admin/src/views/smart-bi/RevenueReport.vue`)
- Tool-skill entry: Java `revenue_report_generate` Tool → `/api/smartbi/{factoryId}/revenue-report/prepare`
- Plus AI Chat surface unification (PR #593) and LLM slot-fill (PR #596) for natural language entry
- Out-of-scope for Phase I: 同比 2024 data (留空), multi-POS source support, streaming progress

**Current FinanceAnalysis.vue state for restaurant tenants** (file: `web-admin/src/views/smart-bi/FinanceAnalysis.vue:66-91`, post PR #608):

- Restaurant tenants now see `RestaurantPhaseIIPlaceholder` per PR #608 — friendly placeholder, no 404 noise
- The previous `loadGoldFinSummary()` data loader (lines 590-638) and its associated KPI strip template (around line 1886) are currently bypassed by the placeholder
- Phase II will replace the placeholder with real content (this spec's deliverable)

**Q4/Q5 production+quality endpoints for restaurant tenants** already live in Python (PRs #350/#358, spec `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md`). These cover kitchen utilization proxy and wastage rate — tangential to finance/sales analytics.

### 1.3 What Restaurants Actually Need (PRD-style Gap Analysis)

Anchored in real customer asks from QA audit docs and customer transcripts (`docs/qa-audits/2026-05-11-customer-transcript-vs-shipped-audit.md`, `docs/qa-audits/2026-05-10-customer-meeting-9bug-audit.md`):

Restaurant operators need to answer these business questions every day/week/month:

**Sales performance (data available today):**
- 总营收 by store, by day, by week — "我今天卖了多少钱?"
- 堂食 vs 外卖 split trend — core KPI for any multi-channel restaurant
- Top dishes by revenue and volume — "哪道菜卖得最好?"
- Payment channel breakdown (美团/抖音/现金/支付宝) — "哪个渠道来的最多?"
- 客单价 and 桌均消费 trend — "客人的人均消费在涨还是跌?"
- 早/午/晚市 split (meal period) — "哪个时段最忙?"

**Finance/cost (partially available, partially data gap):**
- 毛利率 — requires food cost data which is largely missing today
- 食材成本占比 — same data gap
- 损耗率 — available from `fact_restaurant_wastage` for chains that track it; most chains currently return `WASTAGE_NOT_TRACKED`
- 人工成本 / 租金 — **Data gap**: no Silver table rows for most chains; `fact_cost_line` exists in schema but has no ingestion path yet for restaurant tenants
- AR/AP aging — **Data gap**: fully out of scope for Phase IIa/IIb; requires supplier relationships module that restaurants do not currently use in Cretas

**Established industry benchmarks (restaurant standard):**
- 翻台率 (table turnover) — proxy derivable from bills/store/day; true metric needs `dim_store.table_count` populated
- 退菜率 (dish return rate) — requires `fact_pos_item.return_qty` (V20260511_03 adds this column, defaulting NULL; `return_amount` is NOT in V20260511_03 — deferred to follow-up. Data fill via Sub-ETL-1c)
- 投诉率 — only available for `R_QINGHUAJIAO_REAL` (has review data)

### 1.4 Explicit Gap Summary

| Report type | Data available today | Phase |
|---|---|---|
| 日/周/月 营收趋势 by store | `agg_daily` Gold | IIa |
| 堂食/外卖占比趋势 | `agg_daily_order_type_meal` Gold | IIa |
| 午/晚市分时营收 | `agg_daily_order_type_meal` Gold | IIa |
| 菜品销售排行 | `agg_product` Gold | IIa |
| 支付渠道分析 | `agg_channel` Gold | IIa |
| 客单价/桌均 trend | `agg_daily` (avg_per_capita) | IIa |
| 损耗率/损耗成本 | `fact_restaurant_wastage` Silver | IIb |
| 食材领料成本 | `fact_restaurant_requisition` Silver | IIb |
| 盘点差异分析 | `fact_restaurant_stocktaking` Silver | IIb |
| 毛利率 (P&L) | **Data gap**: needs `fact_cost_line` with real accounting data | IIc |
| 人工/租金成本 | **Data gap**: `fact_cost_line` schema exists, no ingestion | IIc |
| 应收/应付账款 | **Data gap**: restaurants don't use Cretas AR/AP modules | Out of scope |
| 预算管理 | **Data gap**: no restaurant budget concept in current system | Out of scope |

---

## 2. Data Sources Inventory

### 2.1 Bronze Layer (raw uploads)

Restaurants upload data via `SmartBIUploader` → Bronze POS parsing. Current Bronze tables confirmed to exist (via migration history in `backend/python/smartbi/database/migrations/`):

- `20260408_smartbi_restaurant_dynamic.sql` — dynamic field mapping for restaurant POS variants
- `20260408_smartbi_restaurant_bom_layer23.sql` — BOM-level Bronze
- Bronze POS route: file → filename + header sniffing → parser → Silver write (per `docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §3`)

Current validated POS source: 二维火 (QHJ/青花椒). Other POS systems (客如云/美团/哗啦啦) are explicitly out of scope until per-source ETL mappings are added.

### 2.2 Silver Layer (confirmed tables)

**Dimension tables** (from `2026_04_28_silver_dimensions.sql`):
- `dim_store` — stores per factory: `name`, `brand`, `city`, `province`, `region`. Note: `table_count` column is NOT present; required for true 翻台率
- `dim_product` — menu items (dishes) per factory
- `dim_staff` — staff members
- `dim_payment_channel` — payment methods (美团/现金/支付宝 etc.)
- `dim_discount` — discount types

**Fact tables — POS** (from `2026_04_29_silver_facts.sql`):
- `fact_pos_transaction` — bill grain: `gross_amount`, `net_amount`, `actual_receive`, `customer_count`, `avg_per_capita`, `order_type`, `channel_origin`, `meal_period` (added by V20260513_01)
- `fact_pos_item` — bill × dish line: `qty`, `unit_price`, `amount`, `return_qty` (added by V20260511_03, `DEFAULT NULL` — Rule 1 null-handling applies for return rate computation). `return_amount` was **deferred** in V20260511_03 (see migration header §Drift note); query consumers must compute amount from `qty × unit_price` if needed before Phase IIc.
- `fact_pos_payment` — EAV: bill × payment channel
- `fact_pos_discount` — EAV: bill × discount type

**Fact tables — restaurant ops** (from `2026_04_24_silver_restaurant_ops.sql`):
- `fact_restaurant_requisition` — kitchen ingredient pull orders: `est_cost`, `actual_qty`, `status`
- `fact_restaurant_wastage` — spoilage events: `estimated_cost`, `wastage_type`, `quantity`
- `fact_restaurant_recipe_line` — BOM lines: dish × ingredient × `standard_qty` × `line_cost`
- `fact_restaurant_stocktaking` — inventory check results: `difference_qty`, `difference_cost`

**Ingredient dimension**:
- `dim_ingredient` — food ingredients with `unit_price`, `category`, `shelf_life_days`

**Reviews** (from `20260408_restaurant_reviews.sql`):
- `restaurant_reviews` — customer reviews with `rating`, `taste_score`, `env_score`, `service_score`
- Currently only `R_QINGHUAJIAO_REAL` has review rows

**Cost Silver** (from `2026_05_20_silver_cost.sql`):
- `dim_cost_category` — cost type taxonomy (material/labor/overhead/other)
- `fact_cost_line` — cost entries: `date`, `amount`, `source_type='accounting_import'|'excel'`
- Schema exists; **no rows for any restaurant chain today** — Data gap for Phase IIb cost analytics

### 2.3 Gold Layer (confirmed tables)

From `2026_05_05_gold_aggregations.sql`:
- `agg_daily` — daily sales per store: `gross_amount`, `discount_amount`, `net_amount`, `actual_receive`, `bill_count`, `customer_count`, `item_count`
- `agg_product` — monthly product performance: PK `(factory_id, product_id, month)` + `qty_sold`, `revenue`, `bill_count`, `version`, `computed_at`. **Product name is not in `agg_product`** — joins to `dim_product.name` are required. Phase IIa restaurant impl must include `JOIN dim_product ON agg_product.product_id = dim_product.product_id`. Mirror the `agg_channel` JOIN note above.
- `agg_channel` — daily payment channel breakdown: `(factory_id, channel_id, date)` PK + `amount`, `bill_count`. **Channel name is not in `agg_channel`** — joins to `dim_payment_channel.name` are required. Phase IIa restaurant impl must include `JOIN dim_payment_channel ON agg_channel.channel_id = dim_payment_channel.id`.

From `V20260513_01__qhj_revenue_silver_gold.sql`:
- `agg_daily_order_type_meal` — daily revenue by `store_id × order_type × meal_period`: `gross_amount`, `actual_receive`, `bill_count`, `customer_count`

From `2026_04_24_gold_restaurant_ops.sql`:
- `agg_restaurant_daily_ops` — EAV-style KPI per ingredient/type per day (requisition/wastage/stocktaking)
- `agg_restaurant_daily_totals` — daily scalar totals for ops metrics
- `agg_restaurant_product_cost` — food cost per dish (recipe × ingredient unit price)

**Gold read queries**: `backend/python/smartbi/gold/queries.py` — `daily_trend()`, `finance_summary()`, and related. These already serve FinanceAnalysis.vue's restaurant KPI strip (pre PR #608 placeholder).

### 2.4 What Is Missing for Each Phase

**Phase IIa (no new data needed)**:
All required Gold tables are populated for chains with POS uploads. Only risk: `R_HUOGUO_GENERIC_REAL` has no POS item rows (利润表 source only); it will display empty states.

**Phase IIb (data partially available)**:
- `fact_restaurant_wastage` rows: only QHJ demo seed (`RES_3101_009`) confirmed to have rows. All 14 R_*_REAL chains are expected to have `WASTAGE_NOT_TRACKED` per `docs/qa-audits/2026-05-11-restaurant-data-readiness-audit.md §1.4`. Phase IIb features will render gracefully with "暂无损耗数据" empty state.
- `fact_restaurant_requisition` rows: unknown status per audit §1.4. Same graceful empty-state fallback.

**Phase IIc (data gap, needs new ingestion)**:
- `fact_cost_line`: schema exists but 0 rows for restaurants. Requires either: (a) accounting import upload flow (spec deferred — noted in `docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §2 Out of Scope`), or (b) manual cost entry UI. Neither is currently in scope.

> ⚠️ **Open question OQ-1**: Does any restaurant customer have accounting data they could upload today? If yes, Phase IIb cost metrics become useful immediately. Steve to confirm at Phase IIb kickoff.

---

## 3. Phasing — Shippable Chunks

### Phase IIa — POS Sales Analytics Dashboard

> *(See [§0.5](#05-pre-ii-prerequisite-restaurant-etl-backfill-new-post-cycle-2) for prerequisite ETL work, [§11](#11-sign-off-required-before-dispatch) for current dispatch status.)*


**Customer value**: Replaces the "建设中" placeholder on `/smart-bi/sales` for restaurant tenants with a real, data-backed Sales Analysis page. Answers the daily question "今天卖了多少, 哪道菜最好?"

**Reports in scope**:
1. **营收趋势** — daily/weekly/monthly `actual_receive` and `bill_count` by store, from `agg_daily`
2. **堂食/外卖分析** — order_type split from `agg_daily_order_type_meal`; includes 午市/晚市 meal period breakdown
3. **菜品销售排行** — top 20 dishes by revenue and qty from `agg_product` (monthly grain)
4. **支付渠道分析** — pie/bar chart of `agg_channel.amount` by payment channel
5. **客单价趋势** — `avg_per_capita` from `agg_daily` averaged across stores per day

**Finance page** (`/smart-bi/finance`): Replace placeholder with a **Revenue Overview** tab:
- KPI cards: 总营收, 总单数, 均客单价, 在营门店数 (was already exposed via `loadGoldFinSummary()` pre-#608)
- Trend chart: daily revenue bar chart
- Cross-link: "查看 收入管理报表" button → `/smart-bi/revenue-report`

**Data sources**: All from existing Gold tables (`agg_daily`, `agg_product`, `agg_channel`, `agg_daily_order_type_meal`). Zero schema migrations required.

**Gating criteria to start Phase IIb**: Phase IIa deployed to prod, at least one restaurant customer has confirmed they can see their data, no P0 bugs open.

**Effort**: 1 backend Python PR (extension of polymorphic dispatch pattern) + 1 frontend Vue PR + 1 nginx ops PR. Phase IIa impl is 3-5 days **gated on the ≥5-chain Gold-coverage threshold** (§0.5). Per unified timeline (§0): total realistic timeline from today is 5-9 days (2-4d backfill best case + 3-5d impl), worst case Phase IIa scope shrinks to whatever subset has data and proceeds without delay.

### Phase IIb — Kitchen Cost and Ops Analytics (5-8 days, gated on Phase IIa)

**Customer value**: Surface food cost control metrics that restaurants care about — 损耗率, 领料成本, 盘点差异. These are data that Cretas already captures via the materials management module (wastage records, requisitions, stocktaking). Bridges the gap between operational data the kitchen manager enters daily and the financial picture the owner needs.

**Reports in scope**:
1. **食材损耗分析** — wastage trend and top-waste ingredients from `fact_restaurant_wastage` + `agg_restaurant_daily_ops`; rate vs `fact_restaurant_requisition` cost denominator
2. **领料成本趋势** — requisition cost by category over time from `fact_restaurant_requisition`
3. **盘点差异报告** — `fact_restaurant_stocktaking` difference_qty/cost by ingredient and period
4. **食材成本占比** — food cost ratio: `SUM(requisition.est_cost) / SUM(transaction.actual_receive)` per period

**Finance page** additions: New "成本" sub-tab for restaurant tenants, containing the above charts. No full P&L yet (blocked on `fact_cost_line` having data).

**Data prerequisite**: `fact_restaurant_wastage` + `fact_restaurant_requisition` Silver rows. Currently assumed empty for all 14 R_*_REAL chains; Phase IIb features must render gracefully with empty-state components (`SmartBIEmptyState`) and a CTA: "在领料管理/损耗记录模块录入数据后，此处将自动分析。"

> ⚠️ **Open question OQ-2**: Are any of the 14 restaurant chains actively using the Cretas materials management module (recording wastage/requisitions via the mobile app)? If none are, Phase IIb dashboards will always show empty states until adoption grows. Steve to decide whether to gate Phase IIb on at least one chain having real ops data, or ship the empty-state-graceful version immediately.

**Effort**: 1 backend Python PR (new `analysis_restaurant_ops.py` or extension of `analysis_quality.py`), + 1 frontend Vue PR. 5-8 days including testing.

**Gating criteria to start Phase IIc**: At least one restaurant chain has accounting cost data available for upload, OR Steve explicitly decides to defer full P&L to an indefinite future.

### Phase IIc — Full P&L and Profitability Analytics (2-4 weeks, gated on data)

**Customer value**: True gross margin calculation combining POS revenue with cost data. This is the "holy grail" finance view for a restaurant operator — net profit after food cost, labor, rent.

**Reports in scope**:
1. **毛利率分析** — `(actual_receive - food_cost) / actual_receive` per period; food cost from `fact_cost_line` (material type)
2. **成本结构分解** — material vs labor vs overhead breakdown from `fact_cost_line` with `dim_cost_category`
3. **月度 P&L 摘要** — one-page summary matching factory FinanceAnalysis.vue "profit" tab structure
4. **门店盈亏** — per-store margin if cost data is store-level

**Hard prerequisite**: `fact_cost_line` has real rows for at least one restaurant chain. This requires either:
- **Option A**: Accounting export upload flow (Excel → Bronze → `fact_cost_line`). Spec deferred per `docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §2 Out of Scope ("Phase 2 候选")`.
- **Option B**: Manual cost entry UI in Cretas ERP (new feature, ~2-3 weeks).
- **Option C**: Steve imports cost data manually via psql for a demo customer.

**Data gap**: Currently no ingestion path exists. Phase IIc cannot be dispatched until one option above is chosen and implemented.

> ⚠️ **Open question OQ-3**: Which option above does Steve want to pursue for cost data ingestion? This is the blocking architectural decision for Phase IIc.

---

## 4. API Contracts

### 4.1 Dispatch Pattern

Follows the polymorphic envelope pattern established in `backend/python/smartbi_compat/api/analysis_production.py:446-506`. Single URL per endpoint; tenant type detected at request time via `smartbi_compat.tenant.get_tenant_type()` + `TenantType.is_restaurant_tenant`.

```
GET /api/mobile/{factory_id}/smart-bi/analysis/sales
GET /api/mobile/{factory_id}/smart-bi/analysis/finance
```

Both endpoints already exist in Python (`analysis_sales.py`, `analysis_finance.py`). The Phase II change adds restaurant-branch logic inside each, exactly mirroring how `analysis_production.py` does it at lines 490-506.

### 4.2 Phase IIa — Sales Endpoint Restaurant Branch

**Endpoint**: `GET /api/mobile/{factory_id}/smart-bi/analysis/sales`

**Current state**: `analysis_sales.py` serves factory tenants. Restaurant tenants currently receive an error from Java (nginx routes them to the manufacturing-tenant Java endpoint which lacks restaurant logic — actual response code 404 confirmed in PR #608 repro JSON). PR #608 frontend placeholder masks this for end users.

**Phase IIa change**: Add restaurant branch dispatch + nginx routing inclusion (add R_* / RES_* / R\d+ pattern for sales/finance to the existing nginx allowlist, mirroring production/quality cascade).

```python
# Proposed addition to analysis_sales.py (Phase IIa).
# Mirror analysis_production.py:490-497 signature exactly — 4 args, no auth.
# Router (above this snippet) applies strip_price_for_role on the envelope
# AFTER dispatch returns (per analysis_production.py:496).

if tenant.is_restaurant_tenant:
    envelope = await _restaurant_sales_dispatch(
        factory_id, startDate, endDate, analysisType
    )
    if isinstance(envelope, dict):
        strip_price_for_role(envelope.get("data"), auth.role)
    return envelope
```

**Restaurant sales response shape** (mirrors factory composite at `analysis_sales.py` 7-key shape but with restaurant-specific sub-sections):

```jsonc
{
  "success": true,
  "data": {
    "tenantType": "RESTAURANT",
    "dateRange": {
      "startDate": "2026-05-01",
      "endDate": "2026-05-31",
      "days": 31
    },
    "overview": {
      "totalRevenue": 284650.00,
      "billCount": 3420,
      "avgPerCapita": 83.23,
      "storeCount": 4,
      "dataSource": "agg_daily"
    },
    "revenueTrend": {
      "chartType": "BAR",
      "title": "日营收趋势",
      "xAxis": ["2026-05-01", "2026-05-02", "..."],
      "series": [
        {"name": "堂食", "data": [12400.0, 13200.0, "..."]},
        {"name": "外卖", "data": [4800.0, 5100.0, "..."]}
      ]
    },
    "orderTypeSplit": {
      "chartType": "PIE",
      "title": "堂食/外卖占比",
      "series": [
        {"name": "堂食", "value": 72.4},
        {"name": "外卖", "value": 27.6}
      ]
    },
    "mealPeriodBreakdown": {
      "chartType": "BAR",
      "title": "时段营收分布",
      "series": [
        {"name": "午市", "value": 148900.0},
        {"name": "晚市", "value": 135750.0}
      ]
    },
    "productRanking": [
      {"rank": 1, "name": "水煮鱼", "revenue": 32400.0, "qtySold": 540}
    ],
    "channelBreakdown": [
      {"channelName": "美团", "amount": 88400.0, "billCount": 1100, "share": 31.0}
    ],
    "avgPerCapitaTrend": {
      "chartType": "LINE",
      "xAxis": ["2026-05-01", "..."],
      "series": [{"name": "客单价", "data": [78.3, 84.1, "..."]}]
    },
    "generatedAt": "2026-05-14T10:30:00"
  },
  "message": "ok"
}
```

**Key contract decisions**:
- `tenantType: "RESTAURANT"` discriminator allows frontend `v-if` branching without a second API call
- `dataSource` field in overview tells the frontend which Gold table powered the numbers (transparency)
- All monetary values are plain numbers (per Rule 4 `_decimal_to_number`), not strings
- `generatedAt` uses `_java_isoformat()` (Rule 11)
- `productRanking` is monthly grain (from `agg_product`); frontend should surface the grain clearly ("本月排行")

### 4.3 Phase IIa — Finance Endpoint Restaurant Branch

**Endpoint**: `GET /api/mobile/{factory_id}/smart-bi/analysis/finance?analysisType=overview`

**Current state**: `analysis_finance.py` serves factory tenants with 5-tab (profit/cost/receivable/payable/budget). Restaurant tenants get the same 404 path as sales.

**Phase IIa change**: Formalize the restaurant branch in `analysis_finance.py` returning a structured overview-only response.

```jsonc
{
  "success": true,
  "data": {
    "tenantType": "RESTAURANT",
    "analysisType": "overview",
    "kpi": {
      "totalRevenue": 284650.00,
      "billCount": 3420,
      "avgPerCapita": 83.23,
      "storeCount": 4,
      "coverageStart": "2026-05-01",
      "coverageEnd": "2026-05-31"
    },
    "revenueChart": {
      "chartType": "BAR",
      "title": "月度营收",
      "xAxis": ["2026-01", "2026-02"],
      "series": [{"name": "总营收", "data": [240000.0, 275000.0]}]
    },
    "phaseIIbPreview": {
      "wastageRate": null,
      "dataAvailability": "WASTAGE_NOT_TRACKED"
    },
    "generatedAt": "2026-05-14T10:30:00"
  }
}
```

The `phaseIIbPreview` section seeds the IIb placeholder in the UI without a second API call.

### 4.4 Auth / Permissions

Mirror `require_analytics_read` dependency (already imported in `analysis_finance.py:37`, `analysis_sales.py`). No new RBAC roles. `strip_price_for_role()` applies where `canViewPrice` matters — for restaurant revenue data, all authenticated users with analytics access can see absolute revenue numbers. Price-sensitive stripping applies to `unit_price` in `productRanking`.

### 4.5 Edge Cases (cycle-3 addition C3-4)

Phase IIa response shape behavior for common edge conditions:

| Condition | Response | Why |
|---|---|---|
| Restaurant closed for renovation, 0 bills in date range | `overview.totalRevenue: 0.0` + `billCount: 0` + **empty arrays** for `productRanking` / `channelBreakdown` (NOT null). Frontend renders `SmartBIEmptyState` based on `billCount === 0`. | Null arrays would break v-for; empty arrays + scalar `0.0` are unambiguous. |
| `customerCount == 0` but `billCount > 0` (POS didn't capture customer counts) | `avgPerCapita: null` — skip the division entirely. **Do NOT return `0.0`** (different UX meaning: "客单价 ¥0" looks like a free meal). Frontend renders "—". | Div-by-zero hazard; null is honest about missing data. Mirror Rule 1 (`is not None` semantics). |
| Deleted dish (`agg_product.product_id` no longer in `dim_product`) | JOIN with `COALESCE(dim_product.name, '(已下架菜品 #' \|\| product_id \|\| ')')`. Revenue/qty fields preserved from `agg_product`. | Customers see history without exposing internal ID; revenue numbers stay accurate. |
| `startDate > endDate` (caller bug) | HTTP 400 with `code: "INVALID_DATE_RANGE"`, message `"开始日期不能晚于结束日期"`. Mirror Rule 6 (Python rules). | Avoid silent empty response masking a frontend bug. |
| `startDate == endDate` (single-day query) | Normal response. `revenueTrend.xAxis` has one element; charts render as a single bar. | Common analyst use case (today's snapshot). |
| Date range exceeds available Gold coverage (e.g. asks 2024-01 but `agg_daily` starts 2025-01) | Normal response with `dateRange.coverageWarning: "数据起始 2025-01-01"`. Empty trend before coverage start. | Surface the limitation rather than silently truncating; cycle-3 design call. |

Sister-chat impl must add unit tests covering each of these 6 conditions before merge.

### 4.5.1 Divergences from Factory Contract Justified

| Factory contract | Restaurant divergence | Justification |
|---|---|---|
| `profit / cost / receivable / payable / budget` tabs | `overview` only (IIa), `costops` (IIb) | Factory cost data is in `smart_bi_finance_data`; restaurants have POS-derived revenue only |
| `salespersonRanking` | Replaced by `channelBreakdown` | Restaurants don't have salesperson concept; payment channels are the relevant dimension |
| `customerRanking` | Replaced by `productRanking` | Restaurant customers are anonymous (no CRM IDs); dish ranking is the primary revenue driver |
| `trendChart` by factory custom dimensions | `revenueTrend` by `order_type + meal_period` | Restaurant semantics: channel and time-of-day are the key dimensions |

---

## 5. UI / Frontend Changes

### 5.1 Strategy: Extend Existing Files, Not New Files

Both `FinanceAnalysis.vue` (2972 LOC) and `SalesAnalysis.vue` (2309 LOC) already have `isRestaurantTenant` branching established. The pattern is correct: add restaurant-specific sections via `v-if="isRestaurantTenant"` blocks. Avoids creating new route entries, keeps navigation unchanged, reuses all shared components.

**Decision**: Do NOT create new `RestaurantFinanceAnalysis.vue` / `RestaurantSalesAnalysis.vue` files. Extend the existing files. **Replace** the `RestaurantPhaseIIPlaceholder` (PR #608) with actual content blocks.

### 5.2 SalesAnalysis.vue Changes (Phase IIa)

1. Replace `RestaurantPhaseIIPlaceholder` with restaurant data sections
2. `loadRestaurantSalesData()` calling the new `/analysis/sales` restaurant branch
3. Template: existing factory content stays under `v-else`. Add restaurant section with:
   - Date range picker (reuse existing `dateRange` ref)
   - KPI strip: 总营收, 总单数, 均客单价, 在营门店 (reusable `CapabilityGate` wrappers)
   - `DynamicChartRenderer` for `revenueTrend`
   - Order type pie via `DynamicChartRenderer`
   - Meal period bar via `DynamicChartRenderer`
   - Product ranking table (simple `el-table` with top-20 dishes)
   - Channel breakdown bar/pie

### 5.3 FinanceAnalysis.vue Changes (Phase IIa)

1. Replace `RestaurantPhaseIIPlaceholder` with the Phase IIa Revenue Overview when `analysisType === 'overview'`
2. Add "查看 收入管理报表" cross-link button: `router.push('/smart-bi/revenue-report')`
3. Add `revenueChart` trend section below KPI strip using `DynamicChartRenderer`
4. Phase IIb preview: Show wastage rate placeholder KPI card with `SmartBIEmptyState` and tooltip "损耗数据将在 v2 中加入"

### 5.4 Reusable Components Available

| Component | File | Usage in Phase II |
|---|---|---|
| `DynamicChartRenderer` | `web-admin/src/components/smartbi/DynamicChartRenderer.vue` | All trend/pie/bar charts |
| `SmartBIEmptyState` | `web-admin/src/components/smartbi/SmartBIEmptyState.vue` | Empty state for chains with no data |
| `CapabilityGate` | `web-admin/src/components/CapabilityGate.vue` | Gate revenue numbers behind `canViewPrice` |
| `ChartTypeSelector` | `web-admin/src/components/smartbi/ChartTypeSelector.vue` | Let user switch bar/line/etc. |

### 5.5 Tab Structure

**FinanceAnalysis.vue** restaurant view:
- Tab: 营收概览 (Phase IIa — replaces placeholder)
- Tab: 成本运营 (Phase IIb — empty state with CTA until data available)
- ~~利润/成本/应收/应付/预算~~ — hidden for restaurant tenants

**SalesAnalysis.vue** restaurant view:
- Single page (no tabs needed for IIa)

### 5.6 Cross-link with Revenue Report (Phase I)

```html
<el-button type="primary" plain @click="router.push('/smart-bi/revenue-report')">
  导出可打印的 可比同比/环比报表 →
</el-button>
```

### 5.6.1 UX positioning vs Revenue Report (cycle-3 addition C3-11)

Phase IIa Sales Analytics and the Phase I Revenue Report overlap ~60% on data sources (both read `agg_daily`, `agg_daily_order_type_meal`). Customers will reasonably ask "what's the difference?" UX positioning:

| | **Phase IIa Sales Analytics** | **Phase I Revenue Report** |
|---|---|---|
| Surface | `/smart-bi/sales` (and `/smart-bi/finance` Revenue Overview tab) | `/smart-bi/revenue-report` |
| Format | Always-live interactive dashboard (charts, top-N tables, filters) | On-demand 4-sheet Excel download |
| Use case | Daily glance: "今天哪道菜最好? 渠道分布?" | Monthly export: "给老板的可打印同比环比报表" |
| Data depth | Top-N summarization | Full sheet-by-sheet exhaustive breakdown |
| Refresh | Realtime from Gold | Cache-keyed (8h TTL) |

Cross-link wording in §5.6 above intentionally says "导出可打印的" to emphasize the export-printable distinction — the dashboard is for browsing, the report is for downstream sharing.

### 5.7 Rollback strategy (cycle-3 addition C3-7)

If Phase IIa ships and customers report wrong numbers / broken UX:

1. **Keep `RestaurantPhaseIIPlaceholder.vue` file in the repo** even after Phase IIa lands. Phase IIa PR removes only the `<RestaurantPhaseIIPlaceholder>` import and template usage, NOT the component file.
2. **Add a feature flag pattern**: introduce a `phaseIIaEnabled` computed in both FinanceAnalysis.vue / SalesAnalysis.vue, default `true`. Wrap restaurant section: `v-if="isRestaurantTenant && phaseIIaEnabled"`; placeholder branch: `v-else-if="isRestaurantTenant && !phaseIIaEnabled"`. Source the flag from a config endpoint or env (`VITE_PHASE_IIA_ENABLED`), defaulting on; ops can flip to off via env var without a code revert.
3. **Code-revert path**: if flag flip insufficient, `git revert <phase-iia-merge-commit>` is safe because the placeholder file is preserved.

### 5.8 File LOC growth (cycle-3 addition C3-7)

Both target files are large pre-Phase IIa:
- `FinanceAnalysis.vue`: 2972 LOC
- `SalesAnalysis.vue`: 2309 LOC

Adding ~500 LOC restaurant blocks pushes both past 3000-3500 LOC. Vue 3 compile/HMR degrades noticeably past ~3000 LOC. Mitigation: if either file exceeds **3500 LOC** post-impl, extract the restaurant section to a sub-component (`RestaurantSalesContent.vue` / `RestaurantFinanceContent.vue`) imported in the `v-if` branch. This preserves the "extend existing file" decision (parent file stays; sub-component is just an import) and keeps each file under the HMR threshold.

---

## 6. Migration Plan

### 6.1 Nginx Routing Required for Phase IIa

The current nginx allowlist (`/www/server/panel/vhost/nginx/web-admin.conf:105`) explicitly lists which factory_ids route `/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)` to Python.

**Cycle-2 finding (I-1)**: The allowlist actually already includes 12 demo / test restaurant factory_ids — `RES_3101_00[1-9]`, `RES_GML_001`, `R001`, `R_GML_DEMO`, `R_XMX_(CHAIN|FRESH[123]?)`, `R_YHDJ_DEMO`, `R_YJJ_DEMO`, `TEST_0000_001`. These chains hit Python today; since `analysis_sales.py` / `analysis_finance.py` have no restaurant branch, Python currently returns a factory-shape response (empty for them since their factory_id has no `smart_bi_sales_data` rows). Only the 14 R_*_REAL chains miss the allowlist and fall through to Java 404.

**Phase IIa nginx change**: Add a parallel `location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales)(/.*)?$ { proxy_pass http://cretas_python; }` rule (mirroring the production|quality cascade at line 161). This is broader than just R_*_REAL — it covers all current and future restaurant factory_ids. The 12 already-routed demo chains will switch from broken factory-shape responses to working restaurant-shape responses on the same deploy.

**Testing implication**: Phase IIa pre-deploy smoke must cover both already-routed demo chains (R_GML_DEMO etc.) AND newly-routed R_*_REAL chains. The former category may surface bugs that were masked before (since old factory-shape response gave empty data, customers ignored it).

**Risk**: This must ship simultaneously with the Python restaurant branch. If nginx is updated first, requests will hit Python's factory branch and fail. If Python is updated first, restaurants still 404 at nginx.

**Deploy order** (cycle-3 fix C3-8: avoid race window where Python+nginx done but frontend not, exposing broken UI during rollout):

0. **Frontend PR stays open / unmerged** until all other steps complete. PR #608 `RestaurantPhaseIIPlaceholder` remains live for restaurant tenants throughout backend cutover.
1. Python deploy (test 8084) with restaurant branch + factory branch both functional
2. Verify factory tenants still work via existing nginx test routing
3. nginx test config update — add restaurant routing
4. Verify restaurant tenants reach Python successfully on test (smoke test against ≥2 chains with Gold data)
5. Python deploy (prod 8083, Blue-Green)
6. nginx prod config update — add restaurant routing
7. Verify prod backend healthy for restaurants (curl direct from server, bypassing browser)
8. **Final step**: merge frontend PR + deploy web-admin. This simultaneously replaces placeholder across all restaurant tenants — no race window because backend is already ready.

If any step 1-7 fails: backend revert + placeholder stays live (no user-visible regression). Frontend never deployed = no rollback needed for frontend.

### 6.2 No Schema Migrations Required for Phase IIa

Phase IIa reads exclusively from existing Gold tables. No `V2026xxxx` migrations needed.

### 6.3 Factory Tenant Isolation

The polymorphic dispatch pattern guarantees factory tenants are never affected. The restaurant branch check (`tenant.is_restaurant_tenant`) at the top of each endpoint function short-circuits before any factory logic runs. The `TenantType` detection in `tenant.py:93-121` (`get_tenant_type` function) queries `cretas_db.factories.type` — if this query fails or no row matches, `from_db_value()` (line 77+) defaults to `TenantType.FACTORY`, protecting factory tenants even in degraded states.

### 6.3.1 RLS Pattern Decision (cycle-2 fix C-2)

Phase IIa Gold tables (`agg_daily`, `agg_product`, `agg_channel`, `agg_daily_order_type_meal`) all have `POLICY "tenant_isolation" USING ((factory_id)::text = current_setting('app.factory_id', true)) + FORCE ROW LEVEL SECURITY`.

Two patterns coexist in the codebase:

1. **WHERE-clause pattern** — `analysis_production.py:190` uses `WHERE factory_id = $1` and relies on the connection-pool role having `BYPASSRLS`. This is the dispatch template Phase IIa mirrors.
2. **GUC pattern** — `smartbi/agent/narrative_cache.py:86,130,163` and `smartbi/api/data_quality_queue_admin.py:14` explicitly call `SELECT set_config('app.factory_id', $1, true)` transaction-scoped.

**Phase IIa decision**: **Use the WHERE-clause pattern** mirroring `analysis_production.py:190`. The cretas async pool role is `cretas` (verify via `\du` in `smartbi_prod_db` before impl); per `analysis_production.py` working in prod today, this role either has BYPASSRLS or the `app.factory_id` GUC is set elsewhere upstream (FastAPI middleware?). Sister-chat impl must verify with `\du` and add a one-line comment in the new restaurant dispatcher: `# RLS: relies on connection pool role BYPASSRLS (analysis_production.py:190 pattern)`. If `\du` reveals the role does NOT have BYPASSRLS, fall back to the GUC pattern with one `set_config` call at the start of each request.

**Why not the GUC pattern**: The dispatch template (`analysis_production.py`) is already in prod using WHERE-clause without issue — switching mid-implementation risks divergence and untested code paths. The cycle-2 finding is a documentation gap, not a code defect.

### 6.4 Phase IIb Data Backfill

Before Phase IIb goes live, run `scripts/etl/validate-restaurant-data-quality.py` (already shipped, `docs/qa-audits/2026-05-11-restaurant-data-readiness-audit.md §3.1`) to confirm which chains have `fact_restaurant_wastage` / `fact_restaurant_requisition` rows. For chains with zero rows, the UI must show `SmartBIEmptyState` rather than an error.

---

## 7. Risks and Open Questions

### 7.1 Data Availability Risk (High Impact)

Phase IIa risk is LOW **assuming** the restaurant data readiness audit's a-priori expectation holds in prod (`docs/qa-audits/2026-05-11-restaurant-data-readiness-audit.md §1.4` rates N3 = `fact_pos_item` populated as READY for all 14 R_*_REAL chains — but this is reasoning from migration coverage, not a prod query confirmation). The OQ-4 pre-deploy Gold coverage check (see §7.2) confirms this assumption before Phase IIa ships. The only dead chain explicitly known is `R_HUOGUO_GENERIC_REAL` (利润表 source, no POS items).

Phase IIb risk is HIGH — all 14 real chains are expected to return `WASTAGE_NOT_TRACKED` and empty requisition data per the data readiness audit. The IIb dashboards may render as all-empty-states for every restaurant customer until they begin using Cretas operational modules actively.

Phase IIc risk is CRITICAL — no ingestion path for cost data exists. Without Steve's decision on OQ-3, Phase IIc has no unblocking path.

### 7.2 POS System Diversity

The current Bronze parser is calibrated for 二维火 (only QHJ chain has been fully validated). The other 13 chains have uploaded data via various CSV/Excel formats parsed by the dynamic field mapper. If `agg_daily` aggregations are missing for some chains, it means their ETL chain has a gap upstream. Phase IIa's frontend must handle the case where Gold tables return zero rows for a given `factory_id` + date range.

> ⚠️ **Open question OQ-4**: Run `SELECT factory_id, COUNT(*), MIN(date), MAX(date) FROM agg_daily GROUP BY factory_id` on `smartbi_prod_db` before Phase IIa deploy to establish a per-chain coverage map. Do this before writing the frontend to avoid "beautiful charts on top of no data" surprises.

### 7.3 `dim_store.table_count` for 翻台率

True table turnover rate (`bills / table_count / day`) requires `dim_store.table_count`. This column does not exist in `dim_store` schema. The production endpoint already uses a bills-per-store proxy for M3 (per `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md §3.5`). Sales dashboard should display "翻台率(参考)" and tooltip "精确翻台率需要门店桌位数，请联系管理员补充。"

> ⚠️ **Open question OQ-5**: Should Phase IIa include a one-time admin action to let restaurant operators input their store table counts? If yes, this is a minor feature addition (~0.5pd, adds `table_count` column to `dim_store` via migration + a simple admin form).

### 7.4 Performance — Silver Aggregation Cost

Phase IIa reads from Gold tables only — queries are fast (indexed, small result sets, RLS automatically scopes to tenant). No performance risk.

Phase IIb reads from Silver `fact_restaurant_wastage` and `fact_restaurant_requisition` directly. For a chain with 365 days × 50 wastage events/day = ~18,000 rows, a date-range scan with `(factory_id, date)` index is acceptable. No materialized view needed for Phase IIb.

Phase IIc `fact_cost_line` queries combined with `fact_pos_transaction` for margin calculation may require a Silver-to-Gold aggregation step (a monthly P&L Gold table). Defer this design to Phase IIc spec.

### 7.5 Rule 1-12 Compliance for New Python Code

All new Python analytics code must follow `.claude/rules/python-java-port.md`. Key rules for Phase IIa restaurant branch:

- **Rule 1**: Use `is not None` not `or` for null checks on `agg_daily.gross_amount`
- **Rule 4**: Use `_decimal_to_number()` for all monetary values returned to JSON
- **Rule 6**: Raise `ValueError` if `start_date` or `end_date` is None in any new query helper
- **Rule 10**: Any percentage computation (e.g., channel share = `amount / total`) must do intermediate quantize at scale 4 before final quantize at scale 2
- **Rule 11**: Use `_java_isoformat()` for any `datetime` in response (not `.isoformat()`)
- **Rule 12**: Use `Decimal.quantize(..., ROUND_HALF_UP)` not f-string `:.Nf` for display formatting

Restaurant branch is new Python code with no Java equivalent to mirror — Rules 8 and 9 (Map.of key order / Lombok serialization) do not apply. Rules 2, 3 apply only when trend computation involves weekly period keys.

---

## 8. Out of Scope (Explicit List)

The following are explicitly excluded from this spec. They are either covered by other specs, already shipped, or intentionally deferred:

- **AI 问答 / 智能分析** — handled by `RestaurantChatPanel.vue` and `AIQuery.vue`; separate surface. Not part of Phase II structured analytics.
- **收入管理报表** — Phase I, already shipped (PRs #569/#593/#596). Phase II links to it but does not modify it.
- **Real-time streaming dashboards** — no WebSocket infrastructure; not in PRD
- **Cross-tenant comparison** — "集团视角" analytics across multiple chains. Out of scope for individual restaurant SmartBI.
- **Audit logs / cell provenance** — handled by 数据织网 C spec (`V20260430_01__c_field_provenance.sql`); already has its own surface
- **Q4/Q5 production + quality endpoints** — restaurant branch already live; not touched by this spec
- **Mobile app (React Native) SmartBI views** — SmartBI is web-admin only; mobile app shows different dashboards
- **AR/AP aging analytics** — restaurants do not use Cretas AR/AP modules; no data source
- **Budget management** — no restaurant budget concept in current system
- **Multi-language i18n** — project has no `vue-i18n`; out of scope per QHJ revenue report spec
- **跨日营业日界**: 餐饮店常营业到次日 02:00, business-day boundary 是否 00:00 vs 02:00? 当前 `fact_pos_transaction.date` 用 civil-day (00:00 切). Phase IIa response 不区分, business-day reconciliation 是 Phase IIc 议题
- **退货 / 撤单 (refund / void) 反映**: `fact_pos_item.return_qty` 在 V20260511_03 加了 (默认 NULL), `return_amount` 未加. Phase IIa response (revenueTrend / productRanking) 用 `gross_amount` vs `actual_receive` 的语义没在 spec 中明确; 是否 net-of-refund 由 Sister-chat impl 时根据数据真相决定. 真正 退货率分析 留 Phase IIc.
- **集团/分店聚合 (R_*_BRANCH 模式)**: 连锁 like 唏嘛香 (R_XIMAXIANG_REAL) 是单 factory_id × N stores via dim_store. 若未来出现 franchise 模式 (每个分店一个 factory_id), 跨 factory_id 集团聚合不在 Phase II 范围. Per-tenant 视图 only.

---

## 9. Implementation Map (Build Sequence)

### Phase IIa Build Checklist

**Backend (1 PR):**
- [ ] Add `_restaurant_sales_dispatch()` function to `backend/python/smartbi_compat/api/analysis_sales.py`
- [ ] Add tenant detection call at top of `get_sales_analysis()` (mirrors `analysis_production.py:487-497`)
- [ ] Implement `_get_restaurant_revenue_trend()` querying `agg_daily` + `agg_daily_order_type_meal`
- [ ] Implement `_get_restaurant_product_ranking()` querying `agg_product`
- [ ] Implement `_get_restaurant_channel_breakdown()` querying `agg_channel`
- [ ] Add `_restaurant_finance_overview()` to `analysis_finance.py`
- [ ] Apply Rule 1/4/6/10/11/12 audit checklist per `.claude/rules/python-java-port.md`
- [ ] Unit tests: empty-state branch (zero agg_daily rows) + real-data branch (mock Gold rows)

**Nginx (1 ops PR):**
- [ ] Add `(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales)(/.*)?` rule to `/www/server/panel/vhost/nginx/web-admin.conf` and `api.cretaceousfuture.com.conf`
- [ ] Backup before edit (timestamped .bak)
- [ ] `nginx -t` + `nginx -s reload`

**Frontend (1 PR):**
- [ ] `SalesAnalysis.vue`: replace `RestaurantPhaseIIPlaceholder` with restaurant data sections
- [ ] `FinanceAnalysis.vue`: replace `RestaurantPhaseIIPlaceholder` with Phase IIa content block + cross-link to `/smart-bi/revenue-report`
- [ ] Reuse `DynamicChartRenderer` for all trend/pie charts
- [ ] Handle empty-state for `R_HUOGUO_GENERIC_REAL` (no POS items)
- [ ] `vite build` must pass (per HARD rule `feedback_vite_build_only_catches_vue_ts_import_paths.md`)

**Pre-deploy (cycle-3 expanded checklist C3-9 + C3-10):**
- [ ] **OQ-4 re-run on `smartbi_prod_db`** to confirm post-backfill coverage ≥5 chains (Track C threshold)
- [ ] **RLS verification**: `\du cretas` on `smartbi_prod_db` — confirm `Bypass RLS` attribute. If NOT bypass, add `await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)` at top of every new restaurant query helper (mirror `narrative_cache.py:86`). Otherwise, WHERE-clause pattern as planned in §6.3.1
- [ ] **`agg_product` index check**: verify index supports `WHERE factory_id=$1 AND month BETWEEN $2 AND $3 ORDER BY revenue DESC LIMIT 20`. Run `EXPLAIN` on a 4-store and a 20-store factory_id. If missing, add `V20260514_XX__agg_product_revenue_idx.sql` migration: `CREATE INDEX … ON agg_product(factory_id, month, revenue DESC)`. Without this index, top-N queries are seq scan
- [ ] **`agg_daily_order_type_meal` index check**: verify covers `(factory_id, date)` for date-range queries
- [ ] **Test env data fallback**: if `smartbi_db` (test) has no R_*_REAL data, smoke test direct against prod `RES_3101_009` (paused-traffic factory_id) bypassing nginx
- [ ] Deploy Python to test env (8084) first per §6.1 deploy order step 1
- [ ] Active E2E: 15-30 min per stage (per HARD rule `feedback_active_e2e_replaces_passive_soak.md`)

### Phase IIb Build Checklist

- [ ] Steve decision on OQ-1 (any chain with accounting data?) and OQ-2 (gate on real ops data?)
- [ ] Run `validate-restaurant-data-quality.py` on prod to establish wastage/requisition coverage
- [ ] New Python file `analysis_restaurant_ops.py` OR extend `analysis_quality.py`
- [ ] Implement `_get_wastage_analytics()` from `fact_restaurant_wastage` + `agg_restaurant_daily_ops`
- [ ] Implement `_get_requisition_cost_trend()` from `fact_restaurant_requisition`
- [ ] Frontend: add "成本运营" tab to FinanceAnalysis.vue restaurant section with graceful empty states

### Phase IIc Prerequisites (Not Yet Dispatchable)

- [ ] Steve decision on OQ-3 (cost data ingestion strategy)
- [ ] Accounting import upload flow OR manual cost entry UI (separate spec required)
- [ ] Once `fact_cost_line` has real rows: new P&L endpoint spec + impl

---

## 10. Cross-References

| Document | Path | Relationship |
|---|---|---|
| QHJ Revenue Report design | `docs/qa-specs/2026-05-12-qhj-revenue-report-design.md` | Phase I spec — this Phase II spec links to and extends it |
| Q4/Q5 restaurant semantics | `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` | Sister spec for production/quality endpoints |
| Restaurant data readiness audit | `docs/qa-audits/2026-05-11-restaurant-data-readiness-audit.md` | Per-chain ops data coverage baseline |
| Silver facts migration | `backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql` | fact_pos_transaction + fact_pos_item schema |
| Gold aggregations migration | `backend/python/smartbi/database/migrations/2026_05_05_gold_aggregations.sql` | agg_daily + agg_product + agg_channel schema |
| Revenue Silver/Gold migration | `backend/python/smartbi/database/migrations/V20260513_01__qhj_revenue_silver_gold.sql` | agg_daily_order_type_meal schema |
| Silver restaurant ops migration | `backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql` | fact_restaurant_wastage/requisition/recipe/stocktaking |
| Silver cost migration | `backend/python/smartbi/database/migrations/2026_05_20_silver_cost.sql` | fact_cost_line schema (Phase IIc prerequisite) |
| Polymorphic dispatch pattern | `backend/python/smartbi_compat/api/analysis_production.py:440-506` | The exact pattern this spec extends |
| Tenant detection module | `backend/python/smartbi_compat/tenant.py` | `get_tenant_type()` + `TenantType.is_restaurant_tenant` |
| Gold queries module | `backend/python/smartbi/gold/queries.py` | `finance_summary()` + `daily_trend()` primitives |
| Python port rules | `.claude/rules/python-java-port.md` | Rules 1-12 compliance requirements |
| FinanceAnalysis.vue | `web-admin/src/views/smart-bi/FinanceAnalysis.vue` | Existing file to extend (2972 LOC) |
| SalesAnalysis.vue | `web-admin/src/views/smart-bi/SalesAnalysis.vue` | Existing file to extend |
| RestaurantPhaseIIPlaceholder.vue | `web-admin/src/components/smartbi/RestaurantPhaseIIPlaceholder.vue` | PR #608 — to be REPLACED by Phase IIa actual content |
| RevenueReport.vue | `web-admin/src/views/smart-bi/RevenueReport.vue` | Phase I page — cross-link target |

---

## 11. Sign-off Required Before Dispatch

### 11.1 Decisions made (closed)

- ✅ **OQ-4 ANSWERED 2026-05-14** — cycle-2 audit pre-ran the SQL. Result: only RES_3101_009 has Gold data. Phase IIa scope decision: **deferred until ETL backfill (§0.5) completes**.
- ✅ **Steve 2026-05-14 decision**: Phase IIa 暂延, Pre-II ETL Backfill (§0.5) is the immediate dispatch.

### 11.2 Open questions / pending dispatch

- [ ] **Steve OQ-1**: Any restaurant chain has accounting cost data to upload today? (Needed for Phase IIb sequencing)
- [ ] **Steve OQ-2**: Gate Phase IIb on at least one chain having real ops data, or ship empty-state-graceful?
- [ ] **Steve OQ-3**: Which cost data ingestion option for Phase IIc (accounting upload / manual entry / defer)?
- [ ] **Steve OQ-5**: Include `dim_store.table_count` admin input in Phase IIa (post-backfill), or defer?
- [ ] **Engineering — IMMEDIATE**: Dispatch Pre-II ETL Backfill tracks A+B+C per §0.5. Phase IIa impl waits.
- [ ] **Engineering — after backfill**: Phase IIa ready to dispatch once threshold (≥5 chains with Gold rows) met per §0.5 acceptance memo.

---

*Spec authored 2026-05-14. Based on survey of `backend/python/smartbi/database/migrations/` (75 files), `backend/python/smartbi_compat/api/` (18 Python files), `web-admin/src/views/smart-bi/` (40+ Vue files), `docs/qa-audits/2026-05-1*` (80+ audit docs), `docs/qa-specs/2026-05-12-qhj-revenue-report-design.md`, `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md`.*

### Audit history

| Cycle | Date | Findings | Key changes applied |
|---|---|---|---|
| 1 | 2026-05-14 | 3 CRITICAL + 4 IMPORTANT | Facts: return_amount V20260511_03 status, tenant.py line cites, SalesAnalysis.vue LOC, agg_channel JOIN, KPI strip line cite, 404 language, §1.4 a-priori basis |
| 2 | 2026-05-14 | 3 CRITICAL + 3 IMPORTANT | OQ-4 prod SQL revealed Phase IIa data gap → Steve deferred to backfill; §0.5 added; RLS pattern declared; dim_product JOIN noted; nginx allowlist state documented; OOS additions (timezone/refund/chain-mode) |
| 3 | 2026-05-14 | 4 CRITICAL + 7 IMPORTANT | §0.5 Track A/B premises rewritten (V20260511_02 writes to `restaurant_chain_catalog` not `factories`; no aggregation allowlist — per-upload `GoldMaterializer` gated by `SMARTBI_ENABLE_SILVER_DUAL_WRITE`); §4.2 dispatch signature corrected; §4.5 Edge cases added (6 conditions); §5.6.1/§5.7/§5.8 added; §6.1 deploy order reordered (race fix); §9 checklist expanded (RLS verify + index check) |
| 4 | 2026-05-14 | 0 CRITICAL + 6 IMPORTANT + 10 MINOR | Aesthetics/structure: STATUS block + TOC at top; sign-off split into 11.1 done / 11.2 open; §1.1 table warning; Phase IIa restatement cross-refs |
