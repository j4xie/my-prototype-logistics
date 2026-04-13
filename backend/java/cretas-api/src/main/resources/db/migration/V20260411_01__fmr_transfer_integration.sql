-- V3 P0-5 — FMR ↔ InternalTransfer 双仓集成
--
-- 客户 v1 §2.3 / 会议 3128s 原话:
--   物料需求单 → 仓库备料 → 工厂调拨 → 报工 → 退料
--
-- 需要:
-- 1. InternalTransfer 支持工厂内跨仓调拨 (source/target warehouse nullable 字段)
-- 2. FactoryMaterialRequisition 关联 2 个 transferId:
--    - outboundTransferId: 备料调出 (物流仓 → 工厂鲜棉仓), transferToFactory 时创建
--    - returnTransferId:   退料调入 (工厂鲜棉仓 → 物流仓), close 时如果 returnedQty>0 则创建

ALTER TABLE internal_transfers
    ADD COLUMN IF NOT EXISTS source_warehouse_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS target_warehouse_id VARCHAR(64);

COMMENT ON COLUMN internal_transfers.source_warehouse_id IS
    '工厂内跨仓调拨: 调出仓库ID. null = 跨工厂调拨 (老语义)';
COMMENT ON COLUMN internal_transfers.target_warehouse_id IS
    '工厂内跨仓调拨: 调入仓库ID. null = 跨工厂调拨 (老语义)';

ALTER TABLE factory_material_requisitions
    ADD COLUMN IF NOT EXISTS outbound_transfer_id VARCHAR(191),
    ADD COLUMN IF NOT EXISTS return_transfer_id VARCHAR(191);

COMMENT ON COLUMN factory_material_requisitions.outbound_transfer_id IS
    '关联的备料调出 InternalTransfer ID (transferToFactory 时创建)';
COMMENT ON COLUMN factory_material_requisitions.return_transfer_id IS
    '关联的退料调入 InternalTransfer ID (close 时如果 returnedQty>0 则创建)';

CREATE INDEX IF NOT EXISTS idx_fmr_outbound_tr ON factory_material_requisitions(outbound_transfer_id);
CREATE INDEX IF NOT EXISTS idx_fmr_return_tr ON factory_material_requisitions(return_transfer_id);
