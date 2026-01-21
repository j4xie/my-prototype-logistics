-- 配送调度系统 V4.0 数据库表
-- 用于订单-车辆调度优化

-- 配送订单表
CREATE TABLE IF NOT EXISTS delivery_order (
    id VARCHAR(32) PRIMARY KEY COMMENT '主键ID',
    order_id VARCHAR(32) COMMENT '关联OrderInfo',
    customer_id VARCHAR(32) COMMENT '客户ID',
    delivery_address VARCHAR(500) COMMENT '配送地址',
    latitude DECIMAL(10,7) COMMENT '纬度',
    longitude DECIMAL(10,7) COMMENT '经度',
    district VARCHAR(50) COMMENT '区域',
    expected_start DATETIME COMMENT '期望最早配送时间',
    expected_end DATETIME COMMENT '期望最晚配送时间',
    priority INT DEFAULT 3 COMMENT '优先级 1-5',
    weight DECIMAL(10,2) COMMENT '重量(kg)',
    volume DECIMAL(10,4) COMMENT '体积(m³)',
    item_count INT COMMENT '商品件数',
    requires_cold TINYINT DEFAULT 0 COMMENT '是否需要冷链',
    vehicle_id VARCHAR(32) COMMENT '分配的车辆',
    sequence_in_route INT COMMENT '在路线中的顺序',
    scheduled_time DATETIME COMMENT '计划配送时间',
    actual_start_time DATETIME COMMENT '实际开始时间',
    actual_end_time DATETIME COMMENT '实际完成时间',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending/scheduled/delivering/completed/failed',
    is_simulated TINYINT DEFAULT 0 COMMENT '是否模拟数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_vehicle (vehicle_id),
    INDEX idx_scheduled (scheduled_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送订单表';

-- 配送车辆表
CREATE TABLE IF NOT EXISTS delivery_vehicle (
    id VARCHAR(32) PRIMARY KEY COMMENT '主键ID',
    plate_number VARCHAR(20) COMMENT '车牌号',
    vehicle_type VARCHAR(20) COMMENT '车辆类型: small/medium/large/cold_chain',
    max_weight DECIMAL(10,2) COMMENT '最大载重(kg)',
    max_volume DECIMAL(10,4) COMMENT '最大容积(m³)',
    driver_id VARCHAR(32) COMMENT '司机ID',
    driver_name VARCHAR(50) COMMENT '司机姓名',
    driver_phone VARCHAR(20) COMMENT '司机电话',
    driver_experience_years INT DEFAULT 0 COMMENT '驾龄(年)',
    driver_rating DECIMAL(3,2) DEFAULT 5.00 COMMENT '司机评分',
    current_lat DECIMAL(10,7) COMMENT '当前纬度',
    current_lng DECIMAL(10,7) COMMENT '当前经度',
    current_load_weight DECIMAL(10,2) DEFAULT 0 COMMENT '当前装载重量',
    current_load_volume DECIMAL(10,4) DEFAULT 0 COMMENT '当前装载体积',
    daily_order_count INT DEFAULT 0 COMMENT '今日单量',
    on_time_rate DECIMAL(5,4) DEFAULT 0.9000 COMMENT '准时率',
    status VARCHAR(20) DEFAULT 'available' COMMENT '状态: available/busy/offline/maintenance',
    is_simulated TINYINT DEFAULT 0 COMMENT '是否模拟数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_type (vehicle_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送车辆表';

-- 配送路线表
CREATE TABLE IF NOT EXISTS delivery_route (
    id VARCHAR(32) PRIMARY KEY COMMENT '主键ID',
    vehicle_id VARCHAR(32) COMMENT '车辆ID',
    route_date DATE COMMENT '路线日期',
    total_orders INT DEFAULT 0 COMMENT '订单总数',
    total_distance DECIMAL(10,2) COMMENT '总里程(km)',
    estimated_duration INT COMMENT '预计时长(分钟)',
    actual_duration INT COMMENT '实际时长(分钟)',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '结束时间',
    route_sequence TEXT COMMENT '路线序列JSON',
    status VARCHAR(20) DEFAULT 'planned' COMMENT '状态: planned/in_progress/completed/cancelled',
    is_simulated TINYINT DEFAULT 0 COMMENT '是否模拟数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vehicle (vehicle_id),
    INDEX idx_date (route_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送路线表';

-- 配送反馈表 (用于模型训练)
CREATE TABLE IF NOT EXISTS delivery_feedback (
    id VARCHAR(32) PRIMARY KEY COMMENT '主键ID',
    order_id VARCHAR(32) COMMENT '订单ID',
    vehicle_id VARCHAR(32) COMMENT '车辆ID',
    predicted_duration INT COMMENT '预测时长(分钟)',
    actual_duration INT COMMENT '实际时长(分钟)',
    is_on_time TINYINT COMMENT '是否准时',
    delay_minutes INT DEFAULT 0 COMMENT '延误分钟数',
    delay_reason VARCHAR(100) COMMENT '延误原因',
    customer_rating INT COMMENT '客户评分1-5',
    distance_km DECIMAL(10,2) COMMENT '配送距离(km)',
    weather_condition VARCHAR(20) COMMENT '天气情况',
    traffic_level VARCHAR(20) COMMENT '交通状况',
    is_simulated TINYINT DEFAULT 0 COMMENT '是否模拟数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order (order_id),
    INDEX idx_vehicle (vehicle_id),
    INDEX idx_on_time (is_on_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送反馈表';
