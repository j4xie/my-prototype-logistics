-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_04_50__intent_version_snapshot.sql
-- Conversion date: 2026-01-26 18:47:24
-- WARNING: This file requires manual review!
-- ============================================

-- ==============================================
-- V2026_01_04_50__intent_version_snapshot.sql
--
-- 意图配置版本快照支持
--
-- 功能:
-- 1. 为 ai_intent_configs 添加版本控制字段
-- 2. 创建历史记录表用于审计和回滚
--
-- 设计原则:
-- - 简化版版本控制，不做复杂灰度系统
-- - 每次修改自动保存前一版本快照
-- - 支持一键回滚到上个版本
--
-- @author Cretas Team
-- @version 1.0.0
-- @since 2026-01-04
-- ==============================================

-- 1. 为 ai_intent_configs 添加版本控制字段
ALTER TABLE ai_intent_configs
ADD COLUMN IF NOT EXISTS config_version INT DEFAULT 1 COMMENT '配置版本号，从1开始递增',
ADD COLUMN IF NOT EXISTS previous_snapshot JSON COMMENT '上个版本的完整配置快照，用于一键回滚';

-- 添加索引以支持版本查询
CREATE INDEX IF NOT EXISTS idx_intent_config_version
ON ai_intent_configs(factory_id, config_version);
-- 2. 创建意图配置历史记录表（用于审计和回滚）
CREATE TABLE IF NOT EXISTS ai_intent_config_history (
    id BIGSERIAL PRIMARY KEY,

    -- 关联的配置ID
    intent_config_id VARCHAR(36) NOT NULL COMMENT '关联的意图配置ID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    intent_code VARCHAR(50) NOT NULL COMMENT '意图代码',

    -- 版本信息
    version_number INT NOT NULL COMMENT '版本号',

    -- 完整配置快照
    snapshot JSON NOT NULL COMMENT '完整的配置快照（JSON格式）',

    -- 变更信息
    changed_by BIGINT COMMENT '修改人ID',
    changed_by_name VARCHAR(100) COMMENT '修改人姓名',
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '修改时间',
    change_reason VARCHAR(500) COMMENT '修改原因/备注',
    change_type ENUM('CREATE', 'UPDATE', 'ROLLBACK', 'DELETE') DEFAULT 'UPDATE' COMMENT '变更类型',

    -- 变更详情
    changed_fields JSON COMMENT '变更的字段列表',

    -- 索引
    INDEX idx_config_version (intent_config_id, version_number),
    INDEX idx_factory_intent (factory_id, intent_code),
    INDEX idx_changed_at (changed_at),

    -- 外键约束（可选，取决于数据完整性需求）
    -- FOREIGN KEY (intent_config_id) REFERENCES ai_intent_configs(id) ON DELETE CASCADE

    CONSTRAINT uk_config_version UNIQUE (intent_config_id, version_number)
)
;
-- 3. 创建回滚操作日志表
CREATE TABLE IF NOT EXISTS ai_intent_config_rollback_log (
    id BIGSERIAL PRIMARY KEY,

    -- 回滚范围
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    rollback_scope ENUM('SINGLE', 'FACTORY', 'GLOBAL') DEFAULT 'SINGLE' COMMENT '回滚范围',

    -- 回滚版本信息
    from_version INT COMMENT '回滚前版本',
    to_version INT COMMENT '回滚到版本',

    -- 受影响的配置
    affected_configs JSON COMMENT '受影响的配置ID列表',
    affected_count INT DEFAULT 0 COMMENT '受影响的配置数量',

    -- 操作信息
    rollback_by BIGINT COMMENT '操作人ID',
    rollback_by_name VARCHAR(100) COMMENT '操作人姓名',
    rollback_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '回滚时间',
    rollback_reason VARCHAR(500) COMMENT '回滚原因',

    -- 状态
    status ENUM('STARTED', 'COMPLETED', 'FAILED', 'PARTIAL') DEFAULT 'STARTED' COMMENT '回滚状态',
    error_message TEXT COMMENT '错误信息（如果失败）',

    -- 索引
    INDEX idx_factory_rollback (factory_id, rollback_at),
    INDEX idx_status (status)

)
;
-- 4. 初始化现有配置的版本号
UPDATE ai_intent_configs
SET config_version = 1, previous_snapshot = NULL
WHERE config_version IS NULL;
-- 5. 创建版本快照保存的触发器（可选，也可由应用层处理）
-- 注意：触发器会增加写入开销，生产环境可考虑只用应用层逻辑
/*
DELIMITER //
CREATE TRIGGER trg_intent_config_before_update
BEFORE UPDATE ON ai_intent_configs
FOR EACH ROW
BEGIN
    -- 保存当前状态到快照字段
    SET NEW.previous_snapshot = JSON_OBJECT(
        'intent_code', OLD.intent_code,
        'intent_name', OLD.intent_name,
        'keywords', OLD.keywords,
        'description', OLD.description,
        'intent_category', OLD.intent_category,
        'sensitivity_level', OLD.sensitivity_level,
        'auto_execute', OLD.auto_execute,
        'enabled', OLD.enabled,
        'config_version', OLD.config_version,
        'updated_at', OLD.updated_at
    );

    -- 递增版本号
    SET NEW.config_version = OLD.config_version + 1;
END//
DELIMITER ;
*/
-- 完成
SELECT 'V2026_01_04_50: Intent version snapshot tables created successfully' AS migration_status;
