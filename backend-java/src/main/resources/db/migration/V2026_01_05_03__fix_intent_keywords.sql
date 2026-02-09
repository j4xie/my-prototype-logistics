-- ============================================
-- 修复AI意图关键词配置
-- 解决: P0-考勤关键词缺失, P1-原料/库存冲突, P1-批次查询/更新冲突
-- ============================================

-- P0: 考勤类意图关键词缺失
UPDATE ai_intent_configs SET keywords = '["今日考勤", "考勤情况", "今天考勤", "当日考勤", "考勤状态", "出勤情况", "今日出勤"]'
WHERE intent_code = 'ATTENDANCE_TODAY' AND factory_id = 'F001';

UPDATE ai_intent_configs SET keywords = '["打卡", "签到", "上班打卡", "上班签到", "打卡签到", "开始工作", "上班"]'
WHERE intent_code = 'CLOCK_IN' AND factory_id = 'F001';

UPDATE ai_intent_configs SET keywords = '["下班打卡", "签退", "下班签到", "结束工作", "下班"]'
WHERE intent_code = 'CLOCK_OUT' AND factory_id = 'F001';

UPDATE ai_intent_configs SET keywords = '["考勤状态", "打卡状态", "签到状态", "是否打卡", "有没有打卡"]'
WHERE intent_code = 'ATTENDANCE_STATUS' AND factory_id = 'F001';

-- P1: 原料与库存关键词冲突 - 增加更精确的关键词
-- MATERIAL_BATCH_QUERY 应优先匹配 "原料批次", "查询批次", "批次信息"
UPDATE ai_intent_configs SET keywords = '["原料批次", "查询原料", "原料信息", "批次详情", "查看原料", "原材料查询", "原材料信息", "MB-"]'
WHERE intent_code = 'MATERIAL_BATCH_QUERY' AND factory_id = 'F001';

-- REPORT_INVENTORY 保持库存报表相关关键词
UPDATE ai_intent_configs SET keywords = '["库存报表", "库存统计", "库存分析", "盘点报表", "库存汇总"]'
WHERE intent_code = 'REPORT_INVENTORY' AND factory_id = 'F001';

-- P1: 批次查询与更新冲突 - 明确区分动作词
-- BATCH_UPDATE 明确使用"修改", "更新", "编辑"等动作词
UPDATE ai_intent_configs SET keywords = '["修改批次", "更新批次", "编辑批次", "批次修改", "批次更新", "改批次", "调整批次"]'
WHERE intent_code = 'BATCH_UPDATE' AND factory_id = 'F001';

-- 补充: 其他可能冲突的意图优化
UPDATE ai_intent_configs SET keywords = '["低库存", "库存不足", "缺货预警", "库存预警", "原料不足", "原材料不足"]'
WHERE intent_code = 'MATERIAL_LOW_STOCK_ALERT' AND factory_id = 'F001';

UPDATE ai_intent_configs SET keywords = '["即将过期", "过期预警", "临期原料", "快过期", "临近保质期"]'
WHERE intent_code = 'MATERIAL_EXPIRING_ALERT' AND factory_id = 'F001';
