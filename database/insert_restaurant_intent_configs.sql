-- ============================================
-- v32: 插入 RESTAURANT 业态意图配置
-- 使餐饮短语匹配能通过 DB 验证
-- ============================================
-- 使用方式:
--   测试: psql -h 127.0.0.1 -U cretas_user -d cretas_db -f insert_restaurant_intent_configs.sql
--   生产: psql -h 127.0.0.1 -U cretas_user -d cretas_prod_db -f insert_restaurant_intent_configs.sql

BEGIN;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, is_active, priority, business_type, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'RESTAURANT_DISH_LIST', '菜品列表查询', 'RESTAURANT', true, 100, 'RESTAURANT', '查询餐厅可用菜品列表', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_BESTSELLER_QUERY', '畅销菜品查询', 'RESTAURANT', true, 100, 'RESTAURANT', '查询畅销菜品排行', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_DISH_SALES_RANKING', '菜品销量排行', 'RESTAURANT', true, 100, 'RESTAURANT', '按销量排行菜品', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_SLOW_SELLER_QUERY', '滞销菜品查询', 'RESTAURANT', true, 100, 'RESTAURANT', '查询销量低迷的菜品', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_DISH_COST_ANALYSIS', '菜品成本分析', 'RESTAURANT', true, 100, 'RESTAURANT', '分析每道菜的成本构成', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_INGREDIENT_STOCK', '食材库存查询', 'RESTAURANT', true, 100, 'RESTAURANT', '查询食材库存量', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_INGREDIENT_EXPIRY_ALERT', '食材保质期预警', 'RESTAURANT', true, 100, 'RESTAURANT', '提醒即将过期的食材', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_INGREDIENT_LOW_STOCK', '食材低库存提醒', 'RESTAURANT', true, 100, 'RESTAURANT', '提醒库存不足需补货的食材', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_INGREDIENT_COST_TREND', '食材成本趋势', 'RESTAURANT', true, 100, 'RESTAURANT', '分析食材进货价格变化', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_DAILY_REVENUE', '日营业额查询', 'RESTAURANT', true, 100, 'RESTAURANT', '查询当日营业额', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_REVENUE_TREND', '营业额趋势', 'RESTAURANT', true, 100, 'RESTAURANT', '查看营业额变化趋势', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_ORDER_STATISTICS', '订单统计', 'RESTAURANT', true, 100, 'RESTAURANT', '统计订单量和趋势', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_PEAK_HOURS_ANALYSIS', '高峰时段分析', 'RESTAURANT', true, 100, 'RESTAURANT', '分析客流高峰时段', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_WASTAGE_SUMMARY', '损耗汇总', 'RESTAURANT', true, 100, 'RESTAURANT', '汇总食材损耗数据', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_WASTAGE_RATE', '损耗率分析', 'RESTAURANT', true, 100, 'RESTAURANT', '计算食材损耗率', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_WASTAGE_ANOMALY', '损耗异常检测', 'RESTAURANT', true, 100, 'RESTAURANT', '检测异常高的食材损耗', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_PROCUREMENT_SUGGESTION', '采购建议', 'RESTAURANT', true, 100, 'RESTAURANT', '基于库存和销量推荐采购清单', NOW(), NOW()),
  (gen_random_uuid(), 'RESTAURANT_MARGIN_ANALYSIS', '毛利分析', 'RESTAURANT', true, 100, 'RESTAURANT', '分析整体和菜品级毛利率', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 验证
SELECT business_type, COUNT(*) as cnt
FROM ai_intent_configs
GROUP BY business_type
ORDER BY business_type;

COMMIT;
