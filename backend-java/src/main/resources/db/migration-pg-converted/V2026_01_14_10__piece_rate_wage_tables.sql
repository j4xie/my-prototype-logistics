-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_14_10__piece_rate_wage_tables.sql
-- Conversion date: 2026-01-26 18:48:18
-- WARNING: This file requires manual review!
-- ============================================

-- =============================================
-- 计件工资与人效管理数据库表
-- 版本: V2026_01_14_10
-- 作者: Cretas Team
-- 描述: 创建计件规则、工资记录、工人日效率三张核心表
-- =============================================

-- 1. 计件规则表
CREATE TABLE IF NOT EXISTS piece_rate_rules (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(191) NOT NULL COMMENT '工厂ID',
    work_type_id VARCHAR(191) COMMENT '工作类型ID',
    product_type_id VARCHAR(191) COMMENT '产品类型ID',
    process_stage_type VARCHAR(50) COMMENT '工序类型',
    name VARCHAR(100) NOT NULL COMMENT '规则名称',
    description TEXT COMMENT '规则描述',

    -- 阶梯计件规则
    tier1_threshold INT DEFAULT 0 COMMENT '第一阶梯数量阈值',
    tier1_rate DECIMAL(10,4) COMMENT '第一阶梯单价(元/件)',
    tier2_threshold INT COMMENT '第二阶梯数量阈值',
    tier2_rate DECIMAL(10,4) COMMENT '第二阶梯单价(元/件)',
    tier3_threshold INT COMMENT '第三阶梯数量阈值',
    tier3_rate DECIMAL(10,4) COMMENT '第三阶梯单价(元/件)',
    max_tier_count INT DEFAULT 3 COMMENT '最大阶梯数',

    -- 配置字段
    effective_from DATE COMMENT '生效日期',
    effective_to DATE COMMENT '失效日期',
    is_active SMALLINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
    priority INT DEFAULT 0 COMMENT '优先级(数值越大越优先)',

    -- BaseEntity 字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE COMMENT '软删除时间',

    INDEX idx_piece_rate_factory (factory_id),
    INDEX idx_piece_rate_work_type (work_type_id),
    INDEX idx_piece_rate_product_type (product_type_id),
    INDEX idx_piece_rate_process_stage (factory_id, process_stage_type),
    INDEX idx_piece_rate_active (factory_id, is_active),
    INDEX idx_piece_rate_effective (factory_id, effective_from, effective_to),
    INDEX idx_piece_rate_priority (factory_id, priority)
);

-- 2. 工资记录表
CREATE TABLE IF NOT EXISTS payroll_records (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    worker_id BIGINT NOT NULL COMMENT '工人ID',
    worker_name VARCHAR(50) NOT NULL COMMENT '工人姓名',

    -- 周期字段
    period_start DATE NOT NULL COMMENT '结算周期开始日期',
    period_end DATE NOT NULL COMMENT '结算周期结束日期',
    period_type VARCHAR(20) NOT NULL COMMENT '结算周期类型(DAILY/WEEKLY/MONTHLY)',

    -- 计件工资
    total_piece_count INT COMMENT '总计件数',
    piece_rate_wage DECIMAL(12,2) COMMENT '计件工资金额',
    piece_rule_id BIGINT COMMENT '使用的计件规则ID',

    -- 其他工资
    base_salary DECIMAL(12,2) COMMENT '基本工资',
    overtime_wage DECIMAL(12,2) COMMENT '加班工资',
    overtime_hours DECIMAL(8,2) COMMENT '加班时长(小时)',
    bonus_amount DECIMAL(12,2) COMMENT '奖金',
    deduction_amount DECIMAL(12,2) COMMENT '扣款',
    total_wage DECIMAL(12,2) COMMENT '总工资',

    -- 效率相关
    average_efficiency DECIMAL(8,2) COMMENT '平均效率(件/小时)',
    total_work_hours DECIMAL(8,2) COMMENT '总工作时长(小时)',
    efficiency_rating VARCHAR(1) COMMENT '效率评级(A/B/C/D)',

    -- 审核字段
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态(PENDING/APPROVED/PAID)',
    approved_by BIGINT COMMENT '审核人ID',
    approved_at TIMESTAMP WITH TIME ZONE COMMENT '审核时间',
    paid_at TIMESTAMP WITH TIME ZONE COMMENT '发放时间',
    notes TEXT COMMENT '备注',

    -- BaseEntity 字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE COMMENT '软删除时间',

    INDEX idx_payroll_factory (factory_id),
    INDEX idx_payroll_worker (worker_id),
    INDEX idx_payroll_period_start (period_start),
    INDEX idx_payroll_status (status),
    INDEX idx_payroll_factory_period (factory_id, period_start, period_end),
    UNIQUE KEY uk_payroll_worker_period (factory_id, worker_id, period_start, period_end)
);

