-- Add optimistic locking version columns for inventory entities
-- Run on PostgreSQL (both cretas_db)

-- MaterialBatch
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;

-- FinishedGoodsBatch
ALTER TABLE finished_goods_batches ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;
