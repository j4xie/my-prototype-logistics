-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_05_40__create_intent_suggestion_fields.sql
-- Conversion date: 2026-01-26 18:47:41
-- ============================================

-- ============================================================
-- V2026_01_05_40__create_intent_suggestion_fields.sql
-- 为意图优化建议表添加 CREATE_INTENT 类型所需的字段
-- 支持 LLM 识别新意图模式并生成创建建议
-- ============================================================

-- 添加 CREATE_INTENT 类型需要的字段
ALTER TABLE intent_optimization_suggestions
    ADD COLUMN suggested_intent_code VARCHAR(100) NULL COMMENT 'LLM建议的意图代码 (CREATE_INTENT类型专用)' AFTER reject_reason,
    ADD COLUMN suggested_intent_name VARCHAR(200) NULL COMMENT 'LLM建议的意图名称 (CREATE_INTENT类型专用)' AFTER suggested_intent_code,
    ADD COLUMN suggested_keywords JSON NULL COMMENT 'LLM建议的关键词列表 (CREATE_INTENT类型专用)' AFTER suggested_intent_name,
    ADD COLUMN suggested_category VARCHAR(50) NULL COMMENT 'LLM建议的意图分类 (CREATE_INTENT类型专用)' AFTER suggested_keywords,
    ADD COLUMN llm_confidence DECIMAL(5,4) NULL COMMENT 'LLM置信度' AFTER suggested_category,
    ADD COLUMN llm_reasoning TEXT NULL COMMENT 'LLM推理说明' AFTER llm_confidence,
    ADD COLUMN created_intent_id VARCHAR(36) NULL COMMENT '创建后的意图ID (应用后填写)' AFTER llm_reasoning;

-- 添加 BaseEntity 需要的 deleted_at 字段 (如果不存在)
ALTER TABLE intent_optimization_suggestions
    ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL COMMENT '软删除时间' AFTER updated_at;

-- 添加索引优化查询
CREATE INDEX idx_suggestion_type ON intent_optimization_suggestions(suggestion_type);
CREATE INDEX idx_suggested_code ON intent_optimization_suggestions(suggested_intent_code);

-- 更新 suggestion_type 列的注释以包含新类型
ALTER TABLE intent_optimization_suggestions
    ALTER COLUMN suggestion_type TYPE VARCHAR(30) NOT NULL COMMENT '建议类型: ADD_KEYWORD/ADJUST_PRIORITY/ADD_REGEX/MERGE_INTENT/SPLIT_INTENT/CREATE_INTENT';
