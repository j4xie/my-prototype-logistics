-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_25__add_conversion_change_history_table.sql
-- Conversion date: 2026-01-26 18:45:43
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- 转换率变更历史记录表
-- 用于追踪转换率配置的变更，供AI分析使用
-- Created: 2025-12-25
-- ============================================================

CREATE TABLE IF NOT EXISTS conversion_change_history (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键ID (UUID)',
    conversion_id VARCHAR(36) NOT NULL COMMENT '关联的转换率配置ID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    material_type_id VARCHAR(50) COMMENT '原料类型ID (冗余存储便于查询)',
    product_type_id VARCHAR(50) COMMENT '产品类型ID (冗余存储便于查询)',

    -- 变更类型
    change_type VARCHAR(20) NOT NULL COMMENT '变更类型: CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE',

    -- 变更前后的值
    old_conversion_rate DECIMAL(10,4) COMMENT '变更前的转换率',
    new_conversion_rate DECIMAL(10,4) COMMENT '变更后的转换率',
    old_wastage_rate DECIMAL(10,4) COMMENT '变更前的损耗率',
    new_wastage_rate DECIMAL(10,4) COMMENT '变更后的损耗率',

    -- 变更说明
    reason TEXT COMMENT '变更原因 (可选)',
    notes TEXT COMMENT '备注',

    -- 操作信息
    changed_by BIGINT COMMENT '操作人用户ID',
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '变更时间',

    -- 审计字段 (BaseEntity)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE NULL COMMENT '软删除时间',

    -- 索引
    INDEX idx_cch_conversion_id (conversion_id),
    INDEX idx_cch_factory_material (factory_id, material_type_id),
    INDEX idx_cch_changed_at (changed_at),
    INDEX idx_cch_factory_changed_at (factory_id, changed_at),
    INDEX idx_cch_change_type (factory_id, change_type)
)
;
