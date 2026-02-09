-- =====================================================
-- V2026_01_08_04: Add Equipment Intent Configurations
-- Purpose: Configure AI intents for equipment management tools
-- Tools covered:
--   - equipment_list        - 查询设备列表
--   - equipment_detail      - 查询设备详情
--   - equipment_stats       - 获取设备统计
--   - equipment_start       - 启动设备
--   - equipment_stop        - 停止设备
--   - equipment_status_update - 更新设备状态
--   - equipment_alert_list  - 查询设备告警列表
--   - equipment_alert_acknowledge - 确认设备告警
--   - equipment_alert_resolve - 解决设备告警
--   - equipment_alert_stats - 设备告警统计
-- =====================================================

-- ============================================
-- EQUIPMENT 类意图（设备管理）
-- ============================================

-- 1. 查询设备列表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_LIST', '查询设备列表', 'EQUIPMENT',
    'LOW', 1,
    '["设备列表", "所有设备", "查看设备", "设备清单", "设备名单", "有哪些设备", "机器列表", "生产设备"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 85,
    '查询工厂设备列表，支持按状态、类型筛选',
    'equipment_list', 'DATA', 'QUERY', 'EQUIPMENT',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    tool_name = VALUES(tool_name),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 2. 查询设备详情
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_DETAIL', '查询设备详情', 'EQUIPMENT',
    'LOW', 1,
    '["设备详情", "设备信息", "设备参数", "设备规格", "查看设备信息", "设备状态", "某台设备"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator"]', 82,
    '查询指定设备的详细信息，包括参数、状态、维护记录',
    'equipment_detail', 'DATA', 'QUERY', 'EQUIPMENT',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    tool_name = VALUES(tool_name),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 3. 获取设备统计
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_STATS', '设备统计', 'EQUIPMENT',
    'LOW', 1,
    '["设备统计", "设备数量", "设备概况", "设备分析", "设备状态统计", "运行设备", "停机设备", "设备利用率"]',
    '["factory_super_admin", "department_admin"]', 80,
    '获取设备统计数据，包括在线/离线数量、运行状态分布、利用率等',
    'equipment_stats', 'DATA', 'ANALYZE', 'EQUIPMENT',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    tool_name = VALUES(tool_name),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 4. 启动设备
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_START', '启动设备', 'EQUIPMENT',
    'MEDIUM', 2,
    '["启动设备", "开启设备", "设备启动", "打开设备", "开机", "启动机器", "开启机器"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 88,
    '启动指定设备，将设备状态设置为运行中',
    'equipment_start', 'DATA', 'EXECUTE', 'EQUIPMENT',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    tool_name = VALUES(tool_name),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 5. 停止设备
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_STOP', '停止设备', 'EQUIPMENT',
    'MEDIUM', 2,
    '["停止设备", "关闭设备", "设备停止", "关机", "停机", "停止机器", "关闭机器"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 88,
    '停止指定设备，将设备状态设置为停机',
    'equipment_stop', 'DATA', 'EXECUTE', 'EQUIPMENT',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    tool_name = VALUES(tool_name),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 6. 更新设备状态
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_STATUS_UPDATE', '更新设备状态', 'EQUIPMENT',
    'MEDIUM', 2,
    '["更新设备状态", "修改设备状态", "设备状态变更", "设备维护", "设备保养", "设备故障", "设备维修"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 85,
    '更新设备状态，支持运行、停机、维护、故障等状态切换',
    'equipment_status_update', 'DATA', 'UPDATE', 'EQUIPMENT',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    tool_name = VALUES(tool_name),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- ============================================
-- EQUIPMENT 类意图（设备告警管理）
-- ============================================

-- 7. 查询设备告警列表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_ALERT_LIST', '设备告警列表', 'EQUIPMENT',
    'LOW', 1,
    '["设备告警", "设备告警列表", "设备报警", "设备异常", "设备故障告警", "查看设备告警", "机器告警"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 85,
    '查询设备告警列表，支持按设备、级别、状态筛选',
    'equipment_alert_list', 'DATA', 'QUERY', 'EQUIPMENT',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    tool_name = VALUES(tool_name),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 8. 确认设备告警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_ALERT_ACKNOWLEDGE', '确认设备告警', 'EQUIPMENT',
    'MEDIUM', 2,
    '["确认设备告警", "设备告警确认", "收到设备告警", "知道设备告警", "处理设备告警", "响应设备告警"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 88,
    '确认收到设备告警通知，开始处理',
    'equipment_alert_acknowledge', 'DATA', 'UPDATE', 'EQUIPMENT',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    tool_name = VALUES(tool_name),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 9. 解决设备告警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_ALERT_RESOLVE', '解决设备告警', 'EQUIPMENT',
    'MEDIUM', 2,
    '["解决设备告警", "设备告警解决", "设备告警已解决", "关闭设备告警", "设备故障已修复", "设备问题已解决"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 90,
    '标记设备告警为已解决状态',
    'equipment_alert_resolve', 'DATA', 'UPDATE', 'EQUIPMENT',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    tool_name = VALUES(tool_name),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 10. 设备告警统计
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_ALERT_STATS', '设备告警统计', 'EQUIPMENT',
    'LOW', 1,
    '["设备告警统计", "设备告警分析", "设备告警汇总", "设备告警数量", "设备告警趋势", "故障统计"]',
    '["factory_super_admin", "department_admin"]', 82,
    '查询设备告警统计数据，包括告警数量、类型分布、处理时效等',
    'equipment_alert_stats', 'DATA', 'ANALYZE', 'EQUIPMENT',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    tool_name = VALUES(tool_name),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- =====================================================
-- Summary
-- =====================================================
-- Total new intents: 10
-- Category: EQUIPMENT
--
-- Query intents (sensitivity: LOW):
--   - EQUIPMENT_LIST         (equipment_list)
--   - EQUIPMENT_DETAIL       (equipment_detail)
--   - EQUIPMENT_STATS        (equipment_stats)
--   - EQUIPMENT_ALERT_LIST   (equipment_alert_list)
--   - EQUIPMENT_ALERT_STATS  (equipment_alert_stats)
--
-- Operation intents (sensitivity: MEDIUM):
--   - EQUIPMENT_START        (equipment_start)
--   - EQUIPMENT_STOP         (equipment_stop)
--   - EQUIPMENT_STATUS_UPDATE (equipment_status_update)
--   - EQUIPMENT_ALERT_ACKNOWLEDGE (equipment_alert_acknowledge)
--   - EQUIPMENT_ALERT_RESOLVE (equipment_alert_resolve)
-- =====================================================
