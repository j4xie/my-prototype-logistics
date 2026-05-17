-- F-INV-1 gap-fill: bind FINANCE_INVOICE_STATUS intent → InvoiceStatusTool
-- Fast-path keyword/phrase match for "开票进度" / "发票状态" / "查发票" type queries.

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'FINANCE_INVOICE_STATUS', '开票申请状态查询', 'FINANCE',
    'LOW', 1,
    '["开票进度","开票状态","发票状态","发票进度","查发票","查开票","查询开票","查询发票","开票记录","发票记录","开票申请进度","发票到哪了","开票到哪一步"]',
    NULL, 75,
    '查询开票申请状态 — 返回开票申请的状态/金额/税率分组/各阶段时间戳。支持按销售订单ID或开票记录ID查询。',
    'finance_invoice_status', 'FINANCE', 'QUERY', 'INVOICE',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    intent_name = EXCLUDED.intent_name,
    keywords = EXCLUDED.keywords,
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    is_active = TRUE,
    updated_at = NOW();
