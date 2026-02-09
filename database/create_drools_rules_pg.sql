-- =====================================================
-- Drools Rules Tables for PostgreSQL
-- Creates: drools_rules, rule_execution_logs, drools_rule_versions
-- =====================================================

-- 1. drools_rules - Rule definitions
CREATE TABLE IF NOT EXISTS drools_rules (
    id VARCHAR(50) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    rule_group VARCHAR(50) NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    rule_description TEXT,
    rule_content TEXT NOT NULL,
    decision_table BYTEA,
    decision_table_type VARCHAR(20),
    version INT DEFAULT 1,
    enabled BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,
    created_by BIGINT,
    updated_by BIGINT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_drools_rules_factory ON drools_rules(factory_id);
CREATE INDEX IF NOT EXISTS idx_drools_rules_group ON drools_rules(factory_id, rule_group);
CREATE INDEX IF NOT EXISTS idx_drools_rules_enabled ON drools_rules(factory_id, enabled);

-- Use DO block to avoid error if constraint already exists
DO $$ BEGIN
    ALTER TABLE drools_rules ADD CONSTRAINT uk_drools_rules_name UNIQUE (factory_id, rule_group, rule_name);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- 2. rule_execution_logs - Rule execution audit log
CREATE TABLE IF NOT EXISTS rule_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    rule_group VARCHAR(50) NOT NULL,
    rule_name VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id VARCHAR(50),
    input_facts JSONB,
    output_results JSONB,
    execution_time_ms INT,
    fired_rules_count INT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    executed_by BIGINT,
    executed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rule_logs_factory ON rule_execution_logs(factory_id);
CREATE INDEX IF NOT EXISTS idx_rule_logs_time ON rule_execution_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_rule_logs_entity ON rule_execution_logs(entity_type, entity_id);

-- 3. drools_rule_versions - Rule version history
CREATE TABLE IF NOT EXISTS drools_rule_versions (
    id VARCHAR(50) PRIMARY KEY,
    rule_id VARCHAR(50) NOT NULL,
    version INT NOT NULL,
    rule_content TEXT NOT NULL,
    decision_table BYTEA,
    change_reason VARCHAR(500),
    changed_by BIGINT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rule_versions_rule ON drools_rule_versions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_versions_number ON drools_rule_versions(rule_id, version);

-- 4. Seed data: default urgent threshold rule for F001
INSERT INTO drools_rules (id, factory_id, rule_group, rule_name, rule_description, rule_content, version, enabled, priority, created_at, updated_at)
VALUES (
    'rule-scheduling-urgent-001',
    'F001',
    'scheduling',
    'urgent_threshold',
    '紧急工单阈值配置',
    '{"urgentThresholdHours": 24, "criticalThresholdHours": 8, "autoEscalate": true}',
    1,
    true,
    10,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;
