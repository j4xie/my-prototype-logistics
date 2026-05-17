-- Sprint 4 Wave 1 (C-WF-RULE-1) — 流转规则引擎
-- WorkflowRule 表: ApprovalWorkflow condition 节点的用户友好条件配置.
-- Spec: docs/superpowers/specs/2026-05-16-c-wf-rule-1-design.md

CREATE TABLE IF NOT EXISTS workflow_rules (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    workflow_id VARCHAR(36) NOT NULL,
    node_id VARCHAR(50) NOT NULL,
    edge_id VARCHAR(50),
    rule_type VARCHAR(30) NOT NULL,
    expression JSONB NOT NULL DEFAULT '{}'::jsonb,
    true_target_node_id VARCHAR(50),
    false_target_node_id VARCHAR(50),
    priority INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    description VARCHAR(500),

    -- BaseEntity audit (per database-entity-sync.md PG pattern)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,

    CONSTRAINT chk_workflow_rule_type CHECK (rule_type IN
        ('AMOUNT_THRESHOLD','DEPT_MATCH','ROLE_MATCH','SPEL_CUSTOM'))
);

-- Executor 热路径 — find by workflow_id + node_id + enabled, order by priority
CREATE INDEX IF NOT EXISTS idx_workflow_rules_workflow_node
    ON workflow_rules (workflow_id, node_id, enabled, priority)
    WHERE deleted_at IS NULL;

-- Factory-scoped queries
CREATE INDEX IF NOT EXISTS idx_workflow_rules_factory
    ON workflow_rules (factory_id)
    WHERE deleted_at IS NULL;

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_workflow_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_workflow_rules_updated_at ON workflow_rules;
CREATE TRIGGER trigger_workflow_rules_updated_at
BEFORE UPDATE ON workflow_rules
FOR EACH ROW EXECUTE FUNCTION update_workflow_rules_updated_at();

-- AIChat 意图绑定: workflow_rule_test tool
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category,
    tool_name, keywords, is_active, sensitivity_level, created_at, updated_at)
VALUES (gen_random_uuid(), 'WORKFLOW_RULE_TEST', '测试流转规则',
    'CONFIG_OPERATION', 'workflow_rule_test',
    '["测试规则","规则评估","测试流转规则","流转规则评估","mock context"]'::jsonb,
    true, 'LOW', NOW(), NOW())
ON CONFLICT (intent_code) DO NOTHING;
