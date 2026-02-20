-- =====================================================
-- 调度员模块增强 - 数据库迁移脚本 (PostgreSQL 版本)
-- Version: V2025_12_28_2
-- Description: 添加员工扩展字段和调度员模块相关表
-- Author: Cretas Team
-- Date: 2025-12-28
-- Converted from MySQL to PostgreSQL
-- =====================================================

-- ===========================================
-- 1. 用户表扩展字段 (调度员模块)
-- ===========================================

-- 添加工号字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(10) UNIQUE;
COMMENT ON COLUMN users.employee_code IS '工号 (001-999)';

-- 添加雇用类型字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_type VARCHAR(20) DEFAULT 'FULL_TIME';
COMMENT ON COLUMN users.hire_type IS '雇用类型: FULL_TIME/PART_TIME/DISPATCH/INTERN/TEMPORARY';

-- 添加合同到期日字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_end_date DATE;
COMMENT ON COLUMN users.contract_end_date IS '合同到期日（临时工）';

-- 添加技能等级字段 (JSONB格式)
ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_levels JSONB;
COMMENT ON COLUMN users.skill_levels IS '技能等级 JSON: {"切片": 3, "质检": 2}';

-- 添加小时工资字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);
COMMENT ON COLUMN users.hourly_rate IS '小时工资';

-- 添加头像URL字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);
COMMENT ON COLUMN users.avatar_url IS '头像URL';

-- 添加入职日期字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
COMMENT ON COLUMN users.hire_date IS '入职日期';

-- ===========================================
-- 2. 为现有用户生成工号
-- ===========================================

-- 使用 PL/pgSQL 函数批量生成工号
-- 注意: 只为没有工号的用户生成
CREATE OR REPLACE FUNCTION generate_employee_codes()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    next_code INT := 1;
BEGIN
    -- 获取当前最大工号
    SELECT COALESCE(MAX(employee_code::INT), 0) + 1 INTO next_code
    FROM users
    WHERE employee_code IS NOT NULL AND employee_code ~ '^\d+$';

    -- 遍历没有工号的用户
    FOR user_record IN
        SELECT id FROM users
        WHERE employee_code IS NULL
        ORDER BY id
    LOOP
        -- 跳过超过999的编号
        IF next_code <= 999 THEN
            UPDATE users SET employee_code = LPAD(next_code::TEXT, 3, '0') WHERE id = user_record.id;
            next_code := next_code + 1;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 执行函数
SELECT generate_employee_codes();

-- 删除函数
DROP FUNCTION IF EXISTS generate_employee_codes();

-- ===========================================
-- 3. 添加索引
-- ===========================================

-- 工号索引
CREATE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code);

-- 雇用类型索引
CREATE INDEX IF NOT EXISTS idx_users_hire_type ON users(hire_type);

-- 合同到期日索引 (用于查询即将到期的合同)
CREATE INDEX IF NOT EXISTS idx_users_contract_end_date ON users(contract_end_date);

-- 入职日期索引
CREATE INDEX IF NOT EXISTS idx_users_hire_date ON users(hire_date);

-- 复合索引: 工厂ID + 雇用类型
CREATE INDEX IF NOT EXISTS idx_users_factory_hire_type ON users(factory_id, hire_type);

-- 复合索引: 工厂ID + 工号
CREATE INDEX IF NOT EXISTS idx_users_factory_employee_code ON users(factory_id, employee_code);

-- ===========================================
-- 4. 生产计划表扩展字段
-- ===========================================

-- 添加计划来源类型
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) DEFAULT 'MANUAL';
COMMENT ON COLUMN production_plans.source_type IS '计划来源: CUSTOMER_ORDER/AI_FORECAST/SAFETY_STOCK/MANUAL/URGENT_INSERT';

-- 添加关联订单ID
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS source_order_id VARCHAR(50);
COMMENT ON COLUMN production_plans.source_order_id IS '关联订单ID';

-- 添加客户名称
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS source_customer_name VARCHAR(100);
COMMENT ON COLUMN production_plans.source_customer_name IS '客户名称';

-- 添加AI预测置信度
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS ai_confidence INT;
COMMENT ON COLUMN production_plans.ai_confidence IS 'AI预测置信度 0-100';

