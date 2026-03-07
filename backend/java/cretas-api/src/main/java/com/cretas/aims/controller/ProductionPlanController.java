package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.ImportResult;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.production.CreateProductionPlanRequest;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.ProductionPlanService;
import com.cretas.aims.utils.TokenUtils;
import com.cretas.aims.entity.ProductionBatch;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
    private final ProductionPlanRepository planRepository;

    /**
     * 创建生产计划
     */
    @PostMapping
    @Operation(summary = "创建生产计划")
    public ApiResponse<ProductionPlanDTO> createProductionPlan(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true, example = "Bearer eyJhbGciOiJIUzI1NiJ9...")
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateProductionPlanRequest request) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Long userId = mobileService.getUserFromToken(token).getId();

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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "状态", required = true, example = "IN_PROGRESS")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
            @PathVariable @NotNull String planId,
            @Parameter(description = "实际产量", required = true, example = "500")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
            @PathVariable @NotNull String planId,
            @Parameter(description = "取消原因", required = true, example = "订单取消")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
            @PathVariable @NotNull String planId,
            @Parameter(description = "材料成本", example = "1000.00")
            @RequestParam(required = false) BigDecimal materialCost,
            @Parameter(description = "人工成本", example = "500.00")
            @RequestParam(required = false) BigDecimal laborCost,
            @Parameter(description = "设备成本", example = "200.00")
            @RequestParam(required = false) BigDecimal equipmentCost,
            @Parameter(description = "其他成本", example = "100.00")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "计划ID", required = true, example = "PP-2025-001")
            @PathVariable @NotNull String planId,
            @Parameter(description = "批次ID", required = true, example = "MB-2025-001")
            @RequestParam @NotBlank String batchId,
            @Parameter(description = "消耗数量", required = true, example = "100.5")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "开始日期", required = true, example = "2025-01-01")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期", required = true, example = "2025-01-31")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
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
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true, example = "Bearer eyJhbGciOiJIUzI1NiJ9...")
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody List<CreateProductionPlanRequest> requests) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Long userId = mobileService.getUserFromToken(token).getId();

        log.info("批量创建生产计划: factoryId={}, count={}", factoryId, requests.size());
        List<ProductionPlanDTO> plans = productionPlanService.batchCreateProductionPlans(factoryId, requests, userId);
        return ApiResponse.success("批量创建成功", plans);
    }

    /**
     * 从生产计划创建生产批次（计划→执行转换）
     */
    @PostMapping("/{planId}/create-batch")
    @Operation(summary = "从计划创建批次")
    public ApiResponse<ProductionBatch> createBatchFromPlan(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotNull String planId) {

        log.info("从计划创建批次: factoryId={}, planId={}", factoryId, planId);
        ProductionBatch batch = productionPlanService.createBatchFromPlan(factoryId, planId);
        return ApiResponse.success("批次创建成功", batch);
    }

    /**
     * 导出生产计划
     */
    @GetMapping("/export")
    @Operation(summary = "导出生产计划")
    public void exportProductionPlans(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "开始日期", required = true, example = "2025-01-01")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期", required = true, example = "2025-01-31")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            HttpServletResponse response) throws IOException {

        log.info("导出生产计划: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        byte[] data = productionPlanService.exportProductionPlans(factoryId, startDate, endDate);
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=production-plans.xlsx");
        response.getOutputStream().write(data);
        response.getOutputStream().flush();
    }

    /**
     * 下载生产计划导入模板
     */
    @GetMapping("/import-template")
    @Operation(summary = "下载生产计划导入模板")
    public void downloadImportTemplate(HttpServletResponse response) throws IOException {
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=production-plan-template.xlsx");
        byte[] template = productionPlanService.generateImportTemplate();
        response.getOutputStream().write(template);
        response.getOutputStream().flush();
    }

    /**
     * Excel批量导入生产计划
     */
    @PostMapping("/import")
    @Operation(summary = "Excel批量导入生产计划")
    public ApiResponse<ImportResult<ProductionPlanDTO>> importProductionPlans(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @RequestParam("file") MultipartFile file) throws IOException {

        if (file.isEmpty()) {
            return ApiResponse.error("请选择要导入的文件");
        }

        String token = TokenUtils.extractToken(authorization);
        Long userId = mobileService.getUserFromToken(token).getId();

        log.info("Excel导入生产计划: factoryId={}, fileName={}", factoryId, file.getOriginalFilename());
        ImportResult<ProductionPlanDTO> result = productionPlanService.importProductionPlansFromExcel(
                factoryId, file.getInputStream(), userId);
        return ApiResponse.success("导入完成", result);
    }

    /**
     * 获取今日生产看板卡片（进行中/计划中/待处理）
     */
    @GetMapping("/today-cards")
    @Operation(summary = "获取今日生产看板卡片")
    public ApiResponse<List<Map<String, Object>>> getTodayCards(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId) {

        List<ProductionPlan> plans = planRepository.findByFactoryId(factoryId).stream()
                .filter(p -> {
                    ProductionPlanStatus s = p.getStatus();
                    return s == ProductionPlanStatus.IN_PROGRESS
                            || s == ProductionPlanStatus.PLANNED
                            || s == ProductionPlanStatus.PENDING;
                })
                .collect(Collectors.toList());

        List<Map<String, Object>> cards = plans.stream().map(p -> {
            Map<String, Object> card = new HashMap<>();
            card.put("planId", p.getId());
            card.put("planNumber", p.getPlanNumber());
            card.put("customerName", p.getSourceCustomerName());
            card.put("productName", p.getProductType() != null ? p.getProductType().getName() : "");
            card.put("processName", p.getProcessName());
            card.put("plannedQty", p.getPlannedQuantity());
            card.put("reportedQty", p.getActualQuantity() != null ? p.getActualQuantity() : BigDecimal.ZERO);
            BigDecimal planned = p.getPlannedQuantity();
            BigDecimal actual = p.getActualQuantity() != null ? p.getActualQuantity() : BigDecimal.ZERO;
            int progress = planned != null && planned.compareTo(BigDecimal.ZERO) > 0
                    ? actual.multiply(BigDecimal.valueOf(100))
                            .divide(planned, 0, java.math.RoundingMode.HALF_UP).intValue()
                    : 0;
            card.put("progress", progress);
            return card;
        }).collect(Collectors.toList());

        return ApiResponse.success(cards);
    }
}