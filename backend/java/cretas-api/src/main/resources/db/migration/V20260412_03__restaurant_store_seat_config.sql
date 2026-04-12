CREATE TABLE IF NOT EXISTS store_seat_configs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64) NOT NULL,
    table_number VARCHAR(32) NOT NULL,
    seat_count INTEGER NOT NULL,
    zone VARCHAR(64),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_store_table UNIQUE (factory_id, store_id, table_number)
);
CREATE INDEX IF NOT EXISTS idx_seat_config_store ON store_seat_configs (factory_id, store_id) WHERE deleted_at IS NULL;
