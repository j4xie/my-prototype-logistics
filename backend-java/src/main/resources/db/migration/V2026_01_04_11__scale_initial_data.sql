-- =============================================
-- 秤协议初始数据
-- Scale Protocol Initial Data
-- 内置协议配置 + 品牌型号库
-- =============================================

-- ========================================
-- 1. 内置协议配置
-- ========================================

-- 1.1 柯力 D2008 ASCII协议 (最常用)
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name,
    connection_type, serial_config, frame_format,
    checksum_type, read_mode, stable_threshold_ms,
    description, documentation_url, sample_data_hex,
    is_active, is_verified, is_builtin
) VALUES (
    'proto-keli-d2008-ascii',
    NULL,
    'KELI_D2008_ASCII',
    '柯力D2008 ASCII标准协议',
    'RS232',
    '{"baudRate": 9600, "dataBits": 8, "stopBits": 1, "parity": "NONE", "flowControl": "NONE"}',
    '{
        "frameType": "ASCII_FIXED",
        "encoding": "US-ASCII",
        "frameLength": 12,
        "startMarker": null,
        "endMarker": "\\r\\n",
        "fields": [
            {"name": "sign", "start": 0, "length": 1, "type": "CHAR", "description": "符号 +/-"},
            {"name": "weight", "start": 1, "length": 6, "type": "DECIMAL", "decimalPlaces": 1, "description": "重量值"},
            {"name": "unit", "start": 8, "length": 2, "type": "STRING", "trim": true, "description": "单位"},
            {"name": "stable", "start": 10, "length": 1, "type": "ENUM", "mapping": {"S": true, "U": false}, "description": "稳定标志"}
        ],
        "outputMapping": {
            "weight": "${sign == ''-'' ? -weight : weight}",
            "unit": "${unit}",
            "stable": "${stable}"
        }
    }',
    'NONE',
    'CONTINUOUS',
    500,
    '柯力D2008系列仪表标准ASCII输出协议，支持连续输出模式。数据格式：±XXXXXX kg S/U，其中±为符号，XXXXXX为6位重量值，S表示稳定，U表示不稳定。',
    'http://www.kelichina.com/uploads/soft/20231205/1-231205205524B7.pdf',
    '2B303031323430206B6720530D0A',
    TRUE, TRUE, TRUE
);

-- 1.2 耀华 XK3190 ASCII协议
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name,
    connection_type, serial_config, frame_format,
    checksum_type, read_mode, stable_threshold_ms,
    description, sample_data_hex,
    is_active, is_verified, is_builtin
) VALUES (
    'proto-yaohua-xk3190-ascii',
    NULL,
    'YAOHUA_XK3190_ASCII',
    '耀华XK3190 ASCII协议',
    'RS232',
    '{"baudRate": 9600, "dataBits": 8, "stopBits": 1, "parity": "NONE", "flowControl": "NONE"}',
    '{
        "frameType": "ASCII_FIXED",
        "encoding": "US-ASCII",
        "frameLength": 14,
        "startMarker": "=",
        "endMarker": "\\r\\n",
        "fields": [
            {"name": "sign", "start": 1, "length": 1, "type": "CHAR", "description": "符号"},
            {"name": "weight", "start": 2, "length": 7, "type": "DECIMAL", "decimalPlaces": 2, "description": "重量值"},
            {"name": "unit", "start": 9, "length": 2, "type": "STRING", "trim": true, "description": "单位"},
            {"name": "stable", "start": 11, "length": 1, "type": "ENUM", "mapping": {"S": true, "M": false}, "description": "稳定标志S/M"}
        ]
    }',
    'NONE',
    'CONTINUOUS',
    500,
    '耀华XK3190系列称重显示器ASCII协议，格式：=±XXXXXXX kg S/M',
    '3D2B30303132352E3430206B6720530D0A',
    TRUE, FALSE, TRUE
);

-- 1.3 矽策 XC709S HTTP API协议 (内置WiFi)
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name,
    connection_type, api_config, frame_format,
    read_mode, stable_threshold_ms,
    description, documentation_url,
    is_active, is_verified, is_builtin
) VALUES (
    'proto-xice-xc709s-http',
    NULL,
    'XICE_XC709S_HTTP',
    '矽策XC709S HTTP API协议',
    'HTTP_API',
    '{
        "baseUrl": "http://{deviceIp}:8080/api",
        "authType": "BEARER",
        "endpoints": {
            "getWeight": {"method": "GET", "path": "/weight/current"},
            "getStatus": {"method": "GET", "path": "/device/status"},
            "tare": {"method": "POST", "path": "/weight/tare"}
        },
        "headers": {"Content-Type": "application/json"}
    }',
    '{
        "frameType": "JSON",
        "encoding": "UTF-8",
        "responseMapping": {
            "weight": "$.data.weight",
            "unit": "$.data.unit",
            "stable": "$.data.stable",
            "tare": "$.data.tare",
            "net": "$.data.net"
        }
    }',
    'POLL',
    300,
    '矽策XC709S智能WiFi电子秤HTTP API，支持双频WiFi，返回JSON格式数据。适用于高精度小型称重场景。',
    'https://www.xicetech.com/docs/xc709s-api',
    TRUE, FALSE, TRUE
);

