-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_06_10__conversation_sessions_table.sql
-- Conversion date: 2026-01-26 18:47:44
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- V2026_01_06_10: 多轮对话会话表
--
-- 功能: Layer 5 多轮对话模式
-- 触发条件: Layer 1-4 置信度 < 30% 且无明确匹配
-- 最大轮次: 5轮
--
-- 作者: Cretas Team
-- 日期: 2026-01-06
-- ============================================================

-- 创建多轮对话会话表
CREATE TABLE IF NOT EXISTS conversation_sessions (
    -- 主键
    session_id VARCHAR(36) NOT NULL PRIMARY KEY COMMENT '会话ID (UUID)',

    -- 基础信息
    factory_id VARCHAR(50) COMMENT '工厂ID',
    user_id BIGINT COMMENT '用户ID',
    original_input TEXT NOT NULL COMMENT '用户最初的输入',

    -- 意图识别结果
    final_intent_code VARCHAR(100) COMMENT '最终识别的意图代码',

    -- 对话状态
    current_round INT NOT NULL DEFAULT 0 COMMENT '当前轮次 (最多5轮)',
    max_rounds INT DEFAULT 5 COMMENT '最大轮次限制',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '会话状态: ACTIVE, COMPLETED, TIMEOUT, CANCELLED, MAX_ROUNDS_REACHED',

    -- 对话内容
    messages_json TEXT COMMENT '对话历史 JSON: [{"role": "user/assistant", "content": "...", "timestamp": "..."}]',
    candidates_json TEXT COMMENT '候选意图列表 JSON: [{"intentCode": "...", "confidence": 0.5}]',

    -- 置信度
    last_confidence DOUBLE PRECISION COMMENT '最后识别的置信度',

    -- 超时设置
    timeout_minutes INT DEFAULT 10 COMMENT '超时时间（分钟）',

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    last_active_at TIMESTAMP WITH TIME ZONE COMMENT '最后活跃时间',
    completed_at TIMESTAMP WITH TIME ZONE COMMENT '完成时间',

    -- 索引
    INDEX idx_cs_factory_user (factory_id, user_id),
    INDEX idx_cs_status (status),
    INDEX idx_cs_created_at (created_at),
    INDEX idx_cs_last_active (last_active_at)
)
;

-- 添加状态约束检查 (MySQL 8.0.16+)
-- ALTER TABLE conversation_sessions
--     ADD CONSTRAINT chk_session_status
--     CHECK (status IN ('ACTIVE', 'COMPLETED', 'TIMEOUT', 'CANCELLED', 'MAX_ROUNDS_REACHED'));

-- ============================================================
-- 说明:
--
-- 1. 会话生命周期:
--    ACTIVE -> COMPLETED (成功识别)
--    ACTIVE -> TIMEOUT (超时未响应)
--    ACTIVE -> CANCELLED (用户取消)
--    ACTIVE -> MAX_ROUNDS_REACHED (达到5轮未识别)
--
-- 2. messages_json 格式:
--    [
--      {"role": "user", "content": "用户输入", "timestamp": "2026-01-06T10:00:00"},
--      {"role": "assistant", "content": "助手回复", "timestamp": "2026-01-06T10:00:01"}
--    ]
--
-- 3. candidates_json 格式:
--    [
--      {"intentCode": "BATCH_QUERY", "intentName": "批次查询", "confidence": 0.6},
--      {"intentCode": "MATERIAL_QUERY", "intentName": "原料查询", "confidence": 0.4}
--    ]
--
-- 4. 学习内容 (对话结束时):
--    - 学习原始表达 -> LearnedExpression 表
--    - 学习新关键词 -> AIIntentConfig.keywords
--
-- ============================================================
