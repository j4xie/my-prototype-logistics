-- ============================================================================
-- SmartBI 财务分析维度扩展 - 指标公式配置
--
-- 根据行业标准财务分析框架，添加完整的财务指标体系：
--   Phase 1: 盈利能力指标 (ROA/ROE/EBITDA)
--   Phase 4: 运营效率指标 (周转率)
--   Phase 6: 杜邦分析指标
--   Phase 7: CVP分析指标 (成本-量-利)
--
-- 参考来源：
--   - ThoughtSpot: 21 financial KPIs
--   - NetSuite: 30 Financial Metrics
--   - Oracle: 20 Key CFO KPIs
--   - 知乎: 2025年财务分析九大维度
--
-- @author Cretas Team
-- @version 1.0.0
-- @since 2026-01-21
-- ============================================================================

-- ============================================================================
-- Phase 1: 盈利能力指标扩展
-- ============================================================================

-- ROA 资产回报率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'roa', '资产回报率', 'DERIVED', '#netProfit / #totalAssets * 100', '%', '0.00', 'AVG',
       '净利润/平均总资产×100%，衡量企业资产的盈利效率', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'roa' AND factory_id IS NULL
);

-- ROE 净资产收益率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'roe', '净资产收益率', 'DERIVED', '#netProfit / #shareholderEquity * 100', '%', '0.00', 'AVG',
       '净利润/股东权益×100%，衡量股东投资回报率', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'roe' AND factory_id IS NULL
);

-- EBITDA 息税折旧摊销前利润
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'ebitda', 'EBITDA', 'DERIVED', '#netProfit + #interestExpense + #taxExpense + #depreciation + #amortization', '元', '#,##0.00', 'SUM',
       '息税折旧摊销前利润，反映企业核心经营能力', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'ebitda' AND factory_id IS NULL
);

-- EBITDA 利润率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'ebitda_margin', 'EBITDA利润率', 'DERIVED', '#ebitda / #salesAmount * 100', '%', '0.00', 'AVG',
       'EBITDA/销售额×100%，衡量核心经营盈利能力', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'ebitda_margin' AND factory_id IS NULL
);

-- 营业利润率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'operating_margin', '营业利润率', 'DERIVED', '#operatingProfit / #salesAmount * 100', '%', '0.00', 'AVG',
       '营业利润/销售额×100%，衡量主营业务盈利能力', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'operating_margin' AND factory_id IS NULL
);

-- ============================================================================
-- Phase 2: 流动性指标 (需要数据扩展后使用)
-- ============================================================================

-- 流动比率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'current_ratio', '流动比率', 'DERIVED', '#currentAssets / #currentLiabilities', '倍', '0.00', 'AVG',
       '流动资产/流动负债，衡量短期偿债能力，一般应≥2', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'current_ratio' AND factory_id IS NULL
);

-- 速动比率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'quick_ratio', '速动比率', 'DERIVED', '(#currentAssets - #inventory) / #currentLiabilities', '倍', '0.00', 'AVG',
       '(流动资产-存货)/流动负债，更严格的短期偿债能力指标，一般应≥1', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'quick_ratio' AND factory_id IS NULL
);

-- 现金比率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'cash_ratio', '现金比率', 'DERIVED', '#cashEquivalents / #currentLiabilities', '倍', '0.00', 'AVG',
       '现金及等价物/流动负债，最保守的短期偿债能力指标', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'cash_ratio' AND factory_id IS NULL
);

-- ============================================================================
-- Phase 3: 偿债能力指标 (需要数据扩展后使用)
-- ============================================================================

-- 资产负债率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'debt_ratio', '资产负债率', 'DERIVED', '#totalLiabilities / #totalAssets * 100', '%', '0.00', 'AVG',
       '总负债/总资产×100%，衡量企业财务杠杆水平', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'debt_ratio' AND factory_id IS NULL
);

-- 利息保障倍数
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'interest_coverage', '利息保障倍数', 'DERIVED', '#ebit / #interestExpense', '倍', '0.00', 'AVG',
       'EBIT/利息支出，衡量企业支付利息的能力，一般应≥3', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'interest_coverage' AND factory_id IS NULL
);

