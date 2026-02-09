-- SmartBI 生产与质量数据表
-- Version: 1.0
-- Date: 2026-01-19
-- Description: 存储OEE、生产效率、质量数据，支持生产分析功能

-- ============================================
-- 1. 生产数据主表 (OEE & 效率)
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_production_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    production_date DATE NOT NULL COMMENT '生产日期',
    shift VARCHAR(20) COMMENT '班次: MORNING/AFTERNOON/NIGHT',
    workshop VARCHAR(100) COMMENT '车间',
    production_line VARCHAR(100) COMMENT '产线',
    equipment_id VARCHAR(100) COMMENT '设备ID',
    equipment_name VARCHAR(200) COMMENT '设备名称',
    product_id VARCHAR(100) COMMENT '产品ID',
    product_name VARCHAR(200) COMMENT '产品名称',

    -- OEE 相关指标
    planned_time DECIMAL(10,2) COMMENT '计划运行时间(分钟)',
    actual_time DECIMAL(10,2) COMMENT '实际运行时间(分钟)',
    downtime DECIMAL(10,2) COMMENT '停机时间(分钟)',
    downtime_reason VARCHAR(500) COMMENT '停机原因',
    availability DECIMAL(5,4) COMMENT '可用率 (实际/计划)',

    -- 性能效率
    standard_cycle DECIMAL(10,4) COMMENT '标准节拍(分钟/件)',
    actual_output INT COMMENT '实际产出数量',
    theoretical_output INT COMMENT '理论产出数量',
    performance DECIMAL(5,4) COMMENT '性能率 (实际/理论)',

    -- 质量率
    qualified_output INT COMMENT '合格品数量',
    defect_output INT COMMENT '不良品数量',
    quality_rate DECIMAL(5,4) COMMENT '质量率 (合格/实际)',

    -- OEE
    oee DECIMAL(5,4) COMMENT 'OEE = 可用率 * 性能率 * 质量率',

    -- 其他
    energy_consumption DECIMAL(10,2) COMMENT '能耗(kWh)',
    operator_count INT COMMENT '操作人员数',
    remarks TEXT COMMENT '备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_factory_date (factory_id, production_date),
    INDEX idx_line (factory_id, production_line),
    INDEX idx_equipment (factory_id, equipment_id),
    INDEX idx_oee (factory_id, oee)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI生产数据';

