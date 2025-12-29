package com.cretas.aims.controller;

import com.cretas.aims.dto.MobileDTO;
import com.cretas.aims.dto.batch.AssignWorkersDTO;
import com.cretas.aims.dto.batch.WorkerCheckoutDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.processing.ProcessingStageRecordDTO;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.enums.ProcessingStageType;
import com.cretas.aims.service.AIEnterpriseService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.ProcessingService;
import com.cretas.aims.service.ProcessingStageRecordService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 生产加工控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/processing")
@RequiredArgsConstructor
@Tag(name = "生产加工管理")
public class ProcessingController {

    private final ProcessingService processingService;
    private final MobileService mobileService;
    private final AIEnterpriseService aiEnterpriseService;
    private final ProcessingStageRecordService stageRecordService;

    // ========== 批次管理接口 ==========

    /**
     * 创建生产批次
     */
    @PostMapping("/batches")
    @Operation(summary = "创建生产批次", description = "创建新的生产批次")
    public ApiResponse<ProductionBatch> createBatch(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid @Parameter(description = "批次信息") ProductionBatch batch) {
        log.info("创建生产批次: factoryId={}, batchNumber={}", factoryId, batch.getBatchNumber());
        ProductionBatch result = processingService.createBatch(factoryId, batch);
        return ApiResponse.success(result);
    }

    /**
     * 开始生产
     */
    @PostMapping("/batches/{batchId}/start")
    @Operation(summary = "开始生产", description = "开始批次生产")
    public ApiResponse<ProductionBatch> startProduction(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId,
            @RequestParam @Parameter(description = "负责人ID") Integer supervisorId) {
        log.info("开始生产: factoryId={}, batchId={}", factoryId, batchId);
        ProductionBatch result = processingService.startProduction(factoryId, batchId, supervisorId);
        return ApiResponse.success(result);
    }

    /**
     * 暂停生产
     */
    @PostMapping("/batches/{batchId}/pause")
    @Operation(summary = "暂停生产", description = "暂停批次生产")
    public ApiResponse<ProductionBatch> pauseProduction(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId,
            @RequestParam @Parameter(description = "暂停原因") String reason) {
        log.info("暂停生产: factoryId={}, batchId={}, reason={}", factoryId, batchId, reason);
        ProductionBatch result = processingService.pauseProduction(factoryId, batchId, reason);
        return ApiResponse.success(result);
    }

    /**
     * 恢复生产
     */
    @PostMapping("/batches/{batchId}/resume")
    @Operation(summary = "恢复生产", description = "恢复已暂停的批次生产")
    public ApiResponse<ProductionBatch> resumeProduction(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId) {
        log.info("恢复生产: factoryId={}, batchId={}", factoryId, batchId);
        ProductionBatch result = processingService.resumeProduction(factoryId, batchId);
        return ApiResponse.success(result);
    }

    /**
     * 完成生产
     */
    @PostMapping("/batches/{batchId}/complete")
    @Operation(summary = "完成生产", description = "完成批次生产")
    public ApiResponse<ProductionBatch> completeProduction(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId,
            @RequestParam @Parameter(description = "实际产量") BigDecimal actualQuantity,
            @RequestParam @Parameter(description = "良品数量") BigDecimal goodQuantity,
            @RequestParam @Parameter(description = "不良品数量") BigDecimal defectQuantity) {
        log.info("完成生产: factoryId={}, batchId={}, actualQuantity={}", factoryId, batchId, actualQuantity);
        ProductionBatch result = processingService.completeProduction(
                factoryId, batchId, actualQuantity, goodQuantity, defectQuantity);
        return ApiResponse.success(result);
    }

    /**
     * 取消生产
     */
    @PostMapping("/batches/{batchId}/cancel")
    @Operation(summary = "取消生产", description = "取消批次生产")
    public ApiResponse<ProductionBatch> cancelProduction(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId,
            @RequestParam @Parameter(description = "取消原因") String reason) {
        log.info("取消生产: factoryId={}, batchId={}, reason={}", factoryId, batchId, reason);
        ProductionBatch result = processingService.cancelProduction(factoryId, batchId, reason);
        return ApiResponse.success(result);
    }

