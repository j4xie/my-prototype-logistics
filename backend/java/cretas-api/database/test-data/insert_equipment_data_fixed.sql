-- 为3个工厂添加设备相关数据（修正版）
-- F001已有3台设备，为F002和F003各添加3台设备
-- 然后为所有工厂添加告警、维护、使用记录

USE cretas;

-- ===== 1. 为F002和F003添加设备（F001已有，跳过）=====
INSERT INTO equipment (factory_id, code, name, category, model, manufacturer, purchase_date, purchase_price, status, location, is_active, created_at, updated_at) VALUES
-- F002的设备
('F002', 'EQ-F002-001', '速冻设备', '冷冻', '型号SF-200', '冷链设备公司', '2024-03-15', 250000.00, 'IDLE', 'B区2号车间', 1, NOW(), NOW()),
('F002', 'EQ-F002-002', '真空包装机', '包装', '型号VP-150', '包装机械厂', '2024-04-20', 180000.00, 'IDLE', 'B区包装车间', 1, NOW(), NOW()),
('F002', 'EQ-F002-003', '切割设备', '加工', '型号CT-300', '食品机械公司', '2024-05-10', 320000.00, 'IDLE', 'B区加工车间', 1, NOW(), NOW()),

-- F003的设备
('F003', 'EQ-F003-001', '冷藏库设备', '冷藏', '型号CR-500', '制冷设备厂', '2024-02-01', 450000.00, 'IDLE', 'C区冷藏室', 1, NOW(), NOW()),
('F003', 'EQ-F003-002', '分拣设备', '分拣', '型号ST-100', '自动化设备公司', '2024-03-25', 280000.00, 'IDLE', 'C区分拣车间', 1, NOW(), NOW()),
('F003', 'EQ-F003-003', '清洗设备', '清洗', '型号WS-200', '食品设备公司', '2024-04-15', 150000.00, 'IDLE', 'C区清洗车间', 1, NOW(), NOW());

-- ===== 2. 为F002和F003添加设备告警（F001已有4条）=====
-- 获取F002设备ID
SET @eq_f002_001 = (SELECT id FROM equipment WHERE code = 'EQ-F002-001' LIMIT 1);
SET @eq_f002_002 = (SELECT id FROM equipment WHERE code = 'EQ-F002-002' LIMIT 1);
SET @eq_f002_003 = (SELECT id FROM equipment WHERE code = 'EQ-F002-003' LIMIT 1);

-- 获取F003设备ID
SET @eq_f003_001 = (SELECT id FROM equipment WHERE code = 'EQ-F003-001' LIMIT 1);
SET @eq_f003_002 = (SELECT id FROM equipment WHERE code = 'EQ-F003-002' LIMIT 1);
SET @eq_f003_003 = (SELECT id FROM equipment WHERE code = 'EQ-F003-003' LIMIT 1);

-- equipment_alerts 表只有这些字段：id, equipment_id, factory_id, alert_type, level, status, message, triggered_at
-- 没有 created_at 和 updated_at
INSERT INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, triggered_at) VALUES
-- F002的告警
('F002', @eq_f002_001, '温度异常', 'WARNING', 'ACTIVE', '速冻设备温度超出正常范围，当前温度-15℃，建议检查制冷系统', '2025-11-20 14:30:00'),
('F002', @eq_f002_002, '维护提醒', 'INFO', 'ACTIVE', '真空包装机已运行2000小时，建议进行例行保养', '2025-11-21 09:00:00'),
('F002', @eq_f002_003, '刀片磨损', 'CRITICAL', 'ACTIVE', '切割设备刀片磨损严重，请立即更换', '2025-11-22 16:45:00'),

-- F003的告警
('F003', @eq_f003_001, '电力异常', 'WARNING', 'ACTIVE', '冷藏库设备电压不稳定，建议检查电路', '2025-11-20 11:20:00'),
('F003', @eq_f003_002, '传感器故障', 'CRITICAL', 'RESOLVED', '分拣设备传感器失灵，已更换', '2025-11-19 08:15:00'),
('F003', @eq_f003_003, '水压不足', 'WARNING', 'ACKNOWLEDGED', '清洗设备水压低于标准值，正在处理', '2025-11-21 13:30:00');

-- ===== 3. 为所有3个工厂添加维护记录 =====
-- 获取F001设备ID
SET @eq_f001_001 = (SELECT id FROM equipment WHERE code = 'EQ-F001-001' LIMIT 1);
SET @eq_f001_002 = (SELECT id FROM equipment WHERE code = 'EQ-F001-002' LIMIT 1);
SET @eq_f001_003 = (SELECT id FROM equipment WHERE code = 'EQ-F001-003' LIMIT 1);

INSERT INTO equipment_maintenance (equipment_id, maintenance_date, maintenance_type, cost, description, next_maintenance_date, created_at, updated_at) VALUES
-- F001设备维护
(@eq_f001_001, '2025-11-10', '定期保养', 3500.00, '更换制冷剂，清洁冷凝器，检查压缩机', '2025-12-10', NOW(), NOW()),
(@eq_f001_002, '2025-10-25', '故障维修', 5200.00, '更换真空泵密封件，调整包装参数', '2025-11-25', NOW(), NOW()),
(@eq_f001_003, '2025-11-05', '定期检查', 2800.00, '检查紫外灯管，更换过滤器，校准温度', '2025-12-05', NOW(), NOW()),

