-- V20260409_01__canvas_config_tables.sql
-- Canvas Configuration System — Phase 1 Core Tables

-- 确保 update_updated_at 函数存在 (幂等)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. module_schemas: 平台级模块 Schema 定义
CREATE TABLE IF NOT EXISTS module_schemas (
    id              BIGSERIAL PRIMARY KEY,
    module_code     VARCHAR(64) NOT NULL UNIQUE,
    module_name     VARCHAR(100) NOT NULL,
    module_category VARCHAR(32) NOT NULL,
    module_version  INTEGER NOT NULL DEFAULT 1,
    field_schema    JSONB NOT NULL,
    workflow_schema JSONB,
    validation_schema JSONB,
    permission_schema JSONB,
    default_config  JSONB NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ms_category ON module_schemas(module_category);
CREATE INDEX IF NOT EXISTS idx_ms_active ON module_schemas(is_active);

DROP TRIGGER IF EXISTS trigger_ms_updated_at ON module_schemas;
CREATE TRIGGER trigger_ms_updated_at
BEFORE UPDATE ON module_schemas
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. factory_templates: 行业模板
CREATE TABLE IF NOT EXISTS factory_templates (
    id              BIGSERIAL PRIMARY KEY,
    template_code   VARCHAR(64) NOT NULL UNIQUE,
    template_name   VARCHAR(100) NOT NULL,
    industry_type   VARCHAR(32) NOT NULL,
    description     TEXT,
    base_config     JSONB NOT NULL,
    preview_image   VARCHAR(255),
    usage_count     INTEGER DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      BIGINT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

DROP TRIGGER IF EXISTS trigger_ft_updated_at ON factory_templates;
CREATE TRIGGER trigger_ft_updated_at
BEFORE UPDATE ON factory_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. factory_configurations: 工厂级总配置
CREATE TABLE IF NOT EXISTS factory_configurations (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,
    template_id     BIGINT REFERENCES factory_templates(id),
    config_version  INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    published_at    TIMESTAMP,
    published_by    BIGINT,
    rollback_version INTEGER,
    change_summary  TEXT,
    created_by      BIGINT NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fc_factory_version ON factory_configurations(factory_id, config_version);
CREATE INDEX IF NOT EXISTS idx_fc_factory_status ON factory_configurations(factory_id, status);

DROP TRIGGER IF EXISTS trigger_fc_updated_at ON factory_configurations;
CREATE TRIGGER trigger_fc_updated_at
BEFORE UPDATE ON factory_configurations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. factory_module_configs: 工厂 x 模块配置
CREATE TABLE IF NOT EXISTS factory_module_configs (
    id                  BIGSERIAL PRIMARY KEY,
    factory_id          VARCHAR(50) NOT NULL,
    module_code         VARCHAR(64) NOT NULL,
    config_version      INTEGER NOT NULL DEFAULT 1,
    enabled             BOOLEAN NOT NULL DEFAULT true,
    field_config        JSONB NOT NULL DEFAULT '{}',
    workflow_config     JSONB NOT NULL DEFAULT '{}',
    validation_config   JSONB NOT NULL DEFAULT '{}',
    permission_config   JSONB NOT NULL DEFAULT '{}',
    layout_config       JSONB NOT NULL DEFAULT '{}',
    custom_labels       JSONB NOT NULL DEFAULT '{}',
    computed_fields     JSONB NOT NULL DEFAULT '{}',
    rendering_mode      VARCHAR(16) NOT NULL DEFAULT 'LEGACY',
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fmc_factory_module_version
    ON factory_module_configs(factory_id, module_code, config_version);
CREATE INDEX IF NOT EXISTS idx_fmc_factory ON factory_module_configs(factory_id);

DROP TRIGGER IF EXISTS trigger_fmc_updated_at ON factory_module_configs;
CREATE TRIGGER trigger_fmc_updated_at
BEFORE UPDATE ON factory_module_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. config_change_log: 变更审计
CREATE TABLE IF NOT EXISTS config_change_log (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,
    module_code     VARCHAR(64),
    operation       VARCHAR(32) NOT NULL,
    before_value    JSONB,
    after_value     JSONB,
    diff_summary    TEXT,
    operator_id     BIGINT NOT NULL,
    operator_type   VARCHAR(16) NOT NULL DEFAULT 'USER',
    ai_prompt       TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccl_factory ON config_change_log(factory_id);
CREATE INDEX IF NOT EXISTS idx_ccl_factory_module ON config_change_log(factory_id, module_code);
CREATE INDEX IF NOT EXISTS idx_ccl_created ON config_change_log(created_at);
