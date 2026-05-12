package com.cretas.aims.service.impl;

import com.cretas.aims.dto.report.CostVarianceReportDTO;
import com.cretas.aims.dto.report.DashboardStatisticsDTO;
import com.cretas.aims.dto.report.KpiMetricsDTO;
import com.cretas.aims.dto.report.OeeReportDTO;
import com.cretas.aims.dto.report.ProductionByProductDTO;
import com.cretas.aims.service.ReportService;
import com.cretas.aims.service.report.DashboardStatisticsService;
import com.cretas.aims.service.report.ProductionReportService;
import com.cretas.aims.service.report.ReportExportService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 报表统计服务 - Facade 实现
 * 委托所有业务逻辑到专注的子服务:
 * - DashboardStatisticsService: 仪表盘异步并行统计
 * - ReportExportService: PDF/Excel 导出
 * - ProductionReportService: 生产统计、基础/分析/专项报表
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-01-09
 */
@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {

    private final DashboardStatisticsService dashboardStatisticsService;
    private final ReportExportService reportExportService;
    private final ProductionReportService productionReportService;

    // ==================== Dashboard 统计 ====================

    @Override
    public DashboardStatisticsDTO getDashboardStatistics(String factoryId) {
        return dashboardStatisticsService.getDashboardStatistics(factoryId);
    }

    // ==================== 基础报表 ====================

    @Override
    public Map<String, Object> getProductionReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getProductionReport(factoryId, startDate, endDate);
    }

    @Override
    public Map<String, Object> getInventoryReport(String factoryId, LocalDate date) {
        return productionReportService.getInventoryReport(factoryId, date);
    }

    @Override
    public Map<String, Object> getFinanceReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getFinanceReport(factoryId, startDate, endDate);
    }

    @Override
    public Map<String, Object> getQualityReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getQualityReport(factoryId, startDate, endDate);
    }

    @Override
    public Map<String, Object> getEquipmentEfficiencyReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getEquipmentEfficiencyReport(factoryId, startDate, endDate);
    }

    @Override
    public Map<String, Object> getPersonnelPerformanceReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getPersonnelPerformanceReport(factoryId, startDate, endDate);
    }

    @Override
    public Map<String, Object> getSupplyChainReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getSupplyChainReport(factoryId, startDate, endDate);
    }

    @Override
    public Map<String, Object> getSalesReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getSalesReport(factoryId, startDate, endDate);
    }

    @Override
    public Map<String, Object> getCostAnalysisReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getCostAnalysisReport(factoryId, startDate, endDate);
    }

    // ==================== 汇总报表 ====================

    @Override
    public Map<String, Object> getMonthlyReport(String factoryId, Integer year, Integer month) {
        return productionReportService.getMonthlyReport(factoryId, year, month);
    }

    @Override
    public Map<String, Object> getYearlyReport(String factoryId, Integer year) {
        return productionReportService.getYearlyReport(factoryId, year);
    }

    @Override
    public Map<String, Object> getCustomReport(String factoryId, Map<String, Object> parameters) {
        return productionReportService.getCustomReport(factoryId, parameters);
    }

    // ==================== 导出 ====================

    @Override
    public byte[] exportReportToExcel(String factoryId, String reportType, Map<String, Object> parameters) {
        return reportExportService.exportReportToExcel(factoryId, reportType, parameters);
    }

    @Override
    public byte[] exportReportToPDF(String factoryId, String reportType, Map<String, Object> parameters) {
        return reportExportService.exportReportToPDF(factoryId, reportType, parameters);
    }

    @Override
    public void exportReportAsExcel(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                                    boolean maskPrice, HttpServletResponse response) {
        reportExportService.exportReportAsExcel(factoryId, reportType, startDate, endDate, maskPrice, response);
    }

    @Override
    public void exportReportAsPdf(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                                  boolean maskPrice, HttpServletResponse response) {
        reportExportService.exportReportAsPdf(factoryId, reportType, startDate, endDate, maskPrice, response);
    }

    // ==================== 实时 & KPI ====================

    @Override
    public Map<String, Object> getRealTimeProductionData(String factoryId) {
        return productionReportService.getRealTimeProductionData(factoryId);
    }

    @Override
    public Map<String, Object> getKPIMetrics(String factoryId, LocalDate date) {
        return productionReportService.getKPIMetrics(factoryId, date);
    }

    @Override
    public Map<String, Object> getRealtimeData(String factoryId) {
        return productionReportService.getRealtimeData(factoryId);
    }

    // ==================== 分析报表 ====================

    @Override
    public Map<String, Object> getComparativeAnalysis(String factoryId, LocalDate period1Start, LocalDate period1End,
                                                      LocalDate period2Start, LocalDate period2End) {
        return productionReportService.getComparativeAnalysis(factoryId, period1Start, period1End, period2Start, period2End);
    }

    @Override
    public Map<String, Object> getForecastReport(String factoryId, Integer forecastDays) {
        return productionReportService.getForecastReport(factoryId, forecastDays);
    }

    @Override
    public Map<String, Object> getAnomalyReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getAnomalyReport(factoryId, startDate, endDate);
    }

    @Override
    public Map<String, Object> getEquipmentReport(String factoryId, LocalDate date) {
        return productionReportService.getEquipmentReport(factoryId, date);
    }

    @Override
    public Map<String, Object> getPersonnelReport(String factoryId, LocalDate date) {
        return productionReportService.getPersonnelReport(factoryId, date);
    }

    @Override
    public Map<String, Object> getEfficiencyAnalysisReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getEfficiencyAnalysisReport(factoryId, startDate, endDate);
    }

    @Override
    public Map<String, Object> getTrendAnalysisReport(String factoryId, String type, Integer period) {
        return productionReportService.getTrendAnalysisReport(factoryId, type, period);
    }

    @Override
    public Map<String, Object> getPeriodComparisonReport(String factoryId, LocalDate period1Start, LocalDate period1End,
                                                         LocalDate period2Start, LocalDate period2End) {
        return productionReportService.getPeriodComparisonReport(factoryId, period1Start, period1End, period2Start, period2End);
    }

    @Override
    public Map<String, Object> getForecastReport(String factoryId, String type, Integer days) {
        return productionReportService.getForecastReport(factoryId, type, days);
    }

    // ==================== Dashboard 委托 (ProcessingService) ====================

    @Override
    public Map<String, Object> getDashboardOverview(String factoryId, String period) {
        return productionReportService.getDashboardOverview(factoryId, period);
    }

    @Override
    public Map<String, Object> getProductionDashboard(String factoryId, String period) {
        return productionReportService.getProductionDashboard(factoryId, period);
    }

    @Override
    public Map<String, Object> getQualityDashboard(String factoryId) {
        return productionReportService.getQualityDashboard(factoryId);
    }

    @Override
    public Map<String, Object> getEquipmentDashboard(String factoryId) {
        return productionReportService.getEquipmentDashboard(factoryId);
    }

    @Override
    public Map<String, Object> getAlertsDashboard(String factoryId, String period) {
        return productionReportService.getAlertsDashboard(factoryId, period);
    }

    @Override
    public Map<String, Object> getTrendsDashboard(String factoryId, String period, String metric, Integer days) {
        return productionReportService.getTrendsDashboard(factoryId, period, metric, days);
    }

    // ==================== 生产统计报表 ====================

    @Override
    public List<ProductionByProductDTO> getProductionByProduct(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getProductionByProduct(factoryId, startDate, endDate);
    }

    // ==================== 专项报表 ====================

    @Override
    public OeeReportDTO getOeeReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getOeeReport(factoryId, startDate, endDate);
    }

    @Override
    public CostVarianceReportDTO getCostVarianceReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getCostVarianceReport(factoryId, startDate, endDate);
    }

    @Override
    public KpiMetricsDTO getKpiMetricsDTO(String factoryId, LocalDate date) {
        return productionReportService.getKpiMetricsDTO(factoryId, date);
    }

    @Override
    public Map<String, Object> getCapacityUtilizationReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getCapacityUtilizationReport(factoryId, startDate, endDate);
    }

    @Override
    public Map<String, Object> getOnTimeDeliveryReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return productionReportService.getOnTimeDeliveryReport(factoryId, startDate, endDate);
    }
}
