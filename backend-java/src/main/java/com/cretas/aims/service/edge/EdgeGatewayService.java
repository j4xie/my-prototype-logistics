package com.cretas.aims.service.edge;

import com.cretas.aims.dto.edge.EdgeUploadRequest;
import com.cretas.aims.dto.edge.EdgeUploadResponse;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.entity.isapi.IsapiEventLog;
import com.cretas.aims.repository.isapi.IsapiDeviceRepository;
import com.cretas.aims.repository.isapi.IsapiEventLogRepository;
import com.cretas.aims.service.isapi.IsapiAlertAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 边缘网关服务
 * 处理边缘设备上传的摄像头数据
 */
@Slf4j
@Service
public class EdgeGatewayService {

    private final IsapiDeviceRepository deviceRepository;
    private final IsapiEventLogRepository eventLogRepository;
    private final IsapiAlertAnalysisService alertAnalysisService;

    // WebSocket 模板（可选，如果没有配置 WebSocket 则为 null）
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public EdgeGatewayService(
            IsapiDeviceRepository deviceRepository,
            IsapiEventLogRepository eventLogRepository,
            IsapiAlertAnalysisService alertAnalysisService,
            @Autowired(required = false) SimpMessagingTemplate messagingTemplate) {
        this.deviceRepository = deviceRepository;
        this.eventLogRepository = eventLogRepository;
        this.alertAnalysisService = alertAnalysisService;
        this.messagingTemplate = messagingTemplate;
    }

    // 边缘网关注册表（内存缓存）
    private final Map<String, EdgeGatewayInfo> registeredGateways = new HashMap<>();

    /**
     * 处理边缘上传数据
     */
    @Transactional
    public EdgeUploadResponse processUpload(EdgeUploadRequest request) {
        log.info("收到边缘上传: gateway={}, device={}, type={}",
                request.getGatewayId(), request.getDeviceId(), request.getUploadType());

        // 验证设备存在
        IsapiDevice device = deviceRepository.findById(request.getDeviceId())
                .orElse(null);

        if (device == null) {
            log.warn("设备不存在: {}", request.getDeviceId());
            return EdgeUploadResponse.error("设备不存在: " + request.getDeviceId());
        }

        // 更新设备心跳
        device.heartbeat();
        deviceRepository.save(device);

        // 根据上传类型处理
        switch (request.getUploadType()) {
            case CAPTURE:
                return handleCapture(device, request);
            case EVENT:
                return handleEvent(device, request);
            case HEARTBEAT:
                return handleHeartbeat(device, request);
            default:
                return EdgeUploadResponse.error("不支持的上传类型: " + request.getUploadType());
        }
    }

    /**
     * 处理图片抓拍上传
     */
    private EdgeUploadResponse handleCapture(IsapiDevice device, EdgeUploadRequest request) {
        try {
            // 解码图片
            byte[] pictureData = Base64.getDecoder().decode(request.getPictureBase64());
            log.info("收到抓拍图片: device={}, size={} bytes, channel={}",
                    device.getDeviceName(), pictureData.length, request.getChannelId());

            // 创建事件日志（带图片）
            IsapiEventLog eventLog = IsapiEventLog.builder()
                    .factoryId(device.getFactoryId())
                    .deviceId(device.getId())
                    .eventType("EdgeCapture")
                    .eventState(IsapiEventLog.EventState.ACTIVE)
                    .channelId(request.getChannelId() != null ? request.getChannelId() : 1)
                    .eventTime(request.getCaptureTime() != null ? request.getCaptureTime() : LocalDateTime.now())
                    .receivedTime(LocalDateTime.now())
                    .pictureData(pictureData)
                    .eventDataJson(request.getMetadata())
                    .build();

            eventLogRepository.save(eventLog);

            // 触发AI分析
            String analysisTaskId = null;
            try {
                alertAnalysisService.analyzeAlertAsync(eventLog, device);
                analysisTaskId = String.valueOf(eventLog.getId());
            } catch (Exception e) {
                log.warn("AI分析触发失败: {}", e.getMessage());
            }

            // 推送到 WebSocket
            pushToWebSocket(device, eventLog, "capture");

            return EdgeUploadResponse.builder()
                    .success(true)
                    .message("抓拍上传成功")
                    .receivedAt(LocalDateTime.now())
                    .eventId(String.valueOf(eventLog.getId()))
                    .analysisTaskId(analysisTaskId)
                    .nextUploadInterval(30) // 建议30秒后再上传
                    .build();

        } catch (Exception e) {
            log.error("处理抓拍失败: {}", e.getMessage(), e);
            return EdgeUploadResponse.error("处理抓拍失败: " + e.getMessage());
        }
    }

