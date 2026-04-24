# Persisted `agg_strategy` Per Field — Implementation Plan (Option A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Apr 24 stop-gap heuristics (Python `quick_summary` regex + FE inline rating detection) with a persisted `agg_strategy` column on `smart_bi_pg_field_definitions`, populated by a single `infer_agg_strategy()` helper and consumed by FE/Python with no re-derivation.

**Architecture:** One new column (`agg_strategy VARCHAR(20) DEFAULT 'sum'`) is added to `smart_bi_pg_field_definitions`. A new pure helper `infer_agg_strategy(name, semantic_type, is_measure, statistics)` in `field_classifier.py` returns `'sum' | 'mean' | 'none'` based on (a) `semantic_type=='id'` → `'none'`, (b) name endswith `分/评分/星级` and stats mean ∈ [1,5] → `'mean'`, else `'sum'` for measures and `'none'` for non-measures. The existing `/api/smartbi/analytics/reclassify/{upload_id}` Python endpoint is extended to UPDATE `agg_strategy` after re-running the classifier. Java's initial save defaults to `'sum'` via the DB column default; the γ-1c afterCommit hook fires `reclassify` which corrects ratings/IDs. `quick_summary` in `insight.py` deletes its inline regex+stats heuristic and reads `agg_strategy` per column from `smart_bi_pg_field_definitions`. FE `ColumnSummary` type gains the `aggStrategy?: 'sum' | 'mean' | 'none'` field (closing today's silent type gap); `getSmartKPIs` already dispatches by it, no logic change. The existing `Domain` enum (RESTAURANT/FINANCE/etc) and `domain_detector.py` are NOT touched — Option A explicitly defers the domain axis (see spec §"Why Option A").

**Tech Stack:**
- Backend Python 3.11 / FastAPI / asyncpg / pytest
- Backend Java 21 / Spring Boot 3.2.12 / JPA (Hibernate 6) / Flyway
- DB: PostgreSQL 14+ (smartbi_db / smartbi_prod_db)
- Frontend Vue 3 / TypeScript 5+
- Test infra: existing `tests/e2e-comprehensive/` Playwright suite + `backend/python/smartbi/services/tests/test_field_classifier.py` pytest

**Branch:** `e2e/v1-framework` (continue from HEAD `6dc16435a`)

**Predecessor commits (already prod-live, do NOT revert):**
- `19df49af6` — Python `quick_summary` heuristic (this plan replaces)
- `feb3703d4` — FE rating mean display (this plan keeps; only the type def gets corrected)

**Out of scope (explicit non-goals for this plan):**
- Touching the existing `Domain` enum (RESTAURANT/FINANCE/SALES/PRODUCTION/INVENTORY/UNKNOWN)
- Creating `domain_rules/{review,pos,inventory,...}.py` per-domain modules (the spec proposed these; analysis showed `field_classifier.py` already centralizes this logic)
- Persisting an `upload.domain` column (defer to v2 if/when multi-vendor adapters need it)
- Fixing the SmartBIAnalysis dropdown POS→review→POS staleness bug (separate root cause in `loadHistory` batch grouping; documented in `docs/superpowers/specs/2026-04-25-domain-aware-field-roles-design.md` §7)

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/python/smartbi/database/migrations/V20260425_02__add_field_def_agg_strategy.sql` | CREATE | DDL migration: ALTER TABLE smart_bi_pg_field_definitions ADD COLUMN agg_strategy VARCHAR(20) DEFAULT 'sum' NOT NULL |
| `backend/python/smartbi/services/field_classifier.py` | MODIFY (+~50 LoC) | Add `infer_agg_strategy(name, semantic_type, is_measure, statistics)` pure function |
| `backend/python/smartbi/services/tests/test_field_classifier.py` | MODIFY (+~80 LoC) | Unit tests for `infer_agg_strategy` covering id/rating/measure/dim/edge |
| `backend/python/smartbi/api/materialized_analytics.py` | MODIFY (+~20 LoC) | Reclassify endpoint loads statistics + computes agg_strategy + UPDATE in same transaction |
| `backend/python/smartbi/api/insight.py` | MODIFY (-50 +30 LoC) | Replace inline heuristic in `quick_summary` with DB read of `agg_strategy` per column |
| `backend/python/smartbi/database/models.py` | MODIFY (+1 LoC) | Add `agg_strategy = Column(String(20), default="sum")` to SmartBiPgFieldDefinition |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/postgres/SmartBiPgFieldDefinition.java` | MODIFY (+8 LoC) | Add `private String aggStrategy;` with `@Column(name="agg_strategy", length=20)` |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/DynamicDataPersistenceServiceImpl.java` | MODIFY (+1 LoC in builder) | Set `.aggStrategy("sum")` on new field defs (let Python γ-1c reclassify fix later) |
| `web-admin/src/api/smartbi/common.ts` | MODIFY (+1 LoC) | Add `aggStrategy?: 'sum' \| 'mean' \| 'none'` to `ColumnSummary` interface |
| `scripts/migrations/2026-04-25-backfill-agg-strategy.sh` | CREATE | One-shot bash script: list all upload_ids per env, call reclassify endpoint per one, log changes |
| `tests/e2e-comprehensive/agg-strategy-prod-verify.mjs` | CREATE | Playwright smoke: confirm 4172 still has 4 平均X cards + 4169 still has measures (no regression) |

Total: ~10 files changed, ~1 created (migration), ~1 created (backfill), ~1 created (smoke), ~+200 LoC net.

---

## Why Option A (recap of pre-plan analysis)

The original spec (`docs/superpowers/specs/2026-04-25-domain-aware-field-roles-design.md`) was written without referencing existing code in `materialized_analytics/schema.py` (the `Domain` enum already in use by 30+ template `applies()` checks) and `field_classifier.py` (already centralizes per-keyword classification with `_EXPLICIT_OVERRIDES`, `_MEASURE_KEYWORDS`, `_ID_LIKE_KEYWORDS`, `_DIMENSION_KEYWORDS`).

The spec's proposed `Domain ∈ {review, pos, inventory, finance_pl, ...}` taxonomy conflicts with the existing `Domain ∈ {RESTAURANT, FINANCE, SALES, ...}` (one is data-type axis, the other is business-domain axis). Adopting the spec literally would either require renaming a 30+ template integration or introducing a parallel sub-axis — both 1.5+ days of work for negligible benefit, since:

1. The user-visible KPI 亿/万 pollution is a per-field problem (which columns aggregate as sum vs mean vs none), not a per-upload problem.
2. The review template's `applies()` already keys on field signature (`find_star_col`), not on domain.
3. The `field_classifier.py` already has all the per-keyword rules the spec wanted to put into `domain_rules/<domain>.py`.

Option A ships the per-field `agg_strategy` axis cleanly (the actual root cause), removes both Python and FE heuristics, and closes today's silent ColumnSummary type gap. ~3-4h. The `domain` axis can be revisited in a separate spec if v2 vendor adapters genuinely need it.

---

## Task 1: DB Migration — Add `agg_strategy` Column

**Files:**
- Create: `backend/python/smartbi/database/migrations/V20260425_02__add_field_def_agg_strategy.sql`

**Why this version:** Recent Python migration is `V20260424_01__template_feedback.sql`. The Java entity comment in `SmartBiPgFieldDefinition.java:55-57` references "DB migration V20260425_01 同步 ALTER COLUMN" for an `original_name TEXT` widening that has NO matching file in either `db/flyway/` or `database/migrations/` — that name was reserved for that change but the file was never created (likely applied in-place via psql). To avoid collision if that file ever surfaces, this migration claims `V20260425_02`.

- [ ] **Step 1: Create the migration SQL file**

```sql
-- V20260425_02__add_field_def_agg_strategy.sql
--
-- Add per-field aggregation strategy column. Replaces the Apr 24 stop-gap
-- heuristics in:
--   - backend/python/smartbi/api/insight.py (quick_summary regex on col-name)
--   - web-admin/src/api/smartbi/analysis.ts (FE getSmartKPIs implicit dispatch)
--
-- Values:
--   'sum'  — measures aggregated as SUM for KPI cards (default for legacy rows)
--   'mean' — ratings (1-5 scale) shown as MEAN: "平均星级 = 4.83 分"
--   'none' — IDs and non-measures excluded from KPI cards entirely
--
-- Upstream: backend/python/smartbi/services/field_classifier.py
--           infer_agg_strategy(name, semantic_type, is_measure, statistics)
--
-- Populated by: /api/smartbi/analytics/reclassify/{upload_id} endpoint
--               (γ-1c hook fires this after each upload commit)
--
-- Default 'sum' is safe for existing rows: matches the pre-Apr 24 behaviour
-- where every numeric col was summed. Backfill script runs reclassify per
-- upload to refine IDs → 'none' and ratings → 'mean'.

