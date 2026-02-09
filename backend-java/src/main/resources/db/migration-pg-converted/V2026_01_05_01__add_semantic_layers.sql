-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_05_01__add_semantic_layers.sql
-- Conversion date: 2026-01-26 18:47:26
-- ============================================

-- ============================================================
-- V2026_01_05_01__add_semantic_layers.sql
-- 为AI意图配置表添加语义层字段 (L1-L3)
-- ============================================================

-- 添加语义层字段到AI意图配置表
ALTER TABLE ai_intent_configs
ADD COLUMN semantic_domain VARCHAR(30) NULL COMMENT 'L1语义域: DATA|QUALITY|SCHEDULE|SCALE|SHIPMENT|FORM|META|SYSTEM|MATERIAL|REPORT|ALERT|HR|CRM|CONFIG|USER',
ADD COLUMN semantic_action VARCHAR(30) NULL COMMENT 'L2语义动作: QUERY|UPDATE|CREATE|DELETE|ANALYZE|EXECUTE|CONFIGURE|DETECT',
ADD COLUMN semantic_object VARCHAR(50) NULL COMMENT 'L3语义对象: BATCH|PRODUCT|PLAN|MATERIAL|EQUIPMENT|USER|INTENT|DEVICE|...',
ADD COLUMN semantic_path VARCHAR(100) GENERATED ALWAYS AS (
    CONCAT_WS('.', semantic_domain, semantic_action, semantic_object)
) STORED COMMENT '语义路径，如 DATA.UPDATE.BATCH';

-- 添加索引以支持语义路径查询
CREATE INDEX idx_ai_intent_semantic_path ON ai_intent_configs(semantic_path);
CREATE INDEX idx_ai_intent_semantic_domain ON ai_intent_configs(semantic_domain);
CREATE INDEX idx_ai_intent_semantic_action ON ai_intent_configs(semantic_action);

-- ============================================================
-- 基础意图语义填充 (V2025_12_31_6)
-- ============================================================

-- 分析类意图
UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'ANALYZE', semantic_object = 'COST'
WHERE intent_code = 'COST_ANALYSIS';

UPDATE ai_intent_configs SET
    semantic_domain = 'QUALITY', semantic_action = 'ANALYZE', semantic_object = 'QUALITY'
WHERE intent_code = 'QUALITY_ANALYSIS';

UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'ANALYZE', semantic_object = 'PRODUCTION'
WHERE intent_code = 'PRODUCTION_ANALYSIS';

UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'ANALYZE', semantic_object = 'INVENTORY'
WHERE intent_code = 'INVENTORY_ANALYSIS';

UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'ANALYZE', semantic_object = 'TREND'
WHERE intent_code = 'TREND_PREDICTION';

-- 数据操作类意图
UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'UPDATE', semantic_object = 'BATCH'
WHERE intent_code IN ('BATCH_UPDATE', 'DATA_OPERATION');

UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'UPDATE', semantic_object = 'CORRECTION'
WHERE intent_code = 'DATA_CORRECTION';

UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'DELETE', semantic_object = 'BATCH'
WHERE intent_code = 'BATCH_DELETE';

-- 表单类意图
UPDATE ai_intent_configs SET
    semantic_domain = 'FORM', semantic_action = 'CREATE', semantic_object = 'SCHEMA'
WHERE intent_code IN ('FORM_GENERATION', 'FORM_GENERATE');

UPDATE ai_intent_configs SET
    semantic_domain = 'FORM', semantic_action = 'ANALYZE', semantic_object = 'VALIDATION'
WHERE intent_code = 'FORM_VALIDATION';

UPDATE ai_intent_configs SET
    semantic_domain = 'FORM', semantic_action = 'ANALYZE', semantic_object = 'SUGGESTION'
WHERE intent_code = 'FORM_SUGGESTION';

-- 排程类意图
UPDATE ai_intent_configs SET
    semantic_domain = 'SCHEDULE', semantic_action = 'ANALYZE', semantic_object = 'OPTIMIZATION'
WHERE intent_code IN ('SCHEDULE_OPTIMIZATION', 'SCHEDULE_OPTIMIZE');

