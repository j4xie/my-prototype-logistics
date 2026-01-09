-- =============================================================================
-- SQL Script: Populate Production Batch Cost Data for Factory F001
-- Description: 为 F001 工厂的生产批次添加符合食品加工行业特点的成本测试数据
--
-- Cost Distribution (食品加工行业典型成本结构):
--   - material_cost (原材料成本): 60-70%
--   - labor_cost (人工成本): 15-25%
--   - equipment_cost (设备成本): 5-15%
--   - other_cost (其他成本): 5-10%
--
-- Author: Claude Code
-- Created: 2026-01-08
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 方案 1: 基于产品数量的成本计算（推荐）
-- 假设基础单位成本约 18-35 元/单位，根据产品类型浮动
-- -----------------------------------------------------------------------------

UPDATE production_batches pb
SET
    -- 原材料成本: 基于数量 * 单位原料成本 (10-22元/单位，占总成本约65%)
    material_cost = ROUND(
        COALESCE(actual_quantity, quantity) * (10 + RAND() * 12),
        2
    ),

    -- 人工成本: 基于数量 * 单位人工成本 (3-6元/单位，占总成本约20%)
    labor_cost = ROUND(
        COALESCE(actual_quantity, quantity) * (3 + RAND() * 3),
        2
    ),

    -- 设备成本: 基于数量 * 单位设备成本 (1.5-4元/单位，占总成本约10%)
    equipment_cost = ROUND(
        COALESCE(actual_quantity, quantity) * (1.5 + RAND() * 2.5),
        2
    ),

    -- 其他成本: 基于数量 * 单位其他成本 (0.8-2元/单位，占总成本约5%)
    other_cost = ROUND(
        COALESCE(actual_quantity, quantity) * (0.8 + RAND() * 1.2),
        2
    )
WHERE factory_id = 'F001';

-- -----------------------------------------------------------------------------
-- 步骤 2: 计算总成本和单位成本
-- -----------------------------------------------------------------------------

UPDATE production_batches pb
SET
    -- 总成本 = 原材料 + 人工 + 设备 + 其他
    total_cost = ROUND(
        COALESCE(material_cost, 0) +
        COALESCE(labor_cost, 0) +
        COALESCE(equipment_cost, 0) +
        COALESCE(other_cost, 0),
        2
    )
WHERE factory_id = 'F001';

-- 单位成本 = 总成本 / 良品数量（或实际产量）
UPDATE production_batches pb
SET
    unit_cost = ROUND(
        total_cost / GREATEST(
            COALESCE(good_quantity, COALESCE(actual_quantity, quantity)),
            1  -- 防止除零
        ),
        4
    )
WHERE factory_id = 'F001'
  AND total_cost IS NOT NULL
  AND total_cost > 0;


-- =============================================================================
-- 方案 2: 按产品类型差异化成本（更精细控制）
-- 不同产品类型有不同的成本结构
-- =============================================================================

/*
-- 高端产品（如精品牛肉）: 更高的原材料成本
UPDATE production_batches pb
SET
    material_cost = ROUND(COALESCE(actual_quantity, quantity) * (25 + RAND() * 10), 2),
    labor_cost = ROUND(COALESCE(actual_quantity, quantity) * (5 + RAND() * 3), 2),
    equipment_cost = ROUND(COALESCE(actual_quantity, quantity) * (2 + RAND() * 2), 2),
    other_cost = ROUND(COALESCE(actual_quantity, quantity) * (1 + RAND() * 1), 2)
WHERE factory_id = 'F001'
  AND product_name LIKE '%牛肉%';

-- 普通产品（如鸡肉制品）: 中等成本
UPDATE production_batches pb
SET
    material_cost = ROUND(COALESCE(actual_quantity, quantity) * (12 + RAND() * 6), 2),
    labor_cost = ROUND(COALESCE(actual_quantity, quantity) * (3 + RAND() * 2), 2),
    equipment_cost = ROUND(COALESCE(actual_quantity, quantity) * (1.5 + RAND() * 1.5), 2),
    other_cost = ROUND(COALESCE(actual_quantity, quantity) * (0.8 + RAND() * 0.8), 2)
WHERE factory_id = 'F001'
  AND product_name LIKE '%鸡%';

-- 加工品（如香肠、火腿）: 更高的人工和设备成本
UPDATE production_batches pb
SET
    material_cost = ROUND(COALESCE(actual_quantity, quantity) * (8 + RAND() * 5), 2),
    labor_cost = ROUND(COALESCE(actual_quantity, quantity) * (5 + RAND() * 4), 2),
    equipment_cost = ROUND(COALESCE(actual_quantity, quantity) * (3 + RAND() * 3), 2),
    other_cost = ROUND(COALESCE(actual_quantity, quantity) * (1 + RAND() * 1.5), 2)
WHERE factory_id = 'F001'
  AND (product_name LIKE '%香肠%' OR product_name LIKE '%火腿%');
*/


