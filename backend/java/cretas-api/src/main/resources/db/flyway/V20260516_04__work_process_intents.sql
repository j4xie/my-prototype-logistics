-- V20260516_04: Register 5 work-process intents for Track D2 AI Tools.
--
-- Brief: 04-最终决策/TRACK_D2_BRIEF.md §6.3
-- Spec: 宏见竞品分析/01-客户档案/SCHEMA_DESIGN.md §2.5 line 1106-1112
--
-- Pairs with 5 @Component Tools under ai/tool/impl/workprocess/:
--   work_process_task_spawn       → WorkProcessTaskSpawnTool
--   work_process_task_start       → WorkProcessTaskStartTool
--   work_process_task_complete    → WorkProcessTaskCompleteTool
--   work_process_task_assign      → WorkProcessTaskAssignTool
--   work_process_config_update    → WorkProcessConfigUpdateTool (WRITE preview)
--
-- Pattern mirrors V20260513_02__revenue_report_intent.sql:
--   - gen_random_uuid() for ID
--   - explicit created_at = NOW(), updated_at = NOW() (NOT NULL with no DEFAULT)
--   - ON CONFLICT (intent_code) DO UPDATE keeps tool_name in sync
--
-- Priority 80 = proven baseline for finance/restaurant intents.
-- Sensitivity LOW for read/state-machine actions; MEDIUM for config_update (WRITE).

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES
(
    gen_random_uuid(),
    'WORK_PROCESS_TASK_SPAWN',
    '生成工序任务',
    'PRODUCTION',
    'work_process_task_spawn',
    'LOW',
    '["生成工序任务","批次工序任务","spawn工序","为批次生成工序","启动工序","批次开工序","工序实例化"]',
    '为生产批次从 product_work_processes 模板生成工序任务实例 (1 个工序 = 1 个任务, status=PENDING)。需 productionBatchId + productTypeId。',
    80, true, NOW(), NOW()
),
(
    gen_random_uuid(),
    'WORK_PROCESS_TASK_START',
    '开始工序',
    'PRODUCTION',
    'work_process_task_start',
    'LOW',
    '["开始工序","执行工序","工序开工","启动工序任务","开始操作工序"]',
    '将工序任务从 PENDING 推进到 IN_PROGRESS, 记录实际开始时间。',
    80, true, NOW(), NOW()
),
(
    gen_random_uuid(),
    'WORK_PROCESS_TASK_COMPLETE',
    '完成工序',
    'PRODUCTION',
    'work_process_task_complete',
    'LOW',
    '["完成工序","工序做完","工序完工","结束工序","录入产量","完成工序任务"]',
    '将工序任务从 IN_PROGRESS 推进到 COMPLETED, 必须录入实际产量 (actualQuantity), 自动计算实际工时。',
    80, true, NOW(), NOW()
),
(
    gen_random_uuid(),
    'WORK_PROCESS_TASK_ASSIGN',
    '分配工序责任人',
    'PRODUCTION',
    'work_process_task_assign',
    'LOW',
    '["分配工序","指派工序","派工","工序责任人","工序分配给","分配工序任务"]',
    '为工序任务分配责任人 (assignedTo userId)。不改变任务状态。',
    80, true, NOW(), NOW()
),
(
    gen_random_uuid(),
    'WORK_PROCESS_CONFIG_UPDATE',
    '配置产品工序',
    'PRODUCTION',
    'work_process_config_update',
    'MEDIUM',
    '["给产品加工序","配置工序","设置工序流程","产品工序配置","工序流程","批量配置工序","加工序"]',
    '为指定产品配置完整工序流程 (REPLACE 语义, 按顺序写入)。支持 preview 预览变更。一句话给产品加工序: "给猪蹄加工序: 拆包→分割→卤制→分切→装筐"。',
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
