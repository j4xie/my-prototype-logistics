-- Persist upload_aggregate_cache so it survives Python restarts.
--
-- The in-memory `_UploadAggregateCache` dict dies on every process restart,
-- which causes the first LLM-fallback query per upload after every deploy to
-- trigger a 30-70s cold recompute (15 measures + 4 dim_distincts + 4 top5
-- full JSONB scans on smart_bi_dynamic_data). This table backs the cache so
-- a restart only loses the in-memory L1, not the computed payload itself.
--
-- Populated by:
--   1. compute_upload_aggregates() after a cold compute (lazy warm).
--   2. γ-1c reclassify hook + upload-time materialization (eager warm).
--
-- Read by:
--   upload_aggregate_cache.get_bundle(pool, upload_id) — memory → DB → compute.
CREATE TABLE IF NOT EXISTS smart_bi_pg_upload_aggregate_cache (
    upload_id      BIGINT PRIMARY KEY,
    factory_id     VARCHAR(50),
    -- Full bundle payload: field_meta / measures / dims / real_total_rows /
    -- agg_lines / top5_by_dim / primary_measure. Stored as JSONB so shape
    -- can evolve (new aggregate keys) without a schema migration.
    payload        JSONB NOT NULL,
    compute_time_s DOUBLE PRECISION,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Factory-scoped lookups + cleanup (e.g., purge aggregates for a deleted tenant).
CREATE INDEX IF NOT EXISTS idx_upload_agg_cache_factory
    ON smart_bi_pg_upload_aggregate_cache (factory_id, created_at DESC);

-- Rollback:
--   DROP INDEX IF EXISTS idx_upload_agg_cache_factory;
--   DROP TABLE IF EXISTS smart_bi_pg_upload_aggregate_cache;
