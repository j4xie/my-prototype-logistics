-- 智能设备添加意图配置
-- 支持通过 AI 识别（拍照/语音）添加摄像头和电子秤设备

-- 添加摄像头设备意图
INSERT INTO ai_intent_configs (
    factory_id, intent_code, intent_name, intent_category,
    tool_name, description, keywords,
    semantic_domain, semantic_action, semantic_object,
    sensitivity_level, requires_confirmation, enabled,
    created_at, updated_at
) VALUES (
    'DEFAULT',
    'ISAPI_ADD_DEVICE',
    '添加摄像头设备',
    'DEVICE',
    'isapi_add_device',
    '通过 AI 识别添加海康威视摄像头设备，支持拍照识别设备标签或语音输入设备信息',
    '["添加摄像头", "新增摄像头", "配置摄像头", "摄像头设备", "海康威视", "ISAPI", "监控设备"]',
    'DEVICE',
    'CREATE',
    'CAMERA',
    'NORMAL',
    TRUE,
    TRUE,
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    description = VALUES(description),
    keywords = VALUES(keywords),
    updated_at = NOW();

-- 添加电子秤设备意图
INSERT INTO ai_intent_configs (
    factory_id, intent_code, intent_name, intent_category,
    tool_name, description, keywords,
    semantic_domain, semantic_action, semantic_object,
    sensitivity_level, requires_confirmation, enabled,
    created_at, updated_at
) VALUES (
    'DEFAULT',
    'SCALE_ADD_DEVICE',
    '添加电子秤设备',
    'DEVICE',
    'scale_add_device',
    '通过 AI 识别添加电子秤设备，支持拍照识别设备配置标签或语音输入设备信息',
    '["添加电子秤", "新增电子秤", "配置电子秤", "电子秤设备", "秤设备", "称重设备", "MODBUS", "IoT设备"]',
    'DEVICE',
    'CREATE',
    'SCALE',
    'NORMAL',
    TRUE,
    TRUE,
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    description = VALUES(description),
    keywords = VALUES(keywords),
    updated_at = NOW();

-- 查询设备列表意图
INSERT INTO ai_intent_configs (
    factory_id, intent_code, intent_name, intent_category,
    tool_name, description, keywords,
    semantic_domain, semantic_action, semantic_object,
    sensitivity_level, requires_confirmation, enabled,
    created_at, updated_at
) VALUES (
    'DEFAULT',
    'DEVICE_QUERY',
    '查询设备列表',
    'DEVICE',
    'device_query',
    '查询摄像头或电子秤设备列表，支持按类型、状态、名称等条件筛选',
    '["查看设备", "设备列表", "有哪些设备", "摄像头列表", "电子秤列表", "在线设备", "离线设备"]',
    'DEVICE',
    'QUERY',
    'DEVICE',
    'LOW',
    FALSE,
    TRUE,
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    description = VALUES(description),
    keywords = VALUES(keywords),
    updated_at = NOW();
