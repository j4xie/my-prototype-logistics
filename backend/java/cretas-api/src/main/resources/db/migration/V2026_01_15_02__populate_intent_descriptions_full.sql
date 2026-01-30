-- ============================================================
-- LLM Reranking - Full Intent Description Population
-- Purpose: 补充所有核心意图的 example_queries 和 negative_examples
-- 用于中置信度区间 (0.58-0.85) 的二次确认机制
-- ============================================================

-- ============================================
-- ANALYSIS 类意图
-- ============================================

-- COST_ANALYSIS: 成本分析
UPDATE ai_intent_configs
SET description = '分析成本数据的变化趋势、原因和构成，提供深度洞察。与简单查询不同，此意图关注"为什么"和"怎么样"',
    example_queries = '["分析一下成本", "为什么成本上升了", "成本变化原因是什么", "成本构成分析", "本月成本为什么比上月高"]',
    negative_examples = '["查看成本", "成本多少钱", "今天成本", "这周成本数据"]'
WHERE intent_code = 'COST_ANALYSIS' AND (example_queries IS NULL OR example_queries = '[]');

-- QUALITY_ANALYSIS: 质量分析
UPDATE ai_intent_configs
SET description = '深度分析质量数据，包括合格率趋势、不良原因分析、质量瓶颈识别',
    example_queries = '["分析一下质量数据", "为什么合格率下降", "质量问题原因分析", "质量趋势怎么样"]',
    negative_examples = '["查看质检记录", "质检结果", "合格率多少"]'
WHERE intent_code = 'QUALITY_ANALYSIS' AND (example_queries IS NULL OR example_queries = '[]');

-- PRODUCTION_ANALYSIS: 生产分析
UPDATE ai_intent_configs
SET description = '分析生产效率、产能利用率、瓶颈识别等生产数据的深度洞察',
    example_queries = '["分析一下生产效率", "产能为什么上不去", "生产瓶颈在哪", "效率下降原因"]',
    negative_examples = '["查看产量", "今天生产多少", "生产记录"]'
WHERE intent_code = 'PRODUCTION_ANALYSIS' AND (example_queries IS NULL OR example_queries = '[]');

-- INVENTORY_ANALYSIS: 库存分析
UPDATE ai_intent_configs
SET description = '分析库存周转率、呆滞库存、库存健康度等深度库存数据',
    example_queries = '["分析一下库存", "库存周转率怎么样", "呆滞库存分析", "库存健康度"]',
    negative_examples = '["查看库存", "库存多少", "原料够不够"]'
WHERE intent_code = 'INVENTORY_ANALYSIS' AND (example_queries IS NULL OR example_queries = '[]');

-- TREND_PREDICTION: 趋势预测
UPDATE ai_intent_configs
SET description = '基于历史数据预测未来趋势，包括产量预测、成本预测、需求预测',
    example_queries = '["预测下个月产量", "成本趋势预测", "未来需求预测", "预计下周销量"]',
    negative_examples = '["查看历史数据", "过去一周的数据", "成本多少"]'
WHERE intent_code = 'TREND_PREDICTION' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- DATA_OP 类意图
-- ============================================

-- BATCH_UPDATE: 批量更新
UPDATE ai_intent_configs
SET description = '批量修改多条数据记录，适用于需要同时更新多个对象的场景',
    example_queries = '["批量更新状态", "把所有这些改成完成", "批量修改价格", "全部更新为已处理"]',
    negative_examples = '["修改这一个", "更新单个记录", "查看批次"]'
WHERE intent_code = 'BATCH_UPDATE' AND (example_queries IS NULL OR example_queries = '[]');

-- PRODUCT_UPDATE: 产品更新
UPDATE ai_intent_configs
SET description = '更新产品类型信息，如名称、规格、单位、价格等属性',
    example_queries = '["修改产品名称", "更新产品规格", "调整产品价格", "改一下产品信息"]',
    negative_examples = '["查看产品", "产品列表", "有什么产品"]'
WHERE intent_code = 'PRODUCT_UPDATE' AND (example_queries IS NULL OR example_queries = '[]');

-- PLAN_UPDATE: 计划更新
UPDATE ai_intent_configs
SET description = '更新生产计划信息，如计划数量、日期、优先级等',
    example_queries = '["修改计划数量", "调整生产计划", "改一下计划日期", "更新计划产量"]',
    negative_examples = '["查看计划", "今天的计划", "计划列表"]'
WHERE intent_code = 'PLAN_UPDATE' AND (example_queries IS NULL OR example_queries = '[]');

-- MATERIAL_UPDATE: 原材料更新
UPDATE ai_intent_configs
SET description = '更新原材料批次信息，如数量、状态、存储位置等',
    example_queries = '["修改原料数量", "更新材料状态", "调整原材料信息", "改一下原料批次"]',
    negative_examples = '["查看原料", "原料够不够", "原料列表"]'
WHERE intent_code = 'MATERIAL_UPDATE' AND (example_queries IS NULL OR example_queries = '[]');

-- STATUS_CHANGE: 状态变更
UPDATE ai_intent_configs
SET description = '变更业务实体状态，如批次状态、计划状态、设备状态等',
    example_queries = '["把状态改成完成", "暂停这个计划", "恢复生产", "取消这个订单"]',
    negative_examples = '["查看状态", "当前状态是什么", "状态列表"]'
WHERE intent_code = 'STATUS_CHANGE' AND (example_queries IS NULL OR example_queries = '[]');

-- QUANTITY_ADJUST: 数量调整
UPDATE ai_intent_configs
SET description = '调整生产数量、库存数量等数值类数据',
    example_queries = '["把数量改成100", "调整产量", "增加库存数量", "减少计划数量"]',
    negative_examples = '["数量是多少", "查看数量", "当前库存"]'
WHERE intent_code = 'QUANTITY_ADJUST' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- QUALITY 类意图
-- ============================================

