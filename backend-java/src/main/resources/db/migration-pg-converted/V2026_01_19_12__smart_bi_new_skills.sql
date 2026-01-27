-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_19_12__smart_bi_new_skills.sql
-- Conversion date: 2026-01-26 18:48:52
-- WARNING: This file requires manual review!
-- ============================================

-- SmartBI 新增技能注册
-- Version: 1.0
-- Date: 2026-01-19
-- Description: 注册新的分析技能模块

-- ============================================
-- 1. 生产OEE分析技能
-- ============================================
INSERT INTO smart_bi_skill (name, display_name, description, version, triggers, tools, context_needed, prompt_template, config, enabled) VALUES
(
    'production-oee-analysis',
    '生产OEE分析',
    '分析设备综合效率(OEE)，包括可用率、性能率、质量率的计算与趋势分析，支持产线对比和异常检测',
    '1.0.0',
    '["OEE", "设备效率", "综合效率", "产线效率", "设备OEE", "OEE分析", "生产效率", "产能", "产量", "生产情况", "设备利用率", "设备使用", "开机率", "运行时长"]',
    '["oee_calculator", "production_data_query", "trend_analyzer", "anomaly_detector"]',
    '["factoryId", "dateRange", "productionLine", "equipment"]',
    '你是一位专业的生产效率分析师。请根据以下OEE数据进行分析：

## 数据概览
{{oee_summary}}

## 分析要点
1. 整体OEE水平评估（世界级标准85%）
2. 三大损失分析：可用性损失、性能损失、质量损失
3. 产线/设备对比
4. 趋势变化分析
5. 改善建议

请用专业但易懂的语言进行分析，提供具体可行的改善建议。',
    '{"category": "PRODUCTION", "priority": 1, "requiredPermission": "smartbi:production:view", "chartTypes": ["line", "bar", "gauge"], "kpiMetrics": ["oee", "availability", "performance", "quality_rate"]}',
    TRUE
),

-- ============================================
-- 2. 质量分析技能
-- ============================================
(
    'quality-analysis',
    '质量分析',
    '分析产品质量数据，包括缺陷类型分布、严重程度、根因分析、返工报废成本统计',
    '1.0.0',
    '["质量情况", "质量概览", "合格率", "质量分析", "缺陷分析", "不良品", "缺陷率", "质量问题", "返工成本", "返工率", "报废", "质量损失"]',
    '["quality_data_query", "defect_analyzer", "pareto_analyzer", "cost_calculator"]',
    '["factoryId", "dateRange", "productLine", "defectType"]',
    '你是一位专业的质量管理专家。请根据以下质量数据进行分析：

## 质量数据概览
{{quality_summary}}

## 缺陷分布
{{defect_distribution}}

## 返工/报废成本
{{rework_scrap_cost}}

## 分析要点
1. 整体质量水平评估
2. 主要缺陷类型帕累托分析
3. 严重缺陷根因分析
4. 质量成本（COPQ）评估
5. 改善优先级建议

请提供数据支撑的分析结论和具体改善建议。',
    '{"category": "QUALITY", "priority": 1, "requiredPermission": "smartbi:quality:view", "chartTypes": ["pareto", "pie", "bar", "trend"], "kpiMetrics": ["pass_rate", "defect_rate", "rework_cost", "scrap_cost"]}',
    TRUE
),

-- ============================================
-- 3. 库存健康分析技能
-- ============================================
(
    'inventory-health-analysis',
    '库存健康分析',
    '分析库存健康状况，包括库存周转、过期风险预警、ABC分类、损耗分析',
    '1.0.0',
    '["库存健康", "库存状况", "库存分析", "库存情况", "过期风险", "即将过期", "效期预警", "保质期", "损耗分析", "库存损失", "报损", "损耗率"]',
    '["inventory_data_query", "expiry_analyzer", "turnover_calculator", "abc_classifier"]',
    '["factoryId", "warehouse", "materialType", "expiryThreshold"]',
    '你是一位专业的库存管理专家。请根据以下库存数据进行健康分析：

## 库存概览
{{inventory_summary}}

## 过期风险
{{expiry_risk}}

## ABC分类
{{abc_classification}}

## 分析要点
1. 库存周转率评估
2. 过期风险预警（7天/15天/30天）
3. 呆滞库存识别
4. ABC分类优化建议
5. 库存优化建议

请提供明确的风险预警和处理建议。',
    '{"category": "INVENTORY", "priority": 1, "requiredPermission": "smartbi:inventory:view", "chartTypes": ["pie", "bar", "table", "heatmap"], "kpiMetrics": ["turnover_rate", "expiry_rate", "slow_moving_rate", "inventory_value"]}',
    TRUE
),

