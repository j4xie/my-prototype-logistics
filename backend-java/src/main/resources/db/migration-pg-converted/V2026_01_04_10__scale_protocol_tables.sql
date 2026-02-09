-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_04_10__scale_protocol_tables.sql
-- Conversion date: 2026-01-26 18:47:07
-- WARNING: This file requires manual review!
-- ============================================

-- =============================================
-- 秤协议配置与品牌型号表
-- Scale Protocol Configs & Brand Models
-- 用于多品牌秤的协议自动适配
-- =============================================

-- 1. 秤协议配置表 (核心表)
CREATE TABLE IF NOT EXISTS scale_protocol_configs (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NULL COMMENT 'NULL 表示全局通用协议',
    protocol_code VARCHAR(50) NOT NULL COMMENT '协议唯一编码，如 KELI_D2008_ASCII',
    protocol_name VARCHAR(100) NOT NULL COMMENT '协议名称，如 柯力D2008 ASCII协议',

    -- 连接类型
    connection_type ENUM('RS232', 'RS485', 'HTTP_API', 'MQTT', 'MODBUS_RTU', 'MODBUS_TCP', 'TCP_SOCKET') NOT NULL,

    -- 串口配置 (RS232/RS485)
    serial_config JSON COMMENT '{"baudRate":9600, "dataBits":8, "stopBits":1, "parity":"NONE", "flowControl":"NONE"}',

    -- API配置 (HTTP/MQTT)
    api_config JSON COMMENT '{"baseUrl":"", "authType":"BEARER|BASIC|NONE", "headers":{}, "mqttTopic":""}',

    -- Modbus配置
    modbus_config JSON COMMENT '{"slaveId":1, "registerAddress":0, "registerCount":2, "functionCode":3}',

    -- 数据帧格式定义 (核心)
    frame_format JSON NOT NULL COMMENT '帧格式定义，包含fields数组',

    -- Drools 规则组 (复杂解析逻辑)
    parsing_rule_group VARCHAR(50) NULL COMMENT '可选，引用 Drools 规则组',

    -- 校验方式
    checksum_type ENUM('NONE', 'XOR', 'CRC16', 'CRC32', 'SUM', 'MODBUS_CRC') DEFAULT 'NONE',
    checksum_config JSON COMMENT '{"startIndex":0, "endIndex":-2, "checksumIndex":-1}',

    -- 协议行为配置
    read_mode ENUM('CONTINUOUS', 'ON_STABLE', 'ON_CHANGE', 'POLL') DEFAULT 'CONTINUOUS' COMMENT '读取模式',
    stable_threshold_ms INT DEFAULT 500 COMMENT '稳定判断阈值(毫秒)',
    retry_count INT DEFAULT 3 COMMENT '失败重试次数',
    timeout_ms INT DEFAULT 2000 COMMENT '超时时间(毫秒)',

    -- 元数据
    description TEXT COMMENT '协议描述',
    documentation_url VARCHAR(500) COMMENT '官方文档链接',
    sample_data_hex VARCHAR(200) COMMENT '样本数据(16进制)，用于测试',

    -- 状态
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE COMMENT '是否经过真机验证',
    is_builtin BOOLEAN DEFAULT FALSE COMMENT '是否为内置协议',

    -- 审计字段
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    UNIQUE KEY uk_protocol_code (protocol_code),
    INDEX idx_factory_id (factory_id),
    INDEX idx_connection_type (connection_type),
    INDEX idx_is_active (is_active),

    FOREIGN KEY (factory_id) REFERENCES factories(factory_id) ON DELETE SET NULL
)
;
-- 2. 秤品牌型号库
CREATE TABLE IF NOT EXISTS scale_brand_models (
    id VARCHAR(36) PRIMARY KEY,
    brand_code VARCHAR(50) NOT NULL COMMENT '品牌编码，如 KELI, YAOHUA, XICE',
    brand_name VARCHAR(100) NOT NULL COMMENT '品牌名称，如 柯力, 耀华, 矽策',
    brand_name_en VARCHAR(100) COMMENT '英文名称',

    model_code VARCHAR(50) NOT NULL COMMENT '型号编码，如 D2008, XK3190, XC709S',
    model_name VARCHAR(100) COMMENT '型号全称',

    -- 支持的协议列表
    supported_protocol_ids JSON COMMENT '支持的协议ID列表 ["uuid1", "uuid2"]',
    default_protocol_id VARCHAR(36) COMMENT '默认协议ID',

    -- 接口能力
    has_serial_port BOOLEAN DEFAULT TRUE COMMENT '是否有RS232/RS485接口',
    has_wifi BOOLEAN DEFAULT FALSE COMMENT '是否内置WiFi',
    has_ethernet BOOLEAN DEFAULT FALSE COMMENT '是否有以太网接口',
    has_bluetooth BOOLEAN DEFAULT FALSE COMMENT '是否有蓝牙',
    has_usb BOOLEAN DEFAULT FALSE COMMENT '是否有USB接口',

    -- 产品规格
    weight_range VARCHAR(50) COMMENT '量程范围，如 "30kg-150kg"',
    accuracy VARCHAR(20) COMMENT '精度，如 "±0.01kg"',
    scale_type ENUM('DESKTOP', 'PLATFORM', 'FLOOR', 'TRUCK') DEFAULT 'PLATFORM' COMMENT '秤类型',

    -- 防护等级 (食品加工厂重要)
    ip_rating VARCHAR(10) COMMENT '防护等级，如 IP67, IP68',
    material VARCHAR(50) COMMENT '材质，如 304不锈钢',

    -- 厂商信息
    manufacturer VARCHAR(100) COMMENT '制造商',
    manufacturer_website VARCHAR(200) COMMENT '厂商官网',
    documentation_url VARCHAR(500) COMMENT '产品文档链接',

    -- 价格信息 (采购参考)
    price_range VARCHAR(50) COMMENT '价格区间，如 "¥1,500-2,000"',

    -- 推荐信息
    recommendation_score INT DEFAULT 0 COMMENT '推荐评分 0-100',
    recommendation_reason TEXT COMMENT '推荐理由',

    -- 状态
    is_verified BOOLEAN DEFAULT FALSE COMMENT '是否经过验证',
    is_recommended BOOLEAN DEFAULT FALSE COMMENT '是否推荐',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    UNIQUE KEY uk_brand_model (brand_code, model_code),
    INDEX idx_brand_code (brand_code),
    INDEX idx_scale_type (scale_type),
    INDEX idx_has_wifi (has_wifi),

    FOREIGN KEY (default_protocol_id) REFERENCES scale_protocol_configs(id) ON DELETE SET NULL
)
;
-- 3. 秤协议测试用例表
CREATE TABLE IF NOT EXISTS scale_protocol_test_cases (
    id VARCHAR(36) PRIMARY KEY,
    protocol_id VARCHAR(36) NOT NULL,

    test_name VARCHAR(100) NOT NULL COMMENT '测试名称',
    test_description TEXT COMMENT '测试描述',

    -- 输入数据
    input_data_hex VARCHAR(500) NOT NULL COMMENT '输入数据(16进制)',
    input_data_ascii VARCHAR(500) COMMENT '输入数据(ASCII可读形式)',

    -- 期望输出
    expected_weight DECIMAL(12,3) COMMENT '期望重量值',
    expected_unit VARCHAR(10) COMMENT '期望单位',
    expected_stable BOOLEAN COMMENT '期望稳定状态',
    expected_error VARCHAR(100) COMMENT '期望错误(如果是负面测试)',

    -- 测试结果
    last_run_at TIMESTAMP WITH TIME ZONE COMMENT '最后运行时间',
    last_run_success BOOLEAN COMMENT '最后运行是否成功',
    last_run_result JSON COMMENT '最后运行结果详情',

    -- 元数据
    is_negative_test BOOLEAN DEFAULT FALSE COMMENT '是否为负面测试(期望失败)',
    priority INT DEFAULT 1 COMMENT '优先级 1-5',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_protocol_id (protocol_id),
    FOREIGN KEY (protocol_id) REFERENCES scale_protocol_configs(id) ON DELETE CASCADE
)
;
-- 4. 扩展 factory_equipments 表 (添加秤相关字段)
ALTER TABLE factory_equipments
    ADD COLUMN IF NOT EXISTS scale_protocol_id VARCHAR(36) COMMENT '关联秤协议配置ID',
    ADD COLUMN IF NOT EXISTS scale_brand_model_id VARCHAR(36) COMMENT '关联秤品牌型号ID',
    ADD COLUMN IF NOT EXISTS scale_connection_params JSON COMMENT '连接参数 {"comPort":"COM3", "ipAddress":"192.168.1.100"}',
    ADD COLUMN IF NOT EXISTS last_weight_reading DECIMAL(12,3) COMMENT '最后一次称重值',
    ADD COLUMN IF NOT EXISTS last_weight_unit VARCHAR(10) DEFAULT 'kg' COMMENT '最后称重单位',
    ADD COLUMN IF NOT EXISTS last_weight_time TIMESTAMP WITH TIME ZONE COMMENT '最后称重时间',
    ADD COLUMN IF NOT EXISTS last_weight_stable BOOLEAN COMMENT '最后称重是否稳定';

