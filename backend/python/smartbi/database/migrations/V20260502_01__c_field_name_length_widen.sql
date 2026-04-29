-- 数据织网 Sub-Project C Phase 1 (May 2 2026): widen field_name length budget.
--
-- per 04-C v1.4 §3.1.5 (Phase B compound field_name convention):
-- worst-case length = base_field (~50) + '@store_' (7) + BIGINT (19) = ~76 chars today,
-- but future fields (e.g. 'monthly_average_inventory_turnover_ratio') push toward
-- VARCHAR(100) limit. Widen to 200 for headroom — same dedup index works since
-- index keys on string content not declared length.
--
-- ALTER TYPE on a 0-row table (test smartbi_db) is instant. Prod smartbi_prod_db
-- (when applied) has 0 rows in field_provenance currently — instant ALTER.
-- Idempotent via PG's CONFORMING coercion (no-op if already VARCHAR(200)+).

ALTER TABLE field_provenance
    ALTER COLUMN field_name TYPE VARCHAR(200);

-- Rollback (only safe if no rows have field_name length > 100):
--   ALTER TABLE field_provenance ALTER COLUMN field_name TYPE VARCHAR(100);
