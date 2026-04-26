-- V20260425_11__module_schemas_referencemodule_to_apiendpoint.sql
--
-- R12 (R10 audit S2 + Meta-issue): backfill `referenceConfig.apiEndpoint` for
-- pre-existing module_schemas that use legacy `referenceModule` shape (no apiEndpoint).
--
-- Background: V20260410_08/09/10 seeded ~20 schemas with shape:
--   {"type":"reference","referenceModule":"supplier", ...}  -- no apiEndpoint
--
-- ReferenceSelector.vue only reads `apiEndpoint` (line 15), ignores `referenceModule`.
-- So any factory that flips these modules to DYNAMIC mode gets a silent empty dropdown
-- (no error — try/catch swallows the request.get(undefined,...) failure).
--
-- The R1-R10 arc fixed sales_order schema explicitly (V20260425_01) and bom (V20260425_03),
-- but did not sweep the other 8 schemas with the same problem. Audit R7 (reviewer #5)
-- listed them as "Tier 3 time-bombs"; R10 audit (reviewer #7) elevated to a meta-issue.
--
-- Affected schemas (verified prod 2026-04-25 EDT):
--   finance_ap.purchaseOrderId, finance_ap.supplierId
--   finance_ar.customerId, finance_ar.salesOrderId
--   inbound.purchaseOrderId, outbound.salesOrderId
--   production_plan.sourceOrderId
--   purchase_order.supplierId
--
-- Mapping referenceModule → apiEndpoint:
--   supplier        → /api/mobile/{factoryId}/reference-data/suppliers
--   customer        → /api/mobile/{factoryId}/reference-data/customers
--   purchase_order  → /api/mobile/{factoryId}/reference-data/purchase-orders   (NEW endpoint, pending)
--   sales_order     → /api/mobile/{factoryId}/reference-data/sales-orders      (NEW endpoint, pending)
--
-- IMPORTANT: This migration backfills the schema, but two endpoints
-- (`/reference-data/purchase-orders` and `/reference-data/sales-orders`) don't yet exist.
-- ReferenceDataController will return 404 until they're added in a follow-up commit.
-- That's acceptable: these schemas are TIER 3 (no factory currently has them in DYNAMIC),
-- so the backfill is forward-compat preparation. ReferenceSelector now FAILS LOUDLY (per
-- the R12 FE defensive fix) instead of silently empty.
--
-- For supplier/customer (already-implemented endpoints), the schemas become immediately
-- functional if any factory flips these modules to DYNAMIC.
--
-- All 8 schemas are top-level-array shape (jsonb_typeof=array, no `fields` wrapper) —
-- this is V20260410_08/09/10 convention.

UPDATE module_schemas
SET field_schema = (
    SELECT jsonb_agg(
        CASE
            WHEN f->>'type' = 'reference' AND f ? 'referenceModule' AND NOT (f ? 'referenceConfig') THEN
                f || jsonb_build_object(
                    'referenceConfig',
                    jsonb_build_object(
                        'entity', f->>'referenceModule',
                        'valueField', 'id',
                        'displayField',
                            CASE
                                WHEN f->>'referenceModule' = 'supplier' THEN 'name'
                                WHEN f->>'referenceModule' = 'customer' THEN 'name'
                                WHEN f->>'referenceModule' = 'purchase_order' THEN 'poNumber'
                                WHEN f->>'referenceModule' = 'sales_order' THEN 'orderNumber'
                                ELSE 'name'
                            END,
                        'apiEndpoint',
                            '/api/mobile/{factoryId}/reference-data/' ||
                            CASE
                                WHEN f->>'referenceModule' = 'supplier' THEN 'suppliers'
                                WHEN f->>'referenceModule' = 'customer' THEN 'customers'
                                WHEN f->>'referenceModule' = 'purchase_order' THEN 'purchase-orders'
                                WHEN f->>'referenceModule' = 'sales_order' THEN 'sales-orders'
                                ELSE f->>'referenceModule'
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
      AND f ? 'referenceModule'
      AND NOT (f ? 'referenceConfig')
  );

DO $$
DECLARE
  v_remaining INT;
  v_filled INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM module_schemas, jsonb_array_elements(field_schema) f
  WHERE jsonb_typeof(field_schema) = 'array'
    AND f->>'type' = 'reference'
    AND NOT (f ? 'referenceConfig');

  SELECT COUNT(*) INTO v_filled
  FROM module_schemas, jsonb_array_elements(field_schema) f
  WHERE jsonb_typeof(field_schema) = 'array'
    AND f->>'type' = 'reference'
    AND f ? 'referenceConfig';

  RAISE NOTICE 'V20260425_11: % reference fields now have apiEndpoint, % still missing', v_filled, v_remaining;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'V20260425_11 sanity: % reference fields still missing referenceConfig', v_remaining;
  END IF;
END $$;
