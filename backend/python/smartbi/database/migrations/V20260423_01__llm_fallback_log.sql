-- Log every LLM-fallback query for Phase 2 pattern clustering + Phase 3 RAG.
--
-- Each row is one SSE chat answer that went through the LLM (not a template
-- hit). query_embedding is the DashScope text-embedding-v3 vector of the
-- user's query, used later for DBSCAN clustering and RAG similarity search.
--
-- Designed to be written fire-and-forget from chat.py after the `done` SSE
-- event. Failure to log must not affect the user's answer.

CREATE TABLE IF NOT EXISTS smart_bi_llm_fallback_log (
    id BIGSERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    factory_id VARCHAR(50),
    upload_id BIGINT,
    -- First 4000 chars of the LLM answer. Rarely longer — we've seen 200-600
    -- char answers in practice. Full text cap at 4000 to bound row size.
    answer TEXT,
    -- Structured metadata about what aggregates the LLM saw:
    -- { "time_filter": "9月", "agg_lines_count": 23, "primary_measure": "营业额",
    --   "hoisted_dims": ["门店"], "has_entity_lookups": true }
    agg_meta JSONB,
    -- DashScope text-embedding-v3 output (768 dims). Null if embedding failed.
    query_embedding vector(768),
    -- Conversation history at time of query: [{role, content}, ...]. Null if
    -- first-turn (no prior context). Capped at last 6 messages per Fix 2.
    history JSONB,
    -- User feedback: null = no feedback yet, 1 = 👍, -1 = 👎
    user_feedback SMALLINT,
    -- Optional free-form comment from the 👎 flow
    feedback_comment TEXT,
    -- Latency metrics (ms)
    total_wall_ms INTEGER,
    llm_wall_ms INTEGER,
    -- When this query fires → promoted template (filled by Phase 4 if/when
    -- the query gets absorbed by a new template).
    promoted_to_template VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time-range queries (dashboard, weekly batch)
CREATE INDEX IF NOT EXISTS idx_fallback_log_created_at
    ON smart_bi_llm_fallback_log (created_at DESC);

-- Per-factory filter
CREATE INDEX IF NOT EXISTS idx_fallback_log_factory
    ON smart_bi_llm_fallback_log (factory_id, created_at DESC);

-- Approximate nearest-neighbor search on query_embedding for Phase 3 RAG.
-- HNSW is the faster index type for pgvector (vs IVF); good for <1M rows.
CREATE INDEX IF NOT EXISTS idx_fallback_log_embedding
    ON smart_bi_llm_fallback_log
    USING hnsw (query_embedding vector_cosine_ops);

-- Feedback-filtered queries (find thumbs-down for improvement)
CREATE INDEX IF NOT EXISTS idx_fallback_log_feedback
    ON smart_bi_llm_fallback_log (user_feedback, created_at DESC)
    WHERE user_feedback IS NOT NULL;

-- Rollback:
--   DROP INDEX IF EXISTS idx_fallback_log_feedback;
--   DROP INDEX IF EXISTS idx_fallback_log_embedding;
--   DROP INDEX IF EXISTS idx_fallback_log_factory;
--   DROP INDEX IF EXISTS idx_fallback_log_created_at;
--   DROP TABLE IF EXISTS smart_bi_llm_fallback_log;
