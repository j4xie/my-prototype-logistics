-- 步骤2: 插入设备告警（基于实际设备ID）
-- 请先执行 step1_insert_equipment.sql 并记录设备ID，然后替换下面的ID

USE cretas;

-- ===== 方案A: 如果你看到了设备ID，直接使用ID插入 =====
-- 根据截图，F002的设备ID是 22, 23, 24，F003的设备ID是 25, 26, 27
-- 请根据实际查询结果替换下面的ID

INSERT INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, triggered_at) VALUES
-- F002的告警（请替换为实际的设备ID）
('F002', 22, '温度异常', 'WARNING', 'ACTIVE', '速冻设备温度超出正常范围，当前温度-15℃，建议检查制冷系统', '2025-11-20 14:30:00'),
('F002', 23, '维护提醒', 'INFO', 'ACTIVE', '真空包装机已运行2000小时，建议进行例行保养', '2025-11-21 09:00:00'),
('F002', 24, '刀片磨损', 'CRITICAL', 'ACTIVE', '切割设备刀片磨损严重，请立即更换', '2025-11-22 16:45:00'),

-- F003的告警（请替换为实际的设备ID）
('F003', 25, '电力异常', 'WARNING', 'ACTIVE', '冷藏库设备电压不稳定，建议检查电路', '2025-11-20 11:20:00'),
('F003', 26, '传感器故障', 'CRITICAL', 'RESOLVED', '分拣设备传感器失灵，已更换', '2025-11-19 08:15:00'),
('F003', 27, '水压不足', 'WARNING', 'ACKNOWLEDGED', '清洗设备水压低于标准值，正在处理', '2025-11-21 13:30:00');

-- 验证告警插入
SELECT '=== 告警统计 ===' AS Info;
SELECT factory_id, status, COUNT(*) AS alert_count 
FROM equipment_alerts 
GROUP BY factory_id, status 
ORDER BY factory_id, status;