UPDATE ai_intent_configs SET
    semantic_domain = 'SCHEDULE', semantic_action = 'ANALYZE', semantic_object = 'RESOURCE'
WHERE intent_code = 'RESOURCE_ALLOCATION';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCHEDULE', semantic_action = 'ANALYZE', semantic_object = 'CAPACITY'
WHERE intent_code = 'CAPACITY_PLANNING';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCHEDULE', semantic_action = 'CREATE', semantic_object = 'URGENT'
WHERE intent_code = 'URGENT_INSERT';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCHEDULE', semantic_action = 'QUERY', semantic_object = 'PLAN'
WHERE intent_code = 'SCHEDULE_QUERY';

-- 系统类意图
UPDATE ai_intent_configs SET
    semantic_domain = 'SYSTEM', semantic_action = 'QUERY', semantic_object = 'REPORT'
WHERE intent_code = 'SYSTEM_REPORT';

UPDATE ai_intent_configs SET
    semantic_domain = 'SYSTEM', semantic_action = 'CONFIGURE', semantic_object = 'SETTINGS'
WHERE intent_code = 'SYSTEM_CONFIG';

UPDATE ai_intent_configs SET
    semantic_domain = 'SYSTEM', semantic_action = 'QUERY', semantic_object = 'HELP'
WHERE intent_code = 'USER_QUERY';

-- ============================================================
-- P0意图语义填充 - 质检类 (V2026_01_04_2)
-- ============================================================

UPDATE ai_intent_configs SET
    semantic_domain = 'QUALITY', semantic_action = 'QUERY', semantic_object = 'CHECK'
WHERE intent_code = 'QUALITY_CHECK_QUERY';

UPDATE ai_intent_configs SET
    semantic_domain = 'QUALITY', semantic_action = 'EXECUTE', semantic_object = 'CHECK'
WHERE intent_code = 'QUALITY_CHECK_EXECUTE';

UPDATE ai_intent_configs SET
    semantic_domain = 'QUALITY', semantic_action = 'ANALYZE', semantic_object = 'DISPOSITION'
WHERE intent_code = 'QUALITY_DISPOSITION_EVALUATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'QUALITY', semantic_action = 'EXECUTE', semantic_object = 'DISPOSITION'
WHERE intent_code = 'QUALITY_DISPOSITION_EXECUTE';

UPDATE ai_intent_configs SET
    semantic_domain = 'QUALITY', semantic_action = 'QUERY', semantic_object = 'STATS'
WHERE intent_code = 'QUALITY_STATS';

UPDATE ai_intent_configs SET
    semantic_domain = 'QUALITY', semantic_action = 'QUERY', semantic_object = 'CRITICAL_ITEMS'
WHERE intent_code = 'QUALITY_CRITICAL_ITEMS';

UPDATE ai_intent_configs SET
    semantic_domain = 'QUALITY', semantic_action = 'QUERY', semantic_object = 'RECORD'
WHERE intent_code = 'QUALITY_RECORD_QUERY';

-- ============================================================
-- P0意图语义填充 - 原料类
-- ============================================================

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'QUERY', semantic_object = 'BATCH'
WHERE intent_code = 'MATERIAL_BATCH_QUERY';

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'UPDATE', semantic_object = 'USE'
WHERE intent_code = 'MATERIAL_BATCH_USE';

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'UPDATE', semantic_object = 'RESERVE'
WHERE intent_code = 'MATERIAL_BATCH_RESERVE';

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'UPDATE', semantic_object = 'RELEASE'
WHERE intent_code = 'MATERIAL_BATCH_RELEASE';

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'UPDATE', semantic_object = 'CONSUME'
WHERE intent_code = 'MATERIAL_BATCH_CONSUME';

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'ANALYZE', semantic_object = 'FIFO'
WHERE intent_code = 'MATERIAL_FIFO_RECOMMEND';

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'QUERY', semantic_object = 'EXPIRING'
WHERE intent_code = 'MATERIAL_EXPIRING_ALERT';

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'QUERY', semantic_object = 'LOW_STOCK'
WHERE intent_code = 'MATERIAL_LOW_STOCK_ALERT';

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'QUERY', semantic_object = 'EXPIRED'
WHERE intent_code = 'MATERIAL_EXPIRED_QUERY';

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'UPDATE', semantic_object = 'QUANTITY'
WHERE intent_code = 'MATERIAL_ADJUST_QUANTITY';

