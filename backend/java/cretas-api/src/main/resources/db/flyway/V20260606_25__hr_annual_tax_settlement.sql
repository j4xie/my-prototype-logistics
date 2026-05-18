-- V20260606_25: #833 follow-up — 年度汇算 (China 综合所得 annual tax settlement)
--
-- Aggregates monthly SalaryItem rows + annual bonus + special deductions for a tax year,
-- applies China 综合所得 7-bracket ANNUAL tax (vs. monthly prepaid sum) to determine refund/owed.
--
-- Annual brackets (起征点 60000/year, 综合所得):
--   ≤36000      : 3%,  扣 0
--   ≤144000     : 10%, 扣 2520
--   ≤300000     : 20%, 扣 16920
--   ≤420000     : 25%, 扣 31920
--   ≤660000     : 30%, 扣 52920
--   ≤960000     : 35%, 扣 85920
--   >960000     : 45%, 扣 181920
--
-- Formula:
--   年度应纳税所得额 = 年度综合所得 − 60000 − 年度专项扣除 (社保+公积金 sum) − 年度专项附加扣除
--   年度应纳税额    = 年度应纳税所得额 × 适用税率 − 速算扣除数
--   汇算补退        = 年度应纳税额 − sum(月度 personal_tax 已预缴)
--                     >0 = 应补缴, <0 = 应退税, =0 = 平账
--
-- 年终奖 (#861 path): 独立计税 (一次性年终奖政策), 不并入综合所得.
--   故 refundOwed 仅针对月度工资综合所得部分, 年终奖税已在 #861 算定.
--
-- R4 防呆: unique (factory_id, user_id, tax_year) WHERE deleted_at IS NULL
-- → re-compute 走 update 不 insert, 不产生重复年度汇算记录.
--
-- State: DRAFT → CONFIRMED → REPORTED (REPORTED 不可改, 已申报税局).
--
-- Deferred (next batch):
--   - 税局 e-filing 集成 (向 IRS 直推汇算单)
--   - 多 user 批量汇算 (cron 跑年初)
--   - 收入分类: 工资薪金 / 劳务报酬 / 稿酬 / 特许权使用费 (MVP 只算工资薪金)

CREATE TABLE IF NOT EXISTS annual_tax_settlements (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    tax_year INTEGER NOT NULL,
        -- 纳税年度 (e.g. 2025 → 汇算 2025-01 至 2025-12 全年数据)
    total_salary NUMERIC(14, 2) NOT NULL DEFAULT 0,
        -- 年度综合所得 (sum of monthly base_salary)
    total_bonus NUMERIC(14, 2) NOT NULL DEFAULT 0,
        -- 年度年终奖 (sum of annual_bonus, info-only, 不并入汇算)
    total_social_insurance NUMERIC(14, 2) NOT NULL DEFAULT 0,
        -- 年度个人社保 (sum of social_insurance_employee)
    total_provident_fund NUMERIC(14, 2) NOT NULL DEFAULT 0,
        -- 年度个人公积金 (sum of provident_fund_employee)
    total_special_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0,
        -- 年度专项附加扣除 (sum across 12 month probes)
    annual_taxable_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
        -- 年度应纳税所得额 = total_salary − 60000 − total_social − total_fund − total_special
    annual_tax_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
        -- 年度应纳税额 = taxable × rate − quick_deduction
    monthly_prepaid_sum NUMERIC(14, 2) NOT NULL DEFAULT 0,
        -- 月度个税已预缴合计 (sum of monthly personal_tax)
    refund_owed NUMERIC(14, 2) NOT NULL DEFAULT 0,
        -- 汇算补退 = annual_tax_due − monthly_prepaid_sum
        -- >0: 应补缴, <0: 应退税, =0: 平账
    annual_bonus_tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
        -- 年终奖个税合计 (info-only, sum of annual_bonus_tax)
    bracket_label VARCHAR(20),
        -- "≤36000" / "≤144000" / ... 适用年度档位 label (UI 显示)
    bracket_rate VARCHAR(10),
        -- "3%" / "10%" / ... 适用税率 (UI 显示)
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        -- DRAFT / CONFIRMED / REPORTED
    months_covered INTEGER NOT NULL DEFAULT 0,
        -- 实际参与汇算的月数 (≤12, 用于 prorate / 跨年入职)
    computed_at TIMESTAMP DEFAULT NOW(),
        -- 最后计算时间
    confirmed_at TIMESTAMP,
    confirmed_by BIGINT,
    reported_at TIMESTAMP,
        -- 申报税局时间 (status=REPORTED 时填)
    reported_by BIGINT,
    notes VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT ck_annual_tax_year_range CHECK (tax_year BETWEEN 2000 AND 2100),
    CONSTRAINT ck_annual_tax_months CHECK (months_covered BETWEEN 0 AND 12),
    CONSTRAINT ck_annual_tax_total_salary_nonneg CHECK (total_salary >= 0),
    CONSTRAINT ck_annual_tax_due_nonneg CHECK (annual_tax_due >= 0)
);

-- R4 防呆: unique (factory_id, user_id, tax_year) WHERE deleted_at IS NULL
-- → re-compute 走 update 不 insert.
CREATE UNIQUE INDEX IF NOT EXISTS uq_annual_tax_factory_user_year
    ON annual_tax_settlements (factory_id, user_id, tax_year)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_annual_tax_factory_year
    ON annual_tax_settlements (factory_id, tax_year)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_annual_tax_factory_status
    ON annual_tax_settlements (factory_id, status, tax_year)
    WHERE deleted_at IS NULL;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_annual_tax_settlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_annual_tax_settlements_updated_at ON annual_tax_settlements;
CREATE TRIGGER trg_annual_tax_settlements_updated_at
BEFORE UPDATE ON annual_tax_settlements
FOR EACH ROW EXECUTE FUNCTION update_annual_tax_settlements_updated_at();

COMMENT ON TABLE annual_tax_settlements IS
    '#833 follow-up — 年度汇算 (China 综合所得 annual settlement). UNIQUE (factory, user, tax_year) WHERE deleted_at IS NULL. State: DRAFT → CONFIRMED → REPORTED.';
COMMENT ON COLUMN annual_tax_settlements.refund_owed IS
    '汇算补退 = annual_tax_due − monthly_prepaid_sum. >0: 应补缴, <0: 应退税, =0: 平账';
COMMENT ON COLUMN annual_tax_settlements.annual_bonus_tax IS
    '年终奖个税 (info-only, sum of #861 annual_bonus_tax). 一次性年终奖独立计税, 不进汇算';
COMMENT ON COLUMN annual_tax_settlements.months_covered IS
    '实际参与汇算的月数 (≤12). 跨年入职或离职时 < 12';
