-- =====================================================
-- AI意图分类枚举配置
-- 将前端硬编码的分类迁移到数据库
-- V2026_01_09_01
-- =====================================================

-- INTENT_CATEGORY - AI意图分类 (13个分组)
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, icon, color, metadata) VALUES
-- 查询类
('enum-ic-001', '*', 'INTENT_CATEGORY', 'QUERY', '查询类', '数据查询相关意图', 1, 'magnify', '#1890ff', '{"subCategories": ["BATCH", "BATCH_QUERY", "MATERIAL_QUERY", "PLAN_QUERY", "EQUIPMENT_QUERY", "QUALITY_QUERY", "HR_QUERY"]}'),
-- 数据操作类
('enum-ic-002', '*', 'INTENT_CATEGORY', 'DATA_OP', '数据操作类', '数据增删改相关意图', 2, 'database-edit', '#52c41a', '{"subCategories": ["MATERIAL", "PROCESSING", "BATCH_UPDATE", "MATERIAL_UPDATE", "PLAN_UPDATE", "EQUIPMENT_UPDATE", "QUALITY_UPDATE", "HR_UPDATE"]}'),
-- 设备类
('enum-ic-003', '*', 'INTENT_CATEGORY', 'EQUIPMENT', '设备类', '设备管理相关意图', 3, 'cog', '#722ed1', '{"subCategories": ["SCALE", "CAMERA"]}'),
-- 出货类
('enum-ic-004', '*', 'INTENT_CATEGORY', 'SHIPMENT', '出货类', '出货物流相关意图', 4, 'truck-delivery', '#13c2c2', '{"subCategories": []}'),
-- 客户类
('enum-ic-005', '*', 'INTENT_CATEGORY', 'CRM', '客户类', '客户关系相关意图', 5, 'account-group', '#eb2f96', '{"subCategories": []}'),
-- 质量类
('enum-ic-006', '*', 'INTENT_CATEGORY', 'QUALITY', '质量类', '质量管理相关意图', 6, 'check-decagram', '#52c41a', '{"subCategories": []}'),
-- 人事类
('enum-ic-007', '*', 'INTENT_CATEGORY', 'HR', '人事类', '人事管理相关意图', 7, 'badge-account', '#fa8c16', '{"subCategories": []}'),
-- 报告/分析类
('enum-ic-008', '*', 'INTENT_CATEGORY', 'REPORT', '报告/分析类', '报告和数据分析相关意图', 8, 'chart-line', '#fa8c16', '{"subCategories": ["ANALYSIS", "COST_ANALYSIS", "TREND_ANALYSIS"]}'),
-- 告警类
('enum-ic-009', '*', 'INTENT_CATEGORY', 'ALERT', '告警类', '告警处理相关意图', 9, 'alert-circle', '#f5222d', '{"subCategories": ["ALERT_QUERY", "ALERT_UPDATE"]}'),
-- 表单类
('enum-ic-010', '*', 'INTENT_CATEGORY', 'FORM', '表单类', '表单操作相关意图', 10, 'form-select', '#722ed1', '{"subCategories": []}'),
-- 排程类
('enum-ic-011', '*', 'INTENT_CATEGORY', 'SCHEDULE', '排程类', '排程调度相关意图', 11, 'calendar-clock', '#fa8c16', '{"subCategories": []}'),
-- 系统/配置类
('enum-ic-012', '*', 'INTENT_CATEGORY', 'SYSTEM', '系统/配置类', '系统配置相关意图', 12, 'cog', '#8c8c8c', '{"subCategories": ["CONFIG", "USER", "PLATFORM", "META"]}'),
-- 其他
('enum-ic-013', '*', 'INTENT_CATEGORY', 'OTHER', '其他', '未分类意图', 99, 'help-circle', '#bfbfbf', '{"subCategories": ["FLOOR"]}')
ON DUPLICATE KEY UPDATE
    enum_label = VALUES(enum_label),
    enum_description = VALUES(enum_description),
    icon = VALUES(icon),
    color = VALUES(color),
    metadata = VALUES(metadata),
    updated_at = NOW();
