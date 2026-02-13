-- =====================================================
-- Production Alerts & Evidence Photos for PostgreSQL
-- Creates: production_alerts, alert_thresholds, batch_evidence_photos
-- Includes seed data for alert_thresholds (factory F001)
-- =====================================================

-- 1. production_alerts - Real-time production anomaly alerts
--    Alert types: YIELD_DROP, COST_SPIKE, OEE_LOW, QUALITY_FAIL
--    Lifecycle: ACTIVE -> ACKNOWLEDGED -> RESOLVED -> VERIFIED
CREATE TABLE IF NOT EXISTS production_alerts (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    metric_name VARCHAR(100) NOT NULL,
    current_value DOUBLE PRECISION,
    baseline_value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    deviation_percent DOUBLE PRECISION,
    batch_id BIGINT,
    equipment_id VARCHAR(100),
    product_name VARCHAR(255),
    description TEXT,
    ai_analysis TEXT,
    resolution_notes TEXT,
    acknowledged_by BIGINT,
    acknowledged_at TIMESTAMP WITHOUT TIME ZONE,
    resolved_by BIGINT,
    resolved_at TIMESTAMP WITHOUT TIME ZONE,
    verified_at TIMESTAMP WITHOUT TIME ZONE,
    auto_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITHOUT TIME ZONE
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_production_alerts_factory ON production_alerts(factory_id);
CREATE INDEX IF NOT EXISTS idx_production_alerts_status ON production_alerts(status);
CREATE INDEX IF NOT EXISTS idx_production_alerts_level ON production_alerts(level);
CREATE INDEX IF NOT EXISTS idx_production_alerts_type ON production_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_production_alerts_created ON production_alerts(created_at);

-- Composite index for dashboard queries (factory + status + level)
CREATE INDEX IF NOT EXISTS idx_production_alerts_dashboard ON production_alerts(factory_id, status, level);


-- 2. alert_thresholds - Configurable threshold definitions per factory
--    Supports both static thresholds and dynamic deviation-based thresholds
CREATE TABLE IF NOT EXISTS alert_thresholds (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL,
    comparison VARCHAR(20) NOT NULL,
    static_threshold DOUBLE PRECISION,
    deviation_percent DOUBLE PRECISION,
    baseline_days INTEGER DEFAULT 30,
    enabled BOOLEAN DEFAULT true,
    description VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint: one threshold per (factory, metric, alert_type)
DO $$ BEGIN
    ALTER TABLE alert_thresholds
        ADD CONSTRAINT uk_alert_thresholds_factory_metric_type
        UNIQUE (factory_id, metric_name, alert_type);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_alert_thresholds_factory ON alert_thresholds(factory_id);
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_enabled ON alert_thresholds(factory_id, enabled);


-- 3. Seed data for alert_thresholds (factory F001 defaults)
--    These define the baseline alerting rules for the production monitoring system

-- Yield rate critical: absolute floor at 90%
INSERT INTO alert_thresholds (factory_id, metric_name, alert_type, level, comparison, static_threshold, deviation_percent, baseline_days, enabled, description)
VALUES ('F001', 'yield_rate', 'YIELD_DROP', 'CRITICAL', 'LESS_THAN', 90.0, NULL, 30, true, '良品率低于90%触发严重警报')
ON CONFLICT (factory_id, metric_name, alert_type) DO NOTHING;

-- Yield rate warning: 15% deviation below rolling 30-day baseline
INSERT INTO alert_thresholds (factory_id, metric_name, alert_type, level, comparison, static_threshold, deviation_percent, baseline_days, enabled, description)
VALUES ('F001', 'yield_rate', 'YIELD_DROP', 'WARNING', 'DEVIATION_BELOW', NULL, 15.0, 30, true, '良品率偏离30天基线15%以上触发预警')
ON CONFLICT (factory_id, metric_name, alert_type) DO NOTHING;

-- Unit cost warning: 20% deviation above rolling 30-day baseline
INSERT INTO alert_thresholds (factory_id, metric_name, alert_type, level, comparison, static_threshold, deviation_percent, baseline_days, enabled, description)
VALUES ('F001', 'unit_cost', 'COST_SPIKE', 'WARNING', 'DEVIATION_ABOVE', NULL, 20.0, 30, true, '单位成本偏离30天基线20%以上触发预警')
ON CONFLICT (factory_id, metric_name, alert_type) DO NOTHING;

-- OEE warning: absolute floor at 65%
INSERT INTO alert_thresholds (factory_id, metric_name, alert_type, level, comparison, static_threshold, deviation_percent, baseline_days, enabled, description)
VALUES ('F001', 'oee', 'OEE_LOW', 'WARNING', 'LESS_THAN', 65.0, NULL, 30, true, 'OEE低于65%触发预警')
ON CONFLICT (factory_id, metric_name, alert_type) DO NOTHING;

-- Quality pass rate critical: absolute floor at 95%
INSERT INTO alert_thresholds (factory_id, metric_name, alert_type, level, comparison, static_threshold, deviation_percent, baseline_days, enabled, description)
VALUES ('F001', 'quality_pass_rate', 'QUALITY_FAIL', 'CRITICAL', 'LESS_THAN', 95.0, NULL, 30, true, '质检合格率低于95%触发严重警报')
ON CONFLICT (factory_id, metric_name, alert_type) DO NOTHING;

-- Defect rate warning: absolute ceiling at 5%
INSERT INTO alert_thresholds (factory_id, metric_name, alert_type, level, comparison, static_threshold, deviation_percent, baseline_days, enabled, description)
VALUES ('F001', 'defect_rate', 'QUALITY_FAIL', 'WARNING', 'GREATER_THAN', 5.0, NULL, 30, true, '缺陷率超过5%触发预警')
ON CONFLICT (factory_id, metric_name, alert_type) DO NOTHING;


-- 4. batch_evidence_photos - Photo evidence attached to production batches
--    Stages: RAW_MATERIAL, IN_PROCESS, FINISHED, PACKAGING, QUALITY_CHECK
CREATE TABLE IF NOT EXISTS batch_evidence_photos (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    factory_id VARCHAR(50) NOT NULL,
    stage VARCHAR(50) NOT NULL,
    photo_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    file_size BIGINT,
    uploaded_by BIGINT NOT NULL,
    notes VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_batch_photos_batch ON batch_evidence_photos(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_photos_factory ON batch_evidence_photos(factory_id);
CREATE INDEX IF NOT EXISTS idx_batch_photos_stage ON batch_evidence_photos(batch_id, stage);
