-- =====================================================
-- 01_truncate.sql - 清空现有商品数据
-- 警告: 此操作不可逆，请确保已执行备份!
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 清空商品SKU规格关联
TRUNCATE TABLE goods_spu_spec;

-- 清空商品SKU
TRUNCATE TABLE goods_sku;

-- 清空商品SPU
TRUNCATE TABLE goods_spu;

-- 清空商品分类 (将重建)
TRUNCATE TABLE goods_category;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Truncate completed. Ready for import.' AS status;
