-- =====================================================
-- Sprint 5 Tool 5: material_batch_wip_query intent binding
--
-- Binds MaterialBatchWipQueryTool (@Component) to AI intent
-- MATERIAL_BATCH_WIP_QUERY so natural-language queries like
-- "在制品有哪些?" / "WIP 库存" / "什么物料正在生产中" route to the
-- correct Tool via /api/mobile/ai-intents/execute.
--
-- Source: PR #732 (Sprint 4 Wave 2 M-WIP-1) added PRODUCING_RESERVED
-- status + MaterialBatchService.getWipBatches(factoryId). This Tool
-- wraps that Service method for AIChat exposure.
--
-- Read-only, LOW sensitivity, DATA_OPERATION category. ON CONFLICT keeps
-- this idempotent if migration replays.
--
-- @since 2026-05-17
-- =====================================================

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, keywords, description,
    priority, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'MATERIAL_BATCH_WIP_QUERY',
    '在制品批次查询',
    'DATA_OPERATION',
    'material_batch_wip_query',
    'LOW',
    '["在制品","WIP","wip","生产中","正在生产","占用批次","在产","被占用的料","生产中物料","生产预留","哪些原料在生产","在制品库存","wip 批次","WIP批次","查在制品","在制品批次"]'::jsonb,
    '查询在制品 (WIP) 物料批次 — 当前被生产任务占用 (PRODUCING_RESERVED 状态) 的原材料批次。返回批次号、物料名、剩余/预留数量、供应商、入库日期。',
    85,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (intent_code) DO UPDATE
SET tool_name = 'material_batch_wip_query',
    intent_category = 'DATA_OPERATION',
    sensitivity_level = 'LOW',
    keywords = EXCLUDED.keywords,
    description = EXCLUDED.description,
    priority = 85,
    is_active = true,
    updated_at = NOW();
