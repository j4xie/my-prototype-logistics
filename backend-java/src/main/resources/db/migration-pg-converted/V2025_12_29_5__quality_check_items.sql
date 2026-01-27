-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_29_5__quality_check_items.sql
-- Conversion date: 2026-01-26 18:46:00
-- WARNING: This file requires manual review!
-- ============================================

-- =====================================================
-- 质检项配置表 (Quality Check Items Configuration)
-- 版本: V2025_12_29_5
-- 作者: Cretas Team
-- 描述: 创建质检项配置和绑定表
-- =====================================================

-- 质检项配置表
CREATE TABLE IF NOT EXISTS quality_check_items (
    id VARCHAR(50) PRIMARY KEY,
    factory_id VARCHAR(50) COMMENT '工厂ID，为NULL表示系统默认模板',
    item_code VARCHAR(50) NOT NULL COMMENT '项目编号',
    item_name VARCHAR(100) NOT NULL COMMENT '项目名称',
    category VARCHAR(30) NOT NULL COMMENT '项目类别: SENSORY, PHYSICAL, CHEMICAL, MICROBIOLOGICAL, PACKAGING',
    description VARCHAR(500) COMMENT '项目描述',
    check_method VARCHAR(500) COMMENT '检测方法',
    standard_reference VARCHAR(200) COMMENT '检测标准引用',

    -- 标准值配置
    value_type VARCHAR(20) DEFAULT 'NUMERIC' COMMENT '检测类型: NUMERIC, TEXT, BOOLEAN, RANGE',
    standard_value VARCHAR(100) COMMENT '标准值',
    min_value DECIMAL(15,4) COMMENT '最小值',
    max_value DECIMAL(15,4) COMMENT '最大值',
    unit VARCHAR(30) COMMENT '单位',
    tolerance DECIMAL(10,4) COMMENT '允许误差',

    -- 抽样配置
    sampling_strategy VARCHAR(30) DEFAULT 'RANDOM' COMMENT '抽样策略',
    sampling_ratio DECIMAL(5,2) DEFAULT 10.00 COMMENT '抽样比例(%)',
    min_sample_size INT DEFAULT 1 COMMENT '最小抽样数量',
    aql_level DECIMAL(5,2) COMMENT 'AQL水平',

    -- 严重程度和控制
    severity VARCHAR(20) DEFAULT 'MAJOR' COMMENT '严重程度: CRITICAL, MAJOR, MINOR',
    is_required BOOLEAN DEFAULT TRUE COMMENT '是否必检项',
    require_photo_on_fail BOOLEAN DEFAULT FALSE COMMENT '不合格时是否需要拍照',
    require_note_on_fail BOOLEAN DEFAULT TRUE COMMENT '不合格时是否需要备注',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    version INT DEFAULT 1 COMMENT '版本号',

    -- 审计字段
    created_by BIGINT COMMENT '创建者用户ID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE COMMENT '软删除时间',

    -- 索引
    INDEX idx_qci_factory (factory_id),
    INDEX idx_qci_category (factory_id, category),
    INDEX idx_qci_code (factory_id, item_code),

    -- 唯一约束
    UNIQUE KEY uk_qci_factory_code (factory_id, item_code)
)
;

-- 质检项与产品绑定表
CREATE TABLE IF NOT EXISTS quality_check_item_bindings (
    id VARCHAR(50) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    product_type_id VARCHAR(100) NOT NULL COMMENT '产品类型ID',
    quality_check_item_id VARCHAR(50) NOT NULL COMMENT '质检项ID',

    -- 覆盖配置
    override_standard_value VARCHAR(100) COMMENT '覆盖: 标准值',
    override_min_value DECIMAL(15,4) COMMENT '覆盖: 最小值',
    override_max_value DECIMAL(15,4) COMMENT '覆盖: 最大值',
    override_sampling_ratio DECIMAL(5,2) COMMENT '覆盖: 抽样比例',
    override_is_required BOOLEAN COMMENT '覆盖: 是否必检',

    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    notes VARCHAR(500) COMMENT '备注',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE COMMENT '软删除时间',

    -- 索引
    INDEX idx_qcib_factory (factory_id),
    INDEX idx_qcib_product (product_type_id),
    INDEX idx_qcib_item (quality_check_item_id),

    -- 唯一约束
    UNIQUE KEY uk_qcib_product_item (product_type_id, quality_check_item_id),

    -- 外键
    CONSTRAINT fk_qcib_item FOREIGN KEY (quality_check_item_id)
        REFERENCES quality_check_items(id) ON DELETE CASCADE
)
;

-- =====================================================
-- 插入系统默认质检项模板 (factory_id = NULL)
-- =====================================================