-- QUALITY_CHECK_QUERY: 质检项查询
UPDATE ai_intent_configs
SET description = '查询质检项目和标准配置，不包括执行质检操作',
    example_queries = '["有哪些质检项", "质检标准是什么", "查看质检项目", "质检配置"]',
    negative_examples = '["做质检", "执行检测", "提交质检结果"]'
WHERE intent_code = 'QUALITY_CHECK_QUERY' AND (example_queries IS NULL OR example_queries = '[]');

-- QUALITY_CHECK_EXECUTE: 执行质检 - 已在 V2026_01_15_01 中填充

-- QUALITY_DISPOSITION_EVALUATE: 处置评估
UPDATE ai_intent_configs
SET description = '根据质检结果智能评估处置方案，提供处置建议',
    example_queries = '["该怎么处置", "处置建议是什么", "不合格品怎么处理", "应该怎么处置"]',
    negative_examples = '["执行处置", "确认处置", "做处置"]'
WHERE intent_code = 'QUALITY_DISPOSITION_EVALUATE' AND (example_queries IS NULL OR example_queries = '[]');

-- QUALITY_DISPOSITION_EXECUTE: 执行处置
UPDATE ai_intent_configs
SET description = '执行质量处置动作，包括放行、返工、报废、特批、暂扣等',
    example_queries = '["执行放行", "确认报废", "做返工处理", "特批放行"]',
    negative_examples = '["处置建议", "应该怎么处置", "处置方案"]'
WHERE intent_code = 'QUALITY_DISPOSITION_EXECUTE' AND (example_queries IS NULL OR example_queries = '[]');

-- QUALITY_STATS: 质检统计
UPDATE ai_intent_configs
SET description = '查询质检统计数据，如合格率、不合格率、趋势等汇总数据',
    example_queries = '["质检合格率多少", "质检统计数据", "这周质检情况", "合格率报表"]',
    negative_examples = '["做质检", "执行检测", "质检项目有哪些"]'
WHERE intent_code = 'QUALITY_STATS' AND (example_queries IS NULL OR example_queries = '[]');

-- QUALITY_CRITICAL_ITEMS: 关键质检项
UPDATE ai_intent_configs
SET description = '查询关键/必检的质检项目，这些是必须执行的检测点',
    example_queries = '["关键质检项有哪些", "必检项目", "强制检验项", "哪些是必检的"]',
    negative_examples = '["所有质检项", "质检配置", "执行质检"]'
WHERE intent_code = 'QUALITY_CRITICAL_ITEMS' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- MATERIAL 类意图
-- ============================================

-- MATERIAL_BATCH_QUERY: 原料批次查询 - 已在 V2026_01_15_01 中填充

-- MATERIAL_BATCH_USE: 使用原料
UPDATE ai_intent_configs
SET description = '记录原材料使用/出库操作，将原材料从库存中消耗',
    example_queries = '["使用这批原料", "领用原材料", "原料出库", "消耗材料"]',
    negative_examples = '["查看原料", "原料够不够", "原料库存"]'
WHERE intent_code = 'MATERIAL_BATCH_USE' AND (example_queries IS NULL OR example_queries = '[]');

-- MATERIAL_BATCH_RESERVE: 预留原料
UPDATE ai_intent_configs
SET description = '预留原材料给特定生产计划，锁定库存防止被其他计划使用',
    example_queries = '["预留这批原料", "锁定原材料", "保留给这个计划", "原料预留"]',
    negative_examples = '["使用原料", "释放预留", "查看原料"]'
WHERE intent_code = 'MATERIAL_BATCH_RESERVE' AND (example_queries IS NULL OR example_queries = '[]');

-- MATERIAL_BATCH_RELEASE: 释放预留
UPDATE ai_intent_configs
SET description = '释放已预留的原材料，使其可被其他计划使用',
    example_queries = '["释放这批原料", "取消预留", "解锁原材料", "不需要预留了"]',
    negative_examples = '["预留原料", "使用原料", "查看预留"]'
WHERE intent_code = 'MATERIAL_BATCH_RELEASE' AND (example_queries IS NULL OR example_queries = '[]');

-- MATERIAL_BATCH_CONSUME: 消耗预留
UPDATE ai_intent_configs
SET description = '将预留的原材料转为实际消耗，确认使用预留库存',
    example_queries = '["确认消耗预留", "预留转消耗", "使用预留的原料", "消耗这批预留"]',
    negative_examples = '["释放预留", "预留原料", "查看预留"]'
WHERE intent_code = 'MATERIAL_BATCH_CONSUME' AND (example_queries IS NULL OR example_queries = '[]');

-- MATERIAL_FIFO_RECOMMEND: FIFO推荐
UPDATE ai_intent_configs
SET description = '按先进先出原则推荐应优先使用的原材料批次',
    example_queries = '["推荐使用哪批原料", "FIFO推荐", "应该先用哪批", "优先使用哪个"]',
    negative_examples = '["使用原料", "原料列表", "原料库存"]'
WHERE intent_code = 'MATERIAL_FIFO_RECOMMEND' AND (example_queries IS NULL OR example_queries = '[]');

-- MATERIAL_EXPIRING_ALERT: 即将过期预警
UPDATE ai_intent_configs
SET description = '查询即将过期的原材料批次，提前预警',
    example_queries = '["有哪些快过期的原料", "临期原料", "即将过期的材料", "过期预警"]',
    negative_examples = '["已过期原料", "原料库存", "使用原料"]'
WHERE intent_code = 'MATERIAL_EXPIRING_ALERT' AND (example_queries IS NULL OR example_queries = '[]');

-- MATERIAL_LOW_STOCK_ALERT: 低库存预警
UPDATE ai_intent_configs
SET description = '查询库存不足的原材料类型，提供补货预警',
    example_queries = '["有哪些原料库存不足", "低库存预警", "哪些材料要补货", "缺货预警"]',
    negative_examples = '["原料库存", "即将过期", "原料列表"]'
