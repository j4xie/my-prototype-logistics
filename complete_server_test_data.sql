-- ============================================================
-- 完整服务器测试数据脚本 (Complete Server Test Data)
-- ============================================================
-- 日期: 2025-11-22
-- 数据库: cretas_db
-- 用途: 在服务器上初始化所有必要的测试数据
-- ============================================================

USE cretas_db;

-- ============================================================
-- 第1部分: 更新工厂用户的密码 (Factory Users)
-- ============================================================
UPDATE users SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username IN ('super_admin', 'dept_admin', 'operator1');

-- ============================================================
-- 第2部分: 更新平台管理员密码 (Platform Admin)
-- ============================================================
UPDATE platform_admins SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username = 'platform_admin';

-- ============================================================
-- 第3部分: 产品类型 (Product Types)
-- ============================================================
INSERT IGNORE INTO product_types (id, factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at) VALUES
('PT001', 'F001', '冷冻鱼片', 'PT001', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT002', 'F001', '冷冻虾仁', 'PT002', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT003', 'F001', '冷冻鱼块', 'PT003', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT004', 'F001', '冷冻鸡肉', 'PT004', '肉类', '公斤', 1, 180, NOW(), NOW()),
('PT005', 'F001', '速冻蔬菜', 'PT005', '蔬菜', '公斤', 1, 180, NOW(), NOW());

-- ============================================================
-- 第4部分: 原料类型 (Raw Material Types)
-- ============================================================
INSERT IGNORE INTO raw_material_types (id, factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_at, updated_at) VALUES
('RMT001', 'F001', '鲜活鱼', 'RMT001', '海鲜', '公斤', '冷藏', 1, 3, NOW(), NOW()),
('RMT002', 'F001', '冷冻虾', 'RMT002', '海鲜', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('RMT003', 'F001', '鲜鸡肉', 'RMT003', '肉类', '公斤', '冷藏', 1, 7, NOW(), NOW()),
('RMT004', 'F001', '食盐', 'RMT004', '调料', '公斤', '常温', 1, 730, NOW(), NOW()),
('RMT005', 'F001', '新鲜蔬菜', 'RMT005', '蔬菜', '公斤', '冷藏', 1, 5, NOW(), NOW());

-- ============================================================
-- 第5部分: 部门 (Departments)
-- ============================================================
INSERT IGNORE INTO departments (id, factory_id, name, code, is_active, display_order, created_at, updated_at) VALUES
(100, 'F001', '加工部', 'DEPT_PROC', 1, 1, NOW(), NOW()),
(101, 'F001', '质检部', 'DEPT_QC', 1, 2, NOW(), NOW()),
(102, 'F001', '仓储部', 'DEPT_WARE', 1, 3, NOW(), NOW()),
(103, 'F001', '管理部', 'DEPT_MGMT', 1, 4, NOW(), NOW());

-- ============================================================
-- 第6部分: 供应商 (Suppliers)
-- ============================================================
INSERT IGNORE INTO suppliers (id, factory_id, name, contact_person, phone, email, address, category, rating, status, created_at, updated_at) VALUES
(100, 'F001', '海洋渔业有限公司', '张三', '13800138001', 'zhangsan@ocean.com', '浙江省舟山市', '海鲜', 5, 'active', NOW(), NOW()),
(101, 'F001', '新鲜禽肉批发', '李四', '13800138002', 'lisi@poultry.com', '山东省济南市', '肉类', 4, 'active', NOW(), NOW()),
(102, 'F001', '绿色蔬菜基地', '王五', '13800138003', 'wangwu@veg.com', '江苏省南京市', '蔬菜', 4, 'active', NOW(), NOW()),
(103, 'F001', '优质调料供应商', '赵六', '13800138004', 'zhaoliu@spice.com', '广东省广州市', '调料', 5, 'active', NOW(), NOW());

-- ============================================================
-- 第7部分: 客户 (Customers)
-- ============================================================
INSERT IGNORE INTO customers (id, factory_id, name, contact_person, phone, email, address, category, credit_limit, status, created_at, updated_at) VALUES
(100, 'F001', '大型连锁超市A', '陈经理', '13900139001', 'chen@supermarket-a.com', '上海市浦东新区', '零售', 500000.00, 'active', NOW(), NOW()),
(101, 'F001', '酒店集团B', '刘经理', '13900139002', 'liu@hotel-b.com', '北京市朝阳区', '餐饮', 300000.00, 'active', NOW(), NOW()),
(102, 'F001', '食品批发市场C', '周经理', '13900139003', 'zhou@market-c.com', '广州市天河区', '批发', 800000.00, 'active', NOW(), NOW()),
(103, 'F001', '连锁餐厅D', '吴经理', '13900139004', 'wu@restaurant-d.com', '深圳市福田区', '餐饮', 200000.00, 'active', NOW(), NOW());

-- ============================================================
-- 第8部分: 原料批次 (Material Batches)
-- ============================================================
INSERT IGNORE INTO material_batches (id, factory_id, batch_number, material_type_id, supplier_id, quantity, unit, received_date, expiry_date, storage_location, quality_status, notes, created_at, updated_at) VALUES
(100, 'F001', 'MAT-20251120-001', 'RMT001', 100, 500, '公斤', '2025-11-20', '2025-11-23', '冷藏-A区-01号', 'qualified', '新鲜鱼类，质量良好', NOW(), NOW()),
(101, 'F001', 'MAT-20251120-002', 'RMT002', 101, 300, '公斤', '2025-11-20', '2026-11-20', '冷冻-B区-05号', 'qualified', '冷冻虾仁，来自正规供应商', NOW(), NOW()),
(102, 'F001', 'MAT-20251121-001', 'RMT003', 102, 200, '公斤', '2025-11-21', '2025-11-28', '冷藏-A区-02号', 'qualified', '新鲜鸡肉，检验合格', NOW(), NOW()),
(103, 'F001', 'MAT-20251121-002', 'RMT004', 103, 1000, '公斤', '2025-11-21', '2027-11-21', '常温-C区-10号', 'qualified', '食盐，干燥保存', NOW(), NOW());

-- ============================================================
-- 第9部分: 加工批次 (Processing Batches)
-- ============================================================
INSERT IGNORE INTO processing_batches (id, factory_id, batch_number, product_type_id, planned_quantity, actual_quantity, unit, status, production_date, completion_date, efficiency, quality_grade, notes, created_at, updated_at) VALUES
(100, 'F001', 'PROC-20251120-001', 'PT001', 300, 290, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 96.67, 'A', '鱼片加工批次，质量优良', NOW(), NOW()),
(101, 'F001', 'PROC-20251120-002', 'PT002', 200, 195, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 97.50, 'A', '虾仁加工批次，无损耗', NOW(), NOW()),
(102, 'F001', 'PROC-20251121-001', 'PT004', 250, 240, '公斤', 'IN_PROGRESS', '2025-11-21', NULL, 0, NULL, '鸡肉加工中，进度70%', NOW(), NOW()),
(103, 'F001', 'PROC-20251121-002', 'PT005', 150, 0, '公斤', 'PENDING', '2025-11-22', NULL, 0, NULL, '蔬菜加工待开始', NOW(), NOW());

-- ============================================================
-- 第10部分: 质检记录 (Quality Inspections)
-- ============================================================
INSERT IGNORE INTO quality_inspections (id, factory_id, batch_id, batch_type, inspection_date, inspector_id, quality_grade, temperature, ph_level, microbial_count, appearance_status, notes, passed, created_at, updated_at) VALUES
(100, 'F001', 100, 'material', '2025-11-20', 2, 'A', 2.5, 6.8, 'low', 'fresh and clean', '质检合格', 1, NOW(), NOW()),
(101, 'F001', 101, 'material', '2025-11-20', 2, 'A', -18, 7.0, 'low', 'frozen well', '质检合格', 1, NOW(), NOW()),
(102, 'F001', 100, 'processing', '2025-11-20', 2, 'A', 2.5, 6.9, 'low', 'well processed', '加工质检合格', 1, NOW(), NOW()),
(103, 'F001', 101, 'processing', '2025-11-20', 2, 'A', 2.5, 6.8, 'low', 'color good', '加工质检合格', 1, NOW(), NOW());

-- ============================================================
-- 第11部分: 工作类型 (Work Types)
-- ============================================================
INSERT IGNORE INTO work_types (id, factory_id, name, code, description, is_active, created_at, updated_at) VALUES
(100, 'F001', '原料接收', 'WT_RECEIVE', '原料到厂后的接收和入库', 1, NOW(), NOW()),
(101, 'F001', '原料检验', 'WT_INSPECT', '原料的质量检验', 1, NOW(), NOW()),
(102, 'F001', '加工处理', 'WT_PROCESS', '原料加工成产品', 1, NOW(), NOW()),
(103, 'F001', '产品打包', 'WT_PACKAGE', '产品的包装和标签', 1, NOW(), NOW()),
(104, 'F001', '产品存储', 'WT_STORAGE', '产品的冷库存储', 1, NOW(), NOW());

-- ============================================================
-- 第12部分: 产品计划 (Production Plans)
-- ============================================================
INSERT IGNORE INTO production_plans (id, factory_id, plan_number, period, status, total_planned_quantity, total_completed_quantity, notes, created_at, updated_at) VALUES
(100, 'F001', 'PLAN-2025-11-W47', '2025-11-18 至 2025-11-24', 'IN_PROGRESS', 2000, 485, '本周生产计划执行中', NOW(), NOW()),
(101, 'F001', 'PLAN-2025-11-W48', '2025-11-25 至 2025-12-01', 'PENDING', 2500, 0, '下周生产计划待启动', NOW(), NOW());

-- ============================================================
-- 验证数据插入结果
-- ============================================================
SELECT '✅ 用户账号' AS Category;
SELECT username, role_code, is_active FROM users WHERE username IN ('super_admin', 'dept_admin', 'operator1');

SELECT '✅ 平台管理员' AS Category;
SELECT username, platform_role, status FROM platform_admins WHERE username = 'platform_admin';

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

SELECT '✅ 原料批次' AS Category;
SELECT COUNT(*) AS Count FROM material_batches WHERE factory_id='F001';

SELECT '✅ 加工批次' AS Category;
SELECT COUNT(*) AS Count FROM processing_batches WHERE factory_id='F001';

SELECT '✅ 质检记录' AS Category;
SELECT COUNT(*) AS Count FROM quality_inspections WHERE factory_id='F001';

SELECT '✅ 工作类型' AS Category;
SELECT COUNT(*) AS Count FROM work_types WHERE factory_id='F001';

SELECT '✅ 生产计划' AS Category;
SELECT COUNT(*) AS Count FROM production_plans WHERE factory_id='F001';

SELECT '======================================' AS '';
SELECT '✅ 完整测试数据导入成功！' AS Status;
SELECT '======================================' AS '';
