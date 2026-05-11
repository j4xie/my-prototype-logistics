# Restaurant N1-N4 Data Readiness — Prod Evidence (2026-05-12)

**Date**: 2026-05-12 04:46-04:48 UTC+8 (server 47)
**Author**: chat4 (prod-data-audit dispatch)
**Branch**: `chore/audit-doc-amend-with-prod-evidence`
**Status**: 🔴 **RED** — every restaurant tenant returns mostly-null envelopes today

Companion to [`2026-05-11-restaurant-data-readiness-audit.md`](./2026-05-11-restaurant-data-readiness-audit.md) (framework doc, PR #367 — still open at time of this run). That doc had `_TBD_` placeholders in §1.3 + §2.2 pending an SSH-side run. This doc captures the run + interpretation + dispatch impact.

---

## 0. TL;DR

I ran `validate-restaurant-data-quality.py` + `validate-factory-silver-schema.sql` against `smartbi_prod_db` + `cretas_prod_db` on 47. Findings:

1. **All 14 V20260511_02 R_\*_REAL catalog rows have ZERO ingested data** in prod. The seed populated `restaurant_chain_catalog` metadata but Sub-ETL-2c has not loaded any chain's POS / review / wastage data for these factory_ids. The catalog and the data layer are out of sync — the catalog says "we know about 14 chains" but the data layer says "we have rows for none of them".

2. **The 14 R_\*_REAL catalog rows are NOT in `cretas_prod_db.factories`** at all. They exist only in `smartbi_prod_db.restaurant_chain_catalog`. So even if Sub-ETL-2c loaded their data, the new `/analysis/quality` endpoint (PR #358, LIVE prod 8083) would route them through `_factory_quality_dispatch` (Phase 2D `NotImplementedError`) because `tenant.py:get_tenant_type` would return `FACTORY` (default for missing rows). This is the **tenant-registry split** chat1/chat2 flagged; PR #368 fixed tenant.py's column-name bug but the underlying registry split remains.

3. **The actual 19 RESTAURANT tenants in `cretas_prod_db.factories`** (the ones tenant.py CAN route to restaurant branch) have:
   - **N2 ready: 0/19** — `restaurant_reviews` table is empty across all tenants.
   - **N3 ready: 0/19** — no tenant has `return_qty > 0` rows in `fact_pos_item`, despite 3 tenants (`RES_3101_009`, `R_GML_DEMO`, `R_XMX_CHAIN`) having ≥141 POS item rows. Sub-ETL-2c hasn't populated `return_qty` from the canonical `qty_refund` source column.
   - **N4 ready: 2/19** — `F002` (13 wastage + 14 requisition rows) and `R_XMX_CHAIN` (4 + 8) only.
   - **Overall PARTIAL: 2** (F002, R_XMX_CHAIN with N4 only), **EMPTY: 17**.

4. **Factory tenant Silver schema is entirely missing** (10/10 tables MISSING — all 5 production + all 5 quality). Phase 2D needs both `V_factory_production_silver` + `V_factory_quality_silver` migrations before un-deferring the `_factory_*_dispatch` `NotImplementedError`.

5. **V20260511_03 column LIVE prod correctly** — `fact_pos_item.return_qty NUMERIC NULLABLE DEFAULT NULL` exists. The column is plumbed; the ETL into it is the gap.

**Bottom line for Steve**: opening the new `/analysis/quality` dashboard for any restaurant tenant today produces a wall of null markers. The two tenants showing PARTIAL (F002, R_XMX_CHAIN) get only N4 wastage-rate (denominator + numerator both populated). Nobody sees N2 (complaint) or N3 (return rate) values — the underlying data is missing or the ETL stopped before populating the right column.

---

## 1. Run metadata

| Item | Value |
|---|---|
| Restaurant audit script | `/tmp/validate-restaurant-data-quality.py` (SCP'd from PR #367 branch — `scripts/etl/` not yet on server) |
| Factory SQL audit | `/tmp/validate-factory-silver-schema.sql` |
| Restaurant DB | `smartbi_prod_db` on `localhost:5432` (server 47.100.235.168) |
| Factory tenant DB | `cretas_prod_db` |
| Python | 3.8.17 (`/www/wwwroot/cretas/code/backend/python/venv38`) |
| RLS context | `set_config('app.factory_id', $1, false)` per factory (session-scoped, because the audit connects via a fresh asyncpg conn, not the production pool) |
| Outputs on server | `/tmp/restaurant-data-audit-20260512-044601.json` (14 chains, 9.4KB), `/tmp/restaurant-data-audit-19tenants.json` (19 tenants, 12.5KB), `/tmp/factory-schema-audit.txt` (4.2KB) |
| Local snapshots | `/tmp/audit-14chains.json` + `/tmp/audit-19tenants.json` + `/tmp/factory-schema-audit.txt` (Steve's workstation) |
| Total runtime | ~3 seconds for restaurant audit, <1 second for SQL audit |

---

## 2. Restaurant audit — 14 V20260511_02 R_\*_REAL catalog rows

Run command (verbatim, post-SCP):

```bash
cd /www/wwwroot/cretas/code/backend/python
SMARTBI_PG_PASSWORD=$(grep '^SMARTBI_DB_PASSWORD=' /www/wwwroot/cretas/.env.prod | cut -d= -f2) \
./venv38/bin/python /tmp/validate-restaurant-data-quality.py --env prod \
    --output /tmp/restaurant-data-audit-20260512-044601.json
```

### 2.1 Per-chain matrix

| factory_id (catalog) | N1 | N2 (reviews) | N3 (returns) | N4 (wastage) | Overall |
|---|---|---|---|---|---|
| `R_ILTEATRO_REAL`       | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_SHANGMA_HG_REAL`     | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_JINCHUAN_HG_REAL`    | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_XIMAXIANG_REAL`      | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_YUJIUJING_REAL`      | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_YONGHE_REAL`         | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_XINBASHU_REAL`       | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_QINGHUAJIAO_REAL`    | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_DONGMENKOU_REAL`     | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_HONGDEJI_REAL`       | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_JINRINIUSHI_REAL`    | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_YOUZIYOUWEI_REAL`    | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_LINJIAYAN_REAL`      | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |
| `R_HUOGUO_GENERIC_REAL` | always_null_ok | EMPTY (0 rows) | EMPTY (0 rows) | EMPTY (0/0) | **EMPTY** |

Summary: **0 READY / 0 PARTIAL / 14 EMPTY / 0 SCHEMA_GAP**.

### 2.2 Interpretation

Every R_*_REAL row is purely catalog metadata (chain_name_zh / cuisine / source_root_path). The Sub-ETL-2c pipeline that maps canonical CSV → `fact_pos_item` + `fact_restaurant_wastage` etc. has not run for any of them. `R_QINGHUAJIAO_REAL` was the spec's pilot expected to have N2 READY via 大众点评 data — that data is also not yet ingested.

This isn't a script bug (the framework doc §1.4 a-priori expected outcome was wrong) and isn't an endpoint bug (PR #358 correctly returns the documented `NO_REVIEW_DATA_FOR_CHAIN` / `NO_POS_DATA_FOR_PERIOD` markers).

---

## 3. Restaurant audit — 19 actual RESTAURANT tenants in `cretas_prod_db.factories`

Per Steve's relay: `cretas_prod_db.factories` is the **tenant routing source of truth**. 19 RESTAURANT rows exist there, distinct from `smartbi_prod_db.restaurant_chain_catalog` (which has 14 REAL + likely DEMO/TEST rows). Ran the same audit with `--factories <19-id list>` override.

Run command:

```bash
SMARTBI_PG_PASSWORD=… ./venv38/bin/python /tmp/validate-restaurant-data-quality.py \
    --env prod \
    --factories 'F002,R001,RES_3101_001,…,R_YJJ_DEMO' \
    --output /tmp/restaurant-data-audit-19tenants.json
```

### 3.1 Per-tenant matrix

| factory_id (cretas_db) | type | N2 | N3 (rows / nonzero) | N4 (wastage / req) | Overall |
|---|---|---|---|---|---|
| `F002`            | RESTAURANT | EMPTY | EMPTY (0/0)    | **READY (13/14)** | **PARTIAL** |
| `R001`            | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `RES_3101_001`    | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `RES_3101_002`    | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `RES_3101_003`    | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `RES_3101_004`    | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `RES_3101_005`    | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `RES_3101_006`    | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `RES_3101_007`    | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `RES_3101_008`    | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `RES_3101_009`    | RESTAURANT | EMPTY | EMPTY (646946 / **0**) | EMPTY (6 / 0) | EMPTY |
| `RES_GML_001`     | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `R_GML_DEMO`      | RESTAURANT | EMPTY | EMPTY (16213 / **0**) | EMPTY (0/0)  | EMPTY |
| `R_XMX_CHAIN`     | RESTAURANT | EMPTY | EMPTY (141 / **0**)   | **READY (4/8)**   | **PARTIAL** |
| `R_XMX_FRESH`     | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `R_XMX_FRESH2`    | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `R_XMX_FRESH3`    | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `R_YHDJ_DEMO`     | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |
| `R_YJJ_DEMO`      | RESTAURANT | EMPTY | EMPTY (0/0)    | EMPTY (0/0)       | EMPTY |

Summary: **0 N2 READY / 0 N3 READY / 2 N4 READY / 2 PARTIAL / 17 EMPTY**.

### 3.2 The 3 tenants with POS rows but zero returns

Even where POS rows exist, **no return_qty is populated**:

| factory_id | fact_pos_item rows | total_qty (sales) | total_return_qty | return_qty IS NOT NULL AND > 0 |
|---|---|---|---|---|
| `F001` (FACTORY — not in this audit but populates the same table) | 646,946 | 625,160.30 | 0 | 0 rows |
| `RES_3101_009` (qhj demo seed) | 646,946 | 625,160.30 | 0 | 0 rows |
| `R_GML_DEMO`     | 16,213  | 3,171,267.85 | 0 | 0 rows |
| `R_XMX_CHAIN`    | 141     | 36,434.00    | 0 | 0 rows |

Note F001 + RES_3101_009 have identical 646,946 row counts and identical qty totals — strongly suggesting the qhj demo seed inserts under both factory_ids (or one table is a copy of the other).

**Implication**: PR #358's N3 path is byte-correct but the data layer is missing return values. `_query_dish_return_rate` returns `total_return_qty=0` → `_compute_rate_pct(0, total_sales_qty) = 0`. With `_decimal_to_number(Decimal("0"))` = `int(0)`, the metric serialization would emit `"value": 0` (real number, not null), which **WOULD** display as "0%" in the dashboard — misleading. Re-check this: actually `_build_dish_return_rate_metric` early-returns `_empty_dish_return_rate_metric()` only when `total_sales_qty == 0`. For RES_3101_009 / R_GML_DEMO / R_XMX_CHAIN, `total_sales_qty > 0` → goes through the rate-compute path → emits `"value": 0` with no marker. That's actually a documented Phase 2A dict-eq path (real `0%`), not a bug, but UX-wise it tells customers "your return rate is 0%" when the truth is "we haven't ingested your return data". A future iteration may want an additional marker `RETURN_QTY_ALL_ZERO_LIKELY_NOT_INGESTED` — out of scope here.

### 3.3 Where N4 is READY

| factory_id | wastage rows | requisition rows | total_wastage_cost | total_requisition_cost |
|---|---|---|---|---|
| `F002`        | 13 | 14 | (cost values not surfaced in summary) | … |
| `R_XMX_CHAIN` | 4  | 8  | … | … |

Both have non-zero on both sides, so `_build_wastage_rate_metric` returns the real `value` with no `dataAvailability` field. Customers opening F002 or R_XMX_CHAIN dashboards see a real N4 wastage rate. All other 17 tenants see `WASTAGE_NOT_TRACKED`.

---

## 4. Factory tenant Phase 2D prereq — Silver schema state

Run command:

```bash
sudo -u postgres psql -d smartbi_prod_db -f /tmp/validate-factory-silver-schema.sql
```

### 4.1 Section 1 — `/analysis/production` factory branch tables

| Table | Status |
|---|---|
| `dim_equipment`           | **MISSING** |
| `dim_production_line`     | **MISSING** |
| `fact_equipment_event`    | **MISSING** |
| `fact_production_batch`   | **MISSING** |
| `fact_quality_inspection` | **MISSING** |

### 4.2 Section 2 — `/analysis/quality` factory branch tables

| Table | Status |
|---|---|
| `fact_customer_complaint` | **MISSING** |
| `fact_disposal_record`    | **MISSING** |
| `fact_quality_defect`     | **MISSING** |
| `fact_quality_inspection` | **MISSING** (shared with production) |
| `fact_rework_record`      | **MISSING** |

### 4.3 Section 3 — Restaurant-side tables (expected EXISTS)

All 9 restaurant tables exist: `dim_ingredient`, `dim_product`, `dim_store`, `fact_pos_item`, `fact_pos_transaction`, `fact_restaurant_requisition`, `fact_restaurant_wastage`, `restaurant_chain_catalog`, `restaurant_reviews`. ✅

### 4.4 Section 4 — V20260511_03 column check

```
column_name | data_type | is_nullable | column_default
return_qty  | numeric   | YES         | NULL::numeric
```

✅ Column LIVE prod. Migration ran. The blocker is upstream ETL, not the column.

### 4.5 Section 5 — `restaurant_chain_catalog` REAL chains

```
source_kind | chain_count
REAL        | 14
```

✅ Seed complete. All 14 names + cuisines + source_root_paths confirmed (full table in JSON snapshot).

### 4.6 Section 6 — `cretas_prod_db.factories` tenant breakdown

(Run separately because table is in `cretas_prod_db`, not `smartbi_prod_db`.)

| type | count |
|---|---|
| FACTORY    | 56 |
| RESTAURANT | 19 |

The 19 RESTAURANT rows enumerated in §3.1. **No BRANCH rows** in this env, despite `tenant.py:TenantType.BRANCH` being part of the `is_restaurant_tenant` predicate. Sub-A spec §2.2 + Sub-B spec §2.2 allow for BRANCH as a future tenant type — none in use yet.

### 4.7 Phase 2D dispatch readiness — implication

**Both** factory-branch dispatches (`_factory_production_dispatch` PR #350 + `_factory_quality_dispatch` PR #354) are blocked on Silver-table existence. Phase 2D dispatch needs:

1. **`V<phase2d-date>_01__t6_6_factory_production_silver.sql`** — 5 tables (`dim_equipment`, `dim_production_line`, `fact_equipment_event`, `fact_production_batch`, `fact_quality_inspection`). chat-A1 fill-in chat picks up.
2. **`V<phase2d-date>_02__t6_6_factory_quality_silver.sql`** — 4 new tables (`fact_customer_complaint`, `fact_disposal_record`, `fact_quality_defect`, `fact_rework_record`) plus `fact_quality_inspection` shared with migration 01. chat-B1 fill-in chat picks up.
3. Both new schemas need RLS policies (mirroring existing restaurant tables — `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy on `app.factory_id`).
4. Sub-ETL-1 / Sub-ETL-2 extensions to feed the new tables from Java-side data sources (factory bronze tables `smart_bi_*`).

**Java callers stay zero-caller** until factory branch is real (PR #360 wired the methods but `SmartBIAnalysisController.getProductionAnalysis` + `getQualityAnalysis` still route to local `ProductionAnalysisService` / `QualityAnalysisService` Java mocks — see my PR #360 audit verdict).

---

## 5. Action items by stakeholder

### 5.1 For Steve

| # | Action | Why | Effort |
|---|---|---|---|
| S1 | Decide policy: keep R_*_REAL catalog metadata-only until Sub-ETL-2c can ingest, OR remove from V20260511_02 seed and re-seed when ingestion ships | Catalog says "we know about these" but data layer is empty — could mislead anyone reading the catalog as a source of truth | 10 min |
| S2 | Steer Sub-ETL-2c next step: which canonical CSV → which factory_id mapping? Currently no CSV ingestion has populated any R_*_REAL row. Re-confirm if 青花椒 review data exists locally and needs upload | Restaurant `/analysis/quality` only emits useful data once ETL runs | 30 min |
| S3 | Decide whether to surface a UI banner "your restaurant data is being prepared" when overall=EMPTY, since the 4-null-marker envelope is a poor UX | Customer perception fix | UX decision only |

### 5.2 For chat1 (Phase 2D factory Silver migration spec)

| # | Action | Reference |
|---|---|---|
| C1a | Spec V_factory_production_silver migration with the 5 missing tables (§4.1). Mirror restaurant-side RLS + trigger patterns from `2026_04_24_silver_restaurant_ops.sql`. | This doc §4.1 |
| C1b | Spec V_factory_quality_silver migration with the 4 net-new tables (§4.2; fact_quality_inspection shared with production). | This doc §4.2 |
| C1c | Coordinate column naming with Java-mock fields per Sub-A spec §2.3 + Sub-B spec §2.3 (already documented). | Sub-A/B impl specs |
| C1d | Confirm: after PR #368 tenant.py fix landed, are R_*_REAL factory_ids meant to be added to `cretas_prod_db.factories` so they CAN route to restaurant branch? Or is the catalog-only registry intentional? Currently they'd hit factory NotImplementedError. | §0 ¶2 split |

### 5.3 For chat2 (Phase 2C scope)

| # | Action | Reference |
|---|---|---|
| C2a | When deciding Phase 2C cutover scope, exclude factory branches for `/analysis/production` and `/analysis/quality` until Phase 2D Silver migrations ship — they will hard-fail. | This doc §4.7 |
| C2b | Java caller wiring (`callAnalysisProduction` / `callAnalysisQuality` in PR #360) stays zero-caller until Phase 2D. Phase 2C should NOT switch `SmartBIAnalysisController.getProductionAnalysis` to call Python yet. | PR #360 audit verdict + this doc §4.7 |
| C2c | For the 17 EMPTY / 2 PARTIAL restaurant tenants (§3.1), Phase 2C cutover is "safe but useless" — endpoint returns valid envelope, frontend sees null markers. Customer-facing rollout should wait on Sub-ETL-2c data ingestion. | This doc §3 |

### 5.4 For chat-AB-1 (real-data trigger)

Re-run `validate-restaurant-data-quality.py` after each Sub-ETL-2c ingestion cycle to confirm chains transition EMPTY → PARTIAL → READY. Cadence:

- **Day 0** (now, 2026-05-12): this doc captures baseline = 0 READY / 2 PARTIAL / 17 EMPTY.
- **Day 7** (~2026-05-19): expect at least 1 chain READY if Sub-ETL-2c shipped post-this audit.
- **Day 30** (~2026-06-11): full-coverage target. Anything still EMPTY past 30 days needs sales-team escalation.

---

## 6. Cross-references

| Ref | Purpose |
|---|---|
| [`2026-05-11-restaurant-data-readiness-audit.md`](./2026-05-11-restaurant-data-readiness-audit.md) | Framework doc (PR #367) — has TBD placeholders this doc replaces |
| [PR #358](https://github.com/j4xie/my-prototype-logistics/pull/358) | chat-B2 N1-N4 impl — endpoint this evidence targets |
| [PR #360](https://github.com/j4xie/my-prototype-logistics/pull/360) | Router wiring (Python include_router + Java client methods) |
| [PR #367](https://github.com/j4xie/my-prototype-logistics/pull/367) | Audit framework + scripts (still open at time of run) |
| [PR #368](https://github.com/j4xie/my-prototype-logistics/pull/368) | tenant.py P0 fix — `factory_id` → `id` column name (MERGED, base of this run) |
| [V20260511_02 seed](../../backend/python/smartbi/database/migrations/V20260511_02__t6_6_etl_seed_14_real_chains.sql) | 14 R_*_REAL catalog rows |
| [V20260511_03 migration](../../backend/python/smartbi/database/migrations/V20260511_03__fact_pos_item_add_return_qty.sql) | N3 column LIVE |
| [Sub-A impl spec](../superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md) | §2.3 factory production schema deps (now confirmed all MISSING) |
| [Sub-B impl spec](../superpowers/specs/2026-05-12-t6-6-sub-b-quality-impl-spec.md) | §2.3 factory quality schema deps (now confirmed all MISSING) |

---

## 7. Reproducibility

To re-run this audit after Sub-ETL-2c cycles:

```bash
# SCP scripts (they don't deploy with the standard pipeline — server doesn't sync scripts/etl/)
scp scripts/etl/validate-restaurant-data-quality.py \
    scripts/etl/validate-factory-silver-schema.sql \
    root@47.100.235.168:/tmp/

# Run restaurant audit against 14 catalog chains
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && \
    SMARTBI_PG_PASSWORD=\$(grep '^SMARTBI_DB_PASSWORD=' /www/wwwroot/cretas/.env.prod | cut -d= -f2) \
    ./venv38/bin/python /tmp/validate-restaurant-data-quality.py --env prod \
        --output /tmp/restaurant-data-audit-\$(date +%F).json"

# Run restaurant audit against 19 actual restaurant tenants
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && \
    SMARTBI_PG_PASSWORD=\$(grep '^SMARTBI_DB_PASSWORD=' /www/wwwroot/cretas/.env.prod | cut -d= -f2) \
    ./venv38/bin/python /tmp/validate-restaurant-data-quality.py --env prod \
        --factories 'F002,R001,RES_3101_001,RES_3101_002,RES_3101_003,RES_3101_004,RES_3101_005,RES_3101_006,RES_3101_007,RES_3101_008,RES_3101_009,RES_GML_001,R_GML_DEMO,R_XMX_CHAIN,R_XMX_FRESH,R_XMX_FRESH2,R_XMX_FRESH3,R_YHDJ_DEMO,R_YJJ_DEMO' \
        --output /tmp/restaurant-data-audit-19tenants-\$(date +%F).json"

# Factory schema audit
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -f /tmp/validate-factory-silver-schema.sql" \
    > /tmp/factory-schema-audit-$(date +%F).txt

# cretas_prod_db tenant breakdown
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_prod_db -c \
    \"SELECT type, COUNT(*) FROM factories GROUP BY type ORDER BY type;\""
```

Once PR #367 merges, the SCP step becomes a `git pull` on server since `scripts/etl/` would be in the repo. Until then, SCP is the workaround.

---

*End of evidence doc. Numbers are direct queries against `smartbi_prod_db` + `cretas_prod_db` at the time stamps in §1. Re-run after Sub-ETL-2c ingestion to track delta.*
