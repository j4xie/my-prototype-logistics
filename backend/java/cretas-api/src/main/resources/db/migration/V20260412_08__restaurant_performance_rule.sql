-- V20260412_08: Performance rule engine table for Phase 4
-- Customer [T 38:05]: '规则不能老是变, 月初才能改'

CREATE TABLE IF NOT EXISTS restaurant_performance_rules (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64),
    effective_month DATE NOT NULL,
    kpi_weights JSONB,
    non_controllable_items JSONB,
    modify_role VARCHAR(32) DEFAULT 'OWNER',
    created_by VARCHAR(64),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_perf_rule_month UNIQUE (factory_id, store_id, effective_month)
);
