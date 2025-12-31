-- ===========================================================================
-- V2025_12_29_6: Add Production Plan Urgent Status Monitoring Fields
-- ===========================================================================
-- Author: AI Scheduling Enhancement Team
-- Date: 2025-12-29
-- Description:
--   1. Add current_probability and probability_updated_at fields to production_plans
--   2. Initialize DroolsRule for urgent_threshold (system-level default)
--   3. Create factory-level urgent_threshold rules for existing factories
-- ===========================================================================

-- -------------------------------------------------------------------------
-- Part 1: Add Urgent Monitoring Fields to production_plans Table
-- -------------------------------------------------------------------------

ALTER TABLE production_plans
ADD COLUMN current_probability DECIMAL(5,4) NULL COMMENT '当前完成概率 (0-1, 基于CR值+材料匹配+AI置信度+混批影响)',
ADD COLUMN probability_updated_at DATETIME NULL COMMENT '概率最后更新时间';

-- Create index for urgent status queries (optimize filtering by probability)
CREATE INDEX idx_production_plans_urgent ON production_plans(current_probability, cr_value);

-- -------------------------------------------------------------------------
-- Part 2: Initialize System-Level Urgent Threshold Configuration
-- -------------------------------------------------------------------------

-- Insert system-level default configuration
INSERT INTO drools_rules (
    id,
    factory_id,
    rule_group,
    rule_name,
    rule_description,
    rule_content,
    enabled,
    priority,
    version,
    created_at,
    updated_at
) VALUES (
    UUID(),
    'SYSTEM',  -- System-level default (fallback for all factories)
    'scheduling',
    'urgent_threshold',
    '生产计划紧急阈值：完成概率低于此值时标记为紧急。默认60%表示当完成概率低于60%或CR值<1时，批次将被标记为紧急并置顶显示。',
    '0.60',  -- Default 60% threshold
    TRUE,
    100,
    1,
    NOW(),
    NOW()
);

-- -------------------------------------------------------------------------
-- Part 3: Create Factory-Level Rules for Existing Factories (Optional)
-- -------------------------------------------------------------------------

-- Only create factory-level rules if they don't already exist
INSERT INTO drools_rules (
    id,
    factory_id,
    rule_group,
    rule_name,
    rule_description,
    rule_content,
    enabled,
    priority,
    version,
    created_at,
    updated_at
)
SELECT
    UUID(),
    f.id,
    'scheduling',
    'urgent_threshold',
    CONCAT('工厂 ', f.name, ' 的生产计划紧急阈值配置'),
    '0.60',  -- Same default as system-level
    TRUE,
    100,
    1,
    NOW(),
    NOW()
FROM factories f
WHERE NOT EXISTS (
    SELECT 1 FROM drools_rules dr
    WHERE dr.factory_id = f.id
    AND dr.rule_group = 'scheduling'
    AND dr.rule_name = 'urgent_threshold'
);

-- -------------------------------------------------------------------------
-- Verification Queries (for manual testing after migration)
-- -------------------------------------------------------------------------

-- Check new columns exist
-- SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME = 'production_plans'
-- AND COLUMN_NAME IN ('current_probability', 'probability_updated_at');

-- Check DroolsRule initialization
-- SELECT factory_id, rule_group, rule_name, rule_content, enabled
-- FROM drools_rules
-- WHERE rule_group = 'scheduling' AND rule_name = 'urgent_threshold'
-- ORDER BY factory_id;

-- Count factories with urgent_threshold config
-- SELECT COUNT(DISTINCT factory_id) as factory_count
-- FROM drools_rules
-- WHERE rule_group = 'scheduling' AND rule_name = 'urgent_threshold';
