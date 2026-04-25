-- V20260425_01__module_schemas_reference_dropdowns.sql
--
-- Convert system-field text inputs to reference-typed dropdowns in Canvas DYNAMIC mode.
-- Why: Six-Doors meeting + 系统修改意见.docx require "业务员" to be employee dropdown,
-- "产品" to be remote-search dropdown, "客户" to be remote-search dropdown. Legacy LEGACY-mode
-- list.vue already had these widgets, but DYNAMIC-mode SchemaFormRenderer renders by field.type
-- only — and the schema had type='string' for salesperson + missing apiEndpoint for productTypeId.
--
-- New /reference-data/* endpoint (see ReferenceDataController) returns minimal {id, name, ...}
-- without HR/finance permission gates so sales users can populate dropdowns.

-- 1) sales_order — patch salesperson + customerId + items.productTypeId + items.unit
UPDATE module_schemas
SET field_schema = jsonb_set(
    field_schema,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                -- salesperson: string → reference (employee dropdown, sales-eligible only)
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
                -- customerId: re-point apiEndpoint to /reference-data (drop hr/finance gate)
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
                                    -- unit: select-no-options → select with common food-industry units
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
                        )
                    )
                ELSE f
            END
        )
        FROM jsonb_array_elements(field_schema->'fields') f
    )
)
WHERE module_code = 'sales_order';

-- 2) purchase_order — supplierId reference + apiEndpoint
UPDATE module_schemas
SET field_schema = jsonb_set(
    field_schema,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN f->>'fieldCode' = 'supplierId' THEN
                    jsonb_set(
                        f,
                        '{referenceConfig}',
                        jsonb_build_object(
                            'entity', 'supplier',
                            'valueField', 'id',
                            'displayField', 'name',
                            'apiEndpoint', '/api/mobile/{factoryId}/reference-data/suppliers'
                        )
                    )
                ELSE f
            END
        )
        FROM jsonb_array_elements(field_schema->'fields') f
    )
)
WHERE module_code = 'purchase_order';

-- Sanity check: verify changes applied (visible in flyway log if executed manually)
DO $$
DECLARE
  v_so_salesperson_type TEXT;
  v_so_customer_endpoint TEXT;
  v_po_supplier_endpoint TEXT;
BEGIN
  SELECT f->>'type' INTO v_so_salesperson_type
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE module_code = 'sales_order' AND f->>'code' = 'salesperson';

  SELECT f->'referenceConfig'->>'apiEndpoint' INTO v_so_customer_endpoint
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE module_code = 'sales_order' AND f->>'code' = 'customerId';

  SELECT f->'referenceConfig'->>'apiEndpoint' INTO v_po_supplier_endpoint
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE module_code = 'purchase_order' AND f->>'fieldCode' = 'supplierId';

  RAISE NOTICE 'V20260425_01: SO salesperson type=%, SO customer endpoint=%, PO supplier endpoint=%',
    v_so_salesperson_type, v_so_customer_endpoint, v_po_supplier_endpoint;

  IF v_so_salesperson_type IS DISTINCT FROM 'reference' THEN
    RAISE EXCEPTION 'V20260425_01 sanity failure: SO salesperson type should be "reference", got %',
      v_so_salesperson_type;
  END IF;
END $$;
