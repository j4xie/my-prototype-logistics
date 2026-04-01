-- ============================================================
-- Phase 2: 字段补全 — 产品/客户/销售订单 (六扇门需求对齐)
-- ============================================================

-- ==================== ProductType 新增6字段 ====================
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS box_conversion_coefficient DECIMAL(10,4);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS inventory_warning_threshold DECIMAL(15,2);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS minimum_order_quantity DECIMAL(15,2);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS settlement_method VARCHAR(50);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS tax_included_unit_price DECIMAL(15,4);

-- ==================== Customer 新增2字段 ====================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100);

-- ==================== CustomerTrackingRecord 子表 ====================
CREATE TABLE IF NOT EXISTS customer_tracking_records (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(191) NOT NULL,
    customer_id VARCHAR(191) NOT NULL,
    record_time TIMESTAMP NOT NULL DEFAULT NOW(),
    recorder_name VARCHAR(100),
    recorder_id BIGINT,
    content TEXT,
    contact_person VARCHAR(100),
    contact_phone VARCHAR(50),
    address VARCHAR(500),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ctr_customer ON customer_tracking_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_ctr_factory ON customer_tracking_records(factory_id);

-- ==================== SalesOrder 新增8字段 ====================
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(32) DEFAULT 'NOT_INVOICED';
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS invoiced_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS settlement_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS quote_id VARCHAR(191);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS transport_plan_status VARCHAR(32);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS delivery_reminder_date DATE;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS box_quantity DECIMAL(15,2);

-- ==================== SalesOrderItem 新增2字段 ====================
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS cost_unit_price DECIMAL(15,4);
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2);
