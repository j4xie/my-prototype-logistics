CREATE TABLE IF NOT EXISTS canvas_dynamic_field (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id      VARCHAR(50),
    module_code     VARCHAR(50) NOT NULL,
    field_code      VARCHAR(100) NOT NULL,
    field_type      VARCHAR(20) NOT NULL,
    label           VARCHAR(200) NOT NULL,
    config          JSONB DEFAULT '{}',
    visible_when    VARCHAR(500),
    computed_when   VARCHAR(500),
    sort_order      INT DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'PENDING_DDL',
    column_name     VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(factory_id, module_code, field_code)
);

CREATE INDEX idx_cdf_factory_module ON canvas_dynamic_field(factory_id, module_code);
CREATE INDEX idx_cdf_status ON canvas_dynamic_field(status);
