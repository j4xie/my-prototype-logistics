-- ============================================================
-- Hardware Test Data for Unit and Integration Tests
--
-- Tables covered:
--   - factory_equipments (IOT_SCALE, IOT_CAMERA categories)
--   - scale_protocol_configs (protocol definitions)
--   - scale_brand_models (brand/model library)
--   - scale_protocol_test_cases (protocol verification)
--   - isapi_devices (camera devices)
--   - isapi_device_channels (NVR channels)
--   - iot_devices (IoT device registry)
--
-- Test IDs use prefix: TEST-* for easy cleanup
-- ============================================================

-- Clean up existing test data
DELETE FROM scale_protocol_test_cases WHERE id LIKE 'TEST-%';
DELETE FROM scale_brand_models WHERE id LIKE 'TEST-%';
DELETE FROM scale_protocol_configs WHERE id LIKE 'TEST-%';
DELETE FROM isapi_device_channels WHERE device_id LIKE 'TEST-%';
DELETE FROM isapi_devices WHERE id LIKE 'TEST-%';
DELETE FROM iot_devices WHERE id LIKE 'TEST-%';
DELETE FROM factory_equipments WHERE id IN (9001, 9002, 9003, 9004, 9005);

-- ============================================================
-- 1. Factory Equipments (Base equipment records)
-- ============================================================

INSERT INTO factory_equipments (id, factory_id, equipment_code, equipment_name, device_category, status, created_at, updated_at)
VALUES
-- IoT Scale Equipment
(9001, 'F001', 'EQ-TEST-SCALE-001', '测试电子秤1-柯力D2008', 'IOT_SCALE', 'ACTIVE', NOW(), NOW()),
(9002, 'F001', 'EQ-TEST-SCALE-002', '测试电子秤2-托利多IND570', 'IOT_SCALE', 'ACTIVE', NOW(), NOW()),
(9003, 'F001', 'EQ-TEST-SCALE-003', '测试电子秤3-梅特勒ICS', 'IOT_SCALE', 'ACTIVE', NOW(), NOW()),
-- IoT Camera Equipment
(9004, 'F001', 'EQ-TEST-CAM-001', '测试摄像头1-IPC', 'IOT_CAMERA', 'ACTIVE', NOW(), NOW()),
(9005, 'F001', 'EQ-TEST-CAM-002', '测试摄像头2-NVR', 'IOT_CAMERA', 'ACTIVE', NOW(), NOW());

-- ============================================================
-- 2. Scale Protocol Configs (Protocol definitions)
-- ============================================================

-- Protocol 1: 柯力 D2008 (ASCII Fixed Frame)
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name, brand_name, model_name,
    connection_type, frame_format, checksum_type, read_mode,
    baud_rate, data_bits, stop_bits, parity, timeout_ms,
    is_global, is_active, created_at, updated_at
) VALUES (
    'TEST-P001', NULL, 'KELI-D2008', 'D2008标准协议', '柯力', 'D2008',
    'RS232',
    '{"frameType": "ASCII_FIXED", "startByte": "02", "endByte": "03", "dataLength": 10, "weightOffset": 1, "weightLength": 8, "signOffset": 1, "stableOffset": 0, "stableMask": "00", "decimalPlaces": 0}',
    'NONE', 'CONTINUOUS',
    9600, 8, 1, 'NONE', 1000,
    TRUE, TRUE, NOW(), NOW()
);

-- Protocol 2: 托利多 IND570 (HEX Fixed Frame with CRC16)
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name, brand_name, model_name,
    connection_type, frame_format, checksum_type, read_mode,
    baud_rate, data_bits, stop_bits, parity, timeout_ms,
    is_global, is_active, created_at, updated_at
) VALUES (
    'TEST-P002', NULL, 'TOLEDO-IND570', 'IND570 BCD协议', '托利多', 'IND570',
    'RS485',
    '{"frameType": "HEX_FIXED", "startByte": "AA55", "endByte": "", "dataLength": 12, "weightOffset": 4, "weightLength": 4, "weightFormat": "BCD", "signOffset": 2, "signBit": 7, "stableOffset": 2, "stableBit": 6, "decimalPlaces": 2}',
    'CRC16', 'ON_STABLE',
    19200, 8, 1, 'EVEN', 2000,
    TRUE, TRUE, NOW(), NOW()
);

-- Protocol 3: 梅特勒 ICS (Modbus RTU)
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name, brand_name, model_name,
    connection_type, frame_format, checksum_type, read_mode,
    baud_rate, data_bits, stop_bits, parity, timeout_ms,
    is_global, is_active, created_at, updated_at
) VALUES (
    'TEST-P003', NULL, 'METTLER-ICS-MODBUS', 'ICS Modbus协议', '梅特勒', 'ICS',
    'MODBUS_RTU',
    '{"frameType": "MODBUS_RTU", "slaveAddress": 1, "functionCode": 3, "registerAddress": 0, "registerCount": 2, "weightRegister": 0, "statusRegister": 2, "decimalPlaces": 3}',
    'MODBUS_CRC', 'POLL',
    9600, 8, 1, 'NONE', 500,
    TRUE, TRUE, NOW(), NOW()
);

