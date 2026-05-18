-- V20260607_01: 创建 approval_history 表 (审批历史 / 审计 / 报表)
--
-- Phase 1 Canvas-Workflow (Step B.1).
--
-- ⚠️ Flyway 版本号: 原打算用 V20260518_01 (当天日期), 但
-- spring.flyway.out-of-order=false (application-pg-prod.properties:64)
-- 会拒收晚于已有 V20260606_21 的更早版本号. 改用 V20260607_01 = 已有最新 + 1 天.
-- 同根源 PR #707 (commit 74697febc) 也踩过此坑.
--
-- 每次 transition 一条记录: APPROVE / REJECT / SKIP / DELEGATE / TIMEOUT / START / AUTO_TRANSITION
-- 用于:
--   1) 审计 — F006 客户合规要求所有审批可追溯
--   2) 时间线 UI — Canvas Approval Tab 内嵌"实例历史"面板
--   3) Phase D 报表 — 通过率 / 平均时长 / 卡瓶颈节点
--
-- Schema 通用 (不绑死采购), 12+ 业务模块复用. instance_id refs approval_workflow_instances(id)
-- 但 NOT FOREIGN KEY (历史归档场景 instance 可能 hard-delete 但 history 保留).
--
-- 设计文档: 见 PR #862 Steve B.1-B.6 决断

CREATE TABLE approval_history (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    instance_id VARCHAR(36) NOT NULL,
    node_id VARCHAR(50) NOT NULL,

    -- Action 类型 — Java enum HistoryAction.toString()
    -- APPROVE / REJECT / SKIP / DELEGATE / TIMEOUT — 用户/系统操作
    -- START — workflow 实例启动
    -- AUTO_TRANSITION — condition/parallel 自动推进 (无人工)
    -- CANCEL — workflow 取消
    action VARCHAR(32) NOT NULL,

    -- Actor — 操作人 id + role; AUTO_TRANSITION/START 时为 NULL
    actor_id BIGINT,
    actor_role VARCHAR(50),

    -- 自由文本备注 (审批意见 / 驳回理由 / 委托人姓名)
    notes TEXT,

    -- 从前一节点到本节点的耗时 (秒). START 时为 NULL.
    -- 用于 Phase D 报表 "平均审批时长 / 卡瓶颈节点"
    duration_seconds INT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index: 时间线查询 — 单 instance 按时间排
CREATE INDEX idx_approval_history_instance_time
    ON approval_history (factory_id, instance_id, created_at);

-- Index: factory 维度报表
CREATE INDEX idx_approval_history_factory_action_time
    ON approval_history (factory_id, action, created_at);

-- Documentation
COMMENT ON TABLE approval_history IS 'Phase 1 Canvas-Workflow 审批历史. 每次 transition 一条. 不 FK 到 instance — 支持 instance 归档/删除后 history 保留.';
COMMENT ON COLUMN approval_history.action IS 'APPROVE / REJECT / SKIP / DELEGATE / TIMEOUT / START / AUTO_TRANSITION / CANCEL';
COMMENT ON COLUMN approval_history.duration_seconds IS '本节点耗时 (秒) — 从前一节点 created_at 到本节点 created_at. START 为 NULL.';
