-- V20260412_07: Piecework commission config table for Phase 4
-- Customer [T 33:15-35:40]: '迎宾按客单量计件, 服务员小组计件'

CREATE TABLE IF NOT EXISTS restaurant_piecework_configs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64),
    role VARCHAR(32) NOT NULL,
    calc_mode VARCHAR(16) NOT NULL DEFAULT 'TEAM',
    base_threshold INTEGER,
    base_salary NUMERIC(10,2),
    per_unit_bonus NUMERIC(8,2),
    unit_type VARCHAR(16) DEFAULT 'COVER',
    team_size INTEGER,
    effective_month DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_piecework_role_month UNIQUE (factory_id, store_id, role, effective_month)
);
