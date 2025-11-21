-- ============================================================
-- 服务器完整测试数据脚本 (Server Complete Test Data)
-- ============================================================
-- 日期: 2025-11-22
-- 数据库: cretas_db
-- 用途: 在服务器上插入完整的业务测试数据
-- 基于本地数据库的实际结构
-- ============================================================

USE cretas_db;

-- ============================================================
-- 第1部分: 更新用户密码
-- ============================================================
UPDATE users SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse' WHERE username IN ('super_admin', 'dept_admin', 'operator1');

UPDATE platform_admins SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse' WHERE username = 'platform_admin';

-- ============================================================
-- 第2部分: 产品类型 (Product Types)
-- ============================================================
INSERT IGNORE INTO product_types (id, factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at) VALUES
('PT001', 'F001', '冷冻鱼片', 'PT001', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT002', 'F001', '冷冻虾仁', 'PT002', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT003', 'F001', '冷冻鱼块', 'PT003', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT004', 'F001', '冷冻鸡肉', 'PT004', '肉类', '公斤', 1, 180, NOW(), NOW()),
('PT005', 'F001', '速冻蔬菜', 'PT005', '蔬菜', '公斤', 1, 180, NOW(), NOW()),
('FISH-001', 'F001', '鲈鱼片', 'FISH-001', '鱼片类', '公斤', 1, 365, NOW(), NOW());

-- ============================================================
-- 第3部分: 原料类型 (Raw Material Types)
-- ============================================================
INSERT IGNORE INTO raw_material_types (id, factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_at, updated_at) VALUES
('RMT001', 'F001', '鲜活鱼', 'RMT001', '海鲜', '公斤', '冷藏', 1, 3, NOW(), NOW()),
('RMT002', 'F001', '冷冻虾', 'RMT002', '海鲜', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('RMT003', 'F001', '鲜鸡肉', 'RMT003', '肉类', '公斤', '冷藏', 1, 7, NOW(), NOW()),
('RMT004', 'F001', '食盐', 'RMT004', '调料', '公斤', '常温', 1, 730, NOW(), NOW()),
('RMT005', 'F001', '新鲜蔬菜', 'RMT005', '蔬菜', '公斤', '冷藏', 1, 5, NOW(), NOW()),
('DY', 'F001', '带鱼', 'DY', '海水鱼', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('LY', 'F001', '鲈鱼', 'LY', '淡水鱼', '公斤', '冷藏', 1, 7, NOW(), NOW());

-- ============================================================
-- 第4部分: 部门 (Departments)
-- ============================================================
INSERT IGNORE INTO departments (id, factory_id, name, code, is_active, display_order, created_at, updated_at) VALUES
(1, 'F001', '养殖部门', 'FARMING', 1, 1, NOW(), NOW()),
(2, 'F001', '加工部门', 'PROCESSING', 1, 2, NOW(), NOW()),
(3, 'F001', '物流部门', 'LOGISTICS', 1, 3, NOW(), NOW()),
(4, 'F001', '质量部门', 'QUALITY', 1, 4, NOW(), NOW()),
(5, 'F001', '管理部门', 'MANAGEMENT', 1, 5, NOW(), NOW()),
(10, 'F001', '加工部', 'DEPT_PROC', 1, 1, NOW(), NOW()),
(11, 'F001', '质检部', 'DEPT_QC', 1, 2, NOW(), NOW()),
(12, 'F001', '仓储部', 'DEPT_WARE', 1, 3, NOW(), NOW()),
(13, 'F001', '管理部', 'DEPT_MGMT', 1, 4, NOW(), NOW());

-- ============================================================
-- 第5部分: 供应商 (Suppliers) - 基于实际表结构
-- ============================================================
INSERT IGNORE INTO suppliers (id, factory_id, name, contact_person, contact_phone, contact_email, address, is_active, rating, created_at, updated_at) VALUES
(100, 'F001', '海洋渔业有限公司', '张三', '13800138001', 'zhangsan@ocean.com', '浙江省舟山市', 1, 5, NOW(), NOW()),
(101, 'F001', '新鲜禽肉批发', '李四', '13800138002', 'lisi@poultry.com', '山东省济南市', 1, 4, NOW(), NOW()),
(102, 'F001', '绿色蔬菜基地', '王五', '13800138003', 'wangwu@veg.com', '江苏省南京市', 1, 4, NOW(), NOW()),
(103, 'F001', '优质调料供应商', '赵六', '13800138004', 'zhaoliu@spice.com', '广东省广州市', 1, 5, NOW(), NOW());

-- ============================================================
-- 第6部分: 客户 (Customers) - 基于实际表结构
-- ============================================================
INSERT IGNORE INTO customers (id, factory_id, name, contact_person, contact_phone, contact_email, type, is_active, rating, created_at, updated_at) VALUES
(100, 'F001', '大型连锁超市A', '陈经理', '13900139001', 'chen@supermarket-a.com', '零售', 1, 5, NOW(), NOW()),
(101, 'F001', '酒店集团B', '刘经理', '13900139002', 'liu@hotel-b.com', '餐饮', 1, 5, NOW(), NOW()),
(102, 'F001', '食品批发市场C', '周经理', '13900139003', 'zhou@market-c.com', '批发', 1, 5, NOW(), NOW()),
(103, 'F001', '连锁餐厅D', '吴经理', '13900139004', 'wu@restaurant-d.com', '餐饮', 1, 4, NOW(), NOW());

-- ============================================================
-- 第7部分: 验证数据
-- ============================================================
SELECT '✅ 用户和密码' AS Category;
SELECT COUNT(*) AS Count FROM users WHERE factory_id='F001' AND username IN ('super_admin', 'dept_admin', 'operator1');

SELECT '✅ 产品类型' AS Category;
SELECT COUNT(*) AS Count FROM product_types WHERE factory_id='F001';

SELECT '✅ 原料类型' AS Category;
SELECT COUNT(*) AS Count FROM raw_material_types WHERE factory_id='F001';

SELECT '✅ 部门' AS Category;
SELECT COUNT(*) AS Count FROM departments WHERE factory_id='F001';

SELECT '✅ 供应商' AS Category;
SELECT COUNT(*) AS Count FROM suppliers WHERE factory_id='F001';

SELECT '✅ 客户' AS Category;
SELECT COUNT(*) AS Count FROM customers WHERE factory_id='F001';

SELECT '======================================' AS '';
SELECT '✅ 服务器完整测试数据导入成功！' AS Status;
SELECT '======================================' AS '';
SELECT '' AS '';
SELECT '🔐 可用的测试账号和密码:' AS TestAccounts;
SELECT 'super_admin / 123456' AS '';
SELECT 'dept_admin / 123456' AS '';
SELECT 'operator1 / 123456' AS '';
SELECT 'platform_admin / 123456' AS '';
