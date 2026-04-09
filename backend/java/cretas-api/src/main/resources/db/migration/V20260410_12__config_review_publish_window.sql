-- V20260410_12__config_review_publish_window.sql
ALTER TABLE factory_configurations ADD COLUMN IF NOT EXISTS submitted_by BIGINT;
ALTER TABLE factory_configurations ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE factory_configurations ADD COLUMN IF NOT EXISTS reviewed_by BIGINT;
ALTER TABLE factory_configurations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE factory_configurations ADD COLUMN IF NOT EXISTS review_notes TEXT;

INSERT INTO factory_scheduler_configs (factory_id, task_code, cron_expression, enabled, tool_or_method, params, description)
VALUES (NULL, 'CONFIG_PUBLISH_WINDOW', '0 0 22 * * ?', true, 'canvas_auto_publish', '{"startHour":22,"startMinute":0,"endHour":6,"endMinute":0}', '配置自动发布窗口 (默认 22:00-06:00)')
ON CONFLICT (factory_id, task_code) DO NOTHING;
