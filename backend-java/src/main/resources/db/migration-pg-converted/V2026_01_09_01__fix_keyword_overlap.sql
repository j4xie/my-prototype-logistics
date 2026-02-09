-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_09_01__fix_keyword_overlap.sql
-- Conversion date: 2026-01-26 18:48:05
-- ============================================

-- ================================================
-- 阶段一：关键词差异化 - 消除重叠
-- ================================================

-- 1. SCALE_LIST_DEVICES: 移除通用设备关键词，保留秤专有词
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '秤列表', '电子秤列表', '所有秤', '查看秤', '有哪些秤',
    '称重设备', '地磅列表', '台秤列表', 'IoT秤', '物联网秤',
    '电子秤', '地磅', '台秤'
)
WHERE intent_code = 'SCALE_LIST_DEVICES';

-- 2. EQUIPMENT_LIST: 强化通用设备关键词
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '设备列表', '所有设备', '设备清单', '查看设备', '设备查询',
    '机器列表', '生产设备', '设备一览', '全部设备', '设备目录',
    '查设备', '看设备'
)
WHERE intent_code = 'EQUIPMENT_LIST';

-- 3. EQUIPMENT_ALERT_LIST: 使用更具体的关键词
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '设备告警列表', '设备警报汇总', '设备故障告警', '机器告警',
    '设备异常列表', '设备报警记录', '设备告警查询', '设备告警'
)
WHERE intent_code = 'EQUIPMENT_ALERT_LIST';

-- 4. ALERT_LIST: 保留通用告警关键词
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '告警列表', '所有告警', '查看告警', '告警记录', '告警查询',
    '全部告警', '警报列表', '告警一览'
)
WHERE intent_code = 'ALERT_LIST';

-- 5. ALERT_ACTIVE: 强调"活跃/当前"
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '活跃告警', '当前告警', '未处理告警', '待处理告警',
    '进行中告警', '实时告警', '正在发生的告警', '未解决告警'
)
WHERE intent_code = 'ALERT_ACTIVE';

-- 6. SHIPMENT_QUERY: 强调查询动作
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '查询出货', '出货记录', '出货单查询', '发货记录', '发货查询',
    '查出货', '出货历史', '发货历史', '出货单列表', '查发货'
)
WHERE intent_code = 'SHIPMENT_QUERY';

-- 7. SHIPMENT_CREATE: 强调创建动作
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '创建出货', '新建出货', '新增出货', '登记出货', '录入出货',
    '安排发货', '创建发货单', '出货登记', '发起出货', '发货'
)
WHERE intent_code = 'SHIPMENT_CREATE';

-- 8. SHIPMENT_STATS: 强调统计
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '出货统计', '发货统计', '出货报表', '发货报表', '出货量统计',
    '出货数据', '发货数据', '出货汇总', '出货量', '发货量'
)
WHERE intent_code = 'SHIPMENT_STATS';

-- 9. ALERT_BY_EQUIPMENT: 区分于通用设备告警
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '某设备告警', '指定设备告警', '单设备告警', '设备故障',
    '查看某设备告警', '某设备的警报'
)
WHERE intent_code = 'ALERT_BY_EQUIPMENT';

-- 10. EQUIPMENT_ALERT_STATS: 设备告警统计
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '设备告警统计', '设备故障统计', '设备异常统计', '机器故障统计',
    '设备警报统计', '设备报警汇总'
)
WHERE intent_code = 'EQUIPMENT_ALERT_STATS';

-- 11. ATTENDANCE_HISTORY: 考勤历史
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '考勤历史', '历史考勤', '历史打卡', '打卡记录', '考勤记录',
    '考勤明细', '打卡明细', '签到记录'
)
WHERE intent_code = 'ATTENDANCE_HISTORY';

-- 12. ATTENDANCE_TODAY: 今日考勤
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '今日考勤', '今日打卡', '今天打卡', '今天考勤', '今日出勤',
    '谁来了', '今天谁来了', '出勤情况'
)
WHERE intent_code = 'ATTENDANCE_TODAY';

