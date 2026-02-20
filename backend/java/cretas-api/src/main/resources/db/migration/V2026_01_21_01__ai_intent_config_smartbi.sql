-- =============================================================================
-- SmartBI 意图配置统一迁移
-- 版本: V2026_01_21_01
-- 描述: 添加 SmartBI 专用字段并初始化 SmartBI 意图配置数据
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Part 1: 添加 SmartBI 专用字段（如果不存在）
-- -----------------------------------------------------------------------------

-- 添加 chart_type 字段 (推荐图表类型)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND COLUMN_NAME = 'chart_type');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE ai_intent_configs ADD COLUMN chart_type VARCHAR(32) NULL COMMENT ''推荐图表类型''',
    'SELECT ''chart_type column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 required_entities 字段 (必需实体类型)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND COLUMN_NAME = 'required_entities');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE ai_intent_configs ADD COLUMN required_entities TEXT NULL COMMENT ''必需实体类型 JSON数组''',
    'SELECT ''required_entities column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 confidence_boost 字段 (置信度提升值)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND COLUMN_NAME = 'confidence_boost');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE ai_intent_configs ADD COLUMN confidence_boost DECIMAL(3,2) DEFAULT 0.00 COMMENT ''置信度提升值''',
    'SELECT ''confidence_boost column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- Part 2: 初始化 SmartBI 意图配置数据
-- -----------------------------------------------------------------------------

-- 删除已存在的 SmartBI 意图（防止重复）
DELETE FROM ai_intent_configs WHERE intent_category = 'SMARTBI' AND deleted_at IS NULL;

-- ===================== 销售查询类意图 =====================

-- 销售概览
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'sales_overview', '销售概览', 'SMARTBI', 'LOW',
 '["销售情况", "销售概览", "销售总览", "销售数据", "卖了多少", "营收情况", "销售怎么样", "销售如何", "业绩情况", "总体销售", "销售额", "营业额", "销售收入", "总销售", "销量多少", "卖多少", "销售额是多少", "营业额是多少", "卖了多少钱", "收入多少", "业绩多少", "做了多少业绩", "今天销售", "本月销售", "这个月销售"]',
 '.*(销售.*(情况|概览|总览|怎么样|如何)|(销售额|营业额|营收|收入).*是?多少|(本月|这个月|今天|昨天|上月|本周).*(销售|营收|收入)|(卖|销售)了?(多少|几)|多少.*(销售额|营业额|收入)).*',
 '查看整体销售情况，包括销售额、销量等概览数据',
 'card', '["time"]', 0.10, 100, true, NOW(), NOW());

-- 销售排名
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'sales_ranking', '销售排名', 'SMARTBI', 'LOW',
 '["销售排名", "销售TOP", "销量排名", "卖得最好", "销量第一", "前几名", "排行榜", "销售冠军", "最高销量", "业绩排名", "销售员排名", "业务员排名", "谁卖得最多", "谁业绩最好", "销售员业绩"]',
 '.*(销售.*(排名|排行|TOP\\d*)|卖得?最(好|多)|谁.*销售.*最(高|好)|(销售员|业务员|人员).*(排名|排行|业绩)|(排名|排行).*(销售员|业务员|人员)|谁.*业绩.*最(好|高)).*',
 '查看销售排名数据，如产品销售排名、销售员业绩排名',
 'bar_chart', '["time"]', 0.05, 95, true, NOW(), NOW());

-- 销售趋势
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'sales_trend', '销售趋势', 'SMARTBI', 'LOW',
 '["销售趋势", "销售走势", "销量变化", "增长趋势", "销售曲线", "走势图", "趋势分析", "变化趋势", "销售波动"]',
 '.*(销售.*(趋势|走势|变化)|(趋势|走势).*销售|(最近|近).*(天|周|月).*(趋势|走势|变化)|(日|周|月)度.*(趋势|走势|变化)).*',
 '查看销售趋势变化，按时间维度展示销售数据变化',
 'line_chart', '["time"]', 0.10, 90, true, NOW(), NOW());

