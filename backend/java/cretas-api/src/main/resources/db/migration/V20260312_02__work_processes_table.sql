-- Work processes master data table for PROCESS production mode
CREATE TABLE IF NOT EXISTS work_processes (
    id VARCHAR(50) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    process_name VARCHAR(100) NOT NULL,
    process_category VARCHAR(50),
    description VARCHAR(500),
    unit VARCHAR(20) NOT NULL DEFAULT 'kg',
    estimated_minutes INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wp_factory ON work_processes(factory_id);
CREATE INDEX IF NOT EXISTS idx_wp_factory_active ON work_processes(factory_id, is_active);
