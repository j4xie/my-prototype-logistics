-- Sprint 4 Chat K data center AIChat intent bindings (2026-05-16).
-- 绑定 tool_name 让 IntentExecutorServiceImpl 路由到 OperationLogQueryTool.
-- 其他 2 个 tool (export/import center run) 暂未实现, 不在此次绑定.

INSERT INTO ai_intent_config (
    id, intent_code, intent_name, intent_category,
    tool_name, keywords, is_active, sensitivity_level,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'OPERATION_LOG_QUERY',
    '操作日志查询',
    'DATA_OPERATION',
    'operation_log_query',
    '["操作日志","审计日志","谁改的","变更历史","operation log","audit log","最近修改","谁删了"]'::jsonb,
    TRUE,
    'LOW',
    NOW(),
    NOW()
)
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
