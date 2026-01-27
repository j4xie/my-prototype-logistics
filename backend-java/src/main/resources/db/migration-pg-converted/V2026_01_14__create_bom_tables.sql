-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_14__create_bom_tables.sql
-- Conversion date: 2026-01-26 18:48:26
-- ============================================

-- BOM 物料清单表
CREATE TABLE IF NOT EXISTS bom_items (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    product_type_id VARCHAR(50) NOT NULL,
    material_type_id VARCHAR(50) NOT NULL,
    material_name VARCHAR(200),
    standard_quantity DECIMAL(10,6),
    yield_rate DECIMAL(5,2),
    unit VARCHAR(20),
    unit_price DECIMAL(10,4),
    tax_rate DECIMAL(5,2),
    sort_order INT DEFAULT 0,
    notes VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE KEY uk_bom_item (factory_id, product_type_id, material_type_id),
    INDEX idx_bom_factory (factory_id),
    INDEX idx_bom_product (product_type_id)
);

-- 人工费用配置表
CREATE TABLE IF NOT EXISTS labor_cost_configs (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    product_type_id VARCHAR(50),
    process_name VARCHAR(100) NOT NULL,
    process_category VARCHAR(50),
    unit_price DECIMAL(10,4) NOT NULL,
    price_unit VARCHAR(20) DEFAULT '元/kg',
    standard_quantity DECIMAL(10,4),
    sort_order INT DEFAULT 0,
    notes VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    INDEX idx_labor_factory (factory_id),
    INDEX idx_labor_product (product_type_id)
);

-- 均摊费用配置表
CREATE TABLE IF NOT EXISTS overhead_cost_configs (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    unit_price DECIMAL(10,4) NOT NULL,
    price_unit VARCHAR(20) DEFAULT '元/kg',
    allocation_rate DECIMAL(10,4),
    sort_order INT DEFAULT 0,
    notes VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    INDEX idx_overhead_factory (factory_id)
);

-- 插入默认均摊费用配置示例
INSERT INTO overhead_cost_configs (factory_id, name, category, unit_price, price_unit, allocation_rate, sort_order)
VALUES
    ('F001', '热加工房租', '固定成本', 1.2000, '元/kg', 0.1, 1),
    ('F001', '热加工水电', '固定成本', 0.6000, '元/kg', 0.1, 2),
    ('F001', '燃气', '可变成本', 0.5700, '元/kg', 0.1, 3),
    ('F001', '后端毛利', '利润', 3.0000, '元/kg', 0.1, 4);
