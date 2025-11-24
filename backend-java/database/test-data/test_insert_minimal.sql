-- 最小化测试：先测试单个产品类型插入
-- 请先执行这个，如果成功再执行完整的

USE cretas_db;  -- 或 USE cretas; (根据您的实际数据库名)

-- 测试1: 最简单的插入（只包含必填字段）
INSERT INTO product_types (factory_id, name, code, unit, is_active, created_at, updated_at) 
VALUES ('F001', '测试产品1', 'TEST001', '公斤', 1, NOW(), NOW());

-- 查看是否成功
SELECT '测试1结果' AS Test, COUNT(*) AS Count FROM product_types WHERE code = 'TEST001';

-- 如果上面成功，测试2: 添加更多字段
INSERT INTO product_types (factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at) 
VALUES ('F001', '测试产品2', 'TEST002', '海鲜', '公斤', 1, 365, NOW(), NOW());

-- 查看是否成功
SELECT '测试2结果' AS Test, COUNT(*) AS Count FROM product_types WHERE code = 'TEST002';

-- 查看所有测试数据
SELECT id, factory_id, name, code, category FROM product_types WHERE code LIKE 'TEST%';