-- 添加预测原因
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS forecast_reason VARCHAR(255);
COMMENT ON COLUMN production_plans.forecast_reason IS '预测原因';

-- 添加CR值 (交期紧急度)
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS cr_value DECIMAL(5,2);
COMMENT ON COLUMN production_plans.cr_value IS 'CR值 = (交期-今日) / 工期';

-- 添加是否混批标记
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS is_mixed_batch BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN production_plans.is_mixed_batch IS '是否混批';

-- 添加混批关联类型
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS mixed_batch_type VARCHAR(30);
COMMENT ON COLUMN production_plans.mixed_batch_type IS '混批类型: SAME_MATERIAL/SAME_PROCESS';

-- 添加混批关联订单 (JSONB)
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS related_orders JSONB;
COMMENT ON COLUMN production_plans.related_orders IS '混批关联订单 JSON: ["ORD-001", "ORD-002"]';

-- ===========================================
-- 5. 生产计划表索引
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_plans_source_type ON production_plans(source_type);
CREATE INDEX IF NOT EXISTS idx_plans_mixed_batch ON production_plans(is_mixed_batch);
CREATE INDEX IF NOT EXISTS idx_plans_cr_value ON production_plans(cr_value);

-- ===========================================
-- 6. 紧急插单时段表 (新建)
-- ===========================================

