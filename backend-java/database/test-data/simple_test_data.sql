-- 简化版测试数据脚本
-- 只插入核心字段

USE cretas_db;

-- 1. 产品类型 (使用实际表结构)
INSERT IGNORE INTO product_types (id, factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at) VALUES
('PT001', 'CRETAS_2024_001', '冷冻鱼片', 'PT001', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT002', 'CRETAS_2024_001', '冷冻虾仁', 'PT002', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT003', 'CRETAS_2024_001', '冷冻鱼块', 'PT003', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT004', 'CRETAS_2024_001', '冷冻鸡肉', 'PT004', '肉类', '公斤', 1, 180, NOW(), NOW()),
('PT005', 'CRETAS_2024_001', '速冻蔬菜', 'PT005', '蔬菜', '公斤', 1, 180, NOW(), NOW());

-- 2. 原料类型
INSERT IGNORE INTO raw_material_types (id, factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_at, updated_at) VALUES
('RMT001', 'CRETAS_2024_001', '鲜活鱼', 'RMT001', '海鲜', '公斤', '冷藏', 1, 3, NOW(), NOW()),
('RMT002', 'CRETAS_2024_001', '冷冻虾', 'RMT002', '海鲜', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('RMT003', 'CRETAS_2024_001', '鲜鸡肉', 'RMT003', '肉类', '公斤', '冷藏', 1, 7, NOW(), NOW()),
('RMT004', 'CRETAS_2024_001', '食盐', 'RMT004', '调料', '公斤', '常温', 1, 730, NOW(), NOW()),
('RMT005', 'CRETAS_2024_001', '新鲜蔬菜', 'RMT005', '蔬菜', '公斤', '冷藏', 1, 5, NOW(), NOW());

-- 3. 部门
INSERT IGNORE INTO departments (id, factory_id, name, code, is_active, display_order, created_at, updated_at) VALUES
(10, 'CRETAS_2024_001', '加工部', 'DEPT_PROC', 1, 1, NOW(), NOW()),
(11, 'CRETAS_2024_001', '质检部', 'DEPT_QC', 1, 2, NOW(), NOW()),
(12, 'CRETAS_2024_001', '仓储部', 'DEPT_WARE', 1, 3, NOW(), NOW()),
(13, 'CRETAS_2024_001', '管理部', 'DEPT_MGMT', 1, 4, NOW(), NOW());

-- 4. 供应商
INSERT IGNORE INTO suppliers (id, factory_id, name, contact_person, phone, email, address, category, rating, status, created_at, updated_at) VALUES
(10, 'CRETAS_2024_001', '海洋渔业有限公司', '张三', '13800138001', 'zhangsan@ocean.com', '浙江省舟山市', '海鲜', 5, 'active', NOW(), NOW()),
(11, 'CRETAS_2024_001', '新鲜禽肉批发', '李四', '13800138002', 'lisi@poultry.com', '山东省济南市', '肉类', 4, 'active', NOW(), NOW()),
(12, 'CRETAS_2024_001', '绿色蔬菜基地', '王五', '13800138003', 'wangwu@veg.com', '江苏省南京市', '蔬菜', 4, 'active', NOW(), NOW()),
(13, 'CRETAS_2024_001', '优质调料供应商', '赵六', '13800138004', 'zhaoliu@spice.com', '广东省广州市', '调料', 5, 'active', NOW(), NOW());

-- 5. 客户
INSERT IGNORE INTO customers (id, factory_id, name, contact_person, phone, email, address, category, credit_limit, status, created_at, updated_at) VALUES
(10, 'CRETAS_2024_001', '大型连锁超市A', '陈经理', '13900139001', 'chen@supermarket-a.com', '上海市浦东新区', '零售', 500000.00, 'active', NOW(), NOW()),
(11, 'CRETAS_2024_001', '酒店集团B', '刘经理', '13900139002', 'liu@hotel-b.com', '北京市朝阳区', '餐饮', 300000.00, 'active', NOW(), NOW()),
(12, 'CRETAS_2024_001', '食品批发市场C', '周经理', '13900139003', 'zhou@market-c.com', '广州市天河区', '批发', 800000.00, 'active', NOW(), NOW()),
(13, 'CRETAS_2024_001', '连锁餐厅D', '吴经理', '13900139004', 'wu@restaurant-d.com', '深圳市福田区', '餐饮', 200000.00, 'active', NOW(), NOW());

-- 验证插入结果
SELECT 'Product Types' AS Category, COUNT(*) AS Count FROM product_types WHERE factory_id='CRETAS_2024_001' AND deleted_at IS NULL
UNION ALL SELECT 'Raw Material Types', COUNT(*) FROM raw_material_types WHERE factory_id='CRETAS_2024_001' AND deleted_at IS NULL
UNION ALL SELECT 'Departments', COUNT(*) FROM departments WHERE factory_id='CRETAS_2024_001' AND deleted_at IS NULL
UNION ALL SELECT 'Suppliers', COUNT(*) FROM suppliers WHERE factory_id='CRETAS_2024_001' AND deleted_at IS NULL
UNION ALL SELECT 'Customers', COUNT(*) FROM customers WHERE factory_id='CRETAS_2024_001' AND deleted_at IS NULL;

SELECT '✅ 核心测试数据插入完成' AS Status;
