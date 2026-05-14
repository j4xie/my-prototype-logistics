-- M-BOM-1 — BOM 配方主子表重设 (取代单表 bom_items)
--
-- 客户原话 (六扇门第四次 May10 line 217): "物料名称是要手写吗?" → 应该是 SELECT
-- 客户原话 (六扇门第四次 May10 line 268): "成品 200g, 出成率 58%, 自动折算" → 主子表 + 出成率
-- 客户原话 (六扇门第四次 May10 line 263): "我写克, 后台自动折换成公斤" → 单位 CHECK + 全链路换算
--
-- 设计决策 (SCHEMA_DESIGN §2.6):
--   - 主子表: bom_recipes (1 product = 1 recipe head) + bom_recipe_items (N rows)
--   - 物料硬外键: material_type_id → raw_material_types(id) ON DELETE RESTRICT (禁手写)
--   - 单位 CHECK 约束: ('g','kg','mg','ml','L','个','袋','箱','瓶','盒')
--   - PriceSensitive 字段: 5 主表 + 2 子表 (运行时 by RBAC strip)
--   - 兼容期 30 天: 不 drop bom_items, 数据 COPY 而非 MOVE
-- 后续: V20260615_01__drop_bom_items.sql 观察期后另起删除迁移.

-- pgcrypto 提供 gen_random_uuid (PG 13+ 内置, 防御性 ensure)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. 主表: bom_recipes (配方头, 1 product = 1 head)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bom_recipes (
    id                       VARCHAR(191) PRIMARY KEY,
    factory_id               VARCHAR(50)  NOT NULL,
    recipe_code              VARCHAR(50)  NOT NULL,
    product_type_id          VARCHAR(50)  NOT NULL,
    product_name             VARCHAR(200) NOT NULL,

    version                  INTEGER      NOT NULL DEFAULT 1,
    is_current               BOOLEAN      NOT NULL DEFAULT TRUE,

    overall_yield_rate       DECIMAL(6, 2)        DEFAULT 100.00,
    output_quantity_per_unit DECIMAL(15, 4) NOT NULL,
    output_unit              VARCHAR(20)  NOT NULL DEFAULT 'g',

    -- 5 PriceSensitive 字段 (运行时按 RBAC strip, 数据层照存)
    total_material_cost      DECIMAL(15, 4),
    total_labor_cost         DECIMAL(15, 4),
    total_overhead_cost      DECIMAL(15, 4),
    total_cost               DECIMAL(15, 4),
    standard_sale_price      DECIMAL(15, 2),

    status                   VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    activated_at             TIMESTAMP,
    activated_by             BIGINT,

    source_type              VARCHAR(20)  NOT NULL DEFAULT 'MANUAL',
    source_sample_id         VARCHAR(191),

    notes                    VARCHAR(500),

    created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at               TIMESTAMP,

    CONSTRAINT chk_br_yield  CHECK (overall_yield_rate > 0 AND overall_yield_rate <= 100),
    CONSTRAINT chk_br_output CHECK (output_quantity_per_unit > 0),
    CONSTRAINT chk_br_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT chk_br_source CHECK (source_type IN ('MANUAL', 'SAMPLE_AUTOGEN', 'AI_GENERATED', 'IMPORTED'))
);

-- 同产品同版本唯一; is_current=TRUE 同产品也只允许 1 条 (partial unique)
CREATE UNIQUE INDEX IF NOT EXISTS uk_br_product_version
    ON bom_recipes (factory_id, product_type_id, version)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_br_product_current
    ON bom_recipes (factory_id, product_type_id)
    WHERE is_current = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_br_factory_product ON bom_recipes (factory_id, product_type_id);
CREATE INDEX IF NOT EXISTS idx_br_status          ON bom_recipes (factory_id, status);
CREATE INDEX IF NOT EXISTS idx_br_source_sample   ON bom_recipes (source_sample_id)
    WHERE source_sample_id IS NOT NULL;

COMMENT ON TABLE bom_recipes IS
    'M-BOM-1 BOM 配方头. 取代 bom_items 单表设计 (后者兼容期保留 30 天).';

