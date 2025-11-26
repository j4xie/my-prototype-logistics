-- ============================================================
-- 完整生产业务数据脚本 (Complete Business Data)
-- ============================================================
-- 包含所有重要业务表的完整测试数据
-- ============================================================

USE cretas_db;

-- ============================================================
-- 第1部分: 生产计划 (Production Plans)
-- ============================================================
INSERT IGNORE INTO production_plans (id, factory_id, plan_number, period, status, total_planned_quantity, total_completed_quantity, notes, created_at, updated_at) VALUES
(1001, 'F001', 'PLAN-F001-2025-11-W47', '2025-11-18 至 2025-11-24', 'IN_PROGRESS', 2000, 600, '海鲜产品第47周生产计划', NOW(), NOW()),
(1002, 'F001', 'PLAN-F001-2025-11-W48', '2025-11-25 至 2025-12-01', 'PENDING', 2500, 0, '海鲜产品第48周生产计划', NOW(), NOW()),
(1003, 'F002', 'PLAN-F002-2025-11-W47', '2025-11-18 至 2025-11-24', 'IN_PROGRESS', 1800, 400, '肉制品第47周生产计划', NOW(), NOW()),
(1004, 'F002', 'PLAN-F002-2025-11-W48', '2025-11-25 至 2025-12-01', 'PENDING', 2200, 0, '肉制品第48周生产计划', NOW(), NOW()),
(1005, 'F003', 'PLAN-F003-2025-11-W47', '2025-11-18 至 2025-11-24', 'COMPLETED', 1500, 1500, '果蔬产品第47周生产计划', NOW(), NOW()),
(1006, 'F003', 'PLAN-F003-2025-11-W48', '2025-11-25 至 2025-12-01', 'PENDING', 1800, 0, '果蔬产品第48周生产计划', NOW(), NOW());

-- ============================================================
-- 第2部分: 原料批次 (Material Batches)
-- ============================================================
INSERT IGNORE INTO material_batches (id, factory_id, batch_number, material_type_id, supplier_id, quantity, unit, received_date, expiry_date, storage_location, quality_status, notes, created_at, updated_at) VALUES
-- F001 海鲜原料
(2001, 'F001', 'MAT-F001-20251120-001', 'F001-RMT001', 201, 500, '公斤', '2025-11-20', '2025-11-23', '冷藏-A-01', 'qualified', '鲜活鱼，质量优秀', NOW(), NOW()),
(2002, 'F001', 'MAT-F001-20251120-002', 'F001-RMT002', 202, 300, '公斤', '2025-11-20', '2025-11-22', '冷藏-A-02', 'qualified', '鲜活虾，新鲜度高', NOW(), NOW()),
(2003, 'F001', 'MAT-F001-20251121-001', 'F001-RMT003', 203, 800, '公斤', '2025-11-21', '2026-11-21', '冷冻-B-01', 'qualified', '带鱼，冷冻状态好', NOW(), NOW()),
(2004, 'F001', 'MAT-F001-20251121-002', 'F001-RMT004', 201, 200, '公斤', '2025-11-21', '2027-11-21', '常温-C-01', 'qualified', '食盐防腐剂', NOW(), NOW()),

-- F002 肉制品原料
(2005, 'F002', 'MAT-F002-20251120-001', 'F002-RMT001', 204, 600, '公斤', '2025-11-20', '2025-11-25', '冷藏-A-03', 'qualified', '新鲜鸡肉，来自山东', NOW(), NOW()),
(2006, 'F002', 'MAT-F002-20251120-002', 'F002-RMT002', 205, 1000, '公斤', '2025-11-20', '2026-11-20', '冷冻-B-02', 'qualified', '冷冻猪肉，河南基地', NOW(), NOW()),
(2007, 'F002', 'MAT-F002-20251121-001', 'F002-RMT003', 204, 300, '公斤', '2025-11-21', '2027-11-21', '常温-C-02', 'qualified', '腌制盐', NOW(), NOW()),
(2008, 'F002', 'MAT-F002-20251121-002', 'F002-RMT004', 206, 150, '公斤', '2025-11-21', '2026-11-21', '常温-C-03', 'qualified', '烟熏香料', NOW(), NOW()),

