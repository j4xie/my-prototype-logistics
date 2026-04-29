-- V20260421_01__scope_fermentation_tank_required_rule.sql
-- Bug #295 fix: global rule `fermentation_tank_required` (factory_id=NULL) enforces
-- 发酵缸号 for ALL factories on production_plan CREATE. Non-brewery factories
-- (e.g. F001 seafood) have no tank_id dynamic field in their UI, so the rule
-- blocks 100% of plan creation with misleading error "发酵缸号不能为空".
--
-- Fix: Add `#cf_fermentation_days != null &&` guard so the rule only fires for
-- plans that actually include fermentation data. Matches the pattern already
-- used by sibling rules `fermentation_days_positive` and `fermentation_ph_range`
-- in V20260410_18.
--
-- Idempotent: re-running is safe (UPDATE with explicit condition match).

UPDATE factory_validation_rules
SET condition = '#cf_fermentation_days != null && (#cf_tank_id == null || #cf_tank_id.trim() == "")'
WHERE factory_id IS NULL
  AND module_code = 'production_plan'
  AND rule_code = 'fermentation_tank_required'
  AND condition = '#cf_tank_id == null || #cf_tank_id.trim() == ""';