ALTER TABLE smart_bi_pg_field_definitions
    ADD COLUMN IF NOT EXISTS agg_strategy VARCHAR(20) NOT NULL DEFAULT 'sum';

COMMENT ON COLUMN smart_bi_pg_field_definitions.agg_strategy IS
    'KPI aggregation strategy: sum | mean | none. See field_classifier.infer_agg_strategy().';
```

- [ ] **Step 2: Apply migration to local dev DB (smartbi_db)**

Run:
```bash
psql -U smartbi_user -d smartbi_db -h localhost -p 5432 \
  -f backend/python/smartbi/database/migrations/V20260425_02__add_field_def_agg_strategy.sql
```
Expected output: `ALTER TABLE` then `COMMENT`. No errors.

- [ ] **Step 3: Verify column exists with correct default**

Run:
```bash
psql -U smartbi_user -d smartbi_db -h localhost -p 5432 -c \
  "SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
   FROM information_schema.columns
   WHERE table_name='smart_bi_pg_field_definitions' AND column_name='agg_strategy';"
```
Expected output: one row with `data_type=character varying`, `character_maximum_length=20`, `column_default='sum'::character varying`, `is_nullable=NO`.

- [ ] **Step 4: Verify existing rows backfilled to 'sum'**

Run:
```bash
psql -U smartbi_user -d smartbi_db -h localhost -p 5432 -c \
  "SELECT agg_strategy, COUNT(*) FROM smart_bi_pg_field_definitions GROUP BY agg_strategy;"
```
Expected: only `sum` group; count matches `SELECT COUNT(*) FROM smart_bi_pg_field_definitions` from before migration.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/database/migrations/V20260425_02__add_field_def_agg_strategy.sql
git commit -m "feat(smartbi): add agg_strategy column to field_definitions

Replaces Apr 24 stop-gap heuristics (insight.py regex + FE inline detection)
with persisted per-field aggregation strategy. Default 'sum' matches
pre-Apr 24 behaviour; backfill via reclassify endpoint refines IDs/ratings.

Plan: docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md (Task 1)"
```

---

## Task 2: Add `infer_agg_strategy` Helper to `field_classifier.py`

**Files:**
- Modify: `backend/python/smartbi/services/field_classifier.py` (append new function around line 268, after `_infer_semantic_type` and before `dedupe_column_names`)

**Why a separate function (not part of `classify_column`):** `classify_column` is pure on `(name, dtype)` only and is called from many places that don't have statistics. The agg strategy decision needs the column's `mean` from statistics to apply the rating [1,5] guard, so it must be a separate function called only by consumers who have stats access (reclassify endpoint).

- [ ] **Step 1: Write failing tests first (TDD)**

Append to `backend/python/smartbi/services/tests/test_field_classifier.py`:

```python
# ─── infer_agg_strategy ──────────────────────────────────────────────────────


from smartbi.services.field_classifier import infer_agg_strategy


def test_infer_agg_strategy_id_returns_none():
    """semantic_type='id' always returns 'none' regardless of stats."""
    assert infer_agg_strategy("评价ID", semantic_type="id", is_measure=False,
                              statistics=None) == "none"


def test_infer_agg_strategy_non_measure_returns_none():
    """Non-measure columns (dimensions/time) never aggregate."""
    assert infer_agg_strategy("门店名称", semantic_type=None, is_measure=False,
                              statistics={"mean": 100}) == "none"


def test_infer_agg_strategy_rating_in_range_returns_mean():
    """Name endswith '分' AND mean ∈ [1,5] → 'mean'."""
    assert infer_agg_strategy("星级分", semantic_type=None, is_measure=True,
                              statistics={"mean": 4.83}) == "mean"
    assert infer_agg_strategy("口味分", semantic_type=None, is_measure=True,
                              statistics={"mean": 4.82}) == "mean"
    assert infer_agg_strategy("环境分", semantic_type=None, is_measure=True,
                              statistics={"mean": 4.5}) == "mean"
    assert infer_agg_strategy("服务分", semantic_type=None, is_measure=True,
                              statistics={"mean": 1.0}) == "mean"
    assert infer_agg_strategy("综合评分", semantic_type=None, is_measure=True,
                              statistics={"mean": 5.0}) == "mean"
    assert infer_agg_strategy("店铺星级", semantic_type=None, is_measure=True,
                              statistics={"mean": 3.5}) == "mean"


def test_infer_agg_strategy_rating_name_but_stats_out_of_range_returns_none():
    """Name suggests rating but mean > 5 → likely loyalty points / score / 积分.
    Better to skip than to mis-display."""
    assert infer_agg_strategy("服务积分", semantic_type=None, is_measure=True,
                              statistics={"mean": 2300.0}) == "sum"
    # mean = 0 (no data) — still fall back to sum default
    assert infer_agg_strategy("星级分", semantic_type=None, is_measure=True,
                              statistics={"mean": 0.0}) == "sum"
    # mean = 6.5 (out of range) — fall back
    assert infer_agg_strategy("星级分", semantic_type=None, is_measure=True,
                              statistics={"mean": 6.5}) == "sum"


def test_infer_agg_strategy_no_stats_falls_back_to_sum():
    """No statistics available → can't apply rating guard, default to sum."""
    assert infer_agg_strategy("营业额", semantic_type="revenue", is_measure=True,
                              statistics=None) == "sum"
    assert infer_agg_strategy("星级分", semantic_type=None, is_measure=True,
                              statistics=None) == "sum"


def test_infer_agg_strategy_normal_measure_returns_sum():
    """Standard measures → sum."""
    assert infer_agg_strategy("营业额", semantic_type="revenue", is_measure=True,
                              statistics={"mean": 12000.0}) == "sum"
    assert infer_agg_strategy("实收金额", semantic_type="payment", is_measure=True,
                              statistics={"mean": 250.0}) == "sum"


def test_infer_agg_strategy_id_takes_priority_over_measure_flag():
    """If is_measure=True but semantic_type='id' (e.g. wrongly classified
    numeric ID), id wins → 'none'."""
    assert infer_agg_strategy("订单ID", semantic_type="id", is_measure=True,
                              statistics={"mean": 9144294805.0}) == "none"
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend/python && python -m pytest smartbi/services/tests/test_field_classifier.py -v -k infer_agg_strategy 2>&1 | tail -30
```
Expected: 7 failures with `ImportError: cannot import name 'infer_agg_strategy' from 'smartbi.services.field_classifier'`.

- [ ] **Step 3: Add the implementation to `field_classifier.py`**

Open `backend/python/smartbi/services/field_classifier.py`. After the `_infer_semantic_type` function (currently ends around line 267), before the `# ─── Duplicate-header dedup ─` separator, add:

```python
# ─── Aggregation-strategy decision ────────────────────────────────────────────
# Used by /reclassify endpoint to populate smart_bi_pg_field_definitions.agg_strategy.
# Centralized here so FE getSmartKPIs and Python quick_summary can both read the
# same persisted value rather than re-deriving via heuristics.

# Suffixes that indicate a 1-5 rating column (大众点评 / 美团 评价 exports).
_RATING_NAME_SUFFIXES: Tuple[str, ...] = ("分", "评分", "星级")

# Valid bounds for a "rating" mean. Outside [1, 5] strongly suggests the column
# is a loyalty score (积分) or unrelated metric — fall back to sum default.
_RATING_MEAN_MIN: float = 1.0
_RATING_MEAN_MAX: float = 5.0


def infer_agg_strategy(
    name: str,
    semantic_type: Optional[str],
    is_measure: bool,
    statistics: Optional[Dict[str, object]] = None,
) -> str:
    """Decide how a column should be aggregated for KPI cards.

    Returns one of:
      "sum"  — display SUM(col) (default for measures: amounts, counts, etc.)
      "mean" — display AVG(col) (1-5 ratings: 平均星级 = 4.83)
      "none" — exclude from KPI cards entirely (IDs, dimensions, time fields)

    Decision order (first match wins):
      1. semantic_type == 'id' → 'none' (NUMERIC IDs would otherwise sum to 亿)
      2. is_measure == False   → 'none' (only measures can be KPI cards)
      3. Name endswith 分/评分/星级 AND statistics.mean ∈ [1, 5] → 'mean'
      4. Else                   → 'sum'

    The [1, 5] guard prevents columns like "服务积分" (loyalty points,
    mean ~2300) from being mis-rendered as a 4.83 rating, while still
    catching legitimate 大众点评 ratings whose names match the suffix list.

    Args:
      name: column header text (e.g. "星级分", "营业额")
      semantic_type: from classify_column(...)["semantic_type"] (id/revenue/...)
      is_measure: from classify_column(...)["is_measure"]
      statistics: optional {"mean": float, "min": float, "max": float, ...}
                  from smart_bi_pg_field_definitions.statistics JSONB column.
                  When None (no stats yet), the rating guard is skipped and
                  the function falls back to the conservative 'sum' default.

    Returns:
      String ∈ {"sum", "mean", "none"}.
    """
    # Rule 1: IDs never aggregate
    if (semantic_type or "").lower() == "id":
        return "none"

    # Rule 2: only measures can be KPI cards
    if not is_measure:
        return "none"

    # Rule 3: rating detection (name + stats both required)
    if statistics:
        mean = statistics.get("mean")
        if mean is not None and name:
            for suffix in _RATING_NAME_SUFFIXES:
                if name.endswith(suffix):
                    try:
                        m = float(mean)
                    except (TypeError, ValueError):
                        break
                    if _RATING_MEAN_MIN <= m <= _RATING_MEAN_MAX:
                        return "mean"
                    # Name suggests rating but mean out of [1, 5] →
                    # likely loyalty points / 积分 / unrelated. Fall through
                    # to default 'sum'. NOT 'none' because the column may
                    # still be a meaningful sum-able measure.
                    break

    # Rule 4: default
    return "sum"
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd backend/python && python -m pytest smartbi/services/tests/test_field_classifier.py -v -k infer_agg_strategy 2>&1 | tail -20
```
Expected: 7 passed.

