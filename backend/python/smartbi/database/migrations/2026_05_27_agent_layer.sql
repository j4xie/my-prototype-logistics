-- Week 5 Agent Layer — budget tracking + narrative cache + per-tenant config.
-- Spec: docs/superpowers/specs/2026-04-22-unified-data-layer-v1-design.md §4.2
-- RLS pattern mirrors 2026_04_22_tenant_rls_smoke.sql (FORCE + unset-safe policy).

-- ---------- agent_tenant_config ----------
-- Per-factory tier + optional cap override. Long-term home for agent-layer
-- tenant settings (future: model_preference, tool_whitelist, etc).
CREATE TABLE IF NOT EXISTS agent_tenant_config (
    factory_id          VARCHAR(50) PRIMARY KEY,
    tier                VARCHAR(20) NOT NULL DEFAULT 'basic'
                        CHECK (tier IN ('basic', 'enterprise')),
    custom_cap_override BIGINT,
    model_preference    VARCHAR(50),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tenant_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agent_tenant_config;
CREATE POLICY tenant_isolation ON agent_tenant_config
    FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON agent_tenant_config TO smartbi_user;

-- ---------- agent_budget_daily ----------
CREATE TABLE IF NOT EXISTS agent_budget_daily (
    factory_id   VARCHAR(50) NOT NULL,
    date         DATE        NOT NULL,
    tokens_used  BIGINT      NOT NULL DEFAULT 0,
    tokens_cap   BIGINT      NOT NULL,
    blocked      BOOLEAN     GENERATED ALWAYS AS (tokens_used >= tokens_cap) STORED,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (factory_id, date)
);

CREATE INDEX IF NOT EXISTS idx_agent_budget_daily_date
    ON agent_budget_daily(date);

ALTER TABLE agent_budget_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_daily FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agent_budget_daily;
CREATE POLICY tenant_isolation ON agent_budget_daily
    FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON agent_budget_daily TO smartbi_user;

-- ---------- narrative_cache ----------
-- Hash = SHA256(normalized_q + startDate + endDate + factory_id).
-- upload_id deliberately NOT in hash: /executive/insights/custom is
-- range-scoped, not upload-scoped. Fresh uploads invalidate via
-- NarrativeCacheService.invalidate_on_upload() wiping all rows for factory.
CREATE TABLE IF NOT EXISTS narrative_cache (
    factory_id     VARCHAR(50) NOT NULL,
    question_hash  VARCHAR(64) NOT NULL,
    answer         TEXT        NOT NULL,
    chart_config   JSONB,
    tokens         INT         NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    expires_at     TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (factory_id, question_hash)
);

CREATE INDEX IF NOT EXISTS idx_narrative_cache_expires
    ON narrative_cache(expires_at);

ALTER TABLE narrative_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_cache FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON narrative_cache;
CREATE POLICY tenant_isolation ON narrative_cache
    FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON narrative_cache TO smartbi_user;

-- ---------- Seed qhj_prod as enterprise tier ----------
-- Safe to run repeatedly via ON CONFLICT DO NOTHING.
-- RLS bypass here: migration runs as postgres superuser, RLS does not apply.
INSERT INTO agent_tenant_config (factory_id, tier)
VALUES ('qhj_prod', 'enterprise')
ON CONFLICT (factory_id) DO NOTHING;
