-- 临时解决方案：跳过维护记录，只插入告警和使用记录
-- 因为 equipment_maintenance 引用的是 factory_equipment 表

USE cretas;

-- ===== 1. 插入设备告警（这个可以正常工作）=====
INSERT INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, triggered_at) VALUES
-- F002的告警
('F002', 22, '温度异常', 'WARNING', 'ACTIVE', '速冻设备温度超出正常范围，当前温度-15℃，建议检查制冷系统', '2025-11-20 14:30:00'),
('F002', 23, '维护提醒', 'INFO', 'ACTIVE', '真空包装机已运行2000小时，建议进行例行保养', '2025-11-21 09:00:00'),
('F002', 24, '刀片磨损', 'CRITICAL', 'ACTIVE', '切割设备刀片磨损严重，请立即更换', '2025-11-22 16:45:00'),

-- F003的告警
('F003', 25, '电力异常', 'WARNING', 'ACTIVE', '冷藏库设备电压不稳定，建议检查电路', '2025-11-20 11:20:00'),
('F003', 26, '传感器故障', 'CRITICAL', 'RESOLVED', '分拣设备传感器失灵，已更换', '2025-11-19 08:15:00'),
('F003', 27, '水压不足', 'WARNING', 'ACKNOWLEDGED', '清洗设备水压低于标准值，正在处理', '2025-11-21 13:30:00');

-- ===== 2. 插入设备使用记录（这个可以正常工作）=====
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

-- ===== 3. 验证插入结果 =====
SELECT '=== 告警统计 ===' AS Category;
SELECT factory_id, status, COUNT(*) AS alert_count 
FROM equipment_alerts 
GROUP BY factory_id, status 
ORDER BY factory_id, status;

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

SELECT '✅ 告警和使用记录插入完成！' AS Status;
SELECT '⚠️ 维护记录需要单独处理（因为外键约束问题）' AS Note;


