-- ============================================================
-- Phase 3: 开票记录 + 收款记录表
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_records (
    id VARCHAR(191) PRIMARY KEY,
    factory_id VARCHAR(191) NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    sales_order_id VARCHAR(191),
    customer_id VARCHAR(191),
    customer_name VARCHAR(200),
    amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2),
    total_amount DECIMAL(15,2) NOT NULL,
    invoice_type VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    requested_by BIGINT,
    requested_at TIMESTAMP,
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    issued_at TIMESTAMP,
    invoice_pdf_url VARCHAR(500),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inv_factory ON invoice_records(factory_id);
CREATE INDEX IF NOT EXISTS idx_inv_sales_order ON invoice_records(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_inv_customer ON invoice_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_inv_status ON invoice_records(status);

CREATE TABLE IF NOT EXISTS payment_records (
    id VARCHAR(191) PRIMARY KEY,
    factory_id VARCHAR(191) NOT NULL,
    payment_number VARCHAR(50) NOT NULL,
    sales_order_id VARCHAR(191),
    customer_id VARCHAR(191),
    customer_name VARCHAR(200),
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(32),
    payment_date DATE,
    payment_reference VARCHAR(200),
    receipt_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    recorded_by BIGINT,
    verified_by BIGINT,
    verified_at TIMESTAMP,
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pay_factory ON payment_records(factory_id);
CREATE INDEX IF NOT EXISTS idx_pay_sales_order ON payment_records(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_pay_customer ON payment_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_pay_status ON payment_records(status);