-- 部门业绩
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'dept_performance', '部门业绩', 'SMARTBI', 'LOW',
 '["部门业绩", "部门表现", "各部门销售", "团队业绩", "部门销量", "哪个部门", "部门数据", "团队表现", "部门情况"]',
 '.*(部门.*(业绩|表现|销售|数据)|各.*部门|哪个?部门).*',
 '查看部门业绩表现，按部门维度展示销售数据',
 'bar_chart', '["department", "time"]', 0.15, 85, true, NOW(), NOW());

-- 区域分析
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'region_analysis', '区域分析', 'SMARTBI', 'LOW',
 '["区域分析", "区域销售", "各地区销量", "地区分布", "区域数据", "哪个区域", "城市销售", "地区排名", "区域表现", "各区域销售", "区域业绩", "各省销售", "省份销售", "城市业绩", "地区业绩", "区域情况", "地区情况"]',
 '.*(区域.*(分析|销售|数据|分布)|各.*区域|哪个?(区域|地区|城市)).*',
 '查看区域销售分布，按区域维度展示销售数据',
 'pie_chart', '["region", "time"]', 0.20, 85, true, NOW(), NOW());

-- ===================== 财务查询类意图 =====================

-- 财务概览
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'finance_overview', '财务概览', 'SMARTBI', 'MEDIUM',
 '["财务概览", "财务情况", "财务报表", "收支情况", "财务数据", "财务怎么样", "资金情况", "财务状况"]',
 '.*(财务.*(概览|情况|报表|怎么样|如何)|收支.*(情况|分析)).*',
 '查看财务整体情况，包括收入、支出、利润等',
 'card', '["time"]', 0.10, 80, true, NOW(), NOW());

-- 利润分析
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'profit_analysis', '利润分析', 'SMARTBI', 'MEDIUM',
 '["利润分析", "利润率", "毛利", "净利润", "利润情况", "赚了多少", "盈利情况", "利润多少"]',
 '.*(利润.*(分析|情况|率)|毛利|净利|赚了?多少|盈利).*',
 '查看利润相关数据，包括毛利、净利润、利润率等',
 'line_chart', '["time"]', 0.10, 75, true, NOW(), NOW());

-- 成本分析
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'cost_analysis', '成本分析', 'SMARTBI', 'MEDIUM',
 '["成本分析", "成本构成", "费用分析", "成本占比", "成本情况", "花了多少", "开支情况", "费用明细"]',
 '.*(成本.*(分析|构成|占比|情况)|费用.*(分析|明细)|花了?多少|开支).*',
 '查看成本相关数据，包括成本构成、费用分析等',
 'pie_chart', '["time"]', 0.10, 75, true, NOW(), NOW());

-- 应收账款
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'receivable', '应收账款', 'SMARTBI', 'MEDIUM',
 '["应收账款", "欠款", "账期", "回款情况", "应收款", "还有多少没收", "待收款", "账龄"]',
 '.*(应收.*(账款|款)|欠款|账期|回款|待收款|账龄).*',
 '查看应收账款情况，包括欠款、账期、回款等',
 'table', '["time"]', 0.05, 70, true, NOW(), NOW());

-- ===================== 产品查询类意图 =====================

-- 产品分析
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'product_analysis', '产品分析', 'SMARTBI', 'LOW',
 '["产品分析", "产品销量", "产品表现", "哪个产品", "商品分析", "品类分析", "产品数据", "SKU分析"]',
 '.*(产品.*(分析|销量|表现|数据)|商品分析|品类分析|SKU分析).*',
 '查看产品相关数据，包括产品销量、表现等',
 'bar_chart', '["product", "time"]', 0.10, 80, true, NOW(), NOW());

