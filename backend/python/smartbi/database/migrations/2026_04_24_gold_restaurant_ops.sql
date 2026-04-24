-- Gold aggregation tables for restaurant daily operations (Phase 3 of Plan C).
-- Built on top of fact_restaurant_* Silver tables from 2026_04_24_silver_restaurant_ops.sql.
--
-- Design: ONE unified agg table keyed by (factory, date, kpi_kind, dim_value_id).
-- This EAV-shaped design is flexible enough to serve all 4 daily modules without
-- creating 4 separate agg tables, and simple enough that the materializer
-- is just 4 INSERT ... SELECT queries with different GROUP BYs.
--
-- kpi_kind values (extensible):
--   'requisition_qty'     — daily requisition quantity per ingredient
--   'requisition_cost'    — daily requisition estimated cost per ingredient
--   'wastage_qty'         — daily wastage quantity per ingredient
--   'wastage_cost'        — daily wastage estimated cost per type
--   'stocktaking_diff_qty' — daily stocktaking difference per ingredient
--   'stocktaking_diff_cost' — daily stocktaking loss value per ingredient
--   'recipe_line_count'   — count of active recipe lines per product (not dated)
--
-- dim_value_id references dim_ingredient.ingredient_id or dim_product.product_id
-- depending on kpi_kind — the materializer owns this contract, readers use
-- templates that know which dim to join.
--
-- For "daily totals" (no dimension breakdown), a parallel table agg_restaurant_daily_totals
-- stores single-value per-day scalars (much faster than SUM over EAV table).


-- ── agg_restaurant_daily_ops: EAV-style per-ingredient/type per-day metric ──
-- Grain: at most one row per (factory, date, kpi_kind, dim_value_id_or_0, dim_value_str_or_'').
-- Postgres can't take expressions inside PRIMARY KEY, so we normalize nulls
-- to 0 / '' by setting NOT NULL + DEFAULTs and use a normal composite PK.
CREATE TABLE IF NOT EXISTS agg_restaurant_daily_ops (
    factory_id    VARCHAR(50) NOT NULL,
    date          DATE        NOT NULL,
    kpi_kind      VARCHAR(50) NOT NULL,
    -- Use 0 as the "unset" sentinel for BIGINT. ingredient_id / product_id are
    -- always > 0 (BIGSERIAL starts at 1), so 0 never collides with real data.
    dim_value_id  BIGINT       NOT NULL DEFAULT 0,
    -- Use '' as "unset" for VARCHAR. real category strings are never empty.
    dim_value_str VARCHAR(100) NOT NULL DEFAULT '',
    value_num     NUMERIC(18,4),
    version       BIGINT       NOT NULL DEFAULT 1,
    computed_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, date, kpi_kind, dim_value_id, dim_value_str)
);
ALTER TABLE agg_restaurant_daily_ops ENABLE  ROW LEVEL SECURITY;
ALTER TABLE agg_restaurant_daily_ops FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agg_restaurant_daily_ops;
CREATE POLICY tenant_isolation ON agg_restaurant_daily_ops FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
-- Trend reads (factory + date range + kpi_kind): most queries pick one kpi at a time
CREATE INDEX IF NOT EXISTS idx_agg_rest_ops_factory_date_kind
    ON agg_restaurant_daily_ops (factory_id, date, kpi_kind);
-- Ranking reads (top N by dim_value): index on (factory, kpi_kind, dim_value_id)
CREATE INDEX IF NOT EXISTS idx_agg_rest_ops_factory_kind_dim
    ON agg_restaurant_daily_ops (factory_id, kpi_kind, dim_value_id)
    WHERE dim_value_id IS NOT NULL;


-- ── agg_restaurant_daily_totals: per-factory per-day single scalars ──
-- Faster than SUM over EAV table for "total requisition cost this week".
CREATE TABLE IF NOT EXISTS agg_restaurant_daily_totals (
    factory_id            VARCHAR(50) NOT NULL,
    date                  DATE        NOT NULL,
    requisition_count     INT,
    requisition_qty_total NUMERIC(14,4),
    requisition_cost_total NUMERIC(14,2),
    wastage_count         INT,
    wastage_qty_total     NUMERIC(14,4),
    wastage_cost_total    NUMERIC(14,2),
    stocktaking_count     INT,
    stocktaking_shortage_total NUMERIC(14,4),  -- abs(sum(neg difference))
    stocktaking_surplus_total  NUMERIC(14,4),  -- sum(pos difference)
    version               BIGINT    NOT NULL DEFAULT 1,
    computed_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, date)
);
ALTER TABLE agg_restaurant_daily_totals ENABLE  ROW LEVEL SECURITY;
ALTER TABLE agg_restaurant_daily_totals FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agg_restaurant_daily_totals;
CREATE POLICY tenant_isolation ON agg_restaurant_daily_totals FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
CREATE INDEX IF NOT EXISTS idx_agg_rest_totals_factory_date
    ON agg_restaurant_daily_totals (factory_id, date DESC);


-- ── agg_restaurant_product_cost: food cost per dish ──────────────────
-- Computed by rolling up fact_restaurant_recipe_line ×
-- dim_ingredient.unit_price. Cross-join with fact_pos_transaction enables
-- true profit margin: sold price - food_cost = gross profit.
-- NOT time-varying (unit prices change over time; we snapshot "current"),
-- recomputed weekly by the materializer.
CREATE TABLE IF NOT EXISTS agg_restaurant_product_cost (
    factory_id        VARCHAR(50) NOT NULL,
    product_id        BIGINT      NOT NULL,
    food_cost         NUMERIC(14,4),              -- SUM(standard_qty × ingredient.unit_price)
    main_ingredient_id BIGINT,                    -- for quick lookup
    ingredient_count  INT,                        -- number of ingredients in recipe
    has_price_data    BOOLEAN DEFAULT FALSE,      -- FALSE if any ingredient has no unit_price
    version           BIGINT    NOT NULL DEFAULT 1,
    computed_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, product_id)
);
ALTER TABLE agg_restaurant_product_cost ENABLE  ROW LEVEL SECURITY;
ALTER TABLE agg_restaurant_product_cost FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agg_restaurant_product_cost;
CREATE POLICY tenant_isolation ON agg_restaurant_product_cost FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));


-- Rollback:
--   DROP TABLE IF EXISTS agg_restaurant_product_cost;
--   DROP TABLE IF EXISTS agg_restaurant_daily_totals;
--   DROP TABLE IF EXISTS agg_restaurant_daily_ops;
