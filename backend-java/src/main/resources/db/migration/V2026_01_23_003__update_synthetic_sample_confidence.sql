-- ============================================================
-- EnvScaler: Update existing synthetic samples confidence field
-- ============================================================
-- This migration updates the confidence field for synthetic samples
-- that were created before the code fix that sets confidence = syntheticConfidence.
-- Without this, existing synthetic samples won't be included in training queries.
-- ============================================================

-- Update synthetic samples: set confidence = synthetic_confidence where confidence is null
UPDATE ai_training_samples
SET confidence = synthetic_confidence
WHERE source = 'SYNTHETIC'
  AND confidence IS NULL
  AND synthetic_confidence IS NOT NULL;

-- Log the update count (MySQL specific)
SELECT CONCAT('Updated ', ROW_COUNT(), ' synthetic samples with confidence field') AS migration_info;
