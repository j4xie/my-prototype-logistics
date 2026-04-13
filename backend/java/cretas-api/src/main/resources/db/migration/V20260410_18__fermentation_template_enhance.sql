-- V20260410_18__fermentation_template_enhance.sql
-- Round 4 Fix P2-30: Enhance FERMENTATION template with validation rules, trigger chain seeds,
-- and additional seed dynamic fields to cover full fermentation business flow.
--
-- Round 5 Fix DATA-1: Made the jsonb array append idempotent. Previously re-running this
-- migration (e.g. after a Flyway reset or manual re-apply) would double-append the seed
-- fields, leaving duplicate entries that confuse applyTemplate downstream.

-- Add more seed fields to FERMENTATION, only if tank_capacity_kg is not already present.
-- The WHERE clause short-circuits a second apply; all other fields are added as a batch
-- alongside the first one, so checking a single sentinel is sufficient.
UPDATE factory_templates
SET base_config = jsonb_set(
  base_config,
  '{seedDynamicFields}',
  (COALESCE(base_config->'seedDynamicFields', '[]'::jsonb) || '[
    {"moduleCode":"production_plan","fieldCode":"tank_capacity_kg","fieldType":"DECIMAL","label":"缸容量(kg)","sortOrder":60,"config":{"precision":1}},
    {"moduleCode":"production_plan","fieldCode":"ph_value","fieldType":"DECIMAL","label":"PH 值","sortOrder":70,"config":{"precision":2,"min":0,"max":14}},
    {"moduleCode":"production_plan","fieldCode":"taste_score","fieldType":"NUMBER","label":"口味评分(1-10)","sortOrder":80,"config":{"min":1,"max":10}},
    {"moduleCode":"production_plan","fieldCode":"fermentation_log","fieldType":"SUB_TABLE","label":"发酵日志","sortOrder":100,"config":{"columns":[{"code":"log_date","label":"日期","type":"DATE"},{"code":"temp","label":"温度(℃)","type":"DECIMAL"},{"code":"humidity","label":"湿度(%)","type":"DECIMAL"},{"code":"taste_note","label":"口感记录","type":"TEXT"}]}},
    {"moduleCode":"bom","fieldCode":"required_fermentation_days","fieldType":"NUMBER","label":"标准发酵天数","sortOrder":50,"config":{"default":30}}
  ]'::jsonb)
)
WHERE template_code = 'FERMENTATION'
  AND NOT (COALESCE(base_config->'seedDynamicFields', '[]'::jsonb)
           @> '[{"fieldCode":"tank_capacity_kg"}]'::jsonb);

-- Seed trigger chains for FERMENTATION template (attached via global factory_id = NULL)
-- When fermentation_days are met → auto-create quality inspection task.
-- Guard against missing unique constraint on (factory_id, chain_code) by checking NOT EXISTS.
INSERT INTO factory_trigger_chains (factory_id, chain_code, event_type, steps, enabled, error_strategy, description)
SELECT NULL, 'fermentation_complete_quality_check', 'BatchCompletedEvent',
'[{"tool":"quality_create_inspection","condition":"#moduleCode == ''production_plan''","params":{"source":"fermentation"}}]'::jsonb,
true, 'CONTINUE',
'发酵完成 → 自动创建质检任务'
WHERE NOT EXISTS (
  SELECT 1 FROM factory_trigger_chains
  WHERE factory_id IS NULL AND chain_code = 'fermentation_complete_quality_check'
);

-- Global validation rules for FERMENTATION module_code='production_plan':
--   1. 发酵天数 > 0
--   2. 缸号非空
--   3. PH 值合理范围
-- Guard with NOT EXISTS on (factory_id, module_code, rule_code) so re-apply is a no-op.
INSERT INTO factory_validation_rules (factory_id, module_code, rule_code, operation, condition, error_message, severity, enabled, sort_order)
SELECT NULL, 'production_plan', 'fermentation_days_positive', 'CREATE',
  '#cf_fermentation_days != null && #cf_fermentation_days <= 0', '发酵天数必须大于0', 'BLOCK', true, 10
WHERE NOT EXISTS (
  SELECT 1 FROM factory_validation_rules
  WHERE factory_id IS NULL AND module_code = 'production_plan' AND rule_code = 'fermentation_days_positive'
);

INSERT INTO factory_validation_rules (factory_id, module_code, rule_code, operation, condition, error_message, severity, enabled, sort_order)
SELECT NULL, 'production_plan', 'fermentation_tank_required', 'CREATE',
  '#cf_tank_id == null || #cf_tank_id.trim() == """"', '发酵缸号不能为空', 'BLOCK', true, 20
WHERE NOT EXISTS (
  SELECT 1 FROM factory_validation_rules
  WHERE factory_id IS NULL AND module_code = 'production_plan' AND rule_code = 'fermentation_tank_required'
);

INSERT INTO factory_validation_rules (factory_id, module_code, rule_code, operation, condition, error_message, severity, enabled, sort_order)
SELECT NULL, 'production_plan', 'fermentation_ph_range', 'CREATE',
  '#cf_ph_value != null && (#cf_ph_value < 3 || #cf_ph_value > 10)', 'PH 值超出正常发酵范围 (3-10)', 'WARN', true, 30
WHERE NOT EXISTS (
  SELECT 1 FROM factory_validation_rules
  WHERE factory_id IS NULL AND module_code = 'production_plan' AND rule_code = 'fermentation_ph_range'
);

-- Comment for clarity
COMMENT ON TABLE factory_templates IS 'Industry templates with seedDynamicFields, trigger chain seeds, and default validation rules for rapid factory onboarding (Round 4 Fix P2-29, P2-30; Round 5 Fix DATA-1 idempotent).';
