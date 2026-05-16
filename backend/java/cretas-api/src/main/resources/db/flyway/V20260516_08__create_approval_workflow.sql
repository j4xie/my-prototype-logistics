-- V20260516_05: 创建 approval_workflows 表 (graph-native 审批工作流)
--
-- Sprint 3 Track-I (C-APPROVAL-EDITOR-1) 引入 graph-native 审批工作流配置,
-- 跟现有 approval_chain_configs (flat list) 互补:
--   - approval_chain_configs = 线性多级 (approvalLevel 1/2/3 + escalationConfigId)
--   - approval_workflows = graph DAG (sequential / parallel / conditional / 会签)
--
-- Dual-source read: ApprovalChainService.requiresApproval() 优先查 approval_workflows
-- (publish_status='published' + enabled=true), 找到则走 ApprovalWorkflowExecutor (graph);
-- 否则 fallback 到 legacy ApprovalChainConfig 逻辑.
--
-- 加性扩展, 不破坏现状: Track-E/H 调用 ApprovalChainService 接口签名不变.
--
-- 设计文档: docs/superpowers/specs/2026-05-16-c-approval-editor-design.md

CREATE TABLE approval_workflows (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    decision_type VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),

    -- Graph payload: nodes + edges JSONB. 服务层 Jackson serde.
    nodes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    start_node_id VARCHAR(50),

    -- Lifecycle
    version INTEGER NOT NULL DEFAULT 1,
    publish_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 0,

    -- BaseEntity audit columns (per .claude/rules/database-entity-sync.md)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,

    CONSTRAINT uk_approval_workflows_factory_type_name UNIQUE (factory_id, decision_type, name)
);

-- Index: lookup by factory + decision_type for executor (filter enabled + published)
CREATE INDEX idx_approval_workflows_factory_type_lookup
    ON approval_workflows (factory_id, decision_type, enabled, publish_status)
    WHERE deleted_at IS NULL;

-- Index: priority ordering for "multiple published workflows per decision type" case
CREATE INDEX idx_approval_workflows_priority
    ON approval_workflows (factory_id, decision_type, priority DESC, version DESC)
    WHERE deleted_at IS NULL AND enabled = TRUE AND publish_status = 'published';

-- Auto-update updated_at trigger (per .claude/rules/database-entity-sync.md PG pattern)
CREATE OR REPLACE FUNCTION update_approval_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_approval_workflows_updated_at
BEFORE UPDATE ON approval_workflows
FOR EACH ROW EXECUTE FUNCTION update_approval_workflows_updated_at();

-- Documentation comments (PG \d+ shows these)
COMMENT ON TABLE approval_workflows IS 'Graph-native 审批工作流配置 (Sprint 3 Track-I). 跟 approval_chain_configs 互补, 见 design doc.';
COMMENT ON COLUMN approval_workflows.nodes_json IS 'JSONB array of ApprovalWorkflowNode {id, type, label, position, config, allowedNextTypes}. 7 types: start/approval/condition/parallel/join/notify/end.';
COMMENT ON COLUMN approval_workflows.edges_json IS 'JSONB array of ApprovalWorkflowEdge {id, source, target, condition (SpEL), label, priority}.';
COMMENT ON COLUMN approval_workflows.publish_status IS 'draft / published / archived. Executor 只 consume publish_status=published + enabled=true.';
COMMENT ON COLUMN approval_workflows.priority IS '数值越大优先级越高. 同 (factory_id, decision_type) 多 published workflow 时 executor 选最高优先级.';
