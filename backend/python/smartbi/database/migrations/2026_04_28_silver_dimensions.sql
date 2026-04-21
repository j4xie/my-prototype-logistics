-- Silver dimensions — shared schema used by every domain.
-- Week 2 Day 1 of Unified Data Layer v1 spec (§2.1).
--
-- v1.1 scope (qhj restaurant) ships FIVE tables:
--   dim_store, dim_product, dim_staff, dim_payment_channel, dim_discount
-- plus one view:
--   dim_date  (not materialized — view over generate_series)
--
-- Deferred to v1.2: dim_store_alias (needs 美团 API source to be useful;
-- qhj Excel has no platform-level shop_id to alias).
-- Deferred to v2: dim_customer (qhj has no customer_id; 点评/美团 will).
--
-- Every physical table:
--   - BIGSERIAL surrogate key (id)
--   - factory_id VARCHAR(50) NOT NULL (tenant scope)
--   - created_at / updated_at TIMESTAMP with NOW() default + touch trigger
--   - ENABLE + FORCE ROW LEVEL SECURITY (owner follows policy too)
--   - Policy: factory_id = current_setting('app.factory_id', true)
--     — unset tenant → NULL match → 0 rows (safe default per Week 1 Day 2)
--
-- Caller UPSERT pattern (documented per table but identical shape):
--   INSERT INTO <dim> (factory_id, name, ...)
--   VALUES ($1, $2, ...)
--   ON CONFLICT (factory_id, <unique_cols>)
--     DO UPDATE SET updated_at = NOW(),
--                    <opt: refresh non-key fields like category, brand>
--   RETURNING <id>;
-- The DO UPDATE (not DO NOTHING) is load-bearing — RETURNING is only emitted
-- when a row was INSERTed or UPDATEd, not on NOTHING, so NOTHING would
-- require a fallback SELECT and lose concurrency safety.


-- ── Shared touch trigger function (reused by all dim tables) ──────
-- field_registry already defined `field_registry_touch()`; we create a
-- generic `silver_touch_updated_at()` so naming stays clean.
CREATE OR REPLACE FUNCTION silver_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── dim_store ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dim_store (
    store_id    BIGSERIAL PRIMARY KEY,
    factory_id  VARCHAR(50) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    brand       VARCHAR(100),
    city        VARCHAR(50),
    province    VARCHAR(50),
    region      VARCHAR(50),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_dim_store_factory_name UNIQUE (factory_id, name)
);
ALTER TABLE dim_store ENABLE  ROW LEVEL SECURITY;
ALTER TABLE dim_store FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dim_store;
CREATE POLICY tenant_isolation ON dim_store FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_dim_store_touch ON dim_store;
CREATE TRIGGER trg_dim_store_touch BEFORE UPDATE ON dim_store
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();


-- ── dim_product ────────────────────────────────────────────────────
-- normalized_name is the UPSERT key; populated by alias_normalizer.py
-- (existing service, reused). Two raw names that normalize to the same
-- string (e.g. "宫保鸡丁" and "宮保雞丁" after trad→simp + whitespace
-- collapse) become one product row.
CREATE TABLE IF NOT EXISTS dim_product (
    product_id       BIGSERIAL PRIMARY KEY,
    factory_id       VARCHAR(50) NOT NULL,
    name             VARCHAR(500) NOT NULL,
    normalized_name  VARCHAR(500) NOT NULL,
    category         VARCHAR(100),
    sub_category     VARCHAR(100),
    sku_code         VARCHAR(100),
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_dim_product_factory_normname UNIQUE (factory_id, normalized_name)
);
ALTER TABLE dim_product ENABLE  ROW LEVEL SECURITY;
ALTER TABLE dim_product FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dim_product;
CREATE POLICY tenant_isolation ON dim_product FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_dim_product_touch ON dim_product;
CREATE TRIGGER trg_dim_product_touch BEFORE UPDATE ON dim_product
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();
-- Lookup by category (admin UI "show restaurant菜单 category distribution"):
CREATE INDEX IF NOT EXISTS idx_dim_product_factory_category
    ON dim_product (factory_id, category);


