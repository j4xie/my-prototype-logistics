-- W2-3 — P0-5 工厂物料需求单 (六扇门双仓制核心)
--
-- 客户原话 (会议 3124-3252s):
--   "提交过后如果生产一个物料需求单, 根据 BOM 会生产一个物料需求单,
--    给到仓库备料, 然后仓库把他的库存调过到工厂, 工厂开始跑生产,
--    生产跑完以后进行一个生产退料相当于仓库调拨."
--
-- 双仓制: 物流仓 (source) → 工厂鲜棉仓 (target), 当天清仓.
-- 状态机: PENDING → PICKING → TRANSFERRED → ISSUED → IN_USE → CLOSED.

CREATE TABLE IF NOT EXISTS factory_material_requisitions (
    id                  VARCHAR(64) PRIMARY KEY,
    factory_id          VARCHAR(64)  NOT NULL,
    requisition_no      VARCHAR(40)  NOT NULL UNIQUE,
    production_plan_id  VARCHAR(64)  NOT NULL,
    source_warehouse_id VARCHAR(64),
    target_warehouse_id VARCHAR(64),
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    required_date       DATE,
    requested_by        BIGINT,
    picked_by           BIGINT,
    picked_at           TIMESTAMP,
    transferred_by      BIGINT,
    transferred_at      TIMESTAMP,
    received_by         BIGINT,
    received_at         TIMESTAMP,
    closed_by           BIGINT,
    closed_at           TIMESTAMP,
    remarks             TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    deleted_at          TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_fmr_factory_status ON factory_material_requisitions(factory_id, status);
CREATE INDEX IF NOT EXISTS idx_fmr_plan ON factory_material_requisitions(production_plan_id);
CREATE INDEX IF NOT EXISTS idx_fmr_required_date ON factory_material_requisitions(required_date);

CREATE TABLE IF NOT EXISTS factory_material_requisition_items (
    id                 VARCHAR(64) PRIMARY KEY,
    requisition_id     VARCHAR(64) NOT NULL REFERENCES factory_material_requisitions(id) ON DELETE CASCADE,
    material_type_id   VARCHAR(64) NOT NULL,
    material_name      VARCHAR(200),
    material_category  VARCHAR(20) DEFAULT 'RAW',    -- RAW / AUXILIARY / PACKAGING
    bom_item_id        BIGINT,
    required_qty       NUMERIC(15,3),
    picked_qty         NUMERIC(15,3),
    issued_qty         NUMERIC(15,3),
    consumed_qty       NUMERIC(15,3),
    returned_qty       NUMERIC(15,3),
    unit               VARCHAR(20),
    batch_numbers      JSONB,                        -- [{batchNo, qty}, ...]
    created_at         TIMESTAMP DEFAULT NOW(),
    updated_at         TIMESTAMP DEFAULT NOW(),
    deleted_at         TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_fmri_req ON factory_material_requisition_items(requisition_id);
CREATE INDEX IF NOT EXISTS idx_fmri_material ON factory_material_requisition_items(material_type_id);

COMMENT ON TABLE factory_material_requisitions IS '工厂物料需求单 — 生产计划↔库存调拨之间的任务单 (P0-5, W2-3)';
COMMENT ON TABLE factory_material_requisition_items IS '物料需求单明细行 — 按 BOM 展开';
