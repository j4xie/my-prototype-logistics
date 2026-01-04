package com.cretas.edge.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PreDestroy;

/**
 * MQTT 连接配置
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "mqtt")
public class MqttConfig {

    /**
     * MQTT Broker 地址 (如 tcp://broker.emqx.io:1883)
     */
    private String brokerUrl = "tcp://localhost:1883";

    /**
     * 客户端ID前缀
     */
    private String clientIdPrefix = "cretas-edge";

    /**
     * 用户名
     */
    private String username;

    /**
     * 密码
     */
    private String password;

    /**
     * 连接超时时间 (秒)
     */
    private int connectionTimeout = 30;

    /**
     * 心跳间隔 (秒)
     */
    private int keepAliveInterval = 60;

    /**
     * 是否自动重连
     */
    private boolean autoReconnect = true;

    /**
     * 最大重连延迟 (毫秒)
     */
    private int maxReconnectDelay = 128000;

    /**
     * 清除会话
     */
    private boolean cleanSession = true;

    /**
     * QoS 级别 (0, 1, 2)
     */
    private int qos = 1;

    /**
     * 数据上报主题前缀
     */
    private String topicPrefix = "cretas/scale";

    /**
     * 是否启用 MQTT
     */
    private boolean enabled = true;

    private MqttClient mqttClient;

    /**
     * 创建 MQTT 客户端
     */
    @Bean
    public MqttClient mqttClient() throws MqttException {
        if (!enabled) {
            log.warn("MQTT is disabled, skipping client creation");
            return null;
        }

        String clientId = clientIdPrefix + "-" + System.currentTimeMillis();
        log.info("Creating MQTT client with clientId: {}", clientId);

        mqttClient = new MqttClient(brokerUrl, clientId, new MemoryPersistence());

        MqttConnectOptions options = buildConnectOptions();

        try {
            mqttClient.connect(options);
            log.info("MQTT client connected successfully to {}", brokerUrl);
        } catch (MqttException e) {
            log.error("Failed to connect to MQTT broker: {}", e.getMessage());
            // 不抛出异常，允许应用启动，后续重连
        }

        return mqttClient;
    }

    /**
     * 构建连接选项
     */
    private MqttConnectOptions buildConnectOptions() {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setCleanSession(cleanSession);
        options.setConnectionTimeout(connectionTimeout);
        options.setKeepAliveInterval(keepAliveInterval);
        options.setAutomaticReconnect(autoReconnect);
        options.setMaxReconnectDelay(maxReconnectDelay);

        if (username != null && !username.isEmpty()) {
            options.setUserName(username);
        }
        if (password != null && !password.isEmpty()) {
            options.setPassword(password.toCharArray());
        }

        return options;
    }

    /**
     * 获取完整的数据上报主题
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @return 完整主题
     */
    public String getDataTopic(String factoryId, String deviceId) {
        return String.format("%s/%s/%s/data", topicPrefix, factoryId, deviceId);
    }

    /**
     * 获取状态上报主题
     */
    public String getStatusTopic(String factoryId, String deviceId) {
        return String.format("%s/%s/%s/status", topicPrefix, factoryId, deviceId);
    }

    /**
     * 获取命令订阅主题
     */
    public String getCommandTopic(String factoryId, String deviceId) {
        return String.format("%s/%s/%s/command", topicPrefix, factoryId, deviceId);
    }

    @PreDestroy
    public void cleanup() {
        if (mqttClient != null && mqttClient.isConnected()) {
            try {
                mqttClient.disconnect();
                log.info("MQTT client disconnected");
            } catch (MqttException e) {
                log.error("Error disconnecting MQTT client: {}", e.getMessage());
            }
        }
    }
}
