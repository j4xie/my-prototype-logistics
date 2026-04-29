-- Capability Calculator query indexes (数据织网 Sub-Project A spec §3.0.1).
--
-- Background: capability/calculator.py runs:
--   SELECT DISTINCT fd.original_name
--     FROM smart_bi_pg_field_definitions fd
--     JOIN smart_bi_pg_excel_uploads u ON fd.upload_id = u.id
--    WHERE u.factory_id = $1
--      AND u.upload_status = 'COMPLETED'
--      [merge_status filter (B-stage column)]
--
-- Without these indexes, prod (12 factories × ~100 uploads avg × ~20 fields)
-- expects ~200-500ms per call. With indexes, target < 20ms (per spec EXPLAIN ANALYZE
-- estimate). Migration v1.4 O1 explicitly says "不等 SLO 失败再加, 主动建".
--
-- Apply timing: deploy at start of Day 4 test env, then Day 13 prod gradual rollout,
-- BEFORE the calculator endpoint goes live (spec: "index 必须在 calculator 上线之前部署").

-- Partial index: only COMPLETED uploads matter for capability (avoid bloating with
-- PROCESSING / FAILED rows). 12 factories × tens of completed uploads = thin index.
-- (factory_id, upload_status) composite is more selective than the existing
-- single-column idx_pg_upload_factory + idx_pg_upload_status combo for our query.
CREATE INDEX IF NOT EXISTS idx_uploads_factory_status_completed
  ON smart_bi_pg_excel_uploads (factory_id, upload_status)
  WHERE upload_status = 'COMPLETED';

-- Note (Apr 26 2026, deploy-time discovery on test env smartbi_db):
-- smart_bi_pg_field_definitions ALREADY has `idx_pg_field_upload` btree (upload_id),
-- which covers the JOIN in our calculator query. Day 3 spec §3.0.1 prescribed
-- a second index `idx_field_def_upload_id` on the same column, but that would
-- be a redundant duplicate. Skipped here. If a future query needs a different
-- composite (e.g. (upload_id, original_name) for covering DISTINCT), add it
-- in a new migration.

-- Rollback:
--   DROP INDEX IF EXISTS idx_uploads_factory_status_completed;
