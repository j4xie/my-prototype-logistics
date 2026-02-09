-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_04_3__p1_intent_configs.sql
-- Conversion date: 2026-01-26 18:47:19
-- ============================================

-- P1 意图配置 - 报表、告警、人事考勤、客户供应商
-- Phase 4: AI Intent Extension - P1 Priority
-- @version 1.0.0
-- @since 2026-01-04

-- ============================================
-- REPORT 类意图（报表生成）
-- ============================================

-- 仪表盘总览
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'REPORT_DASHBOARD_OVERVIEW', '仪表盘总览', 'REPORT',
    'LOW', 1,
    '["仪表盘", "总览", "首页数据", "工厂概况", "今日概况", "运营总览"]',
    '["factory_super_admin", "department_admin"]', 85, '获取工厂仪表盘总览数据',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 生产报表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'REPORT_PRODUCTION', '生产报表', 'REPORT',
    'LOW', 1,
    '["生产报表", "产量统计", "生产统计", "产出报表", "生产数据", "产量报告"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 85, '生成生产相关统计报表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 质量报表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'REPORT_QUALITY', '质量报表', 'REPORT',
    'LOW', 1,
    '["质量报表", "质量统计", "合格率报表", "质检报告", "质量分析报告"]',
    '["factory_super_admin", "quality_inspector", "department_admin"]', 85, '生成质量检测统计报表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 库存报表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'REPORT_INVENTORY', '库存报表', 'REPORT',
    'LOW', 1,
    '["库存报表", "库存统计", "原料报表", "成品库存", "库存盘点报告"]',
    '["factory_super_admin", "department_admin"]', 82, '生成库存统计报表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 财务报表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'REPORT_FINANCE', '财务报表', 'REPORT',
    'MEDIUM', 2,
    '["财务报表", "成本报表", "收支统计", "成本分析", "财务分析"]',
    '["factory_super_admin"]', 80, '生成财务成本分析报表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 效率分析报表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'REPORT_EFFICIENCY', '效率分析报表', 'REPORT',
    'LOW', 1,
    '["效率报表", "效率分析", "产能分析", "OEE分析", "设备效率"]',
    '["factory_super_admin", "department_admin"]', 82, '生成生产效率分析报表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- KPI指标报表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'REPORT_KPI', 'KPI指标报表', 'REPORT',
    'LOW', 1,
    '["KPI", "绩效指标", "关键指标", "考核指标", "目标完成"]',
    '["factory_super_admin", "department_admin"]', 80, '生成KPI绩效指标报表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 异常报表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'REPORT_ANOMALY', '异常报表', 'REPORT',
    'MEDIUM', 1,
    '["异常报表", "异常统计", "问题汇总", "异常分析", "告警统计"]',
    '["factory_super_admin", "department_admin"]', 85, '生成异常问题统计报表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 趋势报表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'REPORT_TRENDS', '趋势报表', 'REPORT',
    'LOW', 1,
    '["趋势分析", "趋势报表", "走势图", "变化趋势", "历史趋势"]',
    '["factory_super_admin", "department_admin"]', 80, '生成趋势分析报表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- ALERT 类意图（告警智能分级）
-- ============================================

