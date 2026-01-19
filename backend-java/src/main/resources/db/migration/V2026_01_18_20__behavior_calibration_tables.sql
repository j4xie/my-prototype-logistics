-- ============================================================
-- ET-Agent 行为校准机制 - 基础设施表
-- 基于 ET-Agent 论文 (arXiv:2601.06860) 实现工具调用监控与行为校准
-- ============================================================

-- 1. 工具调用记录表
-- 记录每次工具调用的详细信息，用于冗余检测和指标计算
CREATE TABLE IF NOT EXISTS tool_call_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    -- 关联信息
    factory_id VARCHAR(64) COMMENT '工厂ID',
    session_id VARCHAR(128) COMMENT '会话ID',
    user_id BIGINT COMMENT '用户ID',
    intent_code VARCHAR(128) COMMENT '关联的意图代码',

    -- 工具调用信息
    tool_name VARCHAR(128) NOT NULL COMMENT '工具名称',
    tool_parameters JSON COMMENT '工具参数（JSON格式）',
    parameters_hash VARCHAR(64) COMMENT '参数哈希值，用于冗余检测',

    -- 执行状态
    execution_status ENUM('SUCCESS', 'FAILED', 'SKIPPED', 'TIMEOUT') NOT NULL DEFAULT 'SUCCESS' COMMENT '执行状态',
    error_type VARCHAR(64) COMMENT '错误类型（如参数错误、权限错误、服务不可用）',
    error_message TEXT COMMENT '错误信息',

    -- 冗余检测
    is_redundant BOOLEAN DEFAULT FALSE COMMENT '是否为冗余调用',
    redundant_reason VARCHAR(256) COMMENT '冗余原因说明',
    original_call_id BIGINT COMMENT '原始调用ID（如果是冗余调用）',

    -- 性能指标
    execution_time_ms INT COMMENT '执行耗时（毫秒）',
    input_tokens INT COMMENT '输入token数',
    output_tokens INT COMMENT '输出token数',

    -- 纠错相关
    retry_count INT DEFAULT 0 COMMENT '重试次数',
    recovery_strategy VARCHAR(64) COMMENT '恢复策略（如prompt_injection, parameter_fix）',
    recovered BOOLEAN DEFAULT FALSE COMMENT '是否通过纠错恢复成功',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    -- 索引
    INDEX idx_factory_id (factory_id),
    INDEX idx_session_id (session_id),
    INDEX idx_tool_name (tool_name),
    INDEX idx_execution_status (execution_status),
    INDEX idx_is_redundant (is_redundant),
    INDEX idx_created_at (created_at),
    INDEX idx_parameters_hash (parameters_hash),
    INDEX idx_factory_created (factory_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='工具调用记录表 - ET-Agent行为校准';

-- 2. 行为校准指标表
-- 按时间段聚合的指标数据，用于仪表盘展示
CREATE TABLE IF NOT EXISTS behavior_calibration_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    -- 维度
    factory_id VARCHAR(64) COMMENT '工厂ID（NULL表示全平台）',
    metric_date DATE NOT NULL COMMENT '统计日期',
    period_type ENUM('DAILY', 'WEEKLY', 'MONTHLY') NOT NULL DEFAULT 'DAILY' COMMENT '统计周期类型',

    -- 核心指标
    total_calls INT DEFAULT 0 COMMENT '总调用数',
    successful_calls INT DEFAULT 0 COMMENT '成功调用数',
    failed_calls INT DEFAULT 0 COMMENT '失败调用数',
    redundant_calls INT DEFAULT 0 COMMENT '冗余调用数',
    recovered_calls INT DEFAULT 0 COMMENT '通过纠错恢复的调用数',

    -- 计算指标
    conciseness_score DECIMAL(5,2) COMMENT '简洁性得分 = (total - redundant) / total * 100',
    success_rate DECIMAL(5,2) COMMENT '执行成功率 = successful / total * 100',
    reasoning_efficiency DECIMAL(5,2) COMMENT '推理效率得分',
    composite_score DECIMAL(5,2) COMMENT '综合得分 = conciseness*0.3 + success*0.5 + efficiency*0.2',

    -- Token统计
    total_input_tokens BIGINT DEFAULT 0 COMMENT '总输入token数',
    total_output_tokens BIGINT DEFAULT 0 COMMENT '总输出token数',
    avg_execution_time_ms INT COMMENT '平均执行耗时',

    -- 工具分布（JSON格式存储各工具调用次数）
    tool_distribution JSON COMMENT '工具调用分布 {"tool_name": count}',
    error_distribution JSON COMMENT '错误类型分布 {"error_type": count}',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    -- 唯一约束
    UNIQUE KEY uk_factory_date_period (factory_id, metric_date, period_type),

    -- 索引
    INDEX idx_metric_date (metric_date),
    INDEX idx_period_type (period_type),
    INDEX idx_composite_score (composite_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='行为校准指标表 - 聚合统计数据';

-- 3. 工具可靠性统计表
-- 按工具维度统计成功率和性能
CREATE TABLE IF NOT EXISTS tool_reliability_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    -- 维度
    factory_id VARCHAR(64) COMMENT '工厂ID（NULL表示全平台）',
    tool_name VARCHAR(128) NOT NULL COMMENT '工具名称',
    stat_date DATE NOT NULL COMMENT '统计日期',

    -- 统计数据
    total_calls INT DEFAULT 0 COMMENT '总调用数',
    successful_calls INT DEFAULT 0 COMMENT '成功调用数',
    failed_calls INT DEFAULT 0 COMMENT '失败调用数',
    avg_execution_time_ms INT COMMENT '平均执行耗时',

    -- 计算指标
    success_rate DECIMAL(5,2) COMMENT '成功率 = successful / total * 100',

    -- 常见错误
    common_errors JSON COMMENT '常见错误 [{"type": "xxx", "count": n, "message": "xxx"}]',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    -- 唯一约束
    UNIQUE KEY uk_factory_tool_date (factory_id, tool_name, stat_date),

    -- 索引
    INDEX idx_tool_name (tool_name),
    INDEX idx_stat_date (stat_date),
    INDEX idx_success_rate (success_rate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='工具可靠性统计表 - 按工具维度聚合';

-- 4. 纠错记录表
-- 记录自我纠错的详细过程
CREATE TABLE IF NOT EXISTS correction_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    -- 关联信息
    tool_call_id BIGINT NOT NULL COMMENT '关联的工具调用ID',
    factory_id VARCHAR(64) COMMENT '工厂ID',
    session_id VARCHAR(128) COMMENT '会话ID',

    -- 错误信息
    error_type VARCHAR(64) NOT NULL COMMENT '错误类型',
    error_category ENUM('DATA_INSUFFICIENT', 'ANALYSIS_ERROR', 'FORMAT_ERROR', 'LOGIC_ERROR', 'UNKNOWN')
        NOT NULL DEFAULT 'UNKNOWN' COMMENT '错误分类',
    original_error_message TEXT COMMENT '原始错误信息',

    -- 纠错策略
    correction_strategy ENUM('RE_RETRIEVE', 'RE_ANALYZE', 'FORMAT_FIX', 'PROMPT_INJECTION', 'FULL_RETRY')
        NOT NULL COMMENT '纠错策略',
    injected_prompt TEXT COMMENT '注入的纠正提示',

    -- 纠错结果
    correction_success BOOLEAN DEFAULT FALSE COMMENT '纠错是否成功',
    correction_rounds INT DEFAULT 1 COMMENT '纠错轮次',
    final_status VARCHAR(64) COMMENT '最终状态',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    -- 外键约束
    CONSTRAINT fk_correction_tool_call FOREIGN KEY (tool_call_id)
        REFERENCES tool_call_records(id) ON DELETE CASCADE,

    -- 索引
    INDEX idx_tool_call_id (tool_call_id),
    INDEX idx_error_category (error_category),
    INDEX idx_correction_strategy (correction_strategy),
    INDEX idx_correction_success (correction_success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='纠错记录表 - 自我纠错机制追踪';

-- 5. 工具调用缓存表
-- 用于冗余检测的短期缓存
CREATE TABLE IF NOT EXISTS tool_call_cache (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    -- 缓存键
    cache_key VARCHAR(256) NOT NULL COMMENT '缓存键 = session_id + tool_name + parameters_hash',
    session_id VARCHAR(128) NOT NULL COMMENT '会话ID',
    tool_name VARCHAR(128) NOT NULL COMMENT '工具名称',
    parameters_hash VARCHAR(64) NOT NULL COMMENT '参数哈希值',

    -- 缓存值
    cached_result JSON COMMENT '缓存的执行结果',
    original_call_id BIGINT NOT NULL COMMENT '原始调用ID',

    -- 过期控制
    expires_at DATETIME NOT NULL COMMENT '过期时间',
    hit_count INT DEFAULT 0 COMMENT '缓存命中次数',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- 唯一约束
    UNIQUE KEY uk_cache_key (cache_key),

    -- 索引
    INDEX idx_session_id (session_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_tool_parameters (tool_name, parameters_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='工具调用缓存表 - 冗余检测支持';

-- 6. 定时清理过期缓存的事件
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_tool_call_cache
ON SCHEDULE EVERY 10 MINUTE
DO
BEGIN
    DELETE FROM tool_call_cache WHERE expires_at < NOW();
END//
DELIMITER ;
