-- =====================================================
-- Dahua Device Management Tables
-- Migration: V2026_01_23_01
-- Description: Tables for Dahua camera/NVR device management
-- =====================================================

-- -----------------------------------------------------
-- Table: dahua_devices
-- Stores Dahua device information (IPC, NVR, DVR, XVR)
-- -----------------------------------------------------
CREATE TABLE dahua_devices (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(20) NOT NULL COMMENT 'IPC, NVR, DVR, XVR',
    device_model VARCHAR(100),
    serial_number VARCHAR(100),
    mac_address VARCHAR(17),
    firmware_version VARCHAR(50),

    -- Network Configuration
    ip_address VARCHAR(45) NOT NULL,
    port INT NOT NULL DEFAULT 80,
    rtsp_port INT DEFAULT 554,
    tcp_port INT DEFAULT 37777 COMMENT 'Dahua TCP control port',

    -- Authentication
    username VARCHAR(50) NOT NULL,
    password_encrypted VARCHAR(255) NOT NULL,

    -- Device Capabilities
    channel_count INT NOT NULL DEFAULT 1,
    supports_ptz BOOLEAN DEFAULT FALSE,
    supports_audio BOOLEAN DEFAULT FALSE,
    supports_smart BOOLEAN DEFAULT FALSE,
    device_capabilities JSON COMMENT 'Extended capabilities JSON',

    -- Status Information
    status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN' COMMENT 'ONLINE, OFFLINE, CONNECTING, ERROR, UNKNOWN, UNACTIVATED',
    last_error VARCHAR(500),
    last_heartbeat_at DATETIME,
    last_event_at DATETIME,

    -- Event Subscription
    alert_subscribed BOOLEAN DEFAULT FALSE,
    subscribed_events JSON COMMENT 'List of subscribed event types',

    -- Physical Location
    location_description VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Relations
    department_id VARCHAR(36),
    equipment_id BIGINT,

    -- Audit Fields (BaseEntity)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    -- Indexes
    INDEX idx_factory_status (factory_id, status),
    INDEX idx_ip_port (ip_address, port),
    UNIQUE INDEX uk_factory_ip_port (factory_id, ip_address, port, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Dahua device registry';

-- -----------------------------------------------------
-- Table: dahua_device_channels
-- Stores channel information for Dahua NVR/DVR devices
-- -----------------------------------------------------
CREATE TABLE dahua_device_channels (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    factory_id VARCHAR(50) NOT NULL,

    -- Channel Identification
    channel_id INT NOT NULL,
    channel_name VARCHAR(100),
    channel_type VARCHAR(20) DEFAULT 'IP' COMMENT 'ANALOG, IP, VIRTUAL',

    -- Source (for NVR connected cameras)
    source_ip VARCHAR(45),
    source_port INT,

    -- Stream URLs
    main_stream_url VARCHAR(500),
    sub_stream_url VARCHAR(500),

    -- Status
    status VARCHAR(20) DEFAULT 'OFFLINE' COMMENT 'ONLINE, OFFLINE, NO_VIDEO',

    -- Features
    recording_enabled BOOLEAN DEFAULT FALSE,
    smart_enabled BOOLEAN DEFAULT FALSE,
    enabled_events JSON COMMENT 'List of enabled event types for this channel',

    -- Audit Fields (BaseEntity)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    -- Indexes
    INDEX idx_device_channel (device_id, channel_id),
    INDEX idx_factory_id (factory_id),
    UNIQUE INDEX uk_device_channel (device_id, channel_id, deleted_at),

    -- Foreign Key
    FOREIGN KEY (device_id) REFERENCES dahua_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Dahua device channels';
