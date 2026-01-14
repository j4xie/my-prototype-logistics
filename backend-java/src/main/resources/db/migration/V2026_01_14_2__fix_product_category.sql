-- 修复 product_types 表的 product_category 字段
-- 根据产品名称和已有 category 字段推断产品分类

-- 1. 成品类 (FINISHED_PRODUCT) - 包含"成品"关键字或最终产品
UPDATE product_types
SET product_category = 'FINISHED_PRODUCT'
WHERE product_category IS NULL
  AND (
    name LIKE '%成品%'
    OR name LIKE '%酱%'
    OR name LIKE '%酱油%'
    OR name LIKE '%调味%'
    OR name LIKE '%料包%'
    OR name LIKE '%风味%'
    OR name LIKE '%鲜%'
    OR category = '成品'
    OR category = 'FINISHED'
  );

-- 2. 原材料 (RAW_MATERIAL) - 肉类、蔬菜、水产等
UPDATE product_types
SET product_category = 'RAW_MATERIAL'
WHERE product_category IS NULL
  AND (
    name LIKE '%肉%'
    OR name LIKE '%鸡%'
    OR name LIKE '%鸭%'
    OR name LIKE '%猪%'
    OR name LIKE '%牛%'
    OR name LIKE '%羊%'
    OR name LIKE '%菜%'
    OR name LIKE '%蔬%'
    OR name LIKE '%虾%'
    OR name LIKE '%鱼%'
    OR name LIKE '%海鲜%'
    OR name LIKE '%原料%'
    OR category = '原材料'
    OR category = 'RAW_MATERIAL'
  );

-- 3. 包辅材料 (PACKAGING) - 包装相关
UPDATE product_types
SET product_category = 'PACKAGING'
WHERE product_category IS NULL
  AND (
    name LIKE '%包装%'
    OR name LIKE '%袋%'
    OR name LIKE '%箱%'
    OR name LIKE '%盒%'
    OR name LIKE '%纸%'
    OR name LIKE '%膜%'
    OR name LIKE '%标签%'
    OR name LIKE '%瓶%'
    OR name LIKE '%罐%'
    OR category = '包装'
    OR category = 'PACKAGING'
  );

-- 4. 调味品 (SEASONING) - 调料类
UPDATE product_types
SET product_category = 'SEASONING'
WHERE product_category IS NULL
  AND (
    name LIKE '%盐%'
    OR name LIKE '%糖%'
    OR name LIKE '%醋%'
    OR name LIKE '%味精%'
    OR name LIKE '%胡椒%'
    OR name LIKE '%香料%'
    OR name LIKE '%料酒%'
    OR name LIKE '%酱油%'
    OR name LIKE '%油%'
    OR category = '调味'
    OR category = '调味品'
    OR category = 'SEASONING'
  );

-- 5. 客户自带材料 (CUSTOMER_MATERIAL) - 客户提供
UPDATE product_types
SET product_category = 'CUSTOMER_MATERIAL'
WHERE product_category IS NULL
  AND (
    name LIKE '%客户%'
    OR name LIKE '%代加工%'
    OR related_customer IS NOT NULL
    OR category = '客户'
    OR category = 'CUSTOMER'
  );

-- 6. 默认分类 - 未匹配的设为原材料
UPDATE product_types
SET product_category = 'RAW_MATERIAL'
WHERE product_category IS NULL;

-- 添加索引优化分类查询
CREATE INDEX IF NOT EXISTS idx_product_category ON product_types(product_category);
