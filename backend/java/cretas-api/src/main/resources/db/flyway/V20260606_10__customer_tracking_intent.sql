-- V20260606_10: Sprint 5 Tool 2 — customer_tracking_recent_query intent binding.
--
-- Binds CUSTOMER_TRACKING_RECENT_QUERY intent → customer_tracking_recent_query
-- AbstractBusinessTool (CRM domain). Read-only query wrapping
-- CustomerTrackingRecordRepository (shipped via PR #774).
--
-- Sensitivity: LOW (read-only, no side effects).
-- Priority 85 = consistent with adjacent CRM-domain query intents (BUSINESS_LINK_QUERY).
-- Tool 自身按命名约定 (*_query) auto-derive ActionType=READ / RiskLevel=LOW.

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, keywords, description,
    priority, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'CUSTOMER_TRACKING_RECENT_QUERY',
    '客户跟进记录查询',
    'CRM',
    'customer_tracking_recent_query',
    'LOW',
    '["跟进记录","最近联系","拜访记录","上次联系","客户回访","跟进了吗","沟通记录","客户跟进","回访记录","上次跟进","最近沟通","跟进历史"]'::jsonb,
    'Sprint 5 Tool 2: 查询客户最近的跟进记录 (拜访/电话/邮件), 支持 limit + daysBack 参数. 含客户名+内容摘要回出明确上下文 (防呆 R2). read-only.',
    85,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (intent_code) DO UPDATE
SET tool_name = 'customer_tracking_recent_query',
    intent_name = '客户跟进记录查询',
    intent_category = 'CRM',
    sensitivity_level = 'LOW',
    keywords = EXCLUDED.keywords,
    description = EXCLUDED.description,
    priority = 85,
    is_active = true,
    updated_at = NOW();