UPDATE ai_intent_configs SET
    semantic_domain = 'MATERIAL', semantic_action = 'UPDATE', semantic_object = 'MATERIAL'
WHERE intent_code = 'MATERIAL_UPDATE';

-- ============================================================
-- P0意图语义填充 - 出货类
-- ============================================================

UPDATE ai_intent_configs SET
    semantic_domain = 'SHIPMENT', semantic_action = 'CREATE', semantic_object = 'SHIPMENT'
WHERE intent_code = 'SHIPMENT_CREATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'SHIPMENT', semantic_action = 'QUERY', semantic_object = 'SHIPMENT'
WHERE intent_code = 'SHIPMENT_QUERY';

UPDATE ai_intent_configs SET
    semantic_domain = 'SHIPMENT', semantic_action = 'UPDATE', semantic_object = 'SHIPMENT'
WHERE intent_code = 'SHIPMENT_UPDATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'SHIPMENT', semantic_action = 'UPDATE', semantic_object = 'STATUS'
WHERE intent_code = 'SHIPMENT_STATUS_UPDATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'SHIPMENT', semantic_action = 'QUERY', semantic_object = 'STATS'
WHERE intent_code = 'SHIPMENT_STATS';

UPDATE ai_intent_configs SET
    semantic_domain = 'SHIPMENT', semantic_action = 'QUERY', semantic_object = 'BY_CUSTOMER'
WHERE intent_code = 'SHIPMENT_BY_CUSTOMER';

UPDATE ai_intent_configs SET
    semantic_domain = 'SHIPMENT', semantic_action = 'QUERY', semantic_object = 'BY_DATE'
WHERE intent_code = 'SHIPMENT_BY_DATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'SHIPMENT', semantic_action = 'QUERY', semantic_object = 'TRACE'
WHERE intent_code = 'TRACE_BATCH';

UPDATE ai_intent_configs SET
    semantic_domain = 'SHIPMENT', semantic_action = 'QUERY', semantic_object = 'TRACE_FULL'
WHERE intent_code = 'TRACE_FULL';

UPDATE ai_intent_configs SET
    semantic_domain = 'SHIPMENT', semantic_action = 'QUERY', semantic_object = 'TRACE_PUBLIC'
WHERE intent_code = 'TRACE_PUBLIC';

-- ============================================================
-- P1意图语义填充 - 报表类 (V2026_01_04_3)
-- ============================================================

UPDATE ai_intent_configs SET
    semantic_domain = 'REPORT', semantic_action = 'QUERY', semantic_object = 'DASHBOARD'
WHERE intent_code = 'REPORT_DASHBOARD_OVERVIEW';

UPDATE ai_intent_configs SET
    semantic_domain = 'REPORT', semantic_action = 'QUERY', semantic_object = 'PRODUCTION'
WHERE intent_code = 'REPORT_PRODUCTION';

UPDATE ai_intent_configs SET
    semantic_domain = 'REPORT', semantic_action = 'QUERY', semantic_object = 'QUALITY'
WHERE intent_code = 'REPORT_QUALITY';

UPDATE ai_intent_configs SET
    semantic_domain = 'REPORT', semantic_action = 'QUERY', semantic_object = 'INVENTORY'
WHERE intent_code = 'REPORT_INVENTORY';

UPDATE ai_intent_configs SET
    semantic_domain = 'REPORT', semantic_action = 'QUERY', semantic_object = 'FINANCE'
WHERE intent_code = 'REPORT_FINANCE';

UPDATE ai_intent_configs SET
    semantic_domain = 'REPORT', semantic_action = 'QUERY', semantic_object = 'EFFICIENCY'
WHERE intent_code = 'REPORT_EFFICIENCY';

UPDATE ai_intent_configs SET
    semantic_domain = 'REPORT', semantic_action = 'QUERY', semantic_object = 'KPI'
WHERE intent_code = 'REPORT_KPI';

UPDATE ai_intent_configs SET
    semantic_domain = 'REPORT', semantic_action = 'QUERY', semantic_object = 'ANOMALY'