-- ── dim_staff ──────────────────────────────────────────────────────
-- store_id is part of the UNIQUE so two stores can each have a "王小明".
-- NULL store_id means cross-store / head-office role; use
-- COALESCE(store_id, 0) in the unique if NULL-breaks-uniqueness bites.
CREATE TABLE IF NOT EXISTS dim_staff (
    staff_id    BIGSERIAL PRIMARY KEY,
    factory_id  VARCHAR(50) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    role        VARCHAR(50),
    store_id    BIGINT,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_dim_staff_store FOREIGN KEY (store_id)
        REFERENCES dim_store (store_id) ON DELETE SET NULL,
    CONSTRAINT uq_dim_staff_factory_name_store UNIQUE (factory_id, name, store_id)
);
ALTER TABLE dim_staff ENABLE  ROW LEVEL SECURITY;
ALTER TABLE dim_staff FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dim_staff;
CREATE POLICY tenant_isolation ON dim_staff FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_dim_staff_touch ON dim_staff;
CREATE TRIGGER trg_dim_staff_touch BEFORE UPDATE ON dim_staff
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();


-- ── dim_payment_channel ────────────────────────────────────────────
-- category: "online" (美团/抖音/饿了么) / "offline" (现金/POS刷卡) /
-- "voucher" (代金券抵扣 — although per spec these go to dim_discount).
CREATE TABLE IF NOT EXISTS dim_payment_channel (
    channel_id  BIGSERIAL PRIMARY KEY,
    factory_id  VARCHAR(50) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(50),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_dim_payment_channel_factory_name UNIQUE (factory_id, name)
);
ALTER TABLE dim_payment_channel ENABLE  ROW LEVEL SECURITY;
ALTER TABLE dim_payment_channel FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dim_payment_channel;
CREATE POLICY tenant_isolation ON dim_payment_channel FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_dim_payment_channel_touch ON dim_payment_channel;
CREATE TRIGGER trg_dim_payment_channel_touch BEFORE UPDATE ON dim_payment_channel
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();


-- ── dim_discount ───────────────────────────────────────────────────
-- Discounts get richer metadata than payment channels — face/actual price,
-- platform, validity window. parsed_ok=false rows come from rule-based
-- name→fields extraction failing; admin UI (Week 4) fills in manually.
CREATE TABLE IF NOT EXISTS dim_discount (
    discount_id    BIGSERIAL PRIMARY KEY,
    factory_id     VARCHAR(50) NOT NULL,
    name           VARCHAR(200) NOT NULL,
    discount_type  VARCHAR(50),
    platform       VARCHAR(50),
    face_value     NUMERIC(18,2),
    actual_price   NUMERIC(18,2),
    start_date     DATE,
    end_date       DATE,
    parsed_ok      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMP DEFAULT NOW(),
    updated_at     TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_dim_discount_factory_name UNIQUE (factory_id, name)
);
ALTER TABLE dim_discount ENABLE  ROW LEVEL SECURITY;
ALTER TABLE dim_discount FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dim_discount;
CREATE POLICY tenant_isolation ON dim_discount FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_dim_discount_touch ON dim_discount;
CREATE TRIGGER trg_dim_discount_touch BEFORE UPDATE ON dim_discount
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();
-- For admin UI "show discounts needing manual review":
CREATE INDEX IF NOT EXISTS idx_dim_discount_unparsed
    ON dim_discount (factory_id, updated_at DESC)
    WHERE parsed_ok = FALSE;


-- ── dim_date (view) ────────────────────────────────────────────────
-- Not a table — materializing 20 years of dates is wasteful. View over
-- generate_series. Callers JOIN by calendar_date. No RLS needed (no
-- tenant scope — dates are universal).
CREATE OR REPLACE VIEW dim_date AS
SELECT d::DATE                                    AS calendar_date,
       EXTRACT(YEAR  FROM d)::INT                 AS year,
       EXTRACT(QUARTER FROM d)::INT               AS quarter,
       EXTRACT(MONTH FROM d)::INT                 AS month,
       EXTRACT(WEEK FROM d)::INT                  AS iso_week,  -- PG's WEEK is ISO 8601 week
       EXTRACT(DAY   FROM d)::INT                 AS day_of_month,
       EXTRACT(DOW   FROM d)::INT                 AS day_of_week,
       (EXTRACT(DOW FROM d) IN (0,6))             AS is_weekend,
       TO_CHAR(d, 'YYYY-MM')                      AS year_month,
       TO_CHAR(d, 'YYYY-"Q"Q')                    AS year_quarter
  FROM generate_series('2020-01-01'::DATE, '2030-12-31'::DATE, '1 day'::INTERVAL) d;
