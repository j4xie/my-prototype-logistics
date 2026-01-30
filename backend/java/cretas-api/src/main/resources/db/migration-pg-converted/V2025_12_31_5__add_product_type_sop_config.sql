-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_31_5__add_product_type_sop_config.sql
-- Conversion date: 2026-01-26 18:46:40
-- ============================================

-- =====================================================
-- Sprint 2 S2-5: 产品类型SOP配置关联
-- 用途: 为产品类型添加默认SOP配置关联
-- =====================================================

-- 1. 添加 default_sop_config_id 字段到产品类型表
ALTER TABLE product_types
    ADD COLUMN IF NOT EXISTS default_sop_config_id VARCHAR(50) NULL COMMENT '默认SOP配置ID';

-- 2. 添加索引
CREATE INDEX IF NOT EXISTS idx_product_sop ON product_types(default_sop_config_id);