WHERE intent_code = 'REPORT_ANOMALY';

UPDATE ai_intent_configs SET
    semantic_domain = 'REPORT', semantic_action = 'QUERY', semantic_object = 'TRENDS'
WHERE intent_code = 'REPORT_TRENDS';

-- ============================================================
-- P1意图语义填充 - 告警类
-- ============================================================

UPDATE ai_intent_configs SET
    semantic_domain = 'ALERT', semantic_action = 'QUERY', semantic_object = 'LIST'
WHERE intent_code = 'ALERT_LIST';

UPDATE ai_intent_configs SET
    semantic_domain = 'ALERT', semantic_action = 'QUERY', semantic_object = 'ACTIVE'
WHERE intent_code = 'ALERT_ACTIVE';

UPDATE ai_intent_configs SET
    semantic_domain = 'ALERT', semantic_action = 'QUERY', semantic_object = 'STATS'
WHERE intent_code = 'ALERT_STATS';

UPDATE ai_intent_configs SET
    semantic_domain = 'ALERT', semantic_action = 'EXECUTE', semantic_object = 'ACKNOWLEDGE'
WHERE intent_code = 'ALERT_ACKNOWLEDGE';

UPDATE ai_intent_configs SET
    semantic_domain = 'ALERT', semantic_action = 'EXECUTE', semantic_object = 'RESOLVE'
WHERE intent_code = 'ALERT_RESOLVE';

UPDATE ai_intent_configs SET
    semantic_domain = 'ALERT', semantic_action = 'ANALYZE', semantic_object = 'TRIAGE'
WHERE intent_code = 'ALERT_TRIAGE';

UPDATE ai_intent_configs SET
    semantic_domain = 'ALERT', semantic_action = 'ANALYZE', semantic_object = 'DIAGNOSE'
WHERE intent_code = 'ALERT_DIAGNOSE';

UPDATE ai_intent_configs SET
    semantic_domain = 'ALERT', semantic_action = 'QUERY', semantic_object = 'BY_EQUIPMENT'
WHERE intent_code = 'ALERT_BY_EQUIPMENT';

UPDATE ai_intent_configs SET
    semantic_domain = 'ALERT', semantic_action = 'QUERY', semantic_object = 'BY_LEVEL'
WHERE intent_code = 'ALERT_BY_LEVEL';

-- ============================================================
-- P1意图语义填充 - 人事/考勤类
-- ============================================================

UPDATE ai_intent_configs SET
    semantic_domain = 'HR', semantic_action = 'QUERY', semantic_object = 'STATUS'
WHERE intent_code = 'ATTENDANCE_STATUS';

UPDATE ai_intent_configs SET
    semantic_domain = 'HR', semantic_action = 'QUERY', semantic_object = 'HISTORY'
WHERE intent_code = 'ATTENDANCE_HISTORY';

UPDATE ai_intent_configs SET
    semantic_domain = 'HR', semantic_action = 'QUERY', semantic_object = 'STATS'
WHERE intent_code = 'ATTENDANCE_STATS';

UPDATE ai_intent_configs SET
    semantic_domain = 'HR', semantic_action = 'QUERY', semantic_object = 'MONTHLY'
WHERE intent_code = 'ATTENDANCE_MONTHLY';

UPDATE ai_intent_configs SET
    semantic_domain = 'HR', semantic_action = 'QUERY', semantic_object = 'ANOMALY'
WHERE intent_code = 'ATTENDANCE_ANOMALY';

UPDATE ai_intent_configs SET
    semantic_domain = 'HR', semantic_action = 'QUERY', semantic_object = 'DEPARTMENT'
WHERE intent_code = 'ATTENDANCE_DEPARTMENT';

UPDATE ai_intent_configs SET
    semantic_domain = 'HR', semantic_action = 'QUERY', semantic_object = 'TODAY'
WHERE intent_code = 'ATTENDANCE_TODAY';

UPDATE ai_intent_configs SET
    semantic_domain = 'HR', semantic_action = 'EXECUTE', semantic_object = 'CLOCK_IN'
WHERE intent_code = 'CLOCK_IN';

UPDATE ai_intent_configs SET
    semantic_domain = 'HR', semantic_action = 'EXECUTE', semantic_object = 'CLOCK_OUT'