-- 库存查询
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'inventory', '库存查询', 'SMARTBI', 'LOW',
 '["库存情况", "库存量", "存货", "库存分析", "库存数据", "还有多少货", "库存多少", "缺货"]',
 '.*(库存.*(情况|量|分析|数据|多少)|存货|还有多少货|缺货).*',
 '查看库存相关数据，包括库存量、缺货等',
 'table', '["product"]', 0.05, 75, true, NOW(), NOW());

-- ===================== 生产查询类意图 =====================

-- OEE概览
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'oee_overview', 'OEE概览', 'SMARTBI', 'LOW',
 '["OEE", "oee", "设备效率", "综合效率", "产线效率", "设备综合效率", "OEE是多少", "今日OEE", "本月OEE", "设备效率怎么样"]',
 '.*(OEE|oee|设备.*效率|综合效率|产线效率).*',
 '查看设备综合效率 OEE 数据',
 'gauge', '["time"]', 0.10, 80, true, NOW(), NOW());

-- 生产效率
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'production_efficiency', '生产效率', 'SMARTBI', 'LOW',
 '["生产效率", "产能", "产量", "生产情况", "生产数据", "产了多少", "生产了多少", "日产量", "月产量"]',
 '.*(生产.*(效率|情况|数据)|产能|产量|产了?多少).*',
 '查看生产效率数据，包括产能、产量等',
 'line_chart', '["time"]', 0.05, 75, true, NOW(), NOW());

-- 设备利用率
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'equipment_utilization', '设备利用率', 'SMARTBI', 'LOW',
 '["设备利用率", "设备使用", "开机率", "运行时长", "设备运行", "设备状态", "稼动率"]',
 '.*(设备.*(利用率|使用|运行|状态)|开机率|稼动率|运行时长).*',
 '查看设备使用情况，包括设备利用率、开机率等',
 'bar_chart', '["time"]', 0.05, 70, true, NOW(), NOW());

-- ===================== 质量查询类意图 =====================

-- 质量汇总
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'quality_summary', '质量汇总', 'SMARTBI', 'LOW',
 '["质量情况", "质量概览", "合格率", "质量分析", "质量数据", "良品率", "质量怎么样", "质量报告"]',
 '.*(质量.*(情况|概览|分析|数据|怎么样)|合格率|良品率).*',
 '查看质量整体情况，包括合格率、良品率等',
 'card', '["time"]', 0.10, 80, true, NOW(), NOW());

-- 缺陷分析
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'defect_analysis', '缺陷分析', 'SMARTBI', 'LOW',
 '["缺陷分析", "不良品", "缺陷率", "质量问题", "不合格品", "缺陷类型", "不良原因"]',
 '.*(缺陷.*(分析|率|类型)|不良.*(品|率|原因)|质量问题|不合格品).*',
 '查看缺陷类型和分布，分析质量问题原因',
 'pie_chart', '["time"]', 0.10, 75, true, NOW(), NOW());

-- 返工成本
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'rework_cost', '返工成本', 'SMARTBI', 'MEDIUM',
 '["返工成本", "返工率", "报废", "质量损失", "返工情况", "报废成本", "质量成本"]',
 '.*(返工.*(成本|率|情况)|报废.*(成本)?|质量.*(损失|成本)).*',
 '查看返工和报废成本，分析质量损失',
 'bar_chart', '["time"]', 0.05, 70, true, NOW(), NOW());

-- ===================== 库存健康类意图 =====================

-- 库存健康
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'inventory_health', '库存健康', 'SMARTBI', 'LOW',
 '["库存健康", "库存状况", "周转率", "库存周转", "库存效率", "库存管理"]',
 '.*(库存.*(健康|状况|周转|效率|管理)|周转率).*',
 '查看库存健康状况，包括周转率等',
 'gauge', '["time"]', 0.05, 70, true, NOW(), NOW());

-- 过期风险
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'expiry_risk', '过期风险', 'SMARTBI', 'LOW',
 '["过期风险", "即将过期", "效期预警", "保质期", "临期商品", "近效期", "效期管理"]',
 '.*(过期.*(风险)?|即将过期|效期.*(预警|管理)|保质期|临期|近效期).*',
 '查看库存过期预警，分析效期风险',
 'table', '[]', 0.05, 70, true, NOW(), NOW());

