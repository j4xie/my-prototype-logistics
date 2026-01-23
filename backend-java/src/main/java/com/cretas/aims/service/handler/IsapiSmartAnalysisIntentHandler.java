package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO.SmartCapabilities;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.entity.isapi.IsapiEventLog;
import com.cretas.aims.repository.isapi.IsapiDeviceRepository;
import com.cretas.aims.repository.isapi.IsapiEventLogRepository;
import com.cretas.aims.service.isapi.IsapiDeviceService;
import com.cretas.aims.service.isapi.IsapiSmartAnalysisService;
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
 * ISAPI 智能分析意图处理器
 *
 * 处理与海康威视摄像头智能分析相关的 AI 意图，包括：
 * - 配置行为检测 (越界检测/警戒线)
 * - 配置区域入侵检测
 * - 查询检测事件
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IsapiSmartAnalysisIntentHandler implements IntentHandler {

    private final IsapiSmartAnalysisService smartAnalysisService;
    private final IsapiDeviceService deviceService;
    private final IsapiDeviceRepository deviceRepository;
    private final IsapiEventLogRepository eventLogRepository;

    @Override
    public String getSupportedCategory() {
        return "ISAPI_SMART";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        log.info("Processing smart analysis intent: {} - {} (user: {}, role: {})",
                intentCode, intentConfig.getIntentName(), userId, userRole);

        try {
            return switch (intentCode) {
                case "ISAPI_CONFIG_LINE_DETECTION" -> handleConfigLineDetection(factoryId, request, intentConfig);
                case "ISAPI_CONFIG_FIELD_DETECTION" -> handleConfigFieldDetection(factoryId, request, intentConfig);
                case "ISAPI_QUERY_DETECTION_EVENTS" -> handleQueryDetectionEvents(factoryId, request, intentConfig);
                default -> buildErrorResponse(intentConfig, "Unsupported intent: " + intentCode);
            };
        } catch (Exception e) {
            log.error("Error processing smart analysis intent: {} - {}", intentCode, e.getMessage(), e);
            return buildErrorResponse(intentConfig, "Execution failed: " + e.getMessage());
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                          AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();

        String previewMessage = switch (intentCode) {
            case "ISAPI_CONFIG_LINE_DETECTION" -> "Will configure line crossing detection (virtual tripwire) rules for the camera";
            case "ISAPI_CONFIG_FIELD_DETECTION" -> "Will configure field intrusion detection rules for the camera";
            case "ISAPI_QUERY_DETECTION_EVENTS" -> "Will query smart analysis detection events (crossing, intrusion, etc.)";
            default -> "Unknown operation";
        };

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig.getIntentName())
                .intentCategory("ISAPI_SMART")
                .status("PREVIEW")
                .message(previewMessage)
                .build();
    }

    // ==================== Intent Handlers ====================

    /**
     * Handle line detection configuration
     */
    private IntentExecuteResponse handleConfigLineDetection(String factoryId, IntentExecuteRequest request,
                                                             AIIntentConfig intentConfig) {
        Map<String, Object> context = request.getContext();
        String deviceId = extractDeviceId(request);

        if (deviceId == null) {
            // Try to find device by keyword
            String keyword = extractKeyword(request);
            if (keyword != null) {
                Page<IsapiDevice> devices = deviceService.searchDevices(factoryId, keyword, PageRequest.of(0, 1));
                if (!devices.isEmpty()) {
                    deviceId = devices.getContent().get(0).getId();
                }
            }
            if (deviceId == null) {
                return buildNeedInfoResponse(intentConfig,
                        "Please specify the camera to configure. You can provide the device name or ID.",
                        List.of("deviceId", "deviceName"));
            }
        }

        int channelId = context != null ? extractInteger(context, "channelId", 1) : 1;

        // Check if device supports smart analysis
        try {
            SmartCapabilities caps = smartAnalysisService.getSmartCapabilities(factoryId, deviceId);
            if (!Boolean.TRUE.equals(caps.getLineDetectionSupported())) {
                return buildErrorResponse(intentConfig, "This device does not support line detection");
            }
        } catch (Exception e) {
            log.warn("Failed to check device capabilities: {}", e.getMessage());
        }

        // Check if this is a query or configuration request
        String userInput = request.getUserInput();
        boolean isQuery = userInput != null && (
                userInput.contains("query") || userInput.contains("check") ||
                userInput.contains("view") || userInput.contains("current") ||
                userInput.contains("existing"));

        if (isQuery || context == null || !context.containsKey("enabled")) {
            // Query current configuration
            SmartAnalysisDTO config = smartAnalysisService.getLineDetectionConfig(factoryId, deviceId, channelId);
            IsapiDevice device = deviceService.getDevice(deviceId);

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("ISAPI_SMART")
                    .status("COMPLETED")
                    .message(String.format("Line detection config for %s channel %d: %s, %d rules",
                            device.getDeviceName(), channelId,
                            Boolean.TRUE.equals(config.getEnabled()) ? "enabled" : "disabled",
                            config.getRules() != null ? config.getRules().size() : 0))
                    .resultData(Map.of(
                            "deviceId", deviceId,
                            "deviceName", device.getDeviceName(),
                            "channelId", channelId,
                            "config", config
                    ))
                    .quotaCost(intentConfig.getQuotaCost())
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // Save configuration
        SmartAnalysisDTO config = buildDetectionConfig(context, SmartAnalysisDTO.DetectionType.LINE_DETECTION);
        smartAnalysisService.saveLineDetectionConfig(factoryId, deviceId, channelId, config);
        IsapiDevice device = deviceService.getDevice(deviceId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ISAPI_SMART")
                .status("COMPLETED")
                .message(String.format("Line detection configured successfully for %s channel %d",
                        device.getDeviceName(), channelId))
                .resultData(Map.of(
                        "deviceId", deviceId,
                        "deviceName", device.getDeviceName(),
                        "channelId", channelId,
                        "enabled", config.getEnabled()
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("IsapiDevice")
                                .entityId(deviceId)
                                .entityName(device.getDeviceName())
                                .action("CONFIG_UPDATED")
                                .build()
                ))
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * Handle field detection configuration
     */
    private IntentExecuteResponse handleConfigFieldDetection(String factoryId, IntentExecuteRequest request,
                                                              AIIntentConfig intentConfig) {
        Map<String, Object> context = request.getContext();
        String deviceId = extractDeviceId(request);

        if (deviceId == null) {
            String keyword = extractKeyword(request);
            if (keyword != null) {
                Page<IsapiDevice> devices = deviceService.searchDevices(factoryId, keyword, PageRequest.of(0, 1));
                if (!devices.isEmpty()) {
                    deviceId = devices.getContent().get(0).getId();
                }
            }
            if (deviceId == null) {
                return buildNeedInfoResponse(intentConfig,
                        "Please specify the camera to configure. You can provide the device name or ID.",
                        List.of("deviceId", "deviceName"));
            }
        }

        int channelId = context != null ? extractInteger(context, "channelId", 1) : 1;

        // Check device capabilities
        try {
            SmartCapabilities caps = smartAnalysisService.getSmartCapabilities(factoryId, deviceId);
            if (!Boolean.TRUE.equals(caps.getFieldDetectionSupported())) {
                return buildErrorResponse(intentConfig, "This device does not support field detection");
            }
        } catch (Exception e) {
            log.warn("Failed to check device capabilities: {}", e.getMessage());
        }

        // Check if query or configuration
        String userInput = request.getUserInput();
        boolean isQuery = userInput != null && (
                userInput.contains("query") || userInput.contains("check") ||
                userInput.contains("view") || userInput.contains("current"));

        if (isQuery || context == null || !context.containsKey("enabled")) {
            SmartAnalysisDTO config = smartAnalysisService.getFieldDetectionConfig(factoryId, deviceId, channelId);
            IsapiDevice device = deviceService.getDevice(deviceId);

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("ISAPI_SMART")
                    .status("COMPLETED")
                    .message(String.format("Field detection config for %s channel %d: %s, %d rules",
                            device.getDeviceName(), channelId,
                            Boolean.TRUE.equals(config.getEnabled()) ? "enabled" : "disabled",
                            config.getRules() != null ? config.getRules().size() : 0))
                    .resultData(Map.of(
                            "deviceId", deviceId,
                            "deviceName", device.getDeviceName(),
                            "channelId", channelId,
                            "config", config
                    ))
                    .quotaCost(intentConfig.getQuotaCost())
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // Save configuration
        SmartAnalysisDTO config = buildDetectionConfig(context, SmartAnalysisDTO.DetectionType.FIELD_DETECTION);
        smartAnalysisService.saveFieldDetectionConfig(factoryId, deviceId, channelId, config);
        IsapiDevice device = deviceService.getDevice(deviceId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ISAPI_SMART")
                .status("COMPLETED")
                .message(String.format("Field detection configured successfully for %s channel %d",
                        device.getDeviceName(), channelId))
                .resultData(Map.of(
                        "deviceId", deviceId,
                        "deviceName", device.getDeviceName(),
                        "channelId", channelId,
                        "enabled", config.getEnabled()
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("IsapiDevice")
                                .entityId(deviceId)
                                .entityName(device.getDeviceName())
                                .action("CONFIG_UPDATED")
                                .build()
                ))
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * Handle query detection events
     */
    private IntentExecuteResponse handleQueryDetectionEvents(String factoryId, IntentExecuteRequest request,
                                                              AIIntentConfig intentConfig) {
        Map<String, Object> context = request.getContext();
        String deviceId = extractDeviceId(request);
        int page = context != null ? extractInteger(context, "page", 0) : 0;
        int size = context != null ? extractInteger(context, "size", 20) : 20;

        Pageable pageable = PageRequest.of(page, size);
        Page<IsapiEventLog> events;

        // Check for time filters in user input
        String userInput = request.getUserInput();
        LocalDateTime startTime = null;
        LocalDateTime endTime = LocalDateTime.now();

        if (userInput != null) {
            if (userInput.contains("today") || userInput.contains("今天") || userInput.contains("今日")) {
                startTime = LocalDate.now().atStartOfDay();
            } else if (userInput.contains("yesterday") || userInput.contains("昨天")) {
                startTime = LocalDate.now().minusDays(1).atStartOfDay();
                endTime = LocalDate.now().atStartOfDay();
            } else if (userInput.contains("week") || userInput.contains("本周") || userInput.contains("这周")) {
                startTime = LocalDate.now().minusDays(7).atStartOfDay();
            }
        }

        // Filter by event type for smart analysis events
        List<String> smartEventTypes = List.of("linedetection", "fielddetection", "facedetection",
                "intrusion", "lineDetection", "fieldDetection", "faceDetection");

        if (deviceId != null) {
            if (startTime != null) {
                events = eventLogRepository.findByTimeRange(factoryId, startTime, endTime, pageable);
            } else {
                events = eventLogRepository.findByFactoryIdAndDeviceIdOrderByEventTimeDesc(
                        factoryId, deviceId, pageable);
            }
        } else {
            if (startTime != null) {
                events = eventLogRepository.findByTimeRange(factoryId, startTime, endTime, pageable);
            } else {
                events = eventLogRepository.findByFactoryIdOrderByEventTimeDesc(factoryId, pageable);
            }
        }

        // Filter for smart analysis event types
        List<Map<String, Object>> filteredEvents = events.getContent().stream()
                .filter(e -> smartEventTypes.stream().anyMatch(t ->
                        t.equalsIgnoreCase(e.getEventType()) ||
                        (e.getEventType() != null && e.getEventType().toLowerCase().contains("detection"))))
                .map(this::convertEventToMap)
                .collect(Collectors.toList());

        // Get statistics
        Map<String, Long> eventTypeStats = new HashMap<>();
        for (Map<String, Object> event : filteredEvents) {
            String type = (String) event.get("eventType");
            eventTypeStats.merge(type, 1L, Long::sum);
        }

        Map<String, Object> resultData = new HashMap<>();
        resultData.put("events", filteredEvents);
        resultData.put("totalElements", filteredEvents.size());
        resultData.put("totalPages", events.getTotalPages());
        resultData.put("eventTypeStats", eventTypeStats);
        if (deviceId != null) {
            resultData.put("deviceId", deviceId);
        }

        String timeDesc = startTime != null ?
                (userInput.contains("today") || userInput.contains("今") ? "today" :
                 userInput.contains("yesterday") || userInput.contains("昨") ? "yesterday" : "this week")
                : "recent";

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ISAPI_SMART")
                .status("COMPLETED")
                .message(String.format("Found %d smart analysis events (%s)", filteredEvents.size(), timeDesc))
                .resultData(resultData)
                .quotaCost(intentConfig.getQuotaCost())
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ==================== Helper Methods ====================

    /**
     * Build detection configuration from context
     */
    private SmartAnalysisDTO buildDetectionConfig(Map<String, Object> context,
                                                   SmartAnalysisDTO.DetectionType detectionType) {
        SmartAnalysisDTO config = new SmartAnalysisDTO();
        config.setDetectionType(detectionType);
        config.setEnabled(extractBoolean(context, "enabled", true));

        Integer channelId = extractInteger(context, "channelId");
        if (channelId != null) {
            config.setChannelId(channelId);
        }

        // Build rules if provided
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rulesData = (List<Map<String, Object>>) context.get("rules");
        if (rulesData != null && !rulesData.isEmpty()) {
            List<SmartAnalysisDTO.DetectionRule> rules = new ArrayList<>();
            for (Map<String, Object> ruleData : rulesData) {
                SmartAnalysisDTO.DetectionRule rule = SmartAnalysisDTO.DetectionRule.builder()
                        .id(extractInteger(ruleData, "id"))
                        .name(extractString(ruleData, "name", "ruleName"))
                        .enabled(extractBoolean(ruleData, "enabled", true))
                        .sensitivityLevel(extractInteger(ruleData, "sensitivityLevel", 50))
                        .detectionTarget(extractString(ruleData, "detectionTarget", "target"))
                        .direction(extractString(ruleData, "direction"))
                        .timeThreshold(extractInteger(ruleData, "timeThreshold"))
                        .build();
                rules.add(rule);
            }
            config.setRules(rules);
        }

        return config;
    }

    /**
     * Extract device ID from request
     */
    private String extractDeviceId(IntentExecuteRequest request) {
        Map<String, Object> context = request.getContext();
        if (context == null) return null;

        String deviceId = extractString(context, "deviceId", "id", "cameraId");
        if (deviceId != null) return deviceId;

        if (request.getEntityId() != null) {
            return request.getEntityId();
        }

        return null;
    }

    /**
     * Extract search keyword from request
     */
    private String extractKeyword(IntentExecuteRequest request) {
        Map<String, Object> context = request.getContext();
        if (context != null) {
            String keyword = extractString(context, "keyword", "deviceName", "name", "location");
            if (keyword != null) return keyword;
        }

        String userInput = request.getUserInput();
        if (userInput != null) {
            String[] locationKeywords = {"entrance", "exit", "workshop", "warehouse", "gate", "door", "channel",
                    "入口", "出口", "车间", "仓库", "大门", "门口", "通道"};
            for (String kw : locationKeywords) {
                if (userInput.contains(kw)) {
                    return kw;
                }
            }
        }

        return null;
    }

    /**
     * Extract string from context with multiple possible keys
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
     * Extract integer from context
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

    /**
     * Extract boolean from context
     */
    private boolean extractBoolean(Map<String, Object> context, String key, boolean defaultValue) {
        Object value = context.get(key);
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof String) {
            return Boolean.parseBoolean((String) value);
        }
        return defaultValue;
    }

    /**
     * Build need more info response
     */
    private IntentExecuteResponse buildNeedInfoResponse(AIIntentConfig config, String message,
                                                         List<String> requiredFields) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(config.getIntentCode())
                .intentName(config.getIntentName())
                .intentCategory("ISAPI_SMART")
                .status("NEED_MORE_INFO")
                .message(message)
                .metadata(Map.of("requiredFields", requiredFields))
                .build();
    }

    /**
     * Build error response
     */
    private IntentExecuteResponse buildErrorResponse(AIIntentConfig config, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(config.getIntentCode())
                .intentName(config.getIntentName())
                .intentCategory("ISAPI_SMART")
                .status("FAILED")
                .message(message)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * Convert event log to map
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
        map.put("aiAnalyzed", event.getAiAnalyzed());
        map.put("aiThreatLevel", event.getAiThreatLevel());
        return map;
    }
}
