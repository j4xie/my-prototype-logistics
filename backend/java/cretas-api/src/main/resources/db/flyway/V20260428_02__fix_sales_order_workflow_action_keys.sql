-- R38 BUG-3 P0 fix: module_schemas.sales_order.workflow_schema.transitions[].action
-- 用 camelCase ('submitForReview', 'approveFinance', 'rejectFinance', 'resubmitForReview')
-- 但 SalesController 实际 endpoint 是 kebab ('submit-for-review', 'finance-approve', 'finance-reject')
-- 后果: DynamicModulePage.vue:189 用 ` $ {transition.action} ` 直拼 URL → 404 → 5 个 SO 状态转移全断
-- (CONFIRMED→PENDING_FINANCE_REVIEW / PENDING_FINANCE_REVIEW→FINANCE_APPROVED/FINANCE_REJECTED /
--  FINANCE_REJECTED→PENDING_FINANCE_REVIEW)
--
-- R38 真窗 verify: 点 SO-20260424-0013 (CONFIRMED) 的"提交审核"按钮 → 404
--   ElNotification: "请求的接口不存在 (POST /F001/sales/orders/.../submitForReview)"
--
-- 这是六扇门 V1 finance-review 流程的 P0 阻断 bug. 修复后 DYNAMIC view 与 list.vue legacy view
-- 行为对齐.
--
-- 修复 jsonb 路径: transitions array 各 index 的 .action 字段
-- (FE list.vue legacy view 一直用 kebab 没事, 只是 DYNAMIC list 走 schema action key)

UPDATE module_schemas
SET workflow_schema = (
    -- 用 jsonb_path_query/array_to_jsonb 不可行, 用整个 array replace
    -- 解构: top-level 保留, 替换 transitions array
    workflow_schema
    || jsonb_build_object(
        'transitions',
        (
            SELECT jsonb_agg(
                CASE t->>'action'
                    WHEN 'submitForReview'   THEN t || jsonb_build_object('action', 'submit-for-review')
                    WHEN 'approveFinance'    THEN t || jsonb_build_object('action', 'finance-approve')
                    WHEN 'rejectFinance'     THEN t || jsonb_build_object('action', 'finance-reject')
                    WHEN 'resubmitForReview' THEN t || jsonb_build_object('action', 'submit-for-review')
                    ELSE t
                END
            )
            FROM jsonb_array_elements(workflow_schema->'transitions') t
        )
    )
)
WHERE module_code = 'sales_order'
  AND workflow_schema->'transitions' IS NOT NULL;
