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
-- 3. 工厂用户 (users)
-- department枚举: farming, processing, logistics, quality, management
-- =====================================================
INSERT IGNORE INTO users (username, password_hash, factory_id, full_name, phone, department, position, role_code, is_active, monthly_salary, expected_work_minutes, created_at, updated_at) VALUES
-- F001 工厂用户
('factory_admin1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '张三', '13800138101', 'management', '工厂管理员', 'factory_super_admin', 1, 15000.00, 10080, NOW(), NOW()),
('operator1', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F001', '操作员小王', '13800138111', 'processing', '操作员', 'operator', 1, 6000.00, 10080, NOW(), NOW()),
-- F002 工厂用户
('factory_admin2', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', '李四', '13800138102', 'management', '工厂管理员', 'factory_super_admin', 1, 15000.00, 10080, NOW(), NOW()),
('operator2', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F002', '操作员小李', '13800138112', 'processing', '操作员', 'operator', 1, 6000.00, 10080, NOW(), NOW()),
-- F003 工厂用户
('factory_admin3', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F003', '王五', '13800138103', 'management', '工厂管理员', 'factory_super_admin', 1, 15000.00, 10080, NOW(), NOW()),
('operator3', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F003', '操作员小张', '13800138113', 'processing', '操作员', 'operator', 1, 6000.00, 10080, NOW(), NOW());

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
