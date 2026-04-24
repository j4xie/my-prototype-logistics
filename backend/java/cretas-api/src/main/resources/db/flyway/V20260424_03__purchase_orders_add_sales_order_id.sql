-- W-12 fix (Round 15 findings): purchase_orders.sales_order_id column missing.
--
-- Background: SO detail page has "关联采购" tab (line 1056+, detail.vue) that
-- loads `/purchase/orders?salesOrderId={id}` and filters client-side
-- `po.salesOrderId === orderId`. But PurchaseOrder entity had NO sales_order_id
-- field and backend ignored the filter param — tab was ALWAYS empty.
-- Customer docx requirement (系统修改意见.docx) explicitly: "主原料 (贵重料) 必须
-- 按销售订单做定点追踪, 防止多采浪费". Feature was structurally unimplemented.
-- FE had a `relatedSalesOrderId` form field but stripped it from POST payload
-- and only embedded ref as text in `remark` ("[关联销售订单: SO-XXX]") — hack.
--
-- Fix: proper relational column + index. Nullable to support existing "无单采购"
-- (direct purchase not tied to SO) and backfill-safe for pre-fix rows.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS sales_order_id VARCHAR(191);

CREATE INDEX IF NOT EXISTS idx_purchase_sales_order ON purchase_orders (sales_order_id);

COMMENT ON COLUMN purchase_orders.sales_order_id IS 'Optional FK to sales_orders.id. Populated when PO is created to fulfill a specific SO (为防止多采浪费做定点追踪). Null means 无单采购 (direct/general purchase).';
