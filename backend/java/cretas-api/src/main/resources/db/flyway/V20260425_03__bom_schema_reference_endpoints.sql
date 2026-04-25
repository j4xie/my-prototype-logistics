-- V20260425_03__bom_schema_reference_endpoints.sql
--
-- ACTIVE P0 FIX (caught by Apr 25 2026 audit, NOT in original Rule 8 sweep):
-- F001 bom is DYNAMIC mode (factory_module_configs.rendering_mode='DYNAMIC') —
-- the original Apr 25 backlog wrongly classified bom as "LEGACY mode, time-bomb only".
-- Live curl verified:
--   GET /api/mobile/F001/material-types               → HTTP 404 (no controller)
--   GET /api/mobile/F001/finished-goods/product-types → HTTP 404 (no controller)
--   GET /api/mobile/F001/raw-material-types           → HTTP 200 (real path)
--
-- Impact: F001 users in BOM module currently see EMPTY dropdowns for materialTypeId
-- and productTypeId — silent ReferenceSelector 404 swallowed by try/catch.
--
-- Fix: re-point to /reference-data/{materials,products} (consistent with sales_order fix).
-- materials endpoint added in same commit as this migration.
--
-- Schema shape: bom uses wrapper shape {fields: [...]} (verified test+prod), NOT top-level
-- array as initially assumed. Same shape as sales_order. Reuse the same UPDATE pattern.

UPDATE module_schemas
SET field_schema = jsonb_set(
    field_schema,
    '{fields}',
    COALESCE(
        (
            SELECT jsonb_agg(
                CASE
                    WHEN f->>'code' = 'materialTypeId' OR f->>'fieldCode' = 'materialTypeId' THEN
                        jsonb_set(
                            f,
                            '{referenceConfig}',
                            jsonb_build_object(
                                'entity', 'rawMaterialType',
                                'valueField', 'id',
                                'displayField', 'name',
                                'apiEndpoint', '/api/mobile/{factoryId}/reference-data/materials'
                            )
                        )
                    WHEN f->>'code' = 'productTypeId' OR f->>'fieldCode' = 'productTypeId' THEN
                        jsonb_set(
                            f,
                            '{referenceConfig}',
                            jsonb_build_object(
                                'entity', 'productType',
                                'valueField', 'id',
                                'displayField', 'name',
                                'apiEndpoint', '/api/mobile/{factoryId}/reference-data/products'
                            )
                        )
                    ELSE f
                END
            )
            FROM jsonb_array_elements(field_schema->'fields') f
        ),
        field_schema->'fields'
    )
)
WHERE module_code = 'bom'
  AND field_schema IS NOT NULL
  AND jsonb_typeof(field_schema->'fields') = 'array';

DO $$
DECLARE
  v_mat_endpoint TEXT;
  v_prod_endpoint TEXT;
BEGIN
  SELECT f->'referenceConfig'->>'apiEndpoint' INTO v_mat_endpoint
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE module_code='bom' AND (f->>'code'='materialTypeId' OR f->>'fieldCode'='materialTypeId');

  SELECT f->'referenceConfig'->>'apiEndpoint' INTO v_prod_endpoint
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE module_code='bom' AND (f->>'code'='productTypeId' OR f->>'fieldCode'='productTypeId');

  RAISE NOTICE 'V20260425_03: bom materialTypeId endpoint=%, productTypeId endpoint=%',
    v_mat_endpoint, v_prod_endpoint;

  -- Skip asserts on environments lacking bom row
  IF v_mat_endpoint IS NOT NULL AND v_mat_endpoint NOT LIKE '%/reference-data/materials%' THEN
    RAISE EXCEPTION 'V20260425_03 sanity: bom.materialTypeId should target /reference-data/materials, got %',
      v_mat_endpoint;
  END IF;
  IF v_prod_endpoint IS NOT NULL AND v_prod_endpoint NOT LIKE '%/reference-data/products%' THEN
    RAISE EXCEPTION 'V20260425_03 sanity: bom.productTypeId should target /reference-data/products, got %',
      v_prod_endpoint;
  END IF;
END $$;
