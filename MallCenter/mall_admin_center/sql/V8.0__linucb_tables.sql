-- =====================================================
-- LinUCB 强化学习算法表结构
-- 用于上下文感知的个性化推荐探索
-- 创建时间: 2025-12-27
-- =====================================================

-- 1. LinUCB 臂参数表
-- 存储每个分类/商品的 A 矩阵、b 向量和 theta 参数
CREATE TABLE IF NOT EXISTS linucb_arm_parameters (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    arm_id VARCHAR(64) NOT NULL COMMENT '臂ID (分类ID或商品ID)',
    arm_type VARCHAR(32) NOT NULL DEFAULT 'category' COMMENT '臂类型: category/product',

    -- LinUCB 核心参数
    a_matrix TEXT COMMENT 'A矩阵 (d x d，JSON格式存储)',
    b_vector TEXT COMMENT 'b向量 (d维，JSON格式存储)',
    theta_vector TEXT COMMENT 'theta参数向量 (d维，JSON格式存储)',
    feature_dimension INT NOT NULL DEFAULT 40 COMMENT '特征维度 d',

    -- 统计数据
    selection_count INT NOT NULL DEFAULT 0 COMMENT '被选择次数',
    positive_feedback_count INT NOT NULL DEFAULT 0 COMMENT '正向反馈次数 (点击/购买)',
    negative_feedback_count INT NOT NULL DEFAULT 0 COMMENT '负向反馈次数 (曝光未点击)',
    cumulative_reward DECIMAL(15,6) NOT NULL DEFAULT 0 COMMENT '累积奖励',
    expected_ctr DECIMAL(10,6) NOT NULL DEFAULT 0 COMMENT '预期点击率',

    -- 元数据
    algorithm_version VARCHAR(16) DEFAULT '1.0' COMMENT '算法版本',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    UNIQUE KEY uk_arm (arm_id, arm_type),
    INDEX idx_arm_type (arm_type),
    INDEX idx_expected_ctr (arm_type, expected_ctr DESC),
    INDEX idx_selection_count (arm_type, selection_count ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='LinUCB臂参数表';


-- 2. LinUCB 探索日志表
-- 记录每次探索推荐的详细信息，用于算法调试和效果分析
CREATE TABLE IF NOT EXISTS linucb_exploration_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    wx_user_id VARCHAR(64) NOT NULL COMMENT '微信用户ID',
    arm_id VARCHAR(64) NOT NULL COMMENT '臂ID (分类ID或商品ID)',
    arm_type VARCHAR(32) NOT NULL DEFAULT 'category' COMMENT '臂类型: category/product',

    -- UCB 计算详情
    context_vector TEXT COMMENT '上下文特征向量 (JSON格式)',
    expected_reward DECIMAL(10,6) COMMENT '预期奖励 (x^T * theta)',
    exploration_bonus DECIMAL(10,6) COMMENT '探索奖励 (alpha * sqrt(x^T * A^{-1} * x))',
    total_ucb DECIMAL(10,6) COMMENT '总UCB值',
    alpha_value DECIMAL(10,6) DEFAULT 1.5 COMMENT 'alpha参数值',

    -- 反馈数据
    actual_reward DECIMAL(10,6) COMMENT '实际奖励 (1.0=点击, 0.0=未点击)',
    is_clicked TINYINT(1) DEFAULT NULL COMMENT '是否点击',
    is_purchased TINYINT(1) DEFAULT NULL COMMENT '是否购买',
    feedback_time DATETIME COMMENT '反馈时间',

    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_user (wx_user_id),
    INDEX idx_arm (arm_id, arm_type),
    INDEX idx_create_time (create_time),
    INDEX idx_pending_feedback (wx_user_id, arm_id, actual_reward)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='LinUCB探索日志表';


-- 3. 为 ThompsonSampling 添加持久化表 (可选，目前 TS 使用 Redis)
-- CREATE TABLE IF NOT EXISTS thompson_sampling_parameters (
--     id BIGINT AUTO_INCREMENT PRIMARY KEY,
--     category_id VARCHAR(64) NOT NULL,
--     alpha DOUBLE NOT NULL DEFAULT 1.0 COMMENT 'Beta分布 alpha 参数 (正向反馈)',
--     beta_param DOUBLE NOT NULL DEFAULT 1.0 COMMENT 'Beta分布 beta 参数 (负向反馈)',
--     expected_ctr DECIMAL(10,6) COMMENT '预期点击率 = alpha / (alpha + beta)',
--     create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
--     update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     UNIQUE KEY uk_category (category_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Thompson Sampling参数表';


-- =====================================================
-- 执行说明:
-- 1. 在 MySQL 中执行此脚本创建表
-- 2. 确保已连接到正确的数据库 (joolun)
--
-- 执行命令:
-- mysql -u root -p joolun < V8.0__linucb_tables.sql
-- =====================================================
