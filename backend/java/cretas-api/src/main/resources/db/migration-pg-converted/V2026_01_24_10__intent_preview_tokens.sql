-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_24_10__intent_preview_tokens.sql
-- Conversion date: 2026-01-26 18:49:42
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================
-- 意图预览令牌表 - TCC (Try-Confirm-Cancel) 模式
-- 用于实现预览-确认机制，防止误操作
-- ============================================

CREATE TABLE IF NOT EXISTS intent_preview_tokens (
    id BIGSERIAL PRIMARY KEY,

    -- 令牌值 (UUID)
    token VARCHAR(64) NOT NULL UNIQUE,

    -- 工厂和用户
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    username VARCHAR(100),

    -- 意图信息
    intent_code VARCHAR(100) NOT NULL,
    intent_name VARCHAR(200),

    -- 操作目标
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    operation VARCHAR(20),

    -- 预览数据 (JSON)
    preview_data TEXT,
    current_values TEXT,
    new_values TEXT,

    -- 状态: PENDING, CONFIRMED, CANCELLED, EXPIRED, FAILED
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- 结果描述
    resolution_message VARCHAR(500),

    -- 客户端信息 (安全验证)
    client_info VARCHAR(200),

    -- 索引
    INDEX idx_ipt_token (token),
    INDEX idx_ipt_factory_user (factory_id, user_id),
    INDEX idx_ipt_status (status),
    INDEX idx_ipt_expires (expires_at)
)
;

-- 添加注释
ALTER TABLE intent_preview_tokens
    ALTER COLUMN token TYPE VARCHAR(64) NOT NULL UNIQUE COMMENT '令牌值(UUID)',
    ALTER COLUMN factory_id TYPE VARCHAR(50) NOT NULL COMMENT '工厂ID',
    ALTER COLUMN user_id TYPE BIGINT NOT NULL COMMENT '用户ID',
    ALTER COLUMN username TYPE VARCHAR(100) COMMENT '用户名',
    ALTER COLUMN intent_code TYPE VARCHAR(100) NOT NULL COMMENT '意图代码',
    ALTER COLUMN intent_name TYPE VARCHAR(200) COMMENT '意图名称',
    ALTER COLUMN entity_type TYPE VARCHAR(50) COMMENT '实体类型',
    ALTER COLUMN entity_id TYPE VARCHAR(100) COMMENT '实体ID',
    ALTER COLUMN operation TYPE VARCHAR(20) COMMENT '操作类型(CREATE/UPDATE/DELETE)',
    ALTER COLUMN preview_data TYPE TEXT COMMENT '预览数据JSON',
    ALTER COLUMN current_values TYPE TEXT COMMENT '当前值快照JSON',
    ALTER COLUMN new_values TYPE TEXT COMMENT '新值JSON',
    ALTER COLUMN status TYPE VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态',
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    ALTER COLUMN expires_at TYPE TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '过期时间',
    ALTER COLUMN resolved_at TYPE TIMESTAMP WITH TIME ZONE COMMENT '处理时间',
    ALTER COLUMN resolution_message TYPE VARCHAR(500) COMMENT '处理结果描述',
    ALTER COLUMN client_info TYPE VARCHAR(200) COMMENT '客户端信息';
