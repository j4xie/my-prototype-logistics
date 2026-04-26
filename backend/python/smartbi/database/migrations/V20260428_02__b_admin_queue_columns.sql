-- Add priority/status/reasoning/extra/reviewed_by/reviewed_at columns to
-- entity_resolution_admin_queue. Also extend entity_type CHECK to include
-- 'ingredient' for InventoryWriter queueing of unresolved ingredient names.
ALTER TABLE entity_resolution_admin_queue
    ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS reasoning TEXT,
    ADD COLUMN IF NOT EXISTS extra JSONB,
    ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(50),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

-- Add CHECK constraint on priority (idempotent: drop-then-add)
ALTER TABLE entity_resolution_admin_queue
    DROP CONSTRAINT IF EXISTS entity_resolution_admin_queue_priority_check;
ALTER TABLE entity_resolution_admin_queue
    ADD CONSTRAINT entity_resolution_admin_queue_priority_check
        CHECK (priority IN ('low', 'medium', 'high'));

ALTER TABLE entity_resolution_admin_queue
    DROP CONSTRAINT IF EXISTS entity_resolution_admin_queue_status_check;
ALTER TABLE entity_resolution_admin_queue
    ADD CONSTRAINT entity_resolution_admin_queue_status_check
        CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'DEFERRED'));

-- Extend entity_type CHECK to include 'ingredient'
ALTER TABLE entity_resolution_admin_queue
    DROP CONSTRAINT IF EXISTS entity_resolution_admin_queue_entity_type_check;
ALTER TABLE entity_resolution_admin_queue
    ADD CONSTRAINT entity_resolution_admin_queue_entity_type_check
        CHECK (entity_type IN (
            'store', 'product', 'staff', 'ingredient',
            'shape_detection', 'sheet_merge', 'period_inference'
        ));

-- Index for pending queue queries
CREATE INDEX IF NOT EXISTS idx_eraq_pending_priority
    ON entity_resolution_admin_queue (factory_id, priority, created_at)
    WHERE status = 'PENDING';

-- Rollback:
--   DROP INDEX IF EXISTS idx_eraq_pending_priority;
--   ALTER TABLE entity_resolution_admin_queue DROP CONSTRAINT IF EXISTS entity_resolution_admin_queue_entity_type_check;
--   ALTER TABLE entity_resolution_admin_queue ADD CONSTRAINT entity_resolution_admin_queue_entity_type_check
--     CHECK (entity_type IN ('store','product','staff','shape_detection','sheet_merge','period_inference'));
--   ALTER TABLE entity_resolution_admin_queue DROP CONSTRAINT IF EXISTS entity_resolution_admin_queue_status_check;
--   ALTER TABLE entity_resolution_admin_queue DROP CONSTRAINT IF EXISTS entity_resolution_admin_queue_priority_check;
--   ALTER TABLE entity_resolution_admin_queue
--     DROP COLUMN IF EXISTS reviewed_at,
--     DROP COLUMN IF EXISTS reviewed_by,
--     DROP COLUMN IF EXISTS extra,
--     DROP COLUMN IF EXISTS reasoning,
--     DROP COLUMN IF EXISTS status,
--     DROP COLUMN IF EXISTS priority;
