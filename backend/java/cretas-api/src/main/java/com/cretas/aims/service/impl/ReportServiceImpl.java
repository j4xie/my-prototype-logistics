package com.cretas.aims.service.impl;

import com.cretas.aims.dto.report.CostVarianceReportDTO;
import com.cretas.aims.dto.report.DashboardStatisticsDTO;
import com.cretas.aims.dto.report.KpiMetricsDTO;
import com.cretas.aims.dto.report.OeeReportDTO;
import com.cretas.aims.dto.report.ProductionByProductDTO;
import com.cretas.aims.dto.report.SalesProductProfitRowDTO;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.inventory.SalesOrderItem;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.inventory.SalesOrderItemRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.service.ReportService;
import com.cretas.aims.service.report.DashboardStatisticsService;
import com.cretas.aims.service.report.ProductionReportService;
import com.cretas.aims.service.report.ReportExportService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Objects;
import java.util.stream.Collectors;

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
    private final SalesOrderRepository salesOrderRepository;
    private final SalesOrderItemRepository salesOrderItemRepository;

    private static final int DEFAULT_PROFIT_LOOKBACK_DAYS = 90;
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal TREND_FLAT_THRESHOLD_PCT = new BigDecimal("1.0");

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

    @Override
    public List<SalesProductProfitRowDTO> getSalesOrderProductProfitDetail(String factoryId,
                                                                           String salesOrderId,
                                                                           Integer lookbackDays) {
        SalesOrder order = salesOrderRepository.findById(salesOrderId)
                .orElseThrow(() -> new BusinessException(404, "销售订单不存在: " + salesOrderId));
        if (!Objects.equals(order.getFactoryId(), factoryId)) {
            throw new BusinessException(403, "无权访问该工厂的销售订单");
        }

        List<SalesOrderItem> items = salesOrderItemRepository.findBySalesOrderId(salesOrderId);
        if (items.isEmpty()) {
            return List.of();
        }

        int window = lookbackDays != null && lookbackDays > 0 ? lookbackDays : DEFAULT_PROFIT_LOOKBACK_DAYS;
        LocalDate endDate = order.getOrderDate() != null ? order.getOrderDate() : LocalDate.now();
        LocalDate startDate = endDate.minusDays(window);

        List<String> productTypeIds = items.stream()
                .map(SalesOrderItem::getProductTypeId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        Map<String, BigDecimal> avgByProduct = new HashMap<>();
        if (!productTypeIds.isEmpty()) {
            salesOrderItemRepository.findHistoricalAvgPrice(factoryId, productTypeIds, startDate, endDate)
                    .forEach(row -> {
                        if (row.getAvgUnitPrice() != null) {
                            avgByProduct.put(row.getProductTypeId(),
                                    row.getAvgUnitPrice().setScale(4, RoundingMode.HALF_UP));
                        }
                    });
        }

        List<SalesProductProfitRowDTO> result = new ArrayList<>(items.size());
        for (SalesOrderItem item : items) {
            result.add(buildProfitRow(item, avgByProduct.get(item.getProductTypeId())));
        }
        return result;
    }

    /**
     * Build one profit row. Honors @PriceSensitive by leaving derived price fields null
     * when any required input is null (i.e., already stripped upstream by the framework
     * for non-price roles when the entity is fetched in that auth context).
     *
     * <p>This service is called via REST under {@link com.cretas.aims.controller.ReportController}
     * which is gated by {@code @RequirePermission}, so non-price callers should never reach
     * here — but the null-safe computation defends against future code paths that might.
     */
    private SalesProductProfitRowDTO buildProfitRow(SalesOrderItem item, BigDecimal historicalAvg) {
        BigDecimal quantity = item.getQuantity();
        BigDecimal unitPrice = item.getUnitPrice();
        BigDecimal costUnitPrice = item.getCostUnitPrice();
        BigDecimal discountRate = item.getDiscountRate();
        BigDecimal taxRate = item.getTaxRate();

        SalesProductProfitRowDTO.SalesProductProfitRowDTOBuilder b = SalesProductProfitRowDTO.builder()
                .productTypeId(item.getProductTypeId())
                .productName(item.getProductName())
                .unit(item.getUnit())
                .quantity(quantity)
                .unitPrice(unitPrice)
                .costUnitPrice(costUnitPrice)
                .historicalAvgPrice(historicalAvg);

        BigDecimal grossProfit = null;
        if (unitPrice != null && costUnitPrice != null) {
            grossProfit = unitPrice.subtract(costUnitPrice).setScale(4, RoundingMode.HALF_UP);
            b.grossProfit(grossProfit);
            if (unitPrice.signum() > 0) {
                b.grossMarginPct(grossProfit.multiply(HUNDRED)
                        .divide(unitPrice, 2, RoundingMode.HALF_UP));
            }
        }

        BigDecimal lineAmount = null;
        if (unitPrice != null && quantity != null) {
            BigDecimal raw = unitPrice.multiply(quantity);
            BigDecimal discountMultiplier = BigDecimal.ONE;
            if (discountRate != null && discountRate.signum() > 0) {
                discountMultiplier = BigDecimal.ONE.subtract(
                        discountRate.divide(HUNDRED, 6, RoundingMode.HALF_UP));
            }
            lineAmount = raw.multiply(discountMultiplier).setScale(2, RoundingMode.HALF_UP);
        }

        if (lineAmount != null && unitPrice != null && quantity != null && discountRate != null) {
            b.discountAmount(unitPrice.multiply(quantity).subtract(lineAmount).setScale(2, RoundingMode.HALF_UP));
        }

        BigDecimal taxAmount = null;
        if (lineAmount != null && taxRate != null) {
            taxAmount = lineAmount.multiply(taxRate).divide(HUNDRED, 2, RoundingMode.HALF_UP);
            b.taxAmount(taxAmount);
        }

        if (grossProfit != null && quantity != null) {
            BigDecimal netProfit = grossProfit.multiply(quantity);
            if (discountRate != null && discountRate.signum() > 0) {
                BigDecimal discountMultiplier = BigDecimal.ONE.subtract(
                        discountRate.divide(HUNDRED, 6, RoundingMode.HALF_UP));
                netProfit = netProfit.multiply(discountMultiplier);
            }
            if (taxAmount != null) {
                netProfit = netProfit.subtract(taxAmount);
            }
            b.netProfit(netProfit.setScale(2, RoundingMode.HALF_UP));
        }

        if (unitPrice != null && historicalAvg != null && historicalAvg.signum() > 0) {
            BigDecimal deltaPct = unitPrice.subtract(historicalAvg).multiply(HUNDRED)
                    .divide(historicalAvg, 2, RoundingMode.HALF_UP);
            if (deltaPct.abs().compareTo(TREND_FLAT_THRESHOLD_PCT) < 0) {
                b.priceTrend("FLAT");
            } else if (deltaPct.signum() > 0) {
                b.priceTrend("UP");
            } else {
                b.priceTrend("DOWN");
            }
        }

        return b.build();
    }
}
