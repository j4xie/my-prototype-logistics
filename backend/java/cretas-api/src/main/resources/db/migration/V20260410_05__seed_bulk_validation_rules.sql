-- V20260410_05__seed_bulk_validation_rules.sql
INSERT INTO factory_validation_rules (factory_id, module_code, rule_code, operation, condition, error_message, severity, sort_order) VALUES
(NULL, 'purchase_order', 'DRAFT_ONLY_SUBMIT', 'STATUS_CHANGE', '#status != ''DRAFT''', '只有草稿状态的订单可以提交', 'BLOCK', 10),
(NULL, 'purchase_order', 'SUBMITTED_ONLY_APPROVE', 'STATUS_CHANGE', '#status != ''SUBMITTED''', '只有已提交状态的订单可以审批', 'BLOCK', 20),
(NULL, 'purchase_order', 'APPROVED_ONLY_FINANCE', 'STATUS_CHANGE', '#status != ''APPROVED''', '只有已审批状态的订单可以提交财务', 'BLOCK', 30),
(NULL, 'purchase_order', 'FINANCE_ONLY_APPROVE', 'STATUS_CHANGE', '#status != ''PENDING_FINANCE_REVIEW''', '只有待财务审核状态可以审核', 'BLOCK', 40),
(NULL, 'purchase_order', 'NO_CANCEL_COMPLETED', 'STATUS_CHANGE', '#status == ''COMPLETED'' OR #status == ''CLOSED''', '已完成或已关闭的订单不能取消', 'BLOCK', 50),
(NULL, 'purchase_order', 'DRAFT_ONLY_EDIT', 'UPDATE', '#status != ''DRAFT''', '只有草稿状态可以编辑', 'BLOCK', 60),
(NULL, 'transfer', 'NO_CANCEL_TERMINAL', 'STATUS_CHANGE', '#isTerminal == true', '终态调拨单不能取消', 'BLOCK', 10),
(NULL, 'transfer', 'STOCK_SUFFICIENT', 'CREATE', '#stockInsufficient == true', '库存不足', 'BLOCK', 20),
(NULL, 'return_order', 'DRAFT_ONLY_SUBMIT', 'STATUS_CHANGE', '#status != ''DRAFT''', '只有草稿状态可以提交', 'BLOCK', 10),
(NULL, 'return_order', 'SUBMITTED_ONLY_APPROVE', 'STATUS_CHANGE', '#status != ''SUBMITTED''', '只有已提交状态可以审批', 'BLOCK', 20),
(NULL, 'return_order', 'APPROVED_ONLY_COMPLETE', 'STATUS_CHANGE', '#status != ''APPROVED''', '只有已审批状态可以完成', 'BLOCK', 30),
(NULL, 'supplier', 'UNIQUE_NAME', 'CREATE', '#nameExists == true', '供应商名称已存在', 'BLOCK', 10),
(NULL, 'supplier', 'NO_DELETE_WITH_BATCHES', 'DELETE', '#hasBatches == true', '有关联批次无法删除', 'BLOCK', 20),
(NULL, 'supplier', 'RATING_RANGE', 'UPDATE', '#rating < 1 OR #rating > 5', '评级1-5', 'BLOCK', 30),
(NULL, 'customer', 'UNIQUE_NAME', 'CREATE', '#nameExists == true', '客户名称已存在', 'BLOCK', 10),
(NULL, 'customer', 'NO_DELETE_WITH_DELIVERIES', 'DELETE', '#hasDeliveries == true', '有关联出货无法删除', 'BLOCK', 20),
(NULL, 'customer', 'RATING_RANGE', 'UPDATE', '#rating < 1 OR #rating > 5', '评级1-5', 'BLOCK', 30),
(NULL, 'finance_ap', 'POSITIVE_AMOUNT', 'CREATE', '#amount <= 0', '应付金额必须大于0', 'BLOCK', 10),
(NULL, 'finance_ap', 'DUPLICATE_PO_AP', 'CREATE', '#existingApForPO == true', '该采购单已生成应付', 'BLOCK', 20),
(NULL, 'finance_receipt', 'POSITIVE_AMOUNT', 'CREATE', '#amount <= 0', '收款金额必须大于0', 'BLOCK', 10),
(NULL, 'finance_receipt', 'EXCEED_BALANCE', 'CREATE', '#amount > #remainingBalance', '超过应收余额', 'WARN', 20)
ON CONFLICT (factory_id, module_code, rule_code) DO NOTHING;
