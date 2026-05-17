-- V20260606_09: Sprint 5 Tool 1 — production_plan_delivery_warn_query intent binding
--
-- Wraps ProductionPlanService.getDeliveryWarnings (shipped via PR #737, M-DELIVERY-WARN-1)
-- for AIChat. Read-only query: lists production plans whose expectedCompletionDate
-- falls within the configured window or is already overdue, grouped by warn level.
--
-- Sensitivity: LOW (read-only, no side effects).
-- Priority 80 = baseline (per V20260606_08 pattern).
-- Tool auto-derives ActionType=READ / RiskLevel=LOW via *_query convention.
--
-- Table name verified PLURAL: ai_intent_configs (per repo migrations V20260606_01/04/06/08).

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'PRODUCTION_DELIVERY_WARN_QUERY',
    '交货预警查询',
    'DATA_QUERY',
    'production_plan_delivery_warn_query',
    'LOW',
    '["交货预警","快超期","即将到期","延期风险","几天后到期","已超期","赶不上交期","交期预警","哪些订单要超期","近7天交货","快超期的生产计划","交付预警"]',
    'Sprint 5 Tool 1: 查询交货预警 (OVERDUE/URGENT/WARN/NORMAL), 默认 7 天窗口, 可选 warnLevel 过滤. read-only.',
    80, true, NOW(), NOW()
)
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    intent_name = EXCLUDED.intent_name,
    intent_category = EXCLUDED.intent_category,
    sensitivity_level = EXCLUDED.sensitivity_level,
    keywords = EXCLUDED.keywords,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
