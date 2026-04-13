-- R10 IT schema — minimal set of tables needed by FactoryConfigServiceImpl#reorderFields.
-- Idempotent drop-and-create so the test suite can re-run without collisions.

DROP TABLE IF EXISTS canvas_dynamic_field CASCADE;
DROP TABLE IF EXISTS factory_module_configs CASCADE;
DROP TABLE IF EXISTS factory_configurations CASCADE;
DROP TABLE IF EXISTS config_change_log CASCADE;
DROP TABLE IF EXISTS module_schemas CASCADE;

CREATE TABLE factory_configurations (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    template_id BIGINT,
    config_version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMP,
    published_by BIGINT,
    rollback_version INTEGER,
    submitted_at TIMESTAMP,
    submitted_by BIGINT,
    reviewed_at TIMESTAMP,
    reviewed_by BIGINT,
    review_notes TEXT,
    row_version BIGINT NOT NULL DEFAULT 0,
    change_summary TEXT,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT idx_fc_factory_version UNIQUE (factory_id, config_version)
);

CREATE INDEX idx_fc_factory_status ON factory_configurations (factory_id, status);

CREATE TABLE factory_module_configs (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    module_code VARCHAR(64) NOT NULL,
    config_version INTEGER NOT NULL DEFAULT 1,
    enabled BOOLEAN NOT NULL DEFAULT true,
    rendering_mode VARCHAR(16) NOT NULL DEFAULT 'LEGACY',
    field_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    workflow_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    validation_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    permission_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    layout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    custom_labels JSONB NOT NULL DEFAULT '{}'::jsonb,
    computed_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT idx_fmc_unique UNIQUE (factory_id, module_code, config_version)
);

CREATE TABLE canvas_dynamic_field (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50),
    module_code VARCHAR(50) NOT NULL,
    field_code VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL,
    label VARCHAR(200) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    visible_when VARCHAR(500),
    computed_when VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING_DDL',
    column_name VARCHAR(100),
    active_from_version INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_cdf_factory_module ON canvas_dynamic_field (factory_id, module_code);
CREATE INDEX idx_cdf_status ON canvas_dynamic_field (status);

CREATE TABLE config_change_log (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    module_code VARCHAR(64),
    operation VARCHAR(32) NOT NULL,
    before_value JSONB,
    after_value JSONB,
    diff_summary TEXT,
    operator_id BIGINT NOT NULL,
    operator_type VARCHAR(16) NOT NULL,
    ai_prompt TEXT,
    created_at TIMESTAMP
);

CREATE TABLE module_schemas (
    id BIGSERIAL PRIMARY KEY,
    module_code VARCHAR(64) NOT NULL UNIQUE,
    module_name VARCHAR(100) NOT NULL,
    module_category VARCHAR(32) NOT NULL,
    module_version INTEGER NOT NULL DEFAULT 1,
    field_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    workflow_schema JSONB DEFAULT '{}'::jsonb,
    validation_schema JSONB DEFAULT '{}'::jsonb,
    permission_schema JSONB DEFAULT '{}'::jsonb,
    default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
