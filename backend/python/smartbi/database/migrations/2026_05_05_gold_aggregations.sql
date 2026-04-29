-- Gold aggregation tables — durable, read-optimized, updated by materializer.
-- Week 3 Day 1 of Unified Data Layer v1 spec (§4.1).
--
-- Three tables, one per hot downstream read pattern:
--   agg_daily    — daily sales rollup per (factory, date, store)
--   agg_product  — monthly product performance per (factory, product, month)
--   agg_channel  — daily payment channel breakdown per (factory, channel, date)
--
-- All three are kept in sync by the Gold materializer (smartbi/gold/
-- materializer.py, Week 3 Day 2). Each has:
--   * `version` BIGINT — increments on re-materialize. Reader contract per
--     spec §4.1 is "pick max committed"; with a PRIMARY KEY on the grain
--     there's only one row per key, so readers always see the latest
--     value (PG row-level atomic upsert). The version column exists for
--     audit / debugging — you can tell from version=1 vs version=17
--     whether a row has been recomputed and how often.
--   * `computed_at` TIMESTAMP — wall-clock of last recomputation.
--   * Tenant RLS pattern (ENABLE + FORCE + tenant_isolation policy).
--
-- Write pattern (used by materializer):
--   INSERT ... ON CONFLICT (<grain_cols>) DO UPDATE SET
--     <metric>   = EXCLUDED.<metric>,
--     version    = agg_*.version + 1,
--     computed_at = NOW()
--
-- Read pattern (used by downstream modules Week 4+):
--   SELECT ... FROM agg_daily WHERE factory_id = current_setting('app.factory_id')
--                              AND date BETWEEN $1 AND $2;
-- RLS filters by tenant automatically.
--
-- These tables are NOT the same as the existing per-upload chart cache
-- (SmartBiPgAnalysisResult, persisted by materialized_analytics/). Both
-- live under the "Gold" conceptual layer per spec §1.1, but the existing
-- code remains unchanged — this migration is additive.


-- ── agg_daily: daily sales by store ────────────────────────────────
CREATE TABLE IF NOT EXISTS agg_daily (
    factory_id       VARCHAR(50) NOT NULL,
    date             DATE NOT NULL,
    store_id         BIGINT NOT NULL,
    gross_amount     NUMERIC(18,2),
    discount_amount  NUMERIC(18,2),
    net_amount       NUMERIC(18,2),
    actual_receive   NUMERIC(18,2),
    bill_count       INT,
    customer_count   INT,
    item_count       INT,
    version          BIGINT NOT NULL DEFAULT 1,
    computed_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, date, store_id),
    CONSTRAINT fk_agg_daily_store FOREIGN KEY (store_id)
        REFERENCES dim_store (store_id) ON DELETE CASCADE
);
ALTER TABLE agg_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_daily FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agg_daily;
CREATE POLICY tenant_isolation ON agg_daily FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
-- Hot path: "total daily sales across all stores" (KPI dashboard).
CREATE INDEX IF NOT EXISTS idx_agg_daily_factory_date
    ON agg_daily (factory_id, date);


-- ── agg_product: monthly product performance ──────────────────────
-- Month bucket = first day of the month (truncation by date_trunc).
CREATE TABLE IF NOT EXISTS agg_product (
    factory_id  VARCHAR(50) NOT NULL,
    product_id  BIGINT NOT NULL,
    month       DATE NOT NULL,
    qty_sold    NUMERIC(18,3),
    revenue     NUMERIC(18,2),
    bill_count  INT,
    version     BIGINT NOT NULL DEFAULT 1,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, product_id, month),
    CONSTRAINT fk_agg_product_product FOREIGN KEY (product_id)
        REFERENCES dim_product (product_id) ON DELETE CASCADE,
    CONSTRAINT chk_agg_product_month_is_first_of_month
        CHECK (month = DATE_TRUNC('month', month)::DATE)
);
ALTER TABLE agg_product ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_product FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agg_product;
CREATE POLICY tenant_isolation ON agg_product FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
-- Hot path: "top 10 products this month" — revenue desc within (factory, month).
CREATE INDEX IF NOT EXISTS idx_agg_product_factory_month_revenue
    ON agg_product (factory_id, month, revenue DESC);


-- ── agg_channel: daily payment channel breakdown ───────────────────
CREATE TABLE IF NOT EXISTS agg_channel (
    factory_id  VARCHAR(50) NOT NULL,
    channel_id  BIGINT NOT NULL,
    date        DATE NOT NULL,
    amount      NUMERIC(18,2),
    bill_count  INT,
    version     BIGINT NOT NULL DEFAULT 1,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, channel_id, date),
    CONSTRAINT fk_agg_channel_channel FOREIGN KEY (channel_id)
        REFERENCES dim_payment_channel (channel_id) ON DELETE CASCADE
);
ALTER TABLE agg_channel ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_channel FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agg_channel;
CREATE POLICY tenant_isolation ON agg_channel FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
-- Hot path: "channel breakdown for this date" — amount desc within (factory, date).
CREATE INDEX IF NOT EXISTS idx_agg_channel_factory_date_amount
    ON agg_channel (factory_id, date, amount DESC);
