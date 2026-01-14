package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.report.CostVarianceReportDTO;
import com.cretas.aims.dto.report.KpiMetricsDTO;
import com.cretas.aims.dto.report.OeeReportDTO;
import com.cretas.aims.dto.report.ProductionByProductDTO;
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
import java.util.List;
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

    // ============================================================
    // Dashboard 统一入口 (委托 ProcessingService)
    // 这是 ReportController 作为报表/Dashboard 统一入口的实现
    // ProcessingController 的 dashboard 端点已标记为 @Deprecated
    // ============================================================

    /**
     * 获取生产概览 Dashboard
     */
    @GetMapping("/dashboard/overview")
    @Operation(summary = "生产概览Dashboard", description = "获取生产概览数据 (委托ProcessingService)")
    public ApiResponse<Map<String, Object>> getDashboardOverview(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "today") @Parameter(description = "时间周期: today, week, month") String period) {
        log.info("获取生产概览Dashboard: factoryId={}, period={}", factoryId, period);
        return ApiResponse.success(reportService.getDashboardOverview(factoryId, period));
    }

    /**
     * 获取生产统计 Dashboard
     */
    @GetMapping("/dashboard/production")
    @Operation(summary = "生产统计Dashboard", description = "获取生产统计数据 (委托ProcessingService)")
    public ApiResponse<Map<String, Object>> getProductionDashboard(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "today") @Parameter(description = "时间周期: today, week, month") String period) {
        log.info("获取生产统计Dashboard: factoryId={}, period={}", factoryId, period);
        return ApiResponse.success(reportService.getProductionDashboard(factoryId, period));
    }

    /**
     * 获取质量 Dashboard
     */
    @GetMapping("/dashboard/quality")
    @Operation(summary = "质量Dashboard", description = "获取质量统计数据 (委托ProcessingService)")
    public ApiResponse<Map<String, Object>> getQualityDashboard(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取质量Dashboard: factoryId={}", factoryId);
        return ApiResponse.success(reportService.getQualityDashboard(factoryId));
    }

    /**
     * 获取设备 Dashboard
     */
    @GetMapping("/dashboard/equipment")
    @Operation(summary = "设备Dashboard", description = "获取设备统计数据 (委托ProcessingService)")
    public ApiResponse<Map<String, Object>> getEquipmentDashboard(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取设备Dashboard: factoryId={}", factoryId);
        return ApiResponse.success(reportService.getEquipmentDashboard(factoryId));
    }

    /**
     * 获取告警 Dashboard
     */
    @GetMapping("/dashboard/alerts")
    @Operation(summary = "告警Dashboard", description = "获取告警统计数据 (委托ProcessingService)")
    public ApiResponse<Map<String, Object>> getAlertsDashboard(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "week") @Parameter(description = "时间周期: today, week, month") String period) {
        log.info("获取告警Dashboard: factoryId={}, period={}", factoryId, period);
        return ApiResponse.success(reportService.getAlertsDashboard(factoryId, period));
    }

    /**
     * 获取趋势分析 Dashboard
     */
    @GetMapping("/dashboard/trends")
    @Operation(summary = "趋势分析Dashboard", description = "获取趋势分析数据 (委托ProcessingService)")
    public ApiResponse<Map<String, Object>> getTrendsDashboard(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "month") @Parameter(description = "时间周期: week, month, quarter, year") String period,
            @RequestParam(defaultValue = "production") @Parameter(description = "趋势类型: production, quality, equipment, cost") String metric,
            @RequestParam(defaultValue = "30") @Parameter(description = "趋势天数") Integer days) {
        log.info("获取趋势分析Dashboard: factoryId={}, period={}, metric={}, days={}", factoryId, period, metric, days);
        return ApiResponse.success(reportService.getTrendsDashboard(factoryId, period, metric, days));
    }

    // ============================================================
    // 报表功能端点
    // ============================================================

    /**
     * 按产品统计生产数量
     */
    @GetMapping("/production-by-product")
    @Operation(summary = "按产品统计生产数量", description = "获取指定时间范围内各产品的生产统计数据，按产量降序排序")
    public ApiResponse<List<ProductionByProductDTO>> getProductionByProduct(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期，格式yyyy-MM-dd，默认本周一") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期，格式yyyy-MM-dd，默认今天") LocalDate endDate) {
        log.info("按产品统计生产数量: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        List<ProductionByProductDTO> result = reportService.getProductionByProduct(factoryId, startDate, endDate);
        return ApiResponse.success(result);
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
    @Operation(summary = "获取财务报表", description = "获取指定日期范围的财务报表，默认近30天")
    public ApiResponse<Map<String, Object>> getFinanceReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期，默认30天前") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期，默认今天") LocalDate endDate) {
        // 默认值: 近30天
        LocalDate effectiveEndDate = endDate != null ? endDate : LocalDate.now();
        LocalDate effectiveStartDate = startDate != null ? startDate : effectiveEndDate.minusDays(30);
        log.info("获取财务报表: factoryId={}, startDate={}, endDate={}",
                factoryId, effectiveStartDate, effectiveEndDate);
        Map<String, Object> report = reportService.getFinanceReport(factoryId, effectiveStartDate, effectiveEndDate);
        return ApiResponse.success(report);
    }

    // quality 和 equipment 报表已移至 ProcessingController

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
    @Operation(summary = "获取销售报表", description = "获取指定日期范围的销售报表，默认近30天")
    public ApiResponse<Map<String, Object>> getSalesReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期，默认30天前") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期，默认今天") LocalDate endDate) {
        // 默认值: 近30天
        LocalDate effectiveEndDate = endDate != null ? endDate : LocalDate.now();
        LocalDate effectiveStartDate = startDate != null ? startDate : effectiveEndDate.minusDays(30);
        log.info("获取销售报表: factoryId={}, startDate={}, endDate={}",
                factoryId, effectiveStartDate, effectiveEndDate);
        Map<String, Object> report = reportService.getSalesReport(factoryId, effectiveStartDate, effectiveEndDate);
        return ApiResponse.success(report);
    }

    // cost-analysis 已移至 AIController (通过 Python AI 服务计算)

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

    // trend-analysis 已移至 ProcessingController

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

    // ========== 新增报表端点 (2026-01-14) ==========

    /**
     * 获取 OEE (设备综合效率) 报表
     * OEE = 可用性 × 表现性 × 质量率
     * 行业标准: ≥85% 为世界级水平
     */
    @GetMapping("/oee")
    @Operation(summary = "获取OEE报表", description = "获取设备综合效率(OEE)报表，包含可用性、表现性、质量率分析")
    public ApiResponse<OeeReportDTO> getOeeReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期，默认本周一") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期，默认今天") LocalDate endDate) {
        log.info("获取OEE报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        // 默认日期范围：本周
        if (endDate == null) {
            endDate = LocalDate.now();
        }
        if (startDate == null) {
            startDate = endDate.minusDays(6);
        }

        OeeReportDTO report = reportService.getOeeReport(factoryId, startDate, endDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取成本差异报表
     * 对比 BOM 理论成本与实际成本
     * 行业标准: 差异率 ≤5%
     */
    @GetMapping("/cost-variance")
    @Operation(summary = "获取成本差异报表", description = "获取BOM理论成本与实际成本差异分析报表")
    public ApiResponse<CostVarianceReportDTO> getCostVarianceReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期，默认30天前") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期，默认今天") LocalDate endDate) {
        log.info("获取成本差异报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        // 默认日期范围：近30天
        if (endDate == null) {
            endDate = LocalDate.now();
        }
        if (startDate == null) {
            startDate = endDate.minusDays(30);
        }

        CostVarianceReportDTO report = reportService.getCostVarianceReport(factoryId, startDate, endDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取完整 KPI 指标集
     * 整合生产、质量、成本、交付、设备等多维度指标
     */
    @GetMapping("/kpi-metrics")
    @Operation(summary = "获取完整KPI指标", description = "获取制造业核心KPI指标完整集合")
    public ApiResponse<KpiMetricsDTO> getKpiMetrics(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "指标日期，默认今天") LocalDate date) {
        log.info("获取完整KPI指标: factoryId={}, date={}", factoryId, date);

        if (date == null) {
            date = LocalDate.now();
        }

        KpiMetricsDTO metrics = reportService.getKpiMetricsDTO(factoryId, date);
        return ApiResponse.success(metrics);
    }

    /**
     * 获取产能利用率报表
     */
    @GetMapping("/capacity-utilization")
    @Operation(summary = "获取产能利用率报表", description = "获取产能利用率分析，包含热力图数据")
    public ApiResponse<Map<String, Object>> getCapacityUtilizationReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取产能利用率报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        if (endDate == null) {
            endDate = LocalDate.now();
        }
        if (startDate == null) {
            startDate = endDate.minusDays(30);
        }

        Map<String, Object> report = reportService.getCapacityUtilizationReport(factoryId, startDate, endDate);
        return ApiResponse.success(report);
    }

    /**
     * 获取准时交付报表
     * OTIF (On-Time In-Full) 准时足量交付率
     * 行业标准: ≥95%
     */
    @GetMapping("/on-time-delivery")
    @Operation(summary = "获取准时交付报表", description = "获取OTIF准时足量交付率分析")
    public ApiResponse<Map<String, Object>> getOnTimeDeliveryReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取准时交付报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        if (endDate == null) {
            endDate = LocalDate.now();
        }
        if (startDate == null) {
            startDate = endDate.minusDays(30);
        }

        Map<String, Object> report = reportService.getOnTimeDeliveryReport(factoryId, startDate, endDate);
        return ApiResponse.success(report);
    }
}