-- V20260402_01: Add intent configs for 7 new finance + R&D intents
-- These were previously inserted manually; this migration ensures they exist on fresh deployments

-- Finance: Invoice Request
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'FINANCE_INVOICE_REQUEST', '申请开票', 'FINANCE', 'finance_invoice_request', 'MEDIUM',
        '["开票","发票","申请开票","开发票","申请发票","开具发票"]',
        '提交开票申请，关联销售订单', 80, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'finance_invoice_request', is_active = true;

-- Finance: Invoice Approve
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'FINANCE_INVOICE_APPROVE', '审核开票', 'FINANCE', 'finance_invoice_approve', 'HIGH',
        '["开票审核","审核开票","批准开票","审核发票"]',
        '审核开票申请（通过/驳回）', 80, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'finance_invoice_approve', is_active = true;

-- Finance: Payment Record
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'FINANCE_PAYMENT_RECORD', '录入收款', 'FINANCE', 'finance_payment_record', 'MEDIUM',
        '["收款","回款","客户付款","录入收款","收到货款","回款登记","记录收款"]',
        '录入客户收款/回款记录', 80, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'finance_payment_record', is_active = true;

-- Purchase: Finance Approve
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'PURCHASE_FINANCE_APPROVE', '采购财务审核', 'PROCUREMENT', 'purchase_finance_approve', 'HIGH',
        '["采购财务审核","采购单审核","审核采购单","采购审批"]',
        '采购订单财务审核（通过/驳回）', 80, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'purchase_finance_approve', is_active = true;

-- R&D: Request Create
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RD_REQUEST_CREATE', '创建研发需求', 'RD', 'rd_request_create', 'LOW',
        '["研发需求","创建研发需求","新品开发需求","开发需求","样品需求","新品开发"]',
        '创建新的研发需求（客户新品开发请求）', 80, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'rd_request_create', is_active = true;

-- R&D: Sample Create
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RD_SAMPLE_CREATE', '创建样品', 'RD', 'rd_sample_create', 'LOW',
        '["创建样品","新建样品","样品档案","登记样品"]',
        '创建新的产品样品档案', 80, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'rd_sample_create', is_active = true;

-- R&D: Sample Approve
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RD_SAMPLE_APPROVE', '审核样品', 'RD', 'rd_sample_approve', 'HIGH',
        '["审核样品","样品审核","样品通过","批准样品","驳回样品"]',
        '审核产品样品（通过→自动创建BOM+报价任务）', 80, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'rd_sample_approve', is_active = true;
