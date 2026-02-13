-- ==============================================
-- SmartBI PostgreSQL DDL Script
-- ==============================================
-- Creates tables and indexes for dynamic data storage
-- Uses JSONB with GIN indexes for flexible schema queries
--
-- Database: smartbi_db
-- User: smartbi_user
-- ==============================================

-- Connect to smartbi_db (run as superuser first)
-- CREATE DATABASE smartbi_db;
-- CREATE USER smartbi_user WITH PASSWORD 'your_password_here';
-- GRANT ALL PRIVILEGES ON DATABASE smartbi_db TO smartbi_user;

-- Then connect as smartbi_user or run these commands in smartbi_db:
-- \c smartbi_db

-- ==============================================
-- Table: smart_bi_pg_excel_uploads
-- ==============================================
-- Stores metadata for uploaded Excel files
-- Tracks detected table type and field mappings

CREATE TABLE IF NOT EXISTS smart_bi_pg_excel_uploads (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    file_name VARCHAR(255),
    sheet_name VARCHAR(100),

    -- Dynamically detected metadata (JSONB)
    detected_table_type VARCHAR(50),
    detected_structure JSONB,
    field_mappings JSONB,
    context_info JSONB,

    row_count INT,
    column_count INT,
    upload_status VARCHAR(20) DEFAULT 'PENDING',
    error_message TEXT,
    uploaded_by BIGINT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for upload queries
CREATE INDEX IF NOT EXISTS idx_pg_upload_factory ON smart_bi_pg_excel_uploads (factory_id);
CREATE INDEX IF NOT EXISTS idx_pg_upload_status ON smart_bi_pg_excel_uploads (upload_status);
CREATE INDEX IF NOT EXISTS idx_pg_upload_table_type ON smart_bi_pg_excel_uploads (detected_table_type);
CREATE INDEX IF NOT EXISTS idx_pg_upload_created_at ON smart_bi_pg_excel_uploads (created_at DESC);


-- ==============================================
-- Table: smart_bi_dynamic_data
-- ==============================================
-- Core table for flexible data storage
-- Each row is stored as a complete JSONB document
-- Enables dynamic aggregation using PostgreSQL JSON operators

CREATE TABLE IF NOT EXISTS smart_bi_dynamic_data (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    upload_id BIGINT NOT NULL REFERENCES smart_bi_pg_excel_uploads(id) ON DELETE CASCADE,
    sheet_name VARCHAR(100),
    row_index INT,

    -- Complete row data as JSONB
    -- Example: {"营业收入": 1500000, "部门": "江苏分部", "期间": "2024年"}
    row_data JSONB NOT NULL,

    -- Extracted dimensions for fast filtering
    period VARCHAR(50),
    category VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- B-tree indexes for common filters
CREATE INDEX IF NOT EXISTS idx_dynamic_factory_upload ON smart_bi_dynamic_data (factory_id, upload_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_period ON smart_bi_dynamic_data (factory_id, period);
CREATE INDEX IF NOT EXISTS idx_dynamic_category ON smart_bi_dynamic_data (factory_id, category);

-- GIN index for JSONB queries
-- Supports @> (contains), ? (key exists), ?& (all keys exist), ?| (any key exists)
CREATE INDEX IF NOT EXISTS idx_dynamic_data_row_data ON smart_bi_dynamic_data USING GIN (row_data);

-- Path ops GIN index for specific JSON path queries
-- More efficient for row_data->'key' type queries
CREATE INDEX IF NOT EXISTS idx_dynamic_data_row_data_path ON smart_bi_dynamic_data USING GIN (row_data jsonb_path_ops);


-- ==============================================
-- Table: smart_bi_pg_field_definitions
-- ==============================================
-- Stores field metadata for each upload
-- Defines schema for dynamic data

CREATE TABLE IF NOT EXISTS smart_bi_pg_field_definitions (
    id BIGSERIAL PRIMARY KEY,
    upload_id BIGINT NOT NULL REFERENCES smart_bi_pg_excel_uploads(id) ON DELETE CASCADE,

    original_name VARCHAR(255),
    standard_name VARCHAR(100),
    field_type VARCHAR(50),
    semantic_type VARCHAR(50),
    chart_role VARCHAR(50),

    is_dimension BOOLEAN DEFAULT FALSE,
    is_measure BOOLEAN DEFAULT FALSE,
    is_time BOOLEAN DEFAULT FALSE,

    sample_values JSONB,
    statistics JSONB,
    display_order INT DEFAULT 0,
    format_pattern VARCHAR(50),

    CONSTRAINT uk_pg_field_upload_name UNIQUE (upload_id, original_name)
);

-- Index for field queries
CREATE INDEX IF NOT EXISTS idx_pg_field_upload ON smart_bi_pg_field_definitions (upload_id);


-- ==============================================
-- Table: smart_bi_pg_analysis_results
-- ==============================================
-- Caches AI-generated analysis results
-- Stores insights, chart configs, and KPIs

CREATE TABLE IF NOT EXISTS smart_bi_pg_analysis_results (
    id BIGSERIAL PRIMARY KEY,
    upload_id BIGINT NOT NULL REFERENCES smart_bi_pg_excel_uploads(id) ON DELETE CASCADE,
    factory_id VARCHAR(50) NOT NULL,

    analysis_type VARCHAR(50),  -- 'insight', 'forecast', 'benchmark', 'comparison'
    analysis_result JSONB NOT NULL,
    chart_configs JSONB,
    kpi_values JSONB,
    insights JSONB,
    request_params JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analysis queries
CREATE INDEX IF NOT EXISTS idx_pg_analysis_upload ON smart_bi_pg_analysis_results (upload_id);
CREATE INDEX IF NOT EXISTS idx_pg_analysis_factory ON smart_bi_pg_analysis_results (factory_id);
CREATE INDEX IF NOT EXISTS idx_pg_analysis_type ON smart_bi_pg_analysis_results (analysis_type);


-- ==============================================
-- Trigger: Auto-update updated_at
-- ==============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_excel_uploads_updated_at ON smart_bi_pg_excel_uploads;
CREATE TRIGGER update_excel_uploads_updated_at
    BEFORE UPDATE ON smart_bi_pg_excel_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ==============================================
-- Grant permissions
-- ==============================================

-- Grant permissions to smartbi_user (if not owner)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smartbi_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smartbi_user;


-- ==============================================
-- Example Queries
-- ==============================================

-- 1. Dynamic aggregation by department
-- SELECT
--     row_data->>'部门' as department,
--     SUM(CAST(NULLIF(row_data->>'营业收入', '') AS DECIMAL(18,2))) as revenue
-- FROM smart_bi_dynamic_data
-- WHERE factory_id = 'F001' AND upload_id = 1
-- GROUP BY row_data->>'部门'
-- ORDER BY revenue DESC;

-- 2. JSONB contains query (uses GIN index)
-- SELECT * FROM smart_bi_dynamic_data
-- WHERE factory_id = 'F001'
-- AND row_data @> '{"部门": "江苏分部"}';

-- 3. Get distinct values for a field
-- SELECT DISTINCT row_data->>'部门' as department
-- FROM smart_bi_dynamic_data
-- WHERE factory_id = 'F001' AND upload_id = 1
-- ORDER BY department;

-- 4. Multi-field aggregation
-- SELECT
--     row_data->>'部门' as department,
--     SUM(CAST(NULLIF(row_data->>'营业收入', '') AS DECIMAL(18,2))) as revenue,
--     SUM(CAST(NULLIF(row_data->>'净利润', '') AS DECIMAL(18,2))) as profit
-- FROM smart_bi_dynamic_data
-- WHERE factory_id = 'F001' AND upload_id = 1
-- GROUP BY row_data->>'部门';


-- ==============================================
-- End of DDL Script
-- ==============================================
