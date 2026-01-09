-- Add custom_schema_overrides column to product_types table
-- This column stores JSON configuration for custom form schemas per entity type
-- Migration Date: 2026-01-08

-- Add the new column
ALTER TABLE product_types
ADD COLUMN custom_schema_overrides TEXT NULL COMMENT 'JSON: Custom form schema overrides for different entity types (MATERIAL_BATCH, QUALITY_CHECK, etc.)';

-- Verify the column was added
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME = 'product_types' AND COLUMN_NAME = 'custom_schema_overrides';

-- Example data format:
-- {
--   "MATERIAL_BATCH": {
--     "additionalFields": [
--       {"name": "organicCertification", "type": "boolean", "label": "Organic Certified", "required": true}
--     ],
--     "requiredFields": ["batchNumber", "supplierId", "quantity"],
--     "fieldValidations": {
--       "quantity": {"min": 0.1, "max": 10000}
--     }
--   },
--   "QUALITY_CHECK": {
--     "additionalFields": [...],
--     "checkItems": [...]
--   }
-- }
