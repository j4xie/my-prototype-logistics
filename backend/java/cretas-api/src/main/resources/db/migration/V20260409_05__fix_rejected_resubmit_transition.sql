-- V20260409_05: Add FINANCE_REJECTED -> PENDING_FINANCE_REVIEW transition
-- Found by E2E: SalesServiceImpl allows resubmit from REJECTED, but canvas seed was missing this transition

UPDATE module_schemas
SET workflow_schema = jsonb_set(
    workflow_schema,
    '{transitions}',
    workflow_schema->'transitions' || '[{"from":"FINANCE_REJECTED","to":"PENDING_FINANCE_REVIEW","action":"resubmitForReview","label":"重新提交审核","buttonType":"warning"}]'::jsonb
)
WHERE module_code = 'sales_order'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(workflow_schema->'transitions') t
    WHERE t->>'from' = 'FINANCE_REJECTED' AND t->>'to' = 'PENDING_FINANCE_REVIEW'
  );
