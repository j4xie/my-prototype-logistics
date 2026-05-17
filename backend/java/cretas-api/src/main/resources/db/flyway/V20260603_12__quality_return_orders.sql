-- ============================================================================
-- Sprint4-H Q-RETURN-1: 质检退回单 (退回供应商 / 委外加工厂)
-- ============================================================================
-- 区分 T-RTA 客户退货 (走 sales_returns / SalesOrder return 流) — 此表只处理
-- 上游退回, target_type ∈ {SUPPLIER, SUBCONTRACT}.
--
-- 状态机: DRAFT → CONFIRMED → SHIPPED.
-- ============================================================================

CREATE TABLE IF NOT EXISTS quality_return_orders (
    id                       VARCHAR(191) PRIMARY KEY,
    factory_id               VARCHAR(255) NOT NULL,
    return_number            VARCHAR(64),                -- QR-YYYYMMDD-NNN
    quality_inspection_id    VARCHAR(191) NOT NULL,
    target_type              VARCHAR(32)  NOT NULL,
    target_id                VARCHAR(191) NOT NULL,
    target_name              VARCHAR(255),
    material_id              VARCHAR(191),
    quantity                 NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    unit                     VARCHAR(32),
    reason                   TEXT,
    status                   VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    confirmed_at             TIMESTAMP,
    confirmed_by             BIGINT,
    shipped_at               TIMESTAMP,
    shipped_by               BIGINT,
    shipping_tracking_no     VARCHAR(128),
    created_by               BIGINT,
    custom_fields            JSONB        DEFAULT '{}'::jsonb,
    created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at               TIMESTAMP,
    CONSTRAINT chk_qro_status CHECK (status IN ('DRAFT', 'CONFIRMED', 'SHIPPED')),
    CONSTRAINT chk_qro_target_type CHECK (target_type IN ('SUPPLIER', 'SUBCONTRACT')),
    CONSTRAINT fk_qro_inspection FOREIGN KEY (quality_inspection_id)
        REFERENCES quality_inspections (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_qro_factory ON quality_return_orders (factory_id);
CREATE INDEX IF NOT EXISTS idx_qro_inspection ON quality_return_orders (quality_inspection_id);
CREATE INDEX IF NOT EXISTS idx_qro_status ON quality_return_orders (status);
CREATE INDEX IF NOT EXISTS idx_qro_target ON quality_return_orders (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_qro_number ON quality_return_orders (return_number);

COMMENT ON TABLE  quality_return_orders IS 'Sprint4-H Q-RETURN-1 质检退回单 (上游退回, 不含客户退货)';
COMMENT ON COLUMN quality_return_orders.return_number IS 'QR-YYYYMMDD-NNN 自动生成';
COMMENT ON COLUMN quality_return_orders.target_type IS 'SUPPLIER (退回供应商) / SUBCONTRACT (退回委外加工厂)';
COMMENT ON COLUMN quality_return_orders.target_id IS 'supplier id 或 subcontract id';
COMMENT ON COLUMN quality_return_orders.status IS 'DRAFT/CONFIRMED/SHIPPED';