-- 负债权益比
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'debt_to_equity', '负债权益比', 'DERIVED', '#totalLiabilities / #shareholderEquity', '倍', '0.00', 'AVG',
       '总负债/股东权益，衡量债务与权益的比例关系', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'debt_to_equity' AND factory_id IS NULL
);

-- ============================================================================
-- Phase 4: 运营效率指标
-- ============================================================================

-- 存货周转率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'inventory_turnover', '存货周转率', 'DERIVED', '#costOfSales / #avgInventory', '次', '0.00', 'AVG',
       '销售成本/平均存货，衡量存货周转效率', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'inventory_turnover' AND factory_id IS NULL
);

-- 存货周转天数
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'inventory_days', '存货周转天数', 'DERIVED', '365 / #inventoryTurnover', '天', '0', 'AVG',
       '365/存货周转率，表示存货从购入到售出的平均天数', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'inventory_days' AND factory_id IS NULL
);

-- 总资产周转率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'asset_turnover', '总资产周转率', 'DERIVED', '#salesAmount / #avgTotalAssets', '次', '0.00', 'AVG',
       '销售额/平均总资产，衡量总资产使用效率', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'asset_turnover' AND factory_id IS NULL
);

-- 应收账款周转率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'receivable_turnover', '应收账款周转率', 'DERIVED', '#salesAmount / #avgReceivables', '次', '0.00', 'AVG',
       '销售额/平均应收账款，衡量应收账款回收效率', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'receivable_turnover' AND factory_id IS NULL
);

-- 应收账款周转天数
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'receivable_days', '应收账款周转天数', 'DERIVED', '365 / #receivableTurnover', '天', '0', 'AVG',
       '365/应收周转率，表示应收账款回收的平均天数', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'receivable_days' AND factory_id IS NULL
);

-- 应付账款周转率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'payable_turnover', '应付账款周转率', 'DERIVED', '#costOfSales / #avgPayables', '次', '0.00', 'AVG',
       '销售成本/平均应付账款，衡量应付账款支付效率', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'payable_turnover' AND factory_id IS NULL
);

-- 应付账款周转天数
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'payable_days', '应付账款周转天数', 'DERIVED', '365 / #payableTurnover', '天', '0', 'AVG',
       '365/应付周转率，表示应付账款支付的平均天数', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'payable_days' AND factory_id IS NULL
);

-- ============================================================================
-- Phase 5: 现金流指标 (需要现金流数据表后使用)
-- ============================================================================

-- 自由现金流
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'free_cashflow', '自由现金流', 'DERIVED', '#operatingCashflow - #capex', '元', '#,##0.00', 'SUM',
       '经营现金流-资本支出，可自由支配的现金流量', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'free_cashflow' AND factory_id IS NULL
);

-- 现金流量比率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'cashflow_ratio', '现金流量比率', 'DERIVED', '#operatingCashflow / #currentLiabilities', '倍', '0.00', 'AVG',
       '经营现金流/流动负债，衡量现金偿债能力', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'cashflow_ratio' AND factory_id IS NULL
);

-- 现金转换周期
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'cash_conversion_cycle', '现金转换周期', 'DERIVED', '#inventoryDays + #receivableDays - #payableDays', '天', '0', 'AVG',
       '存货周转天数+应收天数-应付天数，衡量现金周转效率', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'cash_conversion_cycle' AND factory_id IS NULL
);

-- ============================================================================
-- Phase 6: 杜邦分析指标
-- ============================================================================

-- 杜邦-净利率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'dupont_npm', '杜邦-净利率', 'DERIVED', '#netProfit / #salesAmount * 100', '%', '0.00', 'AVG',
       '净利润/销售额×100%，杜邦分析第一分解因子', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'dupont_npm' AND factory_id IS NULL
);

-- 杜邦-资产周转率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'dupont_tat', '杜邦-资产周转率', 'DERIVED', '#salesAmount / #avgTotalAssets', '次', '0.00', 'AVG',
       '销售额/平均总资产，杜邦分析第二分解因子', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'dupont_tat' AND factory_id IS NULL
);

-- 杜邦-权益乘数
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'dupont_em', '杜邦-权益乘数', 'DERIVED', '#avgTotalAssets / #avgShareholderEquity', '倍', '0.00', 'AVG',
       '平均总资产/平均股东权益，杜邦分析第三分解因子', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'dupont_em' AND factory_id IS NULL
);

