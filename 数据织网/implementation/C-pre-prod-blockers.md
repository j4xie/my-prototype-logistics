# Sub-Project C — Pre-Prod-Activation Blockers

**Date**: 2026-04-26 (post-Day-12 holistic audit) — **Updated 2026-04-27 (Phase A+B re-audit)**
**Source**: superpowers:code-reviewer audit of commits `498a8ab56..4b82c98c0` (Day 6-12) + re-audit of `db72592e5..a3dbbfccd` (Phase A+B fixes)
**Status**: Day 12 merge **SAFE** (env flag `SMARTBI_ENABLE_PROVENANCE` default OFF → writer hooks inert in prod). These items gate the Day 23+ flag-flip event, NOT the merge.

**2026-04-27 update**: Phase A (commit `db72592e5`) + Phase B (commit `a3dbbfccd`) closed C1 + C2 + I1 + I4 + I5 + I6 + I7. Re-audit verdict: "Ready to merge: Yes. Ready for flag flip: Pending soak (IMP-1 spec doc update strongly recommended before activation, otherwise Day 13+ subagents will read stale spec)." See "Phase A+B re-audit findings" section below for 5 new IMP items.

This doc mirrors the `C-day6-blockers.md` pattern: track items that MUST be resolved before a specific future activation event so the "flip the switch" task has a clear go/no-go checklist.

---

## Activation gate definition

**The gate**: setting `SMARTBI_ENABLE_PROVENANCE=1` in `.env.prod` (or systemd `Environment=`) and restarting `cretas-python` so the 4 B writers (ProductSummary / Review / Finance / Inventory) start emitting cell-level `field_provenance` rows during Silver writes.

**Gate prerequisites**: all Critical items resolved + multi-store e2e test added + concurrent same-cell e2e test added.

---

## 1. CRITICAL — must fix before flag flip

### C1. Multi-dimensional anchor missing in 4 B writers

**Affects**:
- `backend/python/smartbi/canonical/silver_writers/product_summary_writer.py:138-150`
- `backend/python/smartbi/canonical/silver_writers/inventory_writer.py:167-179`
- `backend/python/smartbi/canonical/silver_writers/finance_writer.py:160-174`
- `backend/python/smartbi/canonical/silver_writers/review_writer.py:212-225`

**Today**: Each writer's dual-write hook anchors `field_provenance` to a single dimension (product / ingredient / finance_subject), but the underlying Silver data has compound dedup keys:

| Writer | Silver dedup key | Provenance anchor today | Mismatch |
|---|---|---|---|
| ProductSummaryWriter | `(factory, upload, product, store, period_start)` | `(factory, "product", product_id, "revenue", period_start)` | drops `store_id` |
| InventoryWriter | `(factory, ingredient, store, snapshot_date)` | `(factory, "ingredient", ingredient_id, "stock_qty", snapshot_date)` | drops `store_id` |
| FinanceWriter | `(factory, upload, source_row_hash)` (per voucher) | `(factory, "finance_subject", subject_id, "debit_amount", voucher_date)` | drops voucher granularity (multiple vouchers same day, same subject collapse) |
| ReviewWriter | `(factory, upload, source_row_hash)` per review | `(factory, "product"\|"store", entity_id, "avg_rating", period)` | drops review-instance granularity |

**Why it matters when flag flips**: Same product across multiple stores in one upload writes N silver rows, but provenance dedups on `(factory, product, "revenue", period_start)` → row 1 INSERTs successfully, rows 2..N hit `resolve_conflict` against row 1's value with same priority → significant diff (different stores have different revenue) → enqueued as `field_conflict` admin_queue rows. **Result**: every multi-store / multi-voucher upload spews tens-to-thousands of admin_queue rows for normal data, AND only the first row per dedup key has provenance written (the rest are silently dropped until admin manually resolves each one).

**Test gap**: Day 12 e2e (`test_b_writer_dual_write_provenance_when_env_set`) uses single store + single product — exactly the case where this defect doesn't manifest. The 4 unit tests per writer also use `_resolve_store` returning a fixed `entity_id=10` without varying it.

**Fix options** (in order of architectural cleanliness):

