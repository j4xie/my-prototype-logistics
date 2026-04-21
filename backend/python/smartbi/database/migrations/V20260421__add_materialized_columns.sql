-- Add domain/template_code/schema_version to smart_bi_pg_analysis_results
-- for materialized analytics pre-compute lookup.
ALTER TABLE smart_bi_pg_analysis_results
    ADD COLUMN IF NOT EXISTS domain VARCHAR(50),
    ADD COLUMN IF NOT EXISTS template_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 1;

-- Composite index for upload_id + template_code lookup (W1 hot path)
CREATE INDEX IF NOT EXISTS idx_analysis_upload_template
    ON smart_bi_pg_analysis_results (upload_id, template_code)
    WHERE template_code IS NOT NULL;

-- Domain index for multi-upload listing
CREATE INDEX IF NOT EXISTS idx_analysis_domain
    ON smart_bi_pg_analysis_results (domain, factory_id)
    WHERE domain IS NOT NULL;
