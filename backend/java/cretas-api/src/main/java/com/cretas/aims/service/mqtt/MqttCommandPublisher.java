package com.cretas.aims.service.mqtt;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.integration.support.MessageBuilder;
import org.springframework.messaging.MessageChannel;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * MQTT 指令发布服务
 * 向 IoT 设备发送控制指令
 *
 * 主题格式: cretas/{factoryId}/device/{deviceId}/command
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "mqtt.enabled", havingValue = "true", matchIfMissing = false)
public class MqttCommandPublisher {

    private final MessageChannel mqttOutputChannel;

    /**
     * 发送指令到指定设备
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param command   指令类型 (RESTART, CONFIG_UPDATE, TARE 等)
     * @param params    指令参数
     */
    public void sendCommand(String factoryId, String deviceId, String command, Map<String, Object> params) {
        String topic = String.format("cretas/%s/device/%s/command", factoryId, deviceId);

        String payload = buildPayload(command, params);

        mqttOutputChannel.send(
                MessageBuilder
                        .withPayload(payload)
                        .setHeader(MqttHeaders.TOPIC, topic)
                        .setHeader(MqttHeaders.QOS, 1)
                        .build()
        );

        log.info("已发送指令: topic={}, command={}", topic, command);
    }

    /**
     * 发送重启指令
     */
    public void sendRestartCommand(String factoryId, String deviceId) {
        sendCommand(factoryId, deviceId, "RESTART", null);
    }

    /**
     * 发送去皮指令 (电子秤)
     */
    public void sendTareCommand(String factoryId, String deviceId) {
        sendCommand(factoryId, deviceId, "TARE", null);
    }

    /**
     * 发送置零指令 (电子秤)
     */
    public void sendZeroCommand(String factoryId, String deviceId) {
        sendCommand(factoryId, deviceId, "ZERO", null);
    }

    /**
     * 发送配置更新指令
     */
    public void sendConfigUpdate(String factoryId, String deviceId, Map<String, Object> config) {
        sendCommand(factoryId, deviceId, "CONFIG_UPDATE", config);
    }

    /**
     * 广播指令到工厂所有设备
     */
    public void broadcastCommand(String factoryId, String command, Map<String, Object> params) {
        String topic = String.format("cretas/%s/device/+/command", factoryId);
        String payload = buildPayload(command, params);

        mqttOutputChannel.send(
                MessageBuilder
                        .withPayload(payload)
                        .setHeader(MqttHeaders.TOPIC, topic)
                        .setHeader(MqttHeaders.QOS, 1)
                        .build()
        );

        log.info("已广播指令: topic={}, command={}", topic, command);
    }

    /**
     * 构建指令 payload
     */
    private String buildPayload(String command, Map<String, Object> params) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"command\":\"").append(command).append("\"");
        sb.append(",\"timestamp\":\"").append(java.time.Instant.now()).append("\"");

        if (params != null && !params.isEmpty()) {
            sb.append(",\"params\":{");
            boolean first = true;
            for (Map.Entry<String, Object> entry : params.entrySet()) {
                if (!first) sb.append(",");
                sb.append("\"").append(entry.getKey()).append("\":");
                Object value = entry.getValue();
                if (value instanceof String) {
                    sb.append("\"").append(value).append("\"");
                } else {
                    sb.append(value);
                }
                first = false;
            }
            sb.append("}");
        }

        sb.append("}");
        return sb.toString();
    }
}
