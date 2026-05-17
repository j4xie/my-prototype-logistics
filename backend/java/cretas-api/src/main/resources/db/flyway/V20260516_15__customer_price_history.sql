-- Sprint 4 W2 S-PRICE-1: 客户记忆价 (append-only history)
--
-- 用于销售单 Item prefill 第 2 层 fallback:
--   1. PriceList(customer_id, price_type=SELLING_PRICE) — 客户专属标准价 (existing)
--   2. customer_price_history (最近一次成交)             — 本表 NEW
--   3. ProductType default / unitPrice                  — 系统兜底
--
-- 写入时机: SalesOrder.status = CONFIRMED — listener 写每个 Item 一行.
-- Idempotency: UNIQUE (factory_id, customer_id, product_type_id, source_sales_order_id)
--   防 cancel→re-confirm 重复写.

CREATE TABLE IF NOT EXISTS customer_price_history (
    id                       VARCHAR(191) PRIMARY KEY,
    factory_id               VARCHAR(191) NOT NULL,
    customer_id              VARCHAR(191) NOT NULL,
    product_type_id          VARCHAR(191) NOT NULL,
    unit_price               NUMERIC(15,4) NOT NULL,
    source_sales_order_id    VARCHAR(191) NOT NULL,
    source_order_number      VARCHAR(50),
    order_date               DATE NOT NULL,

    -- BaseEntity audit (per database-entity-sync.md)
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW(),
    deleted_at               TIMESTAMP NULL,

    CONSTRAINT uk_cph_dedup
        UNIQUE (factory_id, customer_id, product_type_id, source_sales_order_id)
);

CREATE INDEX IF NOT EXISTS idx_cph_lookup
    ON customer_price_history (factory_id, customer_id, product_type_id, order_date DESC);

CREATE INDEX IF NOT EXISTS idx_cph_source_order
    ON customer_price_history (source_sales_order_id);

-- BaseEntity updated_at trigger (per database-entity-sync.md PG pattern)
CREATE OR REPLACE FUNCTION trg_cph_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cph_updated_at ON customer_price_history;
CREATE TRIGGER trigger_cph_updated_at
    BEFORE UPDATE ON customer_price_history
    FOR EACH ROW EXECUTE FUNCTION trg_cph_set_updated_at();

COMMENT ON TABLE customer_price_history IS
    'Sprint 4 W2 S-PRICE-1 客户记忆价 — append-only, 每次 SO confirm 写入. Query: latest by (factory, customer, product) ORDER BY order_date DESC, created_at DESC.';
COMMENT ON COLUMN customer_price_history.source_sales_order_id IS
    '来源销售订单 ID + UNIQUE 组成 R4 idempotency key — 同 SO+customer+product 只 1 row';
COMMENT ON COLUMN customer_price_history.source_order_number IS
    '冗余订单号, 用于 hint "上次成交 ¥X (SO-XXX)" 时避免 join';