-- 告警列表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ALERT_LIST', '告警列表', 'ALERT',
    'LOW', 1,
    '["告警列表", "查看告警", "设备告警", "告警记录", "所有告警"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 85, '查询设备告警列表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 活跃告警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ALERT_ACTIVE', '活跃告警', 'ALERT',
    'LOW', 1,
    '["活跃告警", "当前告警", "未处理告警", "待处理告警", "未解决告警"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 88, '查询当前活跃未处理的告警',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 告警统计
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ALERT_STATS', '告警统计', 'ALERT',
    'LOW', 1,
    '["告警统计", "告警分析", "告警汇总", "告警数量", "告警趋势"]',
    '["factory_super_admin", "department_admin"]', 82, '查询告警统计数据',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 确认告警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ALERT_ACKNOWLEDGE', '确认告警', 'ALERT',
    'MEDIUM', 2,
    '["确认告警", "处理告警", "告警确认", "知道了", "收到告警"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 88, '确认收到告警通知',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 解决告警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ALERT_RESOLVE', '解决告警', 'ALERT',
    'MEDIUM', 2,
    '["解决告警", "告警已解决", "关闭告警", "问题已修复", "故障已排除"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 90, '标记告警为已解决',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 告警分级
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ALERT_TRIAGE', '告警分级', 'ALERT',
    'LOW', 2,
    '["告警分级", "智能分级", "告警优先级", "紧急告警", "重要告警"]',
    '["factory_super_admin", "department_admin"]', 88, '智能分析告警优先级和处理顺序',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 告警诊断
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ALERT_DIAGNOSE', '告警诊断', 'ALERT',
    'MEDIUM', 3,
    '["告警诊断", "故障诊断", "问题分析", "原因分析", "故障原因"]',
    '["factory_super_admin", "department_admin"]', 90, '智能分析告警原因并给出处理建议',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 按设备告警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ALERT_BY_EQUIPMENT', '按设备告警', 'ALERT',
    'LOW', 1,
    '["设备告警", "某设备告警", "查看设备告警", "设备故障记录"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 82, '按设备查询告警记录',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 按级别告警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ALERT_BY_LEVEL', '按级别告警', 'ALERT',
    'LOW', 1,
    '["严重告警", "警告级别", "信息告警", "紧急告警", "高级别告警"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 82, '按告警级别筛选告警',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- HR 类意图（人事/考勤）
-- ============================================

-- 打卡状态
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ATTENDANCE_STATUS', '打卡状态', 'HR',
    'LOW', 1,
    '["打卡状态", "今天打卡了吗", "上班打卡", "考勤状态", "我打卡了吗"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator", "quality_inspector"]', 85, '查询当前打卡状态',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 考勤历史
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ATTENDANCE_HISTORY', '考勤历史', 'HR',
    'LOW', 1,
    '["考勤历史", "打卡记录", "历史考勤", "考勤查询", "打卡历史"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator", "quality_inspector"]', 82, '查询考勤历史记录',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 考勤统计
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ATTENDANCE_STATS', '考勤统计', 'HR',
    'LOW', 1,
    '["考勤统计", "出勤统计", "迟到次数", "早退次数", "缺勤统计"]',
    '["factory_super_admin", "department_admin"]', 82, '查询考勤统计数据',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 月度考勤
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ATTENDANCE_MONTHLY', '月度考勤', 'HR',
    'LOW', 1,
    '["月度考勤", "本月考勤", "月考勤报表", "月度出勤", "这个月考勤"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator", "quality_inspector"]', 80, '查询月度考勤记录',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 考勤异常
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ATTENDANCE_ANOMALY', '考勤异常', 'HR',
    'MEDIUM', 1,
    '["考勤异常", "迟到记录", "早退记录", "缺勤记录", "异常考勤"]',
    '["factory_super_admin", "department_admin"]', 85, '查询考勤异常记录',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 部门考勤
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ATTENDANCE_DEPARTMENT', '部门考勤', 'HR',
    'LOW', 1,
    '["部门考勤", "团队考勤", "部门出勤", "部门考勤统计"]',
    '["factory_super_admin", "department_admin"]', 82, '查询部门考勤统计',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 今日打卡记录
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'ATTENDANCE_TODAY', '今日打卡记录', 'HR',
    'LOW', 1,
    '["今天考勤", "今日打卡", "今天打卡记录", "今日出勤"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator", "quality_inspector"]', 85, '查询今天的打卡记录',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 上班打卡
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CLOCK_IN', '上班打卡', 'HR',
    'MEDIUM', 1,
    '["上班打卡", "打卡上班", "签到", "上班签到", "开始上班"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator", "quality_inspector"]', 90, '执行上班打卡',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 下班打卡
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CLOCK_OUT', '下班打卡', 'HR',
    'MEDIUM', 1,
    '["下班打卡", "打卡下班", "签退", "下班签退", "结束上班"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator", "quality_inspector"]', 90, '执行下班打卡',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- CRM 类意图（客户/供应商）
