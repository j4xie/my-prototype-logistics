-- material_consumptions
ALTER TABLE material_consumptions ADD COLUMN IF NOT EXISTS material_type_id VARCHAR(255);
ALTER TABLE material_consumptions ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP;
ALTER TABLE material_consumptions ADD COLUMN IF NOT EXISTS consumption_time TIMESTAMP;
ALTER TABLE material_consumptions ADD COLUMN IF NOT EXISTS planned_quantity NUMERIC;
ALTER TABLE material_consumptions ADD COLUMN IF NOT EXISTS production_plan_id VARCHAR(255);
ALTER TABLE material_consumptions ADD COLUMN IF NOT EXISTS source_type VARCHAR(255);
ALTER TABLE material_consumptions ADD COLUMN IF NOT EXISTS total_cost NUMERIC;
ALTER TABLE material_consumptions ADD COLUMN IF NOT EXISTS unit_price NUMERIC;

-- sales_orders
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS actual_shipped_amount NUMERIC;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS box_quantity INTEGER;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS created_by BIGINT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS delivery_reminder_date DATE;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS estimated_profit NUMERIC;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS finance_review_notes TEXT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS finance_reviewed_at TIMESTAMP;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS finance_reviewed_by BIGINT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS quote_id VARCHAR(255);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS settlement_flag BOOLEAN;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS shipping_included BOOLEAN;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS transport_plan_status VARCHAR(50);

-- shipment_records
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS batch_number VARCHAR(255);
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS logistics_company VARCHAR(255);
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255);
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS sales_order_id VARCHAR(255);
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS total_weight NUMERIC;
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS total_boxes INTEGER;
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS shipped_by BIGINT;
