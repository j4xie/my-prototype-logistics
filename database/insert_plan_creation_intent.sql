-- AI对话创建生产计划 — 意图配置
-- 2026-02-26

INSERT INTO ai_intent_configs (
    id, factory_id, intent_code, intent_name, intent_category,
    description, trigger_phrases, is_active, priority, created_at, updated_at
) VALUES (
    'intent-prod-plan-create-full',
    'F001',
    'PRODUCTION_PLAN_CREATE_FULL',
    '创建完整生产计划',
    'DATA_OP',
    '通过AI对话引导创建完整生产计划（含产线、工人、主管）',
    '["创建生产计划", "新建计划", "安排生产", "帮我排产", "新增生产计划", "添加生产任务"]',
    true,
    80,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;
