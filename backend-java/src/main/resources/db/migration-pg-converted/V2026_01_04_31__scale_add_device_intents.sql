-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_04_31__scale_add_device_intents.sql
-- Conversion date: 2026-01-26 18:47:18
-- ============================================

-- Scale Device Addition Intent Configurations
-- AI Intent configs for adding IoT scale devices via natural language or image recognition
-- @version 1.0.0
-- @since 2026-01-04

-- ============================================
-- SCALE 设备添加意图 (自然语言 + 图片识别)
-- ============================================

-- 自然语言添加秤设备
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_ADD_DEVICE', '自然语言添加秤设备', 'SCALE',
    'MEDIUM', 3,
    '["添加设备", "新增电子秤", "配置新秤", "添加电子秤", "新装一台秤", "安装新秤", "添加称重设备", "新设备", "添加一台", "装新秤", "增加电子秤", "加一台秤", "新增称重", "配置设备", "接入新秤", "注册设备", "录入秤", "登记电子秤"]',
    '["factory_super_admin", "department_admin"]', 92, '通过自然语言描述快速添加新的 IoT 电子秤设备，支持自动识别品牌型号、位置、通信参数等',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 图片识别添加秤设备
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_ADD_DEVICE_VISION', '图片识别添加秤设备', 'SCALE',
    'HIGH', 5,
    '["拍照添加", "扫描添加", "识别设备", "拍照识别", "照片添加", "铭牌识别", "扫描铭牌", "拍设备", "识别铭牌", "扫码添加", "拍照录入", "图片识别", "上传照片", "识别图片", "看图添加", "扫描设备"]',
    '["factory_super_admin", "department_admin"]', 91, '通过拍摄设备铭牌或说明书照片，AI 自动识别并提取设备信息，快速完成设备添加',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 查看秤设备列表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_LIST_DEVICES', '查看秤设备列表', 'SCALE',
    'LOW', 1,
    '["秤列表", "设备列表", "有哪些秤", "查看秤", "秤设备", "电子秤列表", "所有秤", "设备清单", "称重设备列表", "IoT设备", "物联网秤"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 79, '查询工厂内已配置的 IoT 电子秤设备列表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 查看秤设备详情
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_DEVICE_DETAIL', '查看秤设备详情', 'SCALE',
    'LOW', 1,
    '["设备详情", "秤详情", "设备信息", "查看设备", "秤信息", "设备状态", "秤状态", "设备配置"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 76, '查看指定 IoT 电子秤设备的详细信息和当前状态',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 修改秤设备
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_UPDATE_DEVICE', '修改秤设备', 'SCALE',
    'MEDIUM', 2,
    '["修改设备", "更新秤", "编辑设备", "改设备", "调整秤", "修改秤", "更改设备", "设备改名", "移动秤位置", "更换协议"]',
    '["factory_super_admin", "department_admin"]', 84, '修改已有 IoT 电子秤设备的配置信息',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 删除秤设备
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SCALE_DELETE_DEVICE', '删除秤设备', 'SCALE',
    'HIGH', 1,
    '["删除设备", "移除秤", "删除秤", "拆除设备", "下线秤", "停用设备", "报废秤"]',
    '["factory_super_admin"]', 70, '删除或停用指定的 IoT 电子秤设备（需确认无使用记录）',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();