-- F002设备维护
(@eq_f002_001, '2025-10-15', '安装调试', 8000.00, '设备初次安装，系统调试，参数设置', '2025-11-15', NOW(), NOW()),
(@eq_f002_002, '2025-11-08', '定期保养', 4200.00, '清洁真空室，更换密封圈，润滑传动部件', '2025-12-08', NOW(), NOW()),
(@eq_f002_003, '2025-11-15', '刀具更换', 6500.00, '更换切割刀片，调整切割精度，安全检查', '2025-12-15', NOW(), NOW()),

-- F003设备维护
(@eq_f003_001, '2025-09-20', '制冷系统检修', 12000.00, '检修制冷系统，更换冷媒，清洗冷凝器', '2025-10-20', NOW(), NOW()),
(@eq_f003_002, '2025-10-30', '传感器校准', 3800.00, '校准称重传感器，更新分拣程序，精度测试', '2025-11-30', NOW(), NOW()),
(@eq_f003_003, '2025-11-12', '水路清洁', 2500.00, '清洗水路管道，更换喷嘴，检查水泵', '2025-12-12', NOW(), NOW());

-- ===== 4. 为所有3个工厂添加设备使用记录 =====
INSERT INTO equipment_usages (equipment_id, start_time, end_time, duration_hours, operator_id, notes, created_at, updated_at) VALUES
-- F001设备使用记录
(@eq_f001_001, '2025-11-20 08:00:00', '2025-11-20 12:00:00', 4, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), '冷冻鱼片批次生产', NOW(), NOW()),
(@eq_f001_001, '2025-11-21 13:00:00', '2025-11-21 17:30:00', 4, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), '冷冻虾仁批次生产', NOW(), NOW()),
(@eq_f001_002, '2025-11-20 09:00:00', '2025-11-20 11:30:00', 2, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), '产品包装作业', NOW(), NOW()),
(@eq_f001_003, '2025-11-20 07:00:00', '2025-11-20 08:00:00', 1, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), '车间消毒作业', NOW(), NOW()),

-- F002设备使用记录
(@eq_f002_001, '2025-11-19 10:00:00', '2025-11-19 14:00:00', 4, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), '速冻海鲜批次处理', NOW(), NOW()),
(@eq_f002_001, '2025-11-20 09:30:00', '2025-11-20 13:30:00', 4, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), '速冻肉类批次处理', NOW(), NOW()),
(@eq_f002_002, '2025-11-19 14:30:00', '2025-11-19 16:00:00', 1, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), '真空包装作业', NOW(), NOW()),
(@eq_f002_003, '2025-11-20 08:00:00', '2025-11-20 12:30:00', 4, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), '鱼片切割加工', NOW(), NOW()),

-- F003设备使用记录
(@eq_f003_001, '2025-11-18 00:00:00', '2025-11-18 23:59:59', 24, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), '冷藏库持续运行', NOW(), NOW()),
(@eq_f003_002, '2025-11-19 08:00:00', '2025-11-19 12:00:00', 4, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), '食材分拣作业', NOW(), NOW()),
(@eq_f003_002, '2025-11-20 13:00:00', '2025-11-20 17:00:00', 4, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), '产品分类作业', NOW(), NOW()),
(@eq_f003_003, '2025-11-19 07:00:00', '2025-11-19 09:00:00', 2, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), '原材料清洗', NOW(), NOW());

-- ===== 5. 验证插入结果 =====
SELECT '=== 设备统计 ===' AS Category;
SELECT factory_id, COUNT(*) AS equipment_count 
FROM equipment 
WHERE deleted_at IS NULL 
GROUP BY factory_id 
ORDER BY factory_id;

SELECT '=== 告警统计 ===' AS Category;
SELECT factory_id, status, COUNT(*) AS alert_count 
FROM equipment_alerts 
GROUP BY factory_id, status 
ORDER BY factory_id, status;

SELECT '=== 维护记录统计 ===' AS Category;
SELECT 
    e.factory_id, 
    COUNT(*) AS maintenance_count,
    SUM(em.cost) AS total_maintenance_cost
FROM equipment_maintenance em
JOIN equipment e ON em.equipment_id = e.id
WHERE e.deleted_at IS NULL
GROUP BY e.factory_id
ORDER BY e.factory_id;

SELECT '=== 设备使用统计 ===' AS Category;
SELECT 
    e.factory_id, 
    COUNT(*) AS usage_count,
    SUM(eu.duration_hours) AS total_hours
FROM equipment_usages eu
JOIN equipment e ON eu.equipment_id = e.id
WHERE e.deleted_at IS NULL AND eu.deleted_at IS NULL
GROUP BY e.factory_id
ORDER BY e.factory_id;

SELECT '✅ 设备数据插入完成！' AS Status;


