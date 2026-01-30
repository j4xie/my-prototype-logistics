-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_22_01__dialect_mappings_table.sql
-- Conversion date: 2026-01-26 18:49:22
-- WARNING: This file requires manual review!
-- ============================================

-- =============================================================================
-- 方言/口语映射表
-- 用于存储方言/口语表达到标准表达的映射关系
-- 支持自学习和工厂级别的定制化映射
-- =============================================================================

CREATE TABLE IF NOT EXISTS dialect_mappings (
    id BIGSERIAL PRIMARY KEY,

    -- 方言/口语表达
    dialect_expr VARCHAR(100) NOT NULL COMMENT '方言/口语表达',

    -- 标准表达
    standard_expr VARCHAR(100) NOT NULL COMMENT '标准表达',

    -- 工厂ID（可为空表示全局映射）
    factory_id VARCHAR(50) NULL COMMENT '工厂ID，NULL表示全局映射',

    -- 置信度 (0.0 - 1.0)
    confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0 COMMENT '映射置信度',

    -- 使用统计
    use_count INT NOT NULL DEFAULT 0 COMMENT '使用次数',
    success_count INT NOT NULL DEFAULT 0 COMMENT '成功次数',

    -- 映射类型
    mapping_type VARCHAR(20) NOT NULL DEFAULT 'OTHER' COMMENT '映射类型: TIME, VERB, NOUN, QUESTION, FILLER, DIALECT, OTHER',

    -- 来源
    source VARCHAR(20) NOT NULL DEFAULT 'PRESET' COMMENT '来源: PRESET, LEARNED, USER_FEEDBACK, ADMIN',

    -- 是否启用
    enabled SMALLINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE NULL COMMENT '软删除时间',

    -- 索引
    INDEX idx_dialect_expr (dialect_expr),
    INDEX idx_factory_id (factory_id),
    INDEX idx_confidence (confidence),
    INDEX idx_mapping_type (mapping_type),
    INDEX idx_source (source),
    INDEX idx_enabled (enabled),

    -- 唯一约束：相同方言表达在同一工厂（或全局）只能有一个映射
    UNIQUE KEY uk_dialect_factory (dialect_expr, factory_id)
)
;