CREATE TABLE IF NOT EXISTS insert_slots (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    production_line_id VARCHAR(36) NOT NULL,
    production_line_name VARCHAR(100),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    available_capacity DECIMAL(10,2),
    impact_level VARCHAR(20) DEFAULT 'none',
    impacted_plans JSONB,
    required_workers INT,
    available_workers INT,
    switch_cost_minutes INT DEFAULT 0,
    recommend_score INT DEFAULT 0,
    recommendation_reason TEXT,
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE insert_slots IS '紧急插单时段表';
COMMENT ON COLUMN insert_slots.available_capacity IS '可用产能 kg';
COMMENT ON COLUMN insert_slots.impact_level IS '影响等级: none/low/medium/high';
COMMENT ON COLUMN insert_slots.impacted_plans IS '受影响计划 JSON';
COMMENT ON COLUMN insert_slots.required_workers IS '所需人员';
COMMENT ON COLUMN insert_slots.available_workers IS '可用人员';
COMMENT ON COLUMN insert_slots.switch_cost_minutes IS '换型成本分钟';
COMMENT ON COLUMN insert_slots.recommend_score IS 'AI推荐分 0-100';
COMMENT ON COLUMN insert_slots.recommendation_reason IS 'AI推荐理由';
COMMENT ON COLUMN insert_slots.status IS '状态: available/selected/expired';

CREATE INDEX IF NOT EXISTS idx_insert_slots_factory_time ON insert_slots(factory_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_insert_slots_status ON insert_slots(status);

-- 创建触发器函数用于自动更新 updated_at
CREATE OR REPLACE FUNCTION update_insert_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insert_slots_updated_at ON insert_slots;
CREATE TRIGGER trg_insert_slots_updated_at
    BEFORE UPDATE ON insert_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_insert_slots_updated_at();

-- ===========================================
-- 7. 混批分组表 (新建)
-- ===========================================

CREATE TABLE IF NOT EXISTS mixed_batch_groups (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    group_type VARCHAR(30) NOT NULL,
    material_batch_id VARCHAR(50),
    process_type VARCHAR(50),
    order_ids JSONB NOT NULL,
    total_quantity DECIMAL(10,2),
    estimated_switch_saving INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    confirmed_by BIGINT,
    confirmed_at TIMESTAMP,
    production_plan_id VARCHAR(191),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE mixed_batch_groups IS '混批分组表';
COMMENT ON COLUMN mixed_batch_groups.group_type IS '混批类型: SAME_MATERIAL/SAME_PROCESS';
COMMENT ON COLUMN mixed_batch_groups.material_batch_id IS '共用原料批次ID';
COMMENT ON COLUMN mixed_batch_groups.process_type IS '共用工艺类型';
COMMENT ON COLUMN mixed_batch_groups.order_ids IS '合并的订单ID列表';
COMMENT ON COLUMN mixed_batch_groups.total_quantity IS '合并后总数量';
COMMENT ON COLUMN mixed_batch_groups.estimated_switch_saving IS '预计节省换型时间(分钟)';
COMMENT ON COLUMN mixed_batch_groups.status IS '状态: pending/confirmed/rejected';
COMMENT ON COLUMN mixed_batch_groups.confirmed_by IS '确认人';
COMMENT ON COLUMN mixed_batch_groups.confirmed_at IS '确认时间';
COMMENT ON COLUMN mixed_batch_groups.production_plan_id IS '生成的生产计划ID';

CREATE INDEX IF NOT EXISTS idx_mixed_batch_factory_status ON mixed_batch_groups(factory_id, status);
CREATE INDEX IF NOT EXISTS idx_mixed_batch_created ON mixed_batch_groups(created_at);

-- 创建触发器
CREATE OR REPLACE FUNCTION update_mixed_batch_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mixed_batch_groups_updated_at ON mixed_batch_groups;
CREATE TRIGGER trg_mixed_batch_groups_updated_at
    BEFORE UPDATE ON mixed_batch_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_mixed_batch_groups_updated_at();

-- ===========================================
-- 8. 混批规则配置表 (新建)
-- ===========================================

CREATE TABLE IF NOT EXISTS mixed_batch_rules (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    rule_type VARCHAR(30) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    max_deadline_gap_hours INT DEFAULT 24,
    min_switch_saving_minutes INT DEFAULT 10,
    process_similarity_threshold DECIMAL(3,2) DEFAULT 0.80,
    auto_detect BOOLEAN DEFAULT TRUE,
    require_approval BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_factory_rule_type UNIQUE (factory_id, rule_type)
);

COMMENT ON TABLE mixed_batch_rules IS '混批规则配置表';
COMMENT ON COLUMN mixed_batch_rules.rule_type IS '规则类型: SAME_MATERIAL/SAME_PROCESS';
COMMENT ON COLUMN mixed_batch_rules.is_enabled IS '是否启用';
COMMENT ON COLUMN mixed_batch_rules.max_deadline_gap_hours IS '最大交期间隔(小时)';
COMMENT ON COLUMN mixed_batch_rules.min_switch_saving_minutes IS '最小换型节省(分钟)';
COMMENT ON COLUMN mixed_batch_rules.process_similarity_threshold IS '工艺相似度阈值';
COMMENT ON COLUMN mixed_batch_rules.auto_detect IS '是否自动检测';
COMMENT ON COLUMN mixed_batch_rules.require_approval IS '是否需要审批';

-- 创建触发器
CREATE OR REPLACE FUNCTION update_mixed_batch_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mixed_batch_rules_updated_at ON mixed_batch_rules;
CREATE TRIGGER trg_mixed_batch_rules_updated_at
    BEFORE UPDATE ON mixed_batch_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_mixed_batch_rules_updated_at();

-- ===========================================
-- 9. 插入默认混批规则
-- ===========================================

-- 为每个工厂插入默认规则 (如果不存在)
INSERT INTO mixed_batch_rules (id, factory_id, rule_type, is_enabled, max_deadline_gap_hours, min_switch_saving_minutes)
SELECT
    gen_random_uuid()::VARCHAR(36) as id,
    f.id as factory_id,
    'SAME_MATERIAL' as rule_type,
    TRUE as is_enabled,
    24 as max_deadline_gap_hours,
    10 as min_switch_saving_minutes
FROM factories f
WHERE NOT EXISTS (
    SELECT 1 FROM mixed_batch_rules r
    WHERE r.factory_id = f.id AND r.rule_type = 'SAME_MATERIAL'
)
ON CONFLICT (factory_id, rule_type) DO NOTHING;

INSERT INTO mixed_batch_rules (id, factory_id, rule_type, is_enabled, max_deadline_gap_hours, min_switch_saving_minutes)
SELECT
    gen_random_uuid()::VARCHAR(36) as id,
    f.id as factory_id,
    'SAME_PROCESS' as rule_type,
    TRUE as is_enabled,
    24 as max_deadline_gap_hours,
    15 as min_switch_saving_minutes
FROM factories f
WHERE NOT EXISTS (
    SELECT 1 FROM mixed_batch_rules r
    WHERE r.factory_id = f.id AND r.rule_type = 'SAME_PROCESS'
)
ON CONFLICT (factory_id, rule_type) DO NOTHING;

-- ===========================================
-- 完成
-- ===========================================
