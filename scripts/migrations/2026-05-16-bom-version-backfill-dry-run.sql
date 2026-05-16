-- Sprint 3 Track-H M-BOM-VER-1 — Dry-run preview
--
-- Read-only. Returns the row counts and a sample of what WOULD be inserted by
-- 2026-05-16-bom-version-backfill.sql, without modifying anything.
--
-- Usage:
--   psql -h ... -d cretas_db -f 此文件
--
-- 不写入. 仅 SELECT.

-- ============================================================================
-- Counts: how many rows would be inserted?
-- ============================================================================

\echo '--- BomRecipe (alive) → BomVersion candidates ---'
SELECT
    COUNT(*)                                                            AS total_recipes,
    COUNT(*) FILTER (WHERE is_current = TRUE)                           AS current_recipes,
    COUNT(*) FILTER (WHERE is_current = FALSE)                          AS historical_recipes,
    COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM bom_versions v
        WHERE v.factory_id     = r.factory_id
          AND v.bom_recipe_id  = r.id
          AND v.version_number = r.version
          AND v.deleted_at IS NULL
    ))                                                                  AS would_insert
FROM bom_recipes r
WHERE r.deleted_at IS NULL;

\echo
\echo '--- BomChangeLog (alive) grouped by (factory_id, bom_id) → ECN DRAFT candidates ---'
WITH grouped AS (
    SELECT factory_id, bom_id, COUNT(*) AS log_count
    FROM bom_change_logs
    WHERE deleted_at IS NULL AND bom_id IS NOT NULL
    GROUP BY factory_id, bom_id
)
SELECT
    COUNT(*)                                                            AS distinct_recipe_groups,
    SUM(log_count)                                                      AS total_change_logs,
    COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM engineering_change_notices e
        WHERE e.factory_id    = grouped.factory_id
          AND e.bom_recipe_id = grouped.bom_id
          AND e.status        = 'DRAFT'
          AND e.reason_detail LIKE 'Backfilled from BomChangeLog%'
          AND e.deleted_at IS NULL
    ))                                                                  AS would_insert
FROM grouped;

-- ============================================================================
-- Sample 10: show a sample of recipes that would be backfilled to BomVersion
-- ============================================================================

\echo
\echo '--- Sample 10 BomRecipe → BomVersion projections ---'
SELECT
    r.factory_id,
    r.id                                                       AS recipe_id,
    r.recipe_code,
    r.product_name,
    r.version                                                  AS version_number,
    CASE WHEN r.is_current AND r.status = 'ACTIVE' THEN 'APPROVED'
         WHEN r.is_current                          THEN 'APPROVED'
         ELSE                                            'OBSOLETE'
    END                                                        AS target_status,
    COALESCE(r.activated_at::date, r.created_at::date)         AS target_effective_from,
    CASE WHEN r.is_current THEN NULL ELSE r.updated_at::date END AS target_effective_to,
    r.activated_by                                             AS target_approved_by,
    (SELECT COUNT(*) FROM bom_recipe_items i
     WHERE i.recipe_id = r.id AND i.deleted_at IS NULL)        AS item_count
FROM bom_recipes r
WHERE r.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM bom_versions v
      WHERE v.factory_id     = r.factory_id
        AND v.bom_recipe_id  = r.id
        AND v.version_number = r.version
        AND v.deleted_at IS NULL
  )
ORDER BY r.created_at DESC
LIMIT 10;

-- ============================================================================
-- Sample 10: show a sample of BomChangeLog → ECN DRAFT projections
-- ============================================================================

\echo
\echo '--- Sample 10 BomChangeLog group → ECN DRAFT projections ---'
WITH grouped AS (
    SELECT
        factory_id,
        bom_id,
        MIN(created_at)        AS first_changed_at,
        MAX(created_at)        AS last_changed_at,
        COUNT(*)               AS change_count,
        string_agg(DISTINCT change_reason, '; ' ORDER BY change_reason)
            FILTER (WHERE change_reason IS NOT NULL)              AS reasons_concat,
        MIN(changed_by)        AS first_changed_by
    FROM bom_change_logs
    WHERE deleted_at IS NULL AND bom_id IS NOT NULL
    GROUP BY factory_id, bom_id
)
SELECT
    factory_id,
    bom_id                                                       AS target_bom_recipe_id,
    first_changed_at,
    last_changed_at,
    change_count,
    first_changed_by                                             AS target_created_by,
    LEFT('Backfilled from BomChangeLog ' || change_count
         || ' changes. Reasons: '
         || COALESCE(reasons_concat, '(none recorded)'), 100)    AS reason_detail_preview
FROM grouped
WHERE NOT EXISTS (
    SELECT 1 FROM engineering_change_notices e
    WHERE e.factory_id    = grouped.factory_id
      AND e.bom_recipe_id = grouped.bom_id
      AND e.status        = 'DRAFT'
      AND e.reason_detail LIKE 'Backfilled from BomChangeLog%'
      AND e.deleted_at IS NULL
)
ORDER BY change_count DESC
LIMIT 10;

\echo
\echo '--- Dry-run complete. Apply via: psql -f 2026-05-16-bom-version-backfill.sql ---'
