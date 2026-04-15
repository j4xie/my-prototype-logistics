-- R7 Issue 3: sales_order_prepayment_records_items.parent_id type alignment
--
-- Context: this sub-table was auto-generated before DDLExecutor.resolveParentIdSqlType
-- (R4 fix, commit 7b23217b0) taught new sub-tables to inherit parent_id type from their
-- parent table. Parent `sales_orders.id` is VARCHAR, but this sub-table was created
-- with `parent_id UUID NOT NULL`. Sub-tables created AFTER R4 are correct; this
-- pre-existing one is the only known drift.
--
-- Impact pre-migration:
--   - Write: type-aware SQL cast in DDLExecutor/DynamicTableService now generates
--     VARCHAR cast for sales_orders children, but this column still expects UUID →
--     new writes failed with "invalid input syntax for type uuid".
--   - Read: verifyParentOwnership could not reliably link rows back to parent.
--
-- Fix: change parent_id from UUID to VARCHAR(100) matching the parent's id type.
-- Existing UUID values stringify cleanly to VARCHAR — no data loss.
--
-- Idempotent: if column is already VARCHAR or table doesn't exist (test envs where
-- the sub-table wasn't created), this migration is a no-op.
--
-- Executed directly on prod (cretas_prod_db) 2026-04-16 with 2 rows preserved.
-- This file makes the change re-playable for any env that still has the old schema.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_order_prepayment_records_items'
      AND column_name = 'parent_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE sales_order_prepayment_records_items
      ALTER COLUMN parent_id TYPE varchar(100) USING parent_id::text;
    RAISE NOTICE 'Migrated sales_order_prepayment_records_items.parent_id UUID -> VARCHAR(100)';
  ELSE
    RAISE NOTICE 'sales_order_prepayment_records_items.parent_id already VARCHAR or table missing — skipping';
  END IF;
END $$;
