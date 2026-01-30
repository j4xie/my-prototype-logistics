-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_21_04__field_synonym_dictionary.sql
-- Conversion date: 2026-01-26 18:49:08
-- ============================================

-- =============================================================================
-- 字段同义词字典数据
-- 将 FieldMappingDictionary 中的硬编码字段映射迁移到 smart_bi_dictionary 表
-- dict_type = 'field_synonym'
-- =============================================================================

-- 销售相关字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'amount', '["销售额","销售金额","营业额","收入","销售收入","金额","成交金额","营收","业绩","业绩金额","交易金额","成交额","revenue","amount","sales amount"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'quantity', '["数量","件数","个数","销售数量","销量","订购数量","购买数量","qty","quantity","count"]',
 '{"dataType":"QUANTITY","aggregation":"SUM","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'order_date', '["订单日期","下单时间","成交日期","日期","销售日期","交易日期","购买日期","date","order date","sale date","purchase date"]',
 '{"dataType":"DATE","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'unit_price', '["单价","售价","价格","销售单价","销售价格","商品单价","产品单价","定价","price","unit price"]',
 '{"dataType":"AMOUNT","aggregation":"AVG","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW());

-- 客户相关字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'customer_name', '["客户","客户名称","公司名","客户名","公司名称","买方","购买方","customer","customer name","client name"]',
 '{"dataType":"STRING","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'customer_type', '["客户类型","客户分类","客户级别","客户等级","客户类别","customer type","client type"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW());

