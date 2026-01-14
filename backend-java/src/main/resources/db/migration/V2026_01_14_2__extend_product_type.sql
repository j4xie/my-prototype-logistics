-- 产品信息管理增强字段
-- 添加产品大类、规格、关联客户、产品图片字段

ALTER TABLE product_types ADD COLUMN IF NOT EXISTS product_category VARCHAR(50);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS specification VARCHAR(200);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS related_customer VARCHAR(100);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_product_types_category ON product_types(product_category);
CREATE INDEX IF NOT EXISTS idx_product_types_related_customer ON product_types(related_customer);