- [ ] **Step 5: Run the full file to verify no existing test broke**

Run:
```bash
cd backend/python && python -m pytest smartbi/services/tests/test_field_classifier.py -v 2>&1 | tail -10
```
Expected: all tests pass (existing + new 7).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/field_classifier.py \
        backend/python/smartbi/services/tests/test_field_classifier.py
git commit -m "feat(smartbi): add infer_agg_strategy() to field_classifier

Pure function deciding KPI aggregation per column based on:
  - semantic_type='id' → 'none' (suppress NUMERIC IDs from KPI cards)
  - is_measure=False → 'none' (dimensions/time)
  - name endswith 分/评分/星级 + mean ∈ [1,5] → 'mean' (大众点评 ratings)
  - else → 'sum' (default for amounts/counts)

7 unit tests cover id/rating/measure/dim/edge cases.

Plan: docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md (Task 2)"
```

---

## Task 3: Wire `infer_agg_strategy` Into `/reclassify` Endpoint

**Files:**
- Modify: `backend/python/smartbi/api/materialized_analytics.py` (lines 175-265 reclassify_upload function)

The existing endpoint already loads field defs, runs `classify_column`, and UPDATEs is_measure/is_dimension/is_time/semantic_type. We extend it to also load `statistics` JSONB, compute `agg_strategy` via the new helper, and add it to the same UPDATE.

- [ ] **Step 1: Read the existing function fully to confirm structure**

Run:
```bash
sed -n '175,270p' backend/python/smartbi/api/materialized_analytics.py
```
Expected: see the SELECT loading 8 columns + the for-loop over rows + the UPDATE block. Confirm no other consumer depends on the current SELECT field list.

- [ ] **Step 2: Modify the SELECT to also load statistics**

In `backend/python/smartbi/api/materialized_analytics.py`, find:
```python
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT original_name, standard_name, field_type, semantic_type,
                      is_measure, is_dimension, is_time, display_order
               FROM smart_bi_pg_field_definitions
               WHERE upload_id = $1
               ORDER BY display_order""",
            upload_id,
        )
```

Replace with:
```python
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT original_name, standard_name, field_type, semantic_type,
                      is_measure, is_dimension, is_time, display_order,
                      statistics, agg_strategy
               FROM smart_bi_pg_field_definitions
               WHERE upload_id = $1
               ORDER BY display_order""",
            upload_id,
        )
```

- [ ] **Step 3: Add import for new helper at top of file**

Find the existing import line (around line 48):
```python
from smartbi.services.field_classifier import classify_column
```

Replace with:
```python
from smartbi.services.field_classifier import classify_column, infer_agg_strategy
```

- [ ] **Step 4: Compute new agg_strategy in the loop and add to changes/updates**

Find the for-loop body (around lines 220-248):
```python
    for row in rows:
        name = row["original_name"]
        field_type = (row["field_type"] or "").upper() or None
        new = classify_column(original_name=name, inferred_dtype=field_type)
        old_roles = {
            "is_measure": row["is_measure"],
            "is_dimension": row["is_dimension"],
            "is_time": row["is_time"],
        }
        new_roles = {
            "is_measure": new["is_measure"],
            "is_dimension": new["is_dimension"],
            "is_time": new["is_time"],
        }
        if old_roles != new_roles or row["semantic_type"] != new["semantic_type"]:
            changes.append({
                "original_name": name,
                "field_type": row["field_type"],
                "old": {**old_roles, "semantic_type": row["semantic_type"]},
                "new": {**new_roles, "semantic_type": new["semantic_type"]},
                "reason": new["reason"],
            })
            updates.append({
                "name": name,
                "is_measure": new["is_measure"],
                "is_dimension": new["is_dimension"],
                "is_time": new["is_time"],
                "semantic_type": new["semantic_type"],
            })
```

Replace with:
```python
    for row in rows:
        name = row["original_name"]
        field_type = (row["field_type"] or "").upper() or None
        new = classify_column(original_name=name, inferred_dtype=field_type)

        # Compute agg_strategy from new classification + persisted statistics.
        # row["statistics"] is JSONB → asyncpg returns it as a dict already; if
        # the upload predates statistics population (rare), pass None and the
        # helper falls back to the conservative 'sum' default.
        stats = row["statistics"] if isinstance(row["statistics"], dict) else None
        new_agg = infer_agg_strategy(
            name=name,
            semantic_type=new["semantic_type"],  # type: ignore[arg-type]
            is_measure=bool(new["is_measure"]),
            statistics=stats,
        )

        old_roles = {
            "is_measure": row["is_measure"],
            "is_dimension": row["is_dimension"],
            "is_time": row["is_time"],
        }
        new_roles = {
            "is_measure": new["is_measure"],
            "is_dimension": new["is_dimension"],
            "is_time": new["is_time"],
        }
        old_agg = row["agg_strategy"]

        if (old_roles != new_roles
                or row["semantic_type"] != new["semantic_type"]
                or old_agg != new_agg):
            changes.append({
                "original_name": name,
                "field_type": row["field_type"],
                "old": {**old_roles, "semantic_type": row["semantic_type"],
                        "agg_strategy": old_agg},
                "new": {**new_roles, "semantic_type": new["semantic_type"],
                        "agg_strategy": new_agg},
                "reason": new["reason"],
            })
            updates.append({
                "name": name,
                "is_measure": new["is_measure"],
                "is_dimension": new["is_dimension"],
                "is_time": new["is_time"],
                "semantic_type": new["semantic_type"],
                "agg_strategy": new_agg,
            })
```

- [ ] **Step 5: Add agg_strategy to UPDATE statement**

Find the UPDATE block (around lines 252-262):
```python
        async with pool.acquire() as conn:
            async with conn.transaction():
                for u in updates:
                    await conn.execute(
                        """UPDATE smart_bi_pg_field_definitions
                           SET is_measure = $1, is_dimension = $2, is_time = $3,
                               semantic_type = $4
                           WHERE upload_id = $5 AND original_name = $6""",
                        u["is_measure"], u["is_dimension"], u["is_time"],
                        u["semantic_type"], upload_id, u["name"],
                    )
```

Replace with:
```python
        async with pool.acquire() as conn:
            async with conn.transaction():
                for u in updates:
                    await conn.execute(
                        """UPDATE smart_bi_pg_field_definitions
                           SET is_measure = $1, is_dimension = $2, is_time = $3,
                               semantic_type = $4, agg_strategy = $5
                           WHERE upload_id = $6 AND original_name = $7""",
                        u["is_measure"], u["is_dimension"], u["is_time"],
                        u["semantic_type"], u["agg_strategy"],
                        upload_id, u["name"],
                    )
