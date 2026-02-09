-- Add missing columns to smart_bi_skill table
-- These columns are defined in SmartBiSkill.java but missing from the table

-- Add category column (for grouping skills)
ALTER TABLE smart_bi_skill
ADD COLUMN IF NOT EXISTS category VARCHAR(50) COMMENT 'Skill category: analytics, alerting, reporting' AFTER config;

-- Add priority column (for ordering)
ALTER TABLE smart_bi_skill
ADD COLUMN IF NOT EXISTS priority INT DEFAULT 100 COMMENT 'Priority order (lower = higher priority)' AFTER category;

-- Add required_permission column (for access control)
ALTER TABLE smart_bi_skill
ADD COLUMN IF NOT EXISTS required_permission VARCHAR(100) COMMENT 'Required permission to use this skill' AFTER priority;

-- Add deleted_at column (for soft delete, inherited from BaseEntity)
ALTER TABLE smart_bi_skill
ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL COMMENT 'Soft delete timestamp' AFTER updated_at;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_skill_category ON smart_bi_skill(category);
CREATE INDEX IF NOT EXISTS idx_skill_priority ON smart_bi_skill(priority);

-- Update existing skills with default categories based on their name
UPDATE smart_bi_skill SET category = 'analytics' WHERE name LIKE '%analysis%' OR name LIKE '%trend%';
UPDATE smart_bi_skill SET category = 'query' WHERE name LIKE '%query%';
UPDATE smart_bi_skill SET category = 'reporting' WHERE name LIKE '%report%' OR name LIKE '%dashboard%';
UPDATE smart_bi_skill SET category = 'operations' WHERE name LIKE '%batch%' OR name LIKE '%inventory%';
UPDATE smart_bi_skill SET category = 'general' WHERE category IS NULL;
