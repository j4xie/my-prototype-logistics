-- ============================================================
-- 完整业务测试数据脚本 - 修复版本 (Fixed Complete Business Data)
-- ============================================================
-- 日期: 2025-11-22
-- 数据库: cretas_db
-- 用途: 根据实际JPA实体类的列名插入完整的业务测试数据
-- 基于后端entity类的列名映射，修复所有列名错误
-- ============================================================

USE cretas_db;

-- ============================================================
-- 第1部分: 生产计划 (Production Plans)
-- 根据 ProductionPlan.java 的列名
-- ============================================================
INSERT IGNORE INTO production_plans (
  id, factory_id, plan_number, product_type_id,
  planned_quantity, actual_quantity,
  start_time, end_time, status,
  customer_order_number, priority, notes,
  estimated_material_cost, estimated_labor_cost,
  estimated_equipment_cost, estimated_other_cost,
  created_by, created_at, updated_at
) VALUES
-- F001: 海鲜冷冻加工厂
('PLAN-F001-001', 'F001', 'PLAN-2025-001', 'PT001', 100.00, 95.00, '2025-11-20 08:00:00', '2025-11-20 16:00:00', 'COMPLETED', 'ORD-001', 1, '冷冻鱼片生产计划', 500.00, 300.00, 200.00, 50.00, 1, NOW(), NOW()),
('PLAN-F001-002', 'F001', 'PLAN-2025-002', 'PT002', 80.00, 76.00, '2025-11-21 08:00:00', '2025-11-21 16:00:00', 'IN_PROGRESS', 'ORD-002', 2, '冷冻虾仁生产计划', 600.00, 250.00, 180.00, 40.00, 1, NOW(), NOW()),
('PLAN-F001-003', 'F001', 'PLAN-2025-003', 'PT003', 120.00, NULL, '2025-11-22 08:00:00', NULL, 'PENDING', 'ORD-003', 3, '冷冻鱼块生产计划', 450.00, 280.00, 150.00, 45.00, 1, NOW(), NOW()),

-- F002: 肉制品深加工厂
('PLAN-F002-001', 'F002', 'PLAN-2025-004', 'PT004', 150.00, 140.00, '2025-11-20 09:00:00', '2025-11-20 17:00:00', 'COMPLETED', 'ORD-004', 1, '冷冻鸡肉加工计划', 700.00, 350.00, 250.00, 100.00, 18, NOW(), NOW()),
('PLAN-F002-002', 'F002', 'PLAN-2025-005', 'PT004', 200.00, NULL, '2025-11-21 09:00:00', NULL, 'PENDING', 'ORD-005', 2, '大批量鸡肉加工', 900.00, 400.00, 300.00, 120.00, 18, NOW(), NOW()),

-- F003: 果蔬加工厂
('PLAN-F003-001', 'F003', 'PLAN-2025-006', 'PT005', 300.00, 285.00, '2025-11-20 10:00:00', '2025-11-20 18:00:00', 'COMPLETED', 'ORD-006', 1, '速冻蔬菜加工计划', 400.00, 200.00, 150.00, 50.00, 1, NOW(), NOW());

