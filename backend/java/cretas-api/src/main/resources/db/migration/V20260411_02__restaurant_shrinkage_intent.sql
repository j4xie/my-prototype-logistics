-- V20260411_02: Register shrinkage_analysis intent for P3.5C B6
-- Binds RESTAURANT_SHRINKAGE intent to restaurant_shrinkage_analysis tool
-- (created in P3.5C B5, wraps P3.5C B4 Python section).
--
-- Category: SMARTBI (matches all restaurant diagnostic intents)
-- Sensitivity: LOW (read-only diagnostic, no data mutation)
-- Idempotent via ON CONFLICT (intent_code) DO UPDATE.

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_SHRINKAGE', '档口损溢分析', 'SMARTBI', 'restaurant_shrinkage_analysis', 'LOW',
        '["损溢","标准成本","实际成本","哪个档口","档口超标","损耗率","月度盘点差异","变异率","厨房损耗"]',
        '档口标准成本 vs 实际成本差异分析 (损溢). 识别超标档口 + 生成改进跟踪表.',
        85, true)
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = 'restaurant_shrinkage_analysis',
    is_active = true;
