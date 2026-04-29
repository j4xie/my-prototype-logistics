-- Seed 5 RESTAURANT_OPS_* AI intents for Java-side intent recognition fallback.
-- Python router already handles these via smartbi.gold.restaurant_ops_router._OPS_PATTERNS;
-- this seed is for the Java AIIntentService path (not currently primary but kept in sync).
--
-- Safe to rerun: ON CONFLICT DO NOTHING on (intent_code).
-- Rollback: DELETE FROM ai_intent_configs WHERE intent_code LIKE 'RESTAURANT_OPS_%';

INSERT INTO ai_intent_configs (
  id, intent_code, intent_name, intent_category, sensitivity_level,
  business_type, is_active, keywords, examples, description,
  created_at, updated_at
) VALUES
  (gen_random_uuid()::text, 'RESTAURANT_OPS_WASTAGE_TOP', '损耗 Top 分析', 'SMARTBI', 'LOW',
   'RESTAURANT', true,
   '["损耗","报废","过期","变质","浪费","扔掉"]'::jsonb,
   '["最近30天损耗最多的食材","哪个食材报废最多","过期食材 top"]'::jsonb,
   '按食材维度汇总近 N 天损耗数量和金额, Top-N 排行',
   NOW(), NOW()),
  (gen_random_uuid()::text, 'RESTAURANT_OPS_STOCK_SHORTAGE', '库存盘亏分析', 'SMARTBI', 'LOW',
   'RESTAURANT', true,
   '["盘亏","盘点","库存差异","账实差","库存流失"]'::jsonb,
   '["哪个食材盘亏最严重","库存差异最大的食材","账实差 top"]'::jsonb,
   '按食材维度汇总盘点账实差, 找出流失重点',
   NOW(), NOW()),
  (gen_random_uuid()::text, 'RESTAURANT_OPS_REQUISITION_TREND', '领料趋势', 'SMARTBI', 'LOW',
   'RESTAURANT', true,
   '["领料","用料","出库","使用量","消耗"]'::jsonb,
   '["最近30天领料趋势","top 10 领料食材","哪个食材用得最多"]'::jsonb,
   '按食材维度汇总近 N 天领料量 Top-N, 配合日趋势图',
   NOW(), NOW()),
  (gen_random_uuid()::text, 'RESTAURANT_OPS_GROSS_MARGIN', '菜品毛利分析', 'SMARTBI', 'LOW',
   'RESTAURANT', true,
   '["毛利","毛利率","净赚","赚钱","挣钱","利润"]'::jsonb,
   '["哪道菜毛利最高","毛利率 top 10","利润最高的菜品","售价减去食材成本最多的菜"]'::jsonb,
   '跨模块 POS × 配方 毛利分析, 每道菜营收/食材成本/毛利率',
   NOW(), NOW()),
  (gen_random_uuid()::text, 'RESTAURANT_OPS_STORE_MARGIN', '门店毛利对比', 'SMARTBI', 'LOW',
   'RESTAURANT', true,
   '["门店","店","分店","店铺","哪家","连锁"]'::jsonb,
   '["哪家店最赚钱","门店毛利排行","分店利润对比","店铺毛利分析"]'::jsonb,
   '按门店维度汇总毛利率, 连锁店经营者的核心分析',
   NOW(), NOW())
ON CONFLICT (intent_code) DO NOTHING;
