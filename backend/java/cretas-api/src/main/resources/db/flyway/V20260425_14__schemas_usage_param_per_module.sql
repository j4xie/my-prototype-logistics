-- V20260425_14__schemas_usage_param_per_module.sql
--
-- R19 (R18 audit CRIT-A+B): /reference-data/sales-orders + /purchase-orders are SHARED
-- across modules with DIFFERENT business semantics. R17 set a finance-only whitelist
-- for both, which broke production_plan (needs CONFIRMED+ for sourceOrderId) + would
-- break inbound (receive-before-finance for fast-moving consumables).
--
-- Fix: ReferenceDataController now dispatches via ?usage=invoiceable|plannable|shippable|
-- receivable|all (R19 commit). This migration sets the per-module schema apiEndpoint to
-- include the right ?usage= param so each module gets the right status set.
--
-- Mappings:
--   finance_ar.salesOrderId      → ?usage=invoiceable (post-finance-approved + post)
--   outbound.salesOrderId        → ?usage=shippable (FINANCE_APPROVED+PROCESSING+PARTIAL)
--   production_plan.sourceOrderId → ?usage=plannable (CONFIRMED+post, exclude COMPLETED)
--   finance_ap.purchaseOrderId   → ?usage=invoiceable (post-finance-approved)
--   inbound.purchaseOrderId      → ?usage=receivable (APPROVED+, ops-approved enough)

UPDATE module_schemas
SET field_schema = (
    SELECT jsonb_agg(
        CASE
            WHEN f->>'fieldCode' = 'salesOrderId' OR f->>'fieldCode' = 'sourceOrderId' THEN
                jsonb_set(
                    f,
                    '{referenceConfig,apiEndpoint}',
                    to_jsonb(
                        '/api/mobile/{factoryId}/reference-data/sales-orders?usage=' ||
                        CASE module_code
                            WHEN 'finance_ar' THEN 'invoiceable'
                            WHEN 'outbound' THEN 'shippable'
                            WHEN 'production_plan' THEN 'plannable'
                            ELSE 'all'
                        END
                    )
                )
            WHEN f->>'fieldCode' = 'purchaseOrderId' THEN
                jsonb_set(
                    f,
                    '{referenceConfig,apiEndpoint}',
                    to_jsonb(
                        '/api/mobile/{factoryId}/reference-data/purchase-orders?usage=' ||
                        CASE module_code
                            WHEN 'finance_ap' THEN 'invoiceable'
                            WHEN 'inbound' THEN 'receivable'
                            ELSE 'all'
                        END
                    )
                )
            ELSE f
        END
    )
    FROM jsonb_array_elements(field_schema) f
)
WHERE jsonb_typeof(field_schema) = 'array'
  AND module_code IN ('finance_ar', 'outbound', 'production_plan', 'finance_ap', 'inbound')
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(field_schema) f
    WHERE f->>'fieldCode' IN ('salesOrderId', 'sourceOrderId', 'purchaseOrderId')
  );

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM module_schemas, jsonb_array_elements(field_schema) f
  WHERE jsonb_typeof(field_schema) = 'array'
    AND f->>'fieldCode' IN ('salesOrderId', 'sourceOrderId', 'purchaseOrderId')
    AND f->'referenceConfig'->>'apiEndpoint' LIKE '%?usage=%';

  RAISE NOTICE 'V20260425_14: % order-id fields now have ?usage= param', v_count;

  IF v_count < 5 THEN
    RAISE WARNING 'V20260425_14: expected 5 fields with ?usage param, found %', v_count;
  END IF;
END $$;
