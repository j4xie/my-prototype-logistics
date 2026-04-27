-- 数据织网 Sub-Project C Day 8 (May 1 2026): extend admin_queue.entity_type CHECK
-- to include 'field_conflict'.
--
-- per 04-C v1.3 §3.5.1 (S-23): C reuses B's entity_resolution_admin_queue table.
-- 30% diff conflicts during write_provenance enqueue rows with entity_type='field_conflict'.
--
-- Idempotent: drop-then-add to handle re-runs.

ALTER TABLE entity_resolution_admin_queue
    DROP CONSTRAINT IF EXISTS entity_resolution_admin_queue_entity_type_check;

ALTER TABLE entity_resolution_admin_queue
    ADD CONSTRAINT entity_resolution_admin_queue_entity_type_check
        CHECK (entity_type IN (
            'store', 'product', 'staff', 'ingredient',
            'shape_detection', 'sheet_merge', 'period_inference',
            'field_conflict'
        ));

-- Rollback:
--   ALTER TABLE entity_resolution_admin_queue
--     DROP CONSTRAINT entity_resolution_admin_queue_entity_type_check;
--   ALTER TABLE entity_resolution_admin_queue
--     ADD CONSTRAINT entity_resolution_admin_queue_entity_type_check
--       CHECK (entity_type IN (
--         'store', 'product', 'staff', 'ingredient',
--         'shape_detection', 'sheet_merge', 'period_inference'
--       ));
-- Note: rollback only safe if no rows with entity_type='field_conflict' exist.
