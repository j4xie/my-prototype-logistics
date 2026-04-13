-- V20260411_09__cleanup_stale_intent_tool_refs.sql
-- Round 9 Fix — clean up 15 stale tool_name references in ai_intent_configs.
--
-- Round 8-β Subagent B found that ai_intent_configs has 15 rows pointing at
-- non-existent Tool classes. When these intents match, ToolDispatchService
-- throws "tool not found" and the user gets a generic error with no hint of
-- what's wrong. Cleanup removes the broken tool_name binding so the intent
-- falls back to the LLM ToolRouter or returns a clearer "no handler" message.
--
-- We NULL out tool_name rather than deleting the intent row — the intent may
-- still be valid (keywords, category), just the tool binding was wrong. An
-- admin can rebind it later via the AI intent config UI.

UPDATE ai_intent_configs
SET tool_name = NULL,
    updated_at = NOW()
WHERE tool_name IN (
    'approval_submit',
    'cold_chain_temperature',
    'data_batch_delete',
    'equipment_alert_acknowledge',
    'equipment_alert_list',
    'equipment_alert_resolve',
    'equipment_alert_stats',
    'equipment_delete',
    'intent_analyze',
    'intent_create',
    'intent_update',
    'inventory_clear',
    'order_filter',
    'user_delete',
    'work_order_update'
);

-- Log the number of rows cleaned
DO $$
DECLARE
    cleaned_count INT;
BEGIN
    SELECT COUNT(*) INTO cleaned_count FROM ai_intent_configs WHERE tool_name IS NULL AND updated_at >= NOW() - INTERVAL '1 minute';
    RAISE NOTICE 'V20260411_09: cleaned % stale tool_name references', cleaned_count;
END $$;