WHERE intent_code = 'CLOCK_OUT';

-- ============================================================
-- P1意图语义填充 - CRM类（客户/供应商）
-- ============================================================

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'CUSTOMER_LIST'
WHERE intent_code = 'CUSTOMER_LIST';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'CUSTOMER'
WHERE intent_code = 'CUSTOMER_SEARCH';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'CUSTOMER_STATS'
WHERE intent_code = 'CUSTOMER_STATS';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'CUSTOMER_BY_TYPE'
WHERE intent_code = 'CUSTOMER_BY_TYPE';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'CUSTOMER_ACTIVE'
WHERE intent_code = 'CUSTOMER_ACTIVE';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'PURCHASE_HISTORY'
WHERE intent_code = 'CUSTOMER_PURCHASE_HISTORY';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'SUPPLIER_LIST'
WHERE intent_code = 'SUPPLIER_LIST';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'SUPPLIER'
WHERE intent_code = 'SUPPLIER_SEARCH';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'ANALYZE', semantic_object = 'SUPPLIER'
WHERE intent_code = 'SUPPLIER_EVALUATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'SUPPLIER_BY_CATEGORY'
WHERE intent_code = 'SUPPLIER_BY_CATEGORY';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'SUPPLIER_ACTIVE'
WHERE intent_code = 'SUPPLIER_ACTIVE';

UPDATE ai_intent_configs SET
    semantic_domain = 'CRM', semantic_action = 'QUERY', semantic_object = 'SUPPLIER_RANKING'
WHERE intent_code = 'SUPPLIER_RANKING';

-- ============================================================
-- 秤设备意图语义填充 (V2026_01_04_30/31)
-- ============================================================

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'CREATE', semantic_object = 'MODEL'
WHERE intent_code = 'SCALE_ADD_MODEL';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'DETECT', semantic_object = 'PROTOCOL'
WHERE intent_code = 'SCALE_PROTOCOL_DETECT';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'CREATE', semantic_object = 'CONFIG'
WHERE intent_code = 'SCALE_CONFIG_GENERATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'ANALYZE', semantic_object = 'TROUBLESHOOT'
WHERE intent_code = 'SCALE_TROUBLESHOOT';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'QUERY', semantic_object = 'PROTOCOLS'
WHERE intent_code = 'SCALE_LIST_PROTOCOLS';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'EXECUTE', semantic_object = 'TEST_PARSE'
WHERE intent_code = 'SCALE_TEST_PARSE';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'QUERY', semantic_object = 'MODEL'
WHERE intent_code = 'SCALE_SEARCH_MODEL';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'QUERY', semantic_object = 'MODEL_DETAIL'
WHERE intent_code = 'SCALE_MODEL_DETAIL';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'CREATE', semantic_object = 'DEVICE'
WHERE intent_code = 'SCALE_ADD_DEVICE';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'CREATE', semantic_object = 'DEVICE_VISION'
WHERE intent_code = 'SCALE_ADD_DEVICE_VISION';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'QUERY', semantic_object = 'DEVICES'
WHERE intent_code = 'SCALE_LIST_DEVICES';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'QUERY', semantic_object = 'DEVICE_DETAIL'
WHERE intent_code = 'SCALE_DEVICE_DETAIL';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'UPDATE', semantic_object = 'DEVICE'
WHERE intent_code = 'SCALE_UPDATE_DEVICE';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'DELETE', semantic_object = 'DEVICE'
WHERE intent_code = 'SCALE_DELETE_DEVICE';

UPDATE ai_intent_configs SET
    semantic_domain = 'SCALE', semantic_action = 'DETECT', semantic_object = 'WEIGHT'
WHERE intent_code = 'SCALE_WEIGHT_DETECT';

-- ============================================================
-- AI管理意图语义填充 (V2026_01_04_1)
-- ============================================================

-- 排产设置
UPDATE ai_intent_configs SET
    semantic_domain = 'SYSTEM', semantic_action = 'CONFIGURE', semantic_object = 'SCHEDULING_AUTO'
WHERE intent_code = 'SCHEDULING_SET_AUTO';

