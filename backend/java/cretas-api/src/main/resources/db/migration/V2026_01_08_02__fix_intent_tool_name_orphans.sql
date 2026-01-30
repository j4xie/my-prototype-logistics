-- =====================================================
-- V2026_01_08_02: Fix orphaned intent tool_name mappings
--
-- Purpose: Correct mismatched tool_name values and clear
--          non-existent tool references to enable Handler fallback
--
-- Issues Fixed:
-- 1. INTENT_CREATE: intent_create -> create_new_intent (name mismatch)
-- 2. INTENT_ANALYZE: intent_analyze -> test_intent_matching (name mismatch)
-- 3. INTENT_UPDATE: Already correct (update_intent)
-- 4. QUALITY_CRITICAL_ITEMS: Set NULL (no tool implementation)
-- 5. QUALITY_DISPOSITION_EVALUATE: Set NULL (no tool implementation)
-- 6. QUALITY_DISPOSITION_EXECUTE: Set NULL (no tool implementation)
--
-- When tool_name is NULL, the system falls back to handler_class
-- =====================================================

-- =====================================================
-- SECTION 1: Fix name mismatches (intent tools)
-- =====================================================

-- INTENT_CREATE: Update to actual tool name
-- Old: intent_create
-- New: create_new_intent (from CreateIntentTool.getToolName())
UPDATE ai_intent_configs
SET tool_name = 'create_new_intent',
    updated_at = NOW()
WHERE intent_code = 'INTENT_CREATE'
  AND tool_name = 'intent_create';

-- INTENT_ANALYZE: Update to actual tool name
-- Old: intent_analyze
-- New: test_intent_matching (from TestIntentMatchingTool.getToolName())
-- Note: INTENT_ANALYZE is used for testing/analyzing intent matching,
--       which is exactly what TestIntentMatchingTool does
UPDATE ai_intent_configs
SET tool_name = 'test_intent_matching',
    updated_at = NOW()
WHERE intent_code = 'INTENT_ANALYZE'
  AND tool_name = 'intent_analyze';

-- =====================================================
-- SECTION 2: Clear non-existent tool references
-- These intents will fall back to Handler processing
-- =====================================================

-- QUALITY_CRITICAL_ITEMS: No tool implementation exists
-- Will fallback to QualityHandler for processing
UPDATE ai_intent_configs
SET tool_name = NULL,
    updated_at = NOW()
WHERE intent_code = 'QUALITY_CRITICAL_ITEMS'
  AND tool_name = 'quality_critical_items';

-- QUALITY_DISPOSITION_EVALUATE: No tool implementation exists
-- Will fallback to QualityHandler for processing
UPDATE ai_intent_configs
SET tool_name = NULL,
    updated_at = NOW()
WHERE intent_code = 'QUALITY_DISPOSITION_EVALUATE'
  AND tool_name = 'quality_disposition_evaluate';

-- QUALITY_DISPOSITION_EXECUTE: No tool implementation exists
-- Will fallback to QualityHandler for processing
UPDATE ai_intent_configs
SET tool_name = NULL,
    updated_at = NOW()
WHERE intent_code = 'QUALITY_DISPOSITION_EXECUTE'
  AND tool_name = 'quality_disposition_execute';

-- =====================================================
-- Summary
-- =====================================================
-- Fixed 2 name mismatches:
--   - INTENT_CREATE: intent_create -> create_new_intent
--   - INTENT_ANALYZE: intent_analyze -> test_intent_matching
--
-- Cleared 3 orphaned tool references (set to NULL for Handler fallback):
--   - QUALITY_CRITICAL_ITEMS
--   - QUALITY_DISPOSITION_EVALUATE
--   - QUALITY_DISPOSITION_EXECUTE
--
-- No change needed:
--   - INTENT_UPDATE: Already correct (update_intent)
-- =====================================================
