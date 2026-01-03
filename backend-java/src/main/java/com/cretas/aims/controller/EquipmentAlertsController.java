package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.equipment.CreateEquipmentAlertRequest;
import com.cretas.aims.dto.equipment.EquipmentAlertDTO;
import com.cretas.aims.service.EquipmentAlertsService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.util.Map;

/**
 * 设备告警管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-27
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/equipment-alerts")
@RequiredArgsConstructor
@Tag(name = "设备告警管理", description = "设备告警管理相关接口")
public class EquipmentAlertsController {

    private final EquipmentAlertsService alertsService;
    private final MobileService mobileService;

    /**
     * 创建设备告警
     */
    @PostMapping
    @Operation(summary = "创建设备告警", description = "手动创建设备告警记录，用于记录设备异常情况")
    public ApiResponse<EquipmentAlertDTO> createAlert(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Valid @RequestBody CreateEquipmentAlertRequest request) {

        log.info("创建告警: factoryId={}, equipmentId={}, alertType={}",
                factoryId, request.getEquipmentId(), request.getAlertType());
        EquipmentAlertDTO alert = alertsService.createAlert(factoryId, request);
        return ApiResponse.success("告警创建成功", alert);
    }

    /**
     * 获取告警列表（分页）
     */
    @GetMapping
    @Operation(summary = "获取告警列表（分页）", description = "分页查询设备告警，支持按关键词、严重程度、状态过滤")
    public ApiResponse<PageResponse<EquipmentAlertDTO>> getAlertList(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Valid PageRequest pageRequest,
            @Parameter(description = "搜索关键词", example = "温度")
            @RequestParam(required = false) String keyword,
            @Parameter(description = "严重程度: CRITICAL, HIGH, MEDIUM, LOW", example = "CRITICAL")
            @RequestParam(required = false) String severity,
            @Parameter(description = "状态: ACTIVE, ACKNOWLEDGED, RESOLVED", example = "ACTIVE")
            @RequestParam(required = false) String status) {

        log.info("获取告警列表: factoryId={}, page={}, size={}", factoryId, pageRequest.getPage(), pageRequest.getSize());
        PageResponse<EquipmentAlertDTO> response = alertsService.getAlertList(
                factoryId, pageRequest, keyword, severity, status);
        return ApiResponse.success(response);
    }

    /**
     * 获取告警统计
     */
    @GetMapping("/stats")
    @Operation(summary = "获取告警统计", description = "统计各状态、各严重程度的告警数量")
    public ApiResponse<Map<String, Object>> getAlertStatistics(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId) {

        log.info("获取告警统计: factoryId={}", factoryId);
        Map<String, Object> stats = alertsService.getAlertStatistics(factoryId);
        return ApiResponse.success(stats);
    }

    // 注意: /statistics 端点由 MobileController 提供，避免重复映射

    /**
     * 获取活跃告警列表
     */
    @GetMapping("/active")
    @Operation(summary = "获取活跃告警列表", description = "获取所有未处理的活跃告警")
    public ApiResponse<PageResponse<EquipmentAlertDTO>> getActiveAlerts(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Valid PageRequest pageRequest) {

        log.info("获取活跃告警: factoryId={}", factoryId);
        // 使用状态过滤获取活跃告警
        PageResponse<EquipmentAlertDTO> response = alertsService.getAlertList(
                factoryId, pageRequest, null, null, "ACTIVE");
        return ApiResponse.success(response);
    }

    /**
     * 获取告警详情
     */
    @GetMapping("/{alertId}")
    @Operation(summary = "获取告警详情", description = "根据告警ID获取详细信息")
    public ApiResponse<EquipmentAlertDTO> getAlertById(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "告警ID", required = true, example = "1")
            @PathVariable Integer alertId) {

        log.info("获取告警详情: factoryId={}, alertId={}", factoryId, alertId);
        EquipmentAlertDTO alert = alertsService.getAlertById(factoryId, alertId);
        return ApiResponse.success(alert);
    }

    /**
     * 确认告警
     */
    @PutMapping("/{alertId}/acknowledge")
    @Operation(summary = "确认告警", description = "确认已收到告警通知，状态变更为ACKNOWLEDGED")
    public ApiResponse<EquipmentAlertDTO> acknowledgeAlert(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "告警ID", required = true, example = "1")
            @PathVariable Integer alertId,
            @Parameter(description = "访问令牌", required = true, example = "Bearer eyJhbGci...")
            @RequestHeader("Authorization") String authorization) {

        String token = TokenUtils.extractToken(authorization);
        var user = mobileService.getUserFromToken(token);

        log.info("确认告警: factoryId={}, alertId={}, userId={}", factoryId, alertId, user.getId());
        EquipmentAlertDTO alert = alertsService.acknowledgeAlert(
                factoryId, alertId, user.getId(), user.getRealName());
        return ApiResponse.success("告警已确认", alert);
    }

    /**
     * 处理告警
     */
    @PutMapping("/{alertId}/resolve")
    @Operation(summary = "处理告警", description = "标记告警已处理完成，状态变更为RESOLVED")
    public ApiResponse<EquipmentAlertDTO> resolveAlert(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "告警ID", required = true, example = "1")
            @PathVariable Integer alertId,
            @Parameter(description = "访问令牌", required = true, example = "Bearer eyJhbGci...")
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, String> body) {

        String token = TokenUtils.extractToken(authorization);
        var user = mobileService.getUserFromToken(token);
        String resolution = body.getOrDefault("resolution", "");

        log.info("处理告警: factoryId={}, alertId={}, userId={}", factoryId, alertId, user.getId());
        EquipmentAlertDTO alert = alertsService.resolveAlert(
                factoryId, alertId, user.getId(), user.getRealName(), resolution);
        return ApiResponse.success("告警已处理", alert);
    }
}
