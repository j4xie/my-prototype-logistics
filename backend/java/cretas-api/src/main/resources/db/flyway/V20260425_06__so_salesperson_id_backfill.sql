-- V20260425_06__so_salesperson_id_backfill.sql
--
-- Round 5: backfill historical SOs' salesperson_id where unique-match exists.
-- Per audit S5 (Apr 25 2026 R4 reviewer).
--
-- Survey before this migration (prod, 2026-04-25 16:00 EDT):
--   - 209 total SOs
--   - 1 has FK (created/edited via R4 dual-field)
--   - 41 NULL FK + non-blank snapshot (backfill candidates)
--     - 3 unique-match (active or inactive user with same fullName) — safe backfill
--     - 38 zero-match (snapshot string has no corresponding user — mostly E2E test
--       artifacts like "E2E测试员508024", typed-in strings — leave NULL)
--   - 167 NULL FK + blank snapshot (genuine historical/imported orders without salesperson)
--   - 0 collision (>1 match) — no manual review needed
--
-- Strategy:
-- - Only backfill rows where exactly 1 user matches by (factory_id, full_name).
-- - Prefer active users; if no active match, fall back to any matching user.
-- - Leave 0-match rows untouched (snapshot remains correct for legacy display).
-- - Leave blank-snapshot rows untouched (no source of truth for who).
--
-- Idempotent: the WHERE clause guards against re-running on already-backfilled rows.

WITH backfill AS (
  SELECT
    so.id AS so_id,
    (
      SELECT u.id::text
      FROM users u
      WHERE u.factory_id = so.factory_id
        AND u.full_name = so.salesperson
      ORDER BY u.is_active DESC NULLS LAST, u.id ASC
      LIMIT 1
    ) AS matched_user_id,
    (
      SELECT COUNT(*)
      FROM users u
      WHERE u.factory_id = so.factory_id
        AND u.full_name = so.salesperson
    ) AS match_count
  FROM sales_orders so
  WHERE so.salesperson_id IS NULL
    AND so.salesperson IS NOT NULL
    AND so.salesperson != ''
    AND so.deleted_at IS NULL
)
UPDATE sales_orders so
SET salesperson_id = bf.matched_user_id
FROM backfill bf
WHERE so.id = bf.so_id
  AND bf.match_count = 1
  AND bf.matched_user_id IS NOT NULL;

DO $$
DECLARE
  v_total_filled BIGINT;
  v_remaining_null_with_snapshot BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total_filled FROM sales_orders WHERE salesperson_id IS NOT NULL AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_remaining_null_with_snapshot FROM sales_orders
   WHERE salesperson_id IS NULL AND salesperson IS NOT NULL AND salesperson != '' AND deleted_at IS NULL;
  RAISE NOTICE 'V20260425_06: total SOs with FK now=%, remaining NULL+non-blank=% (mostly E2E test data + typo snapshots, intentionally untouched)',
    v_total_filled, v_remaining_null_with_snapshot;
END $$;
