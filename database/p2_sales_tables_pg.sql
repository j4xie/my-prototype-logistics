-- ============================================================
-- P2: 销售订单 + 发货出库 + 成品库存 + 套餐组合（PostgreSQL）
-- 通用设计：工厂销售出货 = 餐饮外卖/堂食/团购
-- 执行前提：P0, P1 已执行
-- ============================================================

-- 1. 成品库存批次（对标 material_batches 的成品版）
CREATE TABLE IF NOT EXISTS finished_goods_batches (
    id                  VARCHAR(191) NOT NULL PRIMARY KEY,
    factory_id          VARCHAR(191) NOT NULL,
    batch_number        VARCHAR(50)  NOT NULL,
    product_type_id     VARCHAR(191) NOT NULL,
    product_name        VARCHAR(200),
    produced_quantity   NUMERIC(15,4) NOT NULL,
    shipped_quantity    NUMERIC(15,4) NOT NULL DEFAULT 0,
    reserved_quantity   NUMERIC(15,4) NOT NULL DEFAULT 0,
    unit                VARCHAR(20)   NOT NULL,
    unit_price          NUMERIC(15,4),
    production_date     DATE,
    expire_date         DATE,
    storage_location    VARCHAR(100),
    production_plan_id  VARCHAR(191),
    status              VARCHAR(32)  NOT NULL DEFAULT 'AVAILABLE',
    created_by          BIGINT,
    remark              TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP,

    CONSTRAINT uk_fgb_factory_batch UNIQUE (factory_id, batch_number),
    CONSTRAINT fk_fgb_factory FOREIGN KEY (factory_id) REFERENCES factories(id),
    CONSTRAINT fk_fgb_product FOREIGN KEY (product_type_id) REFERENCES product_types(id)
);

CREATE INDEX IF NOT EXISTS idx_fgb_factory         ON finished_goods_batches(factory_id);
CREATE INDEX IF NOT EXISTS idx_fgb_product         ON finished_goods_batches(product_type_id);
CREATE INDEX IF NOT EXISTS idx_fgb_status          ON finished_goods_batches(status);
CREATE INDEX IF NOT EXISTS idx_fgb_production_date ON finished_goods_batches(production_date);
CREATE INDEX IF NOT EXISTS idx_fgb_expire_date     ON finished_goods_batches(expire_date);

