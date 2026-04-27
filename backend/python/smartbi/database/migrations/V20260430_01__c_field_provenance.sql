-- 数据织网 Sub-Project C Day 1-5 (Apr 30 2026): field_provenance baseline.
--
-- Per 04-C v1.3 §2.1 (lines 113-185), introduces cell-level provenance:
-- one row per (factory, entity, field) write recording source upload, source
-- type, confidence, validity window, mapper method, and supersession chain.
--
-- Day 1-5 scope: schema + write path + types + unit tests.
-- DEFERRED to Day 6+: conflict resolution, 30% diff, cascade engine,
-- factory_provenance_config table, dual-write into B writers, Trust UI,
-- backfill of existing 1.31M rows.
--
-- Critical/serious fixes baked in (per spec 修订记录):
--   C-1: sentinel source_upload_id=0 + valid_from='-infinity' + COALESCE
--        partial UNIQUE index — defeats the NULL-bypass dedup race.
--   C-2: source_upload_id ON DELETE RESTRICT — no orphan provenance.
--   C-6: source_priority column intentionally NOT created (runtime JOIN to
--        factory_provenance_config in Day 6+).
--   NC-1: confidence is NUMERIC(5,4) so manual writes can use 1.0
--         (NUMERIC(4,4) caps at 0.9999 → overflow).
--   NS-3: callers should hold pg_advisory_xact_lock(99::int, ...) — namespace
--         99 reserved here so we don't collide with B's 1-arg per-factory lock.

-- ── 0. Sentinel upload row ──────────────────────────────────────────
-- source_upload_id has ON DELETE RESTRICT to a real FK; INSERTs can't use
-- NULL (column is NOT NULL DEFAULT 0). So we need a sentinel row with id=0
-- representing "client-manual / system-inferred / industry-default" sources.
-- Insert it before the FK is added, then bump the sequence so future real
-- uploads don't collide.

INSERT INTO smart_bi_pg_excel_uploads (id, factory_id, file_name, upload_status)
SELECT 0, '__internal__', '_sentinel_manual', 'COMPLETED'
WHERE NOT EXISTS (SELECT 1 FROM smart_bi_pg_excel_uploads WHERE id = 0);

-- Reset sequence so the next nextval() lands past the sentinel + any
-- existing rows. GREATEST(1, max) handles the empty-table case
-- (setval requires value >= 1).
SELECT setval(
    'smart_bi_pg_excel_uploads_id_seq',
    GREATEST(1, (SELECT COALESCE(MAX(id), 0) FROM smart_bi_pg_excel_uploads)),
    true
);

-- ── 1. field_provenance table ───────────────────────────────────────

CREATE TABLE field_provenance (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,

    -- Polymorphic entity reference. entity_type is one of:
    --   'store' / 'product' / 'staff' / 'ingredient' /
    --   'finance_subject' / 'bill' / etc.
    -- entity_id refers to the corresponding dim_*.<id> or fact_*.<id>.
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_value JSONB NOT NULL,

    -- Source upload (sentinel 0 = "non-upload": manual / inferred / default).
    source_upload_id BIGINT NOT NULL DEFAULT 0
        REFERENCES smart_bi_pg_excel_uploads(id) ON DELETE RESTRICT,
    -- source_type values: 'pos_excel' / 'manual' / 'inferred' /
    -- 'industry_default' / 'review' / etc.
    source_type VARCHAR(50) NOT NULL,

    -- Confidence in [0.0, 1.0]. NUMERIC(5,4) so manual writes can use 1.0
    -- (NUMERIC(4,4) max is 0.9999).
    confidence NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),

    -- Validity window. valid_from defaults to '-infinity' (row applies from
    -- start of time). valid_to NULL means open-ended ("still valid").
    valid_from DATE NOT NULL DEFAULT '-infinity'::date,
    valid_to DATE,

    -- Mapper that produced this value. Restricted set so writers can't
    -- silently invent new categories.
    mapper_method VARCHAR(20) NOT NULL
        CHECK (mapper_method IN ('manual', 'rule', 'embedding', 'llm')),

    -- Supersession chain. NULL = active; non-NULL = replaced by another row.
    superseded_by_id BIGINT REFERENCES field_provenance(id) ON DELETE SET NULL,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Row-level security (FORCE so even table owner is filtered) ───

ALTER TABLE field_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_provenance FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON field_provenance
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- ── 3. Indexes ──────────────────────────────────────────────────────

-- Lookup: most recent active value per (factory, entity, field).
CREATE INDEX idx_fp_lookup
    ON field_provenance (factory_id, entity_type, entity_id, field_name, valid_from DESC)
    WHERE superseded_by_id IS NULL;

-- Audit: chronological history per entity.
CREATE INDEX idx_fp_audit
    ON field_provenance (factory_id, entity_type, entity_id, created_at DESC);

-- Source-cleanup / backfill: rows attributable to a real upload (sentinel
-- excluded so the index stays small).
CREATE INDEX idx_fp_by_source
    ON field_provenance (factory_id, source_upload_id)
    WHERE source_upload_id != 0;

-- Dedup (C-1 fix): one active row per (factory, entity, field, valid_from).
-- COALESCE turns the rare 'infinity'/'-infinity' edges into a stable key.
-- WHERE clause excludes superseded rows so historical chains don't trip
-- the constraint.
CREATE UNIQUE INDEX uq_fp_dedup
    ON field_provenance (
        factory_id, entity_type, entity_id, field_name,
        COALESCE(valid_from, '-infinity'::date)
    )
    WHERE superseded_by_id IS NULL;

-- ── 4. updated_at trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION fp_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fp_touch
    BEFORE UPDATE ON field_provenance
    FOR EACH ROW EXECUTE FUNCTION fp_touch_updated_at();

-- ── 5. Grants ───────────────────────────────────────────────────────
-- Same pattern as V20260428_03 (B-Silver grants): table is created via this
-- migration which may run as postgres (FK to smart_bi_pg_excel_uploads,
-- which may be postgres-owned), so smartbi_user needs explicit grants.

GRANT SELECT, INSERT, UPDATE, DELETE ON field_provenance TO smartbi_user;
GRANT USAGE, SELECT ON SEQUENCE field_provenance_id_seq TO smartbi_user;

-- ── Rollback ────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS trg_fp_touch ON field_provenance;
--   DROP FUNCTION IF EXISTS fp_touch_updated_at();
--   DROP INDEX IF EXISTS uq_fp_dedup;
--   DROP INDEX IF EXISTS idx_fp_by_source;
--   DROP INDEX IF EXISTS idx_fp_audit;
--   DROP INDEX IF EXISTS idx_fp_lookup;
--   DROP POLICY IF EXISTS tenant_isolation ON field_provenance;
--   DROP TABLE IF EXISTS field_provenance;
--   -- Sentinel row left in place; safe to delete only if no other
--   -- migration depends on it:
--   --   DELETE FROM smart_bi_pg_excel_uploads
--   --     WHERE id = 0 AND factory_id = '__internal__';
