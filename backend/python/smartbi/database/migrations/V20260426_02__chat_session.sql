-- v2 Conversation Memory (Apr 26 2026): server-side session storage so follow-up
-- queries can inherit context from the parent main answer.
--
-- Background: S3 270-followup audit (session-3-followup-audit.md) measured 3.21/5,
-- a -18.5% drop vs main 3.94/5 — caused by no conversation memory. Lightweight
-- design: store last (parent_query, parent_answer_summary) per session_id, inject
-- into LLM prompt on next turn. Backward compatible: no session_id → standalone.
--
-- TTL: 1 hour rolling (refreshed on each turn). Cron prunes expired rows every 30 min.

CREATE TABLE IF NOT EXISTS smart_bi_chat_session (
    id                       BIGSERIAL PRIMARY KEY,
    session_id               VARCHAR(64) NOT NULL UNIQUE,  -- UUID v4 from FE
    factory_id               VARCHAR(50) NOT NULL,         -- tenant isolation
    user_id                  BIGINT,                        -- nullable (anon)
    parent_query             TEXT,                          -- last main query
    parent_answer_summary    TEXT,                          -- truncated to ~750 chars (~500 tokens Chinese)
    parent_template_code     VARCHAR(100),                  -- if cached, which template
    parent_upload_id         BIGINT,                        -- which upload was used
    turn_count               INTEGER NOT NULL DEFAULT 0,
    created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at               TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_chat_session_factory ON smart_bi_chat_session(factory_id);
CREATE INDEX IF NOT EXISTS idx_chat_session_expires ON smart_bi_chat_session(expires_at);

COMMENT ON TABLE smart_bi_chat_session IS
    'v2 conversation memory: parent (query, answer_summary) per session_id. TTL 1 hour rolling.';
COMMENT ON COLUMN smart_bi_chat_session.parent_answer_summary IS
    'Truncated to ~750 chars to bound LLM prompt cost (+~500 tokens for Chinese).';
