-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_31_3__create_sop_config_table.sql
-- Conversion date: 2026-01-26 18:46:33
-- WARNING: This file requires manual review!
-- ============================================

-- =====================================================
-- Sprint 2 S2-2: SOP Configuration Table
-- 用途: 存储标准操作流程 (SOP) 配置
-- =====================================================

-- 1. 创建 SOP 配置表
CREATE TABLE IF NOT EXISTS sop_configs (
    id VARCHAR(50) PRIMARY KEY,

    -- 工厂隔离
    factory_id VARCHAR(50) NOT NULL,

    -- SOP 基本信息
    name VARCHAR(100) NOT NULL COMMENT 'SOP名称',
    code VARCHAR(50) NOT NULL COMMENT 'SOP编码',
    description TEXT COMMENT 'SOP描述',

    -- 关联实体类型
    entity_type VARCHAR(50) NOT NULL COMMENT '关联实体类型: PRODUCTION_BATCH, MATERIAL_BATCH, QUALITY_CHECK',

    -- 关联产品类型 (可选，为空则适用于所有产品)
    product_type_id VARCHAR(100) NULL COMMENT '关联产品类型ID',

    -- Sprint 2 S2-3: 规则组关联
    rule_group_id VARCHAR(50) NULL COMMENT '关联的规则组ID (对应 drools_rules.rule_group)',

    -- SOP 步骤配置 (JSON 数组)
    -- 格式: [{"stageType": "SLICING", "orderIndex": 1, "requiredSkillLevel": 3,
    --         "photoRequired": true, "timeLimitMinutes": 30, "ruleIds": ["rule1"]}]
    steps_json JSON COMMENT 'SOP步骤配置JSON',

    -- 验证规则配置 (JSON 对象)
    -- 格式: {"onStart": ["rule1"], "onComplete": ["rule2"], "crossStep": ["rule3"]}
    validation_rules_json JSON COMMENT '验证规则配置JSON',

    -- 拍照证据配置 (Sprint 2 S2-4 预留)
    photo_config_json JSON COMMENT '拍照配置JSON: {"required": true, "stages": ["PACKAGING"]}',

    -- 版本控制
    version INT NOT NULL DEFAULT 1 COMMENT '版本号',

    -- 状态
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用',

    -- 创建者
    created_by BIGINT NULL COMMENT '创建者用户ID',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    -- 唯一约束: 同一工厂内 SOP 编码唯一
    UNIQUE KEY uk_sop_factory_code (factory_id, code),

    -- 索引
    INDEX idx_sop_factory (factory_id),
    INDEX idx_sop_entity_type (entity_type),
    INDEX idx_sop_product_type (product_type_id),
    INDEX idx_sop_rule_group (rule_group_id),
    INDEX idx_sop_active (is_active)
);

-- 2. 添加外键约束 (可选，根据实际情况启用)
-- ALTER TABLE sop_configs
-- ADD CONSTRAINT fk_sop_factory FOREIGN KEY (factory_id) REFERENCES factories(id);

-- ALTER TABLE sop_configs
-- ADD CONSTRAINT fk_sop_product_type FOREIGN KEY (product_type_id) REFERENCES product_types(id);
