-- ============================================================
-- V2026_01_02_1__data_operation_intents.sql
-- 添加更具体的数据操作意图配置
-- 支持通过自然语言修改业务数据
-- ============================================================

-- 产品类型更新意图
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, quota_cost, requires_approval, keywords, handler_class, description, priority)
VALUES
    (UUID(), 'PRODUCT_UPDATE', '产品更新', 'DATA_OP', 'HIGH', 2, FALSE,
     '["产品", "修改产品", "更新产品", "产品信息", "改产品", "调整产品"]',
     'DataOperationIntentHandler',
     '更新产品类型信息，如名称、规格、单位等', 85);

-- 生产计划更新意图
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, quota_cost, requires_approval, keywords, handler_class, description, priority)
VALUES
    (UUID(), 'PLAN_UPDATE', '计划更新', 'DATA_OP', 'HIGH', 2, FALSE,
     '["计划", "修改计划", "更新计划", "生产计划", "改计划", "调整计划", "计划数量", "产量"]',
     'DataOperationIntentHandler',
     '更新生产计划信息，如计划数量、日期等', 85);

-- 原材料批次更新意图
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, quota_cost, requires_approval, keywords, handler_class, description, priority)
VALUES
    (UUID(), 'MATERIAL_UPDATE', '原材料更新', 'DATA_OP', 'HIGH', 2, FALSE,
     '["原材料", "原料", "材料", "修改原材料", "更新材料", "改原材料"]',
     'DataOperationIntentHandler',
     '更新原材料批次信息，如数量、状态等', 85);

-- 更新现有的 BATCH_UPDATE 意图，添加更多中文关键词和处理器
UPDATE ai_intent_configs
SET keywords = '["批次", "生产批次", "批量", "更新", "修改", "调整", "改成", "改为", "update", "把", "的"]',
    handler_class = 'DataOperationIntentHandler',
    description = '更新生产批次信息，如计划产量、状态等'
WHERE intent_code = 'BATCH_UPDATE';

-- 状态变更意图 (通用)
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, quota_cost, requires_approval, keywords, handler_class, description, priority)
VALUES
    (UUID(), 'STATUS_CHANGE', '状态变更', 'DATA_OP', 'HIGH', 2, FALSE,
     '["状态", "改状态", "更新状态", "变更状态", "完成", "取消", "暂停", "恢复", "启动"]',
     'DataOperationIntentHandler',
     '变更业务实体状态，如批次状态、计划状态等', 80);

-- 数量调整意图 (高频使用)
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, quota_cost, requires_approval, keywords, handler_class, description, priority)
VALUES
    (UUID(), 'QUANTITY_ADJUST', '数量调整', 'DATA_OP', 'HIGH', 2, FALSE,
     '["数量", "产量", "改数量", "调整数量", "改产量", "调产量", "增加", "减少", "设为"]',
     'DataOperationIntentHandler',
     '调整生产数量、库存数量等', 90);
