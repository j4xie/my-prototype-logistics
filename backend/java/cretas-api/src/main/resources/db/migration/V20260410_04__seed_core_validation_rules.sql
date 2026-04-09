-- V20260410_04__seed_core_validation_rules.sql
INSERT INTO factory_validation_rules (factory_id, module_code, rule_code, operation, condition, error_message, severity, sort_order) VALUES
(NULL, 'sales_order', 'DRAFT_ONLY_EDIT', 'UPDATE', '#status != ''DRAFT''', '只有草稿状态的订单可以编辑', 'BLOCK', 10),
(NULL, 'sales_order', 'DRAFT_ONLY_DELETE', 'DELETE', '#status != ''DRAFT''', '只有草稿状态的订单可以删除', 'BLOCK', 20),
(NULL, 'sales_order', 'DUPLICATE_PRODUCT', 'CREATE', '#hasDuplicateProduct == true', '同一订单中不能添加重复的产品', 'BLOCK', 30),
(NULL, 'sales_order', 'ITEMS_REQUIRED', 'CREATE', '#itemCount == 0', '订单必须包含至少一个行项目', 'BLOCK', 40),
(NULL, 'sales_order', 'POSITIVE_AMOUNT', 'CREATE', '#totalAmount <= 0', '订单总金额必须大于0', 'BLOCK', 50),
(NULL, 'sales_order', 'CONFIRM_DRAFT_ONLY', 'STATUS_CHANGE', '#status != ''DRAFT'' AND #targetStatus == ''CONFIRMED''', '只有草稿状态可以确认', 'BLOCK', 60),
(NULL, 'sales_order', 'FINANCE_CONFIRM_ONLY', 'STATUS_CHANGE', '#status != ''CONFIRMED'' AND #targetStatus == ''PENDING_FINANCE_REVIEW''', '只有已确认的订单可以提交财务审核', 'BLOCK', 70),
(NULL, 'sales_order', 'STOCK_SUFFICIENT', 'STATUS_CHANGE', '#stockInsufficient == true AND #targetStatus == ''DELIVERING''', '成品库存不足，无法发货', 'WARN', 80),
(NULL, 'finance_ar', 'POSITIVE_AMOUNT', 'CREATE', '#amount <= 0', '应收金额必须大于0', 'BLOCK', 10),
(NULL, 'finance_ar', 'DUPLICATE_SO_AR', 'CREATE', '#existingArForSO == true', '该销售订单已生成应收记录', 'BLOCK', 20),
(NULL, 'finance_payment', 'POSITIVE_PAYMENT', 'CREATE', '#amount <= 0', '付款金额必须大于0', 'BLOCK', 10),
(NULL, 'finance_payment', 'EXCEED_BALANCE', 'CREATE', '#amount > #remainingBalance', '付款金额不能超过剩余应付余额', 'BLOCK', 20),
(NULL, 'bom', 'PRODUCT_REQUIRED', 'CREATE', '#productTypeId == null', '必须选择产品', 'BLOCK', 10),
(NULL, 'bom', 'ITEMS_REQUIRED', 'CREATE', '#itemCount == 0', 'BOM必须包含至少一个物料', 'BLOCK', 20)
ON CONFLICT (factory_id, module_code, rule_code) DO NOTHING;

INSERT INTO factory_formulas (factory_id, module_code, formula_code, expression, variables, result_type, precision_val, description) VALUES
(NULL, 'sales_order', 'LINE_AMOUNT', '#quantity * #unitPrice', '{"quantity":"DECIMAL","unitPrice":"DECIMAL"}', 'DECIMAL', 2, '行项目金额'),
(NULL, 'bom', 'ACTUAL_QUANTITY', '#standardQuantity / (#yieldRate / 100)', '{"standardQuantity":"DECIMAL","yieldRate":"DECIMAL"}', 'DECIMAL', 6, '实际用量'),
(NULL, 'bom', 'MATERIAL_COST', '#actualQuantity * #unitPrice', '{"actualQuantity":"DECIMAL","unitPrice":"DECIMAL"}', 'DECIMAL', 4, '物料成本'),
(NULL, 'bom', 'LABOR_COST', '#unitPrice * #quantity', '{"unitPrice":"DECIMAL","quantity":"DECIMAL"}', 'DECIMAL', 4, '人工成本'),
(NULL, 'bom', 'OVERHEAD_COST', '#unitPrice * #allocationRate', '{"unitPrice":"DECIMAL","allocationRate":"DECIMAL"}', 'DECIMAL', 4, '制造费用'),
(NULL, 'rd_sample', 'TOTAL_COST', '#materialCost + #laborCost + #overheadCost', '{"materialCost":"DECIMAL","laborCost":"DECIMAL","overheadCost":"DECIMAL"}', 'DECIMAL', 2, '总成本'),
(NULL, 'rd_sample', 'PROFIT_MARGIN', '(#suggestedPrice - #totalCost) / #suggestedPrice * 100', '{"suggestedPrice":"DECIMAL","totalCost":"DECIMAL"}', 'DECIMAL', 2, '利润率'),
(NULL, 'transfer', 'LINE_AMOUNT', '#quantity * #unitPrice', '{"quantity":"DECIMAL","unitPrice":"DECIMAL"}', 'DECIMAL', 2, '调拨行金额')
ON CONFLICT (factory_id, module_code, formula_code) DO NOTHING;
