-- 六扇门一期: BOM自动扣料 + 报工增强 + 移动均价
-- 2026-03-18

-- 1. MaterialConsumption: 添加计划量、物料类型、来源类型
ALTER TABLE material_consumptions
  ADD COLUMN IF NOT EXISTS planned_quantity DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS material_type_id VARCHAR(191),
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'MANUAL';

CREATE INDEX IF NOT EXISTS idx_consumption_production_batch ON material_consumptions(production_batch_id);
CREATE INDEX IF NOT EXISTS idx_consumption_material_type ON material_consumptions(material_type_id);

-- 2. RawMaterialType: 添加移动平均价
ALTER TABLE raw_material_types
  ADD COLUMN IF NOT EXISTS moving_avg_price DECIMAL(12,4);

-- 3. ProcessTask: 添加工序投入量
ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS input_quantity DECIMAL(12,2);

-- 4. AI意图配置: 注册新工具 (表名 ai_intent_configs, 注意复数)
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, keywords, is_active, sensitivity_level, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'BATCH_CONSUMPTION_ADJUST', '生产耗料调整', 'DATA_OPERATION', 'batch_consumption_adjust',
   '["耗料","用料","多用了","少用了","实际用量","调整用量","物料差异","消耗调整"]', true, 'LOW', NOW(), NOW()),
  (gen_random_uuid(), 'BATCH_CONSUMPTION_QUERY', '生产耗料查询', 'DATA_QUERY', 'batch_consumption_query',
   '["耗料查询","物料消耗","BOM达成率","用了多少料","消耗明细","耗料情况"]', true, 'LOW', NOW(), NOW()),
  (gen_random_uuid(), 'SKU_GROSS_MARGIN', 'SKU毛利率查询', 'REPORT', 'report_sku_gross_margin',
   '["毛利率","SKU利润","产品利润","哪个产品赚钱","成本分析","单品利润"]', true, 'LOW', NOW(), NOW())
ON CONFLICT DO NOTHING;
