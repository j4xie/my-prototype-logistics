-- ============================================================
-- Return Orders (退货管理) — PostgreSQL
-- Supports both PURCHASE_RETURN and SALES_RETURN
-- ============================================================

-- 1. return_orders 主表
CREATE TABLE IF NOT EXISTS return_orders (
    id              VARCHAR(191) PRIMARY KEY,
    factory_id      VARCHAR(191) NOT NULL,
    return_number   VARCHAR(50)  NOT NULL,
    return_type     VARCHAR(32)  NOT NULL,          -- PURCHASE_RETURN | SALES_RETURN
    status          VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    counterparty_id VARCHAR(191) NOT NULL,          -- supplier (purchase) or customer (sales)
    source_order_id VARCHAR(191),                    -- original PO/SO id (nullable)
    return_date     DATE         NOT NULL,
    total_amount    NUMERIC(15,2) DEFAULT 0,
    reason          TEXT,
    created_by      BIGINT       NOT NULL,
    approved_by     BIGINT,
    approved_at     TIMESTAMP,
    remark          TEXT,
    version         BIGINT       DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP,

    CONSTRAINT uk_return_factory_number UNIQUE (factory_id, return_number)
);

CREATE INDEX IF NOT EXISTS idx_ro_factory      ON return_orders (factory_id);
CREATE INDEX IF NOT EXISTS idx_ro_type         ON return_orders (return_type);
CREATE INDEX IF NOT EXISTS idx_ro_status       ON return_orders (status);
CREATE INDEX IF NOT EXISTS idx_ro_counterparty ON return_orders (counterparty_id);
CREATE INDEX IF NOT EXISTS idx_ro_return_date  ON return_orders (return_date);

-- 2. return_order_items 行项目表
CREATE TABLE IF NOT EXISTS return_order_items (
    id               BIGSERIAL PRIMARY KEY,
    return_order_id  VARCHAR(191) NOT NULL,
    material_type_id VARCHAR(191),                   -- for purchase returns
    product_type_id  VARCHAR(191),                   -- for sales returns
    item_name        VARCHAR(200),
    quantity         NUMERIC(15,4) NOT NULL,
    unit_price       NUMERIC(15,4),
    line_amount      NUMERIC(15,2),
    batch_number     VARCHAR(100),
    reason           VARCHAR(500),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMP,

    CONSTRAINT fk_roi_return_order FOREIGN KEY (return_order_id) REFERENCES return_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_roi_order    ON return_order_items (return_order_id);
CREATE INDEX IF NOT EXISTS idx_roi_material ON return_order_items (material_type_id);
CREATE INDEX IF NOT EXISTS idx_roi_product  ON return_order_items (product_type_id);

-- 3. updated_at triggers
CREATE OR REPLACE FUNCTION update_return_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_return_orders_updated_at
BEFORE UPDATE ON return_orders
FOR EACH ROW EXECUTE FUNCTION update_return_orders_updated_at();

CREATE OR REPLACE FUNCTION update_return_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_return_order_items_updated_at
BEFORE UPDATE ON return_order_items
FOR EACH ROW EXECUTE FUNCTION update_return_order_items_updated_at();
