-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_24_03__profit_loss_field_synonyms.sql
-- Conversion date: 2026-01-26 18:49:37
-- ============================================

-- =============================================================================
-- 利润表/损益表专用字段同义词
-- 扩展 smart_bi_dictionary 表的字段映射，支持利润表数据上传和分析
-- dict_type = 'field_synonym'
-- =============================================================================

-- 利润表收入/成本字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'revenue', '["营业收入","营收","主营业务收入","收入","销售收入","经营收入","revenue","operating revenue","sales revenue","income","总收入","营业总收入","主营收入"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'cost_of_sales', '["营业成本","销售成本","主营业务成本","经营成本","直接成本","cost of sales","cost of goods sold","COGS","operating cost","产品成本","服务成本"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'gross_profit', '["毛利","毛利润","毛利额","销售毛利","营业毛利","gross profit","gross margin amount","GP","主营毛利","经营毛利"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'operating_expense', '["营业费用","期间费用","运营费用","经营费用","operating expense","opex","period expense","销售费用","管理费用合计"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'operating_profit', '["营业利润","经营利润","营业利润额","operating profit","operating income","EBIT","主营利润"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  aliases = VALUES(aliases),
  metadata = VALUES(metadata),
  updated_at = NOW();

-- 利润表预算对比字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'ytd_amount', '["本年累计","年累计","年度累计","累计金额","累计数","YTD","year to date","ytd amount","cumulative","截至目前累计","本年度累计"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"BUDGET"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'yoy_amount', '["同比","去年同期","上年同期","同期","去年","YoY","year over year","yoy amount","prior year","同比金额","去年同期金额","上年同期数"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"BUDGET"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'mom_amount', '["环比","上月","上期","上月同期","MoM","month over month","mom amount","prior month","环比金额","上月金额"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"BUDGET"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'budget_achievement_rate', '["预算达成率","达成率","完成率","预算完成率","budget achievement rate","achievement rate","completion rate","预算执行率","达成比例"]',
 '{"dataType":"PERCENTAGE","aggregation":"AVG","category":"BUDGET"}', 'SYSTEM', 10, TRUE, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  aliases = VALUES(aliases),
  metadata = VALUES(metadata),
  updated_at = NOW();

-- 更新现有的 budget_amount 和 actual_amount 字段，添加更多别名
UPDATE smart_bi_dictionary
SET aliases = '["预算","预算金额","预算额","计划金额","预算值","预算数","年度预算","月度预算","预算目标","目标预算","budget","budget amount"]',
    updated_at = NOW()
WHERE dict_type = 'field_synonym' AND name = 'budget_amount';

UPDATE smart_bi_dictionary
SET aliases = '["实际","实际金额","实际值","实际额","实际发生","本月实际","当月实际","实际数","本期实际","当期实际","actual","actual amount"]',
    updated_at = NOW()
WHERE dict_type = 'field_synonym' AND name = 'actual_amount';

-- 添加利润表科目/项目字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'account_item', '["科目","项目","会计科目","账目","财务科目","account item","account","line item","费用项目","收入项目"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'period', '["期间","会计期间","报告期","账期","period","accounting period","reporting period","财务期间"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  aliases = VALUES(aliases),
  metadata = VALUES(metadata),
  updated_at = NOW();
