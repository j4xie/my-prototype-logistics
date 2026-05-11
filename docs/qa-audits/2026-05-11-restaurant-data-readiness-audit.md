# Restaurant N1-N4 Data Readiness Audit + Phase 2D Factory Silver Schema Prereq

**Date**: 2026-05-11
**Author**: chat4 (data-audit dispatch)
**Branch**: `feat/restaurant-data-quality-audit`
**Status**: ⚠️ AMBER — script + tests + framework ready; prod data run pending Steve's SSH-side execution

---

## 0. TL;DR

After PR #358 (N1-N4 restaurant `/analysis/quality` impl LIVE prod 8083) and PR #360 (router wiring), nobody has verified that the 14 real restaurant chains seeded by V20260511_02 actually have the source-table rows the new endpoint needs. If a customer opens the quality dashboard for a chain with zero rows, they see a wall of null markers (`MISSING_FOOD_SAFETY_INCIDENT_LOG` / `NO_REVIEW_DATA_FOR_CHAIN` / `NO_POS_DATA_FOR_PERIOD` / `WASTAGE_NOT_TRACKED`) instead of meaningful values.

This audit ships:

1. **`scripts/etl/validate-restaurant-data-quality.py`** — Python CLI that connects to smartbi_prod_db, sets RLS context per factory, and emits READY / EMPTY / MISSING_TABLE / SCHEMA_GAP verdicts per chain per metric (N2 / N3 / N4) + an overall verdict.
2. **`scripts/etl/validate-factory-silver-schema.sql`** — psql audit that enumerates which factory-tenant Silver tables exist (Phase 2D prereq for `_factory_quality_dispatch` + `_factory_production_dispatch` un-deferral).
3. **30 unit tests** locking the script contract (output shape / RLS context-setting / parametric binding / READY-EMPTY-SCHEMA_GAP aggregation).
4. **This doc** — framework + decision matrix + next-step grid for Steve and the organizer.

⛔ **HOLD blocks**:
- Sections §1.3 (per-chain readiness matrix) and §2.2 (factory schema state) **remain TBD** until the script runs against `smartbi_prod_db`. Run via SSH per §3.1 below; this doc gets filled in via a follow-up commit referencing the JSON output.
- Re-run cadence (Day-7 / Day-30) per §3.4 must be wired into the operations runbook; not in scope of this PR.

---

## 1. Restaurant 14-chain data readiness

### 1.1 Endpoint dependency map

