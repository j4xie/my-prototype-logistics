-- 设备告警测试数据
-- 用途：为设备告警确认和解决API提供测试数据
-- 创建时间：2025-11-19

-- 1. 创建设备告警表（如果不存在）
CREATE TABLE IF NOT EXISTS equipment_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    equipment_id INT NOT NULL COMMENT '设备ID',
    alert_type VARCHAR(50) NOT NULL COMMENT '告警类型',
    level ENUM('CRITICAL', 'WARNING', 'INFO') NOT NULL DEFAULT 'INFO' COMMENT '告警级别',
    status ENUM('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'ACTIVE' COMMENT '告警状态',
    message TEXT NOT NULL COMMENT '告警消息',
    details TEXT COMMENT '详细信息',
    triggered_at DATETIME NOT NULL COMMENT '触发时间',
    acknowledged_at DATETIME COMMENT '确认时间',
    acknowledged_by INT COMMENT '确认人ID',
    acknowledged_by_name VARCHAR(100) COMMENT '确认人姓名',
    resolved_at DATETIME COMMENT '解决时间',
    resolved_by INT COMMENT '解决人ID',
    resolved_by_name VARCHAR(100) COMMENT '解决人姓名',
    resolution_notes TEXT COMMENT '解决方案备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_alert_equipment (equipment_id),
    INDEX idx_alert_factory (factory_id),
    INDEX idx_alert_status (status),
    INDEX idx_alert_triggered_at (triggered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备告警表';

-- 2. 插入测试数据（假设工厂ID为CRETAS_2024_001）
-- 注意：请根据实际的equipment表中的设备ID进行调整

-- 删除旧的测试数据
DELETE FROM equipment_alerts WHERE factory_id = 'CRETAS_2024_001';

-- 插入活动状态的严重告警（维护逾期）
INSERT INTO equipment_alerts (
    factory_id, equipment_id, alert_type, level, status,
    message, details, triggered_at
) VALUES (
    'CRETAS_2024_001',
    1,  -- 请替换为实际的设备ID
    '维护提醒',
    'CRITICAL',
    'ACTIVE',
    '设备维护已逾期 15 天',
    '上次维护: 2025-10-01\n下次维护: 2025-11-04',
    '2025-11-04 00:00:00'
);

-- 插入警告级别告警（维护即将到期）
INSERT INTO equipment_alerts (
    factory_id, equipment_id, alert_type, level, status,
    message, details, triggered_at
) VALUES (
    'CRETAS_2024_001',
    2,  -- 请替换为实际的设备ID
    '维护提醒',
    'WARNING',
    'ACTIVE',
    '设备维护已逾期 3 天',
    '上次维护: 2025-10-16\n下次维护: 2025-11-16',
    '2025-11-16 00:00:00'
);

-- 插入保修即将到期告警
INSERT INTO equipment_alerts (
    factory_id, equipment_id, alert_type, level, status,
    message, details, triggered_at
) VALUES (
    'CRETAS_2024_001',
    1,  -- 请替换为实际的设备ID
    '保修即将到期',
    'WARNING',
    'ACTIVE',
    '保修将在 5 天后到期',
    '购买日期: 2023-11-24\n保修到期: 2025-11-24\n制造商: 海尔',
    '2025-11-24 00:00:00'
);

-- 插入信息级别告警
INSERT INTO equipment_alerts (
    factory_id, equipment_id, alert_type, level, status,
    message, details, triggered_at
) VALUES (
    'CRETAS_2024_001',
    3,  -- 请替换为实际的设备ID
    '保修即将到期',
    'INFO',
    'ACTIVE',
    '保修将在 45 天后到期',
    '购买日期: 2024-01-04\n保修到期: 2026-01-04\n制造商: 西门子',
    '2026-01-04 00:00:00'
);

-- 插入已确认的告警
INSERT INTO equipment_alerts (
    factory_id, equipment_id, alert_type, level, status,
    message, details, triggered_at,
    acknowledged_at, acknowledged_by, acknowledged_by_name
) VALUES (
    'CRETAS_2024_001',
    2,  -- 请替换为实际的设备ID
    '维护提醒',
    'WARNING',
    'ACKNOWLEDGED',
    '设备即将到达维护周期',
    '上次维护: 2025-10-25\n下次维护: 2025-11-25',
    '2025-11-25 00:00:00',
    '2025-11-19 10:30:00',
    1,
    '张三'
);

-- 插入已解决的告警
INSERT INTO equipment_alerts (
    factory_id, equipment_id, alert_type, level, status,
    message, details, triggered_at,
    acknowledged_at, acknowledged_by, acknowledged_by_name,
    resolved_at, resolved_by, resolved_by_name, resolution_notes
) VALUES (
    'CRETAS_2024_001',
    1,  -- 请替换为实际的设备ID
    '维护提醒',
    'WARNING',
    'RESOLVED',
    '设备维护已逾期 2 天',
    '上次维护: 2025-10-15\n下次维护: 2025-11-15',
    '2025-11-15 00:00:00',
    '2025-11-17 09:00:00',
    1,
    '张三',
    '2025-11-17 14:30:00',
    2,
    '李四',
    '已完成设备维护，更换了润滑油和滤芯'
);

-- 3. 验证插入的数据
SELECT
    id,
    equipment_id,
    alert_type,
    level,
    status,
    message,
    triggered_at
FROM equipment_alerts
WHERE factory_id = 'CRETAS_2024_001'
ORDER BY triggered_at DESC;

-- 4. 查看各状态的告警数量
SELECT
    status,
    level,
    COUNT(*) as count
FROM equipment_alerts
WHERE factory_id = 'CRETAS_2024_001'
GROUP BY status, level
ORDER BY status, level;
