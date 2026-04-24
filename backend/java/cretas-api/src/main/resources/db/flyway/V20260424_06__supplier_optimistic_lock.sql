-- Add optimistic lock version column to suppliers
-- Extends V20260424_05 customer pattern to supplier entity
-- Prevents silent last-write-wins when 2 users edit the same supplier

ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN suppliers.version IS 'Optimistic lock version (Hibernate @Version). Mismatch → 409 Conflict.';
