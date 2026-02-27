-- 设置AI意图角色权限
-- 车间主管(workshop_supervisor)只允许 报工/查询 操作，禁止创建/修改生产计划
-- 2026-02-27

-- 1. 插入 PRODUCTION_PLAN_CREATE_FULL（限制为管理员+调度员）
INSERT INTO ai_intent_configs (
    id, factory_id, intent_code, intent_name, intent_category,
    description, keywords, required_roles, sensitivity_level,
    is_active, priority, created_at, updated_at
) VALUES (
    'intent-prod-plan-create-full',
    NULL,
    'PRODUCTION_PLAN_CREATE_FULL',
    '创建完整生产计划',
    'DATA_OP',
    '通过AI对话引导创建完整生产计划（含产线、工人、主管）',
    '["创建生产计划", "新建计划", "安排生产", "帮我排产", "新增生产计划", "添加生产任务"]',
    '["factory_super_admin", "dispatcher"]',
    'HIGH',
    true,
    80,
    NOW(),
    NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    required_roles = '["factory_super_admin", "dispatcher"]',
    sensitivity_level = 'HIGH',
    updated_at = NOW();

-- 2. PLAN_UPDATE — 只允许管理员和调度员修改计划
UPDATE ai_intent_configs
SET required_roles = '["factory_super_admin", "dispatcher"]',
    updated_at = NOW()
WHERE intent_code = 'PLAN_UPDATE';

-- 3. PROCESSING_BATCH_CREATE — 创建生产批次只允许管理员和调度员
UPDATE ai_intent_configs
SET required_roles = '["factory_super_admin", "dispatcher", "workshop_supervisor"]',
    updated_at = NOW()
WHERE intent_code = 'PROCESSING_BATCH_CREATE';

-- 4. BATCH_UPDATE — 批次更新允许管理员、调度员、车间主管
UPDATE ai_intent_configs
SET required_roles = '["factory_super_admin", "dispatcher", "workshop_supervisor"]',
    updated_at = NOW()
WHERE intent_code = 'BATCH_UPDATE';

-- 5. SUPPLIER_CREATE / SUPPLIER_DELETE — 供应商操作不允许车间主管（已有限制确认）
-- SUPPLIER_DELETE 已有 ["factory_super_admin", "department_admin", "warehouse_manager"]

-- 验证结果
-- SELECT intent_code, intent_name, required_roles FROM ai_intent_configs
-- WHERE intent_code IN ('PRODUCTION_PLAN_CREATE_FULL', 'PLAN_UPDATE', 'PROCESSING_BATCH_CREATE', 'BATCH_UPDATE');
