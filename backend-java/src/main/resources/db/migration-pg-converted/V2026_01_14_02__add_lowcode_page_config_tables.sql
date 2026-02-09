-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_14_02__add_lowcode_page_config_tables.sql
-- Conversion date: 2026-01-26 18:48:15
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- V2026_01_14_02__add_lowcode_page_config_tables.sql
-- Phase 3: Lowcode Page Configuration System Tables
-- ============================================================

-- ============================================================
-- 1. lowcode_page_config - General Page Configuration Table
-- Supports any page type: home, dashboard, form, list, detail
-- ============================================================
CREATE TABLE IF NOT EXISTS lowcode_page_config (
    id BIGSERIAL PRIMARY KEY,
    page_id VARCHAR(100) NOT NULL COMMENT 'Unique page identifier (e.g., home, dashboard, material-list)',
    factory_id VARCHAR(50) NOT NULL COMMENT 'Factory ID',
    page_type VARCHAR(50) NOT NULL COMMENT 'Page type: home/dashboard/form/list/detail',
    page_name VARCHAR(100) COMMENT 'Display name of the page',

    -- Layout and Theme Configuration
    layout_config JSON NOT NULL COMMENT 'Layout configuration JSON (modules, positions, sizes)',
    theme_config JSON COMMENT 'Theme configuration JSON (colors, fonts, spacing)',
    data_bindings JSON COMMENT 'Data binding configuration JSON (API endpoints, stores)',
    event_handlers JSON COMMENT 'Event handler configuration JSON (onClick, onRefresh)',
    permissions JSON COMMENT 'Permission configuration JSON (roles, actions)',

    -- Status and Version
    status SMALLINT DEFAULT 0 COMMENT 'Status: 0=draft, 1=published',
    version INT DEFAULT 1 COMMENT 'Version number',
    ai_generated SMALLINT DEFAULT 0 COMMENT 'AI generated: 0=no, 1=yes',
    ai_prompt TEXT COMMENT 'AI generation prompt',

    -- Inheritance
    parent_config_id BIGINT COMMENT 'Parent config ID for inheritance',

    -- Audit Fields
    created_by BIGINT COMMENT 'Creator user ID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    -- Unique constraint: one page per factory
    UNIQUE KEY uk_factory_page (factory_id, page_id),

    -- Indexes
    INDEX idx_lowcode_page_factory_type (factory_id, page_type),
    INDEX idx_lowcode_page_status (status),
    INDEX idx_lowcode_page_parent (parent_config_id),

    -- Foreign Key
    CONSTRAINT fk_lowcode_page_parent FOREIGN KEY (parent_config_id)
        REFERENCES lowcode_page_config(id) ON DELETE SET NULL
)
;

-- ============================================================
-- 2. lowcode_component_definition - Component Definition Table
-- Defines all available components in the lowcode system
-- ============================================================
CREATE TABLE IF NOT EXISTS lowcode_component_definition (
    id BIGSERIAL PRIMARY KEY,
    component_type VARCHAR(100) NOT NULL COMMENT 'Unique component type identifier',
    name VARCHAR(100) NOT NULL COMMENT 'Display name',
    category VARCHAR(50) NOT NULL COMMENT 'Category: stats/navigation/data/chart/form/layout',
    icon VARCHAR(50) COMMENT 'Icon name (e.g., chart-bar, table, card)',

    -- Component Implementation
    component_path VARCHAR(200) COMMENT 'Component import path (e.g., @/components/StatsCard)',
    props_schema JSON NOT NULL COMMENT 'Props schema JSON (Formily schema format)',
    default_props JSON COMMENT 'Default props JSON',

    -- Layout Constraints
    size_constraints JSON COMMENT 'Size constraints JSON: {minW, maxW, minH, maxH, defaultW, defaultH}',

    -- Data and Events
    data_requirements JSON COMMENT 'Data requirements JSON (API endpoints, data shape)',
    supported_events JSON COMMENT 'Supported events JSON (onClick, onRefresh, onDataLoad)',

    -- AI Support
    ai_description TEXT COMMENT 'AI-friendly description for page generation',
    applicable_page_types JSON COMMENT 'Applicable page types JSON array (home, dashboard, etc.)',

    -- Display and Status
    sort_order INT DEFAULT 0 COMMENT 'Sort order in component palette',
    status SMALLINT DEFAULT 1 COMMENT 'Status: 0=disabled, 1=enabled',
    is_system SMALLINT DEFAULT 1 COMMENT 'System component: 0=custom, 1=system',
    factory_id VARCHAR(50) COMMENT 'Factory ID for custom components (NULL=system)',

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    -- Unique constraint
    UNIQUE KEY uk_component_type_factory (component_type, factory_id),

    -- Indexes
    INDEX idx_component_category (category),
    INDEX idx_component_status (status),
    INDEX idx_component_factory (factory_id)
)
;

