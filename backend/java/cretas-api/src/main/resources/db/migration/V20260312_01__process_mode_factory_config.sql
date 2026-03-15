-- Process-centric production mode: factory feature config for F001
-- This inserts a 'production' module config enabling PROCESS mode

INSERT INTO factory_feature_config (factory_id, module_id, module_name, enabled, config)
VALUES ('F001', 'production', '生产管理配置', true, '{
  "mode": "PROCESS",
  "defaultUnit": "箱",
  "cumulativeReporting": true,
  "completionRule": "manual_with_prompt",
  "reportingInterval": "hourly"
}')
ON CONFLICT (factory_id, module_id) DO UPDATE
SET config = EXCLUDED.config,
    module_name = EXCLUDED.module_name,
    enabled = EXCLUDED.enabled;
