-- V20260511_01__t6_6_etl_chain_catalog.sql
--
-- T6.6 Phase B Sub-ETL-3a — restaurant chain catalog (control-plane metadata).
--
-- Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §1.2 + §2.2
-- Q1 amendment: docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md §4.3
-- Sign-off: Q-ETL-1 (factory_id is sole tenant), Q-ETL-2 (ship catalog table)
--           per spec §10 — recorded in PR description.
--
-- Apply via apply-smartbi-migrations.sh per server-operations.md HARD RULE.
-- Idempotent — re-applying is a no-op (CREATE IF NOT EXISTS + DROP/CREATE trigger).
--
-- Sibling: V20260511_02__t6_6_etl_seed_14_real_chains.sql (Sub-ETL-3b INSERT seed).
-- Sub-ETL-2a (constraint fixups) ships separately on its own date.

-- ── restaurant_chain_catalog ──────────────────────────────────────────
-- Thin metadata catalog for ETL provenance + admin/diagnostic queries.
-- factory_id is the primary key; 1:1 with chain. Store-level fields live
-- in dim_store, NOT replicated here. cuisine + source_kind + source_root_path
-- are NOT derivable from dim_store / fact_* rows.
--
-- No RLS — control-plane catalog readable across factory contexts. Cross-tenant
-- data leakage is already blocked at dim_store / fact_* layer via existing
-- tenant_isolation policies.
CREATE TABLE IF NOT EXISTS restaurant_chain_catalog (
    factory_id        VARCHAR(50) PRIMARY KEY,
    chain_name_zh     VARCHAR(200) NOT NULL,
    chain_name_roman  VARCHAR(100) NOT NULL,
    cuisine           VARCHAR(50),
    source_kind       VARCHAR(20) NOT NULL,
    source_root_path  VARCHAR(500),
    notes             TEXT,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_chain_source_kind
        CHECK (source_kind IN ('REAL', 'DEMO', 'TEST'))
);

-- Filter by source_kind (admin UI: "list all REAL chains").
CREATE INDEX IF NOT EXISTS idx_chain_catalog_source_kind
    ON restaurant_chain_catalog (source_kind);

-- Reuse silver_touch_updated_at() defined in 2026_04_28_silver_dimensions.sql.
-- Function is CREATE OR REPLACE there, so it always exists in target DB
-- before this migration runs (Phase 2A silver_dimensions ships well before T6.6).
DROP TRIGGER IF EXISTS trg_chain_catalog_touch ON restaurant_chain_catalog;
CREATE TRIGGER trg_chain_catalog_touch
    BEFORE UPDATE ON restaurant_chain_catalog
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();
