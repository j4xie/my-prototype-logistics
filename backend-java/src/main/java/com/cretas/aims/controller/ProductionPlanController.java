package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.production.CreateProductionPlanRequest;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.ProductionPlanService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 生产计划管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/production-plans")
@RequiredArgsConstructor
@Tag(name = "生产计划管理", description = "生产计划管理相关接口")
public class ProductionPlanController {

    private final ProductionPlanService productionPlanService;
    private final MobileService mobileService;

    /**
     * 创建生产计划
     */
    @PostMapping
    @Operation(summary = "创建生产计划")
    public ApiResponse<ProductionPlanDTO> createProductionPlan(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateProductionPlanRequest request) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Integer userId = mobileService.getUserFromToken(token).getId();

        log.info("创建生产计划: factoryId={}, productTypeId={}", factoryId, request.getProductTypeId());
        ProductionPlanDTO plan = productionPlanService.createProductionPlan(factoryId, request, userId);
        return ApiResponse.success("生产计划创建成功", plan);
    }

    /**
     * 更新生产计划
     */
    @PutMapping("/{planId}")
    @Operation(summary = "更新生产计划")
    public ApiResponse<ProductionPlanDTO> updateProductionPlan(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId,
            @Valid @RequestBody CreateProductionPlanRequest request) {

        log.info("更新生产计划: factoryId={}, planId={}", factoryId, planId);
        ProductionPlanDTO plan = productionPlanService.updateProductionPlan(factoryId, planId, request);
        return ApiResponse.success("生产计划更新成功", plan);
    }

    /**
     * 删除生产计划
     */
    @DeleteMapping("/{planId}")
    @Operation(summary = "删除生产计划")
    public ApiResponse<Void> deleteProductionPlan(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId) {

        log.info("删除生产计划: factoryId={}, planId={}", factoryId, planId);
        productionPlanService.deleteProductionPlan(factoryId, planId);
        return ApiResponse.success("生产计划删除成功", null);
    }

    /**
     * 获取生产计划详情
     */
    @GetMapping("/{planId}")
    @Operation(summary = "获取生产计划详情")
    public ApiResponse<ProductionPlanDTO> getProductionPlanById(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId) {

        ProductionPlanDTO plan = productionPlanService.getProductionPlanById(factoryId, planId);
        return ApiResponse.success(plan);
    }

    /**
     * 获取生产计划列表
     */
    @GetMapping
    @Operation(summary = "获取生产计划列表（分页）")
    public ApiResponse<PageResponse<ProductionPlanDTO>> getProductionPlanList(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Valid PageRequest pageRequest) {

        PageResponse<ProductionPlanDTO> response = productionPlanService.getProductionPlanList(factoryId, pageRequest);
        return ApiResponse.success(response);
    }

    /**
     * 按状态获取生产计划
     */
    @GetMapping("/status/{status}")
    @Operation(summary = "按状态获取生产计划")
    public ApiResponse<List<ProductionPlanDTO>> getProductionPlansByStatus(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "状态", required = true)
            @PathVariable ProductionPlanStatus status) {

        List<ProductionPlanDTO> plans = productionPlanService.getProductionPlansByStatus(factoryId, status);
        return ApiResponse.success(plans);
    }

    /**
     * 按日期范围获取生产计划
     */
    @GetMapping("/date-range")
    @Operation(summary = "按日期范围获取生产计划")
    public ApiResponse<List<ProductionPlanDTO>> getProductionPlansByDateRange(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "开始日期", required = true, example = "2025-01-01")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期", required = true, example = "2025-01-31")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        List<ProductionPlanDTO> plans = productionPlanService.getProductionPlansByDateRange(factoryId, startDate, endDate);
        return ApiResponse.success(plans);
    }

    /**
     * 获取今日生产计划
     */
    @GetMapping("/today")
    @Operation(summary = "获取今日生产计划")
    public ApiResponse<List<ProductionPlanDTO>> getTodayProductionPlans(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<ProductionPlanDTO> plans = productionPlanService.getTodayProductionPlans(factoryId);
        return ApiResponse.success(plans);
    }

    /**
     * 开始生产
     */
    @PostMapping("/{planId}/start")
    @Operation(summary = "开始生产")
    public ApiResponse<ProductionPlanDTO> startProduction(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId) {

        log.info("开始生产: factoryId={}, planId={}", factoryId, planId);
        ProductionPlanDTO plan = productionPlanService.startProduction(factoryId, planId);
        return ApiResponse.success("生产已开始", plan);
    }

    /**
     * 完成生产
     */
    @PostMapping("/{planId}/complete")
    @Operation(summary = "完成生产")
    public ApiResponse<ProductionPlanDTO> completeProduction(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId,
            @Parameter(description = "实际产量", required = true)
            @RequestParam @NotNull BigDecimal actualQuantity) {

        log.info("完成生产: factoryId={}, planId={}, actualQuantity={}", factoryId, planId, actualQuantity);
        ProductionPlanDTO plan = productionPlanService.completeProduction(factoryId, planId, actualQuantity);
        return ApiResponse.success("生产已完成", plan);
    }

    /**
     * 取消生产计划
     */
    @PostMapping("/{planId}/cancel")
    @Operation(summary = "取消生产计划")
    public ApiResponse<Void> cancelProductionPlan(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId,
            @Parameter(description = "取消原因", required = true)
            @RequestParam @NotBlank String reason) {

        log.info("取消生产计划: factoryId={}, planId={}, reason={}", factoryId, planId, reason);
        productionPlanService.cancelProductionPlan(factoryId, planId, reason);
        return ApiResponse.success("生产计划已取消", null);
    }

    /**
     * 暂停生产
     */
    @PostMapping("/{planId}/pause")
    @Operation(summary = "暂停生产")
    public ApiResponse<ProductionPlanDTO> pauseProduction(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId) {

        log.info("暂停生产: factoryId={}, planId={}", factoryId, planId);
        ProductionPlanDTO plan = productionPlanService.pauseProduction(factoryId, planId);
        return ApiResponse.success("生产已暂停", plan);
    }

    /**
     * 恢复生产
     */
    @PostMapping("/{planId}/resume")
    @Operation(summary = "恢复生产")
    public ApiResponse<ProductionPlanDTO> resumeProduction(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId) {

        log.info("恢复生产: factoryId={}, planId={}", factoryId, planId);
        ProductionPlanDTO plan = productionPlanService.resumeProduction(factoryId, planId);
        return ApiResponse.success("生产已恢复", plan);
    }

    /**
     * 更新实际成本
     */
    @PutMapping("/{planId}/costs")
    @Operation(summary = "更新实际成本")
    public ApiResponse<ProductionPlanDTO> updateActualCosts(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId,
            @Parameter(description = "材料成本")
            @RequestParam(required = false) BigDecimal materialCost,
            @Parameter(description = "人工成本")
            @RequestParam(required = false) BigDecimal laborCost,
            @Parameter(description = "设备成本")
            @RequestParam(required = false) BigDecimal equipmentCost,
            @Parameter(description = "其他成本")
            @RequestParam(required = false) BigDecimal otherCost) {

        log.info("更新实际成本: factoryId={}, planId={}", factoryId, planId);
        ProductionPlanDTO plan = productionPlanService.updateActualCosts(
            factoryId, planId, materialCost, laborCost, equipmentCost, otherCost);
        return ApiResponse.success("成本更新成功", plan);
    }

    /**
     * 分配原材料批次
     */
    @PostMapping("/{planId}/batches")
    @Operation(summary = "分配原材料批次")
    public ApiResponse<Void> assignMaterialBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId,
            @Parameter(description = "批次ID列表", required = true)
            @RequestBody @NotNull List<String> batchIds) {

        log.info("分配原材料批次: factoryId={}, planId={}, batchCount={}", factoryId, planId, batchIds.size());
        productionPlanService.assignMaterialBatches(factoryId, planId, batchIds);
        return ApiResponse.success("批次分配成功", null);
    }

    /**
     * 记录材料消耗
     */
    @PostMapping("/{planId}/consumption")
    @Operation(summary = "记录材料消耗")
    public ApiResponse<Void> recordMaterialConsumption(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true)
            @PathVariable @NotNull String planId,
            @Parameter(description = "批次ID", required = true)
            @RequestParam @NotBlank String batchId,
            @Parameter(description = "消耗数量", required = true)
            @RequestParam @NotNull BigDecimal quantity) {

        log.info("记录材料消耗: factoryId={}, planId={}, batchId={}, quantity={}",
                factoryId, planId, batchId, quantity);
        productionPlanService.recordMaterialConsumption(factoryId, planId, batchId, quantity);
        return ApiResponse.success("消耗记录成功", null);
    }

    /**
     * 获取生产统计
     */
    @GetMapping("/statistics")
    @Operation(summary = "获取生产统计")
    public ApiResponse<Map<String, Object>> getProductionStatistics(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "开始日期", required = true)
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期", required = true)
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        Map<String, Object> statistics = productionPlanService.getProductionStatistics(factoryId, startDate, endDate);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取待执行的计划
     */
    @GetMapping("/pending-execution")
    @Operation(summary = "获取待执行的计划")
    public ApiResponse<List<ProductionPlanDTO>> getPendingPlansToExecute(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<ProductionPlanDTO> plans = productionPlanService.getPendingPlansToExecute(factoryId);
        return ApiResponse.success(plans);
    }

    /**
     * 批量创建生产计划
     */
    @PostMapping("/batch")
    @Operation(summary = "批量创建生产计划")
    public ApiResponse<List<ProductionPlanDTO>> batchCreateProductionPlans(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody List<CreateProductionPlanRequest> requests) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Integer userId = mobileService.getUserFromToken(token).getId();

        log.info("批量创建生产计划: factoryId={}, count={}", factoryId, requests.size());
        List<ProductionPlanDTO> plans = productionPlanService.batchCreateProductionPlans(factoryId, requests, userId);
        return ApiResponse.success("批量创建成功", plans);
    }

    /**
     * 导出生产计划
     */
    @GetMapping("/export")
    @Operation(summary = "导出生产计划")
    public byte[] exportProductionPlans(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "开始日期", required = true)
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期", required = true)
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        log.info("导出生产计划: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        return productionPlanService.exportProductionPlans(factoryId, startDate, endDate);
    }
}