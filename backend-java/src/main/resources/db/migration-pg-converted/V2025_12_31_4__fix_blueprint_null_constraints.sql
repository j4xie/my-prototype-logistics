-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_31_4__fix_blueprint_null_constraints.sql
-- Conversion date: 2026-01-26 18:46:38
-- ============================================

-- 修复蓝图表 NOT NULL 约束
-- P2-2-2: FactoryTypeBlueprint 表的 is_active 和 version 字段缺少 NOT NULL

-- 1. 先更新可能存在的 NULL 值
UPDATE factory_type_blueprints SET is_active = TRUE WHERE is_active IS NULL;
UPDATE factory_type_blueprints SET version = 1 WHERE version IS NULL;

-- 2. 修改列约束 (MySQL 语法)
ALTER TABLE factory_type_blueprints
  ALTER COLUMN is_active TYPE BOOLEAN NOT NULL DEFAULT TRUE,
  ALTER COLUMN version TYPE INT NOT NULL DEFAULT 1;
