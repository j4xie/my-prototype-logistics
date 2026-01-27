-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_31_5__blueprint_version_management.sql
-- Conversion date: 2026-01-26 18:46:42
-- WARNING: This file requires manual review!
-- ============================================

-- Sprint 3 任务: S3-7 蓝图版本管理
-- 创建蓝图版本历史表和工厂蓝图绑定表

-- 蓝图版本历史表
CREATE TABLE IF NOT EXISTS blueprint_version_history (
    id VARCHAR(36) PRIMARY KEY,
    blueprint_id VARCHAR(36) NOT NULL COMMENT '关联的蓝图ID',
    version INT NOT NULL COMMENT '版本号',
    change_type VARCHAR(20) COMMENT '变更类型: CREATE, UPDATE, PUBLISH, DEPRECATE',
    change_description TEXT COMMENT '变更说明',
    snapshot_data JSON COMMENT '版本快照 (完整蓝图数据)',
    change_summary JSON COMMENT '变更内容摘要',
    is_published BOOLEAN DEFAULT FALSE COMMENT '是否为发布版本',
    published_at TIMESTAMP WITH TIME ZONE COMMENT '发布时间',
    created_by BIGINT COMMENT '创建人',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    INDEX idx_blueprint_version (blueprint_id, version),
    INDEX idx_blueprint_published (blueprint_id, is_published)
);

-- 工厂蓝图绑定表
CREATE TABLE IF NOT EXISTS factory_blueprint_bindings (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(36) NOT NULL COMMENT '工厂ID',
    blueprint_id VARCHAR(36) NOT NULL COMMENT '蓝图ID',
    applied_version INT NOT NULL COMMENT '当前应用的版本',
    latest_version INT COMMENT '最新可用版本',
    auto_update BOOLEAN DEFAULT FALSE COMMENT '是否自动更新',
    update_policy VARCHAR(20) DEFAULT 'MANUAL' COMMENT '更新策略: MANUAL, AUTO_MINOR, AUTO_ALL',
    last_applied_at TIMESTAMP WITH TIME ZONE COMMENT '上次应用时间',
    last_checked_at TIMESTAMP WITH TIME ZONE COMMENT '上次检查更新时间',
    pending_version INT COMMENT '待处理的更新版本',
    notification_status VARCHAR(20) DEFAULT 'NONE' COMMENT '通知状态: NONE, PENDING, NOTIFIED, DISMISSED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    UNIQUE KEY uk_factory (factory_id),
    INDEX idx_blueprint (blueprint_id),
    INDEX idx_pending (blueprint_id, pending_version),
    INDEX idx_outdated (blueprint_id, applied_version, latest_version)
);
