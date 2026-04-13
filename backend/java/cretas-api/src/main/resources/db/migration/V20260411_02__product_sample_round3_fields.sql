-- Round 3 字段补齐 — 对照客户截图 14:09 (t014m09s_0047_s.jpg)
--
-- V20260407_03 补齐 8+4 字段后 (Round 2), 客户截图里仍显示 6 个字段未落地:
--   - 成品报价 / 原料价格 / 加工费 (定价三元组)
--   - 主原料信息 (详细描述) / 主要原料出成率 (百分比)
--   - 主原料图片 (附件组)

ALTER TABLE product_samples
    ADD COLUMN IF NOT EXISTS product_quote_price NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS material_price NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS processing_fee NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS main_material_info TEXT,
    ADD COLUMN IF NOT EXISTS main_material_yield_rate NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS main_material_images TEXT;

COMMENT ON COLUMN product_samples.product_quote_price IS '成品报价 — 给客户的单价';
COMMENT ON COLUMN product_samples.material_price IS '原料价格 — 主原料单价';
COMMENT ON COLUMN product_samples.processing_fee IS '加工费 — 产品加工费用';
COMMENT ON COLUMN product_samples.main_material_info IS '主原料信息 (长文本, 详细描述; 区别于 main_material 字段的名称)';
COMMENT ON COLUMN product_samples.main_material_yield_rate IS '主要原料出成率 (百分比, 例如 80.00 = 80%)';
COMMENT ON COLUMN product_samples.main_material_images IS '主原料图片 URLs (JSON array)';
