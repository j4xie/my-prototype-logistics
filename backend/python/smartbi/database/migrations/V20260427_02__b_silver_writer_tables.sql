-- 数据织网 Sub-Project B Day 8-9 (Apr 27 2026): B-stage Silver writer target tables.
--
-- Per 03-B v1.2 spec §4.1-§4.4. Creates 7 tables (all FORCE RLS + tenant_isolation):
--   1. agg_product_period          (§4.1) — ProductSummaryWriter target
--   2. dim_review_summary          (§4.2) — ReviewWriter aggregate
--   3. fact_review_event           (§4.2) — ReviewWriter detail rows
--   4. dim_finance_subject         (§4.3) — FinanceWriter normalized subjects
--   5. fact_finance_voucher        (§4.3) — FinanceWriter detail rows
--   6. fact_inventory_snapshot     (§4.4) — InventoryWriter target
--   7. dim_ingredient_threshold    (§4.4) — admin-maintained thresholds
--
-- All tables idempotent via CREATE TABLE/INDEX IF NOT EXISTS + DROP POLICY IF EXISTS.

-- =============================================================================
-- 1. agg_product_period
-- =============================================================================
-- NOTE: natural-key uniqueness uses an expression-based unique INDEX (not a
-- table-level UNIQUE constraint) because period_start may be NULL while we
-- still need ON CONFLICT DO UPDATE to fire (PG treats NULL as not-equal-to-NULL
-- in standard UNIQUE constraints). PG 13 doesn't support NULLS NOT DISTINCT
-- (PG 15+), so COALESCE to a sentinel date achieves the same effect.
CREATE TABLE IF NOT EXISTS agg_product_period (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    upload_id BIGINT REFERENCES smart_bi_pg_excel_uploads(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES dim_product(product_id),
    store_id BIGINT REFERENCES dim_store(store_id),
    period_start DATE,
    period_end DATE,
    qty_sold NUMERIC(15,4),
    revenue NUMERIC(15,2),
    avg_unit_price NUMERIC(10,2),
    refund_qty NUMERIC(15,4) DEFAULT 0,
    refund_amount NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_natkey
    ON agg_product_period (
        factory_id, upload_id, product_id, store_id,
        COALESCE(period_start, DATE '0001-01-01')
    );

ALTER TABLE agg_product_period ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_product_period FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agg_product_period;
CREATE POLICY tenant_isolation ON agg_product_period
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX IF NOT EXISTS idx_app_factory_period
    ON agg_product_period (factory_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_app_factory_product
    ON agg_product_period (factory_id, product_id);

-- =============================================================================
-- 2. dim_review_summary
-- =============================================================================
CREATE TABLE IF NOT EXISTS dim_review_summary (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    product_id BIGINT REFERENCES dim_product(product_id) ON DELETE SET NULL,
    store_id BIGINT REFERENCES dim_store(store_id) ON DELETE SET NULL,
    period_start DATE,
    period_end DATE,
    avg_rating NUMERIC(3,2),
    total_count INT,
    positive_count INT,
    negative_count INT,
    top_keywords JSONB,
    unmatched_product_names JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE dim_review_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_review_summary FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dim_review_summary;
CREATE POLICY tenant_isolation ON dim_review_summary
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX IF NOT EXISTS idx_drs_factory_period
    ON dim_review_summary (factory_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_drs_factory_product
    ON dim_review_summary (factory_id, product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drs_factory_store
    ON dim_review_summary (factory_id, store_id) WHERE store_id IS NOT NULL;

-- =============================================================================
-- 3. fact_review_event
-- =============================================================================
CREATE TABLE IF NOT EXISTS fact_review_event (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    upload_id BIGINT REFERENCES smart_bi_pg_excel_uploads(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES dim_product(product_id) ON DELETE SET NULL,
    store_id BIGINT REFERENCES dim_store(store_id) ON DELETE SET NULL,
    rating NUMERIC(3,2),
    review_text TEXT,
    review_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE fact_review_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_review_event FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_review_event;
CREATE POLICY tenant_isolation ON fact_review_event
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX IF NOT EXISTS idx_fre_factory_date
    ON fact_review_event (factory_id, review_date);
CREATE INDEX IF NOT EXISTS idx_fre_factory_product
    ON fact_review_event (factory_id, product_id) WHERE product_id IS NOT NULL;

-- =============================================================================
-- 4. dim_finance_subject
-- =============================================================================
CREATE TABLE IF NOT EXISTS dim_finance_subject (
    subject_id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    normalized_name VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    parent_subject_id BIGINT REFERENCES dim_finance_subject(subject_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(factory_id, normalized_name)
);

ALTER TABLE dim_finance_subject ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_finance_subject FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dim_finance_subject;
CREATE POLICY tenant_isolation ON dim_finance_subject
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- =============================================================================
-- 5. fact_finance_voucher
-- =============================================================================
CREATE TABLE IF NOT EXISTS fact_finance_voucher (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    upload_id BIGINT REFERENCES smart_bi_pg_excel_uploads(id) ON DELETE CASCADE,
    voucher_no VARCHAR(100),
    voucher_date DATE,
    subject_id BIGINT REFERENCES dim_finance_subject(subject_id) ON DELETE SET NULL,
    debit_amount NUMERIC(15,2) DEFAULT 0,
    credit_amount NUMERIC(15,2) DEFAULT 0,
    description TEXT,
    store_id BIGINT REFERENCES dim_store(store_id) ON DELETE SET NULL,
    source_row_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(factory_id, upload_id, source_row_hash)
);

ALTER TABLE fact_finance_voucher ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_finance_voucher FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_finance_voucher;
CREATE POLICY tenant_isolation ON fact_finance_voucher
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX IF NOT EXISTS idx_ffv_factory_date
    ON fact_finance_voucher (factory_id, voucher_date);
CREATE INDEX IF NOT EXISTS idx_ffv_factory_subject
    ON fact_finance_voucher (factory_id, subject_id);

-- =============================================================================
-- 6. fact_inventory_snapshot
-- =============================================================================
CREATE TABLE IF NOT EXISTS fact_inventory_snapshot (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    upload_id BIGINT REFERENCES smart_bi_pg_excel_uploads(id) ON DELETE CASCADE,
    ingredient_id BIGINT REFERENCES dim_ingredient(ingredient_id) ON DELETE SET NULL,
    store_id BIGINT REFERENCES dim_store(store_id) ON DELETE SET NULL,
    snapshot_date DATE NOT NULL,
    stock_qty NUMERIC(15,4),
    unit VARCHAR(20),
    safe_stock_qty NUMERIC(15,4),
    reorder_point NUMERIC(15,4),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(factory_id, ingredient_id, store_id, snapshot_date)
);

ALTER TABLE fact_inventory_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_inventory_snapshot FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_inventory_snapshot;
CREATE POLICY tenant_isolation ON fact_inventory_snapshot
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX IF NOT EXISTS idx_fis_factory_date
    ON fact_inventory_snapshot (factory_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_fis_factory_ingredient
    ON fact_inventory_snapshot (factory_id, ingredient_id);

-- =============================================================================
-- 7. dim_ingredient_threshold
-- =============================================================================
CREATE TABLE IF NOT EXISTS dim_ingredient_threshold (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    ingredient_id BIGINT REFERENCES dim_ingredient(ingredient_id) ON DELETE CASCADE,
    store_id BIGINT REFERENCES dim_store(store_id) ON DELETE CASCADE,
    safe_stock_qty NUMERIC(15,4),
    reorder_point NUMERIC(15,4),
    max_stock_qty NUMERIC(15,4),
    unit VARCHAR(20),
    notes TEXT,
    set_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(factory_id, ingredient_id, store_id)
);

ALTER TABLE dim_ingredient_threshold ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_ingredient_threshold FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dim_ingredient_threshold;
CREATE POLICY tenant_isolation ON dim_ingredient_threshold
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX IF NOT EXISTS idx_dit_factory_ingredient
    ON dim_ingredient_threshold (factory_id, ingredient_id);

-- Rollback (in reverse FK order):
--   DROP TABLE IF EXISTS dim_ingredient_threshold;
--   DROP TABLE IF EXISTS fact_inventory_snapshot;
--   DROP TABLE IF EXISTS fact_finance_voucher;
--   DROP TABLE IF EXISTS dim_finance_subject;
--   DROP TABLE IF EXISTS fact_review_event;
--   DROP TABLE IF EXISTS dim_review_summary;
--   DROP TABLE IF EXISTS agg_product_period;
