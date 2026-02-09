-- 为3个工厂添加设备相关数据（完整版 - 包含设备ID）
-- 设备已经插入，现在插入告警、维护、使用记录

USE cretas;

-- ===== 1. 插入设备告警 =====
-- F001的设备ID: 1, 2, 3
-- F002的设备ID: 22, 23, 24
-- F003的设备ID: 25, 26, 27

INSERT INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, triggered_at) VALUES
-- F002的告警
('F002', 22, '温度异常', 'WARNING', 'ACTIVE', '速冻设备温度超出正常范围，当前温度-15℃，建议检查制冷系统', '2025-11-20 14:30:00'),
('F002', 23, '维护提醒', 'INFO', 'ACTIVE', '真空包装机已运行2000小时，建议进行例行保养', '2025-11-21 09:00:00'),
('F002', 24, '刀片磨损', 'CRITICAL', 'ACTIVE', '切割设备刀片磨损严重，请立即更换', '2025-11-22 16:45:00'),

-- F003的告警
('F003', 25, '电力异常', 'WARNING', 'ACTIVE', '冷藏库设备电压不稳定，建议检查电路', '2025-11-20 11:20:00'),
('F003', 26, '传感器故障', 'CRITICAL', 'RESOLVED', '分拣设备传感器失灵，已更换', '2025-11-19 08:15:00'),
('F003', 27, '水压不足', 'WARNING', 'ACKNOWLEDGED', '清洗设备水压低于标准值，正在处理', '2025-11-21 13:30:00');

-- ===== 2. 插入维护记录 =====
INSERT INTO equipment_maintenance (equipment_id, maintenance_date, maintenance_type, cost, description, next_maintenance_date, created_at, updated_at) VALUES
-- F001设备维护
(1, '2025-11-10', '定期保养', 3500.00, '更换制冷剂，清洁冷凝器，检查压缩机', '2025-12-10', NOW(), NOW()),
(2, '2025-10-25', '故障维修', 5200.00, '更换真空泵密封件，调整包装参数', '2025-11-25', NOW(), NOW()),
(3, '2025-11-05', '定期检查', 2800.00, '检查紫外灯管，更换过滤器，校准温度', '2025-12-05', NOW(), NOW()),

-- F002设备维护
(22, '2025-10-15', '安装调试', 8000.00, '设备初次安装，系统调试，参数设置', '2025-11-15', NOW(), NOW()),
(23, '2025-11-08', '定期保养', 4200.00, '清洁真空室，更换密封圈，润滑传动部件', '2025-12-08', NOW(), NOW()),
(24, '2025-11-15', '刀具更换', 6500.00, '更换切割刀片，调整切割精度，安全检查', '2025-12-15', NOW(), NOW()),

-- F003设备维护
(25, '2025-09-20', '制冷系统检修', 12000.00, '检修制冷系统，更换冷媒，清洗冷凝器', '2025-10-20', NOW(), NOW()),
(26, '2025-10-30', '传感器校准', 3800.00, '校准称重传感器，更新分拣程序，精度测试', '2025-11-30', NOW(), NOW()),
(27, '2025-11-12', '水路清洁', 2500.00, '清洗水路管道，更换喷嘴，检查水泵', '2025-12-12', NOW(), NOW());

-- ===== 3. 插入设备使用记录 =====
INSERT INTO equipment_usages (equipment_id, start_time, end_time, duration_hours, operator_id, notes, created_at, updated_at) VALUES
-- F001设备使用记录
(1, '2025-11-20 08:00:00', '2025-11-20 12:00:00', 4, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), '冷冻鱼片批次生产', NOW(), NOW()),
(1, '2025-11-21 13:00:00', '2025-11-21 17:30:00', 4, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), '冷冻虾仁批次生产', NOW(), NOW()),
(2, '2025-11-20 09:00:00', '2025-11-20 11:30:00', 2, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), '产品包装作业', NOW(), NOW()),
(3, '2025-11-20 07:00:00', '2025-11-20 08:00:00', 1, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), '车间消毒作业', NOW(), NOW()),

-- F002设备使用记录
(22, '2025-11-19 10:00:00', '2025-11-19 14:00:00', 4, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), '速冻海鲜批次处理', NOW(), NOW()),
(22, '2025-11-20 09:30:00', '2025-11-20 13:30:00', 4, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), '速冻肉类批次处理', NOW(), NOW()),
(23, '2025-11-19 14:30:00', '2025-11-19 16:00:00', 1, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), '真空包装作业', NOW(), NOW()),
(24, '2025-11-20 08:00:00', '2025-11-20 12:30:00', 4, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), '鱼片切割加工', NOW(), NOW()),

-- F003设备使用记录
(25, '2025-11-18 00:00:00', '2025-11-18 23:59:59', 24, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), '冷藏库持续运行', NOW(), NOW()),
(26, '2025-11-19 08:00:00', '2025-11-19 12:00:00', 4, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), '食材分拣作业', NOW(), NOW()),
(26, '2025-11-20 13:00:00', '2025-11-20 17:00:00', 4, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), '产品分类作业', NOW(), NOW()),
(27, '2025-11-19 07:00:00', '2025-11-19 09:00:00', 2, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), '原材料清洗', NOW(), NOW());

-- ===== 4. 验证插入结果 =====
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