WHERE intent_code = 'MATERIAL_LOW_STOCK_ALERT' AND (example_queries IS NULL OR example_queries = '[]');

-- MATERIAL_EXPIRED_QUERY: 已过期查询
UPDATE ai_intent_configs
SET description = '查询已过期的原材料批次，需要处置',
    example_queries = '["有哪些过期原料", "已过期材料", "过期批次查询", "查看过期的"]',
    negative_examples = '["即将过期", "原料库存", "使用原料"]'
WHERE intent_code = 'MATERIAL_EXPIRED_QUERY' AND (example_queries IS NULL OR example_queries = '[]');

-- MATERIAL_ADJUST_QUANTITY: 调整数量
UPDATE ai_intent_configs
SET description = '调整原材料批次数量，用于盘点、损耗等场景',
    example_queries = '["调整原料数量", "盘点调整", "修正库存数量", "原料损耗记录"]',
    negative_examples = '["查看库存", "使用原料", "原料列表"]'
WHERE intent_code = 'MATERIAL_ADJUST_QUANTITY' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- SHIPMENT 类意图
-- ============================================

-- SHIPMENT_CREATE: 创建出货
UPDATE ai_intent_configs
SET description = '创建新的出货记录，安排发货',
    example_queries = '["创建出货单", "安排发货", "新建出货", "要出货了"]',
    negative_examples = '["查看出货", "出货记录", "出货状态"]'
WHERE intent_code = 'SHIPMENT_CREATE' AND (example_queries IS NULL OR example_queries = '[]');

-- SHIPMENT_QUERY: 查询出货
UPDATE ai_intent_configs
SET description = '查询出货记录和发货信息',
    example_queries = '["查看出货记录", "出货情况", "发货列表", "有哪些出货"]',
    negative_examples = '["创建出货", "安排发货", "确认送达"]'
WHERE intent_code = 'SHIPMENT_QUERY' AND (example_queries IS NULL OR example_queries = '[]');

-- SHIPMENT_UPDATE: 更新出货
UPDATE ai_intent_configs
SET description = '更新出货记录信息，如数量、客户、备注等',
    example_queries = '["修改出货信息", "更新发货单", "调整出货数量", "编辑出货"]',
    negative_examples = '["查看出货", "创建出货", "出货状态"]'
WHERE intent_code = 'SHIPMENT_UPDATE' AND (example_queries IS NULL OR example_queries = '[]');

-- SHIPMENT_STATUS_UPDATE: 更新出货状态
UPDATE ai_intent_configs
SET description = '更新出货状态，如确认发货、确认送达、标记退货等',
    example_queries = '["确认发货", "标记送达", "确认送达", "退货处理"]',
    negative_examples = '["查看出货", "出货记录", "创建出货"]'
WHERE intent_code = 'SHIPMENT_STATUS_UPDATE' AND (example_queries IS NULL OR example_queries = '[]');

-- SHIPMENT_STATS: 出货统计
UPDATE ai_intent_configs
SET description = '查询出货统计数据，包括发货量、客户分布等汇总信息',
    example_queries = '["出货统计", "发货量多少", "出货报表", "发货汇总"]',
    negative_examples = '["查看出货", "创建出货", "出货列表"]'
WHERE intent_code = 'SHIPMENT_STATS' AND (example_queries IS NULL OR example_queries = '[]');

-- SHIPMENT_BY_CUSTOMER: 客户出货
UPDATE ai_intent_configs
SET description = '按客户查询出货记录',
    example_queries = '["这个客户的出货记录", "客户订单", "某客户的发货", "查询客户出货"]',
    negative_examples = '["所有出货", "出货统计", "创建出货"]'
WHERE intent_code = 'SHIPMENT_BY_CUSTOMER' AND (example_queries IS NULL OR example_queries = '[]');

-- SHIPMENT_BY_DATE: 日期出货
UPDATE ai_intent_configs
SET description = '按日期范围查询出货记录',
    example_queries = '["今天的出货", "昨天发了多少货", "本周出货", "这个月的发货"]',
    negative_examples = '["所有出货", "客户出货", "创建出货"]'
WHERE intent_code = 'SHIPMENT_BY_DATE' AND (example_queries IS NULL OR example_queries = '[]');

-- TRACE_BATCH: 批次溯源
UPDATE ai_intent_configs
SET description = '查询产品批次的溯源信息，追踪生产过程',
    example_queries = '["查询批次溯源", "追溯这个批次", "产品追溯", "溯源查询"]',
    negative_examples = '["出货记录", "批次列表", "生产记录"]'
WHERE intent_code = 'TRACE_BATCH' AND (example_queries IS NULL OR example_queries = '[]');

-- TRACE_FULL: 完整溯源
UPDATE ai_intent_configs
SET description = '查询完整溯源链条，从原料到加工到质检到出货的全流程',
    example_queries = '["完整追溯", "全链路溯源", "从头到尾追溯", "全流程溯源"]',
    negative_examples = '["简单溯源", "批次查询", "出货记录"]'
WHERE intent_code = 'TRACE_FULL' AND (example_queries IS NULL OR example_queries = '[]');

-- TRACE_PUBLIC: 公开溯源
UPDATE ai_intent_configs
SET description = '生成面向消费者的公开溯源信息，用于扫码查询',
    example_queries = '["生成公开溯源", "消费者溯源", "扫码溯源信息", "公开查询信息"]',
    negative_examples = '["内部溯源", "完整溯源", "批次查询"]'
WHERE intent_code = 'TRACE_PUBLIC' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- REPORT 类意图
-- ============================================

-- REPORT_DASHBOARD_OVERVIEW: 仪表盘总览
UPDATE ai_intent_configs
SET description = '获取工厂仪表盘总览数据，包括今日概况、关键指标等',
    example_queries = '["看看仪表盘", "今日概况", "工厂总览", "运营数据总览"]',
    negative_examples = '["生产报表", "质量报表", "详细数据"]'
