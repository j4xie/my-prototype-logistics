-- SmartBI 采购数据表
-- Version: 1.0
-- Date: 2026-01-19
-- Description: 存储采购相关数据，支持采购分析、供应商评估等功能

-- ============================================
-- 1. 采购数据主表
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_purchase_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    order_date DATE NOT NULL COMMENT '采购日期',
    order_no VARCHAR(100) COMMENT '采购单号',
    supplier_id BIGINT COMMENT '供应商ID',
    supplier_name VARCHAR(200) COMMENT '供应商名称',
    supplier_type VARCHAR(50) COMMENT '供应商类型: A级/B级/C级',
    material_id VARCHAR(100) COMMENT '物料ID',
    material_name VARCHAR(200) COMMENT '物料名称',
    material_type VARCHAR(100) COMMENT '物料类型',
    quantity DECIMAL(10,2) COMMENT '采购数量',
    unit VARCHAR(20) COMMENT '单位',
    unit_price DECIMAL(10,2) COMMENT '单价',
    amount DECIMAL(15,2) COMMENT '采购金额',
    expected_date DATE COMMENT '预计到货日期',
    actual_date DATE COMMENT '实际到货日期',
    delivery_days INT COMMENT '交货天数',
    quality_status VARCHAR(20) COMMENT '质检状态: PASS/FAIL/PENDING',
    quality_score DECIMAL(5,2) COMMENT '质量评分',
    pass_quantity DECIMAL(10,2) COMMENT '合格数量',
    reject_quantity DECIMAL(10,2) COMMENT '不合格数量',
    payment_status VARCHAR(20) DEFAULT 'PENDING' COMMENT '付款状态: PENDING/PARTIAL/PAID',
    payment_amount DECIMAL(15,2) DEFAULT 0 COMMENT '已付金额',
    remarks TEXT COMMENT '备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_factory_date (factory_id, order_date),
    INDEX idx_supplier (supplier_id),
    INDEX idx_supplier_name (factory_id, supplier_name),
    INDEX idx_material_type (factory_id, material_type),
    INDEX idx_quality_status (factory_id, quality_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI采购数据';

-- ============================================
-- 2. 供应商主数据表
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_supplier (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    supplier_code VARCHAR(50) COMMENT '供应商编码',
    supplier_name VARCHAR(200) NOT NULL COMMENT '供应商名称',
    supplier_type VARCHAR(50) COMMENT '供应商类型: A级/B级/C级',
    contact_person VARCHAR(100) COMMENT '联系人',
    contact_phone VARCHAR(50) COMMENT '联系电话',
    address VARCHAR(500) COMMENT '地址',
    province VARCHAR(50) COMMENT '省份',
    city VARCHAR(50) COMMENT '城市',
    payment_terms INT DEFAULT 30 COMMENT '账期(天)',
    credit_limit DECIMAL(15,2) COMMENT '信用额度',
    rating_score DECIMAL(5,2) DEFAULT 0 COMMENT '综合评分',
    delivery_rating DECIMAL(5,2) DEFAULT 0 COMMENT '交付评分',
    quality_rating DECIMAL(5,2) DEFAULT 0 COMMENT '质量评分',
    price_rating DECIMAL(5,2) DEFAULT 0 COMMENT '价格评分',
    service_rating DECIMAL(5,2) DEFAULT 0 COMMENT '服务评分',
    total_orders INT DEFAULT 0 COMMENT '总订单数',
    total_amount DECIMAL(15,2) DEFAULT 0 COMMENT '总采购金额',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY uk_factory_code (factory_id, supplier_code),
    INDEX idx_factory_type (factory_id, supplier_type),
    INDEX idx_rating (factory_id, rating_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI供应商主数据';

-- ============================================
-- 3. 采购价格历史表
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_purchase_price_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    supplier_id BIGINT NOT NULL COMMENT '供应商ID',
    material_id VARCHAR(100) NOT NULL COMMENT '物料ID',
    material_name VARCHAR(200) COMMENT '物料名称',
    effective_date DATE NOT NULL COMMENT '生效日期',
    unit_price DECIMAL(10,2) NOT NULL COMMENT '单价',
    currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',
    min_quantity DECIMAL(10,2) COMMENT '最小起订量',
    remarks VARCHAR(500) COMMENT '备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factory_material (factory_id, material_id),
    INDEX idx_supplier_material (supplier_id, material_id),
    INDEX idx_effective_date (effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI采购价格历史';

-- ============================================
-- 4. 插入示例供应商数据
-- ============================================
INSERT INTO smart_bi_supplier (factory_id, supplier_code, supplier_name, supplier_type, contact_person, contact_phone, province, city, payment_terms, credit_limit, rating_score, delivery_rating, quality_rating, price_rating, service_rating, total_orders, total_amount) VALUES
('DEMO_FACTORY', 'SUP001', '东北大米供应商', 'A级', '张经理', '13800138001', '黑龙江', '哈尔滨市', 30, 500000.00, 92.5, 95.0, 93.0, 88.0, 94.0, 156, 2350000.00),
('DEMO_FACTORY', 'SUP002', '福建茶叶公司', 'A级', '李总', '13800138002', '福建', '福州市', 45, 300000.00, 90.0, 88.0, 95.0, 85.0, 92.0, 89, 1280000.00),
('DEMO_FACTORY', 'SUP003', '澳洲牛肉进口商', 'A级', 'Michael', '13800138003', '上海', '上海市', 60, 800000.00, 88.5, 85.0, 92.0, 82.0, 95.0, 45, 3650000.00),
('DEMO_FACTORY', 'SUP004', '舟山海鲜批发', 'B级', '王老板', '13800138004', '浙江', '舟山市', 15, 200000.00, 85.0, 90.0, 88.0, 80.0, 82.0, 234, 980000.00),
('DEMO_FACTORY', 'SUP005', '四川调味品厂', 'B级', '刘厂长', '13800138005', '四川', '成都市', 30, 150000.00, 82.0, 80.0, 85.0, 88.0, 75.0, 167, 560000.00),
('DEMO_FACTORY', 'SUP006', '江西糯米加工厂', 'B级', '陈主任', '13800138006', '江西', '南昌市', 30, 100000.00, 78.5, 75.0, 80.0, 85.0, 74.0, 98, 320000.00),
('DEMO_FACTORY', 'SUP007', '山东蔬菜基地', 'C级', '赵经理', '13800138007', '山东', '寿光市', 15, 80000.00, 72.0, 70.0, 75.0, 78.0, 65.0, 56, 180000.00),
('DEMO_FACTORY', 'SUP008', '云南菌菇合作社', 'C级', '杨社长', '13800138008', '云南', '昆明市', 7, 50000.00, 68.0, 65.0, 72.0, 70.0, 65.0, 34, 95000.00);

-- ============================================
-- 5. 插入示例采购数据 (2025年11月 - 2026年1月)
-- ============================================
INSERT INTO smart_bi_purchase_data (factory_id, order_date, order_no, supplier_id, supplier_name, supplier_type, material_name, material_type, quantity, unit, unit_price, amount, expected_date, actual_date, delivery_days, quality_status, quality_score, pass_quantity, reject_quantity, payment_status, payment_amount) VALUES
-- 2025年11月采购
('DEMO_FACTORY', '2025-11-01', 'PO202511001', 1, '东北大米供应商', 'A级', '有机大米', '粮油', 5000.00, 'kg', 8.50, 42500.00, '2025-11-05', '2025-11-04', -1, 'PASS', 95.0, 4980.00, 20.00, 'PAID', 42500.00),
('DEMO_FACTORY', '2025-11-03', 'PO202511002', 2, '福建茶叶公司', 'A级', '特级铁观音', '茶饮', 200.00, 'kg', 280.00, 56000.00, '2025-11-08', '2025-11-07', -1, 'PASS', 98.0, 200.00, 0.00, 'PAID', 56000.00),
('DEMO_FACTORY', '2025-11-05', 'PO202511003', 3, '澳洲牛肉进口商', 'A级', '进口牛腱', '肉类', 1000.00, 'kg', 120.00, 120000.00, '2025-11-15', '2025-11-14', -1, 'PASS', 92.0, 985.00, 15.00, 'PAID', 120000.00),
('DEMO_FACTORY', '2025-11-08', 'PO202511004', 4, '舟山海鲜批发', 'B级', '深海鱼类', '海鲜', 800.00, 'kg', 85.00, 68000.00, '2025-11-10', '2025-11-10', 0, 'PASS', 88.0, 780.00, 20.00, 'PAID', 68000.00),
('DEMO_FACTORY', '2025-11-10', 'PO202511005', 5, '四川调味品厂', 'B级', '郫县豆瓣酱', '调味品', 500.00, 'kg', 25.00, 12500.00, '2025-11-15', '2025-11-16', 1, 'PASS', 85.0, 495.00, 5.00, 'PAID', 12500.00),
('DEMO_FACTORY', '2025-11-12', 'PO202511006', 6, '江西糯米加工厂', 'B级', '糯米', '粮油', 2000.00, 'kg', 6.00, 12000.00, '2025-11-17', '2025-11-18', 1, 'PASS', 82.0, 1960.00, 40.00, 'PAID', 12000.00),
('DEMO_FACTORY', '2025-11-15', 'PO202511007', 7, '山东蔬菜基地', 'C级', '有机蔬菜', '蔬菜', 1500.00, 'kg', 12.00, 18000.00, '2025-11-17', '2025-11-19', 2, 'PASS', 75.0, 1425.00, 75.00, 'PAID', 18000.00),
('DEMO_FACTORY', '2025-11-18', 'PO202511008', 8, '云南菌菇合作社', 'C级', '野生菌菇', '蔬菜', 300.00, 'kg', 95.00, 28500.00, '2025-11-22', '2025-11-25', 3, 'FAIL', 65.0, 250.00, 50.00, 'PARTIAL', 20000.00),

-- 2025年12月采购
('DEMO_FACTORY', '2025-12-01', 'PO202512001', 1, '东北大米供应商', 'A级', '有机大米', '粮油', 6000.00, 'kg', 8.50, 51000.00, '2025-12-05', '2025-12-04', -1, 'PASS', 96.0, 5970.00, 30.00, 'PAID', 51000.00),
('DEMO_FACTORY', '2025-12-03', 'PO202512002', 2, '福建茶叶公司', 'A级', '特级龙井', '茶饮', 150.00, 'kg', 350.00, 52500.00, '2025-12-08', '2025-12-07', -1, 'PASS', 97.0, 150.00, 0.00, 'PAID', 52500.00),
('DEMO_FACTORY', '2025-12-05', 'PO202512003', 3, '澳洲牛肉进口商', 'A级', '进口牛排', '肉类', 800.00, 'kg', 150.00, 120000.00, '2025-12-15', '2025-12-16', 1, 'PASS', 90.0, 788.00, 12.00, 'PAID', 120000.00),
('DEMO_FACTORY', '2025-12-08', 'PO202512004', 4, '舟山海鲜批发', 'B级', '大闸蟹', '海鲜', 500.00, 'kg', 180.00, 90000.00, '2025-12-10', '2025-12-11', 1, 'PASS', 86.0, 475.00, 25.00, 'PAID', 90000.00),
('DEMO_FACTORY', '2025-12-10', 'PO202512005', 5, '四川调味品厂', 'B级', '火锅底料', '调味品', 800.00, 'kg', 35.00, 28000.00, '2025-12-15', '2025-12-17', 2, 'PASS', 83.0, 784.00, 16.00, 'PAID', 28000.00),
('DEMO_FACTORY', '2025-12-12', 'PO202512006', 6, '江西糯米加工厂', 'B级', '糯米粉', '粮油', 1500.00, 'kg', 8.00, 12000.00, '2025-12-17', '2025-12-19', 2, 'PASS', 80.0, 1455.00, 45.00, 'PAID', 12000.00),
('DEMO_FACTORY', '2025-12-15', 'PO202512007', 7, '山东蔬菜基地', 'C级', '冬季蔬菜', '蔬菜', 2000.00, 'kg', 15.00, 30000.00, '2025-12-18', '2025-12-21', 3, 'PASS', 72.0, 1860.00, 140.00, 'PAID', 30000.00),
('DEMO_FACTORY', '2025-12-18', 'PO202512008', 8, '云南菌菇合作社', 'C级', '松茸', '蔬菜', 100.00, 'kg', 450.00, 45000.00, '2025-12-23', '2025-12-28', 5, 'PENDING', NULL, NULL, NULL, 'PENDING', 0.00),

-- 2026年1月采购
('DEMO_FACTORY', '2026-01-02', 'PO202601001', 1, '东北大米供应商', 'A级', '有机大米', '粮油', 5500.00, 'kg', 8.80, 48400.00, '2026-01-06', '2026-01-05', -1, 'PASS', 94.0, 5450.00, 50.00, 'PARTIAL', 30000.00),
('DEMO_FACTORY', '2026-01-03', 'PO202601002', 2, '福建茶叶公司', 'A级', '白茶', '茶饮', 100.00, 'kg', 420.00, 42000.00, '2026-01-08', '2026-01-08', 0, 'PASS', 99.0, 100.00, 0.00, 'PENDING', 0.00),
('DEMO_FACTORY', '2026-01-05', 'PO202601003', 3, '澳洲牛肉进口商', 'A级', '和牛', '肉类', 500.00, 'kg', 280.00, 140000.00, '2026-01-15', '2026-01-14', -1, 'PASS', 95.0, 498.00, 2.00, 'PENDING', 0.00),
('DEMO_FACTORY', '2026-01-08', 'PO202601004', 4, '舟山海鲜批发', 'B级', '鲍鱼', '海鲜', 200.00, 'kg', 320.00, 64000.00, '2026-01-10', '2026-01-12', 2, 'PASS', 85.0, 192.00, 8.00, 'PENDING', 0.00),
('DEMO_FACTORY', '2026-01-10', 'PO202601005', 5, '四川调味品厂', 'B级', '花椒', '调味品', 300.00, 'kg', 65.00, 19500.00, '2026-01-15', '2026-01-16', 1, 'PASS', 87.0, 294.00, 6.00, 'PENDING', 0.00),
('DEMO_FACTORY', '2026-01-12', 'PO202601006', 6, '江西糯米加工厂', 'B级', '年糕专用粉', '粮油', 3000.00, 'kg', 7.50, 22500.00, '2026-01-16', NULL, NULL, 'PENDING', NULL, NULL, NULL, 'PENDING', 0.00),
('DEMO_FACTORY', '2026-01-15', 'PO202601007', 7, '山东蔬菜基地', 'C级', '大白菜', '蔬菜', 2500.00, 'kg', 8.00, 20000.00, '2026-01-18', NULL, NULL, 'PENDING', NULL, NULL, NULL, 'PENDING', 0.00),
('DEMO_FACTORY', '2026-01-16', 'PO202601008', 8, '云南菌菇合作社', 'C级', '黑松露', '蔬菜', 50.00, 'kg', 800.00, 40000.00, '2026-01-22', NULL, NULL, 'PENDING', NULL, NULL, NULL, 'PENDING', 0.00);
