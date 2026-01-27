-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_25_01__add_order_and_delete_intents.sql
-- Conversion date: 2026-01-26 18:49:43
-- ============================================

-- =====================================================
-- V2026_01_25_01: Add ORDER and DELETE Intent Configurations
-- Purpose: AI Intent configs for order management and delete operations
-- @version 1.0.0
-- @since 2026-01-25
-- =====================================================

-- ============================================
-- ORDER 类意图 (订单管理)
-- ============================================

-- 1. 订单列表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ORDER_LIST', '订单列表', 'DATA_OP',
    'order_list', 'LOW', 1,
    '["订单", "订单列表", "查订单", "所有订单", "订单查询", "看订单", "订单情况", "订单记录", "订单明细", "查看订单"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "sales", "warehouse_manager"]', 90, '查询订单列表，支持按状态、日期、客户筛选',
    'DATA', 'QUERY', 'ORDER',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 2. 今日订单
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ORDER_TODAY', '今日订单', 'DATA_OP',
    'order_today', 'LOW', 1,
    '["今天订单", "今日订单", "今天的订单", "当天订单", "今天有什么订单", "今日订单情况", "今天接了多少单", "今天单子", "今天的单"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "sales", "warehouse_manager"]', 92, '查询今日订单列表和统计数据',
    'DATA', 'QUERY', 'ORDER',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 3. 订单状态
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ORDER_STATUS', '订单状态', 'DATA_OP',
    'order_status', 'LOW', 1,
    '["订单状态", "订单进度", "订单情况", "单子进度", "订单跟踪", "订单处理情况", "订单到哪了", "订单怎么样了", "查订单状态"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "sales", "warehouse_manager", "operator"]', 88, '查询订单处理状态和进度',
    'DATA', 'QUERY', 'ORDER',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 4. 删除订单 (需要审批)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    requires_approval, is_active, created_at, updated_at
) VALUES (
    UUID(), 'ORDER_DELETE', '删除订单', 'DATA_OP',
    'order_delete', 'CRITICAL', 3,
    '["删除订单", "作废订单", "取消订单", "移除订单", "删单", "废弃订单", "订单删除", "撤销订单", "删掉订单", "去掉订单"]',
    '["factory_super_admin", "department_admin"]', 95, '删除订单记录 (敏感操作，需要审批)',
    'DATA', 'DELETE', 'ORDER',
    TRUE, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    sensitivity_level = VALUES(sensitivity_level),
    requires_approval = VALUES(requires_approval),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- ============================================
-- DELETE 类意图 (敏感删除操作)
-- ============================================

-- 5. 删除用户 (CRITICAL, 需要审批)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    requires_approval, is_active, created_at, updated_at
) VALUES (
    UUID(), 'USER_DELETE', '删除用户', 'DATA_OP',
    'user_delete', 'CRITICAL', 3,
    '["删除用户", "移除用户", "删除账号", "禁用用户", "删用户", "用户删除", "去掉用户", "撤销用户", "删除员工账号"]',
    '["factory_super_admin", "platform_admin"]', 92, '删除系统用户账号 (敏感操作，需要审批)',
    'DATA', 'DELETE', 'USER',
    TRUE, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    sensitivity_level = VALUES(sensitivity_level),
    requires_approval = VALUES(requires_approval),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 6. 删除客户 (HIGH, 需要审批)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    requires_approval, is_active, created_at, updated_at
) VALUES (
    UUID(), 'CUSTOMER_DELETE', '删除客户', 'DATA_OP',
    'customer_delete', 'HIGH', 2,
    '["删除客户", "移除客户", "删客户", "客户删除", "去掉客户", "撤销客户", "删除客户信息", "客户移除"]',
    '["factory_super_admin", "department_admin", "sales"]', 90, '删除客户信息记录 (敏感操作，需要审批)',
    'DATA', 'DELETE', 'CUSTOMER',
    TRUE, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    sensitivity_level = VALUES(sensitivity_level),
    requires_approval = VALUES(requires_approval),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 7. 删除供应商 (HIGH, 需要审批)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    requires_approval, is_active, created_at, updated_at
) VALUES (
    UUID(), 'SUPPLIER_DELETE', '删除供应商', 'DATA_OP',
    'supplier_delete', 'HIGH', 2,
    '["删除供应商", "移除供应商", "删供应商", "供应商删除", "去掉供应商", "撤销供应商", "删除供货商", "供应商移除"]',
    '["factory_super_admin", "department_admin", "warehouse_manager"]', 90, '删除供应商信息记录 (敏感操作，需要审批)',
    'DATA', 'DELETE', 'SUPPLIER',
    TRUE, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    sensitivity_level = VALUES(sensitivity_level),
    requires_approval = VALUES(requires_approval),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 8. 删除设备 (HIGH, 需要审批)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    requires_approval, is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_DELETE', '删除设备', 'DATA_OP',
    'equipment_delete', 'HIGH', 2,
    '["删除设备", "移除设备", "删设备", "设备删除", "去掉设备", "撤销设备", "删除机器", "设备移除", "移除机器"]',
    '["factory_super_admin", "department_admin"]', 90, '删除设备信息记录 (敏感操作，需要审批)',
    'DATA', 'DELETE', 'EQUIPMENT',
    TRUE, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    sensitivity_level = VALUES(sensitivity_level),
    requires_approval = VALUES(requires_approval),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- ============================================
-- ORDER 域默认意图
-- ============================================

INSERT INTO ai_domain_default_intents (id, domain_name, primary_intent_code, secondary_intent_code)
VALUES (UUID(), 'ORDER', 'ORDER_LIST', 'ORDER_STATUS')
ON DUPLICATE KEY UPDATE
    primary_intent_code = VALUES(primary_intent_code),
    secondary_intent_code = VALUES(secondary_intent_code),
    updated_at = NOW();

-- =====================================================
-- Summary
-- =====================================================
-- Total intents added: 8
--
-- ORDER domain intents: 4
--   - ORDER_LIST (priority: 90, sensitivity: LOW)
--   - ORDER_TODAY (priority: 92, sensitivity: LOW)
--   - ORDER_STATUS (priority: 88, sensitivity: LOW)
--   - ORDER_DELETE (priority: 95, sensitivity: CRITICAL, requires_approval: TRUE)
--
-- DELETE operation intents: 4
--   - USER_DELETE (priority: 92, sensitivity: CRITICAL, requires_approval: TRUE)
--   - CUSTOMER_DELETE (priority: 90, sensitivity: HIGH, requires_approval: TRUE)
--   - SUPPLIER_DELETE (priority: 90, sensitivity: HIGH, requires_approval: TRUE)
--   - EQUIPMENT_DELETE (priority: 90, sensitivity: HIGH, requires_approval: TRUE)
--
-- Domain default intents: 1
--   - ORDER domain: primary=ORDER_LIST, secondary=ORDER_STATUS
--
-- Tool name mappings:
--   ORDER_LIST        -> order_list
--   ORDER_TODAY       -> order_today
--   ORDER_STATUS      -> order_status
--   ORDER_DELETE      -> order_delete
--   USER_DELETE       -> user_delete
--   CUSTOMER_DELETE   -> customer_delete
--   SUPPLIER_DELETE   -> supplier_delete
--   EQUIPMENT_DELETE  -> equipment_delete
