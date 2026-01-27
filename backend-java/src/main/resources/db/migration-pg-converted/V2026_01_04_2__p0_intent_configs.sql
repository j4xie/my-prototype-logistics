-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_04_2__p0_intent_configs.sql
-- Conversion date: 2026-01-26 18:47:15
-- ============================================

-- P0 意图配置 - 质检、原料批次、出货溯源
-- Phase 4: AI Intent Extension
-- @version 1.0.0
-- @since 2026-01-04

-- ============================================
-- QUALITY 类意图（质检 + 处置）
-- ============================================

-- 质检项查询
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'QUALITY_CHECK_QUERY', '质检项查询', 'QUALITY',
    'LOW', 1,
    '["查询质检项", "质检项列表", "检测项目", "质检标准", "查看质检", "检验项目"]',
    '["factory_super_admin", "quality_inspector"]', 85, '查询工厂配置的质检项目和标准',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 执行质检
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'QUALITY_CHECK_EXECUTE', '执行质检', 'QUALITY',
    'MEDIUM', 2,
    '["执行质检", "提交质检", "质检记录", "检测结果", "录入质检", "质检完成", "检验通过", "检验不通过"]',
    '["factory_super_admin", "quality_inspector"]', 90, '执行质检并记录检测结果',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 处置评估
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'QUALITY_DISPOSITION_EVALUATE', '处置评估', 'QUALITY',
    'MEDIUM', 2,
    '["处置建议", "处置评估", "质检处置", "不合格处置", "处置方案", "应该怎么处置"]',
    '["factory_super_admin", "quality_inspector"]', 88, '根据质检结果智能评估处置方案',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 执行处置
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'QUALITY_DISPOSITION_EXECUTE', '执行处置', 'QUALITY',
    'HIGH', 3,
    '["执行处置", "返工", "报废", "放行", "特批放行", "有条件放行", "暂扣"]',
    '["factory_super_admin", "quality_inspector"]', 92, '执行质量处置动作（放行/返工/报废/特批/暂扣）',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 质检统计
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'QUALITY_STATS', '质检统计', 'QUALITY',
    'LOW', 1,
    '["质检统计", "质检报表", "合格率", "不合格率", "质检分析", "质量统计"]',
    '["factory_super_admin", "quality_inspector", "department_admin"]', 80, '查询质检统计数据和合格率分析',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 关键质检项
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'QUALITY_CRITICAL_ITEMS', '关键质检项', 'QUALITY',
    'LOW', 1,
    '["关键质检", "关键项目", "必检项", "强制检验项", "关键检测点"]',
    '["factory_super_admin", "quality_inspector"]', 82, '查询关键/必检的质检项目',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- MATERIAL 类意图（原料批次管理）
-- ============================================

-- 原料批次查询
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_BATCH_QUERY', '原料批次查询', 'MATERIAL',
    'LOW', 1,
    '["查询原料", "原料批次", "原材料库存", "原料库存", "查看原料", "原料列表"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor", "operator"]', 85, '查询原材料批次信息和库存',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 使用原料
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_BATCH_USE', '使用原料', 'MATERIAL',
    'HIGH', 2,
    '["使用原料", "领用原料", "出库原料", "消耗原料", "原料出库"]',
    '["factory_super_admin", "workshop_supervisor", "operator"]', 90, '记录原材料使用/出库',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 预留原料
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_BATCH_RESERVE', '预留原料', 'MATERIAL',
    'MEDIUM', 2,
    '["预留原料", "预订原料", "锁定原料", "保留原料", "原料预留"]',
    '["factory_super_admin", "workshop_supervisor"]', 88, '预留原材料给特定生产计划',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 释放预留
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_BATCH_RELEASE', '释放预留', 'MATERIAL',
    'MEDIUM', 2,
    '["释放原料", "取消预留", "解锁原料", "释放预留", "原料解锁"]',
    '["factory_super_admin", "workshop_supervisor"]', 85, '释放已预留的原材料',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 消耗预留
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_BATCH_CONSUME', '消耗预留', 'MATERIAL',
    'HIGH', 2,
    '["消耗预留", "确认消耗", "预留转消耗", "消耗原料"]',
    '["factory_super_admin", "workshop_supervisor"]', 88, '将预留的原材料转为实际消耗',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- FIFO推荐
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_FIFO_RECOMMEND', 'FIFO推荐', 'MATERIAL',
    'LOW', 1,
    '["先进先出", "FIFO", "原料推荐", "推荐使用", "优先使用"]',
    '["factory_super_admin", "workshop_supervisor", "operator"]', 82, '按FIFO原则推荐应优先使用的原材料批次',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 即将过期预警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_EXPIRING_ALERT', '即将过期预警', 'MATERIAL',
    'LOW', 1,
    '["即将过期", "快过期", "临期原料", "过期预警", "临期预警"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 85, '查询即将过期的原材料批次',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 低库存预警
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_LOW_STOCK_ALERT', '低库存预警', 'MATERIAL',
    'LOW', 1,
    '["低库存", "库存不足", "缺货预警", "库存告警", "原料不足"]',
    '["factory_super_admin", "department_admin"]', 85, '查询库存不足的原材料类型',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 已过期查询
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_EXPIRED_QUERY', '已过期查询', 'MATERIAL',
    'LOW', 1,
    '["已过期", "过期原料", "过期批次", "查询过期"]',
    '["factory_super_admin", "department_admin", "quality_inspector"]', 82, '查询已过期的原材料批次',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 调整数量
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'MATERIAL_ADJUST_QUANTITY', '调整数量', 'MATERIAL',
    'HIGH', 3,
    '["调整库存", "修改数量", "库存调整", "盘点调整", "数量修正"]',
    '["factory_super_admin"]', 90, '调整原材料批次数量（盘点/损耗等）',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- ============================================
