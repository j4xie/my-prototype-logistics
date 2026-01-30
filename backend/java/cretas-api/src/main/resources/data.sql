-- =====================================================
-- Cretas Mock Data - 完整测试数据
-- 密码统一为: 123456
-- BCrypt Hash: $2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse
-- =====================================================

-- =====================================================
-- 1. 工厂数据 (factories)
-- =====================================================
INSERT IGNORE INTO factories (id, name, address, contact_name, contact_phone, contact_email, industry, ai_weekly_quota, is_active, manually_verified, created_at, updated_at) VALUES
('F001', '白垩纪水产加工一厂', '上海市浦东新区张江高科技园区100号', '张经理', '13800138001', 'factory1@cretas.com', '水产加工', 30, 1, 1, NOW(), NOW()),
('F002', '白垩纪水产加工二厂', '浙江省宁波市北仑区港口大道200号', '李经理', '13800138002', 'factory2@cretas.com', '水产加工', 30, 1, 1, NOW(), NOW()),
('F003', '白垩纪水产加工三厂', '山东省青岛市崂山区海尔路300号', '王经理', '13800138003', 'factory3@cretas.com', '水产加工', 30, 1, 1, NOW(), NOW());

-- =====================================================
-- 2. 平台管理员 (platform_admins)
-- =====================================================
INSERT IGNORE INTO platform_admins (username, password_hash, real_name, email, phone_number, platform_role, status, created_at, updated_at) VALUES
('platform_admin', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', '平台超级管理员', 'admin@cretas.com', '13900000000', 'super_admin', 'active', NOW(), NOW());

-- =====================================================
-- 3. 工厂用户 (users) - 14角色系统
-- department枚举: farming, processing, logistics, quality, management
-- level: 0=工厂总监, 10=部门经理, 20=车间主任, 30=一线员工, 50=查看者, 99=未激活
-- platform_type: web,mobile (所有角色默认支持双平台)
-- =====================================================
INSERT IGNORE INTO users (username, password_hash, factory_id, full_name, phone, department, position, role_code, is_active, monthly_salary, expected_work_minutes, level, platform_type, created_at, updated_at) VALUES
-- ===== F001 工厂用户 (全角色测试) =====
-- Level 0: 工厂总监
('factory_admin1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '张三', '13800138101', 'management', '工厂总监', 'factory_super_admin', 1, 25000.00, 10080, 0, 'web,mobile', NOW(), NOW()),

-- Level 10: 职能部门经理
('hr_admin1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', 'HR经理小陈', '13800138121', 'management', 'HR管理员', 'hr_admin', 1, 12000.00, 10080, 10, 'web,mobile', NOW(), NOW()),
('production_mgr1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '生产经理老刘', '13800138122', 'processing', '生产经理', 'production_manager', 1, 15000.00, 10080, 10, 'web,mobile', NOW(), NOW()),
('quality_mgr1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '质量经理小周', '13800138123', 'quality', '质量经理', 'quality_manager', 1, 14000.00, 10080, 10, 'web,mobile', NOW(), NOW()),
('warehouse_mgr1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '仓储主管老赵', '13800138124', 'logistics', '仓储主管', 'warehouse_manager', 1, 12000.00, 10080, 10, 'web,mobile', NOW(), NOW()),
('equipment_admin1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '设备管理员小孙', '13800138125', 'processing', '设备管理员', 'equipment_admin', 1, 11000.00, 10080, 10, 'web,mobile', NOW(), NOW()),
('procurement_mgr1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '采购主管老钱', '13800138126', 'management', '采购主管', 'procurement_manager', 1, 12000.00, 10080, 10, 'web,mobile', NOW(), NOW()),
('sales_mgr1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '销售主管小吴', '13800138127', 'management', '销售主管', 'sales_manager', 1, 13000.00, 10080, 10, 'web,mobile', NOW(), NOW()),
('finance_mgr1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '财务主管老郑', '13800138128', 'management', '财务主管', 'finance_manager', 1, 14000.00, 10080, 10, 'web,mobile', NOW(), NOW()),

-- Level 20: 车间管理
('workshop_sup1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '车间主任老马', '13800138131', 'processing', '车间主任', 'workshop_supervisor', 1, 10000.00, 10080, 20, 'web,mobile', NOW(), NOW()),

-- Level 30: 一线员工
('quality_insp1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '质检员小林', '13800138141', 'quality', '质检员', 'quality_inspector', 1, 7000.00, 10080, 30, 'web,mobile', NOW(), NOW()),
('operator1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '操作员小王', '13800138111', 'processing', '操作员', 'operator', 1, 6000.00, 10080, 30, 'web,mobile', NOW(), NOW()),
('warehouse_worker1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '仓库员小黄', '13800138151', 'logistics', '仓库员', 'warehouse_worker', 1, 5500.00, 10080, 30, 'web,mobile', NOW(), NOW()),

-- Level 50: 查看者
('viewer1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '访客小何', '13800138161', NULL, '查看者', 'viewer', 1, 0.00, 0, 50, 'web,mobile', NOW(), NOW()),

-- ===== F002 工厂用户 (基础角色) =====
('factory_admin2', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', '李四', '13800138102', 'management', '工厂总监', 'factory_super_admin', 1, 25000.00, 10080, 0, 'web,mobile', NOW(), NOW()),
('production_mgr2', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', '生产经理老杨', '13800138202', 'processing', '生产经理', 'production_manager', 1, 15000.00, 10080, 10, 'web,mobile', NOW(), NOW()),
('workshop_sup2', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', '车间主任老徐', '13800138212', 'processing', '车间主任', 'workshop_supervisor', 1, 10000.00, 10080, 20, 'web,mobile', NOW(), NOW()),
('operator2', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', '操作员小李', '13800138112', 'processing', '操作员', 'operator', 1, 6000.00, 10080, 30, 'web,mobile', NOW(), NOW()),

-- ===== F003 工厂用户 (基础角色) =====
('factory_admin3', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F003', '王五', '13800138103', 'management', '工厂总监', 'factory_super_admin', 1, 25000.00, 10080, 0, 'web,mobile', NOW(), NOW()),
('production_mgr3', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F003', '生产经理老胡', '13800138303', 'processing', '生产经理', 'production_manager', 1, 15000.00, 10080, 10, 'web,mobile', NOW(), NOW()),
('workshop_sup3', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F003', '车间主任老朱', '13800138313', 'processing', '车间主任', 'workshop_supervisor', 1, 10000.00, 10080, 20, 'web,mobile', NOW(), NOW()),
('operator3', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F003', '操作员小张', '13800138113', 'processing', '操作员', 'operator', 1, 6000.00, 10080, 30, 'web,mobile', NOW(), NOW());

-- =====================================================
-- 4. 部门 (departments)
-- =====================================================
INSERT IGNORE INTO departments (factory_id, code, name, is_active, display_order, created_at, updated_at) VALUES
-- F001 部门
('F001', 'MGMT', '管理部', 1, 1, NOW(), NOW()),
('F001', 'PROD', '生产部', 1, 2, NOW(), NOW()),
('F001', 'QC', '质检部', 1, 3, NOW(), NOW()),
-- F002 部门
('F002', 'MGMT', '管理部', 1, 1, NOW(), NOW()),
('F002', 'PROD', '生产部', 1, 2, NOW(), NOW()),
('F002', 'QC', '质检部', 1, 3, NOW(), NOW()),
-- F003 部门
('F003', 'MGMT', '管理部', 1, 1, NOW(), NOW()),
('F003', 'PROD', '生产部', 1, 2, NOW(), NOW()),
('F003', 'QC', '质检部', 1, 3, NOW(), NOW());

-- =====================================================
-- 5. 供应商 (suppliers)
-- 注意: 使用正确的列名 supplier_code, contact_phone
-- 修复: business_type -> supplied_materials, 添加 created_by (必填)
-- =====================================================
INSERT IGNORE INTO suppliers (id, factory_id, name, code, supplier_code, contact_person, contact_phone, address, supplied_materials, is_active, created_by, created_at, updated_at) VALUES
-- F001 供应商 (created_by=22)
('SUP-F001-001', 'F001', '东海水产批发', 'SUP001', 'SUP001', '陈老板', '13600136001', '浙江省舟山市定海区', '海水鱼', 1, 22, NOW(), NOW()),
('SUP-F001-002', 'F001', '南海渔业公司', 'SUP002', 'SUP002', '林老板', '13600136002', '广东省湛江市', '虾蟹', 1, 22, NOW(), NOW()),
-- F002 供应商 (created_by=23)
('SUP-F002-001', 'F002', '北海水产', 'SUP001', 'SUP001', '周老板', '13600136003', '山东省威海市', '海水鱼', 1, 23, NOW(), NOW()),
('SUP-F002-002', 'F002', '长江渔场', 'SUP002', 'SUP002', '吴老板', '13600136004', '江苏省南通市', '淡水鱼', 1, 23, NOW(), NOW()),
-- F003 供应商 (created_by=24)
('SUP-F003-001', 'F003', '黄海水产', 'SUP001', 'SUP001', '郑老板', '13600136005', '山东省日照市', '海水鱼', 1, 24, NOW(), NOW()),
('SUP-F003-002', 'F003', '渤海渔业', 'SUP002', 'SUP002', '孙老板', '13600136006', '辽宁省大连市', '贝类', 1, 24, NOW(), NOW());

-- =====================================================
-- 6. 客户 (customers)
-- 修复: 添加 customer_code (必填), address -> shipping_address
-- =====================================================
INSERT IGNORE INTO customers (id, factory_id, name, code, customer_code, contact_person, phone, email, shipping_address, customer_type, credit_level, status, is_active, created_at, updated_at) VALUES
-- F001 客户
('CUS-F001-001', 'F001', '上海盒马鲜生', 'CUS001', 'CUS001', '赵采购', '13700137001', 'hema@customer.com', '上海市浦东新区', 'retail', 'A', 'active', 1, NOW(), NOW()),
('CUS-F001-002', 'F001', '永辉超市华东区', 'CUS002', 'CUS002', '钱采购', '13700137002', 'yonghui@customer.com', '上海市徐汇区', 'wholesale', 'A', 'active', 1, NOW(), NOW()),
-- F002 客户
('CUS-F002-001', 'F002', '宁波大润发', 'CUS001', 'CUS001', '孙采购', '13700137003', 'darunfa@customer.com', '浙江省宁波市', 'retail', 'B', 'active', 1, NOW(), NOW()),
('CUS-F002-002', 'F002', '杭州联华超市', 'CUS002', 'CUS002', '李采购', '13700137004', 'lianhua@customer.com', '浙江省杭州市', 'wholesale', 'A', 'active', 1, NOW(), NOW()),
-- F003 客户
('CUS-F003-001', 'F003', '青岛佳世客', 'CUS001', 'CUS001', '王采购', '13700137005', 'jusco@customer.com', '山东省青岛市', 'retail', 'A', 'active', 1, NOW(), NOW()),
('CUS-F003-002', 'F003', '济南银座超市', 'CUS002', 'CUS002', '刘采购', '13700137006', 'yinzuo@customer.com', '山东省济南市', 'wholesale', 'B', 'active', 1, NOW(), NOW());

-- =====================================================
-- 7. 原材料类型 (raw_material_types)
-- =====================================================
INSERT IGNORE INTO raw_material_types (id, factory_id, code, name, category, unit, unit_price, storage_type, shelf_life_days, min_stock, max_stock, is_active, created_by, created_at, updated_at) VALUES
-- F001 原材料类型 (created_by = 22)
('RMT-F001-001', 'F001', 'DY', '带鱼', '海水鱼', 'kg', 35.00, 'frozen', 180, 100, 5000, 1, 22, NOW(), NOW()),
('RMT-F001-002', 'F001', 'HHY', '黄花鱼', '海水鱼', 'kg', 45.00, 'frozen', 180, 100, 5000, 1, 22, NOW(), NOW()),
('RMT-F001-003', 'F001', 'DX', '对虾', '虾类', 'kg', 80.00, 'frozen', 120, 50, 2000, 1, 22, NOW(), NOW()),
('RMT-F001-004', 'F001', 'YY', '鱿鱼', '头足类', 'kg', 55.00, 'frozen', 180, 80, 3000, 1, 22, NOW(), NOW()),
('RMT-F001-005', 'F001', 'BYU', '鲍鱼', '贝类', 'kg', 200.00, 'fresh', 7, 20, 500, 1, 22, NOW(), NOW()),
-- F002 原材料类型 (created_by = 23)
('RMT-F002-001', 'F002', 'DY', '带鱼', '海水鱼', 'kg', 34.00, 'frozen', 180, 100, 5000, 1, 23, NOW(), NOW()),
('RMT-F002-002', 'F002', 'LY', '鲈鱼', '海水鱼', 'kg', 50.00, 'fresh', 3, 50, 1000, 1, 23, NOW(), NOW()),
('RMT-F002-003', 'F002', 'PX', '皮皮虾', '虾类', 'kg', 65.00, 'fresh', 2, 30, 800, 1, 23, NOW(), NOW()),
('RMT-F002-004', 'F002', 'HB', '海蚌', '贝类', 'kg', 40.00, 'fresh', 3, 40, 1000, 1, 23, NOW(), NOW()),
('RMT-F002-005', 'F002', 'MYU', '墨鱼', '头足类', 'kg', 48.00, 'frozen', 180, 60, 2500, 1, 23, NOW(), NOW()),
-- F003 原材料类型 (created_by = 24)
('RMT-F003-001', 'F003', 'JY', '金枪鱼', '海水鱼', 'kg', 120.00, 'frozen', 365, 50, 2000, 1, 24, NOW(), NOW()),
('RMT-F003-002', 'F003', 'SY', '三文鱼', '海水鱼', 'kg', 95.00, 'fresh', 5, 30, 1000, 1, 24, NOW(), NOW()),
('RMT-F003-003', 'F003', 'LX', '龙虾', '虾类', 'kg', 180.00, 'fresh', 3, 20, 500, 1, 24, NOW(), NOW()),
('RMT-F003-004', 'F003', 'HX', '海参', '棘皮类', 'kg', 300.00, 'dry', 730, 10, 200, 1, 24, NOW(), NOW()),
('RMT-F003-005', 'F003', 'SB', '扇贝', '贝类', 'kg', 35.00, 'fresh', 2, 50, 1500, 1, 24, NOW(), NOW());

-- =====================================================
-- 8. 产品类型 (product_types)
-- =====================================================
INSERT IGNORE INTO product_types (id, factory_id, code, name, category, unit, unit_price, production_time_minutes, shelf_life_days, package_spec, is_active, created_by, created_at, updated_at) VALUES
-- F001 产品类型 (created_by = 22)
('PT-F001-001', 'F001', 'DYP', '带鱼段精品', '冷冻水产', '袋', 25.00, 30, 365, '500g/袋', 1, 22, NOW(), NOW()),
('PT-F001-002', 'F001', 'DXP', '大虾仁', '冷冻水产', '盒', 45.00, 45, 180, '300g/盒', 1, 22, NOW(), NOW()),
('PT-F001-003', 'F001', 'YYQ', '鱿鱼圈', '冷冻水产', '袋', 35.00, 40, 365, '400g/袋', 1, 22, NOW(), NOW()),
-- F002 产品类型 (created_by = 23)
('PT-F002-001', 'F002', 'LYP', '鲈鱼片', '鲜活水产', '盒', 68.00, 20, 3, '400g/盒', 1, 23, NOW(), NOW()),
('PT-F002-002', 'F002', 'HBP', '海蚌肉', '鲜活水产', '盒', 55.00, 25, 2, '300g/盒', 1, 23, NOW(), NOW()),
('PT-F002-003', 'F002', 'MYG', '墨鱼干', '干制品', '袋', 120.00, 480, 365, '200g/袋', 1, 23, NOW(), NOW()),
-- F003 产品类型 (created_by = 24)
('PT-F003-001', 'F003', 'JYP', '金枪鱼排', '冷冻水产', '盒', 150.00, 35, 365, '300g/盒', 1, 24, NOW(), NOW()),
('PT-F003-002', 'F003', 'SYP', '三文鱼刺身', '鲜活水产', '盒', 128.00, 15, 2, '200g/盒', 1, 24, NOW(), NOW()),
('PT-F003-003', 'F003', 'HXG', '即食海参', '即食品', '盒', 480.00, 120, 180, '100g/盒', 1, 24, NOW(), NOW());

-- =====================================================
-- 9. 设备 (factory_equipment)
-- =====================================================
INSERT IGNORE INTO factory_equipment (factory_id, code, equipment_code, equipment_name, type, model, manufacturer, purchase_date, purchase_price, depreciation_years, hourly_cost, power_consumption_kw, status, location, total_running_hours, maintenance_interval_hours, created_by, created_at, updated_at) VALUES
-- F001 设备
('F001', 'EQ001', 'EQ001', '速冻隧道机', '冷冻设备', 'SD-5000', '海尔冷链', '2023-01-15', 250000.00, 10, 50.00, 45.0, 'running', '1号车间', 2500, 500, 1, NOW(), NOW()),
('F001', 'EQ002', 'EQ002', '切片机', '加工设备', 'QP-200', '大连冷机', '2023-03-20', 85000.00, 8, 25.00, 15.0, 'running', '2号车间', 1800, 300, 1, NOW(), NOW()),
('F001', 'EQ003', 'EQ003', '真空包装机', '包装设备', 'VP-1000', '青岛海尔', '2023-06-10', 120000.00, 8, 30.00, 8.0, 'running', '包装区', 1200, 400, 1, NOW(), NOW()),
-- F002 设备
('F002', 'EQ001', 'EQ001', '制冰机', '制冷设备', 'ZB-3000', '格力电器', '2022-11-01', 180000.00, 10, 40.00, 35.0, 'running', '冷库区', 3500, 600, 1, NOW(), NOW()),
('F002', 'EQ002', 'EQ002', '清洗流水线', '清洗设备', 'QX-800', '上海机械', '2023-02-28', 95000.00, 8, 20.00, 12.0, 'running', '清洗区', 2200, 350, 1, NOW(), NOW()),
('F002', 'EQ003', 'EQ003', '称重分选机', '分选设备', 'CZ-500', '深圳科技', '2023-05-15', 65000.00, 6, 15.00, 5.0, 'running', '分选区', 1600, 250, 1, NOW(), NOW()),
-- F003 设备
('F003', 'EQ001', 'EQ001', '超低温冷库', '存储设备', 'CL-8000', '松下冷链', '2022-08-20', 450000.00, 15, 80.00, 60.0, 'running', '存储区', 5000, 800, 1, NOW(), NOW()),
('F003', 'EQ002', 'EQ002', '鱼片切割机', '加工设备', 'YQ-300', '日本岛津', '2023-01-08', 280000.00, 10, 55.00, 20.0, 'running', '加工区', 2800, 450, 1, NOW(), NOW()),
('F003', 'EQ003', 'EQ003', '气调包装机', '包装设备', 'QD-600', '德国博世', '2023-04-25', 350000.00, 10, 65.00, 18.0, 'running', '包装区', 1500, 500, 1, NOW(), NOW());

-- =====================================================
-- 10. 原材料批次 (material_batches)
-- 注意: 必须包含 created_by, receipt_quantity 必填字段
-- 状态使用枚举值: AVAILABLE, FRESH, FROZEN 等
-- =====================================================
INSERT IGNORE INTO material_batches (id, factory_id, batch_number, material_type_id, supplier_id, inbound_date, production_date, expire_date, used_quantity, reserved_quantity, unit_price, quantity_unit, receipt_quantity, status, created_by, created_at, updated_at) VALUES
-- F001 原材料批次 (带鱼35, 黄花鱼45, 对虾80, 鱿鱼55, 鲍鱼200) created_by=22(factory_admin1)
('MB-F001-001', 'F001', 'MB20241201001', 'RMT-F001-001', 'SUP-F001-001', '2024-12-01', '2024-11-28', '2025-05-30', 0.00, 0.00, 35.00, 'kg', 500.00, 'AVAILABLE', 22, NOW(), NOW()),
('MB-F001-002', 'F001', 'MB20241205001', 'RMT-F001-002', 'SUP-F001-001', '2024-12-05', '2024-12-02', '2025-06-03', 0.00, 0.00, 45.00, 'kg', 300.00, 'AVAILABLE', 22, NOW(), NOW()),
('MB-F001-003', 'F001', 'MB20241210001', 'RMT-F001-003', 'SUP-F001-002', '2024-12-10', '2024-12-08', '2025-04-08', 0.00, 0.00, 80.00, 'kg', 150.00, 'AVAILABLE', 22, NOW(), NOW()),
('MB-F001-004', 'F001', 'MB20241215001', 'RMT-F001-004', 'SUP-F001-001', '2024-12-15', '2024-12-12', '2025-06-12', 0.00, 0.00, 55.00, 'kg', 200.00, 'FROZEN', 22, NOW(), NOW()),
('MB-F001-005', 'F001', 'MB20241220001', 'RMT-F001-005', 'SUP-F001-002', '2024-12-20', '2024-12-18', '2024-12-27', 0.00, 0.00, 200.00, 'kg', 50.00, 'FRESH', 22, NOW(), NOW()),
-- F002 原材料批次 (带鱼34, 鲈鱼50, 皮皮虾65, 海蚌40, 墨鱼48) created_by=23(factory_admin2)
('MB-F002-001', 'F002', 'MB20241202001', 'RMT-F002-001', 'SUP-F002-001', '2024-12-02', '2024-11-29', '2025-05-31', 0.00, 0.00, 34.00, 'kg', 450.00, 'FROZEN', 23, NOW(), NOW()),
('MB-F002-002', 'F002', 'MB20241206001', 'RMT-F002-002', 'SUP-F002-002', '2024-12-06', '2024-12-05', '2024-12-09', 0.00, 0.00, 50.00, 'kg', 100.00, 'FRESH', 23, NOW(), NOW()),
('MB-F002-003', 'F002', 'MB20241211001', 'RMT-F002-003', 'SUP-F002-001', '2024-12-11', '2024-12-10', '2024-12-13', 0.00, 0.00, 65.00, 'kg', 80.00, 'FRESH', 23, NOW(), NOW()),
('MB-F002-004', 'F002', 'MB20241216001', 'RMT-F002-004', 'SUP-F002-002', '2024-12-16', '2024-12-14', '2024-12-19', 0.00, 0.00, 40.00, 'kg', 120.00, 'FRESH', 23, NOW(), NOW()),
('MB-F002-005', 'F002', 'MB20241221001', 'RMT-F002-005', 'SUP-F002-001', '2024-12-21', '2024-12-18', '2025-06-18', 0.00, 0.00, 48.00, 'kg', 180.00, 'FROZEN', 23, NOW(), NOW()),
-- F003 原材料批次 (金枪鱼120, 三文鱼95, 龙虾180, 海参300, 扇贝35) created_by=24(factory_admin3)
('MB-F003-001', 'F003', 'MB20241203001', 'RMT-F003-001', 'SUP-F003-001', '2024-12-03', '2024-11-30', '2025-11-30', 0.00, 0.00, 120.00, 'kg', 200.00, 'FROZEN', 24, NOW(), NOW()),
('MB-F003-002', 'F003', 'MB20241207001', 'RMT-F003-002', 'SUP-F003-001', '2024-12-07', '2024-12-06', '2024-12-12', 0.00, 0.00, 95.00, 'kg', 80.00, 'FRESH', 24, NOW(), NOW()),
('MB-F003-003', 'F003', 'MB20241212001', 'RMT-F003-003', 'SUP-F003-002', '2024-12-12', '2024-12-10', '2024-12-15', 0.00, 0.00, 180.00, 'kg', 30.00, 'FRESH', 24, NOW(), NOW()),
('MB-F003-004', 'F003', 'MB20241217001', 'RMT-F003-004', 'SUP-F003-002', '2024-12-17', '2024-12-15', '2026-12-15', 0.00, 0.00, 300.00, 'kg', 20.00, 'AVAILABLE', 24, NOW(), NOW()),
('MB-F003-005', 'F003', 'MB20241222001', 'RMT-F003-005', 'SUP-F003-001', '2024-12-22', '2024-12-21', '2024-12-24', 0.00, 0.00, 35.00, 'kg', 100.00, 'FRESH', 24, NOW(), NOW());

-- =====================================================
-- 11. 生产批次 (production_batches)
-- =====================================================
INSERT IGNORE INTO production_batches (factory_id, batch_number, product_type_id, product_name, planned_quantity, quantity, actual_quantity, good_quantity, defect_quantity, unit, status, start_time, end_time, supervisor_id, created_at, updated_at) VALUES
-- F001 生产批次 (supervisor_id = 22)
('F001', 'PB20241201001', 'PT-F001-001', '带鱼段精品', 1000, 1000.00, 980, 950, 30, '袋', 'COMPLETED', '2024-12-01 08:00:00', '2024-12-01 16:00:00', 22, NOW(), NOW()),
('F001', 'PB20241210001', 'PT-F001-002', '大虾仁', 500, 500.00, 485, 470, 15, '盒', 'COMPLETED', '2024-12-10 08:00:00', '2024-12-10 14:00:00', 22, NOW(), NOW()),
('F001', 'PB20241220001', 'PT-F001-003', '鱿鱼圈', 800, 800.00, 0, 0, 0, '袋', 'PRODUCING', '2024-12-20 08:00:00', NULL, 22, NOW(), NOW()),
-- F002 生产批次 (supervisor_id = 23)
('F002', 'PB20241202001', 'PT-F002-001', '鲈鱼片', 300, 300.00, 295, 290, 5, '盒', 'COMPLETED', '2024-12-02 08:00:00', '2024-12-02 12:00:00', 23, NOW(), NOW()),
('F002', 'PB20241212001', 'PT-F002-002', '海蚌肉', 400, 400.00, 390, 385, 5, '盒', 'COMPLETED', '2024-12-12 08:00:00', '2024-12-12 14:00:00', 23, NOW(), NOW()),
('F002', 'PB20241221001', 'PT-F002-003', '墨鱼干', 200, 200.00, 0, 0, 0, '袋', 'PRODUCING', '2024-12-21 08:00:00', NULL, 23, NOW(), NOW()),
-- F003 生产批次 (supervisor_id = 24)
('F003', 'PB20241203001', 'PT-F003-001', '金枪鱼排', 600, 600.00, 590, 580, 10, '盒', 'COMPLETED', '2024-12-03 08:00:00', '2024-12-03 15:00:00', 24, NOW(), NOW()),
('F003', 'PB20241213001', 'PT-F003-002', '三文鱼刺身', 250, 250.00, 245, 240, 5, '盒', 'COMPLETED', '2024-12-13 08:00:00', '2024-12-13 11:00:00', 24, NOW(), NOW()),
('F003', 'PB20241222001', 'PT-F003-003', '即食海参', 100, 100.00, 0, 0, 0, '盒', 'PLANNING', NULL, NULL, 24, NOW(), NOW());

-- =====================================================
-- 12. 白名单 (whitelist) - 允许注册的手机号
-- 注意: added_by 为必填字段 (nullable=false)
-- =====================================================
INSERT IGNORE INTO whitelist (factory_id, phone_number, name, department, position, status, added_by, created_at, updated_at) VALUES
('F001', '13800138101', '张三', '管理部', '工厂管理员', 'ACTIVE', 22, NOW(), NOW()),
('F001', '13800138111', '操作员小王', '生产部', '操作员', 'ACTIVE', 22, NOW(), NOW()),
('F002', '13800138102', '李四', '管理部', '工厂管理员', 'ACTIVE', 23, NOW(), NOW()),
('F002', '13800138112', '操作员小李', '生产部', '操作员', 'ACTIVE', 23, NOW(), NOW()),
('F003', '13800138103', '王五', '管理部', '工厂管理员', 'ACTIVE', 24, NOW(), NOW()),
('F003', '13800138113', '操作员小张', '生产部', '操作员', 'ACTIVE', 24, NOW(), NOW());

-- =====================================================
-- 13. 数据修复 - 修复跨工厂用户引用
-- 用户ID: 22=factory_admin1(F001), 23=factory_admin2(F002), 24=factory_admin3(F003)
-- =====================================================

-- 修复 production_batches 的 supervisor_id
UPDATE production_batches SET supervisor_id=22 WHERE factory_id='F001' AND supervisor_id=1;
UPDATE production_batches SET supervisor_id=23 WHERE factory_id='F002' AND supervisor_id=1;
UPDATE production_batches SET supervisor_id=24 WHERE factory_id='F003' AND supervisor_id=1;

-- 修复 factory_equipment 的 created_by
UPDATE factory_equipment SET created_by=22 WHERE factory_id='F001' AND created_by=1;
UPDATE factory_equipment SET created_by=23 WHERE factory_id='F002' AND created_by=1;
UPDATE factory_equipment SET created_by=24 WHERE factory_id='F003' AND created_by=1;

-- =====================================================
-- 14. 原材料消耗记录 (material_consumptions)
-- 关联已完成的生产批次与原材料批次
-- 修复: 移除 id (自增), plan_id -> production_plan_id, 移除 consumed_quantity
-- =====================================================

-- F001 生产批次消耗: PB20241201001(带鱼段精品)消耗MB-F001-001(带鱼), PB20241210001(大虾仁)消耗MB-F001-003(对虾)
INSERT IGNORE INTO material_consumptions (factory_id, production_batch_id, batch_id, production_plan_id, quantity, unit_price, total_cost, consumption_time, consumed_at, recorded_by, created_at, updated_at)
SELECT 'F001', pb.id, 'MB-F001-001', NULL, 100.00, 35.00, 3500.00, NOW(), NOW(), 22, NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241201001' AND pb.factory_id = 'F001';

INSERT IGNORE INTO material_consumptions (factory_id, production_batch_id, batch_id, production_plan_id, quantity, unit_price, total_cost, consumption_time, consumed_at, recorded_by, created_at, updated_at)
SELECT 'F001', pb.id, 'MB-F001-003', NULL, 50.00, 80.00, 4000.00, NOW(), NOW(), 22, NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241210001' AND pb.factory_id = 'F001';

-- F002 生产批次消耗
INSERT IGNORE INTO material_consumptions (factory_id, production_batch_id, batch_id, production_plan_id, quantity, unit_price, total_cost, consumption_time, consumed_at, recorded_by, created_at, updated_at)
SELECT 'F002', pb.id, 'MB-F002-002', NULL, 80.00, 50.00, 4000.00, NOW(), NOW(), 23, NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241202001' AND pb.factory_id = 'F002';

INSERT IGNORE INTO material_consumptions (factory_id, production_batch_id, batch_id, production_plan_id, quantity, unit_price, total_cost, consumption_time, consumed_at, recorded_by, created_at, updated_at)
SELECT 'F002', pb.id, 'MB-F002-004', NULL, 60.00, 40.00, 2400.00, NOW(), NOW(), 23, NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241212001' AND pb.factory_id = 'F002';

-- F003 生产批次消耗
INSERT IGNORE INTO material_consumptions (factory_id, production_batch_id, batch_id, production_plan_id, quantity, unit_price, total_cost, consumption_time, consumed_at, recorded_by, created_at, updated_at)
SELECT 'F003', pb.id, 'MB-F003-001', NULL, 50.00, 120.00, 6000.00, NOW(), NOW(), 24, NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241203001' AND pb.factory_id = 'F003';

INSERT IGNORE INTO material_consumptions (factory_id, production_batch_id, batch_id, production_plan_id, quantity, unit_price, total_cost, consumption_time, consumed_at, recorded_by, created_at, updated_at)
SELECT 'F003', pb.id, 'MB-F003-002', NULL, 40.00, 95.00, 3800.00, NOW(), NOW(), 24, NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241213001' AND pb.factory_id = 'F003';

-- =====================================================
-- 15. 更新原材料批次的已用数量 (模拟消耗后的库存)
-- 注意: remaining_quantity 是 @Transient 计算属性，不存储在数据库
-- remaining = receipt_quantity - used_quantity (由 Entity 动态计算)
-- =====================================================
UPDATE material_batches SET used_quantity = 100.00 WHERE id = 'MB-F001-001';
UPDATE material_batches SET used_quantity = 50.00 WHERE id = 'MB-F001-003';
UPDATE material_batches SET used_quantity = 80.00 WHERE id = 'MB-F002-002';
UPDATE material_batches SET used_quantity = 60.00 WHERE id = 'MB-F002-004';
UPDATE material_batches SET used_quantity = 50.00 WHERE id = 'MB-F003-001';
UPDATE material_batches SET used_quantity = 40.00 WHERE id = 'MB-F003-002';

-- =====================================================
-- 16. 工厂设置 (factory_settings) - 修复404问题
-- 每个工厂必须有对应的设置记录
-- =====================================================
INSERT IGNORE INTO factory_settings (factory_id, factory_name, factory_address, contact_phone, contact_email, working_hours, ai_weekly_quota, allow_self_registration, require_admin_approval, default_user_role, language, timezone, date_format, currency, enable_qr_code, enable_batch_management, enable_quality_check, enable_cost_calculation, enable_equipment_management, enable_attendance, ai_settings, notification_settings, work_time_settings, production_settings, inventory_settings, created_at, updated_at) VALUES
('F001', '白垩纪水产加工一厂', '上海市浦东新区张江高科技园区100号', '13800138001', 'factory1@cretas.com', 8, 30, 0, 1, 'viewer', 'zh-CN', 'Asia/Shanghai', 'yyyy-MM-dd', 'CNY', 1, 1, 1, 1, 1, 1, '{"enabled":true,"tone":"professional","goal":"cost_optimization","detailLevel":"standard"}', '{}', '{"startTime":"08:00","endTime":"17:00"}', '{"defaultBatchSize":100}', '{"minStockAlert":10}', NOW(), NOW()),
('F002', '白垩纪水产加工二厂', '浙江省宁波市北仑区港口大道200号', '13800138002', 'factory2@cretas.com', 8, 30, 0, 1, 'viewer', 'zh-CN', 'Asia/Shanghai', 'yyyy-MM-dd', 'CNY', 1, 1, 1, 1, 1, 1, '{"enabled":true,"tone":"professional","goal":"cost_optimization","detailLevel":"standard"}', '{}', '{"startTime":"08:00","endTime":"17:00"}', '{"defaultBatchSize":100}', '{"minStockAlert":10}', NOW(), NOW()),
('F003', '白垩纪水产加工三厂', '山东省青岛市崂山区海尔路300号', '13800138003', 'factory3@cretas.com', 8, 30, 0, 1, 'viewer', 'zh-CN', 'Asia/Shanghai', 'yyyy-MM-dd', 'CNY', 1, 1, 1, 1, 1, 1, '{"enabled":true,"tone":"professional","goal":"cost_optimization","detailLevel":"standard"}', '{}', '{"startTime":"08:00","endTime":"17:00"}', '{"defaultBatchSize":100}', '{"minStockAlert":10}', NOW(), NOW());

-- =====================================================
-- 17. AI分析报告 (ai_analysis_results) - 修复"暂无报告"问题
-- 为每个工厂添加测试报告
-- =====================================================
INSERT IGNORE INTO ai_analysis_results (factory_id, batch_id, report_type, analysis_text, session_id, period_start, period_end, expires_at, is_auto_generated, created_at, updated_at) VALUES
-- F001 测试报告
('F001', NULL, 'weekly', '## 周成本分析报告 (测试数据)\n\n### 本周生产概况\n- 完成批次: 3个\n- 总产量: 2465袋/盒\n- 良品率: 96.8%\n\n### 成本结构分析\n1. **原材料成本**: ¥15,500 (占比62%)\n2. **人工成本**: ¥5,200 (占比21%)\n3. **设备成本**: ¥4,300 (占比17%)\n\n### 优化建议\n1. 建议与供应商谈判降低带鱼采购价格\n2. 优化班次安排减少人工浪费\n3. 提高设备利用率至90%以上', 'test-session-001', DATE_SUB(NOW(), INTERVAL 7 DAY), NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 0, NOW(), NOW()),
('F001', NULL, 'monthly', '## 月度成本分析报告 (测试数据)\n\n### 本月生产总结\n- 完成批次: 12个\n- 总产量: 9,800袋/盒\n- 平均良品率: 95.5%\n\n### 成本趋势\n原材料成本同比下降3.2%，人工效率提升8%\n\n### 下月建议\n1. 继续优化采购流程\n2. 引入自动化设备降低人工成本', 'test-session-002', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), 0, NOW(), NOW()),
-- F002 测试报告
('F002', NULL, 'weekly', '## 周成本分析报告 (测试数据)\n\n### 生产情况\n- 完成批次: 2个\n- 总产量: 695盒\n- 良品率: 97.1%\n\n### 成本分析\n鲜活水产处理成本较高，建议优化冷链配送', 'test-session-003', DATE_SUB(NOW(), INTERVAL 7 DAY), NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 0, NOW(), NOW()),
-- F003 测试报告
('F003', NULL, 'weekly', '## 周成本分析报告 (测试数据)\n\n### 高端水产线分析\n- 金枪鱼排: 利润率35%\n- 三文鱼刺身: 利润率28%\n\n### 优化空间\n建议扩大金枪鱼产品线', 'test-session-004', DATE_SUB(NOW(), INTERVAL 7 DAY), NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 0, NOW(), NOW());

-- =====================================================
-- 18. 设备告警 (equipment_alerts) - 解决404问题
-- 需要关联 factory_equipment 的设备ID
-- =====================================================

-- 为 F001 添加设备告警
INSERT IGNORE INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at, created_at, updated_at)
SELECT 'F001', e.id, '维护提醒', 'CRITICAL', 'ACTIVE',
       CONCAT('设备 ', e.equipment_name, ' 维护已逾期 15 天'),
       CONCAT('上次维护: 2025-10-01\n下次维护: 2025-11-04\n设备编号: ', e.equipment_code),
       DATE_SUB(NOW(), INTERVAL 15 DAY), NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F001' AND e.code = 'EQ001';

INSERT IGNORE INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at, created_at, updated_at)
SELECT 'F001', e.id, '温度异常', 'WARNING', 'ACTIVE',
       CONCAT('设备 ', e.equipment_name, ' 运行温度偏高'),
       CONCAT('当前温度: -12℃\n正常范围: -18℃ ~ -20℃\n设备编号: ', e.equipment_code),
       DATE_SUB(NOW(), INTERVAL 3 DAY), NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F001' AND e.code = 'EQ001';

INSERT IGNORE INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at, acknowledged_at, acknowledged_by, acknowledged_by_name, created_at, updated_at)
SELECT 'F001', e.id, '刀片磨损', 'WARNING', 'ACKNOWLEDGED',
       CONCAT('设备 ', e.equipment_name, ' 刀片需要更换'),
       CONCAT('已使用次数: 8500\n建议更换阈值: 8000\n设备编号: ', e.equipment_code),
       DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY), 22, '张三', NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F001' AND e.code = 'EQ002';

INSERT IGNORE INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at, acknowledged_at, acknowledged_by, acknowledged_by_name, resolved_at, resolved_by, resolved_by_name, resolution_notes, created_at, updated_at)
SELECT 'F001', e.id, '真空度不足', 'WARNING', 'RESOLVED',
       CONCAT('设备 ', e.equipment_name, ' 真空度低于标准'),
       CONCAT('当前真空度: 85%\n标准值: 95%\n设备编号: ', e.equipment_code),
       DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY), 22, '张三',
       DATE_SUB(NOW(), INTERVAL 5 DAY), 22, '张三', '已更换真空泵密封圈，恢复正常', NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F001' AND e.code = 'EQ003';

-- 为 F002 添加设备告警
INSERT IGNORE INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at, created_at, updated_at)
SELECT 'F002', e.id, '电力异常', 'CRITICAL', 'ACTIVE',
       CONCAT('设备 ', e.equipment_name, ' 电流异常'),
       CONCAT('当前电流: 45A\n额定电流: 35A\n设备编号: ', e.equipment_code),
       DATE_SUB(NOW(), INTERVAL 2 DAY), NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F002' AND e.code = 'EQ001';

INSERT IGNORE INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at, created_at, updated_at)
SELECT 'F002', e.id, '水压不足', 'WARNING', 'ACTIVE',
       CONCAT('设备 ', e.equipment_name, ' 水压低于标准'),
       CONCAT('当前水压: 0.3MPa\n标准水压: 0.5MPa\n设备编号: ', e.equipment_code),
       DATE_SUB(NOW(), INTERVAL 1 DAY), NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F002' AND e.code = 'EQ002';

-- 为 F003 添加设备告警
INSERT IGNORE INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at, created_at, updated_at)
SELECT 'F003', e.id, '温度异常', 'CRITICAL', 'ACTIVE',
       CONCAT('设备 ', e.equipment_name, ' 温度波动异常'),
       CONCAT('当前温度: -48℃\n设定温度: -55℃\n波动范围超出±3℃\n设备编号: ', e.equipment_code),
       DATE_SUB(NOW(), INTERVAL 1 DAY), NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F003' AND e.code = 'EQ001';

INSERT IGNORE INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at, acknowledged_at, acknowledged_by, acknowledged_by_name, resolved_at, resolved_by, resolved_by_name, resolution_notes, created_at, updated_at)
SELECT 'F003', e.id, '刀片磨损', 'WARNING', 'RESOLVED',
       CONCAT('设备 ', e.equipment_name, ' 刀片精度下降'),
       CONCAT('切片厚度偏差: ±0.5mm\n标准偏差: ±0.2mm\n设备编号: ', e.equipment_code),
       DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 9 DAY), 24, '王五',
       DATE_SUB(NOW(), INTERVAL 8 DAY), 24, '王五', '已更换进口刀片，精度恢复正常', NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F003' AND e.code = 'EQ002';

-- =====================================================
-- 19. 出货记录 (shipment_records) - 解决无数据问题
-- =====================================================
INSERT IGNORE INTO shipment_records (id, factory_id, shipment_number, customer_id, shipment_date, total_amount, status, notes, created_by, created_at, updated_at) VALUES
-- F001 出货记录
('SH-F001-001', 'F001', 'SH20241215001', 'CUST-F001-001', '2024-12-15', 15000.00, 'DELIVERED', '带鱼段精品出货', 22, NOW(), NOW()),
('SH-F001-002', 'F001', 'SH20241220001', 'CUST-F001-002', '2024-12-20', 8500.00, 'SHIPPED', '大虾仁出货', 22, NOW(), NOW()),
('SH-F001-003', 'F001', 'SH20241225001', 'CUST-F001-001', '2024-12-25', 12000.00, 'PENDING', '鱿鱼圈出货', 22, NOW(), NOW()),
-- F002 出货记录
('SH-F002-001', 'F002', 'SH20241216001', 'CUST-F002-001', '2024-12-16', 9800.00, 'DELIVERED', '鲈鱼片出货', 23, NOW(), NOW()),
('SH-F002-002', 'F002', 'SH20241221001', 'CUST-F002-002', '2024-12-21', 7200.00, 'SHIPPED', '海蚌肉出货', 23, NOW(), NOW()),
-- F003 出货记录
('SH-F003-001', 'F003', 'SH20241218001', 'CUST-F003-001', '2024-12-18', 25000.00, 'DELIVERED', '金枪鱼排出货', 24, NOW(), NOW()),
('SH-F003-002', 'F003', 'SH20241222001', 'CUST-F003-002', '2024-12-22', 18000.00, 'PENDING', '三文鱼刺身出货', 24, NOW(), NOW());

-- =====================================================
-- 20. 质检记录 (quality_inspections) - 解决无数据问题
-- =====================================================
INSERT IGNORE INTO quality_inspections (factory_id, batch_id, inspector_id, inspection_type, result, inspection_date, temperature, appearance_score, texture_score, smell_score, overall_score, notes, created_at, updated_at)
SELECT 'F001', pb.id, 27, 'INCOMING', 'PASSED', DATE(pb.start_time), -18.5, 95, 92, 94, 93.7, '带鱼外观完整，色泽正常', NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241201001' AND pb.factory_id = 'F001';

INSERT IGNORE INTO quality_inspections (factory_id, batch_id, inspector_id, inspection_type, result, inspection_date, temperature, appearance_score, texture_score, smell_score, overall_score, notes, created_at, updated_at)
SELECT 'F001', pb.id, 27, 'OUTGOING', 'PASSED', DATE(pb.end_time), -20.0, 96, 94, 95, 95.0, '成品包装完整，标签规范', NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241201001' AND pb.factory_id = 'F001';

INSERT IGNORE INTO quality_inspections (factory_id, batch_id, inspector_id, inspection_type, result, inspection_date, temperature, appearance_score, texture_score, smell_score, overall_score, notes, created_at, updated_at)
SELECT 'F001', pb.id, 27, 'INCOMING', 'PASSED', DATE(pb.start_time), -16.0, 94, 93, 95, 94.0, '对虾新鲜度良好', NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241210001' AND pb.factory_id = 'F001';

INSERT IGNORE INTO quality_inspections (factory_id, batch_id, inspector_id, inspection_type, result, inspection_date, temperature, appearance_score, texture_score, smell_score, overall_score, notes, created_at, updated_at)
SELECT 'F002', pb.id, 28, 'INCOMING', 'PASSED', DATE(pb.start_time), 4.0, 93, 91, 93, 92.3, '鲈鱼活体健康', NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241202001' AND pb.factory_id = 'F002';

INSERT IGNORE INTO quality_inspections (factory_id, batch_id, inspector_id, inspection_type, result, inspection_date, temperature, appearance_score, texture_score, smell_score, overall_score, notes, created_at, updated_at)
SELECT 'F003', pb.id, 29, 'INCOMING', 'PASSED', DATE(pb.start_time), -55.0, 98, 97, 98, 97.7, '金枪鱼品质优良', NOW(), NOW()
FROM production_batches pb WHERE pb.batch_number = 'PB20241203001' AND pb.factory_id = 'F003';

-- =====================================================
-- 21. 废弃处理记录 (disposal_records) - 解决无数据问题
-- =====================================================
INSERT IGNORE INTO disposal_records (id, factory_id, disposal_number, disposal_date, disposal_type, disposal_reason, quantity, unit, estimated_loss, actual_loss, status, notes, created_by, approved_by, approved_at, created_at, updated_at) VALUES
-- F001 废弃记录
('DR-F001-001', 'F001', 'DR20241210001', '2024-12-10', 'SCRAPPED', '过期', 50.0, 'kg', 1750.00, 1750.00, 'COMPLETED', '带鱼过期报废', 22, 22, NOW(), NOW(), NOW()),
('DR-F001-002', 'F001', 'DR20241215001', '2024-12-15', 'RETURNED', '质量不合格', 30.0, 'kg', 2400.00, 2400.00, 'COMPLETED', '对虾质量问题退货', 22, 22, NOW(), NOW(), NOW()),
-- F002 废弃记录
('DR-F002-001', 'F002', 'DR20241212001', '2024-12-12', 'SCRAPPED', '设备故障', 20.0, 'kg', 1000.00, 1000.00, 'COMPLETED', '清洗设备故障导致损耗', 23, 23, NOW(), NOW(), NOW()),
-- F003 废弃记录
('DR-F003-001', 'F003', 'DR20241218001', '2024-12-18', 'SCRAPPED', '温度异常', 10.0, 'kg', 1200.00, 1200.00, 'COMPLETED', '冷库温度异常导致损失', 24, 24, NOW(), NOW(), NOW()),
('DR-F003-002', 'F003', 'DR20241220001', '2024-12-20', 'RETURNED', '客户退货', 15.0, 'kg', 1425.00, 1425.00, 'PENDING', '客户退货待处理', 24, NULL, NULL, NOW(), NOW());

-- =====================================================
-- 22. 考勤记录 (time_clock_records) - 解决无数据问题
-- =====================================================
INSERT IGNORE INTO time_clock_records (factory_id, user_id, clock_in_time, clock_out_time, clock_in_location, clock_out_location, work_date, status, total_work_minutes, overtime_minutes, created_at, updated_at) VALUES
-- F001 考勤记录 (user_id: 22=factory_admin1, 27=quality_insp1, 28=operator1)
('F001', 22, '2024-12-26 08:00:00', '2024-12-26 17:30:00', '上海市浦东新区', '上海市浦东新区', '2024-12-26', 'NORMAL', 570, 30, NOW(), NOW()),
('F001', 22, '2024-12-25 08:05:00', '2024-12-25 17:00:00', '上海市浦东新区', '上海市浦东新区', '2024-12-25', 'NORMAL', 535, 0, NOW(), NOW()),
('F001', 27, '2024-12-26 07:55:00', '2024-12-26 17:00:00', '上海市浦东新区', '上海市浦东新区', '2024-12-26', 'NORMAL', 545, 0, NOW(), NOW()),
('F001', 27, '2024-12-25 08:15:00', '2024-12-25 17:00:00', '上海市浦东新区', '上海市浦东新区', '2024-12-25', 'LATE', 525, 0, NOW(), NOW()),
('F001', 28, '2024-12-26 08:00:00', '2024-12-26 18:00:00', '上海市浦东新区', '上海市浦东新区', '2024-12-26', 'NORMAL', 600, 60, NOW(), NOW()),
-- F002 考勤记录
('F002', 23, '2024-12-26 07:58:00', '2024-12-26 17:00:00', '浙江省宁波市', '浙江省宁波市', '2024-12-26', 'NORMAL', 542, 0, NOW(), NOW()),
('F002', 23, '2024-12-25 08:00:00', '2024-12-25 17:30:00', '浙江省宁波市', '浙江省宁波市', '2024-12-25', 'NORMAL', 570, 30, NOW(), NOW()),
-- F003 考勤记录
('F003', 24, '2024-12-26 08:00:00', '2024-12-26 17:00:00', '山东省青岛市', '山东省青岛市', '2024-12-26', 'NORMAL', 540, 0, NOW(), NOW()),
('F003', 24, '2024-12-25 09:00:00', '2024-12-25 17:00:00', '山东省青岛市', '山东省青岛市', '2024-12-25', 'LATE', 480, 0, NOW(), NOW());

-- =====================================================
-- 23. 设备维护记录 (equipment_maintenance) - 解决无数据问题
-- =====================================================
INSERT IGNORE INTO equipment_maintenance (factory_id, equipment_id, maintenance_type, maintenance_date, description, cost, performed_by, next_maintenance_date, created_at, updated_at)
SELECT 'F001', e.id, 'ROUTINE', '2024-12-15', '速冻隧道机日常保养，清洁冷凝器，检查制冷剂', 800.00, '张三', '2025-01-15', NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F001' AND e.code = 'EQ001';

INSERT IGNORE INTO equipment_maintenance (factory_id, equipment_id, maintenance_type, maintenance_date, description, cost, performed_by, next_maintenance_date, created_at, updated_at)
SELECT 'F001', e.id, 'PREVENTIVE', '2024-12-10', '切片机刀片更换，传动带检查', 1500.00, '李四', '2025-02-10', NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F001' AND e.code = 'EQ002';

INSERT IGNORE INTO equipment_maintenance (factory_id, equipment_id, maintenance_type, maintenance_date, description, cost, performed_by, next_maintenance_date, created_at, updated_at)
SELECT 'F002', e.id, 'CORRECTIVE', '2024-12-18', '制冰机压缩机维修，更换阀门', 3500.00, '王五', '2025-03-18', NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F002' AND e.code = 'EQ001';

INSERT IGNORE INTO equipment_maintenance (factory_id, equipment_id, maintenance_type, maintenance_date, description, cost, performed_by, next_maintenance_date, created_at, updated_at)
SELECT 'F003', e.id, 'ROUTINE', '2024-12-20', '超低温冷库温度校准，门封检查', 500.00, '赵六', '2025-01-20', NOW(), NOW()
FROM factory_equipment e WHERE e.factory_id = 'F003' AND e.code = 'EQ001';
