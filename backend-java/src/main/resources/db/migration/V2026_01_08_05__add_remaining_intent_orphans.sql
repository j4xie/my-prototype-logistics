-- =====================================================
-- V2026_01_08_05: Add intent configs for remaining tool orphans
--
-- Purpose: Create ai_intent_configs for 6 tools that lack
--          corresponding intent configuration entries
--
-- Tools covered:
-- SHIPMENT (3):
--   1. shipment_cancel - 取消出货单 (HIGH - 不可逆操作)
--   2. shipment_complete - 完成出货单/已送达 (MEDIUM)
--   3. shipment_confirm - 确认出货单/开始发货 (MEDIUM)
--
-- QUALITY (3):
--   4. quality_check_update - 更新质检任务 (MEDIUM)
--   5. quality_record_query - 查询质检记录 (LOW)
--   6. quality_result_submit - 提交质检结果 (MEDIUM)
--
-- Note: factory_id = NULL indicates platform-level intents
-- =====================================================

-- =====================================================
-- SHIPMENT 类意图 (3)
-- =====================================================

-- 1. 取消出货单 - HIGH sensitivity (不可逆操作)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost,
    keywords, required_roles, priority, description,
    is_active, factory_id, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_CANCEL', '取消出货单', 'SHIPMENT',
    'shipment_cancel', 'HIGH', 3,
    '["取消出货", "撤销出货", "取消发货", "撤销发货", "作废出货", "取消订单", "取消出库", "删除出货"]',
    '["factory_super_admin", "department_admin"]', 85,
    '取消已创建的出货单（不可逆操作，仅限待发货状态）',
    TRUE, NULL, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 2. 完成出货单 - MEDIUM sensitivity
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost,
    keywords, required_roles, priority, description,
    is_active, factory_id, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_COMPLETE', '完成出货单', 'SHIPMENT',
    'shipment_complete', 'MEDIUM', 2,
    '["完成出货", "确认送达", "已送达", "完成发货", "送达确认", "签收确认", "收货确认", "完成配送"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 82,
    '将出货单标记为已完成/已送达状态',
    TRUE, NULL, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 3. 确认出货单 - MEDIUM sensitivity
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost,
    keywords, required_roles, priority, description,
    is_active, factory_id, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_CONFIRM', '确认出货单', 'SHIPMENT',
    'shipment_confirm', 'MEDIUM', 2,
    '["确认出货", "开始发货", "发货确认", "确认发货", "启动发货", "出货确认", "开始配送", "启动配送"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 82,
    '确认出货单开始发货，状态从待发货变为配送中',
    TRUE, NULL, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- =====================================================
-- QUALITY 类意图 (3)
-- =====================================================

-- 4. 更新质检任务 - MEDIUM sensitivity
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost,
    keywords, required_roles, priority, description,
    is_active, factory_id, created_at, updated_at
) VALUES (
    UUID(), 'QUALITY_CHECK_UPDATE', '更新质检任务', 'QUALITY',
    'quality_check_update', 'MEDIUM', 2,
    '["更新质检", "修改质检", "编辑质检", "质检修改", "调整质检", "变更质检", "质检任务更新"]',
    '["factory_super_admin", "quality_inspector"]', 78,
    '更新质检任务信息（修改检验项、调整标准等）',
    TRUE, NULL, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 5. 查询质检记录 - LOW sensitivity (只读操作)
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost,
    keywords, required_roles, priority, description,
    is_active, factory_id, created_at, updated_at
) VALUES (
    UUID(), 'QUALITY_RECORD_QUERY', '查询质检记录', 'QUALITY',
    'quality_record_query', 'LOW', 1,
    '["查询质检记录", "质检历史", "检验记录", "质检报告", "查看质检", "质检详情", "检测记录", "质检结果查询"]',
    '["factory_super_admin", "quality_inspector", "department_admin", "workshop_supervisor"]', 75,
    '查询质检记录和检验历史',
    TRUE, NULL, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 6. 提交质检结果 - MEDIUM sensitivity
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, sensitivity_level, quota_cost,
    keywords, required_roles, priority, description,
    is_active, factory_id, created_at, updated_at
) VALUES (
    UUID(), 'QUALITY_RESULT_SUBMIT', '提交质检结果', 'QUALITY',
    'quality_result_submit', 'MEDIUM', 2,
    '["提交质检结果", "提交检验结果", "录入质检", "提交检测", "质检提交", "检验完成", "提交检验", "质检录入"]',
    '["factory_super_admin", "quality_inspector"]', 80,
    '提交质检检验结果（合格/不合格/待复检）',
    TRUE, NULL, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    tool_name = VALUES(tool_name),
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- =====================================================
-- Summary
-- =====================================================
-- Added 6 intent configs for tool orphans:
--
-- SHIPMENT (3):
--   - SHIPMENT_CANCEL: 取消出货单 (HIGH, priority 85)
--   - SHIPMENT_COMPLETE: 完成出货单 (MEDIUM, priority 82)
--   - SHIPMENT_CONFIRM: 确认出货单 (MEDIUM, priority 82)
--
-- QUALITY (3):
--   - QUALITY_CHECK_UPDATE: 更新质检任务 (MEDIUM, priority 78)
--   - QUALITY_RECORD_QUERY: 查询质检记录 (LOW, priority 75)
--   - QUALITY_RESULT_SUBMIT: 提交质检结果 (MEDIUM, priority 80)
--
-- All intents are platform-level (factory_id = NULL)
-- ON DUPLICATE KEY UPDATE ensures idempotency
-- =====================================================
