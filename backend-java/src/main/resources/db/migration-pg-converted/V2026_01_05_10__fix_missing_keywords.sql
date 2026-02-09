-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_05_10__fix_missing_keywords.sql
-- Conversion date: 2026-01-26 18:47:31
-- ============================================

-- V2026_01_05_10__fix_missing_keywords.sql
-- 修复缺失或不完整的意图关键词配置
-- 解决 NEED_INFO 状态意图的关键词匹配问题

-- ========================================
-- 1. 考勤类意图关键词补充
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["今日考勤","今天考勤","今天的考勤","今日打卡","今日出勤","查看今天考勤","今天打卡情况","今天出勤情况","今天考勤记录","考勤查询","attendance","today"]'
WHERE intent_code = 'ATTENDANCE_TODAY' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["上班打卡","签到","上班签到","打上班卡","开始工作","上班","早签","早上打卡","上班签到","clock in","checkin"]'
WHERE intent_code = 'CLOCK_IN' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["下班打卡","签退","下班签退","打下班卡","结束工作","下班","晚签","下班签到","clock out","checkout"]'
WHERE intent_code = 'CLOCK_OUT' AND factory_id IS NOT NULL;

-- ========================================
-- 2. 溯源类意图关键词优化
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["批次溯源","溯源查询","追溯批次","查询溯源","产品追溯","查询批次","溯源信息","批次追溯","追溯","溯源","trace","batch trace"]'
WHERE intent_code = 'TRACE_BATCH' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["完整溯源","全链路溯源","溯源链","完整追溯","全程追溯","溯源全流程","full trace","complete trace"]'
WHERE intent_code = 'TRACE_FULL' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["公开溯源","消费者溯源","扫码溯源","二维码溯源","公众查询","消费者查询","public trace"]'
WHERE intent_code = 'TRACE_PUBLIC' AND factory_id IS NOT NULL;

-- ========================================
-- 3. 出货类意图关键词优化
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["出货记录","出货查询","查询出货","出货列表","发货记录","发货查询","shipment query","查出货"]'
WHERE intent_code = 'SHIPMENT_QUERY' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["创建出货","新增出货","添加出货","录入出货","出货登记","发货","create shipment","新出货"]'
WHERE intent_code = 'SHIPMENT_CREATE' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["客户出货","按客户查询","客户发货","某客户出货","查客户出货","customer shipment"]'
WHERE intent_code = 'SHIPMENT_BY_CUSTOMER' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["日期出货","按日期查询","某天出货","时间范围出货","查某天出货","date shipment"]'
WHERE intent_code = 'SHIPMENT_BY_DATE' AND factory_id IS NOT NULL;

-- ========================================
-- 4. 告警类意图关键词优化
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["告警列表","查询告警","告警记录","异常列表","设备告警","查看告警","alert list","告警查询"]'
WHERE intent_code = 'ALERT_LIST' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["活动告警","未处理告警","当前告警","待处理告警","active alerts","未解决告警"]'
WHERE intent_code = 'ALERT_ACTIVE' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["确认告警","告警确认","acknowledge","确认异常","ack告警"]'
WHERE intent_code = 'ALERT_ACKNOWLEDGE' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["解决告警","告警解决","处理告警","resolve","关闭告警","告警处理"]'
WHERE intent_code = 'ALERT_RESOLVE' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["告警诊断","故障诊断","异常诊断","告警分析","诊断原因","diagnose alert"]'
WHERE intent_code = 'ALERT_DIAGNOSE' AND factory_id IS NOT NULL;

-- ========================================
-- 5. 用户管理意图关键词优化
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["禁用用户","停用用户","冻结用户","停用账号","禁用账号","disable user","用户禁用"]'
WHERE intent_code = 'USER_DISABLE' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["创建用户","新增用户","添加用户","注册用户","create user","新用户"]'
WHERE intent_code = 'USER_CREATE' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["分配角色","角色分配","修改角色","更新角色","设置权限","role assign"]'
WHERE intent_code = 'USER_ROLE_ASSIGN' AND factory_id IS NOT NULL;

-- ========================================
-- 6. 数据操作意图关键词优化
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["修改数据","更新数据","编辑记录","改信息","update data","数据修改","修改批次"]'
WHERE intent_code = 'DATA_OPERATION' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["更新批次","修改批次","批次修改","编辑批次","batch update","批次更新"]'
WHERE intent_code = 'BATCH_UPDATE' AND factory_id IS NOT NULL;

-- ========================================
-- 7. 质量检测意图关键词优化
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["质检记录","查询质检","质检报告","检测记录","quality record","质量记录"]'
WHERE intent_code = 'QUALITY_RECORD_QUERY' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["执行质检","质量检测","开始质检","质检执行","quality check","做质检"]'
WHERE intent_code = 'QUALITY_CHECK_EXECUTE' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["质量处置","不合格处理","处置决定","质量处理","disposition","处置"]'
WHERE intent_code = 'QUALITY_DISPOSITION' AND factory_id IS NOT NULL;

-- ========================================
-- 8. 原料批次意图关键词优化
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["原料查询","查询原料","原材料查询","原料批次","原料库存","material batch","查原料"]'
WHERE intent_code = 'MATERIAL_BATCH_QUERY' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["创建原料批次","新增原料","入库原料","原料入库","add material","原料登记"]'
WHERE intent_code = 'MATERIAL_BATCH_CREATE' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["更新原料","修改原料","原料修改","update material","原料更新"]'
WHERE intent_code = 'MATERIAL_BATCH_UPDATE' AND factory_id IS NOT NULL;

-- ========================================
-- 9. 报表类意图关键词优化
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["生产报表","生产统计","产量报表","生产分析","production report","生产数据"]'
WHERE intent_code = 'REPORT_PRODUCTION' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["质量报表","质量统计","质检分析","合格率","quality report","质量数据"]'
WHERE intent_code = 'REPORT_QUALITY' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["考勤报表","出勤统计","考勤分析","出勤率","attendance report","考勤数据"]'
WHERE intent_code = 'REPORT_ATTENDANCE' AND factory_id IS NOT NULL;

-- ========================================
-- 10. 电子秤相关意图关键词优化
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["添加电子秤","新增电子秤","注册电子秤","配置电子秤","add scale","电子秤注册"]'
WHERE intent_code = 'SCALE_ADD_DEVICE' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["电子秤列表","查询电子秤","电子秤查询","设备列表","scale list","电子秤设备"]'
WHERE intent_code = 'SCALE_DEVICE_LIST' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["检测重量","称重检测","重量识别","智能称重","weight detect","称重"]'
WHERE intent_code = 'SCALE_WEIGHT_DETECT' AND factory_id IS NOT NULL;

-- ========================================
-- 11. 系统管理意图关键词优化
-- ========================================

UPDATE ai_intent_configs
SET keywords = '["系统帮助","功能帮助","使用帮助","怎么用","如何使用","help","帮助"]'
WHERE intent_code = 'SYSTEM_HELP' AND factory_id IS NOT NULL;

UPDATE ai_intent_configs
SET keywords = '["系统状态","服务状态","运行状态","健康检查","system status","系统健康"]'
WHERE intent_code = 'SYSTEM_STATUS' AND factory_id IS NOT NULL;
