-- 原料包装层级表
-- 用户需求 (2026-05-06): 新建原料类型时支持配置三级单位+换算关系,
-- 例: 三文鱼 一级 kg, 10kg/箱 (二级 箱), 12箱/柜 (三级 柜).
-- 一级 = raw_material_types.unit (基础单位, 必填); 二/三级可选.
-- 一个原料对应一条层级配置 (UNIQUE on material_type_id).

CREATE TABLE IF NOT EXISTS material_packaging_hierarchy (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    material_type_id VARCHAR(36) NOT NULL,

    -- 一级单位 (基础, 与 raw_material_types.unit 一致)
    level1_unit VARCHAR(20) NOT NULL,

    -- 二级 (例: 10 kg / 箱)
    level1_per_level2 DECIMAL(15, 4),
    level2_unit VARCHAR(20),

    -- 三级 (例: 12 箱 / 柜)
    level2_per_level3 DECIMAL(15, 4),
    level3_unit VARCHAR(20),

    notes VARCHAR(500),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    created_by BIGINT,

    CONSTRAINT uk_material_packaging_material UNIQUE (material_type_id),

    -- 二级配对完整: 数量和单位同时存在或同时为空
    CONSTRAINT ck_material_packaging_level2 CHECK (
        (level1_per_level2 IS NULL AND level2_unit IS NULL)
        OR (level1_per_level2 IS NOT NULL AND level1_per_level2 > 0 AND level2_unit IS NOT NULL)
    ),

    -- 三级配对完整 + 必须有二级才能有三级
    CONSTRAINT ck_material_packaging_level3 CHECK (
        (level2_per_level3 IS NULL AND level3_unit IS NULL)
        OR (
            level2_per_level3 IS NOT NULL AND level2_per_level3 > 0 AND level3_unit IS NOT NULL
            AND level2_unit IS NOT NULL
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_mph_factory ON material_packaging_hierarchy (factory_id);
CREATE INDEX IF NOT EXISTS idx_mph_material_type ON material_packaging_hierarchy (material_type_id);
CREATE INDEX IF NOT EXISTS idx_mph_deleted_at ON material_packaging_hierarchy (deleted_at);
