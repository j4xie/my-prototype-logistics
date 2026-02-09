-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_08_03__add_processing_batch_intents.sql
-- Conversion date: 2026-01-26 18:47:55
-- ============================================

-- =====================================================
-- V2026_01_08_03: Add Processing Batch Intent Configurations
-- Purpose: AI Intent configs for production batch management
-- @version 1.0.0
-- @since 2026-01-08
-- =====================================================

-- ============================================
-- PROCESSING 类意图 (生产批次管理)
-- ============================================

-- 1. 创建生产批次
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_BATCH_CREATE', '创建生产批次', 'PROCESSING',
    'processing_batch_create', 'HIGH', 3,
    '["创建批次", "新建批次", "开始生产", "新增批次", "添加批次", "创建生产批次", "新建生产批次", "建一个批次", "开一个批次", "安排生产", "新批次", "开批次"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 85, '创建新的生产批次，包含产品类型、计划数量、工序等信息',
    'DATA', 'CREATE', 'BATCH',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 2. 查询生产批次列表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_BATCH_LIST', '查询生产批次列表', 'PROCESSING',
    'processing_batch_list', 'LOW', 1,
    '["批次列表", "所有批次", "查看批次", "生产批次", "批次查询", "有哪些批次", "今天的批次", "进行中的批次", "查看生产", "生产列表", "批次清单", "查批次", "批次情况"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "quality_inspector", "operator"]', 90, '查询工厂的生产批次列表，支持按状态、日期、产品类型筛选',
    'DATA', 'QUERY', 'BATCH',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 3. 查询批次详情
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_BATCH_DETAIL', '查询批次详情', 'PROCESSING',
    'processing_batch_detail', 'LOW', 1,
    '["批次详情", "批次信息", "查看详情", "批次数据", "批次情况", "批号详情", "这个批次", "批次参数", "查看批次详情", "批次进度"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "quality_inspector", "operator"]', 88, '查看指定生产批次的详细信息，包含产品、工序、进度等',
    'DATA', 'QUERY', 'BATCH',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 4. 开始生产批次
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_BATCH_START', '开始生产批次', 'PROCESSING',
    'processing_batch_start', 'HIGH', 2,
    '["开始批次", "启动批次", "开始生产", "启动生产", "批次开始", "开工", "开始做", "启动这个批次", "执行批次", "批次执行"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 80, '将指定批次状态更新为生产中，开始生产流程',
    'DATA', 'UPDATE', 'BATCH',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 5. 暂停生产批次
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_BATCH_PAUSE', '暂停生产批次', 'PROCESSING',
    'processing_batch_pause', 'HIGH', 2,
    '["暂停批次", "暂停生产", "批次暂停", "暂停一下", "停一下", "暂停这个批次", "中断生产", "批次中断", "先停", "暂时停止"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 78, '暂停指定生产批次，可以稍后恢复继续生产',
    'DATA', 'UPDATE', 'BATCH',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 6. 恢复生产批次
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_BATCH_RESUME', '恢复生产批次', 'PROCESSING',
    'processing_batch_resume', 'HIGH', 2,
    '["恢复批次", "恢复生产", "继续生产", "批次恢复", "继续批次", "恢复这个批次", "继续做", "重启批次", "再开始"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 78, '恢复已暂停的生产批次，继续生产流程',
    'DATA', 'UPDATE', 'BATCH',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 7. 完成生产批次
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_BATCH_COMPLETE', '完成生产批次', 'PROCESSING',
    'processing_batch_complete', 'HIGH', 2,
    '["完成批次", "完成生产", "批次完成", "结束批次", "结束生产", "批次结束", "做完了", "生产完成", "完工", "收工"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 80, '将指定批次标记为已完成，结束生产流程',
    'DATA', 'UPDATE', 'BATCH',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 8. 取消生产批次
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_BATCH_CANCEL', '取消生产批次', 'PROCESSING',
    'processing_batch_cancel', 'HIGH', 3,
    '["取消批次", "取消生产", "批次取消", "废弃批次", "撤销批次", "删除批次", "不做了", "取消这个批次", "作废"]',
    '["factory_super_admin", "department_admin"]', 75, '取消指定生产批次，批次将被标记为已取消状态',
    'DATA', 'UPDATE', 'BATCH',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 9. 查询批次时间线
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_BATCH_TIMELINE', '查询批次时间线', 'PROCESSING',
    'processing_batch_timeline', 'LOW', 1,
    '["批次时间线", "批次历史", "批次记录", "时间线", "批次进度", "操作记录", "批次轨迹", "生产记录", "批次日志", "状态变更记录"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "quality_inspector"]', 75, '查看生产批次的状态变更时间线和操作记录',
    'DATA', 'QUERY', 'BATCH',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 10. 查询批次员工
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_BATCH_WORKERS', '查询批次员工', 'PROCESSING',
    'processing_batch_workers', 'LOW', 1,
    '["批次员工", "谁在做", "批次人员", "参与人员", "谁负责", "工人列表", "人员分配", "批次工人", "这个批次谁做", "批次负责人"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "quality_inspector"]', 75, '查询参与指定生产批次的员工列表',
    'DATA', 'QUERY', 'USER',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 11. 分配员工到批次
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_WORKER_ASSIGN', '分配员工到批次', 'PROCESSING',
    'processing_worker_assign', 'HIGH', 2,
    '["分配员工", "安排人员", "派人", "分配人", "添加员工", "指派员工", "员工分配", "安排工人", "加人", "派工"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 78, '将员工分配到指定生产批次，包含工位和工序信息',
    'DATA', 'UPDATE', 'USER',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- 12. 员工签出批次
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    semantic_domain, semantic_action, semantic_object,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'PROCESSING_WORKER_CHECKOUT', '员工签出批次', 'PROCESSING',
    'processing_worker_checkout', 'MEDIUM', 2,
    '["员工签出", "签出", "下班", "离开批次", "退出批次", "移除员工", "员工离开", "取消分配", "撤出", "人员撤出"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator"]', 72, '员工从生产批次签出，记录工作时长和完成数量',
    'DATA', 'UPDATE', 'USER',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    semantic_domain = VALUES(semantic_domain),
    semantic_action = VALUES(semantic_action),
    semantic_object = VALUES(semantic_object),
    updated_at = NOW();

