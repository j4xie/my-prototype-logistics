-- 完整测试数据准备脚本
-- 生成时间: 2025-11-20
-- 用途: 为集成测试准备完整的测试数据

USE cretas_db;

-- ==================== 1. 产品类型 (Product Types) ====================
INSERT INTO product_types (id, factory_id, category, name, unit, shelf_life_days, storage_temp_min, storage_temp_max, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', '海鲜', '冷冻鱼片', '公斤', 365, -18.0, -15.0, NOW(), NOW()),
(2, 'CRETAS_2024_001', '海鲜', '冷冻虾仁', '公斤', 365, -18.0, -15.0, NOW(), NOW()),
(3, 'CRETAS_2024_001', '海鲜', '冷冻鱼块', '公斤', 365, -18.0, -15.0, NOW(), NOW()),
(4, 'CRETAS_2024_001', '肉类', '冷冻鸡肉', '公斤', 180, -18.0, -15.0, NOW(), NOW()),
(5, 'CRETAS_2024_001', '蔬菜', '速冻蔬菜', '公斤', 180, -18.0, -15.0, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 2. 原料类型 (Raw Material Types) ====================
INSERT INTO raw_material_types (id, factory_id, category, name, unit, specification, shelf_life_days, storage_temp_min, storage_temp_max, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', '海鲜', '鲜活鱼', '公斤', '整条', 3, 0.0, 4.0, NOW(), NOW()),
(2, 'CRETAS_2024_001', '海鲜', '冷冻虾', '公斤', '去壳', 365, -18.0, -15.0, NOW(), NOW()),
(3, 'CRETAS_2024_001', '肉类', '鲜鸡肉', '公斤', '整块', 7, 0.0, 4.0, NOW(), NOW()),
(4, 'CRETAS_2024_001', '调料', '食盐', '公斤', '袋装', 730, 10.0, 30.0, NOW(), NOW()),
(5, 'CRETAS_2024_001', '蔬菜', '新鲜蔬菜', '公斤', '整颗', 5, 0.0, 4.0, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 3. 部门 (Departments) ====================
INSERT INTO departments (id, factory_id, name, code, type, manager_id, manager_name, status, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', '加工部', 'DEPT_PROC', 'processing', 1, '超级工厂管理员', 'active', NOW(), NOW()),
(2, 'CRETAS_2024_001', '质检部', 'DEPT_QC', 'quality', 2, '部门管理员', 'active', NOW(), NOW()),
(3, 'CRETAS_2024_001', '仓储部', 'DEPT_WARE', 'logistics', NULL, NULL, 'active', NOW(), NOW()),
(4, 'CRETAS_2024_001', '管理部', 'DEPT_MGMT', 'management', 1, '超级工厂管理员', 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 4. 供应商 (Suppliers) ====================
INSERT INTO suppliers (id, factory_id, name, contact_person, phone, email, address, category, rating, status, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', '海洋渔业有限公司', '张三', '13800138001', 'zhangsan@ocean.com', '浙江省舟山市', '海鲜', 5, 'active', NOW(), NOW()),
(2, 'CRETAS_2024_001', '新鲜禽肉批发', '李四', '13800138002', 'lisi@poultry.com', '山东省济南市', '肉类', 4, 'active', NOW(), NOW()),
(3, 'CRETAS_2024_001', '绿色蔬菜基地', '王五', '13800138003', 'wangwu@veg.com', '江苏省南京市', '蔬菜', 4, 'active', NOW(), NOW()),
(4, 'CRETAS_2024_001', '优质调料供应商', '赵六', '13800138004', 'zhaoliu@spice.com', '广东省广州市', '调料', 5, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 5. 客户 (Customers) ====================
INSERT INTO customers (id, factory_id, name, contact_person, phone, email, address, category, credit_limit, status, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', '大型连锁超市A', '陈经理', '13900139001', 'chen@supermarket-a.com', '上海市浦东新区', '零售', 500000.00, 'active', NOW(), NOW()),
(2, 'CRETAS_2024_001', '酒店集团B', '刘经理', '13900139002', 'liu@hotel-b.com', '北京市朝阳区', '餐饮', 300000.00, 'active', NOW(), NOW()),
(3, 'CRETAS_2024_001', '食品批发市场C', '周经理', '13900139003', 'zhou@market-c.com', '广州市天河区', '批发', 800000.00, 'active', NOW(), NOW()),
(4, 'CRETAS_2024_001', '连锁餐厅D', '吴经理', '13900139004', 'wu@restaurant-d.com', '深圳市福田区', '餐饮', 200000.00, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 6. 原料批次 (Material Batches) ====================
INSERT INTO material_batches (id, factory_id, batch_number, raw_material_type_id, supplier_id, quantity, unit, unit_price, total_cost, received_date, expiry_date, storage_location, qr_code, status, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', 'MB202411200001', 1, 1, 500.00, '公斤', 25.00, 12500.00, '2025-11-18', '2025-11-21', 'A区冷藏1', 'QR_MB_001', 'in_stock', NOW(), NOW()),
(2, 'CRETAS_2024_001', 'MB202411200002', 2, 1, 300.00, '公斤', 80.00, 24000.00, '2025-11-15', '2026-11-15', 'B区冷冻1', 'QR_MB_002', 'in_stock', NOW(), NOW()),
(3, 'CRETAS_2024_001', 'MB202411200003', 3, 2, 400.00, '公斤', 18.00, 7200.00, '2025-11-17', '2025-11-24', 'A区冷藏2', 'QR_MB_003', 'in_stock', NOW(), NOW()),
(4, 'CRETAS_2024_001', 'MB202411200004', 4, 4, 100.00, '公斤', 5.00, 500.00, '2025-11-10', '2027-11-10', 'C区干货1', 'QR_MB_004', 'in_stock', NOW(), NOW()),
(5, 'CRETAS_2024_001', 'MB202411200005', 5, 3, 200.00, '公斤', 8.00, 1600.00, '2025-11-19', '2025-11-24', 'A区冷藏3', 'QR_MB_005', 'in_stock', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 7. 加工批次 (Processing Batches) ====================
INSERT INTO processing_batches (id, factory_id, batch_number, product_type_id, planned_quantity, actual_quantity, unit, status, supervisor_id, supervisor_name, start_time, end_time, notes, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', 'PB202411200001', 1, 300.00, 285.00, '公斤', 'completed', 1, '超级工厂管理员', '2025-11-19 08:00:00', '2025-11-19 16:00:00', '首批鱼片加工完成', NOW(), NOW()),
(2, 'CRETAS_2024_001', 'PB202411200002', 2, 200.00, 195.00, '公斤', 'completed', 1, '超级工厂管理员', '2025-11-19 09:00:00', '2025-11-19 17:00:00', '虾仁加工完成', NOW(), NOW()),
(3, 'CRETAS_2024_001', 'PB202411200003', 3, 250.00, NULL, '公斤', 'in_progress', 1, '超级工厂管理员', '2025-11-20 08:00:00', NULL, '正在加工中', NOW(), NOW()),
(4, 'CRETAS_2024_001', 'PB202411200004', 4, 150.00, NULL, '公斤', 'planned', 1, '超级工厂管理员', NULL, NULL, '计划明日加工', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 8. 质检记录 (Quality Inspections) ====================
INSERT INTO quality_inspections (id, factory_id, batch_id, batch_number, batch_type, inspection_date, inspector_id, inspector_name, sample_size, defect_count, pass_rate, result, notes, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', 1, 'PB202411200001', 'processing', '2025-11-19', 2, '部门管理员', 50, 2, 96.00, 'passed', '质量合格，少量外观瑕疵', NOW(), NOW()),
(2, 'CRETAS_2024_001', 2, 'PB202411200002', 'processing', '2025-11-19', 2, '部门管理员', 40, 1, 97.50, 'passed', '质量优秀', NOW(), NOW()),
(3, 'CRETAS_2024_001', 1, 'MB202411200001', 'material', '2025-11-18', 2, '部门管理员', 30, 0, 100.00, 'passed', '原料新鲜度优秀', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 9. 设备 (Equipment) ====================
INSERT INTO equipment (id, factory_id, name, code, type, model, manufacturer, purchase_date, status, location, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', '切片机01', 'EQ_SLICER_01', 'processing', 'SL-3000', '德国KRONEN', '2024-01-15', 'active', '加工车间A区', NOW(), NOW()),
(2, 'CRETAS_2024_001', '冷冻设备02', 'EQ_FREEZER_02', 'refrigeration', 'FR-5000', '日本SANYO', '2024-02-20', 'active', '冷冻车间B区', NOW(), NOW()),
(3, 'CRETAS_2024_001', '包装机03', 'EQ_PACKER_03', 'packaging', 'PK-2000', '意大利ILAPAK', '2024-03-10', 'active', '包装车间C区', NOW(), NOW()),
(4, 'CRETAS_2024_001', '运输车04', 'EQ_TRUCK_04', 'transport', 'TK-1000', '中国福田', '2024-04-05', 'maintenance', '车库', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 10. 工作类型 (Work Types) ====================
INSERT INTO work_types (id, factory_id, name, code, category, hourly_rate, description, is_active, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', '切割加工', 'WT_CUTTING', 'processing', 25.00, '鱼类、肉类切割加工', 1, NOW(), NOW()),
(2, 'CRETAS_2024_001', '冷冻操作', 'WT_FREEZING', 'processing', 20.00, '产品冷冻处理', 1, NOW(), NOW()),
(3, 'CRETAS_2024_001', '包装作业', 'WT_PACKING', 'packaging', 18.00, '产品包装封装', 1, NOW(), NOW()),
(4, 'CRETAS_2024_001', '质检检测', 'WT_QC', 'quality', 30.00, '质量检测与抽样', 1, NOW(), NOW()),
(5, 'CRETAS_2024_001', '设备维护', 'WT_MAINT', 'maintenance', 35.00, '设备保养与维修', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 11. 转换率 (Material Product Conversions) ====================
INSERT INTO material_product_conversions (id, factory_id, raw_material_type_id, product_type_id, conversion_rate, unit, loss_rate, notes, is_active, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', 1, 1, 0.85, '公斤', 0.15, '鲜鱼→鱼片，损耗15%', 1, NOW(), NOW()),
(2, 'CRETAS_2024_001', 2, 2, 0.95, '公斤', 0.05, '冷冻虾→虾仁，损耗5%', 1, NOW(), NOW()),
(3, 'CRETAS_2024_001', 3, 4, 0.90, '公斤', 0.10, '鲜鸡肉→冷冻鸡肉，损耗10%', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 12. 生产计划 (Production Plans) ====================
INSERT INTO production_plans (id, factory_id, plan_number, product_type_id, planned_quantity, unit, plan_date, status, priority, notes, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', 'PLAN202411200001', 1, 500.00, '公斤', '2025-11-21', 'pending', 'high', '大客户订单', NOW(), NOW()),
(2, 'CRETAS_2024_001', 'PLAN202411200002', 2, 300.00, '公斤', '2025-11-22', 'pending', 'normal', '常规生产', NOW(), NOW()),
(3, 'CRETAS_2024_001', 'PLAN202411200003', 3, 400.00, '公斤', '2025-11-23', 'draft', 'low', '备货计划', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 13. 打卡记录 (Time Clock Records) ====================
INSERT INTO time_clock_records (id, factory_id, user_id, username, full_name, clock_in_time, clock_in_location, clock_in_photo, clock_out_time, clock_out_location, clock_out_photo, work_duration_minutes, status, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', 1, 'super_admin', '超级工厂管理员', '2025-11-19 08:00:00', '工厂大门', NULL, '2025-11-19 17:30:00', '工厂大门', NULL, 570, 'completed', NOW(), NOW()),
(2, 'CRETAS_2024_001', 2, 'dept_admin', '部门管理员', '2025-11-19 08:15:00', '质检部', NULL, '2025-11-19 17:00:00', '质检部', NULL, 525, 'completed', NOW(), NOW()),
(3, 'CRETAS_2024_001', 3, 'operator1', '操作员1', '2025-11-19 08:30:00', '加工车间', NULL, '2025-11-19 17:15:00', '加工车间', NULL, 525, 'completed', NOW(), NOW()),
(4, 'CRETAS_2024_001', 1, 'super_admin', '超级工厂管理员', '2025-11-20 08:00:00', '工厂大门', NULL, NULL, NULL, NULL, NULL, 'in_progress', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 14. 白名单 (Whitelist) ====================
INSERT INTO whitelist (id, factory_id, phone_number, name, role, status, approved_by, approved_at, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', '+8613900000001', '测试用户1', 'operator', 'active', 1, NOW(), NOW(), NOW()),
(2, 'CRETAS_2024_001', '+8613900000002', '测试用户2', 'operator', 'active', 1, NOW(), NOW(), NOW()),
(3, 'CRETAS_2024_001', '+8613900000003', '测试用户3', 'viewer', 'active', 1, NOW(), NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 15. 工厂设置 (Factory Settings) ====================
INSERT INTO factory_settings (id, factory_id, setting_key, setting_value, category, description, created_at, updated_at) VALUES
(1, 'CRETAS_2024_001', 'work_hours_start', '08:00', 'attendance', '上班时间', NOW(), NOW()),
(2, 'CRETAS_2024_001', 'work_hours_end', '17:00', 'attendance', '下班时间', NOW(), NOW()),
(3, 'CRETAS_2024_001', 'overtime_rate', '1.5', 'attendance', '加班费率', NOW(), NOW()),
(4, 'CRETAS_2024_001', 'quality_pass_threshold', '95.0', 'quality', '质检合格率阈值', NOW(), NOW()),
(5, 'CRETAS_2024_001', 'low_stock_threshold', '100', 'inventory', '低库存警戒线(公斤)', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== 验证数据 ====================
SELECT 'Product Types' AS Table_Name, COUNT(*) AS Record_Count FROM product_types WHERE deleted_at IS NULL
UNION ALL
SELECT 'Raw Material Types', COUNT(*) FROM raw_material_types WHERE deleted_at IS NULL
UNION ALL
SELECT 'Departments', COUNT(*) FROM departments WHERE deleted_at IS NULL
UNION ALL
SELECT 'Suppliers', COUNT(*) FROM suppliers WHERE deleted_at IS NULL
UNION ALL
SELECT 'Customers', COUNT(*) FROM customers WHERE deleted_at IS NULL
UNION ALL
SELECT 'Material Batches', COUNT(*) FROM material_batches WHERE deleted_at IS NULL
UNION ALL
SELECT 'Processing Batches', COUNT(*) FROM processing_batches WHERE deleted_at IS NULL
UNION ALL
SELECT 'Quality Inspections', COUNT(*) FROM quality_inspections WHERE deleted_at IS NULL
UNION ALL
SELECT 'Equipment', COUNT(*) FROM equipment WHERE deleted_at IS NULL
UNION ALL
SELECT 'Work Types', COUNT(*) FROM work_types WHERE deleted_at IS NULL
UNION ALL
SELECT 'Conversions', COUNT(*) FROM material_product_conversions WHERE deleted_at IS NULL
UNION ALL
SELECT 'Production Plans', COUNT(*) FROM production_plans WHERE deleted_at IS NULL
UNION ALL
SELECT 'Time Clock Records', COUNT(*) FROM time_clock_records WHERE deleted_at IS NULL
UNION ALL
SELECT 'Whitelist', COUNT(*) FROM whitelist WHERE deleted_at IS NULL
UNION ALL
SELECT 'Factory Settings', COUNT(*) FROM factory_settings;

SELECT '✅ 测试数据准备完成！' AS Status;
