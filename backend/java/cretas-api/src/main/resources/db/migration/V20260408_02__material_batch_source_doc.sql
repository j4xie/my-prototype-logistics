-- P0-17: 入库必须有发起单 — MaterialBatch 增加 sourceDocType / sourceDocId
-- 昆山六扇门客户需求: 入库不能凭空, 必须引用采购到货通知 / 领料退料单 / 销售退货单 / 手工调整

ALTER TABLE material_batches
    ADD COLUMN IF NOT EXISTS source_doc_type VARCHAR(32),
    ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_material_batches_source_doc
    ON material_batches(source_doc_type, source_doc_id);

COMMENT ON COLUMN material_batches.source_doc_type IS '发起单类型: PURCHASE_RECEIVE / MATERIAL_REQUISITION_RETURN / SALES_RETURN / MANUAL_ADJUST';
COMMENT ON COLUMN material_batches.source_doc_id IS '发起单ID (对应类型的单据主键)';
