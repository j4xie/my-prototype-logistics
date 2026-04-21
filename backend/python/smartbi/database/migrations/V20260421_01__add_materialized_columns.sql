-- Add domain/template_code/schema_version to smart_bi_pg_analysis_results
-- for materialized analytics pre-compute lookup.
ALTER TABLE smart_bi_pg_analysis_results
    ADD COLUMN IF NOT EXISTS domain VARCHAR(50),
    ADD COLUMN IF NOT EXISTS template_code VARCHAR(100),
    -- schema_version tracks the template implementation version.
    -- Historical rows (pre-migration) pick up DEFAULT 1 — this is intentional
    -- and harmless: the column meaning is "which template schema produced this",
    -- and rows without template_code will ignore this field at read time.
    ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 1;

-- Composite index for GET /analytics/cached/{upload_id} hot path.
-- factory_id is included because the endpoint MUST filter by factory_id from
-- JWT for cross-tenant safety (Bug #318 intent: no cross-factory reads even
-- for pre-computed analyses). Partial index skips legacy rows without template_code.
CREATE INDEX IF NOT EXISTS idx_analysis_upload_factory_template
    ON smart_bi_pg_analysis_results (upload_id, factory_id, template_code)
    WHERE template_code IS NOT NULL;

-- Domain index for multi-upload listing (e.g., "show all restaurant analyses for factory X")
CREATE INDEX IF NOT EXISTS idx_analysis_domain
    ON smart_bi_pg_analysis_results (domain, factory_id)
    WHERE domain IS NOT NULL;

-- Rollback (if ever needed; test-only for now):
-- DROP INDEX IF EXISTS idx_analysis_upload_factory_template;
-- DROP INDEX IF EXISTS idx_analysis_domain;
-- ALTER TABLE smart_bi_pg_analysis_results
--     DROP COLUMN IF EXISTS domain,
--     DROP COLUMN IF EXISTS template_code,
--     DROP COLUMN IF EXISTS schema_version;
