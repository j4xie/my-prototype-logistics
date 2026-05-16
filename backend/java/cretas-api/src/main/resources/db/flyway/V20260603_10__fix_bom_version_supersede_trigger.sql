-- Issue #724 fix — defense-in-depth: convert trg_bom_version_supersede from AFTER to BEFORE.
--
-- Root cause of #724: V20260516_10 created the trigger as AFTER INSERT OR UPDATE. The partial
-- unique index `uq_bv_one_current_per_recipe` (bom_recipe_id WHERE status='APPROVED' AND
-- effective_to IS NULL AND deleted_at IS NULL) is checked at row-write time. When the service
-- promotes a row to APPROVED, the index violation surfaces BEFORE the AFTER trigger can OBSOLETE
-- the prior APPROVED row → 409 "数据已存在,bom_recipe_id".
--
-- Primary fix is service-layer (BomVersionServiceImpl.approve explicitly OBSOLETEs prior + flushes
-- before promoting). This migration keeps the trigger as defense-in-depth for direct-SQL / batch
-- paths that bypass the service. Switching to BEFORE lets the trigger OBSOLETE the prior row in
-- the same statement, before PostgreSQL re-evaluates the partial unique index.
--
-- Loop safety: same guard as original (NEW.status = APPROVED AND NEW.effective_to IS NULL).
-- The recursive UPDATE sets status='OBSOLETE', which fails that condition → no re-fire.
--
-- See: https://github.com/j4xie/my-prototype-logistics/issues/724

CREATE OR REPLACE FUNCTION bom_version_supersede_previous()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'APPROVED' AND NEW.effective_to IS NULL
       AND (TG_OP = 'INSERT'
            OR OLD.status <> 'APPROVED'
            OR OLD.effective_to IS NOT NULL) THEN
        UPDATE bom_versions
        SET status       = 'OBSOLETE',
            effective_to = COALESCE(NEW.effective_from, CURRENT_DATE) - INTERVAL '1 day',
            updated_at   = NOW()
        WHERE bom_recipe_id = NEW.bom_recipe_id
          AND id           <> NEW.id
          AND status        = 'APPROVED'
          AND effective_to IS NULL
          AND deleted_at   IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bom_version_supersede ON bom_versions;

CREATE TRIGGER trg_bom_version_supersede
BEFORE INSERT OR UPDATE OF status, effective_to ON bom_versions
FOR EACH ROW
EXECUTE FUNCTION bom_version_supersede_previous();

COMMENT ON FUNCTION bom_version_supersede_previous() IS
    'M-BOM-VER-1 auto-supersede: new APPROVED version → OBSOLETE prior APPROVED for same '
    'bom_recipe_id. Issue #724: BEFORE trigger so OBSOLETE precedes partial-unique-index '
    'check on the NEW row.';
