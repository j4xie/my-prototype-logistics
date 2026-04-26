-- 数据织网 Sub-Project B Phase 3 (Apr 29 2026): Sheet Merger schema.
--
-- Per 03-B v1.2 §5.1 (lines 1450-1484), add merge_status / merge_target_id /
-- merge_inferred_period_start / merge_inferred_period_end /
-- merge_period_inference_method to smart_bi_pg_excel_uploads. This is the
-- keystone that lets Silver writers populate period_start/period_end (was
-- always NULL pre-Phase-3).
--
-- entity_resolution_admin_queue with entity_type='sheet_merge' is already
-- in V20260426_01 + V20260427_01; this migration only adds the upload-level
-- columns + supporting indexes.

ALTER TABLE smart_bi_pg_excel_uploads
    ADD COLUMN IF NOT EXISTS merge_status VARCHAR(50) DEFAULT NULL,
    -- v1.1 修 S-3: 删除 target upload 不阻塞, target_id 自动 NULL
    ADD COLUMN IF NOT EXISTS merge_target_id BIGINT
        REFERENCES smart_bi_pg_excel_uploads(id) ON DELETE SET NULL,
    -- v1.1 修 C-6/S-8: NULL 表示推断失败 / 不可信, Sheet Merger 跳过不做合并
    ADD COLUMN IF NOT EXISTS merge_inferred_period_start DATE,
    ADD COLUMN IF NOT EXISTS merge_inferred_period_end DATE,
    ADD COLUMN IF NOT EXISTS merge_period_inference_method VARCHAR(20) DEFAULT NULL;

-- merge_period_inference_method 取值:
--   NULL                : 还没推断 / 推断失败
--   'row_date_column'   : priority 1, 行内日期列 (高质量)
--   'sheet_name_regex'  : priority 2, sheet 名解析 (中等质量)
--   'admin_set'         : priority 3, admin 手工指定 (高质量, 客户裁决后)
--   不再用 'upload_at_fallback' (会导致 C-6 错误合并)
--
-- merge_status 取值 (v1.2 加 NESTED_IN_<id>):
--   NULL                : 正常, A capability 包含此 upload
--   'SUPERSEDED'        : 同时间段被新版覆盖
--   'MERGED_INTO_<id>'  : 与另一 upload 部分重叠合并 (id 是 target_id, 动态 id)
--   'NESTED_IN_<id>'    : 自己是 other 的 SUBSET, 嵌套在 other 内 (id 是最小容器)
--   'PERIOD_UNKNOWN'    : 时间推断失败, 不参与 merge, 仍激活 (capability union)

CREATE INDEX IF NOT EXISTS idx_uploads_merge_status_active
    ON smart_bi_pg_excel_uploads(factory_id, merge_status)
    WHERE merge_status IS NULL OR merge_status = 'PERIOD_UNKNOWN';

CREATE INDEX IF NOT EXISTS idx_uploads_period
    ON smart_bi_pg_excel_uploads(factory_id, merge_inferred_period_start, merge_inferred_period_end)
    WHERE merge_status IS NULL AND merge_inferred_period_start IS NOT NULL;

-- Rollback:
--   DROP INDEX IF EXISTS idx_uploads_period;
--   DROP INDEX IF EXISTS idx_uploads_merge_status_active;
--   ALTER TABLE smart_bi_pg_excel_uploads
--     DROP COLUMN IF EXISTS merge_period_inference_method,
--     DROP COLUMN IF EXISTS merge_inferred_period_end,
--     DROP COLUMN IF EXISTS merge_inferred_period_start,
--     DROP COLUMN IF EXISTS merge_target_id,
--     DROP COLUMN IF EXISTS merge_status;