-- ============================================================
-- 第2部分: 原料批次 (Material Batches)
-- 根据 MaterialBatch.java 的列名
-- ============================================================
INSERT IGNORE INTO material_batches (
  id, factory_id, batch_number, material_type_id, supplier_id,
  inbound_date, purchase_date, expire_date,
  receipt_quantity, quantity_unit, weight_per_unit,
  used_quantity, reserved_quantity, unit_price,
  status, storage_location, quality_certificate, notes,
  created_by, created_at, updated_at
) VALUES
-- F001: 海鲜冷冻加工厂 - 原料批次
('MAT-F001-001', 'F001', 'MAT-2025-001', 'RMT001', 100, '2025-11-20', '2025-11-19', '2025-11-23', 500.00, '公斤', 2.50, 100.00, 50.00, 15.00, 'AVAILABLE', 'A1-001', 'CERT-001', '鲜活鱼，质量良好', 1, NOW(), NOW()),
('MAT-F001-002', 'F001', 'MAT-2025-002', 'RMT002', 100, '2025-11-20', '2025-11-15', '2025-12-20', 1000.00, '公斤', 0.50, 200.00, 100.00, 18.00, 'AVAILABLE', 'A1-002', 'CERT-002', '冷冻虾，质量优良', 1, NOW(), NOW()),
('MAT-F001-003', 'F001', 'MAT-2025-003', 'RMT004', 103, '2025-11-21', '2025-11-21', '2026-11-21', 200.00, '公斤', 1.00, 50.00, 20.00, 5.00, 'AVAILABLE', 'A1-003', 'CERT-003', '食盐，保存期长', 1, NOW(), NOW()),
('MAT-F001-004', 'F001', 'MAT-2025-004', 'RMT005', 102, '2025-11-21', '2025-11-21', '2025-11-26', 300.00, '公斤', 0.75, 80.00, 40.00, 8.00, 'AVAILABLE', 'A1-004', 'CERT-004', '新鲜蔬菜', 1, NOW(), NOW()),

-- F002: 肉制品深加工厂 - 原料批次
('MAT-F002-001', 'F002', 'MAT-2025-005', 'RMT003', 101, '2025-11-20', '2025-11-19', '2025-11-27', 800.00, '公斤', 1.00, 150.00, 100.00, 25.00, 'AVAILABLE', 'B1-001', 'CERT-005', '鲜鸡肉，冷藏保存', 18, NOW(), NOW()),
('MAT-F002-002', 'F002', 'MAT-2025-006', 'RMT004', 103, '2025-11-21', '2025-11-21', '2026-11-21', 300.00, '公斤', 1.00, 50.00, 30.00, 5.00, 'AVAILABLE', 'B1-002', 'CERT-006', '食盐，调味用', 18, NOW(), NOW()),

-- F003: 果蔬加工厂 - 原料批次
('MAT-F003-001', 'F003', 'MAT-2025-007', 'RMT005', 102, '2025-11-20', '2025-11-20', '2025-11-25', 1200.00, '公斤', 0.50, 300.00, 200.00, 6.00, 'AVAILABLE', 'C1-001', 'CERT-007', '新鲜蔬菜混合', 1, NOW(), NOW()),
('MAT-F003-002', 'F003', 'MAT-2025-008', 'RMT005', 102, '2025-11-21', '2025-11-21', '2025-11-26', 800.00, '公斤', 0.50, 200.00, 100.00, 6.00, 'AVAILABLE', 'C1-002', 'CERT-008', '新鲜蔬菜', 1, NOW(), NOW());

-- ============================================================
-- 第3部分: 加工批次 (Processing Batches)
-- 根据 ProcessingBatch.java 的列名
-- ============================================================
INSERT IGNORE INTO processing_batches (
  id, factory_id, batch_number, product_name, product_type,
  quantity, actual_quantity, unit,
  start_time, end_time, status, supervisor_id,
  material_cost, labor_cost, equipment_cost, other_cost, total_cost,
  production_efficiency, notes,
  created_at, updated_at
) VALUES
-- F001: 海鲜冷冻加工厂
('PROC-F001-001', 'F001', 'PROC-2025-001', '冷冻鱼片', 'PT001', 100.00, 95.00, '公斤', '2025-11-20 08:00:00', '2025-11-20 16:00:00', 'completed', 1, 500.00, 300.00, 200.00, 50.00, 1050.00, 95.00, '成功完成，质量优良', NOW(), NOW()),
('PROC-F001-002', 'F001', 'PROC-2025-002', '冷冻虾仁', 'PT002', 80.00, 76.00, '公斤', '2025-11-21 08:00:00', '2025-11-21 16:00:00', 'completed', 1, 600.00, 250.00, 180.00, 40.00, 1070.00, 95.00, '正常加工完成', NOW(), NOW()),
('PROC-F001-003', 'F001', 'PROC-2025-003', '冷冻鱼块', 'PT003', 120.00, NULL, '公斤', '2025-11-22 08:00:00', NULL, 'processing', 1, 450.00, 280.00, 150.00, 45.00, 925.00, NULL, '正在加工中', NOW(), NOW()),

