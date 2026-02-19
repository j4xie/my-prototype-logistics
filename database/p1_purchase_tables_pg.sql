-- ============================================================
-- P1: 采购订单 + 入库管理表（PostgreSQL）
-- 通用设计：工厂采购原料 = 餐饮进货食材
-- 执行前提：P0 已执行（factories 表已有 type/parent_id/level）
-- ============================================================

-- 1. 采购订单主表
CREATE TABLE IF NOT EXISTS purchase_orders (
    id              VARCHAR(191) NOT NULL PRIMARY KEY,
    factory_id      VARCHAR(191) NOT NULL,
    order_number    VARCHAR(50)  NOT NULL,
    supplier_id     VARCHAR(191) NOT NULL,
    purchase_type   VARCHAR(32)  NOT NULL DEFAULT 'DIRECT',
    order_date      DATE         NOT NULL,
    expected_delivery_date DATE,
    total_amount    NUMERIC(15,2) DEFAULT 0,
    tax_amount      NUMERIC(15,2) DEFAULT 0,
    status          VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    created_by      BIGINT       NOT NULL,
    approved_by     BIGINT,
    approved_at     TIMESTAMP,
    remark          TEXT,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP,

    CONSTRAINT uk_po_factory_order UNIQUE (factory_id, order_number),
    CONSTRAINT fk_po_factory FOREIGN KEY (factory_id) REFERENCES factories(id),
    CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_po_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT ck_po_status CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','PARTIAL_RECEIVED','COMPLETED','CANCELLED','CLOSED')),
    CONSTRAINT ck_po_type CHECK (purchase_type IN ('DIRECT','HQ_UNIFIED','URGENT'))
);

CREATE INDEX IF NOT EXISTS idx_po_factory    ON purchase_orders(factory_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier   ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status     ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_order_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_po_type       ON purchase_orders(purchase_type);

-- 2. 采购订单行项目
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id                  BIGSERIAL PRIMARY KEY,
    purchase_order_id   VARCHAR(191) NOT NULL,
    material_type_id    VARCHAR(191) NOT NULL,
    material_name       VARCHAR(200),
    quantity            NUMERIC(15,4) NOT NULL,
    unit                VARCHAR(20)   NOT NULL,
    unit_price          NUMERIC(15,4),
    tax_rate            NUMERIC(5,2)  DEFAULT 0,
    received_quantity   NUMERIC(15,4) NOT NULL DEFAULT 0,
    remark              VARCHAR(500),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP,

    CONSTRAINT fk_poi_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_poi_material FOREIGN KEY (material_type_id) REFERENCES raw_material_types(id)
);

CREATE INDEX IF NOT EXISTS idx_poi_order    ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_material ON purchase_order_items(material_type_id);

-- 3. 采购入库单主表
CREATE TABLE IF NOT EXISTS purchase_receive_records (
    id              VARCHAR(191) NOT NULL PRIMARY KEY,
    factory_id      VARCHAR(191) NOT NULL,
    receive_number  VARCHAR(50)  NOT NULL,
    purchase_order_id VARCHAR(191),
    supplier_id     VARCHAR(191) NOT NULL,
    receive_date    DATE         NOT NULL,
    warehouse_id    VARCHAR(191),
    status          VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    received_by     BIGINT       NOT NULL,
    total_amount    NUMERIC(15,2) DEFAULT 0,
    remark          TEXT,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP,

    CONSTRAINT uk_prr_factory_receive UNIQUE (factory_id, receive_number),
    CONSTRAINT fk_prr_factory FOREIGN KEY (factory_id) REFERENCES factories(id),
    CONSTRAINT fk_prr_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    CONSTRAINT fk_prr_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_prr_received_by FOREIGN KEY (received_by) REFERENCES users(id),
    CONSTRAINT ck_prr_status CHECK (status IN ('DRAFT','PENDING_QC','CONFIRMED','REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_prr_factory  ON purchase_receive_records(factory_id);
CREATE INDEX IF NOT EXISTS idx_prr_po       ON purchase_receive_records(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_prr_supplier ON purchase_receive_records(supplier_id);
CREATE INDEX IF NOT EXISTS idx_prr_date     ON purchase_receive_records(receive_date);
CREATE INDEX IF NOT EXISTS idx_prr_status   ON purchase_receive_records(status);

-- 4. 采购入库行项目
CREATE TABLE IF NOT EXISTS purchase_receive_items (
    id                  BIGSERIAL PRIMARY KEY,
    receive_record_id   VARCHAR(191) NOT NULL,
    material_type_id    VARCHAR(191) NOT NULL,
    material_name       VARCHAR(200),
    received_quantity   NUMERIC(15,4) NOT NULL,
    unit                VARCHAR(20)   NOT NULL,
    unit_price          NUMERIC(15,4),
    material_batch_id   VARCHAR(191),
    qc_result           VARCHAR(32),
    remark              VARCHAR(500),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP,

    CONSTRAINT fk_pri_record FOREIGN KEY (receive_record_id) REFERENCES purchase_receive_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_pri_material FOREIGN KEY (material_type_id) REFERENCES raw_material_types(id),
    CONSTRAINT fk_pri_batch FOREIGN KEY (material_batch_id) REFERENCES material_batches(id)
);

CREATE INDEX IF NOT EXISTS idx_pri_record   ON purchase_receive_items(receive_record_id);
CREATE INDEX IF NOT EXISTS idx_pri_material ON purchase_receive_items(material_type_id);
CREATE INDEX IF NOT EXISTS idx_pri_batch    ON purchase_receive_items(material_batch_id);

-- ============================================================
-- 完成提示
-- ============================================================
-- 执行后验证:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name LIKE 'purchase_%';
-- 预期结果: purchase_orders, purchase_order_items,
--           purchase_receive_records, purchase_receive_items
