-- smart_bi_datasource: 统一数据源注册表补齐 (Apr 16 2026)
--
-- 背景:
--   表 smart_bi_datasource 已存在, 缺 code / refresh_interval / linked_upload_id 列.
--   前端 DataSourceConfigView 期望 code + refreshInterval; 上传 Excel 同步需要 linked_upload_id.
--
-- 本迁移:
--   1. ALTER 表加 code / refresh_interval / linked_upload_id 三个列
--   2. 索引 linked_upload_id (按 uploadId 反向查数据源行)
--   3. 同 factory 内 code 唯一 (软删除不占)

ALTER TABLE smart_bi_datasource
    ADD COLUMN IF NOT EXISTS code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS refresh_interval INTEGER,
    ADD COLUMN IF NOT EXISTS linked_upload_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_datasource_linked_upload
    ON smart_bi_datasource(linked_upload_id)
    WHERE linked_upload_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_datasource_factory_code
    ON smart_bi_datasource(factory_id, code)
    WHERE deleted_at IS NULL AND code IS NOT NULL;
