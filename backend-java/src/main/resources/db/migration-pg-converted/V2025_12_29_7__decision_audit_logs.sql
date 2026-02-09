-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_29_7__decision_audit_logs.sql
-- Conversion date: 2026-01-26 18:46:03
-- WARNING: This file requires manual review!
-- ============================================

-- =============================================================================
-- V2025_12_29_7__decision_audit_logs.sql
-- 决策审计日志表 - 支持决策回放和审计追踪
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 决策审计日志主表
-- 记录所有关键业务决策，支持回放和审计
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_audit_logs (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',

    -- 决策标识
    decision_type VARCHAR(50) NOT NULL COMMENT '决策类型: RULE_EXECUTION, STATE_TRANSITION, FORCE_INSERT, APPROVAL, AI_ANALYSIS',
    decision_code VARCHAR(100) COMMENT '决策编码，用于分类统计',

    -- 关联实体
    entity_type VARCHAR(50) NOT NULL COMMENT '实体类型: ProductionPlan, MaterialBatch, QualityInspection, etc.',
    entity_id VARCHAR(36) NOT NULL COMMENT '实体ID',
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',

    -- 决策上下文
    input_context JSON COMMENT '输入上下文 (决策时的数据快照)',
    output_result JSON COMMENT '输出结果 (决策结果)',
    rules_applied JSON COMMENT '应用的规则列表',

    -- 决策详情
    decision_made VARCHAR(255) COMMENT '做出的决策描述',
    reason TEXT COMMENT '决策原因/理由',
    confidence DECIMAL(5,2) COMMENT '置信度 (0-100, 用于AI决策)',

    -- 状态变更
    previous_state VARCHAR(50) COMMENT '变更前状态',
    new_state VARCHAR(50) COMMENT '变更后状态',

    -- 执行信息
    executor_id BIGINT COMMENT '执行者用户ID',
    executor_name VARCHAR(100) COMMENT '执行者姓名',
    executor_role VARCHAR(50) COMMENT '执行者角色',
    execution_mode VARCHAR(20) DEFAULT 'AUTOMATIC' COMMENT '执行模式: AUTOMATIC, MANUAL, OVERRIDE',

    -- 审批信息 (用于需要审批的决策)
    requires_approval BOOLEAN DEFAULT FALSE COMMENT '是否需要审批',
    approval_status VARCHAR(20) COMMENT '审批状态: PENDING, APPROVED, REJECTED',
    approver_id BIGINT COMMENT '审批人ID',
    approver_name VARCHAR(100) COMMENT '审批人姓名',
    approved_at TIMESTAMP WITH TIME ZONE COMMENT '审批时间',
    approval_comment TEXT COMMENT '审批意见',

    -- 回放支持
    is_replayable BOOLEAN DEFAULT TRUE COMMENT '是否可回放',
    replay_data JSON COMMENT '回放所需的完整数据',
    checksum VARCHAR(64) COMMENT '数据校验和，用于验证完整性',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 索引
    INDEX idx_decision_type (decision_type),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_factory (factory_id),
    INDEX idx_executor (executor_id),
    INDEX idx_created_at (created_at),
    INDEX idx_approval_status (approval_status),
    INDEX idx_factory_created (factory_id, created_at DESC)
)
;

-- -----------------------------------------------------------------------------
-- 2. 决策类型枚举参考
-- -----------------------------------------------------------------------------
-- RULE_EXECUTION: 规则引擎执行 (Drools规则触发)
-- STATE_TRANSITION: 状态机转换 (工作流状态变更)
-- FORCE_INSERT: 强制插单 (紧急订单处理)
-- APPROVAL: 审批决策 (质检放行、异常处理等)
-- AI_ANALYSIS: AI分析决策 (成本分析、预测分析等)
-- MANUAL_OVERRIDE: 手动覆盖 (覆盖系统建议)

-- -----------------------------------------------------------------------------
-- 3. 决策审计日志明细表 (用于记录决策过程中的多个步骤)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_audit_log_details (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    audit_log_id VARCHAR(36) NOT NULL COMMENT '关联的审计日志ID',

    -- 步骤信息
    step_order INT NOT NULL COMMENT '步骤顺序',
    step_type VARCHAR(50) NOT NULL COMMENT '步骤类型: RULE_FIRED, CONDITION_CHECK, VALUE_MODIFIED, VALIDATION_ERROR',
    step_description TEXT COMMENT '步骤描述',

    -- 步骤数据
    input_data JSON COMMENT '步骤输入数据',
    output_data JSON COMMENT '步骤输出数据',

    -- 规则相关
    rule_id VARCHAR(36) COMMENT '触发的规则ID',
    rule_name VARCHAR(100) COMMENT '规则名称',
    rule_version INT COMMENT '规则版本',

    -- 条件相关
    condition_expression TEXT COMMENT '条件表达式',
    condition_result BOOLEAN COMMENT '条件结果',

    -- 时间
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间',
    duration_ms INT COMMENT '执行耗时(毫秒)',

    -- 索引
    INDEX idx_audit_log (audit_log_id),
    INDEX idx_step_type (step_type),
    INDEX idx_rule (rule_id),

    FOREIGN KEY (audit_log_id) REFERENCES decision_audit_logs(id) ON DELETE CASCADE
)
;

-- -----------------------------------------------------------------------------
-- 4. 初始化示例数据 (可选)
-- -----------------------------------------------------------------------------
-- 暂不插入示例数据，由业务代码生成

-- -----------------------------------------------------------------------------
-- 5. 创建审计日志服务需要的视图
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_decision_audit_summary AS
SELECT
    factory_id,
    decision_type,
    entity_type,
    DATE(created_at) AS decision_date,
    COUNT(*) AS total_decisions,
    SUM(CASE WHEN approval_status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN approval_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_count,
    SUM(CASE WHEN approval_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
    AVG(confidence) AS avg_confidence
FROM decision_audit_logs
GROUP BY factory_id, decision_type, entity_type, DATE(created_at);
