-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_14_3__bom_sample_data.sql
-- Conversion date: 2026-01-26 18:48:23
-- WARNING: This file requires manual review!
-- ============================================

-- BOM 示例数据 - 为工厂 F001 的主要产品配置 BOM
-- 基于食品加工行业的典型配方结构

-- 首先获取工厂 F001 的产品类型
-- 假设有以下产品: 酱料类、调味料类

-- 插入 BOM 项目示例数据 (如果不存在)
-- TODO: Add ON CONFLICT DO NOTHING clause
INSERT INTO bom_items (factory_id, product_type_id, material_type_id, material_name, standard_quantity, yield_rate, unit, unit_price, tax_rate, sort_order, notes)
SELECT
    'F001' as factory_id,
    pt.id as product_type_id,
    CONCAT('MAT-', pt.code, '-001') as material_type_id,
    '主料' as material_name,
    0.6000 as standard_quantity,
    95.00 as yield_rate,
    'kg' as unit,
    15.5000 as unit_price,
    13.00 as tax_rate,
    1 as sort_order,
    'BOM自动生成示例数据' as notes
FROM product_types pt
WHERE pt.factory_id = 'F001'
  AND pt.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM bom_items bi
    WHERE bi.factory_id = 'F001'
    AND bi.product_type_id = pt.id
  )
LIMIT 5;

-- 为已有产品添加辅料 BOM 项
-- TODO: Add ON CONFLICT DO NOTHING clause
INSERT INTO bom_items (factory_id, product_type_id, material_type_id, material_name, standard_quantity, yield_rate, unit, unit_price, tax_rate, sort_order, notes)
SELECT
    'F001' as factory_id,
    pt.id as product_type_id,
    CONCAT('MAT-', pt.code, '-002') as material_type_id,
    '辅料A' as material_name,
    0.1500 as standard_quantity,
    98.00 as yield_rate,
    'kg' as unit,
    8.2000 as unit_price,
    13.00 as tax_rate,
    2 as sort_order,
    'BOM自动生成示例数据' as notes
FROM product_types pt
WHERE pt.factory_id = 'F001'
  AND pt.is_active = 1
  AND EXISTS (
    SELECT 1 FROM bom_items bi
    WHERE bi.factory_id = 'F001'
    AND bi.product_type_id = pt.id
    AND bi.sort_order = 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM bom_items bi
    WHERE bi.factory_id = 'F001'
    AND bi.product_type_id = pt.id
    AND bi.sort_order = 2
  )
LIMIT 5;

-- 添加调味料 BOM 项
-- TODO: Add ON CONFLICT DO NOTHING clause
INSERT INTO bom_items (factory_id, product_type_id, material_type_id, material_name, standard_quantity, yield_rate, unit, unit_price, tax_rate, sort_order, notes)
SELECT
    'F001' as factory_id,
    pt.id as product_type_id,
    CONCAT('MAT-', pt.code, '-003') as material_type_id,
    '调味料' as material_name,
    0.0500 as standard_quantity,
    100.00 as yield_rate,
    'kg' as unit,
    25.0000 as unit_price,
    13.00 as tax_rate,
    3 as sort_order,
    'BOM自动生成示例数据' as notes
FROM product_types pt
WHERE pt.factory_id = 'F001'
  AND pt.is_active = 1
  AND EXISTS (
    SELECT 1 FROM bom_items bi
    WHERE bi.factory_id = 'F001'
    AND bi.product_type_id = pt.id
    AND bi.sort_order = 2
  )
  AND NOT EXISTS (
    SELECT 1 FROM bom_items bi
    WHERE bi.factory_id = 'F001'
    AND bi.product_type_id = pt.id
    AND bi.sort_order = 3
  )
LIMIT 5;

-- 插入人工费用配置示例 (如果不存在)
-- TODO: Add ON CONFLICT DO NOTHING clause
INSERT INTO labor_cost_configs (factory_id, product_type_id, process_name, process_category, unit_price, price_unit, standard_quantity, sort_order, notes)
VALUES
    ('F001', NULL, '分拣工序', '前处理', 1.2000, '元/kg', NULL, 1, '通用人工费配置'),
    ('F001', NULL, '清洗工序', '前处理', 0.8000, '元/kg', NULL, 2, '通用人工费配置'),
    ('F001', NULL, '切配工序', '加工', 1.5000, '元/kg', NULL, 3, '通用人工费配置'),
    ('F001', NULL, '包装工序', '后处理', 0.6000, '元/kg', NULL, 4, '通用人工费配置'),
    ('F001', NULL, '质检工序', '质量', 0.3000, '元/kg', NULL, 5, '通用人工费配置');

-- 插入均摊费用配置 (如果不存在)
-- TODO: Add ON CONFLICT DO NOTHING clause
INSERT INTO overhead_cost_configs (factory_id, name, category, unit_price, price_unit, allocation_rate, sort_order, notes)
SELECT * FROM (
    SELECT 'F001' as factory_id, '场地租金' as name, '固定成本' as category, 1.5000 as unit_price, '元/kg' as price_unit, 0.15 as allocation_rate, 1 as sort_order, '月度分摊' as notes
    UNION ALL
    SELECT 'F001', '水电费', '可变成本', 0.8000, '元/kg', 0.10, 2, '月度分摊'
    UNION ALL
    SELECT 'F001', '设备折旧', '固定成本', 0.5000, '元/kg', 0.08, 3, '年度分摊/12'
    UNION ALL
    SELECT 'F001', '管理费用', '间接成本', 0.4000, '元/kg', 0.05, 4, '月度分摊'
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM overhead_cost_configs oc
    WHERE oc.factory_id = 'F001'
    AND oc.name = tmp.name
);
