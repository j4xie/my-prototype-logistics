-- APS 自适应调度模块数据库变更 (PostgreSQL 版本)
-- Created: 2026-01-21
-- Description: 添加自适应调度所需的表结构和字段，支持效率跟踪、概率预测和策略权重调整
-- Converted from MySQL to PostgreSQL

-- ============================================
-- 1. 修改 line_schedules 表 - 添加实际执行和预测信息字段
-- ============================================

-- 使用 PL/pgSQL 函数安全添加列（如果不存在）
DROP FUNCTION IF EXISTS add_column_if_not_exists(VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION add_column_if_not_exists(
    p_table_name VARCHAR(64),
    p_column_name VARCHAR(64),
    p_column_definition VARCHAR(255)
)
RETURNS void AS $$
DECLARE
    v_column_exists INT;
BEGIN
    SELECT COUNT(*) INTO v_column_exists
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = p_table_name
      AND column_name = p_column_name;

    IF v_column_exists = 0 THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', p_table_name, p_column_name, p_column_definition);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 1.1 为 line_schedules 表添加新字段
SELECT add_column_if_not_exists('line_schedules', 'plan_efficiency', 'DECIMAL(10,2)');
SELECT add_column_if_not_exists('line_schedules', 'efficiency_variance', 'DECIMAL(5,2)');
SELECT add_column_if_not_exists('line_schedules', 'predicted_end', 'TIMESTAMP');
SELECT add_column_if_not_exists('line_schedules', 'risk_level', 'VARCHAR(20) DEFAULT ''low''');
SELECT add_column_if_not_exists('line_schedules', 'adjustment_count', 'INT DEFAULT 0');
SELECT add_column_if_not_exists('line_schedules', 'last_adjustment_time', 'TIMESTAMP');
SELECT add_column_if_not_exists('line_schedules', 'adjustment_reason', 'VARCHAR(200)');

-- 添加注释
COMMENT ON COLUMN line_schedules.plan_efficiency IS '计划效率(件/小时)';
COMMENT ON COLUMN line_schedules.efficiency_variance IS '效率偏差%';
COMMENT ON COLUMN line_schedules.predicted_end IS '预测完成时间';
COMMENT ON COLUMN line_schedules.risk_level IS '风险等级(low/medium/high/critical)';
COMMENT ON COLUMN line_schedules.adjustment_count IS '调整次数';
COMMENT ON COLUMN line_schedules.last_adjustment_time IS '最后调整时间';
COMMENT ON COLUMN line_schedules.adjustment_reason IS '调整原因';

-- ============================================
-- 2. 修改 production_lines 表 - 添加效率因子字段
-- ============================================

SELECT add_column_if_not_exists('production_lines', 'efficiency_factor', 'DECIMAL(5,4) DEFAULT 1.0000');
SELECT add_column_if_not_exists('production_lines', 'rolling_efficiency', 'DECIMAL(5,4) DEFAULT 1.0000');

COMMENT ON COLUMN production_lines.efficiency_factor IS '效率因子(1.0为标准)';
COMMENT ON COLUMN production_lines.rolling_efficiency IS '滚动效率(EWMA计算)';

-- 清理函数
DROP FUNCTION IF EXISTS add_column_if_not_exists(VARCHAR, VARCHAR, VARCHAR);

-- ============================================
-- 3. 创建效率历史记录表 aps_efficiency_history
-- ============================================

CREATE TABLE IF NOT EXISTS aps_efficiency_history (
    id VARCHAR(36) PRIMARY KEY,
    line_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36),
    recorded_at TIMESTAMP NOT NULL,
    actual_output DECIMAL(10,2),
    expected_output DECIMAL(10,2),
    efficiency_ratio DECIMAL(5,4),
    worker_count INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE aps_efficiency_history IS '效率历史记录表';
COMMENT ON COLUMN aps_efficiency_history.line_id IS '产线ID';
COMMENT ON COLUMN aps_efficiency_history.task_id IS '任务ID';
COMMENT ON COLUMN aps_efficiency_history.recorded_at IS '记录时间';
COMMENT ON COLUMN aps_efficiency_history.actual_output IS '实际产出';
COMMENT ON COLUMN aps_efficiency_history.expected_output IS '预期产出';
COMMENT ON COLUMN aps_efficiency_history.efficiency_ratio IS '效率比率';
COMMENT ON COLUMN aps_efficiency_history.worker_count IS '当时工人数';

CREATE INDEX IF NOT EXISTS idx_efficiency_line_time ON aps_efficiency_history(line_id, recorded_at);

-- ============================================
-- 4. 创建策略权重历史表 aps_weight_history
-- ============================================

CREATE TABLE IF NOT EXISTS aps_weight_history (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    adjusted_at TIMESTAMP NOT NULL,
    weights_before JSONB,
    weights_after JSONB,
    trigger_reason VARCHAR(200),
    performance_metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE aps_weight_history IS '策略权重调整历史';
COMMENT ON COLUMN aps_weight_history.factory_id IS '工厂ID';
COMMENT ON COLUMN aps_weight_history.adjusted_at IS '调整时间';
COMMENT ON COLUMN aps_weight_history.weights_before IS '调整前权重';
COMMENT ON COLUMN aps_weight_history.weights_after IS '调整后权重';
COMMENT ON COLUMN aps_weight_history.trigger_reason IS '触发原因';
COMMENT ON COLUMN aps_weight_history.performance_metrics IS '当时性能指标';

CREATE INDEX IF NOT EXISTS idx_weight_factory_time ON aps_weight_history(factory_id, adjusted_at);

-- ============================================
-- 5. 创建完成概率预测模型权重表 aps_prediction_model_weights
-- ============================================

CREATE TABLE IF NOT EXISTS aps_prediction_model_weights (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    feature_name VARCHAR(50) NOT NULL,
    feature_weight DECIMAL(8,6) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_factory_feature UNIQUE (factory_id, feature_name)
);

COMMENT ON TABLE aps_prediction_model_weights IS '完成概率预测模型权重';
COMMENT ON COLUMN aps_prediction_model_weights.factory_id IS '工厂ID';
COMMENT ON COLUMN aps_prediction_model_weights.feature_name IS '特征名称';
COMMENT ON COLUMN aps_prediction_model_weights.feature_weight IS '特征权重';

-- 创建触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_prediction_model_weights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prediction_model_weights_updated_at ON aps_prediction_model_weights;
CREATE TRIGGER trg_prediction_model_weights_updated_at
    BEFORE UPDATE ON aps_prediction_model_weights
    FOR EACH ROW
    EXECUTE FUNCTION update_prediction_model_weights_updated_at();

-- ============================================
-- 6. 插入默认权重数据
-- ============================================

-- 使用 ON CONFLICT 避免重复插入错误（基于 UNIQUE 约束）
INSERT INTO aps_prediction_model_weights (id, factory_id, feature_name, feature_weight) VALUES
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'progress_percent', 0.300000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'time_urgency', -0.200000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'efficiency_deviation', 0.150000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'worker_config', 0.100000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'historical_completion_rate', 0.100000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'current_delay', -0.100000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'material_ready_rate', 0.050000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'is_urgent', -0.050000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'time_window_width', 0.050000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'bias', 0.000000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'efficiency_trend', 0.050000),
    (gen_random_uuid()::VARCHAR(36), 'DEFAULT', 'conflict_count', -0.050000)
ON CONFLICT (factory_id, feature_name) DO NOTHING;
