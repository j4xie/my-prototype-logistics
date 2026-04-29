-- V20260425_05__so_salesperson_value_field_to_id.sql
--
-- Round 4: Critical #4 (salesperson fullName-as-value uniqueness collision) implementation.
--
-- Background:
-- - SalesOrder entity already has salesperson_id column (V20260423_01).
-- - SalesServiceImpl.resolveSalespersonField() already implements dual-field logic:
--   * numeric input → lookup user → write salesperson_id + snapshot fullName to salesperson
--   * non-numeric input → legacy path, only write salesperson string
-- - But V20260425_01 set sales_order.salesperson schema valueField='fullName',
--   so dropdown always emits fullName string → resolver always takes legacy path
--   → salesperson_id permanently NULL → dual-field migration was dead-on-arrival.
--
-- F001 prod actually has collisions (verified by R3 audit):
--   SELECT full_name, COUNT(*) FROM users WHERE factory_id='F001'
--   GROUP BY full_name HAVING COUNT(*)>1;
--   -- "" (empty) → 6 rows
--   -- "test"     → 3 rows
-- Picking "test" for commission attribution is non-deterministic.
--
-- Fix: switch valueField from 'fullName' to 'id'. Now:
-- - New orders: dropdown emits user.id → resolver writes salesperson_id (FK) + name snapshot
-- - Old orders: salesperson="张三" string → looksLikeId returns false (Chinese) → ReferenceSelector
--   falls back to render raw "张三" — display correct, save still works (resolver legacy path)
-- - Deactivated/renamed user: salesperson_id FK preserves identity, salesperson snapshot
--   preserves the name as it was at order time — both columns useful for audit/reporting
--
-- Backwards compat: zero breaking change. Resolver handles both numeric (new) and string (legacy).

UPDATE module_schemas
SET field_schema = jsonb_set(
    field_schema,
    '{fields}',
    COALESCE(
        (
            SELECT jsonb_agg(
                CASE
                    WHEN f->>'code' = 'salesperson' THEN
                        jsonb_set(
                            f,
                            '{referenceConfig}',
                            jsonb_build_object(
                                'entity', 'user',
                                'valueField', 'id',
                                'displayField', 'fullName',
                                'apiEndpoint', '/api/mobile/{factoryId}/reference-data/employees'
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
  v_value_field TEXT;
  v_display_field TEXT;
BEGIN
  SELECT f->'referenceConfig'->>'valueField',
         f->'referenceConfig'->>'displayField'
  INTO v_value_field, v_display_field
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE module_code='sales_order' AND f->>'code'='salesperson';

  RAISE NOTICE 'V20260425_05: salesperson valueField=%, displayField=%',
    v_value_field, v_display_field;

  IF v_value_field IS NOT NULL AND v_value_field IS DISTINCT FROM 'id' THEN
    RAISE EXCEPTION 'V20260425_05 sanity: salesperson valueField should be id, got %', v_value_field;
  END IF;
END $$;
