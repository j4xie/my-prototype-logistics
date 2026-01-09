-- V2026_01_10_03__add_negative_keywords.sql
-- 添加负向关键词机制：防止意图误匹配
-- 例如：SCALE_DELETE 不应匹配 "列表"、"查看" 类查询

-- 1. 添加负向关键词字段
ALTER TABLE ai_intent_configs ADD COLUMN IF NOT EXISTS
    negative_keywords JSON DEFAULT '[]' COMMENT '负向关键词列表，匹配时扣分';

ALTER TABLE ai_intent_configs ADD COLUMN IF NOT EXISTS
    negative_keyword_penalty INT DEFAULT 15 COMMENT '每个负向词扣分百分比(0-100)';

-- 2. 为高混淆意图配置负向关键词

-- SCALE_DELETE_DEVICE: 防止匹配"列表"类查询
UPDATE ai_intent_configs SET negative_keywords =
    '["列表", "所有", "查看", "有哪些", "看看", "查询", "清单", "一览", "查", "看", "几个", "多少"]'
WHERE intent_code = 'SCALE_DELETE_DEVICE';

-- ALERT_ACKNOWLEDGE: 防止匹配"当前/活跃"类查询
UPDATE ai_intent_configs SET negative_keywords =
    '["活跃", "当前", "未处理", "待处理", "进行中", "正在发生", "还没", "待解决", "未关闭"]'
WHERE intent_code = 'ALERT_ACKNOWLEDGE';

-- ALERT_BY_LEVEL: 防止匹配通用告警列表查询
UPDATE ai_intent_configs SET negative_keywords =
    '["所有", "全部", "列表", "清单", "汇总", "信息"]'
WHERE intent_code = 'ALERT_BY_LEVEL';

-- MATERIAL_BATCH_RESERVE: 防止匹配"查询/列表"类
UPDATE ai_intent_configs SET negative_keywords =
    '["查询", "查看", "列表", "清单", "统计", "有哪些", "情况", "信息", "数量", "库存"]'
WHERE intent_code = 'MATERIAL_BATCH_RESERVE';

-- PROCESSING_BATCH_CREATE: 防止匹配"开始/完成/取消"
UPDATE ai_intent_configs SET negative_keywords =
    '["开始", "启动", "完成", "结束", "取消", "作废", "删掉", "撤销", "情况", "列表"]'
WHERE intent_code = 'PROCESSING_BATCH_CREATE';

-- PROCESSING_BATCH_TIMELINE: 防止匹配生产报表查询
UPDATE ai_intent_configs SET negative_keywords =
    '["报表", "报告", "统计", "数据", "分析"]'
WHERE intent_code = 'PROCESSING_BATCH_TIMELINE';

-- BATCH_UPDATE: 防止匹配"完成/取消/追踪"
UPDATE ai_intent_configs SET negative_keywords =
    '["完成", "结束", "取消", "作废", "追踪", "溯源", "列表"]'
WHERE intent_code = 'BATCH_UPDATE';

-- EQUIPMENT_STATS: 防止匹配设备列表查询
UPDATE ai_intent_configs SET negative_keywords =
    '["列表", "清单", "一览", "有哪些", "都有", "调出", "查看"]'
WHERE intent_code = 'EQUIPMENT_STATS';

-- EQUIPMENT_DETAIL: 防止匹配设备列表查询
UPDATE ai_intent_configs SET negative_keywords =
    '["列表", "所有", "全部", "都有", "几台", "多少台", "汇总"]'
WHERE intent_code = 'EQUIPMENT_DETAIL';

-- EQUIPMENT_ALERT_STATS: 防止匹配告警列表/维护查询
UPDATE ai_intent_configs SET negative_keywords =
    '["列表", "清单", "维护", "保养", "利用率"]'
WHERE intent_code = 'EQUIPMENT_ALERT_STATS';

-- SHIPMENT_STATS: 防止匹配出货查询/创建
UPDATE ai_intent_configs SET negative_keywords =
    '["查询", "查看", "订单", "新增", "录入", "创建", "安排"]'
WHERE intent_code = 'SHIPMENT_STATS';

-- SHIPMENT_STATUS_UPDATE: 防止匹配出货查询
UPDATE ai_intent_configs SET negative_keywords =
    '["查询", "查看", "列表", "订单", "情况"]'
