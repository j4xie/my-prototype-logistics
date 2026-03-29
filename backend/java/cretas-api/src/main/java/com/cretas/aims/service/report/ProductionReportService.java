package com.cretas.aims.service.report;

import com.cretas.aims.dto.report.CostVarianceReportDTO;
import com.cretas.aims.dto.report.KpiMetricsDTO;
import com.cretas.aims.dto.report.OeeReportDTO;
import com.cretas.aims.dto.report.ProductionByProductDTO;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 生产报表服务接口
 * 负责所有生产统计、库存、财务、质量、设备、人员、供应链、销售、成本等同步报表，
 * 以及 Dashboard 委托方法、OEE、成本差异、KPI、产能利用率、准时交付等专项报表。
 *
 * @author Cretas Team
 * @since 2026-03-28
 */
public interface ProductionReportService {

    // ==================== 基础报表 ====================

    Map<String, Object> getProductionReport(String factoryId, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getInventoryReport(String factoryId, LocalDate date);

    Map<String, Object> getFinanceReport(String factoryId, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getQualityReport(String factoryId, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getEquipmentEfficiencyReport(String factoryId, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getPersonnelPerformanceReport(String factoryId, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getSupplyChainReport(String factoryId, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getSalesReport(String factoryId, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getCostAnalysisReport(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 汇总报表 ====================

    Map<String, Object> getMonthlyReport(String factoryId, Integer year, Integer month);

    Map<String, Object> getYearlyReport(String factoryId, Integer year);

    Map<String, Object> getCustomReport(String factoryId, Map<String, Object> parameters);

    // ==================== 实时 & KPI ====================

    Map<String, Object> getRealTimeProductionData(String factoryId);

    Map<String, Object> getKPIMetrics(String factoryId, LocalDate date);

    Map<String, Object> getRealtimeData(String factoryId);

    // ==================== 分析报表 ====================

    Map<String, Object> getComparativeAnalysis(String factoryId, LocalDate period1Start, LocalDate period1End,
                                               LocalDate period2Start, LocalDate period2End);

    Map<String, Object> getForecastReport(String factoryId, Integer forecastDays);

    Map<String, Object> getAnomalyReport(String factoryId, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getEquipmentReport(String factoryId, LocalDate date);

    Map<String, Object> getPersonnelReport(String factoryId, LocalDate date);

    Map<String, Object> getEfficiencyAnalysisReport(String factoryId, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getTrendAnalysisReport(String factoryId, String type, Integer period);

    Map<String, Object> getPeriodComparisonReport(String factoryId, LocalDate period1Start, LocalDate period1End,
                                                  LocalDate period2Start, LocalDate period2End);

    Map<String, Object> getForecastReport(String factoryId, String type, Integer days);

    // ==================== Dashboard 委托 (ProcessingService) ====================

    Map<String, Object> getDashboardOverview(String factoryId, String period);

    Map<String, Object> getProductionDashboard(String factoryId, String period);

    Map<String, Object> getQualityDashboard(String factoryId);

    Map<String, Object> getEquipmentDashboard(String factoryId);

    Map<String, Object> getAlertsDashboard(String factoryId, String period);

    Map<String, Object> getTrendsDashboard(String factoryId, String period, String metric, Integer days);

    // ==================== 生产统计报表 ====================

    List<ProductionByProductDTO> getProductionByProduct(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 专项报表 (2026-01-14) ====================

    OeeReportDTO getOeeReport(String factoryId, LocalDate startDate, LocalDate endDate);

    CostVarianceReportDTO getCostVarianceReport(String factoryId, LocalDate startDate, LocalDate endDate);

    KpiMetricsDTO getKpiMetricsDTO(String factoryId, LocalDate date);

    Map<String, Object> getCapacityUtilizationReport(String factoryId, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getOnTimeDeliveryReport(String factoryId, LocalDate startDate, LocalDate endDate);
}
