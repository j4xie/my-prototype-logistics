-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_28__ml_training_tables.sql
-- Conversion date: 2026-01-26 18:45:53
-- WARNING: This file requires manual review!
-- ============================================

-- ML训练数据表 - 存储生产批次完成后的特征数据
CREATE TABLE IF NOT EXISTS scheduling_training_data (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    batch_id BIGINT NOT NULL,

    -- 时间特征
    hour_of_day INT COMMENT '完成时的小时',
    day_of_week INT COMMENT '星期几(1-7)',
    is_overtime BOOLEAN DEFAULT FALSE COMMENT '是否加班',

    -- 工人特征
    worker_count INT DEFAULT 0 COMMENT '参与工人数',
    avg_worker_experience_days INT DEFAULT 0 COMMENT '平均工作经验(天)',
    avg_skill_level DECIMAL(3,2) DEFAULT 1.00 COMMENT '平均技能等级(1-5)',
    temporary_worker_ratio DECIMAL(5,4) DEFAULT 0.0000 COMMENT '临时工比例',

    -- 产品特征
    product_complexity INT DEFAULT 1 COMMENT '产品复杂度(1-10)',
    product_type VARCHAR(50) COMMENT '产品类型编码',

    -- 设备特征
    equipment_age_days INT DEFAULT 0 COMMENT '设备使用天数',
    equipment_utilization DECIMAL(5,4) DEFAULT 0.0000 COMMENT '设备利用率',

    -- 标签数据 (实际结果)
    actual_efficiency DECIMAL(10,2) COMMENT '实际效率(件/人/小时)',
    actual_duration_hours DECIMAL(10,2) COMMENT '实际用时(小时)',
    quality_pass_rate DECIMAL(5,4) DEFAULT 1.0000 COMMENT '质量合格率',

    -- 元数据
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_factory_id (factory_id),
    INDEX idx_batch_id (batch_id),
    INDEX idx_factory_recorded (factory_id, recorded_at),
    INDEX idx_product_type (product_type)
);

-- ML模型版本表 - 管理训练好的模型
CREATE TABLE IF NOT EXISTS ml_model_versions (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL COMMENT 'efficiency/duration/quality',
    version VARCHAR(20) NOT NULL COMMENT '版本号(时间戳)',

    -- 训练信息
    training_data_count INT DEFAULT 0 COMMENT '训练数据量',
    rmse DECIMAL(10,4) COMMENT '均方根误差',
    r2_score DECIMAL(5,4) COMMENT 'R²决定系数',
    mae DECIMAL(10,4) COMMENT '平均绝对误差',

    -- 模型文件
    model_path VARCHAR(255) COMMENT '模型文件路径',
    features_json TEXT COMMENT '使用的特征列表(JSON)',

    -- 状态
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活使用',
    status VARCHAR(20) DEFAULT 'trained' COMMENT 'training/trained/failed/deprecated',

    -- 时间
    trained_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_factory_type (factory_id, model_type),
    INDEX idx_factory_active (factory_id, is_active),
    UNIQUE KEY uk_factory_type_active (factory_id, model_type, is_active)
);

-- 插入初始说明记录(可选)
-- INSERT INTO ml_model_versions (id, factory_id, model_type, version, status, is_active)
-- VALUES (UUID(), 'F001', 'efficiency', '20251228_init', 'pending', FALSE);
