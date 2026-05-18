-- V20260607_04: 把 WORKFLOW_RUNNING 加进 purchase_orders.ck_po_status CHECK 约束
--
-- Phase 1 Canvas-Workflow PR #862 follow-up — B.6 subagent 加了 Java enum
-- PurchaseOrderStatus.WORKFLOW_RUNNING 但漏了 DB 端 CHECK 约束更新.
-- F006 PO ¥40000 触发 workflow → PO 试图 UPDATE status='WORKFLOW_RUNNING'
-- → "violates check constraint ck_po_status" → 409 → 整个 workflow 回滚.
--
-- E2E 验证 2026-05-19 01:38 抓到此 bug.

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS ck_po_status;

ALTER TABLE purchase_orders ADD CONSTRAINT ck_po_status
    CHECK (status::text = ANY (ARRAY[
        'DRAFT',
        'SUBMITTED',
        'APPROVED',
        'WORKFLOW_RUNNING',
        'PENDING_FINANCE_REVIEW',
        'FINANCE_APPROVED',
        'FINANCE_REJECTED',
        'PARTIAL_RECEIVED',
        'COMPLETED',
        'CANCELLED',
        'CLOSED'
    ]::text[]));

COMMENT ON CONSTRAINT ck_po_status ON purchase_orders IS
    'PurchaseOrderStatus enum allowed values. WORKFLOW_RUNNING added by Phase 1 Canvas-Workflow (PR #862 follow-up).';
