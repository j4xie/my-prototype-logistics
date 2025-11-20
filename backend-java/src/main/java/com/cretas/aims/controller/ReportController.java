package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.report.DashboardStatisticsDTO;
import com.cretas.aims.service.ReportService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import java.time.LocalDate;
import java.util.Map;

/**
 * 报表统计控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/reports")
@RequiredArgsConstructor
@Tag(name = "报表统计管理")
public class ReportController {

    private final ReportService reportService;

    /**
     * 获取报表仪表盘统计数据
     */
    @GetMapping("/dashboard")
    @Operation(summary = "获取报表仪表盘统计", description = "获取工厂的综合报表统计数据")
    public ApiResponse<DashboardStatisticsDTO> getReportDashboardStatistics(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取报表仪表盘统计数据: factoryId={}", factoryId);
        DashboardStatisticsDTO statistics = reportService.getDashboardStatistics(factoryId);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取生产报表
     */
    @GetMapping("/production")
    @Operation(summary = "获取生产报表", description = "获取指定日期范围的生产报表")
    public ApiResponse<Map<String, Object>> getProductionReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取生产报表: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        Map<String, Object> report = reportService.getProductionReport(factoryId, startDate, endDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取库存报表
     */
    @GetMapping("/inventory")
    @Operation(summary = "获取库存报表", description = "获取指定日期的库存报表")
    public ApiResponse<Map<String, Object>> getInventoryReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "报表日期") LocalDate date) {
        log.info("获取库存报表: factoryId={}, date={}", factoryId, date);
        LocalDate reportDate = date != null ? date : LocalDate.now();
        Map<String, Object> report = reportService.getInventoryReport(factoryId, reportDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取财务报表
     */
    @GetMapping("/finance")
    @Operation(summary = "获取财务报表", description = "获取指定日期范围的财务报表")
    public ApiResponse<Map<String, Object>> getFinanceReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取财务报表: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        Map<String, Object> report = reportService.getFinanceReport(factoryId, startDate, endDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取质量报表
     */
    @GetMapping("/quality")
    @Operation(summary = "获取质量报表", description = "获取指定日期范围的质量报表")
    public ApiResponse<Map<String, Object>> getQualityReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取质量报表: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        Map<String, Object> report = reportService.getQualityReport(factoryId, startDate, endDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取设备报表
     */
    @GetMapping("/equipment")
    @Operation(summary = "获取设备报表", description = "获取设备运行统计报表")
    public ApiResponse<Map<String, Object>> getEquipmentReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "报表日期") LocalDate date) {
        log.info("获取设备报表: factoryId={}, date={}", factoryId, date);
        LocalDate reportDate = date != null ? date : LocalDate.now();
        Map<String, Object> report = reportService.getEquipmentReport(factoryId, reportDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取人员报表
     */
    @GetMapping("/personnel")
    @Operation(summary = "获取人员报表", description = "获取人员统计报表")
    public ApiResponse<Map<String, Object>> getPersonnelReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "报表日期") LocalDate date) {
        log.info("获取人员报表: factoryId={}, date={}", factoryId, date);
        LocalDate reportDate = date != null ? date : LocalDate.now();
        Map<String, Object> report = reportService.getPersonnelReport(factoryId, reportDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取销售报表
     */
    @GetMapping("/sales")
    @Operation(summary = "获取销售报表", description = "获取指定日期范围的销售报表")
    public ApiResponse<Map<String, Object>> getSalesReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取销售报表: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        Map<String, Object> report = reportService.getSalesReport(factoryId, startDate, endDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取成本分析报表
     */
    @GetMapping("/cost-analysis")
    @Operation(summary = "获取成本分析报表", description = "分析指定日期范围的成本构成")
    public ApiResponse<Map<String, Object>> getCostAnalysisReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取成本分析报表: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        Map<String, Object> report = reportService.getCostAnalysisReport(factoryId, startDate, endDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取效率分析报表
     */
    @GetMapping("/efficiency-analysis")
    @Operation(summary = "获取效率分析报表", description = "分析生产效率指标")
    public ApiResponse<Map<String, Object>> getEfficiencyAnalysisReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取效率分析报表: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        Map<String, Object> report = reportService.getEfficiencyAnalysisReport(factoryId, startDate, endDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取趋势分析报表
     */
    @GetMapping("/trend-analysis")
    @Operation(summary = "获取趋势分析报表", description = "分析生产经营趋势")
    public ApiResponse<Map<String, Object>> getTrendAnalysisReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "分析类型") String type,
            @RequestParam @Parameter(description = "时间周期(天)") Integer period) {
        log.info("获取趋势分析报表: factoryId={}, type={}, period={}",
                factoryId, type, period);
        Map<String, Object> report = reportService.getTrendAnalysisReport(factoryId, type, period);
        return ApiResponse.success(report);
    }

    /**
     * 获取KPI指标
     */
    @GetMapping("/kpi")
    @Operation(summary = "获取KPI指标", description = "获取关键绩效指标")
    public ApiResponse<Map<String, Object>> getKPIMetrics(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "指标日期") LocalDate date) {
        log.info("获取KPI指标: factoryId={}, date={}", factoryId, date);
        LocalDate metricsDate = date != null ? date : LocalDate.now();
        Map<String, Object> metrics = reportService.getKPIMetrics(factoryId, metricsDate);
        return ApiResponse.success(metrics);
    }

    /**
     * 获取周期对比报表
     */
    @GetMapping("/period-comparison")
    @Operation(summary = "获取周期对比报表", description = "对比两个时间周期的数据")
    public ApiResponse<Map<String, Object>> getPeriodComparisonReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "期间1开始日期") LocalDate period1Start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "期间1结束日期") LocalDate period1End,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "期间2开始日期") LocalDate period2Start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "期间2结束日期") LocalDate period2End) {
        log.info("获取周期对比报表: factoryId={}, period1={}-{}, period2={}-{}",
                factoryId, period1Start, period1End, period2Start, period2End);
        Map<String, Object> report = reportService.getPeriodComparisonReport(
                factoryId, period1Start, period1End, period2Start, period2End);
        return ApiResponse.success(report);
    }

    /**
     * 获取预测报表
     */
    @GetMapping("/forecast")
    @Operation(summary = "获取预测报表", description = "基于历史数据的预测分析")
    public ApiResponse<Map<String, Object>> getForecastReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "预测类型") String type,
            @RequestParam @Parameter(description = "预测天数") Integer days) {
        log.info("获取预测报表: factoryId={}, type={}, days={}", factoryId, type, days);
        Map<String, Object> report = reportService.getForecastReport(factoryId, type, days);
        return ApiResponse.success(report);
    }

    /**
     * 获取异常报告
     */
    @GetMapping("/anomalies")
    @Operation(summary = "获取异常报告", description = "检测并报告异常情况")
    public ApiResponse<Map<String, Object>> getAnomalyReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取异常报告: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        LocalDate start = startDate != null ? startDate : LocalDate.now().minusDays(30);
        LocalDate end = endDate != null ? endDate : LocalDate.now();
        Map<String, Object> report = reportService.getAnomalyReport(factoryId, start, end);
        return ApiResponse.success(report);
    }

    /**
     * 导出报表为Excel
     */
    @GetMapping("/export/excel")
    @Operation(summary = "导出Excel报表", description = "导出指定类型的报表为Excel文件")
    public void exportExcelReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "报表类型") String reportType,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate,
            HttpServletResponse response) {
        log.info("导出Excel报表: factoryId={}, type={}, startDate={}, endDate={}",
                factoryId, reportType, startDate, endDate);

        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition",
                String.format("attachment; filename=\"report_%s_%s.xlsx\"", reportType, LocalDate.now()));

        reportService.exportReportAsExcel(factoryId, reportType, startDate, endDate, response);
    }

    /**
     * 导出报表为PDF
     */
    @GetMapping("/export/pdf")
    @Operation(summary = "导出PDF报表", description = "导出指定类型的报表为PDF文件")
    public void exportPdfReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "报表类型") String reportType,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate,
            HttpServletResponse response) {
        log.info("导出PDF报表: factoryId={}, type={}, startDate={}, endDate={}",
                factoryId, reportType, startDate, endDate);

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition",
                String.format("attachment; filename=\"report_%s_%s.pdf\"", reportType, LocalDate.now()));

        reportService.exportReportAsPdf(factoryId, reportType, startDate, endDate, response);
    }

    /**
     * 获取自定义报表
     */
    @PostMapping("/custom")
    @Operation(summary = "获取自定义报表", description = "根据自定义参数生成报表")
    public ApiResponse<Map<String, Object>> getCustomReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Parameter(description = "自定义报表参数") Map<String, Object> parameters) {
        log.info("获取自定义报表: factoryId={}, parameters={}", factoryId, parameters);
        Map<String, Object> report = reportService.getCustomReport(factoryId, parameters);
        return ApiResponse.success(report);
    }

    /**
     * 获取报表实时数据
     */
    @GetMapping("/realtime")
    @Operation(summary = "获取报表实时数据", description = "获取工厂实时运营报表数据")
    public ApiResponse<Map<String, Object>> getRealtimeReportData(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取报表实时数据: factoryId={}", factoryId);
        Map<String, Object> data = reportService.getRealtimeData(factoryId);
        return ApiResponse.success(data);
    }
}