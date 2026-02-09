-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_19_40__factory_scheduling_config.sql
-- Conversion date: 2026-01-26 18:48:59
-- WARNING: This file requires manual review!
-- ============================================

-- 工厂调度配置表 - 支持动态个性化参数
-- 解决问题:
-- 1. 每个工厂有不同的调度需求
-- 2. 临时工和正式工需要不同的处理策略
-- 3. SKU/产品复杂度影响任务分配
-- 4. 参数需要根据反馈自动调整

CREATE TABLE IF NOT EXISTS factory_scheduling_config (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL UNIQUE COMMENT '工厂ID',

    -- 基础配置
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用动态配置',
    diversity_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用多样性调整',

    -- 权重参数
    linucb_weight DOUBLE PRECISION DEFAULT 0.60 COMMENT 'LinUCB分数权重',
    fairness_weight DOUBLE PRECISION DEFAULT 0.15 COMMENT '公平性加分权重',
    skill_maintenance_weight DOUBLE PRECISION DEFAULT 0.15 COMMENT '技能维护加分权重',
    repetition_weight DOUBLE PRECISION DEFAULT 0.10 COMMENT '重复惩罚权重',

    -- 时间参数
    skill_decay_days INT DEFAULT 30 COMMENT '技能遗忘判定天数',
    fairness_period_days INT DEFAULT 14 COMMENT '公平性计算周期天数',
    repetition_days INT DEFAULT 3 COMMENT '重复判定天数',
    max_consecutive_days INT DEFAULT 5 COMMENT '最大同工序连续天数',

    -- 临时工配置
    temp_worker_linucb_factor DOUBLE PRECISION DEFAULT 0.7 COMMENT '临时工LinUCB权重调整因子',
    temp_worker_fairness_factor DOUBLE PRECISION DEFAULT 1.5 COMMENT '临时工公平性权重调整因子',
    temp_worker_skill_decay_days INT DEFAULT 14 COMMENT '临时工技能遗忘天数',
    temp_worker_threshold_days INT DEFAULT 30 COMMENT '临时工判定天数',
    temp_worker_min_assignments INT DEFAULT 3 COMMENT '临时工每周最低分配数',

    -- SKU复杂度配置
    sku_complexity_weight DOUBLE PRECISION DEFAULT 0.15 COMMENT 'SKU复杂度权重',
    high_complexity_skill_threshold INT DEFAULT 3 COMMENT '高复杂度SKU技能阈值',
    low_complexity_for_training BOOLEAN DEFAULT TRUE COMMENT '低复杂度SKU优先给新人',

    -- 自适应学习配置
    adaptive_learning_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用自适应学习',
    learning_rate DOUBLE PRECISION DEFAULT 0.05 COMMENT '学习率',
    min_samples_for_adaptation INT DEFAULT 50 COMMENT '最小样本数',
    efficiency_target DOUBLE PRECISION DEFAULT 0.85 COMMENT '效率提升目标',
    diversity_target DOUBLE PRECISION DEFAULT 0.70 COMMENT '多样性目标',

    -- 异常检测配置
    anomaly_detection_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用异常检测',
    efficiency_anomaly_threshold DOUBLE PRECISION DEFAULT 0.50 COMMENT '效率异常阈值',
    anomaly_count_for_calibration INT DEFAULT 3 COMMENT '触发校准的异常次数',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_adaptation_at TIMESTAMP WITH TIME ZONE NULL COMMENT '最后自适应调整时间',
    adaptation_count INT DEFAULT 0 COMMENT '调整次数统计',

    INDEX idx_factory_id (factory_id),
    INDEX idx_adaptive_learning (adaptive_learning_enabled, last_adaptation_at)
);

