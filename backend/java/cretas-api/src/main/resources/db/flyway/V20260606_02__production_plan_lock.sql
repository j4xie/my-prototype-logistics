-- =====================================================
-- Issue #759 fix — Production plan lock backend API.
--
-- PR #755 #747 shipped a frontend "锁定" button + banner on production plans,
-- but no backend endpoint existed. The button currently fell through to a
-- toast 'Action: lock' placeholder. This migration adds:
--   - production_plans.is_locked  BOOLEAN, default false
--   - production_plans.lock_reason TEXT
--   - production_plans.locked_at  TIMESTAMP
--   - production_plans.locked_by  BIGINT (user_id)
--
-- Lock semantics: when is_locked=true, plan cannot be updated (planQuantity /
-- plannedDate / cancelled). Same role guards as plan write
-- (production:read_write or scheduling:read_write).
--
-- @since 2026-05-17
-- =====================================================

ALTER TABLE production_plans
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS lock_reason TEXT,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS locked_by BIGINT;

CREATE INDEX IF NOT EXISTS idx_production_plans_is_locked
    ON production_plans(factory_id, is_locked)
    WHERE is_locked = true;

COMMENT ON COLUMN production_plans.is_locked IS '是否锁定 (true=不可编辑数量/日期/取消). Issue #759';
COMMENT ON COLUMN production_plans.lock_reason IS '锁定原因 (lock 时填, unlock 时保留为最后一次原因)';
COMMENT ON COLUMN production_plans.locked_at IS '锁定时间';
COMMENT ON COLUMN production_plans.locked_by IS '锁定操作人 user_id';
