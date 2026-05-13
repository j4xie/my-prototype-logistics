-- QHJ 收入管理报表 — 审计日志表
--
-- Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §6.9
--
-- 记录每次生成: 操作人 / 入参 / 缓存命中 / 文件大小 / 耗时 / Gold 数据新鲜度.
-- 用途:
--   1. 客户争议时反查 ("我上周下的报表数据不对" → 查 params_snapshot + gold_materialized_at)
--   2. /download/{cache_key} cache miss 时反查 params 重新生成
--   3. /audit-log endpoint 暴露最近 20 条 (per-factory RLS)

CREATE TABLE IF NOT EXISTS smart_bi_report_audit_log (
    id                    BIGSERIAL PRIMARY KEY,
    factory_id            VARCHAR(50) NOT NULL,
    report_type           VARCHAR(50) NOT NULL,    -- e.g. 'qhj_revenue_v1'
    generated_by          VARCHAR(100) NOT NULL,   -- JWT sub / user_id
    generated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    params_snapshot       JSONB NOT NULL,          -- full input params (store_ids, dates, meal_periods, include_yoy)
    params_hash           VARCHAR(64) NOT NULL,    -- sha256(params_snapshot)
    cache_key             VARCHAR(255),            -- Redis cache key for trace
    cache_hit             BOOLEAN NOT NULL DEFAULT FALSE,
    file_size_bytes       INT,
    duration_ms           INT,
    status                VARCHAR(20) NOT NULL,    -- 'ok' / 'error'
    error_message         TEXT,
    gold_materialized_at  TIMESTAMP                -- 数据新鲜度 (= Gold table MAX(computed_at) for the range)
);

-- RLS — per-factory isolation, 跟其他 fact/agg 表同 pattern.
ALTER TABLE smart_bi_report_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_report_audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON smart_bi_report_audit_log;
CREATE POLICY tenant_isolation ON smart_bi_report_audit_log FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- 主查询: /audit-log endpoint — 最近 N 条 per factory.
CREATE INDEX IF NOT EXISTS idx_audit_log_factory_generated
  ON smart_bi_report_audit_log (factory_id, generated_at DESC);

-- 反查 cache miss → 同 params_hash → params_snapshot 重新生成.
CREATE INDEX IF NOT EXISTS idx_audit_log_params_hash
  ON smart_bi_report_audit_log (factory_id, params_hash);

COMMENT ON TABLE smart_bi_report_audit_log IS
  'Per-generation audit trail for SmartBI reports (qhj_revenue_v1 + future). '
  'RLS-isolated; written by /generate + /prepare + /download endpoints. '
  'Added 2026-05-13 for QHJ revenue report. '
  'Phase 2: extend with quota tracking / approval workflow if intent sensitivity >= MEDIUM.';
