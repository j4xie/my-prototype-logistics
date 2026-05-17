-- V20260606_13: Sprint 5 Tool 4 — hr_leave_submit intent binding (WRITE + preview)
--
-- First HR WRITE Tool. Wraps LeaveRequestService.create + submit (from #770).
-- TCC preview shows balance vs requested (R1), execute applies dedup (R4),
-- context carries identity (R2).
--
-- Sensitivity: MEDIUM (WRITE op affecting LeaveBalance via approve).
-- Priority 90 = above query baseline (80) to win over read intents on ambiguous phrasing.
-- ActionType=WRITE, RiskLevel=MEDIUM (Tool 内 override, 非 *_create 后缀 auto-derive 失效).

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'HR_LEAVE_SUBMIT',
    '提交请假申请',
    'DATA_OPERATION',
    'hr_leave_submit',
    'MEDIUM',
    '["请假","请年假","请病假","事假","调休","休假申请","我要请","请假申请","调休申请",' ||
     '"提交请假","申请请假","请假表","婚假","产假","陪产假","丧假","请几天假",' ||
     '"明天请假","下周请假","年假申请","病假申请","调休申请","休产假","休病假"]',
    'Sprint 5 Tool 4: 提交请假申请 (WRITE with preview). 自动检查余额 + 触发审批. 支持 ANNUAL/SICK/PERSONAL/COMPTIME/MARRIAGE/FUNERAL/MATERNITY/PATERNITY/OTHER. 防呆 R1 (preview 显示余额) + R2 (context 含 用户/类型/起止/时长) + R4 (Service 内 时段重叠 dedup, 409 转 actionHint).',
    90, true, NOW(), NOW()
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
