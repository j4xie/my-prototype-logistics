-- v4 B2-B (Apr 26 2026): LLM-answer cache for repeat queries.
--
-- Background: S4 v4 audit showed 87% of follow-ups go through LLM (12s avg).
-- Many are repeat queries within 24h ("销量 Top 10" asked daily by same user).
-- LLM-answer cache lets the 2nd+ call return in 200ms instead of 12s.
--
-- Key composition: SHA256(factory_id || '|' || normalized_query || '|' ||
-- upload_id_or_zero) — separator ensures collision-free; factory_id in hash
-- is belt-and-suspenders (PK already includes it).
--
-- Invalidation: TTL 24h + `invalidate_on_upload(factory_id)` on new upload.

CREATE TABLE IF NOT EXISTS smart_bi_llm_answer_cache (
    id              BIGSERIAL PRIMARY KEY,
    cache_key       VARCHAR(64) NOT NULL UNIQUE,  -- SHA256 hex (24 chars sufficient but use full for safety)
    factory_id      VARCHAR(50) NOT NULL,
    upload_id       BIGINT,                         -- nullable (standalone queries)
    normalized_q    TEXT NOT NULL,                  -- for debugging — what query was hashed
    answer_text     TEXT NOT NULL,                  -- full_text payload
    charts_json     JSONB,                          -- charts array (may be empty [])
    warning         TEXT,                           -- numeric_hallucination warning if any
    hit_count       INTEGER NOT NULL DEFAULT 0,     -- how many times this entry has been re-served
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    last_hit_at     TIMESTAMP,
    expires_at      TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_llm_answer_cache_factory ON smart_bi_llm_answer_cache(factory_id);
CREATE INDEX IF NOT EXISTS idx_llm_answer_cache_upload ON smart_bi_llm_answer_cache(upload_id);
CREATE INDEX IF NOT EXISTS idx_llm_answer_cache_expires ON smart_bi_llm_answer_cache(expires_at);

COMMENT ON TABLE smart_bi_llm_answer_cache IS
    'v4 B2-B repeat-query cache. Key=SHA256(factory||normalized_q||upload_id). 24h TTL.';
COMMENT ON COLUMN smart_bi_llm_answer_cache.normalized_q IS
    'Original query after query_normalizer. Stored for debugging only — not used for lookup.';
