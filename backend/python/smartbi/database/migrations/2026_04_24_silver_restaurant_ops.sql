-- Silver schema for restaurant daily operations (Phase 1 of Plan C).
-- Sources: cretas_db.raw_material_types (via ETL) + cretas_db.material_requisitions
--                                                   + cretas_db.wastage_records
--                                                   + cretas_db.recipes (BOM)
--                                                   + cretas_db.stocktaking_records
--
-- Purpose: break data-silo between cretas_db (transactional CRUD) and smartbi_db
-- (Gold analytical) so that:
--   1) AI templates can query daily ops (loss/recipe/stocktaking) via fast Gold path
--   2) Cross-module joins (POS bill × food cost from recipe × ingredient price)
--      become possible for true profit margin analysis
--   3) Historical trending (not just latest state) becomes queryable
--
-- Design choices:
--   - dim_ingredient is new (distinct from dim_product which = 菜品/POS items)
--   - All facts follow the same {id, factory_id, date, ..., created_at, updated_at}
--     shape + tenant RLS as existing POS facts (2026_04_29_silver_facts.sql)
--   - source_pk column tracks the origin cretas_db row id for backfill + reconcile
--   - Indexes match expected hot paths (factory+date for trends, factory+ingredient
--     for rankings)


-- ── dim_ingredient (食材 dimension) ──────────────────────────────────
-- ETL source: cretas_db.raw_material_types. Every row is 1 food ingredient
-- used by restaurant kitchen (not to be confused with dim_product = menu dish).
CREATE TABLE IF NOT EXISTS dim_ingredient (
    ingredient_id    BIGSERIAL PRIMARY KEY,
    factory_id       VARCHAR(50) NOT NULL,
    source_pk        VARCHAR(191) NOT NULL,           -- cretas_db.raw_material_types.id
    name             VARCHAR(200) NOT NULL,
    normalized_name  VARCHAR(200) NOT NULL,           -- for dedup (simp+lower+trim)
    category         VARCHAR(100),                    -- 肉类 / 蔬菜 / 主食 / 汤料 / 调料
    code             VARCHAR(100),                    -- factory-scoped SKU-like code
    unit             VARCHAR(20),                     -- kg / L / 个 / 斤
    unit_price       NUMERIC(12,4),                   -- last-known unit price (from moving_avg_price)
    shelf_life_days  INT,                             -- for expiry-aware analytics
    storage_type     VARCHAR(30),                     -- FROZEN / REFRIGERATED / ROOM_TEMP
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_dim_ingredient_factory_source UNIQUE (factory_id, source_pk),
    CONSTRAINT uq_dim_ingredient_factory_normname UNIQUE (factory_id, normalized_name)
);
ALTER TABLE dim_ingredient ENABLE  ROW LEVEL SECURITY;
ALTER TABLE dim_ingredient FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dim_ingredient;
CREATE POLICY tenant_isolation ON dim_ingredient FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_dim_ingredient_touch ON dim_ingredient;
CREATE TRIGGER trg_dim_ingredient_touch BEFORE UPDATE ON dim_ingredient
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_dim_ingredient_factory_cat
    ON dim_ingredient (factory_id, category);
CREATE INDEX IF NOT EXISTS idx_dim_ingredient_factory_name
    ON dim_ingredient (factory_id, name);


