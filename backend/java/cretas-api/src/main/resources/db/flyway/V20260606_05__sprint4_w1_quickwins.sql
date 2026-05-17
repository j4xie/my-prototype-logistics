-- Sprint 4 W1 Chat A Quick wins bundle: 3 schema changes (P1-级业务字段).
--
-- 包含 (W-CLASS-1 不需 DDL: WarehouseType 存 VARCHAR(20), 仅 enum 扩展):
--   - P-IMPORT-1: purchase_orders.is_imported BOOLEAN (是否进口)
--   - S-PAYMENT-DATE-1: customers.settlement_date INTEGER (对账日 1-31)
--   - Q-MODE-1: quality_inspections.inspection_mode VARCHAR(20) (全检/抽检)
--
-- 所有字段 nullable 以兼容 backfill, 不破坏现有数据.

-- ============================================================
-- P-IMPORT-1: purchase_orders.is_imported
-- ============================================================
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS is_imported BOOLEAN;

COMMENT ON COLUMN purchase_orders.is_imported IS
    'Sprint 4 W1 P-IMPORT-1: 是否进口采购. NULL=未指定, TRUE=进口需海关报关, FALSE=境内. 跟 purchase_type 正交.';

-- ============================================================
-- S-PAYMENT-DATE-1: customers.settlement_date (1-31)
-- ============================================================
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS settlement_date INTEGER;

ALTER TABLE customers
    DROP CONSTRAINT IF EXISTS chk_customer_settlement_date;

ALTER TABLE customers
    ADD CONSTRAINT chk_customer_settlement_date
    CHECK (settlement_date IS NULL OR (settlement_date BETWEEN 1 AND 31));

COMMENT ON COLUMN customers.settlement_date IS
    'Sprint 4 W1 S-PAYMENT-DATE-1: 客户级对账日 (每月几号), 1-31, NULL=未指定. 月底特殊值 31 在 2/4/6/9/11 月由调用方降级月末.';

-- ============================================================
-- Q-MODE-1: quality_inspections.inspection_mode
-- ============================================================
ALTER TABLE quality_inspections
    ADD COLUMN IF NOT EXISTS inspection_mode VARCHAR(20);

COMMENT ON COLUMN quality_inspections.inspection_mode IS
    'Sprint 4 W1 Q-MODE-1: 检验模式. FULL_INSPECTION=全检 (sample_size==生产批量), SAMPLING=抽检. NULL for backfill.';
