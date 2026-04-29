-- Add target_role column to notifications table.
--
-- Notification entity declares target_role (VARCHAR(50)) + a composite index
-- (factory_id, target_role) used for broadcasting to everyone with a given
-- role in a factory. Field was added in entity but the original
-- V2025_12_30_1 create-table migration didn't include it, so any INSERT
-- referencing target_role failed with:
--   ERROR: column "target_role" of relation "notifications" does not exist
--
-- Observed 2026-04-16 02:48:47 when SchedulingAIServiceImpl tried to send a
-- high-risk plan alert (WORKSHOP_SUPERVISOR broadcast).
--
-- Idempotent: IF NOT EXISTS guards for running on a DB that already had the
-- column (we already patched prod + test DBs in-place).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_role VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_notification_factory_role
    ON notifications (factory_id, target_role);