| Metric | Q-DEC | Required tables/columns | Status if missing | Reference |
|---|---|---|---|---|
| **N1** FOOD_SAFETY_INCIDENT_RATE | Q-DEC-4 D1 | (none — always null) | `always_null_ok` | [PR #358](https://github.com/j4xie/my-prototype-logistics/pull/358) |
| **N2** COMPLAINT_RATE | Q-DEC-5 E1 | `restaurant_reviews` row + `rating < 3.0` count | `NO_REVIEW_DATA_FOR_CHAIN` | [Sub-B spec §3.2](../superpowers/specs/2026-05-12-t6-6-sub-b-quality-impl-spec.md) |
| **N3** DISH_RETURN_RATE | Q-DEC-6 F1 | `fact_pos_item.return_qty` (V20260511_03) + sales rows | `NO_POS_DATA_FOR_PERIOD` or `RETURN_QTY_NOT_INGESTED` | Sub-B spec §3.3 |
| **N4** WASTAGE_RATE | Q-DEC-7 G1 | `fact_restaurant_wastage` + `fact_restaurant_requisition` rows | `WASTAGE_NOT_TRACKED` | Sub-B spec §3.4 |

### 1.2 14 REAL chains (V20260511_02 seed)

| factory_id | chain_name_zh | cuisine | source |
|---|---|---|---|
| `R_ILTEATRO_REAL` | IL TEATRO 西餐 | Western | 商品销量报表 2 月 |
| `R_SHANGMA_HG_REAL` | 上马火锅 | HotPot | 商品销量报表 2 月 |
| `R_JINCHUAN_HG_REAL` | 锦川火锅 | HotPot | 5-月系列 |
| `R_XIMAXIANG_REAL` | 唏嘛香 牛肉面 | Noodles | 销量报表 2 月 |
| `R_YUJIUJING_REAL` | 御九井 日料 | Japanese | 商品销量报表 2 月 |
| `R_YONGHE_REAL` | 永和豆浆 | FastFood | 商品销量报表 2 月 |
| `R_XINBASHU_REAL` | 鑫巴蜀 | Sichuan | 5-月系列 |
| `R_QINGHUAJIAO_REAL` | 青花椒 | Sichuan | + 25年; distinct from RES_3101_009 demo |
| `R_DONGMENKOU_REAL` | 东门口 | Local | CSV + 25年 |
| `R_HONGDEJI_REAL` | 鸿德记 | (none) | 5-月系列 |
| `R_JINRINIUSHI_REAL` | 今日牛事 | Beef | 5-月系列 |
| `R_YOUZIYOUWEI_REAL` | 有滋有味 | (none) | 5-月系列 |
| `R_LINJIAYAN_REAL` | 邻家宴 | (none) | 5-月系列 |
| `R_HUOGUO_GENERIC_REAL` | 火锅 (generic) | HotPot | 利润表 2 月 |

### 1.3 ⏳ Per-chain readiness matrix (PENDING prod-run)

To fill: run §3.1 and paste the JSON output's `factories[].overall` column here.

| factory_id | N1 | N2 (reviews) | N3 (returns) | N4 (wastage) | Overall | Notes |
|---|---|---|---|---|---|---|
| `R_ILTEATRO_REAL`       | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `R_SHANGMA_HG_REAL`     | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `R_JINCHUAN_HG_REAL`    | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | 5-month series — expect higher row counts |
| `R_XIMAXIANG_REAL`      | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `R_YUJIUJING_REAL`      | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `R_YONGHE_REAL`         | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `R_XINBASHU_REAL`       | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | 5-month series |
| `R_QINGHUAJIAO_REAL`    | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | **N2 expected READY** — has 大众点评 review data per Sub-B spec §3.7 |
| `R_DONGMENKOU_REAL`     | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | CSV + 25年 |
| `R_HONGDEJI_REAL`       | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | 5-month series |
| `R_JINRINIUSHI_REAL`    | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | 5-month series |
| `R_YOUZIYOUWEI_REAL`    | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | 5-month series |
| `R_LINJIAYAN_REAL`      | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | 5-month series |
| `R_HUOGUO_GENERIC_REAL` | always_null_ok | _TBD_ | _TBD_ | _TBD_ | _TBD_ | 利润表 only — may have no POS items, expect N3 EMPTY |

### 1.4 Expected outcomes (a-priori reasoning before prod run)

Based on Sub-B spec assumptions, the audit *should* report the following pattern. Deviations indicate either a Sub-ETL-2c ingestion bug, a migration drift, or a chain-specific data peculiarity worth flagging.

| Pattern | Expected verdict | Reason |
|---|---|---|
| All 14 chains have N3 = READY | per Q-DEC-6 F1 spec | Sub-ETL-2c canonical CSV → `fact_pos_item` should populate every chain |
| Only `R_QINGHUAJIAO_REAL` has N2 = READY | per Sub-B spec §3.7 | Only chain with downloaded review data |
| All 14 chains have N4 = EMPTY (`WASTAGE_NOT_TRACKED`) | per Q-DEC-7 G1 spec | Excel source has no wastage column for REAL chains |
| Demo `RES_3101_009` (qhj demo seed) may have N4 = READY | per 2026_04_25_qhj_demo_seed_v5.sql | Synthetic seed includes wastage rows |
| Overall **PARTIAL** for ~13 chains, **READY** for `R_QINGHUAJIAO_REAL`, **EMPTY** for `R_HUOGUO_GENERIC_REAL` (利润表 only) | composite of above | Used to validate Sub-B impl assumptions |

⚠️ Any **SCHEMA_GAP** verdict (MISSING_TABLE) is a P0 — it means Sub-ETL-2c didn't ship the schema this code depends on, or V20260511_03 wasn't applied to prod.

---

## 2. Factory tenant Phase 2D prereq

The Python factory branches of `/analysis/production` (chat-A1 PR #350) and `/analysis/quality` (chat-B1 PR #354) are currently `raise NotImplementedError` per the Option B decision. Phase 2D un-defers them once the Silver-layer tables exist.

### 2.1 Required Silver tables (per spec §2.3)

**Production endpoint**: `fact_production_batch`, `fact_equipment_event`, `fact_quality_inspection`, `dim_equipment`, `dim_production_line`.

**Quality endpoint**: `fact_quality_inspection`, `fact_quality_defect`, `fact_rework_record`, `fact_disposal_record`, `fact_customer_complaint`.

**Overlap**: `fact_quality_inspection` appears in both — one migration covers it.

### 2.2 ⏳ Schema state (PENDING psql-run)

To fill: run §3.2 and paste the `EXISTS / MISSING` rows here.

| Endpoint | Table | Status | Phase 2D dispatch impact |
|---|---|---|---|
| production | `fact_production_batch`       | _TBD_ | Blocks chat-A1 (Phase 2D fill-in) |
| production | `fact_equipment_event`        | _TBD_ | Blocks chat-A1 |
| production | `fact_quality_inspection`     | _TBD_ | Shared with quality |
| production | `dim_equipment`               | _TBD_ | Blocks chat-A1 |
| production | `dim_production_line`         | _TBD_ | Blocks chat-A1 |
| quality | `fact_quality_inspection`        | _TBD_ | Shared with production |
| quality | `fact_quality_defect`            | _TBD_ | Blocks chat-B1 (Phase 2D fill-in) |
| quality | `fact_rework_record`             | _TBD_ | Blocks chat-B1 |
| quality | `fact_disposal_record`           | _TBD_ | Blocks chat-B1 |
| quality | `fact_customer_complaint`        | _TBD_ | Blocks chat-B1 |

### 2.3 Phase 2D dispatch matrix (a-priori)

Expected initial state per Sub-A spec §2.3 fallback note: **all factory Silver tables MISSING**. Phase 2D therefore requires a new migration:

- `V<phase2d-date>_01__t6_6_factory_production_silver.sql` — Sub-A1 chat picks up
- `V<phase2d-date>_02__t6_6_factory_quality_silver.sql` — Sub-B1 chat picks up
- Then Sub-A1 / Sub-B1 unblock `_factory_*_dispatch` real impl (Java 1:1 mock mirror per spec §2.1)

If §2.2 above unexpectedly shows some tables EXIST, the migration scope narrows to the missing subset.

---

## 3. Next steps

### 3.1 Run restaurant audit against prod (Steve / organizer)

SSH to server 47 and run with prod credentials:

```bash
ssh root@47.100.235.168
cd /www/wwwroot/cretas/code
source backend/python/venv38/bin/activate

# Pull SMARTBI_DB_PASSWORD from the canonical env file
export SMARTBI_PG_PASSWORD=$(grep '^SMARTBI_DB_PASSWORD=' /www/wwwroot/cretas/.env.prod | cut -d= -f2)
export SMARTBI_PG_HOST=localhost
export SMARTBI_PG_USER=smartbi_user

mkdir -p reports
python scripts/etl/validate-restaurant-data-quality.py \
    --env prod \
    --output reports/restaurant-data-quality-prod-$(date +%F).json \
    --markdown reports/restaurant-data-quality-prod-$(date +%F).md

cat reports/restaurant-data-quality-prod-$(date +%F).md
```

Then commit the resulting JSON + MD to `docs/qa-audits/evidence/` (or attach to a follow-up PR amending §1.3 + §2.2 of this doc).

**Expected run time**: ~3 seconds (14 factories × 4 single-row aggregate queries each).

### 3.2 Run factory schema audit against prod

```bash
ssh root@47.100.235.168
export PGPASSWORD=$(grep '^SMARTBI_DB_PASSWORD=' /www/wwwroot/cretas/.env.prod | cut -d= -f2)
psql -h localhost -U smartbi_user -d smartbi_prod_db \
    -f /www/wwwroot/cretas/code/scripts/etl/validate-factory-silver-schema.sql \
    > /tmp/factory-silver-audit-$(date +%F).txt
cat /tmp/factory-silver-audit-$(date +%F).txt
```

### 3.3 Steve-decision tree from §1.3 outcome

| §1.3 verdict | Steve action |
|---|---|
| **Chain shows N3 = EMPTY** | Verify Sub-ETL-2c canonical CSV → `fact_pos_item` ingestion. If row_count = 0, re-run Sub-ETL-2c for this chain (see PR #357 organizer thread). |
| **Chain shows N3 = MISSING_TABLE with `return_qty` missing** | V20260511_03 was not applied to prod. STOP and ping migration runner team (`apply-smartbi-migrations.sh --env prod`). |
| **Multiple chains show N2 = READY** | Unexpected — only `R_QINGHUAJIAO_REAL` should have review data. Investigate which chains had 大众点评 uploads outside the spec window. |
| **`R_QINGHUAJIAO_REAL` shows N2 = EMPTY** | Review data not yet ingested. Steve uploads from local cache (大众点评 评价下载 dataset). |
| **Any chain shows N4 = READY** | Unexpected — REAL chains should not have wastage rows. Likely the chain has a demo-seed shadow row; investigate. |

### 3.4 Reprobe cadence (organizer)

Add to the operations runbook:

- **Day 7** (~2026-05-18): re-run §3.1 to capture data delta after first week of customer uploads. Diff against this run's JSON to identify newly-ingested chains.
- **Day 30** (~2026-06-10): re-run §3.1 to confirm steady-state coverage. Anything still EMPTY past 30 days needs a sales-team escalation (customer not uploading data).

### 3.5 Phase 2D dispatch trigger (organizer)

Once §2.2 confirms factory Silver tables MISSING (expected) and the Phase 2D scoping organizer thread spins up, dispatch:

| Chat | Scope | Inputs |
|---|---|---|
| Sub-A1 fill-in | Replace `_factory_production_dispatch` `NotImplementedError` with real impl | §2.2 schema verdict + new V_factory_production_silver migration |
| Sub-B1 fill-in | Replace `_factory_quality_dispatch` `NotImplementedError` with real impl | §2.2 schema verdict + new V_factory_quality_silver migration |
| Sub-AB (shared) | Java caller wiring once branches return real data | Existing `callAnalysisProduction` / `callAnalysisQuality` (PR #360) are zero-caller until this trigger |

---

## 4. Acceptance evidence

### 4.1 Test results

```
backend/python/tests/test_validate_restaurant_data_quality.py — 30/30 PASS in 0.43s

Coverage:
- DSN resolution (4 tests): prod / test default DB, override, invalid env
- N2 audit (3 tests): missing-table, empty, ready paths
- N3 audit (4 tests): missing-table, missing-column, ready, empty
- N4 audit (4 tests): missing-wastage, missing-requisition, empty, ready
- Overall aggregation (4 tests): SCHEMA_GAP / READY / PARTIAL / EMPTY
- Orchestrator (1 test): exception capture per factory
- Output rendering (2 tests): JSON summary, Markdown report
- CLI parser (3 tests): defaults, full args, invalid env
- SQL parametric binding (3 tests): factory_id via $1, set_config parametric, Rule 6 None-check
- Multi-factory orchestration (1 test): sequential per-factory RLS-context invocation
```

### 4.2 Local dry-run (no smartbi_db available)

The script handled the missing local DB gracefully:

```
$ python scripts/etl/validate-restaurant-data-quality.py --env local --output /tmp/test-audit.json
2026-05-11 16:15:00 INFO Connecting (env=local db=smartbi_db factories=14)
2026-05-11 16:15:00 ERROR connect failed: connection was closed in the middle of operation
$ echo $?
3
```

Exit code 3 (connect failure) is documented in the CLI contract. No partial output, no silent zero-result trap.

### 4.3 Prod evidence — TBD

Pending §3.1 execution by Steve / organizer with prod credentials.

---

## 5. Rule compliance

- **python-java-port.md Rule 1**: All `int(row["x"]) if row["x"] is not None else 0` patterns are explicit. No Python `or` falsy hazards on Decimal / int.
- **python-java-port.md Rule 6**: `_set_factory_context(conn, None)` raises `ValueError` rather than silently `SET app.factory_id = NULL` (which would silently zero out all RLS-filtered queries).
- **CREDENTIAL-MANAGEMENT.md**: Password read from `SMARTBI_PG_PASSWORD` env var, never hardcoded. CLI examples reference `/www/wwwroot/cretas/.env.prod` as the canonical source.
- **concurrent-edit-safety.md §5b**: This PR uses `safe-commit.sh` with explicit paths — 4 files only, no scope creep.
- **server-operations.md §"Smartbi 数据库 schema 变更"**: This PR does NOT add any migration. Read-only audit script + read-only psql audit.

---

## 6. Refs

- [PR #358 — Restaurant N1-N4 impl](https://github.com/j4xie/my-prototype-logistics/pull/358) — endpoint code this audit targets
- [PR #360 — Router wiring](https://github.com/j4xie/my-prototype-logistics/pull/360) — Python `include_router` for the endpoint
- [PR #354 — Quality skeleton + vocab tuple](https://github.com/j4xie/my-prototype-logistics/pull/354)
- [V20260511_02 seed](../../backend/python/smartbi/database/migrations/V20260511_02__t6_6_etl_seed_14_real_chains.sql) — 14 REAL chains
- [V20260511_03 migration](../../backend/python/smartbi/database/migrations/V20260511_03__fact_pos_item_add_return_qty.sql) — N3 column
- [Sub-B spec §3](../superpowers/specs/2026-05-12-t6-6-sub-b-quality-impl-spec.md) — endpoint contract this audit verifies prereqs for
- [Q-DEC ratification (PR #344)](https://github.com/j4xie/my-prototype-logistics/pull/344) — Q-DEC-4/5/6/7 defaults

---

*End of audit. Updates to §1.3 + §2.2 land via follow-up PR after Steve runs §3.1 / §3.2 against prod.*
