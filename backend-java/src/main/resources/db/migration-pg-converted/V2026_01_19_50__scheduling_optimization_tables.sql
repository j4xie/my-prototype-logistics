-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_19_50__scheduling_optimization_tables.sql
-- Conversion date: 2026-01-26 18:49:00
-- WARNING: This file requires manual review!
-- ============================================

-- =====================================================
-- 排班优化特征表 - 支持公平性MAB和特征学习
-- V2026_01_19_50__scheduling_optimization_tables.sql
-- =====================================================

-- 1. 工人特征画像表
CREATE TABLE IF NOT EXISTS worker_feature_profile (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    worker_id BIGINT NOT NULL,

    -- 工序效率 (JSON: {"TRIMMING": 0.92, "SLICING": 0.85})
    process_efficiency JSON NULL,

    -- 疲劳特征
    fatigue_decay_rate DOUBLE PRECISION DEFAULT 0.05 COMMENT '每小时疲劳衰减率',
    optimal_work_hours DOUBLE PRECISION DEFAULT 6.0 COMMENT '最佳工作时长',

    -- 技能特征
    skill_growth_rate DOUBLE PRECISION DEFAULT 0.0 COMMENT '技能成长率(每周)',
    current_skill_level INT DEFAULT 1,

    -- 协作特征 (JSON: [101, 105, 108])
    preferred_coworkers JSON NULL COMMENT '偏好协作工人ID',

    -- 学习来源
    sample_count INT DEFAULT 0 COMMENT '学习样本数',
    confidence_score DOUBLE PRECISION DEFAULT 0.5 COMMENT '特征置信度',

    -- 审计
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_learned_at TIMESTAMP WITH TIME ZONE NULL COMMENT '最后学习时间',

    UNIQUE KEY uk_factory_worker (factory_id, worker_id),
    INDEX idx_skill_level (factory_id, current_skill_level)
);

-- 2. SKU特征画像表
CREATE TABLE IF NOT EXISTS sku_feature_profile (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    sku_code VARCHAR(100) NOT NULL,
    sku_name VARCHAR(200) NULL,

    -- 复杂度 (自动学习)
    learned_complexity DOUBLE PRECISION DEFAULT 3.0 COMMENT '学习得到的复杂度',
    manual_complexity INT NULL COMMENT '人工设置的复杂度',

    -- 各工序复杂度
    process_complexity JSON NULL COMMENT '{"TRIMMING": 3, "SLICING": 4}',

    -- 最佳工人特征
    min_skill_required INT DEFAULT 1,
    preferred_worker_type VARCHAR(50) DEFAULT 'ANY',
    avg_process_time_minutes INT DEFAULT 30,

    -- 学习来源
    sample_count INT DEFAULT 0,
    avg_efficiency DOUBLE PRECISION DEFAULT 0.0 COMMENT '历史平均效率',
    failure_rate DOUBLE PRECISION DEFAULT 0.0 COMMENT '失败率',

    -- 审计
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_factory_sku (factory_id, sku_code),
    INDEX idx_complexity (factory_id, learned_complexity)
);

-- 3. 公平性虚拟队列表
CREATE TABLE IF NOT EXISTS fair_mab_virtual_queue (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    worker_id BIGINT NOT NULL,

    -- 虚拟队列状态
    queue_length DOUBLE PRECISION DEFAULT 0.0 COMMENT '虚拟队列长度(公平性债务)',
    target_ratio DOUBLE PRECISION DEFAULT 0.0 COMMENT '目标分配比例',
    actual_ratio DOUBLE PRECISION DEFAULT 0.0 COMMENT '实际分配比例',

    -- 统计
    total_assignments INT DEFAULT 0 COMMENT '总分配次数',
    period_assignments INT DEFAULT 0 COMMENT '周期内分配次数',
    last_assignment_at TIMESTAMP WITH TIME ZONE NULL,

    -- 审计
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    period_start_at TIMESTAMP WITH TIME ZONE NULL COMMENT '统计周期开始时间',

    UNIQUE KEY uk_factory_worker (factory_id, worker_id),
    INDEX idx_queue_length (factory_id, queue_length DESC)
);

-- 4. 特征漂移日志表
CREATE TABLE IF NOT EXISTS scheduling_feature_drift_log (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,

    -- 漂移类型
    drift_type VARCHAR(50) NOT NULL COMMENT 'WORKER_SKILL/WORKER_EFFICIENCY/SKU_COMPLEXITY',
    entity_type VARCHAR(50) NOT NULL COMMENT 'WORKER/SKU',
    entity_id VARCHAR(100) NOT NULL,

    -- 漂移详情
    old_value DOUBLE PRECISION NULL,
    new_value DOUBLE PRECISION NULL,
    drift_magnitude DOUBLE PRECISION NULL COMMENT '漂移幅度',

    -- 触发的动作
    action_taken VARCHAR(200) NULL COMMENT '采取的动作',

    -- 审计
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_factory_time (factory_id, detected_at),
    INDEX idx_drift_type (drift_type, detected_at)
);

-- =====================================================
-- 插入示例数据
-- =====================================================

-- 示例工人特征
INSERT INTO worker_feature_profile (factory_id, worker_id, process_efficiency, current_skill_level, sample_count, confidence_score) VALUES
('F001', 1, '{"TRIMMING": 0.92, "SLICING": 0.88, "MIXING": 0.75}', 4, 150, 0.9),
('F001', 2, '{"TRIMMING": 0.85, "SLICING": 0.90, "QUALITY_CHECK": 0.95}', 4, 120, 0.85),
('F001', 3, '{"TRIMMING": 0.78, "SLICING": 0.72}', 2, 45, 0.6),
('F001', 4, '{"TRIMMING": 0.65}', 1, 10, 0.3);

-- 示例SKU特征
INSERT INTO sku_feature_profile (factory_id, sku_code, sku_name, learned_complexity, min_skill_required, preferred_worker_type) VALUES
('F001', 'SKU001', '标准猪肉切片', 2.1, 1, 'ANY'),
('F001', 'SKU002', '精品五花肉', 4.2, 3, 'EXPERIENCED'),
('F001', 'SKU003', '猪蹄处理', 4.8, 4, 'EXPERIENCED');

-- 初始化虚拟队列
INSERT INTO fair_mab_virtual_queue (factory_id, worker_id, target_ratio, actual_ratio, total_assignments) VALUES
('F001', 1, 0.125, 0.18, 45),
('F001', 2, 0.125, 0.15, 38),
('F001', 3, 0.125, 0.08, 20),
('F001', 4, 0.125, 0.05, 12);