-- 1.4 通用 Modbus RTU 协议
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name,
    connection_type, serial_config, modbus_config, frame_format,
    checksum_type, read_mode,
    description,
    is_active, is_verified, is_builtin
) VALUES (
    'proto-modbus-rtu-standard',
    NULL,
    'MODBUS_RTU_STANDARD',
    '通用Modbus RTU协议',
    'MODBUS_RTU',
    '{"baudRate": 9600, "dataBits": 8, "stopBits": 1, "parity": "NONE"}',
    '{"slaveId": 1, "functionCode": 3, "registerAddress": 0, "registerCount": 2, "dataType": "FLOAT32_ABCD"}',
    '{
        "frameType": "MODBUS_RTU",
        "registerLayout": [
            {"name": "weight", "registerStart": 0, "registerCount": 2, "dataType": "FLOAT32_ABCD", "scale": 1},
            {"name": "status", "registerStart": 2, "registerCount": 1, "dataType": "UINT16", "bitMapping": {"stable": 0}}
        ]
    }',
    'MODBUS_CRC',
    'POLL',
    '通用Modbus RTU协议，适用于支持Modbus的工业电子秤。寄存器0-1存储重量(32位浮点)，寄存器2存储状态。',
    TRUE, TRUE, TRUE
);

-- 1.5 托利多 IND570 串口协议
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name,
    connection_type, serial_config, frame_format,
    checksum_type, read_mode,
    description,
    is_active, is_verified, is_builtin
) VALUES (
    'proto-toledo-ind570',
    NULL,
    'TOLEDO_IND570_ASCII',
    '托利多IND570 ASCII协议',
    'RS232',
    '{"baudRate": 9600, "dataBits": 8, "stopBits": 1, "parity": "ODD"}',
    '{
        "frameType": "ASCII_VARIABLE",
        "encoding": "US-ASCII",
        "startMarker": "STX",
        "endMarker": "ETX",
        "fields": [
            {"name": "status", "start": 1, "length": 2, "type": "HEX", "description": "状态字节"},
            {"name": "weight", "start": 3, "length": 8, "type": "DECIMAL", "decimalPlaces": 2},
            {"name": "unit", "start": 11, "length": 3, "type": "STRING", "trim": true}
        ],
        "stableCheck": {"field": "status", "bit": 0, "value": 1}
    }',
    'XOR',
    'CONTINUOUS',
    '梅特勒-托利多IND570称重终端ASCII协议，STX...ETX帧格式，带XOR校验。',
    TRUE, FALSE, TRUE
);

-- 1.6 MQTT 通用物联网秤协议
INSERT INTO scale_protocol_configs (
    id, factory_id, protocol_code, protocol_name,
    connection_type, api_config, frame_format,
    read_mode,
    description,
    is_active, is_verified, is_builtin
) VALUES (
    'proto-mqtt-iot-scale',
    NULL,
    'MQTT_IOT_SCALE',
    'MQTT物联网秤通用协议',
    'MQTT',
    '{
        "broker": "tcp://{mqttBroker}:1883",
        "subscribeTopic": "scale/{deviceId}/data",
        "publishTopic": "scale/{deviceId}/command",
        "qos": 1,
        "authType": "USERNAME_PASSWORD"
    }',
    '{
        "frameType": "JSON",
        "encoding": "UTF-8",
        "responseMapping": {
            "weight": "$.weight",
            "unit": "$.unit",
            "stable": "$.stable",
            "timestamp": "$.ts",
            "deviceId": "$.deviceId"
        }
    }',
    'ON_CHANGE',
    'MQTT物联网秤通用协议，设备通过MQTT上报JSON格式称重数据。适用于亚津、巨天等物联网秤。',
    TRUE, FALSE, TRUE
);


-- ========================================
-- 2. 品牌型号库
-- ========================================

