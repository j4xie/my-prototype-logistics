-- Sprint 5 Tool 3: reminder_query_mine intent binding.
-- Pairs with ai/tool/impl/system/ReminderQueryTool.java (@Component, getToolName=reminder_query_mine).
-- Wraps ReminderService.listMine (shipped via PR #766 Sprint 4 W2 S-REMIND-1) for AIChat.
-- Pattern mirrors V20260526_03__sales_need_intent_configs.sql.
-- Note: table name is PLURAL ai_intent_configs (HARD rule, 2 prior hotfixes for singular typo).

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'REMINDER_LIST_MINE',
    '我的提醒列表',
    'DATA_OPERATION',
    'reminder_query_mine',
    'LOW',
    '["我的提醒","待办提醒","催款提醒","收款催办","收款提醒","有什么待办","提醒列表","今天的提醒","什么没处理","催办","我有什么提醒","查提醒"]',
    '查询当前用户的待办提醒 (默认 PENDING+SNOOZED, 含收款逾期/即将到期等). 按 dueDate 升序返回, 包含 sourceId 业务单号 + dueDate + message 上下文, 顶层 actionHint 指向 /sales/reminders.',
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
