-- Product-WorkProcess association table
CREATE TABLE IF NOT EXISTS product_work_processes (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    product_type_id VARCHAR(50) NOT NULL,
    work_process_id VARCHAR(50) NOT NULL,
    process_order INTEGER DEFAULT 0,
    unit_override VARCHAR(20),
    estimated_minutes_override INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(factory_id, product_type_id, work_process_id)
);

CREATE INDEX IF NOT EXISTS idx_pwp_product ON product_work_processes(factory_id, product_type_id);
