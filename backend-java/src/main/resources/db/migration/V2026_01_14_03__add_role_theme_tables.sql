-- ============================================================
-- V2026_01_14_03__add_role_theme_tables.sql
-- Multi-Role Theme System (Phase 3.5)
-- Support different UI themes and component permissions per role
-- ============================================================

-- ============================================================
-- 1. Role Theme Configuration Table
-- Stores theme colors and brand settings per role
-- ============================================================

CREATE TABLE IF NOT EXISTS lowcode_role_theme (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_code VARCHAR(50) NOT NULL COMMENT 'Role code (e.g., factory_super_admin, dispatcher)',
    factory_id VARCHAR(50) NULL COMMENT 'Factory ID (NULL = global default, non-NULL = factory override)',

    -- Theme Colors (Primary)
    primary_color VARCHAR(20) NOT NULL COMMENT 'Primary color (e.g., #1890FF)',
    secondary_color VARCHAR(20) NULL COMMENT 'Secondary color',
    accent_color VARCHAR(20) NULL COMMENT 'Accent color',
    background_color VARCHAR(20) DEFAULT '#F5F5F5' COMMENT 'Background color',
    surface_color VARCHAR(20) DEFAULT '#FFFFFF' COMMENT 'Surface/card color',
    text_color VARCHAR(20) DEFAULT '#1F2937' COMMENT 'Primary text color',

    -- Semantic Colors
    success_color VARCHAR(20) DEFAULT '#34C759' COMMENT 'Success state color',
    warning_color VARCHAR(20) DEFAULT '#FFCC00' COMMENT 'Warning state color',
    error_color VARCHAR(20) DEFAULT '#FF3B30' COMMENT 'Error state color',

    -- Brand Settings
    logo_url VARCHAR(500) NULL COMMENT 'Role-specific logo URL',
    welcome_text VARCHAR(200) NULL COMMENT 'Welcome message for this role',

    -- Status & Audit
    status TINYINT DEFAULT 1 COMMENT 'Status: 0=inactive, 1=active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE KEY uk_role_factory (role_code, factory_id),
    INDEX idx_factory (factory_id),
    INDEX idx_role_code (role_code),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Role theme configuration table';


-- ============================================================
-- 2. Role Component Permission Table
-- Controls which components each role can view/edit
-- ============================================================

CREATE TABLE IF NOT EXISTS lowcode_role_component_permission (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_code VARCHAR(50) NOT NULL COMMENT 'Role code',
    component_type VARCHAR(100) NOT NULL COMMENT 'Component type (e.g., stats_grid, ai_insight)',
    permission_level VARCHAR(20) NOT NULL COMMENT 'Permission: view, edit, none',
    factory_id VARCHAR(50) NULL COMMENT 'Factory ID (NULL = global setting)',

    -- Audit fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE KEY uk_role_component (role_code, component_type, factory_id),
    INDEX idx_role_code (role_code),
    INDEX idx_factory (factory_id),
    INDEX idx_component_type (component_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Role component permission table';


-- ============================================================
-- 3. Insert Default Theme Presets
-- System-level defaults for each role (factory_id = NULL)
-- ============================================================

INSERT INTO lowcode_role_theme (role_code, factory_id, primary_color, secondary_color, accent_color, welcome_text) VALUES

-- Level 0: Factory Super Admin (Blue - Authority, Global Control)
('factory_super_admin', NULL, '#1890FF', '#5856D6', '#40A9FF', 'Welcome, Factory Administrator'),

-- Level 10: Department Managers
('hr_admin', NULL, '#722ED1', '#B37FEB', '#9254DE', 'Welcome, HR Administrator'),
('dispatcher', NULL, '#13C2C2', '#36CFC9', '#5CDBD3', 'Welcome, Dispatcher'),
('production_manager', NULL, '#52C41A', '#95DE64', '#73D13D', 'Welcome, Production Manager'),
('warehouse_manager', NULL, '#FA8C16', '#FFC53D', '#FFD666', 'Welcome, Warehouse Manager'),
('quality_manager', NULL, '#EB2F96', '#FF85C0', '#F759AB', 'Welcome, Quality Manager'),

-- Level 20: Supervisors
('workshop_supervisor', NULL, '#2F54EB', '#597EF7', '#85A5FF', 'Welcome, Workshop Supervisor'),

-- Level 30: Operators
('operator', NULL, '#1890FF', '#69C0FF', '#91D5FF', 'Welcome, Operator');


-- ============================================================
-- 4. Insert Default Component Permissions
-- Define default permissions for common components per role
-- ============================================================

-- Factory Super Admin - Full access to all components
INSERT INTO lowcode_role_component_permission (role_code, component_type, permission_level, factory_id) VALUES
('factory_super_admin', 'stats_grid', 'edit', NULL),
('factory_super_admin', 'ai_insight', 'edit', NULL),
('factory_super_admin', 'quick_actions', 'edit', NULL),
('factory_super_admin', 'production_overview', 'edit', NULL),
('factory_super_admin', 'quality_summary', 'edit', NULL),
('factory_super_admin', 'inventory_status', 'edit', NULL),
('factory_super_admin', 'hr_summary', 'edit', NULL),
('factory_super_admin', 'dispatch_status', 'edit', NULL),
('factory_super_admin', 'financial_overview', 'edit', NULL),
('factory_super_admin', 'alert_center', 'edit', NULL);

-- HR Admin - HR-focused access
INSERT INTO lowcode_role_component_permission (role_code, component_type, permission_level, factory_id) VALUES
('hr_admin', 'stats_grid', 'view', NULL),
('hr_admin', 'ai_insight', 'view', NULL),
('hr_admin', 'quick_actions', 'edit', NULL),
('hr_admin', 'production_overview', 'view', NULL),
('hr_admin', 'quality_summary', 'none', NULL),
('hr_admin', 'inventory_status', 'none', NULL),
('hr_admin', 'hr_summary', 'edit', NULL),
('hr_admin', 'dispatch_status', 'none', NULL),
('hr_admin', 'financial_overview', 'none', NULL),
('hr_admin', 'alert_center', 'view', NULL);

-- Dispatcher - Dispatch-focused access
INSERT INTO lowcode_role_component_permission (role_code, component_type, permission_level, factory_id) VALUES
('dispatcher', 'stats_grid', 'view', NULL),
('dispatcher', 'ai_insight', 'view', NULL),
('dispatcher', 'quick_actions', 'edit', NULL),
('dispatcher', 'production_overview', 'view', NULL),
('dispatcher', 'quality_summary', 'view', NULL),
('dispatcher', 'inventory_status', 'view', NULL),
('dispatcher', 'hr_summary', 'none', NULL),
('dispatcher', 'dispatch_status', 'edit', NULL),
('dispatcher', 'financial_overview', 'none', NULL),
('dispatcher', 'alert_center', 'view', NULL);

-- Production Manager - Production-focused access
INSERT INTO lowcode_role_component_permission (role_code, component_type, permission_level, factory_id) VALUES
('production_manager', 'stats_grid', 'view', NULL),
('production_manager', 'ai_insight', 'edit', NULL),
('production_manager', 'quick_actions', 'edit', NULL),
('production_manager', 'production_overview', 'edit', NULL),
('production_manager', 'quality_summary', 'view', NULL),
('production_manager', 'inventory_status', 'view', NULL),
('production_manager', 'hr_summary', 'none', NULL),
('production_manager', 'dispatch_status', 'view', NULL),
('production_manager', 'financial_overview', 'none', NULL),
('production_manager', 'alert_center', 'edit', NULL);

-- Warehouse Manager - Inventory-focused access
INSERT INTO lowcode_role_component_permission (role_code, component_type, permission_level, factory_id) VALUES
('warehouse_manager', 'stats_grid', 'view', NULL),
('warehouse_manager', 'ai_insight', 'view', NULL),
('warehouse_manager', 'quick_actions', 'edit', NULL),
('warehouse_manager', 'production_overview', 'view', NULL),
('warehouse_manager', 'quality_summary', 'view', NULL),
('warehouse_manager', 'inventory_status', 'edit', NULL),
('warehouse_manager', 'hr_summary', 'none', NULL),
('warehouse_manager', 'dispatch_status', 'view', NULL),
('warehouse_manager', 'financial_overview', 'none', NULL),
('warehouse_manager', 'alert_center', 'view', NULL);

-- Quality Manager - Quality-focused access
INSERT INTO lowcode_role_component_permission (role_code, component_type, permission_level, factory_id) VALUES
('quality_manager', 'stats_grid', 'view', NULL),
('quality_manager', 'ai_insight', 'edit', NULL),
('quality_manager', 'quick_actions', 'edit', NULL),
('quality_manager', 'production_overview', 'view', NULL),
('quality_manager', 'quality_summary', 'edit', NULL),
('quality_manager', 'inventory_status', 'view', NULL),
('quality_manager', 'hr_summary', 'none', NULL),
('quality_manager', 'dispatch_status', 'none', NULL),
('quality_manager', 'financial_overview', 'none', NULL),
('quality_manager', 'alert_center', 'edit', NULL);

-- Workshop Supervisor - Workshop-focused access
INSERT INTO lowcode_role_component_permission (role_code, component_type, permission_level, factory_id) VALUES
('workshop_supervisor', 'stats_grid', 'view', NULL),
('workshop_supervisor', 'ai_insight', 'view', NULL),
('workshop_supervisor', 'quick_actions', 'edit', NULL),
('workshop_supervisor', 'production_overview', 'view', NULL),
('workshop_supervisor', 'quality_summary', 'view', NULL),
('workshop_supervisor', 'inventory_status', 'view', NULL),
('workshop_supervisor', 'hr_summary', 'none', NULL),
('workshop_supervisor', 'dispatch_status', 'none', NULL),
('workshop_supervisor', 'financial_overview', 'none', NULL),
('workshop_supervisor', 'alert_center', 'view', NULL);

-- Operator - Limited operational access
INSERT INTO lowcode_role_component_permission (role_code, component_type, permission_level, factory_id) VALUES
('operator', 'stats_grid', 'view', NULL),
('operator', 'ai_insight', 'view', NULL),
('operator', 'quick_actions', 'view', NULL),
('operator', 'production_overview', 'view', NULL),
('operator', 'quality_summary', 'none', NULL),
('operator', 'inventory_status', 'none', NULL),
('operator', 'hr_summary', 'none', NULL),
('operator', 'dispatch_status', 'none', NULL),
('operator', 'financial_overview', 'none', NULL),
('operator', 'alert_center', 'view', NULL);
