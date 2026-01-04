package com.cretas.edge.uploader;

import com.cretas.edge.config.MqttConfig;
import com.cretas.edge.model.ScaleReading;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * MQTT 数据上报器
 *
 * 功能：
 * 1. 将称重数据通过 MQTT 上报到后端
 * 2. 支持离线缓存和重传
 * 3. 支持批量上报
 * 4. 连接状态监控
 */
@Slf4j
@Component
public class MqttDataUploader {

    private final MqttConfig mqttConfig;
    private final MqttClient mqttClient;
    private final ObjectMapper objectMapper;

    @Value("${gateway.factory-id}")
    private String factoryId;

    @Value("${mqtt.batch-size:10}")
    private int batchSize;

    @Value("${mqtt.flush-interval:1000}")
    private long flushInterval;

    @Value("${mqtt.offline-queue-size:10000}")
    private int offlineQueueSize;

    // 离线消息队列
    private final BlockingQueue<ScaleReading> offlineQueue = new LinkedBlockingQueue<>();

    // 批量发送缓冲区
    private final BlockingQueue<ScaleReading> batchBuffer = new LinkedBlockingQueue<>();

    // 统计信息
    private final AtomicLong totalSent = new AtomicLong(0);
    private final AtomicLong totalFailed = new AtomicLong(0);
    private final AtomicInteger pendingMessages = new AtomicInteger(0);

    // 定时任务
    private ScheduledExecutorService scheduler;

    public MqttDataUploader(MqttConfig mqttConfig, MqttClient mqttClient) {
        this.mqttConfig = mqttConfig;
        this.mqttClient = mqttClient;
        this.objectMapper = createObjectMapper();
    }

