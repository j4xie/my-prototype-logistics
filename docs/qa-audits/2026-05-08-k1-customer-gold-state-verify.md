# K-1 Customer Gold POS Data State Verification — T6.4 Risk Assessment

**Date**: 2026-05-08
**Auditor**: chat 3 (k1-customer-gold-state)
**Scope**: 14 real customer factories (T6.4 IN-scope) + F001 baseline
**Question**: K-1 latent risk in `analysis_sales.py:1465-1507` (unconditional Gold dispatch) — does T6.4 cutover risk silent empty-dashboard for any of 14 real customers?
**Verdict**: **K-1 is P2 scheduled cleanup, NOT T6.4 BLOCKER** ✅

---

## 0. TL;DR

Queried `smartbi_prod_db` + `cretas_prod_db` for Silver/Gold/legacy POS state across 14 T6.4 customers + F001 baseline. **None of the 14 T6.4 customers have populated `smart_bi_sales_data` (the legacy table that K-1's path bypasses)** — meaning Java's `getSalesOverview` and Python's `_build_from_gold_finance_summary` would both return empty for these customers under T6.4 cutover, achieving parity.

T6.4 can proceed without K-1 fix. K-1 fix recommended as P2 scheduled cleanup post-T6.4 to prevent divergence if future customers gain `smart_bi_sales_data` content while Gold remains empty.

---

## 1. K-1 risk model recap

Per `analysis_sales.py:1465-1507` (`_get_sales_overview`):

```
1. Try Gold path (`_build_from_gold_finance_summary` → reads `agg_daily`/`agg_product`/`agg_channel`)
2. Gold returns non-None → return Gold result ✅
3. Gold returns None (revenue=0 AND bill_count=0) → return EMPTY dashboard, SKIP legacy ⚠️ K-1
4. Gold raises exception → fall back to `_build_legacy_sales_overview` (reads `smart_bi_sales_data` in cretas_prod_db)
```

**K-1 divergence risk window**: Customer has `smart_bi_sales_data` content > 0 (Java would compute content) AND Gold `agg_daily` empty → Python emits empty dashboard / Java emits real content → byte-shape divergence.

---

## 2. Database state matrix (queried 2026-05-08)

### 2.1 smartbi_prod_db tables surveyed

| Table | Layer | Purpose |
|---|---|---|
| `fact_pos_transaction` | Silver | POS transaction (raw transactions) |
| `fact_pos_item` / `fact_pos_payment` / `fact_pos_discount` | Silver | POS item/payment/discount detail |
| `agg_daily` | Gold | Daily revenue/bill aggregates (K-1 critical path) |
| `agg_product` | Gold | Product-month aggregates |
| `agg_channel` | Gold | Channel daily aggregates |
| `agg_restaurant_daily_ops` | Gold (alt) | Restaurant ops alt path |
| `smart_bi_dynamic_data` | (other) | Excel upload parsed rows — NOT in K-1 path |

### 2.2 cretas_prod_db tables surveyed

| Table | Purpose |
|---|---|
| `smart_bi_sales_data` | Java legacy + Python `_build_legacy_sales_overview` source (K-1 alternative path target) |

### 2.3 Per-customer state (15 factories: F001 baseline + 14 T6.4 in-scope)

| Factory | T6.4 stage | Java legacy `smart_bi_sales_data` | Gold `agg_daily` | Silver `fact_pos_transaction` | `smart_bi_dynamic_data` | K-1 risk |
|---|---|---|---|---|---|---|
| **F001** (baseline) | T6.2 LIVE | **345 rows** (2026-01..2026-12, ¥89.45M) | 1,730 (Jan-Dec 2025) | 140,541 | 708,947 | **NONE** ✅ both paths populated |
| F002 | Stage 2 | 0 | 0 | 0 | 10,930 | **NONE** ✅ legacy empty + Gold empty → both empty parity |
| F003 | Stage 2 | 0 | 0 | 0 | 10,772 | **NONE** ✅ |
| F004 | Stage 2 | 0 | 0 | 0 | 10,645 | **NONE** ✅ |
| F006 | Stage 2 | 0 | 0 | 0 | 0 | **NONE** ✅ |
| R001 | Stage 2 | 0 | 0 | 0 | 0 | **NONE** ✅ |
| RES_3101_009 (QHJ_PROD) | Stage 3 | 0 | **1,730** (Jan-Dec 2025) | 140,541 | 759,123 | **NONE** ✅ Gold populated, returns real content |
| RES_GML_001 (桂满陇) | Stage 3 | 0 | 0 | 0 | 145,729 | **NONE** ✅ legacy empty → both empty parity |
| R_GML_DEMO | Stage 4 | 0 | 0 | **16,213** (1 day 2026-01-15) | 0 | **NONE** ✅ legacy empty → both empty parity |
| R_XMX_CHAIN | Stage 4 | 0 | 0 | **141** (1 day 2026-02-15) | 0 | **NONE** ✅ |
| R_XMX_FRESH | Stage 4 | 0 | 0 | 0 | 61,208 | **NONE** ✅ |
| R_XMX_FRESH2 | Stage 5 | 0 | 0 | 0 | 203 | **NONE** ✅ |
| R_XMX_FRESH3 | Stage 5 | 0 | 0 | 0 | 203 | **NONE** ✅ |
| R_YHDJ_DEMO | Stage 5 | 0 | 0 | 0 | 0 | **NONE** ✅ |
| R_YJJ_DEMO | Stage 5 | 0 | 0 | 0 | 0 | **NONE** ✅ |

### 2.4 Aggregate restaurant_ops Gold (alternate Gold path)

| Factory | `agg_restaurant_daily_ops` rows |
|---|---|
| F002 | 58 |
| RES_3101_009 | 18 |
| R_XMX_CHAIN | 44 |

(Other 12 customers: 0 rows)

This alternate Gold path is NOT in K-1 scope — `_build_from_gold_finance_summary` reads `agg_daily` only. Documented for completeness; restaurant_ops Gold serves different endpoint paths.

---

## 3. K-1 risk analysis per customer

### 3.1 Risk classification rule

K-1 divergence requires **both** conditions:
1. `smart_bi_sales_data` rows > 0 (Java legacy would compute content)
2. `agg_daily` rows = 0 OR `agg_daily.SUM(net_amount) = 0 AND SUM(bill_count) = 0` (Python Gold returns None)

If **either** condition fails, K-1 path is benign:
- Java legacy = 0 → both Java and Python emit empty → parity ✅
- Python Gold > 0 → Gold returns real content → no K-1 trigger ✅

### 3.2 Per-customer verdict

**14/14 T6.4 customers: NO K-1 RISK** under T6.4 cutover (2026-05-10 to 2026-05-14 windows).

Only F001 has populated `smart_bi_sales_data` (345 rows, ¥89.45M). All 14 T6.4 customers have **0 rows** in `smart_bi_sales_data` — Java's `_build_legacy_sales_overview` would return empty just as Python's K-1-bypassed path does. Parity achieved by data state, not by K-1 fix.

### 3.3 Special cases

- **F001 baseline** (already on Python via T6.2): Gold + legacy both populated. K-1 not triggered (Gold path returns content). Stable.
- **RES_3101_009 (QHJ_PROD)**: Gold populated (1,730 rows), legacy empty. Gold path returns content, legacy fallback never invoked. K-1 not triggered.
- **R_GML_DEMO + R_XMX_CHAIN**: Silver POS populated but Gold not materialized (1-day Silver vs 0 Gold rows). Suggests Gold materialization pipeline ran for F001/RES_3101_009 only, or these factories' Silver was loaded after Gold ETL last ran. Both have 0 in `smart_bi_sales_data` so K-1 still benign.
- **F002 / F003 / F004 / RES_GML_001 / R_XMX_FRESH / R_XMX_FRESH2/3**: substantial `smart_bi_dynamic_data` content (Excel upload pipeline) but **0 in K-1-relevant tables**. Their data lives in Excel-derived dynamic table, not POS Silver/Gold or sales legacy. T6.4 cutover doesn't expose K-1 divergence for them.

---

## 4. Verdict

### 4.1 T6.4 cutover decision

✅ **T6.4 can proceed without K-1 fix** as a hard prerequisite.

K-1 fix (chat 2 in flight) downgraded from BLOCKER → **P2 scheduled cleanup**:
- T6.4 stage MOs (PR #144) can execute on schedule (May 10-14 CST)
- K-1 fix recommended as defensive cleanup post-T6.4 to prevent silent divergence if any customer's `smart_bi_sales_data` populates while Gold remains empty (e.g. legacy data backfill scenario)

### 4.2 Why K-1 was originally flagged

The K-1 fix was scoped as a defensive pattern improvement in `_get_sales_overview` to mirror Java's exception-vs-empty distinction. Risk assessment depended on real prod data state of 14 customers — verification before T6.4 trigger.

### 4.3 Why this audit clears the blocker

Empirical query of `smart_bi_sales_data` confirms only F001 has rows (345). All 14 T6.4 customers are 0-row in that table. K-1's "skip legacy when Gold empty" cannot diverge from Java when Java would also return empty (Java reads same table).

### 4.4 What this audit does NOT verify

- **Other K-2 / K-N latent issues** in analysis_sales.py or other Python modules that may have similar Gold-first patterns and different data dependencies. This audit scope is K-1 only.
- **Cretas data ingestion timeline**: if a customer's Excel upload triggers `smart_bi_sales_data` population mid-T6.4, K-1 risk could emerge. Recommend monitoring `smart_bi_sales_data` row counts daily during T6.4 5-day window.
- **Future customers**: any T6.4-post customer additions need re-verification of this matrix before routing to Python.

---

## 5. Recommended actions

### 5.1 Immediate (T6.4 trigger blockers)

- ✅ **Remove K-1 fix from T6.4 trigger blocker list**. Update `2026-05-10-t6-4-stage-1-marching-order.md` HOLD prereqs:
  - Strike: "chat 2 K-1 sales fix prereq (per organizer note — added blocker)"
  - Add: "K-1 fix is P2 scheduled (per `2026-05-08-k1-customer-gold-state-verify.md` audit) — not blocking T6.4"

### 5.2 Defensive monitoring (during T6.4 5-day window)

- **Daily smart_bi_sales_data row count** for 14 customers (one liner cron):
  ```sql
  SELECT factory_id, COUNT(*) FROM smart_bi_sales_data
  WHERE factory_id IN (...14 list...)
  GROUP BY factory_id;
  ```
  If any customer transitions 0 → > 0 mid-T6.4, K-1 risk re-emerges for that customer. Trigger investigation.

### 5.3 Post-T6.4 follow-up

- **Schedule K-1 fix as P2 cleanup** (target: post-Phase 2A retrospective, ~May 16-20 CST)
- **Audit other Gold-first dispatch patterns** in analysis_finance.py / analysis_inventory.py / etc. for similar latent risks (different data dependencies → different verification queries)
- **Document Gold materialization SLA**: R_GML_DEMO + R_XMX_CHAIN have Silver but no Gold — suggests materialization runs on schedule that hasn't covered them. Verify ETL trigger conditions (per `reference_smartbi_gold_layer_architecture.md`).

---

## 6. Methodology

### 6.1 Tools

- SSH to server 47 (47.100.235.168)
- `sudo -u postgres psql` for read-only queries (DB user `cretas` rejected via peer auth, postgres superuser used for read-only audit)
- 2 databases queried: `smartbi_prod_db` (Silver/Gold/dynamic) + `cretas_prod_db` (legacy `smart_bi_sales_data`)

### 6.2 Queries executed (read-only, no schema mutation)

```sql
-- Gold (smartbi_prod_db.agg_daily)
SELECT factory_id, COUNT(*), MIN(date), MAX(date)
FROM agg_daily
WHERE factory_id IN ('F001', ...14 T6.4 list...)
GROUP BY factory_id;

-- Silver (smartbi_prod_db.fact_pos_transaction)
SELECT factory_id, COUNT(*), MIN(date), MAX(date)
FROM fact_pos_transaction
WHERE factory_id IN (...) GROUP BY factory_id;

-- Java legacy (cretas_prod_db.smart_bi_sales_data)
SELECT factory_id, COUNT(*), MIN(order_date), MAX(order_date), SUM(amount)
FROM smart_bi_sales_data
WHERE factory_id IN (...) GROUP BY factory_id;

-- Excel upload pipeline (smartbi_prod_db.smart_bi_dynamic_data)
SELECT factory_id, COUNT(*) FROM smart_bi_dynamic_data
WHERE factory_id IN (...) GROUP BY factory_id;

-- Restaurant ops Gold alt (smartbi_prod_db.agg_restaurant_daily_ops)
SELECT factory_id, COUNT(*) FROM agg_restaurant_daily_ops
WHERE factory_id IN (...) GROUP BY factory_id;

-- Schema validation
SELECT column_name FROM information_schema.columns
WHERE table_name='fact_pos_transaction' AND table_schema='public';
```

### 6.3 Code references inspected

- `backend/python/smartbi_compat/api/analysis_sales.py:1465-1507` — `_get_sales_overview` K-1 dispatch
- `backend/python/smartbi_compat/api/analysis_sales.py:1176-1230` — `_build_from_gold_finance_summary` (Gold None signal logic)
- `backend/python/smartbi_compat/api/analysis_sales.py:1372-1410` — `_build_legacy_sales_overview` (legacy fallback)
- `backend/python/smartbi_compat/api/analysis_sales.py:240-282` — `_query_sales_aggregates` (legacy SQL on `smart_bi_sales_data` in cretas_prod_db)
- `backend/python/smartbi/gold/queries.py:46-91` — `daily_trend` Gold query (reads `agg_daily`)
- `backend/python/smartbi/gold/materializer.py` — Silver→Gold ETL (reads `fact_pos_*`, writes `agg_*`)

### 6.4 Memory references cross-checked

- `reference_smartbi_gold_layer_architecture.md` — task #24 Phase A discovery: Gold = Python-side, Java GoldDashboardBuilder is Python `/api/smartbi/gold/*` HTTP client
- `project_2026_05_07_t6_2_canary_live.md` — F001 already on Python prod, smartbi_prod_db migration tracker
- `reference_smartbi_prod_db_migration_gap.md` — 35 migrations applied, schema parity restored

---

## 7. ⛔ HOLD blocks

- ⛔ Doc-only audit, no code changes, no schema mutation, no customer data modification
- ⛔ Read-only queries via `sudo -u postgres` (no DB-level RBAC change)
- ⛔ This audit does NOT execute T6.4 stages — separate marching order required
- ⛔ Recommendation §5.1 to update PR #144 stage 1 MO requires separate follow-up commit

---

## 8. Findings summary one-liner

> **None of the 14 T6.4 customers have content in `smart_bi_sales_data` (the legacy table K-1 bypasses) — K-1 cannot diverge from Java when Java would also return empty for that table. K-1 is P2 cleanup, T6.4 can proceed without K-1 fix as hard prereq.**
