package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.isapi.BatchImportRequest;
import com.cretas.aims.dto.isapi.DeviceDiscoveryRequest;
import com.cretas.aims.dto.isapi.DiscoveredDeviceDTO;
import com.cretas.aims.dto.isapi.HttpHostConfigRequest;
import com.cretas.aims.dto.isapi.HttpHostConfigResponse;
import com.cretas.aims.dto.isapi.IsapiCaptureDTO;
import com.cretas.aims.dto.isapi.IsapiDeviceDTO;
import com.cretas.aims.dto.isapi.IsapiEventDTO;
import com.cretas.aims.dto.isapi.IsapiStreamDTO;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.entity.isapi.IsapiEventLog;
import com.cretas.aims.repository.isapi.IsapiEventLogRepository;
import com.cretas.aims.service.isapi.IsapiAlertAnalysisService;
import com.cretas.aims.service.isapi.IsapiDeviceDiscoveryService;
import com.cretas.aims.service.isapi.IsapiDeviceService;
import com.cretas.aims.service.isapi.IsapiEventSubscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * ISAPI 设备管理 Controller
 * 海康威视摄像头/NVR 设备管理接口
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/isapi/devices")
@RequiredArgsConstructor
@Tag(name = "ISAPI 设备管理", description = "海康威视摄像头/NVR 设备管理")
public class IsapiDeviceController {

    private final IsapiDeviceService deviceService;
    private final IsapiDeviceDiscoveryService discoveryService;
    private final IsapiEventSubscriptionService subscriptionService;
    private final IsapiEventLogRepository eventLogRepository;
    private final IsapiAlertAnalysisService alertAnalysisService;

    // ==================== 设备 CRUD ====================

