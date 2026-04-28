-- V20260501_04__restaurant_etl_failures.sql
-- ETL 失败日志表，per spec v2 §2.1
-- Phase A A-1 — restaurant ETL retry/failure persistence

CREATE TABLE IF NOT EXISTS restaurant_etl_failures (
  id BIGSERIAL PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  run_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL,    -- 'failed' | 'retrying' | 'failed_final'
  attempt INT NOT NULL,            -- 1-3
  error_msg TEXT,
  error_class VARCHAR(100),
  duration_ms INT,
  trace TEXT,                       -- truncated 4KB
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etl_fail_factory_run ON restaurant_etl_failures (factory_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_etl_fail_run_at ON restaurant_etl_failures (run_at);  -- 90-day archive cron

COMMENT ON TABLE restaurant_etl_failures IS 'Restaurant ETL run failure log (Phase A A-1). 90-day retention via monthly cron.';
