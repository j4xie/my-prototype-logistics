-- 销售订单新增财务审核字段
-- 业务流程: DRAFT -> CONFIRMED -> PENDING_FINANCE_REVIEW -> FINANCE_APPROVED -> PROCESSING
-- 财务审核通过后才能触发供应链联动（生产计划+采购建议）

ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS finance_reviewed_by BIGINT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS finance_reviewed_at TIMESTAMP;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS finance_review_notes TEXT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(15, 2);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS estimated_profit NUMERIC(15, 2);

-- 为财务审核状态查询加索引
CREATE INDEX IF NOT EXISTS idx_so_finance_status ON sales_orders (status)
    WHERE status IN ('PENDING_FINANCE_REVIEW', 'FINANCE_APPROVED', 'FINANCE_REJECTED');

COMMENT ON COLUMN sales_orders.finance_reviewed_by IS '财务审核人ID';
COMMENT ON COLUMN sales_orders.finance_reviewed_at IS '财务审核时间';
COMMENT ON COLUMN sales_orders.finance_review_notes IS '财务审核意见/驳回原因';
COMMENT ON COLUMN sales_orders.estimated_cost IS '预估BOM成本（基于BOM + 历史采购均价）';
COMMENT ON COLUMN sales_orders.estimated_profit IS '预估利润（totalAmount - estimatedCost）';
