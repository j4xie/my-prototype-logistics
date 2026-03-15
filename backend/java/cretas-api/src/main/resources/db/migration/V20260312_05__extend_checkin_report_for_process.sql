-- Extend existing tables for PROCESS mode support
-- ProcessCheckinRecord: add process_task_id
ALTER TABLE process_checkin_records ADD COLUMN IF NOT EXISTS process_task_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_pcr_process_task ON process_checkin_records(process_task_id);

-- ProductionReport: add process mode fields
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS process_task_id VARCHAR(50);
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS is_supplemental BOOLEAN DEFAULT FALSE;
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS approved_by BIGINT;
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS rejected_reason VARCHAR(500);
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS reversal_of_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_pr_process_task ON production_reports(process_task_id);
CREATE INDEX IF NOT EXISTS idx_pr_approval ON production_reports(approval_status);
