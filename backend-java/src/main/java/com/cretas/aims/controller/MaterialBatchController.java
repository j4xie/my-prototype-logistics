package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.ConvertToFrozenRequest;
import com.cretas.aims.dto.material.CreateMaterialBatchRequest;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.service.MaterialBatchService;
import com.cretas.aims.service.MobileService;
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
 * 原材料批次管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/material-batches")
@RequiredArgsConstructor
@Tag(name = "原材料批次管理", description = "原材料批次管理相关接口")
public class MaterialBatchController {

    private final MaterialBatchService materialBatchService;
    private final MobileService mobileService;

    /**
     * 创建原材料批次
     */
    @PostMapping
    @Operation(summary = "创建原材料批次")
    public ApiResponse<MaterialBatchDTO> createMaterialBatch(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateMaterialBatchRequest request) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Integer userId = mobileService.getUserFromToken(token).getId();

        log.info("创建原材料批次: factoryId={}, materialTypeId={}", factoryId, request.getMaterialTypeId());
        MaterialBatchDTO batch = materialBatchService.createMaterialBatch(factoryId, request, userId);
        return ApiResponse.success("原材料批次创建成功", batch);
    }

    /**
     * 更新原材料批次
     */
    @PutMapping("/{batchId}")
    @Operation(summary = "更新原材料批次")
    public ApiResponse<MaterialBatchDTO> updateMaterialBatch(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId,
            @Valid @RequestBody CreateMaterialBatchRequest request) {

        log.info("更新原材料批次: factoryId={}, batchId={}", factoryId, batchId);
        MaterialBatchDTO batch = materialBatchService.updateMaterialBatch(factoryId, batchId, request);
        return ApiResponse.success("原材料批次更新成功", batch);
    }

    /**
     * 删除原材料批次
     */
    @DeleteMapping("/{batchId}")
    @Operation(summary = "删除原材料批次")
    public ApiResponse<Void> deleteMaterialBatch(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId) {

        log.info("删除原材料批次: factoryId={}, batchId={}", factoryId, batchId);
        materialBatchService.deleteMaterialBatch(factoryId, batchId);
        return ApiResponse.success("原材料批次删除成功", null);
    }

    /**
     * 获取原材料批次详情
     */
    @GetMapping("/{batchId}")
    @Operation(summary = "获取原材料批次详情")
    public ApiResponse<MaterialBatchDTO> getMaterialBatchById(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId) {

        MaterialBatchDTO batch = materialBatchService.getMaterialBatchById(factoryId, batchId);
        return ApiResponse.success(batch);
    }

    /**
     * 获取原材料批次列表（分页）
     */
    @GetMapping
    @Operation(summary = "获取原材料批次列表（分页）")
    public ApiResponse<PageResponse<MaterialBatchDTO>> getMaterialBatchList(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Valid PageRequest pageRequest) {

        PageResponse<MaterialBatchDTO> response = materialBatchService.getMaterialBatchList(factoryId, pageRequest);
        return ApiResponse.success(response);
    }

    /**
     * 按材料类型获取批次
     */
    @GetMapping("/material-type/{materialTypeId}")
    @Operation(summary = "按材料类型获取批次")
    public ApiResponse<List<MaterialBatchDTO>> getMaterialBatchesByType(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "材料类型ID", required = true)
            @PathVariable @NotBlank String materialTypeId) {

        List<MaterialBatchDTO> batches = materialBatchService.getMaterialBatchesByType(factoryId, materialTypeId);
        return ApiResponse.success(batches);
    }

    /**
     * 按状态获取批次
     */
    @GetMapping("/status/{status}")
    @Operation(summary = "按状态获取批次")
    public ApiResponse<List<MaterialBatchDTO>> getMaterialBatchesByStatus(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "状态", required = true)
            @PathVariable MaterialBatchStatus status) {

        List<MaterialBatchDTO> batches = materialBatchService.getMaterialBatchesByStatus(factoryId, status);
        return ApiResponse.success(batches);
    }

    /**
     * 获取FIFO批次（先进先出）
     */
    @GetMapping("/fifo/{materialTypeId}")
    @Operation(summary = "获取FIFO批次（先进先出）")
    public ApiResponse<List<MaterialBatchDTO>> getFIFOBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "材料类型ID", required = true)
            @PathVariable @NotBlank String materialTypeId,
            @Parameter(description = "需求数量", required = true)
            @RequestParam @NotNull BigDecimal requiredQuantity) {

        List<MaterialBatchDTO> batches = materialBatchService.getFIFOBatches(factoryId, materialTypeId, requiredQuantity);
        return ApiResponse.success(batches);
    }

    /**
     * 获取即将过期的批次
     */
    @GetMapping("/expiring")
    @Operation(summary = "获取即将过期的批次")
    public ApiResponse<List<MaterialBatchDTO>> getExpiringBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "天数", required = true, example = "3")
            @RequestParam(defaultValue = "3") Integer days) {

        List<MaterialBatchDTO> batches = materialBatchService.getExpiringBatches(factoryId, days);
        return ApiResponse.success(batches);
    }

    /**
     * 获取已过期的批次
     */
    @GetMapping("/expired")
    @Operation(summary = "获取已过期的批次")
    public ApiResponse<List<MaterialBatchDTO>> getExpiredBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<MaterialBatchDTO> batches = materialBatchService.getExpiredBatches(factoryId);
        return ApiResponse.success(batches);
    }

    /**
     * 使用批次材料
     */
    @PostMapping("/{batchId}/use")
    @Operation(summary = "使用批次材料")
    public ApiResponse<MaterialBatchDTO> useBatchMaterial(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId,
            @Parameter(description = "使用数量", required = true)
            @RequestParam @NotNull BigDecimal quantity,
            @Parameter(description = "生产计划ID")
            @RequestParam(required = false) String productionPlanId) {

        log.info("使用批次材料: factoryId={}, batchId={}, quantity={}", factoryId, batchId, quantity);
        MaterialBatchDTO batch = materialBatchService.useBatchMaterial(factoryId, batchId, quantity, productionPlanId);
        return ApiResponse.success("材料使用成功", batch);
    }

    /**
     * 调整批次数量
     */
    @PostMapping("/{batchId}/adjust")
    @Operation(summary = "调整批次数量")
    public ApiResponse<MaterialBatchDTO> adjustBatchQuantity(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Parameter(description = "新数量", required = true)
            @RequestParam @NotNull BigDecimal newQuantity,
            @Parameter(description = "调整原因", required = true)
            @RequestParam @NotBlank String reason) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Integer userId = mobileService.getUserFromToken(token).getId();

        log.info("调整批次数量: factoryId={}, batchId={}, newQuantity={}, reason={}",
                factoryId, batchId, newQuantity, reason);
        MaterialBatchDTO batch = materialBatchService.adjustBatchQuantity(factoryId, batchId, newQuantity, reason, userId);
        return ApiResponse.success("批次数量调整成功", batch);
    }

    /**
     * 更新批次状态
     */
    @PutMapping("/{batchId}/status")
    @Operation(summary = "更新批次状态")
    public ApiResponse<MaterialBatchDTO> updateBatchStatus(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId,
            @Parameter(description = "新状态", required = true)
            @RequestParam @NotNull MaterialBatchStatus status) {

        log.info("更新批次状态: factoryId={}, batchId={}, status={}", factoryId, batchId, status);
        MaterialBatchDTO batch = materialBatchService.updateBatchStatus(factoryId, batchId, status);
        return ApiResponse.success("批次状态更新成功", batch);
    }

    /**
     * 预留批次材料
     */
    @PostMapping("/{batchId}/reserve")
    @Operation(summary = "预留批次材料")
    public ApiResponse<Void> reserveBatchMaterial(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId,
            @Parameter(description = "预留数量", required = true)
            @RequestParam @NotNull BigDecimal quantity,
            @Parameter(description = "生产计划ID", required = true)
            @RequestParam @NotNull String productionPlanId) {

        log.info("预留批次材料: factoryId={}, batchId={}, quantity={}, planId={}",
                factoryId, batchId, quantity, productionPlanId);
        materialBatchService.reserveBatchMaterial(factoryId, batchId, quantity, productionPlanId);
        return ApiResponse.success("材料预留成功", null);
    }

    /**
     * 释放预留材料
     */
    @PostMapping("/{batchId}/release")
    @Operation(summary = "释放预留材料")
    public ApiResponse<Void> releaseBatchReservation(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId,
            @Parameter(description = "释放数量", required = true)
            @RequestParam @NotNull BigDecimal quantity,
            @Parameter(description = "生产计划ID", required = true)
            @RequestParam @NotNull String productionPlanId) {

        log.info("释放预留材料: factoryId={}, batchId={}, quantity={}, planId={}",
                factoryId, batchId, quantity, productionPlanId);
        materialBatchService.releaseBatchReservation(factoryId, batchId, quantity, productionPlanId);
        return ApiResponse.success("预留释放成功", null);
    }

    /**
     * 消耗批次材料
     */
    @PostMapping("/{batchId}/consume")
    @Operation(summary = "消耗批次材料")
    public ApiResponse<Void> consumeBatchMaterial(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId,
            @Parameter(description = "消耗数量", required = true)
            @RequestParam @NotNull BigDecimal quantity,
            @Parameter(description = "生产计划ID", required = true)
            @RequestParam @NotNull String productionPlanId) {

        log.info("消耗批次材料: factoryId={}, batchId={}, quantity={}, planId={}",
                factoryId, batchId, quantity, productionPlanId);
        materialBatchService.consumeBatchMaterial(factoryId, batchId, quantity, productionPlanId);
        return ApiResponse.success("材料消耗成功", null);
    }

    /**
     * 获取库存统计
     */
    @GetMapping("/inventory/statistics")
    @Operation(summary = "获取库存统计")
    public ApiResponse<Map<String, Object>> getInventoryStatistics(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<String, Object> statistics = materialBatchService.getInventoryStatistics(factoryId);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取库存价值
     */
    @GetMapping("/inventory/valuation")
    @Operation(summary = "获取库存价值")
    public ApiResponse<BigDecimal> getInventoryValuation(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        BigDecimal valuation = materialBatchService.getInventoryValuation(factoryId);
        return ApiResponse.success(valuation);
    }

    /**
     * 获取低库存警告
     */
    @GetMapping("/low-stock")
    @Operation(summary = "获取低库存警告")
    public ApiResponse<List<Map<String, Object>>> getLowStockWarnings(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<Map<String, Object>> warnings = materialBatchService.getLowStockWarnings(factoryId);
        return ApiResponse.success(warnings);
    }

    /**
     * 批量创建材料批次
     */
    @PostMapping("/batch")
    @Operation(summary = "批量创建材料批次")
    public ApiResponse<List<MaterialBatchDTO>> batchCreateMaterialBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody List<CreateMaterialBatchRequest> requests) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Integer userId = mobileService.getUserFromToken(token).getId();

        log.info("批量创建材料批次: factoryId={}, count={}", factoryId, requests.size());
        List<MaterialBatchDTO> batches = materialBatchService.batchCreateMaterialBatches(factoryId, requests, userId);
        return ApiResponse.success("批量创建成功", batches);
    }

    /**
     * 获取批次使用历史
     */
    @GetMapping("/{batchId}/usage-history")
    @Operation(summary = "获取批次使用历史")
    public ApiResponse<List<Map<String, Object>>> getBatchUsageHistory(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId) {

        List<Map<String, Object>> history = materialBatchService.getBatchUsageHistory(factoryId, batchId);
        return ApiResponse.success(history);
    }

    /**
     * 导出库存报表
     */
    @GetMapping("/export")
    @Operation(summary = "导出库存报表")
    public byte[] exportInventoryReport(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "开始日期")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        log.info("导出库存报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        return materialBatchService.exportInventoryReport(factoryId, startDate, endDate);
    }

    /**
     * 处理过期批次
     */
    @PostMapping("/handle-expired")
    @Operation(summary = "处理过期批次")
    public ApiResponse<Integer> handleExpiredBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        log.info("处理过期批次: factoryId={}", factoryId);
        int count = materialBatchService.handleExpiredBatches(factoryId);
        return ApiResponse.success(String.format("已处理%d个过期批次", count), count);
    }

    /**
     * 转冻品
     * 将原材料批次从鲜品转换为冻品状态
     *
     * @param factoryId 工厂ID
     * @param batchId 批次ID
     * @param request 转换请求参数
     * @return 转换后的批次信息
     * @since 2025-11-20
     */
    @PostMapping("/{batchId}/convert-to-frozen")
    @Operation(summary = "将原材料批次转为冻品",
               description = "将鲜品批次转换为冻品，更新批次状态和存储条件")
    public ApiResponse<MaterialBatchDTO> convertToFrozen(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotNull Long batchId,
            @Parameter(description = "转换请求参数", required = true)
            @RequestBody @Valid ConvertToFrozenRequest request) {

        log.info("转冻品: factoryId={}, batchId={}, convertedBy={}",
                factoryId, batchId, request.getConvertedBy());
        MaterialBatchDTO result = materialBatchService.convertToFrozen(factoryId, batchId, request);
        return ApiResponse.success("已成功转为冻品", result);
    }
}