-- V20260412_01: Create restaurant_sales_plans table for Phase 1 sales plan tracking

CREATE TABLE IF NOT EXISTS restaurant_sales_plans (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64),
    plan_month DATE NOT NULL,
    target_revenue NUMERIC(14,2) NOT NULL,
    target_order_count INTEGER,
    target_avg_ticket NUMERIC(10,2),
    daily_adjustments JSONB,
    holiday_adjustments JSONB,
    notes VARCHAR(500),
    created_by VARCHAR(64),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_sales_plan_month UNIQUE (factory_id, store_id, plan_month)
);

CREATE INDEX IF NOT EXISTS idx_sales_plan_factory_month
    ON restaurant_sales_plans (factory_id, plan_month)
    WHERE deleted_at IS NULL;
