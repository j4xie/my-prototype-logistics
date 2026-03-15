-- P0-3: Ensure production_reports has version column for @Version optimistic locking
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;

-- P1-4: Add notes column for worker report notes
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS notes VARCHAR(500);
