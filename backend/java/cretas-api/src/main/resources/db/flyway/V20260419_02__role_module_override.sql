-- V20260419_02: Factory-level role×module permission override (Layer 2)
-- Factory super admin overrides platform defaults via Canvas editor.
-- See: docs/superpowers/specs/2026-04-18-permission-matrix-ai-driven-design.md §4.1

ALTER TABLE factory_module_configs
  ADD COLUMN IF NOT EXISTS role_module_override JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN factory_module_configs.role_module_override IS
  'Layer 2: Factory-level role x module permission override. Format: {"role_code":{"module_code":"rw|r|w|-"}}. Missing combos fall back to platform_role_permissions.';

CREATE INDEX IF NOT EXISTS idx_factory_module_configs_override_gin
  ON factory_module_configs USING gin (role_module_override);
