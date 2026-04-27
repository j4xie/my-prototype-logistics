# Sub-Project C — Day 6+ Blockers

**Date**: 2026-04-26
**Source**: superpowers code-reviewer audit of `bb5bfc4cc` (C Day 1-5)

These items MUST be resolved before Day 6+ work that integrates field_provenance into B writers (dual-write hooks). Day 1-5 deferred them as acceptable simplifications, but Day 6+ correctness depends on them.

## 1. write_provenance must wrap advisory_xact_lock internally

**Today**: `smartbi/canonical/provenance/writer.py` accepts caller-side lock per spec C-3 / NS-3:
> caller should hold `pg_advisory_xact_lock(99::int, hashtext(factory||entity_type||entity_id||field_name)::int)`

**Why it matters Day 6+**: B writers (ProductSummaryWriter et al) call write_provenance from their write() methods. 5 writers × N developers will inevitably forget the lock. Race condition produces duplicate rows that violate uq_fp_dedup → UniqueViolationError, OR (worse) two writers each succeed because the index is partial WHERE superseded_by_id IS NULL and the timing leaves both as "active" momentarily.

**Fix in Day 6+**: wrap inside write_provenance:
```python
lock_key = abs(hash(f"{factory_id}|{entity_type}|{entity_id}|{field_name}")) % (2**31)
async with conn.transaction():
    await conn.execute("SELECT pg_advisory_xact_lock($1, $2)", 99, lock_key)
    # ... existing INSERT
```

## 2. read_authoritative_value must filter valid_to

**Today**: returns most-recent valid_from non-superseded, ignores valid_to.

**Why it matters Day 6+**: Once supersession lands, a row with valid_from=2025-01-01 + valid_to=2025-06-30 is NOT authoritative for 2025-12-15 — but current code returns it. Wrong cost values in margin calculations.

**Fix in Day 6+**: add `(valid_to IS NULL OR valid_to >= as_of)` to WHERE clause. as_of defaults to today.

## 3. Migration must add confidence_method / superseded_reason / created_by

**Today**: V20260430_01 omits these columns. Spec §2.1 lines 178-180 has them.

**Why it matters Day 6+**:
- `confidence_method`: Day 6 conflict-resolution priority chain consumes this (e.g., 'manual' > 'pos_excel_review' > 'inference')
- `superseded_reason`: Day 6 supersession audit needs reason text ('30%_diff_threshold', 'manual_override', 'newer_priority')
- `created_by`: GDPR audit + admin queue review needs user attribution

**Fix in Day 6+**: V20260501_01__c_provenance_columns_extension.sql adding the 3 columns + backfill any existing rows with defaults. Day 1-5's `notes` field can absorb superseded_reason TEMPORARILY but conflict resolution code expects the dedicated column.

## 4. uq_fp_dedup spec column-list deviation (NIT)

**Today**: `UNIQUE(factory_id, entity_type, entity_id, field_name, COALESCE(valid_from, '-infinity'::date)) WHERE superseded_by_id IS NULL`

**Spec §2.1 line 159**: `UNIQUE(factory_id, entity_type, entity_id, field_name, source_upload_id, valid_from)`

**Why it doesn't matter today**: Day 1-5 spec intent is "one active row per cell at any time" — Day 1-5 implementation enforces this via partial WHERE on `superseded_by_id IS NULL`. Spec's including `source_upload_id` in the key would let multiple uploads write the SAME (factory, entity, field, valid_from) which violates spec §3 conflict resolution intent.

**Fix Day 6+**: update spec line 159 to match migration. No code change needed.

## 5. Per-call asyncpg pool churn (architectural)

**Today**: Three subsystems (sheet_merger, b_writers, dual_write) each create their own pool per upload + close.

**Why it matters Day 6+**: C Day 6 dual-write integration adds a 4th pool churn site. Eventually 5+ subsystems all churning pools → connection storm under load.

**Fix Day 6+ or post-M2**: add `smartbi/canonical/_shared_pool.py` with `get_pool()` singleton, refactor 4 sites to share. Out of scope for current commit.

## 6. Real-PG integration tests for field_provenance (✅ FIXED in this commit)

This commit adds 4 e2e tests in test_data_fabric_e2e.py covering:
- write+read round-trip (sentinel upload_id default, asyncpg date round-trip)
- dedup unique violation on duplicate active row
- RLS WITH CHECK cross-tenant block
- ON DELETE RESTRICT FK orphan prevention

These fill the audit-flagged "16 tests are all mock-based" gap.

## 7. write_provenance must not pass NULL valid_from

**Today**: writer.py line 105 passes `valid_from` (Python `None` if caller omits) directly into the asyncpg `INSERT … VALUES ($9, …)` parameter list. asyncpg sends explicit NULL, which **bypasses** the `DEFAULT '-infinity'::date` clause — Postgres only applies the column DEFAULT when the column is omitted from the INSERT, not when it receives a NULL parameter. Result: `NotNullViolationError` whenever a caller leaves `valid_from` unset.

**Discovered**: Day 1-5 follow-up fix-pack (Apr 26 2026) — server-side run of `test_provenance_dedup_unique_violation_on_concurrent_write` and `test_provenance_fk_restrict_prevents_orphan` both raised `NotNullViolationError` until the tests were updated to pass `valid_from=date(...)` explicitly.

**Why mock tests didn't catch this**: unit tests use `AsyncMock` for `conn.fetchval`, so they never exercise the real `NOT NULL DEFAULT` semantics. Integration tests against real PG immediately surfaced it.

**Fix in Day 6+**: in `writer.py`, change the signature default behaviour — when `valid_from is None`, either:
- (a) pass `'-infinity'::date` literal (`valid_from = valid_from or date.min`), or
- (b) build the INSERT statement dynamically to OMIT the column when `valid_from` is None so the DB DEFAULT applies.

(a) is simpler and matches the spec's intent that `valid_from` is `'-infinity'` when not specified.

---

Block: Day 6+ session start MUST address items 1+2+3+7 before B writer dual-write hooks.
