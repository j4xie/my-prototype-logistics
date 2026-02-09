-- ============================================================
-- Phase C: 紧急插单完整流程 - 工厂产能配置与时段锁定表
-- 创建日期: 2025-12-30
-- 描述: 创建工厂产能配置表和插单时段锁定表
-- ============================================================

-- -----------------------------------------------------
-- Table: factory_capacity_configs
-- 工厂产能配置表 - 存储各工厂的产能和工作参数
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS factory_capacity_configs (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

    -- 产能配置
    daily_capacity DECIMAL(12,2) NOT NULL DEFAULT 5000.00 COMMENT '日产能 (kg)',
    hourly_capacity DECIMAL(12,2) NOT NULL DEFAULT 500.00 COMMENT '时产能 (kg)',
    max_batch_size DECIMAL(12,2) NULL COMMENT '单批次最大产量 (kg)',
    min_batch_size DECIMAL(12,2) NULL COMMENT '单批次最小产量 (kg)',

    -- 工人配置
    standard_shift_workers INT NOT NULL DEFAULT 6 COMMENT '标准班次工人数',
    max_workers INT NOT NULL DEFAULT 10 COMMENT '最大工人数',
    min_workers INT NOT NULL DEFAULT 3 COMMENT '最小工人数',
    workers_per_line INT NULL DEFAULT 3 COMMENT '每条产线工人数',

    -- 换线配置
    switch_cost_minutes INT NOT NULL DEFAULT 30 COMMENT '标准换线时间 (分钟)',
    material_switch_cost_minutes INT NOT NULL DEFAULT 15 COMMENT '同材料换线时间 (分钟)',
    cleaning_time_minutes INT NULL DEFAULT 20 COMMENT '清洁消毒时间 (分钟)',

    -- 工作时间配置
    work_start_time TIME NOT NULL DEFAULT '08:00:00' COMMENT '工作开始时间',
    work_end_time TIME NOT NULL DEFAULT '18:00:00' COMMENT '工作结束时间',
    lunch_break_start TIME NULL DEFAULT '12:00:00' COMMENT '午休开始时间',
    lunch_break_end TIME NULL DEFAULT '13:00:00' COMMENT '午休结束时间',

    -- 加班配置
    allow_overtime TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否允许加班',
    max_overtime_hours DECIMAL(4,2) NULL DEFAULT 4.00 COMMENT '最大加班时长 (小时)',
    overtime_capacity_rate DECIMAL(4,2) NULL DEFAULT 0.80 COMMENT '加班产能效率 (0-1)',

    -- 设备配置
    production_line_count INT NULL DEFAULT 1 COMMENT '产线数量',
    parallel_batch_limit INT NULL DEFAULT 2 COMMENT '同时进行批次上限',

    -- 安全库存配置
    material_buffer_rate DECIMAL(4,2) NULL DEFAULT 0.10 COMMENT '原料缓冲率 (10%)',
    capacity_buffer_rate DECIMAL(4,2) NULL DEFAULT 0.05 COMMENT '产能缓冲率 (5%)',

    -- 元数据
    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
    effective_from DATE NULL COMMENT '生效开始日期',
    effective_until DATE NULL COMMENT '生效结束日期',
    notes TEXT NULL COMMENT '备注',

    -- 审计字段
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT NULL COMMENT '创建人ID',
    updated_by BIGINT NULL COMMENT '更新人ID',

    -- 唯一约束
    UNIQUE KEY uk_factory_active (factory_id, is_active, effective_from),

    -- 索引
    INDEX idx_factory_id (factory_id),
    INDEX idx_is_active (is_active),
    INDEX idx_effective_dates (effective_from, effective_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='工厂产能配置表';


-- -----------------------------------------------------
-- Table: insert_slot_locks
-- 插单时段锁定表 - 防止多用户同时操作同一时段
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS insert_slot_locks (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    slot_id VARCHAR(36) NOT NULL COMMENT '时段ID',

    -- 时段信息
    start_time DATETIME NOT NULL COMMENT '时段开始时间',
    end_time DATETIME NOT NULL COMMENT '时段结束时间',

    -- 锁定信息
    locked_by BIGINT NOT NULL COMMENT '锁定用户ID',
    locked_by_username VARCHAR(100) NULL COMMENT '锁定用户名',
    locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '锁定时间',
    expire_at DATETIME NOT NULL COMMENT '锁定过期时间',

    -- 锁定原因/用途
    lock_purpose VARCHAR(50) NULL DEFAULT 'URGENT_INSERT' COMMENT '锁定用途: URGENT_INSERT/PREVIEW/EDITING',

    -- 元数据
    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否有效',
    released_at DATETIME NULL COMMENT '释放时间',
    released_reason VARCHAR(100) NULL COMMENT '释放原因',

    -- 审计字段
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- 索引
    INDEX idx_factory_slot (factory_id, slot_id),
    INDEX idx_locked_by (locked_by),
    INDEX idx_expire_at (expire_at),
    INDEX idx_is_active (is_active),
    INDEX idx_factory_time (factory_id, start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='插单时段锁定表';


-- -----------------------------------------------------
-- 插入默认工厂配置 (如果没有)
-- -----------------------------------------------------
INSERT INTO factory_capacity_configs (
    id, factory_id,
    daily_capacity, hourly_capacity,
    standard_shift_workers, max_workers, min_workers,
    switch_cost_minutes, material_switch_cost_minutes,
    work_start_time, work_end_time,
    allow_overtime, max_overtime_hours,
    production_line_count, parallel_batch_limit,
    is_active, notes, created_at
)
SELECT
    UUID(), 'F001',
    5000.00, 500.00,
    6, 10, 3,
    30, 15,
    '08:00:00', '18:00:00',
    1, 4.00,
    2, 3,
    1, '默认工厂产能配置 (自动创建)', NOW()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM factory_capacity_configs WHERE factory_id = 'F001' AND is_active = 1
);


-- -----------------------------------------------------
-- 创建定时清理过期锁定的事件 (可选)
-- -----------------------------------------------------
-- 注意: 需要在MySQL中启用事件调度器
-- SET GLOBAL event_scheduler = ON;

DELIMITER $$

DROP EVENT IF EXISTS cleanup_expired_slot_locks$$

CREATE EVENT IF NOT EXISTS cleanup_expired_slot_locks
ON SCHEDULE EVERY 1 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    UPDATE insert_slot_locks
    SET
        is_active = 0,
        released_at = NOW(),
        released_reason = 'AUTO_EXPIRED'
    WHERE
        is_active = 1
        AND expire_at < NOW();
END$$

DELIMITER ;


-- ============================================================
-- 验证脚本
-- ============================================================
-- SELECT * FROM factory_capacity_configs WHERE factory_id = 'F001';
-- SELECT * FROM insert_slot_locks WHERE is_active = 1;
