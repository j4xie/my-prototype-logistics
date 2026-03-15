-- Tool Governance: tool_metadata table
-- Stores runtime metadata for each registered tool (call stats, risk level, domain tags)
-- Used by ToolHealthMonitor for daily audits and governance reports

CREATE TABLE IF NOT EXISTS tool_metadata (
    id              BIGSERIAL PRIMARY KEY,
    tool_name       VARCHAR(100) NOT NULL UNIQUE,
    action_type     VARCHAR(20) NOT NULL DEFAULT 'READ',
    risk_level      VARCHAR(20) NOT NULL DEFAULT 'LOW',
    domain_tags     JSONB DEFAULT '[]'::jsonb,
    tool_version    VARCHAR(20) DEFAULT '1.0.0',
    deprecation_notice TEXT,
    last_called_at  TIMESTAMP,
    call_count      BIGINT NOT NULL DEFAULT 0,
    success_count   BIGINT NOT NULL DEFAULT 0,
    failure_count   BIGINT NOT NULL DEFAULT 0,
    avg_execution_ms DOUBLE PRECISION DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP
);

CREATE INDEX idx_tm_action_type ON tool_metadata(action_type);
CREATE INDEX idx_tm_risk_level ON tool_metadata(risk_level);
CREATE INDEX idx_tm_domain_tags ON tool_metadata USING GIN(domain_tags);
CREATE INDEX idx_tm_last_called ON tool_metadata(last_called_at);

COMMENT ON TABLE tool_metadata IS 'Tool 治理元数据：运行时统计 + 分类标签';
COMMENT ON COLUMN tool_metadata.call_count IS '累计调用次数';
COMMENT ON COLUMN tool_metadata.deprecation_notice IS 'NULL=活跃, 非NULL=已废弃(含迁移说明)';
