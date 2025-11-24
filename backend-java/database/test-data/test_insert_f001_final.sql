-- 最终版本：根据实际表结构插入数据
-- 使用 super_admin 的 id (20) 作为 created_by

USE cretas;  -- 或 cretas_db，根据实际数据库名

-- ===== 1. 插入产品类型 (包含所有必填字段) =====
INSERT INTO product_types (factory_id, name, code, category, unit, is_active, shelf_life_days, created_by, created_at, updated_at) VALUES
('F001', '冷冻鱼片', 'PT001', '海鲜', '公斤', 1, 365, 20, NOW(), NOW()),
('F001', '冷冻虾仁', 'PT002', '海鲜', '公斤', 1, 365, 20, NOW(), NOW()),
('F001', '冷冻鱼块', 'PT003', '海鲜', '公斤', 1, 365, 20, NOW(), NOW()),
('F001', '冷冻鸡肉', 'PT004', '肉类', '公斤', 1, 180, 20, NOW(), NOW()),
('F001', '速冻蔬菜', 'PT005', '蔬菜', '公斤', 1, 180, 20, NOW(), NOW());

-- ===== 2. 插入原材料类型 (包含 created_by) =====
INSERT INTO raw_material_types (factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_by, created_at, updated_at) VALUES
('F001', '鲜活鱼', 'RMT001', '海鲜', '公斤', '冷藏', 1, 3, 20, NOW(), NOW()),
('F001', '冷冻虾', 'RMT002', '海鲜', '公斤', '冷冻', 1, 365, 20, NOW(), NOW()),
('F001', '鲜鸡肉', 'RMT003', '肉类', '公斤', '冷藏', 1, 7, 20, NOW(), NOW());

-- ===== 3. 插入供应商 (包含 created_by) =====
INSERT INTO suppliers (factory_id, name, code, contact_person, contact_phone, contact_email, address, rating, is_active, created_by, created_at, updated_at) VALUES
('F001', '海洋渔业有限公司', 'SUP001', '张三', '13800138001', 'zhangsan@ocean.com', '浙江省舟山市', 5, 1, 20, NOW(), NOW()),
('F001', '新鲜禽肉批发', 'SUP002', '李四', '13800138002', 'lisi@poultry.com', '山东省济南市', 4, 1, 20, NOW(), NOW());

-- ===== 4. 插入客户 (包含 created_by) =====
INSERT INTO customers (factory_id, name, code, contact_person, contact_phone, contact_email, billing_address, shipping_address, industry, credit_limit, is_active, created_by, created_at, updated_at) VALUES
('F001', '大型连锁超市A', 'CUS001', '陈经理', '13900139001', 'chen@supermarket-a.com', '上海市浦东新区', '上海市浦东新区', '零售', 500000.00, 1, 20, NOW(), NOW()),
('F001', '酒店集团B', 'CUS002', '刘经理', '13900139002', 'liu@hotel-b.com', '北京市朝阳区', '北京市朝阳区', '餐饮', 300000.00, 1, 20, NOW(), NOW());

-- ===== 5. 验证插入结果 =====
SELECT 'Product Types' AS Category, COUNT(*) AS Count FROM product_types WHERE factory_id='F001' AND deleted_at IS NULL
UNION ALL SELECT 'Raw Material Types', COUNT(*) FROM raw_material_types WHERE factory_id='F001' AND deleted_at IS NULL  
UNION ALL SELECT 'Suppliers', COUNT(*) FROM suppliers WHERE factory_id='F001' AND deleted_at IS NULL
UNION ALL SELECT 'Customers', COUNT(*) FROM customers WHERE factory_id='F001' AND deleted_at IS NULL;

-- ===== 6. 查看插入的产品类型 =====
SELECT id, factory_id, name, code, category FROM product_types WHERE factory_id='F001' AND deleted_at IS NULL;

SELECT '✅ 数据插入完成！' AS Status;

