-- V3 P0-2 — 产品大类隔离 bug 修复
--
-- 客户原话 (会议 1503-1510s): "选成品但能看到原料"
--
-- 历史遗留: product_types 表存在两个大类字段
--   - category (旧, 自由字符串, 中文如"成品"/"原料"/"包材")
--   - product_category (新, 约定枚举值: FINISHED_PRODUCT/RAW_MATERIAL/PACKAGING/SEASONING/CUSTOMER_MATERIAL)
--
-- 新数据写 product_category, 老数据写 category, 列表显示用 || 兜底,
-- 但 ServiceImpl 完全没用 product_category 过滤 — 这是真正的 bug 根因.
--
-- 本迁移完成 3 件事:
-- 1. 把老 category 字段中的中文标签映射到 product_category 枚举值
-- 2. 给 product_category 加索引 (按工厂查询时常用)
-- 3. 不删除老 category 字段, 保留只读供前端兼容显示, 后续 Phase 4 再删

-- ────────────────────────────────────────────
-- Step 1: 中文 → 英文枚举映射 (仅在 product_category 为空时)
-- ────────────────────────────────────────────

UPDATE product_types
SET product_category = 'FINISHED_PRODUCT'
WHERE product_category IS NULL
  AND category IN ('成品', '产品', '产成品', 'finished', 'FINISHED');

UPDATE product_types
SET product_category = 'RAW_MATERIAL'
WHERE product_category IS NULL
  AND category IN ('原料', '原材料', '主料', 'raw', 'RAW');

UPDATE product_types
SET product_category = 'PACKAGING'
WHERE product_category IS NULL
  AND category IN ('包材', '包装材料', '包装', 'packaging', 'PACKAGING');

UPDATE product_types
SET product_category = 'SEASONING'
WHERE product_category IS NULL
  AND category IN ('调味品', '调料', '辅料', '调油品', 'seasoning', 'SEASONING');

UPDATE product_types
SET product_category = 'CUSTOMER_MATERIAL'
WHERE product_category IS NULL
  AND category IN ('客户物料', '客户料', '客户来料', 'customer', 'CUSTOMER_MATERIAL');

-- 兜底: 仍然没分类的视为成品 (避免漏过滤)
UPDATE product_types
SET product_category = 'FINISHED_PRODUCT'
WHERE product_category IS NULL OR product_category = '';

-- ────────────────────────────────────────────
-- Step 2: 索引
-- ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_product_types_factory_category
    ON product_types (factory_id, product_category)
    WHERE deleted_at IS NULL;

-- ────────────────────────────────────────────
-- Step 3: 注释提示
-- ────────────────────────────────────────────

COMMENT ON COLUMN product_types.product_category IS
'V3 P0-2 — 产品大类枚举: FINISHED_PRODUCT/RAW_MATERIAL/PACKAGING/SEASONING/CUSTOMER_MATERIAL. 主字段, 用于按大类过滤查询.';

COMMENT ON COLUMN product_types.category IS
'V3 P0-2 — 历史遗留字段, 仅供前端兼容显示, 不再用于过滤查询. Phase 4 删除.';