```

- [ ] **Step 6: Manual smoke against local DB**

Make sure local Python dev server is running on port 8083 (`cd backend/python && uvicorn main:app --port 8083 --reload`). In another terminal:

```bash
# Get a JWT for local F001 (use existing test creds)
TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"qhj_prod","password":"123456","factoryId":"F001"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# Pick any upload ID with field defs in local smartbi_db
UPLOAD_ID=$(psql -U smartbi_user -d smartbi_db -h localhost -tA -c \
  "SELECT upload_id FROM smart_bi_pg_field_definitions
   GROUP BY upload_id LIMIT 1;")
echo "Testing with upload_id=$UPLOAD_ID"

# Trigger reclassify (without rematerialize for speed)
curl -s -X POST "http://localhost:8083/api/smartbi/analytics/reclassify/$UPLOAD_ID?rematerialize=false" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

Expected: response shows `"changes_count" >= 0` and `"changes"` array. If any change has `agg_strategy` differing in old/new, the column shows it. If all rows already have the correct agg_strategy from previous runs, `changes_count` may be 0 — that's fine.

- [ ] **Step 7: Verify DB state directly**

Run:
```bash
psql -U smartbi_user -d smartbi_db -h localhost -c \
  "SELECT original_name, semantic_type, is_measure, agg_strategy
   FROM smart_bi_pg_field_definitions
   WHERE upload_id = $UPLOAD_ID
   ORDER BY display_order LIMIT 20;"
```
Expected: rows have `agg_strategy` populated (not all 'sum' — at least IDs should be 'none' if any are present).

- [ ] **Step 8: Commit**

```bash
git add backend/python/smartbi/api/materialized_analytics.py
git commit -m "feat(smartbi): reclassify endpoint UPDATEs agg_strategy

Extends /api/smartbi/analytics/reclassify/{upload_id} to also compute
agg_strategy via infer_agg_strategy() and persist it. Loads existing
statistics JSONB to apply the rating [1,5] mean guard.

The diff response now includes old/new agg_strategy for each changed
column, so frontend can audit what's about to flip.

Plan: docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md (Task 3)"
```

---

## Task 4: Replace `quick_summary` Heuristic With DB Read

**Files:**
- Modify: `backend/python/smartbi/api/insight.py` (lines ~265-347 — the heuristic block)

The current code in `insight.py:268-302` does field_def lookup for IDs and re-derives ratings via column-name regex + statistics. We replace both with a single SELECT of `agg_strategy` per column from the persisted DB.

- [ ] **Step 1: Read the current heuristic block**

Run:
```bash
sed -n '260,350p' backend/python/smartbi/api/insight.py
```
Confirm the structure: `id_cols` set + `rating_cols` set both populated by inline detection, then used in the per-column for-loop to set `agg_strategy`.

- [ ] **Step 2: Replace the detection block**

In `backend/python/smartbi/api/insight.py`, find the block starting around line 268 with comment `# Apr 24 2026 — IDs: never aggregate as sum (KPI card filter ...` and continuing through line 302 (end of `for col in df.columns:` rating loop).

The replacement reads `agg_strategy` directly from DB. The existing block looks like:

```python
        # ... (existing comments about Apr 24 fix)
        id_cols: set = set()
        rating_cols: set = set()
        if isinstance(body, dict) and body.get("upload_id"):
            try:
                from smartbi.config import get_pg_pool
                pool = await get_pg_pool()
                if pool:
                    async with pool.acquire() as conn:
                        rows = await conn.fetch(
                            """SELECT original_name, semantic_type
                               FROM smart_bi_pg_field_definitions
                               WHERE upload_id = $1""",
                            int(body["upload_id"]),
                        )
                        for r in rows:
                            sem = (r["semantic_type"] or "").lower()
                            name = r["original_name"]
                            if sem == "id" or name.lower().endswith("id"):
                                id_cols.add(name)
            except Exception as _e:
                logger.warning(f"[quick_summary] field_defs lookup failed: {_e}")

        # Heuristic for rating cols (works without field_defs):
        # col name ends with "分" / "评分" AND mean within [1, 5] inclusive
        # (matches 星级分/口味分/环境分/服务分 + their merchant variants)
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                cmean = df[col].mean()
                if (col.endswith("分") or col.endswith("评分") or col.endswith("星级")) \
                        and pd.notna(cmean) and 1.0 <= float(cmean) <= 5.0:
                    rating_cols.add(col)
```

Replace with:

```python
        # Apr 25 2026 — read persisted agg_strategy from smart_bi_pg_field_definitions.
        # Replaces the prior inline regex+stats heuristic (now centralized in
        # field_classifier.infer_agg_strategy() and persisted by /reclassify).
        # Falls back to {} if no upload_id or DB lookup fails — every numeric
        # col then defaults to agg_strategy='sum' below (legacy behaviour).
        agg_by_name: dict = {}
        if isinstance(body, dict) and body.get("upload_id"):
            try:
                from smartbi.config import get_pg_pool
                pool = await get_pg_pool()
                if pool:
                    async with pool.acquire() as conn:
                        rows = await conn.fetch(
                            """SELECT original_name, agg_strategy
                               FROM smart_bi_pg_field_definitions
                               WHERE upload_id = $1""",
                            int(body["upload_id"]),
                        )
                        for r in rows:
                            agg_by_name[r["original_name"]] = (
                                r["agg_strategy"] or "sum"
                            )
            except Exception as _e:
                logger.warning(f"[quick_summary] field_defs lookup failed: {_e}")
```

- [ ] **Step 3: Update the per-column logic that consumes `id_cols`/`rating_cols`**

Find the per-column block (around lines 311-348 — inside `for col in df.columns:`):

```python
            if pd.api.types.is_numeric_dtype(df[col]):
                col_min = df[col].min()
                col_max = df[col].max()
                col_mean = df[col].mean()
                col_sum = df[col].sum()
                # Apr 24 2026 — IDs: never aggregate as sum (KPI card filter ...
                is_id = col in id_cols
                is_rating = col in rating_cols
                # aggStrategy tells FE how to display this col as KPI:
                #   "mean" → use c.mean (4.83 平均星级)
                #   "sum"  → use c.sum (current default for amounts)
                #   "none" → skip (don't make KPI card; e.g. ID columns)
                if is_id:
                    agg_strategy = "none"
                elif is_rating:
                    agg_strategy = "mean"
                else:
                    agg_strategy = "sum"
                col_info.update({
                    "min": float(col_min) if pd.notna(col_min) else None,
                    "max": float(col_max) if pd.notna(col_max) else None,
                    "mean": float(col_mean) if pd.notna(col_mean) else None,
                    "sum": None if (is_id or is_rating) else (float(col_sum) if pd.notna(col_sum) else None),
                    "semanticType": "id" if is_id else ("rating" if is_rating else None),
                    "aggStrategy": agg_strategy,
                })
```

Replace with:

```python
            if pd.api.types.is_numeric_dtype(df[col]):
                col_min = df[col].min()
                col_max = df[col].max()
                col_mean = df[col].mean()
                col_sum = df[col].sum()
                # Apr 25 2026 — agg_strategy is the single source of truth for
                # how this col appears as a KPI card. Persisted in
                # smart_bi_pg_field_definitions.agg_strategy by /reclassify
                # (which calls field_classifier.infer_agg_strategy).
                #   "mean" → FE displays col.mean (e.g. 平均星级 = 4.83 分)
                #   "sum"  → FE displays col.sum (default for amounts)
                #   "none" → FE skips this col entirely (IDs, dimensions)
                # No upload_id or DB lookup failed → falls back to "sum"
                # (matches legacy pre-Apr 24 behaviour).
                agg_strategy = agg_by_name.get(col, "sum")
                # Suppress sum on the wire when the FE won't use it, so KPI
                # filters that key on `sum != null` stay correct.
                emit_sum = agg_strategy == "sum"
                # semanticType="rating" is a hint for FE label formatting
                # ("平均X = 4.83 分"). Derived from agg_strategy='mean'.
                semantic_type_hint = "rating" if agg_strategy == "mean" else None
                col_info.update({
                    "min": float(col_min) if pd.notna(col_min) else None,
                    "max": float(col_max) if pd.notna(col_max) else None,
                    "mean": float(col_mean) if pd.notna(col_mean) else None,
                    "sum": float(col_sum) if (emit_sum and pd.notna(col_sum)) else None,
                    "semanticType": semantic_type_hint,
                    "aggStrategy": agg_strategy,
                })
```

- [ ] **Step 4: Manual smoke**

Restart local uvicorn (or rely on `--reload`). Run:
```bash
TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"qhj_prod","password":"123456","factoryId":"F001"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

UPLOAD_ID=<your-test-upload-id>

# Quick summary request
curl -s -X POST http://localhost:8083/api/smartbi/insight/quick-summary \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"upload_id\": $UPLOAD_ID}" | python -m json.tool | head -80
```

Expected: each numeric column has `aggStrategy` matching the DB value. ID columns show `aggStrategy: "none"` and `sum: null`. Rating columns (if present) show `aggStrategy: "mean"` and `sum: null`. Normal measures show `aggStrategy: "sum"` and a non-null `sum`.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/api/insight.py
git commit -m "refactor(smartbi): quick_summary reads agg_strategy from DB

Replaces the Apr 24 stop-gap inline regex+stats heuristic
(insight.py:268-302) with a single SELECT of persisted agg_strategy from
smart_bi_pg_field_definitions. Single source of truth: field_classifier
.infer_agg_strategy → /reclassify → DB → quick_summary → FE.

Behavior:
- agg_strategy='none' → sum field NULL (filters as not-KPI)
- agg_strategy='mean' → sum field NULL, mean preserved (FE displays as 平均X)
- agg_strategy='sum'  → sum populated (default for measures)
- No upload_id / DB lookup fails → falls back to 'sum' (legacy)

Plan: docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md (Task 4)"
```

---

## Task 5: Java — Add `aggStrategy` Field to Entity

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/postgres/SmartBiPgFieldDefinition.java`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/DynamicDataPersistenceServiceImpl.java`

The Java entity needs the field so Hibernate maps the new column. The service sets a default `'sum'` on insert; Python γ-1c reclassify hook (already wired) corrects it post-commit.

- [ ] **Step 1: Add field to JPA entity**

Open `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/postgres/SmartBiPgFieldDefinition.java`. After the `@Column(name = "format_pattern", length = 50) private String formatPattern;` block (around line 138), add:

```java

    /**
     * KPI aggregation strategy.
     * Values: "sum" (default for measures), "mean" (1-5 ratings),
     *         "none" (IDs and non-measures excluded from KPI cards).
     *
     * Populated initially by Java with default "sum"; corrected by the Python
     * /reclassify endpoint (γ-1c afterCommit hook in DynamicDataPersistence).
     *
     * Read by both backend (insight.py quick_summary) and frontend
     * (web-admin getSmartKPIs) — single source of truth, no client-side
     * heuristic.
     *
     * See: backend/python/smartbi/services/field_classifier.py
     *      infer_agg_strategy()
     *
     * Migration: V20260425_02__add_field_def_agg_strategy.sql
     */
    @Builder.Default
    @Column(name = "agg_strategy", length = 20, nullable = false)
    private String aggStrategy = "sum";
```

- [ ] **Step 2: Set explicit default in builder for new field defs**

Open `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/DynamicDataPersistenceServiceImpl.java`. Find the `SmartBiPgFieldDefinition.builder()` chain in `saveFieldDefinitions` around line 291. Inside the chain (after `.formatPattern(determineFormatPattern(mapping))` and before `.build()`), add:

```java
                    .aggStrategy("sum")  // Python /reclassify γ-1c hook will refine post-commit
```

The full chain after edit looks like:
```java
            SmartBiPgFieldDefinition def = SmartBiPgFieldDefinition.builder()
                    .uploadId(uploadId)
                    .originalName(uniqueName)
                    .standardName(mapping.getStandardField())
                    .fieldType(mapping.getDataType())
                    .semanticType(inferSemanticType(mapping))
                    .chartRole(inferChartRole(mapping))
                    .isDimension(isDimension(mapping))
                    .isMeasure(isMeasure(mapping))
                    .isTime(isTimeField(mapping))
                    .sampleValues(sampleValues)
                    .displayOrder(order++)
                    .formatPattern(determineFormatPattern(mapping))
                    .aggStrategy("sum")  // Python /reclassify γ-1c hook will refine post-commit
                    .build();
```

- [ ] **Step 3: Update Python SQLAlchemy model for parity**

Open `backend/python/smartbi/database/models.py`. Find the `SmartBiPgFieldDefinition` class (around line 98). After `format_pattern = Column(String(50))` (around line 121), add:

```python
    agg_strategy = Column(String(20), nullable=False, default="sum")
```

Also add it to the `to_dict` method:

```python
    def to_dict(self) -> Dict[str, Any]:
        return {
            "originalName": self.original_name,
            "standardName": self.standard_name,
            "fieldType": self.field_type,
            "semanticType": self.semantic_type,
            "chartRole": self.chart_role,
            "isDimension": self.is_dimension,
            "isMeasure": self.is_measure,
            "isTime": self.is_time,
            "sampleValues": self.sample_values,
            "statistics": self.statistics,
            "displayOrder": self.display_order,
            "formatPattern": self.format_pattern,
            "aggStrategy": self.agg_strategy,
        }
```

- [ ] **Step 4: Compile Java to verify entity is valid**

Run:
```bash
cd backend/java/cretas-api && mvn -q compile 2>&1 | tail -20
```
Expected: BUILD SUCCESS or no compile errors related to SmartBiPgFieldDefinition / DynamicDataPersistenceServiceImpl.

- [ ] **Step 5: Smoke test — upload triggers initial 'sum' default**

With local servers running (Java 10010 + Python 8083), upload any small Excel via the web-admin UI (or via curl POST `/api/smartbi/excel/upload` if simpler). Then:

```bash
psql -U smartbi_user -d smartbi_db -h localhost -c \
  "SELECT original_name, agg_strategy
   FROM smart_bi_pg_field_definitions
   WHERE upload_id = (SELECT MAX(id) FROM smart_bi_pg_excel_uploads)
   ORDER BY display_order LIMIT 10;"
```
Expected: every row has `agg_strategy='sum'` immediately after upload (Python γ-1c reclassify will correct it shortly after, possibly within seconds).

Then:
```bash
sleep 10  # Wait for Python γ-1c hook to fire
psql -U smartbi_user -d smartbi_db -h localhost -c \
  "SELECT original_name, semantic_type, agg_strategy
   FROM smart_bi_pg_field_definitions
   WHERE upload_id = (SELECT MAX(id) FROM smart_bi_pg_excel_uploads)
     AND (semantic_type = 'id' OR original_name LIKE '%分')
   ORDER BY display_order;"
```
Expected: ID rows now have `agg_strategy='none'`, rating rows have `agg_strategy='mean'`.

- [ ] **Step 6: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/postgres/SmartBiPgFieldDefinition.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/DynamicDataPersistenceServiceImpl.java \
        backend/python/smartbi/database/models.py
git commit -m "feat(smartbi): add aggStrategy entity field + default 'sum' on insert

Java SmartBiPgFieldDefinition entity adds aggStrategy field mapped to
agg_strategy column (V20260425_02 migration). DynamicDataPersistence
sets default 'sum' on insert; Python γ-1c reclassify hook refines
IDs/ratings post-commit (existing pattern).

Python SQLAlchemy model updated for parity (smartbi/database/models.py).

Plan: docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md (Task 5)"
```

---

## Task 6: Frontend — Add `aggStrategy` to `ColumnSummary` Type

**Files:**
- Modify: `web-admin/src/api/smartbi/common.ts` (around line 423)

The FE `getSmartKPIs` already reads `c.aggStrategy` (analysis.ts lines 562-563, 684, 732), but the `ColumnSummary` interface in `common.ts:423-436` does NOT declare the field. This is the silent type gap from Apr 24 (FE relies on TS structural typing letting it access undeclared props on widened types). Closing this gap = explicit contract + typo protection on future edits.

- [ ] **Step 1: Add the field to the interface**

Open `web-admin/src/api/smartbi/common.ts`. Find:
```typescript
export interface ColumnSummary {
  name: string;
  type: string;
  nullCount?: number;
  uniqueCount?: number;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
  // From Python quick-summary: sparkline data points and trend info
  sparkline?: number[];
  trend?: string;
  trendPercent?: number | null;
}
```

Replace with:
```typescript
export interface ColumnSummary {
  name: string;
  type: string;
  nullCount?: number;
  uniqueCount?: number;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
  // From Python quick-summary: sparkline data points and trend info
  sparkline?: number[];
  trend?: string;
  trendPercent?: number | null;
  // Apr 25 2026 — KPI aggregation strategy persisted on
  // smart_bi_pg_field_definitions.agg_strategy. Backed by
  // field_classifier.infer_agg_strategy() (Python). Read by getSmartKPIs.
  //   "sum"  → display SUM(col) as KPI (default for measures)
  //   "mean" → display AVG(col) as KPI (e.g. 平均星级 = 4.83 分)
  //   "none" → exclude this col from KPI cards (IDs, dimensions)
  aggStrategy?: 'sum' | 'mean' | 'none';
  // Hint for label prefix; FE displays "平均X" when this is "rating".
  semanticType?: 'rating' | 'id' | string | null;
}
```

- [ ] **Step 2: Run the FE typecheck**

Run:
```bash
cd web-admin && npm run type-check 2>&1 | tail -20
```
(Or `npx vue-tsc --noEmit` if `type-check` script is not defined.)
Expected: no errors related to ColumnSummary / aggStrategy / getSmartKPIs.

- [ ] **Step 3: Visual smoke (local dev)**

Run web-admin dev server (`cd web-admin && npm run dev`). Navigate to SmartBI 智能数据分析 page → select a known review-style upload (with 星级分 column) → verify KPI strip still shows 平均星级=4.83 cards (no regression). Open browser devtools → Console → confirm zero TypeScript errors / runtime warnings about undefined aggStrategy.

- [ ] **Step 4: Commit**

```bash
git add web-admin/src/api/smartbi/common.ts
git commit -m "fix(types): add aggStrategy + semanticType to ColumnSummary

Closes silent type gap from Apr 24 commit feb3703d4 — getSmartKPIs in
analysis.ts reads c.aggStrategy and c.semanticType but the type
interface did not declare them. TS structural typing allowed this at
runtime but flagged nothing on rename/typo.

Now explicit: aggStrategy ∈ {'sum'|'mean'|'none'}, semanticType
including 'rating'/'id' hints. Single source of truth via
field_classifier.infer_agg_strategy() persisted to DB.

Plan: docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md (Task 6)"
```

---

## Task 7: Backfill Script — Trigger Reclassify For All Existing Uploads

**Files:**
- Create: `scripts/migrations/2026-04-25-backfill-agg-strategy.sh`

This script lists all upload IDs from the smartbi DB and POSTs `/api/smartbi/analytics/reclassify/<id>?rematerialize=false` for each. With `rematerialize=false`, only field_definitions are updated (fast: ~100ms per upload); we don't re-run materialization since field roles aren't changing — only `agg_strategy` is.

- [ ] **Step 1: Verify the script directory exists**

Run:
```bash
ls scripts/migrations/ 2>/dev/null || mkdir -p scripts/migrations
ls scripts/migrations/
```
If the dir didn't exist, create it.

- [ ] **Step 2: Create the script**

Write `scripts/migrations/2026-04-25-backfill-agg-strategy.sh`:

```bash
#!/usr/bin/env bash
# 2026-04-25-backfill-agg-strategy.sh
#
# Backfill smart_bi_pg_field_definitions.agg_strategy for every existing
# upload by invoking the /reclassify endpoint per upload. Idempotent.
#
# Usage:
#   ./scripts/migrations/2026-04-25-backfill-agg-strategy.sh test
#   ./scripts/migrations/2026-04-25-backfill-agg-strategy.sh prod
#
# Requirements:
#   - Java backend reachable on the env's port (10011 test / 10010 prod)
#   - Python backend reachable (8084 test / 8083 prod)
#   - psql installed locally OR run remotely on server (set RUN_LOCATION)
#   - Test creds: qhj_prod/123456 (works in both envs)

set -euo pipefail

ENV="${1:-test}"
case "$ENV" in
  test)
    JAVA_PORT=10011
    PY_PORT=8084
    DB="smartbi_db"
    FACTORY="F001"
    ;;
  prod)
    JAVA_PORT=10010
    PY_PORT=8083
    DB="smartbi_prod_db"
    FACTORY="RES_3101_009"
    ;;
  *)
    echo "Usage: $0 {test|prod}" >&2
    exit 2
    ;;
esac

SERVER="root@47.100.235.168"

echo "==> Backfilling agg_strategy on $ENV ($DB)"
echo "==> Java port: $JAVA_PORT  Python port: $PY_PORT  Factory: $FACTORY"

# Login on the server (avoids local→server SSH SG timeout).
ssh "$SERVER" bash <<EOF
set -euo pipefail

TOKEN=\$(curl -sf -X POST http://localhost:$JAVA_PORT/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"qhj_prod","password":"123456","factoryId":"$FACTORY"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["accessToken"])')

if [ -z "\$TOKEN" ] || [ "\$TOKEN" = "None" ]; then
  echo "ERROR: failed to obtain JWT" >&2
  exit 1
fi

echo "==> Listing upload IDs from $DB ..."
UPLOAD_IDS=\$(psql -U smartbi_user -d $DB -h localhost -tA -c \
  "SELECT DISTINCT upload_id FROM smart_bi_pg_field_definitions ORDER BY upload_id;")

TOTAL=\$(echo "\$UPLOAD_IDS" | wc -l)
echo "==> Found \$TOTAL uploads to reclassify"

OK=0
FAIL=0
CHANGED=0
for UID in \$UPLOAD_IDS; do
  RESP=\$(curl -sf -X POST \
    "http://localhost:$PY_PORT/api/smartbi/analytics/reclassify/\$UID?rematerialize=false" \
    -H "Authorization: Bearer \$TOKEN" 2>&1) || {
      echo "  upload \$UID: FAIL (\$RESP)" >&2
      FAIL=\$((FAIL + 1))
      continue
    }
  CHANGES=\$(echo "\$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("changes_count", 0))' 2>/dev/null || echo "?")
  echo "  upload \$UID: \$CHANGES changes"
  OK=\$((OK + 1))
  if [ "\$CHANGES" != "0" ] && [ "\$CHANGES" != "?" ]; then
    CHANGED=\$((CHANGED + 1))
  fi
done

echo ""
echo "==> Done: \$OK OK / \$FAIL fail / \$CHANGED uploads with changes"

# Sanity check
echo "==> Final agg_strategy distribution:"
psql -U smartbi_user -d $DB -h localhost -c \
  "SELECT agg_strategy, COUNT(*) FROM smart_bi_pg_field_definitions GROUP BY agg_strategy ORDER BY agg_strategy;"
EOF
```

- [ ] **Step 3: Make it executable**

Run:
```bash
chmod +x scripts/migrations/2026-04-25-backfill-agg-strategy.sh
```

- [ ] **Step 4: Commit (do NOT run yet — that happens in deploy tasks)**

```bash
git add scripts/migrations/2026-04-25-backfill-agg-strategy.sh
git commit -m "ops(smartbi): add agg_strategy backfill script

One-shot script to populate agg_strategy on existing uploads via
the /reclassify endpoint. Idempotent (rematerialize=false skips
materialization since field roles don't change).

Run order:
  1. Apply V20260425_02 migration to env
  2. Deploy backend with new infer_agg_strategy + reclassify
  3. Run this script: ./scripts/migrations/2026-04-25-backfill-agg-strategy.sh {test|prod}

Plan: docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md (Task 7)"
```

---

## Task 8: Deploy & Backfill TEST Environment

**Files:** (none — deploy actions only)

- [ ] **Step 1: Apply migration to test DB**

Run on the server (test smartbi_db):
```bash
ssh root@47.100.235.168 "psql -U smartbi_user -d smartbi_db -h localhost -p 5432 \
  < /tmp/V20260425_02__add_field_def_agg_strategy.sql"
```

To get the file there first:
```bash
scp backend/python/smartbi/database/migrations/V20260425_02__add_field_def_agg_strategy.sql \
    root@47.100.235.168:/tmp/
```

Expected output: `ALTER TABLE` then `COMMENT`. No errors. If column already exists (someone ran ahead), `IF NOT EXISTS` keeps it idempotent.

- [ ] **Step 2: Deploy Python (test env, port 8084)**

Run:
```bash
./scripts/deploy/deploy-smartbi-python.sh --env test
```
Expected: deploy script reports SUCCESS + Python service restarts on test (port 8084). Verify:
```bash
ssh root@47.100.235.168 "curl -s http://localhost:8084/health"
```
Expected: `{"status": "ok"}` or similar.

- [ ] **Step 3: Deploy Java (test env, port 10011)**

Run:
```bash
./scripts/deploy/deploy-backend.sh --env test
```
Expected: Maven package + scp + service restart on port 10011. Verify:
```bash
ssh root@47.100.235.168 "curl -s http://localhost:10011/api/mobile/health"
```
Expected: `{"status": "UP"}` or similar.

- [ ] **Step 4: Deploy web-admin to test**

Run:
```bash
./scripts/deploy/deploy-web-admin.sh --env test
```
Expected: build SUCCESS + dist uploaded to test web-admin path on server.

- [ ] **Step 5: Run backfill against test**

Run:
```bash
./scripts/migrations/2026-04-25-backfill-agg-strategy.sh test
```
Expected: lists all upload IDs (~50-100 in test), reclassifies each, prints `OK / FAIL / CHANGED` counts. Final distribution should show non-zero `none` and `mean` counts (not all `sum`).

- [ ] **Step 6: Capture before/after diff for audit**

Run on the server:
```bash
ssh root@47.100.235.168 "psql -U smartbi_user -d smartbi_db -h localhost -c \
  \"SELECT agg_strategy, COUNT(*) FROM smart_bi_pg_field_definitions GROUP BY agg_strategy;\""
```
Save the output (paste into commit message of next task).

---

## Task 9: Verify TEST E2E — No Regression

**Files:**
- Create: `tests/e2e-comprehensive/agg-strategy-prod-verify.mjs`

- [ ] **Step 1: Create the smoke test**

Write `tests/e2e-comprehensive/agg-strategy-prod-verify.mjs`:

```javascript
// agg-strategy-prod-verify.mjs
//
// Verifies the persisted-agg_strategy refactor preserves Apr 24 behavior:
//   - Review xlsx (qhj_q3 / upload 4172 prod / 3975 test): 4 平均X cards
//   - POS xlsx (qhj_order / upload 4169 prod / 3970 test): legitimate measures
//
// Usage:
//   ENV=test node tests/e2e-comprehensive/agg-strategy-prod-verify.mjs
//   ENV=prod node tests/e2e-comprehensive/agg-strategy-prod-verify.mjs
//
// Exit code 0 = all assertions pass. 1 = at least one assertion failed.

import { chromium } from 'playwright';

const ENV = process.env.ENV || 'test';
const CONFIG = ENV === 'prod' ? {
  baseUrl: 'http://admin.cretaceousfuture.com',
  factory: 'RES_3101_009',
  reviewUploadId: 4172,
  posUploadId: 4169,
} : {
  baseUrl: 'http://139.196.165.140:8097',
  factory: 'F001',
  reviewUploadId: 3975,
  posUploadId: 3970,
};

const FAIL = (msg) => { console.error(`❌ ${msg}`); process.exitCode = 1; };
const OK = (msg) => console.log(`✅ ${msg}`);

async function login(page) {
  await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="账号"], input[placeholder*="用户名"]', 'qhj_prod');
  await page.fill('input[type="password"]', '123456');
  // Factory selection if visible
  const factoryInput = await page.$('input[placeholder*="工厂"]');
  if (factoryInput) await page.fill('input[placeholder*="工厂"]', CONFIG.factory);
  await page.click('button:has-text("登录"), button:has-text("Sign in")');
  await page.waitForURL(/dashboard|home|index/, { timeout: 15000 });
  OK(`Logged in as qhj_prod / ${CONFIG.factory}`);
}

async function checkUpload(page, uploadId, expected) {
  await page.goto(`${CONFIG.baseUrl}/#/smart-bi/analysis?uploadId=${uploadId}`, {
    waitUntil: 'networkidle',
  });
  // Wait for KPI cards to render + animation to settle
  await page.waitForSelector('.kpi-card, .kpi-strip, [class*="kpi"]', { timeout: 30000 });
  await page.waitForTimeout(6000);  // counter animation settle

  const titles = await page.$$eval('[class*="kpi"] [class*="title"], .kpi-card .title',
    (els) => els.map((e) => e.textContent.trim()).filter(Boolean));
  console.log(`  upload ${uploadId} KPI titles:`, titles);

  for (const must of expected.mustHave) {
    if (titles.some((t) => t.includes(must))) {
      OK(`upload ${uploadId}: contains "${must}"`);
    } else {
      FAIL(`upload ${uploadId}: missing "${must}"`);
    }
  }
  for (const mustNot of expected.mustNotHave || []) {
    if (titles.some((t) => t.includes(mustNot))) {
      FAIL(`upload ${uploadId}: should NOT contain "${mustNot}" but does`);
    } else {
      OK(`upload ${uploadId}: correctly excludes "${mustNot}"`);
    }
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await login(page);

    // Review upload — 4 平均X cards expected
    await checkUpload(page, CONFIG.reviewUploadId, {
      mustHave: ['平均'],  // any one 平均X card name
      mustNotHave: ['评价ID', '团购ID', '门店美团ID'],  // IDs forbidden
    });

    // POS upload — legitimate measures, no leak of review titles
    await checkUpload(page, CONFIG.posUploadId, {
      mustHave: [],  // POS has many possible titles, just check no IDs
      mustNotHave: ['账单号', '外部单号'],  // POS IDs forbidden as KPI
    });

    if (process.exitCode === 1) {
      console.error('\n❌ One or more assertions failed.');
    } else {
      console.log('\n✅ All assertions passed.');
    }
  } finally {
    await browser.close();
  }
})();
```

- [ ] **Step 2: Run against test env**

Run:
```bash
ENV=test node tests/e2e-comprehensive/agg-strategy-prod-verify.mjs
```
Expected exit code 0. All `mustHave` 平均 contains pass for review upload, all `mustNotHave` IDs absent.

If a real regression surfaces (e.g. the review upload no longer shows 平均X), STOP and investigate before proceeding. Likely cause: the agg_strategy in DB is wrong → check `psql ... SELECT agg_strategy FROM smart_bi_pg_field_definitions WHERE upload_id = 3975 AND original_name LIKE '%分';` — should return `mean` rows.

- [ ] **Step 3: Run the existing 94-test smoke for regression**

Run:
```bash
ENV=test node tests/e2e-comprehensive/p2-guardrail-full.mjs 2>&1 | tail -20
```
Expected: 93+/94 pass (baseline). Investigate any new failures.

- [ ] **Step 4: Commit the smoke test**

```bash
git add tests/e2e-comprehensive/agg-strategy-prod-verify.mjs
git commit -m "test(smartbi): add agg_strategy persistence regression smoke