-- SHIPMENT 类意图（出货 + 溯源）
-- ============================================

-- 创建出货
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_CREATE', '创建出货', 'SHIPMENT',
    'HIGH', 2,
    '["创建出货", "新建出货", "发货", "出货登记", "安排发货", "出库"]',
    '["factory_super_admin", "department_admin"]', 90, '创建新的出货记录',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 查询出货
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_QUERY', '查询出货', 'SHIPMENT',
    'LOW', 1,
    '["查询出货", "出货记录", "发货记录", "出货列表", "出货查询"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 85, '查询出货记录',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 更新出货
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_UPDATE', '更新出货', 'SHIPMENT',
    'MEDIUM', 2,
    '["修改出货", "更新出货", "编辑出货", "修改发货"]',
    '["factory_super_admin", "department_admin"]', 88, '更新出货记录信息',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 更新出货状态
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_STATUS_UPDATE', '更新出货状态', 'SHIPMENT',
    'MEDIUM', 2,
    '["出货状态", "发货状态", "确认送达", "确认发货", "标记送达", "退货"]',
    '["factory_super_admin", "department_admin"]', 88, '更新出货状态（发货/送达/退货）',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 出货统计
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_STATS', '出货统计', 'SHIPMENT',
    'LOW', 1,
    '["出货统计", "发货统计", "出货报表", "出货分析"]',
    '["factory_super_admin", "department_admin"]', 80, '查询出货统计数据',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 客户出货
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_BY_CUSTOMER', '客户出货', 'SHIPMENT',
    'LOW', 1,
    '["客户出货", "客户发货", "查询客户订单", "客户订单"]',
    '["factory_super_admin", "department_admin"]', 82, '按客户查询出货记录',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 日期出货
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'SHIPMENT_BY_DATE', '日期出货', 'SHIPMENT',
    'LOW', 1,
    '["今天出货", "昨天出货", "本周出货", "本月出货", "日期出货"]',
    '["factory_super_admin", "department_admin", "workshop_supervisor"]', 82, '按日期范围查询出货记录',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 批次溯源
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'TRACE_BATCH', '批次溯源', 'SHIPMENT',
    'LOW', 1,
    '["批次溯源", "溯源查询", "追溯批次", "查询溯源", "产品追溯"]',
    '["factory_super_admin", "department_admin", "quality_inspector"]', 88, '查询批次溯源信息',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 完整溯源
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'TRACE_FULL', '完整溯源', 'SHIPMENT',
    'LOW', 2,
    '["完整溯源", "全链路追溯", "完整追溯", "全流程溯源"]',
    '["factory_super_admin", "department_admin", "quality_inspector"]', 90, '查询完整溯源链条（原料→加工→质检→出货）',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- 公开溯源
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    is_active, created_at, updated_at
) VALUES (
    UUID(), 'TRACE_PUBLIC', '公开溯源', 'SHIPMENT',
    'LOW', 1,
    '["公开溯源", "扫码溯源", "消费者溯源", "公开查询"]',
    '["factory_super_admin", "department_admin"]', 85, '生成面向消费者的公开溯源信息',
    TRUE, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();
