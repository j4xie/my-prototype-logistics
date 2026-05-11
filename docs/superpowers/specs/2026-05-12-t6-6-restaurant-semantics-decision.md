# T6.6 Q4 + Q5 Restaurant-Tenant Semantics — Decision Ratification Spec

**Status**: ⛔ DRAFT — Spec ratification only. No code, no migrations, no DDL apply.
**Spec date**: 2026-05-12
**Author**: chat4 (Q4/Q5 decision ratification dispatch, post-`/clear` context)
**Branch**: `ops-q4-q5-decision-spec`
**Worktree**: `.worktrees/q4-q5-decision-spec`
**Audience**: T6.6 Phase B Sub-A / Sub-B impl chats (production / quality endpoint port); Sub-ETL-* chats (data fill scope); Steve (sign-off on data-gap resolution path per metric)
**Trigger**: Steve directive 2026-05-11 via AskUserQuestion — Q4 = Option B, Q5 = Option B (餐饮重定义). PR #298 §6.1 recommended writing this doc (~0.5 person-day). PR #223 §8 Q4 + Q5 currently flagged PENDING.

---

## 0. TL;DR

Q1 amendment (PR #223) §8 flags **two PENDING Open Questions** that block T6.6 Phase B Sub-A (`/analysis/production`) + Sub-B (`/analysis/quality`) endpoint output shapes:

- **Q4** — restaurant-tenant Production endpoint semantics (factory-floor OEE doesn't map to restaurant)
- **Q5** — restaurant-tenant Quality endpoint semantics (factory defect rate / FPY / rework doesn't map either)

Steve's 2026-05-11 AskUserQuestion response: **both Q4 + Q5 → Option B (餐饮重定义)**.

This spec ratifies that decision into source-of-truth committed form:

| Decision | Q4 ratification | Q5 ratification |
|---|---|---|
| Factory tenant | Java mock parity (unchanged) → OEE / Availability / Performance / Quality 4-metric envelope | Java mock parity (unchanged) → Defect rate / FPY / Rework / Quality cost 4-metric envelope |
| Restaurant tenant | **REDEFINE** — 厨房工位利用率 / 备菜时间 / 翻台率 (3-metric envelope) | **REDEFINE** — 食安事故率 / 投诉率 / 退菜率 / 损耗率 (4-metric envelope) |
| Polymorphism | Single endpoint, tenant-typed response envelope (§3.1 Option A) | Single endpoint, tenant-typed response envelope (§3.1 Option A) |
| Data source readiness | **PARTIAL** — 1 of 3 metrics derivable from existing schema; 2 of 3 require ETL extension (§1.5) | **MIXED** — 2 of 4 metrics derivable; 2 of 4 require new ETL ingestion OR proxy logic (§2.5) |

**Critical implication**: Steve's Option B answer is the *semantic* decision (what metrics restaurant Production/Quality returns). The *data infrastructure* to populate those metrics for the 14 real chains is **not free** — 4 of the 7 redefined metrics require schema extension or new ETL ingestion paths not currently in scope of the ETL infra spec (PR #316). Each redefined metric is graded §1.x / §2.x for: derivable-today / proxy-derivable / needs-schema-extension / needs-new-data-source.

**Effort impact on T6.6 Phase B Steps 4+5+6 (per Q1 §4.7)**:

- Pre-this-ratification estimate (Q1 §4.4 Step 4): ~10 person-days combined for production + quality service refactor
- Post-ratification realistic estimate: **~14-16 person-days** for service refactor *if* tenant-typed envelope adopted AND data-gap proxies implemented per §4 recommended defaults. Up to +6pd vs Q1 estimate if data-gap fills require new ETL ingestion (§5.3 worst case).

This spec **does not authorize** ETL extension to fill gaps — that scope-creeps into Q-ETL-* territory (PR #316). Spec recommends path forward: ship endpoints with explicit `dataAvailability: "INCOMPLETE"` markers per metric where data missing; Phase B kickoff dispatches separate ETL extension chats only if Steve approves.

⛔ **HOLD blocks** (per dispatch §⛔ + Q1 §10 + audit PR #298 §6.1):
- Spec ratification only — no code, no migrations, no DDL, no deploys.
- Sub-A / Sub-B impl chats remain HOLD per MO PR #249 §⛔ pre-flight (T6.5 Phase C close + active-E2E gate).
- ETL extension dispatches (if any) gated on Steve sign-off per §4 + §5 per-metric resolution.
- STOP-and-ping organizer BEFORE pushing this spec — per HARD `feedback_pause_before_deploy_or_push.md`.

---

## 1. Q4 Decision Ratification — `/analysis/production` for Restaurant Tenant

### 1.1 Steve directive (verbatim semantics)

Per Steve 2026-05-11 AskUserQuestion answer:

> Q4 = Option B (餐饮重定义). 餐饮 Production = 厨房工位利用率 / 备菜时间 / 翻台率.

This rejects Option A (tenant-gate to FACTORY only with 410 / `notApplicableForTenantType`) and Option C (permanent 410-stub for restaurant tenants). Restaurant Production endpoint MUST return a substantively meaningful body shape, redefined for restaurant ops semantics.

### 1.2 3-metric redefinition (canonical)

| # | 工厂语义 (factory tenant) | 餐饮重定义 (restaurant tenant, Option B) | Unit | Higher-is-better |
|---|---|---|---|---|
| M1 | Overall Equipment Effectiveness (OEE) | 厨房工位利用率 (Kitchen Station Utilization) | % | Yes |
| M2 | Availability | 备菜时间 (Average Prep Time per Order) | minutes | No (lower is better) |
| M3 | Performance | 翻台率 (Table Turnover Rate) | turns/day | Yes |
| (M4 factory) | Quality (factory subcomponent of OEE) | **OMITTED for restaurant** — overlaps semantically with Q5 quality endpoint | — | — |

Note: the factory OEE family is 4-metric (OEE + Availability + Performance + Quality), Q5 keeps factory's "Quality" as quality-endpoint scope. Restaurant Production is **3-metric** because 翻台率 already encodes "throughput" (factory's Performance proxy) and 备菜时间 encodes "speed" (factory's Availability proxy). Adding a 4th would force a synthetic composite that doesn't reflect restaurant ops mental model.

### 1.3 Per-metric data source mapping

#### M1: 厨房工位利用率 (Kitchen Station Utilization)

**Conceptual definition**: % of operating hours during which a kitchen station (e.g., 炒锅 / 凉菜 / 蒸炉 / 烤箱) is actively producing an order, relative to total operating hours.

**Formula** (canonical):

```
station_utilization = total_active_minutes / (operating_hours × station_count × 60)
```

**Data gap level**: ❌ **NO SOURCE** — schema lacks both inputs:
- No `dim_kitchen_station` table or equivalent in current Silver layer.
- No order-station mapping (`fact_pos_item` lacks `kitchen_station_id`).
- No `active_minutes` per station per period — would require workstation-level timer events, not present.
- Existing Excel source data (Q1 §2.3) provides **none** of this — 大众点评 商品销量报表 is sales-output grained, not station-input grained.

**Implementation options** (recommend Steve picks at Phase B kickoff):

| Option | Approach | Effort | Honesty |
|---|---|---|---|
| **A1 (DEFAULT)** | Emit `null` for restaurant tenants on M1 with `dataAvailability: "MISSING_KITCHEN_STATION_DATA"` envelope marker | ~0.1pd | Honest (no fabrication) |
| A2 | Synthesize a proxy from `fact_pos_item.qty` aggregated by hour-of-day vs `dim_store.operating_hours` (assumed) | ~1.5pd in Sub-A | Misleading — not actually kitchen station data |
| A3 | Extend ETL: ingest workstation timer data from a new `fact_kitchen_station_event` table sourced from POS-system station tickets (e.g., 美团 / 哗啦啦 中央 POS sometimes exports this) | ~5pd schema + ETL + ingestion | Honest, biggest effort |

**Recommended default**: A1. Spec §4 lists this as Q-DEC-1 for Steve final sign-off.

#### M2: 备菜时间 (Average Prep Time per Order)

**Conceptual definition**: Average minutes between order placement (下单) and dish serve (上菜).

**Formula**:

```
avg_prep_time_minutes = AVG(serve_time - order_time) per order
```

**Data gap level**: ❌ **NO SOURCE** — `fact_pos_transaction` has 1 `time` TIMESTAMP column only (verified `2026_04_29_silver_facts.sql` line 35). No 上菜 / 下单 split.

- Excel source 商品销量报表 (Q1 §2.3) provides no individual order timestamps either — it's bill-level aggregate per period.
- Even 收入管理报表 (青花椒) is bill-grain not line-grain.

**Implementation options**:

| Option | Approach | Effort | Honesty |
|---|---|---|---|
| **B1 (DEFAULT)** | Emit `null` for M2 with `dataAvailability: "MISSING_ORDER_TIMESTAMP_SPLIT"` envelope marker | ~0.1pd | Honest |
| B2 | Add `order_time` + `serve_time` columns to `fact_pos_transaction` + accept loaders set them equal (= NULL prep time) until POS export provides them | ~0.3pd schema + ETL stub | Schema-future-proof, still 100% NULL data |
| B3 | Extend ETL: subscribe to POS-system order-event streams (where available) to populate dual timestamps. **No 14-chain source has this currently.** | ~7pd schema + ETL + ingestion + 1 partner integration | Massive scope — defer |

**Recommended default**: B1. Phase 2D could revisit B2/B3 if customer demand surfaces.

#### M3: 翻台率 (Table Turnover Rate)

**Conceptual definition**: Average # of distinct customer parties seated per table per operating day.

**Formula**:

```
table_turnover_per_day = COUNT(DISTINCT transaction_id) / table_count_per_store / operating_day_count
```

**Data gap level**: ⚠️ **PARTIAL** — needed inputs are split:
- ✅ `fact_pos_transaction` has `id` (1 row per bill) + `store_id` + `date` + optional `table_no` — bills per store-day derivable.
- ❌ `dim_store` schema (verified `2026_04_28_silver_dimensions.sql` line 46-57) **does NOT carry `table_count` or `seats`**. Without table count denominator, only "bills per store per day" is computable, not turnover.
- ⚠️ If `table_no` is consistently populated, `COUNT(DISTINCT table_no)` per store-day approximates table count — but Excel source data (商品销量报表) doesn't carry `table_no`. Only structured POS exports would.

**Implementation options**:

| Option | Approach | Effort | Honesty |
|---|---|---|---|
| **C1 (DEFAULT)** | Compute "bills per store per day" as **proxy metric** `bills_per_store_per_day` + return `null` for true M3 with marker `dataAvailability: "PROXY_AS_BILLS_PER_STORE"` | ~1pd | Useful semi-honest — labelled as proxy |
| C2 | Add `table_count INT` column to `dim_store` + manual back-fill per chain via factory_id config | ~1.5pd schema + 14-row data entry | Honest if back-fill accurate |
| C3 | Use `COUNT(DISTINCT table_no)` from `fact_pos_transaction` when `table_no IS NOT NULL` for that store-date — fall back to proxy bills metric otherwise | ~2pd | Conditional honesty — data-dependent |

**Recommended default**: C1 for shipping the 3-metric envelope; C2 as Phase 2D follow-up if Steve approves manual seat-count data entry.

### 1.4 Per-metric data readiness summary (Q4)

| Metric | Derivable today (existing schema + 14-chain data) | Recommended Default Path | Effort delta vs Q1 §4.4 Step 4 |
|---|---|---|---|
| M1 厨房工位利用率 | ❌ NO | A1 (emit null + marker) | +0pd (just envelope marker) |
| M2 备菜时间 | ❌ NO | B1 (emit null + marker) | +0pd |
| M3 翻台率 | ⚠️ PARTIAL (proxy possible) | C1 (proxy `bills_per_store_per_day` + true M3 null) | +1pd vs Q1 estimate |

**Q4 net Sub-A effort revision**: Q1 §4.4 estimate ~5pd → revised **~5-6pd** (add ~1pd for M3 proxy path + envelope `dataAvailability` markers). Acceptable.

### 1.5 ETL extension required to fully populate Q4 metrics

If Steve later wants restaurant Production endpoint to return **non-null** values for all 3 metrics, additional ETL work is needed beyond PR #316 ETL infra scope:

| Metric | New ETL work | Effort | Triggers schema migration? |
|---|---|---|---|
| M1 真值 | New `fact_kitchen_station_event` table + workstation timer event ingestion | ~5pd | YES (1 new table) |
| M2 真值 | Dual-timestamp `fact_pos_transaction` extension + POS partner integration for order-event stream | ~7pd | YES (alter table) |
| M3 真值 | `dim_store.table_count` column + manual seed (or POS-export `table_no` reliable path) | ~1.5pd | YES (alter table) |

**Total additional ETL effort if all 3 metrics filled**: ~13.5 person-days. NOT in Phase B Sub-A scope; defer per §6 dispatch boundary.

---

## 2. Q5 Decision Ratification — `/analysis/quality` for Restaurant Tenant

### 2.1 Steve directive (verbatim semantics)

Per Steve 2026-05-11 AskUserQuestion answer:

> Q5 = Option B (餐饮重定义). 餐饮 Quality = 食安事故率 / 投诉率 / 退菜率 / 损耗率.

This rejects Option A (factory mapping retained: defectRate → returnRate / reworkRate → wastageRate / FPY → customerSatRate per Q1 §3.2 partial-mapping suggestion) and adopts a richer 4-metric quality model tailored to restaurant ops.

### 2.2 4-metric redefinition (canonical)

| # | 工厂语义 | 餐饮重定义 (Option B) | Unit | Lower-is-better | Source schema status |
|---|---|---|---|---|---|
| N1 | Defect rate (DPM/PPM) | 食安事故率 (Food Safety Incident Rate) | incidents per period | Yes | ❌ NO TABLE |
| N2 | First-Pass Yield (FPY) | 投诉率 (Complaint Rate) | % of bills with complaints | Yes | ⚠️ PARTIAL via `restaurant_reviews.rating` |
| N3 | Rework rate | 退菜率 (Dish Return Rate) | % of items returned | Yes | ⚠️ PARTIAL — schema gap on fact_pos_item |
| N4 | Quality cost rate | 损耗率 (Wastage / Spoilage Rate) | % of ingredient cost lost | Yes | ✅ SCHEMA READY (data missing 14 chains) |

### 2.3 Per-metric data source mapping

#### N1: 食安事故率 (Food Safety Incident Rate)

**Conceptual definition**: # of confirmed food-safety incidents per 1000 orders or per operating-day.

**Formula**:

```
food_safety_incident_rate = food_safety_incidents / total_orders × 1000
```

**Data gap level**: ❌ **NO TABLE** — no `fact_food_safety_incident` or equivalent in Silver layer.

- 大众点评 评价下载 (青花椒 only) reviews contain free-text content; could keyword-match for safety incidents but high false-positive risk (e.g., "中毒" used metaphorically).
- 食安事故 are typically tracked via:
  - Customer complaint escalation log (no current schema)
  - Health-inspection reports (none in source data)
  - Internal incident reports (none)

**Implementation options**:

| Option | Approach | Effort | Honesty |
|---|---|---|---|
| **D1 (DEFAULT)** | Emit `null` for N1 with `dataAvailability: "MISSING_FOOD_SAFETY_INCIDENT_LOG"` | ~0.1pd | Honest |
| D2 | NLP keyword-extract from `restaurant_reviews.content` for safety-related keywords (变质 / 中毒 / 食物中毒 / 异物 / etc.) — emit weakly-typed estimate | ~3pd + LLM accuracy risk | High false-positive — misleading |
| D3 | New `fact_food_safety_incident` table + manual customer-data-entry workflow + ETL from Web-Admin | ~4pd schema + UI + ETL | Honest, but no source for back-fill |

**Recommended default**: D1. Surface as Q-DEC-3 in §4.

#### N2: 投诉率 (Complaint Rate)

**Conceptual definition**: % of customer interactions resulting in a complaint, derivable from review rating-based proxy.

**Formula**:

```
complaint_rate = COUNT(reviews WHERE rating < 3.0) / COUNT(reviews) × 100
                                                 -- or with content NLP for explicit complaints
```

**Data gap level**: ⚠️ **PARTIAL** — `restaurant_reviews` table exists per `20260408_restaurant_reviews.sql`:
- ✅ Schema has `rating NUMERIC(3,1)` + `content TEXT` per review
- ✅ Per-store, per-period queryable via factory_id + store_name + review_time
- ⚠️ **Data coverage**: Q1 §2.2 confirms only **青花椒** chain has 评价下载 source data. 13 of 14 chains have no review data. Result: `complaint_rate = NULL` for 13 chains.

**Implementation options**:

| Option | Approach | Effort | Honesty |
|---|---|---|---|
| **E1 (DEFAULT)** | Compute complaint_rate via `rating < 3.0` threshold for chains with `restaurant_reviews` rows; emit `null` with `dataAvailability: "NO_REVIEW_DATA_FOR_CHAIN"` for other 13 chains | ~1pd | Conditional honest — graceful degradation per chain |
| E2 | E1 + NLP content-keyword pass for chains with reviews (more sensitive complaint detection) | ~2pd + LLM | Better signal but adds Phase 2A Rule 4 LLM-non-determinism risk |
| E3 | Wait for cross-chain review ingestion (out of T6.6 scope; 大众点评 scrape rollout per task #N) | indefinite | Defer entirely |

**Recommended default**: E1. Phase 2D considers E2.

#### N3: 退菜率 (Dish Return Rate)

**Conceptual definition**: % of dish items that were returned / refused by customer.

**Formula**:

```
return_rate = SUM(return_qty) / SUM(sales_qty) × 100
              per (factory, period, optionally per product)
```

**Data gap level**: ⚠️ **SCHEMA GAP** — Excel source carries the data but Silver schema doesn't:
- ✅ Excel 商品销量报表 (Q1 §2.3) has **separate `销售数量` + `退货数量` columns** per row. 14 chains all have this.
- ❌ Silver `fact_pos_item` schema (verified `2026_04_29_silver_facts.sql` line 86-100) has only `qty NUMERIC(18,3)` + `amount` — **no return_qty / return_amount column** and no `is_return BOOLEAN` discriminator.
- ⚠️ ETL spec (PR #316) §1.5 doesn't currently account for return data — it inherits the schema as-is.

**Implementation options**:

| Option | Approach | Effort | Honesty |
|---|---|---|---|
| **F1 (RECOMMENDED — extends ETL scope)** | Extend `fact_pos_item` with `return_qty NUMERIC(18,3) DEFAULT 0` + `return_amount NUMERIC(18,2) DEFAULT 0` columns; ETL maps Excel 销售数量/退货数量 → 2 columns | ~1.5pd schema migration (additive, NULL-safe default) + ~1pd ETL loader update (in Sub-ETL-1c) | Honest, real data |
| F2 | Treat returns as negative-qty rows in same `fact_pos_item` (sentinel value approach) | ~1pd schema + ~1pd ETL convention | Compact but easy to mis-aggregate (forget WHERE qty > 0 in COUNT) |
| F3 | Emit `null` with `dataAvailability: "RETURN_QTY_NOT_INGESTED"` envelope marker | ~0.1pd | Wastes available Excel data |

**Recommended default**: **F1** — this is the *only* Q5 metric where the 14-chain source data exists today AND a schema change is cheap. Worth the ~2.5pd ETL extension to get a non-null metric for all 14 chains.

**ETL extension dispatch implication**: F1 requires extending PR #316 ETL infra scope (specifically Sub-ETL-1c CSV-to-fact-pos-item canonical mapping + a `V20260815_04__t6_6_etl_return_qty_columns.sql` migration). This is *additive* to the existing 8-batch breakdown, not a re-scope.

#### N4: 损耗率 (Wastage / Spoilage Rate)

**Conceptual definition**: Cost of wasted ingredients as % of total ingredient cost.

**Formula**:

```
wastage_rate = SUM(fact_restaurant_wastage.estimated_cost) /
               SUM(fact_restaurant_requisition.est_cost) × 100
               per (factory, period)
```

**Data gap level**: ⚠️ **SCHEMA READY, DATA MISSING** for 14 chains:
- ✅ `fact_restaurant_wastage` schema exists per `2026_04_24_silver_restaurant_ops.sql` line 109-142 (wastage_number / date / ingredient_id / wastage_type / quantity / estimated_cost / reason).
- ✅ `fact_restaurant_requisition` schema exists with `est_cost` for denominator.
- ❌ **0 rows for 14 chains** — Excel source (Q1 §2.3) lacks wastage column. Existing qhj demo seed (RES_3101_009) likely has rows but the 14 real chains will not.
- ⚠️ Same coverage problem as N1: the *infrastructure* is ready, but the *source data* doesn't exist.

**Implementation options**:

| Option | Approach | Effort | Honesty |
|---|---|---|---|
| **G1 (DEFAULT)** | Compute wastage_rate against `fact_restaurant_wastage`; for chains with 0 rows emit `null` with `dataAvailability: "WASTAGE_NOT_TRACKED"` marker | ~0.5pd | Honest — gracefully degrades per chain |
| G2 | Proxy: estimate wastage as `(SUM(requisition_cost) - SUM(sales_cost_of_goods)) / SUM(requisition_cost)` — "what came in vs what got sold cost-of-goods" | ~2pd + accuracy caveat | Risky — needs recipe BOM data (also empty for 14 chains) so falls back to N4=NULL |
| G3 | Push ingestion of wastage data to manual Web-Admin entry workflow (out of T6.6 scope) | indefinite | Defer entirely |

**Recommended default**: G1.

### 2.4 Per-metric data readiness summary (Q5)

| Metric | Derivable today (14 chains) | Recommended Default Path | Effort delta vs Q1 §4.4 Step 4 |
|---|---|---|---|
| N1 食安事故率 | ❌ NO | D1 (null + marker) | +0pd |
| N2 投诉率 | ⚠️ PARTIAL (青花椒 only) | E1 (rating-based for chains with reviews; null elsewhere) | +1pd |
| N3 退菜率 | ⚠️ ETL extension (cheap) | **F1** (extend `fact_pos_item` schema + Sub-ETL-1c map) | +2.5pd (1.5 schema + 1 ETL) |
| N4 损耗率 | ⚠️ SCHEMA READY but no data | G1 (compute per chain; null where 0 rows) | +0.5pd |

**Q5 net Sub-B effort revision**: Q1 §4.4 estimate ~5pd → revised **~9pd** (5 base + 4 markers/proxies/ETL extension). +4pd vs Q1. Worth it because F1 turns "100% null" into "real data for 14 chains".

### 2.5 ETL extension required to fully populate Q5 metrics

| Metric | New ETL work | Effort | In current §4 ETL spec? |
|---|---|---|---|
| N1 真值 | New `fact_food_safety_incident` table + manual Web-Admin entry workflow | ~4pd | No |
| N2 真值 across 14 chains | Cross-chain 大众点评 scrape ingestion (currently only 青花椒 manual) | indefinite | No |
| N3 真值 | `fact_pos_item` schema extension (add `return_qty` + `return_amount` columns) + Sub-ETL-1c canonical CSV → `fact_pos_item` writer needs `销售数量` + `退货数量` mapping (currently maps to single `qty`) | **~2.5pd — RECOMMENDED for Phase B inclusion** | Adjacent — extends PR #316 §1.5 |
| N4 真值 across 14 chains | Manual wastage workflow rollout (cretas_db.wastage_records → Silver) for restaurant tenants | ~3pd schema + UI + Silver ETL | No |

**Total additional ETL effort to fully populate Q5**: ~9.5pd worst case. **F1 alone at ~2.5pd is the single highest-ROI add** because it unblocks N3 for all 14 chains with cheap schema extension.

---

## 3. Polymorphic Endpoint Shape Design

### 3.1 Two design options

#### Option A: Single endpoint, tenant-typed response envelope (RECOMMENDED)

Same URL path `/api/mobile/{factoryId}/smart-bi/analysis/production` (and `/quality`) for both factory + restaurant tenants. The response body shape varies by tenant type, but the **envelope** (`{success, data, message}`) and the **dispatcher contract** (4-branch analysisType) stays identical.

Response shape, factory tenant (Q1 §1 unchanged):

```jsonc
{
  "success": true,
  "data": {
    "startDate": "2026-05-01",
    "endDate": "2026-05-31",
    "tenantType": "FACTORY",
    "metrics": [
      { "metricCode": "OEE",          "value": 78.4, "unit": "%", "trend": "UP", "alertLevel": "YELLOW" },
      { "metricCode": "AVAILABILITY", "value": 82.1, "unit": "%", "trend": "FLAT", "alertLevel": "YELLOW" },
      { "metricCode": "PERFORMANCE",  "value": 88.7, "unit": "%", "trend": "UP", "alertLevel": "GREEN" },
      { "metricCode": "QUALITY",      "value": 96.2, "unit": "%", "trend": "FLAT", "alertLevel": "GREEN" }
    ]
  },
  "message": "ok"
}
```

Response shape, restaurant tenant (per §1.2 + §1.3 markers):

```jsonc
{
  "success": true,
  "data": {
    "startDate": "2026-05-01",
    "endDate": "2026-05-31",
    "tenantType": "RESTAURANT",
    "metrics": [
      {
        "metricCode": "KITCHEN_STATION_UTILIZATION",
        "value": null,
        "unit": "%",
        "trend": null,
        "alertLevel": null,
        "dataAvailability": "MISSING_KITCHEN_STATION_DATA"
      },
      {
        "metricCode": "AVG_PREP_TIME",
        "value": null,
        "unit": "minutes",
        "trend": null,
        "alertLevel": null,
        "dataAvailability": "MISSING_ORDER_TIMESTAMP_SPLIT"
      },
      {
        "metricCode": "TABLE_TURNOVER_RATE",
        "value": null,
        "unit": "turns_per_day",
        "trend": null,
        "alertLevel": null,
        "dataAvailability": "PROXY_AS_BILLS_PER_STORE",
        "proxyMetric": {
          "metricCode": "BILLS_PER_STORE_PER_DAY",
          "value": 47.3,
          "unit": "bills_per_store_per_day",
          "trend": "UP",
          "alertLevel": "GREEN"
        }
      }
    ]
  },
  "message": "ok"
}
```

**Pros**:
- Single nginx route covers both tenant types — no cohort split needed.
- Single dispatcher logic — restaurant + factory go through same `getOEEOverview` / `getProductionEfficiency` etc. entry points, branching on `tenantType` early.
- Frontend can render generic "metrics" array with metric-code dispatch table per tenant.
- Phase 2A dict-eq parity gate inapplicable per Q1 §1 (Java stays mock for factory; Python is real DB for restaurant) — but envelope shape contract stable.

**Cons**:
- One endpoint with two response shapes is harder to document (OpenAPI / Swagger needs `oneOf` schema).
- Frontend must handle null metric values gracefully — but it would have to anyway for the Java mock side.

#### Option B: Separate endpoints — `/analysis/production` (factory) + `/analysis/restaurant-operations` (restaurant)

Two distinct URLs:
- `/api/mobile/{factoryId}/smart-bi/analysis/production` — factory tenants only; restaurant returns 410.
- `/api/mobile/{factoryId}/smart-bi/analysis/restaurant-operations` — new URL for restaurant.

Similarly for quality: `/analysis/quality` + `/analysis/restaurant-quality`.

**Pros**:
- Clean OpenAPI shape — each endpoint has 1 response schema.
- Different metric codes don't "leak" — factory consumers never see restaurant metric codes.

**Cons**:
- Doubles nginx routing entries (regex needs two paths instead of one).
- Doubles dispatcher logic — separate service classes per tenant type.
- Phase B impl effort goes from "1 endpoint with 2 branches" to "2 endpoints" — ~+2pd per endpoint pair × 2 pairs = ~+4pd Phase B.
- Tighter coupling between frontend tenant detection + URL selection. Tenant-type misclassification breaks the request, not just the body parsing.

### 3.2 Recommendation: Option A (single endpoint, tenant-typed envelope)

**Decision rationale**:

1. **Frontend complexity**: Frontend already does tenant-type detection on JWT (per CLAUDE.md JWT payload includes `factoryId`, and tenant_type is resolved via `dim_store` / config). Adding URL selection on top is redundant.

2. **Phase B effort**: Option A saves ~4pd over Option B. Phase B is already ~14-16pd post-§1.4/§2.4 revisions.

3. **dict-eq parity gate compatibility**: Per Q1 §1 final paragraph, Java stays mock + Python is real; dict-eq gate Java-vs-Python no longer applies for these endpoints post-cutover. **The "envelope shape parity" gate replaces it** — and Option A makes that envelope contract single and stable for both tenant types, simpler to test via Python-vs-Python regression goldens.

4. **Nginx route stability**: Phase C cutover (per Q1 + PR #196 §3.5) flips the SAME regex location for `/analysis/production|quality` to `cretas_python` upstream. Option A keeps that 1-flip semantics. Option B adds 2 new locations.

5. **CRM precedent**: cretas already has tenant-typed responses in other domains (e.g., `RestaurantV2` envelope vs `CrmOrder` envelope per memory `project_apr23_complete.md`). Same pattern applies cleanly here.

### 3.3 Per-metric envelope field contract (Option A canonical)

Each metric in the `metrics[]` array follows this contract:

| Field | Type | Required | Semantics |
|---|---|---|---|
| `metricCode` | string | Yes | UPPER_SNAKE_CASE canonical code (e.g., `OEE`, `KITCHEN_STATION_UTILIZATION`, `RETURN_RATE`) |
| `value` | number\|null | Yes | Numeric value or null if `dataAvailability` indicates unavailable |
| `unit` | string | Yes | `%` / `minutes` / `turns_per_day` / `bills_per_store_per_day` etc. |
| `trend` | "UP"\|"DOWN"\|"FLAT"\|null | Yes | Direction vs prior period; null if value null |
| `alertLevel` | "RED"\|"YELLOW"\|"GREEN"\|null | Yes | Threshold band; null if value null |
| `dataAvailability` | string\|null | No | Present **only** if value is null OR is a proxy/approximation. Documented values §3.4 |
| `proxyMetric` | object\|null | No | Present when `dataAvailability` indicates proxy-substitution; same envelope shape as parent |

### 3.4 `dataAvailability` controlled vocabulary

| Code | Meaning | Example |
|---|---|---|
| `OK` (or omit field) | Real data, no caveat | Standard case |
| `MISSING_KITCHEN_STATION_DATA` | M1 — schema lacks workstation tracking | Per §1.3 |
| `MISSING_ORDER_TIMESTAMP_SPLIT` | M2 — schema has only 1 time column | Per §1.3 |
| `PROXY_AS_BILLS_PER_STORE` | M3 — using `bills_per_store_per_day` because `dim_store.table_count` unset | Per §1.3 |
| `MISSING_FOOD_SAFETY_INCIDENT_LOG` | N1 — no incident table | Per §2.3 |
| `NO_REVIEW_DATA_FOR_CHAIN` | N2 — `restaurant_reviews` 0 rows for this factory_id | Per §2.3 |
| `RETURN_QTY_NOT_INGESTED` | N3 — if F1 (recommended) deferred and schema not extended | Per §2.3 |
| `WASTAGE_NOT_TRACKED` | N4 — `fact_restaurant_wastage` 0 rows for this factory_id | Per §2.3 |

Frontend renders chip badges per metric for non-OK availability (recommended UX per memory `project_apr20_permission_matrix_complete.md` Bug #370 — rich body + actionHint pattern).

### 3.5 Phase 2A Rule 8 / Rule 9 compliance

When Sub-A / Sub-B impl chats land, they MUST:

- **Rule 8** (Map.of(N) key order): if Python returns metrics via dict literals, record golden against Python output, then mirror exact dict literal order. The envelope `{metricCode, value, unit, trend, alertLevel, dataAvailability, proxyMetric}` ordering MUST be byte-stable across all 4 + 3 = 7 metric instances.
- **Rule 9** (Lombok null emit): the `MetricResult` Java DTO (per memory `Rule 9 3-pattern verify`) emits null fields explicitly. Python `_emit_with_nulls` per Phase 2A pattern.
- **Rule 11** (LocalDateTime microsecond): not directly applicable here (no datetime in metric envelope), but if `startDate` / `endDate` get serialized as `LocalDate` Java side, Python must use `date.isoformat()` (no microseconds).
- **Rule 12** (HALF_UP rounding): all percentage values (`%`-unit metrics) computed via `Decimal.quantize(Decimal("0.01"), ROUND_HALF_UP)` for parity with Java `BigDecimal.setScale(2, HALF_UP)` patterns.

These are Phase B impl reviewer-audit gates — flagged here so spec is self-contained.

---

## 4. Open Questions for Steve (Q-DEC-* series)

Steve sign-off needed on per-metric default path resolution **before Sub-A / Sub-B impl chats dispatch**. None of these are blocking ratification of the §1-§3 high-level decision — they fine-tune the data-gap implementation defaults.

| # | Question | Recommended default | Effort delta if alternative |
|---|---|---|---|
| **Q-DEC-1** | M1 厨房工位利用率 — emit null with marker (A1), synthesize proxy (A2), or extend ETL with new kitchen-station fact table (A3)? | **A1 (null + marker)** | A2: +1.5pd Phase B; A3: +5pd new ETL chat |
| **Q-DEC-2** | M2 备菜时间 — emit null (B1), schema-future-proof dual timestamp now (B2), or full POS integration (B3)? | **B1 (null + marker)** | B2: +0.3pd schema; B3: +7pd partner integration |
| **Q-DEC-3** | M3 翻台率 — proxy as bills-per-store (C1), manual `table_count` data entry (C2), or conditional table_no-based (C3)? | **C1 (proxy)** | C2: +1.5pd schema + 14-row data; C3: +2pd conditional logic |
| **Q-DEC-4** | N1 食安事故率 — emit null (D1), LLM keyword-extract from reviews (D2), or new incident table (D3)? | **D1 (null + marker)** | D2: +3pd LLM + accuracy risk; D3: +4pd new schema |
| **Q-DEC-5** | N2 投诉率 — rating-based per chain with reviews (E1), augment with NLP keyword (E2), or defer entirely (E3)? | **E1 (rating-based gradual)** | E2: +1pd NLP; E3: defer |
| **Q-DEC-6** | **N3 退菜率** — extend fact_pos_item schema (F1, RECOMMENDED) vs sentinel negative-qty (F2) vs ship null (F3)? | **F1 (extend schema + Sub-ETL-1c)** | F2: same effort but error-prone; F3: -2.5pd but wastes available Excel data |
| **Q-DEC-7** | N4 损耗率 — per-chain conditional (G1) vs derivation proxy (G2) vs defer (G3)? | **G1 (compute per chain; null where empty)** | G2: +2pd, accuracy weak; G3: defer |
| **Q-DEC-8** | Endpoint shape — tenant-typed envelope §3.1 Option A vs separate URLs §3.1 Option B? | **Option A (single endpoint, tenant-typed)** | Option B: +4pd Phase B + dual nginx route |
| **Q-DEC-9** | Should `dataAvailability=OK` be explicitly emitted, or omitted when truthy? | **Omit when OK** (only emit on caveat) | Saves ~2-3 bytes per metric × 14 chains × 30+ requests; aligns with Phase 2A Rule 9 (omit-when-null preferred when JsonInclude doesn't force emit) — verify with Sub-A golden |
| **Q-DEC-10** | `bills_per_store_per_day` proxy for M3 — return as nested `proxyMetric` (recommended §3.4) vs replace primary metric value? | **Nested `proxyMetric`** | Replace: simpler shape but loses the "this is a proxy" semantic flag |

**Minimum sign-off**: Q-DEC-6 (F1 vs F3 — affects ETL extension scope) and Q-DEC-8 (Option A vs B — affects nginx + dispatcher) before Sub-A / Sub-B chats are dispatched. Other defaults can flow through to impl without explicit sign-off.

---

## 5. ETL Backfill Dependencies

### 5.1 What's in PR #316 ETL infra scope

Per PR #316 ETL infra spec §0:

- Step 1 (Excel → canonical CSV): Sub-ETL-1a/b/c
- Step 2 (Silver/Gold loader): Sub-ETL-2a/b/c
- Step 3 (factory_id seed migration): Sub-ETL-3a/b

**Total**: ~6.5pd, 8 sub-batches.

### 5.2 What this Q4/Q5 spec adds on top (recommended defaults applied)

If Steve approves Q-DEC-6 = F1 (extend `fact_pos_item` for return_qty):

- **+1 migration**: `V20260815_04__t6_6_etl_return_qty_columns.sql` — ALTER TABLE fact_pos_item ADD COLUMN return_qty NUMERIC(18,3) DEFAULT 0, ADD COLUMN return_amount NUMERIC(18,2) DEFAULT 0; (~10 LOC)
- **+canonical column mapping** in `_lib/column_mapping.py` (Sub-ETL-1a deliverable): map `销售数量` → `qty`, `退货数量` → `return_qty`, `销售金额` → `amount`, `实退金额` → `return_amount`.
- **+UPSERT helper update** in `_lib/upsert_helpers.py` (Sub-ETL-2b deliverable): include new columns in INSERT statement.

**Net ETL extension**: ~2.5pd added to Sub-ETL-1a + Sub-ETL-1c + Sub-ETL-2c. Reasonable scope creep — surface as Q-DEC-6 sign-off, then organizer extends Sub-ETL-1c marching order to include return-qty mapping.

### 5.3 What this Q4/Q5 spec does NOT add (deferred)

The following are **explicitly out of scope** for the Q4/Q5 decision ratification spec:

- N1 食安事故率 — no new ETL ingestion. (D1 = null + marker.)
- N4 损耗率 — no new ETL for the 14 chains. (G1 = compute or null per chain.)
- M1 厨房工位利用率 — no new fact_kitchen_station_event ETL. (A1 = null + marker.)
- M2 备菜时间 — no schema change for dual-timestamp. (B1 = null + marker.)
- M3 翻台率 — no `dim_store.table_count` column. (C1 = proxy.)
- N2 投诉率 — no cross-chain review ingestion. (E1 = rating-based per existing data.)

If Steve later wants any of these filled with real data, separate marching orders dispatch ETL extension work post-Phase B. Estimated tail: ~13-15pd if all 6 deferred items eventually filled (per §1.5 + §2.5 totals).

### 5.4 ETL extension ROI matrix

| Extension | Effort | Coverage gained | Customer value |
|---|---|---|---|
| F1 (return_qty extension) | ~2.5pd | All 14 chains, real data | HIGH — N3 from 100% null to real numbers |
| B2 (dual timestamp prep) | ~0.3pd | 0 chains immediately, schema-future-proof | LOW — symbolic |
| C2 (table_count column) | ~1.5pd | All 14 chains via manual entry | MEDIUM — M3 from proxy to real |
| Wastage Web-Admin (G3 part) | ~3pd | Future chains as customers track | MEDIUM (long-tail) |
| Kitchen station event (A3) | ~5pd | 0 chains immediately, requires POS partner | LOW — speculative |

**F1 is the standout — single highest-ROI ETL extension.** Recommended for Phase B inclusion via Q-DEC-6.

---

## 6. Sub-A / Sub-B Downstream Impact (Phase B Impl Spec Input)

### 6.1 Sub-A impact (`/analysis/production` Python port)

Phase B Sub-A impl chat (per MO PR #249 §3 Sub-A) must consume this spec's decisions:

- **Output shape contract**: §3.1 Option A envelope (single endpoint, tenant-typed). Factory branch returns 4-metric OEE family; restaurant branch returns 3-metric §1.2 family.
- **Java method mirror**: 8 entry points per `ProductionAnalysisServiceImpl.java` (per audit PR #298 §1.4 line 76-326) ports as-is for factory tenant. Restaurant tenant: each method body branches to restaurant computation per §1.3.
- **Goldens recording**: Per Q1 §4.5, Java path stays mock (factory only); Python real-DB output is the new source of truth for restaurant. Sub-A records goldens at:
  - F999 (test factory, factory tenant) — 4 analysisType × 1 = 4 goldens (Java parity informational only)
  - F001 (default seed, factory tenant) — 4 goldens (Python regression)
  - `R_ILTEATRO_REAL` (pilot real-chain, restaurant tenant) — 4 goldens (Python new-shape regression with null/proxy data per §1.3 defaults)
- **Effort revision**: Q1 §4.4 ~5pd → revised ~5-6pd (per §1.4).
- **Dependencies on Sub-ETL-***: Sub-A needs Sub-ETL-3a + Sub-ETL-3b merged (factory_id seeded) + Sub-ETL-1c output (canonical CSVs) + Sub-ETL-2c output (Silver rows populated) before Python can return real data. Without those, restaurant tenant returns all-null payload (acceptable degradation).

### 6.2 Sub-B impact (`/analysis/quality` Python port)

Phase B Sub-B impl chat (per MO PR #249 §3 Sub-B) must consume:

- **Output shape contract**: §3.1 Option A envelope, restaurant branch returns 4-metric §2.2 family.
- **Java method mirror**: 7 entry points per `QualityAnalysisServiceImpl.java` (per audit PR #298 §1.4 line 77-322) ports as-is for factory tenant.
- **Goldens recording**: Same pattern as Sub-A — F999/F001 factory mock parity + `R_QINGHUAJIAO_REAL` (青花椒 — the only chain with review data) as pilot restaurant golden.
- **Effort revision**: Q1 §4.4 ~5pd → revised ~9pd (per §2.4) — significantly higher than Sub-A because Q-DEC-6 = F1 adds ETL extension scope.
- **Dependencies on Sub-ETL-***: Same as Sub-A plus the new `V20260815_04` migration if Q-DEC-6 = F1.
- **Special case 青花椒**: `R_QINGHUAJIAO_REAL` is the only chain with review data per Q1 §2.2. N2 (投诉率) golden has real value here; other 13 chains golden N2 = null. Sub-B should record at least 2 restaurant goldens (with-reviews + without-reviews) to cover both code paths.

### 6.3 Sub-F nginx routing impact

Per MO §3 Sub-F (organizer-owned post-cutover):

- §3.1 Option A keeps single nginx regex location for `/analysis/production|quality`.
- No additional Sub-F scope creep from this spec.
- 14 new factory_ids (R_*_REAL per Q1 §4.3) need adding to factory_id alternation regex per Q1 §10 default ("internal showcase only by default"). That's Q1 Q3 scope, not this spec.

### 6.4 Sub-C / Sub-D not impacted

`/query` (Sub-C) + `/drill-down` (Sub-D) endpoints are independent surfaces. No impact from Q4/Q5 redefine.

### 6.5 SmartBIDashboardController not impacted

Per Q1 §1: Java `ProductionAnalysisServiceImpl` + `QualityAnalysisServiceImpl` stay KEEP forever (Dashboard composite still binds). Dashboard receives factory-mock data, unchanged. This spec does NOT affect Dashboard endpoint behavior or composite injection.

---

## 7. Cross-references

| Doc | PR / Path | Relation |
|---|---|---|
| Q1 real-DB amendment | PR #223 / `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` §8 Q4 + Q5 | **Authoritative trigger** — this spec ratifies the PENDING Q4 + Q5 |
| T6.6 Phase B pre-flight audit | PR #298 / `docs/qa-audits/2026-05-11-t6-6-phase-b-pre-flight-blockers.md` §6.1 | **Recommended writing this doc** — "Resolve Q1 §8 Q4 + Q5" listed as first synchronous step |
| T6.6 ETL infra design | PR #316 / `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` §4 (Q4/Q5 boundary strict ETL infra scope) | **Strict boundary** — that spec says ETL infra is INDEPENDENT of Q4/Q5; this spec respects boundary, adds only Q-DEC-6 F1 extension (~2.5pd) into Sub-ETL-1c if Steve approves |
| T6.6 Phase A design | PR #196 / `docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md` §3.1 + §3.2 | Endpoint Java method inventory (8 + 7 methods); spec §6 outputs feeds into Sub-A/Sub-B plans |
| Production-port detail | PR #199 / `docs/superpowers/specs/2026-05-09-t6-6-production-port-detail.md` | Body voided by Q1; useful Java method-mirror reference for Sub-A factory branch |
| Quality-port detail | PR #203 / `docs/superpowers/specs/2026-05-09-t6-6-quality-port-detail.md` | Body voided by Q1; useful Java method-mirror reference for Sub-B factory branch |
| T6.6 Phase B execute MO | PR #249 / `docs/superpowers/dispatch/2026-08-15-t6-6-phase-b-execute-marching-order.md` | Sub-A/Sub-B/Sub-C/Sub-D dispatch protocol; this spec is pre-MO scope |
| Existing silver dimensions | `backend/python/smartbi/database/migrations/2026_04_28_silver_dimensions.sql` lines 46-57 | Confirms `dim_store` has NO `table_count` / `seats` column (M3 gap) |
| Existing silver facts | `backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql` lines 86-100 | Confirms `fact_pos_item` has NO `return_qty` (N3 gap) |
| Existing silver restaurant ops | `backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql` lines 109-142 | Confirms `fact_restaurant_wastage` schema READY (N4 ready, data missing) |
| Existing gold aggregations | `backend/python/smartbi/database/migrations/2026_05_05_gold_aggregations.sql` | `agg_daily` / `agg_product` / `agg_channel` covered; no `agg_quality_*` / `agg_production_*` yet |
| Existing reviews table | `backend/python/smartbi/database/migrations/20260408_restaurant_reviews.sql` lines 26-43 | `restaurant_reviews` schema with `rating NUMERIC(3,1)` — N2 base for E1 default |
| python-java-port.md Rule 8 / 9 / 11 / 12 | `.claude/rules/python-java-port.md` | Apply to Sub-A / Sub-B impl per §3.5 |
| Server operations migration runner | `.claude/rules/server-operations.md` § "Smartbi 数据库 schema 变更" | If Q-DEC-6 = F1, the V20260815_04 migration applies via `apply-smartbi-migrations.sh` per HARD RULE |
| Concurrent edit safety Rule 5b | `.claude/rules/concurrent-edit-safety.md` | Sub-A / Sub-B / Sub-ETL-* chats must use `git commit -- <paths>` only mode |
| HARD `active-E2E-replaces-passive-soak` | memory `feedback_active_e2e_replaces_passive_soak.md` | T6.6 Phase B kickoff gate per audit PR #298 §6.1 step 4 |
| HARD `pause-before-deploy-or-push` | memory `feedback_pause_before_deploy_or_push.md` | This spec push gate |
| HARD `dispatch-on-technical-readiness` | memory `feedback_dispatch_on_technical_readiness.md` | When all 10 Q-DEC-* defaults sign-off + ETL infra dispatched, Sub-A/Sub-B technically ready |

---

## 8. ⛔ HOLD Blocks

- ⛔ **This is a decision ratification spec only.** Zero code edits, zero migrations, zero DDL apply, zero deploys, zero nginx mutations.
- ⛔ **Steve sign-off required** on at minimum Q-DEC-6 (N3 F1 vs F3 — ETL extension scope) and Q-DEC-8 (Option A vs B — endpoint shape) before Sub-A / Sub-B chats dispatch.
- ⛔ **ETL infra scope** per PR #316 stays as-is **unless** Q-DEC-6 = F1, in which case organizer extends Sub-ETL-1c marching order to include return-qty column mapping (~2.5pd extension to existing 6.5pd ETL).
- ⛔ **Sub-A / Sub-B impl chats remain HOLD** per MO PR #249 §⛔ pre-flight (T6.5 Phase C close + active-E2E gate). This spec does NOT bypass that gate; it only fills in PENDING Q4 + Q5 so Sub-A/Sub-B can be impl-spec'd post-gate.
- ⛔ **ETL extension chats (if any)** require separate marching orders. This spec does NOT authorize ETL extension dispatch — it only documents per-metric data-gap resolution options.
- ⛔ **No Java side changes.** Java `ProductionAnalysisServiceImpl` / `QualityAnalysisServiceImpl` stay mock per Q1 §1 (Dashboard composite binds). This spec affects Python output only.
- ⛔ **STOP-and-ping organizer** before this spec's PR push per dispatch §⛔ HOLD final line + HARD `feedback_pause_before_deploy_or_push.md`.
- ⛔ **No customer-facing nginx routing** for new factory_ids — Q1 §8 Q3 default = internal showcase only. This spec does NOT change that.
- ⛔ **Phase 2A dict-eq parity gate**: per Q1 §1 final paragraph, dict-eq Java-vs-Python no longer applies post-cutover for these endpoints. Sub-A / Sub-B golden gate is **Python-vs-Python regression**, not Java-vs-Python parity.

---

## 9. Sign-off

Before Sub-A / Sub-B dispatch:

- [x] Steve — Q4 = Option B (餐饮重定义) directive recorded 2026-05-11 via AskUserQuestion ✅ (this spec encodes the decision per §1)
- [x] Steve — Q5 = Option B (餐饮重定义) directive recorded 2026-05-11 via AskUserQuestion ✅ (this spec encodes per §2)
- [ ] Steve — Q-DEC-6 decision (N3 F1 ETL extension vs F3 null) — recommended **F1**
- [ ] Steve — Q-DEC-8 decision (endpoint shape Option A vs B) — recommended **Option A**
- [ ] Steve — Q-DEC-1..5 + Q-DEC-7 + Q-DEC-9 + Q-DEC-10 defaults accepted (or per-item alternative chosen)
- [ ] Engineering organizer — effort revision +4 to +6pd Sub-A/Sub-B acknowledged (vs Q1 §4.4 ~10pd combined)
- [ ] PR #316 ETL infra chat author — ack scope extension if Q-DEC-6 = F1 (+2.5pd Sub-ETL-1c/1a/2b)
- [ ] Reviewer audit cycle per `feedback_subagent_driven_audit_pattern.md` — recommended 2-3 cycles on this spec before Phase B impl dispatch

Sign-off recorded in PR description when this spec merges main.

---

## 10. Predecessor Chain

- PR #178 — T6.5 Phase A retrospective audit (KEEP list); merged
- PR #180 — T6.6 main spec (`f999-python-migration`); merged
- PR #196 — T6.6 Phase A design; merged
- PR #199 — production-port detail; merged; body voided by Q1
- PR #203 — quality-port detail; merged; body voided by Q1
- PR #220 — cross-PR consistency audit; merged
- PR #223 — Q1 real-DB sign-off; merged; **§8 Q4 + Q5 PENDING — this spec resolves**
- PR #249 — T6.6 Phase B execute MO (DRAFT/HOLD); merged
- PR #298 — T6.6 Phase B pre-flight audit; merged; **§6.1 recommended this spec**
- PR #316 — T6.6 ETL infra design; merged; **§4 strict ETL boundary respected by this spec**

This spec is the **fourth in the T6.6 Phase B planning chain** (after #223 + #298 + #316). It unblocks Sub-A / Sub-B impl spec writing by ratifying the Q4 + Q5 PENDING decisions into committed source-of-truth form.

---

**End of T6.6 Q4 + Q5 Restaurant-Tenant Semantics — Decision Ratification Spec.**

*Author: chat4 (post-`/clear`, 2026-05-12). Worktree: `.worktrees/q4-q5-decision-spec`. Branch: `ops-q4-q5-decision-spec` rooted at `origin/main` HEAD `ab348cb7f8`.*
*Triggered by: organizer dispatch — "Q4/Q5 decision ratification spec (Option B 餐饮重定义)".*
*Predecessors: Q1 amendment PR #223 + Phase B pre-flight audit PR #298 + ETL infra spec PR #316.*
*Per HARD memories `feedback_pause_before_deploy_or_push.md` + `feedback_dispatch_on_technical_readiness.md`: STOP-and-ping organizer BEFORE push.*
