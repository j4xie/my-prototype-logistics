-- Sprint 4 W1 S-CUSTOMER-TAB-1: customer 360° tab 20 "业务员变更 history"
-- Spec: docs/superpowers/specs/2026-05-16-sprint4-w1-customer-tab-360-design.md §5.3
-- Plan: docs/superpowers/plans/2026-05-17-sprint4-w1-customer-tab-360-impl.md §A1

-- Step 1: Customer 2 new fields
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS assigned_sales_user_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS assigned_sales_user_assigned_at TIMESTAMP NULL;

-- Step 2: history table (R4 dedup uses this)
CREATE TABLE IF NOT EXISTS customer_sales_user_history (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id),
    previous_sales_user_id BIGINT NULL,
    new_sales_user_id BIGINT NULL,
    changed_by BIGINT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reason VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

-- Step 3: indices for tab 20 list + R4 dedup query
CREATE INDEX IF NOT EXISTS idx_csuh_customer_changed
  ON customer_sales_user_history(customer_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_csuh_factory_changed
  ON customer_sales_user_history(factory_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_csuh_dedup
  ON customer_sales_user_history(factory_id, customer_id, new_sales_user_id, changed_at);

-- Step 4: BaseEntity audit trigger (update_updated_at function defined in V20260409_01)
DROP TRIGGER IF EXISTS trigger_csuh_updated_at ON customer_sales_user_history;
CREATE TRIGGER trigger_csuh_updated_at
BEFORE UPDATE ON customer_sales_user_history
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
