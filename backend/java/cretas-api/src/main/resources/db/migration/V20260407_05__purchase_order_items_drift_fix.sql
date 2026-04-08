-- W2-1 — 修复 purchase_order_items 历史 schema 漂移
--
-- 问题: PurchaseOrderItem entity 已有 specification + box_quantity 字段
-- (见 commit 776d680f, 4b058083), 但 product_samples 类型的 schema 漂移
-- 在本地 DB 同样发生 — 这两个列从未在 DB 建立, 导致 GET /purchase/orders 500.
--
-- 跟 V20260407_03 product_samples 漂移修复同款问题, 同样 ALTER ... IF NOT EXISTS.
--
-- 触发场景: D7 PM Playwright 演示销售订单详情页"关联采购"tab 调
--   GET /F001/purchase/orders?salesOrderId=...
-- 导致 500 错误, 客户演示前必须修.

ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS specification VARCHAR(200),
    ADD COLUMN IF NOT EXISTS box_quantity NUMERIC(15, 2);

COMMENT ON COLUMN purchase_order_items.specification IS
'物料规格 — 与 SalesOrderItem 对齐';

COMMENT ON COLUMN purchase_order_items.box_quantity IS
'箱数 — 与 SalesOrderItem 对齐';
