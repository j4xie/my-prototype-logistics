-- V20260516_01: 统一跨业务关联表 (Sprint 3 Track-F C-LINKARRAY-1)
--
-- 背景: 宏见 ERP 的 linkListArray 8 类跨业务关联 (sale/sample/request/produce/
-- outsource/stock/project/free), Cretas 各业务单 (ReturnOrder/ProductionPlan/
-- 拆单等) 各自 hard-code link 字段, 缺统一查询入口. 此表为通用 link store.
--
-- 设计:
--   * 独立 table (而非 JSONB column): 支持索引 + 反查 "谁 link 了我"
--   * owner_* = 持有 link 的业务单, target_* = 关联对象
--   * link_type: sale / sample / request / produce / outsource / stock / project / free
--   * target_type: SALES_ORDER / PURCHASE_ORDER / PRODUCTION_PLAN / RETURN_ORDER /
--                  INVENTORY_TRANSACTION / SAMPLE_REQUEST / PROJECT / FREE_LINK ...
--   * unique idx (owner_type, owner_id, target_type, target_id): 防重复 link
--   * reverse idx (factory_id, target_type, target_id): 反查 "谁 link 了我"
--
-- 兼容性: 现有 sourceOrderId 等 hard-code link 字段不删, 双轨过渡 (新调用
-- LinkArrayService.link(), 老字段保留向后兼容).

CREATE TABLE IF NOT EXISTS business_links (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL,
    owner_type VARCHAR(64) NOT NULL,
    owner_id VARCHAR(191) NOT NULL,
    link_type VARCHAR(32) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(191) NOT NULL,
    description VARCHAR(255),
    linked_by VARCHAR(64),
    linked_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_business_link_unique UNIQUE (owner_type, owner_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_business_link_owner ON business_links (factory_id, owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_business_link_target ON business_links (factory_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_business_link_type ON business_links (factory_id, link_type);
