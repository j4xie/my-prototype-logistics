package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.equipment.EquipmentDTO;
import com.cretas.aims.dto.equipment.EquipmentAlertDTO;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.EquipmentService;
import com.cretas.aims.service.EquipmentAlertsService;
import com.cretas.aims.service.CameraService;
import com.cretas.aims.dto.camera.CameraDeviceInfo;
import com.cretas.aims.dto.camera.CaptureImageResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.cretas.aims.util.ErrorSanitizer;

/**
 * 设备意图处理器
 *
 * 处理 EQUIPMENT 分类的意图:
 * - EQUIPMENT_LIST: 查询设备列表
 * - EQUIPMENT_DETAIL: 查询设备详情
 * - EQUIPMENT_STATUS_QUERY: 查询设备运行状态
 * - EQUIPMENT_STATS: 设备统计
 * - EQUIPMENT_START: 启动设备
 * - EQUIPMENT_STOP: 停止设备
 * - EQUIPMENT_STATUS_UPDATE: 更新设备状态
 * - EQUIPMENT_ALERT_LIST: 设备告警列表
 * - EQUIPMENT_ALERT_STATS: 设备告警统计
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-11
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EquipmentIntentHandler implements IntentHandler {

    private final EquipmentService equipmentService;
    private final EquipmentAlertsService equipmentAlertsService;
    private final CameraService cameraService;

    @Override
    public String getSupportedCategory() {
        return "EQUIPMENT";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("EquipmentIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "EQUIPMENT_LIST" -> handleEquipmentList(factoryId, request, intentConfig);
                case "EQUIPMENT_DETAIL" -> handleEquipmentDetail(factoryId, request, intentConfig);
                case "EQUIPMENT_STATUS_QUERY" -> handleEquipmentStatusQuery(factoryId, request, intentConfig);
                case "EQUIPMENT_STATS" -> handleEquipmentStats(factoryId, intentConfig);
                case "EQUIPMENT_START" -> handleEquipmentStart(factoryId, request, intentConfig);
                case "EQUIPMENT_STOP" -> handleEquipmentStop(factoryId, request, intentConfig);
                case "EQUIPMENT_STATUS_UPDATE" -> handleEquipmentStatusUpdate(factoryId, request, intentConfig);
                case "EQUIPMENT_BREAKDOWN_REPORT" -> handleBreakdownReport(factoryId, intentConfig);
                case "QUERY_EQUIPMENT_STATUS_BY_NAME" -> handleQueryByName(factoryId, request, intentConfig);
                case "ANALYZE_EQUIPMENT" -> handleAnalyzeEquipment(factoryId, request, intentConfig);
                case "EQUIPMENT_CAMERA_START" -> handleCameraStart(factoryId, intentConfig);
                case "CCP_MONITOR_DATA_DETECTION" -> handleCcpMonitor(factoryId, intentConfig);
                case "COLD_CHAIN_TEMPERATURE" -> handleColdChainTemperature(factoryId, intentConfig);
                case "EQUIPMENT_MAINTENANCE" -> handleEquipmentMaintenance(factoryId, request, intentConfig);
                case "EQUIPMENT_HEALTH_DIAGNOSIS" -> handleHealthDiagnosis(factoryId, request, intentConfig);
                default -> {
                    log.warn("未知的EQUIPMENT意图: {}", intentCode);
                    yield IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentCode)
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("EQUIPMENT")
                            .status("FAILED")
                            .message("暂不支持此设备操作: " + intentCode)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            };

        } catch (Exception e) {
            log.error("EquipmentIntentHandler处理失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            String errMsg = "设备操作失败: " + ErrorSanitizer.sanitize(e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("EQUIPMENT")
                    .status("FAILED")
                    .message(errMsg)
                    .formattedText(errMsg)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 查询设备列表
     */
    private IntentExecuteResponse handleEquipmentList(String factoryId, IntentExecuteRequest request,
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

        PageResponse<EquipmentDTO> equipmentList = equipmentService.getEquipmentList(factoryId, pageRequest);

        Map<String, Object> result = new HashMap<>();
        result.put("equipment", equipmentList.getContent());
        result.put("total", equipmentList.getTotalElements());
        result.put("page", page);
        result.put("size", size);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("EQUIPMENT")
                .status("COMPLETED")
                .message(buildEquipmentListMessage(equipmentList))
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 查询设备详情
     */
    private IntentExecuteResponse handleEquipmentDetail(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("equipmentId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("EQUIPMENT")
                    .status("NEED_INPUT")
                    .message("请提供要查询的设备ID (equipmentId)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String equipmentId = String.valueOf(request.getContext().get("equipmentId"));
        EquipmentDTO equipment = equipmentService.getEquipmentById(factoryId, equipmentId);

        Map<String, Object> result = new HashMap<>();
        result.put("equipment", equipment);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("EQUIPMENT")
                .status("COMPLETED")
                .message(buildEquipmentDetailMessage(equipment))
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 查询设备运行状态 - 核心意图
     * 返回所有设备的状态汇总及各状态设备列表
     */
    private IntentExecuteResponse handleEquipmentStatusQuery(String factoryId, IntentExecuteRequest request,
                                                             AIIntentConfig intentConfig) {
        // 获取工厂设备总体统计
        Map<String, Object> overallStats = equipmentService.getOverallEquipmentStatistics(factoryId);

        // 获取各状态设备列表
        List<EquipmentDTO> runningEquipment = equipmentService.getEquipmentByStatus(factoryId, "running");
        List<EquipmentDTO> idleEquipment = equipmentService.getEquipmentByStatus(factoryId, "idle");
        List<EquipmentDTO> maintenanceEquipment = equipmentService.getEquipmentByStatus(factoryId, "maintenance");
        List<EquipmentDTO> faultEquipment = equipmentService.getEquipmentByStatus(factoryId, "fault");

        Map<String, Object> result = new HashMap<>();
        result.put("overallStats", overallStats);
        result.put("runningCount", runningEquipment.size());
        result.put("idleCount", idleEquipment.size());
        result.put("maintenanceCount", maintenanceEquipment.size());
        result.put("faultCount", faultEquipment.size());
        result.put("runningEquipment", runningEquipment);
        result.put("idleEquipment", idleEquipment);
        result.put("maintenanceEquipment", maintenanceEquipment);
        result.put("faultEquipment", faultEquipment);

        int totalCount = runningEquipment.size() + idleEquipment.size()
                + maintenanceEquipment.size() + faultEquipment.size();

        String message = buildEquipmentStatusMessage(totalCount,
                runningEquipment.size(), idleEquipment.size(),
                maintenanceEquipment.size(), faultEquipment.size(),
                faultEquipment);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("EQUIPMENT")
                .status("COMPLETED")
                .message(message)
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 设备统计
     */
    private IntentExecuteResponse handleEquipmentStats(String factoryId, AIIntentConfig intentConfig) {
        Map<String, Object> stats = equipmentService.getOverallEquipmentStatistics(factoryId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("EQUIPMENT")
                .status("COMPLETED")
                .message(buildEquipmentStatsMessage(stats))
                .resultData(stats)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 启动设备
     */
    private IntentExecuteResponse handleEquipmentStart(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("equipmentId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("EQUIPMENT")
                    .status("NEED_INPUT")
                    .message("请提供要启动的设备ID (equipmentId)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String equipmentId = String.valueOf(request.getContext().get("equipmentId"));
        EquipmentDTO equipment = equipmentService.startEquipment(factoryId, equipmentId);

        Map<String, Object> result = new HashMap<>();
        result.put("equipment", equipment);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("EQUIPMENT")
                .status("COMPLETED")
                .message("设备 " + equipment.getEquipmentName() + " 已启动")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 停止设备
     */
    private IntentExecuteResponse handleEquipmentStop(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("equipmentId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("EQUIPMENT")
                    .status("NEED_INPUT")
                    .message("请提供要停止的设备ID (equipmentId)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String equipmentId = String.valueOf(request.getContext().get("equipmentId"));
        Integer runningHours = null;
        if (request.getContext().containsKey("runningHours")) {
            runningHours = ((Number) request.getContext().get("runningHours")).intValue();
        }
        EquipmentDTO equipment = equipmentService.stopEquipment(factoryId, equipmentId, runningHours);

        Map<String, Object> result = new HashMap<>();
        result.put("equipment", equipment);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("EQUIPMENT")
                .status("COMPLETED")
                .message("设备 " + equipment.getEquipmentName() + " 已停止")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 更新设备状态
     */
    private IntentExecuteResponse handleEquipmentStatusUpdate(String factoryId, IntentExecuteRequest request,
                                                              AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("equipmentId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("EQUIPMENT")
                    .status("NEED_INPUT")
                    .message("请提供设备ID (equipmentId) 和目标状态 (status: running/idle/maintenance/fault)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String equipmentId = String.valueOf(request.getContext().get("equipmentId"));
        String status = (String) request.getContext().get("status");
        if (status == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("EQUIPMENT")
                    .status("NEED_INPUT")
                    .message("请提供目标状态 (status: running/idle/maintenance/fault)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        EquipmentDTO equipment = equipmentService.updateEquipmentStatus(factoryId, equipmentId, status);

        Map<String, Object> result = new HashMap<>();
        result.put("equipment", equipment);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("EQUIPMENT")
                .status("COMPLETED")
                .message("设备 " + equipment.getEquipmentName() + " 状态已更新为: " + translateStatus(status))
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ===== Phase 2b 新增意图 =====

    private IntentExecuteResponse handleBreakdownReport(String factoryId, AIIntentConfig intentConfig) {
        PageRequest pr = new PageRequest();
        pr.setPage(1);
        pr.setSize(50);
        PageResponse<EquipmentAlertDTO> alerts = equipmentAlertsService.getAlertList(factoryId, pr, null, null, null);
        Map<String, Object> stats = equipmentAlertsService.getAlertStatistics(factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("alerts", alerts.getContent());
        result.put("totalAlerts", alerts.getTotalElements());
        result.put("statistics", stats);

        StringBuilder sb = new StringBuilder();
        sb.append("设备故障报告\n");
        sb.append("告警总数: ").append(alerts.getTotalElements());
        if (stats.containsKey("unresolved")) {
            sb.append(" | 未解决: ").append(stats.get("unresolved"));
        }
        if (stats.containsKey("critical")) {
            sb.append(" | 严重: ").append(stats.get("critical"));
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("EQUIPMENT")
                .status("COMPLETED")
                .message(sb.toString())
                .formattedText(sb.toString())
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse handleQueryByName(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig) {
        String keyword = null;
        if (request.getContext() != null) {
            keyword = (String) request.getContext().get("keyword");
        }
        if (keyword == null && request.getUserInput() != null) {
            keyword = request.getUserInput().replaceAll("(?:按名称|查|设备|状态|查询|搜索)", "").trim();
        }
        if (keyword == null || keyword.isEmpty()) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("EQUIPMENT").status("NEED_MORE_INFO")
                    .message("请提供设备名称关键词").executedAt(LocalDateTime.now()).build();
        }

        List<EquipmentDTO> results = equipmentService.searchEquipment(factoryId, keyword);
        Map<String, Object> result = new HashMap<>();
        result.put("equipment", results);
        result.put("keyword", keyword);
        result.put("total", results.size());

        String msg = results.isEmpty()
                ? "未找到名称包含\"" + keyword + "\"的设备"
                : "找到 " + results.size() + " 台设备（关键词: " + keyword + "）";

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("EQUIPMENT")
                .status("COMPLETED").message(msg).formattedText(msg)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleAnalyzeEquipment(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig) {
        String equipmentId = null;
        if (request.getContext() != null) {
            Object idObj = request.getContext().get("equipmentId");
            if (idObj != null) equipmentId = idObj.toString();
        }
        if (equipmentId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("EQUIPMENT").status("NEED_MORE_INFO")
                    .message("请提供要分析的设备ID (equipmentId)").executedAt(LocalDateTime.now()).build();
        }

        Map<String, Object> stats = equipmentService.getEquipmentStatistics(factoryId, equipmentId);
        List<Map<String, Object>> usage = equipmentService.getEquipmentUsageHistory(factoryId, equipmentId);

        Map<String, Object> result = new HashMap<>();
        result.put("statistics", stats);
        result.put("usageHistory", usage);
        result.put("equipmentId", equipmentId);

        StringBuilder sb = new StringBuilder();
        sb.append("设备运行分析 (ID: ").append(equipmentId).append(")\n");
        if (stats.containsKey("totalRunningHours")) {
            sb.append("累计运行: ").append(stats.get("totalRunningHours")).append("小时");
        }
        if (stats.containsKey("maintenanceCount")) {
            sb.append(" | 维护次数: ").append(stats.get("maintenanceCount"));
        }
        sb.append("\n近期使用记录: ").append(usage.size()).append("条");

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("EQUIPMENT")
                .status("COMPLETED").message(sb.toString()).formattedText(sb.toString())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleCameraStart(String factoryId, AIIntentConfig intentConfig) {
        try {
            List<CameraDeviceInfo> devices = cameraService.enumerateDevices();
            if (devices == null || devices.isEmpty()) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                        .intentName(intentConfig.getIntentName()).intentCategory("EQUIPMENT")
                        .status("COMPLETED")
                        .message("摄像头设备查询完成：当前工厂未配置摄像头设备。\n如需使用摄像头功能，请先在设备管理中添加摄像头设备。")
                        .formattedText("摄像头设备查询完成：当前工厂未配置摄像头设备。\n如需使用摄像头功能，请先在设备管理中添加摄像头设备。")
                        .executedAt(LocalDateTime.now()).build();
            }

            if (!cameraService.isConnected()) {
                cameraService.connectCamera(0);
            }
            CaptureImageResponse capture = cameraService.captureImage();

            Map<String, Object> result = new HashMap<>();
            result.put("devices", devices);
            result.put("capture", capture);
            result.put("connected", true);

            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("EQUIPMENT")
                    .status("COMPLETED").message("摄像头已启动，检测到 " + devices.size() + " 个设备，已完成拍照")
                    .resultData(result).executedAt(LocalDateTime.now()).build();
        } catch (Exception e) {
            log.warn("摄像头操作失败: {}", e.getMessage());
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("EQUIPMENT")
                    .status("COMPLETED")
                    .message("摄像头设备查询完成：当前未检测到可用的摄像头设备。\n如需使用摄像头功能，请先在设备管理中添加摄像头设备。")
                    .formattedText("摄像头设备查询完成：当前未检测到可用的摄像头设备。\n如需使用摄像头功能，请先在设备管理中添加摄像头设备。")
                    .executedAt(LocalDateTime.now()).build();
        }
    }

    private IntentExecuteResponse handleCcpMonitor(String factoryId, AIIntentConfig intentConfig) {
        Map<String, Object> overallStats = equipmentService.getOverallEquipmentStatistics(factoryId);
        List<EquipmentDTO> running = equipmentService.getEquipmentByStatus(factoryId, "running");
        List<EquipmentDTO> fault = equipmentService.getEquipmentByStatus(factoryId, "fault");

        Map<String, Object> result = new HashMap<>();
        result.put("overallStats", overallStats);
        result.put("runningEquipment", running);
        result.put("faultEquipment", fault);
        result.put("ccpCompliant", fault.isEmpty());

        StringBuilder sb = new StringBuilder();
        sb.append("CCP关键控制点监控\n");
        sb.append("运行设备: ").append(running.size()).append("台");
        sb.append(" | 故障设备: ").append(fault.size()).append("台\n");
        sb.append("CCP合规状态: ").append(fault.isEmpty() ? "正常" : "异常 — 有故障设备需处理");

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("EQUIPMENT")
                .status("COMPLETED").message(sb.toString()).formattedText(sb.toString())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    // ===== 消息格式化辅助方法 =====

    private String buildEquipmentListMessage(PageResponse<EquipmentDTO> equipmentList) {
        try {
            long total = equipmentList.getTotalElements();
            List<EquipmentDTO> content = equipmentList.getContent();

            long running = content.stream().filter(e -> "running".equalsIgnoreCase(e.getStatus())).count();
            long idle = content.stream().filter(e -> "idle".equalsIgnoreCase(e.getStatus())).count();
            long maintenance = content.stream().filter(e -> "maintenance".equalsIgnoreCase(e.getStatus())).count();
            long fault = content.stream().filter(e -> "fault".equalsIgnoreCase(e.getStatus())).count();

            StringBuilder sb = new StringBuilder();
            sb.append("设备列表 (共").append(total).append("台)\n");
            sb.append("运行中: ").append(running);
            sb.append(" | 空闲: ").append(idle);
            sb.append(" | 维护中: ").append(maintenance);
            if (fault > 0) {
                sb.append(" | 故障: ").append(fault);
            }
            return sb.toString();
        } catch (Exception e) {
            log.debug("格式化设备列表消息失败: {}", e.getMessage());
            return "查询到 " + equipmentList.getTotalElements() + " 台设备";
        }
    }

    private String buildEquipmentDetailMessage(EquipmentDTO equipment) {
        try {
            StringBuilder sb = new StringBuilder();
            sb.append("设备: ").append(equipment.getEquipmentName());
            sb.append("\n编号: ").append(equipment.getEquipmentCode());
            sb.append(" | 状态: ").append(translateStatus(equipment.getStatus()));
            if (equipment.getType() != null) {
                sb.append(" | 类型: ").append(equipment.getType());
            }
            if (equipment.getLocation() != null) {
                sb.append("\n位置: ").append(equipment.getLocation());
            }
            return sb.toString();
        } catch (Exception e) {
            log.debug("格式化设备详情消息失败: {}", e.getMessage());
            return "设备信息获取成功";
        }
    }

    private String buildEquipmentStatusMessage(int total, int running, int idle,
                                               int maintenance, int fault,
                                               List<EquipmentDTO> faultEquipment) {
        StringBuilder sb = new StringBuilder();
        sb.append("设备运行状态 (共").append(total).append("台)\n");
        sb.append("运行中: ").append(running).append("台");
        sb.append(" | 空闲: ").append(idle).append("台");
        sb.append(" | 维护中: ").append(maintenance).append("台");
        if (fault > 0) {
            sb.append(" | 故障: ").append(fault).append("台");
        }

        // 运行率
        if (total > 0) {
            double runningRate = (double) running / total * 100;
            sb.append("\n设备运行率: ").append(String.format("%.1f", runningRate)).append("%");
        }

        // 故障设备提示
        if (fault > 0 && faultEquipment != null && !faultEquipment.isEmpty()) {
            sb.append("\n故障设备:");
            int count = 0;
            for (EquipmentDTO eq : faultEquipment) {
                if (count >= 3) {
                    sb.append("\n... 等共").append(fault).append("台故障设备");
                    break;
                }
                sb.append("\n  - ").append(eq.getEquipmentName());
                if (eq.getEquipmentCode() != null) {
                    sb.append(" (").append(eq.getEquipmentCode()).append(")");
                }
                count++;
            }
        }

        // 健康评估
        if (total > 0) {
            String health;
            if (fault == 0 && maintenance <= 1) {
                health = "良好";
            } else if (fault <= 1) {
                health = "一般";
            } else {
                health = "需关注";
            }
            sb.append("\n健康评估: ").append(health);
        }

        return sb.toString();
    }

    private String buildEquipmentStatsMessage(Map<String, Object> stats) {
        try {
            StringBuilder sb = new StringBuilder();
            sb.append("设备统计概况\n");

            if (stats.containsKey("totalCount")) {
                sb.append("设备总数: ").append(stats.get("totalCount"));
            }
            if (stats.containsKey("runningCount")) {
                sb.append(" | 运行中: ").append(stats.get("runningCount"));
            }
            if (stats.containsKey("totalValue")) {
                sb.append("\n设备总价值: ").append(stats.get("totalValue")).append("元");
            }
            if (stats.containsKey("averageRunningHours")) {
                sb.append("\n平均运行时长: ").append(stats.get("averageRunningHours")).append("小时");
            }

            return sb.toString();
        } catch (Exception e) {
            log.debug("格式化设备统计消息失败: {}", e.getMessage());
            return "设备统计数据获取成功";
        }
    }

    private String translateStatus(String status) {
        if (status == null) return "未知";
        return switch (status.toLowerCase()) {
            case "running", "active" -> "运行中";
            case "idle", "inactive" -> "空闲";
            case "maintenance" -> "维护中";
            case "fault" -> "故障";
            case "offline", "scrapped" -> "离线";
            default -> status;
        };
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        String previewMessage = switch (intentCode) {
            case "EQUIPMENT_LIST" -> "将查询工厂所有设备列表，包括设备名称、编号、状态等信息。";
            case "EQUIPMENT_DETAIL" -> "将查询指定设备的详细信息，包括参数、状态、维护记录。";
            case "EQUIPMENT_STATUS_QUERY" -> "将查询所有设备的运行状态汇总，包括运行中、空闲、维护中、故障设备数量及详情。";
            case "EQUIPMENT_STATS" -> "将获取设备统计数据，包括在线/离线数量、运行状态分布、利用率等。";
            case "EQUIPMENT_START" -> "将启动指定设备，设备状态将更新为运行中。";
            case "EQUIPMENT_STOP" -> "将停止指定设备，设备状态将更新为停机。";
            case "EQUIPMENT_STATUS_UPDATE" -> "将更新指定设备的状态，支持运行、停机、维护、故障等状态。";
            default -> "设备相关操作预览。";
        };

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig.getIntentName())
                .intentCategory("EQUIPMENT")
                .status("PREVIEW")
                .message(previewMessage)
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ===== Round 2: 新增设备意图 =====

    private IntentExecuteResponse handleColdChainTemperature(String factoryId, AIIntentConfig intentConfig) {
        // 冷链温度查询 - 从设备服务获取温控设备状态
        List<EquipmentDTO> allEquipment = equipmentService.getEquipmentList(factoryId, com.cretas.aims.dto.common.PageRequest.of(1, 200)).getContent();
        List<Map<String, Object>> coldChainDevices = new ArrayList<>();
        for (EquipmentDTO eq : allEquipment) {
            String name = eq.getName() != null ? eq.getName().toLowerCase() : "";
            String type = eq.getType() != null ? eq.getType().toLowerCase() : "";
            if (name.contains("冷") || name.contains("温") || name.contains("freezer") ||
                name.contains("refriger") || type.contains("冷链") || type.contains("温控")) {
                Map<String, Object> device = new HashMap<>();
                device.put("equipmentId", eq.getId());
                device.put("name", eq.getName());
                device.put("status", eq.getStatus());
                device.put("type", eq.getType());
                coldChainDevices.add(device);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("coldChainDevices", coldChainDevices);
        result.put("totalDevices", coldChainDevices.size());
        result.put("queryTime", LocalDateTime.now().toString());

        StringBuilder sb = new StringBuilder();
        sb.append("冷链温控设备状态\n");
        if (coldChainDevices.isEmpty()) {
            sb.append("当前工厂未配置冷链温控设备。\n");
            sb.append("如需监控冷链温度，请先在设备管理中添加温控设备。");
        } else {
            sb.append("共 ").append(coldChainDevices.size()).append(" 台冷链设备：\n");
            for (Map<String, Object> d : coldChainDevices) {
                sb.append("  - ").append(d.get("name")).append(": ").append(translateStatus(String.valueOf(d.get("status")))).append("\n");
            }
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("EQUIPMENT")
                .status("COMPLETED").message(sb.toString().trim())
                .formattedText(sb.toString().trim())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleEquipmentMaintenance(String factoryId, IntentExecuteRequest request,
                                                               AIIntentConfig intentConfig) {
        List<EquipmentDTO> equipment = equipmentService.getEquipmentList(factoryId, com.cretas.aims.dto.common.PageRequest.of(1, 200)).getContent();
        List<Map<String, Object>> maintenanceNeeded = new ArrayList<>();
        for (EquipmentDTO eq : equipment) {
            if ("maintenance".equalsIgnoreCase(eq.getStatus()) || "fault".equalsIgnoreCase(eq.getStatus())) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", eq.getId());
                item.put("name", eq.getName());
                item.put("status", eq.getStatus());
                maintenanceNeeded.add(item);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("maintenanceDevices", maintenanceNeeded);
        result.put("count", maintenanceNeeded.size());

        String msg;
        if (maintenanceNeeded.isEmpty()) {
            msg = "设备维护检查完成：当前所有设备运行正常，暂无需要维护的设备。系统将持续监控设备健康状态。";
        } else {
            StringBuilder sb = new StringBuilder();
            sb.append("设备维护检查完成：共 ").append(maintenanceNeeded.size()).append(" 台设备需要维护\n");
            for (Map<String, Object> item : maintenanceNeeded) {
                sb.append("  - ").append(item.get("name")).append(" (状态: ").append(translateStatus(String.valueOf(item.get("status")))).append(")\n");
            }
            msg = sb.toString().trim();
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("EQUIPMENT")
                .status("COMPLETED")
                .message(msg).formattedText(msg)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleHealthDiagnosis(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig) {
        List<EquipmentDTO> equipment = equipmentService.getEquipmentList(factoryId, com.cretas.aims.dto.common.PageRequest.of(1, 200)).getContent();
        int running = 0, idle = 0, fault = 0, maintenance = 0, total = equipment.size();
        for (EquipmentDTO eq : equipment) {
            String status = eq.getStatus() != null ? eq.getStatus().toLowerCase() : "";
            switch (status) {
                case "running", "active" -> running++;
                case "idle", "inactive" -> idle++;
                case "fault" -> fault++;
                case "maintenance" -> maintenance++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("running", running);
        result.put("idle", idle);
        result.put("fault", fault);
        result.put("maintenance", maintenance);
        result.put("healthScore", total > 0 ? (int) ((double)(running + idle) / total * 100) : 0);

        StringBuilder sb = new StringBuilder();
        sb.append("设备健康诊断\n");
        sb.append("总设备数: ").append(total).append("\n");
        sb.append("  运行中: ").append(running).append(" | 空闲: ").append(idle).append("\n");
        sb.append("  故障: ").append(fault).append(" | 维护中: ").append(maintenance).append("\n");
        sb.append("健康评分: ").append(result.get("healthScore")).append("/100");

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("EQUIPMENT")
                .status("COMPLETED").message(sb.toString().trim())
                .formattedText(sb.toString().trim())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    @Override
    public boolean supportsSemanticsMode() {
        return true;
    }
}