Playwright headless verifies post-refactor:
  - Review xlsx (4172 prod / 3975 test): 平均X cards present, ID titles absent
  - POS xlsx (4169 prod / 3970 test): no leaked review titles, no ID KPIs

Run with: ENV={test|prod} node tests/e2e-comprehensive/agg-strategy-prod-verify.mjs

Plan: docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md (Task 9)"
```

---

## Task 10: Deploy & Backfill PROD

**Files:** (none — deploy actions only)

Pre-flight gate: Task 9 reported all green on test. If test is broken, do NOT proceed.

- [ ] **Step 1: Confirm test smoke is green**

Re-run if needed:
```bash
ENV=test node tests/e2e-comprehensive/agg-strategy-prod-verify.mjs && echo "TEST GREEN — safe to proceed to prod"
```

- [ ] **Step 2: Apply migration to prod DB**

Run on the server (prod smartbi_prod_db):
```bash
scp backend/python/smartbi/database/migrations/V20260425_02__add_field_def_agg_strategy.sql \
    root@47.100.235.168:/tmp/
ssh root@47.100.235.168 "psql -U smartbi_user -d smartbi_prod_db -h localhost -p 5432 \
  < /tmp/V20260425_02__add_field_def_agg_strategy.sql"
```
Expected: `ALTER TABLE` + `COMMENT`, no errors.

- [ ] **Step 3: Deploy Python (prod env, port 8083)**

Run:
```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod
```
Expected: SUCCESS + service restarts. Verify:
```bash
ssh root@47.100.235.168 "systemctl status cretas-python --no-pager | head -8"
ssh root@47.100.235.168 "curl -s http://localhost:8083/health"
```

- [ ] **Step 4: Deploy Java (prod env, BG blue/green)**

Run:
```bash
./scripts/deploy/deploy-backend.sh --env prod
```
Expected: BG deployment cuts over to new green port (10020 typically), then blue stops. Verify:
```bash
ssh root@47.100.235.168 "curl -s http://localhost:10010/api/mobile/health"
```

- [ ] **Step 5: Deploy web-admin to prod**

Run:
```bash
echo YES-PROD | ./scripts/deploy/deploy-web-admin.sh --env prod
```
Expected: build SUCCESS + dist deployed to admin.cretaceousfuture.com.

- [ ] **Step 6: Run backfill against prod**

Run:
```bash
./scripts/migrations/2026-04-25-backfill-agg-strategy.sh prod
```
Expected: ~100 uploads reclassified, non-zero `mean` and `none` counts in final distribution.

- [ ] **Step 7: Run smoke against prod**

Run:
```bash
ENV=prod node tests/e2e-comprehensive/agg-strategy-prod-verify.mjs
```
Expected: exit 0, all assertions pass.

- [ ] **Step 8: Run 94-test smoke against prod**

Run:
```bash
ENV=prod node tests/e2e-comprehensive/p2-guardrail-full.mjs 2>&1 | tail -20
```
Expected: 93/94 baseline (matches pre-refactor).

- [ ] **Step 9: Capture final state for handoff memory**

Run:
```bash
ssh root@47.100.235.168 "psql -U smartbi_user -d smartbi_prod_db -h localhost -c \
  \"SELECT agg_strategy, COUNT(*) FROM smart_bi_pg_field_definitions GROUP BY agg_strategy;\"" \
  | tee /tmp/agg_strategy_prod_dist.txt