WHERE intent_code = 'REPORT_DASHBOARD_OVERVIEW' AND (example_queries IS NULL OR example_queries = '[]');

-- REPORT_PRODUCTION: 生产报表 - 已在 V2026_01_15_01 中填充

-- REPORT_QUALITY: 质量报表
UPDATE ai_intent_configs
SET description = '生成质量检测统计报表，包括合格率、不良分布等',
    example_queries = '["质量报表", "质检报告", "合格率报表", "质量统计报告"]',
    negative_examples = '["生产报表", "做质检", "质检记录"]'
WHERE intent_code = 'REPORT_QUALITY' AND (example_queries IS NULL OR example_queries = '[]');

-- REPORT_INVENTORY: 库存报表
UPDATE ai_intent_configs
SET description = '生成库存统计报表，包括原料库存、成品库存、周转率等',
    example_queries = '["库存报表", "库存统计报告", "盘点报告", "成品库存报表"]',
    negative_examples = '["查看库存", "原料够不够", "使用原料"]'
WHERE intent_code = 'REPORT_INVENTORY' AND (example_queries IS NULL OR example_queries = '[]');

-- REPORT_FINANCE: 财务报表
UPDATE ai_intent_configs
SET description = '生成财务成本分析报表，包括成本构成、收支统计等',
    example_queries = '["财务报表", "成本报表", "收支报告", "财务分析报告"]',
    negative_examples = '["查看成本", "成本多少", "分析成本"]'
WHERE intent_code = 'REPORT_FINANCE' AND (example_queries IS NULL OR example_queries = '[]');

-- REPORT_EFFICIENCY: 效率分析报表
UPDATE ai_intent_configs
SET description = '生成生产效率分析报表，包括OEE、产能利用率等',
    example_queries = '["效率报表", "OEE报告", "产能分析报表", "设备效率报告"]',
    negative_examples = '["生产报表", "查看产量", "效率多少"]'
WHERE intent_code = 'REPORT_EFFICIENCY' AND (example_queries IS NULL OR example_queries = '[]');

-- REPORT_KPI: KPI指标报表
UPDATE ai_intent_configs
SET description = '生成KPI绩效指标报表，包括各项考核指标完成情况',
    example_queries = '["KPI报表", "绩效报告", "指标完成情况", "考核报表"]',
    negative_examples = '["生产报表", "效率报表", "查看数据"]'
WHERE intent_code = 'REPORT_KPI' AND (example_queries IS NULL OR example_queries = '[]');

-- REPORT_ANOMALY: 异常报表
UPDATE ai_intent_configs
SET description = '生成异常问题统计报表，汇总各类异常和告警',
    example_queries = '["异常报表", "问题汇总报告", "告警统计报表", "异常分析报告"]',
    negative_examples = '["查看告警", "处理异常", "告警列表"]'
WHERE intent_code = 'REPORT_ANOMALY' AND (example_queries IS NULL OR example_queries = '[]');

-- REPORT_TRENDS: 趋势报表
UPDATE ai_intent_configs
SET description = '生成趋势分析报表，展示历史数据的变化走势',
    example_queries = '["趋势报表", "走势分析报告", "变化趋势报表", "历史趋势报告"]',
    negative_examples = '["预测未来", "今天数据", "当前状态"]'
WHERE intent_code = 'REPORT_TRENDS' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- ALERT 类意图
-- ============================================

-- ALERT_LIST: 告警列表 - 已在 V2026_01_15_01 中填充

-- ALERT_ACTIVE: 活跃告警
UPDATE ai_intent_configs
SET description = '查询当前活跃未处理的告警，需要关注的紧急事项',
    example_queries = '["当前告警", "未处理告警", "有什么待处理的告警", "活跃告警"]',
    negative_examples = '["所有告警", "历史告警", "告警统计"]'
WHERE intent_code = 'ALERT_ACTIVE' AND (example_queries IS NULL OR example_queries = '[]');

-- ALERT_STATS: 告警统计
UPDATE ai_intent_configs
SET description = '查询告警统计数据，包括告警数量、类型分布、处理时效等',
    example_queries = '["告警统计", "告警数量", "告警分析", "告警汇总"]',
    negative_examples = '["查看告警", "处理告警", "当前告警"]'
WHERE intent_code = 'ALERT_STATS' AND (example_queries IS NULL OR example_queries = '[]');

-- ALERT_ACKNOWLEDGE: 确认告警
UPDATE ai_intent_configs
SET description = '确认收到告警通知，表示开始处理',
    example_queries = '["确认告警", "收到告警", "知道了", "我来处理"]',
    negative_examples = '["查看告警", "解决告警", "告警列表"]'
WHERE intent_code = 'ALERT_ACKNOWLEDGE' AND (example_queries IS NULL OR example_queries = '[]');

-- ALERT_RESOLVE: 解决告警 - 已在 V2026_01_15_01 中填充

-- ALERT_TRIAGE: 告警分级
UPDATE ai_intent_configs
SET description = '智能分析告警优先级和处理顺序，进行告警分级',
    example_queries = '["告警分级", "哪个告警最紧急", "优先处理哪个", "告警优先级"]',
    negative_examples = '["查看告警", "处理告警", "告警列表"]'
WHERE intent_code = 'ALERT_TRIAGE' AND (example_queries IS NULL OR example_queries = '[]');

-- ALERT_DIAGNOSE: 告警诊断
UPDATE ai_intent_configs
SET description = '智能分析告警原因并给出处理建议',
    example_queries = '["诊断这个告警", "告警原因分析", "为什么会告警", "怎么解决这个告警"]',
    negative_examples = '["查看告警", "告警列表", "确认告警"]'
WHERE intent_code = 'ALERT_DIAGNOSE' AND (example_queries IS NULL OR example_queries = '[]');

