-- Re-enable all previously Coming Soon modules.
-- These features have been fully implemented as of 2026-03-15.

-- 1. Enable logistics module
INSERT INTO factory_feature_config (factory_id, module_id, module_name, enabled, config, created_at, updated_at)
VALUES ('F001', 'logistics', '物流管理', true, '{}', NOW(), NOW())
ON CONFLICT (factory_id, module_id) DO UPDATE SET enabled = true, updated_at = NOW();

-- 2. Enable trace module
INSERT INTO factory_feature_config (factory_id, module_id, module_name, enabled, config, created_at, updated_at)
VALUES ('F001', 'trace', '溯源管理', true, '{}', NOW(), NOW())
ON CONFLICT (factory_id, module_id) DO UPDATE SET enabled = true, updated_at = NOW();

-- 3. Enable all finance screens (remove disabledScreens)
INSERT INTO factory_feature_config (factory_id, module_id, module_name, enabled, config, created_at, updated_at)
VALUES ('F001', 'finance', '财务管理', true, '{"disabledScreens": []}', NOW(), NOW())
ON CONFLICT (factory_id, module_id) DO UPDATE
  SET config = jsonb_set(
    COALESCE(factory_feature_config.config::jsonb, '{}'::jsonb),
    '{disabledScreens}',
    '[]'
  ),
  updated_at = NOW();

-- 4. Enable notification settings (remove from system disabledScreens)
INSERT INTO factory_feature_config (factory_id, module_id, module_name, enabled, config, created_at, updated_at)
VALUES ('F001', 'system', '系统功能', true, '{"disabledScreens": []}', NOW(), NOW())
ON CONFLICT (factory_id, module_id) DO UPDATE
  SET config = jsonb_set(
    COALESCE(factory_feature_config.config::jsonb, '{}'::jsonb),
    '{disabledScreens}',
    '[]'
  ),
  updated_at = NOW();
