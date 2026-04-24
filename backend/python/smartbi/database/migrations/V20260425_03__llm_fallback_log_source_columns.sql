-- Add `source` + `template_code` columns to smart_bi_llm_fallback_log
-- Found via Python perf audit 2026-04-24: log_template_hit() inserts these columns
-- but migration never created them → silent warning spam in python-prod.log
--
-- source: 'template' (cache hit) | 'fallback' (LLM call)
-- template_code: which template was hit (e.g. 'reviews_sentiment_summary')

ALTER TABLE smart_bi_llm_fallback_log
ADD COLUMN IF NOT EXISTS source VARCHAR(50);

ALTER TABLE smart_bi_llm_fallback_log
ADD COLUMN IF NOT EXISTS template_code VARCHAR(100);

COMMENT ON COLUMN smart_bi_llm_fallback_log.source IS 'Origin of the answer: template (cache hit) or fallback (LLM call)';
COMMENT ON COLUMN smart_bi_llm_fallback_log.template_code IS 'Template code when source=template; null otherwise';

-- Index for analytics: which templates get hit most
CREATE INDEX IF NOT EXISTS idx_fallback_log_template_code
  ON smart_bi_llm_fallback_log (template_code, created_at DESC)
  WHERE template_code IS NOT NULL;
