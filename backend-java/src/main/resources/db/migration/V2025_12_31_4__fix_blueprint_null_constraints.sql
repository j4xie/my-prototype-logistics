-- 修复蓝图表 NOT NULL 约束
-- P2-2-2: FactoryTypeBlueprint 表的 is_active 和 version 字段缺少 NOT NULL

-- 1. 先更新可能存在的 NULL 值
UPDATE factory_type_blueprints SET is_active = TRUE WHERE is_active IS NULL;
UPDATE factory_type_blueprints SET version = 1 WHERE version IS NULL;

-- 2. 修改列约束 (MySQL 语法)
ALTER TABLE factory_type_blueprints
  MODIFY COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  MODIFY COLUMN version INT NOT NULL DEFAULT 1;
