-- C4 周转耗材(周转框)进销存管理
-- 客户原话 (Apr 7 会议 3428-3475s): 周转框丢了客户要赔钱

CREATE TABLE IF NOT EXISTS reusable_containers (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(64) NOT NULL,
    container_code VARCHAR(64) NOT NULL,
    container_name VARCHAR(128) NOT NULL,
    specification VARCHAR(128),
    unit_price NUMERIC(10,2),
    total_quantity INTEGER NOT NULL DEFAULT 0,
    in_warehouse_quantity INTEGER NOT NULL DEFAULT 0,
    in_transit_quantity INTEGER NOT NULL DEFAULT 0,
    remark VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT uk_reusable_container_code UNIQUE (factory_id, container_code)
);

CREATE INDEX IF NOT EXISTS idx_reusable_containers_factory ON reusable_containers(factory_id);

CREATE TABLE IF NOT EXISTS reusable_container_transactions (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(64) NOT NULL,
    container_id VARCHAR(64) NOT NULL,
    transaction_type VARCHAR(16) NOT NULL,
    quantity INTEGER NOT NULL,
    customer_id VARCHAR(64),
    customer_name VARCHAR(128),
    sales_delivery_id VARCHAR(64),
    compensation_amount NUMERIC(12,2),
    remark VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_rct_container ON reusable_container_transactions(factory_id, container_id);
CREATE INDEX IF NOT EXISTS idx_rct_customer ON reusable_container_transactions(factory_id, customer_id, transaction_type);