-- Protocol 4: ASCII Variable (Delimiter-based)
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name, brand_name, model_name,
    connection_type, frame_format, checksum_type, read_mode,
    baud_rate, data_bits, stop_bits, parity, timeout_ms,
    is_global, is_active, created_at, updated_at
) VALUES (
    'TEST-P004', NULL, 'GENERIC-ASCII-VAR', '通用ASCII可变协议', '通用', 'Generic',
    'RS232',
    '{"frameType": "ASCII_VARIABLE", "delimiter": ",", "weightField": 2, "unitField": 3, "stableField": 0, "stableValue": "ST", "lineEnding": "CRLF"}',
    'NONE', 'CONTINUOUS',
    9600, 8, 1, 'NONE', 1000,
    TRUE, TRUE, NOW(), NOW()
);

-- Protocol 5: Factory-specific protocol (for factory isolation testing)
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name, brand_name, model_name,
    connection_type, frame_format, checksum_type, read_mode,
    baud_rate, data_bits, stop_bits, parity, timeout_ms,
    is_global, is_active, created_at, updated_at
) VALUES (
    'TEST-P005', 'F001', 'F001-CUSTOM', 'F001工厂自定义协议', '自定义', 'Custom-F001',
    'TCP_SOCKET',
    '{"frameType": "ASCII_FIXED", "startByte": "24", "endByte": "0D0A", "dataLength": 16, "weightOffset": 2, "weightLength": 10, "decimalPlaces": 2}',
    'XOR', 'ON_CHANGE',
    0, 0, 0, 'NONE', 3000,
    FALSE, TRUE, NOW(), NOW()
);

-- ============================================================
-- 3. Scale Brand Models (Brand/Model Library)
-- ============================================================

-- Brand: 柯力
INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_aliases, model_code, model_name,
    default_protocol_id, supported_protocol_ids, is_recommended, is_active,
    created_at, updated_at
) VALUES (
    'TEST-BM001', 'KELI', '柯力', '["柯力","KELI","KeLi","科力"]',
    'D2008', 'D2008',
    'TEST-P001', '["TEST-P001"]',
    TRUE, TRUE, NOW(), NOW()
);

INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_aliases, model_code, model_name,
    default_protocol_id, supported_protocol_ids, is_recommended, is_active,
    created_at, updated_at
) VALUES (
    'TEST-BM002', 'KELI', '柯力', '["柯力","KELI","KeLi","科力"]',
    'XK3190-A9', 'XK3190-A9',
    'TEST-P001', '["TEST-P001"]',
    FALSE, TRUE, NOW(), NOW()
);

-- Brand: 托利多
INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_aliases, model_code, model_name,
    default_protocol_id, supported_protocol_ids, is_recommended, is_active,
    created_at, updated_at
) VALUES (
    'TEST-BM003', 'TOLEDO', '托利多', '["托利多","TOLEDO","梅特勒-托利多","Mettler-Toledo"]',
    'IND570', 'IND570',
    'TEST-P002', '["TEST-P002"]',
    TRUE, TRUE, NOW(), NOW()
);

-- Brand: 梅特勒
INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_aliases, model_code, model_name,
    default_protocol_id, supported_protocol_ids, is_recommended, is_active,
    created_at, updated_at
) VALUES (
    'TEST-BM004', 'METTLER', '梅特勒', '["梅特勒","METTLER","Mettler"]',
    'ICS', 'ICS',
    'TEST-P003', '["TEST-P003"]',
    TRUE, TRUE, NOW(), NOW()
);

-- ============================================================
-- 4. Scale Protocol Test Cases (Protocol Verification)
-- ============================================================

-- Test case for D2008 protocol (positive weight, stable)
INSERT INTO scale_protocol_test_cases (
    id, protocol_id, test_name, description,
    raw_data_hex, expected_weight, expected_unit, expected_stable, expected_overload,
    is_active, created_at, updated_at
) VALUES (
    'TEST-TC001', 'TEST-P001', '正常毛重-稳定',
    '柯力D2008协议测试：正常毛重12345，稳定状态',
    '022B303030313233343503', 12345.0, 'kg', TRUE, FALSE,
    TRUE, NOW(), NOW()
);

