-- Phase 2.5: add product_source_pk to restaurant recipe tables so dishes can
-- be distinguished WITHOUT needing a full dim_product ETL from cretas_db
-- product_types. The source_pk is the cretas_db.product_types.id (varchar),
-- and the resolver joins back at query time for dish names.
--
-- Rationale vs full dim_product:
-- - dim_product already exists in smartbi_db, populated from POS bill parser
--   (fact_pos_item). These are xlsx-parsed dish names.
-- - cretas_db.product_types is a different source (admin-configured menu).
-- - The two universes may not overlap by name (different spelling / casing /
--   alias issues) — merging them is its own project (dim_product_alias layer).
-- - Short-term: keep recipe_line grain anchored to the cretas_db source so
--   agg_restaurant_product_cost gives per-dish food cost that FE can display
--   alongside 菜品管理 page items.

ALTER TABLE fact_restaurant_recipe_line
    ADD COLUMN IF NOT EXISTS product_source_pk VARCHAR(191);

CREATE INDEX IF NOT EXISTS idx_fact_recipe_product_source
    ON fact_restaurant_recipe_line (factory_id, product_source_pk);

ALTER TABLE agg_restaurant_product_cost
    ADD COLUMN IF NOT EXISTS product_source_pk VARCHAR(191);

-- Drop + recreate primary key so it includes product_source_pk. The old
-- (factory_id, product_id) PK collapsed all dishes onto product_id=0 sentinel
-- which is useless. product_source_pk is the real dish identifier.
-- Note: cannot use IF NOT EXISTS on PK ops; use guard via pg_constraint.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'agg_restaurant_product_cost'::regclass
           AND contype = 'p'
    ) THEN
        ALTER TABLE agg_restaurant_product_cost
            DROP CONSTRAINT agg_restaurant_product_cost_pkey;
    END IF;
END $$;

-- New PK: (factory_id, product_source_pk). Allow NULL product_source_pk
-- transiently during migration (backfill below). Use COALESCE('') to keep PK
-- constraint satisfied on existing rows.
UPDATE agg_restaurant_product_cost
   SET product_source_pk = COALESCE(product_source_pk, '')
 WHERE product_source_pk IS NULL;

ALTER TABLE agg_restaurant_product_cost
    ALTER COLUMN product_source_pk SET NOT NULL,
    ALTER COLUMN product_source_pk SET DEFAULT '';

ALTER TABLE agg_restaurant_product_cost
    ADD PRIMARY KEY (factory_id, product_source_pk);

-- Rollback:
--   ALTER TABLE agg_restaurant_product_cost DROP CONSTRAINT agg_restaurant_product_cost_pkey;
--   ALTER TABLE agg_restaurant_product_cost ADD PRIMARY KEY (factory_id, product_id);
--   ALTER TABLE agg_restaurant_product_cost DROP COLUMN product_source_pk;
--   DROP INDEX IF EXISTS idx_fact_recipe_product_source;
--   ALTER TABLE fact_restaurant_recipe_line DROP COLUMN product_source_pk;
