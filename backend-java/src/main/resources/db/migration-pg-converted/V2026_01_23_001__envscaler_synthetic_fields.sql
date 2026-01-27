-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_23_001__envscaler_synthetic_fields.sql
-- Conversion date: 2026-01-26 18:49:25
-- ============================================

-- EnvScaler: Add synthetic data tracking fields to ai_training_samples
-- Migration: V2026_01_23_001__envscaler_synthetic_fields.sql
-- Description: Adds columns for tracking synthetic vs real data, generation lineage,
--              and quality scores for the EnvScaler data augmentation system

-- Add source column to distinguish real vs synthetic data
ALTER TABLE ai_training_samples
ADD COLUMN source VARCHAR(20) DEFAULT 'REAL' COMMENT 'Data source: REAL or SYNTHETIC';

-- Add generation column for tracking synthetic data lineage (0 = real, 1 = first generation synthetic)
ALTER TABLE ai_training_samples
ADD COLUMN generation INT DEFAULT 0 COMMENT 'Generation number: 0 for real data, 1 for synthetic';

-- Add synthetic_confidence column for model confidence score when generating synthetic data
ALTER TABLE ai_training_samples
ADD COLUMN synthetic_confidence DECIMAL(5,4) NULL COMMENT 'Confidence score for synthetic data (0.0000-1.0000)';

-- Add grape_score column for GRAPE (Graph-based Augmentation Performance Evaluation) quality metric
ALTER TABLE ai_training_samples
ADD COLUMN grape_score DECIMAL(5,4) NULL COMMENT 'GRAPE quality score for synthetic data (0.0000-1.0000)';

-- Add skeleton_id column to track the template/skeleton used for synthetic generation
ALTER TABLE ai_training_samples
ADD COLUMN skeleton_id VARCHAR(100) NULL COMMENT 'Reference to the skeleton/template used for generation';

-- Add index on source column for filtering by data origin
CREATE INDEX idx_ats_source ON ai_training_samples(source);

-- Add index on generation column for filtering by lineage
CREATE INDEX idx_ats_generation ON ai_training_samples(generation);

-- Add check constraint to ensure generation is limited to 0 or 1
-- (prevents multi-generation synthetic data which could degrade quality)
ALTER TABLE ai_training_samples
ADD CONSTRAINT chk_ats_generation CHECK (generation <= 1);
