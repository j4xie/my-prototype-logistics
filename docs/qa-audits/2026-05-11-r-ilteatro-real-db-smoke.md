# R_ILTEATRO_REAL Real-DB Smoke — Sub-ETL-2 Loader Gate #3

**Date**: 2026-05-11
**Gate**: T6.6 Phase B Sub-ETL-2 Gate #3 (real-DB smoke)
**Target**: R_ILTEATRO_REAL (IL TEATRO 西餐) — `smartbi_db` test env on server 47
**Source**: PR #338 (Sub-ETL-2 redispatch — `scripts/etl/import_restaurant_chain.py` + `scripts/etl/_lib/upsert_helpers.py`)
**Verdict**: **RED — loader has 2 P1 bugs that block any DB write; smoke NOT executed end-to-end**

---

## 1. Excel source

- **File**: `smartbi维度分析/大众点评/真实餐饮连锁数据/xlsx_converted/IL TEATRO（西餐厅）2月_商品销量报表.xlsx`
- **Size**: 59,309 bytes (xlsx_converted form; raw `.xls` is 202,752 bytes)
- **Rows**: 525 (sheet `Sheet1`, 17 columns)
- **Header**: `店铺名称, 商品分类, 营收组别, 商品编码, 商品名称, 规格, 商品类型, 点单方式, 单卖数量(不含套餐子商品), 退货数量(含套餐子商品), 单位, 销售单价, 销售金额, 折后价, 摊派优惠, 实退金额, 实收` (the source has **17 cols** vs canonical 19; `revenue_group` and `product_code` are absent → mapped to None)
- **Note**: source Excel exposes `单卖数量` (qty_single) but NOT `数量(含套餐子商品)` (qty_total), so canonical `qty_total` is empty for every row.

## 2. Sub-ETL-1 normalizer (✓ PASS)

```
python scripts/etl/normalize_restaurant_chains.py \
  --source-root /tmp/iltheatro-src \
  --output-root /tmp/iltheatro-canonical \
  --quarantine-root /tmp/iltheatro-quarantine \
  --index-path /tmp/iltheatro-canonical/_index.json
```

