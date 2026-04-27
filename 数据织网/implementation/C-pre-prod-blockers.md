# Sub-Project C — Pre-Prod-Activation Blockers

**Date**: 2026-04-26 (post-Day-12 holistic audit)
**Source**: superpowers:code-reviewer audit of commits `498a8ab56..4b82c98c0` (8 C commits Day 6-12)
**Status**: Day 12 merge **SAFE** (env flag `SMARTBI_ENABLE_PROVENANCE` default OFF → writer hooks inert in prod). These items gate the Day 23+ flag-flip event, NOT the Day 12 merge.

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

- [ ] **C1 fixed** with multi-dimensional anchor implementation chosen + e2e tests added
- [ ] **C2 fixed** with advisory lock at `resolve_conflict` entry + concurrent e2e test added
- [ ] All 89+ unit + 7+ e2e + new tests still green
- [ ] **I1 fixed** (test cleanup) — non-blocking but recommended before any QA cycle
- [ ] **I4 fixed** (env flag cache) so flag flip is process-restart-only — clearer ops semantics
- [ ] **I5 fixed** (narrow exception swallow) so misconfigured RLS / network errors surface
- [ ] Test smartbi_db migrations (V20260430_01, V20260501_01..03) applied to **prod smartbi_prod_db** (currently test only)
- [ ] One-week observation period in test environment with `SMARTBI_ENABLE_PROVENANCE=1` + real upload flows
- [ ] Friendly customer cohort selected (suggest reuse A's `RES_3101_009` as first prod factory)

I2 / I3 / I6 / I7 / M1-M6 are not gating but worthwhile cleanup before/during Day 13+ inheritance cascade work.

---

## Day 13+ session continuation

Suggested order:
1. Fix C2 (cleanest, ~30 min, isolated to `conflict_resolver.py` + 1 new e2e)
2. Fix I1 + I4 + I5 + I6 + I7 (~1 hr total, mostly tactical)
3. Fix C1 (~2 hr, requires schema/anchor decision + 4 writers updated + 4 multi-dim e2e tests)
4. Run full audit again before considering flag flip
5. Then proceed to Day 13-15 inheritance cascade engine

**Don't flip the flag in prod** until items above complete + soak period.