-- =====================================================
-- Summary
-- =====================================================
-- Total Processing Batch intents: 12
--
-- Query intents (LOW sensitivity): 4
--   - PROCESSING_BATCH_LIST (priority: 90)
--   - PROCESSING_BATCH_DETAIL (priority: 88)
--   - PROCESSING_BATCH_TIMELINE (priority: 75)
--   - PROCESSING_BATCH_WORKERS (priority: 75)
--
-- Write intents (HIGH sensitivity): 7
--   - PROCESSING_BATCH_CREATE (priority: 85)
--   - PROCESSING_BATCH_START (priority: 80)
--   - PROCESSING_BATCH_PAUSE (priority: 78)
--   - PROCESSING_BATCH_RESUME (priority: 78)
--   - PROCESSING_BATCH_COMPLETE (priority: 80)
--   - PROCESSING_BATCH_CANCEL (priority: 75)
--   - PROCESSING_WORKER_ASSIGN (priority: 78)
--
-- Checkout intent (MEDIUM sensitivity): 1
--   - PROCESSING_WORKER_CHECKOUT (priority: 72)
--
-- Tool name mappings:
--   PROCESSING_BATCH_CREATE  -> processing_batch_create
--   PROCESSING_BATCH_LIST    -> processing_batch_list
--   PROCESSING_BATCH_DETAIL  -> processing_batch_detail
--   PROCESSING_BATCH_START   -> processing_batch_start
--   PROCESSING_BATCH_PAUSE   -> processing_batch_pause
--   PROCESSING_BATCH_RESUME  -> processing_batch_resume
--   PROCESSING_BATCH_COMPLETE-> processing_batch_complete
--   PROCESSING_BATCH_CANCEL  -> processing_batch_cancel
--   PROCESSING_BATCH_TIMELINE-> processing_batch_timeline
--   PROCESSING_BATCH_WORKERS -> processing_batch_workers
--   PROCESSING_WORKER_ASSIGN -> processing_worker_assign
--   PROCESSING_WORKER_CHECKOUT-> processing_worker_checkout
