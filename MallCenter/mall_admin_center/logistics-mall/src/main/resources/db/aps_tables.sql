-- =====================================================
-- APS (Advanced Planning and Scheduling) 数据库表
-- 支持10大复杂场景:
-- 1. 多产线协调与人员调配
-- 2. 混批生产优化
-- 3. 工艺约束与时间窗口
-- 4. 跨天排程
-- 5. 设备/模具共享冲突
-- 6. 物料到达约束
-- 7. 多班次管理
-- 8. 质检等待
-- 9. 紧急插单
-- 10. 综合场景
-- =====================================================

-- 1. 生产订单表
CREATE TABLE IF NOT EXISTS aps_production_order (
    id VARCHAR(32) PRIMARY KEY,
    order_no VARCHAR(50) NOT NULL COMMENT '生产订单号',
    sales_order_id VARCHAR(32) COMMENT '关联销售订单',
    product_id VARCHAR(32) COMMENT '产品ID',
    product_name VARCHAR(100) COMMENT '产品名称',
    product_spec VARCHAR(100) COMMENT '产品规格',
    product_category VARCHAR(50) COMMENT '产品类别(换型时间计算)',
    planned_qty DECIMAL(12,2) DEFAULT 0 COMMENT '计划数量',
    completed_qty DECIMAL(12,2) DEFAULT 0 COMMENT '已完成数量',
    unit VARCHAR(20) DEFAULT 'pcs' COMMENT '单位',

    -- 时间约束
    earliest_start DATETIME COMMENT '最早开始时间',
    latest_end DATETIME COMMENT '最晚完成时间(交期)',
    planned_start DATETIME COMMENT '计划开始时间',
    planned_end DATETIME COMMENT '计划完成时间',
    actual_start DATETIME COMMENT '实际开始时间',
    actual_end DATETIME COMMENT '实际完成时间',

    -- 工艺约束
    routing_id VARCHAR(32) COMMENT '工艺路线ID',
    current_operation_seq INT DEFAULT 1 COMMENT '当前工序序号',
    total_operations INT DEFAULT 1 COMMENT '总工序数',
    standard_time DECIMAL(10,2) COMMENT '标准工时(分钟/单位)',
    pre_wait_time INT DEFAULT 0 COMMENT '前置等待(分钟)',
    post_wait_time INT DEFAULT 0 COMMENT '后置等待(分钟)',

    -- 资源需求
    assigned_line_id VARCHAR(32) COMMENT '指定产线(空=自动分配)',
    required_equipment_type VARCHAR(50) COMMENT '需要的设备类型',
    required_mold_id VARCHAR(32) COMMENT '需要的模具ID',
    required_skill_level INT DEFAULT 1 COMMENT '需要的技能等级',
    required_worker_count INT DEFAULT 1 COMMENT '需要的人员数量',

    -- 物料约束
    bom_id VARCHAR(32) COMMENT '物料BOM ID',
    material_status VARCHAR(20) DEFAULT 'ready' COMMENT 'ready/partial/waiting',
    material_arrival_time DATETIME COMMENT '物料预计到达时间',

    -- 优先级与状态
    priority INT DEFAULT 5 COMMENT '优先级 1-10',
    is_urgent TINYINT DEFAULT 0 COMMENT '是否紧急插单',
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/scheduled/in_progress/paused/completed/cancelled',
    allow_split TINYINT DEFAULT 0 COMMENT '是否允许拆分',
    allow_cross_day TINYINT DEFAULT 1 COMMENT '是否允许跨天',
    allow_mix_batch TINYINT DEFAULT 0 COMMENT '是否允许混批',

    -- 排程结果
    scheduled_line_id VARCHAR(32) COMMENT '分配的产线',
    scheduled_equipment_id VARCHAR(32) COMMENT '分配的设备',
    schedule_batch_no VARCHAR(50) COMMENT '排程批次号',
    schedule_sequence INT COMMENT '排程顺序',
    changeover_time INT DEFAULT 0 COMMENT '预计换型时间(分钟)',

    -- 元数据
    is_simulated TINYINT DEFAULT 0,
    remark VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_order_no (order_no),
    INDEX idx_status (status),
    INDEX idx_latest_end (latest_end),
    INDEX idx_priority (priority DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APS生产订单';

-- 2. 生产线表
CREATE TABLE IF NOT EXISTS aps_production_line (
    id VARCHAR(32) PRIMARY KEY,
    line_no VARCHAR(50) NOT NULL COMMENT '产线编号',
    line_name VARCHAR(100) COMMENT '产线名称',
    line_type VARCHAR(50) COMMENT 'assembly/packaging/processing/mixing',
    workshop_id VARCHAR(32) COMMENT '所属车间',

    -- 能力参数
    standard_capacity DECIMAL(10,2) COMMENT '标准产能(件/小时)',
    max_capacity DECIMAL(10,2) COMMENT '最大产能',
    efficiency_factor DECIMAL(5,2) DEFAULT 1.00 COMMENT '效率系数',
    product_categories VARCHAR(500) COMMENT '可生产的产品类别',
    standard_worker_count INT DEFAULT 5 COMMENT '标准人员数',
    min_worker_count INT DEFAULT 3 COMMENT '最小人员数',
    max_worker_count INT DEFAULT 8 COMMENT '最大人员数',

    -- 班次配置
    shift_mode VARCHAR(20) DEFAULT 'double' COMMENT 'single/double/triple',
    shift1_start TIME DEFAULT '08:00:00' COMMENT '早班开始',
    shift1_end TIME DEFAULT '16:00:00' COMMENT '早班结束',
    shift2_start TIME DEFAULT '16:00:00' COMMENT '中班开始',
    shift2_end TIME DEFAULT '00:00:00' COMMENT '中班结束',
    shift3_start TIME DEFAULT '00:00:00' COMMENT '晚班开始',
    shift3_end TIME DEFAULT '08:00:00' COMMENT '晚班结束',

    -- 当前状态
    status VARCHAR(20) DEFAULT 'available' COMMENT 'available/running/maintenance/offline',
    current_order_id VARCHAR(32) COMMENT '当前生产订单',
    current_product_category VARCHAR(50) COMMENT '当前产品类别',
    current_worker_count INT DEFAULT 0 COMMENT '当前人数',
    today_output DECIMAL(12,2) DEFAULT 0 COMMENT '今日产量',
    estimated_free_time DATETIME COMMENT '预计空闲时间',

    -- 维护信息
    next_maintenance_time DATETIME COMMENT '下次维护时间',
    maintenance_cycle_hours INT DEFAULT 500 COMMENT '维护周期(小时)',
    running_hours_since_maintenance DECIMAL(10,2) DEFAULT 0 COMMENT '累计运行',

    -- 元数据
    is_simulated TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    UNIQUE INDEX idx_line_no (line_no),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APS生产线';

-- 3. 生产人员表
CREATE TABLE IF NOT EXISTS aps_production_worker (
    id VARCHAR(32) PRIMARY KEY,
    worker_no VARCHAR(50) NOT NULL COMMENT '工号',
    worker_name VARCHAR(50) COMMENT '姓名',
    department VARCHAR(50) COMMENT '部门',
    default_line_id VARCHAR(32) COMMENT '默认产线',

    -- 技能属性
    skill_level INT DEFAULT 3 COMMENT '技能等级 1-5',
    capable_line_types VARCHAR(200) COMMENT '可操作产线类型',
    capable_equipment_types VARCHAR(200) COMMENT '可操作设备类型',
    efficiency_factor DECIMAL(5,2) DEFAULT 1.00 COMMENT '效率系数',

    -- 班次信息
    current_shift VARCHAR(20) COMMENT 'day/middle/night',
    shift_start TIME COMMENT '今日上班时间',
    shift_end TIME COMMENT '今日下班时间',
    can_overtime TINYINT DEFAULT 1 COMMENT '是否可加班',
    max_overtime_hours INT DEFAULT 3 COMMENT '最大加班时长',

    -- 当前状态
    status VARCHAR(20) DEFAULT 'available' COMMENT 'available/working/break/off',
    current_line_id VARCHAR(32) COMMENT '当前产线',
    current_order_id VARCHAR(32) COMMENT '当前任务',
    today_work_minutes INT DEFAULT 0 COMMENT '今日工作时长',
    estimated_free_time DATETIME COMMENT '预计空闲时间',

    -- 统计
    month_work_days INT DEFAULT 0 COMMENT '本月工作天数',
    month_overtime_hours DECIMAL(6,2) DEFAULT 0 COMMENT '本月加班',
    avg_output_per_hour DECIMAL(10,2) COMMENT '平均产出',

    -- 元数据
    is_simulated TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    UNIQUE INDEX idx_worker_no (worker_no),
    INDEX idx_status (status),
    INDEX idx_current_line (current_line_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APS生产人员';

-- 4. 生产设备表
CREATE TABLE IF NOT EXISTS aps_production_equipment (
    id VARCHAR(32) PRIMARY KEY,
    equipment_no VARCHAR(50) NOT NULL COMMENT '设备编号',
    equipment_name VARCHAR(100) COMMENT '设备名称',
    equipment_type VARCHAR(50) COMMENT '设备类型',
    line_id VARCHAR(32) COMMENT '所属产线(空=共享)',
    is_shared TINYINT DEFAULT 0 COMMENT '是否共享',

    -- 能力参数
    standard_speed DECIMAL(10,2) COMMENT '标准速度(件/小时)',
    max_speed DECIMAL(10,2) COMMENT '最大速度',
    product_categories VARCHAR(500) COMMENT '可处理产品类别',
    required_operators INT DEFAULT 1 COMMENT '需要操作人员数',

    -- 当前状态
    status VARCHAR(20) DEFAULT 'available' COMMENT 'available/running/setup/maintenance/fault',
    current_order_id VARCHAR(32) COMMENT '当前订单',
    current_product_category VARCHAR(50) COMMENT '当前产品类别',
    estimated_free_time DATETIME COMMENT '预计空闲时间',

    -- 维护信息
    last_maintenance_time DATETIME COMMENT '上次维护',
    next_maintenance_time DATETIME COMMENT '下次维护',
    total_running_hours DECIMAL(12,2) DEFAULT 0 COMMENT '累计运行',
    failure_rate DECIMAL(5,4) DEFAULT 0 COMMENT '故障率',

    -- 元数据
    is_simulated TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    UNIQUE INDEX idx_equipment_no (equipment_no),
    INDEX idx_status (status),
    INDEX idx_line_id (line_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APS生产设备';

-- 5. 生产模具表
CREATE TABLE IF NOT EXISTS aps_production_mold (
    id VARCHAR(32) PRIMARY KEY,
    mold_no VARCHAR(50) NOT NULL COMMENT '模具编号',
    mold_name VARCHAR(100) COMMENT '模具名称',
    mold_type VARCHAR(50) COMMENT '模具类型',
    applicable_specs VARCHAR(500) COMMENT '适用规格',
    product_category VARCHAR(50) COMMENT '适用类别',

    -- 能力参数
    cavity_count INT DEFAULT 1 COMMENT '穴数',
    standard_cycle_time INT COMMENT '标准周期(秒)',
    setup_time INT DEFAULT 30 COMMENT '安装时间(分钟)',
    teardown_time INT DEFAULT 20 COMMENT '拆卸时间(分钟)',

    -- 使用状态
    status VARCHAR(20) DEFAULT 'available' COMMENT 'available/in_use/maintenance/scrapped',
    current_equipment_id VARCHAR(32) COMMENT '当前设备',
    current_line_id VARCHAR(32) COMMENT '当前产线',
    current_order_id VARCHAR(32) COMMENT '当前订单',
    estimated_free_time DATETIME COMMENT '预计空闲时间',

    -- 寿命管理
    design_life_cycles INT DEFAULT 100000 COMMENT '设计寿命',
    used_cycles INT DEFAULT 0 COMMENT '已使用次数',
    remaining_life_percent DECIMAL(5,2) DEFAULT 100 COMMENT '剩余寿命%',
    last_maintenance_time DATETIME COMMENT '上次维护',
    maintenance_cycle_counts INT DEFAULT 10000 COMMENT '维护周期',

    -- 元数据
    is_simulated TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    UNIQUE INDEX idx_mold_no (mold_no),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APS生产模具';

-- 6. 换型矩阵表
CREATE TABLE IF NOT EXISTS aps_changeover_matrix (
    id VARCHAR(32) PRIMARY KEY,
    line_id VARCHAR(32) COMMENT '产线ID(空=通用)',
    from_category VARCHAR(50) NOT NULL COMMENT '来源类别',
    from_spec VARCHAR(100) COMMENT '来源规格',
    to_category VARCHAR(50) NOT NULL COMMENT '目标类别',
    to_spec VARCHAR(100) COMMENT '目标规格',

    changeover_minutes INT NOT NULL COMMENT '换型时间(分钟)',
    requires_cleaning TINYINT DEFAULT 0 COMMENT '是否需要清洁',
    cleaning_minutes INT DEFAULT 0 COMMENT '清洁时间',
    requires_mold_change TINYINT DEFAULT 0 COMMENT '是否换模具',
    mold_change_minutes INT DEFAULT 0 COMMENT '换模具时间',
    requires_calibration TINYINT DEFAULT 0 COMMENT '是否需要调试',
    calibration_minutes INT DEFAULT 0 COMMENT '调试时间',
    required_workers INT DEFAULT 2 COMMENT '需要人员数',
    changeover_cost INT DEFAULT 0 COMMENT '换型成本(元)',

    remark VARCHAR(200),
    is_simulated TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_from_to (from_category, to_category),
    INDEX idx_line_id (line_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APS换型矩阵';

-- 7. 排程任务表 (Gantt图数据)
CREATE TABLE IF NOT EXISTS aps_schedule_task (
    id VARCHAR(32) PRIMARY KEY,
    task_no VARCHAR(50) NOT NULL COMMENT '任务编号',
    schedule_batch_no VARCHAR(50) NOT NULL COMMENT '排程批次号',
    order_id VARCHAR(32) COMMENT '关联订单',
    order_no VARCHAR(50) COMMENT '订单号',
    task_type VARCHAR(20) DEFAULT 'production' COMMENT 'production/changeover/maintenance/break',

    -- 产品信息
    product_id VARCHAR(32),
    product_name VARCHAR(100),
    product_spec VARCHAR(100),
    product_category VARCHAR(50),
    planned_qty DECIMAL(12,2) DEFAULT 0,
    completed_qty DECIMAL(12,2) DEFAULT 0,

    -- 时间安排
    planned_start DATETIME NOT NULL COMMENT '计划开始',
    planned_end DATETIME NOT NULL COMMENT '计划结束',
    actual_start DATETIME COMMENT '实际开始',
    actual_end DATETIME COMMENT '实际结束',
    planned_duration INT COMMENT '计划时长(分钟)',
    actual_duration INT COMMENT '实际时长',
    is_cross_day TINYINT DEFAULT 0 COMMENT '是否跨天',

    -- 资源分配
    line_id VARCHAR(32) NOT NULL COMMENT '产线ID',
    line_name VARCHAR(100) COMMENT '产线名称',
    equipment_id VARCHAR(32) COMMENT '设备ID',
    mold_id VARCHAR(32) COMMENT '模具ID',
    worker_ids VARCHAR(500) COMMENT '人员ID列表',
    worker_count INT DEFAULT 0 COMMENT '人员数量',

    -- 换型信息
    previous_order_id VARCHAR(32) COMMENT '前置订单',
    changeover_minutes INT DEFAULT 0 COMMENT '换型时间',
    requires_cleaning TINYINT DEFAULT 0,

    -- 约束满足
    meets_time_window TINYINT DEFAULT 1 COMMENT '满足时间窗口',
    delivery_gap_minutes INT DEFAULT 0 COMMENT '与交期差距',
    meets_material_constraint TINYINT DEFAULT 1 COMMENT '满足物料约束',

    -- 状态
    status VARCHAR(20) DEFAULT 'planned' COMMENT 'planned/confirmed/in_progress/paused/completed/cancelled',
    sequence_in_line INT COMMENT '产线内顺序',
    progress_percent INT DEFAULT 0 COMMENT '进度%',

    -- 混批
    is_mix_batch TINYINT DEFAULT 0,
    mix_batch_order_ids VARCHAR(500) COMMENT '混批订单ID列表',

    -- 元数据
    is_simulated TINYINT DEFAULT 0,
    remark VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_task_no (task_no),
    INDEX idx_schedule_batch (schedule_batch_no),
    INDEX idx_line_id (line_id),
    INDEX idx_planned_start (planned_start),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APS排程任务';

-- 8. 人员分配表
CREATE TABLE IF NOT EXISTS aps_worker_assignment (
    id VARCHAR(32) PRIMARY KEY,
    schedule_batch_no VARCHAR(50) NOT NULL,
    worker_id VARCHAR(32) NOT NULL COMMENT '人员ID',
    worker_name VARCHAR(50) COMMENT '人员姓名',
    task_id VARCHAR(32) COMMENT '任务ID',
    line_id VARCHAR(32) COMMENT '产线ID',
    line_name VARCHAR(100) COMMENT '产线名称',

    -- 时间安排
    planned_start DATETIME NOT NULL,
    planned_end DATETIME NOT NULL,
    actual_start DATETIME,
    actual_end DATETIME,
    planned_minutes INT DEFAULT 0 COMMENT '计划工作时长',
    actual_minutes INT DEFAULT 0 COMMENT '实际工作时长',

    -- 分配原因
    assignment_type VARCHAR(20) DEFAULT 'initial' COMMENT 'initial/transfer/overtime/support',
    from_line_id VARCHAR(32) COMMENT '调配来源',
    transfer_reason VARCHAR(200) COMMENT '调配原因',

    -- 状态
    status VARCHAR(20) DEFAULT 'planned' COMMENT 'planned/confirmed/working/completed/cancelled',
    is_overtime TINYINT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,

    -- 元数据
    is_simulated TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_schedule_batch (schedule_batch_no),
    INDEX idx_worker_id (worker_id),
    INDEX idx_line_id (line_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APS人员分配';

-- 9. 排程冲突表
CREATE TABLE IF NOT EXISTS aps_schedule_conflict (
    id VARCHAR(32) PRIMARY KEY,
    schedule_batch_no VARCHAR(50) NOT NULL,
    conflict_type VARCHAR(30) NOT NULL COMMENT 'equipment/mold/worker/time_window/material/capacity',
    severity VARCHAR(20) DEFAULT 'medium' COMMENT 'low/medium/high/critical',

    -- 冲突详情
    order1_id VARCHAR(32),
    order1_no VARCHAR(50),
    order2_id VARCHAR(32),
    order2_no VARCHAR(50),
    conflict_resource_id VARCHAR(32) COMMENT '冲突资源ID',
    conflict_resource_name VARCHAR(100) COMMENT '冲突资源名称',
    conflict_start DATETIME COMMENT '冲突开始时间',
    conflict_end DATETIME COMMENT '冲突结束时间',
    description VARCHAR(500) COMMENT '冲突描述',

    -- 解决方案
    suggested_solution VARCHAR(500) COMMENT '建议方案',
    is_resolved TINYINT DEFAULT 0,
    resolution_method VARCHAR(200) COMMENT '解决方式',
    resolved_at DATETIME,
    resolution_note VARCHAR(500),

    -- 影响评估
    affected_order_count INT DEFAULT 1,
    estimated_delay_minutes INT DEFAULT 0,
    affected_delivery_value INT DEFAULT 0 COMMENT '影响金额(元)',

    -- 元数据
    is_simulated TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_schedule_batch (schedule_batch_no),
    INDEX idx_conflict_type (conflict_type),
    INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APS排程冲突';

-- 10. 排程结果表 (排程历史)
CREATE TABLE IF NOT EXISTS aps_schedule_result (
    id VARCHAR(32) PRIMARY KEY,
    schedule_batch_no VARCHAR(50) NOT NULL COMMENT '排程批次号',
    schedule_date DATE NOT NULL COMMENT '排程日期',
    schedule_type VARCHAR(20) DEFAULT 'auto' COMMENT 'auto/manual/replan',

    -- 输入统计
    total_orders INT DEFAULT 0 COMMENT '总订单数',
    total_lines INT DEFAULT 0 COMMENT '总产线数',
    total_workers INT DEFAULT 0 COMMENT '总人员数',

    -- 输出统计
    scheduled_orders INT DEFAULT 0 COMMENT '已排程订单',
    unscheduled_orders INT DEFAULT 0 COMMENT '未排程订单',
    created_tasks INT DEFAULT 0 COMMENT '生成的任务数',
    total_changeover_minutes INT DEFAULT 0 COMMENT '总换型时间',

    -- 质量指标
    on_time_rate DECIMAL(5,2) DEFAULT 0 COMMENT '准时率%',
    line_utilization DECIMAL(5,2) DEFAULT 0 COMMENT '产线利用率%',
    worker_utilization DECIMAL(5,2) DEFAULT 0 COMMENT '人员利用率%',
    conflict_count INT DEFAULT 0 COMMENT '冲突数',

    -- 执行信息
    elapsed_ms BIGINT DEFAULT 0 COMMENT '执行时间(毫秒)',
    algorithm_version VARCHAR(20) DEFAULT 'v1.0',
    status VARCHAR(20) DEFAULT 'completed' COMMENT 'running/completed/failed',
    message VARCHAR(500),

    -- 元数据
    is_simulated TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_schedule_batch (schedule_batch_no),
    INDEX idx_schedule_date (schedule_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APS排程结果';
