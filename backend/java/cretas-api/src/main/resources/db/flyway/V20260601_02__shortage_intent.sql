-- Sprint 2 Track E (S-MRP-1 / N31): SHORTAGE_ANALYSIS intent → shortage_analyze tool.
--
-- Pattern mirrors V20260516_04 / V20260516_07 (BOM / WorkProcess intents):
--   - gen_random_uuid() for ID
--   - explicit created_at / updated_at = NOW()
--   - ON CONFLICT (intent_code) DO UPDATE keeps tool_name in sync
--
-- Priority 80 = baseline. Sensitivity LOW (read-only analyze, no side effects).
-- Tool 自身按命名约定 (*_analyze) 自动 derive ActionType=ANALYZE / RiskLevel=LOW.

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES
(
    gen_random_uuid(),
    'SHORTAGE_ANALYSIS',
    '销售订单缺料分析',
    'DATA_QUERY',
    'shortage_analyze',
    'LOW',
    '["缺料","缺什么","缺多少","缺哪些原料","库存够吗","成品够吗","要采购什么","这单能做吗","原料够不够","缺料分析"]',
    'S-MRP-1 N31: 分析销售订单成品库存 + BOM 原料缺口, 返回采购建议 + 生产建议 + chain-card 提示。read-only 不创建采购/生产单。',
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