-- Test case for D2008 protocol (negative weight)
INSERT INTO scale_protocol_test_cases (
    id, protocol_id, test_name, description,
    raw_data_hex, expected_weight, expected_unit, expected_stable, expected_overload,
    is_active, created_at, updated_at
) VALUES (
    'TEST-TC002', 'TEST-P001', '负数重量',
    '柯力D2008协议测试：负数重量-1000',
    '022D303030303130303003', -1000.0, 'kg', TRUE, FALSE,
    TRUE, NOW(), NOW()
);

-- Test case for IND570 protocol (BCD format)
INSERT INTO scale_protocol_test_cases (
    id, protocol_id, test_name, description,
    raw_data_hex, expected_weight, expected_unit, expected_stable, expected_overload,
    is_active, created_at, updated_at
) VALUES (
    'TEST-TC003', 'TEST-P002', 'BCD格式重量',
    '托利多IND570 BCD协议测试：重量123.45kg',
    'AA5500400001234500XXXX', 123.45, 'kg', TRUE, FALSE,
    TRUE, NOW(), NOW()
);

-- Test case for Modbus RTU protocol
INSERT INTO scale_protocol_test_cases (
    id, protocol_id, test_name, description,
    raw_data_hex, expected_weight, expected_unit, expected_stable, expected_overload,
    is_active, created_at, updated_at
) VALUES (
    'TEST-TC004', 'TEST-P003', 'Modbus读保持寄存器',
    '梅特勒ICS Modbus协议测试：读取重量寄存器',
    '0103040000303912AB', 12345.0, 'kg', TRUE, FALSE,
    TRUE, NOW(), NOW()
);

-- Test case for ASCII Variable protocol
INSERT INTO scale_protocol_test_cases (
    id, protocol_id, test_name, description,
    raw_data_hex, expected_weight, expected_unit, expected_stable, expected_overload,
    is_active, created_at, updated_at
) VALUES (
    'TEST-TC005', 'TEST-P004', 'ASCII分隔符格式',
    '通用ASCII可变协议测试：逗号分隔',
    '53542C47532C2B3030313233342E352C6B670D0A', 1234.5, 'kg', TRUE, FALSE,
    TRUE, NOW(), NOW()
);

-- ============================================================
-- 5. ISAPI Devices (Camera devices)
-- ============================================================

-- IPC Camera (online)
INSERT INTO isapi_devices (
    id, factory_id, device_name, device_type, ip_address, port, https_port, rtsp_port,
    protocol, username, password_encrypted, equipment_id,
    status, channel_count, supports_ptz, supports_audio, supports_smart,
    alert_subscribed, device_capabilities, subscribed_events,
    created_at, updated_at
) VALUES (
    'TEST-ISAPI-001', 'F001', '测试IPC摄像头-在线', 'IPC',
    '192.168.1.100', 80, 443, 554,
    'HTTP', 'admin', 'AES_ENCRYPTED_PWD_TEST_001', 9004,
    'ONLINE', 1, TRUE, TRUE, TRUE,
    FALSE, '{"supportsPtz": true, "supportsAudio": true, "supportsSmart": true, "maxResolution": "4K"}',
    '[]',
    NOW(), NOW()
);

-- IPC Camera (offline)
INSERT INTO isapi_devices (
    id, factory_id, device_name, device_type, ip_address, port, https_port, rtsp_port,
    protocol, username, password_encrypted, equipment_id,
    status, channel_count, supports_ptz, supports_audio, supports_smart,
    alert_subscribed, device_capabilities, subscribed_events,
    created_at, updated_at
) VALUES (
    'TEST-ISAPI-002', 'F001', '测试IPC摄像头-离线', 'IPC',
    '192.168.1.101', 80, 443, 554,
    'HTTP', 'admin', 'AES_ENCRYPTED_PWD_TEST_002', NULL,
    'OFFLINE', 1, FALSE, FALSE, FALSE,
    FALSE, '{}', '[]',
    NOW(), NOW()
);

-- NVR (multi-channel)
INSERT INTO isapi_devices (
    id, factory_id, device_name, device_type, ip_address, port, https_port, rtsp_port,
    protocol, username, password_encrypted, equipment_id,
    status, channel_count, supports_ptz, supports_audio, supports_smart,
    alert_subscribed, device_capabilities, subscribed_events,
    created_at, updated_at
) VALUES (
    'TEST-ISAPI-003', 'F001', '测试NVR设备', 'NVR',
    '192.168.1.200', 80, 443, 554,
    'HTTP', 'admin', 'AES_ENCRYPTED_PWD_TEST_003', 9005,
    'ONLINE', 16, FALSE, TRUE, TRUE,
    TRUE, '{"maxChannels": 16, "supportsRaid": true}',
    '["lineDetection", "fieldDetection"]',
    NOW(), NOW()
);

