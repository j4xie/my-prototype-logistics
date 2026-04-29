-- ShedLock distributed lock table
-- Used by ShedLock to prevent @Scheduled cron jobs from firing concurrently
-- across multiple JVM instances (e.g. during blue-green deploy overlap).
--
-- When @SchedulerLock(name = "X") fires, ShedLock INSERTs or UPDATEs a row
-- with name='X', lock_until=<future>, and only one instance succeeds.
-- Other instances see lock_until > NOW() and skip the run.
--
-- Schema required by shedlock-provider-jdbc-template:
--   https://github.com/lukas-krecan/ShedLock#configure-lockprovider
--
-- name column sized at VARCHAR(128) — not the spec's default VARCHAR(64) —
-- because our @SchedulerLock(name="<Class>.<method>") convention easily
-- exceeds 64 chars (e.g. ErrorAttributionAnalysisScheduler
-- .generateOptimizationSuggestions is 65). Production hit this at
-- 2026-04-15 04:00:00 when that specific cron fired and blew up with
-- "value too long for type character varying(64)". 128 gives room to grow.
CREATE TABLE IF NOT EXISTS shedlock (
    name VARCHAR(128) NOT NULL,
    lock_until TIMESTAMP NOT NULL,
    locked_at TIMESTAMP NOT NULL,
    locked_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);

-- Widen existing column if the table was pre-created with VARCHAR(64)
-- (idempotent — no-op if already 128).
ALTER TABLE shedlock ALTER COLUMN name TYPE VARCHAR(128);
