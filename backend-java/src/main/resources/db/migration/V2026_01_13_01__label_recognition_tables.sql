-- ============================================
-- 标签自动识别功能表
-- 摄像头VMD触发的自动标签OCR识别
-- ============================================

-- 标签识别配置表
CREATE TABLE IF NOT EXISTS label_recognition_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    device_id VARCHAR(36) NOT NULL COMMENT '摄像头设备ID',
    channel_id INT DEFAULT 1 COMMENT '摄像头通道号',
    config_name VARCHAR(100) COMMENT '配置名称',

    -- 触发配置
    trigger_on_vmd BOOLEAN DEFAULT TRUE COMMENT '是否VMD触发',
    trigger_on_field_detection BOOLEAN DEFAULT FALSE COMMENT '是否区域入侵触发',
    cooldown_seconds INT DEFAULT 3 COMMENT '冷却时间(秒)，防重复识别',

    -- 识别配置
    min_confidence DOUBLE DEFAULT 0.7 COMMENT '最低置信度阈值',
    default_batch_id VARCHAR(100) COMMENT '默认关联批次ID',

    -- 状态
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    last_trigger_time DATETIME COMMENT '最后触发时间',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_factory_id (factory_id),
    INDEX idx_device_id (device_id),
    INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签识别配置';

-- 标签识别记录表
CREATE TABLE IF NOT EXISTS label_recognition_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    config_id BIGINT COMMENT '关联配置ID',
    device_id VARCHAR(36) COMMENT '触发设备ID',

    -- 触发信息
    trigger_type VARCHAR(20) NOT NULL COMMENT '触发类型: VMD/FIELD_DETECTION/MANUAL',
    trigger_event_id VARCHAR(100) COMMENT 'ISAPI事件ID',

    -- 识别结果
    status VARCHAR(20) NOT NULL COMMENT '状态: SUCCESS/FAILED/NO_LABEL/LOW_CONFIDENCE',
    recognized_batch_number VARCHAR(100) COMMENT '识别出的批次号',
    expected_batch_number VARCHAR(100) COMMENT '期望的批次号',
    batch_match BOOLEAN COMMENT '批次是否匹配',

    -- 标签质量
    print_quality VARCHAR(20) COMMENT '打印质量: GOOD/ACCEPTABLE/POOR/UNREADABLE',
    confidence DOUBLE COMMENT '识别置信度',
    quality_score DOUBLE COMMENT '质量分数',
    quality_issues TEXT COMMENT '质量问题(JSON数组)',

    -- 图片数据
    captured_image LONGBLOB COMMENT '抓拍图片',
    captured_image_url VARCHAR(500) COMMENT '图片URL(OSS)',

    -- 时间
    recognition_time DATETIME NOT NULL COMMENT '识别时间',
    processing_duration_ms INT COMMENT '处理耗时(毫秒)',

    -- AI响应
    ai_response TEXT COMMENT 'AI原始响应(JSON)',
    error_message TEXT COMMENT '错误信息',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_factory_id (factory_id),
    INDEX idx_config_id (config_id),
    INDEX idx_status (status),
    INDEX idx_recognition_time (recognition_time),
    INDEX idx_batch_number (recognized_batch_number),

    CONSTRAINT fk_config_id FOREIGN KEY (config_id)
        REFERENCES label_recognition_configs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签识别记录';
