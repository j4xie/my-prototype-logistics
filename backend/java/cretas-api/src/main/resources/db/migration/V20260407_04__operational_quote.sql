-- V3 P0-4 — 销售运营报价单
--
-- 客户原话 (会议 1670-1750s):
-- "样品过了以后, 像类似于提交一个审批, 对应的人员去报价的;
--  运营报完价以后调过去审批审批完 ok 没问题, 然后给到销售这边."
--
-- 三段式状态机: 提交 → 录价 → 审批 → 销售可下单
-- 关键: 必须指定到人, 不指定到岗位 (客户原话: "我们这边岗位也是比较模糊的")

CREATE TABLE IF NOT EXISTS operational_quotes (
    id                    VARCHAR(191) PRIMARY KEY,
    factory_id            VARCHAR(191) NOT NULL,
    quote_no              VARCHAR(50)  NOT NULL,

    -- 关联
    sample_id             VARCHAR(191),
    customer_id           VARCHAR(191),
    product_type_id       VARCHAR(191),
    bom_id                VARCHAR(191),

    -- 报价核心
    quote_type            VARCHAR(20),         -- FIXED / NEGOTIABLE
    unit_price            NUMERIC(15, 2),
    unit                  VARCHAR(20),
    min_order_qty         NUMERIC(15, 3),
    cost_price            NUMERIC(15, 2),      -- 内部成本参考
    margin_rate           NUMERIC(6, 4),       -- 自动计算
    valid_until           DATE,

    -- 状态机
    status                VARCHAR(30) NOT NULL,  -- DRAFT/PENDING_QUOTE/PENDING_APPROVAL/APPROVED/REJECTED/EXPIRED

    -- 指派人 (具体的人, 不是岗位)
    submitted_by_user_id  BIGINT,
    submitted_at          TIMESTAMP,
    quoted_by_user_id     BIGINT,
    quoted_by_name        VARCHAR(100),
    quoted_at             TIMESTAMP,
    approver_user_id      BIGINT,
    approver_name         VARCHAR(100),
    approved_at           TIMESTAMP,

    -- 其他
    rejection_reason      TEXT,
    remarks               TEXT,
    revision_count        INTEGER DEFAULT 0,

    -- BaseEntity
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at            TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oq_quote_no ON operational_quotes (quote_no);
CREATE INDEX IF NOT EXISTS idx_oq_factory_status ON operational_quotes (factory_id, status);
CREATE INDEX IF NOT EXISTS idx_oq_customer ON operational_quotes (customer_id);
CREATE INDEX IF NOT EXISTS idx_oq_product ON operational_quotes (product_type_id);
CREATE INDEX IF NOT EXISTS idx_oq_quoted_by ON operational_quotes (quoted_by_user_id);

COMMENT ON TABLE operational_quotes IS
'销售运营报价单 — V3 P0-4. 客户原话: 样品过后→运营报价→主管审批→销售可下单. 必须指定到人.';
