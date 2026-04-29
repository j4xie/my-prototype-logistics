-- P1-3: Raw material price history (track cost drift over time)
-- P1-4: Recipe versioning (effective_from / effective_to for historical margin accuracy)

BEGIN;

-- =====================================================================
-- P1-3: raw_material_price_history
-- snapshot taken on insert/update of raw_material_types.unit_price
-- =====================================================================
CREATE TABLE IF NOT EXISTS raw_material_price_history (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(100) NOT NULL,
    raw_material_type_id VARCHAR(191) NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMP,  -- NULL = current
    changed_by BIGINT,
    change_reason VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_price_hist_material ON raw_material_price_history(raw_material_type_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_price_hist_factory ON raw_material_price_history(factory_id, effective_from DESC);

-- Backfill current prices as first history entry (one row per existing material)
INSERT INTO raw_material_price_history (factory_id, raw_material_type_id, unit_price, effective_from, change_reason)
SELECT factory_id, id, unit_price, created_at, 'backfill_from_current'
  FROM raw_material_types
 WHERE unit_price IS NOT NULL AND deleted_at IS NULL
 ON CONFLICT DO NOTHING;

-- Trigger: on raw_material_types.unit_price change, close previous + insert new row
CREATE OR REPLACE FUNCTION trg_raw_material_price_snapshot() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.unit_price IS NOT NULL AND
     (OLD.unit_price IS NULL OR OLD.unit_price <> NEW.unit_price) THEN
    -- Close the prior open history entry
    UPDATE raw_material_price_history
       SET effective_to = NOW()
     WHERE raw_material_type_id = NEW.id AND effective_to IS NULL;
    -- Insert new
    INSERT INTO raw_material_price_history (factory_id, raw_material_type_id, unit_price, effective_from, change_reason)
    VALUES (NEW.factory_id, NEW.id, NEW.unit_price, NOW(), 'auto_on_update');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rawmat_price_hist ON raw_material_types;
CREATE TRIGGER trg_rawmat_price_hist
AFTER UPDATE OF unit_price ON raw_material_types
FOR EACH ROW EXECUTE FUNCTION trg_raw_material_price_snapshot();

-- =====================================================================
-- P1-4: recipes versioning
-- effective_from / effective_to already there-ish via created_at / updated_at, but we
-- make it explicit for historical margin queries. NULL effective_to = current.
-- =====================================================================
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS effective_from TIMESTAMP;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS effective_to TIMESTAMP;

-- Backfill effective_from from created_at for all existing rows
UPDATE recipes SET effective_from = created_at WHERE effective_from IS NULL;

CREATE INDEX IF NOT EXISTS idx_recipes_effective ON recipes(factory_id, product_type_id, effective_from, effective_to);

-- Helper view: current recipes (effective_to IS NULL or in future)
CREATE OR REPLACE VIEW v_current_recipes AS
SELECT * FROM recipes
 WHERE deleted_at IS NULL AND is_active = true AND (effective_to IS NULL OR effective_to > NOW());

COMMIT;
