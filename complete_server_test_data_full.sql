-- ============================================================
-- 完整的服务器测试数据脚本 v2.0 (Complete Server Test Data)
-- ============================================================
-- 日期: 2025-11-22
-- 数据库: cretas_db
-- 用途: 在服务器上初始化所有必要的测试数据
-- 包括: 多工厂、多角色用户、产品数据、转换率、AI配额、白名单等
-- ============================================================

USE cretas_db;

-- ============================================================
-- 第0部分: 添加工厂 (Factories)
-- ============================================================
-- 工厂F001已存在，添加更多工厂用于测试
INSERT IGNORE INTO factories (id, name, location, contact_person, contact_phone, established_date, is_active, created_at, updated_at) VALUES
('F002', '冷链食品工厂B', '浙江省杭州市', '李经理', '13800200002', '2023-06-15', 1, NOW(), NOW()),
('F003', '水产品加工厂C', '山东省威海市', '王经理', '13800300003', '2023-09-20', 1, NOW(), NOW());

-- ============================================================
-- 第1部分: 更新现有工厂用户的密码 (Factory Users - Update Existing)
-- ============================================================
UPDATE users SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username IN ('super_admin', 'dept_admin', 'operator1');

-- ============================================================
-- 第1.5部分: 为新工厂添加工厂用户 (Factory Users - New Factories)
-- ============================================================
-- F002 工厂的用户
INSERT IGNORE INTO users (id, username, password_hash, factory_id, is_active, created_at, updated_at, role_code, full_name, department) VALUES
(2001, 'factory_admin_f002', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', 1, NOW(), NOW(), 'factory_super_admin', '李超管', 'admin'),
(2002, 'dept_manager_f002', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', 1, NOW(), NOW(), 'department_admin', '李部长', 'processing'),
(2003, 'operator_f002', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', 1, NOW(), NOW(), 'operator', '李操作员', 'processing'),
(2004, 'viewer_f002', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', 1, NOW(), NOW(), 'viewer', '李查看员', 'warehouse'),
(2005, 'permission_admin_f002', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', 1, NOW(), NOW(), 'permission_admin', '李权限管', 'admin');

-- F003 工厂的用户
INSERT IGNORE INTO users (id, username, password_hash, factory_id, is_active, created_at, updated_at, role_code, full_name, department) VALUES
(3001, 'factory_admin_f003', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F003', 1, NOW(), NOW(), 'factory_super_admin', '王超管', 'admin'),
(3002, 'dept_manager_f003', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F003', 1, NOW(), NOW(), 'department_admin', '王部长', 'quality'),
(3003, 'operator_f003', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F003', 1, NOW(), NOW(), 'operator', '王操作员', 'quality'),
(3004, 'permission_admin_f003', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F003', 1, NOW(), NOW(), 'permission_admin', '王权限管', 'admin');

-- ============================================================
-- 第2部分: 平台用户 (Platform Users)
-- ============================================================
-- 更新现有的 platform_admin
UPDATE platform_admins SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username = 'platform_admin';

-- 添加更多平台用户
INSERT IGNORE INTO platform_admins (id, username, password_hash, platform_role, real_name, email, phone_number, status, created_at, updated_at) VALUES
(1002, 'system_admin', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'system_admin', '系统管理员', 'sysadmin@cretas.com', '13800100002', 'active', NOW(), NOW()),
(1003, 'operation_admin', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'operation_admin', '运营管理员', 'ops@cretas.com', '13800100003', 'active', NOW(), NOW()),
(1004, 'auditor', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'auditor', '审计员', 'audit@cretas.com', '13800100004', 'active', NOW(), NOW());

-- ============================================================
-- 第3部分: 白名单 (Whitelist) - 允许注册的用户/设备
-- ============================================================
INSERT IGNORE INTO whitelist (id, type, value, factory_id, description, is_active, created_at, updated_at) VALUES
(1001, 'phone', '+86 13800138000', 'F001', '测试电话1', 1, NOW(), NOW()),
(1002, 'phone', '+86 13800138001', 'F001', '测试电话2', 1, NOW(), NOW()),
(1003, 'phone', '+86 13800138002', 'F002', 'F002工厂测试电话', 1, NOW(), NOW()),
(1004, 'phone', '+86 13800138003', 'F003', 'F003工厂测试电话', 1, NOW(), NOW()),
(1005, 'device_id', 'TEST-DEVICE-001', 'F001', '测试设备1', 1, NOW(), NOW()),
(1006, 'device_id', 'TEST-DEVICE-002', 'F002', '测试设备2', 1, NOW(), NOW());

-- ============================================================
-- 第4部分: 产品类型 (Product Types) - 多工厂产品
-- ============================================================
-- F001 产品
INSERT IGNORE INTO product_types (id, factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at) VALUES
('PT001', 'F001', '冷冻鱼片', 'PT001', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT002', 'F001', '冷冻虾仁', 'PT002', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT003', 'F001', '冷冻鱼块', 'PT003', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT004', 'F001', '冷冻鸡肉', 'PT004', '肉类', '公斤', 1, 180, NOW(), NOW()),
('PT005', 'F001', '速冻蔬菜', 'PT005', '蔬菜', '公斤', 1, 180, NOW(), NOW());

-- F002 产品
INSERT IGNORE INTO product_types (id, factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at) VALUES
('PT201', 'F002', '冷链牛肉', 'PT201', '肉类', '公斤', 1, 365, NOW(), NOW()),
('PT202', 'F002', '冷链羊肉', 'PT202', '肉类', '公斤', 1, 365, NOW(), NOW()),
('PT203', 'F002', '速冻馄饨', 'PT203', '速冻食品', '公斤', 1, 180, NOW(), NOW());

-- F003 产品
INSERT IGNORE INTO product_types (id, factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at) VALUES
('PT301', 'F003', '冷冻扇贝', 'PT301', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT302', 'F003', '冷冻鱿鱼', 'PT302', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT303', 'F003', '冷冻海参', 'PT303', '海鲜', '公斤', 1, 730, NOW(), NOW());

-- ============================================================
-- 第5部分: 原料类型 (Raw Material Types) - 分为鲜货和冻货
-- ============================================================
-- F001 原料
INSERT IGNORE INTO raw_material_types (id, factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_at, updated_at) VALUES
('RMT001', 'F001', '鲜活鱼', 'RMT001', '海鲜', '公斤', '冷藏', 1, 3, NOW(), NOW()),
('RMT002', 'F001', '冷冻虾', 'RMT002', '海鲜', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('RMT003', 'F001', '鲜鸡肉', 'RMT003', '肉类', '公斤', '冷藏', 1, 7, NOW(), NOW()),
('RMT004', 'F001', '食盐', 'RMT004', '调料', '公斤', '常温', 1, 730, NOW(), NOW()),
('RMT005', 'F001', '新鲜蔬菜', 'RMT005', '蔬菜', '公斤', '冷藏', 1, 5, NOW(), NOW());

-- F002 原料
INSERT IGNORE INTO raw_material_types (id, factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_at, updated_at) VALUES
('RMT201', 'F002', '鲜牛肉', 'RMT201', '肉类', '公斤', '冷藏', 1, 10, NOW(), NOW()),
('RMT202', 'F002', '冷冻牛肉', 'RMT202', '肉类', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('RMT203', 'F002', '鲜羊肉', 'RMT203', '肉类', '公斤', '冷藏', 1, 10, NOW(), NOW()),
('RMT204', 'F002', '冷冻羊肉', 'RMT204', '肉类', '公斤', '冷冻', 1, 365, NOW(), NOW());

-- F003 原料
INSERT IGNORE INTO raw_material_types (id, factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_at, updated_at) VALUES
('RMT301', 'F003', '鲜扇贝', 'RMT301', '海鲜', '公斤', '冷藏', 1, 2, NOW(), NOW()),
('RMT302', 'F003', '冷冻扇贝', 'RMT302', '海鲜', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('RMT303', 'F003', '鲜鱿鱼', 'RMT303', '海鲜', '公斤', '冷藏', 1, 3, NOW(), NOW()),
('RMT304', 'F003', '冷冻鱿鱼', 'RMT304', '海鲜', '公斤', '冷冻', 1, 365, NOW(), NOW());

-- ============================================================
-- 第6部分: 转换率配置 (Product Conversion Rates)
-- ============================================================
-- F001 转换率: 原料 -> 产品
INSERT IGNORE INTO product_conversion_rates (id, factory_id, from_material_id, to_product_id, conversion_ratio, unit, notes, is_active, created_at, updated_at) VALUES
(1001, 'F001', 'RMT001', 'PT001', 0.95, '1kg鲜鱼 -> 0.95kg鱼片', '清理内脏和骨头损耗5%', 1, NOW(), NOW()),
(1002, 'F001', 'RMT002', 'PT002', 0.98, '1kg冻虾 -> 0.98kg虾仁', '虾仁分离损耗2%', 1, NOW(), NOW()),
(1003, 'F001', 'RMT003', 'PT004', 0.92, '1kg鲜鸡肉 -> 0.92kg冷冻鸡肉', '切割和包装损耗8%', 1, NOW(), NOW()),
(1004, 'F001', 'RMT005', 'PT005', 0.97, '1kg鲜蔬菜 -> 0.97kg速冻蔬菜', '清洗和冷冻损耗3%', 1, NOW(), NOW());

-- F002 转换率
INSERT IGNORE INTO product_conversion_rates (id, factory_id, from_material_id, to_product_id, conversion_ratio, unit, notes, is_active, created_at, updated_at) VALUES
(2001, 'F002', 'RMT202', 'PT201', 0.95, '1kg冷冻牛肉 -> 0.95kg切片', '切割损耗5%', 1, NOW(), NOW()),
(2002, 'F002', 'RMT204', 'PT202', 0.93, '1kg冷冻羊肉 -> 0.93kg切片', '切割损耗7%', 1, NOW(), NOW());

-- F003 转换率
INSERT IGNORE INTO product_conversion_rates (id, factory_id, from_material_id, to_product_id, conversion_ratio, unit, notes, is_active, created_at, updated_at) VALUES
(3001, 'F003', 'RMT302', 'PT301', 0.96, '1kg冷冻扇贝 -> 0.96kg产品', '分级损耗4%', 1, NOW(), NOW()),
(3002, 'F003', 'RMT304', 'PT302', 0.94, '1kg冷冻鱿鱼 -> 0.94kg产品', '清理损耗6%', 1, NOW(), NOW());

-- ============================================================
-- 第7部分: 部门 (Departments) - 多工厂部门
-- ============================================================
-- F001 部门
INSERT IGNORE INTO departments (id, factory_id, name, code, is_active, display_order, created_at, updated_at) VALUES
(100, 'F001', '加工部', 'DEPT_PROC', 1, 1, NOW(), NOW()),
(101, 'F001', '质检部', 'DEPT_QC', 1, 2, NOW(), NOW()),
(102, 'F001', '仓储部', 'DEPT_WARE', 1, 3, NOW(), NOW()),
(103, 'F001', '管理部', 'DEPT_MGMT', 1, 4, NOW(), NOW());

-- F002 部门
INSERT IGNORE INTO departments (id, factory_id, name, code, is_active, display_order, created_at, updated_at) VALUES
(200, 'F002', '加工部', 'DEPT_PROC', 1, 1, NOW(), NOW()),
(201, 'F002', '质检部', 'DEPT_QC', 1, 2, NOW(), NOW()),
(202, 'F002', '仓储部', 'DEPT_WARE', 1, 3, NOW(), NOW());

-- F003 部门
INSERT IGNORE INTO departments (id, factory_id, name, code, is_active, display_order, created_at, updated_at) VALUES
(300, 'F003', '加工部', 'DEPT_PROC', 1, 1, NOW(), NOW()),
(301, 'F003', '质检部', 'DEPT_QC', 1, 2, NOW(), NOW()),
(302, 'F003', '仓储部', 'DEPT_WARE', 1, 3, NOW(), NOW()),
(303, 'F003', '销售部', 'DEPT_SALES', 1, 4, NOW(), NOW());

-- ============================================================
-- 第8部分: 供应商 (Suppliers) - 多工厂供应商
-- ============================================================
-- F001 供应商
INSERT IGNORE INTO suppliers (id, factory_id, name, contact_person, phone, email, address, category, rating, status, created_at, updated_at) VALUES
(100, 'F001', '海洋渔业有限公司', '张三', '13800138001', 'zhangsan@ocean.com', '浙江省舟山市', '海鲜', 5, 'active', NOW(), NOW()),
(101, 'F001', '新鲜禽肉批发', '李四', '13800138002', 'lisi@poultry.com', '山东省济南市', '肉类', 4, 'active', NOW(), NOW()),
(102, 'F001', '绿色蔬菜基地', '王五', '13800138003', 'wangwu@veg.com', '江苏省南京市', '蔬菜', 4, 'active', NOW(), NOW()),
(103, 'F001', '优质调料供应商', '赵六', '13800138004', 'zhaoliu@spice.com', '广东省广州市', '调料', 5, 'active', NOW(), NOW());

-- F002 供应商
INSERT IGNORE INTO suppliers (id, factory_id, name, contact_person, phone, email, address, category, rating, status, created_at, updated_at) VALUES
(200, 'F002', '优质牛肉供应商', '孙七', '13800200001', 'sun@beef.com', '内蒙古呼伦贝尔', '肉类', 5, 'active', NOW(), NOW()),
(201, 'F002', '草原羊肉基地', '周八', '13800200002', 'zhou@mutton.com', '宁夏银川', '肉类', 5, 'active', NOW(), NOW());

-- F003 供应商
INSERT IGNORE INTO suppliers (id, factory_id, name, contact_person, phone, email, address, category, rating, status, created_at, updated_at) VALUES
(300, 'F003', '深海贝类养殖场', '吴九', '13800300001', 'wu@shellfish.com', '山东省威海市', '海鲜', 5, 'active', NOW(), NOW()),
(301, 'F003', '海洋鱿鱼基地', '郑十', '13800300002', 'zheng@squid.com', '广东省湛江市', '海鲜', 4, 'active', NOW(), NOW());

-- ============================================================
-- 第9部分: 客户 (Customers) - 多工厂客户
-- ============================================================
-- F001 客户
INSERT IGNORE INTO customers (id, factory_id, name, contact_person, phone, email, address, category, credit_limit, status, created_at, updated_at) VALUES
(100, 'F001', '大型连锁超市A', '陈经理', '13900139001', 'chen@supermarket-a.com', '上海市浦东新区', '零售', 500000.00, 'active', NOW(), NOW()),
(101, 'F001', '酒店集团B', '刘经理', '13900139002', 'liu@hotel-b.com', '北京市朝阳区', '餐饮', 300000.00, 'active', NOW(), NOW()),
(102, 'F001', '食品批发市场C', '周经理', '13900139003', 'zhou@market-c.com', '广州市天河区', '批发', 800000.00, 'active', NOW(), NOW()),
(103, 'F001', '连锁餐厅D', '吴经理', '13900139004', 'wu@restaurant-d.com', '深圳市福田区', '餐饮', 200000.00, 'active', NOW(), NOW());

-- F002 客户
INSERT IGNORE INTO customers (id, factory_id, name, contact_person, phone, email, address, category, credit_limit, status, created_at, updated_at) VALUES
(200, 'F002', '高端肉类专营店', '马经理', '13900200001', 'ma@premium-meat.com', '杭州市下城区', '零售', 600000.00, 'active', NOW(), NOW()),
(201, 'F002', '大型连锁餐厅', '林经理', '13900200002', 'lin@chain-restaurant.com', '南京市建邺区', '餐饮', 400000.00, 'active', NOW(), NOW());

-- F003 客户
INSERT IGNORE INTO customers (id, factory_id, name, contact_person, phone, email, address, category, credit_limit, status, created_at, updated_at) VALUES
(300, 'F003', '高档海鲜酒楼', '郭经理', '13900300001', 'guo@seafood-restaurant.com', '威海市环翠区', '餐饮', 350000.00, 'active', NOW(), NOW()),
(301, 'F003', '冷链物流公司', '何经理', '13900300002', 'he@coldchain-logistics.com', '青岛市黄岛区', '批发', 1000000.00, 'active', NOW(), NOW());

-- ============================================================
-- 第10部分: 原料批次 (Material Batches) - 鲜货和冻货
-- ============================================================
-- F001 批次
INSERT IGNORE INTO material_batches (id, factory_id, batch_number, material_type_id, supplier_id, quantity, unit, received_date, expiry_date, storage_location, quality_status, notes, created_at, updated_at) VALUES
(100, 'F001', 'MAT-20251120-001', 'RMT001', 100, 500, '公斤', '2025-11-20', '2025-11-23', '冷藏-A区-01号', 'qualified', '鲜活鱼，质量优良', 1, NOW(), NOW()),
(101, 'F001', 'MAT-20251120-002', 'RMT002', 101, 300, '公斤', '2025-11-20', '2026-11-20', '冷冻-B区-05号', 'qualified', '冷冻虾仁，来自正规供应商', 1, NOW(), NOW()),
(102, 'F001', 'MAT-20251121-001', 'RMT003', 101, 200, '公斤', '2025-11-21', '2025-11-28', '冷藏-A区-02号', 'qualified', '鲜鸡肉，检验合格', 1, NOW(), NOW()),
(103, 'F001', 'MAT-20251121-002', 'RMT004', 103, 1000, '公斤', '2025-11-21', '2027-11-21', '常温-C区-10号', 'qualified', '食盐，干燥保存', 1, NOW(), NOW()),
(104, 'F001', 'MAT-20251122-001', 'RMT005', 102, 400, '公斤', '2025-11-22', '2025-11-27', '冷藏-A区-03号', 'qualified', '新鲜蔬菜，刚采收', 1, NOW(), NOW());

-- F002 批次
INSERT IGNORE INTO material_batches (id, factory_id, batch_number, material_type_id, supplier_id, quantity, unit, received_date, expiry_date, storage_location, quality_status, notes, created_at, updated_at) VALUES
(200, 'F002', 'MAT-20251120-001', 'RMT202', 200, 800, '公斤', '2025-11-20', '2026-11-20', '冷冻-A区-10号', 'qualified', '冷冻牛肉，一级品', 1, NOW(), NOW()),
(201, 'F002', 'MAT-20251121-001', 'RMT204', 201, 600, '公斤', '2025-11-21', '2026-11-21', '冷冻-B区-08号', 'qualified', '冷冻羊肉，来自内蒙古', 1, NOW(), NOW());

-- F003 批次
INSERT IGNORE INTO material_batches (id, factory_id, batch_number, material_type_id, supplier_id, quantity, unit, received_date, expiry_date, storage_location, quality_status, notes, created_at, updated_at) VALUES
(300, 'F003', 'MAT-20251120-001', 'RMT302', 300, 500, '公斤', '2025-11-20', '2026-11-20', '冷冻-A区-05号', 'qualified', '冷冻扇贝，特级品', 1, NOW(), NOW()),
(301, 'F003', 'MAT-20251121-001', 'RMT304', 301, 400, '公斤', '2025-11-21', '2026-11-21', '冷冻-B区-03号', 'qualified', '冷冻鱿鱼，一级品', 1, NOW(), NOW());

-- ============================================================
-- 第11部分: 加工批次 (Processing Batches) - 多状态
-- ============================================================
-- F001 加工批次
INSERT IGNORE INTO processing_batches (id, factory_id, batch_number, product_type_id, planned_quantity, actual_quantity, unit, status, production_date, completion_date, efficiency, quality_grade, notes, created_at, updated_at) VALUES
(100, 'F001', 'PROC-20251120-001', 'PT001', 300, 290, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 96.67, 'A', '鱼片加工批次，质量优良', NOW(), NOW()),
(101, 'F001', 'PROC-20251120-002', 'PT002', 200, 195, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 97.50, 'A', '虾仁加工批次，无损耗', NOW(), NOW()),
(102, 'F001', 'PROC-20251121-001', 'PT004', 250, 240, '公斤', 'IN_PROGRESS', '2025-11-21', NULL, 0, NULL, '鸡肉加工中，进度70%', NOW(), NOW()),
(103, 'F001', 'PROC-20251121-002', 'PT005', 150, 0, '公斤', 'PENDING', '2025-11-22', NULL, 0, NULL, '蔬菜加工待开始', NOW(), NOW()),
(104, 'F001', 'PROC-20251122-001', 'PT003', 180, 170, '公斤', 'COMPLETED', '2025-11-22', '2025-11-22', 94.44, 'A', '鱼块加工完成', NOW(), NOW());

-- F002 加工批次
INSERT IGNORE INTO processing_batches (id, factory_id, batch_number, product_type_id, planned_quantity, actual_quantity, unit, status, production_date, completion_date, efficiency, quality_grade, notes, created_at, updated_at) VALUES
(200, 'F002', 'PROC-20251120-001', 'PT201', 400, 380, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 95.00, 'A', '牛肉切片加工完成', NOW(), NOW()),
(201, 'F002', 'PROC-20251121-001', 'PT202', 350, 325, '公斤', 'COMPLETED', '2025-11-21', '2025-11-21', 92.86, 'A', '羊肉切片加工完成', NOW(), NOW());

-- F003 加工批次
INSERT IGNORE INTO processing_batches (id, factory_id, batch_number, product_type_id, planned_quantity, actual_quantity, unit, status, production_date, completion_date, efficiency, quality_grade, notes, created_at, updated_at) VALUES
(300, 'F003', 'PROC-20251120-001', 'PT301', 300, 288, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 96.00, 'A', '扇贝分级加工完成', NOW(), NOW()),
(301, 'F003', 'PROC-20251121-001', 'PT302', 250, 235, '公斤', 'COMPLETED', '2025-11-21', '2025-11-21', 94.00, 'A', '鱿鱼处理加工完成', NOW(), NOW());

-- ============================================================
-- 第12部分: 质检记录 (Quality Inspections)
-- ============================================================
-- F001 质检
INSERT IGNORE INTO quality_inspections (id, factory_id, batch_id, batch_type, inspection_date, inspector_id, quality_grade, temperature, ph_level, microbial_count, appearance_status, notes, passed, created_at, updated_at) VALUES
(100, 'F001', 100, 'material', '2025-11-20', 2, 'A', 2.5, 6.8, 'low', 'fresh and clean', '原料质检合格', 1, NOW(), NOW()),
(101, 'F001', 101, 'material', '2025-11-20', 2, 'A', -18, 7.0, 'low', 'frozen well', '原料质检合格', 1, NOW(), NOW()),
(102, 'F001', 100, 'processing', '2025-11-20', 2, 'A', 2.5, 6.9, 'low', 'well processed', '加工质检合格', 1, NOW(), NOW()),
(103, 'F001', 101, 'processing', '2025-11-20', 2, 'A', 2.5, 6.8, 'low', 'color good', '加工质检合格', 1, NOW(), NOW());

-- F002 质检
INSERT IGNORE INTO quality_inspections (id, factory_id, batch_id, batch_type, inspection_date, inspector_id, quality_grade, temperature, ph_level, microbial_count, appearance_status, notes, passed, created_at, updated_at) VALUES
(200, 'F002', 200, 'material', '2025-11-20', 2002, 'A', -18, 6.5, 'low', 'color good', '牛肉质检合格', 1, NOW(), NOW()),
(201, 'F002', 200, 'processing', '2025-11-20', 2002, 'A', -18, 6.5, 'low', 'cut well', '加工质检合格', 1, NOW(), NOW());

-- F003 质检
INSERT IGNORE INTO quality_inspections (id, factory_id, batch_id, batch_type, inspection_date, inspector_id, quality_grade, temperature, ph_level, microbial_count, appearance_status, notes, passed, created_at, updated_at) VALUES
(300, 'F003', 300, 'material', '2025-11-20', 3002, 'A', -18, 7.0, 'low', 'fresh frozen', '扇贝质检合格', 1, NOW(), NOW()),
(301, 'F003', 301, 'material', '2025-11-21', 3002, 'A', -18, 6.9, 'low', 'clean', '鱿鱼质检合格', 1, NOW(), NOW());

-- ============================================================
-- 第13部分: AI使用配额 (AI Quota) - 防止AI爆表
-- ============================================================
INSERT IGNORE INTO ai_quota (id, factory_id, total_monthly_quota, consumed_quota, remaining_quota, reset_date, status, created_at, updated_at) VALUES
(1, 'F001', 100000, 15000, 85000, '2025-12-01', 'active', NOW(), NOW()),
(2, 'F002', 100000, 8000, 92000, '2025-12-01', 'active', NOW(), NOW()),
(3, 'F003', 100000, 12000, 88000, '2025-12-01', 'active', NOW(), NOW());

-- ============================================================
-- 第14部分: AI分析缓存 (AI Analysis Cache)
-- ============================================================
INSERT IGNORE INTO ai_analysis_cache (id, factory_id, query_hash, result, expires_at, created_at) VALUES
(1, 'F001', 'md5_hash_001', '{\"cost\":15000,\"efficiency\":96.5}', DATE_ADD(NOW(), INTERVAL 5 MINUTE), NOW()),
(2, 'F001', 'md5_hash_002', '{\"trend\":\"up\",\"growth\":5.2}', DATE_ADD(NOW(), INTERVAL 5 MINUTE), NOW());

-- ============================================================
-- 第15部分: 工作类型 (Work Types)
-- ============================================================
INSERT IGNORE INTO work_types (id, factory_id, name, code, description, is_active, created_at, updated_at) VALUES
(100, 'F001', '原料接收', 'WT_RECEIVE', '原料到厂后的接收和入库', 1, NOW(), NOW()),
(101, 'F001', '原料检验', 'WT_INSPECT', '原料的质量检验', 1, NOW(), NOW()),
(102, 'F001', '加工处理', 'WT_PROCESS', '原料加工成产品', 1, NOW(), NOW()),
(103, 'F001', '产品打包', 'WT_PACKAGE', '产品的包装和标签', 1, NOW(), NOW()),
(104, 'F001', '产品存储', 'WT_STORAGE', '产品的冷库存储', 1, NOW(), NOW()),
(200, 'F002', '原料接收', 'WT_RECEIVE', '原料到厂后的接收和入库', 1, NOW(), NOW()),
(201, 'F002', '加工处理', 'WT_PROCESS', '原料加工成产品', 1, NOW(), NOW()),
(202, 'F002', '产品打包', 'WT_PACKAGE', '产品的包装和标签', 1, NOW(), NOW()),
(300, 'F003', '原料接收', 'WT_RECEIVE', '原料到厂后的接收和入库', 1, NOW(), NOW()),
(301, 'F003', '原料检验', 'WT_INSPECT', '原料的质量检验', 1, NOW(), NOW()),
(302, 'F003', '加工处理', 'WT_PROCESS', '原料加工成产品', 1, NOW(), NOW()),
(303, 'F003', '销售发货', 'WT_SALES', '产品销售和发货', 1, NOW(), NOW());

-- ============================================================
-- 第16部分: 生产计划 (Production Plans)
-- ============================================================
INSERT IGNORE INTO production_plans (id, factory_id, plan_number, period, status, total_planned_quantity, total_completed_quantity, notes, created_at, updated_at) VALUES
(100, 'F001', 'PLAN-2025-11-W47', '2025-11-18 至 2025-11-24', 'IN_PROGRESS', 2000, 485, '本周生产计划执行中', NOW(), NOW()),
(101, 'F001', 'PLAN-2025-11-W48', '2025-11-25 至 2025-12-01', 'PENDING', 2500, 0, '下周生产计划待启动', NOW(), NOW()),
(200, 'F002', 'PLAN-2025-11-W47', '2025-11-18 至 2025-11-24', 'IN_PROGRESS', 1500, 380, 'F002本周生产计划执行中', NOW(), NOW()),
(201, 'F002', 'PLAN-2025-11-W48', '2025-11-25 至 2025-12-01', 'PENDING', 2000, 0, 'F002下周生产计划待启动', NOW(), NOW()),
(300, 'F003', 'PLAN-2025-11-W47', '2025-11-18 至 2025-11-24', 'IN_PROGRESS', 1800, 523, 'F003本周生产计划执行中', NOW(), NOW()),
(301, 'F003', 'PLAN-2025-11-W48', '2025-11-25 至 2025-12-01', 'PENDING', 2200, 0, 'F003下周生产计划待启动', NOW(), NOW());

-- ============================================================
-- 第17部分: 生产计划批次关联 (Production Plan Batches)
-- ============================================================
INSERT IGNORE INTO production_plan_batch_usage (id, production_plan_id, processing_batch_id, created_at) VALUES
(1, 100, 100, NOW()),
(2, 100, 101, NOW()),
(3, 200, 200, NOW()),
(4, 300, 300, NOW());

-- ============================================================
-- 验证数据插入结果
-- ============================================================
SELECT '====== 用户数据统计 ======' AS Category;
SELECT 'F001 工厂用户数' AS Item, COUNT(*) AS Count FROM users WHERE factory_id='F001'
UNION ALL SELECT 'F002 工厂用户数', COUNT(*) FROM users WHERE factory_id='F002'
UNION ALL SELECT 'F003 工厂用户数', COUNT(*) FROM users WHERE factory_id='F003'
UNION ALL SELECT '平台用户数', COUNT(*) FROM platform_admins;

SELECT '====== 工厂和基础数据 ======' AS Category;
SELECT 'F001 产品类型' AS Item, COUNT(*) FROM product_types WHERE factory_id='F001'
UNION ALL SELECT 'F002 产品类型', COUNT(*) FROM product_types WHERE factory_id='F002'
UNION ALL SELECT 'F003 产品类型', COUNT(*) FROM product_types WHERE factory_id='F003'
UNION ALL SELECT '总转换率配置', COUNT(*) FROM product_conversion_rates;

SELECT '====== 业务数据统计 ======' AS Category;
SELECT 'F001 原料批次' AS Item, COUNT(*) FROM material_batches WHERE factory_id='F001'
UNION ALL SELECT 'F002 原料批次', COUNT(*) FROM material_batches WHERE factory_id='F002'
UNION ALL SELECT 'F003 原料批次', COUNT(*) FROM material_batches WHERE factory_id='F003'
UNION ALL SELECT 'F001 加工批次', COUNT(*) FROM processing_batches WHERE factory_id='F001'
UNION ALL SELECT 'F002 加工批次', COUNT(*) FROM processing_batches WHERE factory_id='F002'
UNION ALL SELECT 'F003 加工批次', COUNT(*) FROM processing_batches WHERE factory_id='F003'
UNION ALL SELECT '质检记录总数', COUNT(*) FROM quality_inspections;

SELECT '====== 其他配置 ======' AS Category;
SELECT '白名单条数' AS Item, COUNT(*) FROM whitelist
UNION ALL SELECT 'AI配额', COUNT(*) FROM ai_quota
UNION ALL SELECT '生产计划', COUNT(*) FROM production_plans;

SELECT '======================================' AS '';
SELECT '✅ 完整的多工厂测试数据导入成功！' AS Status;
SELECT '======================================' AS '';
SELECT '' AS '';
SELECT '📊 数据概览:' AS Overview;
SELECT '   - 工厂数: 3 (F001, F002, F003)' AS '';
SELECT '   - 工厂用户: 13 (含各角色)' AS '';
SELECT '   - 平台用户: 4 (超级管理员, 系统管理员, 运营管理员, 审计员)' AS '';
SELECT '   - 产品类型: 11 (海鲜、肉类、速冻等)' AS '';
SELECT '   - 原料类型: 13 (分为鲜货和冻货)' AS '';
SELECT '   - 转换率配置: 7 (原料->产品的损耗率)' AS '';
SELECT '   - 部门: 11 (跨多工厂)' AS '';
SELECT '   - 供应商: 6 (各工厂对应)' AS '';
SELECT '   - 客户: 6 (各工厂对应)' AS '';
SELECT '   - 原料批次: 5 (含鲜货和冻货)' AS '';
SELECT '   - 加工批次: 7 (多状态: 完成、进行中、待开始)' AS '';
SELECT '   - 质检记录: 8' AS '';
SELECT '   - AI配额: 3 (防止AI爆表)' AS '';
SELECT '   - 生产计划: 6' AS '';
SELECT '' AS '';
SELECT '🔐 默认账号和密码:' AS Accounts;
SELECT '   工厂用户: super_admin / 123456' AS '';
SELECT '   工厂用户: dept_admin / 123456' AS '';
SELECT '   工厂用户: operator1 / 123456' AS '';
SELECT '   工厂用户: factory_admin_f002 / 123456' AS '';
SELECT '   工厂用户: factory_admin_f003 / 123456' AS '';
SELECT '   平台用户: platform_admin / 123456' AS '';
SELECT '   平台用户: system_admin / 123456' AS '';
SELECT '   平台用户: operation_admin / 123456' AS '';
SELECT '   平台用户: auditor / 123456' AS '';
