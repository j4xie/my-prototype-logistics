-- ============================================================
-- P3: 内部调拨 + 总部定价表（PostgreSQL）
-- 总部↔分店/分厂 物资调拨 + 统一价格管理
-- 执行前提：P0, P1, P2 已执行
-- ============================================================

-- 1. 内部调拨单主表
CREATE TABLE IF NOT EXISTS internal_transfers (
    id                      VARCHAR(191) NOT NULL PRIMARY KEY,
    transfer_number         VARCHAR(50)  NOT NULL,
    transfer_type           VARCHAR(32)  NOT NULL,
    source_factory_id       VARCHAR(191) NOT NULL,
    target_factory_id       VARCHAR(191) NOT NULL,
    transfer_date           DATE         NOT NULL,
    expected_arrival_date   DATE,
    total_amount            NUMERIC(15,2) DEFAULT 0,
    status                  VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    requested_by            BIGINT,
    requested_at            TIMESTAMP,
    approved_by             BIGINT,
    approved_at             TIMESTAMP,
    shipped_at              TIMESTAMP,
    received_at             TIMESTAMP,
    confirmed_at            TIMESTAMP,
    reject_reason           VARCHAR(500),
    remark                  TEXT,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at              TIMESTAMP,

    CONSTRAINT uk_it_source_number UNIQUE (source_factory_id, transfer_number),
    CONSTRAINT fk_it_source FOREIGN KEY (source_factory_id) REFERENCES factories(id),
    CONSTRAINT fk_it_target FOREIGN KEY (target_factory_id) REFERENCES factories(id),
    CONSTRAINT ck_it_status CHECK (status IN ('DRAFT','REQUESTED','APPROVED','REJECTED','SHIPPED','RECEIVED','CONFIRMED','CANCELLED')),
    CONSTRAINT ck_it_type CHECK (transfer_type IN ('HQ_TO_BRANCH','BRANCH_TO_BRANCH','BRANCH_TO_HQ'))
);

CREATE INDEX IF NOT EXISTS idx_it_source        ON internal_transfers(source_factory_id);
CREATE INDEX IF NOT EXISTS idx_it_target        ON internal_transfers(target_factory_id);
CREATE INDEX IF NOT EXISTS idx_it_status        ON internal_transfers(status);
CREATE INDEX IF NOT EXISTS idx_it_type          ON internal_transfers(transfer_type);
CREATE INDEX IF NOT EXISTS idx_it_transfer_date ON internal_transfers(transfer_date);

-- 2. 调拨行项目
CREATE TABLE IF NOT EXISTS internal_transfer_items (
    id                  BIGSERIAL PRIMARY KEY,
    transfer_id         VARCHAR(191) NOT NULL,
    item_type           VARCHAR(32)  NOT NULL,
    material_type_id    VARCHAR(191),
    product_type_id     VARCHAR(191),
    item_name           VARCHAR(200),
    quantity            NUMERIC(15,4) NOT NULL,
    received_quantity   NUMERIC(15,4),
    unit                VARCHAR(20)   NOT NULL,
    unit_price          NUMERIC(15,4),
    source_batch_id     VARCHAR(191),
    target_batch_id     VARCHAR(191),
    remark              VARCHAR(500),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP,

    CONSTRAINT fk_iti_transfer FOREIGN KEY (transfer_id) REFERENCES internal_transfers(id) ON DELETE CASCADE,
    CONSTRAINT ck_iti_type CHECK (item_type IN ('RAW_MATERIAL','FINISHED_GOODS'))
);

CREATE INDEX IF NOT EXISTS idx_iti_transfer ON internal_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_iti_material ON internal_transfer_items(material_type_id);
CREATE INDEX IF NOT EXISTS idx_iti_product  ON internal_transfer_items(product_type_id);

-- 3. 价格表主表
CREATE TABLE IF NOT EXISTS price_lists (
    id              VARCHAR(191) NOT NULL PRIMARY KEY,
    factory_id      VARCHAR(191) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    price_type      VARCHAR(32)  NOT NULL,
    effective_from  DATE         NOT NULL,
    effective_to    DATE,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by      BIGINT,
    remark          TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP,

    CONSTRAINT fk_pl_factory FOREIGN KEY (factory_id) REFERENCES factories(id),
    CONSTRAINT ck_pl_type CHECK (price_type IN ('PURCHASE_PRICE','TRANSFER_PRICE','SELLING_PRICE'))
);

CREATE INDEX IF NOT EXISTS idx_pl_factory   ON price_lists(factory_id);
CREATE INDEX IF NOT EXISTS idx_pl_effective ON price_lists(effective_from, effective_to);

-- 4. 价格表行项目
CREATE TABLE IF NOT EXISTS price_list_items (
    id              BIGSERIAL PRIMARY KEY,
    price_list_id   VARCHAR(191) NOT NULL,
    material_type_id VARCHAR(191),
    product_type_id  VARCHAR(191),
    item_name       VARCHAR(200),
    unit            VARCHAR(20),
    standard_price  NUMERIC(15,4) NOT NULL,
    min_price       NUMERIC(15,4),
    max_price       NUMERIC(15,4),
    remark          VARCHAR(500),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP,

    CONSTRAINT fk_pli_list FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pli_list     ON price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_pli_material ON price_list_items(material_type_id);
CREATE INDEX IF NOT EXISTS idx_pli_product  ON price_list_items(product_type_id);

-- ============================================================
-- 完成提示
-- ============================================================
-- 执行后验证:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN (
--     'internal_transfers', 'internal_transfer_items',
--     'price_lists', 'price_list_items'
--   );
-- 预期结果: 4 张表
