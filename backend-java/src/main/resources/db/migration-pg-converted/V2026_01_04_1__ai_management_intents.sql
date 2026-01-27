-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_04_1__ai_management_intents.sql
-- Conversion date: 2026-01-26 18:47:10
-- ============================================

-- AI 管理能力意图配置
-- 支持通过 AI 对话来管理工厂配置、用户、设备等
-- @version 1.0.0
-- @since 2026-01-04

-- ============================================
-- Phase 1: SYSTEM 类意图（排产设置 + 工厂配置）
-- ============================================

-- 排产设置 - 全自动模式
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCHEDULING_SET_AUTO', '排产全自动', 'SYSTEM',
    'HIGH', 2,
    '["排产全自动", "全自动排产", "自动排产", "开启自动排产", "排产自动化", "自动排程"]',
    '["factory_super_admin"]', 95, '将排产设置切换为全自动模式，低风险计划自动激活',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 排产设置 - 人工确认模式
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCHEDULING_SET_MANUAL', '排产人工确认', 'SYSTEM',
    'HIGH', 2,
    '["排产人工确认", "人工排产", "手动排产", "排产手动", "排产需确认", "人工确认排产"]',
    '["factory_super_admin"]', 95, '将排产设置切换为人工确认模式，所有计划需确认后激活',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 排产设置 - 禁用
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCHEDULING_SET_DISABLED', '禁用自动排产', 'SYSTEM',
    'HIGH', 2,
    '["禁用排产", "关闭排产", "停用排产", "关闭自动排产", "禁用自动排程"]',
    '["factory_super_admin"]', 95, '禁用自动排产功能',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 工厂功能开关
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'FACTORY_FEATURE_TOGGLE', '功能开关', 'SYSTEM',
    'HIGH', 2,
    '["启用功能", "禁用功能", "开启功能", "关闭功能", "功能开关", "开启AI", "关闭AI", "启用AI分析", "禁用AI分析"]',
    '["factory_super_admin"]', 90, '切换工厂功能开关（AI分析、质量告警等）',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 通知设置
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'FACTORY_NOTIFICATION_CONFIG', '通知设置', 'SYSTEM',
    'MEDIUM', 1,
    '["通知设置", "邮件通知", "短信通知", "推送通知", "开启通知", "关闭通知", "配置通知"]',
    '["factory_super_admin"]', 85, '配置通知渠道（邮件、短信、推送）',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- Phase 1: USER 类意图（用户管理）
-- ============================================

-- 创建用户
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'USER_CREATE', '创建用户', 'USER',
    'HIGH', 2,
    '["创建用户", "新建用户", "添加用户", "注册用户", "新增用户", "添加员工"]',
    '["factory_super_admin"]', 90, '创建新用户账户',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 禁用用户
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'USER_DISABLE', '禁用用户', 'USER',
    'HIGH', 2,
    '["禁用用户", "停用用户", "冻结用户", "暂停用户", "禁用账户", "停用账户"]',
    '["factory_super_admin"]', 90, '禁用用户账户',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 角色分配
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    requires_approval, is_active, created_at, updated_at
) VALUES (
    UUID(), 'USER_ROLE_ASSIGN', '角色分配', 'USER',
    'CRITICAL', 3,
    '["分配角色", "赋予角色", "设置角色", "更改角色", "修改角色", "授权角色"]',
    '["factory_super_admin"]', 95, '为用户分配角色',
    TRUE, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    requires_approval = VALUES(requires_approval),
    updated_at = NOW();

-- ============================================
-- Phase 1: CONFIG 类意图（设备/转换率/规则）
-- ============================================

-- 设备维护
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'EQUIPMENT_MAINTENANCE', '设备维护', 'CONFIG',
    'MEDIUM', 1,
    '["设备维护", "记录维护", "维护保养", "设备检修", "设备保养", "维护记录"]',
    '["factory_super_admin", "department_admin"]', 85, '记录设备维护信息',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 转换率配置
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CONVERSION_RATE_UPDATE', '转换率配置', 'CONFIG',
    'MEDIUM', 2,
    '["转换率", "转化率", "原料转换", "产出率", "配置转换率", "修改转换率"]',
    '["factory_super_admin"]', 85, '配置原材料转换率',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 规则配置
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'RULE_CONFIG', '规则配置', 'CONFIG',
    'HIGH', 2,
    '["规则配置", "业务规则", "创建规则", "修改规则", "配置规则", "设置规则"]',
    '["factory_super_admin"]', 90, '配置业务规则',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- Phase 2: META 类意图（自我扩展能力）
-- ============================================

-- 创建新意图
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    requires_approval, is_active, created_at, updated_at
) VALUES (
    UUID(), 'INTENT_CREATE', '创建AI意图', 'META',
    'CRITICAL', 5,
    '["创建意图", "添加意图", "我想用AI管理", "让AI能够", "配置新意图", "新增AI能力"]',
    '["factory_super_admin"]', 99, '创建新的AI意图配置（需要审批）',
    TRUE, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    requires_approval = VALUES(requires_approval),
    updated_at = NOW();

-- 更新意图
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'INTENT_UPDATE', '更新AI意图', 'META',
    'HIGH', 3,
    '["更新意图", "修改意图", "优化关键词", "调整意图", "改进意图"]',
    '["factory_super_admin"]', 95, '更新现有意图配置',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 分析意图使用
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'INTENT_ANALYZE', '分析意图使用', 'META',
    'LOW', 1,
    '["意图统计", "使用情况", "分析意图", "意图报表", "AI使用统计"]',
    '["factory_super_admin"]', 80, '分析意图使用情况',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 记录本次迁移
SELECT CONCAT('AI管理意图配置已添加: ', COUNT(*), ' 条记录') AS migration_result
FROM ai_intent_configs
WHERE intent_code IN (
    'SCHEDULING_SET_AUTO', 'SCHEDULING_SET_MANUAL', 'SCHEDULING_SET_DISABLED',
    'FACTORY_FEATURE_TOGGLE', 'FACTORY_NOTIFICATION_CONFIG',
    'USER_CREATE', 'USER_DISABLE', 'USER_ROLE_ASSIGN',
    'EQUIPMENT_MAINTENANCE', 'CONVERSION_RATE_UPDATE', 'RULE_CONFIG',
    'INTENT_CREATE', 'INTENT_UPDATE', 'INTENT_ANALYZE'
);
