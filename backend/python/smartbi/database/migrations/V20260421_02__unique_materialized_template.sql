-- Task 11 persistence requires a UNIQUE constraint on (upload_id, template_code)
-- for ON CONFLICT upsert to work. The existing idx_analysis_upload_factory_template
-- (from V20260421_01) is a plain INDEX; ON CONFLICT requires UNIQUE.
-- Partial UNIQUE excludes pre-existing rows (template_code NULL) that predate
-- materialized analytics.
CREATE UNIQUE INDEX IF NOT EXISTS uq_analysis_upload_template
    ON smart_bi_pg_analysis_results (upload_id, template_code)
    WHERE template_code IS NOT NULL;

-- Rollback:
-- DROP INDEX IF EXISTS uq_analysis_upload_template;