1. **Compound entity key (recommended)**: change `entity_type` to capture the compound. E.g., `entity_type="product_at_store"` with `entity_id` derived from a (product_id, store_id) hash, OR introduce a `store_qualifier` JSONB column on `field_provenance` and a partial-unique-index variant. This preserves cell-level lineage for every (product, store, period) triplet.

2. **Compound field name**: `field_name=f"revenue@store_{store_id}"` — uglier but no schema change. Reader needs to know to query for `field_name LIKE 'revenue@store_%'` aggregations.

3. **Roll up at writer**: aggregate revenue across stores in the writer hook so one provenance row records SUM(revenue) per product-period. Loses per-store cell lineage but matches single-anchor semantics.

4. **Skip dual-write for these writers entirely**: only emit cell-level provenance from manual edits / inferred / industry_default sources where one entity = one cell.

**Required gate**:
- Implement option chosen above
- Add multi-store e2e test (2 stores × 1 product × 1 upload → assert N×3 provenance rows, 0 admin_queue rows)
- Add multi-voucher-same-day e2e test for FinanceWriter
- Run all 89+ unit + 7+ e2e + new tests → all green

---

### C2. `resolve_conflict` read-then-decide window not lock-protected

**File**: `backend/python/smartbi/canonical/provenance/conflict_resolver.py:307-393`

**Today**: The flow is:
```
1. read_authoritative_value(conn, factory, entity, field)        ← NO LOCK
2. branch on current=None / values_equal / priority comparison
3. write_provenance(conn, ...)                                   ← LOCK ACQUIRED HERE (Day 6 blocker fix)
```

Two writers racing on the same `(factory, entity_type, entity_id, field_name, valid_from)` dedup key:
- T0: A reads → None
- T1: B reads → None
- T2: A `write_provenance` → acquires lock → INSERT → commits
- T3: B `write_provenance` → acquires lock → INSERT → **`asyncpg.UniqueViolationError`** on `uq_fp_dedup`

