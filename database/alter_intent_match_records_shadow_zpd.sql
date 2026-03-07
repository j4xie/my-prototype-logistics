-- Migration: Add shadow mode, OOD metrics, and ZPD boundary columns
-- to intent_match_records table
-- Date: 2026-02-27
-- Phase: Z0.2

-- Shadow mode columns (for PHRASE_MATCH vs BERT comparison)
ALTER TABLE intent_match_records ADD COLUMN IF NOT EXISTS shadow_intent_code VARCHAR(50);
ALTER TABLE intent_match_records ADD COLUMN IF NOT EXISTS shadow_confidence NUMERIC(5,4);
ALTER TABLE intent_match_records ADD COLUMN IF NOT EXISTS shadow_agreed BOOLEAN;

-- OOD detection metrics (from BERT classifier)
ALTER TABLE intent_match_records ADD COLUMN IF NOT EXISTS classifier_entropy NUMERIC(8,4);
ALTER TABLE intent_match_records ADD COLUMN IF NOT EXISTS classifier_margin NUMERIC(8,4);
ALTER TABLE intent_match_records ADD COLUMN IF NOT EXISTS classifier_max_logit NUMERIC(8,4);

-- Semantic router top score
ALTER TABLE intent_match_records ADD COLUMN IF NOT EXISTS semantic_top_score NUMERIC(5,4);

-- ZPD boundary marker (NeedFullLLM / OOD triggered)
ALTER TABLE intent_match_records ADD COLUMN IF NOT EXISTS zpd_boundary BOOLEAN DEFAULT false;

-- Partial indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_shadow_agreed
    ON intent_match_records(shadow_agreed)
    WHERE shadow_agreed IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zpd_boundary
    ON intent_match_records(zpd_boundary)
    WHERE zpd_boundary = true;

CREATE INDEX IF NOT EXISTS idx_match_method_shadow
    ON intent_match_records(match_method, shadow_agreed)
    WHERE match_method = 'PHRASE_MATCH' AND shadow_agreed IS NOT NULL;
