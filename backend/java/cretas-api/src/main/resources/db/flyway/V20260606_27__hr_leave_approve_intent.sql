-- V20260606_27: HR_LEAVE_APPROVE intent binding — closes #848 PHRASE_MATCH gap
--
-- Sprint 5 PR #848 fixed "请假申请" / "帮我请假" → HR_LEAVE_SUBMIT (V20260606_13),
-- but left "批准请假" routed to ATTENDANCE_STATS (no HR_LEAVE_APPROVE Tool existed
-- at the time). This migration ships the missing HR_LEAVE_APPROVE intent +
-- companion LeaveRequestApproveTool (WRITE + preview, wraps existing
-- LeaveRequestService.approve / reject from #770).
--
-- ActionType=WRITE, RiskLevel=MEDIUM. priority=95 mirrors V20260606_15 sibling
-- Sprint 5 Tools (HR_LEAVE_SUBMIT bumped to 95 in that migration to win KEYWORD
-- tier vs legacy ATTENDANCE_STATS). PHRASE_MATCH side is fixed via
-- IntentKnowledgeBase.phraseToIntentMapping edit (Java-side) so this migration
-- only owns the database-side intent config.
--
-- Table name verified PLURAL: ai_intent_configs (per
-- feedback_pr_review_must_grep_migration_table_names HARD rule).

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'HR_LEAVE_APPROVE',
    '批准/驳回请假申请',
    'DATA_OPERATION',
    'hr_leave_approve',
    'MEDIUM',
    ('["批准请假","同意请假","通过请假","驳回请假","拒绝请假","审批请假",' ||
     '"批准这个请假","同意这个请假","通过该请假","驳回该请假",' ||
     '"批假","准假","批准休假","同意休假","驳回休假","拒绝休假",' ||
     '"批假申请","驳回假条","通过休假申请","拒绝休假申请",' ||
     '"批准 LR","批准 lr","审批通过","审批驳回","审批拒绝"]')::jsonb,
    'HR_LEAVE_APPROVE (#848 follow-up): 批准或驳回请假申请 (WRITE with preview). 包装 LeaveRequestService.approve / reject. APPROVE 后自动扣减余额 + 发布 LeaveApprovedEvent (CompTime ledger 出账); REJECT 时 notes 必填作为 rejectReason. 防呆 R1 (preview 显示申请人/类型/期间/时长/当前状态) + R2 (context 含 审批人/申请人/决定/leaveId/终态) + R3 (decision enum APPROVE/REJECT + REJECT 强制 notes) + R4 (Service state 校验 重复 approve 抛 BusinessException, Tool 转 DUPLICATE + actionHint).',
    95, true, NOW(), NOW()
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
