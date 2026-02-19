-- ============================================================
-- P0: Factory 组织层级扩展 + ProductType 分类扩展
-- 支持工厂+餐饮通用进销存，单店/总部分店两种模式
-- PostgreSQL
-- 日期: 2026-02-19
-- ============================================================

-- 1. Factory 表新增组织类型与层级字段
-- type: 组织类型 (FACTORY/RESTAURANT/HEADQUARTERS/BRANCH/CENTRAL_KITCHEN)
-- parent_id: 上级组织ID (自引用)
-- level: 层级深度 (0=独立/集团, 1=总部, 2=区域, 3=门店)

ALTER TABLE factories
    ADD COLUMN IF NOT EXISTS type VARCHAR(32) NOT NULL DEFAULT 'FACTORY',
    ADD COLUMN IF NOT EXISTS parent_id VARCHAR(191),
    ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 0;

-- 2. 外键约束: parent_id → factories.id
ALTER TABLE factories
    ADD CONSTRAINT fk_factory_parent
    FOREIGN KEY (parent_id) REFERENCES factories(id)
    ON DELETE SET NULL;

-- 3. 索引: 加速层级查询
CREATE INDEX IF NOT EXISTS idx_factory_type ON factories(type);
CREATE INDEX IF NOT EXISTS idx_factory_parent ON factories(parent_id);
CREATE INDEX IF NOT EXISTS idx_factory_level ON factories(level);

-- 4. 现有数据迁移: 所有现有工厂默认为独立工厂
UPDATE factories SET type = 'FACTORY', level = 0, parent_id = NULL
WHERE type IS NULL OR type = 'FACTORY';

-- 5. CHECK 约束: 确保 type 值合法
ALTER TABLE factories
    ADD CONSTRAINT chk_factory_type
    CHECK (type IN ('FACTORY', 'RESTAURANT', 'HEADQUARTERS', 'BRANCH', 'CENTRAL_KITCHEN'));

-- ============================================================
-- 验证
-- ============================================================
-- SELECT id, name, type, parent_id, level FROM factories;
