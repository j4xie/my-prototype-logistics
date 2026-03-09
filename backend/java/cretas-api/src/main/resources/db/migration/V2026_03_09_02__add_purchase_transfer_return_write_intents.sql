-- =====================================================
-- V2026_03_09_02: Add write operation intents for purchase, transfer, return
-- Purpose: Enable AI to create/approve purchase orders, transfers, return orders
-- =====================================================

-- 1. PURCHASE_ORDER_CREATE - 创建采购订单
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'PURCHASE_ORDER_CREATE', '创建采购订单', 'DATA_OPERATION',
    'HIGH', 5,
    '["创建采购单", "新建采购订单", "下采购单", "采购原料", "采购下单", "新增采购"]',
    NULL, 80,
    '创建采购订单，需要供应商和物品信息',
    'purchase_order_create', 'PURCHASE', 'CREATE', 'ORDER',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- 2. PURCHASE_ORDER_APPROVE - 采购订单审批
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'PURCHASE_ORDER_APPROVE', '审批采购订单', 'DATA_OPERATION',
    'HIGH', 3,
    '["审批采购单", "通过采购", "提交采购单", "采购审批", "采购订单审核", "取消采购单"]',
    NULL, 80,
    '审批采购订单：提交、审批通过或取消',
    'purchase_order_approve', 'PURCHASE', 'UPDATE', 'ORDER',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- 3. TRANSFER_CREATE - 创建调拨单
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'TRANSFER_CREATE', '创建调拨单', 'DATA_OPERATION',
    'HIGH', 5,
    '["创建调拨单", "新建调拨", "申请调拨", "内部调拨", "调货", "从总部调货", "分部调拨"]',
    NULL, 80,
    '创建内部调拨单，需要调入方和物品信息',
    'transfer_create', 'TRANSFER', 'CREATE', 'ORDER',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- 4. TRANSFER_APPROVE - 调拨单审批
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'TRANSFER_APPROVE', '调拨单审批', 'DATA_OPERATION',
    'HIGH', 3,
    '["审批调拨", "调拨审批", "提交调拨", "确认发货", "确认签收", "调拨发货", "调拨签收", "取消调拨"]',
    NULL, 80,
    '调拨单审批和状态推进：提交、审批、发货、签收、确认、取消',
    'transfer_approve', 'TRANSFER', 'UPDATE', 'ORDER',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- 5. RETURN_ORDER_CREATE - 创建退货单
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'RETURN_ORDER_CREATE', '创建退货单', 'DATA_OPERATION',
    'HIGH', 5,
    '["创建退货单", "新建退货", "退货给供应商", "客户退货", "退货申请", "采购退货", "销售退货"]',
    NULL, 80,
    '创建退货单，支持采购退货和销售退货',
    'return_order_create', 'RETURN', 'CREATE', 'ORDER',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- 6. RETURN_ORDER_APPROVE - 退货单审批
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'RETURN_ORDER_APPROVE', '退货单审批', 'DATA_OPERATION',
    'HIGH', 3,
    '["审批退货", "退货审批", "提交退货", "确认退货", "拒绝退货", "退货完成"]',
    NULL, 80,
    '退货单审批和状态推进：提交、审批、拒绝、完成',
    'return_order_approve', 'RETURN', 'UPDATE', 'ORDER',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();