-- F003 果蔬原料
(2009, 'F003', 'MAT-F003-20251120-001', 'F003-RMT001', 207, 400, '公斤', '2025-11-20', '2025-11-27', '冷藏-A-04', 'qualified', '新鲜叶菜，江苏基地', NOW(), NOW()),
(2010, 'F003', 'MAT-F003-20251120-002', 'F003-RMT002', 208, 500, '公斤', '2025-11-20', '2025-11-30', '冷藏-A-05', 'qualified', '新鲜水果，山东基地', NOW(), NOW()),
(2011, 'F003', 'MAT-F003-20251121-001', 'F003-RMT003', 209, 600, '公斤', '2025-11-21', '2026-11-21', '冷冻-B-03', 'qualified', '冷冻根茎菜', NOW(), NOW()),
(2012, 'F003', 'MAT-F003-20251121-002', 'F003-RMT004', 209, 100, '公斤', '2025-11-21', '2026-11-21', '常温-C-04', 'qualified', '食品添加剂', NOW(), NOW());

-- ============================================================
-- 第3部分: 加工批次 (Processing Batches)
-- ============================================================
INSERT IGNORE INTO processing_batches (id, factory_id, batch_number, product_type_id, planned_quantity, actual_quantity, unit, status, production_date, completion_date, efficiency, quality_grade, notes, created_at, updated_at) VALUES
-- F001 海鲜加工
(3001, 'F001', 'PROC-F001-20251120-001', 'F001-PT001', 300, 290, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 96.67, 'A', '冷冻鱼片加工完成', NOW(), NOW()),
(3002, 'F001', 'PROC-F001-20251120-002', 'F001-PT002', 200, 195, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 97.50, 'A', '冷冻虾仁加工完成', NOW(), NOW()),
(3003, 'F001', 'PROC-F001-20251121-001', 'F001-PT003', 250, 240, '公斤', 'IN_PROGRESS', '2025-11-21', NULL, 0, NULL, '冷冻鱼块加工中，进度70%', NOW(), NOW()),
(3004, 'F001', 'PROC-F001-20251122-001', 'F001-PT004', 200, 0, '公斤', 'PENDING', '2025-11-22', NULL, 0, NULL, '冷冻带鱼段加工待开始', NOW(), NOW()),

-- F002 肉制品加工
(3005, 'F002', 'PROC-F002-20251120-001', 'F002-PT001', 300, 285, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 95.00, 'A', '腌制鸡肉加工完成', NOW(), NOW()),
(3006, 'F002', 'PROC-F002-20251120-002', 'F002-PT002', 250, 240, '公斤', 'IN_PROGRESS', '2025-11-20', NULL, 0, NULL, '烟熏猪肉加工中，进度60%', NOW(), NOW()),
(3007, 'F002', 'PROC-F002-20251121-001', 'F002-PT003', 150, 0, '罐', 'PENDING', '2025-11-21', NULL, 0, NULL, '午餐肉罐头待加工', NOW(), NOW()),
(3008, 'F002', 'PROC-F002-20251122-001', 'F002-PT004', 100, 0, '公斤', 'PENDING', '2025-11-22', NULL, 0, NULL, '肉类香肠待加工', NOW(), NOW()),

