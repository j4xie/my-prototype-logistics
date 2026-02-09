-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_31_5__unit_of_measurements.sql
-- Conversion date: 2026-01-26 18:46:43
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- V2025_12_31_3__unit_of_measurements.sql
-- 计量单位配置表
-- ============================================================

-- 创建计量单位表
CREATE TABLE IF NOT EXISTS unit_of_measurements (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL DEFAULT '*' COMMENT '工厂ID (*表示全局配置)',
    unit_code VARCHAR(20) NOT NULL COMMENT '单位代码 (kg, g, ton)',
    unit_name VARCHAR(100) NOT NULL COMMENT '单位名称 (公斤, 克, 吨)',
    unit_symbol VARCHAR(20) COMMENT '单位符号 (kg, g, t)',
    base_unit VARCHAR(20) NOT NULL COMMENT '基础单位 (同分类的换算基准)',
    conversion_factor DECIMAL(15, 6) DEFAULT 1.000000 COMMENT '转换系数 (相对于基础单位)',
    category VARCHAR(50) COMMENT '分类 (WEIGHT, VOLUME, COUNT, LENGTH, TEMPERATURE)',
    decimal_places INT DEFAULT 2 COMMENT '小数位数',
    is_base_unit BOOLEAN DEFAULT FALSE COMMENT '是否为基础单位',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    is_system BOOLEAN DEFAULT TRUE COMMENT '是否为系统内置',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    UNIQUE KEY uk_factory_unit (factory_id, unit_code),
    INDEX idx_unit_factory (factory_id),
    INDEX idx_unit_category (category),
    INDEX idx_unit_is_active (is_active)
);

-- ============================================================
-- 初始化全局计量单位数据
-- ============================================================

-- 重量类 (基础单位: kg)
INSERT INTO unit_of_measurements (id, factory_id, unit_code, unit_name, unit_symbol, base_unit, conversion_factor, category, decimal_places, is_base_unit, is_system, sort_order)
VALUES
    (UUID(), '*', 'kg', '公斤', 'kg', 'kg', 1.000000, 'WEIGHT', 2, TRUE, TRUE, 1),
    (UUID(), '*', 'g', '克', 'g', 'kg', 0.001000, 'WEIGHT', 0, FALSE, TRUE, 2),
    (UUID(), '*', 'mg', '毫克', 'mg', 'kg', 0.000001, 'WEIGHT', 0, FALSE, TRUE, 3),
    (UUID(), '*', 'ton', '吨', 't', 'kg', 1000.000000, 'WEIGHT', 3, FALSE, TRUE, 4),
    (UUID(), '*', 'jin', '斤', '斤', 'kg', 0.500000, 'WEIGHT', 2, FALSE, TRUE, 5),
    (UUID(), '*', 'liang', '两', '两', 'kg', 0.050000, 'WEIGHT', 2, FALSE, TRUE, 6);

-- 体积类 (基础单位: L)
INSERT INTO unit_of_measurements (id, factory_id, unit_code, unit_name, unit_symbol, base_unit, conversion_factor, category, decimal_places, is_base_unit, is_system, sort_order)
VALUES
    (UUID(), '*', 'L', '升', 'L', 'L', 1.000000, 'VOLUME', 2, TRUE, TRUE, 1),
    (UUID(), '*', 'mL', '毫升', 'mL', 'L', 0.001000, 'VOLUME', 0, FALSE, TRUE, 2),
    (UUID(), '*', 'm3', '立方米', 'm³', 'L', 1000.000000, 'VOLUME', 3, FALSE, TRUE, 3);

-- 数量类 (基础单位: pcs)
INSERT INTO unit_of_measurements (id, factory_id, unit_code, unit_name, unit_symbol, base_unit, conversion_factor, category, decimal_places, is_base_unit, is_system, sort_order)
VALUES
    (UUID(), '*', 'pcs', '件', '件', 'pcs', 1.000000, 'COUNT', 0, TRUE, TRUE, 1),
    (UUID(), '*', 'box', '箱', '箱', 'pcs', 1.000000, 'COUNT', 0, FALSE, TRUE, 2),
    (UUID(), '*', 'bag', '袋', '袋', 'pcs', 1.000000, 'COUNT', 0, FALSE, TRUE, 3),
    (UUID(), '*', 'pack', '包', '包', 'pcs', 1.000000, 'COUNT', 0, FALSE, TRUE, 4),
    (UUID(), '*', 'bottle', '瓶', '瓶', 'pcs', 1.000000, 'COUNT', 0, FALSE, TRUE, 5),
    (UUID(), '*', 'can', '罐', '罐', 'pcs', 1.000000, 'COUNT', 0, FALSE, TRUE, 6),
    (UUID(), '*', 'tray', '托盘', '托', 'pcs', 1.000000, 'COUNT', 0, FALSE, TRUE, 7),
    (UUID(), '*', 'plate', '板', '板', 'pcs', 1.000000, 'COUNT', 0, FALSE, TRUE, 8);

-- 长度类 (基础单位: m)
INSERT INTO unit_of_measurements (id, factory_id, unit_code, unit_name, unit_symbol, base_unit, conversion_factor, category, decimal_places, is_base_unit, is_system, sort_order)
VALUES
    (UUID(), '*', 'm', '米', 'm', 'm', 1.000000, 'LENGTH', 2, TRUE, TRUE, 1),
    (UUID(), '*', 'cm', '厘米', 'cm', 'm', 0.010000, 'LENGTH', 1, FALSE, TRUE, 2),
    (UUID(), '*', 'mm', '毫米', 'mm', 'm', 0.001000, 'LENGTH', 0, FALSE, TRUE, 3);

-- 温度类 (基础单位: celsius)
INSERT INTO unit_of_measurements (id, factory_id, unit_code, unit_name, unit_symbol, base_unit, conversion_factor, category, decimal_places, is_base_unit, is_system, sort_order)
VALUES
    (UUID(), '*', 'celsius', '摄氏度', '℃', 'celsius', 1.000000, 'TEMPERATURE', 1, TRUE, TRUE, 1),
    (UUID(), '*', 'fahrenheit', '华氏度', '℉', 'celsius', 1.000000, 'TEMPERATURE', 1, FALSE, TRUE, 2);

-- 时间类 (基础单位: minute)
INSERT INTO unit_of_measurements (id, factory_id, unit_code, unit_name, unit_symbol, base_unit, conversion_factor, category, decimal_places, is_base_unit, is_system, sort_order)
VALUES
    (UUID(), '*', 'minute', '分钟', 'min', 'minute', 1.000000, 'TIME', 0, TRUE, TRUE, 1),
    (UUID(), '*', 'hour', '小时', 'h', 'minute', 60.000000, 'TIME', 1, FALSE, TRUE, 2),
    (UUID(), '*', 'day', '天', 'd', 'minute', 1440.000000, 'TIME', 0, FALSE, TRUE, 3),
    (UUID(), '*', 'second', '秒', 's', 'minute', 0.016667, 'TIME', 0, FALSE, TRUE, 4);

-- 百分比类 (基础单位: percent)
INSERT INTO unit_of_measurements (id, factory_id, unit_code, unit_name, unit_symbol, base_unit, conversion_factor, category, decimal_places, is_base_unit, is_system, sort_order)
VALUES
    (UUID(), '*', 'percent', '百分比', '%', 'percent', 1.000000, 'RATIO', 2, TRUE, TRUE, 1),
    (UUID(), '*', 'permille', '千分比', '‰', 'percent', 0.100000, 'RATIO', 3, FALSE, TRUE, 2);
