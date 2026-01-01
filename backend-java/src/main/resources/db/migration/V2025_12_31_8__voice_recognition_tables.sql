-- =============================================================================
-- Voice Recognition Tables
-- Created: 2025-12-31
-- Description: Tables for voice recognition history, configuration, and batch tasks
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Voice Recognition History - 语音识别历史记录
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_recognition_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    user_id BIGINT COMMENT '用户ID',
    username VARCHAR(100) COMMENT '用户名',
    session_id VARCHAR(100) COMMENT '会话ID',

    -- Recognition Result
    recognized_text TEXT COMMENT '识别结果文本',
    status_code INT DEFAULT 0 COMMENT '状态码: 0=成功',
    error_message VARCHAR(500) COMMENT '错误信息',

    -- Audio Info
    audio_format VARCHAR(20) DEFAULT 'raw' COMMENT '音频格式',
    audio_encoding VARCHAR(20) DEFAULT 'raw' COMMENT '音频编码',
    audio_sample_rate INT DEFAULT 16000 COMMENT '采样率',
    audio_duration_ms INT COMMENT '音频时长(毫秒)',
    audio_size_bytes BIGINT COMMENT '音频大小(字节)',
    audio_oss_path VARCHAR(500) COMMENT 'OSS存储路径(可选)',

    -- Processing Info
    recognition_duration_ms INT COMMENT '识别耗时(毫秒)',

    -- Business Context
    business_scene VARCHAR(100) COMMENT '业务场景',
    related_business_id VARCHAR(100) COMMENT '关联业务ID',
    related_business_type VARCHAR(50) COMMENT '关联业务类型',

    -- Client Info
    client_ip VARCHAR(50) COMMENT '客户端IP',
    device_info VARCHAR(255) COMMENT '设备信息',

    -- Audit Fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    -- Indexes
    INDEX idx_factory_id (factory_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_factory_user (factory_id, user_id),
    INDEX idx_factory_scene (factory_id, business_scene),
    INDEX idx_factory_time (factory_id, created_at),
    INDEX idx_related_business (factory_id, related_business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='语音识别历史记录';

-- -----------------------------------------------------------------------------
-- 2. Voice Recognition Config - 语音识别配置
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_recognition_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL UNIQUE COMMENT '工厂ID',

    -- Basic Settings
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用语音识别',
    default_language VARCHAR(20) DEFAULT 'zh_cn' COMMENT '默认语言',
    default_sample_rate INT DEFAULT 16000 COMMENT '默认采样率',
    default_format VARCHAR(20) DEFAULT 'raw' COMMENT '默认音频格式',
    default_encoding VARCHAR(20) DEFAULT 'raw' COMMENT '默认音频编码',
    max_audio_duration INT DEFAULT 60 COMMENT '最大音频时长(秒)',

    -- Storage Settings
    save_audio_to_oss BOOLEAN DEFAULT FALSE COMMENT '是否保存音频到OSS',
    save_history BOOLEAN DEFAULT TRUE COMMENT '是否保存识别历史',
    history_retention_days INT DEFAULT 90 COMMENT '历史记录保留天数',

    -- Usage Limits
    daily_limit INT DEFAULT 0 COMMENT '每日识别次数限制(0=不限制)',
    user_daily_limit INT DEFAULT 0 COMMENT '每用户每日限制(0=不限制)',

    -- Batch Settings
    batch_max_concurrent INT DEFAULT 3 COMMENT '批量任务最大并发数',
    batch_max_files INT DEFAULT 50 COMMENT '单次批量最大文件数',

    -- Metadata
    notes VARCHAR(500) COMMENT '配置备注',
    last_updated_by BIGINT COMMENT '最后更新人ID',
    last_updated_by_name VARCHAR(100) COMMENT '最后更新人姓名',

    -- Audit Fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    -- Indexes
    INDEX idx_factory_id (factory_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='语音识别配置';

-- -----------------------------------------------------------------------------
-- 3. Batch Voice Task - 批量语音识别任务
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS batch_voice_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_number VARCHAR(50) NOT NULL UNIQUE COMMENT '任务编号',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

    -- Creator Info
    created_by BIGINT COMMENT '创建人ID',
    created_by_name VARCHAR(100) COMMENT '创建人姓名',

    -- Task Status
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT '状态: PENDING/PROCESSING/COMPLETED/FAILED/CANCELLED',

    -- Progress
    total_files INT DEFAULT 0 COMMENT '总文件数',
    processed_files INT DEFAULT 0 COMMENT '已处理文件数',
    success_count INT DEFAULT 0 COMMENT '成功数',
    fail_count INT DEFAULT 0 COMMENT '失败数',
    progress DECIMAL(5,2) DEFAULT 0.00 COMMENT '进度百分比',

    -- Audio Settings
    audio_format VARCHAR(20) DEFAULT 'raw' COMMENT '音频格式',
    audio_encoding VARCHAR(20) DEFAULT 'raw' COMMENT '音频编码',
    audio_sample_rate INT DEFAULT 16000 COMMENT '采样率',
    audio_language VARCHAR(20) DEFAULT 'zh_cn' COMMENT '语言',

    -- Result
    result_json LONGTEXT COMMENT '识别结果JSON',
    error_message VARCHAR(1000) COMMENT '错误信息',

    -- Timing
    started_at DATETIME COMMENT '开始处理时间',
    completed_at DATETIME COMMENT '完成时间',

    -- Metadata
    notes VARCHAR(500) COMMENT '任务备注',

    -- Audit Fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    -- Indexes
    INDEX idx_task_number (task_number),
    INDEX idx_factory_id (factory_id),
    INDEX idx_status (status),
    INDEX idx_factory_status (factory_id, status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='批量语音识别任务';
