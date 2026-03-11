-- Fix: 报工防重唯一约束 — 加入 report_type 维度
-- 允许同一工人+同一批次+同一天分别提交 PROGRESS 和 HOURS 报工

-- 1. 删除旧约束 (不含 report_type)
DROP INDEX IF EXISTS uk_report_worker_batch_date;

-- 2. 新约束: factory_id + worker_id + batch_id + report_type + report_date (batch_id 非空)
CREATE UNIQUE INDEX uk_report_worker_batch_type_date
    ON production_reports (factory_id, worker_id, batch_id, report_type, report_date)
    WHERE deleted_at IS NULL AND batch_id IS NOT NULL;

-- 3. 新约束: factory_id + worker_id + report_type + report_date (batch_id 为空)
CREATE UNIQUE INDEX uk_report_worker_type_date_no_batch
    ON production_reports (factory_id, worker_id, report_type, report_date)
    WHERE deleted_at IS NULL AND batch_id IS NULL;