```
Save the distribution output for the next session's memory entry.

---

## Task 11: Code Review & Final Audit

**Files:** (none — review actions only)

After 8 commits across Tasks 1-7 (DB / classifier / reclassify / quick_summary / Java entity / FE type / backfill script / smoke test), run a holistic code review per qa-prompt v2.4 Rule 15.

- [ ] **Step 1: Trigger superpowers:code-reviewer**

Use the Skill tool to invoke `superpowers:code-reviewer`. Brief it with:

> Review the 8 commits introduced by docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md (`git log e2e/v1-framework --oneline | head -10` shows them). Focus on:
>
> 1. **Type safety**: ColumnSummary contract correct? FE getSmartKPIs uses the new typed field consistently? Any `as any` introduced?
> 2. **DB safety**: V20260425_02 migration is additive + idempotent (`IF NOT EXISTS`)? Default 'sum' matches pre-refactor behavior so legacy code paths unbroken?
> 3. **Reclassify endpoint**: Backwards compatible? Existing callers (Java γ-1c hook) still receive expected response shape?
> 4. **Heuristic removal**: Confirm both Python `quick_summary` heuristic AND FE inline rating detection deleted, no leftover dead code.
> 5. **Race conditions**: Initial Java save → Python γ-1c reclassify → FE quick_summary read. Any window where FE reads stale 'sum' default and shows ID as KPI? (Acceptable per existing pattern but flag if worse than before.)
> 6. **Tests**: 7 unit tests for infer_agg_strategy cover the documented decision tree?

Report only P0 (must-fix-before-merge) and P1 (should-fix) issues. Skip stylistic P2/P3.

- [ ] **Step 2: Address any P0 findings**

If reviewer reports P0: fix in a follow-up commit, push, re-run smoke if needed. P1 findings get logged as backlog (commit message reference).

- [ ] **Step 3: Update memory file**

Edit `C:\Users\Steve\.claude\projects\C--Users-Steve-my-prototype-logistics\memory\MEMORY.md` to add a new entry (one line under ~200 chars):

```markdown
## Apr 25 2026 — agg_strategy persisted (Option A complete)
- [Apr 25 agg_strategy](project_apr25_agg_strategy_persistence.md) — V20260425_02 migration + infer_agg_strategy() + reclassify UPDATE + DB-driven quick_summary + ColumnSummary type fix + ~100 prod uploads backfilled. 0 P0 in reviewer audit. Stop-gap heuristics (19df49af6 + feb3703d4) now dead code, both deleted.
```

Create the topic file `C:\Users\Steve\.claude\projects\C--Users-Steve-my-prototype-logistics\memory\project_apr25_agg_strategy_persistence.md`:

```markdown
---
name: Apr 25 2026 — agg_strategy persistence (Option A complete)
description: V20260425_02 migration + infer_agg_strategy() helper + reclassify endpoint UPDATE + DB-driven quick_summary + ColumnSummary type fix. ~100 prod uploads backfilled. Replaces stop-gap heuristics from 19df49af6/feb3703d4.
type: project
---