-- ALERT_BY_EQUIPMENT: 按设备告警
UPDATE ai_intent_configs
SET description = '按设备查询告警记录，查看特定设备的告警历史',
    example_queries = '["这台设备的告警", "某设备告警记录", "设备故障历史", "查看设备告警"]',
    negative_examples = '["所有告警", "活跃告警", "告警统计"]'
WHERE intent_code = 'ALERT_BY_EQUIPMENT' AND (example_queries IS NULL OR example_queries = '[]');

-- ALERT_BY_LEVEL: 按级别告警
UPDATE ai_intent_configs
SET description = '按告警级别筛选告警，如严重、警告、信息等',
    example_queries = '["严重告警", "紧急告警有哪些", "高级别告警", "警告级别的"]',
    negative_examples = '["所有告警", "设备告警", "告警统计"]'
WHERE intent_code = 'ALERT_BY_LEVEL' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- HR 类意图
-- ============================================

-- ATTENDANCE_STATUS: 打卡状态 - 已在 V2026_01_15_01 中填充

-- ATTENDANCE_HISTORY: 考勤历史
UPDATE ai_intent_configs
SET description = '查询考勤历史记录，包括打卡时间、出勤情况等',
    example_queries = '["考勤记录", "打卡历史", "历史考勤", "出勤记录"]',
    negative_examples = '["打卡", "签到", "今天考勤"]'
WHERE intent_code = 'ATTENDANCE_HISTORY' AND (example_queries IS NULL OR example_queries = '[]');

-- ATTENDANCE_STATS: 考勤统计
UPDATE ai_intent_configs
SET description = '查询考勤统计数据，如出勤率、迟到次数、早退次数等',
    example_queries = '["考勤统计", "出勤率", "迟到了多少次", "考勤汇总"]',
    negative_examples = '["考勤记录", "打卡", "今天考勤"]'
WHERE intent_code = 'ATTENDANCE_STATS' AND (example_queries IS NULL OR example_queries = '[]');

-- ATTENDANCE_MONTHLY: 月度考勤
UPDATE ai_intent_configs
SET description = '查询月度考勤记录，生成月度出勤报表',
    example_queries = '["本月考勤", "月度出勤", "这个月的考勤", "月考勤报表"]',
    negative_examples = '["今天考勤", "打卡", "考勤统计"]'
WHERE intent_code = 'ATTENDANCE_MONTHLY' AND (example_queries IS NULL OR example_queries = '[]');

-- ATTENDANCE_ANOMALY: 考勤异常
UPDATE ai_intent_configs
SET description = '查询考勤异常记录，如迟到、早退、缺勤等',
    example_queries = '["考勤异常", "迟到记录", "早退记录", "缺勤情况"]',
    negative_examples = '["正常考勤", "考勤统计", "打卡"]'
WHERE intent_code = 'ATTENDANCE_ANOMALY' AND (example_queries IS NULL OR example_queries = '[]');

-- ATTENDANCE_DEPARTMENT: 部门考勤
UPDATE ai_intent_configs
SET description = '查询部门考勤统计，团队整体出勤情况',
    example_queries = '["部门考勤", "团队出勤", "部门出勤率", "团队考勤统计"]',
    negative_examples = '["个人考勤", "我的考勤", "打卡"]'
WHERE intent_code = 'ATTENDANCE_DEPARTMENT' AND (example_queries IS NULL OR example_queries = '[]');

-- ATTENDANCE_TODAY: 今日打卡记录
UPDATE ai_intent_configs
SET description = '查询今天的打卡记录',
    example_queries = '["今天打卡记录", "今日考勤", "今天出勤", "今天的考勤"]',
    negative_examples = '["打卡", "历史考勤", "月度考勤"]'
WHERE intent_code = 'ATTENDANCE_TODAY' AND (example_queries IS NULL OR example_queries = '[]');

-- CLOCK_IN: 上班打卡 - 已在 V2026_01_15_01 中填充

-- CLOCK_OUT: 下班打卡 - 已在 V2026_01_15_01 中填充

-- ============================================
-- CRM 类意图
-- ============================================

-- CUSTOMER_LIST: 客户列表
UPDATE ai_intent_configs
SET description = '查询客户列表，获取所有客户信息',
    example_queries = '["客户列表", "有哪些客户", "所有客户", "客户名单"]',
    negative_examples = '["查询某个客户", "客户统计", "新增客户"]'
WHERE intent_code = 'CUSTOMER_LIST' AND (example_queries IS NULL OR example_queries = '[]');

-- CUSTOMER_SEARCH: 客户搜索
UPDATE ai_intent_configs
SET description = '按条件搜索客户，查找特定客户信息',
    example_queries = '["查找某客户", "搜索客户", "客户信息", "找一下这个客户"]',
    negative_examples = '["客户列表", "所有客户", "客户统计"]'
WHERE intent_code = 'CUSTOMER_SEARCH' AND (example_queries IS NULL OR example_queries = '[]');

-- CUSTOMER_STATS: 客户统计
UPDATE ai_intent_configs
SET description = '查询客户统计数据，如客户数量、分布、增长等',
    example_queries = '["客户统计", "有多少客户", "客户分析", "客户数量"]',
    negative_examples = '["客户列表", "查询客户", "客户详情"]'
WHERE intent_code = 'CUSTOMER_STATS' AND (example_queries IS NULL OR example_queries = '[]');

-- CUSTOMER_BY_TYPE: 按类型客户
UPDATE ai_intent_configs
SET description = '按类型筛选客户，如零售、批发、VIP等',
    example_queries = '["VIP客户", "批发客户有哪些", "零售客户", "大客户"]',
    negative_examples = '["所有客户", "客户统计", "客户详情"]'
WHERE intent_code = 'CUSTOMER_BY_TYPE' AND (example_queries IS NULL OR example_queries = '[]');

