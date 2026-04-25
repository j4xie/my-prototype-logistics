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

UPDATE module_schemas
SET field_schema = (
    SELECT CASE
        WHEN jsonb_typeof(field_schema) = 'array' THEN
            -- bom uses top-level array shape
            (SELECT jsonb_agg(
                CASE
                    WHEN f->>'fieldCode' = 'materialTypeId' OR f->>'code' = 'materialTypeId' THEN
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
                    WHEN f->>'fieldCode' = 'productTypeId' OR f->>'code' = 'productTypeId' THEN
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
             FROM jsonb_array_elements(field_schema) f)
        ELSE field_schema
    END
)
WHERE module_code = 'bom'
  AND field_schema IS NOT NULL;

DO $$
DECLARE
  v_mat_endpoint TEXT;
  v_prod_endpoint TEXT;
BEGIN
  SELECT f->'referenceConfig'->>'apiEndpoint' INTO v_mat_endpoint
  FROM module_schemas, jsonb_array_elements(field_schema) f
  WHERE module_code='bom' AND (f->>'fieldCode'='materialTypeId' OR f->>'code'='materialTypeId');

  SELECT f->'referenceConfig'->>'apiEndpoint' INTO v_prod_endpoint
  FROM module_schemas, jsonb_array_elements(field_schema) f
  WHERE module_code='bom' AND (f->>'fieldCode'='productTypeId' OR f->>'code'='productTypeId');

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
