-- 数据织网 Sub-Project C Day 6+ (May 1 2026): field_provenance 列扩展.
--
-- per 04-C v1.3 §2.1 (lines 144/152/156). Day 1-5 V20260430_01 omitted these
-- 3 columns; Day 6+ conflict resolution + GDPR audit need them:
--   confidence_method: priority chain consumer ('manual'/'rule'/'embedding'/'llm')
--   superseded_reason: supersession audit ('30%_diff'/'manual_override'/...)
--   created_by:        GDPR audit + admin queue user attribution
--
-- ALTER TABLE on a 0-row table (Day 1-5 just shipped) is instant. GRANT
-- inherits from V20260430_01 (table-level GRANT covers new columns).
--
-- All 3 columns are NULLable: historical rows from V20260430_01 may have
-- never written them, and Day 6+ writers will populate them lazily. App
-- code MUST tolerate NULL on read.

ALTER TABLE field_provenance
    ADD COLUMN IF NOT EXISTS confidence_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS superseded_reason TEXT,
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);

-- Backfill any existing rows (Day 1-5 test smartbi_db: ~0 rows; prod: not yet
-- applied) — confidence_method falls back to mapper_method as a coarse hint
-- so the priority-chain consumer in Day 6+ has at least one signal.
UPDATE field_provenance
   SET confidence_method = mapper_method
 WHERE confidence_method IS NULL;

-- Rollback:
--   ALTER TABLE field_provenance
--       DROP COLUMN IF EXISTS created_by,
--       DROP COLUMN IF EXISTS superseded_reason,
--       DROP COLUMN IF EXISTS confidence_method;