-- CUSTOMER_ACTIVE: 活跃客户
UPDATE ai_intent_configs
SET description = '查询近期活跃的客户，有最近交易记录的客户',
    example_queries = '["活跃客户", "近期有交易的客户", "常买客户", "忠实客户"]',
    negative_examples = '["所有客户", "客户统计", "新客户"]'
WHERE intent_code = 'CUSTOMER_ACTIVE' AND (example_queries IS NULL OR example_queries = '[]');

-- CUSTOMER_PURCHASE_HISTORY: 客户购买历史
UPDATE ai_intent_configs
SET description = '查询客户的购买历史和交易记录',
    example_queries = '["客户购买记录", "客户订单历史", "这个客户买了什么", "交易记录"]',
    negative_examples = '["客户列表", "客户信息", "客户统计"]'
WHERE intent_code = 'CUSTOMER_PURCHASE_HISTORY' AND (example_queries IS NULL OR example_queries = '[]');

-- SUPPLIER_LIST: 供应商列表
UPDATE ai_intent_configs
SET description = '查询供应商列表，获取所有供应商信息',
    example_queries = '["供应商列表", "有哪些供应商", "所有供应商", "供应商名单"]',
    negative_examples = '["查询某个供应商", "供应商评估", "新增供应商"]'
WHERE intent_code = 'SUPPLIER_LIST' AND (example_queries IS NULL OR example_queries = '[]');

-- SUPPLIER_SEARCH: 供应商搜索
UPDATE ai_intent_configs
SET description = '按条件搜索供应商，查找特定供应商信息',
    example_queries = '["查找某供应商", "搜索供应商", "供应商信息", "找一下这个供应商"]',
    negative_examples = '["供应商列表", "所有供应商", "供应商评估"]'
WHERE intent_code = 'SUPPLIER_SEARCH' AND (example_queries IS NULL OR example_queries = '[]');

-- SUPPLIER_EVALUATE: 供应商评估
UPDATE ai_intent_configs
SET description = '评估供应商资质和表现，进行供应商审核',
    example_queries = '["评估供应商", "供应商考核", "供应商评分", "供应商审核"]',
    negative_examples = '["供应商列表", "供应商信息", "供应商排名"]'
WHERE intent_code = 'SUPPLIER_EVALUATE' AND (example_queries IS NULL OR example_queries = '[]');

-- SUPPLIER_BY_CATEGORY: 按类别供应商
UPDATE ai_intent_configs
SET description = '按供应类别筛选供应商，如原料、包装、设备等',
    example_queries = '["原料供应商", "包装供应商有哪些", "设备供应商", "物流供应商"]',
    negative_examples = '["所有供应商", "供应商评估", "供应商详情"]'
WHERE intent_code = 'SUPPLIER_BY_CATEGORY' AND (example_queries IS NULL OR example_queries = '[]');

-- SUPPLIER_ACTIVE: 活跃供应商
UPDATE ai_intent_configs
SET description = '查询活跃的供应商，有最近合作记录的供应商',
    example_queries = '["活跃供应商", "常用供应商", "主力供应商", "合作供应商"]',
    negative_examples = '["所有供应商", "供应商评估", "新供应商"]'
WHERE intent_code = 'SUPPLIER_ACTIVE' AND (example_queries IS NULL OR example_queries = '[]');

-- SUPPLIER_RANKING: 供应商排名
UPDATE ai_intent_configs
SET description = '查询供应商评分排名，优质供应商推荐',
    example_queries = '["供应商排名", "最佳供应商", "优质供应商", "供应商排行"]',
    negative_examples = '["供应商列表", "供应商评估", "供应商信息"]'
WHERE intent_code = 'SUPPLIER_RANKING' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- EQUIPMENT 类意图
-- ============================================

-- EQUIPMENT_LIST: 设备列表 - 已在 V2026_01_15_01 中填充

-- EQUIPMENT_DETAIL: 设备详情
UPDATE ai_intent_configs
SET description = '查询指定设备的详细信息，包括参数、状态、维护记录',
    example_queries = '["设备详情", "这台设备的信息", "设备参数", "设备规格"]',
    negative_examples = '["设备列表", "所有设备", "设备统计"]'
WHERE intent_code = 'EQUIPMENT_DETAIL' AND (example_queries IS NULL OR example_queries = '[]');

-- EQUIPMENT_STATS: 设备统计
UPDATE ai_intent_configs
SET description = '获取设备统计数据，包括在线/离线数量、运行状态分布、利用率等',
    example_queries = '["设备统计", "设备概况", "设备利用率", "运行设备有多少"]',
    negative_examples = '["设备列表", "设备详情", "启动设备"]'
WHERE intent_code = 'EQUIPMENT_STATS' AND (example_queries IS NULL OR example_queries = '[]');

-- EQUIPMENT_START: 启动设备
UPDATE ai_intent_configs
SET description = '启动指定设备，将设备状态设置为运行中',
    example_queries = '["启动设备", "开启设备", "打开设备", "开机"]',
    negative_examples = '["停止设备", "设备状态", "设备列表"]'
WHERE intent_code = 'EQUIPMENT_START' AND (example_queries IS NULL OR example_queries = '[]');

-- EQUIPMENT_STOP: 停止设备
UPDATE ai_intent_configs
SET description = '停止指定设备，将设备状态设置为停机',
    example_queries = '["停止设备", "关闭设备", "关机", "停机"]',
    negative_examples = '["启动设备", "设备状态", "设备列表"]'
WHERE intent_code = 'EQUIPMENT_STOP' AND (example_queries IS NULL OR example_queries = '[]');

-- EQUIPMENT_STATUS_UPDATE: 更新设备状态
UPDATE ai_intent_configs
SET description = '更新设备状态，支持运行、停机、维护、故障等状态切换',
    example_queries = '["更新设备状态", "设备进入维护", "设备故障了", "设备保养"]',
    negative_examples = '["查看设备状态", "设备列表", "启动设备"]'
