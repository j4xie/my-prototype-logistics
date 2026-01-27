-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_04_21__factory_equipment_iot_fields.sql
-- Conversion date: 2026-01-26 18:47:13
-- ============================================

-- ============================================================
-- V2026_01_04_21: 为 factory_equipment 表添加 IoT 设备相关字段
--
-- 目的: 扩展工厂设备表，支持 IoT 设备管理、秤协议配置、MQTT 通信等
--
-- 新增字段:
--   - iot_device_code: IoT 设备编码
--   - device_category: 设备分类 (TRADITIONAL/IOT_SCALE/IOT_CAMERA/IOT_SENSOR)
--   - scale_protocol_id: 关联的秤协议配置ID
--   - scale_brand_model_id: 关联的秤品牌型号ID
--   - mqtt_topic: MQTT 订阅/发布主题
--   - scale_connection_params: 秤连接参数 (JSON)
--   - last_weight_reading: 最后一次称重值
--   - last_weight_time: 最后称重时间
--   - last_data_received: 最后数据接收时间
-- ============================================================

-- 1. 添加 IoT 设备编码字段
ALTER TABLE factory_equipment
ADD COLUMN IF NOT EXISTS iot_device_code VARCHAR(100) NULL
COMMENT 'IoT设备唯一编码，用于MQTT通信标识';

-- 2. 添加设备分类字段
ALTER TABLE factory_equipment
ADD COLUMN IF NOT EXISTS device_category VARCHAR(20) DEFAULT 'TRADITIONAL'
COMMENT '设备分类: TRADITIONAL(传统设备), IOT_SCALE(物联网秤), IOT_CAMERA(物联网摄像头), IOT_SENSOR(物联网传感器)';

-- 3. 添加秤协议配置ID关联
ALTER TABLE factory_equipment
ADD COLUMN IF NOT EXISTS scale_protocol_id VARCHAR(50) NULL
COMMENT '关联的秤协议配置ID，引用 scale_protocol_configs.id';

-- 4. 添加秤品牌型号ID关联
ALTER TABLE factory_equipment
ADD COLUMN IF NOT EXISTS scale_brand_model_id VARCHAR(50) NULL
COMMENT '关联的秤品牌型号ID，引用 scale_brand_models.id';

-- 5. 添加 MQTT 主题字段
ALTER TABLE factory_equipment
ADD COLUMN IF NOT EXISTS mqtt_topic VARCHAR(255) NULL
COMMENT 'MQTT订阅/发布主题，格式: cretas/{factoryId}/device/{deviceCode}/#';

-- 6. 添加秤连接参数字段 (JSON 格式)
ALTER TABLE factory_equipment
ADD COLUMN IF NOT EXISTS scale_connection_params TEXT NULL
COMMENT '秤连接参数JSON，如 {"comPort":"COM3","baudRate":9600} 或 {"apiUrl":"http://..."}';

-- 7. 添加最后称重值字段
ALTER TABLE factory_equipment
ADD COLUMN IF NOT EXISTS last_weight_reading DECIMAL(12,4) NULL
COMMENT '最后一次称重读数，单位 kg';

-- 8. 添加最后称重时间字段
ALTER TABLE factory_equipment
ADD COLUMN IF NOT EXISTS last_weight_time TIMESTAMP WITH TIME ZONE NULL
COMMENT '最后一次称重时间';

-- 9. 添加最后数据接收时间字段
ALTER TABLE factory_equipment
ADD COLUMN IF NOT EXISTS last_data_received TIMESTAMP WITH TIME ZONE NULL
COMMENT 'IoT设备最后一次数据接收时间，用于心跳检测';

-- 10. 添加索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_factory_equipment_iot_device_code
ON factory_equipment(iot_device_code);

CREATE INDEX IF NOT EXISTS idx_factory_equipment_device_category
ON factory_equipment(device_category);

CREATE INDEX IF NOT EXISTS idx_factory_equipment_scale_protocol
ON factory_equipment(scale_protocol_id);

-- 11. 为现有设备设置默认分类
UPDATE factory_equipment
SET device_category = 'TRADITIONAL'
WHERE device_category IS NULL;
