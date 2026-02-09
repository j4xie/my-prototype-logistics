-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_05_30__expression_learning_tables.sql
-- Conversion date: 2026-01-26 18:47:38
-- WARNING: This file requires manual review!
-- ============================================

-- =========================================================================
-- 自我学习增强：表达学习与训练样本收集
-- =========================================================================

-- 1. 表达学习表：存储完整表达模式
CREATE TABLE IF NOT EXISTS ai_learned_expressions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    factory_id VARCHAR(50) DEFAULT NULL COMMENT '工厂ID (null=全局)',
    intent_code VARCHAR(100) NOT NULL COMMENT '意图代码',
    expression TEXT NOT NULL COMMENT '完整表达 (整句)',
    expression_hash VARCHAR(64) NOT NULL COMMENT 'SHA256 hash for exact match',
    source_type VARCHAR(20) NOT NULL COMMENT 'LLM_FALLBACK / USER_FEEDBACK / MANUAL',
    confidence DECIMAL(5,4) DEFAULT 0.0000 COMMENT '置信度',
    hit_count INT DEFAULT 0 COMMENT '命中次数',
    last_hit_at TIMESTAMP WITH TIME ZONE DEFAULT NULL COMMENT '最后命中时间',
    is_verified BOOLEAN DEFAULT FALSE COMMENT '人工确认过',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_ale_factory_intent (factory_id, intent_code),
    INDEX idx_ale_expression_hash (expression_hash),
    INDEX idx_ale_source_type (source_type),
    INDEX idx_ale_is_active (is_active),
    UNIQUE KEY uk_ale_hash_factory (expression_hash, factory_id)
)
;

-- 2. 训练样本收集表：用于未来模型微调
CREATE TABLE IF NOT EXISTS ai_training_samples (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) DEFAULT NULL COMMENT '工厂ID',
    user_input TEXT NOT NULL COMMENT '原始用户输入',
    normalized_input VARCHAR(500) GENERATED ALWAYS AS (LOWER(TRIM(SUBSTRING(user_input, 1, 500)))) STORED COMMENT '标准化输入',
    matched_intent_code VARCHAR(100) DEFAULT NULL COMMENT '匹配的意图代码',
    match_method VARCHAR(20) DEFAULT NULL COMMENT 'EXACT/KEYWORD/SEMANTIC/LLM/UNKNOWN',
    confidence DECIMAL(5,4) DEFAULT NULL COMMENT '匹配置信度',
    llm_response_intent VARCHAR(100) DEFAULT NULL COMMENT 'LLM返回的意图 (用于对比)',
    is_correct BOOLEAN DEFAULT NULL COMMENT '用户反馈: 匹配正确? (null=未反馈)',
    correct_intent_code VARCHAR(100) DEFAULT NULL COMMENT '正确的意图 (若is_correct=false)',
    feedback_at TIMESTAMP WITH TIME ZONE DEFAULT NULL COMMENT '反馈时间',
    embedding_blob BYTEA DEFAULT NULL COMMENT '768*4 bytes (~3KB) 向量用于微调',
    session_id VARCHAR(100) DEFAULT NULL COMMENT '会话ID (用于上下文追踪)',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_ats_factory (factory_id),
    INDEX idx_ats_intent (matched_intent_code),
    INDEX idx_ats_correct (is_correct),
    INDEX idx_ats_method (match_method),
    INDEX idx_ats_created (created_at),
    INDEX idx_ats_normalized (normalized_input(100))
)
;

-- 3. 学习统计表：追踪学习效果
CREATE TABLE IF NOT EXISTS ai_learning_statistics (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    stat_date DATE NOT NULL COMMENT '统计日期',

    -- 样本统计
    total_samples INT DEFAULT 0 COMMENT '总样本数',
    llm_samples INT DEFAULT 0 COMMENT 'LLM fallback样本数',
    keyword_samples INT DEFAULT 0 COMMENT '关键词匹配样本数',
    semantic_samples INT DEFAULT 0 COMMENT '语义匹配样本数',
    exact_samples INT DEFAULT 0 COMMENT '精确表达匹配样本数',

    -- 反馈统计
    feedback_count INT DEFAULT 0 COMMENT '收到反馈数',
    positive_feedback INT DEFAULT 0 COMMENT '正向反馈数',
    negative_feedback INT DEFAULT 0 COMMENT '负向反馈数',

    -- 学习统计
    new_expressions INT DEFAULT 0 COMMENT '新增表达数',
    new_keywords INT DEFAULT 0 COMMENT '新增关键词数',
    removed_expressions INT DEFAULT 0 COMMENT '清理表达数',
    removed_keywords INT DEFAULT 0 COMMENT '清理关键词数',

    -- 效果指标
    accuracy_rate DECIMAL(5,4) DEFAULT NULL COMMENT '准确率 (基于反馈)',
    llm_fallback_rate DECIMAL(5,4) DEFAULT NULL COMMENT 'LLM回退率',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_als_factory_date (factory_id, stat_date),
    INDEX idx_als_date (stat_date)
)
;

-- 4. 更新学习配置表：添加表达学习相关配置
ALTER TABLE factory_ai_learning_config
    ADD COLUMN IF NOT EXISTS expression_learn_enabled BOOLEAN DEFAULT TRUE COMMENT '启用表达学习',
    ADD COLUMN IF NOT EXISTS expression_learn_threshold DECIMAL(3,2) DEFAULT 0.70 COMMENT '表达学习置信度阈值',
    ADD COLUMN IF NOT EXISTS sample_collection_enabled BOOLEAN DEFAULT TRUE COMMENT '启用样本收集',
    ADD COLUMN IF NOT EXISTS sample_embedding_enabled BOOLEAN DEFAULT FALSE COMMENT '收集时计算embedding',
    ADD COLUMN IF NOT EXISTS max_expressions_per_intent INT DEFAULT 100 COMMENT '每个意图最大表达数';