-- 损耗分析
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'loss_analysis', '损耗分析', 'SMARTBI', 'LOW',
 '["损耗分析", "库存损失", "报损", "损耗率", "损耗情况", "库存损耗", "损失分析"]',
 '.*(损耗.*(分析|率|情况)|库存.*(损失|损耗)|报损|损失分析).*',
 '查看库存损耗情况，分析损耗原因',
 'pie_chart', '["time"]', 0.05, 65, true, NOW(), NOW());

-- ===================== 销售深化类意图 =====================

-- 销售漏斗
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'sales_funnel', '销售漏斗', 'SMARTBI', 'LOW',
 '["销售漏斗", "转化率", "销售管道", "成交漏斗", "漏斗分析", "转化漏斗", "销售转化"]',
 '.*(销售.*(漏斗|管道|转化)|转化.*(率|漏斗)|成交漏斗|漏斗分析).*',
 '查看销售转化漏斗，分析各阶段转化率',
 'funnel', '["time"]', 0.10, 70, true, NOW(), NOW());

-- 客户RFM
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'customer_rfm', '客户RFM', 'SMARTBI', 'MEDIUM',
 '["RFM", "rfm", "客户分群", "客户价值", "客户分析", "客户分层", "客户画像", "高价值客户"]',
 '.*(RFM|rfm|客户.*(分群|价值|分析|分层|画像)|高价值客户).*',
 '查看客户RFM分群，分析客户价值',
 'scatter', '[]', 0.10, 65, true, NOW(), NOW());

-- 产品ABC
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'product_abc', '产品ABC', 'SMARTBI', 'LOW',
 '["ABC分析", "abc分析", "产品分类", "产品贡献", "二八法则", "产品ABC", "SKU分类", "销量分类"]',
 '.*(ABC分析|abc分析|产品.*(分类|贡献|ABC)|二八法则|SKU分类|销量分类).*',
 '查看产品ABC分类，分析产品贡献度',
 'bar_chart', '["time"]', 0.05, 65, true, NOW(), NOW());

-- ===================== 采购查询类意图 =====================

-- 采购概览
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'procurement_overview', '采购概览', 'SMARTBI', 'LOW',
 '["采购情况", "采购概览", "采购分析", "进货情况", "采购数据", "采购报表", "进货分析"]',
 '.*(采购.*(情况|概览|分析|数据|报表)|进货.*(情况|分析)).*',
 '查看采购整体情况，包括采购金额、订单等',
 'card', '["time"]', 0.05, 70, true, NOW(), NOW());

-- 供应商评估
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'supplier_evaluation', '供应商评估', 'SMARTBI', 'LOW',
 '["供应商评估", "供应商表现", "供应商排名", "供应商分析", "供应商考核", "供应商评分", "供应商管理"]',
 '.*(供应商.*(评估|表现|排名|分析|考核|评分|管理)).*',
 '查看供应商表现，进行供应商评估',
 'bar_chart', '["time"]', 0.10, 65, true, NOW(), NOW());

-- 采购成本
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'purchase_cost', '采购成本', 'SMARTBI', 'MEDIUM',
 '["采购成本", "进货成本", "采购价格", "成本趋势", "采购支出", "进货价格", "采购费用"]',
 '.*(采购.*(成本|价格|支出|费用)|进货.*(成本|价格)|成本趋势).*',
 '查看采购成本分析，包括采购价格趋势等',
 'line_chart', '["time"]', 0.05, 65, true, NOW(), NOW());

-- ===================== 财务深化类意图 =====================

