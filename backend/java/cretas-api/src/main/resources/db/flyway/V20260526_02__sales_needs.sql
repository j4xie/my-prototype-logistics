-- Sprint 4 W2 S-NEED-1: sales_needs (客户需求).
-- 客户提的购买意向, 销售员确认后转销售订单.

CREATE TABLE IF NOT EXISTS sales_needs (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(191) NOT NULL,
    customer_id VARCHAR(191) NOT NULL,
    customer_name VARCHAR(200),
    product_id VARCHAR(191) NOT NULL,
    product_name VARCHAR(200),
    qty_demand NUMERIC(15, 4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    expected_delivery_date DATE,
    priority VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    remark TEXT,
    converted_sales_order_id VARCHAR(191),
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_sn_factory_status
    ON sales_needs (factory_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sn_customer
    ON sales_needs (factory_id, customer_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sn_converted_so
    ON sales_needs (converted_sales_order_id)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE sales_needs IS 'Sprint 4 W2 S-NEED-1 客户需求 — DRAFT → CONFIRMED → CONVERTED_TO_SO';
COMMENT ON COLUMN sales_needs.product_id IS 'ProductType.id (matches SalesOrderItem.productTypeId)';
COMMENT ON COLUMN sales_needs.converted_sales_order_id IS 'SalesOrder.id after one-click convert';