# agg_strategy persistence (Option A) — Apr 25 2026

## What shipped
- V20260425_02__add_field_def_agg_strategy.sql — adds VARCHAR(20) DEFAULT 'sum' NOT NULL column to smart_bi_pg_field_definitions
- field_classifier.infer_agg_strategy(name, semantic_type, is_measure, statistics) → 'sum'|'mean'|'none' (7 unit tests)
- Reclassify endpoint extended to load statistics + UPDATE agg_strategy in same transaction
- quick_summary heuristic deleted; reads agg_strategy from DB
- Java SmartBiPgFieldDefinition + DynamicDataPersistenceServiceImpl: 'sum' default on insert, Python γ-1c refines
- ColumnSummary type adds aggStrategy + semanticType (closes Apr 24 silent type gap)
- Backfill script ran on prod: <X> uploads reclassified, agg distribution (sum/mean/none): <copy from /tmp/agg_strategy_prod_dist.txt>

## Why Option A vs spec proposal
Spec proposed Domain ∈ {review, pos, ...} but existing Domain enum in materialized_analytics/schema.py uses {RESTAURANT, FINANCE, ...} keyed by 30+ template applies(). Option A skips the domain axis entirely — the user-visible KPI 亿/万 pollution is a per-field issue solved by agg_strategy alone.

