-- =====================================================
-- Issue #715 fix — bind BusinessLinkQueryTool to AI intent.
--
-- BusinessLinkQueryTool (Sprint 3 Track-F C-LINKARRAY-1) is @Component-registered
-- in ToolRegistry but unreachable via /ai-intents/execute because no row in
-- ai_intent_configs sets tool_name='business_link_query'. Result: natural
-- queries like "查 SO-xxx 关联业务单" route to CUSTOMER_LIST / TRACE_BATCH
-- (wrong tool); explicit intentCode='BUSINESS_LINK_QUERY' returns
-- "未找到意图配置: BUSINESS_LINK_QUERY".
--
-- Fix: INSERT one row binding BUSINESS_LINK_QUERY → business_link_query tool.
-- ON CONFLICT clause keeps this idempotent if migration replays.
--
-- @since 2026-05-17
-- =====================================================

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, keywords, description,
    priority, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'BUSINESS_LINK_QUERY',
    '业务链路查询',
    'CRM',
    'business_link_query',
    'LOW',
    '["业务链路","关联业务单","关联业务","查关联","查关联单","linkArray","outbound","inbound","业务追溯","关联业务链","上下游业务单","跨域关联","跟单","查关联订单","关联订单","对应订单","对应业务单"]'::jsonb,
    '查询业务单跨域关联 (sales/purchase/production/return/sample 等)，返回 outbound (我关联了谁) + inbound (谁关联了我). 输入 ownerType + ownerId.',
    85,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (intent_code) DO UPDATE
SET tool_name = 'business_link_query',
    intent_category = 'CRM',
    sensitivity_level = 'LOW',
    keywords = EXCLUDED.keywords,
    description = EXCLUDED.description,
    priority = 85,
    is_active = true,
    updated_at = NOW();
