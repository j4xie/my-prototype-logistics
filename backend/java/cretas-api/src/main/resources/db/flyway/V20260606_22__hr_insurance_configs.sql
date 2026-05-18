-- #833 H-WAGE follow-up — 工厂级 社保 / 公积金 费率配置.
--
-- 客户场景: SalaryItemServiceImpl 当前硬编码 个人社保 10.5% / 单位 26% / 公积金 8%/8%.
-- 不同城市公积金范围 5%-12%, 社保比例也按地市差异.
-- 本表让 HR 按工厂自定义并保留历史 (每次 save 老 ACTIVE → ARCHIVED, 新版 ACTIVE).
--
-- Spring Boot Entity: com.cretas.aims.entity.hr.HrInsuranceConfig
-- Service:           com.cretas.aims.service.hr.impl.HrInsuranceConfigServiceImpl

CREATE TABLE IF NOT EXISTS hr_insurance_configs (
    id                              VARCHAR(36)  PRIMARY KEY,
    factory_id                      VARCHAR(50)  NOT NULL,

    -- 个人 / 单位 养老
    employee_pension_rate           NUMERIC(6,4) NOT NULL DEFAULT 0.0800,
    employer_pension_rate           NUMERIC(6,4) NOT NULL DEFAULT 0.1600,

    -- 个人 / 单位 医疗
    employee_medical_rate           NUMERIC(6,4) NOT NULL DEFAULT 0.0200,
    employer_medical_rate           NUMERIC(6,4) NOT NULL DEFAULT 0.0800,

    -- 个人 / 单位 失业
    employee_unemployment_rate      NUMERIC(6,4) NOT NULL DEFAULT 0.0050,
    employer_unemployment_rate      NUMERIC(6,4) NOT NULL DEFAULT 0.0050,

    -- 个人 / 单位 公积金 (城市范围 5%-12%, 默认 8%)
    employee_provident_fund_rate    NUMERIC(6,4) NOT NULL DEFAULT 0.0800,
    employer_provident_fund_rate    NUMERIC(6,4) NOT NULL DEFAULT 0.0800,

    -- 缴费基数上下限 (¥元), nullable: 留空 = 不限制
    base_salary_lower_bound         NUMERIC(12,2),
    base_salary_upper_bound         NUMERIC(12,2),

    effective_from                  DATE         NOT NULL,
    status                          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    remark                          VARCHAR(500),
    created_by                      BIGINT,

    created_at                      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at                      TIMESTAMP,

    CONSTRAINT chk_insurance_status CHECK (status IN ('ACTIVE','ARCHIVED')),
    CONSTRAINT chk_insurance_rates_range CHECK (
        employee_pension_rate         BETWEEN 0 AND 0.30 AND
        employer_pension_rate         BETWEEN 0 AND 0.30 AND
        employee_medical_rate         BETWEEN 0 AND 0.30 AND
        employer_medical_rate         BETWEEN 0 AND 0.30 AND
        employee_unemployment_rate    BETWEEN 0 AND 0.30 AND
        employer_unemployment_rate    BETWEEN 0 AND 0.30 AND
        employee_provident_fund_rate  BETWEEN 0 AND 0.30 AND
        employer_provident_fund_rate  BETWEEN 0 AND 0.30
    ),
    CONSTRAINT chk_insurance_base_range CHECK (
        base_salary_lower_bound IS NULL OR
        base_salary_upper_bound IS NULL OR
        base_salary_lower_bound <= base_salary_upper_bound
    )
);

CREATE INDEX IF NOT EXISTS idx_insurance_factory_status
    ON hr_insurance_configs(factory_id, status, effective_from);
CREATE INDEX IF NOT EXISTS idx_insurance_factory_eff
    ON hr_insurance_configs(factory_id, effective_from);

COMMENT ON TABLE hr_insurance_configs IS
    '工厂级 社保 / 公积金 费率配置 (#833 H-WAGE follow-up). 每次 save 生成新版本, 老 ACTIVE → ARCHIVED.';
COMMENT ON COLUMN hr_insurance_configs.status IS
    'ACTIVE = 当前生效 (factory 最多 1 条); ARCHIVED = 历史版本';
COMMENT ON COLUMN hr_insurance_configs.effective_from IS
    '该费率生效起始月 (含). 之后的工资单按此费率计算';

-- Seed: 每个 factory 自动插入 1 条法定默认 ACTIVE 配置 (与 SalaryItemServiceImpl 原硬编码值对齐)
-- 幂等: WHERE NOT EXISTS 防重复
INSERT INTO hr_insurance_configs (
    id, factory_id,
    employee_pension_rate, employer_pension_rate,
    employee_medical_rate, employer_medical_rate,
    employee_unemployment_rate, employer_unemployment_rate,
    employee_provident_fund_rate, employer_provident_fund_rate,
    effective_from, status, remark,
    created_at, updated_at
)
SELECT
    gen_random_uuid()::text,
    f.id,
    0.0800, 0.1600,      -- 养老
    0.0200, 0.0800,      -- 医疗
    0.0050, 0.0050,      -- 失业
    0.0800, 0.0800,      -- 公积金
    DATE_TRUNC('month', NOW())::date,
    'ACTIVE',
    '初始法定默认值 (#833 follow-up seed)',
    NOW(), NOW()
FROM factories f
WHERE NOT EXISTS (
    SELECT 1 FROM hr_insurance_configs c
    WHERE c.factory_id = f.id AND c.status = 'ACTIVE'
);