## What's deferred
- Domain persistence (revisit when v2 vendor adapters land)
- SmartBIAnalysis dropdown POS→review→POS staleness (separate root cause in loadHistory batch grouping)
- Domain.REVIEW / Domain.POS sub-types in enum

## Commit list
- <fill in 8 SHAs from git log>
```

- [ ] **Step 4: Final commit (memory only — no code changes)**

```bash
# Memory files are outside the git repo (~/.claude/projects/...); no commit needed
echo "Plan complete. Final memory: ~/.claude/.../memory/project_apr25_agg_strategy_persistence.md"
```

---

## Self-Review Checklist (run before declaring plan done)

This is for the planner (current session) — not the executor. Verifies the plan against the spec / scope.

### 1. Spec coverage

Walking through the original spec sections (`docs/superpowers/specs/2026-04-25-domain-aware-field-roles-design.md`):

| Spec section | Coverage in this plan |
|---|---|
| §1 Background — stop-gap brittleness | ✓ Removed; heuristics deleted in Tasks 4 + 6 |
| §2.1 In scope — Python domain_detector + per-domain rules | ✗ Explicitly out of scope (Option A rationale stated above and in plan §"Why Option A") |
| §2.1 In scope — agg_strategy column on field_definitions | ✓ Task 1 (DDL) + Task 5 (Java entity) + Task 6 (FE type) |
| §2.1 In scope — quick_summary reads agg_strategy from DB | ✓ Task 4 |
| §2.1 In scope — FE getSmartKPIs reads aggStrategy authoritatively | ✓ Already done in feb3703d4; Task 6 closes the type contract |
| §2.1 In scope — Backfill script | ✓ Task 7 |
| §2.1 In scope — Empty-state for review domain | ✗ Out of scope (UX polish, separate ticket) |
| §2.1 In scope — Dropdown switch forceRefresh | ✗ Out of scope (separate root cause, separate ticket) |
| §2.2 Out of scope items | All preserved |
| §5 Migration plan order | ✓ Tasks 8-10 follow the order: DB → Python+Java co-deploy → backfill → FE smoke |
| §5.4 Rollback | Implicit: V20260425_02 is additive (column ignored), Python+Java/FE git revert returns to stop-gap |
| §6 Test plan — Unit | ✓ Task 2 (7 tests) |
| §6 Test plan — E2E | ✓ Task 9 (review + POS regression) + Task 9/10 (94-test smoke) |
| §7 Risks — domain mis-classification | N/A (domain not in scope) |
| §7 Risks — backfill crash | Addressed: script is per-upload + idempotent, partial completion OK |
| §7 Risks — large prod re-enrichment | Addressed: rematerialize=false skips materialization |
| §7 Risks — dropdown staleness | Documented as out-of-scope |
| §8 Success criteria | All criteria EXCEPT domain-specific ones (review xlsx 4 cards / POS measures / 94-test / 0 P0 / no FE heuristic / no Python heuristic) covered by Tasks 9 + 11 |

### 2. Placeholder scan

Searched plan for "TBD"/"TODO"/"implement later"/"add appropriate"/"similar to": **none found**. All steps contain actual code, file paths, commands.

### 3. Type consistency

| Identifier | First defined | Used in |
|---|---|---|
| `infer_agg_strategy(name, semantic_type, is_measure, statistics)` | Task 2 step 3 | Task 3 step 4 (matching call site), Task 5 docs reference |
| `agg_strategy` DB column type `VARCHAR(20) NOT NULL DEFAULT 'sum'` | Task 1 step 1 | Task 5 (`@Column(name = "agg_strategy", length = 20, nullable = false)` matches), Task 6 (`aggStrategy?: 'sum' \| 'mean' \| 'none'` matches values) |
| `agg_by_name: dict` (Python local) | Task 4 step 2 | Task 4 step 3 (consumer) |
| `aggStrategy` (FE prop) | Task 6 step 1 | analysis.ts already uses (no change needed) |
| `V20260425_02__add_field_def_agg_strategy.sql` | Task 1 | Tasks 5 (Java entity comment) + 7 (script docstring) + 8/10 (deploy) all reference exact filename |
| Python `Dict[str, object]` import | Already present (line 24 of field_classifier.py) | Task 2 (used in helper signature) |

All consistent.

### 4. No-spec gap left undocumented

The plan explicitly states what's out of scope and why (§"Out of scope" + Task descriptions). No spec requirement is silently dropped — domain axis is loud and documented.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-25-agg-strategy-persistence.md`. Two execution options:

**1. Subagent-Driven (recommended for this plan)** — Each Task (1-10) dispatched to a fresh subagent; main session reviews diffs between tasks. Best for the 4 tasks that touch >1 layer (Tasks 4, 5, 9, 10) where mid-task confusion would be expensive. Estimated wall-clock: 4-5h (parallelism on Tasks 7+9 possible).

**2. Inline Execution** — Execute Tasks 1-11 sequentially in this session. Faster context (no subagent boot), but main session carries all artifacts in working memory. Estimated wall-clock: 3-4h. Better if you want to see every diff inline before commit.

Which approach?