-- 2. 销售订单主表
CREATE TABLE IF NOT EXISTS sales_orders (
    id                      VARCHAR(191) NOT NULL PRIMARY KEY,
    factory_id              VARCHAR(191) NOT NULL,
    order_number            VARCHAR(50)  NOT NULL,
    customer_id             VARCHAR(191) NOT NULL,
    order_date              DATE         NOT NULL,
    required_delivery_date  DATE,
    delivery_address        TEXT,
    total_amount            NUMERIC(15,2) DEFAULT 0,
    discount_amount         NUMERIC(15,2) DEFAULT 0,
    tax_amount              NUMERIC(15,2) DEFAULT 0,
    status                  VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    created_by              BIGINT       NOT NULL,
    confirmed_at            TIMESTAMP,
    remark                  TEXT,
    created_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    deleted_at              TIMESTAMP,

    CONSTRAINT uk_so_factory_order UNIQUE (factory_id, order_number),
    CONSTRAINT fk_so_factory FOREIGN KEY (factory_id) REFERENCES factories(id),
    CONSTRAINT fk_so_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_so_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT ck_so_status CHECK (status IN ('DRAFT','CONFIRMED','PROCESSING','PARTIAL_DELIVERED','COMPLETED','CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_so_factory    ON sales_orders(factory_id);
CREATE INDEX IF NOT EXISTS idx_so_customer   ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_status     ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_so_order_date ON sales_orders(order_date);

-- 3. 销售订单行项目
CREATE TABLE IF NOT EXISTS sales_order_items (
    id                  BIGSERIAL PRIMARY KEY,
    sales_order_id      VARCHAR(191) NOT NULL,
    product_type_id     VARCHAR(191) NOT NULL,
    product_name        VARCHAR(200),
    quantity            NUMERIC(15,4) NOT NULL,
    unit                VARCHAR(20)   NOT NULL,
    unit_price          NUMERIC(15,4),
    discount_rate       NUMERIC(5,2)  DEFAULT 0,
    delivered_quantity   NUMERIC(15,4) NOT NULL DEFAULT 0,
    remark              VARCHAR(500),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP,

    CONSTRAINT fk_soi_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_soi_product FOREIGN KEY (product_type_id) REFERENCES product_types(id)
);

CREATE INDEX IF NOT EXISTS idx_soi_order   ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_soi_product ON sales_order_items(product_type_id);

-- 4. 发货/出库单主表
CREATE TABLE IF NOT EXISTS sales_delivery_records (
    id                  VARCHAR(191) NOT NULL PRIMARY KEY,
    factory_id          VARCHAR(191) NOT NULL,
    delivery_number     VARCHAR(50)  NOT NULL,
    sales_order_id      VARCHAR(191),
    customer_id         VARCHAR(191) NOT NULL,
    delivery_date       DATE         NOT NULL,
    delivery_address    TEXT,
    logistics_company   VARCHAR(100),
    tracking_number     VARCHAR(100),
    status              VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    shipped_by          BIGINT       NOT NULL,
    total_amount        NUMERIC(15,2) DEFAULT 0,
    remark              TEXT,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP,

    CONSTRAINT uk_sdr_factory_delivery UNIQUE (factory_id, delivery_number),
    CONSTRAINT fk_sdr_factory FOREIGN KEY (factory_id) REFERENCES factories(id),
    CONSTRAINT fk_sdr_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
    CONSTRAINT fk_sdr_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_sdr_shipped_by FOREIGN KEY (shipped_by) REFERENCES users(id),
    CONSTRAINT ck_sdr_status CHECK (status IN ('DRAFT','PICKED','SHIPPED','DELIVERED','RETURNED'))
);

CREATE INDEX IF NOT EXISTS idx_sdr_factory       ON sales_delivery_records(factory_id);
CREATE INDEX IF NOT EXISTS idx_sdr_order         ON sales_delivery_records(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sdr_customer      ON sales_delivery_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_sdr_status        ON sales_delivery_records(status);
CREATE INDEX IF NOT EXISTS idx_sdr_delivery_date ON sales_delivery_records(delivery_date);

-- 5. 发货行项目
CREATE TABLE IF NOT EXISTS sales_delivery_items (
    id                      BIGSERIAL PRIMARY KEY,
    delivery_record_id      VARCHAR(191) NOT NULL,
    product_type_id         VARCHAR(191) NOT NULL,
    product_name            VARCHAR(200),
    delivered_quantity      NUMERIC(15,4) NOT NULL,
    unit                    VARCHAR(20)   NOT NULL,
    unit_price              NUMERIC(15,4),
    finished_goods_batch_id VARCHAR(191),
    remark                  VARCHAR(500),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at              TIMESTAMP,

    CONSTRAINT fk_sdi_record FOREIGN KEY (delivery_record_id) REFERENCES sales_delivery_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_sdi_product FOREIGN KEY (product_type_id) REFERENCES product_types(id),
    CONSTRAINT fk_sdi_batch FOREIGN KEY (finished_goods_batch_id) REFERENCES finished_goods_batches(id)
);

CREATE INDEX IF NOT EXISTS idx_sdi_record  ON sales_delivery_items(delivery_record_id);
CREATE INDEX IF NOT EXISTS idx_sdi_product ON sales_delivery_items(product_type_id);
CREATE INDEX IF NOT EXISTS idx_sdi_batch   ON sales_delivery_items(finished_goods_batch_id);

-- 6. 套餐/组合商品明细（product→product 关系）
CREATE TABLE IF NOT EXISTS combo_items (
    id                  BIGSERIAL PRIMARY KEY,
    factory_id          VARCHAR(191) NOT NULL,
    combo_product_id    VARCHAR(191) NOT NULL,
    child_product_id    VARCHAR(191) NOT NULL,
    child_product_name  VARCHAR(200),
    quantity            NUMERIC(15,4) NOT NULL DEFAULT 1,
    sort_order          INTEGER DEFAULT 0,
    replaceable         BOOLEAN DEFAULT FALSE,
    remark              VARCHAR(500),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP,

    CONSTRAINT fk_ci_factory FOREIGN KEY (factory_id) REFERENCES factories(id),
    CONSTRAINT fk_ci_combo FOREIGN KEY (combo_product_id) REFERENCES product_types(id),
    CONSTRAINT fk_ci_child FOREIGN KEY (child_product_id) REFERENCES product_types(id)
);

CREATE INDEX IF NOT EXISTS idx_ci_factory ON combo_items(factory_id);
CREATE INDEX IF NOT EXISTS idx_ci_combo   ON combo_items(combo_product_id);
CREATE INDEX IF NOT EXISTS idx_ci_child   ON combo_items(child_product_id);

-- ============================================================
-- 完成提示
-- ============================================================
-- 执行后验证:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN (
--     'finished_goods_batches', 'sales_orders', 'sales_order_items',
--     'sales_delivery_records', 'sales_delivery_items', 'combo_items'
--   );
-- 预期结果: 6 张表
