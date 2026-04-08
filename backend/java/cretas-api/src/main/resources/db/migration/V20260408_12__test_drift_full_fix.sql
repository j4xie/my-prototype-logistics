-- V20260408_12 — test 环境 schema drift 全量修复
--
-- 背景: test cretas_db 在 Apr 7-8 部署后发现多张表 column/relation 缺失,
-- 本文件合并所有漂移补丁, 统一用 IF NOT EXISTS 幂等,
-- 同时作为 prod 部署时的追加保险.
--
-- 依据: 触发 500 的 endpoint 日志 + entity 源码字段核对.

-- ============================================================
-- 1. material_batches (MaterialBatch.java)
--    源: /api/mobile/F001/material-batches 500
-- ============================================================
ALTER TABLE material_batches
    ADD COLUMN IF NOT EXISTS inbound_type VARCHAR(30);

-- G1 税率分组开票 dry-run 暴露: customers.bank_name
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200);

-- ============================================================
-- 2. customers (Customer.java)
--    源: customer 列表 500 (c1_0.bank_account)
-- ============================================================
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100);

-- ============================================================
-- 3. product_types (ProductType.java)
--    源: product_types 查询 500 (pt1_0.box_conversion_coefficient)
-- ============================================================
ALTER TABLE product_types
    ADD COLUMN IF NOT EXISTS box_conversion_coefficient NUMERIC(10, 4);

-- ============================================================
-- 4. process_tasks (ProcessTask.java)
--    源: 调度/APS 扫描 500 (pt1_0.input_quantity, 另一 pt1 别名)
-- ============================================================
ALTER TABLE process_tasks
    ADD COLUMN IF NOT EXISTS input_quantity NUMERIC(12, 2);

-- ============================================================
-- 5. raw_material_types (RawMaterialType.java)
--    源: 原材料查询 500 (rmt1_0.moving_avg_price)
-- ============================================================
ALTER TABLE raw_material_types
    ADD COLUMN IF NOT EXISTS moving_avg_price NUMERIC(12, 4);

-- ============================================================
-- 6. sales_orders (SalesOrder.java)
--    源: /api/mobile/F001/sales-orders 500
--    注: V20260408_11 已补其他 16 列, 这两列是后续发现的
-- ============================================================
ALTER TABLE sales_orders
    ADD COLUMN IF NOT EXISTS actual_shipped_amount NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS box_quantity NUMERIC(15, 2);

-- ============================================================
-- 7. sales_order_items (SalesOrderItem.java)
--    源: sales_orders join sales_order_items 500 (i1_0.box_quantity)
-- ============================================================
ALTER TABLE sales_order_items
    ADD COLUMN IF NOT EXISTS box_quantity NUMERIC(15, 2);

-- ============================================================
-- 8. operational_quotes (OperationalQuote.java)
--    源: /api/mobile/F001/operational-quotes 500
--    V20260407_04 定义过, 但未应用到 test DB. 此处幂等重建.
-- ============================================================
CREATE TABLE IF NOT EXISTS operational_quotes (
    id                    VARCHAR(191) PRIMARY KEY,
    factory_id            VARCHAR(191) NOT NULL,
    quote_no              VARCHAR(50)  NOT NULL,
    sample_id             VARCHAR(191),
    customer_id           VARCHAR(191),
    product_type_id       VARCHAR(191),
    bom_id                VARCHAR(191),
    quote_type            VARCHAR(20),
    unit_price            NUMERIC(15, 2),
    unit                  VARCHAR(20),
    min_order_qty         NUMERIC(15, 3),
    cost_price            NUMERIC(15, 2),
    margin_rate           NUMERIC(6, 4),
    valid_until           DATE,
    status                VARCHAR(30) NOT NULL,
    submitted_by_user_id  BIGINT,
    submitted_at          TIMESTAMP,
    quoted_by_user_id     BIGINT,
    quoted_by_name        VARCHAR(100),
    quoted_at             TIMESTAMP,
    approver_user_id      BIGINT,
    approver_name         VARCHAR(100),
    approved_at           TIMESTAMP,
    rejection_reason      TEXT,
    remarks               TEXT,
    revision_count        INTEGER DEFAULT 0,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at            TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oq_quote_no ON operational_quotes (quote_no);
CREATE INDEX IF NOT EXISTS idx_oq_factory_status ON operational_quotes (factory_id, status);
CREATE INDEX IF NOT EXISTS idx_oq_customer ON operational_quotes (customer_id);
CREATE INDEX IF NOT EXISTS idx_oq_product ON operational_quotes (product_type_id);
CREATE INDEX IF NOT EXISTS idx_oq_quoted_by ON operational_quotes (quoted_by_user_id);
