-- 确保 FOOD_KNOWLEDGE_QUERY 在 ai_intent_configs 表中注册
-- FoodKnowledgeIntentHandler 依赖此记录 (category=FOOD_KNOWLEDGE)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'FOOD_KNOWLEDGE_QUERY',
    '食品安全知识查询',
    'FOOD_KNOWLEDGE',
    'LOW', 1, 30,
    false, true, 0,
    '食品安全知识查询 - 包括食品标准、法规、工艺参数、HACCP等知识库检索',
    '["食品安全", "食品标准", "GB标准", "添加剂", "冷链", "HACCP", "食品知识"]'
) ON CONFLICT (intent_code) DO NOTHING;
