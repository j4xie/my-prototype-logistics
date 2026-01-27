-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V20260121__aps_adaptive_scheduling.sql
-- Conversion date: 2026-01-26 18:46:50
-- WARNING: This file requires manual review!
-- ============================================

-- APS 自适应调度模块数据库变更
-- Created: 2026-01-21
-- Description: 添加自适应调度所需的表结构和字段，支持效率跟踪、概率预测和策略权重调整

-- ============================================
-- 1. 修改 line_schedules 表 - 添加实际执行和预测信息字段
-- ============================================

-- 使用存储过程安全添加列（如果不存在）
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

DELIMITER //

CREATE PROCEDURE add_column_if_not_exists(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition VARCHAR(255)
)
BEGIN
    DECLARE v_column_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO v_column_exists
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name;

    IF v_column_exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', p_table_name, ' ADD COLUMN ', p_column_name, ' ', p_column_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DELIMITER ;

-- 1.1 为 line_schedules 表添加新字段
CALL add_column_if_not_exists('line_schedules', 'plan_efficiency', "DECIMAL(10,2) COMMENT '计划效率(件/小时)'");
CALL add_column_if_not_exists('line_schedules', 'efficiency_variance', "DECIMAL(5,2) COMMENT '效率偏差%'");
CALL add_column_if_not_exists('line_schedules', 'predicted_end', "TIMESTAMP WITH TIME ZONE COMMENT '预测完成时间'");
CALL add_column_if_not_exists('line_schedules', 'risk_level', "VARCHAR(20) DEFAULT 'low' COMMENT '风险等级(low/medium/high/critical)'");
CALL add_column_if_not_exists('line_schedules', 'adjustment_count', "INT DEFAULT 0 COMMENT '调整次数'");
CALL add_column_if_not_exists('line_schedules', 'last_adjustment_time', "TIMESTAMP WITH TIME ZONE COMMENT '最后调整时间'");
CALL add_column_if_not_exists('line_schedules', 'adjustment_reason', "VARCHAR(200) COMMENT '调整原因'");

-- ============================================
-- 2. 修改 production_lines 表 - 添加效率因子字段
-- ============================================

CALL add_column_if_not_exists('production_lines', 'efficiency_factor', "DECIMAL(5,4) DEFAULT 1.0000 COMMENT '效率因子(1.0为标准)'");
CALL add_column_if_not_exists('production_lines', 'rolling_efficiency', "DECIMAL(5,4) DEFAULT 1.0000 COMMENT '滚动效率(EWMA计算)'");

-- 清理存储过程
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

-- ============================================
-- 3. 创建效率历史记录表 aps_efficiency_history
-- ============================================

CREATE TABLE IF NOT EXISTS aps_efficiency_history (
    id VARCHAR(36) PRIMARY KEY,
    line_id VARCHAR(36) NOT NULL COMMENT '产线ID',
    task_id VARCHAR(36) COMMENT '任务ID',
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '记录时间',
    actual_output DECIMAL(10,2) COMMENT '实际产出',
    expected_output DECIMAL(10,2) COMMENT '预期产出',
    efficiency_ratio DECIMAL(5,4) COMMENT '效率比率',
    worker_count INT COMMENT '当时工人数',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_line_time (line_id, recorded_at)
);

-- ============================================
-- 4. 创建策略权重历史表 aps_weight_history
-- ============================================

CREATE TABLE IF NOT EXISTS aps_weight_history (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    adjusted_at TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '调整时间',
    weights_before JSON COMMENT '调整前权重',
    weights_after JSON COMMENT '调整后权重',
    trigger_reason VARCHAR(200) COMMENT '触发原因',
    performance_metrics JSON COMMENT '当时性能指标',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factory_time (factory_id, adjusted_at)
);

-- ============================================
-- 5. 创建完成概率预测模型权重表 aps_prediction_model_weights
-- ============================================

CREATE TABLE IF NOT EXISTS aps_prediction_model_weights (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    feature_name VARCHAR(50) NOT NULL COMMENT '特征名称',
    feature_weight DECIMAL(8,6) NOT NULL COMMENT '特征权重',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_factory_feature (factory_id, feature_name)
);

-- ============================================
-- 6. 插入默认权重数据
-- ============================================

-- 使用 INSERT IGNORE 避免重复插入错误（基于 UNIQUE KEY）
-- TODO: Add ON CONFLICT DO NOTHING clause
INSERT INTO aps_prediction_model_weights (id, factory_id, feature_name, feature_weight) VALUES
(UUID(), 'DEFAULT', 'progress_percent', 0.300000),
(UUID(), 'DEFAULT', 'time_urgency', -0.200000),
(UUID(), 'DEFAULT', 'efficiency_deviation', 0.150000),
(UUID(), 'DEFAULT', 'worker_config', 0.100000),
(UUID(), 'DEFAULT', 'historical_completion_rate', 0.100000),
(UUID(), 'DEFAULT', 'current_delay', -0.100000),
(UUID(), 'DEFAULT', 'material_ready_rate', 0.050000),
(UUID(), 'DEFAULT', 'is_urgent', -0.050000),
(UUID(), 'DEFAULT', 'time_window_width', 0.050000),
(UUID(), 'DEFAULT', 'bias', 0.000000),
(UUID(), 'DEFAULT', 'efficiency_trend', 0.050000),
(UUID(), 'DEFAULT', 'conflict_count', -0.050000);
