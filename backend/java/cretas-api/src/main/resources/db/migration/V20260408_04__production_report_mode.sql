-- P0-15: 生产报工 mode (六扇门简化报工)
ALTER TABLE production_reports
  ADD COLUMN IF NOT EXISTS report_mode VARCHAR(16) DEFAULT 'MODE_1' NOT NULL;

CREATE INDEX IF NOT EXISTS idx_production_reports_mode
  ON production_reports(factory_id, report_mode);