-- ── fact_restaurant_requisition (领料记录) ──────────────────────────
-- Source: cretas_db.material_requisitions (both RESTAURANT + FACTORY tenants).
-- Ingredient requisition from kitchen → warehouse; grain = 1 row per requisition
-- entry. Joins dim_ingredient for rollups by category/food type.
CREATE TABLE IF NOT EXISTS fact_restaurant_requisition (
    id                  BIGSERIAL PRIMARY KEY,
    factory_id          VARCHAR(50) NOT NULL,
    source_pk           VARCHAR(191) NOT NULL,       -- cretas_db.material_requisitions.id
    requisition_number  VARCHAR(100),                -- human-readable ref
    date                DATE NOT NULL,
    ingredient_id       BIGINT,                      -- FK to dim_ingredient (nullable for orphans)
    product_id          BIGINT,                      -- FK to dim_product (optional — PRODUCTION type)
    type                VARCHAR(32),                 -- PRODUCTION / MANUAL
    status              VARCHAR(32),                 -- DRAFT / SUBMITTED / APPROVED / REJECTED
    requested_qty       NUMERIC(14,4),
    actual_qty          NUMERIC(14,4),
    unit                VARCHAR(20),
    est_cost            NUMERIC(14,2),               -- requested_qty × ingredient.unit_price
    notes               TEXT,
    requested_by        BIGINT,
    approved_by         BIGINT,
    approved_at         TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_fact_req_factory_source UNIQUE (factory_id, source_pk),
    CONSTRAINT fk_fact_req_ingredient FOREIGN KEY (ingredient_id)
        REFERENCES dim_ingredient (ingredient_id) ON DELETE SET NULL
);
ALTER TABLE fact_restaurant_requisition ENABLE  ROW LEVEL SECURITY;
ALTER TABLE fact_restaurant_requisition FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_restaurant_requisition;
CREATE POLICY tenant_isolation ON fact_restaurant_requisition FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_fact_req_touch ON fact_restaurant_requisition;
CREATE TRIGGER trg_fact_req_touch BEFORE UPDATE ON fact_restaurant_requisition
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();
-- Hot path: trend by factory+date (agg_restaurant_daily builder)
CREATE INDEX IF NOT EXISTS idx_fact_req_factory_date
    ON fact_restaurant_requisition (factory_id, date);
-- Hot path: ranking by ingredient (Top N food ingredient usage)
CREATE INDEX IF NOT EXISTS idx_fact_req_factory_ingredient
    ON fact_restaurant_requisition (factory_id, ingredient_id);
CREATE INDEX IF NOT EXISTS idx_fact_req_factory_status
    ON fact_restaurant_requisition (factory_id, status);


-- ── fact_restaurant_wastage (损耗记录) ──────────────────────────────
-- Source: cretas_db.wastage_records. One row per wastage event.
-- Critical for food-cost-control analytics (spoilage / damage / processing loss).
CREATE TABLE IF NOT EXISTS fact_restaurant_wastage (
    id                  BIGSERIAL PRIMARY KEY,
    factory_id          VARCHAR(50) NOT NULL,
    source_pk           VARCHAR(191) NOT NULL,
    wastage_number      VARCHAR(100),
    date                DATE NOT NULL,
    ingredient_id       BIGINT,
    wastage_type        VARCHAR(32),                 -- EXPIRED / DAMAGED / SPOILED / PROCESSING / OTHER
    status              VARCHAR(32),
    quantity            NUMERIC(14,4),
    unit                VARCHAR(20),
    estimated_cost      NUMERIC(14,2),               -- user-entered loss value
    reason              TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_fact_wastage_factory_source UNIQUE (factory_id, source_pk),
    CONSTRAINT fk_fact_wastage_ingredient FOREIGN KEY (ingredient_id)
        REFERENCES dim_ingredient (ingredient_id) ON DELETE SET NULL
);
ALTER TABLE fact_restaurant_wastage ENABLE  ROW LEVEL SECURITY;
ALTER TABLE fact_restaurant_wastage FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_restaurant_wastage;
CREATE POLICY tenant_isolation ON fact_restaurant_wastage FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_fact_wastage_touch ON fact_restaurant_wastage;
CREATE TRIGGER trg_fact_wastage_touch BEFORE UPDATE ON fact_restaurant_wastage
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_fact_wastage_factory_date
    ON fact_restaurant_wastage (factory_id, date);
CREATE INDEX IF NOT EXISTS idx_fact_wastage_factory_type
    ON fact_restaurant_wastage (factory_id, wastage_type);
CREATE INDEX IF NOT EXISTS idx_fact_wastage_factory_ingredient
    ON fact_restaurant_wastage (factory_id, ingredient_id);


