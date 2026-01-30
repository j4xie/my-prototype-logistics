-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_04_41__update_intent_create_roles.sql
-- Conversion date: 2026-01-26 18:47:23
-- ============================================

-- ============================================================
-- 更新 INTENT_CREATE 意图配置允许平台管理员使用
--
-- 平台管理员(super_admin, platform_admin)需要能够创建:
-- - 平台级意图 (所有工厂共享)
-- - 工厂级意图 (指定工厂可见)
--
-- @since 2026-01-04
-- ============================================================

UPDATE ai_intent_configs
SET required_roles = '["factory_super_admin", "super_admin", "platform_admin"]'
WHERE intent_code = 'INTENT_CREATE';

-- 同样更新 INTENT_UPDATE 允许平台管理员使用
UPDATE ai_intent_configs
SET required_roles = '["factory_super_admin", "super_admin", "platform_admin"]'
WHERE intent_code = 'INTENT_UPDATE';

-- 同样更新 INTENT_ANALYZE 允许平台管理员使用
UPDATE ai_intent_configs
SET required_roles = '["factory_super_admin", "super_admin", "platform_admin"]'
WHERE intent_code = 'INTENT_ANALYZE';
