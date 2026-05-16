-- Sprint 3 Track-H M-BOM-VER-1 — BomVersion + EngineeringChangeNotice
--
-- 升级 Cretas BOM "配方版本" (BomRecipe.version Integer) 到工程级 PLM-Lite:
--   - bom_versions:                独立 row 存每次审批快照 + 状态机 + ECN 链
--   - engineering_change_notices:  5 reason ECN + 影响范围 + 通知列表 + 审批链
--   - trigger trg_bom_version_supersede: 新 APPROVED 自动 obsolete 旧 APPROVED
--
-- 双轨过渡 (6 月期): bom_recipes.version Integer + bom_recipes.is_current Boolean 不删.
--   BomRecipe.version 是 "快照式 latest", BomVersion 是历史追溯.
--
-- Flyway 编号 (Sprint 3 Track-H): V20260516_10
--   Brief 原指定 _04, 实际 _01-_07 全部已在 origin/main (V20260516_04__bom_intent_configs.sql
--   等 7 个非 Sprint 3 migration; cleanup commit 47bd22302 已重命名过一轮). Sprint 3 协调表:
--   chat2 = _08 / chat1 amend = _09 / Track-H (me) = _10. (原我先选 _14 留 buffer,
--   Steve organizer 协调后改回紧凑 _10.)
--
-- See docs/superpowers/dispatch/2026-05-16-sprint3-track-h-m-bom-ver-1-marching-order.md

-- ============================================================================
-- bom_versions
-- ============================================================================

CREATE TABLE IF NOT EXISTS bom_versions (
    id                VARCHAR(191) PRIMARY KEY,
    factory_id        VARCHAR(50)  NOT NULL,
    bom_recipe_id     VARCHAR(191) NOT NULL,
    version_number    INTEGER      NOT NULL,
    snapshot_json     JSONB        NOT NULL,
    status            VARCHAR(32)  NOT NULL DEFAULT 'DRAFT'
                                   CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED',
                                                     'OBSOLETE', 'REJECTED')),
    effective_from    DATE,
    effective_to      DATE,
    created_by        BIGINT,
    approved_by       BIGINT,
    approved_at       TIMESTAMP,
    ecn_id            VARCHAR(191),
    rejection_reason  TEXT,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bv_recipe_version
    ON bom_versions(factory_id, bom_recipe_id, version_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bv_recipe_status
    ON bom_versions(bom_recipe_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bv_factory_status
    ON bom_versions(factory_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bv_ecn
    ON bom_versions(ecn_id)
    WHERE ecn_id IS NOT NULL AND deleted_at IS NULL;

-- Partial unique: only 1 currently-effective version per bom_recipe_id.
-- Enforces "single active version" invariant at DB layer (defense-in-depth vs trigger).
CREATE UNIQUE INDEX IF NOT EXISTS uq_bv_one_current_per_recipe
    ON bom_versions(bom_recipe_id)
    WHERE status = 'APPROVED' AND effective_to IS NULL AND deleted_at IS NULL;

COMMENT ON TABLE bom_versions IS
    'M-BOM-VER-1 BOM 版本独立 (Sprint 3 Track-H). 独立 row + 完整 snapshot + 状态机 + ECN 链.';
COMMENT ON COLUMN bom_versions.snapshot_json IS
    'Full snapshot of BomRecipe + BomRecipeItem list at approval time. @PriceSensitive — contains cost fields.';
COMMENT ON COLUMN bom_versions.effective_to IS
    'NULL = currently effective. Partial unique uq_bv_one_current_per_recipe enforces single active.';

-- ============================================================================
-- engineering_change_notices
-- ============================================================================

CREATE TABLE IF NOT EXISTS engineering_change_notices (
    id                 VARCHAR(191) PRIMARY KEY,
    factory_id         VARCHAR(50)  NOT NULL,
    ecn_number         VARCHAR(50)  NOT NULL,
    bom_recipe_id      VARCHAR(191) NOT NULL,
    from_version       INTEGER,
    to_version         INTEGER      NOT NULL,
    reason             VARCHAR(32)  NOT NULL
                                     CHECK (reason IN ('CUSTOMER_REQUEST', 'MATERIAL_DISCONTINUED',
                                                       'COST_OPTIMIZATION', 'QUALITY_DEFECT',
                                                       'PROCESS_IMPROVEMENT')),
    reason_detail      TEXT,
    impact_scope       JSONB,
    notify_roles       JSONB,
    effective_date     DATE,
    status             VARCHAR(32)  NOT NULL DEFAULT 'DRAFT'
                                     CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED',
                                                       'REJECTED', 'EFFECTIVE')),
    approval_chain_id  VARCHAR(191),
    created_by         BIGINT,
    approved_by        BIGINT,
    approved_at        TIMESTAMP,
    rejection_reason   TEXT,
    created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at         TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ecn_factory_number
    ON engineering_change_notices(factory_id, ecn_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ecn_recipe
    ON engineering_change_notices(bom_recipe_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ecn_factory_status
    ON engineering_change_notices(factory_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ecn_effective_date
    ON engineering_change_notices(factory_id, effective_date)
    WHERE deleted_at IS NULL AND effective_date IS NOT NULL;

COMMENT ON TABLE engineering_change_notices IS
    'M-BOM-VER-1 工程变更通知 ECN (Sprint 3 Track-H). 5 reason + 审批 + 影响范围 + 通知列表.';

-- ============================================================================
-- BomReverseQueryService perf index — material_type_id → BomRecipeItem (Day 6-7)
-- ============================================================================
-- bom_recipe_items already has idx_bri_material on (factory_id, material_type_id)
-- per V20260514 (Track D1). Confirmed via entity/bom/BomRecipeItem.java @Index annotation.
-- No new index needed for reverse query; doc-only note here.

-- ============================================================================
-- Trigger: auto-supersede previous APPROVED version on new approval
-- ============================================================================
--
-- Defense-in-depth atop uq_bv_one_current_per_recipe partial unique index. Service layer
-- (BomVersionService.approve) also performs the update explicitly for transactional clarity;
-- trigger guards against direct SQL or batch approvals bypassing the service.
--
-- Loop safety: condition `NEW.status = 'APPROVED' AND NEW.effective_to IS NULL` filters the
-- recursive UPDATE (which sets status='OBSOLETE'), so trigger does not re-fire on the cascade.

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
AFTER INSERT OR UPDATE OF status, effective_to ON bom_versions
FOR EACH ROW
EXECUTE FUNCTION bom_version_supersede_previous();

COMMENT ON FUNCTION bom_version_supersede_previous() IS
    'M-BOM-VER-1 auto-supersede: new APPROVED version → OBSOLETE prior APPROVED for same bom_recipe_id.';
