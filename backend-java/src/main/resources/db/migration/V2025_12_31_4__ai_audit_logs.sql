-- =====================================================
-- AI审计日志表
-- 用于记录所有AI分析请求，用于合规和分析
-- V2025_12_31_4
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    user_id BIGINT COMMENT '用户ID (自动任务时为NULL)',
    batch_id VARCHAR(50) COMMENT '批次ID',
    question_type VARCHAR(20) NOT NULL COMMENT '问题类型 (default/followup/weekly/monthly/historical)',
    question TEXT COMMENT '用户问题内容',
    session_id VARCHAR(100) COMMENT 'Python Session ID',
    consumed_quota BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否消耗配额',
    quota_cost INT NOT NULL DEFAULT 0 COMMENT '消耗的配额数量',
    is_success BOOLEAN NOT NULL COMMENT '请求是否成功',
    error_message VARCHAR(500) COMMENT '错误信息',
    response_time_ms BIGINT COMMENT 'AI响应时间(毫秒)',
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否命中缓存',
    ip_address VARCHAR(50) COMMENT '用户IP地址',
    user_agent VARCHAR(500) COMMENT '用户设备信息',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME COMMENT '软删除时间',

    -- 索引 (与实体定义一致)
    INDEX idx_factory_created (factory_id, created_at),
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_batch_id (batch_id),
    INDEX idx_session_id (session_id),
    INDEX idx_question_type (question_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='AI审计日志表 - 记录所有AI分析请求用于合规和成本分析';
