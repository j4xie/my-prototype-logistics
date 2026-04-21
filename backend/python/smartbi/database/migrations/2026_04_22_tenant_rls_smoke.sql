-- Tenant RLS smoke table — reference pattern for future Silver/Gold tables.
-- Week 1 Day 2 of Unified Data Layer v1 (docs/superpowers/specs/2026-04-22-unified-data-layer-v1-design.md §6).
--
-- Not a business table. Exists solely to (a) prove the
-- tenant_ctx → pool setup → current_setting('app.factory_id') → RLS
-- chain isolates tenants end-to-end, and (b) serve as the exact template
-- copied into every Silver fact/dim table when Week 2 begins.
--
-- Safe to keep in prod DB long-term — zero rows until tests insert; zero
-- impact on unrelated code paths.

CREATE TABLE IF NOT EXISTS tenant_rls_smoke (
    id          BIGSERIAL PRIMARY KEY,
    factory_id  VARCHAR(50) NOT NULL,
    label       VARCHAR(200),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_rls_smoke_factory ON tenant_rls_smoke(factory_id);

ALTER TABLE tenant_rls_smoke ENABLE ROW LEVEL SECURITY;
-- FORCE so table owner also follows policy (otherwise smartbi_user as owner
-- would bypass). Future Silver tables will be owned by smartbi_user too.
ALTER TABLE tenant_rls_smoke FORCE ROW LEVEL SECURITY;

-- Policy: row visible iff its factory_id matches session setting.
-- `current_setting(name, true)` returns NULL when unset instead of raising,
-- so unset → policy mismatch → 0 rows (the safe fail mode).
DROP POLICY IF EXISTS tenant_isolation ON tenant_rls_smoke;
CREATE POLICY tenant_isolation ON tenant_rls_smoke
    FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
