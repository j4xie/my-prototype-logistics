-- ============================================================================
-- Track A Project 3 (C-CANVAS-REPO): migrate legacy Tool-written layouts
-- ============================================================================
-- Background
-- ----------
-- Prior to this migration, the three decoration Tools (HomeLayoutGenerateTool,
-- HomeLayoutUpdateTool, HomeLayoutSuggestTool) persisted their generated
-- layouts at `factory_settings.ai_settings -> 'homeLayout'` (a JSON path
-- inside a JSON column). DecorationServiceImpl.getHomeLayout (which feeds the
-- frontend FAHomeScreen renderer) reads from `factory_home_layout.modules_config`
-- in a different table. The two paths never reconciled, so Tool output never
-- reached the UI.
--
-- This migration is a one-shot backfill that copies any existing Tool-written
-- layout from factory_settings into factory_home_layout so end users do not
-- lose their tool-generated configurations after the swap.
--
-- Safety
-- ------
-- 1. The migration is **idempotent**: WHERE NOT EXISTS guards prevent
--    duplicate inserts on re-run.
-- 2. Existing `factory_home_layout` rows are NEVER overwritten — operator
--    configurations win over Tool-generated drafts.
-- 3. The source key `factory_settings.ai_settings.homeLayout` is left in
--    place; Tools simply stop writing it. Operators can manually clean it
--    later if desired.
-- 4. Wraps the flat [] array under {"modules": [...]} so the schema matches
--    what DecorationServiceImpl.parseModules expects.
-- ============================================================================

-- 1) INSERT new factory_home_layout rows for factories that have a
--    Tool-written layout but no factory_home_layout row yet.
INSERT INTO factory_home_layout (
    factory_id,
    modules_config,
    theme_config,
    status,
    version,
    ai_generated,
    grid_columns,
    time_based_enabled,
    created_at,
    updated_at
)
SELECT
    fs.factory_id,
    jsonb_build_object(
        'modules',
        COALESCE(fs.ai_settings::jsonb -> 'homeLayout', '[]'::jsonb)
    ),
    '{}',
    0,                                    -- status: 0 = 草稿 (operator promotes via UI)
    1,                                    -- version
    1,                                    -- ai_generated
    2,                                    -- grid_columns: 2-column Bento default
    0,                                    -- time_based_enabled: off
    NOW(),
    NOW()
FROM factory_settings fs
WHERE fs.ai_settings IS NOT NULL
  AND jsonb_typeof(fs.ai_settings::jsonb -> 'homeLayout') = 'array'
  AND jsonb_array_length(fs.ai_settings::jsonb -> 'homeLayout') > 0
  AND NOT EXISTS (
      SELECT 1 FROM factory_home_layout fhl
      WHERE fhl.factory_id = fs.factory_id
  );

-- 2) (No DROP) — `factory_settings.ai_settings.homeLayout` left in place for
--    rollback safety. The Tools have been updated to ignore this key going
--    forward. Operators may purge the orphan key after a soak period via:
--
--    UPDATE factory_settings
--       SET ai_settings = (ai_settings::jsonb - 'homeLayout')::text
--     WHERE ai_settings::jsonb ? 'homeLayout';
