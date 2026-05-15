-- =====================================================
-- V20260516_02 — W-ABA-1 抄码品识别 (Track B2 / Chat 6)
-- =====================================================
-- 业务背景:
--   六扇门 (F006) 卤制品工厂. 部分原料 (牛肉/猪肉/鸭肉) 每箱重量不一.
--   客户原话: "每箱的规格是不一样的... 牛肉每箱重量都不一样"
--   需求: 采购单创建时不录箱数, 入库时实际称重逐箱记录.
--
-- 设计决策 (per SCHEMA_DESIGN.md §2.1):
--   A. 抄码标记加在 raw_material_types (原料属性, 不是批次特性)
--   B. 实际重量记录走新表 abaca_quantity_log (1 批次可分多次称重, 1:N)
--
-- 注意:
--   - 本 migration 独立于 V20260516_01 (Track B1 dingtalk). 二者无业务耦合,
--     Flyway 按 V 序号顺序执行, 不冲突.
-- =====================================================

-- (1) 扩展 raw_material_types — 加 3 个抄码字段
ALTER TABLE raw_material_types
    ADD COLUMN IF NOT EXISTS is_abaca_packaging BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS abaca_unit_per_box VARCHAR(20),
    ADD COLUMN IF NOT EXISTS abaca_default_unit VARCHAR(20);

COMMENT ON COLUMN raw_material_types.is_abaca_packaging IS '是否抄码品 (每箱重量不一, 采购不录箱数, 入库实际称重)';
COMMENT ON COLUMN raw_material_types.abaca_unit_per_box IS '抄码品箱重区间描述 (UI 提示用, 如 "约 10-15kg/箱")';
COMMENT ON COLUMN raw_material_types.abaca_default_unit IS '抄码品默认计量单位 (kg / g)';

-- (2) 新建 abaca_quantity_log — 抄码品实际重量记录
CREATE TABLE IF NOT EXISTS abaca_quantity_log (
    id                      VARCHAR(191) PRIMARY KEY,
    factory_id              VARCHAR(50)  NOT NULL,
    material_batch_id       VARCHAR(191) NOT NULL,
    raw_material_type_id    VARCHAR(191) NOT NULL,
    purchase_order_item_id  VARCHAR(191),

    box_index               INTEGER       NOT NULL,
    actual_weight           DECIMAL(12,4) NOT NULL,
    unit                    VARCHAR(20)   NOT NULL DEFAULT 'kg',
    weighing_method         VARCHAR(20)   NOT NULL DEFAULT 'SCALE',
    scale_device_id         VARCHAR(50),

    weighed_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
    weighed_by              BIGINT        NOT NULL,
    verified_by             BIGINT,
    verified_at             TIMESTAMP,
    notes                   VARCHAR(500),

    created_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMP,

    CONSTRAINT fk_aql_batch FOREIGN KEY (material_batch_id)
        REFERENCES material_batches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_aql_material FOREIGN KEY (raw_material_type_id)
        REFERENCES raw_material_types(id) ON DELETE RESTRICT,
    CONSTRAINT chk_aql_weight_positive CHECK (actual_weight > 0),
    CONSTRAINT chk_aql_weighing_method CHECK (weighing_method IN ('SCALE', 'MANUAL', 'IMPORTED'))
);

CREATE INDEX IF NOT EXISTS idx_aql_factory_batch
    ON abaca_quantity_log (factory_id, material_batch_id);
CREATE INDEX IF NOT EXISTS idx_aql_material_type
    ON abaca_quantity_log (factory_id, raw_material_type_id, weighed_at DESC);
CREATE INDEX IF NOT EXISTS idx_aql_po_item
    ON abaca_quantity_log (purchase_order_item_id)
    WHERE purchase_order_item_id IS NOT NULL;

COMMENT ON TABLE abaca_quantity_log IS '抄码品实际重量记录 (1 批次可分多次称重)';
COMMENT ON COLUMN abaca_quantity_log.weighing_method IS 'SCALE=电子秤 / MANUAL=手工 / IMPORTED=批量导入';
COMMENT ON COLUMN abaca_quantity_log.verified_by IS '复核员 user_id (双签机制, 可选)';

-- (3) F006 抄码品 seed — 防御式 UPDATE (按 name 匹配, 找不到也不报错)
-- 六扇门卤制品: 牛肉 / 猪肉 / 鸭肉 三种主原料每箱重量不一
UPDATE raw_material_types
SET is_abaca_packaging = TRUE,
    abaca_default_unit = 'kg',
    abaca_unit_per_box = '约 10-15kg/箱',
    updated_at = NOW()
WHERE factory_id = 'F006'
  AND deleted_at IS NULL
  AND (name LIKE '%牛肉%' OR name LIKE '%猪肉%' OR name LIKE '%鸭肉%');

-- (4) AI Intent 注册 — 3 个抄码相关意图
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'MATERIAL_MARK_ABACA', '标记原料为抄码品', 'DATA_OPERATION',
    'MEDIUM', 3,
    '["标记抄码", "设为抄码品", "抄码品标记", "标记为抄码", "抄码原料", "牛肉抄码"]',
    NULL, 70,
    '标记某原料类型为抄码品 (每箱重量不一, 采购不录箱数, 入库实际称重)',
    'material_mark_abaca', 'MATERIAL', 'UPDATE', 'TYPE',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'ABACA_WEIGHT_LOG', '记录抄码品称重', 'DATA_OPERATION',
    'LOW', 2,
    '["称重", "录入抄码", "录入重量", "记录称重", "实际重量", "第几箱"]',
    NULL, 70,
    '记录抄码品入库时单箱实际称重 (boxIndex + actualWeight)',
    'abaca_weight_log', 'MATERIAL', 'CREATE', 'WEIGHT_LOG',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, quota_cost, keywords, required_roles, priority, description,
    tool_name, semantic_domain, semantic_action, semantic_object,
    business_type, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid()::text, 'ABACA_WEIGHT_SUMMARY', '查询抄码品称重汇总', 'ANALYSIS',
    'LOW', 1,
    '["称重汇总", "总重量", "查询抄码", "抄码品总重", "批次重量", "几箱称了多少"]',
    NULL, 60,
    '查询某批次抄码品的全部称重记录 + 总重量 + 箱数汇总',
    'abaca_weight_summary', 'MATERIAL', 'READ', 'WEIGHT_LOG',
    'COMMON', TRUE, NOW(), NOW()
) ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();
