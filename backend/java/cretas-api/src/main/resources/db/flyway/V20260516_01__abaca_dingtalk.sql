-- ============================================================
-- V20260516_01 — Track B1: DingTalk webhook logs (C-AI-1 PoC)
--
-- Track B2 (abaca 抄码品) lands in a SEPARATE file V20260516_02__abaca.sql to
-- avoid Flyway checksum-mismatch when both tracks deploy on different days.
-- Original brief proposed shared file; reverted 2026-05-14 after checksum risk
-- analysis (Flyway recomputes per-file at apply; appending after a deploy
-- breaks subsequent deploys until `flyway repair`). Steve approved the split.
-- ============================================================

-- ============================================================
-- Track B1 — C-AI-1 钉钉机器人 PoC (per SCHEMA_DESIGN §2.4)
-- ============================================================

CREATE TABLE dingtalk_webhook_logs (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),

    -- 方向 + 类型
    direction       VARCHAR(10) NOT NULL,
    message_type    VARCHAR(30) NOT NULL,

    -- 钉钉侧信息
    dingtalk_corp_id    VARCHAR(100),
    dingtalk_chat_id    VARCHAR(100),
    dingtalk_user_id    VARCHAR(100),
    dingtalk_user_name  VARCHAR(100),
    dingtalk_message_id VARCHAR(200),
    webhook_url     VARCHAR(500),

    -- 消息内容
    message_content TEXT NOT NULL,
    message_payload JSONB,
    is_sensitive    BOOLEAN NOT NULL DEFAULT FALSE,

    -- Cretas 侧关联
    user_id         BIGINT,
    ai_audit_log_id BIGINT,
    intent_code     VARCHAR(100),
    session_id      VARCHAR(100),

    -- 状态 + 重试
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message   VARCHAR(2000),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMP,

    -- 时间 (不软删 — 审计日志只读)
    received_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    delivered_at    TIMESTAMP,

    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_dwl_direction CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    CONSTRAINT chk_dwl_status CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'IGNORED')),
    CONSTRAINT chk_dwl_retry CHECK (retry_count >= 0 AND retry_count <= 10)
);

CREATE INDEX idx_dwl_factory_time ON dingtalk_webhook_logs (factory_id, received_at DESC);
CREATE INDEX idx_dwl_session ON dingtalk_webhook_logs (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_dwl_user_dingtalk ON dingtalk_webhook_logs (dingtalk_user_id, received_at DESC);
CREATE INDEX idx_dwl_status_retry ON dingtalk_webhook_logs (status, next_retry_at) WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_dwl_ai_audit ON dingtalk_webhook_logs (ai_audit_log_id) WHERE ai_audit_log_id IS NOT NULL;
CREATE INDEX idx_dwl_payload ON dingtalk_webhook_logs USING GIN (message_payload);

COMMENT ON TABLE dingtalk_webhook_logs IS 'DingTalk webhook 双向消息审计日志 (C-AI-1 PoC).';

-- users.dingtalk_user_id: 钉钉用户 ↔ Cretas user 双向绑定. 由 admin 一次性维护 (Phase 1 PoC).
ALTER TABLE users ADD COLUMN dingtalk_user_id VARCHAR(100);
CREATE UNIQUE INDEX idx_users_dingtalk_user_id ON users (dingtalk_user_id) WHERE dingtalk_user_id IS NOT NULL;
COMMENT ON COLUMN users.dingtalk_user_id IS 'DingTalk senderId for inbound user-resolution; nullable.';

-- ============================================================
-- End of Track B1 section. Track B2 (abaca 抄码品) lives in V20260516_02__abaca.sql.
-- ============================================================
