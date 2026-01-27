-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_30_3__extend_product_type_sku_config.sql
-- Conversion date: 2026-01-26 18:46:13
-- ============================================

-- =============================================================
-- Phase 5: SKU Configuration Extension
-- Extends product_types table with scheduling-related fields
-- =============================================================

-- Add work hours field (standard hours to produce one unit)
ALTER TABLE product_types
ADD COLUMN work_hours DECIMAL(10,2) DEFAULT 1.00 COMMENT 'Standard work hours per unit'
AFTER shelf_life_days;

-- Add processing steps as JSON array
-- Format: [{"stageType": "SLICING", "orderIndex": 1, "requiredSkillLevel": 3, "estimatedMinutes": 30}, ...]
ALTER TABLE product_types
ADD COLUMN processing_steps JSON COMMENT 'Array of processing stages with order and skill requirements'
AFTER work_hours;

-- Add skill requirements as JSON object
-- Format: {"minLevel": 2, "preferredLevel": 4, "specialSkills": ["knife_handling", "quality_inspection"]}
ALTER TABLE product_types
ADD COLUMN skill_requirements JSON COMMENT 'Minimum and preferred skill levels'
AFTER processing_steps;

-- Add equipment IDs as JSON array
-- Format: ["EQ-001", "EQ-002", ...]
ALTER TABLE product_types
ADD COLUMN equipment_ids JSON COMMENT 'Required equipment IDs for production'
AFTER skill_requirements;

-- Add quality check IDs as JSON array
-- Format: ["QC-001", "QC-002", ...]
ALTER TABLE product_types
ADD COLUMN quality_check_ids JSON COMMENT 'Associated quality check item IDs'
AFTER equipment_ids;

-- Add complexity score (1-5, used by LinUCB feature extraction)
ALTER TABLE product_types
ADD COLUMN complexity_score INT DEFAULT 3 COMMENT 'Production complexity 1-5 for LinUCB'
AFTER quality_check_ids;

-- Add index for complexity score (used in scheduling queries)
CREATE INDEX idx_product_complexity ON product_types(complexity_score);

-- =============================================================
-- Sample data update for existing product types (optional)
-- =============================================================

-- Update existing products with default processing steps based on category
UPDATE product_types
SET processing_steps = '[{"stageType": "RECEIVING", "orderIndex": 1, "requiredSkillLevel": 2, "estimatedMinutes": 10}, {"stageType": "SLICING", "orderIndex": 2, "requiredSkillLevel": 3, "estimatedMinutes": 30}, {"stageType": "PACKAGING", "orderIndex": 3, "requiredSkillLevel": 2, "estimatedMinutes": 15}]',
    skill_requirements = '{"minLevel": 2, "preferredLevel": 3, "specialSkills": []}',
    work_hours = 0.75,
    complexity_score = 3
WHERE category = 'seafood' AND processing_steps IS NULL;

UPDATE product_types
SET processing_steps = '[{"stageType": "RECEIVING", "orderIndex": 1, "requiredSkillLevel": 2, "estimatedMinutes": 10}, {"stageType": "PROCESSING", "orderIndex": 2, "requiredSkillLevel": 2, "estimatedMinutes": 20}, {"stageType": "PACKAGING", "orderIndex": 3, "requiredSkillLevel": 2, "estimatedMinutes": 10}]',
    skill_requirements = '{"minLevel": 2, "preferredLevel": 3, "specialSkills": []}',
    work_hours = 0.50,
    complexity_score = 2
WHERE category != 'seafood' AND processing_steps IS NULL;

-- Set default for any remaining NULL values
UPDATE product_types
SET processing_steps = '[]',
    skill_requirements = '{"minLevel": 1, "preferredLevel": 3, "specialSkills": []}',
    equipment_ids = '[]',
    quality_check_ids = '[]',
    work_hours = 1.00,
    complexity_score = 3
WHERE processing_steps IS NULL;
