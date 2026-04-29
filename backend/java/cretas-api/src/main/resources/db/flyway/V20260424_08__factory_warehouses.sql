-- P1-4 双仓体系 v1 §2.9 — FactoryWarehouse 查询表
--
-- 2026-04-24: 重命名 + 移动. 原文件 V20260411_03__factory_warehouses.sql 在
-- db/migration/ 从未被 Flyway 扫描 (项目用 spring.flyway.locations=
-- classpath:db/flyway). 结果 prod 表不存在, /api/mobile/F001/factory/warehouses
-- 持续 500 (audit 2026-04-24 发现).
--
-- 客户原话 (会议 3225s): "物流仓 + 鲜棉仓, 鲜棉仓当天清仓"
--
-- 仅为 FMR.sourceWarehouseId / targetWarehouseId 提供 reference data.
-- 当前不参与 stock query (MaterialBatch 无 warehouseId 字段, 见 P0-5 B2 ADR).
-- 若未来启动 warehouse 维度库存 epic, 此 table 可作为 anchor 扩展.

CREATE TABLE IF NOT EXISTS factory_warehouses (
    id              VARCHAR(64)  PRIMARY KEY,
    factory_id      VARCHAR(64)  NOT NULL,
    code            VARCHAR(32)  NOT NULL,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(20)  NOT NULL CHECK (type IN ('LOGISTICS','WORKSHOP','OTHER')),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    remarks         TEXT,
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW(),
    deleted_at      TIMESTAMP,
    CONSTRAINT uk_fw_factory_code UNIQUE (factory_id, code)
);

CREATE INDEX IF NOT EXISTS idx_fw_factory ON factory_warehouses(factory_id);
CREATE INDEX IF NOT EXISTS idx_fw_factory_type ON factory_warehouses(factory_id, type);

COMMENT ON TABLE factory_warehouses IS
    '工厂仓库查询表 (P1-4, v1 §2.9 双仓体系). 仅为 FMR 字段提供 reference data, 不参与库存查询.';
COMMENT ON COLUMN factory_warehouses.type IS
    'LOGISTICS=物流仓 / WORKSHOP=鲜棉仓(当天清仓) / OTHER=其他扩展';

-- Seed: 给每个 factory 自动生成 2 个默认仓 (物流仓 + 鲜棉仓)
-- 使用 INSERT ... SELECT ... WHERE NOT EXISTS 保证幂等
INSERT INTO factory_warehouses (id, factory_id, code, name, type, is_active, created_at, updated_at)
SELECT
    gen_random_uuid()::text,
    f.id,
    'WH-LOG',
    '物流仓',
    'LOGISTICS',
    true,
    NOW(),
    NOW()
FROM factories f
WHERE NOT EXISTS (
    SELECT 1 FROM factory_warehouses w WHERE w.factory_id = f.id AND w.code = 'WH-LOG'
);

INSERT INTO factory_warehouses (id, factory_id, code, name, type, is_active, created_at, updated_at)
SELECT
    gen_random_uuid()::text,
    f.id,
    'WH-WKS',
    '鲜棉仓',
    'WORKSHOP',
    true,
    NOW(),
    NOW()
FROM factories f
WHERE NOT EXISTS (
    SELECT 1 FROM factory_warehouses w WHERE w.factory_id = f.id AND w.code = 'WH-WKS'
);