-- DVR (for type conversion testing)
INSERT INTO isapi_devices (
    id, factory_id, device_name, device_type, ip_address, port, https_port, rtsp_port,
    protocol, username, password_encrypted, equipment_id,
    status, channel_count, supports_ptz, supports_audio, supports_smart,
    alert_subscribed, device_capabilities, subscribed_events,
    created_at, updated_at
) VALUES (
    'TEST-ISAPI-004', 'F001', '测试DVR设备', 'DVR',
    '192.168.1.201', 80, 443, 554,
    'HTTP', 'admin', 'AES_ENCRYPTED_PWD_TEST_004', NULL,
    'UNKNOWN', 8, FALSE, FALSE, FALSE,
    FALSE, '{}', '[]',
    NOW(), NOW()
);

-- ENCODER (for type conversion testing)
INSERT INTO isapi_devices (
    id, factory_id, device_name, device_type, ip_address, port, https_port, rtsp_port,
    protocol, username, password_encrypted, equipment_id,
    status, channel_count, supports_ptz, supports_audio, supports_smart,
    alert_subscribed, device_capabilities, subscribed_events,
    created_at, updated_at
) VALUES (
    'TEST-ISAPI-005', 'F001', '测试编码器', 'ENCODER',
    '192.168.1.202', 80, 443, 554,
    'HTTP', 'admin', 'AES_ENCRYPTED_PWD_TEST_005', NULL,
    'CONNECTING', 4, FALSE, TRUE, FALSE,
    FALSE, '{}', '[]',
    NOW(), NOW()
);

-- ============================================================
-- 6. ISAPI Device Channels (NVR channels)
-- ============================================================

INSERT INTO isapi_device_channels (
    id, device_id, channel_id, channel_name, is_enabled, stream_type,
    stream_url, snapshot_url, created_at, updated_at
) VALUES
('TEST-CH-001', 'TEST-ISAPI-003', 1, 'NVR通道1-入口', TRUE, 'MAIN',
 'rtsp://192.168.1.200:554/Streaming/Channels/101', '/ISAPI/Streaming/channels/101/picture', NOW(), NOW()),
('TEST-CH-002', 'TEST-ISAPI-003', 2, 'NVR通道2-出口', TRUE, 'MAIN',
 'rtsp://192.168.1.200:554/Streaming/Channels/201', '/ISAPI/Streaming/channels/201/picture', NOW(), NOW()),
('TEST-CH-003', 'TEST-ISAPI-003', 3, 'NVR通道3-车间', FALSE, 'SUB',
 'rtsp://192.168.1.200:554/Streaming/Channels/302', '/ISAPI/Streaming/channels/302/picture', NOW(), NOW());

-- ============================================================
-- 7. IoT Devices (IoT device registry)
-- ============================================================

INSERT INTO iot_devices (
    id, factory_id, device_code, device_name, device_type, equipment_id,
    protocol_id, mqtt_topic, status, last_reading, last_reading_at,
    created_at, updated_at
) VALUES
('TEST-IOT-001', 'F001', 'SCALE-TEST-001', '测试电子秤1', 'SCALE', 9001,
 'TEST-P001', 'factory/F001/scale/TEST-IOT-001/data', 'IDLE', '12345.0', NOW(),
 NOW(), NOW()),
('TEST-IOT-002', 'F001', 'SCALE-TEST-002', '测试电子秤2', 'SCALE', 9002,
 'TEST-P002', 'factory/F001/scale/TEST-IOT-002/data', 'RUNNING', '67890.5', NOW(),
 NOW(), NOW()),
('TEST-IOT-003', 'F001', 'SENSOR-TEST-001', '测试传感器1', 'SENSOR', NULL,
 NULL, 'factory/F001/sensor/TEST-IOT-003/data', 'OFFLINE', NULL, NULL,
 NOW(), NOW());

-- ============================================================
-- Verification Query
-- ============================================================
-- SELECT 'factory_equipments' as table_name, COUNT(*) as count FROM factory_equipments WHERE id >= 9001;
-- SELECT 'scale_protocol_configs' as table_name, COUNT(*) as count FROM scale_protocol_configs WHERE id LIKE 'TEST-%';
-- SELECT 'scale_brand_models' as table_name, COUNT(*) as count FROM scale_brand_models WHERE id LIKE 'TEST-%';
-- SELECT 'scale_protocol_test_cases' as table_name, COUNT(*) as count FROM scale_protocol_test_cases WHERE id LIKE 'TEST-%';
-- SELECT 'isapi_devices' as table_name, COUNT(*) as count FROM isapi_devices WHERE id LIKE 'TEST-%';
-- SELECT 'isapi_device_channels' as table_name, COUNT(*) as count FROM isapi_device_channels WHERE id LIKE 'TEST-%';
-- SELECT 'iot_devices' as table_name, COUNT(*) as count FROM iot_devices WHERE id LIKE 'TEST-%';
