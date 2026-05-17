package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.QualityReturnOrder;
import com.cretas.aims.entity.enums.QualityReturnStatus;
import com.cretas.aims.entity.enums.QualityReturnTargetType;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.QualityReturnOrderService;
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

/**
 * Sprint4-H Q-RETURN-1: 质检退回单控制器.
 *
 * <p>状态机: createDraft (DRAFT) → confirm (DRAFT→CONFIRMED) → ship (CONFIRMED→SHIPPED).
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/quality-return-orders")
@RequiredArgsConstructor
@Tag(name = "质检退回单", description = "Sprint4-H Q-RETURN-1 退回供应商 / 委外加工厂")
@RequireModule("quality_inspection")
public class QualityReturnOrderController {

    private final QualityReturnOrderService returnService;
    private final MobileService mobileService;

    @PostMapping
    @Operation(summary = "创建退回单草稿", description = "DRAFT 状态. 自动生成 returnNumber.")
    @RequirePermission({"quality:read_write"})
    public ApiResponse<QualityReturnOrder> createDraft(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @RequestBody CreateReturnRequest request) {
        Long userId = extractUserId(authorization);
        QualityReturnOrder order = returnService.createDraft(
                factoryId,
                request.getQualityInspectionId(),
                request.getTargetType(),
                request.getTargetId(),
                request.getTargetName(),
                request.getMaterialId(),
                request.getQuantity(),
                request.getUnit(),
                request.getReason(),
                userId);
        return ApiResponse.success("退回单已创建", order);
    }

    @GetMapping
    @Operation(summary = "退回单列表 (筛选 + 分页)")
    @RequirePermission({"quality:read_write", "quality:read"})
    public ApiResponse<PageResponse<QualityReturnOrder>> list(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(required = false) QualityReturnStatus status,
            @RequestParam(required = false) QualityReturnTargetType targetType,
            @RequestParam(required = false) String qualityInspectionId,
            @RequestParam(required = false) String targetId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<QualityReturnOrder> result = returnService.list(
                factoryId, status, targetType, qualityInspectionId, targetId,
                fromDate, toDate, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "退回单详情")
    @RequirePermission({"quality:read_write", "quality:read"})
    public ApiResponse<QualityReturnOrder> get(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String id) {
        return ApiResponse.success("查询成功", returnService.get(factoryId, id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新草稿 (仅 DRAFT 可改)")
    @RequirePermission({"quality:read_write"})
    public ApiResponse<QualityReturnOrder> update(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String id,
            @RequestBody UpdateReturnRequest request) {
        QualityReturnOrder order = returnService.updateDraft(
                factoryId, id,
                request.getTargetType(),
                request.getTargetId(),
                request.getTargetName(),
                request.getMaterialId(),
                request.getQuantity(),
                request.getUnit(),
                request.getReason());
        return ApiResponse.success("更新成功", order);
    }

    @PutMapping("/{id}/confirm")
    @Operation(summary = "确认 DRAFT → CONFIRMED")
    @RequirePermission({"quality:read_write"})
    public ApiResponse<QualityReturnOrder> confirm(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String id,
            @RequestHeader("Authorization") String authorization) {
        Long userId = extractUserId(authorization);
        return ApiResponse.success("已确认", returnService.confirm(factoryId, id, userId));
    }

    @PutMapping("/{id}/ship")
    @Operation(summary = "发出 CONFIRMED → SHIPPED")
    @RequirePermission({"quality:read_write"})
    public ApiResponse<QualityReturnOrder> ship(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String id,
            @RequestHeader("Authorization") String authorization,
            @RequestBody ShipReturnRequest request) {
        Long userId = extractUserId(authorization);
        return ApiResponse.success("已发出",
                returnService.ship(factoryId, id, request.getShippingTrackingNo(), userId));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "撤销草稿 (仅 DRAFT)")
    @RequirePermission({"quality:read_write"})
    public ApiResponse<Void> cancel(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String id) {
        returnService.cancelDraft(factoryId, id);
        return ApiResponse.success("已撤销", null);
    }

    // ==================== Request DTOs ====================

    @lombok.Data
    public static class CreateReturnRequest {
        private String qualityInspectionId;
        private QualityReturnTargetType targetType;
        private String targetId;
        private String targetName;
        private String materialId;
        private BigDecimal quantity;
        private String unit;
        private String reason;
    }

    @lombok.Data
    public static class UpdateReturnRequest {
        private QualityReturnTargetType targetType;
        private String targetId;
        private String targetName;
        private String materialId;
        private BigDecimal quantity;
        private String unit;
        private String reason;
    }

    @lombok.Data
    public static class ShipReturnRequest {
        private String shippingTrackingNo;
    }

    private Long extractUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }
}
