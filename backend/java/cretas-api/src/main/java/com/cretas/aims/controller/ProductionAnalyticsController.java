package com.cretas.aims.controller;

import com.cretas.aims.dto.analytics.EfficiencyDashboardResponse;
import com.cretas.aims.dto.analytics.ProductionDashboardResponse;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.impl.ProductionAnalyticsServiceImpl;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/production-analytics")
@RequiredArgsConstructor
@Tag(name = "生产分析与人效分析")
public class ProductionAnalyticsController {

    private final ProductionAnalyticsServiceImpl analyticsService;

    // ==================== 生产分析 ====================

    @GetMapping("/dashboard")
    @Operation(summary = "生产分析仪表盘", description = "KPI + 日趋势 + 产品分布 + 工序分布")
    public ApiResponse<ProductionDashboardResponse> getProductionDashboard(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getProductionDashboard(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/daily-trend")
    @Operation(summary = "日产出趋势")
    public ApiResponse<List<Map<String, Object>>> getDailyTrend(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getDailyTrend(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/by-product")
    @Operation(summary = "按产品维度分析")
    public ApiResponse<List<Map<String, Object>>> getByProduct(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getByProduct(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/by-process")
    @Operation(summary = "按工序维度分析")
    public ApiResponse<List<Map<String, Object>>> getByProcess(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getByProcess(factoryId, dates[0], dates[1]));
    }

    // ==================== 人效分析 ====================

    @GetMapping("/efficiency/dashboard")
    @Operation(summary = "人效分析仪表盘", description = "KPI + 员工排名 + 日趋势 + 产品工时 + 交叉分析")
    public ApiResponse<EfficiencyDashboardResponse> getEfficiencyDashboard(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getEfficiencyDashboard(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/efficiency/workers")
    @Operation(summary = "员工人效排名")
    public ApiResponse<List<Map<String, Object>>> getWorkerRanking(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getWorkerRanking(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/efficiency/trend")
    @Operation(summary = "人效趋势")
    public ApiResponse<List<Map<String, Object>>> getEfficiencyTrend(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getEfficiencyTrend(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/efficiency/hours")
    @Operation(summary = "产品工时分布")
    public ApiResponse<List<Map<String, Object>>> getHoursByProduct(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getHoursByProduct(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/efficiency/cross")
    @Operation(summary = "员工x工序交叉分析")
    public ApiResponse<List<Map<String, Object>>> getWorkerProcessCross(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getWorkerProcessCross(factoryId, dates[0], dates[1]));
    }

    // ==================== 内部方法 ====================

    private LocalDate[] resolveDefaultDates(LocalDate startDate, LocalDate endDate) {
        if (endDate == null) endDate = LocalDate.now();
        if (startDate == null) startDate = endDate.minusDays(6);
        return new LocalDate[]{startDate, endDate};
    }
}