WHERE intent_code = 'EQUIPMENT_STATUS_UPDATE' AND (example_queries IS NULL OR example_queries = '[]');

-- EQUIPMENT_ALERT_LIST: 设备告警列表
UPDATE ai_intent_configs
SET description = '查询设备告警列表，支持按设备、级别、状态筛选',
    example_queries = '["设备告警", "设备报警列表", "设备异常", "机器告警"]',
    negative_examples = '["确认告警", "解决告警", "告警统计"]'
WHERE intent_code = 'EQUIPMENT_ALERT_LIST' AND (example_queries IS NULL OR example_queries = '[]');

-- EQUIPMENT_ALERT_ACKNOWLEDGE: 确认设备告警
UPDATE ai_intent_configs
SET description = '确认收到设备告警通知，开始处理',
    example_queries = '["确认设备告警", "收到设备告警", "我来处理设备告警", "知道设备问题了"]',
    negative_examples = '["查看设备告警", "设备告警列表", "解决设备告警"]'
WHERE intent_code = 'EQUIPMENT_ALERT_ACKNOWLEDGE' AND (example_queries IS NULL OR example_queries = '[]');

-- EQUIPMENT_ALERT_RESOLVE: 解决设备告警
UPDATE ai_intent_configs
SET description = '标记设备告警为已解决状态',
    example_queries = '["解决设备告警", "设备问题已解决", "设备故障已修复", "关闭设备告警"]',
    negative_examples = '["查看设备告警", "确认设备告警", "设备告警列表"]'
WHERE intent_code = 'EQUIPMENT_ALERT_RESOLVE' AND (example_queries IS NULL OR example_queries = '[]');

-- EQUIPMENT_ALERT_STATS: 设备告警统计
UPDATE ai_intent_configs
SET description = '查询设备告警统计数据，包括告警数量、类型分布、处理时效等',
    example_queries = '["设备告警统计", "设备故障统计", "告警数量分析", "设备告警趋势"]',
    negative_examples = '["设备告警列表", "确认告警", "解决告警"]'
WHERE intent_code = 'EQUIPMENT_ALERT_STATS' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- SCALE 类意图
-- ============================================

-- SCALE_ADD_MODEL: 添加秤型号
UPDATE ai_intent_configs
SET description = '添加新的秤品牌型号配置，用于设备注册时选择',
    example_queries = '["添加秤型号", "新增秤配置", "配置新秤品牌", "注册秤型号"]',
    negative_examples = '["添加秤设备", "秤列表", "秤故障"]'
WHERE intent_code = 'SCALE_ADD_MODEL' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_PROTOCOL_DETECT: 协议自动识别
UPDATE ai_intent_configs
SET description = '自动识别秤数据使用的通信协议，支持16进制样本数据输入',
    example_queries = '["识别协议", "这是什么协议", "自动识别数据格式", "协议检测"]',
    negative_examples = '["秤列表", "添加秤", "秤故障"]'
WHERE intent_code = 'SCALE_PROTOCOL_DETECT' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_CONFIG_GENERATE: AI生成秤配置
UPDATE ai_intent_configs
SET description = '根据用户描述的协议格式需求，AI自动生成秤协议配置',
    example_queries = '["生成协议配置", "自动配置协议", "创建协议模板", "新建协议配置"]',
    negative_examples = '["协议识别", "秤列表", "秤故障"]'
WHERE intent_code = 'SCALE_CONFIG_GENERATE' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_TROUBLESHOOT: 秤故障排查
UPDATE ai_intent_configs
SET description = '根据故障现象提供秤设备排查步骤和解决建议',
    example_queries = '["秤故障排查", "秤收不到数据", "秤数据乱码", "秤不工作怎么办"]',
    negative_examples = '["秤列表", "添加秤", "协议识别"]'
WHERE intent_code = 'SCALE_TROUBLESHOOT' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_LIST_PROTOCOLS: 列出可用协议
UPDATE ai_intent_configs
SET description = '列出工厂可用的秤通信协议列表',
    example_queries = '["有哪些协议", "支持什么协议", "协议列表", "可用协议"]',
    negative_examples = '["识别协议", "生成协议", "秤列表"]'
WHERE intent_code = 'SCALE_LIST_PROTOCOLS' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_TEST_PARSE: 测试数据解析
UPDATE ai_intent_configs
SET description = '使用指定协议测试解析秤数据，验证协议配置是否正确',
    example_queries = '["测试解析", "试一下解析", "验证协议", "测试协议"]',
    negative_examples = '["识别协议", "协议列表", "秤列表"]'
WHERE intent_code = 'SCALE_TEST_PARSE' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_SEARCH_MODEL: 搜索秤型号
UPDATE ai_intent_configs
SET description = '搜索和查询可用的秤品牌型号',
    example_queries = '["搜索秤", "有什么秤", "推荐秤型号", "秤选型"]',
    negative_examples = '["秤列表", "添加秤", "秤设备详情"]'
WHERE intent_code = 'SCALE_SEARCH_MODEL' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_MODEL_DETAIL: 查看秤详情
UPDATE ai_intent_configs
SET description = '查看秤型号的详细参数和规格',
    example_queries = '["秤详情", "秤参数", "秤规格", "型号详情"]',
    negative_examples = '["秤列表", "搜索秤", "添加秤"]'
WHERE intent_code = 'SCALE_MODEL_DETAIL' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_ADD_DEVICE: 添加秤设备
UPDATE ai_intent_configs
SET description = '通过自然语言描述添加新的秤设备，自动匹配协议',
    example_queries = '["添加一个秤", "新增电子秤", "接入秤设备", "安装新秤"]',
    negative_examples = '["秤列表", "秤详情", "删除秤"]'
WHERE intent_code = 'SCALE_ADD_DEVICE' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_ADD_DEVICE_VISION: 图片识别添加秤
UPDATE ai_intent_configs
SET description = '通过上传设备图片或铭牌照片，AI自动识别并配置秤设备',
    example_queries = '["拍照添加秤", "扫描铭牌", "识别设备图片", "上传图片添加"]',
    negative_examples = '["手动添加秤", "秤列表", "秤详情"]'
