-- V20260429_01_add_subcategory.sql
-- Reviewer C1 fix: add subcategory column for domain routing (factory / restaurant)
-- Phase 0 of restaurant-product-manual implementation plan
-- See: docs/superpowers/specs/2026-04-28-restaurant-product-manual-design.md §6.2

BEGIN;

-- Add subcategory column (nullable for backward compat)
ALTER TABLE food_knowledge_documents
  ADD COLUMN IF NOT EXISTS subcategory VARCHAR(64);

-- Add composite index — keep old idx_food_kb_category for 7-day rollback window
CREATE INDEX IF NOT EXISTS idx_food_kb_category_subcategory
  ON food_knowledge_documents (category, subcategory);

-- Optional: index on subcategory alone for cross-category subcategory queries
CREATE INDEX IF NOT EXISTS idx_food_kb_subcategory
  ON food_knowledge_documents (subcategory)
  WHERE subcategory IS NOT NULL;

COMMIT;
