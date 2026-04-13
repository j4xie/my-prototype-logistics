-- V20260411_03: Register 2 new intents for P3.5D P5+P6
-- Binds RESTAURANT_DEPARTMENT_PNL + RESTAURANT_MONTHLY_PPT intents to
-- their respective tools (created in P3.5D P4+P5, wrapping P3.5D P1+P3
-- Python sections).
--
-- Category: SMARTBI (matches all restaurant diagnostic intents)
-- Sensitivity: LOW (read-only diagnostic, no data mutation)
-- Idempotent via ON CONFLICT (intent_code) DO UPDATE.

-- Department P&L intent
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_DEPARTMENT_PNL', '部门 P&L 分解', 'SMARTBI', 'restaurant_department_pnl', 'LOW',
        '["部门人力","前厅后厨","人均产出","哪个部门","后厨贵","前厅贵","部门成本","档口成本","人均工资"]',
        '部门级 P&L 分解 + 人均产出比. 按 DepartmentTree 聚合人力成本, 计算每个档口的人均工资 + 占总营收比.',
        85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = 'restaurant_department_pnl',
    is_active = true;

-- Monthly PPT export intent
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_MONTHLY_PPT', '月度经营分析 PPT', 'SMARTBI', 'restaurant_monthly_ppt_export', 'LOW',
        '["月度报告","月度 PPT","月度经营分析","给我 PPT","月度简报","月度总结","导出月度报表"]',
        '生成 19 张幻灯片的月度经营分析 PPT, 匹配客户已有模板结构.',
        85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = 'restaurant_monthly_ppt_export',
    is_active = true;
