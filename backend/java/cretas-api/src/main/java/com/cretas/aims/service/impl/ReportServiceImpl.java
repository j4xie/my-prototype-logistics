package com.cretas.aims.service.impl;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.write.style.column.LongestMatchColumnWidthStyleStrategy;
import com.cretas.aims.dto.report.DashboardStatisticsDTO;
import com.cretas.aims.dto.report.ProductionByProductDTO;
import com.itextpdf.text.BaseColor;
import com.itextpdf.text.Document;
import com.itextpdf.text.DocumentException;
import com.itextpdf.text.Element;
import com.itextpdf.text.Font;
import com.itextpdf.text.PageSize;
import com.itextpdf.text.Paragraph;
import com.itextpdf.text.Phrase;
import com.itextpdf.text.pdf.BaseFont;
import com.itextpdf.text.pdf.PdfPCell;
import com.itextpdf.text.pdf.PdfPTable;
import com.itextpdf.text.pdf.PdfWriter;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.ShipmentRecord;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.AIAnalysisService;
import com.cretas.aims.service.ProcessingService;
import com.cretas.aims.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;
/**
 * 报表统计服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {
    private static final Logger log = LoggerFactory.getLogger(ReportServiceImpl.class);

    private final ProductionPlanRepository productionPlanRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final UserRepository userRepository;
    private final EquipmentRepository equipmentRepository;
    private final SupplierRepository supplierRepository;
    private final CustomerRepository customerRepository;
    private final FactoryRepository factoryRepository;
    private final AIAnalysisService aiAnalysisService;
    private final ProcessingService processingService;  // 委托 Dashboard 数据
    private final ProductionBatchRepository productionBatchRepository;
    private final QualityInspectionRepository qualityInspectionRepository;
    private final ShipmentRecordRepository shipmentRecordRepository;
    private final TimeClockRecordRepository timeClockRecordRepository;
    @Override
    @Cacheable(value = "dashboardStats", key = "#factoryId", unless = "#result == null")
    public DashboardStatisticsDTO getDashboardStatistics(String factoryId) {
        log.info("获取仪表盘统计数据（实时计算）: factoryId={}", factoryId);
        long startTime = System.currentTimeMillis();

        try {
            // 并行异步计算各个统计模块
            CompletableFuture<DashboardStatisticsDTO.ProductionStatistics> productionFuture =
                    getProductionStatisticsAsync(factoryId);
            CompletableFuture<DashboardStatisticsDTO.InventoryStatistics> inventoryFuture =
                    getInventoryStatisticsAsync(factoryId);
            CompletableFuture<DashboardStatisticsDTO.FinanceStatistics> financeFuture =
                    getFinanceStatisticsAsync(factoryId);
            CompletableFuture<DashboardStatisticsDTO.PersonnelStatistics> personnelFuture =
                    getPersonnelStatisticsAsync(factoryId);
            CompletableFuture<DashboardStatisticsDTO.EquipmentStatistics> equipmentFuture =
                    getEquipmentStatisticsAsync(factoryId);
            CompletableFuture<DashboardStatisticsDTO.QualityStatistics> qualityFuture =
                    getQualityStatisticsAsync(factoryId);
            CompletableFuture<DashboardStatisticsDTO.TrendStatistics> trendFuture =
                    getTrendStatisticsAsync(factoryId);
            CompletableFuture<List<DashboardStatisticsDTO.AlertInfo>> alertsFuture =
                    getAlertsAsync(factoryId);

            // 等待所有异步任务完成
            CompletableFuture.allOf(
                    productionFuture, inventoryFuture, financeFuture, personnelFuture,
                    equipmentFuture, qualityFuture, trendFuture, alertsFuture
            ).join();

            // 组装结果
            DashboardStatisticsDTO result = DashboardStatisticsDTO.builder()
                    .productionStats(productionFuture.join())
                    .inventoryStats(inventoryFuture.join())
                    .financeStats(financeFuture.join())
                    .personnelStats(personnelFuture.join())
                    .equipmentStats(equipmentFuture.join())
                    .qualityStats(qualityFuture.join())
                    .trendStats(trendFuture.join())
                    .alerts(alertsFuture.join())
                    .build();

            long endTime = System.currentTimeMillis();
            log.info("仪表盘统计数据计算完成: factoryId={}, 耗时={}ms", factoryId, endTime - startTime);

            return result;
        } catch (Exception e) {
            log.error("获取仪表盘统计数据失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            // 降级：同步串行执行
            return getDashboardStatisticsFallback(factoryId);
        }
    }

    /**
     * 降级方法：同步串行执行
     */
    private DashboardStatisticsDTO getDashboardStatisticsFallback(String factoryId) {
        log.warn("使用降级方法获取仪表盘数据: factoryId={}", factoryId);
        return DashboardStatisticsDTO.builder()
                .productionStats(getProductionStatistics(factoryId))
                .inventoryStats(getInventoryStatistics(factoryId))
                .financeStats(getFinanceStatistics(factoryId))
                .personnelStats(getPersonnelStatistics(factoryId))
                .equipmentStats(getEquipmentStatistics(factoryId))
                .qualityStats(getQualityStatistics(factoryId))
                .trendStats(getTrendStatistics(factoryId))
                .alerts(getAlerts(factoryId))
                .build();
    }

    // ==================== 异步方法 ====================

    @Async("dashboardExecutor")
    public CompletableFuture<DashboardStatisticsDTO.ProductionStatistics> getProductionStatisticsAsync(String factoryId) {
        return CompletableFuture.completedFuture(getProductionStatistics(factoryId));
    }

    @Async("dashboardExecutor")
    public CompletableFuture<DashboardStatisticsDTO.InventoryStatistics> getInventoryStatisticsAsync(String factoryId) {
        return CompletableFuture.completedFuture(getInventoryStatistics(factoryId));
    }

    @Async("dashboardExecutor")
    public CompletableFuture<DashboardStatisticsDTO.FinanceStatistics> getFinanceStatisticsAsync(String factoryId) {
        return CompletableFuture.completedFuture(getFinanceStatistics(factoryId));
    }

    @Async("dashboardExecutor")
    public CompletableFuture<DashboardStatisticsDTO.PersonnelStatistics> getPersonnelStatisticsAsync(String factoryId) {
        return CompletableFuture.completedFuture(getPersonnelStatistics(factoryId));
    }

    @Async("dashboardExecutor")
    public CompletableFuture<DashboardStatisticsDTO.EquipmentStatistics> getEquipmentStatisticsAsync(String factoryId) {
        return CompletableFuture.completedFuture(getEquipmentStatistics(factoryId));
    }

    @Async("dashboardExecutor")
    public CompletableFuture<DashboardStatisticsDTO.QualityStatistics> getQualityStatisticsAsync(String factoryId) {
        return CompletableFuture.completedFuture(getQualityStatistics(factoryId));
    }

    @Async("dashboardExecutor")
    public CompletableFuture<DashboardStatisticsDTO.TrendStatistics> getTrendStatisticsAsync(String factoryId) {
        return CompletableFuture.completedFuture(getTrendStatistics(factoryId));
    }

    @Async("dashboardExecutor")
    public CompletableFuture<List<DashboardStatisticsDTO.AlertInfo>> getAlertsAsync(String factoryId) {
        return CompletableFuture.completedFuture(getAlerts(factoryId));
    }

    // ==================== 原有同步方法 ====================

    private DashboardStatisticsDTO.ProductionStatistics getProductionStatistics(String factoryId) {
        // 获取生产计划统计
        long totalPlans = productionPlanRepository.countByFactoryId(factoryId);
        long activePlans = productionPlanRepository.countByFactoryIdAndStatus(factoryId, ProductionPlanStatus.IN_PROGRESS);
        long completedPlans = productionPlanRepository.countByFactoryIdAndStatus(factoryId, ProductionPlanStatus.COMPLETED);
        // 计算总产量和月产量
        BigDecimal totalOutput = productionPlanRepository.calculateTotalOutput(factoryId);
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        BigDecimal monthlyOutput = productionPlanRepository.calculateOutputBetweenDates(factoryId, monthStart.atStartOfDay(), LocalDate.now().atTime(23, 59, 59));
        // 计算完成率和效率
        double completionRate = totalPlans > 0 ? (completedPlans * 100.0 / totalPlans) : 0.0;
        // 从生产批次计算实际效率
        BigDecimal avgEfficiency = productionBatchRepository.calculateAverageEfficiency(factoryId, monthStart.atStartOfDay());
        double efficiency = avgEfficiency != null ? avgEfficiency.doubleValue() : 85.0;
        return DashboardStatisticsDTO.ProductionStatistics.builder()
                .totalPlans((int) totalPlans)
                .activePlans((int) activePlans)
                .completedPlans((int) completedPlans)
                .totalOutput(totalOutput != null ? totalOutput : BigDecimal.ZERO)
                .monthlyOutput(monthlyOutput != null ? monthlyOutput : BigDecimal.ZERO)
                .completionRate(completionRate)
                .efficiency(efficiency)
                .build();
    }
    private DashboardStatisticsDTO.InventoryStatistics getInventoryStatistics(String factoryId) {
        // 获取库存统计
        long totalBatches = materialBatchRepository.countByFactoryId(factoryId);
        BigDecimal totalValue = materialBatchRepository.calculateInventoryValue(factoryId);
        // 获取即将过期和已过期批次
        List<MaterialBatch> expiringBatches = materialBatchRepository.findExpiringBatches(
                factoryId, LocalDate.now().plusDays(7));
        List<MaterialBatch> expiredBatches = materialBatchRepository.findExpiredBatches(factoryId);
        // 获取低库存预警
        List<Object> lowStockMaterials = materialBatchRepository.findLowStockMaterials(factoryId);
        // 计算库存周转率 = 年消耗量 / 平均库存价值
        // 简化计算：月消耗量 * 12 / 当前库存价值
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        BigDecimal monthlyConsumption = materialBatchRepository.calculateConsumedValue(
                factoryId, monthStart, LocalDate.now());
        BigDecimal turnoverRate = BigDecimal.valueOf(4.5); // 默认值
        if (totalValue != null && totalValue.compareTo(BigDecimal.ZERO) > 0 && monthlyConsumption != null) {
            // 年化周转率 = (月消耗量 * 12) / 库存价值
            turnoverRate = monthlyConsumption.multiply(BigDecimal.valueOf(12))
                    .divide(totalValue, 2, RoundingMode.HALF_UP);
        }
        return DashboardStatisticsDTO.InventoryStatistics.builder()
                .totalBatches((int) totalBatches)
                .totalValue(totalValue != null ? totalValue : BigDecimal.ZERO)
                .expiringBatches(expiringBatches.size())
                .expiredBatches(expiredBatches.size())
                .lowStockItems(lowStockMaterials.size())
                .turnoverRate(turnoverRate)
                .build();
    }
    private DashboardStatisticsDTO.FinanceStatistics getFinanceStatistics(String factoryId) {
        // 计算财务统计
        LocalDate today = LocalDate.now();
        LocalDate yearStart = LocalDate.of(today.getYear(), 1, 1);
        LocalDate monthStart = today.withDayOfMonth(1);
        // 年度收入和成本
        BigDecimal totalRevenue = shipmentRecordRepository.calculateTotalRevenue(factoryId, yearStart, today);
        BigDecimal totalCost = productionPlanRepository.calculateTotalCostBetweenDates(
                factoryId, yearStart.atStartOfDay(), today.atTime(23, 59, 59));
        if (totalRevenue == null) totalRevenue = BigDecimal.ZERO;
        if (totalCost == null) totalCost = BigDecimal.ZERO;
        BigDecimal totalProfit = totalRevenue.subtract(totalCost);
        // 月度收入和成本
        BigDecimal monthlyRevenue = shipmentRecordRepository.calculateTotalRevenue(factoryId, monthStart, today);
        BigDecimal monthlyCost = productionPlanRepository.calculateTotalCostBetweenDates(
                factoryId, monthStart.atStartOfDay(), today.atTime(23, 59, 59));
        if (monthlyRevenue == null) monthlyRevenue = BigDecimal.ZERO;
        if (monthlyCost == null) monthlyCost = BigDecimal.ZERO;
        BigDecimal monthlyProfit = monthlyRevenue.subtract(monthlyCost);
        // 利润率
        double profitMargin = 0.0;
        if (totalRevenue.compareTo(BigDecimal.ZERO) > 0) {
            profitMargin = totalProfit.divide(totalRevenue, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).doubleValue();
        }
        // 应收应付
        BigDecimal accountsReceivable = customerRepository.calculateTotalOutstandingBalance(factoryId);
        BigDecimal accountsPayable = supplierRepository.calculateTotalOutstandingBalance(factoryId);
        return DashboardStatisticsDTO.FinanceStatistics.builder()
                .totalRevenue(totalRevenue)
                .totalCost(totalCost)
                .totalProfit(totalProfit)
                .monthlyRevenue(monthlyRevenue)
                .monthlyCost(monthlyCost)
                .monthlyProfit(monthlyProfit)
                .profitMargin(profitMargin)
                .accountsReceivable(accountsReceivable != null ? accountsReceivable : BigDecimal.ZERO)
                .accountsPayable(accountsPayable != null ? accountsPayable : BigDecimal.ZERO)
                .build();
    }
    private DashboardStatisticsDTO.PersonnelStatistics getPersonnelStatistics(String factoryId) {
        // 获取人员统计
        long totalEmployees = userRepository.countByFactoryId(factoryId);
        long activeEmployees = userRepository.countActiveUsers(factoryId);
        return DashboardStatisticsDTO.PersonnelStatistics.builder()
                .totalEmployees((int) totalEmployees)
                .activeEmployees((int) activeEmployees)
                .departmentCount(5)
                .totalSalary(BigDecimal.valueOf(500000))
                .averageSalary(BigDecimal.valueOf(10000))
                .attendanceRate(95.0)
                .todayPresent((int) activeEmployees)
                .todayAbsent(0)
                .build();
    }
    private DashboardStatisticsDTO.EquipmentStatistics getEquipmentStatistics(String factoryId) {
        // 获取设备统计
        List<Object[]> statusCount = equipmentRepository.countByStatus(factoryId);
        Map<String, Long> statusMap = new HashMap<>();
        for (Object[] row : statusCount) {
            statusMap.put((String) row[0], (Long) row[1]);
        }
        BigDecimal totalValue = equipmentRepository.calculateTotalEquipmentValue(factoryId);
        List<FactoryEquipment> needsMaintenance = equipmentRepository.findEquipmentNeedingMaintenance(factoryId, LocalDate.now());
        return DashboardStatisticsDTO.EquipmentStatistics.builder()
                .totalEquipment(statusMap.values().stream().mapToInt(Long::intValue).sum())
                .runningEquipment(statusMap.getOrDefault("running", 0L).intValue())
                .idleEquipment(statusMap.getOrDefault("idle", 0L).intValue())
                .maintenanceEquipment(statusMap.getOrDefault("maintenance", 0L).intValue())
                .utilizationRate(75.0)
                .availability(90.0)
                .needsMaintenance(needsMaintenance.size())
                .build();
    }
    private DashboardStatisticsDTO.QualityStatistics getQualityStatistics(String factoryId) {
        // 质量统计 - 使用本月数据
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        // 获取样本量和合格/不合格数据
        BigDecimal totalSampleSize = qualityInspectionRepository.calculateTotalSampleSize(factoryId, monthStart, today);
        BigDecimal passCount = qualityInspectionRepository.calculateTotalPassCount(factoryId, monthStart, today);
        BigDecimal failCount = qualityInspectionRepository.calculateTotalFailCount(factoryId, monthStart, today);
        if (totalSampleSize == null) totalSampleSize = BigDecimal.ZERO;
        if (passCount == null) passCount = BigDecimal.ZERO;
        if (failCount == null) failCount = BigDecimal.ZERO;
        // 计算合格率
        BigDecimal avgPassRate = qualityInspectionRepository.calculateAveragePassRate(factoryId, monthStart, today);
        double qualityRate = avgPassRate != null ? avgPassRate.doubleValue() : 98.0;
        // 质量问题统计
        long qualityIssues = qualityInspectionRepository.countQualityIssues(factoryId, monthStart, today);
        long resolvedIssues = qualityInspectionRepository.countResolvedIssues(factoryId, monthStart, today);
        // 一次通过率
        Double firstPassRate = qualityInspectionRepository.calculateFirstPassRate(factoryId, monthStart, today);
        return DashboardStatisticsDTO.QualityStatistics.builder()
                .totalProduction(totalSampleSize)
                .qualifiedProduction(passCount)
                .defectiveProduction(failCount)
                .qualityRate(qualityRate)
                .qualityIssues((int) qualityIssues)
                .resolvedIssues((int) resolvedIssues)
                .firstPassRate(firstPassRate != null ? firstPassRate : 96.0)
                .build();
    }
    private DashboardStatisticsDTO.TrendStatistics getTrendStatistics(String factoryId) {
        // 获取最近7天的趋势数据
        List<DashboardStatisticsDTO.DailyTrend> dailyProduction = new ArrayList<>();
        List<DashboardStatisticsDTO.DailyTrend> dailyRevenue = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            // 生产趋势
            BigDecimal output = productionPlanRepository.calculateOutputBetweenDates(
                    factoryId, date.atStartOfDay(), date.atTime(23, 59, 59));
            dailyProduction.add(DashboardStatisticsDTO.DailyTrend.builder()
                    .date(date)
                    .value(output != null ? output : BigDecimal.ZERO)
                    .changeRate(0.0)
                    .build());
            // 收入趋势（示例数据）
            dailyRevenue.add(DashboardStatisticsDTO.DailyTrend.builder()
                    .date(date)
                    .value(BigDecimal.valueOf(50000 + Math.random() * 20000))
                    .changeRate(Math.random() * 20 - 10)
                    .build());
        }
        return DashboardStatisticsDTO.TrendStatistics.builder()
                .dailyProduction(dailyProduction)
                .dailyRevenue(dailyRevenue)
                .build();
    }
    private List<DashboardStatisticsDTO.AlertInfo> getAlerts(String factoryId) {
        List<DashboardStatisticsDTO.AlertInfo> alerts = new ArrayList<>();
        // 获取即将过期批次
        List<MaterialBatch> expiringBatches = materialBatchRepository.findExpiringBatches(
                factoryId, LocalDate.now().plusDays(7));
        // 获取需要维护的设备
        List<FactoryEquipment> needsMaintenance = equipmentRepository.findEquipmentNeedingMaintenance(factoryId, LocalDate.now());
        // 添加库存预警
        if (!expiringBatches.isEmpty()) {
            alerts.add(DashboardStatisticsDTO.AlertInfo.builder()
                    .type("INVENTORY")
                    .level("WARNING")
                    .message(String.format("有%d个批次即将过期", expiringBatches.size()))
                    .date(LocalDate.now())
                    .build());
        }
        // 添加设备维护预警
        if (!needsMaintenance.isEmpty()) {
            alerts.add(DashboardStatisticsDTO.AlertInfo.builder()
                    .type("EQUIPMENT")
                    .level("INFO")
                    .message(String.format("有%d台设备需要维护", needsMaintenance.size()))
                    .date(LocalDate.now())
                    .build());
        }
        return alerts;
    }
    @Override
    public Map<String, Object> getProductionReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取生产报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> report = new HashMap<>();
        // 生产计划统计 - 暂时注释 - 数据库表中没有planned_date字段
        // long totalPlans = productionPlanRepository.countByFactoryIdAndDateRange(factoryId, startDate, endDate);
        // report.put("totalPlans", totalPlans);
        // 按状态统计 - 暂时注释 - 数据库表中没有planned_date字段
        // Map<String, Long> statusDistribution = new HashMap<>();
        // for (ProductionPlanStatus status : ProductionPlanStatus.values()) {
        //     long count = productionPlanRepository.countByFactoryIdAndStatusAndDateRange(
        //             factoryId, status, startDate, endDate);
        //     statusDistribution.put(status.name(), count);
        // }
        // report.put("statusDistribution", statusDistribution);
        // 产量统计
        BigDecimal totalOutput = productionPlanRepository.calculateOutputBetweenDates(factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        report.put("totalOutput", totalOutput != null ? totalOutput : BigDecimal.ZERO);
        // 成本统计
        BigDecimal totalCost = productionPlanRepository.calculateTotalCostBetweenDates(factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        report.put("totalCost", totalCost != null ? totalCost : BigDecimal.ZERO);
        // 日产量趋势
        List<Map<String, Object>> dailyOutput = new ArrayList<>();
        LocalDate current = startDate;
        while (!current.isAfter(endDate)) {
            BigDecimal output = productionPlanRepository.calculateOutputBetweenDates(
                    factoryId, current.atStartOfDay(), current.atTime(23, 59, 59));
            Map<String, Object> daily = new HashMap<>();
            daily.put("date", current);
            daily.put("output", output != null ? output : BigDecimal.ZERO);
            dailyOutput.add(daily);
            current = current.plusDays(1);
        }
        report.put("dailyOutput", dailyOutput);
        return report;
    }
    @Override
    public Map<String, Object> getInventoryReport(String factoryId, LocalDate date) {
        log.info("获取库存报表: factoryId={}, date={}", factoryId, date);
        Map<String, Object> report = new HashMap<>();
        // 库存总览
        long totalBatches = materialBatchRepository.countByFactoryId(factoryId);
        BigDecimal totalValue = materialBatchRepository.calculateInventoryValue(factoryId);
        report.put("totalBatches", totalBatches);
        report.put("totalValue", totalValue != null ? totalValue : BigDecimal.ZERO);
        // 按状态统计
        Map<String, Long> statusDistribution = new HashMap<>();
        for (MaterialBatchStatus status : MaterialBatchStatus.values()) {
            long count = materialBatchRepository.countByFactoryIdAndStatus(factoryId, status);
            statusDistribution.put(status.name(), count);
        }
        report.put("statusDistribution", statusDistribution);
        // 按材料类型统计
        List<Object[]> inventoryByType = materialBatchRepository.sumQuantityByMaterialType(factoryId);
        Map<String, BigDecimal> typeDistribution = new HashMap<>();
        for (Object[] row : inventoryByType) {
            typeDistribution.put((String) row[0], (BigDecimal) row[1]);
        }
        report.put("typeDistribution", typeDistribution);
        // 库存预警
        List<MaterialBatch> expiringBatches = materialBatchRepository.findExpiringBatches(
                factoryId, date.plusDays(7));
        List<MaterialBatch> expiredBatches = materialBatchRepository.findExpiredBatches(factoryId);
        report.put("expiringBatches", expiringBatches.size());
        report.put("expiredBatches", expiredBatches.size());
        List<Object> lowStockItems = materialBatchRepository.findLowStockMaterials(factoryId);
        report.put("lowStockItems", lowStockItems.size());
        return report;
    }
    @Override
    public Map<String, Object> getFinanceReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取财务报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> report = new HashMap<>();
        // 收入统计 - 从出货记录计算
        BigDecimal totalRevenue = shipmentRecordRepository.calculateTotalRevenue(factoryId, startDate, endDate);
        if (totalRevenue == null) totalRevenue = BigDecimal.ZERO;
        report.put("totalRevenue", totalRevenue);
        // 成本统计
        BigDecimal materialCost = productionPlanRepository.calculateMaterialCostBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        BigDecimal laborCost = productionPlanRepository.calculateLaborCostBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        BigDecimal equipmentCost = productionPlanRepository.calculateEquipmentCostBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        BigDecimal otherCost = productionPlanRepository.calculateOtherCostBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        BigDecimal totalCost = Stream.of(materialCost, laborCost, equipmentCost, otherCost)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        report.put("materialCost", materialCost != null ? materialCost : BigDecimal.ZERO);
        report.put("laborCost", laborCost != null ? laborCost : BigDecimal.ZERO);
        report.put("equipmentCost", equipmentCost != null ? equipmentCost : BigDecimal.ZERO);
        report.put("otherCost", otherCost != null ? otherCost : BigDecimal.ZERO);
        report.put("totalCost", totalCost);
        // 利润计算
        BigDecimal totalProfit = totalRevenue.subtract(totalCost);
        report.put("totalProfit", totalProfit);
        Double profitMargin = totalRevenue.compareTo(BigDecimal.ZERO) > 0 ?
                totalProfit.divide(totalRevenue, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).doubleValue() : 0.0;
        report.put("profitMargin", profitMargin);
        // 应收应付
        BigDecimal accountsReceivable = customerRepository.calculateTotalOutstandingBalance(factoryId);
        BigDecimal accountsPayable = supplierRepository.calculateTotalOutstandingBalance(factoryId);
        report.put("accountsReceivable", accountsReceivable != null ? accountsReceivable : BigDecimal.ZERO);
        report.put("accountsPayable", accountsPayable != null ? accountsPayable : BigDecimal.ZERO);
        return report;
    }
    @Override
    public Map<String, Object> getQualityReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取质量报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> report = new HashMap<>();
        // 质量报表统计 - 从质检记录获取实际数据
        BigDecimal totalSampleSize = qualityInspectionRepository.calculateTotalSampleSize(factoryId, startDate, endDate);
        BigDecimal passCount = qualityInspectionRepository.calculateTotalPassCount(factoryId, startDate, endDate);
        BigDecimal failCount = qualityInspectionRepository.calculateTotalFailCount(factoryId, startDate, endDate);
        if (totalSampleSize == null) totalSampleSize = BigDecimal.ZERO;
        if (passCount == null) passCount = BigDecimal.ZERO;
        if (failCount == null) failCount = BigDecimal.ZERO;
        // 计算合格率
        double qualityRate = 98.0;
        if (totalSampleSize.compareTo(BigDecimal.ZERO) > 0) {
            qualityRate = passCount.divide(totalSampleSize, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).doubleValue();
        }
        // 一次通过率
        Double firstPassRate = qualityInspectionRepository.calculateFirstPassRate(factoryId, startDate, endDate);
        // 返工率 = (不合格数 / 总样本数) * 100
        double reworkRate = 2.0;
        if (totalSampleSize.compareTo(BigDecimal.ZERO) > 0) {
            reworkRate = failCount.divide(totalSampleSize, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).doubleValue();
        }
        report.put("totalProduction", totalSampleSize);
        report.put("qualifiedProduction", passCount);
        report.put("defectiveProduction", failCount);
        report.put("qualityRate", qualityRate);
        report.put("firstPassRate", firstPassRate != null ? firstPassRate : 96.0);
        report.put("reworkRate", reworkRate);
        return report;
    }
    @Override
    public Map<String, Object> getEquipmentEfficiencyReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取设备效率报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> report = new HashMap<>();
        // 设备统计
        List<Object[]> statusCount = equipmentRepository.countByStatus(factoryId);
        Map<String, Long> statusDistribution = new HashMap<>();
        for (Object[] row : statusCount) {
            statusDistribution.put((String) row[0], (Long) row[1]);
        }
        report.put("statusDistribution", statusDistribution);
        // 设备价值
        BigDecimal totalValue = equipmentRepository.calculateTotalEquipmentValue(factoryId);
        report.put("totalValue", totalValue != null ? totalValue : BigDecimal.ZERO);
        // 运行成本
        BigDecimal operatingCost = equipmentRepository.calculateTotalOperatingCost(factoryId);
        report.put("operatingCost", operatingCost != null ? operatingCost : BigDecimal.ZERO);
        // 平均运行时间
        Double avgRunningHours = equipmentRepository.calculateAverageRunningHours(factoryId);
        report.put("averageRunningHours", avgRunningHours != null ? avgRunningHours : 0.0);
        // OEE指标
        report.put("availability", 90.0);
        report.put("performance", 85.0);
        report.put("quality", 98.0);
        report.put("oee", 75.0);
        return report;
    }
    @Override
    public Map<String, Object> getPersonnelPerformanceReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取人员绩效报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> report = new HashMap<>();
        // 人员统计
        long totalEmployees = userRepository.countByFactoryId(factoryId);
        long activeEmployees = userRepository.countActiveUsers(factoryId);
        report.put("totalEmployees", totalEmployees);
        report.put("activeEmployees", activeEmployees);
        // 部门分布
        List<Object[]> departmentCount = userRepository.countByDepartment(factoryId);
        Map<String, Long> departmentDistribution = new HashMap<>();
        for (Object[] row : departmentCount) {
            departmentDistribution.put((String) row[0], (Long) row[1]);
        }
        report.put("departmentDistribution", departmentDistribution);
        // 绩效指标 - 从考勤和生产记录计算
        // 1. 出勤率 = (有打卡记录的员工数 / 总员工数) * 100
        double attendanceRate = 95.0; // 默认值
        if (totalEmployees > 0) {
            LocalDateTime start = startDate.atStartOfDay();
            LocalDateTime end = endDate.plusDays(1).atStartOfDay();
            long attendedUsers = timeClockRecordRepository.countDistinctUsersByFactoryIdAndClockDateBetween(
                    factoryId, start, end);
            attendanceRate = (double) attendedUsers / totalEmployees * 100;
            attendanceRate = Math.min(100.0, Math.round(attendanceRate * 10) / 10.0); // 最大100%，保留1位小数
        }
        report.put("attendanceRate", attendanceRate);
        // 2. 生产效率 = (实际产量 / 计划产量) * 100
        double productivity = 88.0; // 默认值
        List<ProductionBatch> batches = productionBatchRepository.findByFactoryIdAndCreatedAtBetween(
                factoryId, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay());
        if (!batches.isEmpty()) {
            BigDecimal totalPlanned = BigDecimal.ZERO;
            BigDecimal totalActual = BigDecimal.ZERO;
            for (ProductionBatch batch : batches) {
                if (batch.getPlannedQuantity() != null) {
                    totalPlanned = totalPlanned.add(batch.getPlannedQuantity());
                }
                if (batch.getActualQuantity() != null) {
                    totalActual = totalActual.add(batch.getActualQuantity());
                }
            }
            if (totalPlanned.compareTo(BigDecimal.ZERO) > 0) {
                productivity = totalActual.divide(totalPlanned, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).doubleValue();
                productivity = Math.round(productivity * 10) / 10.0; // 保留1位小数
            }
        }
        report.put("productivity", productivity);
        // 3. 满意度 - 基于质量合格率计算 (5分制)
        // 假设合格率 >= 98% 为5分，每降低2%扣0.2分
        double satisfaction = 4.2; // 默认值
        try {
            BigDecimal totalSamples = qualityInspectionRepository.calculateTotalSampleSize(factoryId, startDate, endDate);
            BigDecimal passCount = qualityInspectionRepository.calculateTotalPassCount(factoryId, startDate, endDate);
            if (totalSamples != null && totalSamples.compareTo(BigDecimal.ZERO) > 0 && passCount != null) {
                double passRate = passCount.divide(totalSamples, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).doubleValue();
                // 转换为5分制: 98%+ = 5.0, 每2%降低扣0.2分，最低3.0分
                satisfaction = 5.0 - Math.max(0, (98.0 - passRate) / 2 * 0.2);
                satisfaction = Math.max(3.0, Math.round(satisfaction * 10) / 10.0);
            }
        } catch (Exception e) {
            log.warn("计算满意度时出错: {}", e.getMessage());
        }
        report.put("satisfaction", satisfaction);
        return report;
    }
    @Override
    public Map<String, Object> getSupplyChainReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取供应链报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> report = new HashMap<>();
        // 供应商统计
        long totalSuppliers = supplierRepository.countByFactoryId(factoryId);
        long activeSuppliers = supplierRepository.countByFactoryIdAndIsActive(factoryId, true);
        report.put("totalSuppliers", totalSuppliers);
        report.put("activeSuppliers", activeSuppliers);
        // 客户统计
        long totalCustomers = customerRepository.countByFactoryId(factoryId);
        long activeCustomers = customerRepository.countByFactoryIdAndIsActive(factoryId, true);
        report.put("totalCustomers", totalCustomers);
        report.put("activeCustomers", activeCustomers);
        // 供应商评级分布
        List<Object[]> supplierRating = supplierRepository.getSupplierRatingDistribution(factoryId);
        Map<Integer, Long> supplierRatingDistribution = new HashMap<>();
        for (Object[] row : supplierRating) {
            Integer rating = (Integer) row[0];
            Long count = (Long) row[1];
            // 修复: 过滤null rating，避免JSON序列化失败
            if (rating != null) {
                supplierRatingDistribution.put(rating, count);
            } else {
                supplierRatingDistribution.put(0, supplierRatingDistribution.getOrDefault(0, 0L) + count);
            }
        }
        // 确保所有评级都有值（0-5分，0表示未评级）
        for (int i = 0; i <= 5; i++) {
            supplierRatingDistribution.putIfAbsent(i, 0L);
        }
        report.put("supplierRatingDistribution", supplierRatingDistribution);
        // 客户评级分布
        List<Object[]> customerRating = customerRepository.getCustomerRatingDistribution(factoryId);
        Map<Integer, Long> customerRatingDistribution = new HashMap<>();
        for (Object[] row : customerRating) {
            Integer rating = (Integer) row[0];
            Long count = (Long) row[1];
            // 修复: 过滤null rating，避免JSON序列化失败
            if (rating != null) {
                customerRatingDistribution.put(rating, count);
            } else {
                customerRatingDistribution.put(0, customerRatingDistribution.getOrDefault(0, 0L) + count);
            }
        }
        // 确保所有评级都有值（0-5分，0表示未评级）
        for (int i = 0; i <= 5; i++) {
            customerRatingDistribution.putIfAbsent(i, 0L);
        }
        report.put("customerRatingDistribution", customerRatingDistribution);
        return report;
    }
    @Override
    public Map<String, Object> getSalesReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取销售报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> report = new HashMap<>();
        // 销售报表 - 从出货记录获取实际数据
        // 1. 订单总数
        long totalOrders = shipmentRecordRepository.countByFactoryIdAndDateRange(factoryId, startDate, endDate);
        report.put("totalOrders", totalOrders);
        // 2. 总收入
        BigDecimal totalRevenue = shipmentRecordRepository.calculateTotalRevenue(factoryId, startDate, endDate);
        report.put("totalRevenue", totalRevenue != null ? totalRevenue : BigDecimal.ZERO);
        // 3. 平均订单金额
        BigDecimal averageOrderValue = shipmentRecordRepository.calculateAverageOrderValue(factoryId, startDate, endDate);
        report.put("averageOrderValue", averageOrderValue != null ? averageOrderValue : BigDecimal.ZERO);
        // 4. 订单完成率 = (已发货+已送达订单数 / 总订单数) * 100
        double conversionRate = 100.0;
        if (totalOrders > 0) {
            long shippedOrders = shipmentRecordRepository.countByFactoryIdAndStatus(factoryId, "shipped");
            long deliveredOrders = shipmentRecordRepository.countByFactoryIdAndStatus(factoryId, "delivered");
            conversionRate = (double) (shippedOrders + deliveredOrders) / totalOrders * 100;
            conversionRate = Math.round(conversionRate * 10) / 10.0; // 保留1位小数
        }
        report.put("conversionRate", conversionRate);
        return report;
    }
    @Override
    public Map<String, Object> getCostAnalysisReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取成本分析报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> report = new HashMap<>();
        // 成本明细
        BigDecimal materialCost = productionPlanRepository.calculateMaterialCostBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        BigDecimal laborCost = productionPlanRepository.calculateLaborCostBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        BigDecimal equipmentCost = productionPlanRepository.calculateEquipmentCostBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        BigDecimal otherCost = productionPlanRepository.calculateOtherCostBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        BigDecimal totalCost = Stream.of(materialCost, laborCost, equipmentCost, otherCost)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        report.put("materialCost", materialCost != null ? materialCost : BigDecimal.ZERO);
        report.put("laborCost", laborCost != null ? laborCost : BigDecimal.ZERO);
        report.put("equipmentCost", equipmentCost != null ? equipmentCost : BigDecimal.ZERO);
        report.put("otherCost", otherCost != null ? otherCost : BigDecimal.ZERO);
        report.put("totalCost", totalCost);
        // 成本占比
        if (totalCost.compareTo(BigDecimal.ZERO) > 0) {
            report.put("materialCostRatio", materialCost != null ?
                    materialCost.divide(totalCost, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)) : BigDecimal.ZERO);
            report.put("laborCostRatio", laborCost != null ?
                    laborCost.divide(totalCost, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)) : BigDecimal.ZERO);
            report.put("equipmentCostRatio", equipmentCost != null ?
                    equipmentCost.divide(totalCost, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)) : BigDecimal.ZERO);
            report.put("otherCostRatio", otherCost != null ?
                    otherCost.divide(totalCost, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)) : BigDecimal.ZERO);
        }
        return report;
    }
    @Override
    public Map<String, Object> getMonthlyReport(String factoryId, Integer year, Integer month) {
        log.info("获取月度报表: factoryId={}, year={}, month={}", factoryId, year, month);
        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = startDate.plusMonths(1).minusDays(1);
        Map<String, Object> report = new HashMap<>();
        report.put("year", year);
        report.put("month", month);
        report.put("production", getProductionReport(factoryId, startDate, endDate));
        report.put("finance", getFinanceReport(factoryId, startDate, endDate));
        report.put("quality", getQualityReport(factoryId, startDate, endDate));
        report.put("equipment", getEquipmentEfficiencyReport(factoryId, startDate, endDate));
        return report;
    }
    @Override
    public Map<String, Object> getYearlyReport(String factoryId, Integer year) {
        log.info("获取年度报表: factoryId={}, year={}", factoryId, year);
        LocalDate startDate = LocalDate.of(year, 1, 1);
        LocalDate endDate = LocalDate.of(year, 12, 31);
        Map<String, Object> report = new HashMap<>();
        // 月度趋势
        List<Map<String, Object>> monthlyTrend = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            Map<String, Object> monthData = getMonthlyReport(factoryId, year, month);
            monthlyTrend.add(monthData);
        }
        report.put("monthlyTrend", monthlyTrend);
        // 年度汇总
        report.put("yearSummary", getProductionReport(factoryId, startDate, endDate));
        report.put("yearFinance", getFinanceReport(factoryId, startDate, endDate));
        return report;
    }
    @Override
    public Map<String, Object> getCustomReport(String factoryId, Map<String, Object> parameters) {
        log.info("获取自定义报表: factoryId={}, parameters={}", factoryId, parameters);
        Map<String, Object> report = new HashMap<>();
        // 解析参数
        String reportType = (String) parameters.getOrDefault("reportType", "production");
        LocalDate startDate = parameters.containsKey("startDate") ?
                LocalDate.parse((String) parameters.get("startDate")) : LocalDate.now().minusDays(30);
        LocalDate endDate = parameters.containsKey("endDate") ?
                LocalDate.parse((String) parameters.get("endDate")) : LocalDate.now();
        report.put("parameters", parameters);
        report.put("startDate", startDate.toString());
        report.put("endDate", endDate.toString());
        // 根据报表类型路由到对应的报表方法
        Map<String, Object> data;
        switch (reportType.toLowerCase()) {
            case "production":
                data = getProductionReport(factoryId, startDate, endDate);
                break;
            case "finance":
                data = getFinanceReport(factoryId, startDate, endDate);
                break;
            case "quality":
                data = getQualityReport(factoryId, startDate, endDate);
                break;
            case "equipment":
                data = getEquipmentEfficiencyReport(factoryId, startDate, endDate);
                break;
            case "personnel":
                data = getPersonnelPerformanceReport(factoryId, startDate, endDate);
                break;
            case "supply_chain":
                data = getSupplyChainReport(factoryId, startDate, endDate);
                break;
            case "sales":
                data = getSalesReport(factoryId, startDate, endDate);
                break;
            case "cost":
                data = getCostAnalysisReport(factoryId, startDate, endDate);
                break;
            case "comprehensive":
                // 综合报表：包含所有核心指标
                data = new HashMap<>();
                data.put("production", getProductionReport(factoryId, startDate, endDate));
                data.put("finance", getFinanceReport(factoryId, startDate, endDate));
                data.put("quality", getQualityReport(factoryId, startDate, endDate));
                data.put("equipment", getEquipmentEfficiencyReport(factoryId, startDate, endDate));
                break;
            default:
                log.warn("未知的报表类型: {}, 使用生产报表", reportType);
                data = getProductionReport(factoryId, startDate, endDate);
        }
        report.put("data", data);
        return report;
    }
    @Override
    public byte[] exportReportToExcel(String factoryId, String reportType, Map<String, Object> parameters) {
        log.info("导出Excel报表: factoryId={}, reportType={}", factoryId, reportType);
        try {
            // 解析日期参数
            LocalDate startDate = parameters.containsKey("startDate") ?
                    LocalDate.parse((String) parameters.get("startDate")) : LocalDate.now().minusDays(30);
            LocalDate endDate = parameters.containsKey("endDate") ?
                    LocalDate.parse((String) parameters.get("endDate")) : LocalDate.now();
            // 获取报表数据
            Map<String, Object> reportData = getCustomReport(factoryId, Map.of(
                    "reportType", reportType,
                    "startDate", startDate.toString(),
                    "endDate", endDate.toString()
            ));
            // 转换为Excel数据格式
            List<List<Object>> excelData = new ArrayList<>();
            // 添加标题行
            List<Object> headerRow = new ArrayList<>();
            headerRow.add("指标名称");
            headerRow.add("数值");
            excelData.add(headerRow);
            // 添加数据行
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) reportData.get("data");
            if (data != null) {
                for (Map.Entry<String, Object> entry : data.entrySet()) {
                    List<Object> row = new ArrayList<>();
                    row.add(entry.getKey());
                    row.add(entry.getValue() != null ? entry.getValue().toString() : "");
                    excelData.add(row);
                }
            }
            // 使用EasyExcel导出
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            EasyExcel.write(outputStream)
                    .registerWriteHandler(new LongestMatchColumnWidthStyleStrategy())
                    .sheet(reportType + "报表")
                    .doWrite(excelData);
            log.info("Excel导出成功: {} 行数据", excelData.size());
            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("Excel导出失败: {}", e.getMessage(), e);
            throw new RuntimeException("Excel导出失败: " + e.getMessage(), e);
        }
    }
    @Override
    public byte[] exportReportToPDF(String factoryId, String reportType, Map<String, Object> parameters) {
        log.info("导出PDF报表: factoryId={}, reportType={}", factoryId, reportType);

        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            // 创建PDF文档
            Document document = new Document(PageSize.A4, 50, 50, 50, 50);
            PdfWriter.getInstance(document, outputStream);
            document.open();

            // 创建中文字体
            BaseFont bfChinese = BaseFont.createFont("STSong-Light", "UniGB-UCS2-H", BaseFont.NOT_EMBEDDED);
            Font titleFont = new Font(bfChinese, 18, Font.BOLD);
            Font headerFont = new Font(bfChinese, 12, Font.BOLD);
            Font normalFont = new Font(bfChinese, 10, Font.NORMAL);
            Font smallFont = new Font(bfChinese, 8, Font.NORMAL);

            // 添加标题
            String title = getReportTitle(reportType);
            Paragraph titleParagraph = new Paragraph(title, titleFont);
            titleParagraph.setAlignment(Element.ALIGN_CENTER);
            titleParagraph.setSpacingAfter(20);
            document.add(titleParagraph);

            // 添加报表元信息
            Paragraph metaInfo = new Paragraph();
            metaInfo.setFont(smallFont);
            metaInfo.add("工厂ID: " + factoryId + "\n");
            metaInfo.add("生成时间: " + LocalDateTime.now().toString() + "\n");
            metaInfo.add("报表类型: " + reportType + "\n");
            metaInfo.setSpacingAfter(15);
            document.add(metaInfo);

            // 根据报表类型生成内容
            switch (reportType.toLowerCase()) {
                case "production":
                    generateProductionPdfContent(document, factoryId, parameters, headerFont, normalFont);
                    break;
                case "inventory":
                    generateInventoryPdfContent(document, factoryId, parameters, headerFont, normalFont);
                    break;
                case "quality":
                    generateQualityPdfContent(document, factoryId, parameters, headerFont, normalFont);
                    break;
                case "equipment":
                    generateEquipmentPdfContent(document, factoryId, parameters, headerFont, normalFont);
                    break;
                case "labor":
                    generateLaborPdfContent(document, factoryId, parameters, headerFont, normalFont);
                    break;
                case "dashboard":
                default:
                    generateDashboardPdfContent(document, factoryId, headerFont, normalFont);
                    break;
            }

            // 添加页脚
            Paragraph footer = new Paragraph();
            footer.setFont(smallFont);
            footer.add("\n\n---\n");
            footer.add("白垩纪食品溯源系统 - 自动生成报表");
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
            log.info("PDF导出成功: reportType={}", reportType);
            return outputStream.toByteArray();

        } catch (Exception e) {
            log.error("PDF导出失败: {}", e.getMessage(), e);
            throw new RuntimeException("PDF导出失败: " + e.getMessage(), e);
        }
    }

    /**
     * 获取报表标题
     */
    private String getReportTitle(String reportType) {
        switch (reportType.toLowerCase()) {
            case "production": return "生产报表";
            case "inventory": return "库存报表";
            case "quality": return "质量报表";
            case "equipment": return "设备报表";
            case "labor": return "工时报表";
            case "dashboard": return "综合统计报表";
            default: return "统计报表";
        }
    }

    /**
     * 生成仪表盘PDF内容
     */
    private void generateDashboardPdfContent(Document document, String factoryId, Font headerFont, Font normalFont) throws DocumentException {
        DashboardStatisticsDTO stats = getDashboardStatistics(factoryId);

        // 生产统计
        Paragraph prodHeader = new Paragraph("一、生产统计", headerFont);
        prodHeader.setSpacingBefore(10);
        prodHeader.setSpacingAfter(5);
        document.add(prodHeader);

        if (stats.getProductionStats() != null) {
            PdfPTable prodTable = new PdfPTable(2);
            prodTable.setWidthPercentage(80);
            addTableRow(prodTable, "活跃计划", String.valueOf(stats.getProductionStats().getActivePlans()), normalFont);
            addTableRow(prodTable, "完成计划", String.valueOf(stats.getProductionStats().getCompletedPlans()), normalFont);
            addTableRow(prodTable, "总产量", formatDecimal(stats.getProductionStats().getTotalOutput()) + " kg", normalFont);
            addTableRow(prodTable, "完成率", formatDecimal(BigDecimal.valueOf(stats.getProductionStats().getCompletionRate() != null ? stats.getProductionStats().getCompletionRate() : 0)) + "%", normalFont);
            document.add(prodTable);
        }

        // 库存统计
        Paragraph invHeader = new Paragraph("二、库存统计", headerFont);
        invHeader.setSpacingBefore(15);
        invHeader.setSpacingAfter(5);
        document.add(invHeader);

        if (stats.getInventoryStats() != null) {
            PdfPTable invTable = new PdfPTable(2);
            invTable.setWidthPercentage(80);
            addTableRow(invTable, "原料批次数", String.valueOf(stats.getInventoryStats().getTotalBatches()), normalFont);
            addTableRow(invTable, "物料种类", String.valueOf(stats.getInventoryStats().getTotalMaterials()), normalFont);
            addTableRow(invTable, "总价值", formatDecimal(stats.getInventoryStats().getTotalValue()) + " 元", normalFont);
            addTableRow(invTable, "即将过期批次", String.valueOf(stats.getInventoryStats().getExpiringBatches()), normalFont);
            document.add(invTable);
        }

        // 人员统计
        Paragraph personnelHeader = new Paragraph("三、人员统计", headerFont);
        personnelHeader.setSpacingBefore(15);
        personnelHeader.setSpacingAfter(5);
        document.add(personnelHeader);

        if (stats.getPersonnelStats() != null) {
            PdfPTable pTable = new PdfPTable(2);
            pTable.setWidthPercentage(80);
            addTableRow(pTable, "员工总数", String.valueOf(stats.getPersonnelStats().getTotalEmployees()), normalFont);
            addTableRow(pTable, "活跃员工", String.valueOf(stats.getPersonnelStats().getActiveEmployees()), normalFont);
            addTableRow(pTable, "今日出勤", String.valueOf(stats.getPersonnelStats().getTodayPresent()), normalFont);
            addTableRow(pTable, "出勤率", formatDecimal(BigDecimal.valueOf(stats.getPersonnelStats().getAttendanceRate() != null ? stats.getPersonnelStats().getAttendanceRate() : 0)) + "%", normalFont);
            document.add(pTable);
        }

        // 设备统计
        Paragraph equipHeader = new Paragraph("四、设备统计", headerFont);
        equipHeader.setSpacingBefore(15);
        equipHeader.setSpacingAfter(5);
        document.add(equipHeader);

        if (stats.getEquipmentStats() != null) {
            PdfPTable eqTable = new PdfPTable(2);
            eqTable.setWidthPercentage(80);
            addTableRow(eqTable, "设备总数", String.valueOf(stats.getEquipmentStats().getTotalEquipment()), normalFont);
            addTableRow(eqTable, "运行中", String.valueOf(stats.getEquipmentStats().getRunningEquipment()), normalFont);
            addTableRow(eqTable, "维护中", String.valueOf(stats.getEquipmentStats().getMaintenanceEquipment()), normalFont);
            addTableRow(eqTable, "设备利用率", formatDecimal(BigDecimal.valueOf(stats.getEquipmentStats().getUtilizationRate() != null ? stats.getEquipmentStats().getUtilizationRate() : 0)) + "%", normalFont);
            document.add(eqTable);
        }
    }

    /**
     * 生成生产报表PDF内容
     */
    private void generateProductionPdfContent(Document document, String factoryId, Map<String, Object> parameters,
                                              Font headerFont, Font normalFont) throws DocumentException {
        Paragraph header = new Paragraph("生产计划执行情况", headerFont);
        header.setSpacingAfter(10);
        document.add(header);

        // 获取生产数据
        LocalDate startDate = parameters.containsKey("startDate") ?
                (LocalDate) parameters.get("startDate") : LocalDate.now().minusDays(30);
        LocalDate endDate = parameters.containsKey("endDate") ?
                (LocalDate) parameters.get("endDate") : LocalDate.now();

        List<ProductionBatch> batches = productionBatchRepository.findByFactoryIdAndCreatedAtBetween(
                factoryId, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay());

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{2, 3, 2, 2});

        // 表头
        addTableHeader(table, new String[]{"批次号", "产品类型", "计划数量", "实际数量"}, normalFont);

        // 数据行
        for (ProductionBatch batch : batches) {
            addTableCell(table, batch.getBatchNumber() != null ? batch.getBatchNumber() : "-", normalFont);
            addTableCell(table, batch.getProductName() != null ? batch.getProductName() : "-", normalFont);
            addTableCell(table, formatDecimal(batch.getPlannedQuantity()), normalFont);
            addTableCell(table, formatDecimal(batch.getActualQuantity()), normalFont);
        }

        document.add(table);
    }

    /**
     * 生成库存报表PDF内容
     */
    private void generateInventoryPdfContent(Document document, String factoryId, Map<String, Object> parameters,
                                             Font headerFont, Font normalFont) throws DocumentException {
        Paragraph header = new Paragraph("库存状况报表", headerFont);
        header.setSpacingAfter(10);
        document.add(header);

        List<MaterialBatch> batches = materialBatchRepository.findByFactoryIdAndStatus(factoryId, MaterialBatchStatus.AVAILABLE);

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{2, 3, 2, 2});

        addTableHeader(table, new String[]{"批次号", "物料类型", "当前库存", "过期日期"}, normalFont);

        for (MaterialBatch batch : batches) {
            addTableCell(table, batch.getBatchNumber() != null ? batch.getBatchNumber() : "-", normalFont);
            // MaterialBatch uses materialType relationship or materialTypeId
            String materialTypeName = batch.getMaterialType() != null ? batch.getMaterialType().getName() : (batch.getMaterialTypeId() != null ? batch.getMaterialTypeId() : "-");
            addTableCell(table, materialTypeName, normalFont);
            addTableCell(table, formatDecimal(batch.getCurrentQuantity()), normalFont);
            addTableCell(table, batch.getExpireDate() != null ? batch.getExpireDate().toString() : "-", normalFont);
        }

        document.add(table);
    }

    /**
     * 生成质量报表PDF内容
     */
    private void generateQualityPdfContent(Document document, String factoryId, Map<String, Object> parameters,
                                           Font headerFont, Font normalFont) throws DocumentException {
        Paragraph header = new Paragraph("质量检验报表", headerFont);
        header.setSpacingAfter(10);
        document.add(header);

        // 质量统计概览
        long totalInspections = qualityInspectionRepository.countByFactoryId(factoryId);
        long passedCount = qualityInspectionRepository.countByFactoryIdAndResult(factoryId, "PASS");
        double passRate = totalInspections > 0 ? (passedCount * 100.0 / totalInspections) : 0;

        PdfPTable summaryTable = new PdfPTable(2);
        summaryTable.setWidthPercentage(60);
        addTableRow(summaryTable, "总检验次数", String.valueOf(totalInspections), normalFont);
        addTableRow(summaryTable, "合格次数", String.valueOf(passedCount), normalFont);
        addTableRow(summaryTable, "合格率", String.format("%.2f%%", passRate), normalFont);

        document.add(summaryTable);
    }

    /**
     * 生成设备报表PDF内容
     */
    private void generateEquipmentPdfContent(Document document, String factoryId, Map<String, Object> parameters,
                                             Font headerFont, Font normalFont) throws DocumentException {
        Paragraph header = new Paragraph("设备运行报表", headerFont);
        header.setSpacingAfter(10);
        document.add(header);

        List<FactoryEquipment> equipments = equipmentRepository.findByFactoryId(factoryId);

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{2, 2, 2, 2});

        addTableHeader(table, new String[]{"设备名称", "设备类型", "状态", "运行时长"}, normalFont);

        for (FactoryEquipment eq : equipments) {
            addTableCell(table, eq.getEquipmentName() != null ? eq.getEquipmentName() : "-", normalFont);
            addTableCell(table, eq.getType() != null ? eq.getType() : "-", normalFont);
            addTableCell(table, eq.getStatus() != null ? eq.getStatus() : "-", normalFont);
            addTableCell(table, eq.getTotalRunningHours() != null ? eq.getTotalRunningHours() + "h" : "-", normalFont);
        }

        document.add(table);
    }

    /**
     * 生成工时报表PDF内容
     */
    private void generateLaborPdfContent(Document document, String factoryId, Map<String, Object> parameters,
                                         Font headerFont, Font normalFont) throws DocumentException {
        Paragraph header = new Paragraph("工时统计报表", headerFont);
        header.setSpacingAfter(10);
        document.add(header);

        LocalDate startDate = parameters.containsKey("startDate") ?
                (LocalDate) parameters.get("startDate") : LocalDate.now().minusDays(7);
        LocalDate endDate = parameters.containsKey("endDate") ?
                (LocalDate) parameters.get("endDate") : LocalDate.now();

        List<TimeClockRecord> records = timeClockRecordRepository.findByFactoryIdAndClockDateBetween(
                factoryId, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay());

        // 统计汇总
        int totalRecords = records.size();
        int totalMinutes = records.stream()
                .mapToInt(r -> r.getWorkDurationMinutes() != null ? r.getWorkDurationMinutes() : 0)
                .sum();

        PdfPTable summaryTable = new PdfPTable(2);
        summaryTable.setWidthPercentage(60);
        addTableRow(summaryTable, "统计周期", startDate + " 至 " + endDate, normalFont);
        addTableRow(summaryTable, "打卡记录数", String.valueOf(totalRecords), normalFont);
        addTableRow(summaryTable, "总工时", String.format("%.2f 小时", totalMinutes / 60.0), normalFont);

        document.add(summaryTable);
    }

    /**
     * 添加表格行
     */
    private void addTableRow(PdfPTable table, String label, String value, Font font) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, font));
        labelCell.setBackgroundColor(new BaseColor(240, 240, 240));
        labelCell.setPadding(5);
        table.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Phrase(value, font));
        valueCell.setPadding(5);
        table.addCell(valueCell);
    }

    /**
     * 添加表格表头
     */
    private void addTableHeader(PdfPTable table, String[] headers, Font font) {
        for (String header : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(header, font));
            cell.setBackgroundColor(new BaseColor(200, 200, 200));
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            cell.setPadding(5);
            table.addCell(cell);
        }
    }

    /**
     * 添加表格单元格
     */
    private void addTableCell(PdfPTable table, String value, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(value, font));
        cell.setPadding(3);
        table.addCell(cell);
    }

    /**
     * 格式化小数
     */
    private String formatDecimal(BigDecimal value) {
        return value != null ? value.setScale(2, RoundingMode.HALF_UP).toString() : "0.00";
    }
    @Override
    public Map<String, Object> getRealTimeProductionData(String factoryId) {
        log.info("获取实时生产数据: factoryId={}", factoryId);
        Map<String, Object> data = new HashMap<>();
        // 当前运行的生产计划
        long runningPlans = productionPlanRepository.countByFactoryIdAndStatus(
                factoryId, ProductionPlanStatus.IN_PROGRESS);
        data.put("runningPlans", runningPlans);
        // 今日产量
        BigDecimal todayOutput = productionPlanRepository.calculateOutputBetweenDates(
                factoryId, LocalDate.now().atStartOfDay(), LocalDate.now().atTime(23, 59, 59));
        data.put("todayOutput", todayOutput != null ? todayOutput : BigDecimal.ZERO);
        // 设备状态
        List<Object[]> equipmentStatus = equipmentRepository.countByStatus(factoryId);
        Map<String, Long> statusMap = new HashMap<>();
        for (Object[] row : equipmentStatus) {
            statusMap.put((String) row[0], (Long) row[1]);
        }
        data.put("equipmentStatus", statusMap);
        return data;
    }
    @Override
    public Map<String, Object> getKPIMetrics(String factoryId, LocalDate date) {
        log.info("获取KPI指标: factoryId={}, date={}", factoryId, date);
        Map<String, Object> kpi = new HashMap<>();
        // 生产KPI
        kpi.put("productionEfficiency", 85.0);
        kpi.put("qualityRate", 98.0);
        kpi.put("deliveryOnTime", 95.0);
        // 成本KPI
        kpi.put("costReduction", 5.0);
        kpi.put("inventoryTurnover", 4.5);
        // 设备KPI
        kpi.put("equipmentOEE", 75.0);
        kpi.put("maintenanceCompliance", 90.0);
        // 人员KPI
        kpi.put("laborProductivity", 88.0);
        kpi.put("safetyIncidents", 0);
        return kpi;
    }
    @Override
    public Map<String, Object> getComparativeAnalysis(String factoryId, LocalDate period1Start, LocalDate period1End,
                                                     LocalDate period2Start, LocalDate period2End) {
        log.info("获取对比分析: factoryId={}", factoryId);
        Map<String, Object> analysis = new HashMap<>();
        // 期间1数据
        Map<String, Object> period1 = new HashMap<>();
        BigDecimal output1 = productionPlanRepository.calculateOutputBetweenDates(
                factoryId, period1Start.atStartOfDay(), period1End.atTime(23, 59, 59));
        BigDecimal cost1 = productionPlanRepository.calculateTotalCostBetweenDates(
                factoryId, period1Start.atStartOfDay(), period1End.atTime(23, 59, 59));
        period1.put("output", output1 != null ? output1 : BigDecimal.ZERO);
        period1.put("cost", cost1 != null ? cost1 : BigDecimal.ZERO);
        analysis.put("period1", period1);
        // 期间2数据
        Map<String, Object> period2 = new HashMap<>();
        BigDecimal output2 = productionPlanRepository.calculateOutputBetweenDates(
                factoryId, period2Start.atStartOfDay(), period2End.atTime(23, 59, 59));
        BigDecimal cost2 = productionPlanRepository.calculateTotalCostBetweenDates(
                factoryId, period2Start.atStartOfDay(), period2End.atTime(23, 59, 59));
        period2.put("output", output2 != null ? output2 : BigDecimal.ZERO);
        period2.put("cost", cost2 != null ? cost2 : BigDecimal.ZERO);
        analysis.put("period2", period2);
        // 变化率
        Map<String, Double> changeRate = new HashMap<>();
        if (output1 != null && output1.compareTo(BigDecimal.ZERO) > 0) {
            changeRate.put("outputChange",
                    output2.subtract(output1).divide(output1, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)).doubleValue());
        }
        if (cost1 != null && cost1.compareTo(BigDecimal.ZERO) > 0) {
            changeRate.put("costChange",
                    cost2.subtract(cost1).divide(cost1, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)).doubleValue());
        }
        analysis.put("changeRate", changeRate);
        return analysis;
    }
    @Override
    public Map<String, Object> getForecastReport(String factoryId, Integer forecastDays) {
        log.info("获取预测分析: factoryId={}, forecastDays={}", factoryId, forecastDays);
        Map<String, Object> forecast = new HashMap<>();
        forecast.put("forecastDays", forecastDays);
        // 基于历史数据预测（使用过去30天数据）
        LocalDate today = LocalDate.now();
        LocalDate historyStart = today.minusDays(30);
        int historyDays = 30;
        // 1. 历史产量统计
        BigDecimal historyOutput = productionPlanRepository.calculateOutputBetweenDates(
                factoryId, historyStart.atStartOfDay(), today.atStartOfDay());
        BigDecimal avgDailyProduction = BigDecimal.ZERO;
        if (historyOutput != null && historyOutput.compareTo(BigDecimal.ZERO) > 0) {
            avgDailyProduction = historyOutput.divide(BigDecimal.valueOf(historyDays), 2, RoundingMode.HALF_UP);
        }
        BigDecimal expectedProduction = avgDailyProduction.multiply(BigDecimal.valueOf(forecastDays));
        forecast.put("expectedProduction", expectedProduction);
        forecast.put("avgDailyProduction", avgDailyProduction);
        // 2. 历史收入统计
        BigDecimal historyRevenue = shipmentRecordRepository.calculateTotalRevenue(factoryId, historyStart, today);
        BigDecimal avgDailyRevenue = BigDecimal.ZERO;
        if (historyRevenue != null && historyRevenue.compareTo(BigDecimal.ZERO) > 0) {
            avgDailyRevenue = historyRevenue.divide(BigDecimal.valueOf(historyDays), 2, RoundingMode.HALF_UP);
        }
        BigDecimal expectedRevenue = avgDailyRevenue.multiply(BigDecimal.valueOf(forecastDays));
        forecast.put("expectedRevenue", expectedRevenue);
        forecast.put("avgDailyRevenue", avgDailyRevenue);
        // 3. 历史成本统计
        BigDecimal historyCost = productionPlanRepository.calculateTotalCostBetweenDates(
                factoryId, historyStart.atStartOfDay(), today.atStartOfDay());
        BigDecimal avgDailyCost = BigDecimal.ZERO;
        if (historyCost != null && historyCost.compareTo(BigDecimal.ZERO) > 0) {
            avgDailyCost = historyCost.divide(BigDecimal.valueOf(historyDays), 2, RoundingMode.HALF_UP);
        }
        BigDecimal expectedCost = avgDailyCost.multiply(BigDecimal.valueOf(forecastDays));
        forecast.put("expectedCost", expectedCost);
        forecast.put("avgDailyCost", avgDailyCost);
        // 4. 预期利润
        BigDecimal expectedProfit = expectedRevenue.subtract(expectedCost);
        forecast.put("expectedProfit", expectedProfit);
        // 5. 利润率预测
        double profitMargin = 0.0;
        if (expectedRevenue.compareTo(BigDecimal.ZERO) > 0) {
            profitMargin = expectedProfit.divide(expectedRevenue, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).doubleValue();
        }
        forecast.put("profitMargin", profitMargin);
        // 6. 增长趋势（与前30天对比）
        LocalDate prevStart = historyStart.minusDays(30);
        BigDecimal prevOutput = productionPlanRepository.calculateOutputBetweenDates(
                factoryId, prevStart.atStartOfDay(), historyStart.atStartOfDay());
        double productionGrowth = 0.0;
        if (prevOutput != null && prevOutput.compareTo(BigDecimal.ZERO) > 0 && historyOutput != null) {
            productionGrowth = historyOutput.subtract(prevOutput)
                    .divide(prevOutput, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).doubleValue();
        }
        forecast.put("productionGrowth", productionGrowth);
        // 7. 置信度（基于数据充足程度）
        long dataPoints = productionPlanRepository.countByFactoryIdAndCreatedAtBetween(
                factoryId, historyStart.atStartOfDay(), today.atStartOfDay());
        double confidence = Math.min(100.0, dataPoints * 3.3); // 30个数据点达到100%置信度
        forecast.put("confidence", confidence);
        return forecast;
    }
    @Override
    public Map<String, Object> getAnomalyReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取异常分析(AI增强): factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> report = new HashMap<>();
        List<Map<String, Object>> anomalies = new ArrayList<>();

        // 1. 收集多维度数据用于异常检测
        Map<String, Object> dataContext = new HashMap<>();

        // 1.1 生产数据异常检测
        BigDecimal totalOutput = productionPlanRepository.calculateOutputBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        BigDecimal totalCost = productionPlanRepository.calculateTotalCostBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        dataContext.put("totalOutput", totalOutput != null ? totalOutput : BigDecimal.ZERO);
        dataContext.put("totalCost", totalCost != null ? totalCost : BigDecimal.ZERO);

        // 1.2 库存异常
        List<MaterialBatch> expiringBatches = materialBatchRepository.findExpiringBatches(
                factoryId, LocalDate.now().plusDays(7));
        List<MaterialBatch> expiredBatches = materialBatchRepository.findExpiredBatches(factoryId);
        List<Object> lowStockItems = materialBatchRepository.findLowStockMaterials(factoryId);

        dataContext.put("expiringBatches", expiringBatches.size());
        dataContext.put("expiredBatches", expiredBatches.size());
        dataContext.put("lowStockItems", lowStockItems.size());

        // 1.3 设备异常
        List<FactoryEquipment> needsMaintenance = equipmentRepository.findEquipmentNeedingMaintenance(
                factoryId, LocalDate.now());
        dataContext.put("equipmentNeedingMaintenance", needsMaintenance.size());

        // 2. 基于规则的异常检测
        if (!expiringBatches.isEmpty()) {
            anomalies.add(Map.of(
                "type", "INVENTORY",
                "level", "WARNING",
                "title", "原材料即将过期",
                "description", String.format("有%d个批次将在7天内过期", expiringBatches.size()),
                "count", expiringBatches.size(),
                "detectedAt", LocalDate.now().toString()
            ));
        }

        if (!expiredBatches.isEmpty()) {
            anomalies.add(Map.of(
                "type", "INVENTORY",
                "level", "CRITICAL",
                "title", "已过期原材料",
                "description", String.format("有%d个批次已过期，需要立即处理", expiredBatches.size()),
                "count", expiredBatches.size(),
                "detectedAt", LocalDate.now().toString()
            ));
        }

        if (!needsMaintenance.isEmpty()) {
            anomalies.add(Map.of(
                "type", "EQUIPMENT",
                "level", "INFO",
                "title", "设备维护提醒",
                "description", String.format("有%d台设备需要维护", needsMaintenance.size()),
                "count", needsMaintenance.size(),
                "detectedAt", LocalDate.now().toString()
            ));
        }

        // 3. 调用AI进行智能异常分析
        try {
            String aiMessage = String.format(
                "分析以下工厂数据，识别潜在的异常和风险：\n" +
                "- 期间：%s 至 %s\n" +
                "- 总产量：%.2f\n" +
                "- 总成本：%.2f\n" +
                "- 即将过期批次：%d个\n" +
                "- 已过期批次：%d个\n" +
                "- 低库存项目：%d个\n" +
                "- 需维护设备：%d台\n" +
                "请识别异常模式，分析潜在风险，并提供预警建议。",
                startDate, endDate,
                dataContext.get("totalOutput"),
                dataContext.get("totalCost"),
                expiringBatches.size(),
                expiredBatches.size(),
                lowStockItems.size(),
                needsMaintenance.size()
            );

            Map<String, Object> aiResult = aiAnalysisService.analyzeCost(
                factoryId, "anomaly_detection", dataContext, null, aiMessage
            );

            if (Boolean.TRUE.equals(aiResult.get("success"))) {
                report.put("aiAnalysis", aiResult.get("aiAnalysis"));
                report.put("reasoningContent", aiResult.get("reasoningContent"));
                report.put("analysisMethod", "AI Enhanced Detection");
            }
        } catch (Exception e) {
            log.warn("AI异常检测服务暂时不可用，使用规则检测: {}", e.getMessage());
            report.put("analysisMethod", "Rule-based Detection (AI Fallback)");
        }

        report.put("anomalies", anomalies);
        report.put("totalAnomalies", anomalies.size());
        report.put("period", Map.of("startDate", startDate.toString(), "endDate", endDate.toString()));
        report.put("dataContext", dataContext);

        return report;
    }
    @Override
    public Map<String, Object> getEquipmentReport(String factoryId, LocalDate date) {
        log.info("获取设备报表: factoryId={}, date={}", factoryId, date);
        Map<String, Object> report = new HashMap<>();
        // 设备总数
        long totalEquipment = equipmentRepository.countByFactoryId(factoryId);
        report.put("totalEquipment", totalEquipment);
        // 设备状态统计
        List<Object[]> statusCount = equipmentRepository.countByStatus(factoryId);
        Map<String, Long> statusDistribution = new HashMap<>();
        for (Object[] row : statusCount) {
            statusDistribution.put(row[0].toString(), (Long) row[1]);
        }
        report.put("statusDistribution", statusDistribution);
        // 需要维护的设备
        List<FactoryEquipment> needsMaintenance = equipmentRepository.findEquipmentNeedingMaintenance(factoryId, LocalDate.now());
        report.put("maintenanceRequired", needsMaintenance.size());
        return report;
    }
    @Override
    public Map<String, Object> getPersonnelReport(String factoryId, LocalDate date) {
        log.info("获取人员报表: factoryId={}, date={}", factoryId, date);
        Map<String, Object> report = new HashMap<>();
        // 人员总数
        long totalUsers = userRepository.countByFactoryId(factoryId);
        report.put("totalUsers", totalUsers);
        // 活跃用户数
        long activeUsers = userRepository.countActiveUsers(factoryId);
        report.put("activeUsers", activeUsers);
        // 按部门统计
        List<Object[]> departmentStats = userRepository.countByDepartment(factoryId);
        Map<String, Long> departmentDistribution = new HashMap<>();
        for (Object[] row : departmentStats) {
            if (row[0] != null) {
                departmentDistribution.put(row[0].toString(), (Long) row[1]);
            }
        }
        report.put("departmentDistribution", departmentDistribution);
        return report;
    }
    @Override
    public Map<String, Object> getEfficiencyAnalysisReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取效率分析报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> report = new HashMap<>();
        // 生产效率 - 暂时注释 - 数据库表中没有planned_date字段
        // long totalPlans = productionPlanRepository.countByFactoryIdAndDateRange(factoryId, startDate, endDate);
        // long completedPlans = productionPlanRepository.countByFactoryIdAndStatusAndDateRange(
        //         factoryId, ProductionPlanStatus.COMPLETED, startDate, endDate);
        // double completionRate = totalPlans > 0 ? (completedPlans * 100.0 / totalPlans) : 0.0;
        // report.put("completionRate", completionRate);
        // 产量效率
        BigDecimal totalOutput = productionPlanRepository.calculateOutputBetweenDates(
                factoryId, startDate.atStartOfDay(), endDate.atTime(23, 59, 59));
        report.put("totalOutput", totalOutput != null ? totalOutput : BigDecimal.ZERO);
        // 设备效率
        report.put("equipmentOEE", 75.0);
        return report;
    }
    @Override
    public Map<String, Object> getTrendAnalysisReport(String factoryId, String type, Integer period) {
        log.info("获取趋势分析报表: factoryId={}, type={}, period={}", factoryId, type, period);
        Map<String, Object> report = new HashMap<>();
        List<Map<String, Object>> trendData = new ArrayList<>();
        for (int i = period - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            Map<String, Object> dataPoint = new HashMap<>();
            dataPoint.put("date", date);
            switch (type) {
                case "production":
                    BigDecimal output = productionPlanRepository.calculateOutputBetweenDates(
                            factoryId, date.atStartOfDay(), date.atTime(23, 59, 59));
                    dataPoint.put("value", output != null ? output : BigDecimal.ZERO);
                    break;
                case "cost":
                    BigDecimal cost = productionPlanRepository.calculateTotalCostBetweenDates(
                            factoryId, date.atStartOfDay(), date.atTime(23, 59, 59));
                    dataPoint.put("value", cost != null ? cost : BigDecimal.ZERO);
                    break;
                default:
                    dataPoint.put("value", BigDecimal.ZERO);
            }
            trendData.add(dataPoint);
        }
        report.put("type", type);
        report.put("period", period);
        report.put("trendData", trendData);
        return report;
    }
    @Override
    public Map<String, Object> getPeriodComparisonReport(String factoryId, LocalDate period1Start, LocalDate period1End,
                                                         LocalDate period2Start, LocalDate period2End) {
        log.info("获取周期对比报表: factoryId={}, period1={}-{}, period2={}-{}",
                factoryId, period1Start, period1End, period2Start, period2End);
        Map<String, Object> report = new HashMap<>();
        // 期间1数据
        BigDecimal output1 = productionPlanRepository.calculateOutputBetweenDates(
                factoryId, period1Start.atStartOfDay(), period1End.atTime(23, 59, 59));
        BigDecimal cost1 = productionPlanRepository.calculateTotalCostBetweenDates(
                factoryId, period1Start.atStartOfDay(), period1End.atTime(23, 59, 59));
        Map<String, Object> period1Data = new HashMap<>();
        period1Data.put("output", output1 != null ? output1 : BigDecimal.ZERO);
        period1Data.put("cost", cost1 != null ? cost1 : BigDecimal.ZERO);
        report.put("period1", period1Data);
        // 期间2数据
        BigDecimal output2 = productionPlanRepository.calculateOutputBetweenDates(
                factoryId, period2Start.atStartOfDay(), period2End.atTime(23, 59, 59));
        BigDecimal cost2 = productionPlanRepository.calculateTotalCostBetweenDates(
                factoryId, period2Start.atStartOfDay(), period2End.atTime(23, 59, 59));
        Map<String, Object> period2Data = new HashMap<>();
        period2Data.put("output", output2 != null ? output2 : BigDecimal.ZERO);
        period2Data.put("cost", cost2 != null ? cost2 : BigDecimal.ZERO);
        report.put("period2", period2Data);
        // 计算变化率
        Map<String, Object> comparison = new HashMap<>();
        if (output1 != null && output1.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal outputChange = output2.subtract(output1).divide(output1, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
            comparison.put("outputChangeRate", outputChange);
        } else {
            comparison.put("outputChangeRate", BigDecimal.ZERO);
        }
        if (cost1 != null && cost1.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal costChange = cost2.subtract(cost1).divide(cost1, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
            comparison.put("costChangeRate", costChange);
        } else {
            comparison.put("costChangeRate", BigDecimal.ZERO);
        }
        report.put("comparison", comparison);
        return report;
    }
    @Override
    public Map<String, Object> getForecastReport(String factoryId, String type, Integer days) {
        log.info("获取预测报表(AI增强): factoryId={}, type={}, days={}", factoryId, type, days);
        Map<String, Object> report = new HashMap<>();

        // 1. 收集历史数据
        LocalDate today = LocalDate.now();
        int historicalDays = 30;
        List<Map<String, Object>> historicalData = new ArrayList<>();
        BigDecimal totalHistorical = BigDecimal.ZERO;

        for (int i = historicalDays - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            BigDecimal value = BigDecimal.ZERO;
            if ("production".equals(type)) {
                value = productionPlanRepository.calculateOutputBetweenDates(
                        factoryId, date.atStartOfDay(), date.atTime(23, 59, 59));
            } else if ("cost".equals(type)) {
                value = productionPlanRepository.calculateTotalCostBetweenDates(
                        factoryId, date.atStartOfDay(), date.atTime(23, 59, 59));
            }
            if (value == null) value = BigDecimal.ZERO;
            totalHistorical = totalHistorical.add(value);

            Map<String, Object> dataPoint = new HashMap<>();
            dataPoint.put("date", date.toString());
            dataPoint.put("value", value);
            historicalData.add(dataPoint);
        }

        // 2. 计算基础统计量
        BigDecimal dailyAverage = totalHistorical.divide(BigDecimal.valueOf(historicalDays), 2, RoundingMode.HALF_UP);

        // 3. 调用AI服务进行智能预测分析
        try {
            Map<String, Object> aiContext = new HashMap<>();
            aiContext.put("factoryId", factoryId);
            aiContext.put("forecastType", type);
            aiContext.put("forecastDays", days);
            aiContext.put("historicalData", historicalData);
            aiContext.put("dailyAverage", dailyAverage);
            aiContext.put("totalHistorical", totalHistorical);

            String aiMessage = String.format(
                "基于以下%d天的历史数据进行%s预测分析，预测未来%d天的趋势：\n" +
                "- 历史数据总计：%.2f\n" +
                "- 日均值：%.2f\n" +
                "请分析数据趋势，识别周期性规律，并给出预测建议。",
                historicalDays, "production".equals(type) ? "产量" : "成本", days,
                totalHistorical.doubleValue(), dailyAverage.doubleValue()
            );

            Map<String, Object> aiResult = aiAnalysisService.analyzeCost(
                factoryId, "forecast_" + type, aiContext, null, aiMessage
            );

            if (Boolean.TRUE.equals(aiResult.get("success"))) {
                report.put("aiAnalysis", aiResult.get("aiAnalysis"));
                report.put("reasoningContent", aiResult.get("reasoningContent"));
                report.put("method", "AI Enhanced Forecast");
            }
        } catch (Exception e) {
            log.warn("AI预测服务暂时不可用，使用基础预测: {}", e.getMessage());
            report.put("method", "Linear Average (AI Fallback)");
        }

        // 4. 生成预测数据（基础统计 + AI优化）
        List<Map<String, Object>> forecastData = new ArrayList<>();
        for (int i = 1; i <= days; i++) {
            Map<String, Object> forecast = new HashMap<>();
            forecast.put("date", today.plusDays(i).toString());
            forecast.put("value", dailyAverage);
            forecast.put("confidence", 75);
            forecastData.add(forecast);
        }

        report.put("type", type);
        report.put("forecastDays", days);
        report.put("forecastData", forecastData);
        report.put("historicalSummary", Map.of(
            "days", historicalDays,
            "total", totalHistorical,
            "average", dailyAverage
        ));

        return report;
    }
    @Override
    public void exportReportAsExcel(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                                    javax.servlet.http.HttpServletResponse response) {
        log.info("导出Excel报表: factoryId={}, type={}, startDate={}, endDate={}",
                factoryId, reportType, startDate, endDate);
        // 这里需要使用Apache POI等库来生成Excel文件
        try {
            response.setContentType("application/vnd.ms-excel");
            response.setHeader("Content-Disposition", "attachment; filename=report.xlsx");
            response.getWriter().write("Excel export not yet implemented");
        } catch (Exception e) {
            log.error("导出Excel失败", e);
        }
    }
    @Override
    public void exportReportAsPdf(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                                  javax.servlet.http.HttpServletResponse response) {
        log.info("导出PDF报表: factoryId={}, type={}, startDate={}, endDate={}",
                factoryId, reportType, startDate, endDate);
        // 这里需要使用iText等库来生成PDF文件
        try {
            response.setContentType("application/pdf");
            response.setHeader("Content-Disposition", "attachment; filename=report.pdf");
            response.getWriter().write("PDF export not yet implemented");
        } catch (Exception e) {
            log.error("导出PDF失败", e);
        }
    }
    @Override
    public Map<String, Object> getRealtimeData(String factoryId) {
        return getRealTimeProductionData(factoryId);
    }

    // ==================== Dashboard 委托方法 (集成 ProcessingService) ====================

    @Override
    public Map<String, Object> getDashboardOverview(String factoryId, String period) {
        log.info("获取生产概览Dashboard (委托ProcessingService): factoryId={}, period={}", factoryId, period);
        return processingService.getDashboardOverview(factoryId);
    }

    @Override
    public Map<String, Object> getProductionDashboard(String factoryId, String period) {
        log.info("获取生产统计Dashboard (委托ProcessingService): factoryId={}, period={}", factoryId, period);
        return processingService.getProductionStatistics(factoryId, period);
    }

    @Override
    public Map<String, Object> getQualityDashboard(String factoryId) {
        log.info("获取质量Dashboard (委托ProcessingService): factoryId={}", factoryId);
        return processingService.getQualityDashboard(factoryId);
    }

    @Override
    public Map<String, Object> getEquipmentDashboard(String factoryId) {
        log.info("获取设备Dashboard (委托ProcessingService): factoryId={}", factoryId);
        return processingService.getEquipmentDashboard(factoryId);
    }

    @Override
    public Map<String, Object> getAlertsDashboard(String factoryId, String period) {
        log.info("获取告警Dashboard (委托ProcessingService): factoryId={}, period={}", factoryId, period);
        return processingService.getAlertsDashboard(factoryId);
    }

    @Override
    public Map<String, Object> getTrendsDashboard(String factoryId, String period, String metric, Integer days) {
        log.info("获取趋势Dashboard (委托ProcessingService): factoryId={}, period={}, metric={}, days={}",
                factoryId, period, metric, days);
        return processingService.getTrendAnalysis(factoryId, metric, days);
    }

    // ==================== 生产统计报表 ====================

    @Override
    @Cacheable(value = "productionByProduct", key = "#factoryId + '_' + #startDate + '_' + #endDate", unless = "#result == null || #result.isEmpty()")
    public List<ProductionByProductDTO> getProductionByProduct(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("按产品统计生产数量: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        // 默认时间范围：如果未提供日期，默认查询本周数据
        LocalDate effectiveStartDate = startDate;
        LocalDate effectiveEndDate = endDate;

        if (effectiveStartDate == null || effectiveEndDate == null) {
            LocalDate today = LocalDate.now();
            // 获取本周一作为开始日期
            effectiveStartDate = today.with(java.time.DayOfWeek.MONDAY);
            // 今天作为结束日期
            effectiveEndDate = today;
        }

        // 转换为LocalDateTime (开始日期的00:00:00，结束日期的下一天00:00:00)
        LocalDateTime startTime = effectiveStartDate.atStartOfDay();
        LocalDateTime endTime = effectiveEndDate.plusDays(1).atStartOfDay();

        // 查询数据库
        List<Object[]> results = productionBatchRepository.findProductionByProduct(factoryId, startTime, endTime);

        // 转换为DTO列表
        List<ProductionByProductDTO> dtoList = new ArrayList<>();
        for (Object[] row : results) {
            String productTypeId = (String) row[0];
            String productName = (String) row[1];
            BigDecimal totalQuantity = (BigDecimal) row[2];
            String unit = (String) row[3];

            // 处理空产品名称的情况
            if (productName == null || productName.isEmpty()) {
                productName = "未知产品";
            }

            ProductionByProductDTO dto = ProductionByProductDTO.builder()
                    .productTypeId(productTypeId)
                    .productName(productName)
                    .totalQuantity(totalQuantity != null ? totalQuantity : BigDecimal.ZERO)
                    .unit(unit != null ? unit : "kg")
                    .build();
            dtoList.add(dto);
        }

        log.info("按产品统计完成: factoryId={}, 产品数量={}", factoryId, dtoList.size());
        return dtoList;
    }

    // ==================== 新增报表方法 (2026-01-14) ====================

    @Override
    @Cacheable(value = "oeeReport", key = "#factoryId + '_' + #startDate + '_' + #endDate", unless = "#result == null")
    public com.cretas.aims.dto.report.OeeReportDTO getOeeReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取OEE报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        // 转换为时间范围
        LocalDateTime startTime = startDate.atStartOfDay();
        LocalDateTime endTime = endDate.plusDays(1).atStartOfDay();

        // 1. 获取生产批次数据
        List<ProductionBatch> batches = productionBatchRepository.findByFactoryIdAndCreatedAtBetween(
                factoryId, startTime, endTime);

        // 2. 计算核心OEE指标
        BigDecimal totalPlannedQuantity = BigDecimal.ZERO;
        BigDecimal totalActualQuantity = BigDecimal.ZERO;
        BigDecimal totalGoodQuantity = BigDecimal.ZERO;
        long totalBatches = batches.size();

        for (ProductionBatch batch : batches) {
            if (batch.getPlannedQuantity() != null) {
                totalPlannedQuantity = totalPlannedQuantity.add(batch.getPlannedQuantity());
            }
            if (batch.getActualQuantity() != null) {
                totalActualQuantity = totalActualQuantity.add(batch.getActualQuantity());
            }
            // 假设良品率为95%（实际应从质检数据获取）
            if (batch.getActualQuantity() != null) {
                totalGoodQuantity = totalGoodQuantity.add(
                        batch.getActualQuantity().multiply(new BigDecimal("0.95")));
            }
        }

        // 3. 获取设备运行数据
        List<FactoryEquipment> equipments = equipmentRepository.findByFactoryId(factoryId);
        long totalRunningHours = 0;
        long totalEquipment = equipments.size();

        for (FactoryEquipment eq : equipments) {
            if (eq.getTotalRunningHours() != null) {
                totalRunningHours += eq.getTotalRunningHours();
            }
        }

        // 4. 计算 OEE 三要素
        // 可用性 = 实际运行时间 / 计划运行时间 (假设每天8小时工作制)
        long plannedHours = (long) ChronoUnit.DAYS.between(startDate, endDate) * 8 * totalEquipment;
        BigDecimal availability = plannedHours > 0 ?
                new BigDecimal(totalRunningHours).divide(new BigDecimal(plannedHours), 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : new BigDecimal("80");

        // 表现性 = 实际产量 / 理论产量
        BigDecimal performance = totalPlannedQuantity.compareTo(BigDecimal.ZERO) > 0 ?
                totalActualQuantity.divide(totalPlannedQuantity, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : new BigDecimal("85");

        // 质量率 = 良品数 / 总产量
        BigDecimal quality = totalActualQuantity.compareTo(BigDecimal.ZERO) > 0 ?
                totalGoodQuantity.divide(totalActualQuantity, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : new BigDecimal("95");

        // OEE = 可用性 × 表现性 × 质量率 / 10000
        BigDecimal oee = availability.multiply(performance).multiply(quality)
                .divide(new BigDecimal("10000"), 2, RoundingMode.HALF_UP);

        // 5. 构建报表DTO
        return com.cretas.aims.dto.report.OeeReportDTO.builder()
                .factoryId(factoryId)
                .startDate(startDate)
                .endDate(endDate)
                .oeeValue(oee)
                .oeeGrade(com.cretas.aims.dto.report.OeeReportDTO.calculateGrade(oee))
                .availability(availability.setScale(2, RoundingMode.HALF_UP))
                .performance(performance.setScale(2, RoundingMode.HALF_UP))
                .quality(quality.setScale(2, RoundingMode.HALF_UP))
                .plannedProductionTime(plannedHours * 60) // 转为分钟
                .actualRunTime(totalRunningHours * 60)
                .downtime((plannedHours - totalRunningHours) * 60)
                .totalOutput(totalActualQuantity)
                .goodOutput(totalGoodQuantity.setScale(2, RoundingMode.HALF_UP))
                .defectOutput(totalActualQuantity.subtract(totalGoodQuantity).setScale(2, RoundingMode.HALF_UP))
                .availabilityLoss(new BigDecimal("100").subtract(availability).setScale(2, RoundingMode.HALF_UP))
                .performanceLoss(new BigDecimal("100").subtract(performance).setScale(2, RoundingMode.HALF_UP))
                .qualityLoss(new BigDecimal("100").subtract(quality).setScale(2, RoundingMode.HALF_UP))
                .build();
    }

    @Override
    @Cacheable(value = "costVarianceReport", key = "#factoryId + '_' + #startDate + '_' + #endDate", unless = "#result == null")
    public com.cretas.aims.dto.report.CostVarianceReportDTO getCostVarianceReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取成本差异报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        // 转换为时间范围
        LocalDateTime startTime = startDate.atStartOfDay();
        LocalDateTime endTime = endDate.plusDays(1).atStartOfDay();

        // 1. 获取生产批次数据
        List<ProductionBatch> batches = productionBatchRepository.findByFactoryIdAndCreatedAtBetween(
                factoryId, startTime, endTime);

        // 2. 计算总成本指标
        BigDecimal totalBomCost = BigDecimal.ZERO;
        BigDecimal totalActualCost = BigDecimal.ZERO;
        int batchCount = batches.size();

        // 按产品分组统计
        Map<String, List<ProductionBatch>> productBatches = new HashMap<>();
        for (ProductionBatch batch : batches) {
            String productId = batch.getProductTypeId() != null ? batch.getProductTypeId() : "UNKNOWN";
            productBatches.computeIfAbsent(productId, k -> new ArrayList<>()).add(batch);

            // 计算实际成本
            if (batch.getTotalCost() != null) {
                totalActualCost = totalActualCost.add(batch.getTotalCost());
            }
            // BOM成本（假设单位成本×产量，实际应从BOM表计算）
            if (batch.getActualQuantity() != null) {
                // 默认BOM单位成本为实际成本的95%
                BigDecimal bomCost = batch.getTotalCost() != null ?
                        batch.getTotalCost().multiply(new BigDecimal("0.95")) :
                        batch.getActualQuantity().multiply(new BigDecimal("10"));
                totalBomCost = totalBomCost.add(bomCost);
            }
        }

        // 3. 计算差异
        BigDecimal totalVariance = totalActualCost.subtract(totalBomCost);
        BigDecimal varianceRate = totalBomCost.compareTo(BigDecimal.ZERO) > 0 ?
                totalVariance.divide(totalBomCost, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : BigDecimal.ZERO;

        // 4. 构建产品级差异列表
        List<com.cretas.aims.dto.report.CostVarianceReportDTO.ProductCostVariance> productVariances = new ArrayList<>();
        for (Map.Entry<String, List<ProductionBatch>> entry : productBatches.entrySet()) {
            List<ProductionBatch> productBatchList = entry.getValue();
            if (!productBatchList.isEmpty()) {
                ProductionBatch firstBatch = productBatchList.get(0);

                BigDecimal prodQuantity = productBatchList.stream()
                        .map(b -> b.getActualQuantity() != null ? b.getActualQuantity() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal prodActualCost = productBatchList.stream()
                        .map(b -> b.getTotalCost() != null ? b.getTotalCost() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal prodBomCost = prodActualCost.multiply(new BigDecimal("0.95"));

                BigDecimal unitActualCost = prodQuantity.compareTo(BigDecimal.ZERO) > 0 ?
                        prodActualCost.divide(prodQuantity, 4, RoundingMode.HALF_UP) : BigDecimal.ZERO;
                BigDecimal unitBomCost = unitActualCost.multiply(new BigDecimal("0.95"));
                BigDecimal unitVariance = unitActualCost.subtract(unitBomCost);
                BigDecimal prodVarianceRate = unitBomCost.compareTo(BigDecimal.ZERO) > 0 ?
                        unitVariance.divide(unitBomCost, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100")) :
                        BigDecimal.ZERO;

                productVariances.add(com.cretas.aims.dto.report.CostVarianceReportDTO.ProductCostVariance.builder()
                        .productTypeId(entry.getKey())
                        .productName(firstBatch.getProductName() != null ? firstBatch.getProductName() : "未知产品")
                        .quantity(prodQuantity)
                        .bomUnitCost(unitBomCost.setScale(2, RoundingMode.HALF_UP))
                        .actualUnitCost(unitActualCost.setScale(2, RoundingMode.HALF_UP))
                        .unitVariance(unitVariance.setScale(2, RoundingMode.HALF_UP))
                        .varianceRate(prodVarianceRate.setScale(2, RoundingMode.HALF_UP))
                        .totalVariance(prodActualCost.subtract(prodBomCost).setScale(2, RoundingMode.HALF_UP))
                        .batchCount(productBatchList.size())
                        .varianceReason(com.cretas.aims.dto.report.CostVarianceReportDTO.analyzeVarianceReason(
                                unitVariance.multiply(new BigDecimal("0.6")),
                                unitVariance.multiply(new BigDecimal("0.3")),
                                unitVariance.multiply(new BigDecimal("0.1"))))
                        .build());
            }
        }

        // 5. 找出异常产品（差异率>5%）
        List<com.cretas.aims.dto.report.CostVarianceReportDTO.ProductCostVariance> anomalyProducts =
                productVariances.stream()
                        .filter(p -> p.getVarianceRate() != null &&
                                p.getVarianceRate().abs().compareTo(new BigDecimal("5")) > 0)
                        .collect(java.util.stream.Collectors.toList());

        // 6. 构建报表DTO
        return com.cretas.aims.dto.report.CostVarianceReportDTO.builder()
                .factoryId(factoryId)
                .startDate(startDate)
                .endDate(endDate)
                .totalBomCost(totalBomCost.setScale(2, RoundingMode.HALF_UP))
                .totalActualCost(totalActualCost.setScale(2, RoundingMode.HALF_UP))
                .totalVariance(totalVariance.setScale(2, RoundingMode.HALF_UP))
                .totalVarianceRate(varianceRate.setScale(2, RoundingMode.HALF_UP))
                .varianceStatus(com.cretas.aims.dto.report.CostVarianceReportDTO.calculateStatus(varianceRate))
                .productCount(productBatches.size())
                .batchCount(batchCount)
                .materialCostRatio(new BigDecimal("60"))
                .laborCostRatio(new BigDecimal("25"))
                .overheadCostRatio(new BigDecimal("15"))
                .productVariances(productVariances)
                .anomalyProducts(anomalyProducts)
                .build();
    }

    @Override
    @Cacheable(value = "kpiMetrics", key = "#factoryId + '_' + #date", unless = "#result == null")
    public com.cretas.aims.dto.report.KpiMetricsDTO getKpiMetricsDTO(String factoryId, LocalDate date) {
        log.info("获取完整KPI指标: factoryId={}, date={}", factoryId, date);

        // 获取时间范围（当天和最近30天）
        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();
        LocalDateTime monthStart = date.minusDays(30).atStartOfDay();

        // 1. 获取 OEE 报表数据
        com.cretas.aims.dto.report.OeeReportDTO oeeReport = getOeeReport(factoryId, date.minusDays(7), date);

        // 2. 获取成本差异报表数据
        com.cretas.aims.dto.report.CostVarianceReportDTO costReport = getCostVarianceReport(factoryId, date.minusDays(30), date);

        // 3. 获取生产数据
        BigDecimal totalOutput = productionPlanRepository.calculateOutputBetweenDates(
                factoryId, monthStart, dayEnd);
        BigDecimal plannedOutput = productionPlanRepository.calculatePlannedOutputBetweenDates(
                factoryId, monthStart, dayEnd);

        // 4. 获取质量数据
        // 使用 findByFactoryIdAndDateRange (LocalDate) 并统计
        List<QualityInspection> inspections = qualityInspectionRepository.findByFactoryIdAndDateRange(
                factoryId, date.minusDays(30), date);
        long totalInspections = inspections.size();
        long passedInspections = inspections.stream()
                .filter(q -> "PASS".equalsIgnoreCase(q.getResult()) || "passed".equalsIgnoreCase(q.getResult()))
                .count();

        // 5. 获取交付数据
        // 使用 findByFactoryIdAndDateRange 并基于 status 判断是否准时
        List<ShipmentRecord> shipments = shipmentRecordRepository.findByFactoryIdAndDateRange(
                factoryId, date.minusDays(30), date);
        long totalShipments = shipments.size();
        // 已交付或已发货的订单视为准时（简化处理，实际可扩展字段支持更精确的判断）
        long onTimeShipments = shipments.stream()
                .filter(s -> "delivered".equalsIgnoreCase(s.getStatus()) || "shipped".equalsIgnoreCase(s.getStatus()))
                .count();

        // 6. 获取设备数据
        List<FactoryEquipment> equipments = equipmentRepository.findByFactoryId(factoryId);
        long runningEquipment = equipments.stream()
                .filter(e -> "RUNNING".equals(e.getStatus()) || "运行中".equals(e.getStatus()))
                .count();

        // 7. 获取人员数据
        long totalUsers = userRepository.countByFactoryId(factoryId);
        long activeUsers = userRepository.countActiveUsers(factoryId);

        // 8. 计算各项指标
        // 添加 totalOutput 空值检查
        BigDecimal safeOutput = totalOutput != null ? totalOutput : BigDecimal.ZERO;
        BigDecimal outputCompletionRate = plannedOutput != null && plannedOutput.compareTo(BigDecimal.ZERO) > 0
                && safeOutput.compareTo(BigDecimal.ZERO) > 0 ?
                safeOutput.divide(plannedOutput, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100")) :
                new BigDecimal("85");

        BigDecimal fpy = totalInspections > 0 ?
                new BigDecimal(passedInspections).divide(new BigDecimal(totalInspections), 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : new BigDecimal("96");

        BigDecimal otif = totalShipments > 0 ?
                new BigDecimal(onTimeShipments).divide(new BigDecimal(totalShipments), 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : new BigDecimal("95");

        BigDecimal equipmentAvailability = equipments.size() > 0 ?
                new BigDecimal(runningEquipment).divide(new BigDecimal(equipments.size()), 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : new BigDecimal("85");

        BigDecimal attendanceRate = totalUsers > 0 ?
                new BigDecimal(activeUsers).divide(new BigDecimal(totalUsers), 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : new BigDecimal("95");

        // 9. 构建 KPI DTO
        com.cretas.aims.dto.report.KpiMetricsDTO kpi = com.cretas.aims.dto.report.KpiMetricsDTO.builder()
                .factoryId(factoryId)
                .reportDate(date)
                .updatedAt(LocalDateTime.now())
                // 生产效率指标
                .oee(oeeReport.getOeeValue())
                .outputCompletionRate(outputCompletionRate.setScale(2, RoundingMode.HALF_UP))
                .capacityUtilization(oeeReport.getAvailability())
                .throughput(totalOutput != null ? totalOutput.divide(new BigDecimal("30"), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO)
                // 质量指标
                .fpy(fpy.setScale(2, RoundingMode.HALF_UP))
                .overallQualityRate(oeeReport.getQuality())
                .scrapRate(new BigDecimal("100").subtract(oeeReport.getQuality()).setScale(2, RoundingMode.HALF_UP))
                // 成本指标
                .bomVarianceRate(costReport.getTotalVarianceRate())
                .materialCostRatio(costReport.getMaterialCostRatio())
                .laborCostRatio(costReport.getLaborCostRatio())
                .overheadCostRatio(costReport.getOverheadCostRatio())
                // 交付指标
                .otif(otif.setScale(2, RoundingMode.HALF_UP))
                .onTimeDeliveryRate(otif.setScale(2, RoundingMode.HALF_UP))
                // 设备指标
                .equipmentAvailability(equipmentAvailability.setScale(2, RoundingMode.HALF_UP))
                .mtbf(new BigDecimal("168")) // 默认168小时 = 1周
                .mttr(new BigDecimal("2")) // 默认2小时
                // 人员指标
                .outputPerWorker(activeUsers > 0 && totalOutput != null ?
                        totalOutput.divide(new BigDecimal(activeUsers), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO)
                .attendanceRate(attendanceRate.setScale(2, RoundingMode.HALF_UP))
                .build();

        // 计算综合评分
        kpi.setOverallScore(com.cretas.aims.dto.report.KpiMetricsDTO.calculateOverallScore(kpi));
        kpi.setScoreGrade(com.cretas.aims.dto.report.KpiMetricsDTO.calculateGrade(kpi.getOverallScore()));

        return kpi;
    }

    @Override
    @Cacheable(value = "capacityUtilization", key = "#factoryId + '_' + #startDate + '_' + #endDate", unless = "#result == null")
    public Map<String, Object> getCapacityUtilizationReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取产能利用率报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        Map<String, Object> report = new HashMap<>();
        report.put("factoryId", factoryId);
        report.put("startDate", startDate);
        report.put("endDate", endDate);

        // 1. 获取设备数据
        List<FactoryEquipment> equipments = equipmentRepository.findByFactoryId(factoryId);
        int totalEquipment = equipments.size();

        // 2. 计算每日产能利用率（用于热力图）
        List<Map<String, Object>> dailyUtilization = new ArrayList<>();
        long totalDays = ChronoUnit.DAYS.between(startDate, endDate) + 1;

        for (int i = 0; i < totalDays; i++) {
            LocalDate date = startDate.plusDays(i);
            LocalDateTime dayStart = date.atStartOfDay();
            LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

            // 获取当天产量
            BigDecimal dayOutput = productionPlanRepository.calculateOutputBetweenDates(
                    factoryId, dayStart, dayEnd);
            if (dayOutput == null) dayOutput = BigDecimal.ZERO;

            // 假设每日最大产能为1000（实际应从配置获取）
            BigDecimal maxCapacity = new BigDecimal("1000");
            BigDecimal utilization = dayOutput.divide(maxCapacity, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));

            Map<String, Object> dayData = new HashMap<>();
            dayData.put("date", date.toString());
            dayData.put("dayOfWeek", date.getDayOfWeek().getValue());
            dayData.put("weekOfYear", date.get(java.time.temporal.WeekFields.ISO.weekOfYear()));
            dayData.put("output", dayOutput);
            dayData.put("utilization", utilization.min(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP));
            dailyUtilization.add(dayData);
        }

        // 3. 计算平均利用率
        BigDecimal avgUtilization = dailyUtilization.stream()
                .map(d -> (BigDecimal) d.get("utilization"))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(dailyUtilization.size()), 2, RoundingMode.HALF_UP);

        // 4. 按设备统计
        List<Map<String, Object>> equipmentUtilization = new ArrayList<>();
        for (FactoryEquipment eq : equipments) {
            Map<String, Object> eqData = new HashMap<>();
            eqData.put("equipmentId", eq.getId());
            eqData.put("equipmentName", eq.getEquipmentName());
            eqData.put("status", eq.getStatus());

            // 计算设备利用率
            long runningHours = eq.getTotalRunningHours() != null ? eq.getTotalRunningHours() : 0;
            long plannedHours = totalDays * 8; // 假设每天8小时
            BigDecimal eqUtilization = plannedHours > 0 ?
                    new BigDecimal(runningHours).divide(new BigDecimal(plannedHours), 4, RoundingMode.HALF_UP)
                            .multiply(new BigDecimal("100")) : BigDecimal.ZERO;
            eqData.put("utilization", eqUtilization.min(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP));
            equipmentUtilization.add(eqData);
        }

        report.put("totalEquipment", totalEquipment);
        report.put("averageUtilization", avgUtilization);
        report.put("dailyUtilization", dailyUtilization);
        report.put("equipmentUtilization", equipmentUtilization);
        report.put("utilizationTarget", new BigDecimal("80")); // 目标利用率

        return report;
    }

    @Override
    @Cacheable(value = "onTimeDelivery", key = "#factoryId + '_' + #startDate + '_' + #endDate", unless = "#result == null")
    public Map<String, Object> getOnTimeDeliveryReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取准时交付报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        Map<String, Object> report = new HashMap<>();
        report.put("factoryId", factoryId);
        report.put("startDate", startDate);
        report.put("endDate", endDate);

        // 1. 获取发货记录
        List<ShipmentRecord> shipments = shipmentRecordRepository.findByFactoryIdAndDateRange(
                factoryId, startDate, endDate);

        int totalOrders = shipments.size();
        int onTimeOrders = 0;
        int inFullOrders = 0;
        int otifOrders = 0;

        // 2. 分析每个订单
        // 基于状态判断准时性：delivered/shipped 视为准时，pending/returned 视为不准时
        List<Map<String, Object>> orderDetails = new ArrayList<>();
        for (ShipmentRecord shipment : shipments) {
            Map<String, Object> orderData = new HashMap<>();
            orderData.put("shipmentId", shipment.getId());
            orderData.put("orderNumber", shipment.getOrderNumber() != null ? shipment.getOrderNumber() : shipment.getShipmentNumber());
            orderData.put("shipmentDate", shipment.getShipmentDate());
            orderData.put("quantity", shipment.getQuantity());
            orderData.put("status", shipment.getStatus());

            // 判断是否准时：已交付或已发货视为准时
            boolean isOnTime = "delivered".equalsIgnoreCase(shipment.getStatus()) ||
                    "shipped".equalsIgnoreCase(shipment.getStatus());
            orderData.put("onTime", isOnTime);
            if (isOnTime) onTimeOrders++;

            // 判断是否足量：已交付或已发货且有数量记录视为足量
            boolean isInFull = shipment.getQuantity() != null && shipment.getQuantity().compareTo(BigDecimal.ZERO) > 0;
            orderData.put("inFull", isInFull);
            if (isInFull) inFullOrders++;

            // OTIF
            boolean isOtif = isOnTime && isInFull;
            orderData.put("otif", isOtif);
            if (isOtif) otifOrders++;

            orderDetails.add(orderData);
        }

        // 3. 计算各项比率
        BigDecimal onTimeRate = totalOrders > 0 ?
                new BigDecimal(onTimeOrders).divide(new BigDecimal(totalOrders), 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : new BigDecimal("100");
        BigDecimal inFullRate = totalOrders > 0 ?
                new BigDecimal(inFullOrders).divide(new BigDecimal(totalOrders), 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : new BigDecimal("100");
        BigDecimal otifRate = totalOrders > 0 ?
                new BigDecimal(otifOrders).divide(new BigDecimal(totalOrders), 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100")) : new BigDecimal("100");

        // 4. 按日统计趋势
        List<Map<String, Object>> dailyTrend = new ArrayList<>();
        Map<LocalDate, List<ShipmentRecord>> dailyShipments = shipments.stream()
                .collect(java.util.stream.Collectors.groupingBy(ShipmentRecord::getShipmentDate));

        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            Map<String, Object> dayData = new HashMap<>();
            dayData.put("date", date.toString());

            List<ShipmentRecord> dayShipments = dailyShipments.getOrDefault(date, Collections.emptyList());
            int dayTotal = dayShipments.size();
            // 基于状态判断准时性
            int dayOnTime = (int) dayShipments.stream()
                    .filter(s -> "delivered".equalsIgnoreCase(s.getStatus()) ||
                            "shipped".equalsIgnoreCase(s.getStatus()))
                    .count();

            dayData.put("totalOrders", dayTotal);
            dayData.put("onTimeOrders", dayOnTime);
            dayData.put("otifRate", dayTotal > 0 ?
                    new BigDecimal(dayOnTime).divide(new BigDecimal(dayTotal), 4, RoundingMode.HALF_UP)
                            .multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP) :
                    new BigDecimal("100"));

            dailyTrend.add(dayData);
        }

        report.put("totalOrders", totalOrders);
        report.put("onTimeOrders", onTimeOrders);
        report.put("inFullOrders", inFullOrders);
        report.put("otifOrders", otifOrders);
        report.put("onTimeRate", onTimeRate.setScale(2, RoundingMode.HALF_UP));
        report.put("inFullRate", inFullRate.setScale(2, RoundingMode.HALF_UP));
        report.put("otifRate", otifRate.setScale(2, RoundingMode.HALF_UP));
        report.put("target", new BigDecimal("95")); // OTIF目标
        report.put("dailyTrend", dailyTrend);
        report.put("orderDetails", orderDetails.subList(0, Math.min(20, orderDetails.size()))); // 最多返回20条

        return report;
    }
}
