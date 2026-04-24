# P3 Architecture Cleanup: Field Statistics Population — Follow-up

**Date**: 2026-04-25
**Branch**: `e2e/v1-framework`
**Code commit**: `9652bf60e` (scope creep — see below)

## Scope creep disclosure

The Python changes for this P3 work were unintentionally bundled into commit `9652bf60e` ("feat(restaurant): Plan C demo seed v4"), which was authored in a parallel session. The lint-staged pre-commit hook auto-staged my unstaged Python edits at commit time, so the demo-seed commit ended up containing my unrelated work in addition to the SQL migration it was supposed to.

This is the classic Apr 11 incident pattern documented in `.claude/rules/concurrent-edit-safety.md` rule 5:
> Even if you only `git add`-ed specific files, commit-time hooks can sweep up parallel session changes.

Since the parallel commit was already pushed to origin by the time I noticed, I'm not rewriting history. This doc serves as the missing commit message for the P3 work.

## What changed in 9652bf60e (Python files only)

Two files modified:

- `backend/python/smartbi/api/analysis_cache.py` (+141 / -1)
- `backend/python/smartbi/api/insight.py` (+8)

### `precompute_enrichment_cache_for_upload` extension

Extends the γ-2c afterCommit hook helper to ALSO populate `smart_bi_pg_field_definitions.statistics` with computed `mean/min/max/sum/nullCount/uniqueCount` per numeric column, then re-run `infer_agg_strategy` with the freshly populated stats.

New ordering inside the helper (idempotent, no LLM, safe to re-run):

1. `compute_quick_summary` with current persisted `agg_strategy`
2. Extract per-numeric-col stats into `stats_by_name` dict (only persists when at least one of mean/min/max is non-null)
3. UPDATE `field_def.statistics` JSONB in single transaction
4. Re-run `infer_agg_strategy(name, persisted semantic_type, persisted is_measure, NEW statistics)` — UPDATE `agg_strategy` where it changed
5. If any `agg_strategy` flipped, recompute summary so cached `kpiSummary` reflects new aggregation
6. Persist `enrichment_cache` as before

Rationale: previously the only way `agg_strategy` could become 'mean' was via the live-mean fallback in `compute_quick_summary` (commit `ce30773d9`, Apr 24 hotfix), because `statistics` was empty for all uploads so `infer_agg_strategy`'s `[1, 5]` rating guard never triggered from DB. Now `statistics` is populated in DB and `infer_agg_strategy` correctly returns 'mean' from the persisted source.

### `compute_quick_summary` — defense-in-depth comment

Added comment to the live-mean rating fallback marking it as defense-in-depth (no behavior change). Plan: remove after 2 weeks of confirming backfill coverage on new uploads.

## Verification

### Test (`smartbi_db`)
- Backfill: **841 / 841 OK / 0 fail / 0 skip**
- Upload 3975 (大众点评 reviews, 12,903 rows, factory F001):
  - 4 rating columns (`星级分 / 口味分 / 环境分 / 服务分`) now `agg_strategy=mean`, `statistics->>'mean'` ≈ 4.83
  - 3 ID columns (`评价ID / 门店美团ID / 团购ID`) correctly stay `agg_strategy=none` (is_measure=false)
- Final stats distribution: 7,121 / 18,408 fields with non-empty `statistics`, 63 with `agg_strategy=mean`

### Prod (`smartbi_prod_db`)
- Backfill: **252 / 252 OK / 0 fail / 0 skip**
- Upload 4172 (大众点评 reviews, 12,903 rows, factory RES_3101_009):
  - Same 4 rating columns now `agg_strategy=mean`, `statistics->>'mean'` ≈ 4.83
  - Cached enrichment_cache payload `aggStrategy=mean`, `mean=4.83`, `sum=null` per rating col
- Final stats distribution: 1,714 / 17,934 fields with non-empty `statistics`, 4 with `agg_strategy=mean` (only upload 4172 has rating columns on prod — other prod uploads are POS/sales data without 1-5 ratings)
- Idempotent: 2nd precompute call on the same upload returns `agg_strategy_changes=0`

### Unit tests
- `pytest backend/python/smartbi/services/tests/test_field_classifier.py -q` → 35 passed

## Files & SHAs

- Code commit: `9652bf60e` (mixed with Plan C demo SQL)
- This doc: separate follow-up commit
- Backfill script: `scripts/migrations/2026-04-25-backfill-enrichment-cache.sh` (unchanged, ran against new logic)

## Live fallback removal plan

The live-mean fallback in `compute_quick_summary` (insight.py lines 295-318) is now redundant for any upload that has run through the γ-2c precompute hook (every new upload + all 252 prod / 841 test backfilled uploads). Plan:

1. Wait 2 weeks (until ~2026-05-09) and confirm:
   - All new prod uploads in that window show `statistics IS NOT NULL` for numeric cols
   - No regression reports of "rating shown as sum"
2. Delete the rating-suffix fallback block, leaving only `agg_strategy = agg_by_name.get(col, "sum")`
3. Move the `RATING_NAME_SUFFIXES` import out of `insight.py` (no longer needed there)

This restores single-source-of-truth: the DB column drives all KPI agg decisions.
