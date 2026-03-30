-- Issue 15: Add inbound_type to material_batches
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS inbound_type VARCHAR(30);

-- Issue 16: Add sales order extended fields
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS salesperson VARCHAR(100);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS shipping_included BOOLEAN;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(15, 2);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS actual_shipped_amount NUMERIC(15, 2);
