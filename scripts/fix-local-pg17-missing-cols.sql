-- product_types missing columns
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS box_conversion_coefficient NUMERIC;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS brand VARCHAR(255);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS complexity_score NUMERIC;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS created_by BIGINT;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS custom_schema_overrides TEXT;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS default_sop_config_id VARCHAR(255);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS equipment_ids TEXT;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS form_template_id VARCHAR(255);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS inventory_warning_threshold INTEGER;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS minimum_order_quantity NUMERIC;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS package_spec VARCHAR(255);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS processing_steps TEXT;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS production_time_minutes INTEGER;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS quality_check_ids TEXT;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS recipe_version VARCHAR(255);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS related_customer VARCHAR(255);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS settlement_method VARCHAR(255);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS skill_requirements TEXT;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS tax_included_unit_price NUMERIC;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS temperature_zone VARCHAR(255);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS template_id VARCHAR(255);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS work_hours NUMERIC;

-- internal_transfers missing columns
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS production_plan_id VARCHAR(255);
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS approved_by BIGINT;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS expected_arrival_date DATE;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS requested_by BIGINT;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS total_amount NUMERIC;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS transfer_date DATE;
ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(255);

-- price_lists missing column
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);

-- raw_material_types missing columns (for BOM/procurement)
ALTER TABLE raw_material_types ADD COLUMN IF NOT EXISTS moving_avg_price NUMERIC;
ALTER TABLE raw_material_types ADD COLUMN IF NOT EXISTS unit_price NUMERIC;

-- material_batches fix remaining json columns
ALTER TABLE material_batches ALTER COLUMN quality_info TYPE TEXT USING quality_info::TEXT;
