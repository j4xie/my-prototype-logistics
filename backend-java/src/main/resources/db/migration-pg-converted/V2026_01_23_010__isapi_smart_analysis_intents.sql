-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_23_010__isapi_smart_analysis_intents.sql
-- Conversion date: 2026-01-26 18:49:29
-- ============================================

-- ISAPI Smart Analysis Intent Configurations
-- AI Intent configs for ISAPI smart analysis (Line Detection, Field Detection, Detection Events)
-- @version 1.0.0
-- @since 2026-01-23

-- ============================================
-- ISAPI 智能分析意图 (摄像头行为分析配置)
-- ============================================

-- 配置行为检测 (越界检测/警戒线)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ISAPI_CONFIG_LINE_DETECTION', '配置行为检测', 'ISAPI_SMART',
    'MEDIUM', 2,
    '["配置行为检测", "行为检测", "越界检测", "警戒线", "越线检测", "配置越界", "设置越界检测", "添加警戒线", "虚拟警戒线", "设置行为分析", "行为分析配置", "配置警戒线", "越界报警", "跨线检测", "划线检测", "设置越线", "配置越线检测", "开启越界检测", "启用行为检测", "设置检测线"]',
    '["factory_super_admin", "department_admin"]', 86, '配置摄像头越界检测/虚拟警戒线规则，用于行为分析告警',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 配置区域入侵检测
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ISAPI_CONFIG_FIELD_DETECTION', '配置区域入侵', 'ISAPI_SMART',
    'MEDIUM', 2,
    '["配置区域入侵", "区域入侵", "入侵检测", "区域检测", "配置入侵检测", "设置入侵区域", "入侵报警", "区域布防", "设置禁区", "配置禁区", "入侵告警", "区域告警", "设置检测区域", "划定检测区域", "配置区域告警", "开启入侵检测", "启用区域检测", "设置入侵检测区域", "智能区域检测", "区域防护"]',
    '["factory_super_admin", "department_admin"]', 86, '配置摄像头区域入侵检测规则，用于禁区入侵告警',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 查询检测事件
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ISAPI_QUERY_DETECTION_EVENTS', '查询检测事件', 'ISAPI_SMART',
    'LOW', 1,
    '["查询检测事件", "检测事件", "智能分析事件", "入侵事件", "越界事件", "行为分析记录", "智能分析配置", "智能分析记录", "智能检测记录", "检测告警记录", "行为告警", "行为事件", "越界告警记录", "入侵告警记录", "智能告警", "检测报警", "智能分析报警", "查看检测记录", "检测日志", "智能检测事件"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "quality_inspector", "operator"]', 85, '查询摄像头智能分析检测事件记录（越界、入侵等）',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 添加负面关键词以避免误匹配
INSERT INTO ai_intent_negative_keywords (intent_code, negative_keyword, created_at)
SELECT 'ISAPI_CONFIG_LINE_DETECTION', keyword, NOW()
FROM (SELECT '查询' AS keyword UNION SELECT '列表' UNION SELECT '记录' UNION SELECT '历史') t
WHERE NOT EXISTS (
    SELECT 1 FROM ai_intent_negative_keywords
    WHERE intent_code = 'ISAPI_CONFIG_LINE_DETECTION' AND negative_keyword = keyword
);

INSERT INTO ai_intent_negative_keywords (intent_code, negative_keyword, created_at)
SELECT 'ISAPI_CONFIG_FIELD_DETECTION', keyword, NOW()
FROM (SELECT '查询' AS keyword UNION SELECT '列表' UNION SELECT '记录' UNION SELECT '历史') t
WHERE NOT EXISTS (
    SELECT 1 FROM ai_intent_negative_keywords
    WHERE intent_code = 'ISAPI_CONFIG_FIELD_DETECTION' AND negative_keyword = keyword
);
