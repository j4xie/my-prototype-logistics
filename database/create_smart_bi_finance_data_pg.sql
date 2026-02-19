-- Create smart_bi_finance_data table for PostgreSQL
-- Used by FinanceAnalysisService for payable/budget/cost/receivable analysis

CREATE TABLE IF NOT EXISTS smart_bi_finance_data (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    upload_id BIGINT,
    record_date DATE NOT NULL,
    record_type VARCHAR(20) NOT NULL,  -- COST, AR, AP, BUDGET
    department VARCHAR(100),
    category VARCHAR(100),
    customer_name VARCHAR(200),
    supplier_name VARCHAR(200),
    material_cost NUMERIC(15, 2) DEFAULT 0,
    labor_cost NUMERIC(15, 2) DEFAULT 0,
    overhead_cost NUMERIC(15, 2) DEFAULT 0,
    total_cost NUMERIC(15, 2) DEFAULT 0,
    receivable_amount NUMERIC(15, 2) DEFAULT 0,
    collection_amount NUMERIC(15, 2) DEFAULT 0,
    aging_days INTEGER DEFAULT 0,
    payable_amount NUMERIC(15, 2) DEFAULT 0,
    payment_amount NUMERIC(15, 2) DEFAULT 0,
    budget_amount NUMERIC(15, 2) DEFAULT 0,
    actual_amount NUMERIC(15, 2) DEFAULT 0,
    variance_amount NUMERIC(15, 2) DEFAULT 0,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes matching the JPA @Index annotations
CREATE INDEX IF NOT EXISTS idx_finance_factory_date ON smart_bi_finance_data (factory_id, record_date);
CREATE INDEX IF NOT EXISTS idx_finance_record_type ON smart_bi_finance_data (factory_id, record_type);
CREATE INDEX IF NOT EXISTS idx_finance_department ON smart_bi_finance_data (factory_id, department);
CREATE INDEX IF NOT EXISTS idx_finance_aging ON smart_bi_finance_data (factory_id, aging_days);
