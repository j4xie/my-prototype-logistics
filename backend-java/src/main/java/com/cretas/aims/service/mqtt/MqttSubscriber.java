package com.cretas.aims.service.mqtt;

import com.cretas.aims.service.IotDataService;
import com.cretas.aims.websocket.EquipmentMonitoringHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHeaders;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * MQTT 消息订阅处理服务
 * 接收来自边缘网关的 IoT 设备数据，进行解析、存储和转发
 *
 * 主题格式:
 * - cretas/{factoryId}/device/{deviceId}/data      - 设备数据
 * - cretas/{factoryId}/device/{deviceId}/status    - 设备状态
 * - cretas/{factoryId}/device/{deviceId}/heartbeat - 设备心跳
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "mqtt.enabled", havingValue = "true", matchIfMissing = false)
public class MqttSubscriber {

    private final ObjectMapper objectMapper;
    private final EquipmentMonitoringHandler equipmentMonitoringHandler;
    private final IotDataService iotDataService;

    // 主题解析正则: cretas/{factoryId}/device/{deviceId}/{messageType}
    private static final Pattern TOPIC_PATTERN = Pattern.compile(
            "cretas/([^/]+)/device/([^/]+)/([^/]+)"
    );

    /**
     * MQTT 消息处理入口
     * 接收 mqttInputChannel 的所有消息
     */
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void handleMessage(Message<?> message) {
        try {
            String topic = extractTopic(message.getHeaders());
            String payload = message.getPayload().toString();

            log.debug("收到 MQTT 消息: topic={}, payload={}", topic, payload);

            // 解析主题
            Matcher matcher = TOPIC_PATTERN.matcher(topic);
            if (!matcher.matches()) {
                log.warn("无法解析主题格式: {}", topic);
                return;
            }

            String factoryId = matcher.group(1);
            String deviceId = matcher.group(2);
            String messageType = matcher.group(3);

            // 根据消息类型分发处理
            switch (messageType) {
                case "data":
                    handleDeviceData(factoryId, deviceId, payload);
                    break;
                case "status":
                    handleDeviceStatus(factoryId, deviceId, payload);
                    break;
                case "heartbeat":
                    handleHeartbeat(factoryId, deviceId, payload);
                    break;
                default:
                    log.warn("未知消息类型: {}", messageType);
            }

        } catch (Exception e) {
            log.error("MQTT 消息处理失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 处理设备数据 (称重、温度等)
     */
    private void handleDeviceData(String factoryId, String deviceId, String payload) {
        try {
            JsonNode data = objectMapper.readTree(payload);
            String dataType = data.has("type") ? data.get("type").asText() : "UNKNOWN";

            log.info("设备数据: factory={}, device={}, type={}", factoryId, deviceId, dataType);

            switch (dataType) {
                case "WEIGHT":
                    handleWeightData(factoryId, deviceId, data);
                    break;
                case "TEMPERATURE":
                    handleTemperatureData(factoryId, deviceId, data);
                    break;
                case "HUMIDITY":
                    handleHumidityData(factoryId, deviceId, data);
                    break;
                case "IMAGE":
                case "CAMERA_EVENT":
                    handleCameraData(factoryId, deviceId, data);
                    break;
                default:
                    log.debug("未处理的数据类型: {}, 仍存储数据", dataType);
                    // 存储未知类型的数据
                    iotDataService.saveDeviceData(factoryId, deviceId, dataType, data);
            }

            // 推送到 WebSocket 前端
            pushToWebSocket(factoryId, "DEVICE_DATA", data);

        } catch (Exception e) {
            log.error("设备数据处理失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 处理称重数据
     */
    private void handleWeightData(String factoryId, String deviceId, JsonNode data) {
        JsonNode weightData = data.get("data");
        if (weightData == null) return;

        double weight = weightData.has("weight") ? weightData.get("weight").asDouble() : 0;
        String unit = weightData.has("unit") ? weightData.get("unit").asText() : "kg";
        boolean stable = weightData.has("stable") && weightData.get("stable").asBoolean();

        log.info("称重数据: device={}, weight={}{}, stable={}",
                deviceId, weight, unit, stable);

        // 1. 存储到 iot_device_data 表
        iotDataService.saveDeviceData(factoryId, deviceId, "WEIGHT", data);

        // 2. 更新 FactoryEquipment.lastWeightReading
        iotDataService.updateEquipmentLastWeight(
                deviceId,
                BigDecimal.valueOf(weight),
                LocalDateTime.now()
        );

        // 3. 如果稳定，记录日志（未来可触发自动入库流程）
        if (stable) {
            log.info("称重稳定，可触发自动入库: device={}, weight={}{}", deviceId, weight, unit);
            // TODO: 未来可调用 MaterialBatchService.autoInbound()
        }
    }

    /**
     * 处理温度数据
     */
    private void handleTemperatureData(String factoryId, String deviceId, JsonNode data) {
        JsonNode tempData = data.get("data");
        if (tempData == null) return;

        double temperature = tempData.has("temperature") ? tempData.get("temperature").asDouble() : 0;

        log.info("温度数据: device={}, temperature={}°C", deviceId, temperature);

        // 1. 存储数据
        iotDataService.saveDeviceData(factoryId, deviceId, "TEMPERATURE", data);

        // 2. 检查温度阈值告警 (冷链超过 -18°C 或常温超过 25°C)
        iotDataService.checkTemperatureThreshold(factoryId, deviceId, temperature);
    }

    /**
     * 处理湿度数据
     */
    private void handleHumidityData(String factoryId, String deviceId, JsonNode data) {
        JsonNode humidityData = data.get("data");
        if (humidityData == null) return;

        double humidity = humidityData.has("humidity") ? humidityData.get("humidity").asDouble() : 0;

        log.info("湿度数据: device={}, humidity={}%", deviceId, humidity);

        // 1. 存储数据
        iotDataService.saveDeviceData(factoryId, deviceId, "HUMIDITY", data);

        // 2. 检查湿度阈值告警 (仓库湿度范围 40%-70%)
        iotDataService.checkHumidityThreshold(factoryId, deviceId, humidity);
    }

    /**
     * 处理摄像头事件
     */
    private void handleCameraData(String factoryId, String deviceId, JsonNode data) {
        JsonNode cameraData = data.get("data");
        if (cameraData == null) return;

        String eventType = cameraData.has("eventType") ? cameraData.get("eventType").asText() : "SNAPSHOT";
        String imageUrl = cameraData.has("imageUrl") ? cameraData.get("imageUrl").asText() : null;

        log.info("摄像头事件: device={}, eventType={}, imageUrl={}", deviceId, eventType, imageUrl);

        // 1. 存储事件数据
        iotDataService.saveDeviceData(factoryId, deviceId, "IMAGE", data);

        // 2. 特殊事件处理（异常检测、动作检测）
        if ("MOTION_DETECTED".equals(eventType) || "ANOMALY".equals(eventType)) {
            iotDataService.createDeviceAlert(factoryId, deviceId, "CAMERA_EVENT",
                    "检测到异常事件: " + eventType);
        }

        // 3. 推送到前端实时显示
        pushToWebSocket(factoryId, "CAMERA_EVENT", data);
    }

    /**
     * 处理设备状态
     */
    private void handleDeviceStatus(String factoryId, String deviceId, String payload) {
        try {
            JsonNode data = objectMapper.readTree(payload);
            String status = data.has("status") ? data.get("status").asText() : "UNKNOWN";

            log.info("设备状态变更: factory={}, device={}, status={}",
                    factoryId, deviceId, status);

            // 1. 更新 iot_devices.status
            iotDataService.updateDeviceStatus(factoryId, deviceId, status);

            // 2. 如果状态为 ERROR，创建告警
            if ("ERROR".equals(status)) {
                String errorMsg = data.has("message") ? data.get("message").asText() : "设备异常";
                iotDataService.createDeviceAlert(factoryId, deviceId, "DEVICE_ERROR", errorMsg);
            }

            // 推送到 WebSocket 前端
            pushToWebSocket(factoryId, "DEVICE_STATUS", data);

        } catch (Exception e) {
            log.error("设备状态处理失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 处理设备心跳
     */
    private void handleHeartbeat(String factoryId, String deviceId, String payload) {
        try {
            log.debug("设备心跳: factory={}, device={}", factoryId, deviceId);

            // 更新 iot_devices.last_heartbeat 和设备在线状态
            iotDataService.updateDeviceHeartbeat(factoryId, deviceId);

        } catch (Exception e) {
            log.error("设备心跳处理失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 推送数据到 WebSocket
     */
    private void pushToWebSocket(String factoryId, String eventType, JsonNode data) {
        try {
            // 复用现有 EquipmentMonitoringHandler 的 WebSocket 推送能力
            // 格式: { "type": "IOT_DATA", "eventType": "DEVICE_DATA", "data": {...} }
            equipmentMonitoringHandler.broadcastToFactory(factoryId,
                    "IOT_" + eventType,
                    objectMapper.writeValueAsString(data));
        } catch (Exception e) {
            log.error("WebSocket 推送失败: {}", e.getMessage());
        }
    }

    /**
     * 从消息头中提取主题
     */
    private String extractTopic(MessageHeaders headers) {
        Object topic = headers.get("mqtt_receivedTopic");
        return topic != null ? topic.toString() : "";
    }
}
