-- Insert new classifier intents: OUT_OF_DOMAIN and CONTEXT_CONTINUE
-- Required for v2 classifier that handles noise/greetings and context-dependent follow-ups

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'OUT_OF_DOMAIN',
    '域外无关输入',
    'SYSTEM',
    'LOW', 0, 0,
    false, true, 0,
    '域外无关输入 - 包括噪音、问候、闲聊、非业务请求等',
    '["你好", "谢谢", "天气", "笑话", "噪音"]'
) ON CONFLICT (intent_code) DO NOTHING;

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'CONTEXT_CONTINUE',
    '上下文继续',
    'SYSTEM',
    'LOW', 0, 0,
    false, true, 0,
    '上下文继续 - 用户省略查询、跟刚才一样、继续等上下文依赖请求',
    '["同上", "继续", "跟刚才一样", "详细的呢", "换成上个月的"]'
) ON CONFLICT (intent_code) DO NOTHING;
