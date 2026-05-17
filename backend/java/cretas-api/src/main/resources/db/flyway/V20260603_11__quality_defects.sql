-- ============================================================================
-- Sprint4-H Q-PROCESS-1: 工序质检不良记录表
-- ============================================================================
-- 关联 quality_inspections.id (1:N, 一次质检对应多条不良).
-- 状态机: OPEN → IN_PROGRESS → CLOSED.
-- defect_type 9 种 (DefectType enum): APPEARANCE / WEIGHT / COMPOSITION /
--   MICROBIAL / PACKAGING / FOREIGN_OBJECT / SENSORY / SHELF_LIFE / OTHER.
--
-- Audit fields (created_at/updated_at/deleted_at) 由 BaseEntity 提供, 软删除走
-- @Where(deleted_at IS NULL) 过滤.
-- ============================================================================

CREATE TABLE IF NOT EXISTS quality_defects (
    id                       VARCHAR(191) PRIMARY KEY,
    factory_id               VARCHAR(255) NOT NULL,
    quality_inspection_id    VARCHAR(191) NOT NULL,
    material_id              VARCHAR(191),
    defect_type              VARCHAR(32)  NOT NULL,
    quantity                 NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    cause                    TEXT,
    handling_action          TEXT,
    assigned_to              BIGINT,
    status                   VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    closed_at                TIMESTAMP,
    closed_by                BIGINT,
    close_notes              TEXT,
    created_by               BIGINT,
    custom_fields            JSONB        DEFAULT '{}'::jsonb,
    created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at               TIMESTAMP,
    CONSTRAINT chk_qd_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'CLOSED')),
    CONSTRAINT chk_qd_defect_type CHECK (defect_type IN (
        'APPEARANCE', 'WEIGHT', 'COMPOSITION', 'MICROBIAL', 'PACKAGING',
        'FOREIGN_OBJECT', 'SENSORY', 'SHELF_LIFE', 'OTHER'
    )),
    CONSTRAINT fk_qd_inspection FOREIGN KEY (quality_inspection_id)
        REFERENCES quality_inspections (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_qd_factory ON quality_defects (factory_id);
CREATE INDEX IF NOT EXISTS idx_qd_inspection ON quality_defects (quality_inspection_id);
CREATE INDEX IF NOT EXISTS idx_qd_status ON quality_defects (status);
CREATE INDEX IF NOT EXISTS idx_qd_type ON quality_defects (defect_type);
CREATE INDEX IF NOT EXISTS idx_qd_material ON quality_defects (material_id);

COMMENT ON TABLE  quality_defects IS 'Sprint4-H Q-PROCESS-1 工序质检不良记录';
COMMENT ON COLUMN quality_defects.defect_type IS '缺陷类型: APPEARANCE/WEIGHT/COMPOSITION/MICROBIAL/PACKAGING/FOREIGN_OBJECT/SENSORY/SHELF_LIFE/OTHER';
COMMENT ON COLUMN quality_defects.status IS '状态: OPEN/IN_PROGRESS/CLOSED';
COMMENT ON COLUMN quality_defects.handling_action IS '处置动作: 返工/报废/降级/退回供应商/其他';
COMMENT ON COLUMN quality_defects.assigned_to IS '处理人 user_id';
COMMENT ON COLUMN quality_defects.closed_by IS '闭环验证人 user_id';
