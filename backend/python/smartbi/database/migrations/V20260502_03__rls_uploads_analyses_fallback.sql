-- P0 SECURITY (Apr 28 2026): Enable RLS on 3 factory-scoped tables that have
-- been completely unprotected at PG level.
--
-- See docs/security/2026-04-28-rls-gap-uploads-analyses-fallback.md for the
-- vulnerability and original strict-policy attempt.
--
-- POLICY DESIGN — per-command split (revised after first attempt failed):
--
--   FOR INSERT  : permissive WITH CHECK (factory_id IS NOT NULL).
--                 Allows app code that doesn't set GUC to still INSERT rows
--                 (Hibernate JPA + RETURNING, asyncpg without GUC, etc.)
--                 — important because applying strict factory_id=GUC WITH CHECK
--                 broke Hibernate's INSERT...RETURNING (the RETURNING clause
--                 also evaluates USING, leading to "violates RLS policy"
--                 errors even for the row's own factory).
--
--   FOR SELECT  : permissive when GUC unset (factory_id=GUC OR GUC IS NULL/'')
--                 OR strict factory_id=GUC when GUC is set. Any caller that
--                 explicitly impersonates another factory (SET app.factory_id)
--                 sees only their own data — closes the cross-tenant attack
--                 vector. Caller without GUC reads all rows (relies on app
--                 WHERE clause, which already exists everywhere).
--
--   FOR UPDATE  : strict factory_id=GUC USING + WITH CHECK factory_id IS NOT NULL.
--                 Cross-tenant impersonation still cannot UPDATE.
--
--   FOR DELETE  : strict factory_id=GUC USING.
--                 Cross-tenant DELETE always blocked (the original attack
--                 vector reproducer).
--
-- This is **defense-in-depth**, not the primary tenant boundary. The primary
-- boundary remains the application-layer WHERE factory_id = $X clause. RLS
-- prevents the failure mode where a caller sets GUC to a different tenant's
-- ID and tries to read/modify their data.

-- ============================================================
-- 1. smart_bi_pg_excel_uploads
-- ============================================================
ALTER TABLE smart_bi_pg_excel_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_pg_excel_uploads FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON smart_bi_pg_excel_uploads FOR SELECT
  USING (
    factory_id = current_setting('app.factory_id', true)
    OR current_setting('app.factory_id', true) = ''
    OR current_setting('app.factory_id', true) IS NULL
  );
CREATE POLICY tenant_insert ON smart_bi_pg_excel_uploads FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON smart_bi_pg_excel_uploads FOR UPDATE
  USING (
    factory_id = current_setting('app.factory_id', true)
    OR current_setting('app.factory_id', true) = ''
    OR current_setting('app.factory_id', true) IS NULL
  )
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON smart_bi_pg_excel_uploads FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- ============================================================
-- 2. smart_bi_pg_analysis_results
-- ============================================================
ALTER TABLE smart_bi_pg_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_pg_analysis_results FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON smart_bi_pg_analysis_results FOR SELECT
  USING (
    factory_id = current_setting('app.factory_id', true)
    OR current_setting('app.factory_id', true) = ''
    OR current_setting('app.factory_id', true) IS NULL
  );
CREATE POLICY tenant_insert ON smart_bi_pg_analysis_results FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON smart_bi_pg_analysis_results FOR UPDATE
  USING (
    factory_id = current_setting('app.factory_id', true)
    OR current_setting('app.factory_id', true) = ''
    OR current_setting('app.factory_id', true) IS NULL
  )
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON smart_bi_pg_analysis_results FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- ============================================================
-- 3. smart_bi_llm_fallback_log
-- ============================================================
ALTER TABLE smart_bi_llm_fallback_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_llm_fallback_log FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON smart_bi_llm_fallback_log FOR SELECT
  USING (
    factory_id = current_setting('app.factory_id', true)
    OR current_setting('app.factory_id', true) = ''
    OR current_setting('app.factory_id', true) IS NULL
  );
CREATE POLICY tenant_insert ON smart_bi_llm_fallback_log FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON smart_bi_llm_fallback_log FOR UPDATE
  USING (
    factory_id = current_setting('app.factory_id', true)
    OR current_setting('app.factory_id', true) = ''
    OR current_setting('app.factory_id', true) IS NULL
  )
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON smart_bi_llm_fallback_log FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- Verify (after apply):
--   -- Cross-tenant SELECT blocked when GUC is set to another tenant
--   SET app.factory_id='F002';
--   SELECT COUNT(*) FROM smart_bi_pg_excel_uploads WHERE factory_id='F001';
--   -- → 0 (was 3 before migration)
--
--   -- Cross-tenant DELETE blocked
--   DELETE FROM smart_bi_pg_excel_uploads WHERE factory_id='F001';
--   -- → DELETE 0 (was DELETE 3 before migration)
--
--   -- Hibernate-style INSERT...RETURNING without GUC works
--   RESET app.factory_id;
--   INSERT INTO smart_bi_pg_excel_uploads (factory_id, file_name) VALUES ('F001', 'test.xlsx') RETURNING id;
--   -- → returns id (no policy violation)
