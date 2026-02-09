-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_06_1__add_factory_id_to_ai_intent_configs.sql
-- Conversion date: 2026-01-26 18:47:49
-- ============================================

-- ============================================================
-- V2026_01_06_1__add_factory_id_to_ai_intent_configs.sql
-- 为 ai_intent_configs 表添加工厂隔离字段
--
-- 目的: 实现AI意图配置的多租户隔离
-- - 支持平台级意图 (factory_id = NULL)
-- - 支持工厂级意图 (factory_id = 具体工厂ID)
-- ============================================================

-- 1. 添加 factory_id 字段
ALTER TABLE ai_intent_configs
ADD COLUMN factory_id VARCHAR(50) NULL COMMENT '工厂ID (NULL=平台级意图, 具体值=工厂级意图)'
AFTER id;

-- 2. 创建索引以优化工厂级查询性能
CREATE INDEX idx_intent_factory_id ON ai_intent_configs(factory_id);

-- 3. 创建复合索引优化常见查询
CREATE INDEX idx_factory_active_priority ON ai_intent_configs(factory_id, is_active, priority);

-- 4. 初始化现有数据
-- 将所有现有意图设置为平台级 (factory_id = NULL)
-- 这样所有工厂都能访问到这些基础意图配置
UPDATE ai_intent_configs
SET factory_id = NULL
WHERE factory_id IS NULL;

-- 5. 修改唯一约束，允许相同 intent_code 在不同工厂存在
-- 先删除原有的唯一约束
ALTER TABLE ai_intent_configs
DROP INDEX intent_code;

-- 重新创建允许 NULL factory_id 的复合唯一约束
-- MySQL 中 NULL 不参与唯一性检查，所以平台级意图 (factory_id=NULL) 的 intent_code 仍保持全局唯一
-- 而工厂级意图可以在不同工厂使用相同的 intent_code
CREATE UNIQUE INDEX idx_unique_intent_code_factory
ON ai_intent_configs(intent_code, factory_id);

-- 6. 添加数据完整性注释
-- 注意: 此迁移后的行为:
-- - 平台级意图 (factory_id = NULL): intent_code 全局唯一
-- - 工厂级意图: 同一 intent_code 可以在不同工厂存在，但同一工厂内必须唯一