-- 杜邦-ROE验证
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'dupont_roe', '杜邦-ROE', 'DERIVED', '#dupontNpm / 100 * #dupontTat * #dupontEm * 100', '%', '0.00', 'AVG',
       '净利率×资产周转率×权益乘数，验证杜邦分解结果', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'dupont_roe' AND factory_id IS NULL
);

-- ============================================================================
-- Phase 7: CVP 分析指标 (成本-量-利)
-- ============================================================================

-- 变动成本率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'variable_cost_rate', '变动成本率', 'DERIVED', '#variableCost / #salesAmount * 100', '%', '0.00', 'AVG',
       '变动成本/销售额×100%，反映变动成本占收入比例', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'variable_cost_rate' AND factory_id IS NULL
);

-- 贡献毛益
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'contribution_margin', '贡献毛益', 'DERIVED', '#salesAmount - #variableCost', '元', '#,##0.00', 'SUM',
       '销售额-变动成本，用于弥补固定成本和创造利润', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'contribution_margin' AND factory_id IS NULL
);

-- 贡献毛益率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'contribution_margin_rate', '贡献毛益率', 'DERIVED', '#contributionMargin / #salesAmount * 100', '%', '0.00', 'AVG',
       '贡献毛益/销售额×100%，反映创利能力', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'contribution_margin_rate' AND factory_id IS NULL
);

-- 盈亏平衡点销售额
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'breakeven_sales', '盈亏平衡点', 'DERIVED', '#fixedCost / (#contributionMarginRate / 100)', '元', '#,##0.00', 'AVG',
       '固定成本/贡献毛益率，达到盈亏平衡所需销售额', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'breakeven_sales' AND factory_id IS NULL
);

-- 安全边际
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'safety_margin', '安全边际', 'DERIVED', '#salesAmount - #breakevenSales', '元', '#,##0.00', 'SUM',
       '实际销售额-盈亏平衡点，表示可承受的销量下降空间', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'safety_margin' AND factory_id IS NULL
);

-- 安全边际率
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, formula_expression, unit, format_pattern, aggregation, description, is_active)
SELECT 'safety_margin_rate', '安全边际率', 'DERIVED', '#safetyMargin / #salesAmount * 100', '%', '0.00', 'AVG',
       '安全边际/销售额×100%，衡量经营安全程度', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_metric_formulas WHERE metric_code = 'safety_margin_rate' AND factory_id IS NULL
);

-- ============================================================================
-- 告警阈值配置
-- ============================================================================

-- 流动比率阈值
INSERT INTO smart_bi_alert_thresholds
(threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description, is_active)
SELECT 'FINANCE', 'current_ratio', 1.5, 1.0, 'LT', '倍', '流动比率低于阈值预警', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_alert_thresholds WHERE metric_code = 'current_ratio' AND factory_id IS NULL
);

-- 速动比率阈值
INSERT INTO smart_bi_alert_thresholds
(threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description, is_active)
SELECT 'FINANCE', 'quick_ratio', 1.0, 0.5, 'LT', '倍', '速动比率低于阈值预警', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_alert_thresholds WHERE metric_code = 'quick_ratio' AND factory_id IS NULL
);

-- 资产负债率阈值
INSERT INTO smart_bi_alert_thresholds
(threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description, is_active)
SELECT 'FINANCE', 'debt_ratio', 60.0, 70.0, 'GT', '%', '资产负债率超过阈值预警', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_alert_thresholds WHERE metric_code = 'debt_ratio' AND factory_id IS NULL
);

-- 利息保障倍数阈值
INSERT INTO smart_bi_alert_thresholds
(threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description, is_active)
SELECT 'FINANCE', 'interest_coverage', 3.0, 1.5, 'LT', '倍', '利息保障倍数低于阈值预警', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_alert_thresholds WHERE metric_code = 'interest_coverage' AND factory_id IS NULL
);

-- ROA 阈值
INSERT INTO smart_bi_alert_thresholds
(threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description, is_active)
SELECT 'FINANCE', 'roa', 5.0, 2.0, 'LT', '%', 'ROA低于阈值预警', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_alert_thresholds WHERE metric_code = 'roa' AND factory_id IS NULL
);

