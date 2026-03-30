-- Add temperature_zone column to product_types table
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS temperature_zone VARCHAR(20);

COMMENT ON COLUMN product_types.temperature_zone IS '温区: 常温, 冷藏, 冷冻';
