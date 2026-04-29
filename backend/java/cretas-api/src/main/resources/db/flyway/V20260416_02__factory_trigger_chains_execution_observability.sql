-- Add execution observability columns to factory_trigger_chains.
--
-- FactoryTriggerChain entity (R7 G3) declares 4 columns that track execution
-- events separate from config updates (created_at / updated_at):
--   last_executed_at      TIMESTAMP
--   last_execution_status VARCHAR(20)   -- SUCCESS / PARTIAL / FAILED
--   last_execution_error  TEXT
--   execution_count       BIGINT NOT NULL DEFAULT 0
--
-- The original create-table migration didn't include these, so any SELECT
-- that referenced execution_count failed with:
--   ERROR: column ftc1_0.execution_count does not exist
--
-- Observed prod 2026-04-16 03:47:19 — app boot tried to load chain state.
--
-- Applied in-place on cretas_prod_db + cretas_db already. Idempotent via
-- IF NOT EXISTS for fresh-DB compatibility.
ALTER TABLE factory_trigger_chains
    ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_execution_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS last_execution_error TEXT,
    ADD COLUMN IF NOT EXISTS execution_count BIGINT NOT NULL DEFAULT 0;
