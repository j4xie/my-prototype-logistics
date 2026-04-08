-- ============================================================
-- 餐饮 SmartBI BOM Layer 2+3 持久化 — W5.1
-- 日期: 2026-04-08
-- 数据库: smartbi_db (test) / smartbi_prod_db (prod)
--
-- 背景: Week 4.4 实现了 SkuFormManager + MonthlyPurchaseCalibrator
-- 作为 in-memory, 进程重启数据丢失. W5.1 把它们迁到 PostgreSQL.
--
-- 表清单:
--   1. restaurant_sku_forms        (Layer 2, TOP 20 SKU 主料成本表)
--   2. restaurant_monthly_purchases (Layer 3, 月度采购反推校准)
--
-- 隔离原则 (与 Week 1 一致):
--   - 表前缀 restaurant_*
--   - factory_id + store_id 组合索引
--   - JSONB 存 ingredients / category_breakdown (灵活 schema)
-- ============================================================


-- ============================================================
-- 1. Layer 2: SKU 主料成本表单
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_sku_forms (
    id BIGSERIAL PRIMARY KEY,

    factory_id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64) NULL,                      -- NULL = 工厂级, 非 NULL = 门店级
    sku_name VARCHAR(255) NOT NULL,                 -- 规范化后的菜品名
    category VARCHAR(128) NOT NULL,                 -- 招牌主菜 / 肉类 / 蔬菜 / ...

    total_cogs_amount NUMERIC(12, 2) NOT NULL,      -- 元/份
    selling_price NUMERIC(12, 2) NULL,
    monthly_sales_quantity NUMERIC(14, 2) NULL,     -- 月销量 (用于算覆盖率)

    ingredients JSONB NULL,                         -- [{name, cost, weight_g, unit_price_per_kg}, ...]

    uploaded_by VARCHAR(64) NULL,                   -- 操作员 (审计追踪)
    notes TEXT NULL,                                -- 备注 (例: '含员工餐成本')

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- 同一 factory+store 同一 SKU 只有一条 (UPSERT 策略)
    CONSTRAINT uk_sku_forms_factory_store_sku UNIQUE (factory_id, store_id, sku_name)
);

CREATE INDEX IF NOT EXISTS idx_sku_forms_factory ON restaurant_sku_forms (factory_id);
CREATE INDEX IF NOT EXISTS idx_sku_forms_category ON restaurant_sku_forms (factory_id, category);
CREATE INDEX IF NOT EXISTS idx_sku_forms_ingredients_gin ON restaurant_sku_forms USING GIN (ingredients);


-- ============================================================
-- 2. Layer 3: 月度采购汇总 (Layer A 自学习源数据)
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_monthly_purchases (
    id BIGSERIAL PRIMARY KEY,

    factory_id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64) NULL,
    period VARCHAR(16) NOT NULL,                    -- "2026-02" / "2026-Q1"

    total_purchase NUMERIC(14, 2) NOT NULL,         -- 总采购额
    total_revenue NUMERIC(14, 2) NOT NULL,          -- 当期营收

    category_breakdown JSONB NULL,                  -- {"肉类": 180000, "海鲜": 55000, ...}

    uploaded_by VARCHAR(64) NULL,
    notes TEXT NULL,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- 同一 factory+store+period 只有一条 (同月重复上传 = 更新)
    CONSTRAINT uk_monthly_purchases_factory_store_period UNIQUE (factory_id, store_id, period),

    -- 数据合理性 CHECK
    CONSTRAINT ck_monthly_purchases_positive_revenue CHECK (total_revenue >= 0),
    CONSTRAINT ck_monthly_purchases_positive_purchase CHECK (total_purchase >= 0)
);

CREATE INDEX IF NOT EXISTS idx_monthly_purchases_factory ON restaurant_monthly_purchases (factory_id);
CREATE INDEX IF NOT EXISTS idx_monthly_purchases_period ON restaurant_monthly_purchases (factory_id, period);
CREATE INDEX IF NOT EXISTS idx_monthly_purchases_breakdown_gin ON restaurant_monthly_purchases USING GIN (category_breakdown);


-- ============================================================
-- 完整性验证
-- ============================================================

-- 验证表创建
SELECT
    'restaurant_sku_forms' AS table_name,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_sku_forms') AS created
UNION ALL
SELECT
    'restaurant_monthly_purchases',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_monthly_purchases');
