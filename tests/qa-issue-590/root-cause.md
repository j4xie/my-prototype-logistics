# Issue #590 — Root Cause Analysis

**Status:** Fixed (V20260515_01 applied to prod 2026-05-14 13:25 CST)
**Bug duration:** 2026-04-28 12:15 CST → 2026-05-14 13:25 CST (~16 days)
**Lost rows:** ~1649 telemetry records (id 4786 → 6434)
**Severity:** P2 — observability blind, not user-facing

## TL;DR

PR #576 (V20260514_01, May 13) was supposed to fix `smart_bi_llm_usage`
flush by allowing system-level NULL `factory_id` rows when the session
GUC `app.factory_id` is unset. The policy works in that case — but in
production the GUC is **never** unset for the flush loop. The asyncpg
pool's setup callback always writes the literal `'__internal__'`
sentinel, so PR #576's "GUC unset" branch never fires. The flush has
been failing continuously since V20260514_01 was deployed.

## The trail

### What broke first (Apr 27 23:23 EDT → Apr 28 01:07 EDT)

- `f4e090d4d` — "RLS on 20 more factory-scoped tables" added FORCE RLS
  to `smart_bi_llm_usage` plus 22 others, with the V20260502_03/04
  pattern: `tenant_insert WITH CHECK (factory_id IS NOT NULL ...)`.
- `2b4e6d4bb` (V20260502_05) — tightened the policy to block the
  `'__internal__'` sentinel, intentionally to stop bg tasks from writing
  to tenant business tables. This silently caught `smart_bi_llm_usage`
  too, which is telemetry, not business data. Last successful insert:
  2026-04-28 12:15 CST.

### The first attempt (May 13)

PR #576 (V20260514_01) recognized the bg flush issue and added a branch
for system-level NULL rows:

```sql
factory_id IS NULL AND (
    current_setting('app.factory_id', true) IS NULL
    OR current_setting('app.factory_id', true) = ''
)
```

The author's verification block (in the migration comments) uses:

```sql
RESET app.factory_id;  -- GUC truly unset
INSERT INTO smart_bi_llm_usage ... VALUES (..., NULL, ...);
```

That branch evaluates `TRUE AND (TRUE OR FALSE) = TRUE` — passes.

### Why the fix didn't work in prod

`backend/python/smartbi/config.py:204-209`:

```python
_pg_pool = await asyncpg.create_pool(
    pg_url,
    min_size=2,
    max_size=settings.postgres_pool_size or 5,
    setup=set_pg_connection_tenant,  # <-- this runs every checkout
)
```

`backend/python/smartbi/tenant_ctx.py:68-80`:

```python
async def set_pg_connection_tenant(conn):
    fid = get_factory_id() or INTERNAL_SENTINEL  # = '__internal__'
    await conn.execute(
        "SELECT set_config('app.factory_id', $1, false)", fid
    )
```

The flush loop in `common.llm_metrics._flush_loop` runs as a bg
`asyncio.create_task` spawned in lifespan. It has no tenant ContextVar
set. So `get_factory_id()` returns `None`, the setup callback applies
`'__internal__'`, and PR #576's policy evaluates:

```sql
factory_id IS NULL                              -- TRUE  (record has NULL)
AND (GUC IS NULL OR GUC = '')                   -- FALSE — GUC is '__internal__'
```

Result: FALSE. The INSERT is rejected. Every 20-30 seconds.

### The test gap

PR #576 was tested with `RESET app.factory_id` — i.e. truly-unset GUC.
That bypasses the pool setup callback that actually runs in prod. The
right test is to acquire a connection from the same pool the flush loop
uses, observe `current_setting('app.factory_id')` returns
`'__internal__'`, and then INSERT.

## The fix (V20260515_01)

Extend the policy to treat `'__internal__'` as equivalent to GUC-unset
for INSERT only:

```sql
(factory_id IS NULL
 AND (current_setting('app.factory_id', true) IS NULL
      OR current_setting('app.factory_id', true) = ''
      OR current_setting('app.factory_id', true) = '__internal__'))
OR
(factory_id IS NOT NULL AND (
    current_setting('app.factory_id', true) IS NULL
    OR current_setting('app.factory_id', true) = ''
    OR current_setting('app.factory_id', true) = '__internal__'
    OR factory_id = current_setting('app.factory_id', true)
))
```

The sentinel marks a system-level bg task (per
`smartbi.tenant_ctx.INTERNAL_SENTINEL`) and is the legitimate writer of
telemetry rows. Tenant business tables — the 22 others tightened in
V20260502_05 — are NOT touched and continue rejecting `'__internal__'`.

### Security matrix preserved

|  GUC                  | factory_id | Outcome                  |
|-----------------------|------------|--------------------------|
| unset / '' / NULL     | NULL       | PASS (admin)             |
| unset / '' / NULL     | F001       | PASS (admin backfill)    |
| `'__internal__'`      | NULL       | PASS (bg flush, NEW)     |
| `'__internal__'`      | F001       | PASS (bg flush, NEW)     |
| `'F001'`              | F001       | PASS (tenant write)      |
| `'F001'`              | NULL       | REJECT (tenant must bind) |
| `'F001'`              | F002       | REJECT (cross-tenant)    |

Verified live on prod 2026-05-14 — see `repro.log` Phase 6 and
`post-deploy-verify.log`.

## Why not patch the code instead?

Two alternatives considered and rejected:

1. **Strip the GUC in the flush loop**: have `_flush_loop` execute
   `SELECT set_config('app.factory_id', '', false)` before the INSERT.
   Works, but requires every future bg-task writer to know the same
   trick, and obscures the security model. The policy should describe
   the intent (telemetry accepts bg-task writes) directly.

2. **Use a separate pool with `setup=None`**: spin up a dedicated
   asyncpg pool just for the flush loop. Doubles connection overhead
   for one writer and adds infra for a single telemetry table. Overkill.

The policy fix is scoped to one table, atomic (DROP + CREATE), and
fully reversible.

## Why was this missed?

Saved as feedback: `feedback_test_rls_with_real_pool_not_psql_reset.md` —
RLS policy changes must be tested against the same asyncpg pool used in
production (with its `setup=` callback active), not a bare psql session
with `RESET <guc>`. The pool-setup layer is part of the policy contract
and ignoring it gives a false-pass.
