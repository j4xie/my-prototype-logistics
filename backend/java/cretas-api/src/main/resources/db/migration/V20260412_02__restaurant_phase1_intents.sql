-- V20260412_02: Register Phase 1 financial analytics intents (4 new tools)

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_BOM_VARIANCE', 'BOM成本差异双归因', 'SMARTBI', 'restaurant_bom_variance', 'LOW',
        '["BOM差异","成本差异归因","供应链差异","管理差异","标准成本差异","采购价变动","实际用量偏差"]',
        'BOM 成本差异双维度归因 — 拆为供应链差异 (采购价) + 管理差异 (用量)', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_bom_variance', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_SALES_PLAN_CREATE', '创建销售计划', 'SMARTBI', 'restaurant_sales_plan_create', 'LOW',
        '["销售计划","月度计划","目标营收","设定目标","预设计划"]',
        '创建或更新门店月度销售计划, 支持节假日调整', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_sales_plan_create', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_SALES_PLAN_TRACK', '销售计划追踪', 'SMARTBI', 'restaurant_sales_plan_track', 'LOW',
        '["计划完成","完成度","目标达成","还差多少","进度追踪","计划追踪","本月目标"]',
        '追踪门店月度销售计划完成度, 对比目标与实际, 未达标预警', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_sales_plan_track', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_LABOR_PRODUCTIVITY', '人效监控', 'SMARTBI', 'restaurant_labor_productivity', 'LOW',
        '["人效","人均产出","员工效率","用人多少","人力成本效率","几个人","人效比"]',
        '人效 (人均产出) 监控, 判断是否在 3-4 万健康区间', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_labor_productivity', is_active = true;