-- ============================================
-- 4. 销售漏斗分析技能
-- ============================================
(
    'sales-funnel-analysis',
    '销售漏斗分析',
    '分析销售转化漏斗，包括各阶段转化率、客户RFM分群、产品ABC分类',
    '1.0.0',
    '["销售漏斗", "转化率", "销售管道", "成交漏斗", "RFM", "客户分群", "客户价值", "客户分析", "ABC分析", "产品分类", "产品贡献", "二八法则"]',
    '["sales_funnel_query", "rfm_analyzer", "abc_product_analyzer", "conversion_calculator"]',
    '["factoryId", "dateRange", "salesChannel", "customerSegment"]',
    '你是一位专业的销售分析师。请根据以下销售数据进行漏斗分析：

## 销售漏斗
{{funnel_data}}

## 客户RFM分群
{{rfm_segments}}

## 产品ABC分类
{{product_abc}}

## 分析要点
1. 各阶段转化率分析
2. 转化瓶颈识别
3. 高价值客户特征
4. 重点产品贡献分析
5. 销售策略建议

请提供数据驱动的销售优化建议。',
    '{"category": "SALES", "priority": 2, "requiredPermission": "smartbi:sales:view", "chartTypes": ["funnel", "pie", "bar", "scatter"], "kpiMetrics": ["conversion_rate", "customer_lifetime_value", "rfm_score", "product_contribution"]}',
    TRUE
),

-- ============================================
-- 5. 采购分析技能
-- ============================================
(
    'procurement-analysis',
    '采购分析',
    '分析采购数据，包括采购概览、供应商评估、采购成本趋势、交期准时率',
    '1.0.0',
    '["采购情况", "采购概览", "采购分析", "进货情况", "供应商评估", "供应商表现", "供应商排名", "供应商分析", "采购成本", "进货成本", "采购价格", "成本趋势"]',
    '["purchase_data_query", "supplier_evaluator", "cost_trend_analyzer", "delivery_analyzer"]',
    '["factoryId", "dateRange", "supplierType", "materialCategory"]',
    '你是一位专业的采购分析师。请根据以下采购数据进行分析：

## 采购概览
{{purchase_summary}}

## 供应商评估
{{supplier_evaluation}}

## 成本趋势
{{cost_trend}}

## 分析要点
1. 采购金额与数量趋势
2. 供应商综合评分（质量、交期、价格、服务）
3. 采购成本波动分析
4. 供应商风险评估
5. 采购优化建议

请提供供应商管理和成本控制的具体建议。',
    '{"category": "PROCUREMENT", "priority": 2, "requiredPermission": "smartbi:procurement:view", "chartTypes": ["bar", "line", "radar", "table"], "kpiMetrics": ["purchase_amount", "supplier_score", "on_time_rate", "price_variance"]}',
    TRUE
),

-- ============================================
-- 6. 财务比率分析技能
-- ============================================
(
    'financial-ratios-analysis',
    '财务比率分析',
    '分析财务比率指标，包括现金流、盈利能力、偿债能力、营运能力等关键财务指标',
    '1.0.0',
    '["现金流", "资金流向", "资金情况", "现金情况", "财务比率", "财务指标", "ROE", "ROA", "流动比率", "资产负债率", "毛利率", "净利率"]',
    '["finance_data_query", "ratio_calculator", "cashflow_analyzer", "trend_analyzer"]',
    '["factoryId", "dateRange", "reportType"]',
    '你是一位专业的财务分析师。请根据以下财务数据进行比率分析：

## 现金流概览
{{cashflow_summary}}

## 财务比率
{{financial_ratios}}

## 趋势对比
{{ratio_trends}}

## 分析要点
1. 现金流健康度评估
2. 盈利能力分析（毛利率、净利率、ROE、ROA）
3. 偿债能力分析（流动比率、速动比率、资产负债率）
4. 营运能力分析（应收账款周转、存货周转）
5. 财务风险预警

请提供专业的财务健康评估和改善建议。',
    '{"category": "FINANCE", "priority": 2, "requiredPermission": "smartbi:finance:view", "chartTypes": ["line", "bar", "waterfall", "gauge"], "kpiMetrics": ["gross_margin", "net_margin", "roe", "roa", "current_ratio", "quick_ratio"]}',
    TRUE
);

