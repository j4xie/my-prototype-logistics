-- =====================================================
-- V2026_01_25_02: Phase 2 - Coverage Enhancement
-- Purpose: Add missing intents for high-risk, complex, and domain-specific queries
-- @version 1.0.0
-- @since 2026-01-25
-- =====================================================

-- ============================================
-- HIGH-RISK 操作意图 (敏感操作)
-- ============================================

-- 1. 清空库存 (CRITICAL, 需要审批)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    requires_approval, is_active, created_at, updated_at
) VALUES (
    UUID(), 'INVENTORY_CLEAR', '清空库存', 'DATA_OP',
    'inventory_clear', 'CRITICAL', 5,
    '["清空库存", "库存清零", "库存清空", "清除库存", "删除所有库存", "库存全部清除"]',
    '["factory_super_admin"]', 98, '清空所有库存数据 (极高风险操作，需要审批)',
    'INVENTORY', 'DELETE', 'INVENTORY',
    TRUE, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    sensitivity_level = VALUES(sensitivity_level),
    requires_approval = VALUES(requires_approval),
    updated_at = NOW();

-- 2. 批量删除数据 (CRITICAL, 需要审批)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    requires_approval, is_active, created_at, updated_at
) VALUES (
    UUID(), 'DATA_BATCH_DELETE', '批量删除数据', 'DATA_OP',
    'data_batch_delete', 'CRITICAL', 5,
    '["批量删除数据", "批量删除", "删除所有数据", "清除数据", "数据清理", "数据删除", "删除全部"]',
    '["factory_super_admin", "platform_admin"]', 97, '批量删除数据 (极高风险操作，需要审批)',
    'DATA', 'DELETE', 'DATA',
    TRUE, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    sensitivity_level = VALUES(sensitivity_level),
    requires_approval = VALUES(requires_approval),
    updated_at = NOW();

-- 3. 重置配置 (HIGH, 需要审批)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    requires_approval, is_active, created_at, updated_at
) VALUES (
    UUID(), 'CONFIG_RESET', '重置配置', 'SYSTEM',
    'config_reset', 'HIGH', 3,
    '["重置配置", "配置重置", "恢复默认配置", "初始化配置", "配置初始化", "重置设置", "恢复默认设置"]',
    '["factory_super_admin", "platform_admin"]', 95, '重置系统配置为默认值 (高风险操作，需要审批)',
    'SYSTEM', 'UPDATE', 'CONFIG',
    TRUE, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    sensitivity_level = VALUES(sensitivity_level),
    requires_approval = VALUES(requires_approval),
    updated_at = NOW();

-- ============================================
-- COMPLEX 复杂查询意图
-- ============================================

-- 4. 按条件筛选订单
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ORDER_FILTER', '订单条件查询', 'DATA_OP',
    'order_filter', 'LOW', 1,
    '["销售额超过", "金额大于", "订单金额", "本月订单", "上月订单", "订单筛选", "条件查订单", "符合条件的订单"]',
    '["factory_super_admin", "department_admin", "sales", "warehouse_manager"]', 88, '按条件筛选订单（支持金额、日期、状态等条件）',
    'ORDER', 'QUERY', 'ORDER',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 5. 按部门统计考勤
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ATTENDANCE_STATS_BY_DEPT', '部门考勤统计', 'REPORT',
    'attendance_stats_by_dept', 'LOW', 1,
    '["按部门统计考勤", "部门考勤统计", "各部门考勤", "部门考勤情况", "部门出勤率", "分部门考勤", "部门考勤报表"]',
    '["factory_super_admin", "department_admin", "hr_admin"]', 89, '按部门维度统计考勤数据',
    'ATTENDANCE', 'QUERY', 'ATTENDANCE',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- DOMAIN 领域特定意图
-- ============================================

-- 6. 冷链温度监控
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'COLD_CHAIN_TEMPERATURE', '冷链温度监控', 'DATA_OP',
    'cold_chain_temperature', 'LOW', 1,
    '["冷链温度", "温度监控", "冷库温度", "冷藏温度", "冷链监控", "温度记录", "温度数据", "冷链数据"]',
    '["factory_super_admin", "department_admin", "warehouse_manager", "quality_inspector"]', 90, '查询冷链温度监控数据',
    'EQUIPMENT', 'QUERY', 'TEMPERATURE',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- TYPO 拼写错误容错 (通过关键词补充)
-- ============================================

-- 7. 更新考勤历史的关键词（包含常见拼写错误）
UPDATE ai_intent_configs
SET keywords = '["考勤记录", "考勤历史", "打卡记录", "出勤记录", "签到记录", "考琴记录", "考勤纪录", "烤勤记录"]',
    updated_at = NOW()
WHERE intent_code = 'ATTENDANCE_HISTORY';

-- =====================================================
-- Summary
-- =====================================================
-- Total new intents: 6
--
-- HIGH-RISK intents: 3
--   - INVENTORY_CLEAR (priority: 98, sensitivity: CRITICAL)
--   - DATA_BATCH_DELETE (priority: 97, sensitivity: CRITICAL)
--   - CONFIG_RESET (priority: 95, sensitivity: HIGH)
--
-- COMPLEX query intents: 2
--   - ORDER_FILTER (priority: 88, sensitivity: LOW)
--   - ATTENDANCE_STATS_BY_DEPT (priority: 89, sensitivity: LOW)
--
-- DOMAIN-specific intents: 1
--   - COLD_CHAIN_TEMPERATURE (priority: 90, sensitivity: LOW)
--
-- TYPO tolerance: 1 update
--   - ATTENDANCE_HISTORY keywords updated
