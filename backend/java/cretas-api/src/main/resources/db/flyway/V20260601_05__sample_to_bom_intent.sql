-- V20260601_05: Sprint 2 / Track F (S-RD-1 / N48) — SAMPLE_TO_BOM intent
-- 绑定 ai_intent_configs.SAMPLE_TO_BOM → SampleToBomTool (sample_to_bom)
-- Pattern mirrors V20260516_07__work_process_intents.sql + V20260513_02__revenue_report_intent.sql

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'SAMPLE_TO_BOM',
    '样品建 BOM',
    'AI_GENERATE',
    'sample_to_bom',
    'LOW',
    '["给样品建BOM","样品建BOM","样品建配方","建BOM","建配方","配方类似","参考SKU","样品BOM","样品转BOM","sample to bom","sampleToBom"]',
    '根据已存在的 ProductSample 生成 BOM 草稿 JSON. 接受可选 referenceSku + 自然语言 adjustments. 仅生成草稿不写库 — 用户在前端编辑确认后再 bom_recipe_create.',
    80, true, NOW(), NOW()
)
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    intent_name = EXCLUDED.intent_name,
    intent_category = EXCLUDED.intent_category,
    sensitivity_level = EXCLUDED.sensitivity_level,
    keywords = EXCLUDED.keywords,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
