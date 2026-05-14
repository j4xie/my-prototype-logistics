-- Allow GUC '__internal__' sentinel for smart_bi_llm_usage INSERTs.
--
-- Context (May 14 2026, Issue #590):
-- PR #576 (V20260514_01) intended to fix `LLM usage flush failed: new row
-- violates row-level security policy` by allowing factory_id IS NULL when
-- the session GUC `app.factory_id` is unset (NULL or empty). It was
-- verified locally with `RESET app.factory_id` / no GUC set.
--
-- Bug missed by PR #576:
-- The asyncpg pool used by the flush loop registers a `setup` callback
-- (smartbi.tenant_ctx.set_pg_connection_tenant) that ALWAYS calls
--   SELECT set_config('app.factory_id', <fid or '__internal__'>, false)
-- on every connection checkout. When the bg flush loop acquires a
-- connection, no tenant ContextVar is set, so the setup callback writes
-- the sentinel value '__internal__'. The GUC is therefore NEVER unset
-- for the flush loop — it is always '__internal__' — and PR #576's
-- `GUC IS NULL OR GUC = ''` branch never fires. Result: the same RLS
-- rejection has continued every flush cycle since V20260514_01 was applied.
--
-- Reproduced May 14 2026 against prod with the cretas_user / smartbi_user
-- session (post PR #576 deploy):
--   SET ROLE smartbi_user;
--   SELECT set_config('app.factory_id', '__internal__', false);
--   INSERT INTO smart_bi_llm_usage (provider, model, caller, factory_id)
--     VALUES ('test', 'test', 'repro-590', NULL);
--   -- ERROR: new row violates row-level security policy
--
-- Live log confirms the same WARNING every 20-30 seconds:
--   common.llm_metrics - WARNING - LLM usage flush failed: new row
--   violates row-level security policy for table "smart_bi_llm_usage"
--
-- Fix:
-- Extend the policy to treat '__internal__' as equivalent to GUC-unset
-- for both NULL and non-NULL factory_id INSERTs. The sentinel marks a
-- system-level bg task (per smartbi.tenant_ctx.INTERNAL_SENTINEL) and is
-- the legitimate writer of telemetry. The 22 other tables tightened in
-- V20260502_05 are NOT in scope — they hold tenant business data and
-- must continue rejecting '__internal__' writes.
--
-- Tenant-isolation matrix after this migration:
--   GUC unset       + factory_id NULL  → PASS (admin)
--   GUC unset       + factory_id F001  → PASS (admin backfill)
--   GUC ''          + factory_id NULL  → PASS (admin)
--   GUC '__internal__' + factory_id NULL  → PASS (bg flush system row)   ← NEW
--   GUC '__internal__' + factory_id F001  → PASS (bg flush tagged row)   ← NEW
--   GUC 'F001'      + factory_id F001  → PASS (tenant write)
--   GUC 'F001'      + factory_id NULL  → REJECT (tenant must bind)
--   GUC 'F001'      + factory_id F002  → REJECT (cross-tenant forge)

DROP POLICY IF EXISTS tenant_insert ON smart_bi_llm_usage;

CREATE POLICY tenant_insert ON smart_bi_llm_usage FOR INSERT WITH CHECK (
    -- Case 1: system-level (admin / migration / bg flush) — factory_id is
    -- NULL and the session GUC is at a no-tenant marker (NULL, empty, or
    -- the '__internal__' sentinel emitted by the asyncpg pool setup).
    (factory_id IS NULL
     AND (current_setting('app.factory_id', true) IS NULL
          OR current_setting('app.factory_id', true) = ''
          OR current_setting('app.factory_id', true) = '__internal__'))
    -- Case 2: tenant write — factory_id is set and either binds to GUC,
    -- or the session is at a no-tenant marker (admin backfill / bg flush
    -- of a tenant-tagged record captured via llm_caller_context).
    OR (factory_id IS NOT NULL AND (
        current_setting('app.factory_id', true) IS NULL
        OR current_setting('app.factory_id', true) = ''
        OR current_setting('app.factory_id', true) = '__internal__'
        OR factory_id = current_setting('app.factory_id', true)
    ))
);

-- Verification (run after apply):
--   -- Test 1: system-level bg flush with sentinel (should PASS — the bug fix)
--   SET ROLE smartbi_user;
--   SELECT set_config('app.factory_id', '__internal__', false);
--   INSERT INTO smart_bi_llm_usage (provider, model, caller, factory_id, status_code)
--     VALUES ('dashscope', 'qwen-flash', 'verify-590', NULL, 200);
--
--   -- Test 2: tenant write under sentinel (bg flush of a tagged record — should PASS)
--   SELECT set_config('app.factory_id', '__internal__', false);
--   INSERT INTO smart_bi_llm_usage (provider, model, caller, factory_id, status_code)
--     VALUES ('dashscope', 'qwen-flash', 'verify-590', 'F001', 200);
--
--   -- Test 3: cross-tenant write under F001 GUC (should FAIL)
--   SELECT set_config('app.factory_id', 'F001', false);
--   INSERT INTO smart_bi_llm_usage (provider, model, caller, factory_id, status_code)
--     VALUES ('dashscope', 'qwen-flash', 'verify-590', 'F002', 200);
--   -- expected: ERROR: new row violates row-level security policy
--
--   -- Test 4: NULL under F001 GUC (should FAIL — tenant session must bind)
--   SELECT set_config('app.factory_id', 'F001', false);
--   INSERT INTO smart_bi_llm_usage (provider, model, caller, factory_id, status_code)
--     VALUES ('dashscope', 'qwen-flash', 'verify-590', NULL, 200);
--   -- expected: ERROR: new row violates row-level security policy
--
--   -- Cleanup (run as postgres / admin):
--   --   DELETE FROM smart_bi_llm_usage WHERE caller = 'verify-590';