-- ============================================================
-- 3. Insert Sample Component Definitions
-- ============================================================

-- Stats Card Component
INSERT INTO lowcode_component_definition (
    component_type, name, category, icon, component_path,
    props_schema, default_props, size_constraints, data_requirements, supported_events,
    ai_description, applicable_page_types, sort_order, status, is_system
) VALUES (
    'stats_card', 'Stats Card', 'stats', 'chart-bar',
    '@/components/home/StatsCard',
    '{
        "type": "object",
        "properties": {
            "title": {"type": "string", "title": "Card Title", "default": "Statistics"},
            "showTrend": {"type": "boolean", "title": "Show Trend", "default": true},
            "trendPeriod": {"type": "string", "title": "Trend Period", "enum": ["day", "week", "month"], "default": "day"},
            "refreshInterval": {"type": "number", "title": "Refresh Interval (sec)", "default": 60, "minimum": 10},
            "columns": {"type": "number", "title": "Columns", "enum": [1, 2, 3, 4], "default": 2}
        }
    }',
    '{"title": "Overview", "showTrend": true, "trendPeriod": "day", "refreshInterval": 60, "columns": 2}',
    '{"minW": 1, "maxW": 2, "minH": 1, "maxH": 2, "defaultW": 2, "defaultH": 1}',
    '{"apiEndpoint": "/api/mobile/{factoryId}/dashboard/stats", "dataShape": {"value": "number", "trend": "number", "label": "string"}}',
    '["onRefresh", "onPress"]',
    'Displays key statistics with optional trend indicators. Use for showing numeric KPIs like total orders, revenue, or production count.',
    '["home", "dashboard"]',
    10, 1, 1
);

-- Welcome Card Component
INSERT INTO lowcode_component_definition (
    component_type, name, category, icon, component_path,
    props_schema, default_props, size_constraints, data_requirements, supported_events,
    ai_description, applicable_page_types, sort_order, status, is_system
) VALUES (
    'welcome_card', 'Welcome Card', 'navigation', 'user',
    '@/components/home/WelcomeCard',
    '{
        "type": "object",
        "properties": {
            "showAvatar": {"type": "boolean", "title": "Show Avatar", "default": true},
            "showDate": {"type": "boolean", "title": "Show Date", "default": true},
            "showWeather": {"type": "boolean", "title": "Show Weather", "default": false},
            "greeting": {"type": "string", "title": "Custom Greeting", "default": ""}
        }
    }',
    '{"showAvatar": true, "showDate": true, "showWeather": false, "greeting": ""}',
    '{"minW": 2, "maxW": 2, "minH": 1, "maxH": 1, "defaultW": 2, "defaultH": 1}',
    '{"storeSelector": "authStore.user", "dataShape": {"name": "string", "role": "string", "avatar": "string"}}',
    '["onPress"]',
    'Personalized welcome banner with user info and date. Always place at the top of home page.',
    '["home"]',
    1, 1, 1
);

-- AI Insight Component
INSERT INTO lowcode_component_definition (
    component_type, name, category, icon, component_path,
    props_schema, default_props, size_constraints, data_requirements, supported_events,
    ai_description, applicable_page_types, sort_order, status, is_system
) VALUES (
    'ai_insight', 'AI Insight', 'stats', 'sparkles',
    '@/components/home/AIInsight',
    '{
        "type": "object",
        "properties": {
            "showMetrics": {"type": "boolean", "title": "Show Metrics", "default": true},
            "autoRefresh": {"type": "boolean", "title": "Auto Refresh", "default": false},
            "refreshInterval": {"type": "number", "title": "Refresh Interval (sec)", "default": 300, "minimum": 60},
            "maxInsights": {"type": "number", "title": "Max Insights", "default": 3, "minimum": 1, "maximum": 5}
        }
    }',
    '{"showMetrics": true, "autoRefresh": false, "refreshInterval": 300, "maxInsights": 3}',
    '{"minW": 1, "maxW": 2, "minH": 1, "maxH": 2, "defaultW": 2, "defaultH": 1}',
    '{"apiEndpoint": "/api/mobile/{factoryId}/ai/insights", "dataShape": {"insights": "array", "metrics": "object"}}',
    '["onRefresh", "onInsightPress"]',
    'AI-generated insights and recommendations. Shows intelligent analysis of factory data and actionable suggestions.',
    '["home", "dashboard"]',
    20, 1, 1
);

