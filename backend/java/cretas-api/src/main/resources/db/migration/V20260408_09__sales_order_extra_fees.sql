-- B2: 销售订单"其他费用" 字段 (客户原话 Apr 7 transcript 2326-2334s)
-- B1 (运费 shipping_included/shipping_fee) 已存在, 本次仅新增 extra_fees JSONB.
-- 数组结构: [{"name": "装卸费", "amount": 100.00, "remark": "..."}]

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS extra_fees JSONB;
