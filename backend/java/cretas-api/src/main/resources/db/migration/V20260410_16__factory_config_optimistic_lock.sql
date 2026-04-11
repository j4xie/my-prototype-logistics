-- V20260410_16__factory_config_optimistic_lock.sql
-- Round 4 Fix P1-17: Add @Version column for optimistic locking on FactoryConfiguration
-- Without this, two admins saving simultaneously would hit the unique(factory_id, config_version)
-- constraint and get a cryptic 500 error. With @Version, the second save cleanly throws
-- StaleObjectStateException → 409 Conflict.

ALTER TABLE factory_configurations
  ADD COLUMN IF NOT EXISTS row_version BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN factory_configurations.row_version IS
  'Optimistic lock version. Incremented by Hibernate on each UPDATE.';
