-- QHJ 收入管理报表 — meal_period 列 + 新 Gold 聚合表
--
-- Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §6.6
-- Sister migrations: V20260513_02 (upload dedup), V20260513_03 (audit log)
-- Java side: backend/java/cretas-api/src/main/resources/db/flyway/V20260513_01__revenue_report_intent.sql
--
-- 数据流: fact_pos_transaction (Silver, 已存在)
--   → materialize_daily_order_type_meal() (新增, 见 §6.7)
--   → agg_daily_order_type_meal (本表, 新增 Gold)

-- ============================================================
-- 1. meal_period 列 (午市/晚市/下午茶等; bill-level grain)
-- ============================================================
ALTER TABLE fact_pos_transaction
  ADD COLUMN IF NOT EXISTS meal_period VARCHAR(50);

-- CHECK constraint 接受所有现实出现的值 (writer 端 .strip() 防尾空格)
ALTER TABLE fact_pos_transaction
  DROP CONSTRAINT IF EXISTS chk_meal_period;
ALTER TABLE fact_pos_transaction
  ADD CONSTRAINT chk_meal_period
    CHECK (meal_period IS NULL OR meal_period IN
      ('早餐','午餐','下午茶','晚餐','其他','午市','晚市','未分类'));

COMMENT ON COLUMN fact_pos_transaction.meal_period IS
  '班次/市段: 午市/晚市/下午茶等. 由 bill_flow_writer / daily_summary_writer / meal_split_writer 写入时 .strip(). LLM 输入由 Java MealPeriodNormalizer 内化, Python 层被动消费.';

-- ============================================================
-- 2. agg_daily_order_type_meal Gold 聚合表
-- PK: (factory_id, date, store_id, order_type, meal_period)
-- 物化: materialize_daily_order_type_meal() in materializer.py
-- ============================================================
CREATE TABLE IF NOT EXISTS agg_daily_order_type_meal (
    factory_id      VARCHAR(50) NOT NULL,
    date            DATE        NOT NULL,
    store_id        BIGINT      NOT NULL,
    order_type      VARCHAR(50) NOT NULL DEFAULT '未分类',
    meal_period     VARCHAR(50) NOT NULL DEFAULT '未分类',
    gross_amount    NUMERIC(18,2),
    actual_receive  NUMERIC(18,2),
    bill_count      INT,
    customer_count  INT,
    version         BIGINT      NOT NULL DEFAULT 1,
    computed_at     TIMESTAMP   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, date, store_id, order_type, meal_period),
    CONSTRAINT fk_agg_daily_omt_store
      FOREIGN KEY (store_id) REFERENCES dim_store(store_id) ON DELETE CASCADE
);

-- RLS — 跟项目其他 fact/agg 表同 pattern
ALTER TABLE agg_daily_order_type_meal ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_daily_order_type_meal FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON agg_daily_order_type_meal;
CREATE POLICY tenant_isolation ON agg_daily_order_type_meal FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- 主查询索引: WHERE factory_id=? AND date BETWEEN ? AND ? GROUP BY store_id, order_type, meal_period
CREATE INDEX IF NOT EXISTS idx_agg_daily_omt_factory_date_store_meal
  ON agg_daily_order_type_meal (factory_id, date, store_id, meal_period);

COMMENT ON TABLE agg_daily_order_type_meal IS
  'Gold layer: daily revenue aggregated by (store × order_type × meal_period). '
  'Source: fact_pos_transaction. '
  'Materializer: materialize_daily_order_type_meal(factory_id, date_min, date_max). '
  'Cache invalidation signal: computed_at (used by /prepare cache_key). '
  'Added 2026-05-13 for QHJ revenue report (R_QINGHUAJIAO_REAL).';
