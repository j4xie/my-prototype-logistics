-- V20260425_08__so_quoteid_to_reference_data.sql
--
-- R6 (Apr 25 2026): two follow-up issues with the quoteId schema entry.
--
-- 1. V20260425_04 set displayField='quoteNumber' but the entity field is `quoteNo`
--    (verified OperationalQuote.java line 65). ReferenceSelector calls
--    item['quoteNumber'] → undefined → label falls back to raw id. This was a real
--    display bug like the Round-1 customerId one but never surfaced because
--    quoteId.defaultVisible=false hides the field by default.
--
-- 2. V20260425_04 pointed at /api/mobile/{factoryId}/quotes (the legacy
--    OperationalQuoteController). That works but doesn't support ?keyword= search,
--    so el-select filterable mode falls back to client-side filter on page 1 only.
--    R6 added /reference-data/quotes with proper keyword + minimal projection,
--    consistent with the other 5 reference-data endpoints.
--
-- Fix: re-point quoteId schema to /reference-data/quotes + correct displayField='quoteNo'.

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
                                'displayField', 'quoteNo',
                                'apiEndpoint', '/api/mobile/{factoryId}/reference-data/quotes'
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
  v_display TEXT;
BEGIN
  SELECT f->'referenceConfig'->>'apiEndpoint',
         f->'referenceConfig'->>'displayField'
  INTO v_endpoint, v_display
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE module_code='sales_order' AND f->>'code'='quoteId';

  RAISE NOTICE 'V20260425_08: quoteId endpoint=%, displayField=%', v_endpoint, v_display;

  IF v_endpoint IS NOT NULL AND v_endpoint NOT LIKE '%/reference-data/quotes%' THEN
    RAISE EXCEPTION 'V20260425_08 sanity: quoteId endpoint should target /reference-data/quotes, got %', v_endpoint;
  END IF;
  IF v_display IS NOT NULL AND v_display IS DISTINCT FROM 'quoteNo' THEN
    RAISE EXCEPTION 'V20260425_08 sanity: quoteId displayField should be quoteNo, got %', v_display;
  END IF;
END $$;
