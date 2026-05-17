package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.QualityDefect;
import com.cretas.aims.entity.enums.DefectStatus;
import com.cretas.aims.entity.enums.DefectType;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.QualityDefectService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Sprint4-H Q-PROCESS-1: 工序质检不良控制器.
 *
 * <p>闭环 REST 接口: 登记 (POST) → 分派 (PUT /assign) → 闭环 (PUT /close).
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/quality-defects")
@RequiredArgsConstructor
@Tag(name = "工序质检不良", description = "Sprint4-H Q-PROCESS-1 不良记录全闭环")
@RequireModule("quality_inspection")
public class QualityDefectController {

    private final QualityDefectService qualityDefectService;
    private final MobileService mobileService;

    @PostMapping
    @Operation(summary = "登记质检不良", description = "OPEN 状态新建. recordDefect 闭环第 1 步.")
    @RequirePermission({"quality:read_write"})
    public ApiResponse<QualityDefect> recordDefect(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @RequestBody RecordDefectRequest request) {
        Long userId = extractUserId(authorization);
        QualityDefect defect = qualityDefectService.recordDefect(
                factoryId,
                request.getQualityInspectionId(),
                request.getMaterialId(),
                request.getDefectType(),
                request.getQuantity(),
                request.getCause(),
                userId);
        return ApiResponse.success("不良记录已登记", defect);
    }

    @GetMapping
    @Operation(summary = "不良列表 (按条件过滤 + 分页)")
    @RequirePermission({"quality:read_write", "quality:read"})
    public ApiResponse<PageResponse<QualityDefect>> listDefects(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(required = false) DefectStatus status,
            @RequestParam(required = false) DefectType defectType,
            @RequestParam(required = false) String qualityInspectionId,
            @RequestParam(required = false) String materialId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<QualityDefect> result = qualityDefectService.listDefects(
                factoryId, status, defectType, qualityInspectionId, materialId,
                fromDate, toDate, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/by-inspection/{inspectionId}")
    @Operation(summary = "按质检记录查所有不良 (detail 页用)")
    @RequirePermission({"quality:read_write", "quality:read"})
    public ApiResponse<List<QualityDefect>> listByInspection(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String inspectionId) {
        List<QualityDefect> list = qualityDefectService.listByInspection(factoryId, inspectionId);
        return ApiResponse.success("查询成功", list);
    }

    @GetMapping("/summary")
    @Operation(summary = "不良统计概览 (按 status + defectType 计数)")
    @RequirePermission({"quality:read_write", "quality:read"})
    public ApiResponse<Map<String, Object>> getSummary(
            @PathVariable @NotBlank String factoryId) {
        return ApiResponse.success("查询成功", qualityDefectService.getDefectSummary(factoryId));
    }

    @GetMapping("/{defectId}")
    @Operation(summary = "不良详情")
    @RequirePermission({"quality:read_write", "quality:read"})
    public ApiResponse<QualityDefect> getDefect(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String defectId) {
        return ApiResponse.success("查询成功", qualityDefectService.getDefect(factoryId, defectId));
    }

    @PutMapping("/{defectId}/assign")
    @Operation(summary = "分派处理", description = "OPEN → IN_PROGRESS, 设定 handlingAction + assignedTo")
    @RequirePermission({"quality:read_write"})
    public ApiResponse<QualityDefect> assignDefect(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String defectId,
            @RequestBody AssignDefectRequest request) {
        QualityDefect defect = qualityDefectService.assignDefect(
                factoryId, defectId, request.getHandlingAction(), request.getAssignedTo());
        return ApiResponse.success("已分派处理", defect);
    }

    @PutMapping("/{defectId}/close")
    @Operation(summary = "闭环", description = "IN_PROGRESS/OPEN → CLOSED, 验证完成")
    @RequirePermission({"quality:read_write"})
    public ApiResponse<QualityDefect> closeDefect(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String defectId,
            @RequestHeader("Authorization") String authorization,
            @RequestBody(required = false) CloseDefectRequest request) {
        Long userId = extractUserId(authorization);
        String notes = request != null ? request.getCloseNotes() : null;
        QualityDefect defect = qualityDefectService.closeDefect(factoryId, defectId, notes, userId);
        return ApiResponse.success("不良已闭环", defect);
    }

    // ==================== Request DTOs ====================

    @lombok.Data
    public static class RecordDefectRequest {
        private String qualityInspectionId;
        private String materialId;
        private DefectType defectType;
        private BigDecimal quantity;
        private String cause;
    }

    @lombok.Data
    public static class AssignDefectRequest {
        private String handlingAction;
        private Long assignedTo;
    }

    @lombok.Data
    public static class CloseDefectRequest {
        private String closeNotes;
    }

    private Long extractUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }
}
