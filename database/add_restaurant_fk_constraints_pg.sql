-- =============================================================================
-- Restaurant Module — Foreign Key Constraints Migration (PostgreSQL)
-- =============================================================================
-- Purpose : Add FK constraints to the 4 restaurant module tables created by
--           create_restaurant_tables_pg.sql.  This is a separate idempotent
--           migration so it can be applied after the base tables are populated.
--
-- Tables affected:
--   1. recipes
--   2. material_requisitions
--   3. wastage_records
--   4. stocktaking_records
--
-- Referenced tables (PKs verified from entity sources):
--   factories          — id  VARCHAR (no length cap in DDL; matches VARCHAR(100) FKs)
--   product_types      — id  VARCHAR(100)
--   raw_material_types — id  VARCHAR(191)
--   material_batches   — id  VARCHAR(191)
--
-- Default FK behaviour:
--   ON DELETE RESTRICT  — prevents parent deletion while child rows exist
--   ON UPDATE CASCADE   — propagates parent PK changes to child FKs
--
-- Idempotency:
--   Each ALTER TABLE is wrapped in an anonymous DO block that catches
--   duplicate_object (42710) so re-running this script is safe.
--
-- Prerequisites:
--   - create_restaurant_tables_pg.sql must have been applied first
--   - PostgreSQL 10+
--   - Database: cretas_db
--
-- Usage:
--   psql -U cretas_user -d cretas_db -f add_restaurant_fk_constraints_pg.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. recipes
-- ---------------------------------------------------------------------------

-- recipes.factory_id → factories(id)
DO $$
BEGIN
    ALTER TABLE recipes
        ADD CONSTRAINT fk_recipes_factory
        FOREIGN KEY (factory_id)
        REFERENCES factories (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_recipes_factory already exists, skipping.';
END $$;

-- recipes.product_type_id → product_types(id)
DO $$
BEGIN
    ALTER TABLE recipes
        ADD CONSTRAINT fk_recipes_product_type
        FOREIGN KEY (product_type_id)
        REFERENCES product_types (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_recipes_product_type already exists, skipping.';
END $$;

-- recipes.raw_material_type_id → raw_material_types(id)
DO $$
BEGIN
    ALTER TABLE recipes
        ADD CONSTRAINT fk_recipes_raw_material_type
        FOREIGN KEY (raw_material_type_id)
        REFERENCES raw_material_types (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_recipes_raw_material_type already exists, skipping.';
END $$;

-- ---------------------------------------------------------------------------
-- 2. material_requisitions
-- ---------------------------------------------------------------------------

-- material_requisitions.factory_id → factories(id)
DO $$
BEGIN
    ALTER TABLE material_requisitions
        ADD CONSTRAINT fk_req_factory
        FOREIGN KEY (factory_id)
        REFERENCES factories (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_req_factory already exists, skipping.';
END $$;

-- material_requisitions.product_type_id → product_types(id)   [nullable]
DO $$
BEGIN
    ALTER TABLE material_requisitions
        ADD CONSTRAINT fk_req_product_type
        FOREIGN KEY (product_type_id)
        REFERENCES product_types (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_req_product_type already exists, skipping.';
END $$;

-- material_requisitions.raw_material_type_id → raw_material_types(id)   [nullable]
DO $$
BEGIN
    ALTER TABLE material_requisitions
        ADD CONSTRAINT fk_req_raw_material_type
        FOREIGN KEY (raw_material_type_id)
        REFERENCES raw_material_types (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_req_raw_material_type already exists, skipping.';
END $$;

-- material_requisitions.material_batch_id → material_batches(id)   [nullable]
DO $$
BEGIN
    ALTER TABLE material_requisitions
        ADD CONSTRAINT fk_req_material_batch
        FOREIGN KEY (material_batch_id)
        REFERENCES material_batches (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_req_material_batch already exists, skipping.';
END $$;

-- ---------------------------------------------------------------------------
-- 3. wastage_records
-- ---------------------------------------------------------------------------

-- wastage_records.factory_id → factories(id)
DO $$
BEGIN
    ALTER TABLE wastage_records
        ADD CONSTRAINT fk_wastage_factory
        FOREIGN KEY (factory_id)
        REFERENCES factories (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_wastage_factory already exists, skipping.';
END $$;

-- wastage_records.raw_material_type_id → raw_material_types(id)
DO $$
BEGIN
    ALTER TABLE wastage_records
        ADD CONSTRAINT fk_wastage_raw_material_type
        FOREIGN KEY (raw_material_type_id)
        REFERENCES raw_material_types (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_wastage_raw_material_type already exists, skipping.';
END $$;

-- wastage_records.material_batch_id → material_batches(id)   [nullable]
DO $$
BEGIN
    ALTER TABLE wastage_records
        ADD CONSTRAINT fk_wastage_material_batch
        FOREIGN KEY (material_batch_id)
        REFERENCES material_batches (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_wastage_material_batch already exists, skipping.';
END $$;

-- ---------------------------------------------------------------------------
-- 4. stocktaking_records
-- ---------------------------------------------------------------------------

-- stocktaking_records.factory_id → factories(id)
DO $$
BEGIN
    ALTER TABLE stocktaking_records
        ADD CONSTRAINT fk_stk_factory
        FOREIGN KEY (factory_id)
        REFERENCES factories (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_stk_factory already exists, skipping.';
END $$;

-- stocktaking_records.raw_material_type_id → raw_material_types(id)
DO $$
BEGIN
    ALTER TABLE stocktaking_records
        ADD CONSTRAINT fk_stk_raw_material_type
        FOREIGN KEY (raw_material_type_id)
        REFERENCES raw_material_types (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'fk_stk_raw_material_type already exists, skipping.';
END $$;

-- =============================================================================
-- Done. 11 FK constraints added across 4 restaurant module tables.
--
-- Summary:
--   recipes                (3 FKs): factory_id, product_type_id, raw_material_type_id
--   material_requisitions  (4 FKs): factory_id, product_type_id*, raw_material_type_id*, material_batch_id*
--   wastage_records        (3 FKs): factory_id, raw_material_type_id, material_batch_id*
--   stocktaking_records    (2 FKs): factory_id, raw_material_type_id
--
--   * nullable column — FK enforced only when value is non-NULL (standard PG behaviour)
-- =============================================================================