-- F002: 肉制品深加工厂
('PROC-F002-001', 'F002', 'PROC-2025-004', '冷冻鸡肉', 'PT004', 150.00, 140.00, '公斤', '2025-11-20 09:00:00', '2025-11-20 17:00:00', 'completed', 18, 700.00, 350.00, 250.00, 100.00, 1400.00, 93.33, '深加工完成，包装优良', NOW(), NOW()),
('PROC-F002-002', 'F002', 'PROC-2025-005', '鸡肉制品', 'PT004', 200.00, NULL, '公斤', '2025-11-21 09:00:00', NULL, 'pending', 18, 900.00, 400.00, 300.00, 120.00, 1720.00, NULL, '等待开始', NOW(), NOW()),

-- F003: 果蔬加工厂
('PROC-F003-001', 'F003', 'PROC-2025-006', '速冻蔬菜', 'PT005', 300.00, 285.00, '公斤', '2025-11-20 10:00:00', '2025-11-20 18:00:00', 'completed', 1, 400.00, 200.00, 150.00, 50.00, 800.00, 95.00, '速冻蔬菜加工完毕', NOW(), NOW()),
('PROC-F003-002', 'F003', 'PROC-2025-007', '蔬菜混合', 'PT005', 250.00, NULL, '公斤', '2025-11-21 10:00:00', NULL, 'processing', 1, 350.00, 180.00, 120.00, 40.00, 690.00, NULL, '加工中', NOW(), NOW());

-- ============================================================
-- 第4部分: 生产批次 (Production Batches)
-- 根据 ProductionBatch.java 的列名
-- ============================================================
INSERT IGNORE INTO production_batches (
  factory_id, batch_number, production_plan_id, product_type_id,
  product_name, planned_quantity, quantity, unit,
  actual_quantity, good_quantity, defect_quantity,
  status, quality_status,
  start_time, end_time,
  equipment_id, equipment_name, supervisor_id, supervisor_name,
  worker_count, work_duration_minutes,
  material_cost, labor_cost, equipment_cost, other_cost, total_cost,
  unit_cost, yield_rate, efficiency, notes,
  created_by, created_at, updated_at
) VALUES
-- F001: 海鲜冷冻加工厂
('F001', 'BATCH-F001-001', 1, 1, '冷冻鱼片', 100.00, 100.00, '公斤', 95.00, 90.00, 5.00, 'COMPLETED', 'PASSED', '2025-11-20 08:00:00', '2025-11-20 16:00:00', 1, '冷冻线1号', 1, '张三', 8, 480, 500.00, 300.00, 200.00, 50.00, 1050.00, 11.05, 94.74, 95.00, '优质产品', 1, NOW(), NOW()),
('F001', 'BATCH-F001-002', 2, 2, '冷冻虾仁', 80.00, 80.00, '公斤', 76.00, 73.00, 3.00, 'COMPLETED', 'PASSED', '2025-11-21 08:00:00', '2025-11-21 16:00:00', 1, '冷冻线1号', 1, '张三', 8, 480, 600.00, 250.00, 180.00, 40.00, 1070.00, 14.08, 96.05, 95.00, '产品优良', 1, NOW(), NOW()),
('F001', 'BATCH-F001-003', 3, 3, '冷冻鱼块', 120.00, 120.00, '公斤', NULL, NULL, NULL, 'IN_PROGRESS', 'PENDING_INSPECTION', '2025-11-22 08:00:00', NULL, 1, '冷冻线1号', 1, '张三', 8, NULL, 450.00, 280.00, 150.00, 45.00, 925.00, NULL, NULL, NULL, '生产中', 1, NOW(), NOW()),

