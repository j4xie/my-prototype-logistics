-- P1-8 研发样品追踪记录独立 table (v1 §2.1.3 客户会议提到追踪记录)
--
-- 之前用 product_samples.progress_notes TEXT (JSON array) 存记录,
-- 本迁移建独立 table 便于按时间查询/审计/导出. 老字段保留作向后兼容 fallback.
--
-- 数据迁移: 本迁移仅建表, 不自动迁移老数据. Service 层新写入走新 table,
-- 读取优先新 table, 没有则 fall back 到 progress_notes JSON. 逐步迁移模式.

CREATE TABLE IF NOT EXISTS product_sample_tracking_records (
    id                  VARCHAR(64)  PRIMARY KEY,
    factory_id          VARCHAR(64)  NOT NULL,
    sample_id           VARCHAR(191) NOT NULL,
    recorded_at         TIMESTAMP    NOT NULL,
    content             TEXT,
    attachment_url      VARCHAR(500),
    recorded_by         BIGINT,
    recorded_by_name    VARCHAR(100),
    created_at          TIMESTAMP    DEFAULT NOW(),
    updated_at          TIMESTAMP    DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pstr_sample ON product_sample_tracking_records(sample_id);
CREATE INDEX IF NOT EXISTS idx_pstr_sample_date ON product_sample_tracking_records(sample_id, recorded_at);

COMMENT ON TABLE product_sample_tracking_records IS
    '研发样品追踪记录 (P1-8). 独立表, 老 product_samples.progress_notes JSON 保留作向后兼容.';
