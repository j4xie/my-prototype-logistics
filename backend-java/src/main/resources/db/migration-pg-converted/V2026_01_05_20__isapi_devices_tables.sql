-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_05_20__isapi_devices_tables.sql
-- Conversion date: 2026-01-26 18:47:33
-- WARNING: This file requires manual review!
-- ============================================

-- =====================================================
-- ISAPI 设备管理表结构
-- 海康威视 ISAPI 协议集成
-- =====================================================

-- 1. ISAPI 设备表
CREATE TABLE IF NOT EXISTS isapi_devices (
    id VARCHAR(36) PRIMARY KEY COMMENT '设备UUID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

    -- 设备基本信息
    device_name VARCHAR(100) NOT NULL COMMENT '设备名称',
    device_type ENUM('IPC', 'NVR', 'DVR', 'ENCODER') NOT NULL DEFAULT 'IPC' COMMENT '设备类型',
    device_model VARCHAR(100) COMMENT '设备型号 (如 DS-2CD2T47G2-L)',
    serial_number VARCHAR(100) COMMENT '设备序列号',
    firmware_version VARCHAR(50) COMMENT '固件版本',

    -- 网络配置
    ip_address VARCHAR(45) NOT NULL COMMENT 'IP地址 (支持IPv6)',
    port INT NOT NULL DEFAULT 80 COMMENT 'HTTP端口',
    rtsp_port INT DEFAULT 554 COMMENT 'RTSP端口',
    https_port INT DEFAULT 443 COMMENT 'HTTPS端口',
    protocol ENUM('HTTP', 'HTTPS') NOT NULL DEFAULT 'HTTP' COMMENT '通信协议',

    -- 认证信息 (密码AES加密存储)
    username VARCHAR(50) NOT NULL COMMENT '登录用户名',
    password_encrypted VARCHAR(255) NOT NULL COMMENT '加密后的密码',

    -- 设备能力
    channel_count INT NOT NULL DEFAULT 1 COMMENT '通道数量',
    supports_ptz SMALLINT(1) DEFAULT 0 COMMENT '是否支持PTZ',
    supports_audio SMALLINT(1) DEFAULT 0 COMMENT '是否支持音频',
    supports_smart SMALLINT(1) DEFAULT 0 COMMENT '是否支持智能分析',
    device_capabilities JSON COMMENT '完整能力集 (ISAPI/System/capabilities)',

    -- 状态信息
    status ENUM('ONLINE', 'OFFLINE', 'CONNECTING', 'ERROR', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN' COMMENT '设备状态',
    last_error VARCHAR(500) COMMENT '最后错误信息',
    last_heartbeat_at TIMESTAMP WITH TIME ZONE COMMENT '最后心跳时间',
    last_event_at TIMESTAMP WITH TIME ZONE COMMENT '最后事件时间',

    -- 订阅状态
    alert_subscribed SMALLINT(1) DEFAULT 0 COMMENT '是否已订阅告警',
    subscribed_events JSON COMMENT '已订阅的事件类型列表',

    -- 位置信息
    location_description VARCHAR(255) COMMENT '安装位置描述',
    latitude DECIMAL(10, 8) COMMENT '纬度',
    longitude DECIMAL(11, 8) COMMENT '经度',

    -- 关联信息
    department_id VARCHAR(36) COMMENT '关联部门ID',
    equipment_id VARCHAR(36) COMMENT '关联设备ID (如绑定到某生产线)',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    -- 索引
    INDEX idx_factory_status (factory_id, status),
    INDEX idx_ip_port (ip_address, port),
    INDEX idx_device_type (device_type),
    INDEX idx_last_heartbeat (last_heartbeat_at),
    UNIQUE INDEX uk_factory_ip_port (factory_id, ip_address, port, deleted_at)
)
;
-- 2. ISAPI 事件日志表
CREATE TABLE IF NOT EXISTS isapi_event_logs (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    device_id VARCHAR(36) NOT NULL COMMENT '设备ID',

    -- 事件信息
    event_type VARCHAR(50) NOT NULL COMMENT '事件类型 (VMD/linedetection/facedetection等)',
    event_state ENUM('ACTIVE', 'INACTIVE') NOT NULL COMMENT '事件状态',
    event_description VARCHAR(500) COMMENT '事件描述',

    -- 通道信息
    channel_id INT COMMENT '通道ID',
    channel_name VARCHAR(100) COMMENT '通道名称',

    -- 事件详情
    event_data JSON COMMENT '原始事件数据 (XML转JSON)',
    detection_region JSON COMMENT '检测区域坐标',

    -- 图片证据
    picture_url VARCHAR(500) COMMENT '抓拍图片URL',
    picture_data BYTEA COMMENT '抓拍图片二进制数据',

    -- 时间戳
    event_time TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '事件发生时间 (设备时间)',
    received_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '服务器接收时间',

    -- 处理状态
    processed SMALLINT(1) DEFAULT 0 COMMENT '是否已处理',
    processed_at TIMESTAMP WITH TIME ZONE COMMENT '处理时间',
    processed_by VARCHAR(50) COMMENT '处理人',
    process_result VARCHAR(255) COMMENT '处理结果',

    -- 关联告警
    alert_id VARCHAR(36) COMMENT '关联的 equipment_alerts 表 ID',

    -- 索引
    INDEX idx_factory_device (factory_id, device_id),
    INDEX idx_event_type (event_type),
    INDEX idx_event_time (event_time),
    INDEX idx_processed (processed),
    INDEX idx_received_time (received_time),

    -- 外键
    CONSTRAINT fk_event_device FOREIGN KEY (device_id)
        REFERENCES isapi_devices(id) ON DELETE CASCADE
)
;
-- 3. ISAPI 设备通道表 (用于NVR多通道管理)
CREATE TABLE IF NOT EXISTS isapi_device_channels (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL COMMENT '所属设备ID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

    -- 通道信息
    channel_id INT NOT NULL COMMENT '通道编号',
    channel_name VARCHAR(100) COMMENT '通道名称',
    channel_type ENUM('ANALOG', 'IP', 'VIRTUAL') DEFAULT 'IP' COMMENT '通道类型',

    -- 关联的IPC设备 (NVR场景)
    source_ip VARCHAR(45) COMMENT '源IPC IP地址',
    source_port INT COMMENT '源IPC端口',

    -- 流信息
    main_stream_url VARCHAR(500) COMMENT '主码流RTSP URL',
    sub_stream_url VARCHAR(500) COMMENT '子码流RTSP URL',

    -- 状态
    status ENUM('ONLINE', 'OFFLINE', 'NO_VIDEO') DEFAULT 'OFFLINE' COMMENT '通道状态',

    -- 配置
    recording_enabled SMALLINT(1) DEFAULT 0 COMMENT '是否启用录像',
    smart_enabled SMALLINT(1) DEFAULT 0 COMMENT '是否启用智能分析',
    enabled_events JSON COMMENT '启用的事件检测类型',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    -- 索引
    INDEX idx_device_channel (device_id, channel_id),
    INDEX idx_factory_id (factory_id),
    UNIQUE INDEX uk_device_channel (device_id, channel_id, deleted_at),

    -- 外键
    CONSTRAINT fk_channel_device FOREIGN KEY (device_id)
        REFERENCES isapi_devices(id) ON DELETE CASCADE
)
;
-- 4. 添加索引优化查询性能
CREATE INDEX idx_isapi_events_composite
    ON isapi_event_logs(factory_id, device_id, event_type, event_time DESC);
