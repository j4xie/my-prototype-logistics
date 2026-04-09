-- V20260410_07__seed_scheduler_configs.sql
INSERT INTO factory_scheduler_configs (factory_id, task_code, cron_expression, enabled, tool_or_method, params, description) VALUES
(NULL, 'AI_DAILY_REPORT', '0 0 20 * * *', true, 'report_daily_generate', '{}', '每日AI报告 (20:00)'),
(NULL, 'AI_WEEKLY_REPORT', '0 0 6 * * MON', true, 'report_weekly_generate', '{}', '每周AI报告 (周一06:00)'),
(NULL, 'AI_MONTHLY_REPORT', '0 0 6 1 * *', true, 'report_monthly_generate', '{}', '每月AI报告 (1号06:00)'),
(NULL, 'BATCH_EXPIRY_CHECK', '0 0 2 * * ?', true, 'material_batch_expiry_check', '{}', '过期批次检查 (02:00)'),
(NULL, 'PRODUCTION_SYNC', '0 0 2 * * ?', true, 'production_report_sync', '{}', '报工数据同步 (02:00)'),
(NULL, 'ANOMALY_DETECTION', '0 0 */2 * * *', true, 'quality_anomaly_detect', '{}', '异常检测 (每2小时)'),
(NULL, 'TASK_CALIBRATION', '0 0 * * * *', true, 'production_task_calibrate', '{}', '工序任务校准 (每小时)'),
(NULL, 'ACTIVE_LEARNING_DAILY', '0 0 2 * * ?', true, 'ai_active_learning_analyze', '{}', 'AI主动学习 (02:00)'),
(NULL, 'BEHAVIOR_CALIBRATION', '0 0 1 * * ?', true, 'ai_behavior_calibrate', '{}', '行为校准 (01:00)'),
(NULL, 'ERROR_ATTRIBUTION', '0 0 1 * * ?', true, 'ai_error_attribution', '{}', '错误归因 (01:00)'),
(NULL, 'APS_WEIGHT_ADJUST', '0 0 2 * * ?', true, 'scheduling_weight_adjust', '{}', 'APS权重自调整 (02:00)'),
(NULL, 'ALERT_VERIFY', '0 30 */4 * * *', true, 'quality_alert_verify', '{}', '告警验证 (每4小时)')
ON CONFLICT (factory_id, task_code) DO NOTHING;