-- Quick Actions Component
INSERT INTO lowcode_component_definition (
    component_type, name, category, icon, component_path,
    props_schema, default_props, size_constraints, data_requirements, supported_events,
    ai_description, applicable_page_types, sort_order, status, is_system
) VALUES (
    'quick_actions', 'Quick Actions', 'navigation', 'zap',
    '@/components/home/QuickActions',
    '{
        "type": "object",
        "properties": {
            "maxItems": {"type": "number", "title": "Max Items", "default": 4, "minimum": 2, "maximum": 8},
            "layout": {"type": "string", "title": "Layout", "enum": ["grid", "list", "carousel"], "default": "grid"},
            "showLabels": {"type": "boolean", "title": "Show Labels", "default": true},
            "iconSize": {"type": "string", "title": "Icon Size", "enum": ["small", "medium", "large"], "default": "medium"}
        }
    }',
    '{"maxItems": 4, "layout": "grid", "showLabels": true, "iconSize": "medium"}',
    '{"minW": 1, "maxW": 2, "minH": 1, "maxH": 2, "defaultW": 2, "defaultH": 1}',
    '{"storeSelector": "navigationStore.quickActions", "dataShape": {"actions": "array"}}',
    '["onActionPress"]',
    'Grid of frequently used action buttons. Provides quick access to common operations like new order, scan, or reports.',
    '["home"]',
    30, 1, 1
);

-- Bar Chart Component
INSERT INTO lowcode_component_definition (
    component_type, name, category, icon, component_path,
    props_schema, default_props, size_constraints, data_requirements, supported_events,
    ai_description, applicable_page_types, sort_order, status, is_system
) VALUES (
    'chart_bar', 'Bar Chart', 'chart', 'bar-chart',
    '@/components/charts/BarChart',
    '{
        "type": "object",
        "properties": {
            "title": {"type": "string", "title": "Chart Title", "default": "Bar Chart"},
            "xAxisLabel": {"type": "string", "title": "X Axis Label", "default": ""},
            "yAxisLabel": {"type": "string", "title": "Y Axis Label", "default": ""},
            "showLegend": {"type": "boolean", "title": "Show Legend", "default": true},
            "horizontal": {"type": "boolean", "title": "Horizontal", "default": false},
            "stacked": {"type": "boolean", "title": "Stacked", "default": false},
            "colors": {"type": "array", "title": "Colors", "items": {"type": "string"}, "default": ["#1890FF", "#52C41A", "#FAAD14"]}
        }
    }',
    '{"title": "Bar Chart", "showLegend": true, "horizontal": false, "stacked": false, "colors": ["#1890FF", "#52C41A", "#FAAD14"]}',
    '{"minW": 1, "maxW": 2, "minH": 1, "maxH": 2, "defaultW": 2, "defaultH": 2}',
    '{"apiEndpoint": "/api/mobile/{factoryId}/reports/chart-data", "dataShape": {"labels": "array", "datasets": "array"}}',
    '["onRefresh", "onBarPress"]',
    'Bar chart for comparing categorical data. Use for production by category, daily output comparison, or inventory levels.',
    '["dashboard", "report"]',
    40, 1, 1
);

