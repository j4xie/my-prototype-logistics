-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_22_002__add_frontend_compatible_fields.sql
-- Conversion date: 2026-01-26 18:49:20
-- ============================================

-- =====================================================
-- V2026_01_22_002: 添加前端兼容字段
-- 修复前后端字段不一致问题
-- =====================================================

-- 1. Customer 表添加 businessType 和 customerType 字段
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) NULL COMMENT '业务类型',
ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) NULL COMMENT '客户类型';

-- 2. Supplier 表添加 businessType, creditLevel, deliveryArea 字段
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) NULL COMMENT '业务类型',
ADD COLUMN IF NOT EXISTS credit_level VARCHAR(20) NULL COMMENT '信用等级',
ADD COLUMN IF NOT EXISTS delivery_area VARCHAR(200) NULL COMMENT '配送区域';

-- 3. 添加索引以优化查询
CREATE INDEX IF NOT EXISTS idx_customer_business_type ON customers(business_type);
CREATE INDEX IF NOT EXISTS idx_customer_customer_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_supplier_business_type ON suppliers(business_type);
CREATE INDEX IF NOT EXISTS idx_supplier_credit_level ON suppliers(credit_level);
