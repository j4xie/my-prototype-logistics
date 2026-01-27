-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_03_1__add_vehicles_table.sql
-- Conversion date: 2026-01-26 18:46:58
-- WARNING: This file requires manual review!
-- ============================================

-- 车辆管理表
-- 用于仓库装车管理

CREATE TABLE IF NOT EXISTS vehicles (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(36) NOT NULL,
    plate_number VARCHAR(20) NOT NULL COMMENT '车牌号',
    driver_name VARCHAR(50) COMMENT '司机姓名',
    driver_phone VARCHAR(20) COMMENT '司机电话',
    capacity DECIMAL(10, 2) COMMENT '车辆载重容量(kg)',
    current_load DECIMAL(10, 2) DEFAULT 0 COMMENT '当前装载量(kg)',
    status VARCHAR(20) DEFAULT 'available' COMMENT '状态: available/loading/dispatched/maintenance',
    vehicle_type VARCHAR(50) COMMENT '车辆类型',
    notes TEXT COMMENT '备注',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    INDEX idx_vehicles_factory (factory_id),
    INDEX idx_vehicles_status (factory_id, status),
    INDEX idx_vehicles_plate (factory_id, plate_number),
    UNIQUE KEY uk_vehicles_plate (factory_id, plate_number, deleted_at)
);

-- 插入测试数据
INSERT INTO vehicles (id, factory_id, plate_number, driver_name, driver_phone, capacity, current_load, status, vehicle_type)
VALUES
    (UUID(), 'F001', '沪A12345', '张师傅', '13800138001', 5000.00, 0.00, 'available', '冷藏车'),
    (UUID(), 'F001', '沪B67890', '李师傅', '13800138002', 8000.00, 0.00, 'available', '普通货车'),
    (UUID(), 'F001', '沪C11111', '王师傅', '13800138003', 3000.00, 1500.00, 'loading', '冷藏车'),
    (UUID(), 'F001', '沪D22222', '赵师傅', '13800138004', 10000.00, 8500.00, 'dispatched', '重型货车');