    @PostMapping
    @Operation(summary = "添加设备")
    public ApiResponse<IsapiDeviceDTO> addDevice(
            @PathVariable String factoryId,
            @Valid @RequestBody IsapiDeviceDTO dto) {
        try {
            IsapiDevice device = deviceService.addDevice(factoryId, dto);
            return ApiResponse.success("设备添加成功", deviceService.toDTO(device));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PutMapping("/{deviceId}")
    @Operation(summary = "更新设备")
    public ApiResponse<IsapiDeviceDTO> updateDevice(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @RequestBody IsapiDeviceDTO dto) {
        try {
            IsapiDevice device = deviceService.updateDevice(deviceId, dto);
            return ApiResponse.success("设备更新成功", deviceService.toDTO(device));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @DeleteMapping("/{deviceId}")
    @Operation(summary = "删除设备")
    public ApiResponse<Void> deleteDevice(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        try {
            // 先取消订阅
            subscriptionService.unsubscribeDevice(deviceId);
            deviceService.deleteDevice(deviceId);
            return ApiResponse.successMessage("设备删除成功");
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/{deviceId}")
    @Operation(summary = "获取设备详情")
    public ApiResponse<IsapiDeviceDTO> getDevice(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        try {
            IsapiDevice device = deviceService.getDevice(deviceId);
            return ApiResponse.success(deviceService.toDTO(device));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping
    @Operation(summary = "获取设备列表")
    public ApiResponse<Page<IsapiDeviceDTO>> listDevices(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword) {

        Pageable pageable = PageRequest.of(page - 1, size);
        Page<IsapiDevice> devices;

        if (keyword != null && !keyword.isEmpty()) {
            devices = deviceService.searchDevices(factoryId, keyword, pageable);
        } else {
            devices = deviceService.listDevices(factoryId, pageable);
        }

        Page<IsapiDeviceDTO> dtoPage = devices.map(deviceService::toDTO);
        return ApiResponse.success(dtoPage);
    }

    // ==================== 连接管理 ====================

    @PostMapping("/{deviceId}/test-connection")
    @Operation(summary = "测试设备连接")
    public ApiResponse<Map<String, Object>> testConnection(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        boolean connected = deviceService.testConnection(deviceId);
        Map<String, Object> result = new HashMap<>();
        result.put("connected", connected);
        result.put("deviceId", deviceId);
        result.put("testedAt", LocalDateTime.now());

        if (connected) {
            return ApiResponse.success("连接成功", result);
        } else {
            return ApiResponse.success("连接失败", result);
        }
    }

    @PostMapping("/{deviceId}/sync")
    @Operation(summary = "同步设备信息")
    public ApiResponse<IsapiDeviceDTO> syncDevice(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        deviceService.syncDeviceInfo(deviceId);
        IsapiDevice device = deviceService.getDevice(deviceId);
        return ApiResponse.success("同步完成", deviceService.toDTO(device));
    }

    @PostMapping("/{deviceId}/configure-http-host")
    @Operation(summary = "配置摄像头 HTTP 监听地址", description = "配置摄像头将事件推送到云端服务器")
    public ApiResponse<HttpHostConfigResponse> configureHttpHost(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @RequestBody HttpHostConfigRequest request) {
        try {
            log.info("配置 HTTP Host: factoryId={}, deviceId={}, motionDetection={}, lineCrossing={}",
                    factoryId, deviceId, request.getEnableMotionDetection(), request.getEnableLineCrossing());

            HttpHostConfigResponse response = deviceService.configureHttpHost(deviceId, request);

            if (response.getSuccess()) {
                return ApiResponse.success("HTTP 监听配置成功", response);
            } else {
                return ApiResponse.success("HTTP 监听配置部分成功", response);
            }
        } catch (IllegalArgumentException e) {
            log.error("配置 HTTP Host 失败: deviceId={}, error={}", deviceId, e.getMessage());
            return ApiResponse.error(e.getMessage());
        } catch (Exception e) {
            log.error("配置 HTTP Host 异常: deviceId={}, error={}", deviceId, e.getMessage(), e);
            return ApiResponse.error("配置失败: " + e.getMessage());
        }
    }

    // ==================== 流媒体 ====================

    @GetMapping("/{deviceId}/streams")
    @Operation(summary = "获取流媒体地址")
    public ApiResponse<List<IsapiStreamDTO>> getStreamUrls(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        List<IsapiStreamDTO> streams = deviceService.getStreamUrls(deviceId);
        return ApiResponse.success(streams);
    }

    @PostMapping("/{deviceId}/capture")
    @Operation(summary = "抓拍图片")
    public ApiResponse<IsapiCaptureDTO> capturePicture(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "1") int channelId) {
        IsapiCaptureDTO capture = deviceService.capturePicture(deviceId, channelId);
        if (capture.getSuccess()) {
            return ApiResponse.success("抓拍成功", capture);
        } else {
            return ApiResponse.error(capture.getError());
        }
    }

    @GetMapping("/{deviceId}/capture/image")
    @Operation(summary = "获取抓拍图片 (直接返回图片)")
    public ResponseEntity<byte[]> capturePictureAsImage(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "1") int channelId) {
        IsapiCaptureDTO capture = deviceService.capturePicture(deviceId, channelId);

        if (!capture.getSuccess() || capture.getPictureBase64() == null) {
            return ResponseEntity.notFound().build();
        }

        byte[] imageBytes = Base64.getDecoder().decode(capture.getPictureBase64());
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .body(imageBytes);
    }

    // ==================== 告警订阅 ====================

    @PostMapping("/{deviceId}/subscribe")
    @Operation(summary = "订阅设备告警")
    public ApiResponse<Void> subscribeDevice(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        subscriptionService.subscribeDevice(deviceId);
        return ApiResponse.successMessage("订阅成功");
    }

    @PostMapping("/{deviceId}/unsubscribe")
    @Operation(summary = "取消订阅设备告警")
    public ApiResponse<Void> unsubscribeDevice(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        subscriptionService.unsubscribeDevice(deviceId);
        return ApiResponse.successMessage("取消订阅成功");
    }

    @PostMapping("/subscribe-all")
    @Operation(summary = "订阅所有在线设备")
    public ApiResponse<Void> subscribeAll(@PathVariable String factoryId) {
        subscriptionService.subscribeAllDevices(factoryId);
        return ApiResponse.successMessage("批量订阅成功");
    }

    @GetMapping("/subscription-status")
    @Operation(summary = "获取订阅状态")
    public ApiResponse<Map<String, Object>> getSubscriptionStatus(@PathVariable String factoryId) {
        Map<String, Object> status = new HashMap<>();
        status.put("activeCount", subscriptionService.getActiveSubscriptionCount());
        status.put("activeDevices", subscriptionService.getActiveSubscriptionIds());
        return ApiResponse.success(status);
    }

    // ==================== 事件日志 ====================

    @GetMapping("/events")
    @Operation(summary = "获取事件日志列表")
    public ApiResponse<Page<IsapiEventDTO>> getEvents(
            @PathVariable String factoryId,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String eventType,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page - 1, size);
        Page<IsapiEventLog> logs;

        if (deviceId != null && !deviceId.isEmpty()) {
            logs = eventLogRepository.findByFactoryIdAndDeviceIdOrderByEventTimeDesc(
                    factoryId, deviceId, pageable);
        } else if (eventType != null && !eventType.isEmpty()) {
            logs = eventLogRepository.findByFactoryIdAndEventTypeOrderByEventTimeDesc(
                    factoryId, eventType, pageable);
        } else {
            logs = eventLogRepository.findByFactoryIdOrderByEventTimeDesc(factoryId, pageable);
        }

        Page<IsapiEventDTO> dtoPage = logs.map(this::toEventDTO);
        return ApiResponse.success(dtoPage);
    }

    @GetMapping("/events/recent")
    @Operation(summary = "获取最近告警")
    public ApiResponse<List<IsapiEventDTO>> getRecentAlerts(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "10") int limit) {

        Pageable pageable = PageRequest.of(0, limit);
        List<IsapiEventLog> logs = eventLogRepository.findRecentAlerts(factoryId, pageable);

        List<IsapiEventDTO> dtos = logs.stream()
                .map(this::toEventDTO)
                .collect(Collectors.toList());

        return ApiResponse.success(dtos);
    }

    @GetMapping("/events/statistics")
    @Operation(summary = "获取事件统计")
    public ApiResponse<Map<String, Object>> getEventStatistics(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "24") int hours) {

        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        Map<String, Object> stats = new HashMap<>();

        // 按类型统计
        List<Object[]> byType = eventLogRepository.countByEventType(factoryId, since);
        Map<String, Long> typeStats = new HashMap<>();
        for (Object[] row : byType) {
            typeStats.put((String) row[0], (Long) row[1]);
        }
        stats.put("byType", typeStats);

        // 按设备统计
        List<Object[]> byDevice = eventLogRepository.countByDevice(factoryId, since);
        Map<String, Long> deviceStats = new HashMap<>();
        for (Object[] row : byDevice) {
            deviceStats.put((String) row[0], (Long) row[1]);
        }
        stats.put("byDevice", deviceStats);

        // 未处理数量
        stats.put("unprocessedCount", eventLogRepository.countByFactoryIdAndProcessedFalse(factoryId));

        // 今日告警数
        stats.put("todayAlerts", eventLogRepository.countTodayAlerts(
                factoryId, LocalDateTime.now().toLocalDate().atStartOfDay()));

        return ApiResponse.success(stats);
    }

    @PostMapping("/events/{eventId}/process")
    @Operation(summary = "处理事件")
    public ApiResponse<Void> processEvent(
            @PathVariable String factoryId,
            @PathVariable Long eventId,
            @RequestParam String processedBy,
            @RequestParam(required = false) String result) {

        eventLogRepository.findById(eventId).ifPresent(event -> {
            event.markProcessed(processedBy, result);
            eventLogRepository.save(event);
        });

        return ApiResponse.successMessage("处理完成");
    }

    // ==================== AI 分析相关 ====================

    @GetMapping("/events/high-risk")
    @Operation(summary = "获取高风险告警", description = "查询 AI 分析标记为需要立即处理的告警")
    public ApiResponse<Page<IsapiEventDTO>> getHighRiskAlerts(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page - 1, size);
        Page<IsapiEventLog> logs = eventLogRepository.findHighRiskAlerts(factoryId, pageable);
        Page<IsapiEventDTO> dtoPage = logs.map(this::toEventDTO);
        return ApiResponse.success(dtoPage);
    }

    @GetMapping("/events/by-threat-level/{threatLevel}")
    @Operation(summary = "按威胁等级查询", description = "根据 AI 判断的威胁等级 (HIGH/MEDIUM/LOW/NONE) 查询事件")
    public ApiResponse<Page<IsapiEventDTO>> getEventsByThreatLevel(
            @PathVariable String factoryId,
            @PathVariable String threatLevel,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page - 1, size);
        Page<IsapiEventLog> logs = eventLogRepository.findByAiThreatLevel(
                factoryId, threatLevel.toUpperCase(), pageable);
        Page<IsapiEventDTO> dtoPage = logs.map(this::toEventDTO);
        return ApiResponse.success(dtoPage);
    }

    @GetMapping("/events/hygiene-concerns")
    @Operation(summary = "获取卫生隐患告警", description = "查询 AI 检测到卫生隐患的事件")
    public ApiResponse<List<IsapiEventDTO>> getHygieneConcerns(@PathVariable String factoryId) {
        List<IsapiEventLog> logs = eventLogRepository.findHygieneConcerns(factoryId);
        List<IsapiEventDTO> dtos = logs.stream()
                .map(this::toEventDTO)
                .collect(Collectors.toList());
        return ApiResponse.success(dtos);
    }

    @GetMapping("/events/safety-concerns")
    @Operation(summary = "获取安全隐患告警", description = "查询 AI 检测到安全隐患的事件")
    public ApiResponse<List<IsapiEventDTO>> getSafetyConcerns(@PathVariable String factoryId) {
        List<IsapiEventLog> logs = eventLogRepository.findSafetyConcerns(factoryId);
        List<IsapiEventDTO> dtos = logs.stream()
                .map(this::toEventDTO)
                .collect(Collectors.toList());
        return ApiResponse.success(dtos);
    }

    @GetMapping("/events/{eventId}")
    @Operation(summary = "获取事件详情", description = "获取单个事件详情，包括 AI 分析结果")
    public ApiResponse<IsapiEventDTO> getEventDetail(
            @PathVariable String factoryId,
            @PathVariable Long eventId) {

        return eventLogRepository.findById(eventId)
                .map(event -> ApiResponse.success(toEventDTO(event)))
                .orElse(ApiResponse.error("事件不存在"));
    }

    @PostMapping("/events/{eventId}/reanalyze")
    @Operation(summary = "重新 AI 分析", description = "对指定事件重新进行 AI 分析 (需要有图片数据)")
    public ApiResponse<IsapiEventDTO> reanalyzeEvent(
            @PathVariable String factoryId,
            @PathVariable Long eventId) {

        try {
            var result = alertAnalysisService.reanalyzeEvent(eventId);
            if (result.isSuccess()) {
                IsapiEventLog event = eventLogRepository.findById(eventId).orElse(null);
                if (event != null) {
                    return ApiResponse.success("AI 分析完成", toEventDTO(event));
                }
            }
            return ApiResponse.error(result.getMessage());
        } catch (Exception e) {
            log.error("重新分析事件失败: eventId={}, error={}", eventId, e.getMessage());
            return ApiResponse.error("分析失败: " + e.getMessage());
        }
    }

    @GetMapping("/events/ai-statistics")
    @Operation(summary = "获取 AI 分析统计", description = "获取 AI 分析结果的统计信息")
    public ApiResponse<Map<String, Object>> getAiStatistics(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "24") int hours) {

        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        Map<String, Object> stats = new HashMap<>();

        // 按威胁等级统计
        List<Object[]> byThreatLevel = eventLogRepository.countByAiThreatLevel(factoryId, since);
        Map<String, Long> threatLevelStats = new HashMap<>();
        for (Object[] row : byThreatLevel) {
            String level = row[0] != null ? (String) row[0] : "UNKNOWN";
            threatLevelStats.put(level, (Long) row[1]);
        }
        stats.put("byThreatLevel", threatLevelStats);

        // 高风险未处理数
        stats.put("highRiskUnprocessed", eventLogRepository.countHighRiskUnprocessed(factoryId));

        // 卫生隐患数
        stats.put("hygieneConcernCount", eventLogRepository.findHygieneConcerns(factoryId).size());

        // 安全隐患数
        stats.put("safetyConcernCount", eventLogRepository.findSafetyConcerns(factoryId).size());

        // 待分析数
        stats.put("pendingAnalysisCount", eventLogRepository.findPendingAnalysis(factoryId).size());

        return ApiResponse.success(stats);
    }

