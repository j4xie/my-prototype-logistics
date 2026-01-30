-- =====================================================
-- 调度员模块增强 - 数据库迁移脚本
-- Version: V2025_12_28_2
-- Description: 添加员工扩展字段和调度员模块相关表
-- Author: Cretas Team
-- Date: 2025-12-28
-- =====================================================

-- ===========================================
-- 1. 用户表扩展字段 (调度员模块)
-- ===========================================

-- 添加工号字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(10) UNIQUE COMMENT '工号 (001-999)';

-- 添加雇用类型字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_type VARCHAR(20) DEFAULT 'FULL_TIME' COMMENT '雇用类型: FULL_TIME/PART_TIME/DISPATCH/INTERN/TEMPORARY';

-- 添加合同到期日字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_end_date DATE COMMENT '合同到期日（临时工）';

-- 添加技能等级字段 (JSON格式)
ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_levels JSON COMMENT '技能等级 JSON: {"切片": 3, "质检": 2}';

-- 添加小时工资字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) COMMENT '小时工资';

-- 添加头像URL字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255) COMMENT '头像URL';

-- 添加入职日期字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE COMMENT '入职日期';

-- ===========================================
-- 2. 为现有用户生成工号
-- ===========================================

-- 使用临时表和存储过程批量生成工号
-- 注意: 只为没有工号的用户生成
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS generate_employee_codes()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE user_id BIGINT;
    DECLARE next_code INT DEFAULT 1;
    DECLARE cur CURSOR FOR
        SELECT id FROM users
        WHERE employee_code IS NULL
        ORDER BY id;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- 获取当前最大工号
    SELECT IFNULL(MAX(CAST(employee_code AS UNSIGNED)), 0) + 1 INTO next_code FROM users WHERE employee_code IS NOT NULL;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO user_id;
        IF done THEN
            LEAVE read_loop;
        END IF;

        -- 跳过超过999的编号
        IF next_code <= 999 THEN
            UPDATE users SET employee_code = LPAD(next_code, 3, '0') WHERE id = user_id;
            SET next_code = next_code + 1;
        END IF;
    END LOOP;

    CLOSE cur;
END //
DELIMITER ;

-- 执行存储过程
CALL generate_employee_codes();

-- 删除存储过程
DROP PROCEDURE IF EXISTS generate_employee_codes;

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
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) DEFAULT 'MANUAL' COMMENT '计划来源: CUSTOMER_ORDER/AI_FORECAST/SAFETY_STOCK/MANUAL/URGENT_INSERT';

-- 添加关联订单ID
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS source_order_id VARCHAR(50) COMMENT '关联订单ID';

-- 添加客户名称
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS source_customer_name VARCHAR(100) COMMENT '客户名称';

-- 添加AI预测置信度
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS ai_confidence INT COMMENT 'AI预测置信度 0-100';

-- 添加预测原因
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS forecast_reason VARCHAR(255) COMMENT '预测原因';

-- 添加CR值 (交期紧急度)
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS cr_value DECIMAL(5,2) COMMENT 'CR值 = (交期-今日) / 工期';

-- 添加是否混批标记
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS is_mixed_batch BOOLEAN DEFAULT FALSE COMMENT '是否混批';

-- 添加混批关联类型
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS mixed_batch_type VARCHAR(30) COMMENT '混批类型: SAME_MATERIAL/SAME_PROCESS';

-- 添加混批关联订单 (JSON)
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS related_orders JSON COMMENT '混批关联订单 JSON: ["ORD-001", "ORD-002"]';

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
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    available_capacity DECIMAL(10,2) COMMENT '可用产能 kg',
    impact_level VARCHAR(20) DEFAULT 'none' COMMENT '影响等级: none/low/medium/high',
    impacted_plans JSON COMMENT '受影响计划 JSON',
    required_workers INT COMMENT '所需人员',
    available_workers INT COMMENT '可用人员',
    switch_cost_minutes INT DEFAULT 0 COMMENT '换型成本分钟',
    recommend_score INT DEFAULT 0 COMMENT 'AI推荐分 0-100',
    recommendation_reason TEXT COMMENT 'AI推荐理由',
    status VARCHAR(20) DEFAULT 'available' COMMENT '状态: available/selected/expired',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_insert_slots_factory_time (factory_id, start_time, end_time),
    INDEX idx_insert_slots_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='紧急插单时段表';

-- ===========================================
-- 7. 混批分组表 (新建)
-- ===========================================

CREATE TABLE IF NOT EXISTS mixed_batch_groups (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    group_type VARCHAR(30) NOT NULL COMMENT '混批类型: SAME_MATERIAL/SAME_PROCESS',
    material_batch_id VARCHAR(50) COMMENT '共用原料批次ID',
    process_type VARCHAR(50) COMMENT '共用工艺类型',
    order_ids JSON NOT NULL COMMENT '合并的订单ID列表',
    total_quantity DECIMAL(10,2) COMMENT '合并后总数量',
    estimated_switch_saving INT DEFAULT 0 COMMENT '预计节省换型时间(分钟)',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending/confirmed/rejected',
    confirmed_by BIGINT COMMENT '确认人',
    confirmed_at DATETIME COMMENT '确认时间',
    production_plan_id VARCHAR(191) COMMENT '生成的生产计划ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mixed_batch_factory_status (factory_id, status),
    INDEX idx_mixed_batch_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='混批分组表';

-- ===========================================
-- 8. 混批规则配置表 (新建)
-- ===========================================

CREATE TABLE IF NOT EXISTS mixed_batch_rules (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    rule_type VARCHAR(30) NOT NULL COMMENT '规则类型: SAME_MATERIAL/SAME_PROCESS',
    is_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    max_deadline_gap_hours INT DEFAULT 24 COMMENT '最大交期间隔(小时)',
    min_switch_saving_minutes INT DEFAULT 10 COMMENT '最小换型节省(分钟)',
    process_similarity_threshold DECIMAL(3,2) DEFAULT 0.80 COMMENT '工艺相似度阈值',
    auto_detect BOOLEAN DEFAULT TRUE COMMENT '是否自动检测',
    require_approval BOOLEAN DEFAULT TRUE COMMENT '是否需要审批',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_factory_rule_type (factory_id, rule_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='混批规则配置表';

-- ===========================================
-- 9. 插入默认混批规则
-- ===========================================

-- 为每个工厂插入默认规则 (如果不存在)
INSERT IGNORE INTO mixed_batch_rules (id, factory_id, rule_type, is_enabled, max_deadline_gap_hours, min_switch_saving_minutes)
SELECT
    UUID() as id,
    f.id as factory_id,
    'SAME_MATERIAL' as rule_type,
    TRUE as is_enabled,
    24 as max_deadline_gap_hours,
    10 as min_switch_saving_minutes
FROM factories f
WHERE NOT EXISTS (
    SELECT 1 FROM mixed_batch_rules r
    WHERE r.factory_id = f.id AND r.rule_type = 'SAME_MATERIAL'
);

INSERT IGNORE INTO mixed_batch_rules (id, factory_id, rule_type, is_enabled, max_deadline_gap_hours, min_switch_saving_minutes)
SELECT
    UUID() as id,
    f.id as factory_id,
    'SAME_PROCESS' as rule_type,
    TRUE as is_enabled,
    24 as max_deadline_gap_hours,
    15 as min_switch_saving_minutes
FROM factories f
WHERE NOT EXISTS (
    SELECT 1 FROM mixed_batch_rules r
    WHERE r.factory_id = f.id AND r.rule_type = 'SAME_PROCESS'
);

-- ===========================================
-- 完成
-- ===========================================