The hook's broad `except Exception` (`_writer_hook.py:92-100`) swallows it as a logged warning. B's intent (which may be HIGHER priority than A's) is silently dropped. No row written, no admin_queue entry.

**Same pattern in higher-priority branch** (lines 343-364): two writers race; both fetchval the same `prior_id`; both UPDATE prior with `superseded_by_id = self`; A's `write_provenance` commits; B's `write_provenance` collides on `uq_fp_dedup` against A's freshly-INSERTed row. Same swallowed exception.

**Why it matters when flag flips**: Concurrent uploads from the same factory hitting the same product during a busy window will drop provenance writes. This won't be visible in admin_queue — only the warning log. Hidden data loss + silent corruption of audit chain (self-loop supersede sentinel can persist if mid-flow exception swallowed).

**Fix**: Move the advisory lock to the START of `resolve_conflict`, BEFORE the read:

```python
async def resolve_conflict(...):
    # Acquire field-conflict lock BEFORE reading current state.
    lock_key = _field_lock_key(factory_id, entity_type, entity_id, field_name)
    await conn.execute("SELECT pg_advisory_xact_lock(99::int, $1::int)", lock_key)
    # ... read → decide → write (write_provenance's inner lock is reentrant, safe)
```

PG advisory locks are reentrant per (session, key) so the inner lock in `write_provenance` is harmless. Consider extracting `_field_lock_key()` to a helper shared between `writer.py` and `conflict_resolver.py`.

**Required gate**:
- Apply fix above
- Add concurrent same-cell e2e test (5 parallel `asyncio.gather` tasks all calling `resolve_conflict` for same product-field, expect exactly 1 `written` + 4 `no_change`/`queued`/lower-priority-rejected, 0 silent drops)
- All existing tests still green

---

## 2. IMPORTANT — should fix before flag flip OR pre-Day-13 cleanup

### I1. `clean_tenant` fixture missing `field_provenance` + `smart_bi_pg_excel_uploads`

**File**: `backend/python/tests/test_data_fabric_e2e.py:99-138` (clean_tenant); `1280-1431` (Day 12 dual-write e2e)

**Today**: Day 12 dual-write e2e doesn't wrap in `async with conn.transaction()` (unlike Day 8-9 e2e), so it commits real rows. Cleanup fixture's table list excludes `field_provenance` + `smart_bi_pg_excel_uploads` → 3+1 leaked rows per run. ON DELETE RESTRICT on `source_upload_id` blocks future cleanup attempts.

**Fix**:
```python
tables = (
    "field_provenance",                # Day 1-5 C — order matters: BEFORE smart_bi_pg_excel_uploads
    "factory_provenance_config",       # Day 8-9 C
    # ... existing tables ...
    "smart_bi_pg_excel_uploads",       # add — but skip sentinel id=0
)
# In cleanup loop:
if tbl == "smart_bi_pg_excel_uploads":
    await conn.execute(f"DELETE FROM {tbl} WHERE factory_id = $1 AND id <> 0", TEST_FACTORY)
```

### I2. `_get_factory_config` cache TOCTOU race

**File**: `backend/python/smartbi/canonical/provenance/conflict_resolver.py:99-153`

**Today**: Lock released between cache miss check and cache populate → N concurrent first-touches → N redundant `fetchrow` calls. Correctness fine (same value); performance only.

**Fix**: Single-flight pattern with `asyncio.Event` per factory_id, OR keep lock held during fetch.

### I3. `_get_factory_config` cache key doesn't include RLS context

**File**: `backend/python/smartbi/canonical/provenance/conflict_resolver.py:53-153`

**Today**: Cache key = `factory_id`. If `_get_factory_config(conn, "F001")` is called when conn's `app.factory_id != "F001"`, RLS returns 0 rows → defaults cached → poisoned for 5 min.

**Fix**: Add assertion at function entry that reads `current_setting('app.factory_id', true)` and matches the requested factory_id; raise if mismatch.

### I4. `is_provenance_enabled()` reads env on every call

**File**: `backend/python/smartbi/canonical/provenance/_writer_hook.py:28-31`

**Today**: Mid-run flag flip means in-flight uploads emit partial provenance (records before flip have none, after-flip have provenance). Behavior surprising.

**Fix**: Cache via `@functools.cache` or module-level lazy global. Document that flag changes require process restart. Add `invalidate_provenance_flag_cache()` for tests via monkeypatch.

### I5. `except Exception` in writer hook too broad

**File**: `backend/python/smartbi/canonical/provenance/_writer_hook.py:92-100`

**Today**: Catches `RLSPolicyViolationError` (real bug), `OSError` (catastrophic), `asyncpg.PostgresConnectionError` (pool exhausted) — all silently logged.

**Fix**: Narrow to `(asyncpg.UniqueViolationError, asyncpg.ForeignKeyViolationError, asyncpg.SerializationError)`. Let other exceptions propagate.

### I6. `minor_diff_same_or_lower_priority` reason tag conflates two semantics

**File**: `backend/python/smartbi/canonical/provenance/conflict_resolver.py:417-426`

**Today**: One reason tag covers both "same priority + minor diff" (spec ambiguity) and "lower priority" (correct rejection). Audit/debug can't distinguish.

**Fix**: Split branch:
```python
if new_priority > current_priority:
    return {"action": "no_change", "id": None, "reason": "lower_priority"}
# Equal priority case
if _is_significant_diff(...):
    enqueue
else:
    return {"action": "no_change", "id": None, "reason": "minor_diff_same_priority"}
```

### I7. Per-field savepoint missing in writer hook

**File**: `backend/python/smartbi/canonical/provenance/_writer_hook.py:62-100`

**Today**: Outer transaction wraps the entire `for field in fields` loop. If `resolve_conflict` raises mid-loop on field N (after field 1 already executed supersede sentinel + INSERT + re-point), exception is swallowed but partial state from N may commit (e.g. self-referencing `superseded_by_id = id`).

**Fix**: Wrap each `resolve_conflict` call in `async with conn.transaction()` (asyncpg auto-promotes nested to SAVEPOINT). Per-field savepoint means individual field failures roll back without aborting the batch.

---

## 3. MINOR — backlog cleanup

| ID | File | Issue | Effort |
|---|---|---|---|
| M1 | `conflict_resolver.py:60-91` | `_FIELD_TYPE_MAP` should be `Mapping[str, str]` or `MappingProxyType` for read-only intent | 5 min |
| M2 | `V20260501_02__c_factory_provenance_config.sql` | Use `CREATE TABLE IF NOT EXISTS` for stylistic consistency with V01/V03 (Flyway tracks state, but easier local re-runs) | 5 min |
| M3 | `conflict_resolver.py:43` | `pos_excel` priority entry vestigial — no writer emits this source_type. Remove if unused | 2 min |
| M4 | `tests/test_provenance.py` | Missing test: write `valid_to=2026-03-31` + read with `as_of=today` (Apr 26) → assert `None`. Catches regression on date-comparison inversion | 10 min |
| M5 | `tests/test_data_fabric_e2e.py` | Only ProductSummaryWriter has dual-write e2e. Three near-clones with parameterized `(writer, source_type, entity_type)` would close gap for Review/Finance/Inventory — would also catch C1 immediately | 30 min (after C1 fix) |
| M6 | `writer.py:132-155` + V20260501_01 | New columns `confidence_method` + `created_by` added but never written. Either populate (`confidence_method = mapper_method` per migration default) or remove from spec scope | 10 min |

---

## Gate checklist for `SMARTBI_ENABLE_PROVENANCE=1` flip in prod

Before any prod systemd `Environment=SMARTBI_ENABLE_PROVENANCE=1` change:

- [x] **C1 fixed** ✅ (Phase B `a3dbbfccd`) — multi-dim anchor: ProductSummary/Inventory compound `field_name@store_<id>`, FinanceWriter hook-level rollup by `(subject_id, voucher_date)`, ReviewWriter unchanged (audit was false positive — aggregate-then-INSERT). 4 multi-dim e2e tests added.
- [x] **C2 fixed** ✅ (Phase A `db72592e5`) — `pg_advisory_xact_lock(99, hash)` at `resolve_conflict` entry, BEFORE `read_authoritative_value`. `_field_lock_key` extracted to `provenance/_lock.py` shared with `writer.py`. Concurrent e2e test (5 parallel asyncio.gather) verifies 1 written + 4 no_change + 0 leaks.
- [x] **All tests green** ✅ — 102 unit PASS + 11 targeted e2e PASS (real PG via SSH tunnel, 4m38s).
- [x] **I1 fixed** ✅ — `clean_tenant` extended (field_provenance / factory_provenance_config / smart_bi_pg_excel_uploads with sentinel guard).
- [x] **I4 fixed** ✅ — `@functools.cache` + `invalidate_provenance_flag_cache()` + autouse fixture in conftest.py.
- [x] **I5 fixed** ✅ — narrowed to `(UniqueViolationError, ForeignKeyViolationError, SerializationError, DeadlockDetectedError)`. RLS / OSError propagate.
- [x] **I6 fixed** ✅ (bonus from Phase A) — branch split: `lower_priority` / `significant_diff_same_priority` / `minor_diff_same_priority`.
- [x] **I7 fixed** ✅ (bonus from Phase A) — per-field `async with conn.transaction()` SAVEPOINT in writer hook.
- [ ] **IMP-1 spec doc update** ⚠️ (NEW, post-Phase-B audit) — strongly recommended before flag flip. See section below.
- [ ] Test smartbi_db migrations (V20260430_01, V20260501_01..03) applied to **prod smartbi_prod_db** (currently test only)
- [ ] One-week observation period in test environment with `SMARTBI_ENABLE_PROVENANCE=1` + real upload flows
- [ ] Friendly customer cohort selected (suggest reuse A's `RES_3101_009` as first prod factory)

**Open non-gating cleanup** (carry to Day 13+): I2 / I3 / M1-M6 + new IMP-2..5 below.

---

## Phase A+B re-audit findings (2026-04-27)

Re-audit of commits `db72592e5..a3dbbfccd` confirmed all Critical + 5 Important from prior audit are properly closed. 5 NEW Important issues surfaced — none gate merge, IMP-1 strongly recommended before flag flip:

### IMP-1. Spec doc out of sync with compound `field_name` convention (PRE-FLIP RECOMMENDED)
**File**: `数据织网/04-C-字段血统与继承.md` v1.3 — needs §3.1.5 or §6.3 sub-section documenting:
- Compound `field_name` convention `<base>@store_<id>` (Phase B introduced)
- Reader query patterns: `WHERE field_name = 'revenue'` (bare/global) / `'revenue@store_42'` (specific) / `LIKE 'revenue@store_%'` (all stores) / `LIKE 'revenue%'` (everything)
- `_field_type` `@`-strip behavior (preserves C-7 30%-diff numeric typing)
- Audit-page UI must split base/qualifier when displaying

**Why gating**: Day 13+ inheritance cascade engine (and audit page UI) subagents read this spec for reader code. Without IMP-1, those sessions write reader code that misses per-store rows.

### IMP-2. Silent drop of NULL-voucher_date provenance has no observability
**File**: `backend/python/smartbi/canonical/silver_writers/finance_writer.py:174-175`
**Fix**: Add WARNING log with skip count when rollup loop drops rows. ~5 min.

### IMP-3. ReviewWriter aggregation collapse not isolated to provenance
**File**: `backend/python/smartbi/canonical/silver_writers/review_writer.py:67-113, 158-192`
**Pre-existing issue**: `product_id_for_summary` set to FIRST non-null product_id; multi-product-per-upload reviews collapse to one row with misattributed aggregate stats. Phase B's "false positive" rationale only papers over the symptom at the provenance hook layer.
**Fix options**: (1) Document as known limitation in spec §4.2 + verify cohort (RES_3101_009) only uploads single-product reviews (~10 min doc); OR (2) promote ReviewWriter to compound `field_name@product_<id>` for true per-product lineage (~1 hr code + 2 e2e).

### IMP-4. `field_name` length budget not asserted; future fields could overflow VARCHAR(100)
**File**: `backend/python/smartbi/database/migrations/V20260430_01__c_field_provenance.sql:55`
**Fix**: Either widen to VARCHAR(200) in a new migration, OR add `assert len(field_name) <= 100` in `write_provenance` with clear error message. Migration is safer (DB-enforced).

### IMP-5. Test isolation under failure scenarios (NIT, current state correct)
**File**: `backend/python/tests/test_data_fabric_e2e.py:114-129`
On inspection, `_clean()` runs both before AND after each test (lines 154-158 — `clean_tenant` fixture finally clause). So this is actually correct. Downgrade to NIT — verify under failure mode if questions arise.

### Minor (re-audit): MIN-1..5
- MIN-1: I7 SAVEPOINT only correct when caller is in transaction — add runtime assertion (`conn.is_in_transaction()` check). Defensive.
- MIN-2: `_field_type` `@`-strip ambiguous for legitimate `@`-containing field names. Future-proofing only.
- MIN-3: `error_swallowed` counter exists but no monitoring hookup. Wire to log/Prometheus before flag flip.
- MIN-4: dim_finance_subject / dim_ingredient persistence between e2e tests — current scope-by-factory_id cleanup correct, just noting design.
- MIN-5: `pos_excel` priority entry vestigial (carry-over M3 from prior audit).

---

## Day 13+ session continuation

**Updated 2026-04-27**: Phase A+B closed all original Critical + 5 Important. Day 13+ next steps:

1. **Pre flag-flip required**: IMP-1 spec doc update (~30 min, doc-only) — gates Day 13+ subagent correctness.
2. **Pre flag-flip recommended**: IMP-2 + MIN-3 (observability of skipped/swallowed counters) — combined ~20 min.
3. **Pre flag-flip assess**: IMP-3 ReviewWriter cohort assumption (verify or add compound name).
4. **Day 13+ cascade work** (separate session): Day 13-15 inheritance cascade engine (compute_dish_margin / 时间继承 / industry_default fallback).
5. **Day 16-22 backlog**: BF1-3 backfill 1.31M historical rows.
6. **Day 23-30 backlog**: Trust UI + admin config UI + flag flip soak.

**Don't flip the flag in prod** until IMP-1 + soak period + cohort verification complete.