-- F003 果蔬加工
(3009, 'F003', 'PROC-F003-20251120-001', 'F003-PT001', 400, 400, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 100.00, 'A', '速冻混合蔬菜加工完成', NOW(), NOW()),
(3010, 'F003', 'PROC-F003-20251120-002', 'F003-PT002', 200, 200, '升', 'COMPLETED', '2025-11-20', '2025-11-20', 100.00, 'A', '新鲜果汁加工完成', NOW(), NOW()),
(3011, 'F003', 'PROC-F003-20251121-001', 'F003-PT003', 300, 150, '罐', 'IN_PROGRESS', '2025-11-21', NULL, 0, NULL, '蔬菜罐头加工中，进度50%', NOW(), NOW()),
(3012, 'F003', 'PROC-F003-20251122-001', 'F003-PT004', 250, 0, '公斤', 'PENDING', '2025-11-22', NULL, 0, NULL, '速冻水果粒待加工', NOW(), NOW());

-- ============================================================
-- 第4部分: 生产批次 (Production Batches)
-- ============================================================
INSERT IGNORE INTO production_batches (id, factory_id, batch_number, product_type_id, production_plan_id, planned_quantity, actual_quantity, unit, status, start_date, completion_date, efficiency, quality_grade, supervisor_id, notes, created_at, updated_at) VALUES
-- F001 生产批次
(4001, 'F001', 'PROD-F001-20251120-001', 'F001-PT001', 1001, 300, 290, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 96.67, 'A', 1, '冷冻鱼片生产完成', NOW(), NOW()),
(4002, 'F001', 'PROD-F001-20251120-002', 'F001-PT002', 1001, 200, 195, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 97.50, 'A', 1, '冷冻虾仁生产完成', NOW(), NOW()),
(4003, 'F001', 'PROD-F001-20251121-001', 'F001-PT003', 1001, 250, 120, '公斤', 'IN_PROGRESS', '2025-11-21', NULL, 48.00, NULL, 1, '冷冻鱼块生产中', NOW(), NOW()),

-- F002 生产批次
(4004, 'F002', 'PROD-F002-20251120-001', 'F002-PT001', 1003, 300, 285, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 95.00, 'A', 1, '腌制鸡肉生产完成', NOW(), NOW()),
(4005, 'F002', 'PROD-F002-20251120-002', 'F002-PT002', 1003, 250, 150, '公斤', 'IN_PROGRESS', '2025-11-20', NULL, 60.00, NULL, 1, '烟熏猪肉生产中', NOW(), NOW()),

-- F003 生产批次
(4006, 'F003', 'PROD-F003-20251120-001', 'F003-PT001', 1005, 400, 400, '公斤', 'COMPLETED', '2025-11-20', '2025-11-20', 100.00, 'A', 1, '速冻混合蔬菜生产完成', NOW(), NOW()),
(4007, 'F003', 'PROD-F003-20251120-002', 'F003-PT002', 1005, 200, 200, '升', 'COMPLETED', '2025-11-20', '2025-11-20', 100.00, 'A', 1, '新鲜果汁生产完成', NOW(), NOW()),
(4008, 'F003', 'PROD-F003-20251121-001', 'F003-PT003', 1005, 300, 150, '罐', 'IN_PROGRESS', '2025-11-21', NULL, 50.00, NULL, 1, '蔬菜罐头生产中', NOW(), NOW());

-- ============================================================
-- 第5部分: 质检记录 (Quality Inspections)
-- ============================================================
INSERT IGNORE INTO quality_inspections (id, factory_id, batch_id, batch_type, inspection_date, inspector_id, quality_grade, temperature, ph_level, microbial_count, appearance_status, notes, passed, created_at, updated_at) VALUES
-- F001 质检
(5001, 'F001', 2001, 'material', '2025-11-20', 1, 'A', 2.5, 6.8, 'low', '新鲜外观良好', '质检合格', 1, NOW(), NOW()),
(5002, 'F001', 2002, 'material', '2025-11-20', 1, 'A', 2.0, 6.9, 'low', '虾仁色泽正常', '质检合格', 1, NOW(), NOW()),
(5003, 'F001', 3001, 'processing', '2025-11-20', 1, 'A', -18.0, 7.0, 'very low', '冷冻效果优秀', '加工质检合格', 1, NOW(), NOW()),
(5004, 'F001', 3002, 'processing', '2025-11-20', 1, 'A', -18.5, 6.9, 'very low', '虾仁冷冻均匀', '加工质检合格', 1, NOW(), NOW()),

