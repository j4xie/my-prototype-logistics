-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_06_01__expression_embedding.sql
-- Conversion date: 2026-01-26 18:47:43
-- ============================================

-- ============================================
-- 表达学习 Embedding 支持
-- 为 ai_learned_expressions 表添加 embedding 字段
-- 用于统一语义匹配 (合并到 Layer 4)
-- ============================================

-- 添加 embedding 相关字段
ALTER TABLE ai_learned_expressions
    ADD COLUMN embedding_vector BYTEA DEFAULT NULL COMMENT '768维向量 (768*4=3072 bytes)',
    ADD COLUMN embedding_model VARCHAR(50) DEFAULT 'gte-base-zh' COMMENT '生成 embedding 的模型',
    ADD COLUMN embedding_created_at TIMESTAMP WITH TIME ZONE DEFAULT NULL COMMENT 'embedding 生成时间';

-- 添加索引用于快速查找有 embedding 的表达
CREATE INDEX idx_has_embedding ON ai_learned_expressions (factory_id, embedding_created_at);