-- Line Chart Component
INSERT INTO lowcode_component_definition (
    component_type, name, category, icon, component_path,
    props_schema, default_props, size_constraints, data_requirements, supported_events,
    ai_description, applicable_page_types, sort_order, status, is_system
) VALUES (
    'chart_line', 'Line Chart', 'chart', 'trending-up',
    '@/components/charts/LineChart',
    '{
        "type": "object",
        "properties": {
            "title": {"type": "string", "title": "Chart Title", "default": "Line Chart"},
            "xAxisLabel": {"type": "string", "title": "X Axis Label", "default": ""},
            "yAxisLabel": {"type": "string", "title": "Y Axis Label", "default": ""},
            "showLegend": {"type": "boolean", "title": "Show Legend", "default": true},
            "smooth": {"type": "boolean", "title": "Smooth Lines", "default": true},
            "showPoints": {"type": "boolean", "title": "Show Data Points", "default": true},
            "fillArea": {"type": "boolean", "title": "Fill Area", "default": false},
            "colors": {"type": "array", "title": "Colors", "items": {"type": "string"}, "default": ["#1890FF", "#52C41A"]}
        }
    }',
    '{"title": "Line Chart", "showLegend": true, "smooth": true, "showPoints": true, "fillArea": false, "colors": ["#1890FF", "#52C41A"]}',
    '{"minW": 1, "maxW": 2, "minH": 1, "maxH": 2, "defaultW": 2, "defaultH": 2}',
    '{"apiEndpoint": "/api/mobile/{factoryId}/reports/trend-data", "dataShape": {"labels": "array", "datasets": "array"}}',
    '["onRefresh", "onPointPress"]',
    'Line chart for showing trends over time. Use for production trends, sales over time, or efficiency metrics.',
    '["dashboard", "report"]',
    41, 1, 1
);

-- Data Table Component
INSERT INTO lowcode_component_definition (
    component_type, name, category, icon, component_path,
    props_schema, default_props, size_constraints, data_requirements, supported_events,
    ai_description, applicable_page_types, sort_order, status, is_system
) VALUES (
    'data_table', 'Data Table', 'data', 'table',
    '@/components/data/DataTable',
    '{
        "type": "object",
        "properties": {
            "title": {"type": "string", "title": "Table Title", "default": "Data Table"},
            "columns": {"type": "array", "title": "Columns", "items": {"type": "object"}, "default": []},
            "pageSize": {"type": "number", "title": "Page Size", "enum": [5, 10, 20, 50], "default": 10},
            "showPagination": {"type": "boolean", "title": "Show Pagination", "default": true},
            "showSearch": {"type": "boolean", "title": "Show Search", "default": true},
            "sortable": {"type": "boolean", "title": "Sortable", "default": true},
            "selectable": {"type": "boolean", "title": "Selectable Rows", "default": false},
            "stickyHeader": {"type": "boolean", "title": "Sticky Header", "default": true}
        }
    }',
    '{"title": "Data Table", "pageSize": 10, "showPagination": true, "showSearch": true, "sortable": true, "selectable": false, "stickyHeader": true}',
    '{"minW": 2, "maxW": 2, "minH": 1, "maxH": 3, "defaultW": 2, "defaultH": 2}',
    '{"apiEndpoint": "/api/mobile/{factoryId}/data", "dataShape": {"rows": "array", "total": "number", "columns": "array"}}',
    '["onRefresh", "onRowPress", "onSearch", "onSort", "onPageChange"]',
    'Scrollable data table with pagination. Use for displaying lists of orders, materials, batches, or any tabular data.',
    '["list", "dashboard", "report"]',
    50, 1, 1
);

-- ============================================================
-- 4. Add PAGE_DESIGN Intent Configurations
-- ============================================================

INSERT INTO ai_intent_configs (id, factory_id, intent_code, intent_name, intent_category, sensitivity_level, keywords, description, is_active, created_at, updated_at)
VALUES
(UUID(), NULL, 'PAGE_GENERATE', 'AI Page Generation', 'PAGE_DESIGN', 'MEDIUM',
 '["generate page", "create page", "design page", "make page", "build page", "new page", "generate layout", "create layout"]',
 'Generate page layout configuration based on user description using AI', 1, NOW(), NOW()),

(UUID(), NULL, 'PAGE_COMPONENT_ADD', 'Add Component', 'PAGE_DESIGN', 'LOW',
 '["add", "insert", "put", "place", "include", "add component", "add module", "add card", "add chart"]',
 'Add a specified component to the page layout', 1, NOW(), NOW()),

(UUID(), NULL, 'PAGE_STYLE_UPDATE', 'Update Page Style', 'PAGE_DESIGN', 'LOW',
 '["change color", "update style", "change theme", "modify appearance", "change look", "style", "color", "theme"]',
 'Update page or component styling and theme', 1, NOW(), NOW()),

(UUID(), NULL, 'PAGE_DATA_BIND', 'Data Binding', 'PAGE_DESIGN', 'MEDIUM',
 '["bind data", "connect api", "fetch data", "show data", "link data", "data source", "api endpoint"]',
 'Bind component to data source (API or store)', 1, NOW(), NOW());
