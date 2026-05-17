-- ============================================================
-- P-NUCLEAR-1 (28-Backlog #30): 核价单 询价 → 核价 → 采购 pipeline
-- ============================================================
-- 业务: buyer 创建询价 → 多供应商提交报价 → buyer 选定最优 + 转化为采购单
-- 防呆 R4: inquiry_quotes.purchase_order_id 非空时 selectAndConvert idempotent 拒绝重复
-- Pre-assigned Flyway slot V20260606_17 by organizer.
-- ============================================================

-- 核价单主表
CREATE TABLE IF NOT EXISTS inquiry_quotes (
    id                       VARCHAR(191) PRIMARY KEY,
    factory_id               VARCHAR(191) NOT NULL,
    inquiry_number           VARCHAR(50)  NOT NULL,
    title                    VARCHAR(200),
    material_type_id         VARCHAR(191) NOT NULL,
    material_name            VARCHAR(200),
    specification            VARCHAR(200),
    quantity                 NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    unit                     VARCHAR(20)  NOT NULL,
    inquiry_date             DATE         NOT NULL,
    required_date            DATE,
    status                   VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    selected_supplier_id     VARCHAR(191),
    selected_unit_price      NUMERIC(15, 4),
    purchase_order_id        VARCHAR(191),
    purchase_order_number    VARCHAR(50),
    created_by               BIGINT       NOT NULL,
    version                  BIGINT       NOT NULL DEFAULT 0,
    remark                   TEXT,
    created_at               TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at               TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_at               TIMESTAMP,
    CONSTRAINT uk_iq_factory_number UNIQUE (factory_id, inquiry_number)
);

CREATE INDEX IF NOT EXISTS idx_iq_factory       ON inquiry_quotes(factory_id);
CREATE INDEX IF NOT EXISTS idx_iq_status        ON inquiry_quotes(status);
CREATE INDEX IF NOT EXISTS idx_iq_inquiry_date  ON inquiry_quotes(inquiry_date);
CREATE INDEX IF NOT EXISTS idx_iq_material      ON inquiry_quotes(material_type_id);
CREATE INDEX IF NOT EXISTS idx_iq_po            ON inquiry_quotes(purchase_order_id);

-- 供应商报价表 (1-N relation)
CREATE TABLE IF NOT EXISTS inquiry_quote_supplier_prices (
    id                  VARCHAR(191) PRIMARY KEY,
    inquiry_quote_id    VARCHAR(191) NOT NULL,
    supplier_id         VARCHAR(191) NOT NULL,
    unit_price          NUMERIC(15, 4) NOT NULL CHECK (unit_price > 0),
    tax_rate            NUMERIC(5, 2)  DEFAULT 0,
    valid_until         DATE,
    quoted_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    delivery_days       INT,
    remark              VARCHAR(500),
    created_at          TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at          TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_at          TIMESTAMP,
    CONSTRAINT uk_iqsp_quote_supplier UNIQUE (inquiry_quote_id, supplier_id),
    CONSTRAINT fk_iqsp_quote    FOREIGN KEY (inquiry_quote_id) REFERENCES inquiry_quotes(id),
    CONSTRAINT fk_iqsp_supplier FOREIGN KEY (supplier_id)      REFERENCES suppliers(id)
);

CREATE INDEX IF NOT EXISTS idx_iqsp_quote    ON inquiry_quote_supplier_prices(inquiry_quote_id);
CREATE INDEX IF NOT EXISTS idx_iqsp_supplier ON inquiry_quote_supplier_prices(supplier_id);

-- ============================================================
-- 反向 FK: purchase_orders.inquiry_quote_id
-- ============================================================
-- 用于:
--  1. PO 详情页显示"来源核价单"
--  2. inquiry 详情页"已生成采购单"反向 link
--  3. 防呆 R4 idempotent guard 的备份字段 (主字段在 inquiry_quotes.purchase_order_id)
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS inquiry_quote_id VARCHAR(191);

-- 注: 不加 FOREIGN KEY 约束 — purchase_orders 已经是高频写表, 加 FK 在 inquiry
-- 软删除场景下需级联处理. 应用层 (InquiryQuoteService) 已保证一致性.

CREATE INDEX IF NOT EXISTS idx_po_inquiry_quote
    ON purchase_orders(inquiry_quote_id)
    WHERE inquiry_quote_id IS NOT NULL;

-- ============================================================
-- 自动 updated_at 触发器 (PG, mirror database-entity-sync.md 规范)
-- update_updated_at() helper 在 V20260409_01__canvas_config_tables.sql 中定义.
-- BaseEntity.@PreUpdate 也写 updated_at — 触发器是 belt + suspenders.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inquiry_quotes_updated_at'
    ) THEN
        CREATE TRIGGER trg_inquiry_quotes_updated_at
        BEFORE UPDATE ON inquiry_quotes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_iqsp_updated_at'
    ) THEN
        CREATE TRIGGER trg_iqsp_updated_at
        BEFORE UPDATE ON inquiry_quote_supplier_prices
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;
