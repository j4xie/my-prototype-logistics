-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_04_40__ai_intent_config_factory_id.sql
-- Conversion date: 2026-01-26 18:47:21
-- ============================================

-- ============================================================
-- AI Intent Config 工厂隔离字段
--
-- 添加 factory_id 字段实现工厂级意图隔离:
-- - factory_id = NULL: 平台级意图（所有工厂共享）
-- - factory_id = 'F001': 工厂级意图（仅该工厂可见）
--
-- @since 2026-01-04
-- ============================================================

-- 1. 添加 factory_id 字段
ALTER TABLE ai_intent_configs
ADD COLUMN IF NOT EXISTS factory_id VARCHAR(50) NULL COMMENT '工厂ID（NULL表示平台级共享意图）';

-- 2. 添加索引以优化工厂级查询
CREATE INDEX IF NOT EXISTS idx_intent_factory_id ON ai_intent_configs(factory_id);

-- 3. 现有数据保持 factory_id = NULL，表示平台级意图
-- 无需数据迁移，所有现有意图默认为平台级