- **Exit**: 1 (fail-loud per Q-ETL-6 because 1 quarantine event), but normalizer **functionally succeeded**.
- **Canonical CSV**: `data/imports/restaurant-chains/R_ILTEATRO_REAL/product_sales/IL TEATRO（西餐厅）2月_商品销量报表.csv`
- **Canonical row count**: **523** (after dropping 1 quarantined trailing total-row that had empty `product_name`)
- **Quarantine**: 1 event, line 525, `EMPTY_REQUIRED_FIELD product_name`, looks like a legit Excel totals row — acceptable.
- **SHA-256**: `eac21fb0095e095197722fdb13355b22df0f89eea4f29ddcf3e1592c97ce8fb1`
- **Chain detection**: `R_ILTEATRO_REAL` matched via `match_chain_for_path` (hint `IL TEATRO`).
- **Report type detection**: `product_sales` (PR #331 modular split working as expected).

Sample canonical rows (first 2):
```
IL TEATRO,Open,,,打包盒,,餐饮商品,单品,1795.0,,0.0,,份,2.0,3590.0,3560.0,72.93,0.0,3487.07
IL TEATRO,Pizza披萨,,,黑松露披萨 Truffle,,餐饮商品,单品,1786.0,,0.0,,份,158.0,282218.0,282123.2,2870.29,0.0,279252.91
```

Verdict: **Sub-ETL-1 normalizer is healthy.**

## 3. Sub-ETL-2 loader (✗ FAIL — 2 P1 bugs)

### Setup

- SSH tunnel: `ssh -fN -L 15432:127.0.0.1:5432 root@47.100.235.168`
- DSN: `postgresql://smartbi_user:smartbi_secure_password_2025@127.0.0.1:15432/smartbi_db`
- Baseline counts (before run): `dim_store=0, dim_product=0, fact_pos_transaction=0, fact_pos_item=0, agg_restaurant_daily_totals=0` for `factory_id='R_ILTEATRO_REAL'`.
- Schema verified present: `dim_store, dim_product, fact_pos_transaction, fact_pos_item, agg_restaurant_daily_totals, dim_ingredient, fact_restaurant_requisition, restaurant_chain_catalog` all exist; `R_ILTEATRO_REAL` seeded into `restaurant_chain_catalog` (chain_name_zh = `IL TEATRO 西餐`).

### P1 Bug #1 — `set_factory_scope` uses `SET app.factory_id = $1` which PostgreSQL rejects

**Location**: `scripts/etl/_lib/upsert_helpers.py:94` and `:118`

```python
await conn.execute("SET app.factory_id = $1", factory_id)
```

**Error** (verbatim, from first loader run):

```
asyncpg.exceptions.PostgresSyntaxError: syntax error at or near "$1"
```

**Root cause**: PostgreSQL `SET` is parser-level — it does **not** accept bind parameters. The standard workaround (used elsewhere in this codebase) is `SELECT set_config('app.factory_id', $1, false)` — see `backend/python/smartbi/services/llm_answer_cache.py:80,147,190` for 3 working precedents.

**Impact**: **Loader fails on first call**, before any row is processed. No DB writes attempted; outer txn never begins.

**Suggested fix**:
```python
# upsert_helpers.py:94 + :118
await conn.execute(
    "SELECT set_config('app.factory_id', $1, false)", factory_id
)
```

(`false` for transaction-LOCAL = false → session-LOCAL, which matches the original `SET` intent; if `SET LOCAL` was intended, use `true` and ensure the call is inside a txn — `import_chain` already opens an outer txn at line 538 before calling `set_factory_scope` at line 540, so `true` is correct.)

### P1 Bug #2 — Gold refresh SQL has ambiguous `$1` parameter type

**Location**: `scripts/etl/_lib/upsert_helpers.py:594-613` (`REFRESH_AGG_RESTAURANT_DAILY_TOTALS_SQL`)

```sql
INSERT INTO agg_restaurant_daily_totals (factory_id, date, ...)
SELECT $1, date::DATE, ...
  FROM fact_restaurant_requisition
 WHERE factory_id = $1
   AND date BETWEEN $2 AND $3
GROUP BY date::DATE
ON CONFLICT (factory_id, date) DO UPDATE ...
```

**Error** (from patched loader run that worked around Bug #1):

```
asyncpg.exceptions.AmbiguousParameterError: inconsistent types deduced for parameter $1
DETAIL: text versus character varying
```

**Root cause**: `$1` is used in both the SELECT list (target column `factory_id` is `varchar`) and the WHERE clause (`factory_id` column is `varchar`). asyncpg deduces conflicting types from Python `str` → either `text` or `varchar`. PostgreSQL needs explicit cast.

**Suggested fix**:
```sql
SELECT $1::text, date::DATE, ...
  FROM fact_restaurant_requisition
 WHERE factory_id = $1::text
   AND date BETWEEN $2 AND $3
```

**Impact**: Even after Bug #1 is fixed, Gold refresh step fails → outer txn aborts → Silver rows never commit (per Q-ETL-6 fail-loud + outer-txn rollback contract in `import_chain` exception handler at line 588).

### Workaround attempt outcome

After monkey-patching `set_factory_scope` to use `set_config()` (Bug #1 workaround), the loader:
- Successfully processed all 523 rows through Silver UPSERT helpers (`upsert_dim_store`, `upsert_dim_product`, `upsert_fact_pos_transaction`, `replace_fact_pos_items`) within an asyncpg transaction.
- Hit Bug #2 at the Gold refresh step → entire outer txn rolled back per `except Exception` handler → **no DB rows persisted**.

This confirms the Silver UPSERT helpers themselves are functionally correct (no schema mismatches, no column drift, no NULL constraint violations on the 523-row IL TEATRO dataset); the loader is blocked **solely** by the two SQL bugs above.

## 4. Idempotency check — NOT EXECUTED

Cannot test until Bug #1 + Bug #2 are fixed.

## 5. Quality sample — NOT EXECUTED

Cannot sample DB rows because no rows were committed.

## 6. DB state verification (post-test)

```
sudo -u postgres psql -d smartbi_db -tc "
SELECT 'dim_store', COUNT(*) FROM dim_store WHERE factory_id='R_ILTEATRO_REAL'
UNION ALL SELECT 'dim_product', COUNT(*) FROM dim_product WHERE factory_id='R_ILTEATRO_REAL'
UNION ALL SELECT 'fact_pos_transaction', COUNT(*) FROM fact_pos_transaction WHERE factory_id='R_ILTEATRO_REAL'
UNION ALL SELECT 'fact_pos_item', COUNT(*) FROM fact_pos_item WHERE factory_id='R_ILTEATRO_REAL'"
```

All four counts: **0** (unchanged from baseline). Confirms outer-txn rollback worked as designed.

## 7. Issues found

| ID | Severity | Location | Description |
|----|----------|----------|-------------|
| L1 | P1 | `_lib/upsert_helpers.py:94, :118` | `SET app.factory_id = $1` rejected by PostgreSQL parser. Fix: `SELECT set_config('app.factory_id', $1, false)` (3 working precedents in codebase). |
| L2 | P1 | `_lib/upsert_helpers.py:594-613` REFRESH_AGG_RESTAURANT_DAILY_TOTALS_SQL | `$1` ambiguous parameter type (text vs varchar). Fix: explicit `$1::text` cast in SELECT list and WHERE clause. |
| L3 | P3 | `_lib/column_mapping.py` PRODUCT_SALES mapping | Source Excel exposes `单卖数量` (qty_single) but NOT `数量(含套餐子商品)` (qty_total); resulting `fact_pos_transaction.item_count` is NULL for every row when source lacks qty_total. May or may not be intended — confirm with downstream Gold consumers. |
| L4 | P3 | Schema gap (operational) | `dim_factory` table referenced in `import_chain` docstring (line 19 reference list) does not exist in `smartbi_db`. The actual seed table is `restaurant_chain_catalog`. Either docstring is stale or `dim_factory` is a Phase 2C+ deliverable. |

## 8. Verdict

**RED** — Sub-ETL-2 loader cannot complete a real-DB smoke against `R_ILTEATRO_REAL` in current shipped form (PR #338). Two independent P1 SQL bugs prevent any write from persisting.

Both bugs are localized to `scripts/etl/_lib/upsert_helpers.py` (4 lines of SQL across 2 helpers). Both have well-known idiomatic fixes (precedent: `llm_answer_cache.py` for L1; standard PostgreSQL cast syntax for L2). Estimated fix: ~30 minutes including added unit tests for `set_factory_scope` against a real PG (the existing test suite likely uses a mock that does not exercise the SQL prepare phase).

**Recommended follow-up**:
1. Open follow-up PR fixing L1 + L2 (single commit, ~6 SQL lines + 1 unit test).
2. Re-run this smoke once PR merges → expected GREEN with 523 Silver rows + Gold daily totals refreshed.
3. Optionally clarify L3 (qty_single vs qty_total) and L4 (dim_factory vs restaurant_chain_catalog docstring drift) in same PR.

## 9. Evidence reproducibility

- Canonical CSV: `D:/Temp/iltheatro-canonical/R_ILTEATRO_REAL/product_sales/IL TEATRO（西餐厅）2月_商品销量报表.csv` (523 rows, sha256 `eac21fb...`)
- Tunnel: `ssh -fN -L 15432:127.0.0.1:5432 root@47.100.235.168`
- Repro loader L1 bug: `python scripts/etl/import_restaurant_chain.py --factory-id R_ILTEATRO_REAL --source-dir D:/Temp/iltheatro-canonical/R_ILTEATRO_REAL --db-dsn "postgresql://smartbi_user:smartbi_secure_password_2025@127.0.0.1:15432/smartbi_db"`
- Repro L2 bug: same command after monkey-patching `set_factory_scope` to `set_config()` form.