-- F002 质检
(5005, 'F002', 2005, 'material', '2025-11-20', 1, 'A', 2.0, 6.5, 'low', '鸡肉新鲜度好', '质检合格', 1, NOW(), NOW()),
(5006, 'F002', 2006, 'material', '2025-11-20', 1, 'A', -18.0, 7.0, 'low', '猪肉冷冻状态佳', '质检合格', 1, NOW(), NOW()),
(5007, 'F002', 3005, 'processing', '2025-11-20', 1, 'A', 5.0, 6.8, 'low', '腌制均匀', '加工质检合格', 1, NOW(), NOW()),
(5008, 'F002', 3006, 'processing', '2025-11-20', 1, 'A', 15.0, 6.9, 'very low', '烟熏香气充足', '加工质检进行中', 1, NOW(), NOW()),

-- F003 质检
(5009, 'F003', 2009, 'material', '2025-11-20', 1, 'A', 4.0, 5.8, 'low', '叶菜新鲜', '质检合格', 1, NOW(), NOW()),
(5010, 'F003', 2010, 'material', '2025-11-20', 1, 'A', 5.0, 5.9, 'low', '水果饱满', '质检合格', 1, NOW(), NOW()),
(5011, 'F003', 3009, 'processing', '2025-11-20', 1, 'A', -18.0, 6.0, 'very low', '速冻效果好', '加工质检合格', 1, NOW(), NOW()),
(5012, 'F003', 3010, 'processing', '2025-11-20', 1, 'A', 5.0, 4.5, 'low', '果汁清澈', '加工质检合格', 1, NOW(), NOW());

-- ============================================================
-- 第6部分: 设备 (Equipment)
-- ============================================================
INSERT IGNORE INTO equipment (id, factory_id, name, code, equipment_type, location, status, installation_date, maintenance_date, notes, created_at, updated_at) VALUES
-- F001 设备
(6001, 'F001', '冷库1号', 'FREEZER-F001-001', '冷冻设备', '冷冻-B-01', 'active', '2023-01-15', '2025-11-10', '海鲜冷冻库，-18℃', NOW(), NOW()),
(6002, 'F001', '冷库2号', 'FREEZER-F001-002', '冷冻设备', '冷冻-B-02', 'active', '2023-02-20', '2025-11-08', '备用冷冻库', NOW(), NOW()),
(6003, 'F001', '加工流水线A', 'PROCESS-F001-001', '加工设备', '加工-D-01', 'active', '2023-05-10', '2025-11-15', '鱼片加工流水线', NOW(), NOW()),
(6004, 'F001', '真空包装机', 'VACUUM-F001-001', '包装设备', '包装-E-01', 'active', '2023-06-01', '2025-11-12', '真空包装机', NOW(), NOW()),

-- F002 设备
(6005, 'F002', '腌制池1号', 'CURING-F002-001', '腌制设备', '腌制-D-01', 'active', '2023-03-15', '2025-11-10', '大型腌制池，50吨', NOW(), NOW()),
(6006, 'F002', '烟熏房', 'SMOKE-F002-001', '烟熏设备', '烟熏-D-02', 'active', '2023-04-20', '2025-11-08', '烟熏房，可控温度', NOW(), NOW()),
(6007, 'F002', '灌装机', 'CANNING-F002-001', '罐装设备', '罐装-E-01', 'active', '2023-07-10', '2025-11-14', '罐头灌装机，50罐/分', NOW(), NOW()),

