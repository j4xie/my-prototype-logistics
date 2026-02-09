-- Migration: Add missing fields for Phase 4 data integrity
-- Date: 2025-12-27
-- Description: Add email to users, operator_id to factory_equipment

-- Task 1: User.email field
-- Check if column exists before adding
SET @columnExists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email'
);

SET @sql = IF(@columnExists = 0,
    'ALTER TABLE users ADD COLUMN email VARCHAR(100) AFTER phone',
    'SELECT "Column users.email already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Task 4: Equipment.operator_id field
SET @columnExists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'factory_equipment'
    AND COLUMN_NAME = 'operator_id'
);

SET @sql = IF(@columnExists = 0,
    'ALTER TABLE factory_equipment ADD COLUMN operator_id BIGINT AFTER created_by',
    'SELECT "Column factory_equipment.operator_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify changes
SELECT 'users table structure:' AS info;
SHOW COLUMNS FROM users WHERE Field IN ('phone', 'email', 'full_name');

SELECT 'factory_equipment table structure:' AS info;
SHOW COLUMNS FROM factory_equipment WHERE Field IN ('created_by', 'operator_id', 'notes');
