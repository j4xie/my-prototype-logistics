package com.cretas.aims.controller;

import com.cretas.aims.dto.aps.WeightAdjustmentResult;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.scheduler.WeightAdjustmentScheduler;
import com.cretas.aims.service.aps.ApsSchedulingPerformanceMetricsService;
import com.cretas.aims.service.aps.StrategyWeightAdaptationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * APS策略权重自适应调整控制器
 *
 * 提供策略权重自适应调整相关API，包括：
 * - 获取当前策略权重
 * - 评估策略效果
 * - 自动/手动调整权重
 * - 查看调整历史
 * - 获取性能指标报告
 *
 * @author Cretas APS Team
 * @since 2026-01-21
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/aps/strategy-weights")
@RequiredArgsConstructor
@Tag(name = "APS策略权重自适应", description = "策略权重自适应调整接口，支持自动调整和手动设置")
public class StrategyWeightAdaptationController {

    private final StrategyWeightAdaptationService adaptationService;
    private final ApsSchedulingPerformanceMetricsService metricsService;
    private final WeightAdjustmentScheduler weightAdjustmentScheduler;

    // ==================== 1. 获取当前权重 ====================

    /**
     * 获取当前策略权重
     */
    @GetMapping("/current")
    @Operation(summary = "获取当前策略权重", description = "获取工厂当前的APS排产策略权重配置")
    public ApiResponse<Map<String, Double>> getCurrentWeights(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId) {
        log.info("获取当前策略权重: factoryId={}", factoryId);

        Map<String, Double> weights = adaptationService.getCurrentWeights(factoryId);
        return ApiResponse.success("获取成功", weights);
    }

    // ==================== 2. 评估策略效果 ====================

    /**
     * 评估策略效果
     */
    @GetMapping("/evaluate")
    @Operation(summary = "评估策略效果", description = "评估各排产策略在指定时间段内的实际效果，返回效果得分")
    public ApiResponse<Map<String, Double>> evaluateEffectiveness(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "开始日期 (可选，默认7天前)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期 (可选，默认今天)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        log.info("评估策略效果: factoryId={}, {} - {}", factoryId, startDate, endDate);

        if (endDate == null) {
            endDate = LocalDate.now();
        }
        if (startDate == null) {
            startDate = endDate.minusDays(7);
        }

        Map<String, Double> scores = adaptationService.evaluateStrategyEffectiveness(factoryId, startDate, endDate);
        return ApiResponse.success("评估完成", scores);
    }

    // ==================== 3. 自动调整权重 ====================

    /**
     * 自动调整策略权重
     */
    @PostMapping("/adjust")
    @Operation(summary = "自动调整策略权重", description = "根据历史效果数据自动调整各排产策略的权重")
    public ApiResponse<WeightAdjustmentResult> adjustWeights(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "开始日期 (可选，默认7天前)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期 (可选，默认今天)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        log.info("自动调整策略权重: factoryId={}, {} - {}", factoryId, startDate, endDate);

        WeightAdjustmentResult result;
        if (startDate != null && endDate != null) {
            result = adaptationService.adjustWeights(factoryId, startDate, endDate);
        } else {
            result = adaptationService.adjustWeights(factoryId);
        }

        return ApiResponse.success("权重调整完成", result);
    }

    /**
     * 模拟权重调整 (不实际保存)
     */
    @GetMapping("/simulate")
    @Operation(summary = "模拟权重调整", description = "模拟权重调整效果，不实际保存变更，用于预览调整结果")
    public ApiResponse<WeightAdjustmentResult> simulateAdjustment(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId) {
        log.info("模拟权重调整: factoryId={}", factoryId);

        WeightAdjustmentResult result = adaptationService.simulateWeightAdjustment(factoryId);
        return ApiResponse.success("模拟完成", result);
    }

    // ==================== 4. 手动设置权重 ====================

    /**
     * 手动设置策略权重
     */
    @PutMapping("/set")
    @Operation(summary = "手动设置策略权重", description = "手动设置各排产策略的权重，权重会自动归一化")
    public ApiResponse<WeightAdjustmentResult> setWeights(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @RequestBody SetWeightsRequest request) {
        log.info("手动设置策略权重: factoryId={}, weights={}, reason={}",
                factoryId, request.getWeights(), request.getReason());

        String reason = request.getReason() != null ? request.getReason() : "手动设置";
        WeightAdjustmentResult result = adaptationService.setWeights(factoryId, request.getWeights(), reason);
        return ApiResponse.success("权重设置完成", result);
    }

