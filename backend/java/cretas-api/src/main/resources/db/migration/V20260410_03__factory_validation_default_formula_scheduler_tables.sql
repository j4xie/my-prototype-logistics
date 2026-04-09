-- V20260410_03__factory_validation_default_formula_scheduler_tables.sql
-- Canvas V2 Phase 2b: Business logic externalization tables

CREATE TABLE IF NOT EXISTS factory_validation_rules (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),
    module_code     VARCHAR(64) NOT NULL,
    rule_code       VARCHAR(64) NOT NULL,
    operation       VARCHAR(32),
    condition       TEXT NOT NULL,
    error_message   TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    severity        VARCHAR(16) NOT NULL DEFAULT 'BLOCK',
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fvr_factory_module_rule ON factory_validation_rules(factory_id, module_code, rule_code);
CREATE INDEX IF NOT EXISTS idx_fvr_factory_module_op ON factory_validation_rules(factory_id, module_code, operation);
DROP TRIGGER IF EXISTS trigger_fvr_updated_at ON factory_validation_rules;
CREATE TRIGGER trigger_fvr_updated_at BEFORE UPDATE ON factory_validation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS factory_default_values (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),
    module_code     VARCHAR(64) NOT NULL,
    field_code      VARCHAR(64) NOT NULL,
    default_value   JSONB NOT NULL,
    condition       TEXT,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fdv_factory_module ON factory_default_values(factory_id, module_code);
CREATE INDEX IF NOT EXISTS idx_fdv_factory_module_field ON factory_default_values(factory_id, module_code, field_code);
DROP TRIGGER IF EXISTS trigger_fdv_updated_at ON factory_default_values;
CREATE TRIGGER trigger_fdv_updated_at BEFORE UPDATE ON factory_default_values FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS factory_formulas (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),
    module_code     VARCHAR(64) NOT NULL,
    formula_code    VARCHAR(64) NOT NULL,
    expression      TEXT NOT NULL,
    variables       JSONB,
    result_type     VARCHAR(20) DEFAULT 'DECIMAL',
    precision_val   INTEGER DEFAULT 2,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ff_factory_module_formula ON factory_formulas(factory_id, module_code, formula_code);
DROP TRIGGER IF EXISTS trigger_ff_updated_at ON factory_formulas;
CREATE TRIGGER trigger_ff_updated_at BEFORE UPDATE ON factory_formulas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS factory_scheduler_configs (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),
    task_code       VARCHAR(64) NOT NULL,
    cron_expression VARCHAR(50) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    tool_or_method  VARCHAR(100),
    params          JSONB NOT NULL DEFAULT '{}',
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fschd_factory_task ON factory_scheduler_configs(factory_id, task_code);
DROP TRIGGER IF EXISTS trigger_fschd_updated_at ON factory_scheduler_configs;
CREATE TRIGGER trigger_fschd_updated_at BEFORE UPDATE ON factory_scheduler_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cretas_user') THEN
        GRANT ALL ON TABLE factory_validation_rules, factory_default_values, factory_formulas, factory_scheduler_configs TO cretas_user;
        GRANT ALL ON SEQUENCE factory_validation_rules_id_seq, factory_default_values_id_seq, factory_formulas_id_seq, factory_scheduler_configs_id_seq TO cretas_user;
    END IF;
END $$;
