-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_04_20__iot_infrastructure_tables.sql
-- Conversion date: 2026-01-26 18:47:11
-- WARNING: This file requires manual review!
-- ============================================

-- =============================================
-- IoT 基础设施表 (IoT Infrastructure Tables)
-- IoT 设备注册、数据采集、告警管理
-- =============================================

-- =============================================
-- 1. iot_devices - IoT设备注册表
-- IoT Device Registry
-- 管理工厂内所有 IoT 设备的注册信息
-- =============================================
CREATE TABLE IF NOT EXISTS iot_devices (
    id VARCHAR(36) PRIMARY KEY COMMENT '设备UUID',
    device_code VARCHAR(50) NOT NULL COMMENT '设备编码，全局唯一',
    device_type ENUM('SCALE', 'CAMERA', 'GATEWAY', 'SENSOR') NOT NULL COMMENT '设备类型: SCALE-电子秤, CAMERA-摄像头, GATEWAY-网关, SENSOR-传感器',
    device_name VARCHAR(100) COMMENT '设备名称，便于识别',

    -- 工厂关联
    factory_id VARCHAR(50) NOT NULL COMMENT '所属工厂ID',
    equipment_id BIGINT COMMENT '关联工厂设备表 (factory_equipments.id)',
    workshop_id BIGINT COMMENT '所在车间ID',
    location VARCHAR(200) COMMENT '设备安装位置描述',

    -- 协议配置
    protocol_id VARCHAR(36) COMMENT '关联秤协议配置 (scale_protocol_configs.id)',

    -- MQTT 配置
    mqtt_topic VARCHAR(200) COMMENT 'MQTT订阅主题，如 factory/{factoryId}/device/{deviceCode}/data',
    mqtt_client_id VARCHAR(100) COMMENT 'MQTT客户端ID',

    -- 连接配置 (JSON 格式灵活存储不同类型设备的配置)
    connection_config JSON COMMENT '连接配置: {"ip":"192.168.1.100","port":8080,"comPort":"COM3","baudRate":9600}',

    -- 设备状态
    status ENUM('ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE') DEFAULT 'OFFLINE' COMMENT '设备状态: ONLINE-在线, OFFLINE-离线, ERROR-异常, MAINTENANCE-维护中',
    last_heartbeat TIMESTAMP WITH TIME ZONE COMMENT '最后心跳时间',
    last_data_time TIMESTAMP WITH TIME ZONE COMMENT '最后数据上报时间',

    -- 设备信息
    firmware_version VARCHAR(50) COMMENT '固件版本',
    hardware_version VARCHAR(50) COMMENT '硬件版本',
    manufacturer VARCHAR(100) COMMENT '设备制造商',
    model VARCHAR(100) COMMENT '设备型号',
    serial_number VARCHAR(100) COMMENT '设备序列号',

    -- 配置参数
    config_params JSON COMMENT '设备配置参数: {"sampleRate":1000,"precision":2,"threshold":0.5}',

    -- 元数据
    tags JSON COMMENT '设备标签: ["temperature","humidity","weight"]',
    description TEXT COMMENT '设备描述',

    -- 审计字段 (BaseEntity)
    created_by BIGINT COMMENT '创建人ID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE NULL COMMENT '软删除时间',

    -- 唯一约束
    UNIQUE KEY uk_device_code (device_code),

    -- 索引
    INDEX idx_factory_id (factory_id),
    INDEX idx_device_type (device_type),
    INDEX idx_status (status),
    INDEX idx_equipment_id (equipment_id),
    INDEX idx_protocol_id (protocol_id),
    INDEX idx_last_heartbeat (last_heartbeat),

    -- 外键约束
    FOREIGN KEY (factory_id) REFERENCES factories(factory_id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES factory_equipments(id) ON DELETE SET NULL,
    FOREIGN KEY (protocol_id) REFERENCES scale_protocol_configs(id) ON DELETE SET NULL
)
;
-- =============================================
-- 2. iot_device_data - 设备数据采集表 (高频数据)
-- IoT Device Data Collection
-- 存储设备上报的实时数据，高频写入
-- =============================================
CREATE TABLE IF NOT EXISTS iot_device_data (
    id BIGSERIAL PRIMARY KEY COMMENT '数据ID，自增主键',
    device_id VARCHAR(36) NOT NULL COMMENT '设备ID (iot_devices.id)',
    device_code VARCHAR(50) COMMENT '设备编码，冗余字段便于查询',
    factory_id VARCHAR(50) COMMENT '工厂ID，冗余字段便于分区查询',

    -- 数据内容
    data_type VARCHAR(30) NOT NULL COMMENT '数据类型: WEIGHT-重量, TEMPERATURE-温度, HUMIDITY-湿度, IMAGE-图像, BARCODE-条码',
    data_value JSON NOT NULL COMMENT '数据值: {"weight":25.5,"unit":"kg","stable":true} 或 {"temperature":4.5,"humidity":60}',
    raw_data VARCHAR(1000) COMMENT '原始数据(十六进制或原始字符串)',

    -- 时间戳
    collected_at TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '数据采集时间(设备端时间)',
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '数据接收时间(服务端时间)',

    -- 数据质量
    data_quality ENUM('GOOD', 'UNCERTAIN', 'BAD') DEFAULT 'GOOD' COMMENT '数据质量: GOOD-正常, UNCERTAIN-不确定, BAD-异常',
    quality_reason VARCHAR(200) COMMENT '数据质量说明',

    -- 处理状态
    processed BOOLEAN DEFAULT FALSE COMMENT '是否已被业务处理',
    processed_at TIMESTAMP WITH TIME ZONE COMMENT '处理时间',
    processed_by VARCHAR(100) COMMENT '处理者(服务名或用户)',

    -- 关联业务 (可选)
    production_batch_id BIGINT COMMENT '关联加工批次ID',
    material_batch_id VARCHAR(36) COMMENT '关联原料批次ID',

    -- 索引优化
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',

    -- 复合索引 (针对高频查询优化)
    INDEX idx_device_time (device_id, collected_at),
    INDEX idx_device_code_time (device_code, collected_at),
    INDEX idx_factory_time (factory_id, collected_at),
    INDEX idx_unprocessed (processed, created_at),
    INDEX idx_data_type (data_type, collected_at),
    INDEX idx_production_batch (production_batch_id),
    INDEX idx_material_batch (material_batch_id)

    -- 注意: 高频表不建议添加外键约束，以提高写入性能
    -- 数据完整性由应用层保证
)
;
-- =============================================
-- 3. iot_device_alerts - 设备告警表
-- IoT Device Alerts
-- 记录设备运行过程中产生的告警信息
-- =============================================
CREATE TABLE IF NOT EXISTS iot_device_alerts (
    id BIGSERIAL PRIMARY KEY COMMENT '告警ID，自增主键',
    device_id VARCHAR(36) NOT NULL COMMENT '设备ID (iot_devices.id)',
    device_code VARCHAR(50) COMMENT '设备编码，冗余字段',
    factory_id VARCHAR(50) COMMENT '工厂ID，冗余字段',

    -- 告警信息
    alert_type VARCHAR(30) NOT NULL COMMENT '告警类型: OFFLINE-设备离线, ERROR-设备错误, THRESHOLD-阈值超限, HEARTBEAT-心跳超时, CONNECTION-连接失败',
    alert_level ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL COMMENT '告警级别: INFO-信息, WARNING-警告, CRITICAL-严重',
    alert_code VARCHAR(50) COMMENT '告警代码，用于分类统计',
    message VARCHAR(500) COMMENT '告警消息',
    details JSON COMMENT '告警详情: {"expectedValue":100,"actualValue":150,"threshold":120}',

    -- 关联数据
    related_data_id BIGINT COMMENT '关联的数据记录ID (iot_device_data.id)',

    -- 告警处理
    acknowledged BOOLEAN DEFAULT FALSE COMMENT '是否已确认',
    acknowledged_by BIGINT COMMENT '确认人ID',
    acknowledged_by_name VARCHAR(100) COMMENT '确认人姓名',
    acknowledged_at TIMESTAMP WITH TIME ZONE COMMENT '确认时间',
    acknowledge_notes TEXT COMMENT '确认备注',

    -- 告警解决
    resolved BOOLEAN DEFAULT FALSE COMMENT '是否已解决',
    resolved_by BIGINT COMMENT '解决人ID',
    resolved_by_name VARCHAR(100) COMMENT '解决人姓名',
    resolved_at TIMESTAMP WITH TIME ZONE COMMENT '解决时间',
    resolution_notes TEXT COMMENT '解决方案描述',

    -- 告警忽略
    ignored BOOLEAN DEFAULT FALSE COMMENT '是否被忽略',
    ignored_by BIGINT COMMENT '忽略人ID',
    ignored_by_name VARCHAR(100) COMMENT '忽略人姓名',
    ignored_at TIMESTAMP WITH TIME ZONE COMMENT '忽略时间',
    ignore_reason TEXT COMMENT '忽略原因',

    -- 通知状态
    notification_sent BOOLEAN DEFAULT FALSE COMMENT '是否已发送通知',
    notification_sent_at TIMESTAMP WITH TIME ZONE COMMENT '通知发送时间',
    notification_channels JSON COMMENT '通知渠道: ["sms","email","push"]',

    -- 时间戳
    alert_time TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '告警发生时间',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 乐观锁
    version INT DEFAULT 0 COMMENT '乐观锁版本号',

    -- 索引
    INDEX idx_device_alerts (device_id, created_at),
    INDEX idx_device_code_alerts (device_code, created_at),
    INDEX idx_factory_alerts (factory_id, created_at),
    INDEX idx_unresolved (resolved, created_at),
    INDEX idx_unacknowledged (acknowledged, created_at),
    INDEX idx_alert_type (alert_type, alert_time),
    INDEX idx_alert_level (alert_level, alert_time),
    INDEX idx_alert_time (alert_time)

    -- 注意: 告警表不添加外键约束，确保即使设备被删除，历史告警仍可查询
)
;
-- =============================================
-- 4. iot_device_heartbeats - 设备心跳记录表 (可选)
-- IoT Device Heartbeats
-- 记录设备心跳历史，用于分析设备稳定性
-- =============================================
CREATE TABLE IF NOT EXISTS iot_device_heartbeats (
    id BIGSERIAL PRIMARY KEY COMMENT '心跳记录ID',
    device_id VARCHAR(36) NOT NULL COMMENT '设备ID',
    device_code VARCHAR(50) COMMENT '设备编码',
    factory_id VARCHAR(50) COMMENT '工厂ID',

    -- 心跳信息
    heartbeat_time TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '心跳时间',
    status_snapshot JSON COMMENT '状态快照: {"cpuUsage":30,"memoryUsage":60,"temperature":45,"signalStrength":-50}',

    -- 网络信息
    ip_address VARCHAR(45) COMMENT 'IP地址',
    latency_ms INT COMMENT '网络延迟(毫秒)',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',

    -- 索引 (心跳数据量大，只保留必要索引)
    INDEX idx_device_heartbeat (device_id, heartbeat_time),
    INDEX idx_factory_heartbeat (factory_id, heartbeat_time)

    -- 建议: 此表数据量大，可考虑按月分区或定期归档
)
;
-- =============================================
-- 5. iot_device_commands - 设备命令下发表
-- IoT Device Commands
-- 记录下发给设备的命令及执行状态
-- =============================================
CREATE TABLE IF NOT EXISTS iot_device_commands (
    id VARCHAR(36) PRIMARY KEY COMMENT '命令ID',
    device_id VARCHAR(36) NOT NULL COMMENT '目标设备ID',
    device_code VARCHAR(50) COMMENT '设备编码',
    factory_id VARCHAR(50) COMMENT '工厂ID',

    -- 命令信息
    command_type VARCHAR(50) NOT NULL COMMENT '命令类型: RESTART-重启, CONFIG-配置更新, CALIBRATE-校准, FIRMWARE_UPDATE-固件更新',
    command_name VARCHAR(100) COMMENT '命令名称',
    command_payload JSON NOT NULL COMMENT '命令参数: {"action":"restart","delay":5}',

    -- 命令状态
    status ENUM('PENDING', 'SENT', 'DELIVERED', 'EXECUTED', 'FAILED', 'TIMEOUT', 'CANCELLED') DEFAULT 'PENDING'
        COMMENT '命令状态: PENDING-待发送, SENT-已发送, DELIVERED-已送达, EXECUTED-已执行, FAILED-失败, TIMEOUT-超时, CANCELLED-已取消',

    -- 执行结果
    sent_at TIMESTAMP WITH TIME ZONE COMMENT '发送时间',
    delivered_at TIMESTAMP WITH TIME ZONE COMMENT '送达时间',
    executed_at TIMESTAMP WITH TIME ZONE COMMENT '执行时间',
    execution_result JSON COMMENT '执行结果: {"success":true,"message":"","data":{}}',
    error_message VARCHAR(500) COMMENT '错误消息',
    retry_count INT DEFAULT 0 COMMENT '重试次数',

    -- 超时配置
    timeout_seconds INT DEFAULT 60 COMMENT '超时时间(秒)',
    expire_at TIMESTAMP WITH TIME ZONE COMMENT '命令过期时间',

    -- 操作者
    created_by BIGINT COMMENT '创建人ID',
    created_by_name VARCHAR(100) COMMENT '创建人姓名',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 索引
    INDEX idx_device_commands (device_id, created_at),
    INDEX idx_device_code_commands (device_code, created_at),
    INDEX idx_factory_commands (factory_id, created_at),
    INDEX idx_status (status, created_at),
    INDEX idx_pending (status, expire_at)
)
;
-- =============================================
-- 6. 创建索引优化视图 (可选)
-- =============================================

-- 设备状态概览视图
CREATE OR REPLACE VIEW v_iot_device_status AS
SELECT
    d.id,
    d.device_code,
    d.device_name,
    d.device_type,
    d.factory_id,
    d.status,
    d.last_heartbeat,
    d.last_data_time,
    TIMESTAMPDIFF(MINUTE, d.last_heartbeat, NOW()) AS minutes_since_heartbeat,
    (SELECT COUNT(*) FROM iot_device_alerts a WHERE a.device_id = d.id AND a.resolved = FALSE) AS unresolved_alerts,
    d.created_at,
    d.updated_at
FROM iot_devices d
WHERE d.deleted_at IS NULL;
-- 未处理告警视图
CREATE OR REPLACE VIEW v_iot_unresolved_alerts AS
SELECT
    a.*,
    d.device_name,
    d.device_type,
    d.factory_id
FROM iot_device_alerts a
LEFT JOIN iot_devices d ON a.device_id = d.id
WHERE a.resolved = FALSE AND a.ignored = FALSE
ORDER BY
    CASE a.alert_level
        WHEN 'CRITICAL' THEN 1
        WHEN 'WARNING' THEN 2
        ELSE 3
    END,
    a.alert_time DESC;
