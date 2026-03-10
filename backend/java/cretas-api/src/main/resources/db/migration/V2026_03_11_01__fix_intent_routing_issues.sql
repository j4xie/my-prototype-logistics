-- Fix 4 intent routing issues discovered in E2E testing:
-- T2: "创建采购订单" → LLM fallback (keyword not in intent config)
-- T3: "设备报修" → misrouted to SCHEDULING_LIST (missing keywords)
-- T6: "查询订单状态" → "工具未注册: order_status" (wrong tool_name)

-- Fix T6: ORDER_STATUS 绑定了不存在的 order_status，应该是 order_query
UPDATE ai_intent_configs
SET tool_name = 'order_query'
WHERE intent_code = 'ORDER_STATUS' AND tool_name = 'order_status';

-- Fix T3: EQUIPMENT_MAINTENANCE 添加 "报修" 相关关键词
UPDATE ai_intent_configs
SET keywords = keywords::jsonb || '["设备报修", "报修", "报修设备", "设备坏了", "机器坏了", "设备出故障"]'::jsonb
WHERE intent_code = 'EQUIPMENT_MAINTENANCE';

-- Fix T2: PURCHASE_ORDER_CREATE 补充 "创建采购订单" 关键词
UPDATE ai_intent_configs
SET keywords = keywords::jsonb || '["创建采购订单", "帮我采购"]'::jsonb
WHERE intent_code = 'PURCHASE_ORDER_CREATE';
