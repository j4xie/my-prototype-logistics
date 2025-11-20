package com.cretas.aims.controller;

import com.cretas.aims.dto.TimeStatsDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.TimeStatsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * 时间统计控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/time-stats")
@Tag(name = "时间统计管理", description = "工时统计和考勤分析相关接口")
@RequiredArgsConstructor
public class TimeStatsController {

    private final TimeStatsService timeStatsService;

    @GetMapping("/daily")
    @Operation(summary = "获取日统计")
    public ApiResponse<TimeStatsDTO> getDailyStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "日期") LocalDate date) {
        log.debug("获取日统计: factoryId={}, date={}", factoryId, date);
        TimeStatsDTO stats = timeStatsService.getDailyStats(factoryId, date);
        return ApiResponse.success(stats);
    }

    @GetMapping("/daily/range")
    @Operation(summary = "获取日期范围统计")
    public ApiResponse<TimeStatsDTO> getDailyStatsRange(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.debug("获取日期范围统计: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        TimeStatsDTO stats = timeStatsService.getDailyStatsRange(factoryId, startDate, endDate);
        return ApiResponse.success(stats);
    }

    @GetMapping("/weekly")
    @Operation(summary = "获取周统计")
    public ApiResponse<TimeStatsDTO> getWeeklyStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "年份") Integer year,
            @RequestParam @Parameter(description = "周数") Integer week) {
        log.debug("获取周统计: factoryId={}, year={}, week={}", factoryId, year, week);
        TimeStatsDTO stats = timeStatsService.getWeeklyStats(factoryId, year, week);
        return ApiResponse.success(stats);
    }

    @GetMapping("/monthly")
    @Operation(summary = "获取月统计")
    public ApiResponse<TimeStatsDTO> getMonthlyStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "年份") Integer year,
            @RequestParam @Parameter(description = "月份") Integer month) {
        log.debug("获取月统计: factoryId={}, year={}, month={}", factoryId, year, month);
        TimeStatsDTO stats = timeStatsService.getMonthlyStats(factoryId, year, month);
        return ApiResponse.success(stats);
    }

    @GetMapping("/yearly")
    @Operation(summary = "获取年统计")
    public ApiResponse<TimeStatsDTO> getYearlyStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "年份") Integer year) {
        log.debug("获取年统计: factoryId={}, year={}", factoryId, year);
        TimeStatsDTO stats = timeStatsService.getYearlyStats(factoryId, year);
        return ApiResponse.success(stats);
    }

    @GetMapping("/by-work-type")
    @Operation(summary = "按工作类型统计")
    public ApiResponse<TimeStatsDTO> getStatsByWorkType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.debug("按工作类型统计: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        TimeStatsDTO stats = timeStatsService.getStatsByWorkType(factoryId, startDate, endDate);
        return ApiResponse.success(stats);
    }

    @GetMapping("/by-department")
    @Operation(summary = "按部门统计")
    public ApiResponse<TimeStatsDTO> getStatsByDepartment(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.debug("按部门统计: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        TimeStatsDTO stats = timeStatsService.getStatsByDepartment(factoryId, startDate, endDate);
        return ApiResponse.success(stats);
    }

    @GetMapping("/productivity")
    @Operation(summary = "获取生产力分析")
    public ApiResponse<TimeStatsDTO.ProductivityAnalysis> getProductivityAnalysis(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.debug("获取生产力分析: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        TimeStatsDTO.ProductivityAnalysis analysis =
            timeStatsService.getProductivityAnalysis(factoryId, startDate, endDate);
        return ApiResponse.success(analysis);
    }

    @GetMapping("/workers")
    @Operation(summary = "获取员工时间统计")
    public ApiResponse<List<TimeStatsDTO.WorkerTimeStats>> getWorkerTimeStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate,
            @RequestParam(required = false, defaultValue = "10")
            @Parameter(description = "排名前N") Integer topN) {
        log.debug("获取员工时间统计: factoryId={}, startDate={}, endDate={}, topN={}",
                factoryId, startDate, endDate, topN);
        List<TimeStatsDTO.WorkerTimeStats> stats =
            timeStatsService.getWorkerTimeStats(factoryId, startDate, endDate, topN);
        return ApiResponse.success(stats);
    }

    @GetMapping("/workers/{workerId}")
    @Operation(summary = "获取员工个人时间统计")
    public ApiResponse<TimeStatsDTO.WorkerTimeStats> getWorkerTimeStatsById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "员工ID") Integer workerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.debug("获取员工个人时间统计: factoryId={}, workerId={}, startDate={}, endDate={}",
                factoryId, workerId, startDate, endDate);
        TimeStatsDTO.WorkerTimeStats stats =
            timeStatsService.getWorkerTimeStatsById(factoryId, workerId, startDate, endDate);
        return ApiResponse.success(stats);
    }

    @GetMapping("/realtime")
    @Operation(summary = "获取工时实时统计")
    public ApiResponse<TimeStatsDTO> getRealtimeTimeStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取工时实时统计: factoryId={}", factoryId);
        TimeStatsDTO stats = timeStatsService.getRealtimeStats(factoryId);
        return ApiResponse.success(stats);
    }

    @GetMapping("/comparative")
    @Operation(summary = "获取对比分析")
    public ApiResponse<TimeStatsDTO> getComparativeStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "期间1开始日期") LocalDate period1Start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "期间1结束日期") LocalDate period1End,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "期间2开始日期") LocalDate period2Start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "期间2结束日期") LocalDate period2End) {
        log.debug("获取对比分析: factoryId={}, period1={} to {}, period2={} to {}",
                factoryId, period1Start, period1End, period2Start, period2End);
        TimeStatsDTO stats = timeStatsService.getComparativeStats(
            factoryId, period1Start, period1End, period2Start, period2End);
        return ApiResponse.success(stats);
    }

    @GetMapping("/anomaly")
    @Operation(summary = "获取异常统计")
    public ApiResponse<TimeStatsDTO> getAnomalyStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.debug("获取异常统计: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        TimeStatsDTO stats = timeStatsService.getAnomalyStats(factoryId, startDate, endDate);
        return ApiResponse.success(stats);
    }

    @GetMapping("/trend")
    @Operation(summary = "获取统计趋势")
    public ApiResponse<List<TimeStatsDTO.DailyStats>> getStatsTrend(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.debug("获取统计趋势: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        List<TimeStatsDTO.DailyStats> trend =
            timeStatsService.getStatsTrend(factoryId, startDate, endDate);
        return ApiResponse.success(trend);
    }

    @PostMapping("/export")
    @Operation(summary = "导出统计报告")
    public ApiResponse<String> exportStatsReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate,
            @RequestParam(defaultValue = "CSV")
            @Parameter(description = "导出格式") String format) {
        log.info("导出统计报告: factoryId={}, startDate={}, endDate={}, format={}",
                factoryId, startDate, endDate, format);
        String report = timeStatsService.exportStatsReport(factoryId, startDate, endDate, format);
        return ApiResponse.success(report);
    }

    @DeleteMapping("/cleanup")
    @Operation(summary = "清理过期统计数据")
    public ApiResponse<Void> cleanupOldStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "90")
            @Parameter(description = "保留天数") Integer retentionDays) {
        log.info("清理过期统计数据: factoryId={}, retentionDays={}", factoryId, retentionDays);
        timeStatsService.cleanupOldStats(factoryId, retentionDays);
        return ApiResponse.success();
    }

    @PostMapping("/recalculate")
    @Operation(summary = "重新计算统计")
    public ApiResponse<Void> recalculateStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "日期") LocalDate date) {
        log.info("重新计算统计: factoryId={}, date={}", factoryId, date);
        timeStatsService.recalculateStats(factoryId, date);
        return ApiResponse.success();
    }
}