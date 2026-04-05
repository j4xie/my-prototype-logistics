-- 六扇门客户反馈：样品管理新增字段
-- 产品级别、客户名称、业务员、储存方式

ALTER TABLE product_samples ADD COLUMN IF NOT EXISTS product_level VARCHAR(10);
ALTER TABLE product_samples ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200);
ALTER TABLE product_samples ADD COLUMN IF NOT EXISTS salesperson VARCHAR(100);
ALTER TABLE product_samples ADD COLUMN IF NOT EXISTS storage_method VARCHAR(50);
