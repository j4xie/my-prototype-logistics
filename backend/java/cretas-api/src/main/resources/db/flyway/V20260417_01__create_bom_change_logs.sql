-- Create bom_change_logs table.
--
-- Entity com.cretas.aims.entity.bom.BomChangeLog (P1-9, v1 §2.2.6 痕迹追踪)
-- was committed but never got a CREATE TABLE. Every BOM item CREATE/UPDATE/
-- DELETE then tried to INSERT into a non-existent table, failing with:
--   ERROR: relation "bom_change_logs" does not exist
--
-- Observed prod 2026-04-16 05:53:17 when user 1511 edited BOM for
-- prod_e2e_test_001.
--
-- Applied in-place on prod + test first; this migration file + Flyway
-- integration (committed 2026-04-16) means future env initial deploys
-- pick it up automatically.
--
-- Note: entity declares @Index(columnList="factory_id,changed_at") but
-- there's no `changed_at` column on the entity (only BaseEntity.created_at).
-- Emit the factory_id,created_at index instead so the intent (filter log
-- by factory + time) still works.

CREATE TABLE IF NOT EXISTS bom_change_logs (
    id VARCHAR(64) NOT NULL,
    factory_id VARCHAR(64) NOT NULL,
    bom_id VARCHAR(191),
    bom_item_id BIGINT,
    change_type VARCHAR(20) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by BIGINT,
    changed_by_name VARCHAR(100),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_bcl_bom ON bom_change_logs (bom_id);
CREATE INDEX IF NOT EXISTS idx_bcl_bom_item ON bom_change_logs (bom_item_id);
CREATE INDEX IF NOT EXISTS idx_bcl_factory_created ON bom_change_logs (factory_id, created_at);
