-- Sprint 3 Track-E F-VFLAG-1: 凭证生成 hook 机制
-- 业务-财务一体化关键桥梁. Backlog §1.1 row 1 (P0 战略).
--
-- 2 张新表:
--   - vouchers: 财务凭证主表 (业务单生成, 财务审核过账)
--   - voucher_entries: 凭证分录 (借/贷, 借贷必平)
--
-- 7 张业务单 add vflag column (UNCREATED → PENDING → CREATED/FAILED 状态机):
--   sales_orders / purchase_orders / production_plans / return_orders /
--   internal_transfers / wastage_records / payroll_records (NOT wage_records,
--   brief drift fixed per actual entity grep).

-- ==================== vouchers ====================

CREATE TABLE IF NOT EXISTS vouchers (
    id                    VARCHAR(191) PRIMARY KEY,
    factory_id            VARCHAR(191) NOT NULL,
    voucher_number        VARCHAR(50)  NOT NULL,
    voucher_type          VARCHAR(32)  NOT NULL CHECK (voucher_type IN
                              ('SALES_RECEIPT','PURCHASE_PAYMENT','INVENTORY_TRANSFER',
                               'EXPENSE','WAGE','RETURN','DEPRECATION')),
    voucher_date          DATE         NOT NULL,
    source_business_type  VARCHAR(50)  NOT NULL,
    source_business_id    VARCHAR(191) NOT NULL,
    total_debit           DECIMAL(15,2) NOT NULL,
    total_credit          DECIMAL(15,2) NOT NULL,
    status                VARCHAR(32)  NOT NULL DEFAULT 'DRAFT'
                              CHECK (status IN ('DRAFT','POSTED','VOID')),
    created_by            BIGINT,
    approved_by           BIGINT,
    approved_at           TIMESTAMP,
    description           VARCHAR(500),
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMP,

    -- 借贷必平: 整体校验 (entries 内部校验在 Voucher.validateBalanced 代码层)
    CONSTRAINT chk_voucher_balanced CHECK (total_debit = total_credit),

    -- factory 内 voucher_number 唯一
    CONSTRAINT uk_voucher_factory_number UNIQUE (factory_id, voucher_number),

    -- idempotent: 同一业务单只能生成一次凭证 (event 重发防御)
    CONSTRAINT uk_voucher_source_business UNIQUE (source_business_type, source_business_id)
);

CREATE INDEX IF NOT EXISTS idx_v_factory          ON vouchers(factory_id);
CREATE INDEX IF NOT EXISTS idx_v_type             ON vouchers(voucher_type);
CREATE INDEX IF NOT EXISTS idx_v_status           ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_v_voucher_date     ON vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_v_source_business  ON vouchers(source_business_type, source_business_id);

COMMENT ON TABLE vouchers IS
    '财务凭证 (Sprint3-E F-VFLAG-1). 业务单 → VoucherGenerator → Voucher + entries. 借贷必平.';

-- ==================== voucher_entries ====================

