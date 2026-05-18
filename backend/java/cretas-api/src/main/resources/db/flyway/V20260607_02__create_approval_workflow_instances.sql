-- V20260607_02: 创建 approval_workflow_instances 表 (Workflow 实例持久化)
--
-- ⚠️ Flyway 版本号: 原打算用 V20260518_02, 但 spring.flyway.out-of-order=false
-- 拒收 V20260606_21 后的更早版本. 改用 V20260607_02 = 已有最新 + 1 天.
--
-- Phase 1 Canvas-Workflow (Step B.2) — 替换 ApprovalWorkflowExecutorImpl 的
-- 内存 ConcurrentHashMap. 双写: Redis (hot cache, 实时操作) + PG (shadow,
-- 重启恢复 + 历史归档 + 跨实例查询).
--
-- 重启恢复流程 (启动 hook):
--   SELECT * FROM approval_workflow_instances WHERE status='RUNNING' AND deleted_at IS NULL
--   FOR each row: HSET aw:instance:{id} ... (重建 Redis state)
--
-- 终态后归档:
--   APPROVED/REJECTED/CANCELLED/TIMEOUT 后 24h Redis TTL 过期, PG 保留作历史.
--
-- 设计文档: PR #862 Steve B.1-B.6 决断

CREATE TABLE approval_workflow_instances (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,

    -- 关联 workflow 配置 (NOT FK — workflow 可能 archive 但 instance 应保留历史快照)
    workflow_id VARCHAR(36) NOT NULL,

    -- 业务模块 — Phase 1 PURCHASE_ORDER; Phase B 扩 SALES_ORDER / DISPOSAL / TRANSFER 等
    module_code VARCHAR(50) NOT NULL,

    -- 业务实体 id — PO id / SO id / disposal id 等. VARCHAR(191) 兼容长 UUID/复合 id
    business_entity_id VARCHAR(191) NOT NULL,

    -- Instance 状态 — Java enum InstanceStatus
    --   RUNNING — 至少 1 个节点 active 等待人工/超时
    --   APPROVED / REJECTED — 终态
    --   CANCELLED — 业务发起方主动取消
    --   TIMEOUT — 自动 escalate 多次失败后终态
    status VARCHAR(32) NOT NULL DEFAULT 'RUNNING',

    -- 当前 active 节点 ids (JSONB array — 支持 parallel 多分支并行)
    -- e.g. ["approval_finance"] 或 ["parallel_finance", "parallel_admin"]
    current_node_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- 业务 context (实例启动时的 PO 快照: totalAmount / items / priceVariance 等)
    -- SpEL condition 评估时 #context.amount 等绑定这里
    context_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 发起人 — userId. 系统自动触发时为 NULL.
    initiated_by BIGINT,
    initiated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,

    -- BaseEntity audit (per .claude/rules/database-entity-sync.md)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

-- Index: 业务实体查实例 (PurchaseService.findInstanceByPO 用)
CREATE INDEX idx_aw_instances_business_entity
    ON approval_workflow_instances (factory_id, module_code, business_entity_id)
    WHERE deleted_at IS NULL;

-- Index: 重启恢复扫描 — 启动时拉所有 RUNNING 实例进 Redis
CREATE INDEX idx_aw_instances_recovery
    ON approval_workflow_instances (factory_id, status)
    WHERE status = 'RUNNING' AND deleted_at IS NULL;

-- Index: workflow 维度统计 (Phase D 报表)
CREATE INDEX idx_aw_instances_workflow_stats
    ON approval_workflow_instances (factory_id, workflow_id, status, completed_at)
    WHERE deleted_at IS NULL;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_aw_instances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_aw_instances_updated_at
BEFORE UPDATE ON approval_workflow_instances
FOR EACH ROW EXECUTE FUNCTION update_aw_instances_updated_at();

-- Documentation
COMMENT ON TABLE approval_workflow_instances IS 'Phase 1 Canvas-Workflow 实例持久化 — Redis 热缓存 + PG shadow. 启动时拉 RUNNING 行重建 Redis state.';
COMMENT ON COLUMN approval_workflow_instances.current_node_ids IS 'JSONB array 支持 parallel 分支. e.g. ["approval_finance"] 单分支 / ["parallel_1", "parallel_2"] 并行.';
COMMENT ON COLUMN approval_workflow_instances.context_json IS '实例启动时的业务快照. SpEL #context.amount / #context.priceVariance 等绑定此 JSONB.';
COMMENT ON COLUMN approval_workflow_instances.status IS 'RUNNING (至少 1 节点 active) / APPROVED / REJECTED / CANCELLED / TIMEOUT';
