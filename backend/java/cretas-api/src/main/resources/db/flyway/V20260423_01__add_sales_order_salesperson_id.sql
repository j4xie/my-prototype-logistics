-- V20260423_01__add_sales_order_salesperson_id.sql
-- Add salesperson_id column for dual-field salesperson migration (option 3)
-- Old orders keep salesperson string; new orders write both salesperson_id (UUID) + salesperson (snapshot name)

ALTER TABLE sales_orders
ADD COLUMN salesperson_id VARCHAR(191) NULL;

CREATE INDEX idx_so_salesperson_id ON sales_orders(salesperson_id) WHERE salesperson_id IS NOT NULL;

COMMENT ON COLUMN sales_orders.salesperson_id IS '业务员 user_id (新数据); 老数据为 NULL, 用 salesperson 字符串字段兜底显示';
