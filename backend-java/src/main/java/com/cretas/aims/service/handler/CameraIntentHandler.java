package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.isapi.IsapiCaptureDTO;
import com.cretas.aims.dto.isapi.IsapiDeviceDTO;
import com.cretas.aims.dto.isapi.IsapiStreamDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.entity.isapi.IsapiEventLog;
import com.cretas.aims.repository.isapi.IsapiDeviceRepository;
import com.cretas.aims.repository.isapi.IsapiEventLogRepository;
import com.cretas.aims.service.isapi.IsapiDeviceService;
import com.cretas.aims.service.isapi.IsapiEventSubscriptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 摄像头/ISAPI 意图处理器
 *
 * 处理与海康威视 ISAPI 协议相关的 AI 意图，包括：
 * - 设备管理（添加、查看、删除）
 * - 抓拍图片
 * - 告警订阅/取消订阅
 * - 事件查询
 * - 流媒体地址获取
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CameraIntentHandler implements IntentHandler {

    private final IsapiDeviceService deviceService;
    private final IsapiDeviceRepository deviceRepository;
    private final IsapiEventLogRepository eventLogRepository;
    private final IsapiEventSubscriptionService subscriptionService;

    @Override
    public String getSupportedCategory() {
        return "CAMERA";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        log.info("处理摄像头意图: {} - {} (用户: {}, 角色: {})",
                intentCode, intentConfig.getIntentName(), userId, userRole);

        try {
            return switch (intentCode) {
                case "CAMERA_ADD" -> handleAddDevice(factoryId, request, intentConfig);
                case "CAMERA_LIST" -> handleListDevices(factoryId, request, intentConfig);
                case "CAMERA_DETAIL" -> handleDeviceDetail(factoryId, request, intentConfig);
                case "CAMERA_CAPTURE" -> handleCapture(factoryId, request, intentConfig);
                case "CAMERA_SUBSCRIBE" -> handleSubscribe(factoryId, request, intentConfig);
                case "CAMERA_UNSUBSCRIBE" -> handleUnsubscribe(factoryId, request, intentConfig);
                case "CAMERA_EVENTS" -> handleEvents(factoryId, request, intentConfig);
                case "CAMERA_STATUS" -> handleStatus(factoryId, request, intentConfig);
                case "CAMERA_STREAMS" -> handleStreams(factoryId, request, intentConfig);
                case "CAMERA_TEST_CONNECTION" -> handleTestConnection(factoryId, request, intentConfig);
                case "CAMERA_SYNC" -> handleSync(factoryId, request, intentConfig);
                default -> buildErrorResponse(intentConfig, "不支持的意图: " + intentCode);
            };
        } catch (Exception e) {
            log.error("处理摄像头意图异常: {} - {}", intentCode, e.getMessage(), e);
            return buildErrorResponse(intentConfig, "执行失败: " + e.getMessage());
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                          AIIntentConfig intentConfig, Long userId, String userRole) {
        // 预览模式返回将要执行的操作描述
        String intentCode = intentConfig.getIntentCode();

        String previewMessage = switch (intentCode) {
            case "CAMERA_ADD" -> "将添加新的摄像头设备";
            case "CAMERA_LIST" -> "将列出工厂中所有摄像头设备";
            case "CAMERA_DETAIL" -> "将显示指定摄像头的详细信息";
            case "CAMERA_CAPTURE" -> "将从指定摄像头抓拍当前画面";
            case "CAMERA_SUBSCRIBE" -> "将订阅摄像头的告警事件推送";
            case "CAMERA_UNSUBSCRIBE" -> "将取消摄像头的告警事件订阅";
            case "CAMERA_EVENTS" -> "将查询摄像头的告警事件记录";
            case "CAMERA_STATUS" -> "将查询摄像头设备的在线状态";
            case "CAMERA_STREAMS" -> "将获取摄像头的流媒体播放地址";
            case "CAMERA_TEST_CONNECTION" -> "将测试摄像头的网络连接";
            case "CAMERA_SYNC" -> "将从摄像头同步最新的配置信息";
            default -> "未知操作";
        };

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig.getIntentName())
                .intentCategory("CAMERA")
                .status("PREVIEW")
                .message(previewMessage)
                .build();
    }

    // ==================== 意图处理方法 ====================

    /**
     * 添加摄像头设备
     */
    private IntentExecuteResponse handleAddDevice(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig) {
        Map<String, Object> context = request.getContext();
        if (context == null) {
            return buildNeedInfoResponse(intentConfig,
                    "请提供摄像头信息，包括：设备名称、IP地址、端口、用户名、密码",
                    List.of("deviceName", "ipAddress", "port", "username", "password"));
        }

        // 从 context 中提取参数
        String deviceName = extractString(context, "deviceName", "name");
        String ipAddress = extractString(context, "ipAddress", "ip");
        Integer port = extractInteger(context, "port");
        String username = extractString(context, "username", "user");
        String password = extractString(context, "password", "pwd");
        String deviceType = extractString(context, "deviceType", "type");

        // 验证必填参数
        List<String> missing = new ArrayList<>();
        if (isBlank(deviceName)) missing.add("deviceName (设备名称)");
        if (isBlank(ipAddress)) missing.add("ipAddress (IP地址)");
        if (isBlank(username)) missing.add("username (用户名)");
        if (isBlank(password)) missing.add("password (密码)");

        if (!missing.isEmpty()) {
            return buildNeedInfoResponse(intentConfig,
                    "缺少必填参数: " + String.join(", ", missing),
                    missing.stream().map(s -> s.split(" ")[0]).collect(Collectors.toList()));
        }

        // 构建 DTO
        IsapiDeviceDTO dto = IsapiDeviceDTO.builder()
                .deviceName(deviceName)
                .deviceType(deviceType != null ? IsapiDevice.DeviceType.valueOf(deviceType.toUpperCase())
                        : IsapiDevice.DeviceType.IPC)
                .ipAddress(ipAddress)
                .port(port != null ? port : 80)
                .username(username)
                .password(password)
                .build();

        // 添加设备
        IsapiDevice device = deviceService.addDevice(factoryId, dto);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CAMERA")
                .status("COMPLETED")
                .message("摄像头添加成功: " + device.getDeviceName())
                .resultData(deviceService.toDTO(device))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("IsapiDevice")
                                .entityId(device.getId())
                                .entityName(device.getDeviceName())
                                .action("CREATED")
                                .build()
                ))
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 查看摄像头列表
     */
    private IntentExecuteResponse handleListDevices(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig) {
        Map<String, Object> context = request.getContext();
        int page = context != null ? extractInteger(context, "page", 0) : 0;
        int size = context != null ? extractInteger(context, "size", 20) : 20;

        Page<IsapiDevice> devices = deviceService.listDevices(factoryId, PageRequest.of(page, size));

        List<IsapiDeviceDTO> deviceList = devices.getContent().stream()
                .map(deviceService::toDTO)
                .collect(Collectors.toList());

        // 构建状态统计
        Map<String, Long> statusStats = deviceService.getStatusStatistics(factoryId);

        Map<String, Object> resultData = new HashMap<>();
        resultData.put("devices", deviceList);
        resultData.put("totalElements", devices.getTotalElements());
        resultData.put("totalPages", devices.getTotalPages());
        resultData.put("statusStatistics", statusStats);

        long onlineCount = statusStats.getOrDefault("ONLINE", 0L);
        long totalCount = devices.getTotalElements();

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CAMERA")
                .status("COMPLETED")
                .message(String.format("共 %d 台摄像头，%d 台在线", totalCount, onlineCount))
                .resultData(resultData)
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 查看摄像头详情
     */
    private IntentExecuteResponse handleDeviceDetail(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        String deviceId = extractDeviceId(request);
        if (deviceId == null) {
            return buildNeedInfoResponse(intentConfig, "请指定要查看的摄像头", List.of("deviceId"));
        }

        IsapiDevice device = deviceService.getDevice(deviceId);
        IsapiDeviceDTO dto = deviceService.toDTO(device);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CAMERA")
                .status("COMPLETED")
                .message("摄像头详情: " + device.getDeviceName())
                .resultData(dto)
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 抓拍图片
     */
    private IntentExecuteResponse handleCapture(String factoryId, IntentExecuteRequest request,
                                                 AIIntentConfig intentConfig) {
        String deviceId = extractDeviceId(request);
        if (deviceId == null) {
            // 尝试按关键词搜索设备
            String keyword = extractKeyword(request);
            if (keyword != null) {
                Page<IsapiDevice> devices = deviceService.searchDevices(factoryId, keyword, PageRequest.of(0, 1));
                if (!devices.isEmpty()) {
                    deviceId = devices.getContent().get(0).getId();
                }
            }
            if (deviceId == null) {
                return buildNeedInfoResponse(intentConfig, "请指定要抓拍的摄像头", List.of("deviceId", "deviceName"));
            }
        }

        Map<String, Object> context = request.getContext();
        int channelId = context != null ? extractInteger(context, "channelId", 1) : 1;

        IsapiCaptureDTO capture = deviceService.capturePicture(deviceId, channelId);

        if (!capture.getSuccess()) {
            return buildErrorResponse(intentConfig, "抓拍失败: " + capture.getError());
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CAMERA")
                .status("COMPLETED")
                .message("抓拍成功: " + capture.getDeviceName())
                .resultData(capture)
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 订阅告警
     */
    private IntentExecuteResponse handleSubscribe(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig) {
        String deviceId = extractDeviceId(request);

        if (deviceId != null) {
            // 订阅单个设备
            subscriptionService.subscribeDevice(deviceId);
            IsapiDevice device = deviceService.getDevice(deviceId);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("CAMERA")
                    .status("COMPLETED")
                    .message("已开启告警订阅: " + device.getDeviceName())
                    .resultData(Map.of(
                            "deviceId", deviceId,
                            "deviceName", device.getDeviceName(),
                            "subscribed", true
                    ))
                    .quotaCost(intentConfig.getQuotaCost())
                    .executedAt(LocalDateTime.now())
                    .build();
        } else {
            // 订阅所有设备
            subscriptionService.subscribeAllDevices(factoryId);
            int count = subscriptionService.getActiveSubscriptionCount();
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("CAMERA")
                    .status("COMPLETED")
                    .message("已订阅所有在线摄像头告警，共 " + count + " 台")
                    .resultData(Map.of(
                            "subscribedCount", count,
                            "subscribedDeviceIds", subscriptionService.getActiveSubscriptionIds()
                    ))
                    .quotaCost(intentConfig.getQuotaCost())
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 取消订阅告警
     */
    private IntentExecuteResponse handleUnsubscribe(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig) {
        String deviceId = extractDeviceId(request);

        if (deviceId != null) {
            // 取消单个设备订阅
            subscriptionService.unsubscribeDevice(deviceId);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("CAMERA")
                    .status("COMPLETED")
                    .message("已取消告警订阅")
                    .resultData(Map.of("deviceId", deviceId, "subscribed", false))
                    .quotaCost(intentConfig.getQuotaCost())
                    .executedAt(LocalDateTime.now())
                    .build();
        } else {
            // 取消所有订阅
            subscriptionService.unsubscribeAllDevices(factoryId);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("CAMERA")
                    .status("COMPLETED")
                    .message("已取消所有摄像头的告警订阅")
                    .resultData(Map.of("activeSubscriptions", 0))
                    .quotaCost(intentConfig.getQuotaCost())
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 查看告警事件
     */
    private IntentExecuteResponse handleEvents(String factoryId, IntentExecuteRequest request,
                                                AIIntentConfig intentConfig) {
        Map<String, Object> context = request.getContext();
        String deviceId = extractDeviceId(request);
        int page = context != null ? extractInteger(context, "page", 0) : 0;
        int size = context != null ? extractInteger(context, "size", 20) : 20;

        Page<IsapiEventLog> events;
        Pageable pageable = PageRequest.of(page, size);

        if (deviceId != null) {
            events = eventLogRepository.findByFactoryIdAndDeviceIdOrderByEventTimeDesc(
                    factoryId, deviceId, pageable);
        } else {
            // 检查是否查询今日
            String userInput = request.getUserInput();
            if (userInput != null && (userInput.contains("今天") || userInput.contains("今日"))) {
                LocalDateTime todayStart = LocalDate.now().atStartOfDay();
                events = eventLogRepository.findByTimeRange(factoryId, todayStart, LocalDateTime.now(), pageable);
            } else {
                events = eventLogRepository.findByFactoryIdOrderByEventTimeDesc(factoryId, pageable);
            }
        }

        List<Map<String, Object>> eventList = events.getContent().stream()
                .map(this::convertEventToMap)
                .collect(Collectors.toList());

        Map<String, Object> resultData = new HashMap<>();
        resultData.put("events", eventList);
        resultData.put("totalElements", events.getTotalElements());
        resultData.put("totalPages", events.getTotalPages());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CAMERA")
                .status("COMPLETED")
                .message(String.format("共 %d 条告警记录", events.getTotalElements()))
                .resultData(resultData)
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 查看设备状态
     */
    private IntentExecuteResponse handleStatus(String factoryId, IntentExecuteRequest request,
                                                AIIntentConfig intentConfig) {
        Map<String, Long> statusStats = deviceService.getStatusStatistics(factoryId);

        long online = statusStats.getOrDefault("ONLINE", 0L);
        long offline = statusStats.getOrDefault("OFFLINE", 0L);
        long error = statusStats.getOrDefault("ERROR", 0L);
        long unknown = statusStats.getOrDefault("UNKNOWN", 0L);
        long total = online + offline + error + unknown;

        // 获取离线设备列表 (最多显示10个)
        List<IsapiDevice> offlineDevices = deviceRepository.findByFactoryIdAndStatus(
                factoryId, IsapiDevice.DeviceStatus.OFFLINE);

        List<Map<String, String>> offlineList = offlineDevices.stream().limit(10)
                .map(d -> Map.of(
                        "id", d.getId(),
                        "name", d.getDeviceName(),
                        "ip", d.getIpAddress(),
                        "lastError", d.getLastError() != null ? d.getLastError() : "未知"
                ))
                .collect(Collectors.toList());

        Map<String, Object> resultData = new HashMap<>();
        resultData.put("statistics", statusStats);
        resultData.put("total", total);
        resultData.put("online", online);
        resultData.put("offline", offline);
        resultData.put("error", error);
        resultData.put("offlineDevices", offlineList);
        resultData.put("activeSubscriptions", subscriptionService.getActiveSubscriptionCount());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CAMERA")
                .status("COMPLETED")
                .message(String.format("摄像头状态: 在线 %d / 总计 %d", online, total))
                .resultData(resultData)
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 获取流地址
     */
    private IntentExecuteResponse handleStreams(String factoryId, IntentExecuteRequest request,
                                                 AIIntentConfig intentConfig) {
        String deviceId = extractDeviceId(request);
        if (deviceId == null) {
            return buildNeedInfoResponse(intentConfig, "请指定要获取流地址的摄像头", List.of("deviceId"));
        }

        List<IsapiStreamDTO> streams = deviceService.getStreamUrls(deviceId);
        IsapiDevice device = deviceService.getDevice(deviceId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CAMERA")
                .status("COMPLETED")
                .message("流地址获取成功: " + device.getDeviceName() + " (" + streams.size() + " 个通道)")
                .resultData(Map.of(
                        "deviceId", deviceId,
                        "deviceName", device.getDeviceName(),
                        "streams", streams
                ))
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 测试连接
     */
    private IntentExecuteResponse handleTestConnection(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {
        String deviceId = extractDeviceId(request);
        if (deviceId == null) {
            return buildNeedInfoResponse(intentConfig, "请指定要测试连接的摄像头", List.of("deviceId"));
        }

        boolean success = deviceService.testConnection(deviceId);
        IsapiDevice device = deviceService.getDevice(deviceId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CAMERA")
                .status("COMPLETED")
                .message(success
                        ? "连接成功: " + device.getDeviceName()
                        : "连接失败: " + device.getDeviceName() + " - " + device.getLastError())
                .resultData(Map.of(
                        "deviceId", deviceId,
                        "deviceName", device.getDeviceName(),
                        "connected", success,
                        "status", device.getStatus().name()
                ))
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 同步设备信息
     */
    private IntentExecuteResponse handleSync(String factoryId, IntentExecuteRequest request,
                                              AIIntentConfig intentConfig) {
        String deviceId = extractDeviceId(request);
        if (deviceId == null) {
            return buildNeedInfoResponse(intentConfig, "请指定要同步的摄像头", List.of("deviceId"));
        }

        deviceService.syncDeviceInfo(deviceId);
        IsapiDevice device = deviceService.getDevice(deviceId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CAMERA")
                .status("COMPLETED")
                .message("同步成功: " + device.getDeviceName())
                .resultData(deviceService.toDTO(device))
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ==================== 辅助方法 ====================

    /**
     * 从请求中提取设备ID
     */
    private String extractDeviceId(IntentExecuteRequest request) {
        Map<String, Object> context = request.getContext();
        if (context == null) return null;

        // 优先使用 deviceId
        String deviceId = extractString(context, "deviceId", "id", "cameraId");
        if (deviceId != null) return deviceId;

        // 也检查 entityId
        if (request.getEntityId() != null) {
            return request.getEntityId();
        }

        return null;
    }

    /**
     * 从请求中提取搜索关键词
     */
    private String extractKeyword(IntentExecuteRequest request) {
        Map<String, Object> context = request.getContext();
        if (context != null) {
            String keyword = extractString(context, "keyword", "deviceName", "name", "location");
            if (keyword != null) return keyword;
        }

        // 尝试从用户输入中提取位置关键词
        String userInput = request.getUserInput();
        if (userInput != null) {
            // 常见位置关键词
            String[] locationKeywords = {"入口", "出口", "车间", "仓库", "大门", "门口", "通道"};
            for (String kw : locationKeywords) {
                if (userInput.contains(kw)) {
                    return kw;
                }
            }
        }

        return null;
    }

    /**
     * 从 context 中提取字符串，支持多个可能的 key
     */
    private String extractString(Map<String, Object> context, String... keys) {
        for (String key : keys) {
            Object value = context.get(key);
            if (value != null && value instanceof String && !((String) value).isBlank()) {
                return (String) value;
            }
        }
        return null;
    }

    /**
     * 从 context 中提取整数
     */
    private Integer extractInteger(Map<String, Object> context, String key) {
        Object value = context.get(key);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private int extractInteger(Map<String, Object> context, String key, int defaultValue) {
        Integer value = extractInteger(context, key);
        return value != null ? value : defaultValue;
    }

    private boolean isBlank(String str) {
        return str == null || str.isBlank();
    }

    /**
     * 构建需要更多信息的响应
     */
    private IntentExecuteResponse buildNeedInfoResponse(AIIntentConfig config, String message,
                                                         List<String> requiredFields) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(config.getIntentCode())
                .intentName(config.getIntentName())
                .intentCategory("CAMERA")
                .status("NEED_MORE_INFO")
                .message(message)
                .metadata(Map.of("requiredFields", requiredFields))
                .build();
    }

    /**
     * 构建错误响应
     */
    private IntentExecuteResponse buildErrorResponse(AIIntentConfig config, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(config.getIntentCode())
                .intentName(config.getIntentName())
                .intentCategory("CAMERA")
                .status("FAILED")
                .message(message)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 转换事件日志为 Map
     */
    private Map<String, Object> convertEventToMap(IsapiEventLog event) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", event.getId());
        map.put("deviceId", event.getDeviceId());
        map.put("eventType", event.getEventType());
        map.put("eventTypeName", event.getEventTypeName());
        map.put("eventState", event.getEventState() != null ? event.getEventState().name() : null);
        map.put("eventDescription", event.getEventDescription());
        map.put("channelId", event.getChannelId());
        map.put("eventTime", event.getEventTime());
        map.put("processed", event.getProcessed());
        return map;
    }
}
