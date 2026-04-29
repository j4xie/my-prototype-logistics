-- Add optimistic lock version column to customers
-- Defaults to 0 for existing rows; Hibernate @Version auto-increments on each UPDATE
-- Motivation: prevents silent last-write-wins when two users edit the same customer
-- (detected via prod-concurrent-edit-conflict.mjs on 2026-04-24)

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN customers.version IS 'Optimistic lock version (Hibernate @Version). Mismatch → 409 Conflict.';
