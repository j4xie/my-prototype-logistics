-- V20260410_11__industry_templates.sql
-- 4 industry templates for Canvas quick-start
--
-- Adapts plan's (industry, module_configs, default_overrides) to actual factory_templates columns:
--   industry_type  — VARCHAR(32)
--   base_config    — JSONB (merges module_configs + default_overrides into one object)

-- Template 1: Food Processing (食品加工 — 白垩纪核心场景)
INSERT INTO factory_templates (template_code, template_name, industry_type, description, base_config)
VALUES ('FOOD_PROCESSING', '食品加工', '食品制造',
'适用于: 熟食/面点/烘焙/调味品加工企业。包含完整的进销存+生产+质检+溯源模块。',
'{
  "moduleConfigs": {
    "enabledModules": ["sales_order","purchase_order","bom","production_plan","production_report","quality_inspection","inventory","inbound","outbound","equipment","customer","supplier","traceability","transfer"],
    "disabledModules": ["finance_ar","finance_ap","hr_employee"]
  },
  "defaultOverrides": {
    "defaultValues": {
      "bom": {"yieldRate": 95},
      "quality_inspection": {"autoCreateOnBatchComplete": true},
      "production_plan": {"defaultPriority": "NORMAL"}
    },
    "disabledTools": ["restaurant_*","camera_facial_*"]
  }
}'::jsonb)
ON CONFLICT (template_code) DO NOTHING;

-- Template 2: Bakery (烘焙)
INSERT INTO factory_templates (template_code, template_name, industry_type, description, base_config)
VALUES ('BAKERY', '烘焙工厂', '烘焙',
'适用于: 面包/蛋糕/糕点工厂。BOM配方管理+短保质期+高频排产。',
'{
  "moduleConfigs": {
    "enabledModules": ["sales_order","purchase_order","bom","production_plan","production_report","quality_inspection","inventory","inbound","outbound","customer","supplier","traceability"],
    "disabledModules": ["equipment","finance_ar","finance_ap","hr_employee","transfer"]
  },
  "defaultOverrides": {
    "defaultValues": {
      "bom": {"yieldRate": 90},
      "inventory": {"defaultShelfLifeDays": 7},
      "production_plan": {"defaultPriority": "HIGH"}
    },
    "disabledTools": ["equipment_*","restaurant_*"]
  }
}'::jsonb)
ON CONFLICT (template_code) DO NOTHING;

-- Template 3: Restaurant (餐饮)
INSERT INTO factory_templates (template_code, template_name, industry_type, description, base_config)
VALUES ('RESTAURANT', '餐饮企业', '餐饮',
'适用于: 连锁餐饮/中央厨房。侧重采购+库存+成本控制，不需要复杂生产流程。',
'{
  "moduleConfigs": {
    "enabledModules": ["purchase_order","inventory","inbound","outbound","customer","supplier","bom"],
    "disabledModules": ["sales_order","production_plan","production_report","quality_inspection","equipment","finance_ar","finance_ap","hr_employee","transfer","traceability"]
  },
  "defaultOverrides": {
    "defaultValues": {
      "bom": {"yieldRate": 85},
      "inventory": {"defaultShelfLifeDays": 3}
    },
    "disabledTools": ["production_*","scheduling_*","quality_*","scale_*"]
  }
}'::jsonb)
ON CONFLICT (template_code) DO NOTHING;

-- Template 4: Aquaculture (水产)
INSERT INTO factory_templates (template_code, template_name, industry_type, description, base_config)
VALUES ('AQUACULTURE', '水产加工', '水产',
'适用于: 水产品加工/冷链。强调溯源+冷链温控+批次管理。',
'{
  "moduleConfigs": {
    "enabledModules": ["sales_order","purchase_order","bom","production_plan","production_report","quality_inspection","inventory","inbound","outbound","equipment","customer","supplier","traceability","transfer"],
    "disabledModules": ["finance_ar","finance_ap","hr_employee"]
  },
  "defaultOverrides": {
    "defaultValues": {
      "bom": {"yieldRate": 75},
      "inventory": {"defaultShelfLifeDays": 14, "requireTemperatureLog": true},
      "quality_inspection": {"requireBatchPhoto": true}
    },
    "disabledTools": ["restaurant_*"]
  }
}'::jsonb)
ON CONFLICT (template_code) DO NOTHING;
