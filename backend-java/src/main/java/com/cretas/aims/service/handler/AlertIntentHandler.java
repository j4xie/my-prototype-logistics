package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.equipment.EquipmentAlertDTO;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.EquipmentAlertsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.cretas.aims.util.ErrorSanitizer;

/**
 * 告警意图处理器
 *
 * 处理 ALERT 分类的意图:
 * - ALERT_LIST: 查询告警列表
 * - ALERT_ACTIVE: 查询活动告警
 * - ALERT_STATS: 告警统计
 * - ALERT_ACKNOWLEDGE: 确认告警
 * - ALERT_RESOLVE: 解决告警
 * - ALERT_TRIAGE: 告警智能分级
 * - ALERT_DIAGNOSE: 告警故障诊断
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AlertIntentHandler implements IntentHandler {

    private final EquipmentAlertsService equipmentAlertsService;

    @Override
    public String getSupportedCategory() {
        return "ALERT";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("AlertIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "ALERT_LIST" -> handleAlertList(factoryId, request, intentConfig);
                case "ALERT_ACTIVE" -> handleActiveAlerts(factoryId, request, intentConfig);
                case "ALERT_STATS" -> handleAlertStats(factoryId, intentConfig);
                case "ALERT_ACKNOWLEDGE" -> handleAcknowledgeAlert(factoryId, request, intentConfig, userId);
                case "ALERT_RESOLVE" -> handleResolveAlert(factoryId, request, intentConfig, userId);
                case "ALERT_TRIAGE" -> handleAlertTriage(factoryId, intentConfig);
                case "ALERT_DIAGNOSE" -> handleAlertDiagnose(factoryId, request, intentConfig);
                case "ALERT_BY_EQUIPMENT" -> handleAlertsByEquipment(factoryId, request, intentConfig);
                case "ALERT_BY_LEVEL" -> handleAlertsByLevel(factoryId, request, intentConfig);
                default -> {
                    log.warn("未知的ALERT意图: {}", intentCode);
                    yield IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentCode)
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("ALERT")
                            .status("FAILED")
                            .message("暂不支持此告警操作: " + intentCode)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            };

        } catch (Exception e) {
            log.error("AlertIntentHandler处理失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("ALERT")
                    .status("FAILED")
                    .message("告警操作失败: " + ErrorSanitizer.sanitize(e))
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 查询告警列表
     */
    private IntentExecuteResponse handleAlertList(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig) {
        int page = 1;
        int size = 10;
        String status = null;
        String severity = null;
        String keyword = null;

        if (request.getContext() != null) {
            page = (int) request.getContext().getOrDefault("page", 1);
            size = (int) request.getContext().getOrDefault("size", 10);
            status = (String) request.getContext().get("status");
            severity = (String) request.getContext().get("severity");
            keyword = (String) request.getContext().get("keyword");
        }

        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);

        PageResponse<EquipmentAlertDTO> alerts = equipmentAlertsService.getAlertList(
                factoryId, pageRequest, keyword, severity, status);

        Map<String, Object> result = new HashMap<>();
        result.put("alerts", alerts.getContent());
        result.put("total", alerts.getTotalElements());
        result.put("page", page);
        result.put("size", size);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ALERT")
                .status("COMPLETED")
                .message("查询到 " + alerts.getTotalElements() + " 条告警记录")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 查询活动告警
     */
    private IntentExecuteResponse handleActiveAlerts(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        int page = 1;
        int size = 20;

        if (request.getContext() != null) {
            page = (int) request.getContext().getOrDefault("page", 1);
            size = (int) request.getContext().getOrDefault("size", 20);
        }

        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);

        // 查询活动状态的告警
        PageResponse<EquipmentAlertDTO> activeAlerts = equipmentAlertsService.getAlertList(
                factoryId, pageRequest, null, null, "ACTIVE");

        Map<String, Object> result = new HashMap<>();
        result.put("activeAlerts", activeAlerts.getContent());
        result.put("total", activeAlerts.getTotalElements());

        String urgencyMessage = activeAlerts.getTotalElements() > 10
                ? "警告：有超过10条活动告警需要处理！"
                : "当前有 " + activeAlerts.getTotalElements() + " 条活动告警";

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ALERT")
                .status("COMPLETED")
                .message(urgencyMessage)
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 告警统计
     */
    private IntentExecuteResponse handleAlertStats(String factoryId, AIIntentConfig intentConfig) {
        Map<String, Object> stats = equipmentAlertsService.getAlertStatistics(factoryId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ALERT")
                .status("COMPLETED")
                .message("告警统计数据获取成功")
                .resultData(stats)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 确认告警
     */
    private IntentExecuteResponse handleAcknowledgeAlert(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig, Long userId) {
        if (request.getContext() == null || request.getContext().get("alertId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("ALERT")
                    .status("NEED_INPUT")
                    .message("请提供要确认的告警ID (alertId)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        Integer alertId = parseAlertId(request.getContext().get("alertId"));
        String userName = (String) request.getContext().getOrDefault("userName", "AI助手");

        EquipmentAlertDTO acknowledged = equipmentAlertsService.acknowledgeAlert(factoryId, alertId, userId, userName);

        Map<String, Object> result = new HashMap<>();
        result.put("alert", acknowledged);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ALERT")
                .status("COMPLETED")
                .message("告警已确认: " + alertId)
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 解决告警
     */
    private IntentExecuteResponse handleResolveAlert(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig, Long userId) {
        if (request.getContext() == null || request.getContext().get("alertId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("ALERT")
                    .status("NEED_INPUT")
                    .message("请提供要解决的告警ID (alertId) 和解决方案 (resolution)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        Integer alertId = parseAlertId(request.getContext().get("alertId"));
        String userName = (String) request.getContext().getOrDefault("userName", "AI助手");
        String resolution = (String) request.getContext().getOrDefault("resolution", "通过AI解决");

        EquipmentAlertDTO resolved = equipmentAlertsService.resolveAlert(factoryId, alertId, userId, userName, resolution);

        Map<String, Object> result = new HashMap<>();
        result.put("alert", resolved);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ALERT")
                .status("COMPLETED")
                .message("告警已解决: " + alertId)
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 告警智能分级 - 根据告警类型和频率智能分配优先级
     */
    private IntentExecuteResponse handleAlertTriage(String factoryId, AIIntentConfig intentConfig) {
        // 获取活动告警并进行智能分级
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(1);
        pageRequest.setSize(100);

        PageResponse<EquipmentAlertDTO> activeAlerts = equipmentAlertsService.getAlertList(
                factoryId, pageRequest, null, null, "ACTIVE");

        Map<String, Object> triage = new HashMap<>();
        triage.put("critical", activeAlerts.getContent().stream()
                .filter(a -> "CRITICAL".equals(a.getSeverity())).toList());
        triage.put("warning", activeAlerts.getContent().stream()
                .filter(a -> "WARNING".equals(a.getSeverity())).toList());
        triage.put("info", activeAlerts.getContent().stream()
                .filter(a -> "INFO".equals(a.getSeverity())).toList());
        triage.put("totalActive", activeAlerts.getTotalElements());

        long criticalCount = activeAlerts.getContent().stream()
                .filter(a -> "CRITICAL".equals(a.getSeverity())).count();

        String message = criticalCount > 0
                ? "紧急！有 " + criticalCount + " 条严重告警需要立即处理"
                : "告警分级完成，共 " + activeAlerts.getTotalElements() + " 条活动告警";

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ALERT")
                .status("COMPLETED")
                .message(message)
                .resultData(triage)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 告警故障诊断
     */
    private IntentExecuteResponse handleAlertDiagnose(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("alertId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("ALERT")
                    .status("NEED_INPUT")
                    .message("请提供要诊断的告警ID (alertId)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        Integer alertId = parseAlertId(request.getContext().get("alertId"));
        EquipmentAlertDTO alert = equipmentAlertsService.getAlertById(factoryId, alertId);

        // 基于告警类型生成诊断建议
        Map<String, Object> diagnosis = new HashMap<>();
        diagnosis.put("alert", alert);
        diagnosis.put("possibleCauses", generatePossibleCauses(alert));
        diagnosis.put("suggestedActions", generateSuggestedActions(alert));
        diagnosis.put("estimatedResolutionTime", estimateResolutionTime(alert));

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ALERT")
                .status("COMPLETED")
                .message("故障诊断完成")
                .resultData(diagnosis)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 按设备查询告警
     */
    private IntentExecuteResponse handleAlertsByEquipment(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("equipmentId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("ALERT")
                    .status("NEED_INPUT")
                    .message("请提供设备ID (equipmentId)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String equipmentId = (String) request.getContext().get("equipmentId");
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(1);
        pageRequest.setSize(50);

        // 使用设备ID作为关键词搜索
        PageResponse<EquipmentAlertDTO> alerts = equipmentAlertsService.getAlertList(
                factoryId, pageRequest, equipmentId, null, null);

        Map<String, Object> result = new HashMap<>();
        result.put("equipmentId", equipmentId);
        result.put("alerts", alerts.getContent());
        result.put("total", alerts.getTotalElements());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ALERT")
                .status("COMPLETED")
                .message("设备 " + equipmentId + " 有 " + alerts.getTotalElements() + " 条告警记录")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 按级别查询告警
     */
    private IntentExecuteResponse handleAlertsByLevel(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        String severity = "CRITICAL";
        if (request.getContext() != null) {
            severity = (String) request.getContext().getOrDefault("level", "CRITICAL");
        }

        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(1);
        pageRequest.setSize(50);

        PageResponse<EquipmentAlertDTO> alerts = equipmentAlertsService.getAlertList(
                factoryId, pageRequest, null, severity, null);

        Map<String, Object> result = new HashMap<>();
        result.put("level", severity);
        result.put("alerts", alerts.getContent());
        result.put("total", alerts.getTotalElements());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("ALERT")
                .status("COMPLETED")
                .message(severity + " 级别告警共 " + alerts.getTotalElements() + " 条")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ===== 辅助方法 =====

    private Integer parseAlertId(Object alertIdObj) {
        if (alertIdObj instanceof Integer) {
            return (Integer) alertIdObj;
        } else if (alertIdObj instanceof String) {
            return Integer.parseInt((String) alertIdObj);
        } else if (alertIdObj instanceof Number) {
            return ((Number) alertIdObj).intValue();
        }
        throw new IllegalArgumentException("无效的告警ID格式");
    }

    private List<String> generatePossibleCauses(EquipmentAlertDTO alert) {
        // 基于告警类型生成可能原因
        return List.of(
                "设备老化或磨损",
                "传感器故障",
                "电源不稳定",
                "环境温度异常",
                "维护周期已到"
        );
    }

    private List<String> generateSuggestedActions(EquipmentAlertDTO alert) {
        // 基于告警级别生成建议操作
        if ("CRITICAL".equals(alert.getSeverity())) {
            return List.of(
                    "立即停机检查",
                    "通知维修团队",
                    "备用设备切换"
            );
        }
        return List.of(
                "安排定期检查",
                "监控后续状态",
                "记录异常情况"
        );
    }

    private String estimateResolutionTime(EquipmentAlertDTO alert) {
        return switch (alert.getSeverity() != null ? alert.getSeverity() : "INFO") {
            case "CRITICAL" -> "预计需要2-4小时";
            case "WARNING" -> "预计需要1-2天";
            default -> "可在常规维护时处理";
        };
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .status("PREVIEW")
                .message("告警意图预览功能")
                .executedAt(LocalDateTime.now())
                .build();
    }

    @Override
    public boolean supportsSemanticsMode() {
        // 启用语义模式
        return true;
    }
}
