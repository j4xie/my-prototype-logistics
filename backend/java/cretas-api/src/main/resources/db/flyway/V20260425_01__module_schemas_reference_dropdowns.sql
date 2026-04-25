-- V20260425_01__module_schemas_reference_dropdowns.sql
--
-- Convert sales_order DYNAMIC-mode system fields to reference-typed dropdowns.
-- Why: Six-Doors meeting + 系统修改意见.docx require "业务员" to be employee dropdown,
-- "产品" to be remote-search dropdown, "客户" to be remote-search dropdown. Legacy LEGACY-mode
-- list.vue already had these widgets, but DYNAMIC-mode SchemaFormRenderer renders by field.type
-- only — and the schema had type='string' for salesperson + apiEndpoint pointed at HR-gated
-- /users/search (silently empty for sales users) + missing apiEndpoint for productTypeId.
--
-- New /reference-data/* endpoint (see ReferenceDataController) returns minimal {id, name, ...}
-- without HR/finance permission gate so sales users can populate dropdowns.
--
-- Scope: only sales_order — purchase_order/customer are LEGACY-mode for all factories,
-- their schema-defined field_schema is a top-level JSONB array (no `fields` wrapper) so
-- the same JSONB rewrite shape doesn't apply. Will be revisited if those modules go DYNAMIC.
--
-- Idempotent: works whether salesperson is currently type='string' (prod baseline) or
-- already type='reference' (test from an earlier ad-hoc migration).

UPDATE module_schemas
SET field_schema = jsonb_set(
    field_schema,
    '{fields}',
    COALESCE(
        (
            SELECT jsonb_agg(
                CASE
                    -- salesperson: switch to reference and point at lightweight endpoint
                    WHEN f->>'code' = 'salesperson' THEN
                        jsonb_set(
                            jsonb_set(f, '{type}', '"reference"'),
                            '{referenceConfig}',
                            jsonb_build_object(
                                'entity', 'user',
                                'valueField', 'fullName',
                                'displayField', 'fullName',
                                'apiEndpoint', '/api/mobile/{factoryId}/reference-data/employees'
                            )
                        )
                    -- customerId: keep type=reference, re-point apiEndpoint to drop hr/finance gate
                    WHEN f->>'code' = 'customerId' THEN
                        jsonb_set(
                            f,
                            '{referenceConfig}',
                            jsonb_build_object(
                                'entity', 'customer',
                                'valueField', 'id',
                                'displayField', 'name',
                                'apiEndpoint', '/api/mobile/{factoryId}/reference-data/customers'
                            )
                        )
                    -- items: patch each line-item field via itemSchema
                    WHEN f->>'code' = 'items' THEN
                        jsonb_set(
                            f,
                            '{itemSchema,fields}',
                            COALESCE(
                                (
                                    SELECT jsonb_agg(
                                        CASE
                                            -- productTypeId: ensure apiEndpoint is present
                                            WHEN itm->>'code' = 'productTypeId' THEN
                                                jsonb_set(
                                                    itm,
                                                    '{referenceConfig}',
                                                    jsonb_build_object(
                                                        'entity', 'productType',
                                                        'valueField', 'id',
                                                        'displayField', 'name',
                                                        'apiEndpoint', '/api/mobile/{factoryId}/reference-data/products'
                                                    )
                                                )
                                            -- unit: select-no-options → select with food-industry units
                                            WHEN itm->>'code' = 'unit' THEN
                                                jsonb_set(
                                                    itm,
                                                    '{options}',
                                                    '["kg","g","t","箱","件","袋","瓶","米","吨","包","只","条","盒","桶"]'::jsonb
                                                )
                                            ELSE itm
                                        END
                                    )
                                    FROM jsonb_array_elements(f->'itemSchema'->'fields') itm
                                ),
                                f->'itemSchema'->'fields'
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
WHERE module_code = 'sales_order'
  AND field_schema IS NOT NULL
  AND jsonb_typeof(field_schema->'fields') = 'array';

-- Sanity check
DO $$
DECLARE
  v_salesperson_type TEXT;
  v_salesperson_endpoint TEXT;
  v_customer_endpoint TEXT;
  v_product_endpoint TEXT;
BEGIN
  SELECT f->>'type', f->'referenceConfig'->>'apiEndpoint'
  INTO v_salesperson_type, v_salesperson_endpoint
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE module_code = 'sales_order' AND f->>'code' = 'salesperson';

  SELECT f->'referenceConfig'->>'apiEndpoint' INTO v_customer_endpoint
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE module_code = 'sales_order' AND f->>'code' = 'customerId';

  SELECT itm->'referenceConfig'->>'apiEndpoint' INTO v_product_endpoint
  FROM module_schemas,
       jsonb_array_elements(field_schema->'fields') f,
       jsonb_array_elements(f->'itemSchema'->'fields') itm
  WHERE module_code = 'sales_order'
    AND f->>'code' = 'items'
    AND itm->>'code' = 'productTypeId';

  RAISE NOTICE 'V20260425_01: salesperson type=% endpoint=%, customerId endpoint=%, productTypeId endpoint=%',
    v_salesperson_type, v_salesperson_endpoint, v_customer_endpoint, v_product_endpoint;

  IF v_salesperson_type IS DISTINCT FROM 'reference' THEN
    RAISE EXCEPTION 'V20260425_01 sanity failure: SO salesperson type should be "reference", got %',
      v_salesperson_type;
  END IF;
  IF v_salesperson_endpoint NOT LIKE '%/reference-data/employees%' THEN
    RAISE EXCEPTION 'V20260425_01 sanity failure: SO salesperson endpoint should target /reference-data/employees, got %',
      v_salesperson_endpoint;
  END IF;
END $$;
