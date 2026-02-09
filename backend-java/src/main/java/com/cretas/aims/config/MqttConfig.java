package com.cretas.aims.config;

import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.outbound.MqttPahoMessageHandler;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

import java.util.UUID;

/**
 * MQTT 配置类
 * 用于连接 EMQX Broker，接收 IoT 设备数据
 *
 * 配置示例 (application.yml):
 * mqtt:
 *   enabled: true
 *   broker: tcp://localhost:1883
 *   username: ""
 *   password: ""
 *   client-id-prefix: cretas-backend
 *   topics:
 *     - cretas/+/device/+/data
 *     - cretas/+/device/+/status
 *     - cretas/+/device/+/heartbeat
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Slf4j
@Configuration
@ConditionalOnProperty(name = "mqtt.enabled", havingValue = "true", matchIfMissing = false)
public class MqttConfig {

    @Value("${mqtt.broker:tcp://localhost:1883}")
    private String broker;

    @Value("${mqtt.username:}")
    private String username;

    @Value("${mqtt.password:}")
    private String password;

    @Value("${mqtt.client-id-prefix:cretas-backend}")
    private String clientIdPrefix;

    @Value("${mqtt.topics:cretas/+/device/+/data,cretas/+/device/+/status,cretas/+/device/+/heartbeat}")
    private String[] topics;

    @Value("${mqtt.qos:1}")
    private int qos;

    @Value("${mqtt.connection-timeout:30}")
    private int connectionTimeout;

    @Value("${mqtt.keep-alive-interval:60}")
    private int keepAliveInterval;

    @Value("${mqtt.auto-reconnect:true}")
    private boolean autoReconnect;

    /**
     * MQTT 客户端工厂
     */
    @Bean
    public MqttPahoClientFactory mqttClientFactory() {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions options = new MqttConnectOptions();

        options.setServerURIs(new String[]{broker});
        options.setConnectionTimeout(connectionTimeout);
        options.setKeepAliveInterval(keepAliveInterval);
        options.setAutomaticReconnect(autoReconnect);
        options.setCleanSession(true);

        if (username != null && !username.isEmpty()) {
            options.setUserName(username);
        }
        if (password != null && !password.isEmpty()) {
            options.setPassword(password.toCharArray());
        }

        factory.setConnectionOptions(options);
        log.info("MQTT 客户端工厂已配置: broker={}", broker);
        return factory;
    }

    /**
     * 入站消息通道
     */
    @Bean
    public MessageChannel mqttInputChannel() {
        return new DirectChannel();
    }

    /**
     * MQTT 入站适配器 (订阅设备消息)
     */
    @Bean
    public MqttPahoMessageDrivenChannelAdapter mqttInboundAdapter(
            MqttPahoClientFactory mqttClientFactory) {

        String clientId = clientIdPrefix + "-inbound-" + UUID.randomUUID().toString().substring(0, 8);

        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(clientId, mqttClientFactory, topics);

        adapter.setCompletionTimeout(5000);
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(qos);
        adapter.setOutputChannel(mqttInputChannel());

        log.info("MQTT 入站适配器已配置: clientId={}, topics={}", clientId, String.join(",", topics));
        return adapter;
    }

    /**
     * 出站消息通道
     */
    @Bean
    public MessageChannel mqttOutputChannel() {
        return new DirectChannel();
    }

    /**
     * MQTT 出站适配器 (发送指令到设备)
     */
    @Bean
    @ServiceActivator(inputChannel = "mqttOutputChannel")
    public MessageHandler mqttOutboundHandler(MqttPahoClientFactory mqttClientFactory) {
        String clientId = clientIdPrefix + "-outbound-" + UUID.randomUUID().toString().substring(0, 8);

        MqttPahoMessageHandler handler = new MqttPahoMessageHandler(clientId, mqttClientFactory);
        handler.setAsync(true);
        handler.setDefaultQos(qos);

        log.info("MQTT 出站处理器已配置: clientId={}", clientId);
        return handler;
    }
}
