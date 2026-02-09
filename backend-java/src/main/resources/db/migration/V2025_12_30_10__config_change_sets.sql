-- =====================================================
-- 配置变更集表
-- 用于追踪所有配置变更，支持差异预览、审批、回滚
--
-- 创建时间: 2025-12-30
-- 作者: Cretas Team
-- =====================================================

CREATE TABLE IF NOT EXISTS config_change_sets (
    id VARCHAR(36) PRIMARY KEY,

    -- 工厂ID (多租户隔离)
    factory_id VARCHAR(50),

    -- 配置标识
    config_type VARCHAR(50) NOT NULL COMMENT '配置类型: FORM_TEMPLATE, DROOLS_RULE, APPROVAL_CHAIN, QUALITY_RULE, CONVERSION_RATE, FACTORY_CAPACITY, OTHER',
    config_id VARCHAR(36) NOT NULL COMMENT '原配置ID',
    config_name VARCHAR(100) COMMENT '配置名称',

    -- 版本信息
    from_version INT COMMENT '变更前版本号',
    to_version INT COMMENT '变更后版本号',

    -- 快照与差异
    before_snapshot TEXT COMMENT '变更前配置快照 (JSON)',
    after_snapshot TEXT COMMENT '变更后配置快照 (JSON)',
    diff_json TEXT COMMENT '差异内容 (JSON)',
    change_summary VARCHAR(500) COMMENT '变更摘要',

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING, APPROVED, APPLIED, REJECTED, ROLLED_BACK, EXPIRED',

    -- 创建者
    created_by BIGINT COMMENT '创建者用户ID',
    created_by_name VARCHAR(100) COMMENT '创建者用户名',

    -- 审批信息
    approved_by BIGINT COMMENT '审批者用户ID',
    approved_by_name VARCHAR(100) COMMENT '审批者用户名',
    approved_at DATETIME COMMENT '审批时间',
    approval_comment TEXT COMMENT '审批备注',

    -- 应用信息
    applied_at DATETIME COMMENT '应用时间',

    -- 回滚信息
    rolled_back_at DATETIME COMMENT '回滚时间',
    rolled_back_by BIGINT COMMENT '回滚者用户ID',
    rollback_reason VARCHAR(500) COMMENT '回滚原因',
    is_rollbackable BOOLEAN DEFAULT TRUE COMMENT '是否可回滚',

    -- BaseEntity 字段
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL COMMENT '软删除时间',

    -- 索引
    INDEX idx_config_type_id (config_type, config_id),
    INDEX idx_factory_id (factory_id),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_created_at (created_at),
    INDEX idx_config_id_status (config_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='配置变更集表';

-- =====================================================
-- 初始数据 (可选)
-- =====================================================

-- 无初始数据，变更集由业务操作创建
