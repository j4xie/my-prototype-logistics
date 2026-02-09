-- =====================================================
-- 审批链路配置表
-- 用于配置化审批流程
-- V2025_12_30_5
-- =====================================================

CREATE TABLE IF NOT EXISTS approval_chain_configs (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    decision_type VARCHAR(50) NOT NULL COMMENT '决策类型',
    name VARCHAR(100) NOT NULL COMMENT '配置名称',
    description VARCHAR(500) COMMENT '配置描述',
    trigger_condition TEXT COMMENT '触发条件 (JSON格式)',
    approval_level INT NOT NULL COMMENT '审批级别 (1=一级审批, 2=二级审批, ...)',
    required_approvers INT DEFAULT 1 COMMENT '必需审批人数',
    approver_roles TEXT COMMENT '可审批角色列表 (JSON数组)',
    approver_user_ids TEXT COMMENT '可审批用户ID列表 (JSON数组)',
    timeout_minutes INT COMMENT '超时时间 (分钟)',
    escalation_config_id VARCHAR(36) COMMENT '超时后升级到的配置ID',
    auto_approve_condition TEXT COMMENT '自动审批条件 (JSON格式)',
    auto_reject_condition TEXT COMMENT '自动拒绝条件 (JSON格式)',
    priority INT DEFAULT 0 COMMENT '优先级 (数值越大优先级越高)',
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    version INT DEFAULT 1 COMMENT '配置版本',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME COMMENT '删除时间 (软删除)',

    -- 唯一约束: 同一工厂同一决策类型下配置名称唯一
    UNIQUE KEY uk_factory_type_name (factory_id, decision_type, name),

    -- 索引
    INDEX idx_factory_id (factory_id),
    INDEX idx_decision_type (decision_type),
    INDEX idx_factory_type_enabled (factory_id, decision_type, enabled),
    INDEX idx_priority (priority),
    INDEX idx_approval_level (approval_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='审批链路配置表';

-- =====================================================
-- 插入默认配置 (示例数据，可按需调整)
-- =====================================================

-- 强制插单审批链 (示例)
INSERT INTO approval_chain_configs (
    id, factory_id, decision_type, name, description,
    trigger_condition, approval_level, required_approvers,
    approver_roles, timeout_minutes, priority, enabled, version
) VALUES
(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-高影响', '影响3条以上生产线的紧急插单',
 '{"affectedLines": ">=3"}', 1, 1,
 '["factory_super_admin"]', 60, 100, true, 1),

(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-普通', '普通紧急插单',
 NULL, 1, 1,
 '["factory_super_admin", "department_admin"]', 120, 50, true, 1);

-- 质检放行审批链 (示例)
INSERT INTO approval_chain_configs (
    id, factory_id, decision_type, name, description,
    trigger_condition, approval_level, required_approvers,
    approver_roles, auto_approve_condition, timeout_minutes, priority, enabled, version
) VALUES
(UUID(), 'F001', 'QUALITY_RELEASE', '质检放行-高风险批次', '高风险批次的质检放行',
 '{"riskLevel": "HIGH"}', 1, 2,
 '["quality_manager", "factory_super_admin"]', NULL, 30, 100, true, 1),

(UUID(), 'F001', 'QUALITY_RELEASE', '质检放行-普通批次', '普通批次的质检放行',
 NULL, 1, 1,
 '["quality_manager", "quality_inspector"]',
 '{"allChecksPassed": true, "noDeviations": true}', 60, 50, true, 1);

-- 质检特批审批链 (示例)
INSERT INTO approval_chain_configs (
    id, factory_id, decision_type, name, description,
    trigger_condition, approval_level, required_approvers,
    approver_roles, timeout_minutes, priority, enabled, version
) VALUES
(UUID(), 'F001', 'QUALITY_EXCEPTION', '质检特批-一级', '首次特批审核',
 NULL, 1, 1,
 '["quality_manager"]', 30, 100, true, 1),

(UUID(), 'F001', 'QUALITY_EXCEPTION', '质检特批-二级', '特批升级审核',
 NULL, 2, 1,
 '["factory_super_admin"]', 60, 100, true, 1);

-- 供应商准入审批链 (示例)
INSERT INTO approval_chain_configs (
    id, factory_id, decision_type, name, description,
    trigger_condition, approval_level, required_approvers,
    approver_roles, timeout_minutes, priority, enabled, version
) VALUES
(UUID(), 'F001', 'SUPPLIER_APPROVAL', '供应商准入-采购审核', '采购部门初审',
 NULL, 1, 1,
 '["procurement_manager"]', 120, 100, true, 1),

(UUID(), 'F001', 'SUPPLIER_APPROVAL', '供应商准入-质量审核', '质量部门复审',
 NULL, 2, 1,
 '["quality_manager"]', 120, 100, true, 1),

(UUID(), 'F001', 'SUPPLIER_APPROVAL', '供应商准入-管理审批', '管理层终审',
 NULL, 3, 1,
 '["factory_super_admin"]', 240, 100, true, 1);

-- 生产计划变更审批链 (示例)
INSERT INTO approval_chain_configs (
    id, factory_id, decision_type, name, description,
    trigger_condition, approval_level, required_approvers,
    approver_roles, auto_approve_condition, timeout_minutes, priority, enabled, version
) VALUES
(UUID(), 'F001', 'PRODUCTION_PLAN_CHANGE', '生产计划变更-重大调整', '影响超过50%产能的调整',
 '{"capacityImpactPercent": ">=50"}', 1, 2,
 '["factory_super_admin", "production_manager"]', NULL, 60, 100, true, 1),

(UUID(), 'F001', 'PRODUCTION_PLAN_CHANGE', '生产计划变更-小幅调整', '小幅度计划调整',
 '{"capacityImpactPercent": "<50"}', 1, 1,
 '["production_manager", "department_admin"]',
 '{"capacityImpactPercent": "<10"}', 120, 50, true, 1);
