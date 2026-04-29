-- V20260425_11__module_schemas_referencemodule_to_apiendpoint.sql
--
-- R12 (R10 audit S2 + Meta-issue): backfill `referenceConfig.apiEndpoint` for ALL
-- pre-existing module_schemas with `type=reference` lacking `referenceConfig`.
--
-- Background: V20260410_08/09/10 seeded ~17 fields with shape:
--   {"type":"reference","referenceModule":"X"}     -- 8 fields, recoverable from referenceModule
--   {"type":"reference"}                            -- 9 fields, no module hint (v0 schemas)
-- ReferenceSelector.vue only reads `apiEndpoint`, ignoring `referenceModule` entirely.
--
-- Resolution strategy (priority order):
-- 1. If `referenceModule` is set, map it directly.
-- 2. Otherwise derive from `fieldCode` suffix convention:
--    - *TypeId → respective type entity (productTypeId → products, materialTypeId → materials)
--    - *Id with no Type prefix → infer entity from prefix
--    (workerId/inspectorId → employees; batchId → materials as fallback for legacy schemas
--     that conflate batch with material; productBatchId → products as best-effort fallback)
--
-- batchId/productBatchId are LOSSY — there's no /reference-data/batches endpoint and these
-- schemas predate the batch model. Fallback to /materials so dropdown is at least non-empty
-- when the schema goes DYNAMIC. If a factory genuinely needs batch-typed dropdowns, a
-- separate /reference-data/batches endpoint must be added; this migration's job is to
-- ensure NO field has missing apiEndpoint (defensive, ReferenceSelector now loud-fails).

