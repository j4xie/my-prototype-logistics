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
CREATE TABLE IF NOT EXISTS shedlock (
    name VARCHAR(64) NOT NULL,
    lock_until TIMESTAMP NOT NULL,
    locked_at TIMESTAMP NOT NULL,
    locked_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