-- F003 设备
(6008, 'F003', '清洗机', 'WASH-F003-001', '清洗设备', '清洗-C-01', 'active', '2023-02-15', '2025-11-11', '蔬果清洗机', NOW(), NOW()),
(6009, 'F003', '冷冻机1号', 'FREEZE-F003-001', '冷冻设备', '冷冻-C-02', 'active', '2023-03-20', '2025-11-13', '蔬菜速冻机', NOW(), NOW()),
(6010, 'F003', '榨汁机', 'JUICE-F003-001', '榨汁设备', '榨汁-D-01', 'active', '2023-08-01', '2025-11-09', '大型榨汁机，日产500升', NOW(), NOW());

-- ============================================================
-- 第7部分: 设备告警 (Equipment Alerts)
-- ============================================================
INSERT IGNORE INTO equipment_alerts (id, factory_id, equipment_id, alert_type, level, description, status, detected_at, resolved_at, notes, created_at, updated_at) VALUES
(7001, 'F001', 6001, 'TEMPERATURE_ABNORMAL', 'WARNING', '冷库温度略高于设置温度', 'active', '2025-11-21 08:30:00', NULL, '温度升高1℃，需要检查压缩机', NOW(), NOW()),
(7002, 'F001', 6003, 'MAINTENANCE_DUE', 'INFO', '加工流水线需要保养', 'active', '2025-11-21', NULL, '距离上次保养已30天', NOW(), NOW()),
(7003, 'F002', 6005, 'OPERATION_ABNORMAL', 'WARNING', '腌制池液位过高', 'resolved', '2025-11-20 14:00:00', '2025-11-20 15:30:00', '已调整液位', NOW(), NOW()),
(7004, 'F003', 6008, 'MOTOR_FAULT', 'ERROR', '清洗机电机故障', 'active', '2025-11-21 09:15:00', NULL, '电机声音异常，需要更换', NOW(), NOW());

-- ============================================================
-- 第8部分: 工作类型 (Work Types)
-- ============================================================
INSERT IGNORE INTO work_types (id, factory_id, name, code, description, is_active, created_at, updated_at) VALUES
(8001, 'F001', '原料接收', 'WT-RECEIVE', '原料到厂后的接收和入库', 1, NOW(), NOW()),
(8002, 'F001', '原料检验', 'WT-INSPECT', '原料的质量检验', 1, NOW(), NOW()),
(8003, 'F001', '加工处理', 'WT-PROCESS', '原料加工成产品', 1, NOW(), NOW()),
(8004, 'F001', '产品打包', 'WT-PACKAGE', '产品的包装和标签', 1, NOW(), NOW()),
(8005, 'F001', '产品存储', 'WT-STORAGE', '产品的冷库存储', 1, NOW(), NOW()),
(8006, 'F002', '原料采购', 'WT-PROCURE', '畜禽产品采购', 1, NOW(), NOW()),
(8007, 'F002', '腌制加工', 'WT-CURING', '肉制品腌制处理', 1, NOW(), NOW()),
(8008, 'F002', '烟熏加工', 'WT-SMOKING', '肉制品烟熏处理', 1, NOW(), NOW()),
(8009, 'F003', '蔬果清洗', 'WT-WASH', '蔬果的清洗处理', 1, NOW(), NOW()),
(8010, 'F003', '冷冻加工', 'WT-FREEZE', '蔬果的冷冻处理', 1, NOW(), NOW());

-- ============================================================
-- 第9部分: 工厂设置 (Factory Settings)
-- ============================================================
INSERT IGNORE INTO factory_settings (id, factory_id, setting_key, setting_value, description, created_at, updated_at) VALUES
(9001, 'F001', 'cold_chain_temp', '-18', '冷链存储温度（℃）', NOW(), NOW()),
(9002, 'F001', 'cold_chain_humidity', '40-60', '冷链存储湿度范围（%）', NOW(), NOW()),
(9003, 'F001', 'max_storage_days', '365', '最长冷冻存储期限（天）', NOW(), NOW()),
(9004, 'F002', 'curing_duration', '7-14', '腌制时间（天）', NOW(), NOW()),
(9005, 'F002', 'curing_temperature', '5', '腌制温度（℃）', NOW(), NOW()),
(9006, 'F002', 'smoking_temperature', '60-80', '烟熏温度范围（℃）', NOW(), NOW()),
(9007, 'F003', 'freeze_temperature', '-18', '速冻温度（℃）', NOW(), NOW()),
(9008, 'F003', 'wash_water_temp', '15-20', '清洗水温范围（℃）', NOW(), NOW()),
(9009, 'F003', 'juice_ph', '3.5-4.5', '果汁pH值范围', NOW(), NOW());

