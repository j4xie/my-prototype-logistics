-- Expand ck_po_status CHECK constraint to include finance-review states.
--
-- PurchaseOrderStatus enum was expanded to cover a 2-step approval flow:
--   DRAFT → SUBMITTED → APPROVED (operations) → PENDING_FINANCE_REVIEW
--        → FINANCE_APPROVED | FINANCE_REJECTED
-- but the DB CHECK only allowed the original 7 statuses, so any UPDATE
-- that transitioned through the finance-review path failed:
--   ERROR: new row for relation "purchase_orders" violates check
--   constraint "ck_po_status"
--
-- Observed prod 2026-04-16 04:05:13 when user 1511 submitted
-- PO-20260416-0001 for finance review. DROP + ADD is the only way to
-- change CHECK constraint bounds in PostgreSQL.
--
-- Already applied in-place on prod + test.

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
