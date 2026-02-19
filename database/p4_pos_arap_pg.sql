-- ============================================================
-- P4: POS集成 + 应收应付（AR/AP）（PostgreSQL）
-- POS适配器配置 + 订单同步日志 + 应收应付交易记录
-- 执行前提：P0, P1, P2, P3 已执行
-- ============================================================

-- 1. 应收应付交易记录表（核心：银行流水模式）
CREATE TABLE IF NOT EXISTS ar_ap_transactions (
    id                      VARCHAR(191) NOT NULL PRIMARY KEY,
    factory_id              VARCHAR(191) NOT NULL,
    transaction_number      VARCHAR(50)  NOT NULL,
    transaction_type        VARCHAR(32)  NOT NULL,
    counterparty_type       VARCHAR(32)  NOT NULL,
    counterparty_id         VARCHAR(191) NOT NULL,
    counterparty_name       VARCHAR(200),
    sales_order_id          VARCHAR(191),
    purchase_order_id       VARCHAR(191),
    pos_order_sync_id       BIGINT,
    amount                  NUMERIC(15,2) NOT NULL,
    balance_after           NUMERIC(15,2) NOT NULL,
    payment_method          VARCHAR(32),
    payment_reference       VARCHAR(100),
    transaction_date        DATE         NOT NULL,
    due_date                DATE,
    operated_by             BIGINT,
    remark                  VARCHAR(500),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at              TIMESTAMP,

    CONSTRAINT fk_aat_factory FOREIGN KEY (factory_id) REFERENCES factories(id),
    CONSTRAINT ck_aat_type CHECK (transaction_type IN ('AR_INVOICE','AR_PAYMENT','AR_ADJUSTMENT','AP_INVOICE','AP_PAYMENT','AP_ADJUSTMENT')),
    CONSTRAINT ck_aat_cp_type CHECK (counterparty_type IN ('CUSTOMER','SUPPLIER')),
    CONSTRAINT ck_aat_pay_method CHECK (payment_method IS NULL OR payment_method IN ('CASH','BANK_TRANSFER','WECHAT','ALIPAY','CHECK','CREDIT','POS','OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_aat_factory          ON ar_ap_transactions(factory_id);
CREATE INDEX IF NOT EXISTS idx_aat_counterparty     ON ar_ap_transactions(counterparty_type, counterparty_id);
CREATE INDEX IF NOT EXISTS idx_aat_type             ON ar_ap_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_aat_due_date         ON ar_ap_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_aat_transaction_date ON ar_ap_transactions(transaction_date);

-- 2. POS连接配置表
CREATE TABLE IF NOT EXISTS pos_connections (
    id                  VARCHAR(191) NOT NULL PRIMARY KEY,
    factory_id          VARCHAR(191) NOT NULL,
    brand               VARCHAR(32)  NOT NULL,
    connection_name     VARCHAR(200),
    app_key             VARCHAR(200),
    app_secret          VARCHAR(500),
    access_token        VARCHAR(1000),
    refresh_token       VARCHAR(1000),
    token_expires_at    TIMESTAMP,
    webhook_secret      VARCHAR(200),
    pos_store_id        VARCHAR(100),
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    last_sync_at        TIMESTAMP,
    last_error          VARCHAR(1000),
    created_by          BIGINT,
    remark              VARCHAR(500),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP,

    CONSTRAINT uk_pos_factory_brand UNIQUE (factory_id, brand),
    CONSTRAINT fk_posc_factory FOREIGN KEY (factory_id) REFERENCES factories(id),
    CONSTRAINT ck_posc_brand CHECK (brand IN ('KERUYUN','ERWEIHUO','YINBAO','MEITUAN','HUALALA'))
);

CREATE INDEX IF NOT EXISTS idx_posc_factory ON pos_connections(factory_id);
CREATE INDEX IF NOT EXISTS idx_posc_brand   ON pos_connections(brand);
CREATE INDEX IF NOT EXISTS idx_posc_active  ON pos_connections(is_active);

-- 3. POS订单同步日志表
CREATE TABLE IF NOT EXISTS pos_order_syncs (
    id                      BIGSERIAL PRIMARY KEY,
    factory_id              VARCHAR(191) NOT NULL,
    brand                   VARCHAR(32)  NOT NULL,
    pos_order_id            VARCHAR(200) NOT NULL,
    pos_order_number        VARCHAR(100),
    local_sales_order_id    VARCHAR(191),
    order_amount            NUMERIC(15,2),
    pos_order_time          TIMESTAMP,
    sync_status             VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    synced_at               TIMESTAMP,
    error_message           VARCHAR(1000),
    retry_count             INTEGER      DEFAULT 0,
    raw_payload             TEXT,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at              TIMESTAMP,

    CONSTRAINT uk_pos_order_brand UNIQUE (pos_order_id, brand),
    CONSTRAINT ck_pos_brand CHECK (brand IN ('KERUYUN','ERWEIHUO','YINBAO','MEITUAN','HUALALA')),
    CONSTRAINT ck_pos_status CHECK (sync_status IN ('PENDING','SUCCESS','FAILED','DUPLICATE'))
);

CREATE INDEX IF NOT EXISTS idx_pos_factory     ON pos_order_syncs(factory_id);
CREATE INDEX IF NOT EXISTS idx_pos_brand       ON pos_order_syncs(brand);
CREATE INDEX IF NOT EXISTS idx_pos_status      ON pos_order_syncs(sync_status);
CREATE INDEX IF NOT EXISTS idx_pos_local_order ON pos_order_syncs(local_sales_order_id);
CREATE INDEX IF NOT EXISTS idx_pos_sync_time   ON pos_order_syncs(synced_at);

-- ============================================================
-- 完成提示
-- ============================================================
-- 执行后验证:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN (
--     'ar_ap_transactions', 'pos_connections', 'pos_order_syncs'
--   );
-- 预期结果: 3 张表
