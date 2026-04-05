-- 六扇门客户反馈：销售订单/采购订单行项目增加 规格+箱数 字段

-- SalesOrderItem
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS specification VARCHAR(200);
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS box_quantity DECIMAL(15,2);

-- PurchaseOrderItem
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS specification VARCHAR(200);
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS box_quantity DECIMAL(15,2);