-- 插入默认工厂配置 (F001)
INSERT INTO factory_scheduling_config (factory_id, enabled, diversity_enabled)
VALUES ('F001', TRUE, TRUE)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 临时工记录表 - 追踪临时工状态
CREATE TABLE IF NOT EXISTS factory_temp_worker (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    worker_id BIGINT NOT NULL COMMENT '工人ID',

    -- 临时工状态
    is_temp_worker BOOLEAN DEFAULT TRUE COMMENT '是否为临时工',
    hire_date DATE NOT NULL COMMENT '入职日期',
    expected_end_date DATE NULL COMMENT '预计结束日期',
    converted_to_permanent BOOLEAN DEFAULT FALSE COMMENT '是否已转正',
    conversion_date DATE NULL COMMENT '转正日期',

    -- 技能快照
    initial_skill_level INT DEFAULT 1 COMMENT '初始技能等级',
    current_skill_level INT DEFAULT 1 COMMENT '当前技能等级',
    skill_growth_rate DOUBLE PRECISION DEFAULT 0.0 COMMENT '技能成长率',

    -- 绩效追踪
    total_assignments INT DEFAULT 0 COMMENT '总分配次数',
    avg_efficiency DOUBLE PRECISION DEFAULT 0.0 COMMENT '平均效率',
    reliability_score DOUBLE PRECISION DEFAULT 0.5 COMMENT '可靠性评分 (出勤率等)',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_factory_worker (factory_id, worker_id),
    INDEX idx_temp_status (factory_id, is_temp_worker, converted_to_permanent)
);

-- SKU复杂度配置表
CREATE TABLE IF NOT EXISTS sku_complexity_config (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    sku_code VARCHAR(100) NOT NULL COMMENT 'SKU编码',
    sku_name VARCHAR(200) NULL COMMENT 'SKU名称',

    -- 复杂度评级 (1-5)
    complexity_level INT DEFAULT 3 COMMENT '复杂度等级',

    -- 各工序复杂度 (JSON格式存储)
    -- {"TRIMMING": 3, "SLICING": 4, "MIXING": 2}
    process_complexity JSON NULL COMMENT '各工序复杂度',

    -- 推荐配置
    min_skill_level INT DEFAULT 1 COMMENT '最低技能等级要求',
    preferred_worker_type VARCHAR(50) DEFAULT 'ANY' COMMENT '推荐工人类型 (ANY/EXPERIENCED/TRAINEE)',
    estimated_time_minutes INT DEFAULT 30 COMMENT '预估处理时间(分钟)',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_factory_sku (factory_id, sku_code),
    INDEX idx_complexity (factory_id, complexity_level)
);

-- 插入示例SKU复杂度数据
INSERT INTO sku_complexity_config (factory_id, sku_code, sku_name, complexity_level, min_skill_level, preferred_worker_type) VALUES
('F001', 'SKU001', '标准猪肉切片', 2, 1, 'ANY'),
('F001', 'SKU002', '精品五花肉', 4, 3, 'EXPERIENCED'),
('F001', 'SKU003', '猪蹄处理', 5, 4, 'EXPERIENCED'),
('F001', 'SKU004', '猪骨切割', 3, 2, 'ANY'),
('F001', 'SKU005', '香肠绞肉', 2, 1, 'TRAINEE'),
('F001', 'SKU006', '腊肉腌制', 4, 3, 'EXPERIENCED')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 自适应学习日志表 - 记录参数调整历史
CREATE TABLE IF NOT EXISTS scheduling_adaptation_log (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

    -- 调整前参数
    old_linucb_weight DOUBLE PRECISION NULL,
    old_fairness_weight DOUBLE PRECISION NULL,
    old_skill_maintenance_weight DOUBLE PRECISION NULL,
    old_repetition_weight DOUBLE PRECISION NULL,

    -- 调整后参数
    new_linucb_weight DOUBLE PRECISION NULL,
    new_fairness_weight DOUBLE PRECISION NULL,
    new_skill_maintenance_weight DOUBLE PRECISION NULL,
    new_repetition_weight DOUBLE PRECISION NULL,

    -- 触发原因
    trigger_reason VARCHAR(100) NOT NULL COMMENT '调整原因',
    -- EFFICIENCY_LOW: 效率低于目标
    -- DIVERSITY_LOW: 多样性低于目标
    -- ANOMALY_DETECTED: 检测到异常
    -- MANUAL: 人工调整

    -- 调整时的指标
    current_efficiency DOUBLE PRECISION NULL COMMENT '当前效率',
    current_diversity DOUBLE PRECISION NULL COMMENT '当前多样性',
    sample_count INT NULL COMMENT '样本数量',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_factory_time (factory_id, created_at)
);
