-- Process tasks table — core scheduling unit for PROCESS production mode
CREATE TABLE IF NOT EXISTS process_tasks (
    id VARCHAR(50) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    production_run_id VARCHAR(50) NOT NULL,
    product_type_id VARCHAR(50) NOT NULL,
    work_process_id VARCHAR(50) NOT NULL,
    source_customer_name VARCHAR(100),
    source_doc_type VARCHAR(20),
    source_doc_id VARCHAR(50),
    workflow_version_id INTEGER,
    planned_quantity DECIMAL(10,2) NOT NULL,
    completed_quantity DECIMAL(10,2) DEFAULT 0,
    pending_quantity DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    start_date DATE,
    expected_end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    previous_terminal_status VARCHAR(20),
    created_by BIGINT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    version BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pt_factory_status ON process_tasks(factory_id, status);
CREATE INDEX IF NOT EXISTS idx_pt_factory_product ON process_tasks(factory_id, product_type_id);
CREATE INDEX IF NOT EXISTS idx_pt_run ON process_tasks(production_run_id);
