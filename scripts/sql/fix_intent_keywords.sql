-- AI意图关键词优化脚本
-- 解决测试用例失败问题
-- 执行方式: mysql -u root -p cretas_aims < fix_intent_keywords.sql

-- 1. 质检相关
UPDATE ai_intent_config SET keywords = '["质检列表", "质检查询", "查询质检", "质检记录查询", "质检项查询", "查询质检项", "质检项列表", "检测项目", "质检标准", "质检情况", "质检项目", "检测标准", "质量检查项", "品控项目列表", "品质检验标准", "qc检查项目"]'
WHERE intent_code = 'QUALITY_CHECK_QUERY';

-- 2. 设备/电子秤相关
UPDATE ai_intent_config SET keywords = '["设备列表", "电子秤列表", "所有电子秤", "查看秤", "秤列表", "设备清单", "称重设备", "计量设备", "秤管理", "所有设备"]'
WHERE intent_code = 'SCALE_LIST_DEVICES';

-- 3. 告警列表
UPDATE ai_intent_config SET keywords = '["告警列表", "查看告警", "所有告警", "警报列表", "系统告警", "告警记录", "告警信息"]'
WHERE intent_code = 'ALERT_LIST';

UPDATE ai_intent_config SET keywords = '["设备告警", "按设备查告警", "设备的告警", "某设备告警", "指定设备告警"]'
WHERE intent_code = 'ALERT_BY_EQUIPMENT';

-- 4. 生产批次
UPDATE ai_intent_config SET keywords = '["更新批次", "修改批次", "批次更新", "编辑批次", "变更批次信息", "生产批次"]'
WHERE intent_code = 'BATCH_UPDATE';

-- 5. 发货相关
UPDATE ai_intent_config SET keywords = '["发货记录", "查询发货", "发货列表", "发货信息", "出货记录", "发货查询", "发货单列表"]'
WHERE intent_code = 'SHIPMENT_QUERY';

-- 6. 生产计划
UPDATE ai_intent_config SET keywords = '["更新计划", "修改计划", "计划更新", "编辑计划", "调整计划", "生产计划"]'
WHERE intent_code = 'PLAN_UPDATE';

-- 7. 仪表盘
UPDATE ai_intent_config SET keywords = '["仪表盘", "看板", "概览", "首页数据", "数据总览", "业务概览", "数据统计", "dashboard"]'
WHERE intent_code = 'REPORT_DASHBOARD_OVERVIEW';

-- 8. 排班相关
UPDATE ai_intent_config SET keywords = '["排班列表", "自动排班", "开启自动排班", "排班设置", "调度设置", "工作排班", "排班管理"]'
WHERE intent_code = 'SCHEDULING_SET_AUTO';

-- 9. 部门相关
UPDATE ai_intent_config SET keywords = '["部门考勤", "按部门考勤", "部门出勤", "各部门考勤", "部门考勤统计"]'
WHERE intent_code = 'ATTENDANCE_DEPARTMENT';

-- 10. 用户管理 (如果不存在则跳过)
UPDATE ai_intent_config SET keywords = '["用户管理", "用户列表", "创建用户", "新增用户", "添加用户", "用户账号"]'
WHERE intent_code = 'USER_CREATE';

-- 验证更新
SELECT intent_code, LEFT(keywords, 80) as keywords_preview
FROM ai_intent_config
WHERE intent_code IN (
  'QUALITY_CHECK_QUERY', 'SCALE_LIST_DEVICES', 'ALERT_LIST',
  'BATCH_UPDATE', 'SHIPMENT_QUERY', 'PLAN_UPDATE',
  'REPORT_DASHBOARD_OVERVIEW', 'SCHEDULING_SET_AUTO'
);
