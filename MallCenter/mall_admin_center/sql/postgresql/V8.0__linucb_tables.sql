-- =====================================================
-- LinUCB 强化学习算法表结构 - PostgreSQL 版本
-- 用于上下文感知的个性化推荐探索
-- 创建时间: 2025-12-27
-- Converted from MySQL
-- =====================================================

-- 1. LinUCB 臂参数表
-- 存储每个分类/商品的 A 矩阵、b 向量和 theta 参数
DROP TABLE IF EXISTS linucb_arm_parameters CASCADE;
CREATE TABLE linucb_arm_parameters (
    id BIGSERIAL PRIMARY KEY,
    arm_id VARCHAR(64) NOT NULL,
    arm_type VARCHAR(32) NOT NULL DEFAULT 'category',

    -- LinUCB 核心参数
    a_matrix TEXT,
    b_vector TEXT,
    theta_vector TEXT,
    feature_dimension INT NOT NULL DEFAULT 40,

    -- 统计数据
    selection_count INT NOT NULL DEFAULT 0,
    positive_feedback_count INT NOT NULL DEFAULT 0,
    negative_feedback_count INT NOT NULL DEFAULT 0,
    cumulative_reward DECIMAL(15,6) NOT NULL DEFAULT 0,
    expected_ctr DECIMAL(10,6) NOT NULL DEFAULT 0,

    -- 元数据
    algorithm_version VARCHAR(16) DEFAULT '1.0',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (arm_id, arm_type)
);

CREATE INDEX idx_linucb_arm_type ON linucb_arm_parameters(arm_type);
CREATE INDEX idx_linucb_expected_ctr ON linucb_arm_parameters(arm_type, expected_ctr DESC);
CREATE INDEX idx_linucb_selection_count ON linucb_arm_parameters(arm_type, selection_count ASC);

COMMENT ON TABLE linucb_arm_parameters IS 'LinUCB臂参数表';
COMMENT ON COLUMN linucb_arm_parameters.id IS '主键ID';
COMMENT ON COLUMN linucb_arm_parameters.arm_id IS '臂ID (分类ID或商品ID)';
COMMENT ON COLUMN linucb_arm_parameters.arm_type IS '臂类型: category/product';
COMMENT ON COLUMN linucb_arm_parameters.a_matrix IS 'A矩阵 (d x d，JSON格式存储)';
COMMENT ON COLUMN linucb_arm_parameters.b_vector IS 'b向量 (d维，JSON格式存储)';
COMMENT ON COLUMN linucb_arm_parameters.theta_vector IS 'theta参数向量 (d维，JSON格式存储)';
COMMENT ON COLUMN linucb_arm_parameters.feature_dimension IS '特征维度 d';
COMMENT ON COLUMN linucb_arm_parameters.selection_count IS '被选择次数';
COMMENT ON COLUMN linucb_arm_parameters.positive_feedback_count IS '正向反馈次数 (点击/购买)';
COMMENT ON COLUMN linucb_arm_parameters.negative_feedback_count IS '负向反馈次数 (曝光未点击)';
COMMENT ON COLUMN linucb_arm_parameters.cumulative_reward IS '累积奖励';
COMMENT ON COLUMN linucb_arm_parameters.expected_ctr IS '预期点击率';
COMMENT ON COLUMN linucb_arm_parameters.algorithm_version IS '算法版本';
COMMENT ON COLUMN linucb_arm_parameters.create_time IS '创建时间';
COMMENT ON COLUMN linucb_arm_parameters.update_time IS '更新时间';

-- Trigger for update_time auto-update
CREATE OR REPLACE FUNCTION update_linucb_arm_parameters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.update_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_linucb_arm_parameters_update_time
    BEFORE UPDATE ON linucb_arm_parameters
    FOR EACH ROW
    EXECUTE FUNCTION update_linucb_arm_parameters_updated_at();


-- 2. LinUCB 探索日志表
-- 记录每次探索推荐的详细信息，用于算法调试和效果分析
DROP TABLE IF EXISTS linucb_exploration_logs CASCADE;
CREATE TABLE linucb_exploration_logs (
    id BIGSERIAL PRIMARY KEY,
    wx_user_id VARCHAR(64) NOT NULL,
    arm_id VARCHAR(64) NOT NULL,
    arm_type VARCHAR(32) NOT NULL DEFAULT 'category',

    -- UCB 计算详情
    context_vector TEXT,
    expected_reward DECIMAL(10,6),
    exploration_bonus DECIMAL(10,6),
    total_ucb DECIMAL(10,6),
    alpha_value DECIMAL(10,6) DEFAULT 1.5,

    -- 反馈数据
    actual_reward DECIMAL(10,6),
    is_clicked SMALLINT DEFAULT NULL,
    is_purchased SMALLINT DEFAULT NULL,
    feedback_time TIMESTAMP,

    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_linucb_log_user ON linucb_exploration_logs(wx_user_id);
CREATE INDEX idx_linucb_log_arm ON linucb_exploration_logs(arm_id, arm_type);
CREATE INDEX idx_linucb_log_create_time ON linucb_exploration_logs(create_time);
CREATE INDEX idx_linucb_log_pending_feedback ON linucb_exploration_logs(wx_user_id, arm_id, actual_reward);

COMMENT ON TABLE linucb_exploration_logs IS 'LinUCB探索日志表';
COMMENT ON COLUMN linucb_exploration_logs.id IS '主键ID';
COMMENT ON COLUMN linucb_exploration_logs.wx_user_id IS '微信用户ID';
COMMENT ON COLUMN linucb_exploration_logs.arm_id IS '臂ID (分类ID或商品ID)';
COMMENT ON COLUMN linucb_exploration_logs.arm_type IS '臂类型: category/product';
COMMENT ON COLUMN linucb_exploration_logs.context_vector IS '上下文特征向量 (JSON格式)';
COMMENT ON COLUMN linucb_exploration_logs.expected_reward IS '预期奖励 (x^T * theta)';
COMMENT ON COLUMN linucb_exploration_logs.exploration_bonus IS '探索奖励 (alpha * sqrt(x^T * A^{-1} * x))';
COMMENT ON COLUMN linucb_exploration_logs.total_ucb IS '总UCB值';
COMMENT ON COLUMN linucb_exploration_logs.alpha_value IS 'alpha参数值';
COMMENT ON COLUMN linucb_exploration_logs.actual_reward IS '实际奖励 (1.0=点击, 0.0=未点击)';
COMMENT ON COLUMN linucb_exploration_logs.is_clicked IS '是否点击';
COMMENT ON COLUMN linucb_exploration_logs.is_purchased IS '是否购买';
COMMENT ON COLUMN linucb_exploration_logs.feedback_time IS '反馈时间';
COMMENT ON COLUMN linucb_exploration_logs.create_time IS '创建时间';


-- =====================================================
-- 执行说明:
-- 1. 在 PostgreSQL 中执行此脚本创建表
-- 2. 确保已连接到正确的数据库
--
-- 执行命令:
-- psql -U postgres -d joolun -f V8.0__linucb_tables.sql
-- =====================================================
