-- V20260410_15__canvas_dynamic_field_version_tracking.sql
-- Round 4 Fix P0-5: version tracking for canvas_dynamic_field to support rollback
-- Without this, rolling back from v3 → v2 leaves v3-added fields still ACTIVE
-- producing "ghost fields" in the v2 UI.

ALTER TABLE canvas_dynamic_field
  ADD COLUMN IF NOT EXISTS active_from_version INTEGER;

CREATE INDEX IF NOT EXISTS idx_cdf_active_from_version
  ON canvas_dynamic_field (factory_id, active_from_version)
  WHERE active_from_version IS NOT NULL;

COMMENT ON COLUMN canvas_dynamic_field.active_from_version IS
  'Factory config version at which this field became ACTIVE. Used by rollback to disable future-version fields.';
