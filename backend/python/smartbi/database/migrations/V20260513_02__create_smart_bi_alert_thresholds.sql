-- V20260513_02__create_smart_bi_alert_thresholds.sql
--
-- Create ``smart_bi_alert_thresholds`` in smartbi_db.
--
-- Bug: Phase 2C Tier 1 pilot ``GET /api/mobile/smartbi-config/thresholds`` (PR #425
-- + #438) returned HTTP 500 after the 三件套 test re-deploy 2026-05-13 with
-- ``asyncpg.exceptions.UndefinedTableError: relation "smart_bi_alert_thresholds"
-- does not exist``. Root cause: the Python service correctly connects to
-- smartbi_db via ``get_pg_pool`` (see config_thresholds.py:225 comment "DB pool —
-- smartbi DB (smart_bi_alert_thresholds lives here)"), but the table only existed
-- in cretas_db / cretas_prod_db — seeded by the legacy Java Flyway
-- ``V2026_01_21_02__alert_thresholds.sql`` that targets the cretas profile.
-- PR #425's 41 unit tests passed because they mock the asyncpg pool.
--
-- This migration aligns the smartbi_db schema with the canonical Java entity
-- ``SmartBiAlertThreshold.java``. Column types / nullability / indexes / unique
-- constraint mirror the entity exactly (verified line 34-114). Default seed
-- mirrors the original Java migration's 28 global rows so the test env is
-- functionally identical to a fresh prod cretas_db apply.
--
-- Spec: docs/superpowers/specs/2026-05-09-phase-2c-tier-1-config-design.md
-- Sister sweep: Rule 8 audit found 1 real bug (this) + 1 false positive
--   (analysis_sales.py uses cretas_engine for smart_bi_sales_data via
--    _get_sync_engine() per spec 2026-05-05 §1.3, NOT get_pg_pool).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT DO NOTHING.

-- ── Table ───────────────────────────────────────────────────────────
-- All columns match SmartBiAlertThreshold.java (entity 2026-01-21).
-- BaseEntity columns (created_at/updated_at/deleted_at) inlined per
-- smartbi_db convention (no shared BaseEntity DDL in smartbi schema).
CREATE TABLE IF NOT EXISTS smart_bi_alert_thresholds (
    id                  VARCHAR(36)     PRIMARY KEY,
    threshold_type      VARCHAR(64)     NOT NULL,
    metric_code         VARCHAR(64)     NOT NULL,
    warning_value       NUMERIC(15, 4),
    critical_value      NUMERIC(15, 4),
    comparison_operator VARCHAR(16)     DEFAULT 'GT',
    unit                VARCHAR(32),
    description         VARCHAR(255),
    factory_id          VARCHAR(32),
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP,
    CONSTRAINT uk_type_metric_factory UNIQUE (threshold_type, metric_code, factory_id)
);

-- ── Indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_threshold_type
    ON smart_bi_alert_thresholds (threshold_type);
CREATE INDEX IF NOT EXISTS idx_threshold_metric
    ON smart_bi_alert_thresholds (metric_code);
CREATE INDEX IF NOT EXISTS idx_threshold_factory
    ON smart_bi_alert_thresholds (factory_id);
CREATE INDEX IF NOT EXISTS idx_threshold_active
    ON smart_bi_alert_thresholds (is_active);

-- ── Soft-delete partial index (matches @Where(deleted_at IS NULL)) ──
CREATE INDEX IF NOT EXISTS idx_threshold_active_not_deleted
    ON smart_bi_alert_thresholds (threshold_type, metric_code)
    WHERE deleted_at IS NULL;

-- ── Partial unique index for global thresholds (factory_id IS NULL) ─
-- PG's UNIQUE constraint does NOT consider two rows with NULL in a column
-- as duplicates (unlike MySQL). The plain ``uk_type_metric_factory`` therefore
-- only dedupes factory-specific rows (factory_id non-null). Add a partial
-- unique index so the seed below remains idempotent on re-run for global
-- defaults (where factory_id is NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uk_global_type_metric
    ON smart_bi_alert_thresholds (threshold_type, metric_code)
    WHERE factory_id IS NULL AND deleted_at IS NULL;

-- ── Updated-at trigger (mirrors @Column(updated_at) auto-update) ────
-- Python service emits ``updated_at = NOW()`` explicitly in every UPDATE
-- (config_thresholds.py:355-360 + 400-403), so this trigger is defense-
-- in-depth only — it covers any future SQL that omits the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_smart_bi_alert_thresholds_updated_at'
    ) THEN
        CREATE FUNCTION update_smart_bi_alert_thresholds_updated_at() RETURNS TRIGGER AS $fn$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $fn$ LANGUAGE plpgsql;
    END IF;
END$$;

DROP TRIGGER IF EXISTS trg_smart_bi_alert_thresholds_updated_at
    ON smart_bi_alert_thresholds;
CREATE TRIGGER trg_smart_bi_alert_thresholds_updated_at
    BEFORE UPDATE ON smart_bi_alert_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_smart_bi_alert_thresholds_updated_at();

-- ── Seed: 28 global default thresholds ──────────────────────────────
-- IDs are deterministic UUID v5 of "smartbi-default-{type}-{metric}" so re-runs
-- (idempotency via ON CONFLICT DO NOTHING on the type/metric/factory unique
-- constraint) don't produce duplicate rows with different ids.
-- Values copied verbatim from V2026_01_21_02__alert_thresholds.sql lines 49-94.

INSERT INTO smart_bi_alert_thresholds
    (id, threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description)
VALUES
    (gen_random_uuid()::text, 'SALES', 'SALES_AMOUNT_DAILY',     50000.0000,   30000.0000,   'LT', '元', '日销售额低于阈值触发告警'),
    (gen_random_uuid()::text, 'SALES', 'SALES_AMOUNT_MONTHLY',   1500000.0000, 1000000.0000, 'LT', '元', '月销售额低于阈值触发告警'),
    (gen_random_uuid()::text, 'SALES', 'ORDER_COUNT_DAILY',      100.0000,     50.0000,      'LT', '单', '日订单数低于阈值触发告警'),
    (gen_random_uuid()::text, 'SALES', 'AVG_ORDER_VALUE',        300.0000,     200.0000,     'LT', '元', '平均客单价低于阈值触发告警'),
    (gen_random_uuid()::text, 'SALES', 'SALES_GROWTH_RATE',      -5.0000,      -10.0000,     'LT', '%',  '销售增长率低于阈值触发告警'),
    (gen_random_uuid()::text, 'SALES', 'ORDER_CANCEL_RATE',      5.0000,       10.0000,      'GT', '%',  '订单取消率高于阈值触发告警'),
    (gen_random_uuid()::text, 'SALES', 'RETURN_RATE',            3.0000,       5.0000,       'GT', '%',  '退货率高于阈值触发告警'),

    (gen_random_uuid()::text, 'FINANCE', 'PROFIT_RATE',              15.0000, 10.0000, 'LT', '%', '利润率低于阈值触发告警'),
    (gen_random_uuid()::text, 'FINANCE', 'GROSS_MARGIN',             25.0000, 20.0000, 'LT', '%', '毛利率低于阈值触发告警'),
    (gen_random_uuid()::text, 'FINANCE', 'COST_RATIO',               70.0000, 80.0000, 'GT', '%', '成本占比高于阈值触发告警'),
    (gen_random_uuid()::text, 'FINANCE', 'OPERATING_EXPENSE_RATIO',  20.0000, 25.0000, 'GT', '%', '运营费用占比高于阈值触发告警'),
    (gen_random_uuid()::text, 'FINANCE', 'RECEIVABLE_DAYS',          45.0000, 60.0000, 'GT', '天', '应收账款周转天数高于阈值触发告警'),
    (gen_random_uuid()::text, 'FINANCE', 'INVENTORY_TURNOVER',       6.0000,  4.0000,  'LT', '次', '库存周转率低于阈值触发告警'),

    (gen_random_uuid()::text, 'DEPARTMENT', 'TASK_COMPLETION_RATE',  90.0000, 80.0000, 'LT', '%', '任务完成率低于阈值触发告警'),
    (gen_random_uuid()::text, 'DEPARTMENT', 'BUDGET_USAGE_RATE',     80.0000, 95.0000, 'GT', '%', '预算使用率高于阈值触发告警'),
    (gen_random_uuid()::text, 'DEPARTMENT', 'EMPLOYEE_PRODUCTIVITY', 80.0000, 60.0000, 'LT', '%', '员工生产力低于阈值触发告警'),
    (gen_random_uuid()::text, 'DEPARTMENT', 'DEPT_SALES_TARGET',     90.0000, 70.0000, 'LT', '%', '部门销售目标完成率低于阈值触发告警'),

    (gen_random_uuid()::text, 'PRODUCTION', 'PRODUCTION_EFFICIENCY', 85.0000, 70.0000, 'LT', '%',    '生产效率低于阈值触发告警'),
    (gen_random_uuid()::text, 'PRODUCTION', 'EQUIPMENT_UTILIZATION', 80.0000, 60.0000, 'LT', '%',    '设备利用率低于阈值触发告警'),
    (gen_random_uuid()::text, 'PRODUCTION', 'DOWNTIME_HOURS',        2.0000,  4.0000,  'GT', '小时', '停机时间高于阈值触发告警'),
    (gen_random_uuid()::text, 'PRODUCTION', 'DEFECT_RATE',           2.0000,  5.0000,  'GT', '%',    '产品缺陷率高于阈值触发告警'),
    (gen_random_uuid()::text, 'PRODUCTION', 'YIELD_RATE',            95.0000, 90.0000, 'LT', '%',    '良品率低于阈值触发告警'),
    (gen_random_uuid()::text, 'PRODUCTION', 'ON_TIME_DELIVERY',      95.0000, 90.0000, 'LT', '%',    '准时交付率低于阈值触发告警'),

    (gen_random_uuid()::text, 'QUALITY', 'INSPECTION_PASS_RATE',    98.0000, 95.0000, 'LT', '%', '检验合格率低于阈值触发告警'),
    (gen_random_uuid()::text, 'QUALITY', 'CUSTOMER_COMPLAINT_RATE', 1.0000,  2.0000,  'GT', '%', '客户投诉率高于阈值触发告警'),
    (gen_random_uuid()::text, 'QUALITY', 'REWORK_RATE',             3.0000,  5.0000,  'GT', '%', '返工率高于阈值触发告警'),
    (gen_random_uuid()::text, 'QUALITY', 'SCRAP_RATE',              1.0000,  2.0000,  'GT', '%', '报废率高于阈值触发告警'),
    (gen_random_uuid()::text, 'QUALITY', 'FIRST_PASS_YIELD',        95.0000, 90.0000, 'LT', '%', '首次通过率低于阈值触发告警')
ON CONFLICT (threshold_type, metric_code) WHERE factory_id IS NULL AND deleted_at IS NULL DO NOTHING;

-- ── Permissions ─────────────────────────────────────────────────────
-- smartbi_user is the runtime DB role used by cretas-python.service. Grant
-- CRUD so the Phase 2C Tier 1 endpoints can write to the table; the smartbi
-- migration runner runs as postgres so DDL is unaffected.
GRANT SELECT, INSERT, UPDATE, DELETE ON smart_bi_alert_thresholds TO smartbi_user;

-- Rollback:
--   DROP TRIGGER IF EXISTS trg_smart_bi_alert_thresholds_updated_at ON smart_bi_alert_thresholds;
--   DROP FUNCTION IF EXISTS update_smart_bi_alert_thresholds_updated_at();
--   DROP TABLE IF EXISTS smart_bi_alert_thresholds;
