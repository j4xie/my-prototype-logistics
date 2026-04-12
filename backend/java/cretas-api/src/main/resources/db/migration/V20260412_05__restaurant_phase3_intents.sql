INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_SMART_REORDER', '智能叫货单', 'SMARTBI', 'restaurant_smart_reorder', 'LOW',
        '["叫货","自动下单","采购单","叫货单","补货","自动采购","智能下单"]',
        '基于预测+BOM+库存自动生成采购建议', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_smart_reorder', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_DAILY_RECONCILIATION', '日清日结', 'SMARTBI', 'restaurant_daily_reconciliation', 'LOW',
        '["日清日结","日盘","今日盘点","库存对账","每日对账","当日损耗"]',
        '对比BOM预期用量vs实际盘点', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_daily_reconciliation', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_PROCUREMENT_FORECAST', '采购预测', 'SMARTBI', 'restaurant_procurement_forecast', 'LOW',
        '["采购预测","明天需要多少","下周要多少","备货","节假日备货","采购参考"]',
        '基于历史日销量+节假日调整预测未来营收', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_procurement_forecast', is_active = true;
