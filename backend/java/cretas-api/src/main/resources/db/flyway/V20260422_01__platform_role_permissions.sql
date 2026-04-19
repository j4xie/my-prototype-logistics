-- V20260419_01: Platform-level global permission defaults (Layer 1)
-- Auto-generated from PermissionServiceImpl.PERMISSION_MATRIX
-- See: docs/superpowers/specs/2026-04-18-permission-matrix-ai-driven-design.md

CREATE TABLE IF NOT EXISTS platform_role_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_code VARCHAR(64) NOT NULL,
  module_code VARCHAR(32) NOT NULL,
  permission_level VARCHAR(8) NOT NULL CHECK (permission_level IN ('rw','r','w','-')),
  updated_by BIGINT,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL,
  CONSTRAINT uk_role_module UNIQUE(role_code, module_code)
);

CREATE INDEX IF NOT EXISTS idx_platform_role_permissions_role ON platform_role_permissions(role_code);

COMMENT ON TABLE platform_role_permissions IS 'Layer 1: Platform global default permissions. role x module -> level.';
COMMENT ON COLUMN platform_role_permissions.permission_level IS 'rw | r | w | - (none).';

-- Seed data (Phase 2 of permission-matrix rollout)
-- Role: platform_admin
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'dashboard', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'production', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'warehouse', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'quality', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'procurement', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'sales', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'hr', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'equipment', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'finance', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'system', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'analytics', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'scheduling', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'work_report', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'inventory', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'report', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'rd', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('platform_admin', 'restaurant', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: factory_super_admin
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'dashboard', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'production', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'warehouse', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'quality', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'procurement', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'sales', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'hr', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'equipment', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'finance', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'system', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'analytics', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'scheduling', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'work_report', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'inventory', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'report', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'rd', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('factory_super_admin', 'restaurant', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: dispatcher
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'dashboard', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'production', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'warehouse', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'quality', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'procurement', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'sales', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'hr', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'equipment', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'finance', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'system', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'analytics', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'scheduling', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'work_report', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'inventory', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'rd', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('dispatcher', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: production_manager
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'dashboard', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'production', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'warehouse', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'quality', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'procurement', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'sales', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'hr', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'equipment', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'finance', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'system', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'analytics', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'scheduling', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'work_report', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'inventory', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'rd', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('production_manager', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: sales_manager
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'production', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'warehouse', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'sales', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'finance', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'analytics', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'rd', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('sales_manager', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: warehouse_manager
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'dashboard', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'production', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'warehouse', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'procurement', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'sales', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'scheduling', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'inventory', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_manager', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: hr_admin
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'production', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'warehouse', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'hr', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('hr_admin', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: procurement_manager
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'production', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'warehouse', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'procurement', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'finance', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'inventory', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('procurement_manager', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: quality_manager
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'production', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'warehouse', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'quality', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'rd', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_manager', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: equipment_admin
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'production', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'warehouse', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'equipment', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('equipment_admin', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: finance_manager
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'production', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'warehouse', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'procurement', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'sales', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'finance', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'analytics', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'rd', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('finance_manager', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: workshop_supervisor
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'production', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'warehouse', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'quality', 'w') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'hr', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'equipment', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'scheduling', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'work_report', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'rd', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('workshop_supervisor', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: team_leader
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'production', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'warehouse', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'quality', 'w') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'equipment', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'scheduling', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'work_report', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'rd', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('team_leader', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: group_leader
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'production', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'warehouse', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'quality', 'w') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'equipment', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'work_report', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('group_leader', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: quality_inspector
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'production', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'warehouse', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'quality', 'w') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'work_report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('quality_inspector', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: operator
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'production', 'w') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'warehouse', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'work_report', 'w') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('operator', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: warehouse_worker
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'production', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'warehouse', 'w') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'inventory', 'w') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('warehouse_worker', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: restaurant_manager
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'production', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'warehouse', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'procurement', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'finance', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'analytics', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('restaurant_manager', 'restaurant', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: viewer
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'dashboard', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'production', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'warehouse', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'quality', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'procurement', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'sales', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'hr', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'equipment', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'finance', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'analytics', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'scheduling', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'work_report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'inventory', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'rd', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('viewer', 'restaurant', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: permission_admin
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'dashboard', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'production', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'warehouse', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('permission_admin', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: department_admin
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'dashboard', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'production', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'warehouse', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'quality', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'procurement', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'sales', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'hr', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'equipment', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'finance', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'system', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'analytics', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'scheduling', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'work_report', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'inventory', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'report', 'r') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'rd', 'rw') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('department_admin', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

-- Role: unactivated
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'dashboard', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'production', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'warehouse', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'quality', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'procurement', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'sales', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'hr', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'equipment', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'finance', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'system', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'analytics', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'scheduling', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'work_report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'inventory', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'report', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'rd', '-') ON CONFLICT (role_code, module_code) DO NOTHING;
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('unactivated', 'restaurant', '-') ON CONFLICT (role_code, module_code) DO NOTHING;

