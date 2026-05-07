-- 物料字典 enum seed
-- 用户需求 (2026-05-06): "新建原料类型"页类别下拉/储存类型不再硬编码,
-- 改成走 system_enums 全局字典 (factory_id='*'), 工厂可级联覆盖.
--
-- 类别: 主材/辅材/调味料/包材 (替换原硬编码海鲜/肉类等)
-- 储存类型: 新鲜/冻货/干货/常温
--
-- 单位字典走 unit_of_measurements 表 (V2025_12_31_5 已 seed 26 个常用单位).
--
-- Idempotent: ON CONFLICT DO NOTHING 防重跑.

-- system_enums.created_at / updated_at 是 NOT NULL 无 DEFAULT (BaseEntity @CreatedDate
-- 由 Hibernate AuditingEntityListener 填, Flyway 走 raw SQL 不经过它), 必须显式 NOW().
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, is_active, is_system, created_at, updated_at)
VALUES
    ('enum-mc-001', '*', 'MATERIAL_CATEGORY', 'main',       '主材',   '主要食材原料',     1, true, true, NOW(), NOW()),
    ('enum-mc-002', '*', 'MATERIAL_CATEGORY', 'auxiliary',  '辅材',   '辅助食材原料',     2, true, true, NOW(), NOW()),
    ('enum-mc-003', '*', 'MATERIAL_CATEGORY', 'seasoning',  '调味料', '调味用原料',       3, true, true, NOW(), NOW()),
    ('enum-mc-004', '*', 'MATERIAL_CATEGORY', 'packaging',  '包材',   '包装材料(箱/袋等)', 4, true, true, NOW(), NOW())
ON CONFLICT (factory_id, enum_group, enum_code) DO NOTHING;

INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, is_active, is_system, created_at, updated_at)
VALUES
    ('enum-mst-001', '*', 'MATERIAL_STORAGE_TYPE', 'fresh',  '新鲜', '常温新鲜原料',  1, true, true, NOW(), NOW()),
    ('enum-mst-002', '*', 'MATERIAL_STORAGE_TYPE', 'frozen', '冻货', '冷冻储存',       2, true, true, NOW(), NOW()),
    ('enum-mst-003', '*', 'MATERIAL_STORAGE_TYPE', 'dry',    '干货', '干燥储存',       3, true, true, NOW(), NOW()),
    ('enum-mst-004', '*', 'MATERIAL_STORAGE_TYPE', 'normal', '常温', '常温储存',       4, true, true, NOW(), NOW())
ON CONFLICT (factory_id, enum_group, enum_code) DO NOTHING;
