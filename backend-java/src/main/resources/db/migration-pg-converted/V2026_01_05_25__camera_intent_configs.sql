-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_05_25__camera_intent_configs.sql
-- Conversion date: 2026-01-26 18:47:36
-- ============================================

-- Camera/ISAPI Intent Configurations
-- AI Intent configs for Hikvision camera/NVR device management
-- @version 1.0.0
-- @since 2026-01-05

-- ============================================
-- CAMERA 类意图 (摄像头设备管理)
-- ============================================

-- 添加摄像头
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_ADD', '添加摄像头', 'CAMERA',
    'MEDIUM', 2,
    '["添加摄像头", "新增摄像头", "配置摄像头", "添加监控", "接入摄像头", "添加海康", "添加IPC", "新增监控设备", "添加NVR", "接入监控", "安装摄像头", "添加一个摄像头", "新增海康设备", "接入海康"]',
    '["factory_super_admin", "department_admin"]', 88, '添加新的摄像头/NVR设备，支持海康威视ISAPI协议',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 查看摄像头列表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_LIST', '查看摄像头列表', 'CAMERA',
    'LOW', 1,
    '["摄像头列表", "有哪些摄像头", "查看摄像头", "所有摄像头", "监控列表", "设备列表", "查看监控", "列出摄像头", "摄像头清单", "有多少摄像头", "监控设备列表"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "quality_inspector", "operator"]', 90, '列出工厂中的所有摄像头设备及其状态',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 摄像头详情
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_DETAIL', '摄像头详情', 'CAMERA',
    'LOW', 1,
    '["摄像头详情", "查看摄像头信息", "摄像头参数", "设备详情", "监控详情", "设备信息", "摄像头配置", "查看设备"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "quality_inspector", "operator"]', 85, '查看指定摄像头的详细配置和状态信息',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 抓拍图片
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_CAPTURE', '抓拍图片', 'CAMERA',
    'MEDIUM', 2,
    '["抓拍", "截图", "拍照", "抓图", "拍一张", "抓拍车间", "抓拍入口", "截个图", "拍张照", "抓拍图片", "实时抓拍", "监控截图", "抓拍画面"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 87, '从摄像头抓拍当前画面图片',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 订阅告警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_SUBSCRIBE', '订阅摄像头告警', 'CAMERA',
    'MEDIUM', 2,
    '["订阅告警", "开启监控", "监控摄像头", "开启告警", "订阅监控", "启用告警", "开始监控", "接收告警", "监控所有摄像头", "订阅所有告警"]',
    '["factory_super_admin", "department_admin"]', 86, '订阅摄像头的实时告警事件推送',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 取消订阅告警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_UNSUBSCRIBE', '取消订阅告警', 'CAMERA',
    'MEDIUM', 2,
    '["取消订阅", "关闭监控", "停止告警", "取消告警", "关闭告警", "停止监控", "不再接收告警"]',
    '["factory_super_admin", "department_admin"]', 85, '取消摄像头的告警事件订阅',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 查看告警记录
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_EVENTS', '查看告警记录', 'CAMERA',
    'LOW', 1,
    '["告警记录", "摄像头告警", "今天告警", "查看告警", "告警历史", "最近告警", "告警列表", "有什么告警", "监控告警", "事件记录", "告警事件"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "quality_inspector", "operator"]', 89, '查看摄像头的告警事件记录',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 设备状态
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_STATUS', '摄像头状态', 'CAMERA',
    'LOW', 1,
    '["摄像头状态", "设备在线", "连接状态", "监控状态", "设备状态", "在线状态", "离线设备", "故障设备", "状态汇总", "摄像头是否在线"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "quality_inspector", "operator"]', 88, '查看摄像头设备的在线状态和连接情况',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 获取流地址
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_STREAMS', '获取流地址', 'CAMERA',
    'LOW', 1,
    '["流地址", "视频地址", "RTSP地址", "直播地址", "播放地址", "预览地址", "实时视频", "看视频", "看监控"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 84, '获取摄像头的RTSP流媒体播放地址',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 测试连接
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_TEST_CONNECTION', '测试摄像头连接', 'CAMERA',
    'LOW', 1,
    '["测试连接", "连接测试", "检查连接", "测试摄像头", "验证连接", "连通性测试", "ping摄像头"]',
    '["factory_super_admin", "department_admin"]', 82, '测试摄像头设备的网络连接是否正常',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 同步设备信息
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CAMERA_SYNC', '同步摄像头信息', 'CAMERA',
    'LOW', 1,
    '["同步设备", "刷新信息", "同步摄像头", "更新设备信息", "获取设备信息", "同步通道"]',
    '["factory_super_admin", "department_admin"]', 80, '从摄像头设备同步最新的配置和通道信息',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();
