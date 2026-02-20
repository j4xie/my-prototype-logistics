-- =====================================================
-- V2026_02_11_01: Add EQUIPMENT_STATUS_QUERY intent config
-- Purpose: Add missing intent config for equipment status query
-- The EQUIPMENT_STATUS_QUERY intent was mapped in IntentKnowledgeBase
-- but had no corresponding ai_intent_configs entry, causing
-- execution to fail with "未找到意图配置" error.
-- =====================================================

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
)
SELECT
    gen_random_uuid()::varchar, 'EQUIPMENT_STATUS_QUERY', '查询设备运行状态', 'EQUIPMENT',
    'LOW', 1,
    '["设备运行状态", "设备状态", "机台运行情况", "设备健康度", "设备故障", "有没有设备故障", "机器状态", "设备正常吗", "设备运行情况", "产线状态"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator"]', 85,
    '查询所有设备的运行状态汇总，包括运行中、空闲、维护中、故障设备数量及详情',
    'equipment_status_query', 'DATA', 'QUERY', 'EQUIPMENT',
    true, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM ai_intent_configs WHERE intent_code = 'EQUIPMENT_STATUS_QUERY'
);
