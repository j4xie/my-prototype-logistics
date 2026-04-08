-- P0-14: BOM 拆原料/辅料/包材 3 块
-- 客户需求: BOM 中原料(RAW)、辅料(AUXILIARY)、包材(PACKAGING) 分 3 组展示和管理
-- 历史数据默认 RAW, 由运营手工调整

ALTER TABLE bom_items
    ADD COLUMN IF NOT EXISTS material_category VARCHAR(32) NOT NULL DEFAULT 'RAW';

CREATE INDEX IF NOT EXISTS idx_bom_items_category
    ON bom_items(factory_id, product_type_id, material_category);