-- F002: 肉制品深加工厂
('F002', 'BATCH-F002-001', 4, 4, '冷冻鸡肉', 150.00, 150.00, '公斤', 140.00, 135.00, 5.00, 'COMPLETED', 'PASSED', '2025-11-20 09:00:00', '2025-11-20 17:00:00', 2, '加工线2号', 18, '李四', 10, 480, 700.00, 350.00, 250.00, 100.00, 1400.00, 10.00, 96.43, 93.33, '深加工完美', 18, NOW(), NOW()),
('F002', 'BATCH-F002-002', 5, 4, '鸡肉制品', 200.00, 200.00, '公斤', NULL, NULL, NULL, 'PLANNED', 'PENDING_INSPECTION', '2025-11-21 09:00:00', NULL, 2, '加工线2号', 18, '李四', 10, NULL, 900.00, 400.00, 300.00, 120.00, 1720.00, NULL, NULL, NULL, '待生产', 18, NOW(), NOW()),

-- F003: 果蔬加工厂
('F003', 'BATCH-F003-001', 6, 5, '速冻蔬菜', 300.00, 300.00, '公斤', 285.00, 275.00, 10.00, 'COMPLETED', 'PASSED', '2025-11-20 10:00:00', '2025-11-20 18:00:00', 3, '速冻线3号', 1, '王五', 6, 480, 400.00, 200.00, 150.00, 50.00, 800.00, 2.81, 96.49, 95.00, '速冻优质品', 1, NOW(), NOW()),
('F003', 'BATCH-F003-002', 6, 5, '蔬菜混合', 250.00, 250.00, '公斤', NULL, NULL, NULL, 'IN_PROGRESS', 'PENDING_INSPECTION', '2025-11-21 10:00:00', NULL, 3, '速冻线3号', 1, '王五', 6, NULL, 350.00, 180.00, 120.00, 40.00, 690.00, NULL, NULL, NULL, '加工中', 1, NOW(), NOW());

-- ============================================================
-- 第5部分: 质量检验 (Quality Inspections)
-- 根据 QualityInspection.java 的列名
-- ============================================================
INSERT IGNORE INTO quality_inspections (
  id, factory_id, production_batch_id, inspector_id,
  inspection_date, sample_size, pass_count, fail_count,
  pass_rate, result, notes,
  created_at, updated_at
) VALUES
-- F001: 海鲜冷冻加工厂
('INSP-F001-001', 'F001', '1', 1, '2025-11-20', 50.00, 48.00, 2.00, 96.00, 'PASS', '冷冻鱼片质检通过', NOW(), NOW()),
('INSP-F001-002', 'F001', '2', 1, '2025-11-21', 40.00, 39.00, 1.00, 97.50, 'PASS', '冷冻虾仁质检通过', NOW(), NOW()),
('INSP-F001-003', 'F001', '3', 1, '2025-11-22', 60.00, NULL, NULL, NULL, NULL, '冷冻鱼块检验进行中', NOW(), NOW()),

-- F002: 肉制品深加工厂
('INSP-F002-001', 'F002', '4', 18, '2025-11-20', 75.00, 72.00, 3.00, 96.00, 'PASS', '冷冻鸡肉质检通过', NOW(), NOW()),
('INSP-F002-002', 'F002', '5', 18, '2025-11-21', 100.00, NULL, NULL, NULL, NULL, '鸡肉制品待检', NOW(), NOW()),