-- 3. 工人日效率汇总表
CREATE TABLE IF NOT EXISTS worker_daily_efficiency (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    worker_id BIGINT NOT NULL COMMENT '工人ID',
    worker_name VARCHAR(50) COMMENT '工人姓名',
    work_date DATE NOT NULL COMMENT '工作日期',

    -- 工时数据
    shift_type VARCHAR(20) COMMENT '班次类型(MORNING/AFTERNOON/NIGHT)',
    work_start_time TIMESTAMP WITH TIME ZONE COMMENT '上班时间',
    work_end_time TIMESTAMP WITH TIME ZONE COMMENT '下班时间',
    total_work_minutes INT COMMENT '总工作时长(分钟)',
    break_minutes INT COMMENT '休息时长(分钟)',
    effective_work_minutes INT COMMENT '有效工作时长(分钟)',

    -- 计件数据
    total_piece_count INT COMMENT '总完成件数',
    qualified_count INT COMMENT '合格件数',
    defect_count INT COMMENT '不合格件数',
    quality_rate DECIMAL(5,2) COMMENT '合格率(%)',

    -- 效率指标
    pieces_per_hour DECIMAL(10,2) COMMENT '每小时件数',
    average_time_per_piece DECIMAL(10,2) COMMENT '平均单件时间(秒)',
    efficiency_score DECIMAL(5,2) COMMENT '效率评分(0-100)',
    efficiency_trend VARCHAR(20) COMMENT '效率趋势(UP/DOWN/STABLE)',

    -- 工位和工序
    workstation_id VARCHAR(50) COMMENT '工位ID',
    workstation_name VARCHAR(100) COMMENT '工位名称',
    process_stage_type VARCHAR(50) COMMENT '工序类型',
    product_type_id VARCHAR(50) COMMENT '产品类型ID',

    -- 对比数据
    standard_pieces_per_hour DECIMAL(10,2) COMMENT '标准效率(件/小时)',
    compared_to_standard DECIMAL(7,2) COMMENT '与标准对比百分比(%)',
    rank_in_team INT COMMENT '团队排名',

    -- 其他
    ai_detected_count INT COMMENT 'AI检测到的完成次数',
    manual_adjust_count INT COMMENT '人工调整次数',
    notes TEXT COMMENT '备注',
    extra_data TEXT COMMENT '扩展数据(JSON)',

    -- BaseEntity 字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE COMMENT '软删除时间',

    INDEX idx_wde_factory_id (factory_id),
    INDEX idx_wde_worker_id (worker_id),
    INDEX idx_wde_work_date (work_date),
    INDEX idx_wde_factory_worker_date (factory_id, worker_id, work_date),
    INDEX idx_wde_process_stage (factory_id, work_date, process_stage_type),
    UNIQUE KEY uk_wde_factory_worker_date_process (factory_id, worker_id, work_date, process_stage_type)
);

-- =============================================
-- 插入示例数据
-- =============================================

-- 示例计件规则: 基础计件 (适用于所有工序)
INSERT INTO piece_rate_rules (factory_id, name, description, tier1_threshold, tier1_rate, tier2_threshold, tier2_rate, tier3_threshold, tier3_rate, is_active, priority)
VALUES
('F001', '默认计件规则', '适用于所有工序的基础计件规则', 300, 0.50, 400, 0.60, 500, 0.70, 1, 0),
('F001', '切片工序计件', '切片工序专用计件规则', 200, 0.45, 300, 0.55, 400, 0.65, 1, 10);

-- 更新切片工序规则的工序类型
UPDATE piece_rate_rules SET process_stage_type = 'CUTTING' WHERE name = '切片工序计件' AND factory_id = 'F001';
