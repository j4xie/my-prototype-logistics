-- =============================================================================
-- E2E Demo Sales Orders: F_E2E_TEST
-- =============================================================================
-- Inserts 3 demo sales orders (DEMO_SO_001 / 002 / 003) covering the 3 main
-- tax-rate scenarios: 9% (B2B food), 13% (e-commerce), 0% (personal).
--
-- Prerequisites: seed-e2e-factory.sql must be applied first (master data).
--
-- Idempotency: uses ON CONFLICT DO NOTHING on (factory_id, order_number).
--   Items are DELETE-then-INSERT on each run because sales_order_items has
--   no unique constraint and uses a BIGINT sequence PK.
--
-- Column notes:
--   sales_orders.order_number  — the business code field (NOT order_code)
--   sales_orders.status        — NOT order_status
--   sales_order_items.id       — BIGINT auto-sequence (no UUID)
--   created_by                 — BIGINT user.id (not UUID)
--   No sub_total/subtotal col  — total_amount computed from items at app layer
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: resolve created_by user ID once
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_uid BIGINT := (SELECT id FROM users WHERE username = 'e2e_super_admin' AND factory_id = 'F_E2E_TEST');
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'e2e_super_admin user not found — run seed-e2e-factory.sql first';
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- DEMO_SO_001: 鼎鲜火锅 — 酸菜鱼 500g × 100 @ 25.00 — tax 9% — CONFIRMED
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sales_orders (
    id, factory_id, order_number, customer_id,
    order_date, total_amount, discount_amount, tax_amount,
    status, created_by, paid_amount,
    created_at, updated_at
)
VALUES (
    'e2e-so-001-0000000000000000000001',
    'F_E2E_TEST',
    'DEMO_SO_001',
    (SELECT id FROM customers WHERE factory_id = 'F_E2E_TEST' AND code = 'CUS_DINGXIAN'),
    CURRENT_DATE - INTERVAL '2 days',
    2500.00,
    0.00,
    225.00,  -- 2500 × 9%
    'CONFIRMED',
    (SELECT id FROM users WHERE username = 'e2e_super_admin' AND factory_id = 'F_E2E_TEST'),
    0.00,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
)
ON CONFLICT (factory_id, order_number) DO NOTHING;

-- Items for DEMO_SO_001 — delete-then-insert for idempotency
DELETE FROM sales_order_items
WHERE sales_order_id = 'e2e-so-001-0000000000000000000001';

INSERT INTO sales_order_items (
    sales_order_id, product_type_id, product_name,
    quantity, unit, unit_price, tax_rate,
    discount_rate, delivered_quantity,
    created_at, updated_at
)
VALUES (
    'e2e-so-001-0000000000000000000001',
    (SELECT id FROM product_types WHERE factory_id = 'F_E2E_TEST' AND code = 'SKU_SCY500'),
    '酸菜鱼 500g',
    100.0000, '袋', 25.0000, 0.09,
    0.00, 0.0000,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DEMO_SO_002: 云海电商 — 鲜牛肉丸 1kg × 50 @ 55.00 — tax 13% — DRAFT
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sales_orders (
    id, factory_id, order_number, customer_id,
    order_date, total_amount, discount_amount, tax_amount,
    status, created_by, paid_amount,
    created_at, updated_at
)
VALUES (
    'e2e-so-002-0000000000000000000001',
    'F_E2E_TEST',
    'DEMO_SO_002',
    (SELECT id FROM customers WHERE factory_id = 'F_E2E_TEST' AND code = 'CUS_YUNHAI'),
    CURRENT_DATE - INTERVAL '1 day',
    2750.00,
    0.00,
    357.50,  -- 2750 × 13%
    'DRAFT',
    (SELECT id FROM users WHERE username = 'e2e_super_admin' AND factory_id = 'F_E2E_TEST'),
    0.00,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (factory_id, order_number) DO NOTHING;

DELETE FROM sales_order_items
WHERE sales_order_id = 'e2e-so-002-0000000000000000000001';

INSERT INTO sales_order_items (
    sales_order_id, product_type_id, product_name,
    quantity, unit, unit_price, tax_rate,
    discount_rate, delivered_quantity,
    created_at, updated_at
)
VALUES (
    'e2e-so-002-0000000000000000000001',
    (SELECT id FROM product_types WHERE factory_id = 'F_E2E_TEST' AND code = 'SKU_NRW1K'),
    '鲜牛肉丸 1kg',
    50.0000, '袋', 55.0000, 0.13,
    0.00, 0.0000,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DEMO_SO_003: 张三 — 花椒鱼 300g × 10 @ 18.00 — tax 0% — CONFIRMED + fully paid
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sales_orders (
    id, factory_id, order_number, customer_id,
    order_date, total_amount, discount_amount, tax_amount,
    status, created_by, paid_amount,
    created_at, updated_at
)
VALUES (
    'e2e-so-003-0000000000000000000001',
    'F_E2E_TEST',
    'DEMO_SO_003',
    (SELECT id FROM customers WHERE factory_id = 'F_E2E_TEST' AND code = 'CUS_ZHANGSAN'),
    CURRENT_DATE,
    180.00,
    0.00,
    0.00,  -- 0% tax
    'CONFIRMED',
    (SELECT id FROM users WHERE username = 'e2e_super_admin' AND factory_id = 'F_E2E_TEST'),
    180.00,  -- fully paid
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours'
)
ON CONFLICT (factory_id, order_number) DO NOTHING;

DELETE FROM sales_order_items
WHERE sales_order_id = 'e2e-so-003-0000000000000000000001';

INSERT INTO sales_order_items (
    sales_order_id, product_type_id, product_name,
    quantity, unit, unit_price, tax_rate,
    discount_rate, delivered_quantity,
    created_at, updated_at
)
VALUES (
    'e2e-so-003-0000000000000000000001',
    (SELECT id FROM product_types WHERE factory_id = 'F_E2E_TEST' AND code = 'SKU_HJY300'),
    '花椒鱼 300g',
    10.0000, '袋', 18.0000, 0.00,
    0.00, 0.0000,
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours'
);

COMMIT;
