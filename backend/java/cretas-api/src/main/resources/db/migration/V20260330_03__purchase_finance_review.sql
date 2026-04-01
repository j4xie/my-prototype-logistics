-- Phase 4: 采购订单财务审核字段
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS finance_reviewed_by BIGINT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS finance_reviewed_at TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS finance_review_notes TEXT;
