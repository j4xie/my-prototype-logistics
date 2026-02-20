-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_05_02__semantic_cache_tables.sql
-- Conversion date: 2026-01-26 18:47:28
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- V2026_01_05_01__semantic_cache_tables.sql
-- 语义缓存表结构
-- 用于加速意图识别的语义相似度匹配
-- ============================================================

-- 语义缓存表
CREATE TABLE IF NOT EXISTS semantic_cache (
    id BIGINT PRIMARY KEY  COMMENT '主键ID',
    factory_id VARCHAR(36) NOT NULL COMMENT '工厂ID',

    -- 输入文本
    normalized_input VARCHAR(500) NOT NULL COMMENT '规范化后的输入文本',
    original_input TEXT NOT NULL COMMENT '原始输入文本',
    input_hash VARCHAR(64) NOT NULL COMMENT '输入文本哈希 (SHA-256)',

    -- 向量表示
    embedding_vector BYTEA COMMENT '384维 float32 向量 (约1.5KB)',

    -- 意图识别结果
    intent_code VARCHAR(100) COMMENT '匹配的意图代码',
    intent_result JSON COMMENT '意图识别完整结果 (IntentMatchResult)',
    execution_result JSON COMMENT '意图执行结果 (IntentExecuteResponse)',

    -- 置信度和统计
    confidence DECIMAL(4,3) DEFAULT 0 COMMENT '匹配置信度 (0-1)',
    hit_count INT DEFAULT 0 COMMENT '命中次数',
    last_hit_at TIMESTAMP WITH TIME ZONE COMMENT '最后命中时间',

    -- 过期管理
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '过期时间',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE COMMENT '软删除时间',

    -- 索引
    INDEX idx_factory_hash (factory_id, input_hash) COMMENT '工厂+哈希快速查找',
    INDEX idx_factory_expires (factory_id, expires_at) COMMENT '工厂+过期时间',
    INDEX idx_expires (expires_at) COMMENT '过期时间 (用于清理)',
    INDEX idx_intent_code (factory_id, intent_code) COMMENT '意图代码查询'
)
;

-- 语义缓存配置表
CREATE TABLE IF NOT EXISTS semantic_cache_config (
    id BIGINT PRIMARY KEY  COMMENT '主键ID',
    factory_id VARCHAR(36) NOT NULL DEFAULT '*' COMMENT '工厂ID (* 表示全局默认)',

    -- 相似度配置
    similarity_threshold DECIMAL(4,3) DEFAULT 0.85 COMMENT '语义相似度阈值 (0.8-0.95)',

    -- 缓存配置
    cache_ttl_hours INT DEFAULT 24 COMMENT '缓存有效期 (小时)',
    max_cache_entries INT DEFAULT 10000 COMMENT '最大缓存条目数',

    -- 模型配置
    embedding_model VARCHAR(100) DEFAULT 'paraphrase-multilingual-MiniLM-L12-v2' COMMENT 'Embedding 模型名称',
    embedding_dimension INT DEFAULT 384 COMMENT 'Embedding 向量维度',

    -- 功能开关
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用语义缓存',
    exact_match_only BOOLEAN DEFAULT FALSE COMMENT '仅使用精确匹配 (禁用语义匹配)',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 唯一约束
    UNIQUE INDEX uk_factory (factory_id) COMMENT '每个工厂一条配置'
)
;

-- 插入默认全局配置
INSERT INTO semantic_cache_config (factory_id, similarity_threshold, cache_ttl_hours, max_cache_entries, enabled)
VALUES ('*', 0.85, 24, 10000, TRUE)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 语义缓存统计表 (可选，用于监控)
CREATE TABLE IF NOT EXISTS semantic_cache_stats (
    id BIGINT PRIMARY KEY  COMMENT '主键ID',
    factory_id VARCHAR(36) NOT NULL COMMENT '工厂ID',
    date DATE NOT NULL COMMENT '统计日期',

    -- 命中统计
    exact_hits INT DEFAULT 0 COMMENT '精确匹配命中次数',
    semantic_hits INT DEFAULT 0 COMMENT '语义匹配命中次数',
    misses INT DEFAULT 0 COMMENT '未命中次数',

    -- 性能统计
    avg_hit_latency_ms INT DEFAULT 0 COMMENT '平均命中延迟 (毫秒)',
    avg_miss_latency_ms INT DEFAULT 0 COMMENT '平均未命中延迟 (毫秒)',

    -- 缓存状态
    total_entries INT DEFAULT 0 COMMENT '当日缓存条目总数',
    expired_entries INT DEFAULT 0 COMMENT '当日过期条目数',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 唯一约束
    UNIQUE INDEX uk_factory_date (factory_id, date) COMMENT '每个工厂每天一条统计'
)
;