    /**
     * 获取批次详情
     */
    @GetMapping("/batches/{batchId}")
    @Operation(summary = "获取批次详情", description = "获取生产批次详细信息")
    public ApiResponse<ProductionBatch> getBatchById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId) {
        log.info("获取批次详情: factoryId={}, batchId={}", factoryId, batchId);
        ProductionBatch batch = processingService.getBatchById(factoryId, batchId);
        return ApiResponse.success(batch);
    }

    /**
     * 获取批次列表
     */
    @GetMapping("/batches")
    @Operation(summary = "获取批次列表", description = "分页获取生产批次列表")
    public ApiResponse<PageResponse<ProductionBatch>> getBatches(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "状态") String status,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取批次列表: factoryId={}, status={}", factoryId, status);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<ProductionBatch> result = processingService.getBatches(factoryId, status, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 获取批次时间线
     */
    @GetMapping("/batches/{batchId}/timeline")
    @Operation(summary = "获取批次时间线", description = "获取批次生产时间线")
    public ApiResponse<List<Map<String, Object>>> getBatchTimeline(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId) {
        log.info("获取批次时间线: factoryId={}, batchId={}", factoryId, batchId);
        List<Map<String, Object>> timeline = processingService.getBatchTimeline(factoryId, batchId);
        return ApiResponse.success(timeline);
    }

    // ========== 批次员工分配接口 ==========

    /**
     * 分配员工到批次
     */
    @PostMapping("/batches/{batchId}/assign-workers")
    @Operation(summary = "分配员工到批次", description = "将多个员工分配到生产批次")
    public ApiResponse<List<Map<String, Object>>> assignWorkersToBatch(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") Long batchId,
            @RequestBody @Valid @Parameter(description = "分配请求") AssignWorkersDTO request) {
        log.info("分配员工到批次: factoryId={}, batchId={}, workerCount={}",
                factoryId, batchId, request.getWorkerIds().size());
        List<Map<String, Object>> results = processingService.assignWorkersToBatch(
                factoryId, batchId, request.getWorkerIds(), request.getAssignedBy(), request.getNotes());
        return ApiResponse.success(results);
    }

    /**
     * 员工签出（完成批次工作）
     */
    @PostMapping("/batches/{batchId}/workers/{workerId}/checkout")
    @Operation(summary = "员工签出", description = "员工完成批次工作并签出")
    public ApiResponse<Map<String, Object>> workerCheckout(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") Long batchId,
            @PathVariable @Parameter(description = "员工ID") Long workerId,
            @RequestBody(required = false) @Parameter(description = "签出信息") WorkerCheckoutDTO request) {
        log.info("员工签出: factoryId={}, batchId={}, workerId={}", factoryId, batchId, workerId);
        Integer workMinutes = request != null ? request.getWorkMinutes() : null;
        String notes = request != null ? request.getNotes() : null;
        Map<String, Object> result = processingService.workerCheckout(
                factoryId, batchId, workerId, workMinutes, notes);
        return ApiResponse.success(result);
    }

    /**
     * 获取批次员工列表
     */
    @GetMapping("/batches/{batchId}/workers")
    @Operation(summary = "获取批次员工", description = "获取分配到批次的所有员工及其工时状态")
    public ApiResponse<List<Map<String, Object>>> getBatchWorkers(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") Long batchId) {
        log.info("获取批次员工: factoryId={}, batchId={}", factoryId, batchId);
        List<Map<String, Object>> workers = processingService.getBatchWorkers(factoryId, batchId);
        return ApiResponse.success(workers);
    }

    /**
     * 取消员工批次分配
     */
    @DeleteMapping("/batches/{batchId}/workers/{workerId}")
    @Operation(summary = "取消员工分配", description = "取消员工在批次的分配")
    public ApiResponse<Map<String, Object>> cancelWorkerAssignment(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") Long batchId,
            @PathVariable @Parameter(description = "员工ID") Long workerId) {
        log.info("取消员工分配: factoryId={}, batchId={}, workerId={}", factoryId, batchId, workerId);
        Map<String, Object> result = processingService.cancelWorkerAssignment(factoryId, batchId, workerId);
        return ApiResponse.success(result);
    }

    // ========== 原材料管理接口 ==========

    /**
     * 创建原材料接收记录
     */
    @PostMapping("/material-receipt")
    @Operation(summary = "原材料接收", description = "创建原材料接收记录")
    public ApiResponse<MaterialBatch> createMaterialReceipt(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestHeader(value = "Authorization", required = false) @Parameter(description = "访问令牌") String authorization,
            @RequestBody @Parameter(description = "原材料批次信息") MaterialBatch materialBatch) {
        log.info("原材料接收: factoryId={}, batchNumber={}", factoryId, materialBatch.getBatchNumber());

        // 获取当前用户ID（如果提供了token）
        Long userId = null;
        if (authorization != null && !authorization.trim().isEmpty()) {
            try {
                String token = TokenUtils.extractToken(authorization);
                var userDTO = mobileService.getUserFromToken(token);
                userId = userDTO.getId();
            } catch (Exception e) {
                log.warn("无法从token获取用户信息: {}", e.getMessage());
            }
        }

        // 设置创建者ID
        if (userId != null) {
            materialBatch.setCreatedBy(userId);
        }

        MaterialBatch result = processingService.createMaterialReceipt(factoryId, materialBatch);
        return ApiResponse.success(result);
    }

    /**
     * 获取原材料列表
     */
    @GetMapping("/materials")
    @Operation(summary = "获取原材料列表", description = "分页获取原材料列表")
    public ApiResponse<PageResponse<MaterialBatch>> getMaterialReceipts(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取原材料列表: factoryId={}", factoryId);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<MaterialBatch> result = processingService.getMaterialReceipts(factoryId, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 记录原材料消耗
     */
    @PostMapping("/batches/{batchId}/material-consumption")
    @Operation(summary = "记录原材料消耗", description = "记录生产批次的原材料消耗")
    public ApiResponse<Void> recordMaterialConsumption(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId,
            @RequestBody @Parameter(description = "消耗记录") List<Map<String, Object>> consumptions) {
        log.info("记录原材料消耗: factoryId={}, batchId={}", factoryId, batchId);
        processingService.recordMaterialConsumption(factoryId, batchId, consumptions);
        return ApiResponse.success();
    }

    // ========== 质量检验接口 ==========

    /**
     * 提交质检记录
     */
    @PostMapping("/quality/inspections")
    @Operation(summary = "提交质检记录", description = "提交产品质量检验记录")
    public ApiResponse<Map<String, Object>> submitInspection(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "批次ID") String batchId,
            @RequestBody @Parameter(description = "质检信息") Map<String, Object> inspection) {
        log.info("提交质检记录: factoryId={}, batchId={}", factoryId, batchId);
        Map<String, Object> result = processingService.submitInspection(factoryId, batchId, inspection);
        return ApiResponse.success(result);
    }

    /**
     * 获取质检记录
     */
    @GetMapping("/quality/inspections")
    @Operation(summary = "获取质检记录", description = "分页获取质检记录")
    public ApiResponse<PageResponse<Map<String, Object>>> getInspections(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "批次ID") String batchId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取质检记录: factoryId={}, batchId={}", factoryId, batchId);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<Map<String, Object>> result = processingService.getInspections(factoryId, batchId, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 获取质检详情
     */
    @GetMapping("/quality/inspections/{inspectionId}")
    @Operation(summary = "获取质检详情", description = "根据ID获取质检记录详情")
    public ApiResponse<Map<String, Object>> getInspectionById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "质检记录ID") String inspectionId) {
        log.info("获取质检详情: factoryId={}, inspectionId={}", factoryId, inspectionId);
        Map<String, Object> result = processingService.getInspectionById(factoryId, inspectionId);
        return ApiResponse.success(result);
    }

    /**
     * 获取质量统计
     */
    @GetMapping("/quality/statistics")
    @Operation(summary = "质量统计", description = "获取质量统计数据")
    public ApiResponse<Map<String, Object>> getQualityStatistics(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取质量统计: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> statistics = processingService.getQualityStatistics(factoryId, startDate, endDate);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取质量趋势
     */
    @GetMapping("/quality/trends")
    @Operation(summary = "质量趋势", description = "获取质量趋势分析")
    public ApiResponse<List<Map<String, Object>>> getQualityTrends(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "30") @Parameter(description = "天数") Integer days) {
        log.info("获取质量趋势: factoryId={}, days={}", factoryId, days);
        List<Map<String, Object>> trends = processingService.getQualityTrends(factoryId, days);
        return ApiResponse.success(trends);
    }

    // ========== 成本分析接口 ==========

    /**
     * 获取批次成本分析
     */
    @GetMapping("/batches/{batchId}/cost-analysis")
    @Operation(summary = "批次成本分析", description = "获取批次成本详细分析")
    public ApiResponse<Map<String, Object>> getBatchCostAnalysis(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId) {
        log.info("获取批次成本分析: factoryId={}, batchId={}", factoryId, batchId);
        Map<String, Object> analysis = processingService.getBatchCostAnalysis(factoryId, batchId);
        return ApiResponse.success(analysis);
    }

    /**
     * 获取增强版批次成本分析（前端CostAnalysisDashboard使用）
     * 返回完整的成本分解结构，包含原材料、人工、设备详情
     */
    @GetMapping("/batches/{batchId}/cost-analysis/enhanced")
    @Operation(summary = "增强版批次成本分析", description = "获取包含costBreakdown的完整成本分析")
    public ApiResponse<Map<String, Object>> getEnhancedBatchCostAnalysis(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId) {
        log.info("获取增强版批次成本分析: factoryId={}, batchId={}", factoryId, batchId);
        Map<String, Object> analysis = processingService.getEnhancedBatchCostAnalysis(factoryId, batchId);
        return ApiResponse.success(analysis);
    }

    /**
     * 重新计算批次成本
     */
    @PostMapping("/batches/{batchId}/recalculate-cost")
    @Operation(summary = "重算成本", description = "重新计算批次成本")
    public ApiResponse<ProductionBatch> recalculateBatchCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId) {
        log.info("重新计算批次成本: factoryId={}, batchId={}", factoryId, batchId);
        ProductionBatch batch = processingService.recalculateBatchCost(factoryId, batchId);
        return ApiResponse.success(batch);
    }

    // ========== AI成本分析接口 ==========
    // 所有AI接口已迁移到 AIController (/api/mobile/{factoryId}/ai/*)
    // 详见: com.cretas.aims.controller.AIController

    // ========== 仪表盘接口已迁移 (2025-12-22) ==========
    // Dashboard 端点已迁移到 ReportController: /api/mobile/{factoryId}/reports/dashboard/*
    // 包括: overview, production, quality, equipment, alerts, trends

    // ========== AI接口已全部迁移 ==========
    // 所有AI相关功能（成本分析、配额查询、报告管理、对话历史）已迁移到统一接口
    // 新接口位置: AIController (/api/mobile/{factoryId}/ai/*)
    // 详见: com.cretas.aims.controller.AIController

    // ========== 加工环节记录接口 ==========

    /**
     * 创建加工环节记录
     */
    @PostMapping("/batches/{batchId}/stages")
    @Operation(summary = "创建加工环节记录", description = "为生产批次创建加工环节记录")
    public ApiResponse<ProcessingStageRecordDTO> createStageRecord(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") Long batchId,
            @RequestBody @Valid @Parameter(description = "环节记录") ProcessingStageRecordDTO dto) {
        log.info("创建加工环节记录: factoryId={}, batchId={}, stageType={}", factoryId, batchId, dto.getStageType());
        dto.setProductionBatchId(batchId);
        ProcessingStageRecordDTO result = stageRecordService.create(factoryId, dto);
        return ApiResponse.success(result);
    }

    /**
     * 批量创建加工环节记录
     */
    @PostMapping("/batches/{batchId}/stages/batch")
    @Operation(summary = "批量创建环节记录", description = "为生产批次批量创建加工环节记录")
    public ApiResponse<List<ProcessingStageRecordDTO>> batchCreateStageRecords(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") Long batchId,
            @RequestBody @Valid @Parameter(description = "环节记录列表") List<ProcessingStageRecordDTO> dtos) {
        log.info("批量创建加工环节记录: factoryId={}, batchId={}, count={}", factoryId, batchId, dtos.size());
        List<ProcessingStageRecordDTO> results = stageRecordService.batchCreate(factoryId, batchId, dtos);
        return ApiResponse.success(results);
    }

    /**
     * 获取批次的所有环节记录
     */
    @GetMapping("/batches/{batchId}/stages")
    @Operation(summary = "获取批次环节记录", description = "获取生产批次的所有加工环节记录")
    public ApiResponse<List<ProcessingStageRecordDTO>> getStageRecords(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") Long batchId,
            @RequestParam(defaultValue = "false") @Parameter(description = "是否包含对比数据") Boolean withComparison) {
        log.info("获取批次环节记录: factoryId={}, batchId={}, withComparison={}", factoryId, batchId, withComparison);
        List<ProcessingStageRecordDTO> results;
        if (withComparison) {
            results = stageRecordService.getByBatchIdWithComparison(factoryId, batchId);
        } else {
            results = stageRecordService.getByBatchId(factoryId, batchId);
        }
        return ApiResponse.success(results);
    }

    /**
     * 获取单个环节记录
     */
    @GetMapping("/stages/{stageId}")
    @Operation(summary = "获取环节记录详情", description = "获取单个加工环节记录详情")
    public ApiResponse<ProcessingStageRecordDTO> getStageRecord(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "环节记录ID") Long stageId) {
        log.info("获取环节记录详情: factoryId={}, stageId={}", factoryId, stageId);
        ProcessingStageRecordDTO result = stageRecordService.getById(factoryId, stageId);
        return ApiResponse.success(result);
    }

    /**
     * 更新环节记录
     */
    @PutMapping("/stages/{stageId}")
    @Operation(summary = "更新环节记录", description = "更新加工环节记录")
    public ApiResponse<ProcessingStageRecordDTO> updateStageRecord(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "环节记录ID") Long stageId,
            @RequestBody @Valid @Parameter(description = "环节记录") ProcessingStageRecordDTO dto) {
        log.info("更新环节记录: factoryId={}, stageId={}", factoryId, stageId);
        ProcessingStageRecordDTO result = stageRecordService.update(factoryId, stageId, dto);
        return ApiResponse.success(result);
    }

    /**
     * 删除环节记录
     */
    @DeleteMapping("/stages/{stageId}")
    @Operation(summary = "删除环节记录", description = "删除加工环节记录")
    public ApiResponse<Void> deleteStageRecord(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "环节记录ID") Long stageId) {
        log.info("删除环节记录: factoryId={}, stageId={}", factoryId, stageId);
        stageRecordService.delete(factoryId, stageId);
        return ApiResponse.success();
    }

    /**
     * 按环节类型查询记录
     */
    @GetMapping("/stages/by-type/{stageType}")
    @Operation(summary = "按类型查询环节记录", description = "按环节类型查询加工记录")
    public ApiResponse<List<ProcessingStageRecordDTO>> getStageRecordsByType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "环节类型") ProcessingStageType stageType) {
        log.info("按类型查询环节记录: factoryId={}, stageType={}", factoryId, stageType);
        List<ProcessingStageRecordDTO> results = stageRecordService.getByStageType(factoryId, stageType);
        return ApiResponse.success(results);
    }

    /**
     * 获取环节统计数据 (用于AI分析)
     */
    @GetMapping("/stages/statistics")
    @Operation(summary = "获取环节统计", description = "获取各环节的统计数据，用于AI分析对比")
    public ApiResponse<Map<ProcessingStageType, Map<String, Object>>> getStageStatistics(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取环节统计: factoryId={}", factoryId);
        Map<ProcessingStageType, Map<String, Object>> stats = stageRecordService.getStageStatistics(factoryId);
        return ApiResponse.success(stats);
    }

    /**
     * 获取批次环节数据 (AI分析格式)
     */
    @GetMapping("/batches/{batchId}/stages/ai-format")
    @Operation(summary = "获取AI分析格式数据", description = "获取批次环节数据，格式化为AI分析所需的格式")
    public ApiResponse<Map<String, String>> getStageRecordsForAI(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") Long batchId) {
        log.info("获取AI分析格式数据: factoryId={}, batchId={}", factoryId, batchId);
        Map<String, String> result = stageRecordService.formatForAIAnalysis(factoryId, batchId);
        return ApiResponse.success(result);
    }

}