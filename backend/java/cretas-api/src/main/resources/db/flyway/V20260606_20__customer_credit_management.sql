-- P1 #23 S-CREDIT-1 客户信用管理 (2026-05-17)
--
-- Customer 加 2 字段 + CHECK 约束:
--   credit_period_days INT default 30 (信用账期天数, NULL = 无账期限制)
--   credit_status VARCHAR(20) default 'NORMAL' (NORMAL/WARNING/SUSPENDED)
--
-- credit_limit + current_balance 字段已存在 (Sprint 1 早期落地), 不重复添加.

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS credit_period_days INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS credit_status VARCHAR(20) DEFAULT 'NORMAL';

-- Backfill existing rows (DEFAULT 仅作用于 NEW rows)
UPDATE customers
   SET credit_period_days = 30
 WHERE credit_period_days IS NULL;

UPDATE customers
   SET credit_status = 'NORMAL'
 WHERE credit_status IS NULL;

-- CHECK 约束 (Postgres 16 兼容: 用 DO block 防重复创建)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_credit_status_check'
    ) THEN
        ALTER TABLE customers
            ADD CONSTRAINT customers_credit_status_check
            CHECK (credit_status IN ('NORMAL', 'WARNING', 'SUSPENDED'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_credit_period_days_check'
    ) THEN
        ALTER TABLE customers
            ADD CONSTRAINT customers_credit_period_days_check
            CHECK (credit_period_days IS NULL OR (credit_period_days >= 0 AND credit_period_days <= 365));
    END IF;
END $$;

COMMENT ON COLUMN customers.credit_period_days IS '信用账期天数 (P1 #23 S-CREDIT-1). NULL = 无账期, default 30.';
COMMENT ON COLUMN customers.credit_status IS '客户信用状态 (P1 #23 S-CREDIT-1): NORMAL/WARNING/SUSPENDED. SUSPENDED 时创建 SO 硬阻塞.';

-- Index 信用状态查询 (列表过滤 + 风控仪表)
CREATE INDEX IF NOT EXISTS idx_customer_credit_status
    ON customers (factory_id, credit_status)
    WHERE deleted_at IS NULL;
