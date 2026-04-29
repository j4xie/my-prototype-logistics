-- 数据织网 Sub-Project C Day 8 (May 1 2026): factory_provenance_config table.
--
-- per 04-C v1.3 §3.5. Factory-level overrides for:
--   diff_threshold (Q1): 30% default, 5%-50% range
--   priority_overrides (Q2): factory can re-rank source priority chain
--   industry_default_overrides (Q3): factory-specific cost ratios per category
--   time_inheritance_window_days (S-15): ±N days for time inheritance, 1-90 default 7
--
-- Spec §3.5 line 515 calls for `REFERENCES factories(factory_id) ON DELETE CASCADE`,
-- but smartbi_db does NOT have a `factories` table — that lives in cretas_db
-- (Java backend). Every other smartbi-side tenant-scoped table uses a plain
-- VARCHAR factory_id with RLS for isolation, no FK. Following that pattern
-- here. If a factory is hard-deleted on the Java side, an orphan-cleanup job
-- would need to handle it (out of scope for Day 8-9).
--
-- RLS FORCE blocks cross-tenant read/write, mirroring V20260430_01.

CREATE TABLE factory_provenance_config (
    factory_id VARCHAR(50) PRIMARY KEY,

    -- diff_threshold: NUMERIC(5,4) per spec §3.5 (matches confidence shape).
    -- Range 0.05-0.50 (5% to 50%); default 0.30.
    diff_threshold NUMERIC(5,4) NOT NULL DEFAULT 0.3000
        CHECK (diff_threshold BETWEEN 0.0500 AND 0.5000),

    -- priority_overrides: JSONB object with source_type → priority (1-6, low=high prio).
    -- NULL means "use GLOBAL_PRIORITY_TABLE for everything".
    -- Spec §3.5 mentions a CHECK with subquery; PG disallows subqueries in CHECK.
    -- Switched to a BEFORE INSERT/UPDATE trigger (validate_priority_overrides
    -- below) which gives the same enforcement semantics.
    priority_overrides JSONB DEFAULT NULL,

    -- industry_default_overrides: JSONB { "cost_rate.川菜": 0.32, ... }.
    -- NULL = use INDUSTRY_DEFAULT_COST_RATIO hardcode for everything.
    industry_default_overrides JSONB DEFAULT NULL,

    -- time_inheritance_window_days: ±N days for time inheritance lookups.
    time_inheritance_window_days INT NOT NULL DEFAULT 7
        CHECK (time_inheritance_window_days BETWEEN 1 AND 90),

    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(50)
);

-- ── priority_overrides trigger validator ───────────────────────────
-- Enforce: if non-null, must be JSON object with all VALUES integer in [1..6].
CREATE OR REPLACE FUNCTION validate_priority_overrides() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.priority_overrides IS NULL THEN
        RETURN NEW;
    END IF;
    IF jsonb_typeof(NEW.priority_overrides) <> 'object' THEN
        RAISE EXCEPTION 'priority_overrides must be a JSON object, got %',
            jsonb_typeof(NEW.priority_overrides)
            USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_each_text(NEW.priority_overrides) v
         WHERE v.value !~ '^[1-6]$'
    ) THEN
        RAISE EXCEPTION 'priority_overrides values must be integers in [1..6]'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fpc_validate_priority
    BEFORE INSERT OR UPDATE ON factory_provenance_config
    FOR EACH ROW EXECUTE FUNCTION validate_priority_overrides();

ALTER TABLE factory_provenance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_provenance_config FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON factory_provenance_config
  USING (factory_id = current_setting('app.factory_id', true))
  WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- Grants (mirror V20260430_01 pattern).
GRANT SELECT, INSERT, UPDATE, DELETE ON factory_provenance_config TO smartbi_user;

-- Rollback:
--   DROP POLICY IF EXISTS tenant_isolation ON factory_provenance_config;
--   DROP TRIGGER IF EXISTS trg_fpc_validate_priority ON factory_provenance_config;
--   DROP FUNCTION IF EXISTS validate_priority_overrides();
--   DROP TABLE IF EXISTS factory_provenance_config;
