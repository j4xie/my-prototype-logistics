-- V20260606_24: #833 follow-up — 年终奖 special tax brackets
--
-- ADD nullable annual_bonus + annual_bonus_tax columns to salary_items.
-- 一次性年终奖 (lump-sum annual bonus) 适用独立税率公式:
--   1) monthlyEq = bonus / 12
--   2) 在 7-bracket 表中找 monthlyEq 落入的档位 (rate + quickDeduction)
--   3) tax = bonus * rate - quickDeduction
--
-- 与月度个税 (personal_tax) 完全独立, 不混算.
-- 用户可在 DRAFT/CONFIRMED 状态多次更新 annualBonus (state-machine: PAID 锁住).
--
-- Brackets (per 中国税法 2019+ 一次性年终奖):
--   ≤3000     : 3%,  扣 0
--   ≤12000    : 10%, 扣 210
--   ≤25000    : 20%, 扣 1410
--   ≤35000    : 25%, 扣 2660
--   ≤55000    : 30%, 扣 4410
--   ≤80000    : 35%, 扣 7160
--   >80000    : 45%, 扣 15160

ALTER TABLE salary_items
    ADD COLUMN IF NOT EXISTS annual_bonus NUMERIC(12, 2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS annual_bonus_tax NUMERIC(12, 2) DEFAULT NULL;

-- 防御 check: annual_bonus 必须 ≥ 0 (允许 NULL).
ALTER TABLE salary_items
    DROP CONSTRAINT IF EXISTS ck_salary_annual_bonus_nonneg;
ALTER TABLE salary_items
    ADD CONSTRAINT ck_salary_annual_bonus_nonneg
    CHECK (annual_bonus IS NULL OR annual_bonus >= 0);

-- 防御 check: annual_bonus_tax 必须 ≥ 0 (允许 NULL).
ALTER TABLE salary_items
    DROP CONSTRAINT IF EXISTS ck_salary_annual_bonus_tax_nonneg;
ALTER TABLE salary_items
    ADD CONSTRAINT ck_salary_annual_bonus_tax_nonneg
    CHECK (annual_bonus_tax IS NULL OR annual_bonus_tax >= 0);

COMMENT ON COLUMN salary_items.annual_bonus IS
    '年终奖金额 (¥). NULL = 该月无年终奖. #833 follow-up V20260606_24.';
COMMENT ON COLUMN salary_items.annual_bonus_tax IS
    '年终奖个税 (¥). NULL = 未设定. 公式: bonus * bracket_rate - quick_deduction (monthlyEq=bonus/12 找档).';