-- ============================================
-- 2. 质量缺陷数据表
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_quality_defect (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    defect_date DATE NOT NULL COMMENT '发生日期',
    shift VARCHAR(20) COMMENT '班次',
    workshop VARCHAR(100) COMMENT '车间',
    production_line VARCHAR(100) COMMENT '产线',
    product_id VARCHAR(100) COMMENT '产品ID',
    product_name VARCHAR(200) COMMENT '产品名称',
    batch_no VARCHAR(100) COMMENT '批次号',
    defect_type VARCHAR(100) COMMENT '缺陷类型',
    defect_code VARCHAR(50) COMMENT '缺陷代码',
    defect_description TEXT COMMENT '缺陷描述',
    severity ENUM('CRITICAL', 'MAJOR', 'MINOR') COMMENT '严重程度',
    quantity INT COMMENT '缺陷数量',
    unit_cost DECIMAL(10,2) COMMENT '单位成本',
    total_cost DECIMAL(15,2) COMMENT '总损失',
    root_cause VARCHAR(500) COMMENT '根本原因',
    corrective_action VARCHAR(500) COMMENT '纠正措施',
    responsible_person VARCHAR(100) COMMENT '责任人',
    status ENUM('OPEN', 'IN_PROGRESS', 'CLOSED') DEFAULT 'OPEN' COMMENT '状态',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_factory_date (factory_id, defect_date),
    INDEX idx_defect_type (factory_id, defect_type),
    INDEX idx_severity (factory_id, severity),
    INDEX idx_status (factory_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI质量缺陷数据';

-- ============================================
-- 3. 返工与报废数据表
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_rework_scrap (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    record_date DATE NOT NULL COMMENT '记录日期',
    record_type ENUM('REWORK', 'SCRAP') NOT NULL COMMENT '类型: 返工/报废',
    workshop VARCHAR(100) COMMENT '车间',
    production_line VARCHAR(100) COMMENT '产线',
    product_id VARCHAR(100) COMMENT '产品ID',
    product_name VARCHAR(200) COMMENT '产品名称',
    batch_no VARCHAR(100) COMMENT '批次号',
    quantity INT COMMENT '数量',
    material_cost DECIMAL(15,2) COMMENT '材料成本',
    labor_cost DECIMAL(15,2) COMMENT '人工成本',
    overhead_cost DECIMAL(15,2) COMMENT '管理费用',
    total_cost DECIMAL(15,2) COMMENT '总成本',
    reason_code VARCHAR(50) COMMENT '原因代码',
    reason_description TEXT COMMENT '原因描述',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_factory_date (factory_id, record_date),
    INDEX idx_record_type (factory_id, record_type),
    INDEX idx_product (factory_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI返工与报废数据';

-- ============================================
-- 4. 库存健康数据表
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_inventory_health (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    snapshot_date DATE NOT NULL COMMENT '快照日期',
    warehouse VARCHAR(100) COMMENT '仓库',
    location VARCHAR(100) COMMENT '库位',
    material_id VARCHAR(100) COMMENT '物料ID',
    material_name VARCHAR(200) COMMENT '物料名称',
    material_type VARCHAR(100) COMMENT '物料类型',
    batch_no VARCHAR(100) COMMENT '批次号',
    quantity DECIMAL(15,2) COMMENT '库存数量',
    unit VARCHAR(20) COMMENT '单位',
    unit_cost DECIMAL(10,2) COMMENT '单位成本',
    total_value DECIMAL(15,2) COMMENT '库存金额',
    production_date DATE COMMENT '生产日期',
    expiry_date DATE COMMENT '过期日期',
    days_to_expiry INT COMMENT '距过期天数',
    shelf_life_days INT COMMENT '保质期天数',
    status VARCHAR(50) COMMENT '状态: NORMAL/NEAR_EXPIRY/EXPIRED/SLOW_MOVING',
    turnover_days INT COMMENT '周转天数',
    abc_class CHAR(1) COMMENT 'ABC分类',
    min_stock DECIMAL(15,2) COMMENT '最低库存',
    max_stock DECIMAL(15,2) COMMENT '最高库存',
    reorder_point DECIMAL(15,2) COMMENT '再订购点',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_factory_date (factory_id, snapshot_date),
    INDEX idx_material (factory_id, material_id),
    INDEX idx_status (factory_id, status),
    INDEX idx_expiry (factory_id, days_to_expiry)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI库存健康数据';

-- ============================================
-- 5. 插入示例生产数据 (OEE)
-- ============================================
INSERT INTO smart_bi_production_data (factory_id, production_date, shift, workshop, production_line, equipment_id, equipment_name, product_id, product_name, planned_time, actual_time, downtime, downtime_reason, availability, standard_cycle, actual_output, theoretical_output, performance, qualified_output, defect_output, quality_rate, oee, energy_consumption, operator_count) VALUES
-- 2025年11月 - 产线A
('DEMO_FACTORY', '2025-11-01', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P001', '有机大米5kg装', 480.00, 450.00, 30.00, '换线调试', 0.9375, 0.50, 850, 900, 0.9444, 835, 15, 0.9824, 0.8701, 125.5, 3),
('DEMO_FACTORY', '2025-11-01', 'AFTERNOON', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P001', '有机大米5kg装', 480.00, 465.00, 15.00, '设备故障', 0.9688, 0.50, 880, 930, 0.9462, 868, 12, 0.9864, 0.9039, 128.0, 3),
('DEMO_FACTORY', '2025-11-02', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P002', '特级茶叶礼盒', 480.00, 470.00, 10.00, '物料等待', 0.9792, 1.00, 450, 470, 0.9574, 445, 5, 0.9889, 0.9268, 118.5, 3),
('DEMO_FACTORY', '2025-11-05', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P001', '有机大米5kg装', 480.00, 460.00, 20.00, '品质检查', 0.9583, 0.50, 890, 920, 0.9674, 875, 15, 0.9831, 0.9114, 130.2, 3),
('DEMO_FACTORY', '2025-11-10', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P003', '进口牛肉真空包装', 480.00, 440.00, 40.00, '设备维护', 0.9167, 0.80, 520, 550, 0.9455, 510, 10, 0.9808, 0.8493, 145.8, 4),

-- 2025年11月 - 产线B
('DEMO_FACTORY', '2025-11-01', 'MORNING', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P004', '深海鱼类冷冻包装', 480.00, 430.00, 50.00, '冷链故障', 0.8958, 0.60, 680, 717, 0.9484, 660, 20, 0.9706, 0.8246, 155.0, 4),
('DEMO_FACTORY', '2025-11-01', 'AFTERNOON', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P004', '深海鱼类冷冻包装', 480.00, 455.00, 25.00, '换班交接', 0.9479, 0.60, 720, 758, 0.9499, 705, 15, 0.9792, 0.8812, 148.5, 4),
('DEMO_FACTORY', '2025-11-05', 'MORNING', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P005', '调味酱料瓶装', 480.00, 465.00, 15.00, '标签更换', 0.9688, 0.40, 1100, 1163, 0.9458, 1078, 22, 0.9800, 0.8979, 98.5, 3),
('DEMO_FACTORY', '2025-11-10', 'AFTERNOON', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P006', '糯米袋装', 480.00, 470.00, 10.00, '计划停机', 0.9792, 0.35, 1280, 1343, 0.9531, 1260, 20, 0.9844, 0.9189, 105.2, 3),

-- 2025年12月 - 产线A
('DEMO_FACTORY', '2025-12-01', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P001', '有机大米5kg装', 480.00, 468.00, 12.00, '正常运行', 0.9750, 0.50, 920, 936, 0.9829, 908, 12, 0.9870, 0.9462, 132.0, 3),
('DEMO_FACTORY', '2025-12-05', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P002', '特级茶叶礼盒', 480.00, 475.00, 5.00, '正常运行', 0.9896, 1.00, 468, 475, 0.9853, 463, 5, 0.9893, 0.9647, 115.8, 3),
('DEMO_FACTORY', '2025-12-10', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P003', '进口牛肉真空包装', 480.00, 455.00, 25.00, '品质问题排查', 0.9479, 0.80, 545, 569, 0.9578, 532, 13, 0.9761, 0.8859, 150.5, 4),
('DEMO_FACTORY', '2025-12-15', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P001', '有机大米5kg装', 480.00, 472.00, 8.00, '正常运行', 0.9833, 0.50, 935, 944, 0.9905, 925, 10, 0.9893, 0.9636, 128.5, 3),

-- 2025年12月 - 产线B
('DEMO_FACTORY', '2025-12-01', 'MORNING', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P004', '深海鱼类冷冻包装', 480.00, 450.00, 30.00, '冷链调试', 0.9375, 0.60, 710, 750, 0.9467, 695, 15, 0.9789, 0.8696, 160.0, 4),
('DEMO_FACTORY', '2025-12-05', 'AFTERNOON', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P005', '调味酱料瓶装', 480.00, 470.00, 10.00, '正常运行', 0.9792, 0.40, 1150, 1175, 0.9787, 1130, 20, 0.9826, 0.9416, 102.0, 3),
('DEMO_FACTORY', '2025-12-10', 'MORNING', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P006', '糯米袋装', 480.00, 460.00, 20.00, '设备清洁', 0.9583, 0.35, 1260, 1314, 0.9589, 1245, 15, 0.9881, 0.9080, 108.5, 3),

-- 2026年1月 - 产线A
('DEMO_FACTORY', '2026-01-02', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P001', '有机大米5kg装', 480.00, 475.00, 5.00, '正常运行', 0.9896, 0.50, 940, 950, 0.9895, 932, 8, 0.9915, 0.9709, 130.0, 3),
('DEMO_FACTORY', '2026-01-05', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P002', '特级茶叶礼盒', 480.00, 478.00, 2.00, '正常运行', 0.9958, 1.00, 475, 478, 0.9937, 472, 3, 0.9937, 0.9834, 112.5, 3),
('DEMO_FACTORY', '2026-01-08', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P003', '进口牛肉真空包装', 480.00, 460.00, 20.00, '原料等待', 0.9583, 0.80, 555, 575, 0.9652, 548, 7, 0.9874, 0.9134, 148.0, 4),
('DEMO_FACTORY', '2026-01-10', 'AFTERNOON', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P001', '有机大米5kg装', 480.00, 470.00, 10.00, '正常运行', 0.9792, 0.50, 925, 940, 0.9840, 918, 7, 0.9924, 0.9565, 126.5, 3),
('DEMO_FACTORY', '2026-01-15', 'MORNING', '包装车间', '产线A', 'EQ001', '全自动包装机A', 'P001', '有机大米5kg装', 480.00, 465.00, 15.00, '设备校准', 0.9688, 0.50, 910, 930, 0.9785, 902, 8, 0.9912, 0.9398, 128.0, 3),

-- 2026年1月 - 产线B
('DEMO_FACTORY', '2026-01-02', 'MORNING', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P004', '深海鱼类冷冻包装', 480.00, 465.00, 15.00, '正常运行', 0.9688, 0.60, 745, 775, 0.9613, 735, 10, 0.9866, 0.9189, 152.0, 4),
('DEMO_FACTORY', '2026-01-05', 'MORNING', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P005', '调味酱料瓶装', 480.00, 475.00, 5.00, '正常运行', 0.9896, 0.40, 1175, 1188, 0.9891, 1165, 10, 0.9915, 0.9706, 99.5, 3),
('DEMO_FACTORY', '2026-01-10', 'AFTERNOON', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P006', '糯米袋装', 480.00, 468.00, 12.00, '正常运行', 0.9750, 0.35, 1300, 1337, 0.9723, 1290, 10, 0.9923, 0.9410, 106.0, 3),
('DEMO_FACTORY', '2026-01-15', 'MORNING', '包装车间', '产线B', 'EQ002', '全自动包装机B', 'P004', '深海鱼类冷冻包装', 480.00, 458.00, 22.00, '冷链检修', 0.9542, 0.60, 738, 763, 0.9672, 728, 10, 0.9864, 0.9103, 155.5, 4);

-- ============================================
-- 6. 插入示例质量缺陷数据
-- ============================================
INSERT INTO smart_bi_quality_defect (factory_id, defect_date, shift, workshop, production_line, product_id, product_name, batch_no, defect_type, defect_code, defect_description, severity, quantity, unit_cost, total_cost, root_cause, corrective_action, responsible_person, status) VALUES
-- 2025年11月
('DEMO_FACTORY', '2025-11-01', 'MORNING', '包装车间', '产线A', 'P001', '有机大米5kg装', 'B20251101A001', '包装破损', 'DEF001', '包装袋热封不良', 'MINOR', 15, 35.00, 525.00, '热封温度偏低', '调整热封温度参数', '张技术员', 'CLOSED'),
('DEMO_FACTORY', '2025-11-01', 'AFTERNOON', '包装车间', '产线A', 'P001', '有机大米5kg装', 'B20251101A002', '重量不足', 'DEF002', '装量偏低50g以上', 'MAJOR', 12, 35.00, 420.00, '计量系统漂移', '重新校准计量系统', '李操作员', 'CLOSED'),
('DEMO_FACTORY', '2025-11-05', 'MORNING', '包装车间', '产线B', 'P004', '深海鱼类冷冻包装', 'B20251105B001', '冷链断裂', 'DEF003', '产品温度超标', 'CRITICAL', 20, 180.00, 3600.00, '冷链设备故障', '更换压缩机组件', '王主管', 'CLOSED'),
('DEMO_FACTORY', '2025-11-10', 'MORNING', '包装车间', '产线A', 'P003', '进口牛肉真空包装', 'B20251110A001', '真空泄漏', 'DEF004', '真空包装漏气', 'MAJOR', 10, 200.00, 2000.00, '密封条老化', '更换密封条', '赵技术员', 'CLOSED'),

-- 2025年12月
('DEMO_FACTORY', '2025-12-01', 'MORNING', '包装车间', '产线A', 'P001', '有机大米5kg装', 'B20251201A001', '标签错误', 'DEF005', '生产日期打印错误', 'MINOR', 12, 35.00, 420.00, '打码机故障', '更换打码机墨盒', '张技术员', 'CLOSED'),
('DEMO_FACTORY', '2025-12-05', 'MORNING', '包装车间', '产线A', 'P002', '特级茶叶礼盒', 'B20251205A001', '外观不良', 'DEF006', '礼盒压痕', 'MINOR', 5, 280.00, 1400.00, '传送带压力过大', '调整传送带间距', '李操作员', 'CLOSED'),
('DEMO_FACTORY', '2025-12-10', 'MORNING', '包装车间', '产线A', 'P003', '进口牛肉真空包装', 'B20251210A001', '异物混入', 'DEF007', '包装内发现金属碎屑', 'CRITICAL', 13, 200.00, 2600.00, '设备磨损', '全面检修设备', '王主管', 'CLOSED'),
('DEMO_FACTORY', '2025-12-15', 'MORNING', '包装车间', '产线B', 'P004', '深海鱼类冷冻包装', 'B20251215B001', '温度异常', 'DEF008', '冷冻温度不达标', 'MAJOR', 15, 180.00, 2700.00, '制冷剂不足', '补充制冷剂', '赵技术员', 'CLOSED'),

-- 2026年1月
('DEMO_FACTORY', '2026-01-02', 'MORNING', '包装车间', '产线A', 'P001', '有机大米5kg装', 'B20260102A001', '包装破损', 'DEF001', '热封脱落', 'MINOR', 8, 35.00, 280.00, '热封温度波动', '稳定热封温度', '张技术员', 'CLOSED'),
('DEMO_FACTORY', '2026-01-05', 'MORNING', '包装车间', '产线A', 'P002', '特级茶叶礼盒', 'B20260105A001', '外观不良', 'DEF006', '表面划痕', 'MINOR', 3, 280.00, 840.00, '操作不当', '加强员工培训', '李操作员', 'CLOSED'),
('DEMO_FACTORY', '2026-01-08', 'MORNING', '包装车间', '产线A', 'P003', '进口牛肉真空包装', 'B20260108A001', '真空泄漏', 'DEF004', '包装角部漏气', 'MAJOR', 7, 200.00, 1400.00, '包装材料缺陷', '更换供应商批次', '王主管', 'IN_PROGRESS'),
('DEMO_FACTORY', '2026-01-10', 'AFTERNOON', '包装车间', '产线B', 'P004', '深海鱼类冷冻包装', 'B20260110B001', '重量不足', 'DEF002', '装量不达标', 'MINOR', 10, 180.00, 1800.00, '称重传感器漂移', '校准称重系统', '赵技术员', 'OPEN'),
('DEMO_FACTORY', '2026-01-15', 'MORNING', '包装车间', '产线A', 'P001', '有机大米5kg装', 'B20260115A001', '标签错误', 'DEF005', '批次号打印不清', 'MINOR', 8, 35.00, 280.00, '打码头磨损', '更换打码头', '张技术员', 'OPEN');

-- ============================================
-- 7. 插入示例返工与报废数据
-- ============================================
INSERT INTO smart_bi_rework_scrap (factory_id, record_date, record_type, workshop, production_line, product_id, product_name, batch_no, quantity, material_cost, labor_cost, overhead_cost, total_cost, reason_code, reason_description) VALUES
-- 2025年11月
('DEMO_FACTORY', '2025-11-05', 'REWORK', '包装车间', '产线A', 'P001', '有机大米5kg装', 'B20251101A001', 15, 350.00, 150.00, 75.00, 575.00, 'RW001', '重新包装热封不良产品'),
('DEMO_FACTORY', '2025-11-05', 'SCRAP', '包装车间', '产线B', 'P004', '深海鱼类冷冻包装', 'B20251105B001', 20, 3200.00, 0.00, 160.00, 3360.00, 'SC001', '冷链断裂产品报废'),
('DEMO_FACTORY', '2025-11-12', 'REWORK', '包装车间', '产线A', 'P003', '进口牛肉真空包装', 'B20251110A001', 10, 1800.00, 200.00, 100.00, 2100.00, 'RW002', '重新真空包装'),

-- 2025年12月
('DEMO_FACTORY', '2025-12-05', 'REWORK', '包装车间', '产线A', 'P001', '有机大米5kg装', 'B20251201A001', 12, 300.00, 120.00, 60.00, 480.00, 'RW003', '重新打印标签'),
('DEMO_FACTORY', '2025-12-08', 'SCRAP', '包装车间', '产线A', 'P002', '特级茶叶礼盒', 'B20251205A001', 5, 1200.00, 0.00, 60.00, 1260.00, 'SC002', '外观严重损坏无法修复'),
('DEMO_FACTORY', '2025-12-12', 'SCRAP', '包装车间', '产线A', 'P003', '进口牛肉真空包装', 'B20251210A001', 13, 2340.00, 0.00, 117.00, 2457.00, 'SC003', '异物污染产品报废'),
('DEMO_FACTORY', '2025-12-18', 'REWORK', '包装车间', '产线B', 'P004', '深海鱼类冷冻包装', 'B20251215B001', 15, 2400.00, 300.00, 150.00, 2850.00, 'RW004', '重新冷冻处理'),

-- 2026年1月
('DEMO_FACTORY', '2026-01-05', 'REWORK', '包装车间', '产线A', 'P001', '有机大米5kg装', 'B20260102A001', 8, 200.00, 80.00, 40.00, 320.00, 'RW001', '重新热封'),
('DEMO_FACTORY', '2026-01-08', 'REWORK', '包装车间', '产线A', 'P002', '特级茶叶礼盒', 'B20260105A001', 3, 720.00, 60.00, 30.00, 810.00, 'RW005', '更换外包装'),
('DEMO_FACTORY', '2026-01-12', 'REWORK', '包装车间', '产线A', 'P003', '进口牛肉真空包装', 'B20260108A001', 7, 1260.00, 140.00, 70.00, 1470.00, 'RW002', '重新真空包装');

-- ============================================
-- 8. 插入示例库存健康数据
-- ============================================
INSERT INTO smart_bi_inventory_health (factory_id, snapshot_date, warehouse, location, material_id, material_name, material_type, batch_no, quantity, unit, unit_cost, total_value, production_date, expiry_date, days_to_expiry, shelf_life_days, status, turnover_days, abc_class, min_stock, max_stock, reorder_point) VALUES
-- 当前库存快照 (2026-01-18)
('DEMO_FACTORY', '2026-01-18', '成品仓', 'A-01-01', 'P001', '有机大米5kg装', '成品', 'B20260115A001', 850.00, '袋', 35.00, 29750.00, '2026-01-15', '2026-07-15', 178, 180, 'NORMAL', 15, 'A', 500.00, 2000.00, 800.00),
('DEMO_FACTORY', '2026-01-18', '成品仓', 'A-01-02', 'P001', '有机大米5kg装', '成品', 'B20251215A001', 320.00, '袋', 35.00, 11200.00, '2025-12-15', '2026-06-15', 148, 180, 'NORMAL', 35, 'A', 500.00, 2000.00, 800.00),
('DEMO_FACTORY', '2026-01-18', '成品仓', 'A-02-01', 'P002', '特级茶叶礼盒', '成品', 'B20260105A001', 420.00, '盒', 280.00, 117600.00, '2026-01-05', '2028-01-05', 717, 730, 'NORMAL', 25, 'A', 200.00, 600.00, 300.00),
('DEMO_FACTORY', '2026-01-18', '成品仓', 'B-01-01', 'P003', '进口牛肉真空包装', '成品', 'B20260108A001', 480.00, '包', 200.00, 96000.00, '2026-01-08', '2026-04-08', 80, 90, 'NORMAL', 12, 'A', 300.00, 800.00, 450.00),
('DEMO_FACTORY', '2026-01-18', '成品仓', 'B-01-02', 'P003', '进口牛肉真空包装', '成品', 'B20251210A001', 65.00, '包', 200.00, 13000.00, '2025-12-10', '2026-03-10', 51, 90, 'NORMAL', 40, 'A', 300.00, 800.00, 450.00),
('DEMO_FACTORY', '2026-01-18', '冷库', 'C-01-01', 'P004', '深海鱼类冷冻包装', '成品', 'B20260115B001', 680.00, '包', 180.00, 122400.00, '2026-01-15', '2026-07-15', 178, 180, 'NORMAL', 8, 'A', 400.00, 1000.00, 600.00),
('DEMO_FACTORY', '2026-01-18', '冷库', 'C-01-02', 'P004', '深海鱼类冷冻包装', '成品', 'B20251201B001', 120.00, '包', 180.00, 21600.00, '2025-12-01', '2026-05-31', 133, 180, 'NORMAL', 48, 'A', 400.00, 1000.00, 600.00),
('DEMO_FACTORY', '2026-01-18', '成品仓', 'D-01-01', 'P005', '调味酱料瓶装', '成品', 'B20260105B001', 1100.00, '瓶', 50.00, 55000.00, '2026-01-05', '2027-01-05', 352, 365, 'NORMAL', 18, 'B', 600.00, 1500.00, 900.00),
('DEMO_FACTORY', '2026-01-18', '成品仓', 'D-02-01', 'P006', '糯米袋装', '成品', 'B20260110B001', 1200.00, '袋', 80.00, 96000.00, '2026-01-10', '2026-04-10', 82, 90, 'NORMAL', 22, 'B', 800.00, 2000.00, 1200.00),

-- 即将过期库存
('DEMO_FACTORY', '2026-01-18', '成品仓', 'B-02-01', 'P003', '进口牛肉真空包装', '成品', 'B20251105A001', 25.00, '包', 200.00, 5000.00, '2025-11-05', '2026-02-03', 16, 90, 'NEAR_EXPIRY', 75, 'A', 300.00, 800.00, 450.00),
('DEMO_FACTORY', '2026-01-18', '冷库', 'C-02-01', 'P004', '深海鱼类冷冻包装', '成品', 'B20251101B001', 40.00, '包', 180.00, 7200.00, '2025-11-01', '2026-01-30', 12, 90, 'NEAR_EXPIRY', 80, 'A', 400.00, 1000.00, 600.00),

-- 过期库存
('DEMO_FACTORY', '2026-01-18', '隔离仓', 'X-01-01', 'P006', '糯米袋装', '成品', 'B20251015B001', 50.00, '袋', 80.00, 4000.00, '2025-10-15', '2026-01-13', -5, 90, 'EXPIRED', 95, 'B', 800.00, 2000.00, 1200.00),

-- 原料库存
('DEMO_FACTORY', '2026-01-18', '原料仓', 'R-01-01', 'M001', '有机大米原料', '原料', 'RM20260102001', 8500.00, 'kg', 8.80, 74800.00, '2026-01-02', '2026-07-02', 165, 180, 'NORMAL', 10, 'A', 5000.00, 15000.00, 8000.00),
('DEMO_FACTORY', '2026-01-18', '原料仓', 'R-02-01', 'M002', '特级茶叶原料', '原料', 'RM20260103001', 180.00, 'kg', 420.00, 75600.00, '2026-01-03', '2028-01-03', 715, 730, 'NORMAL', 20, 'A', 100.00, 300.00, 150.00),
('DEMO_FACTORY', '2026-01-18', '冷库', 'R-03-01', 'M003', '进口牛肉原料', '原料', 'RM20260105001', 650.00, 'kg', 280.00, 182000.00, '2026-01-05', '2026-04-05', 77, 90, 'NORMAL', 8, 'A', 400.00, 1000.00, 600.00),
('DEMO_FACTORY', '2026-01-18', '冷库', 'R-04-01', 'M004', '深海鱼类原料', '原料', 'RM20260108001', 450.00, 'kg', 85.00, 38250.00, '2026-01-08', '2026-04-08', 80, 90, 'NORMAL', 12, 'A', 300.00, 800.00, 500.00),
('DEMO_FACTORY', '2026-01-18', '原料仓', 'R-05-01', 'M005', '调味酱原料', '原料', 'RM20260110001', 850.00, 'kg', 25.00, 21250.00, '2026-01-10', '2027-01-10', 357, 365, 'NORMAL', 25, 'B', 500.00, 1200.00, 700.00),
('DEMO_FACTORY', '2026-01-18', '原料仓', 'R-06-01', 'M006', '糯米原料', '原料', 'RM20260112001', 4500.00, 'kg', 7.50, 33750.00, '2026-01-12', '2026-04-12', 84, 90, 'NORMAL', 15, 'B', 3000.00, 8000.00, 5000.00),

-- 慢动销库存
('DEMO_FACTORY', '2026-01-18', '成品仓', 'E-01-01', 'P007', '高端礼品套装', '成品', 'B20251101S001', 85.00, '套', 580.00, 49300.00, '2025-11-01', '2026-11-01', 287, 365, 'SLOW_MOVING', 78, 'C', 50.00, 150.00, 80.00);
