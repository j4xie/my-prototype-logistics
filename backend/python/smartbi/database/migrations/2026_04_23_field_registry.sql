-- field_registry — global mapper cache for (source → canonical_field) resolutions.
-- Week 1 Day 4 of Unified Data Layer v1 spec (§1.2 workflow step 1-5).
--
-- Purpose:
--   Silver normalizer first queries this table by (source_type, source_version,
--   normalizer_version, raw_column). Hit → direct use (0 LLM cost). Miss → run
--   full mapper pipeline (rule → embedding → llm) and write back the result.
--
-- Scope:
--   GLOBAL (not tenant-scoped). One customer's "商品名称" → product_name
--   resolution benefits all. Admin UI (/smart-bi-admin/fields, future Week 4)
--   manually corrects low-confidence rows; mapper_method='manual' sticks.
--
-- Invalidation:
--   Mapper logic changes → bump normalizer_version constant in code →
--   all old rows stay for audit but are ignored for new lookups. No DELETE.
--
-- Sample values:
--   sample_values JSONB = array of 3-5 raw cell values seen for this column,
--   so admin reviewing low-confidence rows can see what the data actually
--   looks like (not just the column name). Cap to 5 via app code.

CREATE TABLE IF NOT EXISTS field_registry (
    source_type         VARCHAR(20)  NOT NULL,  -- "excel" / "meituan_api" / "dianping_scrape"
    source_version      VARCHAR(50)  NOT NULL,  -- "qhj_2025_v1", "meituan_api_v3.2"
    normalizer_version  VARCHAR(20)  NOT NULL,  -- mapper logic version; bump → auto-invalidate
    raw_column          VARCHAR(200) NOT NULL,  -- exactly as emitted by adapter
    canonical_field     VARCHAR(100),           -- resolved field; NULL if unresolved (needs review)
    domain              VARCHAR(20),            -- "restaurant" / "procurement" / "finance" / ...
    role                VARCHAR(20),            -- "measure" / "dimension" / "time" / "id"
    mapper_method       VARCHAR(20) NOT NULL,   -- "rule" | "embedding" | "llm" | "manual"
    confidence          NUMERIC(3,2) NOT NULL,  -- 0.00-1.00
    sample_values       JSONB,                  -- 3-5 example raw values
    reviewed_by         BIGINT,                 -- users.id of admin who set manual mapping
    reviewed_at         TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (source_type, source_version, normalizer_version, raw_column),
    CONSTRAINT chk_mapper_method CHECK (mapper_method IN ('rule','embedding','llm','manual')),
    CONSTRAINT chk_confidence_range CHECK (confidence >= 0.0 AND confidence <= 1.0)
);

-- Hot path: Silver normalizer looks up by (source_type, raw_column) when
-- resolving a batch of columns for a single upload. PK already covers this
-- ordering, so no extra index needed for the lookup itself.

-- Admin UI "show unresolved / low confidence mappings" query:
-- SELECT ... WHERE confidence < 0.7 AND mapper_method != 'manual' ORDER BY updated_at DESC;
-- Partial index keeps review queue small and fast (the vast majority of rows
-- are high-confidence and don't need review).
CREATE INDEX IF NOT EXISTS idx_field_registry_needs_review
    ON field_registry (updated_at DESC)
    WHERE confidence < 0.7 AND mapper_method != 'manual';

-- Admin UI "show all mappings in restaurant domain" filter:
CREATE INDEX IF NOT EXISTS idx_field_registry_domain
    ON field_registry (domain, source_type)
    WHERE domain IS NOT NULL;

-- updated_at trigger (same pattern as other tables)
CREATE OR REPLACE FUNCTION field_registry_touch()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_field_registry_touch ON field_registry;
CREATE TRIGGER trg_field_registry_touch
    BEFORE UPDATE ON field_registry
    FOR EACH ROW EXECUTE FUNCTION field_registry_touch();
