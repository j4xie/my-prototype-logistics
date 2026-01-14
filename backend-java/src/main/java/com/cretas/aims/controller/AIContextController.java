package com.cretas.aims.controller;

import com.cretas.aims.dto.ai.CostAIContext;
import com.cretas.aims.dto.ai.ProductionAIContext;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.AIContextService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * AI 上下文控制器
 *
 * 提供预计算的业务数据上下文，用于：
 * 1. 减少 LLM Token 消耗（数据聚合由后端完成）
 * 2. 提升 AI 响应质量（更准确的上下文）
 * 3. 支持成本差异分析（BOM vs 实际）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-13
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/ai/context")
@Tag(name = "AI上下文", description = "提供预计算的业务数据上下文，降低LLM Token消耗")
@RequiredArgsConstructor
@Validated
public class AIContextController {

    private final AIContextService aiContextService;

    /**
     * 获取生产统计 AI 上下文
     *
     * 返回指定时间范围内的生产统计数据，包含：
     * - 按产品分组的产量统计
     * - BOM 理论成本 vs 实际成本对比
     * - 成本结构分析
     * - 产量/成本排名
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期（可选，默认本周开始）
     * @param endDate 结束日期（可选，默认今天）
     * @return 生产 AI 上下文
     */
    @GetMapping("/production-summary")
    @Operation(summary = "获取生产统计 AI 上下文",
               description = "返回预计算的生产统计数据，用于AI分析时减少Token消耗")
    public ApiResponse<ProductionAIContext> getProductionContext(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期，默认本周开始") LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期，默认今天") LocalDate endDate) {

        log.info("获取生产统计AI上下文: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);

        // 默认日期范围：本周
        if (endDate == null) {
            endDate = LocalDate.now();
        }
        if (startDate == null) {
            startDate = endDate.minusDays(6); // 最近7天
        }

        ProductionAIContext context = aiContextService.buildProductionContext(
                factoryId, startDate, endDate);

        return ApiResponse.success(context);
    }

    /**
     * 获取产品成本 AI 上下文
     *
     * 返回指定产品的 BOM 成本与实际成本对比分析，包含：
     * - BOM 理论成本结构
     * - 实际成本统计
     * - 成本差异分析
     * - 历史成本趋势
     *
     * @param factoryId 工厂ID
     * @param productTypeId 产品类型ID
     * @param recentBatchCount 分析的最近批次数（默认10）
     * @return 成本 AI 上下文
     */
    @GetMapping("/cost-analysis")
    @Operation(summary = "获取产品成本 AI 上下文",
               description = "返回产品的BOM理论成本与实际成本对比分析")
    public ApiResponse<CostAIContext> getCostContext(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(required = false) @Parameter(description = "产品类型ID", example = "PT001") String productTypeId,
            @RequestParam(required = false, defaultValue = "10")
            @Parameter(description = "分析的最近批次数") Integer recentBatchCount) {

        // 参数验证：productTypeId 是必需的
        if (productTypeId == null || productTypeId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "缺少必需参数: productTypeId (产品类型ID)");
        }

        log.info("获取产品成本AI上下文: factoryId={}, productTypeId={}, recentBatchCount={}",
                factoryId, productTypeId, recentBatchCount);

        CostAIContext context = aiContextService.buildCostContext(
                factoryId, productTypeId.trim(), recentBatchCount);

        return ApiResponse.success(context);
    }

    /**
     * 获取成本差异汇总
     *
     * 返回工厂所有产品的 BOM vs 实际成本差异汇总，
     * 用于快速识别成本异常的产品
     *
     * @param factoryId 工厂ID
     * @return 成本差异汇总列表
     */
    @GetMapping("/cost-variance-summary")
    @Operation(summary = "获取成本差异汇总",
               description = "返回所有产品的BOM vs 实际成本差异，用于异常检测")
    public ApiResponse<?> getCostVarianceSummary(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        log.info("获取成本差异汇总: factoryId={}", factoryId);

        return ApiResponse.success(aiContextService.getCostVarianceSummary(factoryId));
    }
}
