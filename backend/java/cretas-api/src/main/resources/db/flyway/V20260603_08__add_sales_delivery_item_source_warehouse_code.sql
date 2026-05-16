-- T4-D5 (issue #553): propagate source_warehouse_code from SalesOrderItem
-- through to SalesDeliveryItem so delivery records preserve which warehouse
-- each line was supposed to ship FROM.
--
-- Closes the second half of the T4-D1 / T4-D5 family (#525 / #553):
--   - PR #547 added sales_order_items.source_warehouse_code (user pick at
--     order creation: WH-LOG 总仓 / WH-WKS 线边仓)
--   - THIS migration: sales_delivery_items.source_warehouse_code (preserved
--     when delivery is created from the sales order)
--
-- F006 customer expectation (audit doc T4-D5, 第四次会议 706-732):
--   "总仓再会去安排什么时候发给那个客户... 我的成品库存我会调拨给那个总仓去"
--
-- Scope of THIS migration:
--   - Schema only: nullable VARCHAR(20) column
--   - Service-layer plumbing propagates from request → entity (no inventory
--     allocation refactor — that requires PRD decisions on fallback/split
--     and is filed as follow-up scope)
--
-- After this lands:
--   - Frontend delivery dialog can pass per-line sourceWarehouseCode
--   - Delivery records keep the warehouse hint for reports + future
--     intelligent allocation
--   - Existing FinishedGoodsBatch allocation continues to use its default
--     logic (NOT filtered by warehouse yet)
ALTER TABLE sales_delivery_items
    ADD COLUMN IF NOT EXISTS source_warehouse_code VARCHAR(20) NULL;

COMMENT ON COLUMN sales_delivery_items.source_warehouse_code IS
    'T4-D5 (PR closing #553): WH-LOG (总仓) / WH-WKS (线边仓) — preserved from sales_order_items.source_warehouse_code when delivery is created. Inventory allocation does not yet filter by this column (follow-up scope per #553 PR body).';
