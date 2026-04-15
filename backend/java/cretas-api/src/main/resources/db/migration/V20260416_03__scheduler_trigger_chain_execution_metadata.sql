-- R7 G3: add execution observability columns to factory_trigger_chains.
--
-- Purpose: let E2E deep test J2-9 (trigger chain fire verification) assert that
-- a configured chain actually executed when its event fired, not just that the
-- config row exists. Also gives operators a diagnostic surface when debugging
-- "why didn't my trigger chain run" without needing backend log access.
--
-- Columns:
--   last_executed_at     — when the last run started (null = never run)
--   last_execution_status — SUCCESS / PARTIAL / FAILED
--   last_execution_error  — brief error summary if any step failed, else null
--   execution_count       — cumulative run count (includes failures)
--
-- Idempotent — each column added via IF NOT EXISTS.
--
-- Note: G2 (scheduler observability) intentionally not included here.
-- DynamicSchedulerService's executeTask is left unchanged per a parallel
-- decision; if scheduler observability is needed later, apply the same
-- pattern via a new migration + entity update.

ALTER TABLE factory_trigger_chains
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS last_execution_status VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS last_execution_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS execution_count BIGINT NOT NULL DEFAULT 0;

-- Index on last_executed_at for operator queries like "which chains haven't fired in 24h"
CREATE INDEX IF NOT EXISTS idx_ftch_last_executed ON factory_trigger_chains(last_executed_at);
