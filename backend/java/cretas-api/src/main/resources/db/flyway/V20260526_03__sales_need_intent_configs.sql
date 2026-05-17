-- Sprint 4 W2 S-NEED-1: register AI intent configs for sales_need_create + sales_need_convert.
-- Pairs with SalesNeedCreateTool + SalesNeedConvertTool (@Component, getToolName).
-- Pattern mirrors V20260513_02__revenue_report_intent.sql.

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'SALES_NEED_CREATE',
    '创建客户需求',
    'DATA_OPERATION',
    'sales_need_create',
    'LOW',
    '["创建客户需求","记客户需求","客户要","客户想要","记一个需求","客户提需求","新建需求","录入需求","需求录入"]',
    '创建客户需求 (DRAFT 状态). 客户提的购买意向, 销售员后续确认并转销售订单. 需客户ID/产品ID/数量/单位.',
    80,
    true,
    NOW(),
    NOW()
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

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'SALES_NEED_CONVERT',
    '客户需求转销售订单',
    'DATA_OPERATION',
    'sales_need_convert',
    'LOW',
    '["需求转订单","客户需求转销售单","转销售单","转销售订单","一键转销售","需求转销售单","把需求变成订单"]',
    '将 CONFIRMED 客户需求一键转为销售订单. 自动建 SalesOrder + 双向关联 needId.',
    80,
    true,
    NOW(),
    NOW()
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