-- F003: 果蔬加工厂
('INSP-F003-001', 'F003', '6', 1, '2025-11-20', 150.00, 145.00, 5.00, 96.67, 'PASS', '速冻蔬菜质检通过', NOW(), NOW()),
('INSP-F003-002', 'F003', '7', 1, '2025-11-21', 125.00, NULL, NULL, NULL, NULL, '蔬菜混合检验中', NOW(), NOW());

-- ============================================================
-- 第6部分: 设备 (Equipment)
-- 根据 Equipment.java 的列名
-- ============================================================
INSERT IGNORE INTO equipment (
  factory_id, code, name, category, model, manufacturer,
  purchase_date, purchase_price, status, location,
  total_operating_hours, last_maintenance_date, next_maintenance_date,
  maintenance_interval_days, maintenance_notes,
  is_active, notes,
  created_at, updated_at
) VALUES
-- F001: 海鲜冷冻加工厂
('F001', 'EQ-F001-001', '冷冻线1号', '冷冻设备', 'Model-FZ-100', '日本富士制冷', '2024-01-15', 180000.00, 'IDLE', 'A区1号位置', 2400, '2025-11-10', '2025-12-10', 30, '定期润滑保养', 1, '主要生产设备', NOW(), NOW()),
('F001', 'EQ-F001-002', '包装机1号', '包装设备', 'Model-PKG-50', '德国博世', '2024-03-20', 120000.00, 'IDLE', 'A区2号位置', 1800, '2025-10-15', '2025-11-15', 30, '检查传送带', 1, '自动包装机', NOW(), NOW()),
('F001', 'EQ-F001-003', '称重机1号', '测量设备', 'Model-WS-200', '中国衡泰', '2023-06-10', 30000.00, 'IDLE', 'A区3号位置', 3000, '2025-11-05', '2025-12-05', 30, '校准砝码', 1, '精准称重', NOW(), NOW()),

-- F002: 肉制品深加工厂
('F002', 'EQ-F002-001', '加工线2号', '加工设备', 'Model-PROC-200', '德国机械', '2024-02-10', 250000.00, 'IDLE', 'B区1号位置', 2000, '2025-11-08', '2025-12-08', 30, '定期检查刀具', 1, '主要加工设备', NOW(), NOW()),
('F002', 'EQ-F002-002', '冷藏柜1号', '冷藏设备', 'Model-CL-500', '日本大金', '2024-04-15', 80000.00, 'IDLE', 'B区2号位置', 1500, '2025-11-12', '2025-12-12', 30, '清洁风道', 1, '温度控制：-18℃', NOW(), NOW()),

-- F003: 果蔬加工厂
('F003', 'EQ-F003-001', '速冻线3号', '速冻设备', 'Model-QF-300', '意大利科技', '2023-09-20', 200000.00, 'IDLE', 'C区1号位置', 2800, '2025-11-06', '2025-12-06', 30, '液氮补充检查', 1, '液氮速冻', NOW(), NOW()),
('F003', 'EQ-F003-002', '分选机1号', '分选设备', 'Model-SEL-100', '中国机械', '2024-05-01', 60000.00, 'IDLE', 'C区2号位置', 1200, '2025-11-09', '2025-12-09', 30, '清洁传感器', 1, '自动分选', NOW(), NOW());

