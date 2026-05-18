-- V20260606_29: P2 #74 S-COMPLAINT-1 — Create service_complaints table
-- 售后服务投诉登记 / 调查 / 解决跟踪. 12 业务字段 MVP + audit + UUID PK.

CREATE TABLE IF NOT EXISTS service_complaints (
    id                VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id        VARCHAR(191) NOT NULL,
    complaint_number  VARCHAR(32)  NOT NULL,
    customer_id       VARCHAR(191) NOT NULL,
    customer_name     VARCHAR(200),
    order_id          VARCHAR(191),
    complaint_type    VARCHAR(32)  NOT NULL,
    severity          VARCHAR(16)  NOT NULL DEFAULT 'MEDIUM',
    source            VARCHAR(16)  NOT NULL DEFAULT 'PHONE',
    status            VARCHAR(16)  NOT NULL DEFAULT 'NEW',
    description       TEXT         NOT NULL,
    handled_by        BIGINT,
    resolution        TEXT,
    occurred_at       TIMESTAMP,
    resolved_at       TIMESTAMP,
    created_by        BIGINT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMP,
    CONSTRAINT uq_complaint_number UNIQUE (factory_id, complaint_number),
    CONSTRAINT ck_complaint_type CHECK (complaint_type IN
        ('PRODUCT_QUALITY', 'DELIVERY_LATE', 'SERVICE_ATTITUDE', 'PRICING', 'OTHER')),
    CONSTRAINT ck_complaint_severity CHECK (severity IN
        ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT ck_complaint_source CHECK (source IN
        ('PHONE', 'EMAIL', 'WECHAT', 'IN_STORE', 'OTHER')),
    CONSTRAINT ck_complaint_status CHECK (status IN
        ('NEW', 'INVESTIGATING', 'RESOLVED', 'CLOSED'))
);

CREATE INDEX IF NOT EXISTS idx_sc_factory_status
    ON service_complaints (factory_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sc_factory_customer
    ON service_complaints (factory_id, customer_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sc_occurred
    ON service_complaints (factory_id, occurred_at)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE  service_complaints                  IS 'P2 #74 S-COMPLAINT-1: 售后服务投诉';
COMMENT ON COLUMN service_complaints.complaint_number IS 'CMP-YYYYMMDD-NNNN, 每工厂每天序列';
COMMENT ON COLUMN service_complaints.complaint_type   IS '类型: PRODUCT_QUALITY/DELIVERY_LATE/SERVICE_ATTITUDE/PRICING/OTHER';
COMMENT ON COLUMN service_complaints.severity         IS '严重程度: LOW/MEDIUM/HIGH/CRITICAL';
COMMENT ON COLUMN service_complaints.source           IS '来源: PHONE/EMAIL/WECHAT/IN_STORE/OTHER';
COMMENT ON COLUMN service_complaints.status           IS '状态机: NEW → INVESTIGATING → RESOLVED → CLOSED';
COMMENT ON COLUMN service_complaints.handled_by       IS '处理人 user id, nullable';
COMMENT ON COLUMN service_complaints.resolution       IS '解决方案 (RESOLVED 时填写)';
COMMENT ON COLUMN service_complaints.occurred_at      IS '事件实际发生时间 (客户报告)';
COMMENT ON COLUMN service_complaints.resolved_at      IS '状态转 RESOLVED 时自动填写';