    @PostMapping("/events/batch-process")
    @Operation(summary = "批量处理事件", description = "批量标记事件为已处理")
    public ApiResponse<Map<String, Object>> batchProcessEvents(
            @PathVariable String factoryId,
            @RequestParam List<Long> eventIds,
            @RequestParam String processedBy,
            @RequestParam(required = false) String result) {

        int count = eventLogRepository.markAsProcessed(eventIds, LocalDateTime.now(), processedBy);

        Map<String, Object> response = new HashMap<>();
        response.put("processedCount", count);
        response.put("requestedCount", eventIds.size());

        return ApiResponse.success("批量处理完成", response);
    }

    // ==================== 状态统计 ====================

    @GetMapping("/status-summary")
    @Operation(summary = "获取设备状态汇总")
    public ApiResponse<Map<String, Object>> getStatusSummary(@PathVariable String factoryId) {
        Map<String, Object> summary = new HashMap<>();

        // 设备状态统计
        summary.put("deviceStatus", deviceService.getStatusStatistics(factoryId));

        // 订阅状态
        summary.put("subscriptionCount", subscriptionService.getActiveSubscriptionCount());

        return ApiResponse.success(summary);
    }

    // ==================== 设备发现与导入 ====================

    @PostMapping("/discover")
    @Operation(summary = "扫描局域网发现设备")
    public ApiResponse<List<DiscoveredDeviceDTO>> discoverDevices(
            @PathVariable String factoryId,
            @Valid @RequestBody DeviceDiscoveryRequest request) {
        try {
            log.info("开始设备发现: factoryId={}, network={}", factoryId, request.getNetworkCIDR());
            List<DiscoveredDeviceDTO> devices = discoveryService.discoverDevices(request);
            log.info("设备发现完成: factoryId={}, 发现 {} 个设备", factoryId, devices.size());
            return ApiResponse.success("发现 " + devices.size() + " 个设备", devices);
        } catch (Exception e) {
            log.error("设备发现失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return ApiResponse.error("设备发现失败: " + e.getMessage());
        }
    }

    @PostMapping("/batch-import")
    @Operation(summary = "批量导入发现的设备")
    public ApiResponse<Map<String, Object>> batchImportDevices(
            @PathVariable String factoryId,
            @Valid @RequestBody BatchImportRequest request) {
        try {
            log.info("开始批量导入设备: factoryId={}, count={}", factoryId, request.getDevices().size());

            int successCount = 0;
            int failCount = 0;
            List<String> failedDevices = new ArrayList<>();

            for (BatchImportRequest.DeviceImportItem item : request.getDevices()) {
                try {
                    // 转换设备类型
                    IsapiDevice.DeviceType deviceType = IsapiDevice.DeviceType.IPC; // 默认 IPC
                    if (item.getDeviceType() != null && !item.getDeviceType().isEmpty()) {
                        try {
                            deviceType = IsapiDevice.DeviceType.valueOf(item.getDeviceType().toUpperCase());
                        } catch (IllegalArgumentException e) {
                            log.warn("未知设备类型: {}, 使用默认 IPC", item.getDeviceType());
                        }
                    }

                    IsapiDeviceDTO dto = IsapiDeviceDTO.builder()
                            .ipAddress(item.getIpAddress())
                            .port(item.getPort() > 0 ? item.getPort() : 80)
                            .username(item.getUsername())
                            .password(item.getPassword())
                            .deviceName(item.getDeviceName() != null ? item.getDeviceName() : item.getIpAddress())
                            .deviceType(deviceType)
                            .locationDescription(item.getLocationDescription())
                            .build();

                    deviceService.addDevice(factoryId, dto);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    failedDevices.add(item.getIpAddress() + ": " + e.getMessage());
                    log.warn("导入设备失败: ip={}, error={}", item.getIpAddress(), e.getMessage());
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("totalCount", request.getDevices().size());
            result.put("successCount", successCount);
            result.put("failCount", failCount);
            result.put("failedDevices", failedDevices);

            log.info("批量导入完成: factoryId={}, success={}, fail={}", factoryId, successCount, failCount);

            if (failCount == 0) {
                return ApiResponse.success("批量导入成功", result);
            } else if (successCount == 0) {
                return ApiResponse.error("批量导入失败: 所有设备导入失败");
            } else {
                return ApiResponse.success("批量导入部分成功", result);
            }
        } catch (Exception e) {
            log.error("批量导入设备失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return ApiResponse.error("批量导入失败: " + e.getMessage());
        }
    }

    @PostMapping("/scan-single")
    @Operation(summary = "扫描单个IP地址")
    public ApiResponse<List<DiscoveredDeviceDTO>> scanSingleHost(
            @PathVariable String factoryId,
            @RequestParam String ip) {
        try {
            log.info("扫描单个IP: factoryId={}, ip={}", factoryId, ip);
            List<DiscoveredDeviceDTO> devices = discoveryService.scanSingleHost(ip);
            log.info("单IP扫描完成: factoryId={}, ip={}, 发现 {} 个设备", factoryId, ip, devices.size());

            if (devices.isEmpty()) {
                return ApiResponse.success("未发现设备", devices);
            }
            return ApiResponse.success("发现 " + devices.size() + " 个设备", devices);
        } catch (Exception e) {
            log.error("单IP扫描失败: factoryId={}, ip={}, error={}", factoryId, ip, e.getMessage(), e);
            return ApiResponse.error("扫描失败: " + e.getMessage());
        }
    }

    // ==================== 辅助方法 ====================

    private IsapiEventDTO toEventDTO(IsapiEventLog log) {
        return IsapiEventDTO.builder()
                .id(log.getId())
                .factoryId(log.getFactoryId())
                .deviceId(log.getDeviceId())
                .eventType(log.getEventType())
                .eventTypeName(log.getEventTypeName())
                .eventState(log.getEventState())
                .eventDescription(log.getEventDescription())
                .channelId(log.getChannelId())
                .eventData(log.getEventData())
                .detectionRegion(log.getDetectionRegion())
                .pictureUrl(log.getPictureUrl())
                .hasPicture(log.getPictureData() != null || log.getPictureUrl() != null)
                .eventTime(log.getEventTime())
                .receivedTime(log.getReceivedTime())
                .processed(log.getProcessed())
                .processedAt(log.getProcessedAt())
                .processedBy(log.getProcessedBy())
                .processResult(log.getProcessResult())
                .alertId(log.getAlertId())
                .isHeartbeat(log.isHeartbeat())
                .severity(IsapiEventDTO.inferSeverity(log.getEventType(), log.getEventState()))
                // AI 分析结果
                .aiAnalyzed(log.getAiAnalyzed())
                .aiAnalyzedAt(log.getAiAnalyzedAt())
                .aiThreatLevel(log.getAiThreatLevel())
                .aiDetectedObjects(log.getAiDetectedObjectsList())
                .aiObjectCount(log.getAiObjectCount())
                .aiSceneDescription(log.getAiSceneDescription())
                .aiRiskAssessment(log.getAiRiskAssessment())
                .aiRecommendedActions(log.getAiRecommendedActionsList())
                .aiProductionImpact(log.getAiProductionImpact())
                .aiHygieneConcern(log.getAiHygieneConcern())
                .aiSafetyConcern(log.getAiSafetyConcern())
                .aiRequiresAction(log.getAiRequiresAction())
                .build();
    }
}