-- ============================================

-- 客户列表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CUSTOMER_LIST', '客户列表', 'CRM',
    'LOW', 1,
    '["客户列表", "所有客户", "客户名单", "查看客户", "客户清单"]',
    '["factory_super_admin", "department_admin"]', 82, '查询客户列表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 客户搜索
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CUSTOMER_SEARCH', '客户搜索', 'CRM',
    'LOW', 1,
    '["查询客户", "搜索客户", "找客户", "客户信息", "客户详情"]',
    '["factory_super_admin", "department_admin"]', 85, '按条件搜索客户',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 客户统计
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CUSTOMER_STATS', '客户统计', 'CRM',
    'LOW', 1,
    '["客户统计", "客户分析", "客户数量", "客户分布", "客户类型统计"]',
    '["factory_super_admin", "department_admin"]', 80, '查询客户统计数据',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 按类型客户
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CUSTOMER_BY_TYPE', '按类型客户', 'CRM',
    'LOW', 1,
    '["零售客户", "批发客户", "企业客户", "VIP客户", "大客户"]',
    '["factory_super_admin", "department_admin"]', 82, '按类型筛选客户',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 活跃客户
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CUSTOMER_ACTIVE', '活跃客户', 'CRM',
    'LOW', 1,
    '["活跃客户", "近期客户", "常买客户", "忠实客户"]',
    '["factory_super_admin", "department_admin"]', 82, '查询近期活跃的客户',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 客户购买历史
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'CUSTOMER_PURCHASE_HISTORY', '客户购买历史', 'CRM',
    'LOW', 1,
    '["客户订单", "购买历史", "客户采购", "交易记录", "客户历史订单"]',
    '["factory_super_admin", "department_admin"]', 85, '查询客户的购买历史',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 供应商列表
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SUPPLIER_LIST', '供应商列表', 'CRM',
    'LOW', 1,
    '["供应商列表", "所有供应商", "供应商名单", "查看供应商"]',
    '["factory_super_admin", "department_admin"]', 82, '查询供应商列表',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 供应商搜索
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SUPPLIER_SEARCH', '供应商搜索', 'CRM',
    'LOW', 1,
    '["查询供应商", "搜索供应商", "找供应商", "供应商信息"]',
    '["factory_super_admin", "department_admin"]', 85, '按条件搜索供应商',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 供应商评估
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SUPPLIER_EVALUATE', '供应商评估', 'CRM',
    'MEDIUM', 2,
    '["供应商评估", "评估供应商", "供应商评分", "供应商考核", "供应商审核"]',
    '["factory_super_admin"]', 88, '评估供应商资质和表现',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 按类别供应商
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SUPPLIER_BY_CATEGORY', '按类别供应商', 'CRM',
    'LOW', 1,
    '["原料供应商", "包装供应商", "设备供应商", "物流供应商"]',
    '["factory_super_admin", "department_admin"]', 82, '按供应类别筛选供应商',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 活跃供应商
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SUPPLIER_ACTIVE', '活跃供应商', 'CRM',
    'LOW', 1,
    '["活跃供应商", "合作供应商", "常用供应商", "主力供应商"]',
    '["factory_super_admin", "department_admin"]', 82, '查询活跃的供应商',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 供应商排名
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SUPPLIER_RANKING', '供应商排名', 'CRM',
    'LOW', 1,
    '["供应商排名", "最佳供应商", "供应商排行", "优质供应商"]',
    '["factory_super_admin", "department_admin"]', 80, '查询供应商评分排名',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();