UPDATE module_schemas
SET field_schema = (
    SELECT jsonb_agg(
        CASE
            WHEN f->>'type' = 'reference' AND NOT (f ? 'referenceConfig') THEN
                f || jsonb_build_object(
                    'referenceConfig',
                    jsonb_build_object(
                        'entity',
                            COALESCE(NULLIF(f->>'referenceModule', ''),
                                CASE
                                    WHEN f->>'fieldCode' LIKE '%productTypeId%' OR f->>'fieldCode' = 'productTypeId' THEN 'productType'
                                    WHEN f->>'fieldCode' LIKE '%materialTypeId%' OR f->>'fieldCode' = 'materialTypeId' THEN 'rawMaterialType'
                                    WHEN f->>'fieldCode' LIKE '%customerId%' THEN 'customer'
                                    WHEN f->>'fieldCode' LIKE '%supplierId%' THEN 'supplier'
                                    WHEN f->>'fieldCode' LIKE '%salesOrderId%' OR f->>'fieldCode' LIKE '%sourceOrderId%' THEN 'salesOrder'
                                    WHEN f->>'fieldCode' LIKE '%purchaseOrderId%' THEN 'purchaseOrder'
                                    WHEN f->>'fieldCode' IN ('workerId', 'inspectorId', 'salespersonId', 'employeeId') THEN 'user'
                                    WHEN f->>'fieldCode' IN ('batchId', 'productBatchId') THEN 'rawMaterialType'  -- lossy fallback
                                    ELSE 'unknown'
                                END
                            ),
                        'valueField', 'id',
                        'displayField',
                            CASE
                                WHEN COALESCE(NULLIF(f->>'referenceModule', ''),
                                    CASE
                                        WHEN f->>'fieldCode' LIKE '%productTypeId%' THEN 'productType'
                                        WHEN f->>'fieldCode' LIKE '%materialTypeId%' THEN 'rawMaterialType'
                                        WHEN f->>'fieldCode' LIKE '%customerId%' THEN 'customer'
                                        WHEN f->>'fieldCode' LIKE '%supplierId%' THEN 'supplier'
                                        WHEN f->>'fieldCode' LIKE '%salesOrderId%' OR f->>'fieldCode' LIKE '%sourceOrderId%' THEN 'salesOrder'
                                        WHEN f->>'fieldCode' LIKE '%purchaseOrderId%' THEN 'purchaseOrder'
                                        WHEN f->>'fieldCode' IN ('workerId', 'inspectorId', 'salespersonId', 'employeeId') THEN 'user'
                                        WHEN f->>'fieldCode' IN ('batchId', 'productBatchId') THEN 'rawMaterialType'
                                        ELSE 'unknown'
                                    END
                                )
                                IN ('user') THEN 'fullName'
                                WHEN COALESCE(NULLIF(f->>'referenceModule', ''),
                                    CASE
                                        WHEN f->>'fieldCode' LIKE '%purchaseOrderId%' THEN 'purchaseOrder'
                                        WHEN f->>'fieldCode' LIKE '%salesOrderId%' OR f->>'fieldCode' LIKE '%sourceOrderId%' THEN 'salesOrder'
                                        ELSE 'name'
                                    END
                                )
                                = 'purchaseOrder' THEN 'poNumber'
                                WHEN COALESCE(NULLIF(f->>'referenceModule', ''),
                                    CASE
                                        WHEN f->>'fieldCode' LIKE '%salesOrderId%' OR f->>'fieldCode' LIKE '%sourceOrderId%' THEN 'salesOrder'
                                        ELSE 'name'
                                    END
                                )
                                = 'salesOrder' THEN 'orderNumber'
                                ELSE 'name'
                            END,
                        'apiEndpoint', '/api/mobile/{factoryId}/reference-data/' ||
                            CASE
                                WHEN f->>'fieldCode' LIKE '%productTypeId%' THEN 'products'
                                WHEN f->>'fieldCode' LIKE '%materialTypeId%' THEN 'materials'
                                WHEN f->>'fieldCode' LIKE '%customerId%' THEN 'customers'
                                WHEN f->>'fieldCode' LIKE '%supplierId%' THEN 'suppliers'
                                WHEN f->>'fieldCode' LIKE '%salesOrderId%' OR f->>'fieldCode' LIKE '%sourceOrderId%' THEN 'sales-orders'
                                WHEN f->>'fieldCode' LIKE '%purchaseOrderId%' THEN 'purchase-orders'
                                WHEN f->>'fieldCode' IN ('workerId', 'inspectorId', 'salespersonId', 'employeeId') THEN 'employees'
                                WHEN f->>'fieldCode' IN ('batchId', 'productBatchId') THEN 'materials'  -- lossy fallback
                                WHEN f->>'referenceModule' = 'supplier' THEN 'suppliers'
                                WHEN f->>'referenceModule' = 'customer' THEN 'customers'
                                WHEN f->>'referenceModule' = 'purchase_order' THEN 'purchase-orders'
                                WHEN f->>'referenceModule' = 'sales_order' THEN 'sales-orders'
                                ELSE 'unknown'
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
      AND NOT (f ? 'referenceConfig')
  );

DO $$
DECLARE
  v_remaining INT;
  v_filled INT;
  v_unknown INT;
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

  SELECT COUNT(*) INTO v_unknown
  FROM module_schemas, jsonb_array_elements(field_schema) f
  WHERE jsonb_typeof(field_schema) = 'array'
    AND f->>'type' = 'reference'
    AND f->'referenceConfig'->>'apiEndpoint' LIKE '%/unknown';

  RAISE NOTICE 'V20260425_11: % filled, % remaining missing referenceConfig, % with unknown entity', v_filled, v_remaining, v_unknown;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'V20260425_11 sanity: % reference fields still missing referenceConfig', v_remaining;
  END IF;
  -- Allow 'unknown' endpoints to ship — ReferenceSelector loud-fails on 404 + dev fixes the schema.
  IF v_unknown > 0 THEN
    RAISE WARNING 'V20260425_11: % fields fall back to /unknown endpoint; review and fix in next migration', v_unknown;
  END IF;
END $$;
