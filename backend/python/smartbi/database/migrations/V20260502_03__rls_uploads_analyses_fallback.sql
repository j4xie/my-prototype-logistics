-- P0 SECURITY (Apr 28 2026): Enable RLS on 3 factory-scoped tables that have
-- been completely unprotected at PG level.
--
-- Background: qa-prompt v2.4 Phase 9 cross-tenant verify caught these tables
-- can be SELECTed and DELETEd across tenants by any factory's smartbi_user.
-- Application code uses `WHERE factory_id = $X` everywhere as the only
-- isolation barrier — no defense-in-depth. See
-- docs/security/2026-04-28-rls-gap-uploads-analyses-fallback.md.
--
-- Mirroring the policy pattern from V20260501_02 (factory_provenance_config),
-- V20260430_01 (field_provenance), narrative_cache (V20260427_xx), etc.
--
-- IMPORTANT — broken-site policy:
--   With strict policy `USING (factory_id = current_setting('app.factory_id', true))`,
--   any query site that does NOT call `SELECT set_config('app.factory_id', $1, true)`
--   first will return 0 rows / fail INSERT (RLS WITH CHECK).
--
--   This migration uses STRICT policy. Sites that break:
--     - List of known sites tracked in
--       docs/security/2026-04-28-rls-gap-uploads-analyses-fallback.md
--     - Admin/cron paths must add GUC explicitly OR use a BYPASSRLS role.
--
--   Test on test env first. If broken sites are too widespread, ROLLBACK
--   via `ALTER TABLE ... DISABLE ROW LEVEL SECURITY; DROP POLICY tenant_isolation`
--   and convert to a soft policy with NULL-passthrough (less secure but
--   non-breaking). Document choice in the security doc above.

-- ============================================================
-- 1. smart_bi_pg_excel_uploads
-- ============================================================
ALTER TABLE smart_bi_pg_excel_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_pg_excel_uploads FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON smart_bi_pg_excel_uploads
  USING (factory_id = current_setting('app.factory_id', true))
  WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- ============================================================
-- 2. smart_bi_pg_analysis_results
-- ============================================================
ALTER TABLE smart_bi_pg_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_pg_analysis_results FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON smart_bi_pg_analysis_results
  USING (factory_id = current_setting('app.factory_id', true))
  WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- ============================================================
-- 3. smart_bi_llm_fallback_log
-- ============================================================
ALTER TABLE smart_bi_llm_fallback_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_llm_fallback_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON smart_bi_llm_fallback_log
  USING (factory_id = current_setting('app.factory_id', true))
  WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- Verify (Apr 28 2026 manual checks):
--   SELECT relname, relrowsecurity, relforcerowsecurity
--     FROM pg_class
--    WHERE relname IN ('smart_bi_pg_excel_uploads',
--                      'smart_bi_pg_analysis_results',
--                      'smart_bi_llm_fallback_log');
--   → all 3 should show t/t after this migration.
--
--   SET app.factory_id='F002';
--   SELECT COUNT(*) FROM smart_bi_pg_excel_uploads WHERE factory_id='F001';
--   → should return 0 (was 3 before migration).
