-- V20260513_01__module_schemas_price_sensitive_flags.sql
--
-- P1-D (PR #442 follow-up): mark @PriceSensitive columns in Canvas Dynamic
-- module_schemas so SchemaTableRenderer can render stripped null cells as
-- em-dash "—" with .price-masked class (mirrors static-Vue v-if defense
-- pattern from procurement/orders/list.vue + sales/orders/list.vue).
--
-- Backend strip is already unconditional via
-- ``com.cretas.aims.security.PriceFieldResponseAdvice`` (PR #423) and
-- ``com.cretas.aims.security.PriceSensitiveSerializerModifier`` (PR #443) —
-- the migration only annotates the schema so the frontend renderer can pick
-- the correct visual cue. Backend changes:
--   ``FactoryConfigServiceImpl#buildEffectiveFields`` is updated in the same
--   PR to plumb ``priceSensitive`` from raw schema JSON through to
--   ``EffectiveField.extra``.
--
-- Two schema formats coexist in ``module_schemas.field_schema``:
--   * Phase 1 (sales_order + bom, V20260409_02 + V20260409_03):
--     ``{"fields": [{"code": "...", ...}, ...]}`` — object wrapper, ``code`` key.
--   * Phase 2d (purchase_order + 14 others, V20260410_08/09/10):
--     ``[{"fieldCode": "...", ...}, ...]`` — bare array, ``fieldCode`` key.
-- The UPDATE statements below branch on jsonb_typeof to handle both.
--
-- Idempotent: re-running just re-sets priceSensitive=true on the same fields;
-- no schema-level CONCURRENT or transaction concerns (single UPDATE per row).

-- ============================================================
-- 1. sales_order (Phase 1) — flag totalAmount as priceSensitive.
-- Only listVisible decimal field in sales_order field_schema; other price
-- fields (discountAmount/taxAmount/shippingFee/estimatedCost/estimatedProfit/
-- invoicedAmount/paidAmount/items[].unitPrice/items[].lineAmount) are form-only
-- and protected by permission_schema.fieldPermissions (warehouse=hidden).
-- ============================================================

UPDATE module_schemas
SET field_schema = jsonb_set(
    field_schema,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN (field->>'code') = 'totalAmount'
                    THEN field || '{"priceSensitive": true}'::jsonb
                ELSE field
            END
            ORDER BY ordinality
        )
        FROM jsonb_array_elements(field_schema->'fields') WITH ORDINALITY AS t(field, ordinality)
    )
)
WHERE module_code = 'sales_order'
  AND jsonb_typeof(field_schema) = 'object'
  AND field_schema ? 'fields';

-- ============================================================
-- 2. purchase_order (Phase 2d) — flag totalAmount as priceSensitive.
-- The only listVisible (sortOrder 7) price field in purchase_order schema.
-- items[].unitPrice + items[].lineAmount are line_items (form-only) — they
-- live inside the items field's nested itemFields array; form-side rendering
-- is governed by permission_schema for line_items, not by this list-cell
-- renderer.
-- ============================================================

UPDATE module_schemas
SET field_schema = (
    SELECT jsonb_agg(
        CASE
            WHEN (field->>'fieldCode') = 'totalAmount'
                THEN field || '{"priceSensitive": true}'::jsonb
            ELSE field
        END
        ORDER BY ordinality
    )
    FROM jsonb_array_elements(field_schema) WITH ORDINALITY AS t(field, ordinality)
)
WHERE module_code = 'purchase_order'
  AND jsonb_typeof(field_schema) = 'array';

-- ============================================================
-- 3. bom (Phase 1) — flag unitPrice as priceSensitive.
-- bom field_schema listVisible decimal column for cost data (per
-- V20260409_02 line 26 — "code":"unitPrice","listVisible":true,"listOrder":7).
-- BOM may be visible to operator / quality roles that should not see cost.
-- ============================================================

UPDATE module_schemas
SET field_schema = jsonb_set(
    field_schema,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN (field->>'code') = 'unitPrice'
                    THEN field || '{"priceSensitive": true}'::jsonb
                ELSE field
            END
            ORDER BY ordinality
        )
        FROM jsonb_array_elements(field_schema->'fields') WITH ORDINALITY AS t(field, ordinality)
    )
)
WHERE module_code = 'bom'
  AND jsonb_typeof(field_schema) = 'object'
  AND field_schema ? 'fields';

-- ============================================================
-- Sweep verdicts for 14 other Canvas Dynamic modules (no flag needed):
--
-- batch1 (V20260410_08):
--   production_plan   — no price columns (plannedQuantity/actualQuantity are not money)
--   quality_inspection — no price columns
--   inventory          — listVisible currentQuantity is not a price (cost-aware variant not in schema)
--   equipment          — no price columns
-- batch2 (V20260410_09):
--   production_report  — no price columns
--   inbound            — no listVisible price column (per V20260410_09)
--   outbound           — no listVisible price column (per V20260410_09)
--   customer           — no price columns
--   supplier           — no price columns
-- batch3 (V20260410_10):
--   finance_ar         — amount listVisible: HOLD on flag — finance_manager+admin only see this
--                        module per permission_schema (warehouse can't reach it),
--                        defense-in-depth flag deferred until role expands.
--   finance_ap         — same as finance_ar.
--   hr_employee        — no price columns
--   transfer           — no price columns
--   traceability       — no price columns
--
-- If any of the deferred modules expand role access in future (e.g.,
-- warehouse_manager gains read on finance_ar for reconciliation), the same
-- migration pattern applies — add an UPDATE block above.
-- ============================================================
