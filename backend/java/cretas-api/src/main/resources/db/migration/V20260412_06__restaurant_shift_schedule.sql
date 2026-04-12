-- V20260412_06: Shift scheduling tables for Phase 4 workforce management
-- Customer [T 28:06-31:00]: '可能早中晚班, 公式制排班, 全职+兼职'

CREATE TABLE IF NOT EXISTS restaurant_shift_templates (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64),
    template_name VARCHAR(64) NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    duration_hours NUMERIC(4,1),
    employee_type VARCHAR(20) DEFAULT 'BOTH',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurant_shift_schedules (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64) NOT NULL,
    employee_id VARCHAR(64) NOT NULL,
    employee_name VARCHAR(64),
    shift_date DATE NOT NULL,
    shift_template_id VARCHAR(36),
    actual_hours NUMERIC(4,1),
    employee_type VARCHAR(20) NOT NULL,
    hourly_rate NUMERIC(8,2),
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_shift_employee_date UNIQUE (factory_id, store_id, employee_id, shift_date)
);

CREATE INDEX IF NOT EXISTS idx_shift_store_date ON restaurant_shift_schedules (factory_id, store_id, shift_date);
