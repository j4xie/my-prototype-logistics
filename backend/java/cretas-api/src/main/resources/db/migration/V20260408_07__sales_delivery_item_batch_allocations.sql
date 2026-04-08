-- P0-13 昆山六扇门：销售发货强制批次分配
CREATE TABLE IF NOT EXISTS sales_delivery_item_batch_allocations (
    id                       VARCHAR(64) PRIMARY KEY,
    factory_id               VARCHAR(64) NOT NULL,
    delivery_item_id         VARCHAR(64) NOT NULL,
    finished_goods_batch_id  VARCHAR(64) NOT NULL,
    batch_number             VARCHAR(64) NOT NULL,
    allocated_qty            NUMERIC(18,4) NOT NULL,
    unit                     VARCHAR(16),
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW(),
    deleted_at               TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_sdiba_delivery_item
    ON sales_delivery_item_batch_allocations(factory_id, delivery_item_id);

CREATE INDEX IF NOT EXISTS idx_sdiba_batch
    ON sales_delivery_item_batch_allocations(factory_id, finished_goods_batch_id);