    /**
     * 重置为默认权重
     */
    @PostMapping("/reset")
    @Operation(summary = "重置为默认权重", description = "将策略权重重置为系统默认值")
    public ApiResponse<WeightAdjustmentResult> resetWeights(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId) {
        log.info("重置为默认权重: factoryId={}", factoryId);

        WeightAdjustmentResult result = adaptationService.resetToDefaultWeights(factoryId);
        return ApiResponse.success("已重置为默认权重", result);
    }

    // ==================== 5. 查看调整历史 ====================

    /**
     * 获取权重调整历史
     */
    @GetMapping("/history")
    @Operation(summary = "获取权重调整历史", description = "获取最近N天的策略权重调整记录")
    public ApiResponse<List<WeightAdjustmentResult>> getHistory(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "查询天数", example = "30")
            @RequestParam(defaultValue = "30") int days) {
        log.info("获取权重调整历史: factoryId={}, days={}", factoryId, days);

        List<WeightAdjustmentResult> history = adaptationService.getAdjustmentHistory(factoryId, days);
        return ApiResponse.success("获取成功", history);
    }

    // ==================== 6. 获取性能指标报告 ====================

    /**
     * 获取性能指标报告
     */
    @GetMapping("/performance-report")
    @Operation(summary = "获取性能指标报告", description = "获取排产性能的详细指标报告，包括准时率、换型效率、负载均衡等")
    public ApiResponse<ApsSchedulingPerformanceMetricsService.PerformanceReport> getPerformanceReport(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "开始日期 (可选，默认7天前)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期 (可选，默认今天)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        log.info("获取性能指标报告: factoryId={}, {} - {}", factoryId, startDate, endDate);

        if (endDate == null) {
            endDate = LocalDate.now();
        }
        if (startDate == null) {
            startDate = endDate.minusDays(7);
        }

        ApsSchedulingPerformanceMetricsService.PerformanceReport report =
                metricsService.getPerformanceReport(factoryId, startDate, endDate);
        return ApiResponse.success("获取成功", report);
    }

    // ==================== 7. 调度器管理 (仅管理员) ====================

    /**
     * 获取调度器状态
     */
    @GetMapping("/scheduler/status")
    @Operation(summary = "获取调度器状态", description = "获取权重自适应调整调度器的运行状态")
    public ApiResponse<Map<String, Object>> getSchedulerStatus(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId) {
        log.info("获取调度器状态: factoryId={}", factoryId);

        Map<String, Object> status = weightAdjustmentScheduler.getSchedulerStatus();
        return ApiResponse.success("获取成功", status);
    }

    /**
     * 手动触发调度任务
     */
    @PostMapping("/scheduler/trigger")
    @Operation(summary = "手动触发调度任务", description = "手动触发权重自适应调整任务，仅限管理员使用")
    public ApiResponse<Map<String, Object>> triggerScheduler(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "是否调整所有工厂", example = "false")
            @RequestParam(defaultValue = "false") boolean all) {
        log.info("手动触发调度任务: factoryId={}, all={}", factoryId, all);

        if (all) {
            Map<String, Object> result = weightAdjustmentScheduler.triggerAllAdjustments();
            return ApiResponse.success("已触发所有工厂的权重调整", result);
        } else {
            WeightAdjustmentResult result = weightAdjustmentScheduler.triggerAdjustment(factoryId);
            Map<String, Object> resultMap = Map.of(
                    "factoryId", factoryId,
                    "applied", result.isApplied(),
                    "adjustedAt", result.getAdjustedAt().toString()
            );
            return ApiResponse.success("已触发权重调整", resultMap);
        }
    }

    // ==================== 请求DTO ====================

    /**
     * 手动设置权重请求
     */
    @lombok.Data
    public static class SetWeightsRequest {
        /**
         * 新权重配置
         * key: 策略名称 (earliest_deadline, min_changeover, capacity_match,
         *               shortest_process, material_ready, urgency_first)
         * value: 权重值 (0.0 - 1.0)
         */
        private Map<String, Double> weights;

        /**
         * 调整原因
         */
        private String reason;
    }
}