-- ============================================
-- 7. 更新已有技能的触发词（如果存在）
-- ============================================
-- 确保销售概览技能包含新的触发词
UPDATE smart_bi_skill
SET triggers = '["销售情况", "销售概览", "销售总览", "卖了多少", "营收情况", "销售数据", "今天销售", "本月销售", "销售报表"]'
WHERE name = 'sales-overview-analysis'
AND triggers NOT LIKE '%销售报表%';

-- 确保财务概览技能包含新的触发词
UPDATE smart_bi_skill
SET triggers = '["财务概览", "财务情况", "财务报表", "收支情况", "财务数据", "收入支出", "盈亏情况"]'
WHERE name = 'finance-overview-analysis'
AND triggers NOT LIKE '%盈亏情况%';

-- ============================================
-- 8. 创建技能分类视图（便于前端展示）
-- ============================================
CREATE OR REPLACE VIEW v_smart_bi_skill_categories AS
SELECT
    JSON_UNQUOTE(JSON_EXTRACT(config, '$.category')) AS category,
    COUNT(*) AS skill_count,
    -- TODO: Convert to STRING_AGG
GROUP_CONCAT(display_name ORDER BY JSON_EXTRACT(config, '$.priority') SEPARATOR ', ') AS skills
FROM smart_bi_skill
WHERE enabled = TRUE
GROUP BY JSON_UNQUOTE(JSON_EXTRACT(config, '$.category'))
ORDER BY MIN(JSON_EXTRACT(config, '$.priority'));

-- ============================================
-- 9. 创建意图-技能映射表（提升意图匹配效率）
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_intent_skill_mapping (
    id BIGINT PRIMARY KEY ,
    intent_code VARCHAR(100) NOT NULL COMMENT '意图代码',
    skill_name VARCHAR(100) NOT NULL COMMENT '技能名称',
    match_priority INT DEFAULT 1 COMMENT '匹配优先级',
    match_confidence DECIMAL(3,2) DEFAULT 1.00 COMMENT '匹配置信度',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_intent_skill (intent_code, skill_name),
    INDEX idx_intent (intent_code),
    INDEX idx_skill (skill_name),
    FOREIGN KEY (skill_name) REFERENCES smart_bi_skill(name) ON DELETE CASCADE
);

-- 插入意图-技能映射数据
INSERT INTO smart_bi_intent_skill_mapping (intent_code, skill_name, match_priority, match_confidence) VALUES
-- 生产类意图
('oee_overview', 'production-oee-analysis', 1, 1.00),
('production_efficiency', 'production-oee-analysis', 2, 0.90),
('equipment_utilization', 'production-oee-analysis', 3, 0.85),

-- 质量类意图
('quality_summary', 'quality-analysis', 1, 1.00),
('defect_analysis', 'quality-analysis', 1, 1.00),
('rework_cost', 'quality-analysis', 2, 0.90),

-- 库存类意图
('inventory_health', 'inventory-health-analysis', 1, 1.00),
('expiry_risk', 'inventory-health-analysis', 1, 1.00),
('loss_analysis', 'inventory-health-analysis', 2, 0.90),

-- 销售深化类意图
('sales_funnel', 'sales-funnel-analysis', 1, 1.00),
('customer_rfm', 'sales-funnel-analysis', 1, 1.00),
('product_abc', 'sales-funnel-analysis', 2, 0.90),

-- 采购类意图
('procurement_overview', 'procurement-analysis', 1, 1.00),
('supplier_evaluation', 'procurement-analysis', 1, 1.00),
('purchase_cost', 'procurement-analysis', 2, 0.90),

-- 财务深化类意图
('cash_flow', 'financial-ratios-analysis', 1, 1.00),
('financial_ratios', 'financial-ratios-analysis', 1, 1.00);
