-- Scale Intent Configurations
-- AI Intent configs for scale/weighing equipment management
-- @version 1.0.0
-- @since 2026-01-04

-- ============================================
-- SCALE 类意图 (秤设备管理)
-- ============================================

-- 添加秤型号
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_ADD_MODEL', '添加秤型号', 'SCALE',
    'MEDIUM', 2,
    '["添加秤", "新增秤", "配置秤", "注册秤", "电子秤", "柯力", "耀华", "矽策", "英展", "梅特勒", "托利多", "添加型号", "新秤型号", "注册电子秤", "添加称重设备"]',
    '["factory_super_admin", "department_admin"]', 88, '添加新的秤品牌型号配置，用于设备注册时选择',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 协议自动识别
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_PROTOCOL_DETECT', '协议自动识别', 'SCALE',
    'LOW', 1,
    '["识别协议", "协议类型", "解析数据", "数据格式", "自动识别", "协议检测", "识别数据", "什么协议", "协议分析", "数据协议", "串口数据"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 85, '自动识别秤数据使用的通信协议，支持16进制样本数据输入',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- AI生成秤配置
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_CONFIG_GENERATE', 'AI生成秤配置', 'SCALE',
    'MEDIUM', 3,
    '["生成配置", "配置协议", "协议配置", "帧格式", "数据格式配置", "自动配置", "生成协议", "创建协议", "新建协议", "协议模板"]',
    '["factory_super_admin", "department_admin"]', 82, '根据用户描述的协议格式需求，AI自动生成秤协议配置',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 秤故障排查
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_TROUBLESHOOT', '秤故障排查', 'SCALE',
    'LOW', 1,
    '["故障排查", "秤故障", "无数据", "收不到数据", "乱码", "解析失败", "数据错误", "连接失败", "超时", "不稳定", "跳动", "波动", "通信异常", "秤不工作", "称重问题"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator"]', 90, '根据故障现象提供秤设备排查步骤和解决建议',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 列出可用协议
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_LIST_PROTOCOLS', '列出可用协议', 'SCALE',
    'LOW', 1,
    '["协议列表", "有哪些协议", "支持什么协议", "可用协议", "查看协议", "所有协议", "协议清单", "支持的协议"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 80, '列出工厂可用的秤通信协议列表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 测试数据解析
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_TEST_PARSE', '测试数据解析', 'SCALE',
    'LOW', 1,
    '["测试解析", "解析测试", "测试数据", "验证协议", "测试协议", "解析数据", "试一下解析", "解析看看"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 83, '使用指定协议测试解析秤数据，验证协议配置是否正确',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- 秤品牌型号查询相关意图
-- ============================================

-- 搜索秤型号
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_SEARCH_MODEL', '搜索秤型号', 'SCALE',
    'LOW', 1,
    '["搜索秤", "查找秤", "找秤", "秤型号", "有什么秤", "推荐秤", "哪款秤", "秤选型"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 78, '搜索和查询可用的秤品牌型号',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 查看秤详情
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_MODEL_DETAIL', '查看秤详情', 'SCALE',
    'LOW', 1,
    '["秤详情", "秤参数", "秤规格", "型号详情", "秤信息"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 75, '查看秤型号的详细参数和规格',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();
