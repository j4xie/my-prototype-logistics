-- V20260421_02__fix_fermentation_rule_update_where.sql
-- Bug #295 fix follow-up: V20260421_01 UPDATE did not match because the WHERE
-- clause used `""` (2 double-quotes, SpEL empty-string) but V20260410_18
-- originally stored the condition with 4 literal double-quote chars (`""""`).
-- This migration uses the correct WHERE pattern to actually perform the fix.
--
-- Effect: non-brewery factories (F001 seafood) can create production plans
-- via real UI without being blocked by misleading '发酵缸号不能为空' error.

UPDATE factory_validation_rules
SET condition = '#cf_fermentation_days != null && (#cf_tank_id == null || #cf_tank_id.trim() == "")'
WHERE factory_id IS NULL
  AND module_code = 'production_plan'
  AND rule_code = 'fermentation_tank_required'
  AND condition LIKE '%#cf_tank_id == null%'
  AND condition NOT LIKE '%#cf_fermentation_days%';
