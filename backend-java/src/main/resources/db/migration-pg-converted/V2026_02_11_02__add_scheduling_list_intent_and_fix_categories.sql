-- =====================================================
-- V2026_02_11_02: Add SCHEDULING_LIST intent + fix intent categories
-- Purpose:
--   1. Add SCHEDULING_LIST intent config (排班计划查询)
--   2. Ensure COST_QUERY has intent_category='REPORT'
--   3. Ensure CUSTOMER_LIST has intent_category='CRM'
-- =====================================================

-- 1. Add SCHEDULING_LIST intent config
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
)
SELECT
    gen_random_uuid()::varchar, 'SCHEDULING_LIST', '排班计划查询', 'REPORT',
    'LOW', 1,
    '["排班", "排班计划", "排班表", "班次安排", "排班情况", "明天排班"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "dispatcher"]', 80,
    '查询排班计划列表，支持按时间范围筛选',
    'scheduling_list', 'DATA', 'QUERY', 'SCHEDULING',
    true, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM ai_intent_configs WHERE intent_code = 'SCHEDULING_LIST'
);

-- 2. Ensure COST_QUERY is in REPORT category
UPDATE ai_intent_configs
SET intent_category = 'REPORT', updated_at = NOW()
WHERE intent_code = 'COST_QUERY' AND intent_category != 'REPORT';

-- 3. Ensure CUSTOMER_LIST is in CRM category
UPDATE ai_intent_configs
SET intent_category = 'CRM', updated_at = NOW()
WHERE intent_code = 'CUSTOMER_LIST' AND intent_category != 'CRM';
