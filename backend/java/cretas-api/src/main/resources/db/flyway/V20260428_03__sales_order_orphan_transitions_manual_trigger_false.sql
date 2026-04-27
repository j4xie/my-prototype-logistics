-- R40 BUG-5 fix: 5+ orphan transitions in module_schemas.sales_order have no backend
-- endpoint. UI rendered buttons would 404. Mark as manualTrigger=false so FE skips
-- rendering. State machine entry preserved for traceability/upstream auto-flip.
--
-- Affected actions:
--   startProduction        → triggered by ProductionPlan creation (SupplyChainOrchestrator)
--   revise                 → no use case yet, draft for V2
--   partialDeliver         → auto-flipped when first delivery confirmed
--   completeRemaining      → auto-flipped when last delivery confirmed
--   complete               → auto-flipped at 100% delivery (SalesDeliveryService)
--   ship                   → handled at /deliveries/{id}/ship, NOT /sales/orders/{id}/ship
--
-- BE endpoints that ARE wired (skip these):
--   confirm, cancel, submit-for-review, finance-approve, finance-reject

UPDATE module_schemas
SET workflow_schema = workflow_schema || jsonb_build_object(
        'transitions',
        (
            SELECT jsonb_agg(
                CASE
                    WHEN t->>'action' IN ('startProduction', 'revise', 'partialDeliver',
                                          'completeRemaining', 'complete', 'ship')
                        THEN t || jsonb_build_object('manualTrigger', false)
                    ELSE t
                END
            )
            FROM jsonb_array_elements(workflow_schema->'transitions') t
        )
    )
WHERE module_code = 'sales_order'
  AND workflow_schema->'transitions' IS NOT NULL;