-- 添加索引和外键
ALTER TABLE factory_equipments
    ADD INDEX IF NOT EXISTS idx_scale_protocol_id (scale_protocol_id),
    ADD INDEX IF NOT EXISTS idx_scale_brand_model_id (scale_brand_model_id);

-- 注意：外键约束需要在数据存在后添加，这里暂时注释
-- ALTER TABLE factory_equipments
--     ADD CONSTRAINT fk_equipment_scale_protocol FOREIGN KEY (scale_protocol_id) REFERENCES scale_protocol_configs(id) ON DELETE SET NULL,
--     ADD CONSTRAINT fk_equipment_scale_brand_model FOREIGN KEY (scale_brand_model_id) REFERENCES scale_brand_models(id) ON DELETE SET NULL;
-- 5. 称重记录表 (高频数据)
CREATE TABLE IF NOT EXISTS weighing_records (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    equipment_id BIGINT NOT NULL COMMENT '关联设备ID',

    -- 称重数据
    weight DECIMAL(12,3) NOT NULL COMMENT '重量值',
    unit VARCHAR(10) DEFAULT 'kg' COMMENT '单位',
    is_stable BOOLEAN DEFAULT TRUE COMMENT '是否稳定读数',
    tare_weight DECIMAL(12,3) DEFAULT 0 COMMENT '皮重',
    net_weight DECIMAL(12,3) COMMENT '净重 = 重量 - 皮重',

    -- 关联业务
    production_batch_id BIGINT COMMENT '关联加工批次',
    material_batch_id VARCHAR(36) COMMENT '关联原料批次',
    product_type_id VARCHAR(100) COMMENT '产品类型',

    -- 质检结果
    quality_result ENUM('PENDING', 'PASS', 'FAIL', 'REJECTED') DEFAULT 'PENDING',
    quality_notes TEXT COMMENT '质检备注',

    -- 操作者
    operator_id BIGINT COMMENT '操作员ID',
    operator_name VARCHAR(100) COMMENT '操作员姓名',

    -- 设备状态
    device_status JSON COMMENT '设备状态快照 {"temperature":25, "battery":80}',

    -- 数据来源
    source ENUM('MANUAL', 'AUTO', 'API', 'MQTT') DEFAULT 'AUTO',
    raw_data_hex VARCHAR(200) COMMENT '原始数据(16进制)',

    -- 时间戳
    weighed_at TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '称重时间',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_factory_equipment (factory_id, equipment_id),
    INDEX idx_weighed_at (weighed_at),
    INDEX idx_production_batch (production_batch_id),
    INDEX idx_material_batch (material_batch_id),
    INDEX idx_operator (operator_id),

    FOREIGN KEY (factory_id) REFERENCES factories(factory_id),
    FOREIGN KEY (equipment_id) REFERENCES factory_equipments(id),
    FOREIGN KEY (production_batch_id) REFERENCES production_batches(id) ON DELETE SET NULL,
    FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
)
;
-- 6. 边缘网关表
CREATE TABLE IF NOT EXISTS edge_gateways (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,

    gateway_name VARCHAR(100) NOT NULL COMMENT '网关名称',
    gateway_code VARCHAR(50) NOT NULL COMMENT '网关编码',

    -- 网络配置
    ip_address VARCHAR(45) COMMENT 'IP地址',
    mac_address VARCHAR(17) COMMENT 'MAC地址',
    mqtt_client_id VARCHAR(100) COMMENT 'MQTT客户端ID',

    -- 状态
    status ENUM('ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE') DEFAULT 'OFFLINE',
    last_heartbeat TIMESTAMP WITH TIME ZONE COMMENT '最后心跳时间',

    -- 能力
    capabilities JSON COMMENT '网关能力 {"maxSerialPorts":4, "supportedProtocols":["RS232","MQTT"]}',
    connected_devices JSON COMMENT '已连接设备列表',

    -- 版本信息
    firmware_version VARCHAR(50) COMMENT '固件版本',
    software_version VARCHAR(50) COMMENT '软件版本',

    -- 位置
    location VARCHAR(200) COMMENT '安装位置',

    -- 审计
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    UNIQUE KEY uk_gateway_code (gateway_code),
    INDEX idx_factory_id (factory_id),
    INDEX idx_status (status),

    FOREIGN KEY (factory_id) REFERENCES factories(factory_id)
)
;
