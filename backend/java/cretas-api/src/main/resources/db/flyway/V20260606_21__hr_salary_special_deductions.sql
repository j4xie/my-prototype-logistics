-- V20260606_21: P1-40 H-WAGE 专项扣除 (follow-up to V20260606_18 salary_items)
--
-- Creates salary_special_deductions table for China 个税 6 大专项附加扣除:
--   * 子女教育 (CHILD_EDUCATION) — ¥1000/月/孩
--   * 继续教育 (CONTINUING_EDUCATION) — ¥400/月 (学历) / ¥3600/年 (职业资格)
--   * 大病医疗 (SERIOUS_ILLNESS) — 自付 ≥¥15000/年, 限额 ¥80000/年
--   * 住房贷款利息 (HOUSING_LOAN) — ¥1000/月 (首套 ≤20 年)
--   * 住房租金 (HOUSING_RENT) — ¥800/¥1100/¥1500 (按城市档位, MVP user 输入)
--   * 赡养老人 (ELDER_SUPPORT) — 独生子女 ¥2000/月, 兄弟姐妹分摊
--
-- 计税公式: taxable_income = base - 个人社保 - 个人公积金 - 5000起征点
--                                - sum(monthlyAmount FOR status=ACTIVE AND in [validFrom, validTo])
--
-- 状态机: ACTIVE → EXPIRED (用户结束) / CANCELLED (HR 撤销)
--         不允许 EXPIRED/CANCELLED 回到 ACTIVE (需新建记录).
--
-- R4 防呆: unique (factory_id, user_id, deduction_type, valid_from) WHERE status='ACTIVE'
--         防止同 user 同 type 同生效日重复申报.
--
-- Deferred (next batch): 城市档位 rent 自动 / auto-expiry cron job / bulk import.

CREATE TABLE IF NOT EXISTS salary_special_deductions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    deduction_type VARCHAR(30) NOT NULL,
        -- CHILD_EDUCATION / CONTINUING_EDUCATION / SERIOUS_ILLNESS /
        -- HOUSING_LOAN / HOUSING_RENT / ELDER_SUPPORT
    monthly_amount NUMERIC(12,2) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
        -- NULL 表示长期有效
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        -- ACTIVE / EXPIRED / CANCELLED
    notes VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT ck_special_deduction_amount_nonneg CHECK (monthly_amount >= 0),
    CONSTRAINT ck_special_deduction_type CHECK (deduction_type IN (
        'CHILD_EDUCATION', 'CONTINUING_EDUCATION', 'SERIOUS_ILLNESS',
        'HOUSING_LOAN', 'HOUSING_RENT', 'ELDER_SUPPORT')),
    CONSTRAINT ck_special_deduction_status CHECK (status IN (
        'ACTIVE', 'EXPIRED', 'CANCELLED')),
    CONSTRAINT ck_special_deduction_valid_range CHECK (
        valid_to IS NULL OR valid_to >= valid_from)
);

-- R4 防呆: ACTIVE 状态下同 (factory, user, type, valid_from) 唯一
-- Partial index 仅约束 ACTIVE 行: 一旦 EXPIRED/CANCELLED 可再创建同生效日的 ACTIVE 新记录
CREATE UNIQUE INDEX IF NOT EXISTS uq_special_deduction_factory_user_type_from
    ON salary_special_deductions (factory_id, user_id, deduction_type, valid_from)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_special_deduction_factory_user
    ON salary_special_deductions (factory_id, user_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_special_deduction_factory_status
    ON salary_special_deductions (factory_id, status, valid_from, valid_to)
    WHERE deleted_at IS NULL;

-- Auto-update updated_at trigger (mirror salary_items pattern in V20260606_18)
CREATE OR REPLACE FUNCTION update_salary_special_deductions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_salary_special_deductions_updated_at
    ON salary_special_deductions;
CREATE TRIGGER trg_salary_special_deductions_updated_at
BEFORE UPDATE ON salary_special_deductions
FOR EACH ROW EXECUTE FUNCTION update_salary_special_deductions_updated_at();

COMMENT ON TABLE salary_special_deductions IS
    'P1-40 H-WAGE 专项扣除 — 6 大附加扣除. State: ACTIVE → EXPIRED/CANCELLED. UNIQUE (factory, user, type, valid_from) WHERE ACTIVE.';
COMMENT ON COLUMN salary_special_deductions.deduction_type IS
    '6 类专项: CHILD_EDUCATION / CONTINUING_EDUCATION / SERIOUS_ILLNESS / HOUSING_LOAN / HOUSING_RENT / ELDER_SUPPORT';
COMMENT ON COLUMN salary_special_deductions.monthly_amount IS
    '月度扣除金额 ¥元 (MVP user 输入实际值, 不强制上限)';
COMMENT ON COLUMN salary_special_deductions.valid_from IS
    '生效起始日 (含当日)';
COMMENT ON COLUMN salary_special_deductions.valid_to IS
    '失效日 (含当日); NULL 表示长期有效';
COMMENT ON COLUMN salary_special_deductions.status IS
    'ACTIVE (参与计税) / EXPIRED (自然到期) / CANCELLED (HR 撤销)';
