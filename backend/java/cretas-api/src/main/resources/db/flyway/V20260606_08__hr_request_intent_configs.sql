-- V20260606_02: HR self-service AIChat intents (Sprint 4 W2 Chat E — H-LEAVE+OVT+EXP)
--
-- 4 read-only query intents binding to AbstractBusinessTool implementations:
--   * HR_LEAVE_REQUEST_QUERY    → leave_request_query
--   * HR_OVERTIME_REQUEST_QUERY → overtime_request_query
--   * HR_EXPENSE_REQUEST_QUERY  → expense_request_query
--   * HR_LEAVE_BALANCE_QUERY    → leave_balance_query
--
-- Sensitivity: LOW (read-only, no side effects).
-- Priority 80 = baseline (per V20260601_02 pattern).
-- Tool 自身按命名约定 (*_query) auto-derive ActionType=QUERY / RiskLevel=LOW.

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES
(
    gen_random_uuid(),
    'HR_LEAVE_REQUEST_QUERY',
    '请假申请查询',
    'DATA_QUERY',
    'leave_request_query',
    'LOW',
    '["请假","我的请假","待审请假","请假记录","请假申请","请假列表","谁请假","请假统计","年假","病假","事假","调休"]',
    'Sprint 4 W2 H-LEAVE-1: 查询请假申请, 支持 mine/pending/all scope + 月度汇总. read-only.',
    80, true, NOW(), NOW()
),
(
    gen_random_uuid(),
    'HR_OVERTIME_REQUEST_QUERY',
    '加班调休申请查询',
    'DATA_QUERY',
    'overtime_request_query',
    'LOW',
    '["加班","加班记录","我的加班","调休","调休余额","本月加班","加班申请","加班统计","加班工资","待审加班"]',
    'Sprint 4 W2 H-OVT-1: 查询加班/调休申请, 月汇总按 CASH/COMPTIME 分组. read-only.',
    80, true, NOW(), NOW()
),
(
    gen_random_uuid(),
    'HR_EXPENSE_REQUEST_QUERY',
    '报销申请查询',
    'DATA_QUERY',
    'expense_request_query',
    'LOW',
    '["报销","我的报销","报销记录","差旅报销","餐补","本月报销","报销统计","报销申请","报销列表","谁报销最多","待审报销"]',
    'Sprint 4 W2 H-EXP-1: 查询报销申请, 月汇总按类目分组 (TRAVEL/MEAL/OFFICE/ENTERTAIN/TRAINING/OTHER). read-only.',
    80, true, NOW(), NOW()
),
(
    gen_random_uuid(),
    'HR_LEAVE_BALANCE_QUERY',
    '假期余额查询',
    'DATA_QUERY',
    'leave_balance_query',
    'LOW',
    '["还有多少年假","年假余额","调休余额","病假余额","假期余额","本月余额","剩余年假","我的余额","假期还剩"]',
    'Sprint 4 W2 H-LEAVE-1: 查询月度假期余额 (ANNUAL/SICK/COMPTIME/OTHER 跟踪类型), 显示已获/已用/剩余. read-only.',
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