-- 2.1 柯力 D2008 系列
INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_name_en,
    model_code, model_name,
    supported_protocol_ids, default_protocol_id,
    has_serial_port, has_wifi, has_ethernet,
    weight_range, accuracy, scale_type,
    ip_rating, material,
    manufacturer, manufacturer_website, documentation_url,
    price_range, recommendation_score, recommendation_reason,
    is_verified, is_recommended
) VALUES (
    'brand-keli-d2008',
    'KELI', '柯力', 'Keli',
    'D2008', '柯力D2008称重仪表',
    '["proto-keli-d2008-ascii", "proto-modbus-rtu-standard"]',
    'proto-keli-d2008-ascii',
    TRUE, FALSE, FALSE,
    '30kg-150kg', '±0.01kg', 'PLATFORM',
    'IP54', '不锈钢外壳',
    '宁波柯力传感科技股份有限公司',
    'https://www.kelichina.com',
    'http://www.kelichina.com/uploads/soft/20231205/1-231205205524B7.pdf',
    '¥1,200-1,800',
    85,
    '官方协议文档完善，社区资源丰富，性价比高，适合中小型台秤应用',
    TRUE, TRUE
);

-- 2.2 柯力 D2008-SS (不锈钢防水版)
INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_name_en,
    model_code, model_name,
    supported_protocol_ids, default_protocol_id,
    has_serial_port, has_wifi, has_ethernet,
    weight_range, accuracy, scale_type,
    ip_rating, material,
    price_range, recommendation_score, recommendation_reason,
    is_verified, is_recommended
) VALUES (
    'brand-keli-d2008-ss',
    'KELI', '柯力', 'Keli',
    'D2008-SS', '柯力D2008-SS全不锈钢版',
    '["proto-keli-d2008-ascii", "proto-modbus-rtu-standard"]',
    'proto-keli-d2008-ascii',
    TRUE, FALSE, FALSE,
    '300kg-500kg', '±0.05kg', 'PLATFORM',
    'IP68', '304不锈钢',
    '¥3,500-4,500',
    90,
    '食品加工厂首选，IP68防水防腐，适合潮湿环境，中型磅秤应用',
    TRUE, TRUE
);

-- 2.3 耀华 XK3190-A12
INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_name_en,
    model_code, model_name,
    supported_protocol_ids, default_protocol_id,
    has_serial_port, has_wifi, has_ethernet,
    weight_range, accuracy, scale_type,
    ip_rating,
    price_range, recommendation_score, recommendation_reason,
    is_verified, is_recommended
) VALUES (
    'brand-yaohua-xk3190-a12',
    'YAOHUA', '耀华', 'Yaohua',
    'XK3190-A12', '耀华XK3190-A12称重显示器',
    '["proto-yaohua-xk3190-ascii"]',
    'proto-yaohua-xk3190-ascii',
    TRUE, FALSE, FALSE,
    '30kg-500kg', '±0.02kg', 'PLATFORM',
    'IP54',
    '¥800-1,200',
    75,
    '国产经济型选择，市场保有量大，但官方协议文档需联系售后获取',
    FALSE, FALSE
);

-- 2.4 矽策 XC709S (内置WiFi)
INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_name_en,
    model_code, model_name,
    supported_protocol_ids, default_protocol_id,
    has_serial_port, has_wifi, has_ethernet, has_bluetooth,
    weight_range, accuracy, scale_type,
    ip_rating, material,
    price_range, recommendation_score, recommendation_reason,
    is_verified, is_recommended
) VALUES (
    'brand-xice-xc709s',
    'XICE', '矽策', 'Xice',
    'XC709S', '矽策XC709S智能WiFi电子秤',
    '["proto-xice-xc709s-http"]',
    'proto-xice-xc709s-http',
    TRUE, TRUE, FALSE, TRUE,
    '3kg-30kg', '±0.001kg', 'DESKTOP',
    'IP65', '304不锈钢秤盘',
    '¥1,500-2,000',
    95,
    '内置双频WiFi+蓝牙，开放HTTP API，开发最简单，适合桌面高精度称重场景',
    FALSE, TRUE
);

-- 2.5 托利多 IND570
INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_name_en,
    model_code, model_name,
    supported_protocol_ids, default_protocol_id,
    has_serial_port, has_wifi, has_ethernet, has_usb,
    weight_range, accuracy, scale_type,
    ip_rating, material,
    manufacturer, manufacturer_website,
    price_range, recommendation_score, recommendation_reason,
    is_verified, is_recommended
) VALUES (
    'brand-toledo-ind570',
    'TOLEDO', '托利多', 'Mettler Toledo',
    'IND570', '托利多IND570称重终端',
    '["proto-toledo-ind570", "proto-modbus-rtu-standard"]',
    'proto-toledo-ind570',
    TRUE, TRUE, TRUE, TRUE,
    '最高可连接100t', '取决于传感器', 'FLOOR',
    'IP69K', '不锈钢外壳',
    '梅特勒-托利多',
    'https://www.mt.com',
    '¥8,000-15,000',
    80,
    '国际品牌，功能强大，支持多种接口，但价格较高，适合高端应用场景',
    FALSE, FALSE
);

