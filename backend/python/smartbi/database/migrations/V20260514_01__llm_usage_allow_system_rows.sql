-- Allow system-level NULL factory_id for smart_bi_llm_usage (background flush).
--
-- Context (May 13 2026):
-- common.llm_metrics runs a background `_flush_loop` every 5s that drains
-- in-memory LLM usage records into smart_bi_llm_usage. The hook captures
-- `factory_id` from a ContextVar (`_llm_factory`) that defaults to None when
-- the caller is a system-level path (e.g. startup probes, model health
-- pings, semantic_mapper warmup, anything outside a request scope). The
-- flush acquires a raw asyncpg pool connection with no `app.factory_id`
-- GUC set, so `current_setting('app.factory_id', true)` returns NULL.
--
-- Pre-fix policy (from V20260502_05):
--   WITH CHECK (factory_id IS NOT NULL AND (
--     current_setting(...) IS NULL OR current_setting(...) = ''
--     OR factory_id = current_setting(...)
--   ))
-- This rejects rows with factory_id=NULL even when the session is GUC-unset
-- (admin/migration/bg flush), producing a `LLM usage flush failed: new row
-- violates row-level security policy` warning every flush cycle in
-- python-prod.log.
--
-- Fix: allow factory_id IS NULL when the session is also GUC-unset (i.e.
-- system-level admin/migration/bg-task session). Tenant-scoped rows still
-- bind to GUC strictly. We do NOT allow a tenant session (GUC set) to
-- insert a NULL factory_id row — that would be a tenant-isolation escape.
--
-- Equivalence with V20260502_05 reasoning:
-- - GUC unset + factory_id NULL  → allow (NEW: system bg flush)
-- - GUC unset + factory_id set    → allow (admin migration backfill)
-- - GUC set   + factory_id = GUC  → allow (normal tenant write)
-- - GUC set   + factory_id != GUC → reject (cross-tenant forge)
-- - GUC set   + factory_id NULL   → reject (still tenant-bound)
--
-- Scope: ONLY smart_bi_llm_usage. The other 22 tables tightened in
-- V20260502_05 are factory-scoped business data — they must NOT accept
-- NULL factory_id. llm_usage is observability/telemetry, not tenant data.

DROP POLICY IF EXISTS tenant_insert ON smart_bi_llm_usage;

CREATE POLICY tenant_insert ON smart_bi_llm_usage FOR INSERT WITH CHECK (
    -- Case 1: system-level bg flush — both factory_id and GUC are unset
    (factory_id IS NULL
     AND (current_setting('app.factory_id', true) IS NULL
          OR current_setting('app.factory_id', true) = ''))
    -- Case 2: tenant write — factory_id bound to GUC (or admin/migration GUC-unset)
    OR (factory_id IS NOT NULL AND (
        current_setting('app.factory_id', true) IS NULL
        OR current_setting('app.factory_id', true) = ''
        OR factory_id = current_setting('app.factory_id', true)
    ))
);

-- Verification (run after apply):
--   -- Test 1: system-level bg flush (should PASS)
--   RESET app.factory_id;
--   INSERT INTO smart_bi_llm_usage (provider, model, caller, status_code)
--     VALUES ('dashscope', 'qwen-flash', 'startup_probe', 200);
--
--   -- Test 2: F001 tenant insert with matching GUC (should PASS)
--   SET app.factory_id = 'F001';
--   INSERT INTO smart_bi_llm_usage (factory_id, provider, model, caller, status_code)
--     VALUES ('F001', 'dashscope', 'qwen-flash', 'semantic_mapper', 200);
--
--   -- Test 3: F002 insert under F001 GUC (should FAIL — cross-tenant escape)
--   SET app.factory_id = 'F001';
--   INSERT INTO smart_bi_llm_usage (factory_id, provider, model, caller, status_code)
--     VALUES ('F002', 'dashscope', 'qwen-flash', 'semantic_mapper', 200);
--   -- expected: ERROR: new row violates row-level security policy
--
--   -- Test 4: NULL factory_id under F001 GUC (should FAIL — tenant session must bind)
--   SET app.factory_id = 'F001';
--   INSERT INTO smart_bi_llm_usage (provider, model, caller, status_code)
--     VALUES ('dashscope', 'qwen-flash', 'semantic_mapper', 200);
--   -- expected: ERROR: new row violates row-level security policy
