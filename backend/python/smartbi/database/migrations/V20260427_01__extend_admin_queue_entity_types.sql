-- 数据织网 Sub-Project B Day 5 (Apr 27 2026): broaden admin_queue.entity_type CHECK.
--
-- Per 03-B v1.2 §5.1.1 (admin queue spec line 1493) the authoritative entity_type
-- list is: 'store' / 'product' / 'staff' / 'sheet_merge' / 'period_inference'.
-- Day 4 shape_router._queue_unknown_for_admin also needs 'shape_detection' to
-- record upload-level shape detection failures (was using 'store' as a
-- placeholder hack).
--
-- V20260426_01 created the constraint with only ('store','product','staff');
-- this migration broadens it without losing tenant isolation or RLS. The
-- constraint name is the PostgreSQL auto-generated default
-- 'entity_resolution_admin_queue_entity_type_check' (verified on prod
-- smartbi_db Apr 26).

ALTER TABLE entity_resolution_admin_queue
    DROP CONSTRAINT IF EXISTS entity_resolution_admin_queue_entity_type_check;

ALTER TABLE entity_resolution_admin_queue
    ADD CONSTRAINT entity_resolution_admin_queue_entity_type_check
        CHECK (entity_type IN (
            'store', 'product', 'staff',
            'shape_detection', 'sheet_merge', 'period_inference'
        ));

-- Rollback:
--   ALTER TABLE entity_resolution_admin_queue
--     DROP CONSTRAINT entity_resolution_admin_queue_entity_type_check;
--   ALTER TABLE entity_resolution_admin_queue
--     ADD CONSTRAINT entity_resolution_admin_queue_entity_type_check
--       CHECK (entity_type IN ('store', 'product', 'staff'));
-- Note: rollback only safe if no rows with the new entity_type values exist.
