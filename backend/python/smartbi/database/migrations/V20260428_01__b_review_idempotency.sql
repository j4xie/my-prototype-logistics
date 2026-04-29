-- Add source_row_hash to fact_review_event for idempotent re-run
ALTER TABLE fact_review_event
    ADD COLUMN IF NOT EXISTS source_row_hash VARCHAR(64);

-- Backfill any existing rows (none expected since fresh table) with deterministic hash
-- (skip if 0 rows, otherwise update could be expensive)
-- For Day 8-9 era there are 0 rows in test, so this is no-op safe

-- Idempotent unique index for fact_review_event (NULL-safe via COALESCE pattern)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fre_natkey
    ON fact_review_event (
        factory_id, upload_id,
        COALESCE(source_row_hash, '')
    );

-- dim_review_summary needs upload_id so re-running same upload upserts the
-- summary row instead of stacking duplicates.
ALTER TABLE dim_review_summary
    ADD COLUMN IF NOT EXISTS upload_id BIGINT REFERENCES smart_bi_pg_excel_uploads(id) ON DELETE CASCADE;

-- Idempotent unique index on dim_review_summary natural key
-- (one summary row per upload+product+store+period). Uses COALESCE sentinels
-- because PG 13 lacks NULLS NOT DISTINCT.
CREATE UNIQUE INDEX IF NOT EXISTS uq_drs_natkey
    ON dim_review_summary (
        factory_id,
        COALESCE(upload_id, 0),
        COALESCE(product_id, 0),
        COALESCE(store_id, 0),
        COALESCE(period_start, DATE '0001-01-01')
    );

-- Rollback:
--   DROP INDEX IF EXISTS uq_fre_natkey;
--   DROP INDEX IF EXISTS uq_drs_natkey;
--   ALTER TABLE fact_review_event DROP COLUMN IF EXISTS source_row_hash;
--   ALTER TABLE dim_review_summary DROP COLUMN IF EXISTS upload_id;