-- ============================================================
-- 第10部分: 验证所有数据
-- ============================================================
SELECT '==================== 完整业务数据导入验证 ====================' AS '';
SELECT '' AS '';

SELECT '✅ 工厂1 (F001 - 海鲜冷冻加工)' AS Category;
SELECT
  CONCAT('产品类型: ', (SELECT COUNT(*) FROM product_types WHERE factory_id='F001')) AS info,
  CONCAT('原料类型: ', (SELECT COUNT(*) FROM raw_material_types WHERE factory_id='F001')) AS info2,
  CONCAT('原料批次: ', (SELECT COUNT(*) FROM material_batches WHERE factory_id='F001')) AS info3,
  CONCAT('加工批次: ', (SELECT COUNT(*) FROM processing_batches WHERE factory_id='F001')) AS info4,
  CONCAT('生产批次: ', (SELECT COUNT(*) FROM production_batches WHERE factory_id='F001')) AS info5;

SELECT '' AS '';
SELECT '✅ 工厂2 (F002 - 肉制品深加工)' AS Category;
SELECT
  CONCAT('产品类型: ', (SELECT COUNT(*) FROM product_types WHERE factory_id='F002')) AS info,
  CONCAT('原料类型: ', (SELECT COUNT(*) FROM raw_material_types WHERE factory_id='F002')) AS info2,
  CONCAT('原料批次: ', (SELECT COUNT(*) FROM material_batches WHERE factory_id='F002')) AS info3,
  CONCAT('加工批次: ', (SELECT COUNT(*) FROM processing_batches WHERE factory_id='F002')) AS info4,
  CONCAT('生产批次: ', (SELECT COUNT(*) FROM production_batches WHERE factory_id='F002')) AS info5;

SELECT '' AS '';
SELECT '✅ 工厂3 (F003 - 果蔬加工)' AS Category;
SELECT
  CONCAT('产品类型: ', (SELECT COUNT(*) FROM product_types WHERE factory_id='F003')) AS info,
  CONCAT('原料类型: ', (SELECT COUNT(*) FROM raw_material_types WHERE factory_id='F003')) AS info2,
  CONCAT('原料批次: ', (SELECT COUNT(*) FROM material_batches WHERE factory_id='F003')) AS info3,
  CONCAT('加工批次: ', (SELECT COUNT(*) FROM processing_batches WHERE factory_id='F003')) AS info4,
  CONCAT('生产批次: ', (SELECT COUNT(*) FROM production_batches WHERE factory_id='F003')) AS info5;

SELECT '' AS '';
SELECT '==================== 核心业务表统计 ====================' AS '';
SELECT
  (SELECT COUNT(*) FROM production_plans) AS 生产计划数,
  (SELECT COUNT(*) FROM material_batches) AS 原料批次数,
  (SELECT COUNT(*) FROM processing_batches) AS 加工批次数,
  (SELECT COUNT(*) FROM production_batches) AS 生产批次数,
  (SELECT COUNT(*) FROM quality_inspections) AS 质检记录数,
  (SELECT COUNT(*) FROM equipment) AS 设备数,
  (SELECT COUNT(*) FROM equipment_alerts) AS 设备告警数,
  (SELECT COUNT(*) FROM work_types) AS 工作类型数;

SELECT '' AS '';
SELECT '==================== 完整业务数据导入成功！====================' AS Status;