-- ── fact_restaurant_recipe_line (配方 BOM lines) ────────────────────
-- Source: cretas_db.recipes. Grain = 1 row per recipe line (dish × ingredient).
-- Enables food-cost calculation: dish_cost = SUM(standard_qty × ingredient.unit_price).
CREATE TABLE IF NOT EXISTS fact_restaurant_recipe_line (
    id                  BIGSERIAL PRIMARY KEY,
    factory_id          VARCHAR(50) NOT NULL,
    source_pk           VARCHAR(191) NOT NULL,
    product_id          BIGINT NOT NULL,             -- FK to dim_product (= 菜品)
    ingredient_id       BIGINT,                      -- FK to dim_ingredient (= 食材)
    standard_qty        NUMERIC(14,4),               -- 标准用量 per 1 dish
    yield_rate          NUMERIC(5,4),                -- 净料率 (e.g. 0.9 = 10% loss)
    is_main_ingredient  BOOLEAN DEFAULT FALSE,       -- 主料 flag
    unit                VARCHAR(20),
    line_cost           NUMERIC(14,4),               -- standard_qty × ingredient.unit_price
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_fact_recipe_factory_source UNIQUE (factory_id, source_pk),
    CONSTRAINT fk_fact_recipe_ingredient FOREIGN KEY (ingredient_id)
        REFERENCES dim_ingredient (ingredient_id) ON DELETE SET NULL
);
ALTER TABLE fact_restaurant_recipe_line ENABLE  ROW LEVEL SECURITY;
ALTER TABLE fact_restaurant_recipe_line FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_restaurant_recipe_line;
CREATE POLICY tenant_isolation ON fact_restaurant_recipe_line FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_fact_recipe_touch ON fact_restaurant_recipe_line;
CREATE TRIGGER trg_fact_recipe_touch BEFORE UPDATE ON fact_restaurant_recipe_line
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_fact_recipe_factory_product
    ON fact_restaurant_recipe_line (factory_id, product_id);
CREATE INDEX IF NOT EXISTS idx_fact_recipe_factory_ingredient
    ON fact_restaurant_recipe_line (factory_id, ingredient_id);


-- ── fact_restaurant_stocktaking (盘点记录) ──────────────────────────
-- Source: cretas_db.stocktaking_records. Grain = 1 row per stocktaking line
-- (usually one record per ingredient per stocktaking event).
-- Pos/neg difference_qty reveals shortage/surplus for loss analysis.
CREATE TABLE IF NOT EXISTS fact_restaurant_stocktaking (
    id                  BIGSERIAL PRIMARY KEY,
    factory_id          VARCHAR(50) NOT NULL,
    source_pk           VARCHAR(191) NOT NULL,
    stocktaking_number  VARCHAR(100),
    date                DATE NOT NULL,
    ingredient_id       BIGINT,
    status              VARCHAR(32),                 -- IN_PROGRESS / COMPLETED / CANCELLED
    system_qty          NUMERIC(14,4),               -- 账面库存
    actual_qty          NUMERIC(14,4),               -- 实盘
    difference_qty      NUMERIC(14,4),               -- actual - system (neg = shortage)
    difference_cost     NUMERIC(14,2),               -- |difference_qty| × unit_price
    unit                VARCHAR(20),
    reason              TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_fact_stock_factory_source UNIQUE (factory_id, source_pk),
    CONSTRAINT fk_fact_stock_ingredient FOREIGN KEY (ingredient_id)
        REFERENCES dim_ingredient (ingredient_id) ON DELETE SET NULL
);
ALTER TABLE fact_restaurant_stocktaking ENABLE  ROW LEVEL SECURITY;
ALTER TABLE fact_restaurant_stocktaking FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_restaurant_stocktaking;
CREATE POLICY tenant_isolation ON fact_restaurant_stocktaking FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_fact_stock_touch ON fact_restaurant_stocktaking;
CREATE TRIGGER trg_fact_stock_touch BEFORE UPDATE ON fact_restaurant_stocktaking
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_fact_stock_factory_date
    ON fact_restaurant_stocktaking (factory_id, date);
CREATE INDEX IF NOT EXISTS idx_fact_stock_factory_ingredient
    ON fact_restaurant_stocktaking (factory_id, ingredient_id);


-- Rollback:
--   DROP TABLE IF EXISTS fact_restaurant_stocktaking;
--   DROP TABLE IF EXISTS fact_restaurant_recipe_line;
--   DROP TABLE IF EXISTS fact_restaurant_wastage;
--   DROP TABLE IF EXISTS fact_restaurant_requisition;
--   DROP TABLE IF EXISTS dim_ingredient;