-- 现金流
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'cash_flow', '现金流', 'SMARTBI', 'HIGH',
 '["现金流", "资金流向", "资金情况", "现金情况", "资金流", "现金流量", "资金分析"]',
 '.*(现金.*(流|情况|流量)|资金.*(流向|情况|流|分析)).*',
 '查看现金流分析，包括资金流向等',
 'waterfall', '["time"]', 0.10, 60, true, NOW(), NOW());

-- 财务比率
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'financial_ratios', '财务比率', 'SMARTBI', 'MEDIUM',
 '["财务比率", "财务指标", "ROE", "ROA", "流动比率", "财务健康", "财务分析", "盈利能力"]',
 '.*(财务.*(比率|指标|健康|分析)|ROE|ROA|流动比率|盈利能力).*',
 '查看财务比率分析，包括 ROE、ROA 等指标',
 'radar', '["time"]', 0.05, 60, true, NOW(), NOW());

-- ===================== 对比类意图 =====================

-- 时期对比
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'compare_period', '时期对比', 'SMARTBI', 'LOW',
 '["环比", "同比", "对比", "去年同期", "上个月对比", "比较", "增长", "下降", "变化多少"]',
 '.*((同比|环比)|和?(去年|上月|上周).*对?比|比.*去年).*',
 '对比不同时间段的数据，如环比、同比分析',
 'compare_bar', '["time"]', 0.15, 85, true, NOW(), NOW());

-- 部门对比
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'compare_dept', '部门对比', 'SMARTBI', 'LOW',
 '["部门对比", "部门比较", "哪个部门更好", "团队PK", "部门之间", "对比部门"]',
 '.*(部门.*(对比|比较|之间)|哪个部门.*更?好|团队PK|对比部门).*',
 '对比不同部门的数据',
 'compare_bar', '["department"]', 0.15, 80, true, NOW(), NOW());

-- 区域对比
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'compare_region', '区域对比', 'SMARTBI', 'LOW',
 '["区域对比", "地区比较", "哪个区域更好", "城市对比", "区域之间", "对比区域"]',
 '.*(区域.*(对比|比较|之间)|地区比较|哪个(区域|地区|城市).*更?好|城市对比|对比区域).*',
 '对比不同区域的数据',
 'compare_bar', '["region"]', 0.15, 80, true, NOW(), NOW());

-- ===================== 下钻类意图 =====================

-- 数据下钻
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'drill_down', '数据下钻', 'SMARTBI', 'LOW',
 '["详情", "明细", "下钻", "展开", "具体看看", "详细数据", "细节", "深入分析"]',
 '.*(看.*详[细情]|具体.*看看|展开).*',
 '查看数据细节，进行数据下钻分析',
 'table', '[]', 0.05, 70, true, NOW(), NOW());

-- ===================== 预测类意图 =====================

-- 预测分析
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'forecast', '预测分析', 'SMARTBI', 'MEDIUM',
 '["预测", "预估", "预计", "会怎样", "下个月会", "未来趋势", "预测分析", "预期"]',
 '.*(预[测计估]|下个?月.*会|未来.*趋势).*',
 '预测未来趋势，进行预测分析',
 'line_chart', '["time"]', 0.10, 75, true, NOW(), NOW());

-- ===================== 聚合类意图 =====================

-- 汇总统计
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, keywords, regex_pattern, description, chart_type, required_entities, confidence_boost, priority, is_active, created_at, updated_at) VALUES
(UUID(), 'aggregate_summary', '汇总统计', 'SMARTBI', 'LOW',
 '["汇总", "总计", "合计", "一共", "总共", "加起来", "累计", "统计"]',
 '.*(汇总|总计|合计|一共|总共|加起来|累计|统计).*',
 '聚合统计查询，计算汇总数据',
 'card', '["time"]', 0.05, 60, true, NOW(), NOW());

-- =============================================================================
-- 迁移完成日志
-- =============================================================================
SELECT CONCAT('SmartBI 意图配置迁移完成，共插入 ', COUNT(*), ' 条记录')
FROM ai_intent_configs WHERE intent_category = 'SMARTBI' AND deleted_at IS NULL;
