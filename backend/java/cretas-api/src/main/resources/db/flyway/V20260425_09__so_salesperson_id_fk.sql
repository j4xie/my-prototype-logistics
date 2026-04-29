-- V20260425_09__so_salesperson_id_fk.sql
--
-- R6: convert salesperson_id from VARCHAR(191) to BIGINT + add real FK to users(id).
-- Audit S4 (R4 reviewer) deferred.
--
-- Pre-flight checks (verified prod 2026-04-25 EDT):
-- - Total rows with salesperson_id non-null: 4 (1 R4 testing + 3 R5 backfill)
-- - All values match `^\d+$` (CHECK constraint chk_salesperson_id_numeric ensures this)
-- - 0 orphan FKs (all referenced user IDs exist)
-- - sales_orders table small (~209 rows), ALTER TYPE lock window measured in ms
--
-- Steps:
-- 1. Drop the CHECK constraint (will be replaced by FK type integrity)
-- 2. ALTER COLUMN type VARCHAR(191) → BIGINT, with USING cast
-- 3. ADD FOREIGN KEY ... ON DELETE SET NULL (preserves snapshot, drops FK on user delete)
--
-- Backwards-compat:
-- - SalesServiceImpl.resolveSalespersonField writes input string → setSalespersonId(input)
-- - Entity field was String. Need to also change entity field to Long.
-- - DTO request body still accepts String "146" — JPA/Hibernate will coerce String→Long
--   on setter call... wait, no. setSalespersonId(String) won't compile after entity change.
-- - REQUIRES coordinated entity change: SalesOrder.salespersonId String → Long
--   AND resolveSalespersonField setSalespersonId(input) → setSalespersonId(Long.parseLong(input))
-- - Both changes shipped in same commit as this migration.

-- 1. Drop CHECK (constraint name from V20260425_07)
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS chk_salesperson_id_numeric;

-- 2. Convert column type
ALTER TABLE sales_orders
ALTER COLUMN salesperson_id TYPE BIGINT
USING (CASE WHEN salesperson_id IS NULL THEN NULL ELSE salesperson_id::BIGINT END);

-- 3. Add FK
ALTER TABLE sales_orders
DROP CONSTRAINT IF EXISTS fk_sales_orders_salesperson;

ALTER TABLE sales_orders
ADD CONSTRAINT fk_sales_orders_salesperson
FOREIGN KEY (salesperson_id) REFERENCES users(id) ON DELETE SET NULL;

DO $$
DECLARE
  v_col_type TEXT;
  v_fk_count INT;
BEGIN
  SELECT data_type INTO v_col_type FROM information_schema.columns
   WHERE table_name='sales_orders' AND column_name='salesperson_id';
  SELECT COUNT(*) INTO v_fk_count FROM pg_constraint
   WHERE conname='fk_sales_orders_salesperson';

  RAISE NOTICE 'V20260425_09: salesperson_id type=%, FK constraint installed=%', v_col_type, v_fk_count;

  IF v_col_type IS DISTINCT FROM 'bigint' THEN
    RAISE EXCEPTION 'V20260425_09 sanity: salesperson_id should be bigint, got %', v_col_type;
  END IF;
  IF v_fk_count = 0 THEN
    RAISE EXCEPTION 'V20260425_09 sanity: FK constraint fk_sales_orders_salesperson missing';
  END IF;
END $$;
