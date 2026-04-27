-- 数据织网 Sub-Project C Day 16 (May 2 2026): backfill_progress checkpoint.
--
-- per 04-C v1.4 §9.2.1. Tracks per-source-table progress for the
-- BF1/BF2 historical backfill into field_provenance.
-- Internal ops table — no RLS (no tenant scope). PRIMARY KEY = table_name.
-- Crash-resume: backfill resumes from last_id on next run.

CREATE TABLE IF NOT EXISTS backfill_progress (
    table_name VARCHAR(100) PRIMARY KEY,
    last_id BIGINT NOT NULL DEFAULT 0,
    rows_processed BIGINT NOT NULL DEFAULT 0,
    rows_inserted BIGINT NOT NULL DEFAULT 0,
    rows_skipped BIGINT NOT NULL DEFAULT 0,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    last_error TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON backfill_progress TO smartbi_user;

-- Rollback: DROP TABLE IF EXISTS backfill_progress;
