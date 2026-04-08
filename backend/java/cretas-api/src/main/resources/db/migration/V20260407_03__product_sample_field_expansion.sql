-- V3 P0 + Verification Round 2 Agent A 截图 1 字段补齐
--
-- 客户截图 14:09 显示研发样品详情页 24+ 字段, 我们当前 ProductSample 实体
-- 缺 8 个核心字段, Agent A 评分 3/10, 客户演示必反馈.
--
-- 本迁移补 8 个字段, 不引入新表 (沿用 ProductSample 单表):
-- 1. customer_expected_price — 客户预期价格 (有些客户自带价格)
-- 2. product_status — 产品状态枚举
-- 3. customer_type — 客户性质 (餐饮/商超/新零售...)
-- 4. customer_latest_requirement — 客户最新要求 (长文本)
-- 5. sample_version — 样品版本号 (第一次打样...)
-- 6. selling_points — 产品卖点 (长文本)
-- 7. customer_code — 客户编码 (LSM20250037)
-- 8. customer_level — 客户级别 (A/B/C)

ALTER TABLE product_samples
    ADD COLUMN IF NOT EXISTS customer_expected_price NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS product_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS customer_latest_requirement TEXT,
    ADD COLUMN IF NOT EXISTS sample_version VARCHAR(50),
    ADD COLUMN IF NOT EXISTS selling_points TEXT,
    ADD COLUMN IF NOT EXISTS customer_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS customer_level VARCHAR(10);

COMMENT ON COLUMN product_samples.customer_expected_price IS '客户预期价格 — 有些客户自带价格过来 (V3 P0 / 会议 942-947s)';
COMMENT ON COLUMN product_samples.product_status IS '产品状态枚举: 试样研发/不适宜合作/可合作/已转报模/已废弃';
COMMENT ON COLUMN product_samples.customer_type IS '客户性质: 餐饮/商超/新零售/团餐/其他';
COMMENT ON COLUMN product_samples.customer_latest_requirement IS '客户最新要求 (长文本) — 截图 14:09 示例字段';
COMMENT ON COLUMN product_samples.sample_version IS '样品版本号: 第一次打样/第二次打样/确认版';
COMMENT ON COLUMN product_samples.selling_points IS '产品卖点 (长文本)';
COMMENT ON COLUMN product_samples.customer_code IS '客户编码 (如 LSM20250037) — 关联 customers.code';
COMMENT ON COLUMN product_samples.customer_level IS '客户级别 A/B/C';
