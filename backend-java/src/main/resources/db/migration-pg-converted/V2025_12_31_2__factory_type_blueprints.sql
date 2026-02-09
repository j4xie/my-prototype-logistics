-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_31_2__factory_type_blueprints.sql
-- Conversion date: 2026-01-26 18:46:30
-- WARNING: This file requires manual review!
-- ============================================

-- 工厂类型蓝图表
CREATE TABLE factory_type_blueprints (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '蓝图名称，如"水产加工厂"、"肉类加工厂"',
    description TEXT COMMENT '蓝图描述',
    industry_type VARCHAR(50) COMMENT '行业类型',
    default_config JSON COMMENT '默认配置JSON',
    form_templates JSON COMMENT '表单模板配置',
    rule_templates JSON COMMENT '规则模板配置',
    product_type_templates JSON COMMENT '产品类型模板',
    department_templates JSON COMMENT '部门模板',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
    version INT DEFAULT 1 COMMENT '版本号',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE NULL COMMENT '软删除时间',
    INDEX idx_industry_type (industry_type),
    INDEX idx_is_active (is_active),
    INDEX idx_deleted_at (deleted_at)
);

-- 蓝图应用记录表
CREATE TABLE blueprint_applications (
    id VARCHAR(36) PRIMARY KEY,
    blueprint_id VARCHAR(36) NOT NULL COMMENT '蓝图ID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    applied_by BIGINT COMMENT '应用人用户ID',
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '应用时间',
    status VARCHAR(20) DEFAULT 'COMPLETED' COMMENT '状态: PENDING, IN_PROGRESS, COMPLETED, FAILED',
    result_summary TEXT COMMENT '应用结果摘要',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE NULL COMMENT '软删除时间',
    FOREIGN KEY (blueprint_id) REFERENCES factory_type_blueprints(id),
    INDEX idx_factory_id (factory_id),
    INDEX idx_blueprint_id (blueprint_id),
    INDEX idx_status (status),
    INDEX idx_deleted_at (deleted_at)
);

-- 插入默认蓝图数据
INSERT INTO factory_type_blueprints (id, name, description, industry_type, default_config, form_templates, rule_templates, product_type_templates, department_templates, is_active, version)
VALUES
-- 水产加工厂蓝图
('BLUEPRINT_SEAFOOD_001', '水产加工厂标准蓝图', '适用于水产品加工企业，包含冷冻、切片、包装等标准流程', 'SEAFOOD_PROCESSING',
 JSON_OBJECT(
   'dailyCapacity', 5000,
   'shiftCount', 2,
   'qualityStandards', JSON_ARRAY('GB 2733-2015', 'SC认证'),
   'temperatureControl', JSON_OBJECT('min', -18, 'max', 4)
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '水产原料验收表', 'type', 'MATERIAL_RECEIPT', 'fields', JSON_ARRAY('batchNumber', 'species', 'weight', 'temperature', 'freshness')),
   JSON_OBJECT('name', '冷冻加工记录表', 'type', 'PROCESSING', 'fields', JSON_ARRAY('batchNumber', 'freezingTemp', 'freezingTime', 'operator')),
   JSON_OBJECT('name', '水产品质检表', 'type', 'QUALITY_INSPECTION', 'fields', JSON_ARRAY('batchNumber', 'appearance', 'smell', 'microbiologyTest'))
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '冷链温度监控', 'type', 'TEMPERATURE_MONITORING', 'threshold', JSON_OBJECT('min', -20, 'max', -15)),
   JSON_OBJECT('name', '保质期管理', 'type', 'EXPIRY_MANAGEMENT', 'shelfLifeDays', 365)
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '冷冻鱼片', 'category', '冷冻水产', 'processSteps', JSON_ARRAY('解冻', '清洗', '切片', '速冻', '包装')),
   JSON_OBJECT('name', '虾仁', 'category', '冷冻水产', 'processSteps', JSON_ARRAY('解冻', '去壳', '清洗', '速冻', '包装'))
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '原料验收部', 'type', 'RECEIVING'),
   JSON_OBJECT('name', '冷冻加工部', 'type', 'PROCESSING'),
   JSON_OBJECT('name', '质检部', 'type', 'QUALITY'),
   JSON_OBJECT('name', '包装部', 'type', 'PACKAGING')
 ),
 TRUE, 1
),