CREATE TABLE IF NOT EXISTS voucher_entries (
    id            VARCHAR(191) PRIMARY KEY,
    voucher_id    VARCHAR(191) NOT NULL,
    line_no       INTEGER      NOT NULL,
    subject_code  VARCHAR(32)  NOT NULL,
    subject_name  VARCHAR(100) NOT NULL,
    description   VARCHAR(500),
    debit         DECIMAL(15,2),
    credit        DECIMAL(15,2),
    cost_center   VARCHAR(100),
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMP,

    CONSTRAINT fk_ve_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,

    -- 行号 voucher 内唯一
    CONSTRAINT uk_ve_voucher_line UNIQUE (voucher_id, line_no),

    -- 单边规则: debit 和 credit 不能都非零 (借贷分录互斥; 都为 0 也禁, 至少一边非零)
    CONSTRAINT chk_ve_single_side CHECK (
        (COALESCE(debit, 0) > 0 AND COALESCE(credit, 0) = 0) OR
        (COALESCE(debit, 0) = 0 AND COALESCE(credit, 0) > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_ve_voucher  ON voucher_entries(voucher_id);
CREATE INDEX IF NOT EXISTS idx_ve_subject  ON voucher_entries(subject_code);

COMMENT ON TABLE voucher_entries IS
    '凭证分录. 借/贷必平. 一行只能 debit 或 credit 一边非零.';

-- ==================== 7 业务单 add vflag column ====================

ALTER TABLE sales_orders        ADD COLUMN IF NOT EXISTS vflag VARCHAR(20) NOT NULL DEFAULT 'UNCREATED';
ALTER TABLE purchase_orders     ADD COLUMN IF NOT EXISTS vflag VARCHAR(20) NOT NULL DEFAULT 'UNCREATED';
ALTER TABLE production_plans    ADD COLUMN IF NOT EXISTS vflag VARCHAR(20) NOT NULL DEFAULT 'UNCREATED';
ALTER TABLE return_orders       ADD COLUMN IF NOT EXISTS vflag VARCHAR(20) NOT NULL DEFAULT 'UNCREATED';
ALTER TABLE internal_transfers  ADD COLUMN IF NOT EXISTS vflag VARCHAR(20) NOT NULL DEFAULT 'UNCREATED';
ALTER TABLE wastage_records     ADD COLUMN IF NOT EXISTS vflag VARCHAR(20) NOT NULL DEFAULT 'UNCREATED';
ALTER TABLE payroll_records     ADD COLUMN IF NOT EXISTS vflag VARCHAR(20) NOT NULL DEFAULT 'UNCREATED';

-- vflag CHECK constraints (一致约束 4 状态)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_so_vflag') THEN
        ALTER TABLE sales_orders        ADD CONSTRAINT chk_so_vflag       CHECK (vflag IN ('UNCREATED','PENDING','CREATED','FAILED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_po_vflag') THEN
        ALTER TABLE purchase_orders     ADD CONSTRAINT chk_po_vflag       CHECK (vflag IN ('UNCREATED','PENDING','CREATED','FAILED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pp_vflag') THEN
        ALTER TABLE production_plans    ADD CONSTRAINT chk_pp_vflag       CHECK (vflag IN ('UNCREATED','PENDING','CREATED','FAILED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ro_vflag') THEN
        ALTER TABLE return_orders       ADD CONSTRAINT chk_ro_vflag       CHECK (vflag IN ('UNCREATED','PENDING','CREATED','FAILED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_it_vflag') THEN
        ALTER TABLE internal_transfers  ADD CONSTRAINT chk_it_vflag       CHECK (vflag IN ('UNCREATED','PENDING','CREATED','FAILED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wr_vflag') THEN
        ALTER TABLE wastage_records     ADD CONSTRAINT chk_wr_vflag       CHECK (vflag IN ('UNCREATED','PENDING','CREATED','FAILED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pr_vflag') THEN
        ALTER TABLE payroll_records     ADD CONSTRAINT chk_pr_vflag       CHECK (vflag IN ('UNCREATED','PENDING','CREATED','FAILED'));
    END IF;
END $$;

-- vflag 索引 (查询"全 UNCREATED 业务单"用于批量补单)
CREATE INDEX IF NOT EXISTS idx_so_vflag ON sales_orders(vflag) WHERE vflag != 'CREATED';
CREATE INDEX IF NOT EXISTS idx_po_vflag ON purchase_orders(vflag) WHERE vflag != 'CREATED';
CREATE INDEX IF NOT EXISTS idx_pp_vflag ON production_plans(vflag) WHERE vflag != 'CREATED';
CREATE INDEX IF NOT EXISTS idx_ro_vflag ON return_orders(vflag) WHERE vflag != 'CREATED';
CREATE INDEX IF NOT EXISTS idx_it_vflag ON internal_transfers(vflag) WHERE vflag != 'CREATED';
CREATE INDEX IF NOT EXISTS idx_wr_vflag ON wastage_records(vflag) WHERE vflag != 'CREATED';
CREATE INDEX IF NOT EXISTS idx_pr_vflag ON payroll_records(vflag) WHERE vflag != 'CREATED';
