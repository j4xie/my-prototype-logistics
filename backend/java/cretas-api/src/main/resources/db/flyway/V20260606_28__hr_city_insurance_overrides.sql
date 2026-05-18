-- #863 H-WAGE follow-up — 城市差异化 社保 / 公积金 配置覆盖.
--
-- 背景: #863 落地 工厂级 HrInsuranceConfig (factory 单一费率 + 单一基数). 但中国实际
-- 社保 / 公积金缴费基数 按城市差异巨大 (上海 7384-36549, 北京 5360-31884, 深圳 2360-28860).
-- 同一工厂员工可能在多个城市, 各自需要城市配置.
--
-- 本表 = 工厂默认配置 (HrInsuranceConfig) 的覆盖层:
--   - city_code 必填, override_rates jsonb 可选 (只放需覆盖的费率)
--   - (factory, city, status=ACTIVE) DB unique partial index 保证唯一
--
-- 配合表: hr_employee_city_assignments — 维护员工 → 城市 关联.
-- SalaryItemServiceImpl 计算时 user → city → effective cfg (合并工厂默认+城市覆盖).
--
-- Spring Boot Entity: com.cretas.aims.entity.hr.HrCityInsuranceOverride
--                     com.cretas.aims.entity.hr.HrEmployeeCityAssignment
-- Service:           com.cretas.aims.service.hr.impl.HrCityInsuranceOverrideServiceImpl

-- ============================================================
-- 表 1: hr_city_insurance_overrides — 城市覆盖
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_city_insurance_overrides (
    id                              VARCHAR(36)  PRIMARY KEY,
    factory_id                      VARCHAR(50)  NOT NULL,

    -- 城市代号 (大写 ASCII, e.g. "BEIJING", "SHANGHAI")
    city_code                       VARCHAR(50)  NOT NULL,
    -- 中文显示名 (可选)
    city_name                       VARCHAR(100),

    -- 缴费基数上下限 (城市强制必填)
    base_salary_lower_bound         NUMERIC(12,2) NOT NULL,
    base_salary_upper_bound         NUMERIC(12,2) NOT NULL,

    -- 可选费率覆盖 jsonb. keys = camelCase HrInsuranceConfig 字段, values = 0~0.30
    -- e.g. {"employeePensionRate": 0.10, "employerProvidentFundRate": 0.12}
    override_rates                  JSONB,

    effective_from                  DATE         NOT NULL,
    status                          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    remark                          VARCHAR(500),
    created_by                      BIGINT,

    created_at                      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at                      TIMESTAMP,

    CONSTRAINT chk_city_override_status CHECK (status IN ('ACTIVE','ARCHIVED')),
    CONSTRAINT chk_city_override_base CHECK (
        base_salary_lower_bound >= 0 AND
        base_salary_upper_bound >= 0 AND
        base_salary_lower_bound <= base_salary_upper_bound
    )
);

CREATE INDEX IF NOT EXISTS idx_city_override_factory_status
    ON hr_city_insurance_overrides(factory_id, status, effective_from);
CREATE INDEX IF NOT EXISTS idx_city_override_factory_city
    ON hr_city_insurance_overrides(factory_id, city_code, status);

-- R4 防呆: (factory, city) 同一时刻只能有 1 条 ACTIVE
CREATE UNIQUE INDEX IF NOT EXISTS uq_city_override_factory_city_active
    ON hr_city_insurance_overrides(factory_id, city_code)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;

COMMENT ON TABLE hr_city_insurance_overrides IS
    '城市差异化 社保 / 公积金 配置覆盖 (#863 follow-up). 工厂默认 + 城市覆盖合并模式.';
COMMENT ON COLUMN hr_city_insurance_overrides.city_code IS
    '城市代号大写 ASCII, e.g. BEIJING / SHANGHAI / SHENZHEN / GUANGZHOU';
COMMENT ON COLUMN hr_city_insurance_overrides.override_rates IS
    'jsonb 可选费率覆盖. keys 必须是 HrInsuranceConfig camelCase 字段名.';

-- ============================================================
-- 表 2: hr_employee_city_assignments — 员工→城市 关联
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_employee_city_assignments (
    id                              VARCHAR(36)  PRIMARY KEY,
    factory_id                      VARCHAR(50)  NOT NULL,
    user_id                         BIGINT       NOT NULL,
    city_code                       VARCHAR(50)  NOT NULL,

    effective_from                  DATE         NOT NULL,
    status                          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    remark                          VARCHAR(500),
    created_by                      BIGINT,

    created_at                      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at                      TIMESTAMP,

    CONSTRAINT chk_emp_city_status CHECK (status IN ('ACTIVE','ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_emp_city_factory_user
    ON hr_employee_city_assignments(factory_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_emp_city_factory_city
    ON hr_employee_city_assignments(factory_id, city_code, status);

-- R4 防呆: (factory, user) 同一时刻只能有 1 条 ACTIVE 分配
CREATE UNIQUE INDEX IF NOT EXISTS uq_emp_city_factory_user_active
    ON hr_employee_city_assignments(factory_id, user_id)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;

COMMENT ON TABLE hr_employee_city_assignments IS
    '员工 → 工作城市 关联 (#863 follow-up). 不修改 users 表, 作为 side-car 维护.';
COMMENT ON COLUMN hr_employee_city_assignments.city_code IS
    '与 hr_city_insurance_overrides.city_code 对齐. SalaryItem 计算时按 user 取 city.';

-- ============================================================
-- 不做 seed: 城市配置必须由 HR 手动填 (各城市基数差异巨大, 不存在通用默认).
-- 未配置 city 的 factory: SalaryItem 走工厂默认 (HrInsuranceConfig), 行为兼容 #863.
-- ============================================================
