-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_17_02__fix_material_batch_create_intent.sql
-- Conversion date: 2026-01-26 18:48:39
-- ============================================

-- V2026_01_17_02: Fix MATERIAL_BATCH_CREATE intent configuration
-- Problem: "入库一批带鱼,数量500公斤" was incorrectly identified as MATERIAL_BATCH_QUERY
-- Solution: Ensure MATERIAL_BATCH_CREATE intent exists with proper keywords

-- Ensure MATERIAL_BATCH_CREATE intent exists and has correct configuration
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, keywords, tool_name,
    semantic_domain, semantic_action, semantic_object,
    priority, quota_cost, is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_BATCH_CREATE', '原料入库', 'MATERIAL',
    'HIGH', '["入库","原料入库","新到原料","到货","入库原料","新增原料批次","物料入库","原料到货"]',
    'material_batch_create',
    'MATERIAL', 'CREATE', 'BATCH',
    95, 2, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    intent_name = '原料入库',
    keywords = '["入库","原料入库","新到原料","到货","入库原料","新增原料批次","物料入库","原料到货"]',
    semantic_action = 'CREATE',
    priority = 95,
    updated_at = NOW();

-- Ensure SHIPMENT_CREATE intent exists for "发货给客户" scenarios
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, keywords, tool_name,
    semantic_domain, semantic_action, semantic_object,
    priority, quota_cost, is_active, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_CREATE', '创建发货单', 'SHIPMENT',
    'HIGH', '["发货","发货给","出货","出货给","给客户发货","发给","配送"]',
    'shipment_create',
    'SHIPMENT', 'CREATE', 'SHIPMENT',
    95, 2, TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    intent_name = '创建发货单',
    keywords = '["发货","发货给","出货","出货给","给客户发货","发给","配送"]',
    semantic_action = 'CREATE',
    priority = 95,
    updated_at = NOW();

-- Add negative keywords to MATERIAL_BATCH_QUERY to prevent confusion with CREATE operations
UPDATE ai_intent_configs
SET negative_keywords = COALESCE(
    JSON_MERGE_PRESERVE(
        COALESCE(negative_keywords, '[]'),
        '["入库","新到","到货","发货","出货"]'
    ),
    '["入库","新到","到货","发货","出货"]'
),
    updated_at = NOW()
WHERE intent_code = 'MATERIAL_BATCH_QUERY';

-- Add descriptions for semantic matching
UPDATE ai_intent_configs
SET description = '创建新的原料入库批次记录，用于登记新到货的原材料，包括材料名称、数量、供应商等信息',
    updated_at = NOW()
WHERE intent_code = 'MATERIAL_BATCH_CREATE' AND (description IS NULL OR description = '');

UPDATE ai_intent_configs
SET description = '创建新的发货单，用于向客户发送产品，包括客户信息、产品、数量等',
    updated_at = NOW()
WHERE intent_code = 'SHIPMENT_CREATE' AND (description IS NULL OR description = '');

-- Clean up wrongly learned expressions (CREATE operations learned as QUERY)
DELETE FROM ai_learned_expressions WHERE
    (expression LIKE '%入库一批%' OR
     expression LIKE '%新到一批%' OR
     expression LIKE '%到货一批%' OR
     expression LIKE '%发货给客户%' OR
     expression LIKE '%出货给客户%')
    AND intent_code IN ('MATERIAL_BATCH_QUERY', 'SHIPMENT_QUERY');
