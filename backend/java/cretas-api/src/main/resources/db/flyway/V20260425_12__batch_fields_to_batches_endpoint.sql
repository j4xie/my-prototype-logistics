-- V20260425_12__batch_fields_to_batches_endpoint.sql
--
-- R13 (R12 audit Q6 fix): R12 V11 fell back batch* fields to /materials (lossy).
-- Now that /reference-data/batches endpoint exists (R13 commit), re-point these
-- fields to the correct entity.
--
-- Affected:
--   quality_inspection.batchId      → was /materials, now /batches
--   production_report.batchId       → was /materials, now /batches
--   traceability.productBatchId     → was /materials, now /batches
--
-- Semantically correct: MaterialBatch (batch_number, materialType FK) instead of
-- RawMaterialType (basic catalog). Audit said: "if any factory ever flips
-- quality_inspection or traceability to DYNAMIC, the batch dropdown will return
-- materials (raw materials) which is WRONG." This fixes that.

UPDATE module_schemas
SET field_schema = (
    SELECT jsonb_agg(
        CASE
            WHEN f->>'fieldCode' IN ('batchId', 'productBatchId') THEN
                jsonb_set(
                    f,
                    '{referenceConfig}',
                    jsonb_build_object(
                        'entity', 'materialBatch',
                        'valueField', 'id',
                        'displayField', 'batchNumber',
                        'apiEndpoint', '/api/mobile/{factoryId}/reference-data/batches'
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
    WHERE f->>'fieldCode' IN ('batchId', 'productBatchId')
  );

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM module_schemas, jsonb_array_elements(field_schema) f
  WHERE f->>'fieldCode' IN ('batchId', 'productBatchId')
    AND f->'referenceConfig'->>'apiEndpoint' = '/api/mobile/{factoryId}/reference-data/batches';

  RAISE NOTICE 'V20260425_12: % batch fields re-pointed to /batches endpoint', v_count;
END $$;
