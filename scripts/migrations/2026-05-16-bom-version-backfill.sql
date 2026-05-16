-- Sprint 3 Track-H M-BOM-VER-1 — BomVersion + ECN DRAFT backfill
--
-- Backfill 现有 BomRecipe → BomVersion (1 row per recipe, status APPROVED/OBSOLETE).
-- Backfill 现有 BomChangeLog → ECN DRAFT (1 row per distinct (factory_id, bom_id), 占位用,
--   用户后续 finalize). Reason default PROCESS_IMPROVEMENT; reason_detail concat first
--   500 chars of change_reasons.
--
-- Idempotent: NOT EXISTS guards prevent re-inserts. Safe to re-run.
--
-- 使用方式:
--   1) 完整 DB backup (pg_dump)
--   2) Dry-run: 见 2026-05-16-bom-version-backfill-dry-run.sql
--   3) 抽样 10 验证 (脚本 2026-05-16-bom-version-backfill.sh --sample 10)
--   4) Apply: psql -h ... -d cretas_db -f 此文件
--   5) Verify: SELECT COUNT(*) FROM bom_versions; vs SELECT COUNT(*) FROM bom_recipes WHERE deleted_at IS NULL;
--
-- 不动: 现有 BomRecipe.version + isCurrent 字段 (6 月双轨过渡保留).

-- ============================================================================
-- Phase 1: BomRecipe → BomVersion (1 row per recipe)
-- ============================================================================

INSERT INTO bom_versions (
    id, factory_id, bom_recipe_id, version_number, snapshot_json,
    status, effective_from, effective_to, created_by, approved_by, approved_at,
    ecn_id, rejection_reason, created_at, updated_at
)
SELECT
    gen_random_uuid()::text                              AS id,
    r.factory_id,
    r.id                                                 AS bom_recipe_id,
    r.version                                            AS version_number,
    jsonb_build_object(
        'recipeId',              r.id,
        'recipeCode',            r.recipe_code,
        'productTypeId',         r.product_type_id,
        'productName',           r.product_name,
        'version',               r.version,
        'overallYieldRate',      r.overall_yield_rate,
        'outputQuantityPerUnit', r.output_quantity_per_unit,
        'outputUnit',            r.output_unit,
        'totalMaterialCost',     r.total_material_cost,
        'totalLaborCost',        r.total_labor_cost,
        'totalOverheadCost',     r.total_overhead_cost,
        'totalCost',             r.total_cost,
        'standardSalePrice',     r.standard_sale_price,
        'status',                r.status,
        'sourceType',            r.source_type,
        'notes',                 r.notes,
        'items', COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id',                i.id,
                'materialTypeId',    i.material_type_id,
                'materialName',      i.material_name,
                'standardQuantity',  i.standard_quantity,
                'yieldRate',         i.yield_rate,
                'actualQuantity',    i.actual_quantity,
                'unit',              i.unit,
                'unitPrice',         i.unit_price,
                'taxRate',           i.tax_rate,
                'itemCost',          i.item_cost,
                'materialCategory',  i.material_category,
                'sortOrder',         i.sort_order,
                'isOptional',        i.is_optional,
                'substituteGroup',   i.substitute_group,
                'remark',            i.remark
             ) ORDER BY i.sort_order ASC, i.id ASC)
             FROM bom_recipe_items i
             WHERE i.recipe_id = r.id AND i.deleted_at IS NULL),
            '[]'::jsonb
        ),
        'snapshotTakenAt',  to_jsonb(NOW())::text,
        'backfilled',       to_jsonb(TRUE)
    )                                                    AS snapshot_json,
    CASE
        WHEN r.is_current AND r.status = 'ACTIVE' THEN 'APPROVED'
        WHEN r.is_current                          THEN 'APPROVED'  -- old ACTIVE-equivalent
        ELSE                                            'OBSOLETE'
    END                                                  AS status,
    COALESCE(r.activated_at::date, r.created_at::date)   AS effective_from,
    CASE WHEN r.is_current THEN NULL
         ELSE r.updated_at::date END                     AS effective_to,
    NULL::bigint                                         AS created_by,    -- BomRecipe has no created_by field
    r.activated_by                                        AS approved_by,
    CASE WHEN r.is_current THEN r.activated_at
         ELSE r.activated_at END                          AS approved_at,
    NULL                                                  AS ecn_id,
    NULL                                                  AS rejection_reason,
    r.created_at,
    r.updated_at
FROM bom_recipes r
WHERE r.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM bom_versions v
      WHERE v.factory_id     = r.factory_id
        AND v.bom_recipe_id  = r.id
        AND v.version_number = r.version
        AND v.deleted_at IS NULL
  );

-- Suppress trigger trg_bom_version_supersede re-firing on these backfilled rows:
-- Each (factory_id, bom_recipe_id) is_current=true → 1 APPROVED row only,
-- so partial unique uq_bv_one_current_per_recipe is satisfied. is_current=false
-- rows insert as OBSOLETE — trigger condition `NEW.status = 'APPROVED' AND
-- NEW.effective_to IS NULL` filters them out, no recursive update.

