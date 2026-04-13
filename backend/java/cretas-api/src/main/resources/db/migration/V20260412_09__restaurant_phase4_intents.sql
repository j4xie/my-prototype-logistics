-- V20260412_09: Phase 4 workforce management intent registrations
-- 7 intents: shift_create, shift_analysis, piecework_config, piecework_calc,
--            performance_rule, performance_eval, store_kpi_dashboard

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'RESTAURANT_SHIFT_CREATE', '创建排班', 'SMARTBI', 'restaurant_shift_create', 'LOW',
 '["排班","创建班次","分配班次","排班模板"]', '创建排班模板或分配班次', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_shift_create', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'RESTAURANT_SHIFT_ANALYSIS', '排班分析', 'SMARTBI', 'restaurant_shift_analysis', 'LOW',
 '["排班分析","全职兼职","公式制","工时分析","排班效率","兼职比例"]', '评估排班效率和全职/兼职比例', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_shift_analysis', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'RESTAURANT_PIECEWORK_CONFIG', '计件配置', 'SMARTBI', 'restaurant_piecework_config', 'LOW',
 '["计件配置","设置计件","计件规则","提成规则"]', '配置计件绩效规则', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_piecework_config', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'RESTAURANT_PIECEWORK_CALC', '计件计算', 'SMARTBI', 'restaurant_piecework_calc', 'LOW',
 '["计件","提成计算","迎宾提成","小组计件","绩效提成","按单计算"]', '计算本月计件提成', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_piecework_calc', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'RESTAURANT_PERFORMANCE_RULE', '绩效规则', 'SMARTBI', 'restaurant_performance_rule_manage', 'LOW',
 '["绩效规则","KPI权重","考核指标","绩效设置"]', '管理绩效规则', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_performance_rule_manage', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'RESTAURANT_PERFORMANCE_EVAL', '绩效评估', 'SMARTBI', 'restaurant_performance_eval', 'LOW',
 '["绩效评估","绩效考核","KPI得分","考核结果","绩效打分"]', '基于KPI加权评估绩效', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_performance_eval', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'RESTAURANT_STORE_KPI_DASHBOARD', '店长KPI', 'SMARTBI', 'restaurant_store_kpi_dashboard', 'LOW',
 '["店长KPI","三维度","健康度","门店评估","综合评估","KPI仪表盘"]', '店长KPI三维度健康度评估', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_store_kpi_dashboard', is_active = true;
