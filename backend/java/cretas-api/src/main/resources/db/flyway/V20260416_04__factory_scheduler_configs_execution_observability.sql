-- Add execution observability columns to factory_scheduler_configs.
--
-- Same observability pattern as factory_trigger_chains (V20260416_02):
--   last_executed_at, last_execution_status, last_execution_error,
--   execution_count
-- Columns written by DynamicSchedulerService to track task runs without
-- touching the updated_at config-change timestamp.
--
-- CRITICAL: DynamicSchedulerService.init() eagerly queries this table at
-- app boot (SELECT ... FROM factory_scheduler_configs WHERE enabled). Without
-- these columns, Hibernate raises SQLGrammarException, which kills the bean
-- creation chain for dynamicSchedulerService → businessRuleController →
-- Spring context refresh → entire app exits. Observed prod + test failing
-- to start at 2026-04-16 04:27:23.
--
-- Already applied in-place on cretas_prod_db + cretas_db. Migration file
-- so fresh DB installs and new environments get it automatically.
ALTER TABLE factory_scheduler_configs
    ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_execution_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS last_execution_error TEXT,
    ADD COLUMN IF NOT EXISTS execution_count BIGINT NOT NULL DEFAULT 0;
