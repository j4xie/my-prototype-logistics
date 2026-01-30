-- 反思记忆表 (Reflexion Paper - Episodic Memory)
-- 基于 Reflexion 论文 (NeurIPS 2023) 设计
-- 用于存储纠错经验，支持学习和改进

CREATE TABLE IF NOT EXISTS reflection_memories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) COMMENT '会话ID',
    factory_id VARCHAR(50) COMMENT '工厂ID',
    tool_name VARCHAR(100) NOT NULL COMMENT '工具名称',
    original_error TEXT COMMENT '原始错误信息',
    reflection_content TEXT COMMENT '反思内容（LLM生成）',
    corrected_params TEXT COMMENT '修正后的参数（JSON）',
    correction_strategy VARCHAR(50) COMMENT '纠错策略: RE_QUERY, EXPAND_RANGE, FIX_FORMAT, CHANGE_CONDITION, ABANDON',
    confidence DECIMAL(3,2) COMMENT '置信度 (0.00-1.00)',
    was_successful BOOLEAN DEFAULT FALSE COMMENT '纠错是否成功',
    retry_count INT COMMENT '重试次数',
    execution_time_ms BIGINT COMMENT '执行耗时(毫秒)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_reflection_tool_name (tool_name),
    INDEX idx_reflection_session (session_id),
    INDEX idx_reflection_factory (factory_id),
    INDEX idx_reflection_created (created_at),
    INDEX idx_reflection_success (was_successful)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='反思记忆表 - 基于Reflexion论文的episodic memory';