WHERE intent_code = 'SCALE_ADD_DEVICE_VISION' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_LIST_DEVICES: 列出秤设备 - 已在 V2026_01_15_01 中填充

-- SCALE_DEVICE_DETAIL: 查看秤设备详情
UPDATE ai_intent_configs
SET description = '查看指定秤设备的详细配置和状态信息',
    example_queries = '["秤设备详情", "这个秤的配置", "查看秤信息", "秤设备参数"]',
    negative_examples = '["秤列表", "添加秤", "删除秤"]'
WHERE intent_code = 'SCALE_DEVICE_DETAIL' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_UPDATE_DEVICE: 更新秤设备
UPDATE ai_intent_configs
SET description = '更新秤设备的配置参数',
    example_queries = '["修改秤配置", "更新秤参数", "调整秤设置", "修改秤设备"]',
    negative_examples = '["秤详情", "秤列表", "添加秤"]'
WHERE intent_code = 'SCALE_UPDATE_DEVICE' AND (example_queries IS NULL OR example_queries = '[]');

-- SCALE_DELETE_DEVICE: 删除秤设备
UPDATE ai_intent_configs
SET description = '删除或禁用秤设备',
    example_queries = '["删除秤", "移除秤设备", "下线秤", "禁用秤"]',
    negative_examples = '["添加秤", "秤列表", "秤详情"]'
WHERE intent_code = 'SCALE_DELETE_DEVICE' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- FORM 类意图
-- ============================================

-- FORM_GENERATION: 表单生成
UPDATE ai_intent_configs
SET description = '根据需求生成表单字段配置',
    example_queries = '["生成表单", "创建表单", "新建表单字段", "设计表单"]',
    negative_examples = '["表单校验", "表单建议", "查看表单"]'
WHERE intent_code = 'FORM_GENERATION' AND (example_queries IS NULL OR example_queries = '[]');

-- FORM_VALIDATION: 表单校验
UPDATE ai_intent_configs
SET description = '生成表单校验规则',
    example_queries = '["添加校验规则", "表单验证", "生成校验", "设置验证规则"]',
    negative_examples = '["生成表单", "表单建议", "查看表单"]'
WHERE intent_code = 'FORM_VALIDATION' AND (example_queries IS NULL OR example_queries = '[]');

-- FORM_SUGGESTION: 表单建议
UPDATE ai_intent_configs
SET description = '提供表单优化建议',
    example_queries = '["表单优化建议", "怎么改进表单", "表单设计建议", "推荐表单字段"]',
    negative_examples = '["生成表单", "表单校验", "查看表单"]'
WHERE intent_code = 'FORM_SUGGESTION' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- SCHEDULE 类意图
-- ============================================

-- SCHEDULE_OPTIMIZATION: 排程优化
UPDATE ai_intent_configs
SET description = '优化生产排程方案，提高效率',
    example_queries = '["优化排程", "排程调整", "改进排产", "排程怎么优化"]',
    negative_examples = '["查看排程", "排程列表", "创建排程"]'
WHERE intent_code = 'SCHEDULE_OPTIMIZATION' AND (example_queries IS NULL OR example_queries = '[]');

-- RESOURCE_ALLOCATION: 资源分配
UPDATE ai_intent_configs
SET description = '优化资源分配建议，包括人员和设备',
    example_queries = '["资源分配建议", "人员怎么安排", "设备分配", "优化资源"]',
    negative_examples = '["查看资源", "资源列表", "排程优化"]'
WHERE intent_code = 'RESOURCE_ALLOCATION' AND (example_queries IS NULL OR example_queries = '[]');

-- CAPACITY_PLANNING: 产能规划
UPDATE ai_intent_configs
SET description = '产能规划和瓶颈分析',
    example_queries = '["产能规划", "瓶颈分析", "容量规划", "产能怎么提升"]',
    negative_examples = '["查看产能", "产能数据", "排程优化"]'
WHERE intent_code = 'CAPACITY_PLANNING' AND (example_queries IS NULL OR example_queries = '[]');

-- URGENT_INSERT: 紧急插单
UPDATE ai_intent_configs
SET description = '紧急插单影响分析，评估插单对现有排程的影响',
    example_queries = '["紧急插单", "加急订单", "插单影响分析", "能不能插单"]',
    negative_examples = '["查看订单", "排程优化", "取消订单"]'
WHERE intent_code = 'URGENT_INSERT' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================
-- SYSTEM 类意图
-- ============================================

-- SYSTEM_REPORT: 系统报表
UPDATE ai_intent_configs
SET description = '生成系统报表和汇总',
    example_queries = '["系统报表", "生成报表", "汇总报告", "数据报表"]',
    negative_examples = '["查看数据", "系统配置", "帮助"]'
WHERE intent_code = 'SYSTEM_REPORT' AND (example_queries IS NULL OR example_queries = '[]');

-- SYSTEM_CONFIG: 系统配置
UPDATE ai_intent_configs
SET description = '修改系统配置，需要审批',
    example_queries = '["修改配置", "系统设置", "更改参数", "调整配置"]',
    negative_examples = '["查看配置", "配置列表", "帮助"]'
WHERE intent_code = 'SYSTEM_CONFIG' AND (example_queries IS NULL OR example_queries = '[]');

-- USER_QUERY: 用户咨询
UPDATE ai_intent_configs
SET description = '回答用户使用问题，提供帮助',
    example_queries = '["怎么使用", "如何操作", "帮我看看", "什么意思"]',
    negative_examples = '["查看数据", "修改配置", "生成报表"]'
WHERE intent_code = 'USER_QUERY' AND (example_queries IS NULL OR example_queries = '[]');

-- ============================================================
-- 完成
-- ============================================================
