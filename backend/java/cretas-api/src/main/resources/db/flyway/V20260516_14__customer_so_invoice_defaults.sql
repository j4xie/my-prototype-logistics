-- Sprint 4 W2 S-INVOICE-CLIENT-1: 客户级 + 订单级 开票默认 (Option 3 三层 default 链)
--
-- 第 1 层: Customer.default_tax_rate / default_invoice_type — org 级默认
-- 第 2 层: SalesOrder.default_tax_rate / default_invoice_type — 单据级临时覆盖
-- 第 3 层: SalesOrderItem.tax_rate (已存在) + InvoiceRecord.invoice_type (已存在) — 最终落地
--
-- Prefill 顺序 (在 Service 层实现):
--   1. SalesOrder.create — 若未传 → 用 customer.default_*
--   2. SalesOrderItem.create — 若未传 taxRate → 用 SO.defaultTaxRate (兜底 customer.default → 0)
--   3. InvoiceRecord.create — 若未传 invoiceType → 用 SO.defaultInvoiceType (兜底 customer.default → NORMAL)
--
-- 全部 nullable — 老数据不强制回填, prefill 链允许 null 跳层 fallback.

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS default_tax_rate     NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS default_invoice_type VARCHAR(20);

ALTER TABLE sales_orders
    ADD COLUMN IF NOT EXISTS default_tax_rate     NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS default_invoice_type VARCHAR(20);

COMMENT ON COLUMN customers.default_tax_rate         IS '客户级默认税率 (%) — SO 创建 prefill 第 1 层';
COMMENT ON COLUMN customers.default_invoice_type     IS '客户级默认开票类型 (InvoiceType enum) — SO 创建 prefill 第 1 层';
COMMENT ON COLUMN sales_orders.default_tax_rate      IS '单据级默认税率 (%) — Item/Invoice prefill 第 2 层 (来自客户 default 可覆盖)';
COMMENT ON COLUMN sales_orders.default_invoice_type  IS '单据级默认开票类型 (InvoiceType enum) — Item/Invoice prefill 第 2 层';
