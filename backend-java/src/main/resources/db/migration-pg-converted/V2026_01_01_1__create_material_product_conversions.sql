-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_01_1__create_material_product_conversions.sql
-- Conversion date: 2026-01-26 18:46:52
-- ============================================

-- 原材料-产品转换率配置表
CREATE TABLE IF NOT EXISTS material_product_conversions (
    id VARCHAR(191) PRIMARY KEY COMMENT '主键ID (UUID)',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    material_type_id VARCHAR(191) NOT NULL COMMENT '原材料类型ID',
    product_type_id VARCHAR(191) NOT NULL COMMENT '产品类型ID',
    conversion_rate DECIMAL(10,4) NOT NULL COMMENT '转换率',
    wastage_rate DECIMAL(5,2) DEFAULT 0 COMMENT '损耗率',
    standard_usage DECIMAL(10,4) COMMENT '标准用量',
    min_batch_size DECIMAL(10,2) COMMENT '最小批量',
    max_batch_size DECIMAL(10,2) COMMENT '最大批量',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否激活',
    notes TEXT COMMENT '备注',
    created_by BIGINT COMMENT '创建人ID',
    updated_by BIGINT COMMENT '更新人ID',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE NULL COMMENT '软删除时间',
    UNIQUE KEY uk_conversion (factory_id, material_type_id, product_type_id),
    INDEX idx_conversion_factory (factory_id),
    INDEX idx_conversion_material (material_type_id),
    INDEX idx_conversion_product (product_type_id)
);
