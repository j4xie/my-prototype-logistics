-- ============================================
-- 计件人效管理功能数据库表结构
-- 版本: V20260114
-- 作者: Cretas Team
-- ============================================

-- 1. 计件单价规则表
CREATE TABLE IF NOT EXISTS piece_rate_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    work_type_id VARCHAR(191) COMMENT '工作类型ID',
    product_type_id VARCHAR(50) COMMENT '产品类型ID',
    process_stage_type VARCHAR(30) COMMENT '工序类型',
    name VARCHAR(100) NOT NULL COMMENT '规则名称',
    description TEXT COMMENT '描述',

    -- 阶梯计件规则
    tier1_threshold INT DEFAULT 0 COMMENT '第一阶梯数量阈值',
    tier1_rate DECIMAL(10, 4) NOT NULL COMMENT '第一阶梯单价(元/件)',
    tier2_threshold INT COMMENT '第二阶梯数量阈值',
    tier2_rate DECIMAL(10, 4) COMMENT '第二阶梯单价',
    tier3_threshold INT COMMENT '第三阶梯数量阈值',
    tier3_rate DECIMAL(10, 4) COMMENT '第三阶梯单价',
    max_tier_count INT DEFAULT 3 COMMENT '最大阶梯数',

    -- 配置
    effective_from DATE COMMENT '生效日期',
    effective_to DATE COMMENT '失效日期',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    priority INT DEFAULT 0 COMMENT '优先级',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_piece_rate_factory (factory_id),
    INDEX idx_piece_rate_work_type (work_type_id),
    INDEX idx_piece_rate_product_type (product_type_id),
    INDEX idx_piece_rate_process_stage (process_stage_type),
    INDEX idx_piece_rate_active (is_active),
    INDEX idx_piece_rate_effective (effective_from, effective_to),
    INDEX idx_piece_rate_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='计件单价规则表';