    private ObjectMapper createObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }

    @PostConstruct
    public void init() {
        log.info("Initializing MQTT Data Uploader...");

        if (mqttClient != null) {
            // 设置回调
            mqttClient.setCallback(new MqttCallbackExtended() {
                @Override
                public void connectComplete(boolean reconnect, String serverURI) {
                    log.info("MQTT connection {} to {}", reconnect ? "reconnected" : "established", serverURI);
                    // 重连后发送离线缓存的消息
                    if (reconnect) {
                        flushOfflineQueue();
                    }
                }

                @Override
                public void connectionLost(Throwable cause) {
                    log.warn("MQTT connection lost: {}", cause.getMessage());
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    // 处理服务器下发的消息（如配置更新、命令等）
                    handleIncomingMessage(topic, message);
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {
                    pendingMessages.decrementAndGet();
                }
            });
        }

        // 启动定时刷新任务
        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(
                this::flushBatchBuffer,
                flushInterval,
                flushInterval,
                TimeUnit.MILLISECONDS
        );

        log.info("MQTT Data Uploader initialized. Factory ID: {}", factoryId);
    }

    /**
     * 上报称重数据
     *
     * @param reading 称重数据
     * @return true 表示成功加入发送队列
     */
    public boolean upload(ScaleReading reading) {
        if (reading == null) {
            return false;
        }

        // 设置上报时间
        reading.setUploadedAt(LocalDateTime.now());

        // 如果连接正常，加入批量缓冲区
        if (isConnected()) {
            batchBuffer.offer(reading);

            // 如果缓冲区达到批量大小，立即发送
            if (batchBuffer.size() >= batchSize) {
                flushBatchBuffer();
            }
            return true;
        } else {
            // 如果离线，加入离线队列
            return addToOfflineQueue(reading);
        }
    }

    /**
     * 立即发送单条数据
     */
    public boolean uploadImmediate(ScaleReading reading) {
        if (reading == null || !isConnected()) {
            return addToOfflineQueue(reading);
        }

        reading.setUploadedAt(LocalDateTime.now());

        try {
            String topic = mqttConfig.getDataTopic(factoryId, reading.getDeviceId());
            String payload = objectMapper.writeValueAsString(reading);

            MqttMessage message = new MqttMessage(payload.getBytes());
            message.setQos(mqttConfig.getQos());

            pendingMessages.incrementAndGet();
            mqttClient.publish(topic, message);
            totalSent.incrementAndGet();

            log.debug("Data uploaded to topic: {}", topic);
            return true;
        } catch (MqttException | JsonProcessingException e) {
            log.error("Failed to upload data: {}", e.getMessage());
            totalFailed.incrementAndGet();
            pendingMessages.decrementAndGet();
            return addToOfflineQueue(reading);
        }
    }

    /**
     * 刷新批量缓冲区
     */
    private void flushBatchBuffer() {
        if (batchBuffer.isEmpty() || !isConnected()) {
            return;
        }

        try {
            // 取出所有缓冲的数据
            java.util.List<ScaleReading> batch = new java.util.ArrayList<>();
            batchBuffer.drainTo(batch);

            if (batch.isEmpty()) {
                return;
            }

            // 按设备分组发送
            java.util.Map<String, java.util.List<ScaleReading>> groupedByDevice =
                    batch.stream().collect(java.util.stream.Collectors.groupingBy(ScaleReading::getDeviceId));

            for (java.util.Map.Entry<String, java.util.List<ScaleReading>> entry : groupedByDevice.entrySet()) {
                String deviceId = entry.getKey();
                java.util.List<ScaleReading> readings = entry.getValue();

                String topic = mqttConfig.getDataTopic(factoryId, deviceId) + "/batch";
                String payload = objectMapper.writeValueAsString(readings);

                MqttMessage message = new MqttMessage(payload.getBytes());
                message.setQos(mqttConfig.getQos());

                pendingMessages.incrementAndGet();
                mqttClient.publish(topic, message);
                totalSent.addAndGet(readings.size());

                log.debug("Batch data ({} items) uploaded to topic: {}", readings.size(), topic);
            }
        } catch (Exception e) {
            log.error("Failed to flush batch buffer: {}", e.getMessage());
            totalFailed.incrementAndGet();
        }
    }

    /**
     * 刷新离线队列
     */
    private void flushOfflineQueue() {
        if (offlineQueue.isEmpty()) {
            return;
        }

        log.info("Flushing {} offline messages...", offlineQueue.size());

        int sent = 0;
        int failed = 0;

        while (!offlineQueue.isEmpty() && isConnected()) {
            ScaleReading reading = offlineQueue.poll();
            if (reading != null) {
                if (uploadImmediate(reading)) {
                    sent++;
                } else {
                    failed++;
                }
            }
        }

        log.info("Offline queue flushed: {} sent, {} failed, {} remaining",
                sent, failed, offlineQueue.size());
    }

    /**
     * 添加到离线队列
     */
    private boolean addToOfflineQueue(ScaleReading reading) {
        if (reading == null) {
            return false;
        }

        // 如果队列已满，移除最旧的消息
        while (offlineQueue.size() >= offlineQueueSize) {
            offlineQueue.poll();
            log.warn("Offline queue full, dropping oldest message");
        }

        return offlineQueue.offer(reading);
    }

    /**
     * 发送设备状态
     */
    public void sendDeviceStatus(String deviceId, String status) {
        if (!isConnected()) {
            return;
        }

        try {
            String topic = mqttConfig.getStatusTopic(factoryId, deviceId);

            java.util.Map<String, Object> statusMap = new java.util.HashMap<>();
            statusMap.put("deviceId", deviceId);
            statusMap.put("status", status);
            statusMap.put("timestamp", LocalDateTime.now().toString());

            String payload = objectMapper.writeValueAsString(statusMap);

            MqttMessage message = new MqttMessage(payload.getBytes());
            message.setQos(1);
            message.setRetained(true);  // 保留最新状态

            mqttClient.publish(topic, message);
            log.debug("Device status sent: {} -> {}", deviceId, status);
        } catch (Exception e) {
            log.error("Failed to send device status: {}", e.getMessage());
        }
    }

    /**
     * 处理服务器下发的消息
     */
    private void handleIncomingMessage(String topic, MqttMessage message) {
        log.info("Received message on topic: {}", topic);

        try {
            String payload = new String(message.getPayload());
            log.debug("Message payload: {}", payload);

            // TODO: 根据主题处理不同类型的消息
            // 例如：配置更新、命令执行等
        } catch (Exception e) {
            log.error("Error handling incoming message: {}", e.getMessage());
        }
    }

    /**
     * 订阅命令主题
     */
    public void subscribeCommands(String deviceId) {
        if (!isConnected()) {
            return;
        }

        try {
            String topic = mqttConfig.getCommandTopic(factoryId, deviceId);
            mqttClient.subscribe(topic, mqttConfig.getQos());
            log.info("Subscribed to command topic: {}", topic);
        } catch (MqttException e) {
            log.error("Failed to subscribe to command topic: {}", e.getMessage());
        }
    }

    /**
     * 检查连接状态
     */
    public boolean isConnected() {
        return mqttClient != null && mqttClient.isConnected();
    }

    /**
     * 获取统计信息
     */
    public UploaderStats getStats() {
        return new UploaderStats(
                totalSent.get(),
                totalFailed.get(),
                pendingMessages.get(),
                offlineQueue.size(),
                batchBuffer.size(),
                isConnected()
        );
    }

    /**
     * 统计信息
     */
    public static class UploaderStats {
        public final long totalSent;
        public final long totalFailed;
        public final int pendingMessages;
        public final int offlineQueueSize;
        public final int batchBufferSize;
        public final boolean connected;

        public UploaderStats(long totalSent, long totalFailed, int pendingMessages,
                             int offlineQueueSize, int batchBufferSize, boolean connected) {
            this.totalSent = totalSent;
            this.totalFailed = totalFailed;
            this.pendingMessages = pendingMessages;
            this.offlineQueueSize = offlineQueueSize;
            this.batchBufferSize = batchBufferSize;
            this.connected = connected;
        }
    }

    @PreDestroy
    public void cleanup() {
        log.info("Shutting down MQTT Data Uploader...");

        // 停止定时任务
        if (scheduler != null) {
            scheduler.shutdown();
            try {
                if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                    scheduler.shutdownNow();
                }
            } catch (InterruptedException e) {
                scheduler.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }

        // 最后尝试发送剩余数据
        flushBatchBuffer();

        log.info("MQTT Data Uploader stopped. Stats: sent={}, failed={}, offline={}",
                totalSent.get(), totalFailed.get(), offlineQueue.size());
    }
}
