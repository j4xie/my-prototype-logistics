-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_15_03__tool_embeddings_table.sql
-- Conversion date: 2026-01-26 18:48:34
-- WARNING: This file requires manual review!
-- ============================================

-- ==========================================
-- Tool Embeddings Table (模块D - 动态工具选择)
-- ==========================================
-- 用于存储工具的描述向量，支持语义检索
-- 当意图匹配无法确定工具时，使用向量相似度选择最合适的工具
-- ==========================================

CREATE TABLE IF NOT EXISTS tool_embeddings (
    id VARCHAR(36) PRIMARY KEY,
    tool_name VARCHAR(100) NOT NULL UNIQUE COMMENT '工具名称 (对应 ToolExecutor.getToolName())',
    tool_description TEXT COMMENT '工具描述 (用于向量化)',
    tool_category VARCHAR(50) COMMENT '工具分类 (data_query, form_assist, production, etc.)',
    embedding_vector BYTEA COMMENT '描述向量 (序列化的 float[])',
    keywords JSON COMMENT '关键词列表',
    usage_count INT DEFAULT 0 COMMENT '使用次数统计',
    avg_execution_time_ms INT COMMENT '平均执行时间 (毫秒)',
    last_used_at TIMESTAMP WITH TIME ZONE COMMENT '最后使用时间',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_tool_name (tool_name),
    INDEX idx_tool_category (tool_category),
    INDEX idx_usage_count (usage_count DESC)
);

-- 注意：向量索引需要 MySQL 8.0.32+ 或使用专门的向量数据库
-- 当前版本使用应用层内存缓存进行向量检索
