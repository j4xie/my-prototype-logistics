-- T4-D1 (issue #525): add source_warehouse_code to sales_order_items
--
-- F006 customer reported (第四次会议 line 702-732 + 706-732):
--   "成品会调回总仓 ... 总仓再会去安排什么时候发给那个客户 ... 我的成品库存
--    我会调拨给那个总仓去"
--
-- Expected: sales order line items should record which warehouse (WH-LOG 总仓
-- / WH-WKS 线边仓) each line will ship FROM. Currently the field is missing
-- → customer cannot specify source per line in the new-dialog, and detail
-- view cannot show the source.
--
-- This migration adds the nullable column. Default NULL → existing rows are
-- unaffected. Downstream T4-D5 (issue #531 / separate ticket) will wire the
-- outbound logic to honor this field; this migration only enables the data
-- contract.
--
-- Schema notes:
--   - VARCHAR(20) matches factory_warehouses.code length
--   - Nullable: legacy rows + drafts where user hasn't picked yet
--   - No FK to factory_warehouses (the code can outlive a renamed warehouse;
--     UI uses utils/warehouse.ts warehouseDisplayLabel for human label)
--   - No index: column is informational, not a query predicate (yet)
ALTER TABLE sales_order_items
    ADD COLUMN IF NOT EXISTS source_warehouse_code VARCHAR(20) NULL;

COMMENT ON COLUMN sales_order_items.source_warehouse_code IS
    'T4-D1 (PR closing #525): WH-LOG (总仓) / WH-WKS (线边仓) — source warehouse for this line item shipment. Nullable for legacy rows + drafts. Per utils/warehouse.ts mapping.';
