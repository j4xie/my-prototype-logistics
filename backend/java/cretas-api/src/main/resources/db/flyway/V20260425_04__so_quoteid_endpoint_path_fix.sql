-- V20260425_04__so_quoteid_endpoint_path_fix.sql
--
-- R3 audit (Apr 25 2026 NI-1) caught: backlog claimed quoteId endpoint path
--   /api/mobile/{factoryId}/operational-quotes
-- "has no controller, requires 3-day controller build". Wrong — OperationalQuoteController
-- exists at /api/mobile/{factoryId}/quotes (verified live HTTP 200 + GET-by-id /quotes/{id}).
--
-- Fix: re-point sales_order.quoteId schema to the correct path. Time-bomb tier
-- (defaultVisible=false) so no current user-facing impact, but if a factory admin
-- enables the field via Canvas editor, the dropdown now actually works.
--
-- NOTE: /quotes endpoint does NOT support ?keyword= server-side search yet (only
-- ?status=). el-select filterable mode will do client-side filtering on the page=1 batch.
-- Adding server-side keyword search is a separate next-round item.

UPDATE module_schemas
SET field_schema = jsonb_set(
    field_schema,
    '{fields}',
    COALESCE(
        (
            SELECT jsonb_agg(
                CASE
                    WHEN f->>'code' = 'quoteId' THEN
                        jsonb_set(
                            f,
                            '{referenceConfig}',
                            jsonb_build_object(
                                'entity', 'operationalQuote',
                                'valueField', 'id',
                                'displayField', 'quoteNumber',
                                'apiEndpoint', '/api/mobile/{factoryId}/quotes'
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

DO $$
DECLARE
  v_endpoint TEXT;
BEGIN
  SELECT f->'referenceConfig'->>'apiEndpoint' INTO v_endpoint
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE module_code='sales_order' AND f->>'code'='quoteId';

  RAISE NOTICE 'V20260425_04: quoteId endpoint=%', v_endpoint;

  IF v_endpoint IS NOT NULL AND v_endpoint NOT LIKE '%/quotes%' THEN
    RAISE EXCEPTION 'V20260425_04 sanity: quoteId should target /quotes, got %', v_endpoint;
  END IF;
END $$;
