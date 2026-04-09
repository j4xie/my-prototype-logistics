-- V20260410_01__factory_tool_skill_trigger_tables.sql
-- Canvas V2 Phase 2a: Factory-level Tool, Skill, and Trigger Chain configs

-- 1. factory_tool_configs: per-factory tool enable/disable
CREATE TABLE IF NOT EXISTS factory_tool_configs (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,
    tool_name       VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    param_overrides JSONB NOT NULL DEFAULT '{}',
    risk_override   VARCHAR(20),
    custom_description TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ftc_factory_tool
    ON factory_tool_configs(factory_id, tool_name);
CREATE INDEX IF NOT EXISTS idx_ftc_factory ON factory_tool_configs(factory_id);

DROP TRIGGER IF EXISTS trigger_ftc_updated_at ON factory_tool_configs;
CREATE TRIGGER trigger_ftc_updated_at
BEFORE UPDATE ON factory_tool_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. factory_skill_configs: per-factory skill enable/disable + custom DAG
CREATE TABLE IF NOT EXISTS factory_skill_configs (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,
    skill_name      VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    custom_dag      JSONB,
    custom_triggers JSONB,
    priority        INTEGER DEFAULT 100,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fsc_factory_skill
    ON factory_skill_configs(factory_id, skill_name);
CREATE INDEX IF NOT EXISTS idx_fsc_factory ON factory_skill_configs(factory_id);

DROP TRIGGER IF EXISTS trigger_fsc_updated_at ON factory_skill_configs;
CREATE TRIGGER trigger_fsc_updated_at
BEFORE UPDATE ON factory_skill_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. factory_trigger_chains: configurable event→tool sequences
CREATE TABLE IF NOT EXISTS factory_trigger_chains (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),
    chain_code      VARCHAR(64) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    steps           JSONB NOT NULL DEFAULT '[]',
    error_strategy  VARCHAR(20) NOT NULL DEFAULT 'CONTINUE',
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ftch_factory_chain
    ON factory_trigger_chains(factory_id, chain_code);
CREATE INDEX IF NOT EXISTS idx_ftch_event ON factory_trigger_chains(event_type);
CREATE INDEX IF NOT EXISTS idx_ftch_factory ON factory_trigger_chains(factory_id);

DROP TRIGGER IF EXISTS trigger_ftch_updated_at ON factory_trigger_chains;
CREATE TRIGGER trigger_ftch_updated_at
BEFORE UPDATE ON factory_trigger_chains
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Grant permissions to cretas_user
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cretas_user') THEN
        GRANT ALL ON TABLE factory_tool_configs, factory_skill_configs, factory_trigger_chains TO cretas_user;
        GRANT ALL ON SEQUENCE factory_tool_configs_id_seq, factory_skill_configs_id_seq, factory_trigger_chains_id_seq TO cretas_user;
    END IF;
END $$;