-- ============================================================================
-- 2. 子表: bom_recipe_items (配方项, N rows per recipe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bom_recipe_items (
    id                 BIGSERIAL PRIMARY KEY,
    recipe_id          VARCHAR(191) NOT NULL,
    factory_id         VARCHAR(50)  NOT NULL,

    material_type_id   VARCHAR(191) NOT NULL,
    material_name      VARCHAR(200),

    standard_quantity  DECIMAL(15, 4) NOT NULL,
    yield_rate         DECIMAL(6, 2)  NOT NULL DEFAULT 100.00,
    actual_quantity    DECIMAL(15, 4),
    unit               VARCHAR(20)    NOT NULL,

    unit_price         DECIMAL(15, 4),    -- @PriceSensitive
    tax_rate           DECIMAL(5, 2)  DEFAULT 0,
    item_cost          DECIMAL(15, 4),    -- @PriceSensitive

    material_category  VARCHAR(32)    NOT NULL DEFAULT 'RAW',
    sort_order         INTEGER        NOT NULL DEFAULT 0,

    is_optional        BOOLEAN        NOT NULL DEFAULT FALSE,
    substitute_group   VARCHAR(50),

    remark             VARCHAR(500),

    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at         TIMESTAMP,

    CONSTRAINT fk_bri_recipe   FOREIGN KEY (recipe_id)
        REFERENCES bom_recipes(id) ON DELETE CASCADE,
    CONSTRAINT fk_bri_material FOREIGN KEY (material_type_id)
        REFERENCES raw_material_types(id) ON DELETE RESTRICT,
    CONSTRAINT chk_bri_qty      CHECK (standard_quantity > 0),
    CONSTRAINT chk_bri_yield    CHECK (yield_rate > 0 AND yield_rate <= 100),
    CONSTRAINT chk_bri_category CHECK (material_category IN ('RAW', 'AUXILIARY', 'PACKAGING')),
    CONSTRAINT chk_bri_unit     CHECK (unit IN ('g','kg','mg','ml','L','个','袋','箱','瓶','盒'))
);

CREATE INDEX IF NOT EXISTS idx_bri_recipe
    ON bom_recipe_items (recipe_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_bri_material
    ON bom_recipe_items (factory_id, material_type_id);
CREATE INDEX IF NOT EXISTS idx_bri_substitute
    ON bom_recipe_items (recipe_id, substitute_group)
    WHERE substitute_group IS NOT NULL;

COMMENT ON TABLE bom_recipe_items IS
    'M-BOM-1 BOM 配方项. 硬外键 raw_material_types — 禁手写物料名称 (客户原话 May10 line 217-222).';

-- ============================================================================
-- 3. 数据迁移: 旧 bom_items → 新 bom_recipes (主) + bom_recipe_items (子)
-- ============================================================================
-- 策略:
--   - 按 (factory_id, product_type_id) GROUP, 每组生成 1 个 DRAFT recipe + N 个 items
--   - output_quantity_per_unit / overall_yield_rate 旧数据无信息, 用占位 (1.0 / 100.00)
--     status='DRAFT' 提醒用户激活前修正, source_type='IMPORTED' 标记来源
--   - 过滤孤儿 material_type_id (FK ON DELETE RESTRICT 不允许悬空), 跳过 + RAISE NOTICE
--   - 单位 normalize: 旧值 NULL/'' → 'g'; '公斤'/'KG' → 'kg'; '克'/'G' → 'g'; unknown → 'g'
--   - 旧 bom_items 行 deleted_at IS NOT NULL 的不迁
--   - 旧 bom_items 仍保留 30 天 (BomController + BomExpansionService 继续用)

DO $migrate$
DECLARE
    legacy_row_count    INTEGER;
    new_recipe_count    INTEGER;
    new_item_count      INTEGER;
    orphan_count        INTEGER;
    invalid_unit_count  INTEGER;
BEGIN
    SELECT COUNT(*) INTO legacy_row_count FROM bom_items WHERE deleted_at IS NULL;
    RAISE NOTICE 'M-BOM-1 migration: legacy bom_items rows (active) = %', legacy_row_count;

    IF legacy_row_count = 0 THEN
        RAISE NOTICE 'M-BOM-1 migration: bom_items empty, skip data migration step';
        RETURN;
    END IF;

    -- 3.1 检测孤儿 material_type_id (跳过, 仅警告)
    SELECT COUNT(*) INTO orphan_count
    FROM bom_items bi
    WHERE bi.deleted_at IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM raw_material_types rmt
          WHERE rmt.id = bi.material_type_id AND rmt.deleted_at IS NULL
      );
    IF orphan_count > 0 THEN
        RAISE WARNING 'M-BOM-1 migration: % bom_items rows have orphan material_type_id — SKIPPED (data quality 修复后另起 follow-up migration)', orphan_count;
    END IF;

    -- 3.2 INSERT bom_recipes (主, 1 row per (factory, product))
    INSERT INTO bom_recipes (
        id, factory_id, recipe_code, product_type_id, product_name,
        version, is_current,
        overall_yield_rate, output_quantity_per_unit, output_unit,
        status, source_type,
        notes,
        created_at, updated_at
    )
    SELECT
        gen_random_uuid()::text                                                AS id,
        bi.factory_id,
        'BOM-LEGACY-' || bi.factory_id || '-' || LPAD(
            (ROW_NUMBER() OVER (PARTITION BY bi.factory_id ORDER BY bi.product_type_id))::text,
            6, '0'
        )                                                                       AS recipe_code,
        bi.product_type_id,
        COALESCE(MAX(bi.product_name), bi.product_type_id)                      AS product_name,
        1                                                                       AS version,
        TRUE                                                                    AS is_current,
        100.00                                                                  AS overall_yield_rate,
        1.0000                                                                  AS output_quantity_per_unit,
        'g'                                                                     AS output_unit,
        'DRAFT'                                                                 AS status,
        'IMPORTED'                                                              AS source_type,
        'Migrated from legacy bom_items (V20260516_02). 用户激活前请修正 output_quantity_per_unit 和 overall_yield_rate.' AS notes,
        MIN(bi.created_at)                                                      AS created_at,
        NOW()                                                                   AS updated_at
    FROM bom_items bi
    WHERE bi.deleted_at IS NULL
      AND EXISTS (
          SELECT 1 FROM raw_material_types rmt
          WHERE rmt.id = bi.material_type_id AND rmt.deleted_at IS NULL
      )
    GROUP BY bi.factory_id, bi.product_type_id;

    GET DIAGNOSTICS new_recipe_count = ROW_COUNT;
    RAISE NOTICE 'M-BOM-1 migration: bom_recipes inserted = %', new_recipe_count;

    -- 3.3 INSERT bom_recipe_items (子, N rows per recipe)
    INSERT INTO bom_recipe_items (
        recipe_id, factory_id,
        material_type_id, material_name,
        standard_quantity, yield_rate, unit,
        unit_price, tax_rate,
        material_category, sort_order, remark,
        created_at, updated_at
    )
    SELECT
        br.id                                                          AS recipe_id,
        bi.factory_id,
        bi.material_type_id,
        bi.material_name,
        bi.standard_quantity,
        COALESCE(bi.yield_rate, 100.00)                                AS yield_rate,
        CASE
            WHEN bi.unit IS NULL OR bi.unit = ''                       THEN 'g'
            WHEN LOWER(bi.unit) = 'kg' OR bi.unit = '公斤'              THEN 'kg'
            WHEN LOWER(bi.unit) = 'g'  OR bi.unit = '克'                THEN 'g'
            WHEN LOWER(bi.unit) = 'mg' OR bi.unit = '毫克'              THEN 'mg'
            WHEN LOWER(bi.unit) = 'ml' OR bi.unit = '毫升'              THEN 'ml'
            WHEN LOWER(bi.unit) = 'l'  OR bi.unit = '升'                THEN 'L'
            WHEN bi.unit IN ('个','袋','箱','瓶','盒')                  THEN bi.unit
            ELSE 'g'  -- fallback (DRAFT 状态用户激活前会看到)
        END                                                            AS unit,
        bi.unit_price,
        COALESCE(bi.tax_rate, 0)                                       AS tax_rate,
        COALESCE(NULLIF(bi.material_category, ''), 'RAW')              AS material_category,
        COALESCE(bi.sort_order, 0)                                     AS sort_order,
        bi.remark,
        bi.created_at,
        NOW()                                                          AS updated_at
    FROM bom_items bi
    JOIN bom_recipes br
        ON br.factory_id      = bi.factory_id
       AND br.product_type_id = bi.product_type_id
       AND br.source_type     = 'IMPORTED'
       AND br.version         = 1
    WHERE bi.deleted_at IS NULL
      AND EXISTS (
          SELECT 1 FROM raw_material_types rmt
          WHERE rmt.id = bi.material_type_id AND rmt.deleted_at IS NULL
      );

    GET DIAGNOSTICS new_item_count = ROW_COUNT;
    RAISE NOTICE 'M-BOM-1 migration: bom_recipe_items inserted = %', new_item_count;

    -- 3.4 invalid unit warning (rows we coerced to 'g')
    SELECT COUNT(*) INTO invalid_unit_count
    FROM bom_items bi
    WHERE bi.deleted_at IS NULL
      AND bi.unit IS NOT NULL
      AND bi.unit <> ''
      AND LOWER(bi.unit) NOT IN ('g','kg','mg','ml','l')
      AND bi.unit NOT IN ('公斤','克','毫克','毫升','升','个','袋','箱','瓶','盒');
    IF invalid_unit_count > 0 THEN
        RAISE WARNING 'M-BOM-1 migration: % bom_items rows had invalid unit (coerced to ''g'', 用户激活前可改)', invalid_unit_count;
    END IF;

    RAISE NOTICE 'M-BOM-1 migration COMPLETE: % recipes / % items / % orphans skipped',
                 new_recipe_count, new_item_count, orphan_count;
END
$migrate$;
