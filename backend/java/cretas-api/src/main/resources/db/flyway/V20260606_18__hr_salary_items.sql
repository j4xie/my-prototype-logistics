-- V20260606_18: P1-40 H-WAGE-FULL MVP — 月度工资单
--
-- Creates salary_items table for monthly per-user salary breakdown:
--   * 基本工资 (baseSalary)
--   * 个人/单位社保 (socialInsurance Employee/Employer ~10.5%/26%)
--   * 个人/单位公积金 (providentFund Employee/Employer 默认 8%/8%)
--   * 应税收入 (taxableIncome = base - 个人社保 - 个人公积金 - 5000)
--   * 个税 (personalTax — 7-bracket 月度公式)
--   * 实发 (netSalary = base - 个人社保 - 个人公积金 - 个税)
--
-- State machine: DRAFT → CONFIRMED → PAID (一旦 PAID 不可改)
-- R4 防呆: unique (factory_id, user_id, year_month) 防重复创建.
--
-- Deferred (next batch): 专项扣除 / 年度汇算 / 工资条 PDF / 复杂个税 brackets / 公积金比例 UI config.

CREATE TABLE IF NOT EXISTS salary_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    year_month VARCHAR(7) NOT NULL,
        -- ISO YearMonth: "YYYY-MM"
    base_salary NUMERIC(12,2) NOT NULL,
    social_insurance_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
    social_insurance_employer NUMERIC(12,2) NOT NULL DEFAULT 0,
    provident_fund_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
    provident_fund_employer NUMERIC(12,2) NOT NULL DEFAULT 0,
    taxable_income NUMERIC(12,2) NOT NULL DEFAULT 0,
    personal_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        -- DRAFT / CONFIRMED / PAID
    remark VARCHAR(500),
    confirmed_at TIMESTAMP,
    confirmed_by BIGINT,
    paid_at TIMESTAMP,
    paid_by BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT ck_salary_base_nonneg CHECK (base_salary >= 0),
    CONSTRAINT ck_salary_year_month CHECK (year_month ~ '^[0-9]{4}-[0-9]{2}$')
);

-- R4 防呆: unique constraint on (factory_id, user_id, year_month)
-- Partial index excludes soft-deleted so DELETE + recreate works.
CREATE UNIQUE INDEX IF NOT EXISTS uq_salary_factory_user_month
    ON salary_items (factory_id, user_id, year_month)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_salary_factory_month
    ON salary_items (factory_id, year_month)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_salary_factory_status
    ON salary_items (factory_id, status, year_month)
    WHERE deleted_at IS NULL;

-- Auto-update updated_at trigger (mirror leave_requests pattern)
CREATE OR REPLACE FUNCTION update_salary_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_salary_items_updated_at ON salary_items;
CREATE TRIGGER trg_salary_items_updated_at
BEFORE UPDATE ON salary_items
FOR EACH ROW EXECUTE FUNCTION update_salary_items_updated_at();

COMMENT ON TABLE salary_items IS 'P1-40 H-WAGE-FULL MVP — 月度工资单. State: DRAFT → CONFIRMED → PAID. UNIQUE (factory, user, year_month) WHERE deleted_at IS NULL.';
COMMENT ON COLUMN salary_items.year_month IS 'ISO YearMonth YYYY-MM (e.g. "2026-05")';
COMMENT ON COLUMN salary_items.base_salary IS '基本工资 (本月应发底数, ¥元)';
COMMENT ON COLUMN salary_items.taxable_income IS '应税收入 = base - 个人社保 - 个人公积金 - 5000 起征点';
COMMENT ON COLUMN salary_items.personal_tax IS '个税 — 7-bracket 月度公式 (3%/10%/20%/25%/30%/35%/45%)';
COMMENT ON COLUMN salary_items.net_salary IS '实发 = base - 个人社保 - 个人公积金 - 个税';