-- 肉类加工厂蓝图
('BLUEPRINT_MEAT_001', '肉类加工厂标准蓝图', '适用于肉类加工企业，包含屠宰、分割、腌制等标准流程', 'MEAT_PROCESSING',
 JSON_OBJECT(
   'dailyCapacity', 3000,
   'shiftCount', 2,
   'qualityStandards', JSON_ARRAY('GB 2707-2016', 'HACCP'),
   'temperatureControl', JSON_OBJECT('min', 0, 'max', 7)
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '肉类原料验收表', 'type', 'MATERIAL_RECEIPT', 'fields', JSON_ARRAY('batchNumber', 'animalType', 'weight', 'quarantineCert', 'temperature')),
   JSON_OBJECT('name', '分割加工记录表', 'type', 'PROCESSING', 'fields', JSON_ARRAY('batchNumber', 'cutType', 'weight', 'operator', 'timestamp')),
   JSON_OBJECT('name', '肉类质检表', 'type', 'QUALITY_INSPECTION', 'fields', JSON_ARRAY('batchNumber', 'color', 'smell', 'pH', 'microbiologyTest'))
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '冷链温度监控', 'type', 'TEMPERATURE_MONITORING', 'threshold', JSON_OBJECT('min', 0, 'max', 4)),
   JSON_OBJECT('name', '保质期管理', 'type', 'EXPIRY_MANAGEMENT', 'shelfLifeDays', 180)
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '冷鲜猪肉', 'category', '冷鲜肉', 'processSteps', JSON_ARRAY('验收', '排酸', '分割', '包装', '冷藏')),
   JSON_OBJECT('name', '腌制肉制品', 'category', '加工肉制品', 'processSteps', JSON_ARRAY('分割', '腌制', '风干', '包装'))
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '原料验收部', 'type', 'RECEIVING'),
   JSON_OBJECT('name', '屠宰分割部', 'type', 'PROCESSING'),
   JSON_OBJECT('name', '腌制部', 'type', 'MARINATING'),
   JSON_OBJECT('name', '质检部', 'type', 'QUALITY'),
   JSON_OBJECT('name', '包装部', 'type', 'PACKAGING')
 ),
 TRUE, 1
),

-- 通用食品厂蓝图
('BLUEPRINT_GENERAL_001', '通用食品加工厂蓝图', '适用于一般食品加工企业，提供基础配置模板', 'GENERAL_FOOD',
 JSON_OBJECT(
   'dailyCapacity', 2000,
   'shiftCount', 1,
   'qualityStandards', JSON_ARRAY('GB 2760', 'SC认证'),
   'temperatureControl', JSON_OBJECT('min', 5, 'max', 25)
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '原料验收表', 'type', 'MATERIAL_RECEIPT', 'fields', JSON_ARRAY('batchNumber', 'materialType', 'weight', 'supplier', 'qualityCert')),
   JSON_OBJECT('name', '生产加工记录表', 'type', 'PROCESSING', 'fields', JSON_ARRAY('batchNumber', 'productType', 'quantity', 'operator', 'timestamp')),
   JSON_OBJECT('name', '产品质检表', 'type', 'QUALITY_INSPECTION', 'fields', JSON_ARRAY('batchNumber', 'appearance', 'weight', 'packagingIntegrity'))
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '保质期管理', 'type', 'EXPIRY_MANAGEMENT', 'shelfLifeDays', 90),
   JSON_OBJECT('name', '批次追溯', 'type', 'BATCH_TRACING', 'enabled', TRUE)
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '通用食品', 'category', '加工食品', 'processSteps', JSON_ARRAY('验收', '加工', '质检', '包装'))
 ),
 JSON_ARRAY(
   JSON_OBJECT('name', '原料验收部', 'type', 'RECEIVING'),
   JSON_OBJECT('name', '生产加工部', 'type', 'PROCESSING'),
   JSON_OBJECT('name', '质检部', 'type', 'QUALITY'),
   JSON_OBJECT('name', '包装部', 'type', 'PACKAGING')
 ),
 TRUE, 1
);
