package com.cretas.aims.service.isapi;

import com.cretas.aims.client.isapi.IsapiClient;
import com.cretas.aims.config.IsapiConfig;
import com.cretas.aims.dto.isapi.IsapiEventDTO;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.entity.isapi.IsapiEventLog;
import com.cretas.aims.entity.isapi.IsapiEventLog.EventState;
import com.cretas.aims.repository.isapi.IsapiDeviceRepository;
import com.cretas.aims.repository.isapi.IsapiEventLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.Call;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ISAPI 事件订阅服务
 * 管理与设备的 alertStream 长连接
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IsapiEventSubscriptionService {

    private final IsapiClient isapiClient;
    private final IsapiDeviceRepository deviceRepository;
    private final IsapiEventLogRepository eventLogRepository;
    private final IsapiConfig config;

    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    @Autowired(required = false)
    private IsapiAlertAnalysisService alertAnalysisService;

    @Autowired(required = false)
    private AutoLabelRecognitionService labelRecognitionService;

    // 活动的订阅连接 (deviceId -> Call)
    private final Map<String, Call> activeSubscriptions = new ConcurrentHashMap<>();

    // 重连计数
    private final Map<String, Integer> reconnectCounts = new ConcurrentHashMap<>();

    private static final int MAX_RECONNECT_ATTEMPTS = 5;
    private static final int RECONNECT_DELAY_MS = 5000;

    // ==================== 订阅管理 ====================

    /**
     * 订阅设备告警
     */
    public void subscribeDevice(String deviceId) {
        // 如果已订阅，先取消
        if (activeSubscriptions.containsKey(deviceId)) {
            log.info("设备 {} 已有活动订阅，跳过", deviceId);
            return;
        }

        IsapiDevice device = deviceRepository.findById(deviceId).orElse(null);
        if (device == null) {
            log.warn("设备不存在: {}", deviceId);
            return;
        }

        if (device.getStatus() != IsapiDevice.DeviceStatus.ONLINE) {
            log.warn("设备 {} 不在线，跳过订阅", deviceId);
            return;
        }

        log.info("开始订阅设备告警: {} - {}", device.getDeviceName(), device.getIpAddress());

        Call call = isapiClient.subscribeAlertStream(device, event -> {
            handleEvent(device, event);
        });

        activeSubscriptions.put(deviceId, call);

        // 更新设备订阅状态
        device.setAlertSubscribed(true);
        deviceRepository.save(device);
    }

    /**
     * 取消订阅
     */
    public void unsubscribeDevice(String deviceId) {
        Call call = activeSubscriptions.remove(deviceId);
        if (call != null) {
            call.cancel();
            log.info("已取消设备订阅: {}", deviceId);
        }

        // 更新设备状态
        deviceRepository.findById(deviceId).ifPresent(device -> {
            device.setAlertSubscribed(false);
            deviceRepository.save(device);
        });

        reconnectCounts.remove(deviceId);
    }

    /**
     * 订阅工厂下所有在线设备
     */
    public void subscribeAllDevices(String factoryId) {
        List<IsapiDevice> devices = deviceRepository.findOnlineDevices(factoryId);
        for (IsapiDevice device : devices) {
            subscribeDevice(device.getId());
        }
        log.info("已订阅工厂 {} 的 {} 台设备", factoryId, devices.size());
    }

    /**
     * 取消工厂下所有订阅
     */
    public void unsubscribeAllDevices(String factoryId) {
        List<IsapiDevice> devices = deviceRepository.findSubscribedDevices(factoryId);
        for (IsapiDevice device : devices) {
            unsubscribeDevice(device.getId());
        }
    }

    // ==================== 事件处理 ====================

    /**
     * 处理设备事件
     */
    private void handleEvent(IsapiDevice device, Map<String, Object> eventData) {
        String deviceId = device.getId();

        // 检查是否为错误事件
        if (Boolean.TRUE.equals(eventData.get("error"))) {
            handleSubscriptionError(device, (String) eventData.get("message"));
            return;
        }

        // 解析事件
        String eventType = (String) eventData.get("eventType");
        String eventStateStr = (String) eventData.get("eventState");
        Boolean isHeartbeat = Boolean.TRUE.equals(eventData.get("isHeartbeat"));

        if (eventType == null) {
            log.debug("忽略无效事件: {}", eventData);
            return;
        }

        EventState eventState = "active".equalsIgnoreCase(eventStateStr)
                ? EventState.ACTIVE : EventState.INACTIVE;

        // 更新设备心跳
        device.heartbeat();
        device.setLastEventAt(LocalDateTime.now());
        deviceRepository.save(device);

        // 重置重连计数
        reconnectCounts.remove(deviceId);

        // 心跳事件不记录日志
        if (isHeartbeat) {
            log.trace("收到心跳: {} - {}", device.getDeviceName(), eventType);
            return;
        }

        // 保存事件日志
        IsapiEventLog eventLog = saveEventLog(device, eventData, eventType, eventState);

        // 如果是告警事件，推送 WebSocket
        if (eventLog.shouldAlert()) {
            pushAlertToWebSocket(device, eventLog);
        }

        // 如果需要 AI 分析，异步执行
        if (alertAnalysisService != null && alertAnalysisService.shouldAnalyze(eventLog)) {
            alertAnalysisService.analyzeAlertAsync(eventLog, device);
        }

        // 标签自动识别触发 (VMD 或 区域入侵事件)
        if (labelRecognitionService != null && isLabelRecognitionTriggerEvent(eventType, eventState)) {
            labelRecognitionService.onIsapiEvent(
                    device.getFactoryId(),
                    eventType,
                    device.getId(),
                    eventLog.getId().toString()
            );
        }
    }

    /**
     * 判断是否为标签识别触发事件
     */
    private boolean isLabelRecognitionTriggerEvent(String eventType, EventState eventState) {
        if (eventState != EventState.ACTIVE) {
            return false;
        }
        // VMD (视频移动侦测) 或 区域入侵检测
        return "VMD".equalsIgnoreCase(eventType)
                || "fielddetection".equalsIgnoreCase(eventType)
                || "linedetection".equalsIgnoreCase(eventType)
                || "regionEntrance".equalsIgnoreCase(eventType);
    }

    /**
     * 保存事件日志
     */
    @Transactional
    public IsapiEventLog saveEventLog(IsapiDevice device, Map<String, Object> eventData,
                                       String eventType, EventState eventState) {
        Integer channelId = eventData.get("channelID") != null
                ? (Integer) eventData.get("channelID") : null;

        LocalDateTime eventTime = eventData.get("dateTime") != null
                ? (LocalDateTime) eventData.get("dateTime")
                : LocalDateTime.now();

        IsapiEventLog log = IsapiEventLog.builder()
                .factoryId(device.getFactoryId())
                .deviceId(device.getId())
                .eventType(eventType)
                .eventState(eventState)
                .eventDescription((String) eventData.get("eventDescription"))
                .channelId(channelId)
                .eventTime(eventTime)
                .receivedTime(LocalDateTime.now())
                .build();

        // 设置事件数据 (使用setter而非builder，因为需要JSON序列化)
        log.setEventData(eventData);

        // 解析检测区域
        if (eventData.containsKey("detectionRegion")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> region = (Map<String, Object>) eventData.get("detectionRegion");
            log.setDetectionRegion(region);
        }

        return eventLogRepository.save(log);
    }

    /**
     * 推送告警到 WebSocket
     */
    private void pushAlertToWebSocket(IsapiDevice device, IsapiEventLog eventLog) {
        if (messagingTemplate == null) {
            return;
        }

        IsapiEventDTO dto = IsapiEventDTO.builder()
                .id(eventLog.getId())
                .factoryId(device.getFactoryId())
                .deviceId(device.getId())
                .deviceName(device.getDeviceName())
                .eventType(eventLog.getEventType())
                .eventTypeName(eventLog.getEventTypeName())
                .eventState(eventLog.getEventState())
                .eventDescription(eventLog.getEventDescription())
                .channelId(eventLog.getChannelId())
                .eventTime(eventLog.getEventTime())
                .severity(IsapiEventDTO.inferSeverity(eventLog.getEventType(), eventLog.getEventState()))
                .isHeartbeat(eventLog.isHeartbeat())
                .build();

        // 推送到工厂专属频道
        String destination = "/topic/factory/" + device.getFactoryId() + "/isapi/alerts";
        messagingTemplate.convertAndSend(destination, dto);

        log.info("推送告警: {} - {} - {}",
                device.getDeviceName(), eventLog.getEventTypeName(), eventLog.getEventState());
    }

    /**
     * 处理订阅错误
     */
    private void handleSubscriptionError(IsapiDevice device, String errorMessage) {
        String deviceId = device.getId();
        log.warn("设备 {} 订阅错误: {}", device.getDeviceName(), errorMessage);

        // 移除活动订阅
        activeSubscriptions.remove(deviceId);

        // 更新设备状态
        device.markError(errorMessage);
        device.setAlertSubscribed(false);
        deviceRepository.save(device);

        // 尝试重连
        int attempts = reconnectCounts.getOrDefault(deviceId, 0) + 1;
        reconnectCounts.put(deviceId, attempts);

        if (attempts <= MAX_RECONNECT_ATTEMPTS) {
            log.info("设备 {} 将在 {}ms 后重连 (尝试 {}/{})",
                    device.getDeviceName(), RECONNECT_DELAY_MS, attempts, MAX_RECONNECT_ATTEMPTS);

            // 延迟重连
            new Thread(() -> {
                try {
                    Thread.sleep(RECONNECT_DELAY_MS);
                    subscribeDevice(deviceId);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }).start();
        } else {
            log.error("设备 {} 重连次数已达上限，停止重连", device.getDeviceName());
            reconnectCounts.remove(deviceId);
        }
    }

    // ==================== 定时任务 ====================

    /**
     * 定时检查心跳超时的设备
     */
    @Scheduled(fixedDelayString = "${isapi.heartbeat-check-interval:60000}")
    public void checkHeartbeatTimeout() {
        int timeoutSeconds = config.getHeartbeatInterval() * 3; // 3倍心跳间隔认为超时
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(timeoutSeconds);

        List<IsapiDevice> timeoutDevices = deviceRepository.findHeartbeatTimeoutDevices(threshold);

        for (IsapiDevice device : timeoutDevices) {
            log.warn("设备心跳超时: {} - {}", device.getDeviceName(), device.getIpAddress());

            device.markOffline("Heartbeat timeout");
            deviceRepository.save(device);

            // 取消订阅并尝试重连
            unsubscribeDevice(device.getId());
        }
    }

    /**
     * 定时重连离线设备
     */
    @Scheduled(fixedDelayString = "${isapi.reconnect-interval:300000}")
    public void reconnectOfflineDevices() {
        List<IsapiDevice> offlineDevices = deviceRepository.findHeartbeatTimeoutDevices(
                LocalDateTime.now().minusMinutes(5));

        for (IsapiDevice device : offlineDevices) {
            if (!activeSubscriptions.containsKey(device.getId())) {
                boolean connected = isapiClient.testConnection(device);
                if (connected) {
                    device.heartbeat();
                    deviceRepository.save(device);
                    subscribeDevice(device.getId());
                }
            }
        }
    }

    // ==================== 生命周期 ====================

    /**
     * 应用启动时自动订阅
     */
    @EventListener(ContextRefreshedEvent.class)
    public void onApplicationStart() {
        // 可选：启动时自动订阅所有在线设备
        // 如果设备较多，建议改为手动触发或按工厂订阅
        log.info("ISAPI 事件订阅服务已启动");
    }

    /**
     * 应用关闭时取消所有订阅
     */
    @PreDestroy
    public void onShutdown() {
        log.info("关闭所有 ISAPI 事件订阅...");
        for (String deviceId : activeSubscriptions.keySet()) {
            unsubscribeDevice(deviceId);
        }
    }

    // ==================== 查询方法 ====================

    /**
     * 获取活动订阅数量
     */
    public int getActiveSubscriptionCount() {
        return activeSubscriptions.size();
    }

    /**
     * 检查设备是否已订阅
     */
    public boolean isSubscribed(String deviceId) {
        return activeSubscriptions.containsKey(deviceId);
    }

    /**
     * 获取所有活动订阅的设备ID
     */
    public List<String> getActiveSubscriptionIds() {
        return List.copyOf(activeSubscriptions.keySet());
    }
}
