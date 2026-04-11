-- B2+B4: Fix ck_po_status + ck_so_status CHECK constraints
-- Missing states: PENDING_FINANCE_REVIEW, FINANCE_APPROVED, FINANCE_REJECTED
-- Source: Phase A gap audit (docs/plans/v3-gap-ledger.md)
--
-- PurchaseOrderStatus enum (full):
--   DRAFT, SUBMITTED, APPROVED, PENDING_FINANCE_REVIEW, FINANCE_APPROVED,
--   FINANCE_REJECTED, PARTIAL_RECEIVED, COMPLETED, CANCELLED, CLOSED
--
-- SalesOrderStatus enum (full):
--   DRAFT, CONFIRMED, PENDING_FINANCE_REVIEW, FINANCE_APPROVED,
--   FINANCE_REJECTED, PROCESSING, PARTIAL_DELIVERED, COMPLETED, CANCELLED

BEGIN;

-- B2: purchase_orders — add PENDING_FINANCE_REVIEW, FINANCE_APPROVED, FINANCE_REJECTED
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS ck_po_status;
ALTER TABLE purchase_orders ADD CONSTRAINT ck_po_status CHECK (
    status IN (
        'DRAFT',
        'SUBMITTED',
        'APPROVED',
        'PENDING_FINANCE_REVIEW',
        'FINANCE_APPROVED',
        'FINANCE_REJECTED',
        'PARTIAL_RECEIVED',
        'COMPLETED',
        'CANCELLED',
        'CLOSED'
    )
);

-- B4: sales_orders — add PENDING_FINANCE_REVIEW, FINANCE_APPROVED, FINANCE_REJECTED
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS ck_so_status;
ALTER TABLE sales_orders ADD CONSTRAINT ck_so_status CHECK (
    status IN (
        'DRAFT',
        'CONFIRMED',
        'PENDING_FINANCE_REVIEW',
        'FINANCE_APPROVED',
        'FINANCE_REJECTED',
        'PROCESSING',
        'PARTIAL_DELIVERED',
        'COMPLETED',
        'CANCELLED'
    )
);

COMMIT;

-- Verification
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname IN ('ck_po_status', 'ck_so_status');
