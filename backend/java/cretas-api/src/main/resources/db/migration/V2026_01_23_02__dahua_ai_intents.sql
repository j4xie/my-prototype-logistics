-- Dahua Camera AI Intent Configurations
-- AI Intent configs for Dahua camera/NVR device management
-- Includes: Device Discovery, Smart Analysis Config, Device Management, Device Provisioning
-- @version 1.0.0
-- @since 2026-01-23

-- ============================================
-- DAHUA 类意图 (大华摄像头设备管理)
-- ============================================

-- 大华设备发现 - 自动发现局域网内的大华摄像头设备
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'DAHUA_DEVICE_DISCOVERY', '大华设备发现', 'CAMERA',
    'LOW', 1,
    '["大华发现", "发现大华", "扫描大华", "搜索大华摄像头", "大华设备搜索", "dahua发现", "大华摄像头扫描", "发现大华设备", "大华设备发现", "局域网大华", "扫描大华设备", "搜索大华设备", "大华自动发现", "大华摄像头搜索", "发现大华摄像头"]',
    '["factory_super_admin", "department_admin"]', 88, '自动发现局域网内的大华摄像头设备，支持Dahua协议自动搜索',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 大华智能分析配置 - 配置大华摄像头智能分析功能
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'DAHUA_SMART_CONFIG', '大华智能分析配置', 'CAMERA',
    'MEDIUM', 2,
    '["大华越界检测", "大华入侵检测", "大华智能分析", "配置大华摄像头", "大华人脸检测", "大华行为分析", "大华IVS", "大华智能配置", "设置大华检测", "大华区域入侵", "大华警戒线", "大华智能告警", "大华检测配置", "大华智能功能", "大华AI分析", "配置大华智能", "大华绊线检测", "大华徘徊检测", "大华物品遗留", "大华车牌识别"]',
    '["factory_super_admin", "department_admin"]', 86, '配置大华摄像头智能分析功能，支持越界检测、入侵检测、人脸检测等',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 大华设备管理 - 管理大华摄像头设备
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'DAHUA_DEVICE_MANAGE', '大华设备管理', 'CAMERA',
    'MEDIUM', 2,
    '["大华设备列表", "添加大华设备", "大华摄像头", "大华抓拍", "大华视频流", "大华设备管理", "管理大华", "删除大华设备", "修改大华设备", "大华NVR", "大华录像机", "大华通道", "大华设备信息", "大华设备状态", "大华在线状态", "大华设备详情", "查看大华", "大华设备查询", "大华摄像机", "大华IPC"]',
    '["factory_super_admin", "department_admin"]', 87, '管理大华摄像头/NVR设备，支持添加、删除、修改、抓拍、获取视频流等操作',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 大华设备配网 - 配置大华摄像头网络/首次激活
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'DAHUA_DEVICE_PROVISION', '大华设备配网', 'CAMERA',
    'HIGH', 3,
    '["大华配网", "大华激活", "配置大华IP", "初始化大华", "大华首次设置", "大华设备激活", "激活大华摄像头", "大华网络配置", "大华IP设置", "大华初始配置", "大华设备初始化", "新大华设备", "大华出厂设置", "大华修改密码", "大华设置密码", "配置大华网络", "大华DHCP", "大华静态IP"]',
    '["factory_super_admin", "department_admin"]', 85, '配置大华摄像头网络设置，包括设备激活、IP配置、密码设置等首次配置操作',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- 负面关键词配置 (避免误匹配)
-- ============================================

-- 大华设备发现 - 排除管理、配置类关键词
INSERT INTO ai_intent_negative_keywords (intent_code, negative_keyword, created_at)
SELECT 'DAHUA_DEVICE_DISCOVERY', keyword, NOW()
FROM (SELECT '配置' AS keyword UNION SELECT '设置' UNION SELECT '删除' UNION SELECT '修改' UNION SELECT '激活') t
WHERE NOT EXISTS (
    SELECT 1 FROM ai_intent_negative_keywords
    WHERE intent_code = 'DAHUA_DEVICE_DISCOVERY' AND negative_keyword = keyword
);

-- 大华智能分析配置 - 排除设备管理类关键词
INSERT INTO ai_intent_negative_keywords (intent_code, negative_keyword, created_at)
SELECT 'DAHUA_SMART_CONFIG', keyword, NOW()
FROM (SELECT '列表' AS keyword UNION SELECT '发现' UNION SELECT '搜索' UNION SELECT '扫描' UNION SELECT '激活' UNION SELECT '配网') t
WHERE NOT EXISTS (
    SELECT 1 FROM ai_intent_negative_keywords
    WHERE intent_code = 'DAHUA_SMART_CONFIG' AND negative_keyword = keyword
);

-- 大华设备配网 - 排除查询类关键词
INSERT INTO ai_intent_negative_keywords (intent_code, negative_keyword, created_at)
SELECT 'DAHUA_DEVICE_PROVISION', keyword, NOW()
FROM (SELECT '查询' AS keyword UNION SELECT '列表' UNION SELECT '发现' UNION SELECT '搜索' UNION SELECT '扫描') t
WHERE NOT EXISTS (
    SELECT 1 FROM ai_intent_negative_keywords
    WHERE intent_code = 'DAHUA_DEVICE_PROVISION' AND negative_keyword = keyword
);
