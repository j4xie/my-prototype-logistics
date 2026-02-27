-- v31: 系统导航意图配置
-- 8 个新的 SYSTEM 类别意图，用于导航引导
-- 使用 ON CONFLICT (intent_code) DO NOTHING 避免重复插入

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'SYSTEM_PASSWORD_RESET',
    '密码修改',
    'SYSTEM',
    'LOW', 0, 0,
    false, true, 100,
    '引导用户修改密码',
    '["修改密码", "改密码", "重置密码", "忘记密码", "密码修改", "换密码"]'
) ON CONFLICT ON CONSTRAINT uk_intent_code_factory DO NOTHING;

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'SYSTEM_PROFILE_EDIT',
    '编辑个人信息',
    'SYSTEM',
    'LOW', 0, 0,
    false, true, 100,
    '引导用户编辑个人资料',
    '["编辑资料", "修改信息", "个人资料", "改头像", "改手机号", "改邮箱"]'
) ON CONFLICT ON CONSTRAINT uk_intent_code_factory DO NOTHING;

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'SYSTEM_HELP',
    '使用帮助',
    'SYSTEM',
    'LOW', 0, 0,
    false, true, 100,
    '提供系统使用帮助',
    '["帮助", "怎么用", "使用说明", "功能介绍", "你能做什么", "有什么功能"]'
) ON CONFLICT ON CONSTRAINT uk_intent_code_factory DO NOTHING;

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'SYSTEM_SETTINGS',
    '系统设置',
    'SYSTEM',
    'LOW', 0, 0,
    false, true, 100,
    '引导用户进入系统设置',
    '["系统设置", "设置", "偏好设置", "主题设置", "语言设置"]'
) ON CONFLICT ON CONSTRAINT uk_intent_code_factory DO NOTHING;

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'SYSTEM_PERMISSION_QUERY',
    '权限查询',
    'SYSTEM',
    'LOW', 0, 0,
    false, true, 100,
    '查询用户当前权限',
    '["我的权限", "权限查询", "能访问什么", "角色权限", "权限说明"]'
) ON CONFLICT ON CONSTRAINT uk_intent_code_factory DO NOTHING;

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'SYSTEM_NOTIFICATION',
    '通知设置',
    'SYSTEM',
    'LOW', 0, 0,
    false, true, 100,
    '引导用户配置通知',
    '["通知设置", "消息提醒", "开启通知", "关闭通知", "通知管理"]'
) ON CONFLICT ON CONSTRAINT uk_intent_code_factory DO NOTHING;

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'SYSTEM_SWITCH_FACTORY',
    '切换工厂',
    'SYSTEM',
    'LOW', 0, 0,
    false, true, 100,
    '引导用户切换工厂',
    '["切换工厂", "换工厂", "选择工厂", "工厂切换"]'
) ON CONFLICT ON CONSTRAINT uk_intent_code_factory DO NOTHING;

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, cache_ttl_minutes,
    requires_approval, is_active, priority,
    description, keywords
) VALUES (
    gen_random_uuid()::varchar,
    'SYSTEM_FEEDBACK',
    '意见反馈',
    'SYSTEM',
    'LOW', 0, 0,
    false, true, 100,
    '引导用户提交反馈',
    '["意见反馈", "提建议", "反馈问题", "投诉", "建议"]'
) ON CONFLICT ON CONSTRAINT uk_intent_code_factory DO NOTHING;
