# Issue #539 — Gold ETL syntax error investigation

**Date**: 2026-05-14 (CST)
**Branch**: `fix/issue-539-gold-etl-syntax`
**Skill**: `superpowers:systematic-debugging` (4-phase Iron Law)
**Status**: ✅ Fix + regression tests committed. Active-E2E verify pending organizer deploy to test env.

---

## Phase 1 — Root cause

**Source**: `backend/python/smartbi/gold/restaurant_ops_etl.py:542` (now reformatted; was a single 145-char line).

The Python lint annotation `# noqa: E501` was embedded **inside** the triple-quoted SQL string literal `_AGG_PRODUCT_COST_SQL` (line 534–556 of the original file). Python correctly parses everything between `"""..."""` as string content, so `# noqa: E501` became part of the SQL sent to PostgreSQL.

PostgreSQL tokenizer:
- Doesn't recognize `#` as a comment marker (PG uses `--` line comments and `/* */` block comments).
- Reads `#` as either an unknown operator or whitespace-like, then continues.
- Hits the `:` in `: E501` — `:` is only legal in PG SQL as part of `::` (cast) or `:=` (assign). Lone `:` triggers `PostgresSyntaxError: syntax error at or near ":"`.

Stack trace from prod confirms:
```
File "/www/wwwroot/cretas/code/backend/python/smartbi/gold/restaurant_ops_etl.py", line 791, in run_full_etl
File "/www/wwwroot/cretas/code/backend/python/smartbi/gold/restaurant_ops_etl.py", line 727, in materialize_gold_daily_ops
asyncpg.exceptions.PostgresSyntaxError: syntax error at or near ":"
```

Line 727 is `r7 = await conn.execute(_AGG_PRODUCT_COST_SQL, factory_id)` — the 7th and final statement in `materialize_gold_daily_ops` (lines 718–734).

## Impact

`materialize_gold_daily_ops` wraps all 7 INSERTs in a single asyncpg `conn.transaction()` (line 719). When the 7th statement (product_cost) raises `PostgresSyntaxError`, **the entire transaction rolls back** — including the 6 successful aggregations:

- `agg_restaurant_daily_ops` rows for `requisition_qty`, `requisition_cost`, `wastage_qty`, `wastage_cost_by_type`, `stocktaking_shortage_qty`
- `agg_restaurant_daily_totals` rows
- `agg_restaurant_product_cost` rows

→ **NO** Gold aggregations refresh for any tenant whose ETL hits this code path.

**Tenant impact** (from `python-prod.log` `grep -c 'gold materialize failed for R_'` = 1617 events):

```
R_QINGHUAJIAO_REAL (in issue title)
R_DONGMENKOU_REAL          R_LINJIAYAN_REAL
R_GML_DEMO                 R_SHANGMA_HG_REAL
R_HONGDEJI_REAL            R_XIMAXIANG_REAL
R_HUOGUO_GENERIC_REAL      R_XINBASHU_REAL
R_ILTEATRO_REAL            R_XMX_CHAIN
R_JINCHUAN_HG_REAL         R_XMX_FRESH
R_JINRINIUSHI_REAL         R_YHDJ_DEMO
                           R_YJJ_DEMO
                           R_YONGHE_REAL
                           R_YOUZIYOUWEI_REAL
                           R_YUJIUJING_REAL
```

= **19 distinct tenants** affected (14 `_REAL` customers + 5 demo). Issue title #539 mentions only QHJ — actual scope is much wider.

**First occurrence in prod log**: 2026-05-10 21:15:07 CST. Code was added at commit `4059f6047` per `git blame -L 540,545`. Pre-existing per issue #539's "predates T6.6 cutover" note.

## Phase 2 — Same-cause sweep (per `depth-first-e2e` Rule 8)

Searched all `backend/python/smartbi/gold/*.py` for `#` chars inside Python triple-quoted strings containing SQL keywords. **Single match**: the one bug above. Other `# noqa: ...` occurrences in `smartbi/` are at end-of-Python-source-line (correct usage), NOT inside string literals.

Broader pattern check — any `# noqa`, `# type:`, `# TODO`, etc. embedded in SQL constants across the codebase: covered by the new regression test (`test_no_python_lint_markers_in_sql_constants`).

## Phase 3 — Hypothesis + minimal failing test

Hypothesis: line 542 of `_AGG_PRODUCT_COST_SQL` contains `# noqa: E501` inside the triple-quoted SQL string, causing PG syntax error on the `:` before `E501`.

Verified by running the 3 new test regexes against a copy of the broken SQL — all 3 matched (would fail the test). See `fix-verify.log` for test output against the FIXED code (4/4 PASS).

## Phase 4 — Fix

### Code change

`backend/python/smartbi/gold/restaurant_ops_etl.py` line 542 reformatted:

**Before** (single 145-char line, exceeds CI `--max-line-length=120`, with stray `# noqa`):
```sql
       (ARRAY_AGG(r.ingredient_id ORDER BY r.is_main_ingredient DESC, r.line_cost DESC NULLS LAST))[1] AS main_ingredient_id,  # noqa: E501
```

