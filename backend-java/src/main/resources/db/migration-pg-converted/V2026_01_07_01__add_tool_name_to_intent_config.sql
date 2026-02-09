-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_07_01__add_tool_name_to_intent_config.sql
-- Conversion date: 2026-01-26 18:47:51
-- ============================================

-- =====================================================
-- V2026_01_07_01: Add tool_name column to ai_intent_configs
-- Purpose: Support new Tool Calling architecture
-- =====================================================

-- Add tool_name column
ALTER TABLE ai_intent_configs
ADD COLUMN IF NOT EXISTS tool_name VARCHAR(100) NULL
COMMENT 'Tool 名称，对应 ToolExecutor.getToolName()';

-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_intent_tool_name ON ai_intent_configs(tool_name);

-- =====================================================
-- Populate tool_name for existing MATERIAL intents
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'material_batch_query'
WHERE intent_code = 'MATERIAL_BATCH_QUERY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'material_batch_use'
WHERE intent_code = 'MATERIAL_BATCH_USE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'material_batch_consume'
WHERE intent_code = 'MATERIAL_BATCH_CONSUME' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'material_batch_reserve'
WHERE intent_code = 'MATERIAL_BATCH_RESERVE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'material_batch_release'
WHERE intent_code = 'MATERIAL_BATCH_RELEASE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'material_adjust_quantity'
WHERE intent_code = 'MATERIAL_ADJUST_QUANTITY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'material_fifo_recommend'
WHERE intent_code = 'MATERIAL_FIFO_RECOMMEND' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'material_expired_query'
WHERE intent_code = 'MATERIAL_EXPIRED_QUERY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'material_expiring_alert'
WHERE intent_code = 'MATERIAL_EXPIRING_ALERT' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'material_low_stock_alert'
WHERE intent_code = 'MATERIAL_LOW_STOCK_ALERT' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for QUALITY intents
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'quality_check_create'
WHERE intent_code = 'QUALITY_CHECK_EXECUTE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'quality_check_query'
WHERE intent_code = 'QUALITY_CHECK_QUERY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'quality_critical_items'
WHERE intent_code = 'QUALITY_CRITICAL_ITEMS' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'quality_disposition_evaluate'
WHERE intent_code = 'QUALITY_DISPOSITION_EVALUATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'quality_disposition_execute'
WHERE intent_code = 'QUALITY_DISPOSITION_EXECUTE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'quality_stats_query'
WHERE intent_code = 'QUALITY_STATS' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for SHIPMENT intents
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'shipment_create'
WHERE intent_code = 'SHIPMENT_CREATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'shipment_query'
WHERE intent_code = 'SHIPMENT_QUERY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'shipment_update'
WHERE intent_code = 'SHIPMENT_UPDATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'shipment_status_update'
WHERE intent_code = 'SHIPMENT_STATUS_UPDATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'shipment_stats_query'
WHERE intent_code = 'SHIPMENT_STATS' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'shipment_by_customer'
WHERE intent_code = 'SHIPMENT_BY_CUSTOMER' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'shipment_by_date'
WHERE intent_code = 'SHIPMENT_BY_DATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'trace_batch'
WHERE intent_code = 'TRACE_BATCH' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'trace_full'
WHERE intent_code = 'TRACE_FULL' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'trace_public'
WHERE intent_code = 'TRACE_PUBLIC' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for CRM intents (12)
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'customer_list'
WHERE intent_code = 'CUSTOMER_LIST' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'customer_search'
WHERE intent_code = 'CUSTOMER_SEARCH' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'customer_active'
WHERE intent_code = 'CUSTOMER_ACTIVE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'customer_by_type'
WHERE intent_code = 'CUSTOMER_BY_TYPE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'customer_purchase_history'
WHERE intent_code = 'CUSTOMER_PURCHASE_HISTORY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'customer_stats'
WHERE intent_code = 'CUSTOMER_STATS' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'supplier_list'
WHERE intent_code = 'SUPPLIER_LIST' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'supplier_search'
WHERE intent_code = 'SUPPLIER_SEARCH' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'supplier_active'
WHERE intent_code = 'SUPPLIER_ACTIVE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'supplier_by_category'
WHERE intent_code = 'SUPPLIER_BY_CATEGORY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'supplier_evaluate'
WHERE intent_code = 'SUPPLIER_EVALUATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'supplier_ranking'
WHERE intent_code = 'SUPPLIER_RANKING' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for HR intents (9)
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'attendance_today'
WHERE intent_code = 'ATTENDANCE_TODAY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'attendance_status'
WHERE intent_code = 'ATTENDANCE_STATUS' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'attendance_history'
WHERE intent_code = 'ATTENDANCE_HISTORY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'attendance_monthly'
WHERE intent_code = 'ATTENDANCE_MONTHLY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'attendance_department'
WHERE intent_code = 'ATTENDANCE_DEPARTMENT' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'attendance_anomaly'
WHERE intent_code = 'ATTENDANCE_ANOMALY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'attendance_stats'
WHERE intent_code = 'ATTENDANCE_STATS' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'clock_in'
WHERE intent_code = 'CLOCK_IN' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'clock_out'
WHERE intent_code = 'CLOCK_OUT' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for ALERT intents (9)
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'alert_list'
WHERE intent_code = 'ALERT_LIST' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'alert_active'
WHERE intent_code = 'ALERT_ACTIVE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'alert_by_equipment'
WHERE intent_code = 'ALERT_BY_EQUIPMENT' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'alert_by_level'
WHERE intent_code = 'ALERT_BY_LEVEL' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'alert_stats'
WHERE intent_code = 'ALERT_STATS' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'alert_acknowledge'
WHERE intent_code = 'ALERT_ACKNOWLEDGE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'alert_resolve'
WHERE intent_code = 'ALERT_RESOLVE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'alert_diagnose'
WHERE intent_code = 'ALERT_DIAGNOSE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'alert_triage'
WHERE intent_code = 'ALERT_TRIAGE' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for SCALE intents (6)
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'scale_list_devices'
WHERE intent_code = 'SCALE_LIST_DEVICES' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'scale_device_detail'
WHERE intent_code = 'SCALE_DEVICE_DETAIL' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'scale_add_device'
WHERE intent_code = 'SCALE_ADD_DEVICE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'scale_add_device_vision'
WHERE intent_code = 'SCALE_ADD_DEVICE_VISION' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'scale_update_device'
WHERE intent_code = 'SCALE_UPDATE_DEVICE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'scale_delete_device'
WHERE intent_code = 'SCALE_DELETE_DEVICE' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for REPORT intents (9)
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'report_dashboard_overview'
WHERE intent_code = 'REPORT_DASHBOARD_OVERVIEW' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'report_production'
WHERE intent_code = 'REPORT_PRODUCTION' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'report_quality'
WHERE intent_code = 'REPORT_QUALITY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'report_inventory'
WHERE intent_code = 'REPORT_INVENTORY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'report_efficiency'
WHERE intent_code = 'REPORT_EFFICIENCY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'report_finance'
WHERE intent_code = 'REPORT_FINANCE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'report_kpi'
WHERE intent_code = 'REPORT_KPI' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'report_trends'
WHERE intent_code = 'REPORT_TRENDS' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'report_anomaly'
WHERE intent_code = 'REPORT_ANOMALY' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for DATA_OP intents (5)
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'batch_update'
WHERE intent_code = 'BATCH_UPDATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'material_update'
WHERE intent_code = 'MATERIAL_UPDATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'plan_update'
WHERE intent_code = 'PLAN_UPDATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'product_type_query'
WHERE intent_code = 'PRODUCT_TYPE_QUERY' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'product_update'
WHERE intent_code = 'PRODUCT_UPDATE' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for SYSTEM intents (5 real intents)
-- Note: Test intents (E2E_PLAT_*, FACTORY_TEST_*, PLATFORM_SHARED_*) skipped
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'scheduling_set_auto'
WHERE intent_code = 'SCHEDULING_SET_AUTO' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'scheduling_set_manual'
WHERE intent_code = 'SCHEDULING_SET_MANUAL' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'scheduling_set_disabled'
WHERE intent_code = 'SCHEDULING_SET_DISABLED' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'factory_feature_toggle'
WHERE intent_code = 'FACTORY_FEATURE_TOGGLE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'factory_notification_config'
WHERE intent_code = 'FACTORY_NOTIFICATION_CONFIG' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for CONFIG intents (3)
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'conversion_rate_update'
WHERE intent_code = 'CONVERSION_RATE_UPDATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'equipment_maintenance'
WHERE intent_code = 'EQUIPMENT_MAINTENANCE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'rule_config'
WHERE intent_code = 'RULE_CONFIG' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for USER intents (3)
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'user_create'
WHERE intent_code = 'USER_CREATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'user_disable'
WHERE intent_code = 'USER_DISABLE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'user_role_assign'
WHERE intent_code = 'USER_ROLE_ASSIGN' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for FORM intents (1)
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'form_generation'
WHERE intent_code = 'FORM_GENERATION' AND tool_name IS NULL;

-- =====================================================
-- Populate tool_name for META intents (3)
-- =====================================================

UPDATE ai_intent_configs SET tool_name = 'intent_analyze'
WHERE intent_code = 'INTENT_ANALYZE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'intent_create'
WHERE intent_code = 'INTENT_CREATE' AND tool_name IS NULL;

UPDATE ai_intent_configs SET tool_name = 'intent_update'
WHERE intent_code = 'INTENT_UPDATE' AND tool_name IS NULL;

-- =====================================================
-- Summary
-- =====================================================
-- Total tool_name mappings: 91
-- - MATERIAL: 10
-- - QUALITY: 6
-- - SHIPMENT: 10
-- - CRM: 12
-- - HR: 9
-- - ALERT: 9
-- - SCALE: 6
-- - REPORT: 9
-- - DATA_OP: 5
-- - SYSTEM: 5 (excluding test intents)
-- - CONFIG: 3
-- - USER: 3
-- - FORM: 1
-- - META: 3
--
-- tool_name 优先级高于 handler_class
-- 当 tool_name 存在时，使用新的 Tool Calling 架构
-- 当 tool_name 为空时，回退到 handler_class (旧架构)