    /**
     * 处理告警事件上传
     */
    private EdgeUploadResponse handleEvent(IsapiDevice device, EdgeUploadRequest request) {
        try {
            // 解析事件状态
            IsapiEventLog.EventState eventState = "active".equalsIgnoreCase(request.getEventState())
                    ? IsapiEventLog.EventState.ACTIVE
                    : IsapiEventLog.EventState.INACTIVE;

            // 如果有图片，先解码
            byte[] pictureData = null;
            if (request.getPictureBase64() != null && !request.getPictureBase64().isEmpty()) {
                pictureData = Base64.getDecoder().decode(request.getPictureBase64());
            }

            IsapiEventLog eventLog = IsapiEventLog.builder()
                    .factoryId(device.getFactoryId())
                    .deviceId(device.getId())
                    .eventType(request.getEventType() != null ? request.getEventType() : "EdgeEvent")
                    .eventState(eventState)
                    .channelId(request.getChannelId() != null ? request.getChannelId() : 1)
                    .eventTime(request.getCaptureTime() != null ? request.getCaptureTime() : LocalDateTime.now())
                    .receivedTime(LocalDateTime.now())
                    .eventDataJson(request.getEventData())
                    .pictureData(pictureData)
                    .build();

            eventLogRepository.save(eventLog);

            log.info("收到告警事件: device={}, type={}, state={}",
                    device.getDeviceName(), request.getEventType(), request.getEventState());

            // 触发AI分析（如果是重要事件）
            if (shouldAnalyze(request.getEventType())) {
                alertAnalysisService.analyzeAlertAsync(eventLog, device);
            }

            // 推送到 WebSocket
            pushToWebSocket(device, eventLog, "event");

            return EdgeUploadResponse.builder()
                    .success(true)
                    .message("事件上传成功")
                    .receivedAt(LocalDateTime.now())
                    .eventId(String.valueOf(eventLog.getId()))
                    .build();

        } catch (Exception e) {
            log.error("处理事件失败: {}", e.getMessage(), e);
            return EdgeUploadResponse.error("处理事件失败: " + e.getMessage());
        }
    }

    /**
     * 处理心跳
     */
    private EdgeUploadResponse handleHeartbeat(IsapiDevice device, EdgeUploadRequest request) {
        log.debug("收到心跳: device={}, gateway={}", device.getDeviceName(), request.getGatewayId());

        // 更新网关信息
        EdgeGatewayInfo gatewayInfo = registeredGateways.computeIfAbsent(
                request.getGatewayId(),
                k -> new EdgeGatewayInfo(request.getGatewayId())
        );
        gatewayInfo.lastHeartbeat = LocalDateTime.now();
        gatewayInfo.deviceCount++;

        return EdgeUploadResponse.builder()
                .success(true)
                .message("心跳确认")
                .receivedAt(LocalDateTime.now())
                .nextUploadInterval(60) // 建议60秒后再发心跳
                .build();
    }

    /**
     * 推送到 WebSocket
     */
    private void pushToWebSocket(IsapiDevice device, IsapiEventLog eventLog, String source) {
        // 如果 WebSocket 未配置，跳过推送
        if (messagingTemplate == null) {
            log.debug("WebSocket未配置，跳过推送");
            return;
        }

        try {
            Map<String, Object> message = new HashMap<>();
            message.put("source", "edge_gateway");
            message.put("uploadSource", source);
            message.put("deviceId", device.getId());
            message.put("deviceName", device.getDeviceName());
            message.put("eventId", eventLog.getId());
            message.put("eventType", eventLog.getEventType());
            message.put("eventState", eventLog.getEventState());
            message.put("eventTime", eventLog.getEventTime().toString());
            message.put("hasPicture", eventLog.getPictureData() != null);

            String destination = "/topic/factory/" + device.getFactoryId() + "/edge/events";
            messagingTemplate.convertAndSend(destination, message);
            log.debug("WebSocket推送: {}", destination);
        } catch (Exception e) {
            log.warn("WebSocket推送失败: {}", e.getMessage());
        }
    }

    /**
     * 判断事件是否需要AI分析
     */
    private boolean shouldAnalyze(String eventType) {
        if (eventType == null) return false;
        // 需要分析的事件类型
        return eventType.contains("VMD") ||      // 移动侦测
               eventType.contains("linedetection") ||  // 越界
               eventType.contains("fielddetection") || // 区域入侵
               eventType.contains("facedetection") ||  // 人脸检测
               eventType.equals("EdgeCapture");        // 边缘抓拍
    }

    /**
     * 获取已注册的网关列表
     */
    public Map<String, EdgeGatewayInfo> getRegisteredGateways() {
        return new HashMap<>(registeredGateways);
    }

    /**
     * 根据 MAC 地址或 IP 地址查找设备 ID
     * 用于海康摄像头直接推送事件时匹配设备
     */
    public String findDeviceIdByMacOrIp(String macAddress, String ipAddress) {
        // 优先通过 MAC 地址查找
        if (macAddress != null && !macAddress.isEmpty()) {
            // 规范化 MAC 地址格式
            String normalizedMac = macAddress.toLowerCase().replace("-", ":").replace(".", ":");
            IsapiDevice device = deviceRepository.findByMacAddressIgnoreCase(normalizedMac)
                    .or(() -> deviceRepository.findByMacAddressIgnoreCase(macAddress))
                    .orElse(null);
            if (device != null) {
                log.info("通过 MAC 地址找到设备: mac={}, deviceId={}", macAddress, device.getId());
                return device.getId();
            }
        }

        // 通过 IP 地址查找
        if (ipAddress != null && !ipAddress.isEmpty()) {
            IsapiDevice device = deviceRepository.findByIpAddress(ipAddress).orElse(null);
            if (device != null) {
                log.info("通过 IP 地址找到设备: ip={}, deviceId={}", ipAddress, device.getId());
                return device.getId();
            }
        }

        log.warn("未找到匹配的设备: mac={}, ip={}", macAddress, ipAddress);
        return null;
    }

    /**
     * 边缘网关信息
     */
    public static class EdgeGatewayInfo {
        public String gatewayId;
        public LocalDateTime firstSeen;
        public LocalDateTime lastHeartbeat;
        public int deviceCount;

        public EdgeGatewayInfo(String gatewayId) {
            this.gatewayId = gatewayId;
            this.firstSeen = LocalDateTime.now();
            this.lastHeartbeat = LocalDateTime.now();
            this.deviceCount = 0;
        }
    }
}
