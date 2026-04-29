-- P2-8 季节性配方 / 替代食材
-- Design choice: extend `recipes` with variant_tag + priority (rather than a separate table),
-- because the ETL already reads from `recipes`. Adding a WHERE clause for NOW() BETWEEN
-- effective_from AND effective_to is simpler than a JOIN.

BEGIN;

-- variant_tag: 'default' (当前版 — 没设日期的 fallback) / 'summer' / 'winter' / 'emergency' / ...
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS variant_tag VARCHAR(50) DEFAULT 'default';

-- priority: higher wins when multiple variants match (e.g. summer:10 > default:0)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_recipes_variant ON recipes(factory_id, product_type_id, variant_tag, priority DESC);

-- Helper view: current active variant per (factory, dish, ingredient) tuple,
-- picking the highest-priority variant whose effective_range covers NOW().
CREATE OR REPLACE VIEW v_recipes_effective AS
SELECT DISTINCT ON (r.factory_id, r.product_type_id, r.raw_material_type_id)
       r.*
  FROM recipes r
 WHERE r.deleted_at IS NULL
   AND r.is_active = true
   AND (r.effective_from IS NULL OR r.effective_from <= NOW())
   AND (r.effective_to IS NULL OR r.effective_to > NOW())
 ORDER BY r.factory_id, r.product_type_id, r.raw_material_type_id,
          r.priority DESC, r.updated_at DESC;

COMMIT;
