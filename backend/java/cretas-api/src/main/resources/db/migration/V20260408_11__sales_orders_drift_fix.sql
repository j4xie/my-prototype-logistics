-- W3 P0-12 selectable SO endpoint 暴露的 sales_orders schema 漂移
-- Entity 有字段 但 cretas_db / cretas_prod_db 缺列, 同 W2 production_plans 模式
-- 已在 test 环境手工应用, 此 migration 用于未来干净环境

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS actual_shipped_amount NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS box_quantity NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS delivery_reminder_date DATE,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS estimated_profit NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS finance_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS finance_reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS finance_reviewed_by BIGINT,
  ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS quote_id VARCHAR(191),
  ADD COLUMN IF NOT EXISTS salesperson VARCHAR(100),
  ADD COLUMN IF NOT EXISTS settlement_flag BOOLEAN,
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS shipping_included BOOLEAN,
  ADD COLUMN IF NOT EXISTS transport_plan_status VARCHAR(32);

-- sales_order_items 同步漂移 (W3 P0-12 暴露)
ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS box_quantity NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS cost_unit_price NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS specification VARCHAR(200),
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2);