-- 2. 工资记录表
CREATE TABLE IF NOT EXISTS payroll_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    worker_id BIGINT NOT NULL COMMENT '工人ID',
    worker_name VARCHAR(50) COMMENT '工人姓名',

    -- 周期
    period_start DATE NOT NULL COMMENT '结算周期开始',
    period_end DATE NOT NULL COMMENT '结算周期结束',
    period_type VARCHAR(20) DEFAULT 'DAILY' COMMENT '周期类型: DAILY, WEEKLY, MONTHLY',

    -- 计件工资
    total_piece_count INT DEFAULT 0 COMMENT '总计件数',
    piece_rate_wage DECIMAL(12, 2) DEFAULT 0 COMMENT '计件工资金额',
    piece_rule_id BIGINT COMMENT '使用的计件规则ID',

    -- 其他工资
    base_salary DECIMAL(12, 2) DEFAULT 0 COMMENT '基本工资',
    overtime_wage DECIMAL(12, 2) DEFAULT 0 COMMENT '加班工资',
    overtime_hours DECIMAL(8, 2) DEFAULT 0 COMMENT '加班时长',
    bonus_amount DECIMAL(12, 2) DEFAULT 0 COMMENT '奖金',
    deduction_amount DECIMAL(12, 2) DEFAULT 0 COMMENT '扣款',
    total_wage DECIMAL(12, 2) DEFAULT 0 COMMENT '总工资',

    -- 效率相关
    average_efficiency DECIMAL(10, 2) COMMENT '平均效率(件/小时)',
    total_work_hours DECIMAL(10, 2) COMMENT '总工作时长',
    efficiency_rating VARCHAR(10) COMMENT '效率评级: A, B, C, D',

    -- 审核
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT '状态: PENDING, APPROVED, PAID',
    approved_by BIGINT COMMENT '审核人ID',
    approved_at DATETIME COMMENT '审核时间',
    paid_at DATETIME COMMENT '发放时间',
    notes TEXT COMMENT '备注',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_payroll_factory (factory_id),
    INDEX idx_payroll_worker (worker_id),
    INDEX idx_payroll_period_start (period_start),
    INDEX idx_payroll_status (status),
    INDEX idx_payroll_factory_period (factory_id, period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工资记录表';

-- 3. 工人日效率汇总表
CREATE TABLE IF NOT EXISTS worker_daily_efficiency (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    worker_id BIGINT NOT NULL COMMENT '工人ID',
    worker_name VARCHAR(50) COMMENT '工人姓名',
    work_date DATE NOT NULL COMMENT '工作日期',

    -- 工时数据
    shift_type VARCHAR(20) COMMENT '班次类型: MORNING, AFTERNOON, NIGHT',
    work_start_time DATETIME COMMENT '上班时间',
    work_end_time DATETIME COMMENT '下班时间',
    total_work_minutes INT DEFAULT 0 COMMENT '总工作时长(分钟)',
    break_minutes INT DEFAULT 0 COMMENT '休息时长(分钟)',
    effective_work_minutes INT DEFAULT 0 COMMENT '有效工作时长',

    -- 计件数据
    total_piece_count INT DEFAULT 0 COMMENT '总完成件数',
    qualified_count INT DEFAULT 0 COMMENT '合格件数',
    defect_count INT DEFAULT 0 COMMENT '不合格件数',
    quality_rate DECIMAL(5, 2) COMMENT '合格率(%)',

    -- 效率指标
    pieces_per_hour DECIMAL(10, 2) COMMENT '每小时件数',
    average_time_per_piece DECIMAL(10, 2) COMMENT '平均单件时间(秒)',
    efficiency_score DECIMAL(5, 2) COMMENT '效率评分(0-100)',
    efficiency_trend VARCHAR(10) COMMENT '效率趋势: UP, DOWN, STABLE',

    -- 工位和工序
    workstation_id VARCHAR(50) COMMENT '工位ID',
    workstation_name VARCHAR(100) COMMENT '工位名称',
    process_stage_type VARCHAR(30) COMMENT '工序类型',
    product_type_id VARCHAR(50) COMMENT '产品类型ID',

    -- 对比数据
    standard_pieces_per_hour DECIMAL(10, 2) COMMENT '标准效率',
    compared_to_standard DECIMAL(8, 2) COMMENT '与标准对比百分比',
    rank_in_team INT COMMENT '团队排名',

    -- 其他
    ai_detected_count INT DEFAULT 0 COMMENT 'AI检测到的完成次数',
    manual_adjust_count INT DEFAULT 0 COMMENT '人工调整次数',
    notes TEXT COMMENT '备注',
    extra_data TEXT COMMENT '扩展数据JSON',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_wde_factory_id (factory_id),
    INDEX idx_wde_worker_id (worker_id),
    INDEX idx_wde_work_date (work_date),
    INDEX idx_wde_factory_worker_date (factory_id, worker_id, work_date),
    UNIQUE KEY uk_worker_date (factory_id, worker_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工人日效率汇总表';

-- 4. 生产工序Prompt配置表
CREATE TABLE IF NOT EXISTS production_process_prompt_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) COMMENT '工厂ID (NULL表示全局配置)',
    product_type_id VARCHAR(50) COMMENT '产品类型ID',
    process_stage_type VARCHAR(30) NOT NULL COMMENT '工序类型',
    name VARCHAR(100) NOT NULL COMMENT '配置名称',
    description TEXT COMMENT '描述',

    -- Prompt配置
    system_prompt TEXT COMMENT '系统提示词',
    completion_detection_prompt TEXT COMMENT '完成动作检测提示词',
    expected_completion_actions TEXT COMMENT '预期的完成动作描述(JSON数组)',
    response_format TEXT COMMENT '期望的返回格式模板',

    -- AI参数
    model_name VARCHAR(50) DEFAULT 'deepseek-vl' COMMENT 'AI模型名称',
    temperature DECIMAL(3, 2) DEFAULT 0.30 COMMENT '温度参数',
    max_tokens INT DEFAULT 1000 COMMENT '最大token数',
    confidence_threshold DECIMAL(3, 2) DEFAULT 0.80 COMMENT '置信度阈值',

    -- 检测配置
    detection_interval INT DEFAULT 1000 COMMENT '检测间隔(毫秒)',
    cooldown_seconds INT DEFAULT 3 COMMENT '防重复冷却时间(秒)',
    min_confidence DECIMAL(3, 2) DEFAULT 0.50 COMMENT '最小置信度要求',

    -- 状态
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    priority INT DEFAULT 0 COMMENT '优先级',
    effective_from DATE COMMENT '生效日期',
    effective_to DATE COMMENT '失效日期',

    -- 示例数据
    sample_image_urls TEXT COMMENT '示例图片URL(JSON数组)',
    sample_expected_results TEXT COMMENT '示例预期结果(JSON)',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_process_prompt_factory_type (factory_id, process_stage_type),
    INDEX idx_process_prompt_product (factory_id, product_type_id),
    INDEX idx_process_prompt_active (is_active),
    INDEX idx_process_prompt_priority (priority),
    INDEX idx_process_prompt_effective (effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='生产工序Prompt配置表';

-- ============================================
-- 初始化数据（示例）
-- ============================================

-- 示例计件规则 - 包装工序
INSERT INTO piece_rate_rules (factory_id, process_stage_type, name, description,
    tier1_threshold, tier1_rate, tier2_threshold, tier2_rate, tier3_threshold, tier3_rate,
    is_active, priority)
VALUES
('F001', 'PACKAGING', '包装工序基础计件', '包装工序三阶梯计件规则',
    0, 0.4000, 300, 0.5000, 400, 0.6000, 1, 10);

-- 示例Prompt配置 - 包装工序
INSERT INTO production_process_prompt_configs (factory_id, process_stage_type, name,
    system_prompt, completion_detection_prompt, expected_completion_actions,
    response_format, is_active, priority)
VALUES
('F001', 'PACKAGING', '包装工序AI检测配置',
'你正在监控食品包装线的包装工序。工人的任务是将产品装入包装袋并放到传送带上。',
'请分析当前画面，判断工人是否完成了一次包装动作。完成标志是：工人将包装好的产品放到传送带上，并且手离开产品。',
'["产品放到传送带", "手离开产品", "产品移出画面"]',
'{"completed": true/false, "confidence": 0.0-1.0, "action_description": "描述检测到的动作"}',
1, 10);
