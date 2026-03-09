-- =====================================================
-- V2026_03_09_01: Add CONTEXT_CONTINUE + PAGINATION_NEXT/PREVIOUS intent configs
-- Purpose: These system intents were mapped in IntentKnowledgeBase phrase mapping
-- but had no corresponding ai_intent_configs entries with tool_name,
-- causing tool execution to fail with "未找到意图配置" error.
-- =====================================================

-- 1. CONTEXT_CONTINUE - 上下文继续/恢复上次操作
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'CONTEXT_CONTINUE', '继续上次操作', 'SYSTEM',
    'LOW', 0,
    '["继续", "接着", "然后呢", "同上", "再查一遍", "刚才那个", "接上条", "上一个结果"]',
    NULL, 100,
    '处理用户请求继续上一次操作的场景，从对话记忆恢复上次查询上下文并自动重新执行',
    'context_continue', 'SYSTEM', 'QUERY', 'CONTEXT',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- 2. PAGINATION_NEXT - 翻页/下一页
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'PAGINATION_NEXT', '下一页', 'SYSTEM',
    'LOW', 0,
    '["下一页", "翻页", "翻到下一页", "更多", "看更多"]',
    NULL, 100,
    '处理翻页请求，从对话记忆读取上次查询并执行下一页',
    'pagination_next', 'SYSTEM', 'QUERY', 'PAGINATION',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- 3. PAGINATION_PREVIOUS - 上一页
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'PAGINATION_PREVIOUS', '上一页', 'SYSTEM',
    'LOW', 0,
    '["上一页", "前一页", "往回翻"]',
    NULL, 100,
    '处理返回上一页请求',
    'pagination_previous', 'SYSTEM', 'QUERY', 'PAGINATION',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- 4. OUT_OF_DOMAIN - 域外对话
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'OUT_OF_DOMAIN', '域外对话', 'SYSTEM',
    'LOW', 0,
    '["你好", "哈哈", "好的", "嗯嗯"]',
    NULL, 50,
    '处理与业务无关的闲聊或域外问题',
    'out_of_domain', 'SYSTEM', 'QUERY', 'GENERAL',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    updated_at = NOW();