-- ============================================================
-- 第7部分: 设备告警 (Equipment Alerts)
-- 根据 EquipmentAlert.java 的列名
-- ============================================================
INSERT IGNORE INTO equipment_alerts (
  factory_id, equipment_id, alert_type, level, status,
  message, details, triggered_at,
  acknowledged_at, acknowledged_by, acknowledged_by_name,
  resolved_at, resolved_by, resolved_by_name, resolution_notes,
  ignored_at, ignored_by, ignored_by_name, ignore_reason,
  created_at, updated_at
) VALUES
-- F001: 海鲜冷冻加工厂
('F001', '1', '维护提醒', 'WARNING', 'ACTIVE', '冷冻线1号即将进行定期维护', '运行时长已达2400小时，建议进行保养', '2025-11-20 09:30:00', '2025-11-20 10:00:00', 1, '张三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW()),
('F001', '2', '部件更换', 'INFO', 'ACTIVE', '包装机1号传送带需要检查', '已运行1800小时，传送带磨损中等', '2025-11-19 14:20:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW()),

-- F002: 肉制品深加工厂
('F002', '4', '维护提醒', 'WARNING', 'ACTIVE', '加工线2号需要定期检查刀具', '运行2000小时，刀具磨损需要更新', '2025-11-21 11:00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW()),

-- F003: 果蔬加工厂
('F003', '5', '保修到期', 'ERROR', 'ACTIVE', '速冻线3号保修即将到期', '购买时间2023-09-20，保修期2年即将到期', '2025-11-15 08:00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());

-- ============================================================
-- 第8部分: 工作类型 (Work Types)
-- ============================================================
INSERT IGNORE INTO work_types (
  id, factory_id, name, code, description, is_active,
  created_at, updated_at
) VALUES
('WT-001', 'F001', '冷冻加工', 'FREEZING', '鱼类和海鲜的冷冻加工', 1, NOW(), NOW()),
('WT-002', 'F001', '包装装箱', 'PACKAGING', '产品包装和装箱', 1, NOW(), NOW()),
('WT-003', 'F002', '肉类深加工', 'MEAT_PROCESS', '肉制品的深层加工', 1, NOW(), NOW()),
('WT-004', 'F002', '腌制处理', 'CURING', '肉类腌制处理', 1, NOW(), NOW()),
('WT-005', 'F003', '蔬菜清洗', 'WASHING', '新鲜蔬菜清洗', 1, NOW(), NOW()),
('WT-006', 'F003', '速冻处理', 'QUICK_FREEZE', '蔬菜速冻处理', 1, NOW(), NOW()),
('WT-007', 'F001', '质量检验', 'QUALITY_CHECK', '产品质量检验', 1, NOW(), NOW()),
('WT-008', 'F002', '规格分类', 'SORTING', '产品规格分类', 1, NOW(), NOW()),
('WT-009', 'F003', '分级处理', 'GRADING', '蔬菜分级处理', 1, NOW(), NOW()),
('WT-010', 'F001', '设备维护', 'MAINTENANCE', '生产设备维护', 1, NOW(), NOW());

-- ============================================================
-- 第9部分: 工厂设置 (Factory Settings)
-- 根据 FactorySettings.java 的列名
-- ============================================================
INSERT IGNORE INTO factory_settings (
  factory_id, ai_settings, ai_weekly_quota,
  allow_self_registration, require_admin_approval, default_user_role,
  notification_settings, work_time_settings, production_settings,
  inventory_settings, data_retention_settings,
  language, timezone, date_format, currency,
  enable_qr_code, enable_batch_management, enable_quality_check,
  enable_cost_calculation, enable_equipment_management, enable_attendance,
  created_by, created_at, updated_at
) VALUES
('F001',
  '{"enabled": true, "tone": "technical", "goal": "cost_optimization", "detailLevel": "detailed"}',
  20,
  0, 1, 'operator',
  '{"email": true, "sms": true, "push": true, "wechat": false}',
  '{"startTime": "08:00", "endTime": "17:00", "workDays": ["MON", "TUE", "WED", "THU", "FRI"]}',
  '{"defaultBatchSize": 100, "qualityCheckFrequency": "every_batch", "autoApprovalThreshold": 50}',
  '{"minStockAlert": 50, "maxStockLimit": 1000, "autoReorderPoint": 100}',
  '{"logRetentionDays": 90, "dataArchiveDays": 365, "backupFrequency": "daily"}',
  'zh-CN', 'Asia/Shanghai', 'yyyy-MM-dd', 'CNY',
  1, 1, 1, 1, 1, 1,
  1, NOW(), NOW()),

('F002',
  '{"enabled": true, "tone": "formal", "goal": "quality_first", "detailLevel": "comprehensive"}',
  25,
  0, 1, 'operator',
  '{"email": true, "sms": true, "push": true, "wechat": false}',
  '{"startTime": "09:00", "endTime": "18:00", "workDays": ["MON", "TUE", "WED", "THU", "FRI"]}',
  '{"defaultBatchSize": 150, "qualityCheckFrequency": "every_batch", "autoApprovalThreshold": 50}',
  '{"minStockAlert": 100, "maxStockLimit": 2000, "autoReorderPoint": 200}',
  '{"logRetentionDays": 120, "dataArchiveDays": 365, "backupFrequency": "daily"}',
  'zh-CN', 'Asia/Shanghai', 'yyyy-MM-dd', 'CNY',
  1, 1, 1, 1, 1, 1,
  1, NOW(), NOW()),

('F003',
  '{"enabled": true, "tone": "friendly", "goal": "sustainability", "detailLevel": "moderate"}',
  20,
  0, 1, 'operator',
  '{"email": true, "sms": true, "push": true, "wechat": false}',
  '{"startTime": "07:00", "endTime": "16:00", "workDays": ["MON", "TUE", "WED", "THU", "FRI"]}',
  '{"defaultBatchSize": 200, "qualityCheckFrequency": "every_batch", "autoApprovalThreshold": 50}',
  '{"minStockAlert": 100, "maxStockLimit": 1500, "autoReorderPoint": 150}',
  '{"logRetentionDays": 90, "dataArchiveDays": 365, "backupFrequency": "daily"}',
  'zh-CN', 'Asia/Shanghai', 'yyyy-MM-dd', 'CNY',
  1, 1, 1, 1, 1, 1,
  1, NOW(), NOW());

-- ============================================================
-- 第10部分: 验证数据
-- ============================================================
SELECT '✅ 生产计划' AS Category;
SELECT COUNT(*) AS Count FROM production_plans WHERE factory_id IN ('F001', 'F002', 'F003');

SELECT '✅ 原料批次' AS Category;
SELECT COUNT(*) AS Count FROM material_batches WHERE factory_id IN ('F001', 'F002', 'F003');

SELECT '✅ 加工批次' AS Category;
SELECT COUNT(*) AS Count FROM processing_batches WHERE factory_id IN ('F001', 'F002', 'F003');

SELECT '✅ 生产批次' AS Category;
SELECT COUNT(*) AS Count FROM production_batches WHERE factory_id IN ('F001', 'F002', 'F003');

SELECT '✅ 质量检验' AS Category;
SELECT COUNT(*) AS Count FROM quality_inspections WHERE factory_id IN ('F001', 'F002', 'F003');

SELECT '✅ 设备' AS Category;
SELECT COUNT(*) AS Count FROM equipment WHERE factory_id IN ('F001', 'F002', 'F003');

SELECT '✅ 设备告警' AS Category;
SELECT COUNT(*) AS Count FROM equipment_alerts WHERE factory_id IN ('F001', 'F002', 'F003');

SELECT '✅ 工作类型' AS Category;
SELECT COUNT(*) AS Count FROM work_types WHERE factory_id IN ('F001', 'F002', 'F003');

SELECT '✅ 工厂设置' AS Category;
SELECT COUNT(*) AS Count FROM factory_settings WHERE factory_id IN ('F001', 'F002', 'F003');

SELECT '======================================' AS '';
SELECT '✅ 完整业务数据修复版本导入完成！' AS Status;
SELECT '======================================' AS '';
SELECT '' AS '';
SELECT '📊 数据概览：' AS Summary;
SELECT 'F001（海鲜冷冻加工厂）已插入数据' AS '';
SELECT 'F002（肉制品深加工厂）已插入数据' AS '';
SELECT 'F003（果蔬加工厂）已插入数据' AS '';
