-- M-BOM-1 / Track D1: Register 6 BOM AI intents.
--
-- Pairs with ai/tool/impl/bom/*.java (@Component, ToolRegistry auto-collects).
-- IntentExecutor reads tool_name from ai_intent_configs to dispatch.
--
-- Pattern mirrors V20260513_02__revenue_report_intent.sql (REVENUE_REPORT_GENERATE):
--   - gen_random_uuid() for ID
--   - explicit created_at = NOW(), updated_at = NOW() (NOT NULL, no DEFAULT)
--   - ON CONFLICT (intent_code) DO UPDATE keeps tool_name in sync on re-apply
--   - Priority 80 baseline
--   - Sensitivity LOW for read; bom_recipe_activate is WRITE w/ preview support
--
-- Intents:
--   1. BOM_RECIPE_QUERY                 (read)
--   2. BOM_RECIPE_COST_CALCULATE        (read, derived)
--   3. BOM_RECIPE_ACTIVATE              (write, with preview)
--   4. BOM_RECIPE_CLONE_WITH_MODIFY     (write)
--   5. BOM_RECIPE_CREATE_FROM_TEXT      (write, NLP regex parse)
--   6. BOM_RECIPE_CREATE_FROM_SAMPLE    (write, STUB — S-RD-1 pending)

-- 1. Query
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'BOM_RECIPE_QUERY',
    '查询 BOM 配方',
    'PRODUCTION',
    'bom_recipe_query',
    'LOW',
    '["BOM","配方","原辅料配方","产品配方","当前配方","查 BOM","看 BOM","物料明细"]',
    '查询某产品当前生效的 BOM 配方, 含主子表完整结构 (主表 + 配方项 + 出成率 + 成本).',
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

-- 2. Cost calculate
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'BOM_RECIPE_COST_CALCULATE',
    'BOM 配方成本计算',
    'PRODUCTION',
    'bom_recipe_cost_calculate',
    'LOW',
    '["BOM 成本","配方成本","原料成本","重算成本","算成本","成本分析","利润分析"]',
    '重算 BOM 配方的总成本 (material/labor/overhead/total), 返回最新成本汇总. 价格敏感字段按 RBAC strip.',
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

-- 3. Activate (WRITE with preview)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'BOM_RECIPE_ACTIVATE',
    'BOM 配方激活',
    'PRODUCTION',
    'bom_recipe_activate',
    'MEDIUM',
    '["激活 BOM","BOM 生效","启用配方","切换配方","正式启用","上线配方"]',
    '激活 DRAFT 状态的 BOM 配方 (DRAFT → ACTIVE), 同产品其他生效版本自动失效. 支持预览 TCC.',
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

-- 4. Clone with modify
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'BOM_RECIPE_CLONE_WITH_MODIFY',
    'BOM 克隆并修改',
    'PRODUCTION',
    'bom_recipe_clone_with_modify',
    'MEDIUM',
    '["克隆 BOM","复制配方","调整配方","包材减","调味料加","季节性调整","小幅修改"]',
    '克隆 BOM 配方为新版本 (version+1, DRAFT), 可选择性按物料分类调整用量百分比. ' ||
    '示例: 克隆 SKU-201 但 PACKAGING 减 10%.',
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

-- 5. Create from text
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'BOM_RECIPE_CREATE_FROM_TEXT',
    '一句话建 BOM',
    'PRODUCTION',
    'bom_recipe_create_from_text',
    'MEDIUM',
    '["建 BOM","创建配方","新建 BOM","一句话建配方","快速 BOM","AI 建 BOM"]',
    '通过自然语言一句话创建 BOM 配方草稿. 示例: ' ||
    '"给红烧肉建 BOM, 五花肉 200g 出成率 80%, 老抽 5g, 糖 10g, 单份成品 150g". ' ||
    '物料名 fuzzy match 后端 raw_material_types 字典. 返回 DRAFT 状态.',
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

-- 6. Create from sample (STUB, S-RD-1 pending)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'BOM_RECIPE_CREATE_FROM_SAMPLE',
    '从研发样品生成 BOM',
    'RD',
    'bom_recipe_create_from_sample',
    'MEDIUM',
    '["样品生成 BOM","样品转 BOM","研发样品","样品自动建配方","新菜研发"]',
    '[STUB - S-RD-1 pending] 从研发样品 (product_samples) 自动生成 BOM 配方草稿. ' ||
    '依赖 sample_followups 表 (待 S-RD-1 ship). 目前返回 NOT_IMPLEMENTED.',
    -- priority 70 (低于其他, 因 STUB 状态)
    70, true, NOW(), NOW()
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