INSERT INTO quality_check_items (id, factory_id, item_code, item_name, category, description, check_method, standard_reference, value_type, standard_value, min_value, max_value, unit, sampling_strategy, sampling_ratio, severity, is_required, require_photo_on_fail, require_note_on_fail, sort_order, enabled, version) VALUES
-- 感官检测项
('SYS-QCI-SENSE-001', NULL, 'SENSE-001', '外观色泽', 'SENSORY', '检查产品外观颜色是否正常', '目视检查，在自然光或标准光源下观察', 'GB 2733-2015', 'TEXT', '正常', NULL, NULL, NULL, 'RANDOM', 10.00, 'MAJOR', TRUE, TRUE, TRUE, 1, TRUE, 1),
('SYS-QCI-SENSE-002', NULL, 'SENSE-002', '气味', 'SENSORY', '检查产品气味是否正常', '嗅觉检查，样品应无异味', 'GB 2733-2015', 'TEXT', '无异味', NULL, NULL, NULL, 'RANDOM', 10.00, 'CRITICAL', TRUE, TRUE, TRUE, 2, TRUE, 1),
('SYS-QCI-SENSE-003', NULL, 'SENSE-003', '组织形态', 'SENSORY', '检查产品组织状态', '目视检查产品形态完整性', 'GB 2733-2015', 'TEXT', '组织紧密', NULL, NULL, NULL, 'RANDOM', 10.00, 'MAJOR', TRUE, FALSE, TRUE, 3, TRUE, 1),

-- 物理检测项
('SYS-QCI-PHYS-001', NULL, 'PHYS-001', '中心温度(冷藏)', 'PHYSICAL', '检测冷藏产品中心温度', '使用探针式温度计测量产品中心温度', 'GB/T 27306', 'RANGE', NULL, NULL, 4.00, '°C', 'RANDOM', 20.00, 'CRITICAL', TRUE, TRUE, TRUE, 10, TRUE, 1),
('SYS-QCI-PHYS-002', NULL, 'PHYS-002', '中心温度(冷冻)', 'PHYSICAL', '检测冷冻产品中心温度', '使用探针式温度计测量产品中心温度', 'GB/T 27306', 'RANGE', NULL, NULL, -18.00, '°C', 'RANDOM', 20.00, 'CRITICAL', TRUE, TRUE, TRUE, 11, TRUE, 1),
('SYS-QCI-PHYS-003', NULL, 'PHYS-003', '净含量', 'PHYSICAL', '检查产品净含量是否符合标示', '使用电子秤称量', 'JJF 1070', 'RANGE', NULL, 0, NULL, 'g', 'RANDOM', 10.00, 'MAJOR', TRUE, FALSE, TRUE, 12, TRUE, 1),

-- 化学检测项
('SYS-QCI-CHEM-001', NULL, 'CHEM-001', 'pH值', 'CHEMICAL', '检测产品酸碱度', 'pH计测定法', 'GB 5009.237', 'RANGE', NULL, 6.00, 7.50, NULL, 'BATCH_END', 5.00, 'MAJOR', FALSE, FALSE, TRUE, 20, TRUE, 1),
('SYS-QCI-CHEM-002', NULL, 'CHEM-002', '盐分', 'CHEMICAL', '检测产品盐分含量', '银量法或电位滴定法', 'GB 5009.44', 'RANGE', NULL, NULL, 3.00, '%', 'BATCH_END', 5.00, 'MINOR', FALSE, FALSE, TRUE, 21, TRUE, 1),
('SYS-QCI-CHEM-003', NULL, 'CHEM-003', '水分', 'CHEMICAL', '检测产品水分含量', '直接干燥法', 'GB 5009.3', 'RANGE', NULL, NULL, 80.00, '%', 'BATCH_END', 5.00, 'MINOR', FALSE, FALSE, TRUE, 22, TRUE, 1),

-- 微生物检测项
('SYS-QCI-MICRO-001', NULL, 'MICRO-001', '菌落总数', 'MICROBIOLOGICAL', '检测产品菌落总数', '平板计数法', 'GB 4789.2', 'RANGE', NULL, NULL, 100000.00, 'CFU/g', 'BATCH_END', 2.00, 'CRITICAL', FALSE, FALSE, TRUE, 30, TRUE, 1),
('SYS-QCI-MICRO-002', NULL, 'MICRO-002', '大肠菌群', 'MICROBIOLOGICAL', '检测大肠菌群', 'MPN法或平板计数法', 'GB 4789.3', 'RANGE', NULL, NULL, 100.00, 'MPN/g', 'BATCH_END', 2.00, 'CRITICAL', FALSE, FALSE, TRUE, 31, TRUE, 1),

-- 包装检测项
('SYS-QCI-PKG-001', NULL, 'PKG-001', '包装完整性', 'PACKAGING', '检查包装是否完整无破损', '目视检查', NULL, 'BOOLEAN', 'true', NULL, NULL, NULL, 'FULL_INSPECTION', 100.00, 'CRITICAL', TRUE, TRUE, TRUE, 40, TRUE, 1),
('SYS-QCI-PKG-002', NULL, 'PKG-002', '标签信息', 'PACKAGING', '检查标签信息是否完整正确', '对照标准核对', 'GB 7718', 'BOOLEAN', 'true', NULL, NULL, NULL, 'RANDOM', 10.00, 'MAJOR', TRUE, TRUE, TRUE, 41, TRUE, 1),
('SYS-QCI-PKG-003', NULL, 'PKG-003', '生产日期', 'PACKAGING', '检查生产日期标注', '目视检查日期清晰可读', 'GB 7718', 'BOOLEAN', 'true', NULL, NULL, NULL, 'RANDOM', 10.00, 'MAJOR', TRUE, TRUE, TRUE, 42, TRUE, 1);
