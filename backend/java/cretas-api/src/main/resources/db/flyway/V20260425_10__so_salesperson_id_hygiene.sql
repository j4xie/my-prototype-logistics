-- V20260425_10__so_salesperson_id_hygiene.sql
--
-- R7 audit C3 follow-up: defensive cleanup + future-proofing for soft-deleted users.
--
-- Background: V20260425_06 (R5 backfill) used raw SQL that bypasses Hibernate's
-- @Where(deleted_at IS NULL) filter on User. So if a factory soft-deleted a user
-- and then ran the backfill, the SO might link to that soft-deleted user.
-- Verified prod (2026-04-25 EDT): 0 SOs link to soft-deleted users — no current
-- impact. This migration is defensive future-proofing:
--
-- 1. Reset any salesperson_id that points at a soft-deleted user back to NULL.
--    The snapshot field `salesperson` retains the name for legacy display.
--    ON DELETE SET NULL FK constraint only fires on physical delete, not soft-delete,
--    so without this hygiene pass dangling FKs would silently break commission joins.
--
-- 2. Idempotent: the WHERE clause guards against running on already-clean data.
--
-- 3. NOT a Java/Hibernate change — this is purely a data hygiene migration.
--
-- Long-term: an ops-side hygiene job (cron or scheduled task) should periodically
-- run a similar query and either alert or auto-clean. Tracked separately.

UPDATE sales_orders
SET salesperson_id = NULL
WHERE salesperson_id IN (
    SELECT u.id FROM users u WHERE u.deleted_at IS NOT NULL
);

DO $$
DECLARE
  v_dangling_count INT;
  v_fixed_count INT;
BEGIN
  SELECT COUNT(*) INTO v_dangling_count
  FROM sales_orders so
  JOIN users u ON u.id = so.salesperson_id
  WHERE u.deleted_at IS NOT NULL;

  IF v_dangling_count > 0 THEN
    RAISE EXCEPTION 'V20260425_10 sanity: still % dangling FKs to soft-deleted users after cleanup', v_dangling_count;
  END IF;
  RAISE NOTICE 'V20260425_10: hygiene complete, 0 dangling FKs to soft-deleted users';
END $$;
