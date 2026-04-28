-- Migration: V20260502_06__outlier_dismissals.sql
CREATE TABLE outlier_dismissals (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    anomaly_date DATE NOT NULL,
    kpi_kind VARCHAR(50) NOT NULL,
    dismissed_by VARCHAR(50) NOT NULL,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- ↓ Reviewer R1: schema 全建, UI 第一版不展示
    reason VARCHAR(50) NULL,                   -- 后续 downselect: holiday/promotion/data_error/inventory_correction/other
    expires_at TIMESTAMPTZ NULL,               -- NULL = 永久 dismiss; 设值 = 临时 dismiss 到期重新触发
    snapshot_value NUMERIC(18,4),              -- dismiss 当时的异常值
    snapshot_q1 NUMERIC(18,4),                 -- dismiss 当时的 IQR Q1
    snapshot_q3 NUMERIC(18,4),                 -- dismiss 当时的 IQR Q3
    snapshot_baseline_source VARCHAR(10),      -- 'self' | 'global'
    notes TEXT NULL,
    UNIQUE (factory_id, anomaly_date, kpi_kind)
);

ALTER TABLE outlier_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlier_dismissals FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON outlier_dismissals FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX idx_outlier_dismissals_factory_kpi
    ON outlier_dismissals (factory_id, kpi_kind, anomaly_date DESC);

CREATE INDEX idx_outlier_dismissals_active
    ON outlier_dismissals (factory_id, kpi_kind)
    WHERE expires_at IS NULL;

COMMENT ON TABLE outlier_dismissals IS
    '餐饮 Phase B-1: admin 标记的 "已确认非异常" 记录, 用于过滤 outlier 列表. RLS FORCE 隔离, 必须 set_config(app.factory_id) inside transaction.';
COMMENT ON COLUMN outlier_dismissals.reason IS
    'Phase B-1 第一版 NULL; 后续 UI 加 downselect: holiday/promotion/data_error/inventory_correction/other';
COMMENT ON COLUMN outlier_dismissals.expires_at IS
    'Phase B-1 第一版 NULL (永久 dismiss); 后续 UI 加临时 dismiss (e.g. 节假日 7 天后重新触发)';
COMMENT ON COLUMN outlier_dismissals.snapshot_value IS
    'dismiss 当时的异常值, 后续 cache 失效阈值变了让 admin 能回看 "我当时为什么 dismiss"';