WHERE intent_code = 'SHIPMENT_STATUS_UPDATE';

-- CUSTOMER_SEARCH: 防止匹配客户列表
UPDATE ai_intent_configs SET negative_keywords =
    '["列表", "所有", "全部", "资料"]'
WHERE intent_code = 'CUSTOMER_SEARCH';

-- CUSTOMER_BY_TYPE: 防止匹配客户列表
UPDATE ai_intent_configs SET negative_keywords =
    '["列表", "全部", "所有"]'
WHERE intent_code = 'CUSTOMER_BY_TYPE';

-- QUALITY_STATS: 防止匹配质检项查询
UPDATE ai_intent_configs SET negative_keywords =
    '["查看", "项目", "内容", "要求", "项"]'
WHERE intent_code = 'QUALITY_STATS';

-- REPORT_INVENTORY: 防止匹配其他报表类型
UPDATE ai_intent_configs SET negative_keywords =
    '["生产", "产量", "产出", "加工", "质量", "品质"]'
WHERE intent_code = 'REPORT_INVENTORY';

-- REPORT_KPI: 防止匹配质量报表
UPDATE ai_intent_configs SET negative_keywords =
    '["质量", "品质", "检验"]'
WHERE intent_code = 'REPORT_KPI';

-- USER_CREATE: 防止匹配用户禁用操作
UPDATE ai_intent_configs SET negative_keywords =
    '["暂停", "禁用", "停用", "注销"]'
WHERE intent_code = 'USER_CREATE';

-- SCHEDULING_SET_DISABLED: 防止匹配自动排产设置
UPDATE ai_intent_configs SET negative_keywords =
    '["自动", "开启", "启用"]'
WHERE intent_code = 'SCHEDULING_SET_DISABLED';

-- SCHEDULING_SET_MANUAL: 防止匹配考勤操作
UPDATE ai_intent_configs SET negative_keywords =
    '["下班", "签退", "撤了", "走了"]'
WHERE intent_code = 'SCHEDULING_SET_MANUAL';

-- REPORT_DASHBOARD_OVERVIEW: 防止匹配溯源查询
UPDATE ai_intent_configs SET negative_keywords =
    '["溯源", "追溯", "追踪", "端到端", "全流程"]'
WHERE intent_code = 'REPORT_DASHBOARD_OVERVIEW';

-- ALERT_STATS: 防止匹配告警列表/活跃告警
UPDATE ai_intent_configs SET negative_keywords =
    '["列表", "清单", "当前", "活跃", "未处理", "预警信息"]'
WHERE intent_code = 'ALERT_STATS';

-- SUPPLIER_ACTIVE: 防止匹配供应商列表
UPDATE ai_intent_configs SET negative_keywords =
    '["列表", "所有", "全部"]'
WHERE intent_code = 'SUPPLIER_ACTIVE';

-- PROCESSING_BATCH_LIST: 防止匹配生产批次创建
UPDATE ai_intent_configs SET negative_keywords =
    '["登记", "创建", "新建"]'
WHERE intent_code = 'PROCESSING_BATCH_LIST';

-- SHIPMENT_QUERY: 防止匹配创建出货
UPDATE ai_intent_configs SET negative_keywords =
    '["新增", "创建", "录入", "安排发货"]'
WHERE intent_code = 'SHIPMENT_QUERY';

-- PROCESSING_WORKER_ASSIGN: 防止匹配生产批次创建
UPDATE ai_intent_configs SET negative_keywords =
    '["登记", "创建", "新建批次"]'
WHERE intent_code = 'PROCESSING_WORKER_ASSIGN';

-- MATERIAL_EXPIRED_QUERY: 防止匹配即将到期查询
UPDATE ai_intent_configs SET negative_keywords =
    '["即将", "快要", "将要"]'
WHERE intent_code = 'MATERIAL_EXPIRED_QUERY';

-- ATTENDANCE_STATUS: 防止匹配报表概览
UPDATE ai_intent_configs SET negative_keywords =
    '["报表", "综合", "整体", "情况"]'
WHERE intent_code = 'ATTENDANCE_STATUS';

SELECT 'Negative keywords configured successfully' AS result;