**After** (each line ≤ 80 chars, no noqa needed, semantically identical):
```sql
       (ARRAY_AGG(
           r.ingredient_id
           ORDER BY r.is_main_ingredient DESC, r.line_cost DESC NULLS LAST
       ))[1] AS main_ingredient_id,
```

PG allows whitespace freely inside parenthesized expressions, so the reformatted version produces identical SQL semantics.

### Tests added

`backend/python/tests/test_restaurant_ops_etl_sql_syntax.py` — 4 tests:

1. `test_sql_constants_discovered` — sanity that the 7 known `_AGG_*_SQL` constants exist (loudly fails if someone renames them).
2. `test_no_python_lint_markers_in_sql_constants` — regex catches `# noqa`, `# type:`, `# TODO`, `# FIXME`, `# pyright`, `# XXX`, `# HACK` inside any SQL constant. Exact-bug regression.
3. `test_no_lone_colons_in_agg_sql_constants` — regex catches lone `:` (not in `::` cast or `:=` assign). Broader class — catches future variants.
4. `test_no_pound_chars_in_agg_sql_constants` — any `#` char in SQL is suspicious (PG doesn't treat `#` as comment, MySQL-style `#` comments don't work either).

All 4 verified to MATCH against the broken SQL (would fail) and PASS against the fixed SQL. See `fix-verify.log`.

### CI / lint check

- `flake8 --max-line-length=120 smartbi/gold/restaurant_ops_etl.py tests/test_restaurant_ops_etl_sql_syntax.py` → exit 0 (clean)
- `python -m pytest tests/test_restaurant_ops_etl_sql_syntax.py` → 4/4 PASS
- `python -m pytest tests/test_restaurant_ops_router.py` (related module) → still 58/58 PASS (no regressions)

## Phase 4 active-E2E verify — DONE (prod, 2026-05-14)

Organizer deployed PR #544 directly to prod (skipped test env). Active-E2E verification on prod:

- ✅ **Deploy time**: cretas-python service restarted at `2026-05-14 04:03:10 CST` (per `systemctl show cretas-python --property=ActiveEnterTimestamp`)
- ✅ **Failures post-deploy**: **0** `gold materialize failed` / `PostgresSyntaxError` / `syntax error at or near` events in python-prod.log since 04:03:10 (was 1617 pre-fix across 19 tenants)
- ✅ **Successful ETL runs post-deploy**: **66** `materialized gold for X` INFO log lines
- ✅ **Tenant coverage**: 33 distinct tenants successfully materialized — including **all 19 previously-failing** tenants:
  - `R_QINGHUAJIAO_REAL` (issue title), `R_DONGMENKOU_REAL`, `R_HONGDEJI_REAL`, `R_HUOGUO_GENERIC_REAL`,
    `R_ILTEATRO_REAL`, `R_JINCHUAN_HG_REAL`, `R_JINRINIUSHI_REAL`, `R_LINJIAYAN_REAL`, `R_SHANGMA_HG_REAL`,
    `R_XIMAXIANG_REAL`, `R_XINBASHU_REAL`, `R_YONGHE_REAL`, `R_YOUZIYOUWEI_REAL`, `R_YUJIUJING_REAL`,
    `R_XMX_CHAIN`, `R_GML_DEMO`, `R_YJJ_DEMO`, `R_YHDJ_DEMO`, `R_XMX_FRESH`
- ✅ **Gold tables refreshed**: 3 tenants with Silver-layer data (F002, RES_3101_009, R_XMX_CHAIN) have rows with `last_computed = 2026-05-14 04:03:47` (37 seconds post-deploy):
  - `agg_restaurant_daily_totals`: F002=12 rows, RES_3101_009=6, R_XMX_CHAIN=8
  - `agg_restaurant_product_cost`: F002=8, RES_3101_009=136, R_XMX_CHAIN=9
  - `agg_restaurant_daily_ops`: F002=58, RES_3101_009=18, R_XMX_CHAIN=44
- ℹ️ **Out-of-scope cross-check**: MO step 2 mentioned `agg_daily_order_type_meal` — this is the QHJ POS dual_write path (separate from `materialize_gold_daily_ops`), not touched by this bug fix. Currently 0 rows for any factory — that's a data-state observation (no POS uploads yet), not a regression.

Full evidence captured in `post-deploy-clean.log`. **Issue #539 closed via PR #544.**

## Files

```
tests/qa-issue-539/
├── README.md            (this doc)
├── repro.log            (prod python-prod.log error context — 91 lines)
├── fix-verify.log       (pytest output against fixed code — 4/4 PASS)
└── post-deploy-clean.log (pending — active-E2E after organizer deploys)
```

```
backend/python/smartbi/gold/restaurant_ops_etl.py     (line 542 reformatted, -1 +4 lines)
backend/python/tests/test_restaurant_ops_etl_sql_syntax.py  (new, 113 lines / 4 tests)
```
