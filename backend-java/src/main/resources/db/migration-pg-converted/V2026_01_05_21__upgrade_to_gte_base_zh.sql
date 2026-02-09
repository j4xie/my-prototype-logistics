-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_05_21__upgrade_to_gte_base_zh.sql
-- Conversion date: 2026-01-26 18:47:34
-- ============================================

-- ============================================================
-- V2026_01_05_20__upgrade_to_gte_base_zh.sql
-- 升级 Embedding 模型到 GTE-base-zh
-- 测试结果: 93.3% 准确率 (vs bge-base 80%)
-- ============================================================

-- 1. 更新默认配置为 GTE-base-zh 模型
UPDATE semantic_cache_config
SET embedding_model = 'gte-base-zh',
    embedding_dimension = 768,
    updated_at = CURRENT_TIMESTAMP
WHERE embedding_model = 'paraphrase-multilingual-MiniLM-L12-v2';

-- 2. 更新全局配置
UPDATE semantic_cache_config
SET embedding_model = 'gte-base-zh',
    embedding_dimension = 768,
    updated_at = CURRENT_TIMESTAMP
WHERE factory_id = '*';

-- 3. 清空现有缓存 (旧的384维向量与新的768维不兼容)
DELETE FROM semantic_cache WHERE embedding_vector IS NOT NULL;

-- 4. 重置缓存统计
UPDATE semantic_cache_stats
SET exact_hits = 0,
    semantic_hits = 0,
    misses = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE date = CURDATE();
