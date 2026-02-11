-- ============================================================
-- Migration: AI Onboarding Wizard
-- Creates factory_feature_config table, extends models, adds JSONB columns
-- ============================================================

-- 1. factory_feature_config table
CREATE TABLE IF NOT EXISTS factory_feature_config (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    module_id VARCHAR(20) NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    conversation_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(factory_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_ffc_factory ON factory_feature_config(factory_id);

COMMENT ON TABLE factory_feature_config IS 'AI onboarding wizard: per-factory module configuration';
COMMENT ON COLUMN factory_feature_config.config IS 'JSONB config: analysisDimensions, benchmarks, inputModes, enabledStages, keyStages, quickActions, disabledScreens, disabledReports';

-- 2. Extend client_requirement_companies for wizard state
ALTER TABLE client_requirement_companies
  ADD COLUMN IF NOT EXISTS wizard_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS industry VARCHAR(50),
  ADD COLUMN IF NOT EXISTS scale VARCHAR(50),
  ADD COLUMN IF NOT EXISTS products TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS selected_modules TEXT,
  ADD COLUMN IF NOT EXISTS conversation_log TEXT,
  ADD COLUMN IF NOT EXISTS module_summaries TEXT;

-- 3. Add custom_fields JSONB to production_batches
ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

COMMENT ON COLUMN production_batches.custom_fields IS 'AI-configured custom fields, e.g. {"drying_temp": 85, "seasoning_code": "A-003"}';

-- 4. Add custom_fields JSONB to quality_inspections
ALTER TABLE quality_inspections
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

COMMENT ON COLUMN quality_inspections.custom_fields IS 'AI-configured custom quality inspection fields';

-- 5. Add custom_fields JSONB to material_batches
ALTER TABLE material_batches
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

COMMENT ON COLUMN material_batches.custom_fields IS 'AI-configured custom material batch fields';