UPDATE ai_intent_configs SET
    semantic_domain = 'SYSTEM', semantic_action = 'CONFIGURE', semantic_object = 'SCHEDULING_MANUAL'
WHERE intent_code = 'SCHEDULING_SET_MANUAL';

UPDATE ai_intent_configs SET
    semantic_domain = 'SYSTEM', semantic_action = 'CONFIGURE', semantic_object = 'SCHEDULING_DISABLED'
WHERE intent_code = 'SCHEDULING_SET_DISABLED';

-- 工厂功能
UPDATE ai_intent_configs SET
    semantic_domain = 'SYSTEM', semantic_action = 'CONFIGURE', semantic_object = 'FEATURE'
WHERE intent_code = 'FACTORY_FEATURE_TOGGLE';

UPDATE ai_intent_configs SET
    semantic_domain = 'SYSTEM', semantic_action = 'CONFIGURE', semantic_object = 'NOTIFICATION'
WHERE intent_code = 'FACTORY_NOTIFICATION_CONFIG';

-- 用户管理
UPDATE ai_intent_configs SET
    semantic_domain = 'USER', semantic_action = 'CREATE', semantic_object = 'ACCOUNT'
WHERE intent_code = 'USER_CREATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'USER', semantic_action = 'UPDATE', semantic_object = 'STATUS'
WHERE intent_code = 'USER_DISABLE';

UPDATE ai_intent_configs SET
    semantic_domain = 'USER', semantic_action = 'UPDATE', semantic_object = 'ROLE'
WHERE intent_code = 'USER_ROLE_ASSIGN';

-- 配置管理
UPDATE ai_intent_configs SET
    semantic_domain = 'CONFIG', semantic_action = 'UPDATE', semantic_object = 'MAINTENANCE'
WHERE intent_code = 'EQUIPMENT_MAINTENANCE';

UPDATE ai_intent_configs SET
    semantic_domain = 'CONFIG', semantic_action = 'UPDATE', semantic_object = 'CONVERSION_RATE'
WHERE intent_code = 'CONVERSION_RATE_UPDATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'CONFIG', semantic_action = 'UPDATE', semantic_object = 'RULE'
WHERE intent_code = 'RULE_CONFIG';

-- 元意图
UPDATE ai_intent_configs SET
    semantic_domain = 'META', semantic_action = 'CREATE', semantic_object = 'INTENT'
WHERE intent_code = 'INTENT_CREATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'META', semantic_action = 'UPDATE', semantic_object = 'INTENT'
WHERE intent_code = 'INTENT_UPDATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'META', semantic_action = 'ANALYZE', semantic_object = 'INTENT'
WHERE intent_code = 'INTENT_ANALYZE';

UPDATE ai_intent_configs SET
    semantic_domain = 'META', semantic_action = 'QUERY', semantic_object = 'INTENT'
WHERE intent_code = 'META_INTENT_QUERY';

UPDATE ai_intent_configs SET
    semantic_domain = 'META', semantic_action = 'UPDATE', semantic_object = 'INTENT'
WHERE intent_code = 'META_INTENT_UPDATE';

-- ============================================================
-- 数据操作意图语义填充 (V2026_01_02_1)
-- ============================================================

UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'UPDATE', semantic_object = 'PRODUCT'
WHERE intent_code = 'PRODUCT_UPDATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'UPDATE', semantic_object = 'PLAN'
WHERE intent_code = 'PLAN_UPDATE';

UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'UPDATE', semantic_object = 'STATUS'
WHERE intent_code = 'STATUS_CHANGE';

UPDATE ai_intent_configs SET
    semantic_domain = 'DATA', semantic_action = 'UPDATE', semantic_object = 'QUANTITY'
WHERE intent_code = 'QUANTITY_ADJUST';

-- ============================================================
-- 迁移结果统计
-- ============================================================

SELECT
    semantic_domain AS 'L1_Domain',
    COUNT(*) AS 'Intent_Count'
FROM ai_intent_configs
WHERE semantic_domain IS NOT NULL
GROUP BY semantic_domain
ORDER BY COUNT(*) DESC;

SELECT CONCAT('语义层字段已填充: ', COUNT(*), ' 条意图') AS migration_result
FROM ai_intent_configs
WHERE semantic_domain IS NOT NULL;
