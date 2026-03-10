-- =====================================================
-- V2026_03_10_01: Add financial dashboard chart + PPT export intents
-- Purpose: Enable AI to generate financial charts and export PPT reports
-- =====================================================

-- 1. FINANCIAL_CHART_GENERATE - 财务图表生成 (通用，支持所有图表类型)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'FINANCIAL_CHART_GENERATE', '财务图表生成', 'FINANCE',
    'LOW', 2,
    '["预算完成","预算达成","同比","环比","损益表","利润表","费用分析","品类对比","毛利率","品类结构","财务图表","成本结构","渠道分析","重点产品","财务分析","预算分析","费用同比","品类同期","瀑布图","成本流向","差异分析","现金流","现金流量","KPI","记分卡","关键指标"]',
    NULL, 70,
    '生成财务分析图表，支持预算达成、同比环比、损益表、费用分析、品类对比、毛利率趋势、品类结构等多种图表类型',
    'financial_chart_generate', 'FINANCE', 'QUERY', 'CHART',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    intent_name = EXCLUDED.intent_name,
    keywords = EXCLUDED.keywords,
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 2. FINANCE_PPT_EXPORT - 财务报告导出PPT
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'FINANCE_PPT_EXPORT', '财务报告导出PPT', 'FINANCE',
    'LOW', 3,
    '["导出PPT","生成PPT","财务PPT","报告PPT","演示文稿","导出报告","财务演示","PPT报告"]',
    NULL, 70,
    '将财务分析看板导出为PowerPoint演示文稿',
    'finance_ppt_export', 'FINANCE', 'EXPORT', 'REPORT',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    intent_name = EXCLUDED.intent_name,
    keywords = EXCLUDED.keywords,
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    updated_at = NOW();
