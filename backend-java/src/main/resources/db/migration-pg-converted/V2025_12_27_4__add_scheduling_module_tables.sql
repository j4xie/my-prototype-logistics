-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_27_4__add_scheduling_module_tables.sql
-- Conversion date: 2026-01-26 18:45:48
-- WARNING: This file requires manual review!
-- ============================================

-- AI 智能调度模块数据库表
-- Created: 2025-12-27
-- Description: 支持自动排产、人员调度、实时监控、概率预测

-- 1. 产线配置表
CREATE TABLE IF NOT EXISTS production_lines (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    department_id BIGINT,
    name VARCHAR(100) NOT NULL,
    line_code VARCHAR(50),
    line_type VARCHAR(50) COMMENT '产线类型: processing, packaging, quality_check',
    min_workers INT DEFAULT 1,
    max_workers INT DEFAULT 10,
    required_skill_level INT DEFAULT 1 COMMENT '所需技能等级 1-5',
    hourly_capacity DECIMAL(10,2) COMMENT '小时产能',
    equipment_ids TEXT COMMENT '关联设备ID列表，逗号分隔',
    status ENUM('active', 'maintenance', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    INDEX idx_factory (factory_id),
    INDEX idx_department (department_id),
    INDEX idx_status (status)
);

-- 2. 调度计划表 (每日/每周计划)
CREATE TABLE IF NOT EXISTS scheduling_plans (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    plan_name VARCHAR(100),
    plan_date DATE NOT NULL,
    plan_type ENUM('daily', 'weekly') DEFAULT 'daily',
    status ENUM('draft', 'confirmed', 'in_progress', 'completed', 'cancelled') DEFAULT 'draft',
    total_batches INT DEFAULT 0,
    total_workers INT DEFAULT 0,
    ai_generated BOOLEAN DEFAULT FALSE COMMENT '是否AI生成',
    ai_confidence DECIMAL(5,4) COMMENT 'AI置信度 0-1',
    notes TEXT,
    created_by BIGINT,
    confirmed_by BIGINT,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    UNIQUE KEY uk_factory_date (factory_id, plan_date),
    INDEX idx_status (status),
    INDEX idx_plan_date (plan_date)
);

-- 3. 产线排程表 (批次-产线-时间安排)
CREATE TABLE IF NOT EXISTS line_schedules (
    id VARCHAR(36) PRIMARY KEY,
    plan_id VARCHAR(36) NOT NULL,
    production_line_id VARCHAR(36) NOT NULL,
    batch_id BIGINT COMMENT '关联的生产批次',
    sequence_order INT DEFAULT 0 COMMENT '排程顺序',
    planned_start_time TIMESTAMP WITH TIME ZONE,
    planned_end_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    assigned_workers INT DEFAULT 0,
    planned_quantity INT,
    completed_quantity INT DEFAULT 0,
    predicted_efficiency DECIMAL(5,2) COMMENT '预测效率 0-1',
    actual_efficiency DECIMAL(5,2) COMMENT '实际效率 0-1',
    predicted_completion_prob DECIMAL(5,4) COMMENT '预测完成概率 0-1',
    status ENUM('pending', 'in_progress', 'completed', 'delayed', 'cancelled') DEFAULT 'pending',
    delay_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES scheduling_plans(id) ON DELETE CASCADE,
    INDEX idx_batch (batch_id),
    INDEX idx_line (production_line_id),
    INDEX idx_status (status),
    INDEX idx_planned_time (planned_start_time, planned_end_time)
);

-- 4. 工人分配表
CREATE TABLE IF NOT EXISTS worker_assignments (
    id VARCHAR(36) PRIMARY KEY,
    schedule_id VARCHAR(36) NOT NULL,
    user_id BIGINT NOT NULL,
    assignment_type ENUM('primary', 'support', 'temporary') DEFAULT 'primary',
    skill_level INT COMMENT '工人技能等级',
    is_temporary BOOLEAN DEFAULT FALSE COMMENT '是否临时工',
    hourly_rate DECIMAL(10,2) COMMENT '时薪',
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    planned_start_time TIMESTAMP WITH TIME ZONE,
    planned_end_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    actual_work_minutes INT DEFAULT 0,
    labor_cost DECIMAL(10,2),
    performance_score DECIMAL(5,2) COMMENT '绩效评分 0-100',
    status ENUM('assigned', 'checked_in', 'working', 'checked_out', 'absent') DEFAULT 'assigned',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES line_schedules(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_schedule (schedule_id)
);

-- 5. AI预测记录表
CREATE TABLE IF NOT EXISTS scheduling_predictions (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    schedule_id VARCHAR(36),
    batch_id BIGINT,
    prediction_type ENUM('efficiency', 'duration', 'completion_prob', 'quality', 'worker_need') NOT NULL,
    predicted_value DECIMAL(10,4),
    confidence_lower DECIMAL(10,4) COMMENT '置信区间下限',
    confidence_upper DECIMAL(10,4) COMMENT '置信区间上限',
    actual_value DECIMAL(10,4) COMMENT '实际值（用于模型反馈）',
    model_type VARCHAR(50) COMMENT 'lightgbm, monte_carlo, llm, or_tools',
    model_version VARCHAR(20),
    features_json TEXT COMMENT '预测使用的特征JSON',
    reasoning TEXT COMMENT 'LLM推理过程',
    is_cold_start BOOLEAN DEFAULT FALSE,
    prediction_error DECIMAL(10,4) COMMENT '预测误差',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factory (factory_id),
    INDEX idx_schedule (schedule_id),
    INDEX idx_batch (batch_id),
    INDEX idx_type (prediction_type),
    INDEX idx_created (created_at)
);

-- 6. 调度告警表
CREATE TABLE IF NOT EXISTS scheduling_alerts (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    plan_id VARCHAR(36),
    schedule_id VARCHAR(36),
    batch_id BIGINT,
    alert_type ENUM(
        'low_probability',      -- 完成概率低
        'resource_conflict',    -- 资源冲突
        'deadline_risk',        -- 交期风险
        'efficiency_drop',      -- 效率下降
        'worker_shortage',      -- 人员不足
        'equipment_issue',      -- 设备问题
        'quality_risk'          -- 质量风险
    ) NOT NULL,
    severity ENUM('info', 'warning', 'critical') DEFAULT 'warning',
    title VARCHAR(200),
    message TEXT,
    suggested_action TEXT COMMENT 'AI建议的处理方案',
    related_data JSON COMMENT '相关数据',
    probability_value DECIMAL(5,4) COMMENT '触发告警的概率值',
    threshold_value DECIMAL(5,4) COMMENT '阈值',
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by BIGINT,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by BIGINT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factory (factory_id),
    INDEX idx_plan (plan_id),
    INDEX idx_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_resolved (is_resolved),
    INDEX idx_created (created_at)
);

-- 7. 调度配置表 (阈值、参数)
CREATE TABLE IF NOT EXISTS scheduling_configs (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT,
    config_type VARCHAR(50) COMMENT 'threshold, parameter, feature_flag',
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_factory_key (factory_id, config_key)
);

-- 插入默认配置
INSERT INTO scheduling_configs (id, factory_id, config_key, config_value, config_type, description) VALUES
(UUID(), 'DEFAULT', 'completion_prob_warning_threshold', '0.7', 'threshold', '完成概率警告阈值'),
(UUID(), 'DEFAULT', 'completion_prob_critical_threshold', '0.5', 'threshold', '完成概率严重阈值'),
(UUID(), 'DEFAULT', 'efficiency_drop_threshold', '0.15', 'threshold', '效率下降阈值（15%）'),
(UUID(), 'DEFAULT', 'monte_carlo_simulations', '10000', 'parameter', 'Monte Carlo模拟次数'),
(UUID(), 'DEFAULT', 'cold_start_batch_threshold', '50', 'parameter', '冷启动批次阈值'),
(UUID(), 'DEFAULT', 'realtime_polling_interval', '30', 'parameter', '实时监控轮询间隔（秒）'),
(UUID(), 'DEFAULT', 'enable_auto_reschedule', 'false', 'feature_flag', '是否启用自动重排'),
(UUID(), 'DEFAULT', 'enable_llm_insights', 'true', 'feature_flag', '是否启用LLM洞察');
