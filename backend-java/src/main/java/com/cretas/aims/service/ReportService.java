package com.cretas.aims.service;

import com.cretas.aims.dto.report.DashboardStatisticsDTO;
import javax.servlet.http.HttpServletResponse;
import java.time.LocalDate;
import java.util.Map;
/**
 * 报表统计服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface ReportService {
    /**
     * 获取仪表盘统计数据
     */
    DashboardStatisticsDTO getDashboardStatistics(String factoryId);
     /**
     * 获取生产报表
      */
    Map<String, Object> getProductionReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取库存报表
      */
    Map<String, Object> getInventoryReport(String factoryId, LocalDate date);
     /**
     * 获取财务报表
      */
    Map<String, Object> getFinanceReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取质量报表
      */
    Map<String, Object> getQualityReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取设备效率报表
      */
    Map<String, Object> getEquipmentEfficiencyReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取人员绩效报表
      */
    Map<String, Object> getPersonnelPerformanceReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取供应链报表
      */
    Map<String, Object> getSupplyChainReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取销售报表
      */
    Map<String, Object> getSalesReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取成本分析报表
      */
    Map<String, Object> getCostAnalysisReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取月度报表汇总
      */
    Map<String, Object> getMonthlyReport(String factoryId, Integer year, Integer month);
     /**
     * 获取年度报表汇总
      */
    Map<String, Object> getYearlyReport(String factoryId, Integer year);
     /**
     * 获取自定义报表
      */
    Map<String, Object> getCustomReport(String factoryId, Map<String, Object> parameters);
     /**
     * 导出报表为Excel
      */
    byte[] exportReportToExcel(String factoryId, String reportType, Map<String, Object> parameters);
     /**
     * 导出报表为PDF
      */
    byte[] exportReportToPDF(String factoryId, String reportType, Map<String, Object> parameters);
     /**
     * 获取实时生产监控数据
      */
    Map<String, Object> getRealTimeProductionData(String factoryId);
     /**
     * 获取KPI指标
      */
    Map<String, Object> getKPIMetrics(String factoryId, LocalDate date);
     /**
     * 获取对比分析报表
      */
    Map<String, Object> getComparativeAnalysis(String factoryId, LocalDate period1Start, LocalDate period1End,
                                              LocalDate period2Start, LocalDate period2End);
     /**
     * 获取预测分析报表
      */
    Map<String, Object> getForecastReport(String factoryId, Integer forecastDays);
     /**
     * 获取异常分析报表
      */
    Map<String, Object> getAnomalyReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取设备报表
      */
    Map<String, Object> getEquipmentReport(String factoryId, LocalDate date);
     /**
     * 获取人员报表
      */
    Map<String, Object> getPersonnelReport(String factoryId, LocalDate date);
     /**
     * 获取效率分析报表
      */
    Map<String, Object> getEfficiencyAnalysisReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取趋势分析报表
      */
    Map<String, Object> getTrendAnalysisReport(String factoryId, String type, Integer period);
     /**
     * 获取周期对比报表
      */
    Map<String, Object> getPeriodComparisonReport(String factoryId, LocalDate period1Start, LocalDate period1End,
                                                  LocalDate period2Start, LocalDate period2End);
     /**
     * 获取预测报表（带类型）
      */
    Map<String, Object> getForecastReport(String factoryId, String type, Integer days);
    void exportReportAsExcel(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                            HttpServletResponse response);
    void exportReportAsPdf(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                          HttpServletResponse response);
     /**
     * 获取实时数据
      */
    Map<String, Object> getRealtimeData(String factoryId);
}
