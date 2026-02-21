-- =============================================================================
-- Restaurant Module Tables — PostgreSQL DDL
-- =============================================================================
-- Creates 4 tables for the restaurant kitchen-operations module:
--   1. recipes              — BOM recipes linking products to raw materials
--   2. material_requisitions — kitchen material requisition / pick-list records
--   3. wastage_records       — food wastage and spoilage tracking
--   4. stocktaking_records   — periodic inventory count and variance records
--
-- Prerequisites:
--   - PostgreSQL 10+
--   - Database: cretas_db (or whichever DB the application uses)
--
-- Usage:
--   psql -U cretas_user -d cretas_db -f create_restaurant_tables_pg.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Shared trigger function: auto-update updated_at on every UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. recipes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipes (
    id                    VARCHAR(191)   PRIMARY KEY,
    factory_id            VARCHAR(100)   NOT NULL,
    product_type_id       VARCHAR(191)   NOT NULL,
    raw_material_type_id  VARCHAR(191)   NOT NULL,
    standard_quantity     DECIMAL(10,4)  NOT NULL,
    unit                  VARCHAR(20),
    net_yield_rate        DECIMAL(5,4),
    is_main_ingredient    BOOLEAN        DEFAULT true,
    notes                 TEXT,
    is_active             BOOLEAN        NOT NULL DEFAULT true,
    created_by            BIGINT,
    created_at            TIMESTAMP      DEFAULT NOW(),
    updated_at            TIMESTAMP      DEFAULT NOW(),
    deleted_at            TIMESTAMP      NULL
);

CREATE INDEX IF NOT EXISTS idx_recipe_factory          ON recipes (factory_id);
CREATE INDEX IF NOT EXISTS idx_recipe_product          ON recipes (product_type_id);
CREATE INDEX IF NOT EXISTS idx_recipe_material         ON recipes (raw_material_type_id);
CREATE INDEX IF NOT EXISTS idx_recipe_factory_product  ON recipes (factory_id, product_type_id);

DROP TRIGGER IF EXISTS trigger_recipes_updated_at ON recipes;
CREATE TRIGGER trigger_recipes_updated_at
    BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. material_requisitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_requisitions (
    id                    VARCHAR(191)   PRIMARY KEY,
    factory_id            VARCHAR(100)   NOT NULL,
    requisition_number    VARCHAR(50),
    requisition_date      DATE           NOT NULL,
    type                  VARCHAR(32)    NOT NULL DEFAULT 'MANUAL',
    status                VARCHAR(32)    NOT NULL DEFAULT 'DRAFT',
    product_type_id       VARCHAR(191),
    dish_quantity         INTEGER,
    raw_material_type_id  VARCHAR(191),
    requested_quantity    DECIMAL(10,4),
    actual_quantity       DECIMAL(10,4),
    material_batch_id     VARCHAR(191),
    unit                  VARCHAR(20),
    requested_by          BIGINT,
    approved_by           BIGINT,
    approved_at           TIMESTAMP,
    notes                 TEXT,
    created_at            TIMESTAMP      DEFAULT NOW(),
    updated_at            TIMESTAMP      DEFAULT NOW(),
    deleted_at            TIMESTAMP      NULL
);

CREATE INDEX IF NOT EXISTS idx_req_factory              ON material_requisitions (factory_id);
CREATE INDEX IF NOT EXISTS idx_req_date                 ON material_requisitions (requisition_date);
CREATE INDEX IF NOT EXISTS idx_req_status               ON material_requisitions (status);
CREATE INDEX IF NOT EXISTS idx_req_type                 ON material_requisitions (type);
CREATE INDEX IF NOT EXISTS idx_req_factory_date_status  ON material_requisitions (factory_id, requisition_date, status);

DROP TRIGGER IF EXISTS trigger_material_requisitions_updated_at ON material_requisitions;
CREATE TRIGGER trigger_material_requisitions_updated_at
    BEFORE UPDATE ON material_requisitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 3. wastage_records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wastage_records (
    id                    VARCHAR(191)   PRIMARY KEY,
    factory_id            VARCHAR(100)   NOT NULL,
    wastage_number        VARCHAR(50),
    wastage_date          DATE           NOT NULL,
    type                  VARCHAR(32)    NOT NULL,
    status                VARCHAR(32)    NOT NULL DEFAULT 'DRAFT',
    raw_material_type_id  VARCHAR(191)   NOT NULL,
    material_batch_id     VARCHAR(191),
    quantity              DECIMAL(10,4)  NOT NULL,
    unit                  VARCHAR(20),
    estimated_cost        DECIMAL(15,2),
    reason                TEXT,
    reported_by           BIGINT,
    approved_by           BIGINT,
    approved_at           TIMESTAMP,
    notes                 TEXT,
    created_at            TIMESTAMP      DEFAULT NOW(),
    updated_at            TIMESTAMP      DEFAULT NOW(),
    deleted_at            TIMESTAMP      NULL
);

CREATE INDEX IF NOT EXISTS idx_wastage_factory       ON wastage_records (factory_id);
CREATE INDEX IF NOT EXISTS idx_wastage_date          ON wastage_records (wastage_date);
CREATE INDEX IF NOT EXISTS idx_wastage_status        ON wastage_records (status);
CREATE INDEX IF NOT EXISTS idx_wastage_type          ON wastage_records (type);
CREATE INDEX IF NOT EXISTS idx_wastage_factory_date  ON wastage_records (factory_id, wastage_date);

DROP TRIGGER IF EXISTS trigger_wastage_records_updated_at ON wastage_records;
CREATE TRIGGER trigger_wastage_records_updated_at
    BEFORE UPDATE ON wastage_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. stocktaking_records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stocktaking_records (
    id                    VARCHAR(191)   PRIMARY KEY,
    factory_id            VARCHAR(100)   NOT NULL,
    stocktaking_number    VARCHAR(50),
    stocktaking_date      DATE           NOT NULL,
    status                VARCHAR(32)    NOT NULL DEFAULT 'IN_PROGRESS',
    raw_material_type_id  VARCHAR(191)   NOT NULL,
    unit                  VARCHAR(20),
    system_quantity       DECIMAL(10,4),
    actual_quantity       DECIMAL(10,4),
    difference_quantity   DECIMAL(10,4),
    difference_type       VARCHAR(32),
    difference_amount     DECIMAL(15,2),
    adjustment_reason     TEXT,
    counted_by            BIGINT,
    verified_by           BIGINT,
    completed_at          TIMESTAMP,
    notes                 TEXT,
    created_at            TIMESTAMP      DEFAULT NOW(),
    updated_at            TIMESTAMP      DEFAULT NOW(),
    deleted_at            TIMESTAMP      NULL
);

CREATE INDEX IF NOT EXISTS idx_stk_factory       ON stocktaking_records (factory_id);
CREATE INDEX IF NOT EXISTS idx_stk_date          ON stocktaking_records (stocktaking_date);
CREATE INDEX IF NOT EXISTS idx_stk_status        ON stocktaking_records (status);
CREATE INDEX IF NOT EXISTS idx_stk_material      ON stocktaking_records (raw_material_type_id);
CREATE INDEX IF NOT EXISTS idx_stk_factory_date  ON stocktaking_records (factory_id, stocktaking_date, status);

DROP TRIGGER IF EXISTS trigger_stocktaking_records_updated_at ON stocktaking_records;
CREATE TRIGGER trigger_stocktaking_records_updated_at
    BEFORE UPDATE ON stocktaking_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- Done. All 4 restaurant module tables created with indexes and triggers.
-- =============================================================================
