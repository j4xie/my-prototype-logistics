-- Create dashboard layout persistence table
-- Run on both prod (smartbi_prod_db) and test (smartbi_db)

CREATE TABLE IF NOT EXISTS smart_bi_dashboard_layouts (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    upload_id BIGINT NOT NULL,
    sheet_index INTEGER NOT NULL DEFAULT 0,
    user_id BIGINT,

    layout_name VARCHAR(100),
    layout_data JSONB NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_factory ON smart_bi_dashboard_layouts(factory_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_upload ON smart_bi_dashboard_layouts(upload_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_unique
    ON smart_bi_dashboard_layouts(factory_id, upload_id, sheet_index, COALESCE(user_id, 0));

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_dashboard_layout_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_dashboard_layout_updated_at ON smart_bi_dashboard_layouts;
CREATE TRIGGER trigger_dashboard_layout_updated_at
    BEFORE UPDATE ON smart_bi_dashboard_layouts
    FOR EACH ROW EXECUTE FUNCTION update_dashboard_layout_updated_at();
