-- V20260410_17__template_seed_dynamic_fields.sql
-- Round 4 Fix P2-29: Add seedDynamicFields array to industry templates.
--
-- When applyTemplate runs, it will now auto-create CanvasDynamicField records from this array,
-- so factories get their industry-specific fields out of the box instead of requiring manual
-- per-field creation.
--
-- Note: applyTemplate in FactoryConfigServiceImpl must also read this key (TODO separate commit).

-- Extend BAKERY template with time-precision fields for short-shelf-life products
UPDATE factory_templates
SET base_config = base_config || '{
  "seedDynamicFields": [
    {"moduleCode":"production_plan","fieldCode":"start_time","fieldType":"DATETIME","label":"生产开始时间","sortOrder":10},
    {"moduleCode":"production_plan","fieldCode":"shelf_life_hours","fieldType":"NUMBER","label":"保质期(小时)","sortOrder":20,"config":{"default":4}},
    {"moduleCode":"production_plan","fieldCode":"expire_at","fieldType":"DATETIME","label":"过期时间","sortOrder":30,"computedWhen":"#addHours(#cf_start_time, #cf_shelf_life_hours)"},
    {"moduleCode":"bom","fieldCode":"ratio_tolerance","fieldType":"DECIMAL","label":"配方比例误差(%)","sortOrder":10,"config":{"precision":2,"default":2}}
  ]
}'::jsonb
WHERE template_code = 'BAKERY';

-- Extend FOOD_PROCESSING with traceability + BOM achievement fields
UPDATE factory_templates
SET base_config = base_config || '{
  "seedDynamicFields": [
    {"moduleCode":"bom","fieldCode":"boiling_hours","fieldType":"DECIMAL","label":"卤制时长(小时)","sortOrder":10,"config":{"precision":1}},
    {"moduleCode":"bom","fieldCode":"actual_consumption","fieldType":"DECIMAL","label":"实际用量","sortOrder":20,"config":{"precision":3}},
    {"moduleCode":"production_plan","fieldCode":"production_date","fieldType":"DATE","label":"生产日期","sortOrder":10,"config":{"required":true}},
    {"moduleCode":"production_plan","fieldCode":"batch_number","fieldType":"TEXT","label":"批次号","sortOrder":20,"config":{"required":true}},
    {"moduleCode":"production_plan","fieldCode":"shelf_life_days","fieldType":"NUMBER","label":"保质期(天)","sortOrder":30,"config":{"default":30}}
  ]
}'::jsonb
WHERE template_code = 'FOOD_PROCESSING';

-- Extend AQUACULTURE with pond management
UPDATE factory_templates
SET base_config = base_config || '{
  "seedDynamicFields": [
    {"moduleCode":"production_plan","fieldCode":"pond_id","fieldType":"TEXT","label":"塘号","sortOrder":10,"config":{"required":true}},
    {"moduleCode":"production_plan","fieldCode":"feeding_amount","fieldType":"DECIMAL","label":"投喂量(kg)","sortOrder":20,"config":{"precision":1}},
    {"moduleCode":"production_plan","fieldCode":"water_temp","fieldType":"DECIMAL","label":"水温(℃)","sortOrder":30,"config":{"precision":1}},
    {"moduleCode":"production_plan","fieldCode":"alive_or_frozen","fieldType":"SELECT","label":"活体/冷冻","sortOrder":40,"config":{"options":[{"value":"ALIVE","label":"活体"},{"value":"FROZEN","label":"冷冻"}]}}
  ]
}'::jsonb
WHERE template_code = 'AQUACULTURE';

-- New template: FERMENTATION (fermentation-based food — 酱菜/泡菜/陈醋/豆瓣)
INSERT INTO factory_templates (template_code, template_name, industry_type, description, base_config)
VALUES ('FERMENTATION', '发酵食品', '食品制造',
'适用于: 酱菜/泡菜/陈醋/豆瓣等发酵加工。强调发酵周期/陈酿年份/缸号追溯。',
'{
  "moduleConfigs": {
    "enabledModules": ["sales_order","purchase_order","bom","production_plan","production_report","quality_inspection","inventory","inbound","outbound","customer","supplier","traceability"],
    "disabledModules": ["equipment","finance_ar","finance_ap","hr_employee","transfer"]
  },
  "defaultOverrides": {
    "defaultValues": {
      "bom": {"yieldRate": 85},
      "inventory": {"defaultShelfLifeDays": 365},
      "production_plan": {"defaultPriority": "NORMAL"}
    },
    "disabledTools": ["restaurant_*","equipment_*"]
  },
  "seedDynamicFields": [
    {"moduleCode":"production_plan","fieldCode":"fermentation_days","fieldType":"NUMBER","label":"发酵天数","sortOrder":10,"config":{"required":true,"default":30}},
    {"moduleCode":"production_plan","fieldCode":"tank_id","fieldType":"TEXT","label":"发酵缸号","sortOrder":20,"config":{"required":true}},
    {"moduleCode":"production_plan","fieldCode":"tank_in_date","fieldType":"DATE","label":"入缸日期","sortOrder":30,"config":{"required":true}},
    {"moduleCode":"production_plan","fieldCode":"aging_years","fieldType":"NUMBER","label":"陈酿年份","sortOrder":40,"config":{"default":0}},
    {"moduleCode":"production_plan","fieldCode":"season","fieldType":"SELECT","label":"季节","sortOrder":50,"config":{"options":[{"value":"SPRING","label":"春"},{"value":"SUMMER","label":"夏"},{"value":"AUTUMN","label":"秋"},{"value":"WINTER","label":"冬"}]}}
  ]
}'::jsonb)
ON CONFLICT (template_code) DO NOTHING;