-- ============================================================================
-- Phase 2: BomChangeLog → ECN DRAFT (1 per distinct factory_id + bom_id)
-- ============================================================================
--
-- 注意 BomChangeLog 是 item-level UPDATE log + JSONB old/new snapshot. 不天然对应
-- ECN approval workflow. 此 backfill 仅作历史占位 (status=DRAFT), 让用户在 UI 中
-- finalize/discard. ecn_number 自动 ECN-YYYY-NNNN per factory.

WITH ranked_change_logs AS (
    SELECT
        factory_id,
        bom_id,
        MIN(created_at)        AS first_changed_at,
        MAX(created_at)        AS last_changed_at,
        COUNT(*)               AS change_count,
        string_agg(DISTINCT change_reason, '; ' ORDER BY change_reason) FILTER (WHERE change_reason IS NOT NULL)
                                AS reasons_concat,
        MIN(changed_by)        AS first_changed_by
    FROM bom_change_logs
    WHERE deleted_at IS NULL
      AND bom_id IS NOT NULL
    GROUP BY factory_id, bom_id
),
factory_year_count AS (
    SELECT
        factory_id,
        EXTRACT(YEAR FROM first_changed_at)::int                    AS year,
        ROW_NUMBER() OVER (PARTITION BY factory_id, EXTRACT(YEAR FROM first_changed_at) ORDER BY first_changed_at)
                                                                     AS year_seq,
        bom_id, first_changed_at, last_changed_at, change_count,
        reasons_concat, first_changed_by
    FROM ranked_change_logs
)
INSERT INTO engineering_change_notices (
    id, factory_id, ecn_number, bom_recipe_id,
    from_version, to_version,
    reason, reason_detail, impact_scope, notify_roles, effective_date,
    status, approval_chain_id, created_by, approved_by, approved_at,
    rejection_reason, created_at, updated_at
)
SELECT
    gen_random_uuid()::text                                          AS id,
    f.factory_id,
    'ECN-' || f.year || '-' || lpad(
        ((SELECT COALESCE(MAX(SUBSTRING(ecn_number FROM 'ECN-\d{4}-(\d+)')::int), 0)
          FROM engineering_change_notices
          WHERE factory_id = f.factory_id
            AND ecn_number LIKE 'ECN-' || f.year || '-%') + f.year_seq)::text, 4, '0')
                                                                      AS ecn_number,
    f.bom_id                                                          AS bom_recipe_id,
    NULL::int                                                         AS from_version,
    0                                                                 AS to_version,  -- backfill placeholder
    'PROCESS_IMPROVEMENT'                                             AS reason,      -- conservative default
    LEFT('Backfilled from BomChangeLog ' || f.change_count
         || ' changes. Reasons: '
         || COALESCE(f.reasons_concat, '(none recorded)'), 500)        AS reason_detail,
    jsonb_build_object(
        'backfilled',         true,
        'sourceChangeLogCount', f.change_count,
        'firstChangedAt',     to_jsonb(f.first_changed_at)::text,
        'lastChangedAt',      to_jsonb(f.last_changed_at)::text
    )                                                                  AS impact_scope,
    '["production","procurement","quality","sales"]'::jsonb           AS notify_roles,
    NULL::date                                                         AS effective_date,
    'DRAFT'                                                            AS status,
    NULL                                                               AS approval_chain_id,
    f.first_changed_by                                                AS created_by,
    NULL::bigint                                                       AS approved_by,
    NULL::timestamp                                                    AS approved_at,
    NULL                                                               AS rejection_reason,
    f.first_changed_at                                                AS created_at,
    f.last_changed_at                                                 AS updated_at
FROM factory_year_count f
WHERE NOT EXISTS (
    -- Idempotency: skip if a DRAFT placeholder already exists for this (factory_id, bom_id)
    SELECT 1 FROM engineering_change_notices e
    WHERE e.factory_id    = f.factory_id
      AND e.bom_recipe_id = f.bom_id
      AND e.status        = 'DRAFT'
      AND e.reason_detail LIKE 'Backfilled from BomChangeLog%'
      AND e.deleted_at IS NULL
);

-- ============================================================================
-- Verification queries (run after apply to confirm)
-- ============================================================================

-- Expected: bom_versions.count >= bom_recipes.count (1 per recipe, more if re-versions added)
-- SELECT
--     (SELECT COUNT(*) FROM bom_recipes  WHERE deleted_at IS NULL) AS recipes_alive,
--     (SELECT COUNT(*) FROM bom_versions WHERE deleted_at IS NULL) AS versions_alive;

-- Expected: each is_current=true recipe has exactly 1 APPROVED+effective_to=NULL bom_version
-- SELECT r.id, r.recipe_code, COUNT(v.id) AS approved_current
-- FROM bom_recipes r
-- LEFT JOIN bom_versions v ON v.bom_recipe_id = r.id
--                            AND v.status = 'APPROVED'
--                            AND v.effective_to IS NULL
--                            AND v.deleted_at IS NULL
-- WHERE r.deleted_at IS NULL AND r.is_current = TRUE
-- GROUP BY r.id, r.recipe_code
-- HAVING COUNT(v.id) <> 1;

-- ECN backfill summary:
-- SELECT factory_id, COUNT(*) AS draft_ecns
-- FROM engineering_change_notices
-- WHERE reason_detail LIKE 'Backfilled from BomChangeLog%' AND deleted_at IS NULL
-- GROUP BY factory_id;