-- =============================================================================
-- 方案 3: 固定金额范围的随机成本（简单方案，适合演示）
-- =============================================================================

/*
UPDATE production_batches pb
SET
    material_cost = ROUND(5000 + RAND() * 25000, 2),   -- 5000-30000 元
    labor_cost = ROUND(1500 + RAND() * 6000, 2),       -- 1500-7500 元
    equipment_cost = ROUND(500 + RAND() * 3000, 2),    -- 500-3500 元
    other_cost = ROUND(300 + RAND() * 1500, 2)         -- 300-1800 元
WHERE factory_id = 'F001';

-- 计算总成本和单位成本
UPDATE production_batches pb
SET
    total_cost = COALESCE(material_cost, 0) + COALESCE(labor_cost, 0) +
                 COALESCE(equipment_cost, 0) + COALESCE(other_cost, 0),
    unit_cost = ROUND(
        (COALESCE(material_cost, 0) + COALESCE(labor_cost, 0) +
         COALESCE(equipment_cost, 0) + COALESCE(other_cost, 0)) /
        GREATEST(COALESCE(good_quantity, COALESCE(actual_quantity, quantity)), 1),
        4
    )
WHERE factory_id = 'F001';
*/


-- =============================================================================
-- 验证查询：检查成本数据分布
-- =============================================================================

/*
-- 查看更新后的成本数据汇总
SELECT
    batch_number,
    product_name,
    COALESCE(actual_quantity, quantity) AS production_quantity,
    material_cost,
    labor_cost,
    equipment_cost,
    other_cost,
    total_cost,
    unit_cost,
    -- 成本占比验证
    ROUND(material_cost / total_cost * 100, 1) AS material_pct,
    ROUND(labor_cost / total_cost * 100, 1) AS labor_pct,
    ROUND(equipment_cost / total_cost * 100, 1) AS equipment_pct,
    ROUND(other_cost / total_cost * 100, 1) AS other_pct
FROM production_batches
WHERE factory_id = 'F001'
  AND total_cost IS NOT NULL
ORDER BY batch_number;

-- 成本统计汇总
SELECT
    COUNT(*) AS batch_count,
    SUM(total_cost) AS total_production_cost,
    AVG(unit_cost) AS avg_unit_cost,
    MIN(unit_cost) AS min_unit_cost,
    MAX(unit_cost) AS max_unit_cost,
    -- 平均成本结构
    ROUND(AVG(material_cost / total_cost) * 100, 1) AS avg_material_pct,
    ROUND(AVG(labor_cost / total_cost) * 100, 1) AS avg_labor_pct,
    ROUND(AVG(equipment_cost / total_cost) * 100, 1) AS avg_equipment_pct,
    ROUND(AVG(other_cost / total_cost) * 100, 1) AS avg_other_pct
FROM production_batches
WHERE factory_id = 'F001'
  AND total_cost IS NOT NULL;
*/


-- =============================================================================
-- 说明
-- =============================================================================
--
-- 成本计算逻辑:
-- 1. material_cost: 基于 (actual_quantity 或 quantity) * (10-22 元/单位)
-- 2. labor_cost: 基于 (actual_quantity 或 quantity) * (3-6 元/单位)
-- 3. equipment_cost: 基于 (actual_quantity 或 quantity) * (1.5-4 元/单位)
-- 4. other_cost: 基于 (actual_quantity 或 quantity) * (0.8-2 元/单位)
-- 5. total_cost: 四项成本之和
-- 6. unit_cost: total_cost / good_quantity (或 actual_quantity)
--
-- 预期成本占比:
--   原材料: ~65% (食品行业原料成本占主导)
--   人工:   ~20% (加工环节需要人力)
--   设备:   ~10% (设备折旧和能耗)
--   其他:   ~5%  (包装、物流、管理费用)
--
-- 预期单位成本: 15-35 元/单位 (根据产品和数量波动)
-- =============================================================================
