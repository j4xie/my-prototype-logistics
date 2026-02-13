-- ============================================================
-- Food Knowledge Base Feedback Tables
-- Migration: 20260213
-- Database: cretas_db (PostgreSQL)
-- ============================================================

-- 1. Explicit + Implicit + Expert feedback
CREATE TABLE IF NOT EXISTS food_kb_feedback (
    id              SERIAL PRIMARY KEY,
    query           TEXT NOT NULL,
    answer          TEXT,
    retrieved_doc_ids    INTEGER[],
    retrieved_doc_titles TEXT[],
    rating          SMALLINT CHECK (rating >= 1 AND rating <= 5),
    feedback_type   VARCHAR(20) NOT NULL DEFAULT 'explicit',   -- explicit / implicit / expert
    feedback_detail JSONB DEFAULT '{}',                         -- {category, tags[], comment}
    session_id      VARCHAR(64),
    user_id         BIGINT,
    intent_code     VARCHAR(100),
    refined_from    VARCHAR(100),
    response_time_ms BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_fkf_created   ON food_kb_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fkf_rating    ON food_kb_feedback (rating);
CREATE INDEX IF NOT EXISTS idx_fkf_type      ON food_kb_feedback (feedback_type);
CREATE INDEX IF NOT EXISTS idx_fkf_user      ON food_kb_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_fkf_session   ON food_kb_feedback (session_id);

-- 2. Query log for re-query detection and analytics
CREATE TABLE IF NOT EXISTS food_kb_query_log (
    id              SERIAL PRIMARY KEY,
    query           TEXT NOT NULL,
    session_id      VARCHAR(64),
    user_id         BIGINT,
    top1_doc_id     INTEGER,
    top1_similarity FLOAT,
    num_results     INTEGER DEFAULT 0,
    response_time_ms BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for re-query detection (session + time window)
CREATE INDEX IF NOT EXISTS idx_fkql_session_time ON food_kb_query_log (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fkql_created      ON food_kb_query_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fkql_user         ON food_kb_query_log (user_id);

-- Done
SELECT 'food_kb_feedback and food_kb_query_log tables created' AS status;
