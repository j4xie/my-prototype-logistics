package com.cretas.edge.controller;

import com.cretas.edge.service.CollectorManagerService;
import com.cretas.edge.uploader.MqttDataUploader;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 健康检查和管理接口
 */
@RestController
@RequestMapping("/api/edge")
@RequiredArgsConstructor
public class HealthController {

    private final CollectorManagerService collectorManager;
    private final MqttDataUploader mqttDataUploader;

    @Value("${gateway.factory-id}")
    private String factoryId;

    @Value("${gateway.device-name:edge-gateway}")
    private String deviceName;

    /**
     * 健康检查
     */
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("factoryId", factoryId);
        response.put("deviceName", deviceName);
        response.put("timestamp", LocalDateTime.now().toString());
        response.put("activeCollectors", collectorManager.getActiveCollectorCount());
        response.put("mqttConnected", mqttDataUploader.isConnected());
        return response;
    }

    /**
     * 获取详细状态
     */
    @GetMapping("/status")
    public Map<String, Object> status() {
        Map<String, Object> response = new HashMap<>();
        response.put("factoryId", factoryId);
        response.put("deviceName", deviceName);
        response.put("timestamp", LocalDateTime.now().toString());
        response.put("collectors", collectorManager.getCollectorStatus());

        MqttDataUploader.UploaderStats stats = mqttDataUploader.getStats();
        Map<String, Object> mqttStats = new HashMap<>();
        mqttStats.put("connected", stats.connected);
        mqttStats.put("totalSent", stats.totalSent);
        mqttStats.put("totalFailed", stats.totalFailed);
        mqttStats.put("pendingMessages", stats.pendingMessages);
        mqttStats.put("offlineQueueSize", stats.offlineQueueSize);
        response.put("mqtt", mqttStats);

        return response;
    }

    /**
     * 重启采集器
     */
    @PostMapping("/collector/restart")
    public Map<String, Object> restartCollector(@RequestParam String deviceId) {
        Map<String, Object> response = new HashMap<>();
        boolean success = collectorManager.restartCollector(deviceId);
        response.put("success", success);
        response.put("deviceId", deviceId);
        response.put("message", success ? "Collector restarted" : "Failed to restart collector");
        return response;
    }
}
