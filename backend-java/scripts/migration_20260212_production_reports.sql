-- Migration: Production Reports System
-- Date: 2026-02-12
-- Database: cretas_db (PostgreSQL)

-- 1. Main production_reports table
CREATE TABLE IF NOT EXISTS production_reports (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    batch_id BIGINT,
    worker_id BIGINT NOT NULL,
    report_type VARCHAR(30) NOT NULL,
    schema_id VARCHAR(36),

    report_date DATE NOT NULL,
    reporter_name VARCHAR(100),
    process_category VARCHAR(200),
    product_name VARCHAR(200),
    output_quantity DECIMAL(12,2),
    good_quantity DECIMAL(12,2),
    defect_quantity DECIMAL(12,2),
    total_work_minutes INTEGER,
    total_workers INTEGER,
    operation_volume DECIMAL(10,2),

    hour_entries JSONB DEFAULT '[]',
    non_production_entries JSONB DEFAULT '[]',

    production_start_time TIME,
    production_end_time TIME,

    custom_fields JSONB DEFAULT '{}',
    photos JSONB DEFAULT '[]',

    status VARCHAR(20) DEFAULT 'SUBMITTED',
    synced_to_smartbi BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pr_factory_date ON production_reports(factory_id, report_date);
CREATE INDEX IF NOT EXISTS idx_pr_batch ON production_reports(batch_id);
CREATE INDEX IF NOT EXISTS idx_pr_worker ON production_reports(worker_id);
CREATE INDEX IF NOT EXISTS idx_pr_type ON production_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_pr_sync ON production_reports(synced_to_smartbi) WHERE synced_to_smartbi = FALSE;

-- 2. Add checkin_method to batch_work_sessions
ALTER TABLE batch_work_sessions
    ADD COLUMN IF NOT EXISTS checkin_method VARCHAR(20) DEFAULT 'MANUAL';
COMMENT ON COLUMN batch_work_sessions.checkin_method IS 'NFC / QR / MANUAL';

-- 3. Add assigned_by to batch_work_sessions (P1-7: tracks who proxy-checked-in)
ALTER TABLE batch_work_sessions
    ADD COLUMN IF NOT EXISTS assigned_by BIGINT;

-- 4. Form template seed data
INSERT INTO form_templates (id, name, entity_type, schema_json, is_active, version, source)
VALUES
  (gen_random_uuid(), '实时生产进度上报', 'PRODUCTION_PROGRESS_REPORT',
   '{"fields":[{"key":"processCategory","label":"实时生产类目/工序","type":"select","required":true},{"key":"reportDate","label":"上报产品日期/批次","type":"date","required":true},{"key":"quantity","label":"产品数量","type":"integer","required":true},{"key":"photos","label":"照片","type":"photo_array","required":true,"max":10},{"key":"notes","label":"备注","type":"text","required":false}]}',
   true, 1, 'MANUAL'),
  (gen_random_uuid(), '生产工时上报', 'PRODUCTION_HOURS_REPORT',
   '{"fields":[{"key":"reportDate","label":"工时上报日期","type":"date","required":true},{"key":"productName","label":"商品名称","type":"select","required":true},{"key":"hourEntries","label":"总工时上报","type":"table","required":true,"columns":[{"key":"fullTimeWorkers","label":"正式工人数","type":"integer"},{"key":"fullTimeHours","label":"生产总工时","type":"decimal"},{"key":"hourlyWorkers","label":"长期小时工人数","type":"integer"},{"key":"hourlyHours","label":"生产总工时","type":"decimal"},{"key":"dailyWorkers","label":"日结工人数","type":"integer"},{"key":"dailyHours","label":"生产总工时","type":"decimal"}]},{"key":"productionStartTime","label":"生产开始时间","type":"time","required":true},{"key":"productionEndTime","label":"生产结束时间","type":"time","required":true},{"key":"operationVolume","label":"操作量","type":"decimal","required":true},{"key":"notes","label":"备注","type":"text","required":false}]}',
   true, 1, 'MANUAL')
ON CONFLICT DO NOTHING;
