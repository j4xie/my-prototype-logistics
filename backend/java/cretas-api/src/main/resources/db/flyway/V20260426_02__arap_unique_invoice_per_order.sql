-- R23 audit I2: race window between duplicate-check and SO/PO status validation.
--
-- 背景: ArApServiceImpl.recordReceivable / recordPayable 内部:
--   1. existsByFactoryIdAndSalesOrderIdAndTransactionType(factory, so, AR_INVOICE) — 存在则 throw
--   2. validateReceivableStatus(so, factory) — 状态检查
--   3. transactionRepository.save(...) — 写入
-- 两个并发线程同时 POST 同一 SO: 都过 step 1 (此时还无行), 都过 step 2 (SO 是 FINANCE_APPROVED),
-- 都进入 step 3 → 重复 AR_INVOICE 行. 应用层 race-check 不够, 必须 DB-level UNIQUE 约束兜底.
--
-- 修复: partial unique index, 仅约束 AR_INVOICE/AP_INVOICE + 未软删 + 关联 order id 非 NULL.
-- 不影响其他类型 (AR_PAYMENT/AR_ADJUSTMENT etc — 同一订单可有多笔付款/调整).
--
-- prod 已验证 0 重复行 (sudo -iu postgres psql 2026-04-26).

-- AR_INVOICE: 每 (factory, sales_order) 仅一笔挂账
CREATE UNIQUE INDEX IF NOT EXISTS uk_aat_ar_invoice_per_so
    ON ar_ap_transactions (factory_id, sales_order_id)
    WHERE transaction_type = 'AR_INVOICE'
        AND deleted_at IS NULL
        AND sales_order_id IS NOT NULL;

-- AP_INVOICE: 每 (factory, purchase_order) 仅一笔挂账
CREATE UNIQUE INDEX IF NOT EXISTS uk_aat_ap_invoice_per_po
    ON ar_ap_transactions (factory_id, purchase_order_id)
    WHERE transaction_type = 'AP_INVOICE'
        AND deleted_at IS NULL
        AND purchase_order_id IS NOT NULL;

-- Sanity: 不能再有重复行
DO $$
DECLARE
    ar_dupes INTEGER;
    ap_dupes INTEGER;
BEGIN
    SELECT COUNT(*) INTO ar_dupes FROM (
        SELECT factory_id, sales_order_id FROM ar_ap_transactions
        WHERE transaction_type = 'AR_INVOICE' AND deleted_at IS NULL AND sales_order_id IS NOT NULL
        GROUP BY 1, 2 HAVING COUNT(*) > 1
    ) t;
    SELECT COUNT(*) INTO ap_dupes FROM (
        SELECT factory_id, purchase_order_id FROM ar_ap_transactions
        WHERE transaction_type = 'AP_INVOICE' AND deleted_at IS NULL AND purchase_order_id IS NOT NULL
        GROUP BY 1, 2 HAVING COUNT(*) > 1
    ) t;
    IF ar_dupes > 0 OR ap_dupes > 0 THEN
        RAISE EXCEPTION 'V20260426_02 sanity FAILED: AR dupes=%, AP dupes=% — manual cleanup required before retry',
            ar_dupes, ap_dupes;
    END IF;
END
$$;
