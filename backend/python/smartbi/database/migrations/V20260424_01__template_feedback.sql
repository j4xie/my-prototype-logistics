-- Extend llm_fallback_log to also carry template-hit feedback.
--
-- Background: the original table only stored LLM-fallback answers (novel
-- queries). Template-matched answers (the fast ~0.5s path that serves 90%+
-- of queries) had no row here, so users had no 👍/👎 control over them. That
-- meant mismapped KPIs and bad chart labels went unreported.
--
-- This migration adds two columns so one row can represent either path:
--   source       — 'llm' (default, existing rows) | 'template'
--   template_code — the matched template code, populated only when source='template'
--
-- Existing rows default to source='llm', so the semantic meaning of the table
-- widens without migration of historical data.

ALTER TABLE smart_bi_llm_fallback_log
    ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'llm';

ALTER TABLE smart_bi_llm_fallback_log
    ADD COLUMN IF NOT EXISTS template_code VARCHAR(100);

-- Feedback dashboards need to filter by source + template
CREATE INDEX IF NOT EXISTS idx_fallback_log_source_template
    ON smart_bi_llm_fallback_log (source, template_code, created_at DESC)
    WHERE source = 'template';

-- Rollback:
--   DROP INDEX IF EXISTS idx_fallback_log_source_template;
--   ALTER TABLE smart_bi_llm_fallback_log DROP COLUMN IF EXISTS template_code;
--   ALTER TABLE smart_bi_llm_fallback_log DROP COLUMN IF EXISTS source;
