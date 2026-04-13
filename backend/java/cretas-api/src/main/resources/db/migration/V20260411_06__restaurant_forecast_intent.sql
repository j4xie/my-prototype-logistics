-- V20260411_06: Register restaurant_forecast intent for P3 Task 3.5-3.6
-- Integrates the existing ForecastService into the restaurant section
-- flow via restaurant_forecast section handler + Java tool.
--
-- Covers demo A Turn 7: 邓总 asks for 3-4 month revenue forecast.
-- ForecastService already existed (generic /api/smartbi/forecast endpoint)
-- but was never called from the restaurant flow until this migration.

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_FORECAST', '餐饮营收预测', 'SMARTBI', 'restaurant_forecast', 'LOW',
        '["预测","下个月","未来营收","按趋势","扛不住","3月预测","营收预测","时间序列","forecast"]',
        '餐饮营收预测 — 基于历史月度序列做 1-6 个月预测, 含置信区间 + Chinese 趋势解读.',
        85, true)
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = 'restaurant_forecast',
    is_active = true;