-- 组织架构相关字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'region', '["区域","地区","片区","大区","销售区域","市场区域","area","region","territory"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'department', '["部门","科室","处室","所属部门","团队","销售部门","归属部门","dept","department","division"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'province', '["省份","省","所在省","省级","province","state"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'city', '["城市","市","所在城市","地级市","city"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW());

-- 产品相关字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'product_name', '["产品","商品","品名","产品名称","商品名称","产品名","商品名","货品","product","product name","item name"]',
 '{"dataType":"STRING","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'product_id', '["产品ID","商品编号","SKU","产品编号","商品ID","货号","产品代码","商品代码","product id","item id"]',
 '{"dataType":"ID","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'product_category', '["类别","品类","分类","产品类别","商品分类","产品分类","商品类别","类目","category","product category"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW());

-- 财务相关字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'profit', '["毛利","毛利润","毛利额","利润","盈利","收益","利润额","gross_profit","gross profit"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'gross_margin', '["毛利率","利润率","毛利润率","利润率%","GPM","margin","gross margin"]',
 '{"dataType":"PERCENTAGE","aggregation":"AVG","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'cost', '["成本","成本金额","费用","支出","花费","cost","total cost"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'material_cost', '["原材料成本","材料费","采购成本","进货成本","物料成本","原料成本","材料成本","采购费","material cost"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'labor_cost', '["人工成本","工资","人工费用","薪酬","人力成本","工资成本","薪资","人员成本","工资费用","labor cost"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'overhead', '["制造费用","间接费用","管理费用","间接成本","运营费用","其他费用","杂费","overhead"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'total_cost', '["总成本","成本合计","合计成本","成本总额","全部成本","total cost","full cost"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'unit_cost', '["成本价","采购价","进价","单位成本","单件成本","进货价","采购单价","unit cost"]',
 '{"dataType":"AMOUNT","aggregation":"AVG","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'net_profit', '["净利","净利润","净利额","纯利","纯利润","税后利润","net profit"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'net_margin', '["净利率","净利润率","净利润率%","NPM","net margin"]',
 '{"dataType":"PERCENTAGE","aggregation":"AVG","category":"FINANCE"}', 'SYSTEM', 10, TRUE, NOW(), NOW());

-- 应收应付相关字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'accounts_receivable', '["应收账款","应收","AR","应收款","待收款","应收金额","accounts receivable"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"AR_AP"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'accounts_payable', '["应付账款","应付","AP","应付款","待付款","应付金额","accounts payable"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"AR_AP"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'collection', '["回款","收款","已收","回款金额","收款金额","已收款","实收","collection"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"AR_AP"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'payment', '["付款","已付","付款金额","已付款","实付","支付金额","payment"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"AR_AP"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'invoice_date', '["开票日期","发票日期","开票时间","发票时间","开具日期","invoice date"]',
 '{"dataType":"DATE","aggregation":"NONE","category":"AR_AP"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'due_date', '["到期日","应收日期","到期日期","截止日期","应付日期","账期","due date"]',
 '{"dataType":"DATE","aggregation":"NONE","category":"AR_AP"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'aging_days', '["账龄","天数","账龄天数","逾期天数","欠款天数","aging days","days"]',
 '{"dataType":"QUANTITY","aggregation":"AVG","category":"AR_AP"}', 'SYSTEM', 10, TRUE, NOW(), NOW());

-- 预算相关字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'budget_amount', '["预算","预算金额","预算额","计划金额","预算值","budget","budget amount"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"BUDGET"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'actual_amount', '["实际","实际金额","实际值","实际额","实际发生","actual","actual amount"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"BUDGET"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'variance', '["差异","偏差","差异金额","预算差异","偏差值","差额","variance"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"BUDGET"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'budget_category', '["预算科目","费用类别","预算类别","科目","费用科目","预算项目","budget category"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"BUDGET"}', 'SYSTEM', 10, TRUE, NOW(), NOW());

-- 销售人员相关字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'salesperson_id', '["销售员ID","员工编号","工号","销售编号","业务员编号","员工ID","emp_id","employee id","salesperson id","staff id"]',
 '{"dataType":"ID","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'salesperson_name', '["销售员","姓名","业务员","销售人员","员工姓名","业务员姓名","销售代表","name","salesperson name","sales rep","employee name"]',
 '{"dataType":"STRING","aggregation":"NONE","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'monthly_target', '["月目标","销售目标","目标金额","月度目标","业绩目标","指标","月度指标","target","monthly target","sales target"]',
 '{"dataType":"AMOUNT","aggregation":"SUM","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW());

-- 组织相关字段
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'department_id', '["部门编号","部门ID","部门代码","部门号","dept_id","department id"]',
 '{"dataType":"ID","aggregation":"NONE","category":"ORG"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'team', '["团队","小组","工作组","班组","小队","group","team"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"ORG"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'manager', '["负责人","经理","主管","管理者","领导","上级","manager","team leader"]',
 '{"dataType":"STRING","aggregation":"NONE","category":"ORG"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'headcount', '["人数","编制","员工数","人员数量","员工人数","人员编制","在编人数","headcount"]',
 '{"dataType":"QUANTITY","aggregation":"SUM","category":"ORG"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'hire_date', '["入职日期","入职时间","入职日","加入日期","雇佣日期","入司日期","hire date"]',
 '{"dataType":"DATE","aggregation":"NONE","category":"ORG"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'cost_center', '["成本中心","成本归属","费用中心","核算中心","cost center"]',
 '{"dataType":"CATEGORICAL","aggregation":"NONE","category":"ORG"}', 'SYSTEM', 10, TRUE, NOW(), NOW());

-- 添加订单数字段（任务中提到但原代码没有单独定义）
INSERT INTO smart_bi_dictionary
(dict_type, name, aliases, metadata, source, priority, is_active, created_at, updated_at) VALUES
('field_synonym', 'order_count', '["订单数","订单量","单量","成交数","订单数量","order count"]',
 '{"dataType":"QUANTITY","aggregation":"COUNT","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW()),

('field_synonym', 'customer_count', '["客户数","客户量","顾客数","客户数量","customer count"]',
 '{"dataType":"QUANTITY","aggregation":"COUNT","category":"SALES"}', 'SYSTEM', 10, TRUE, NOW(), NOW());
