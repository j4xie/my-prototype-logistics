package com.cretas.edge.service;

import com.cretas.edge.collector.ScaleCollector;
import com.cretas.edge.collector.SerialScaleCollector;
import com.cretas.edge.config.SerialPortConfig;
import com.cretas.edge.model.ScaleReading;
import com.cretas.edge.protocol.KeliD2008Adapter;
import com.cretas.edge.protocol.ScaleProtocolAdapter;
import com.cretas.edge.uploader.MqttDataUploader;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 采集器管理服务
 *
 * 负责：
 * 1. 初始化所有配置的采集器
 * 2. 管理采集器生命周期
 * 3. 将采集数据转发到上报器
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CollectorManagerService {

    private final SerialPortConfig serialPortConfig;
    private final MqttDataUploader mqttDataUploader;
    private final Map<String, ScaleProtocolAdapter> protocolAdapters;

    @Value("${gateway.factory-id}")
    private String factoryId;

    // 活跃的采集器
    private final Map<String, ScaleCollector> activeCollectors = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        log.info("Initializing Collector Manager Service...");

        if (!serialPortConfig.isEnabled()) {
            log.warn("Serial port collection is disabled");
            return;
        }

        List<SerialPortConfig.PortConfig> enabledPorts = serialPortConfig.getEnabledPorts();
        log.info("Found {} enabled serial ports", enabledPorts.size());

        for (SerialPortConfig.PortConfig portConfig : enabledPorts) {
            try {
                initializeCollector(portConfig);
            } catch (Exception e) {
                log.error("Failed to initialize collector for device {}: {}",
                        portConfig.getDeviceId(), e.getMessage());
            }
        }

        log.info("Collector Manager initialized. Active collectors: {}", activeCollectors.size());
    }

    /**
     * 初始化单个采集器
     */
    private void initializeCollector(SerialPortConfig.PortConfig portConfig) throws Exception {
        String deviceId = portConfig.getDeviceId();
        log.info("Initializing collector for device: {}", deviceId);

        // 获取协议适配器
        ScaleProtocolAdapter adapter = getProtocolAdapter(portConfig.getProtocol());
        if (adapter == null) {
            log.error("Protocol adapter not found for: {}", portConfig.getProtocol());
            return;
        }

        // 创建串口采集器
        SerialScaleCollector collector = new SerialScaleCollector(
                portConfig,
                serialPortConfig,
                adapter,
                factoryId
        );

        // 设置数据回调
        collector.setDataCallback(this::handleScaleReading);

        // 设置错误回调
        collector.setErrorCallback((id, error) -> {
            log.error("Collector error for device {}: {}", id, error.getMessage());
            mqttDataUploader.sendDeviceStatus(id, "ERROR: " + error.getMessage());
        });

        // 初始化
        collector.initialize();

        // 启动
        collector.start();

        // 订阅命令主题
        mqttDataUploader.subscribeCommands(deviceId);

        // 发送上线状态
        mqttDataUploader.sendDeviceStatus(deviceId, "ONLINE");

        activeCollectors.put(deviceId, collector);
        log.info("Collector started for device: {}", deviceId);
    }

    /**
     * 获取协议适配器
     */
    private ScaleProtocolAdapter getProtocolAdapter(String protocol) {
        // 先从注入的适配器中查找
        if (protocolAdapters != null) {
            for (ScaleProtocolAdapter adapter : protocolAdapters.values()) {
                if (adapter.getProtocolName().equalsIgnoreCase(protocol)) {
                    return adapter;
                }
            }
        }

        // 内置协议
        switch (protocol.toUpperCase()) {
            case "KELI_D2008":
                return new KeliD2008Adapter();
            // TODO: 添加更多内置协议
            default:
                log.warn("Unknown protocol: {}, will try to load dynamically", protocol);
                return null;
        }
    }

    /**
     * 处理称重数据
     */
    private void handleScaleReading(ScaleReading reading) {
        log.debug("Received reading from {}: {} {}",
                reading.getDeviceId(),
                reading.getWeightGrams(),
                reading.getWeightUnit());

        // 上报到 MQTT
        boolean success = mqttDataUploader.upload(reading);
        if (!success) {
            log.warn("Failed to upload reading for device: {}", reading.getDeviceId());
        }
    }

    /**
     * 获取采集器状态
     */
    public Map<String, String> getCollectorStatus() {
        Map<String, String> status = new HashMap<>();
        for (Map.Entry<String, ScaleCollector> entry : activeCollectors.entrySet()) {
            status.put(entry.getKey(), entry.getValue().getStatusDescription());
        }
        return status;
    }

    /**
     * 重启指定采集器
     */
    public boolean restartCollector(String deviceId) {
        ScaleCollector collector = activeCollectors.get(deviceId);
        if (collector == null) {
            log.warn("Collector not found: {}", deviceId);
            return false;
        }

        try {
            collector.stop();
            Thread.sleep(1000);
            collector.start();
            log.info("Collector restarted: {}", deviceId);
            return true;
        } catch (Exception e) {
            log.error("Failed to restart collector {}: {}", deviceId, e.getMessage());
            return false;
        }
    }

    /**
     * 获取活跃采集器数量
     */
    public int getActiveCollectorCount() {
        return (int) activeCollectors.values().stream()
                .filter(ScaleCollector::isRunning)
                .count();
    }

    @PreDestroy
    public void cleanup() {
        log.info("Shutting down Collector Manager...");

        for (Map.Entry<String, ScaleCollector> entry : activeCollectors.entrySet()) {
            String deviceId = entry.getKey();
            ScaleCollector collector = entry.getValue();

            try {
                collector.stop();
                mqttDataUploader.sendDeviceStatus(deviceId, "OFFLINE");
                log.info("Collector stopped: {}", deviceId);
            } catch (Exception e) {
                log.error("Error stopping collector {}: {}", deviceId, e.getMessage());
            }
        }

        activeCollectors.clear();
        log.info("Collector Manager shutdown complete");
    }
}
