-- V20260425_13__fix_v11_snake_case_displayfield.sql
--
-- R14 (R12 audit CRIT-1, reviewer #8): V11 had internal snake_vs_camel inconsistency.
-- displayField CASE compared `referenceModule = 'purchaseOrder'` (camel) but V20260410
-- seeded `referenceModule = 'purchase_order'` (snake). Comparison FALSE → fallthrough to
-- ELSE 'name'. Controller returns {id, poNumber, supplierId} for /purchase-orders and
-- {id, orderNumber, customerId} for /sales-orders — no 'name' key. ReferenceSelector
-- evaluates item['name'] = undefined → blank dropdown labels.
--
-- Affected 5 fields (verified prod):
--   inbound.purchaseOrderId           → was 'name', should be 'poNumber'
--   finance_ap.purchaseOrderId        → was 'name', should be 'poNumber'
--   outbound.salesOrderId             → was 'name', should be 'orderNumber'
--   finance_ar.salesOrderId           → was 'name', should be 'orderNumber'
--   production_plan.sourceOrderId     → was 'name', should be 'orderNumber'
--
-- These modules are all currently LEGACY mode (no factory has flipped to DYNAMIC), so
-- no current user-facing impact, but R12 was supposed to make them forward-compat.
-- This migration corrects the displayField — same UPDATE pattern + fieldCode-based
-- determination (avoids snake/camel issue by using fieldCode suffix instead).

UPDATE module_schemas
SET field_schema = (
    SELECT jsonb_agg(
        CASE
            WHEN f->>'type' = 'reference'
                 AND f ? 'referenceConfig'
                 AND (f->'referenceConfig'->>'displayField' = 'name')
                 AND (f->>'fieldCode' LIKE '%purchaseOrderId' OR f->>'fieldCode' LIKE '%salesOrderId' OR f->>'fieldCode' LIKE '%sourceOrderId') THEN
                jsonb_set(
                    f,
                    '{referenceConfig,displayField}',
                    to_jsonb(
                        CASE
                            WHEN f->>'fieldCode' LIKE '%purchaseOrderId' THEN 'poNumber'
                            ELSE 'orderNumber'
                        END
                    )
                )
            ELSE f
        END
    )
    FROM jsonb_array_elements(field_schema) f
)
WHERE jsonb_typeof(field_schema) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(field_schema) f
    WHERE f->>'type' = 'reference'
      AND f ? 'referenceConfig'
      AND (f->'referenceConfig'->>'displayField' = 'name')
      AND (f->>'fieldCode' LIKE '%purchaseOrderId' OR f->>'fieldCode' LIKE '%salesOrderId' OR f->>'fieldCode' LIKE '%sourceOrderId')
  );

DO $$
DECLARE
  v_remaining INT;
  v_fixed INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM module_schemas, jsonb_array_elements(field_schema) f
  WHERE jsonb_typeof(field_schema) = 'array'
    AND f->>'type' = 'reference'
    AND (f->>'fieldCode' LIKE '%purchaseOrderId' OR f->>'fieldCode' LIKE '%salesOrderId' OR f->>'fieldCode' LIKE '%sourceOrderId')
    AND f->'referenceConfig'->>'displayField' = 'name';

  SELECT COUNT(*) INTO v_fixed
  FROM module_schemas, jsonb_array_elements(field_schema) f
  WHERE jsonb_typeof(field_schema) = 'array'
    AND f->>'type' = 'reference'
    AND (f->>'fieldCode' LIKE '%purchaseOrderId' OR f->>'fieldCode' LIKE '%salesOrderId' OR f->>'fieldCode' LIKE '%sourceOrderId')
    AND f->'referenceConfig'->>'displayField' IN ('poNumber', 'orderNumber');

  RAISE NOTICE 'V20260425_13: % displayFields corrected, % still mis-set as ''name''', v_fixed, v_remaining;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'V20260425_13 sanity: % order-id fields still have displayField=name', v_remaining;
  END IF;
END $$;