-- ROE 阈值
INSERT INTO smart_bi_alert_thresholds
(threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description, is_active)
SELECT 'FINANCE', 'roe', 10.0, 5.0, 'LT', '%', 'ROE低于阈值预警', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_alert_thresholds WHERE metric_code = 'roe' AND factory_id IS NULL
);

-- 安全边际率阈值
INSERT INTO smart_bi_alert_thresholds
(threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description, is_active)
SELECT 'FINANCE', 'safety_margin_rate', 30.0, 10.0, 'LT', '%', '安全边际率低于阈值预警', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_alert_thresholds WHERE metric_code = 'safety_margin_rate' AND factory_id IS NULL
);

-- ============================================================================
-- 字典词条配置 (指标同义词)
-- ============================================================================

-- ROA 同义词
INSERT INTO smart_bi_dictionary (dict_type, name, aliases, field_mapping, description, is_active)
SELECT 'metric', 'ROA', '["资产回报率","资产收益率","总资产报酬率","return on assets"]', 'roa', '资产回报率指标', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_dictionary WHERE name = 'ROA' AND dict_type = 'metric'
);

-- ROE 同义词
INSERT INTO smart_bi_dictionary (dict_type, name, aliases, field_mapping, description, is_active)
SELECT 'metric', 'ROE', '["净资产收益率","股东权益回报率","return on equity"]', 'roe', '净资产收益率指标', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_dictionary WHERE name = 'ROE' AND dict_type = 'metric'
);

-- 流动比率同义词
INSERT INTO smart_bi_dictionary (dict_type, name, aliases, field_mapping, description, is_active)
SELECT 'metric', '流动比率', '["流动性比率","current ratio","短期偿债能力"]', 'current_ratio', '流动比率指标', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_dictionary WHERE name = '流动比率' AND dict_type = 'metric'
);

-- 速动比率同义词
INSERT INTO smart_bi_dictionary (dict_type, name, aliases, field_mapping, description, is_active)
SELECT 'metric', '速动比率', '["酸性测试比率","quick ratio","acid test ratio"]', 'quick_ratio', '速动比率指标', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_dictionary WHERE name = '速动比率' AND dict_type = 'metric'
);

-- 资产负债率同义词
INSERT INTO smart_bi_dictionary (dict_type, name, aliases, field_mapping, description, is_active)
SELECT 'metric', '资产负债率', '["负债比率","债务比率","debt ratio","杠杆率"]', 'debt_ratio', '资产负债率指标', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_dictionary WHERE name = '资产负债率' AND dict_type = 'metric'
);

-- 杜邦分析同义词
INSERT INTO smart_bi_dictionary (dict_type, name, aliases, field_mapping, description, is_active)
SELECT 'metric', '杜邦分析', '["杜邦","ROE分解","盈利能力分解","dupont analysis"]', 'dupont_roe', '杜邦分析框架', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_dictionary WHERE name = '杜邦分析' AND dict_type = 'metric'
);

-- 存货周转率同义词
INSERT INTO smart_bi_dictionary (dict_type, name, aliases, field_mapping, description, is_active)
SELECT 'metric', '存货周转率', '["库存周转率","存货周转次数","inventory turnover"]', 'inventory_turnover', '存货周转率指标', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_dictionary WHERE name = '存货周转率' AND dict_type = 'metric'
);

-- 盈亏平衡点同义词
INSERT INTO smart_bi_dictionary (dict_type, name, aliases, field_mapping, description, is_active)
SELECT 'metric', '盈亏平衡点', '["保本点","breakeven point","BEP","损益平衡点"]', 'breakeven_sales', '盈亏平衡点指标', TRUE
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_dictionary WHERE name = '盈亏平衡点' AND dict_type = 'metric'
);

-- ============================================================================
-- 日志记录
-- ============================================================================
SELECT CONCAT('V2026_01_21_09: 财务分析指标配置完成',
    ' | 指标公式: ', (SELECT COUNT(*) FROM smart_bi_metric_formulas WHERE factory_id IS NULL),
    ' | 告警阈值: ', (SELECT COUNT(*) FROM smart_bi_alert_thresholds WHERE factory_id IS NULL),
    ' | 字典词条: ', (SELECT COUNT(*) FROM smart_bi_dictionary)
) AS migration_info;