-- 2.6 亚津 SCS-HT 防水地磅
INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_name_en,
    model_code, model_name,
    supported_protocol_ids, default_protocol_id,
    has_serial_port, has_wifi, has_ethernet,
    weight_range, accuracy, scale_type,
    ip_rating, material,
    manufacturer, manufacturer_website,
    price_range, recommendation_score, recommendation_reason,
    is_verified, is_recommended
) VALUES (
    'brand-yajin-scs-ht',
    'YAJIN', '亚津', 'Yajin',
    'SCS-HT', '亚津SCS-HT防水地磅',
    '["proto-keli-d2008-ascii", "proto-modbus-rtu-standard"]',
    'proto-keli-d2008-ascii',
    TRUE, FALSE, FALSE,
    '500kg-3T', '±0.1kg', 'FLOOR',
    'IP68', '304不锈钢+碳钢秤体',
    '上海亚津电子科技有限公司',
    'https://www.maihengqi.com',
    '¥5,500-8,000',
    82,
    '食品厂大型地磅选择，防水防腐，使用柯力兼容协议，可配套衡管家云平台',
    FALSE, TRUE
);

-- 2.7 物联网秤 (通用型)
INSERT INTO scale_brand_models (
    id, brand_code, brand_name, brand_name_en,
    model_code, model_name,
    supported_protocol_ids, default_protocol_id,
    has_serial_port, has_wifi, has_ethernet,
    weight_range, scale_type,
    recommendation_score, recommendation_reason,
    is_verified, is_recommended
) VALUES (
    'brand-iot-generic',
    'IOT_GENERIC', '物联网通用', 'IoT Generic',
    'MQTT_SCALE', 'MQTT物联网电子秤',
    '["proto-mqtt-iot-scale"]',
    'proto-mqtt-iot-scale',
    FALSE, TRUE, TRUE,
    '视具体产品', 'PLATFORM',
    70,
    '适用于支持MQTT协议的各类物联网秤，如亚津物联网版、巨天4G秤等',
    FALSE, FALSE
);


-- ========================================
-- 3. 测试用例数据
-- ========================================

-- 柯力 D2008 测试用例
INSERT INTO scale_protocol_test_cases (id, protocol_id, test_name, test_description, input_data_hex, input_data_ascii, expected_weight, expected_unit, expected_stable, is_negative_test, priority) VALUES
('test-keli-001', 'proto-keli-d2008-ascii', '正常稳定读数', '测试正常的稳定称重数据', '2B303031323430206B6720530D0A', '+001240 kg S', 124.0, 'kg', TRUE, FALSE, 1),
('test-keli-002', 'proto-keli-d2008-ascii', '负值读数', '测试负值称重(去皮后)', '2D303030353230206B6720530D0A', '-000520 kg S', -52.0, 'kg', TRUE, FALSE, 1),
('test-keli-003', 'proto-keli-d2008-ascii', '不稳定读数', '测试不稳定状态', '2B303031323435206B6720550D0A', '+001245 kg U', 124.5, 'kg', FALSE, FALSE, 2),
('test-keli-004', 'proto-keli-d2008-ascii', '零值读数', '测试零值', '2B303030303030206B6720530D0A', '+000000 kg S', 0, 'kg', TRUE, FALSE, 2),
('test-keli-005', 'proto-keli-d2008-ascii', '最大值', '测试边界最大值', '2B393939393939206B6720530D0A', '+999999 kg S', 99999.9, 'kg', TRUE, FALSE, 3);

-- 耀华 XK3190 测试用例
INSERT INTO scale_protocol_test_cases (id, protocol_id, test_name, test_description, input_data_hex, input_data_ascii, expected_weight, expected_unit, expected_stable, is_negative_test, priority) VALUES
('test-yaohua-001', 'proto-yaohua-xk3190-ascii', '正常稳定读数', '测试正常的稳定称重数据', '3D2B30303132352E3430206B6720530D0A', '=+00125.40 kg S', 125.40, 'kg', TRUE, FALSE, 1),
('test-yaohua-002', 'proto-yaohua-xk3190-ascii', '运动状态', '测试运动/不稳定状态', '3D2B30303132352E3432206B67204D0D0A', '=+00125.42 kg M', 125.42, 'kg', FALSE, FALSE, 2);
