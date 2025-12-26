package com.cretas.aims.service.impl;

import com.cretas.aims.dto.report.DashboardStatisticsDTO;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.FactoryEquipment;
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
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
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
        return DashboardStatisticsDTO.ProductionStatistics.builder()
                .totalPlans((int) totalPlans)
                .activePlans((int) activePlans)
                .completedPlans((int) completedPlans)
                .totalOutput(totalOutput != null ? totalOutput : BigDecimal.ZERO)
                .monthlyOutput(monthlyOutput != null ? monthlyOutput : BigDecimal.ZERO)
                .completionRate(completionRate)
                .efficiency(85.0) // TODO: 实际计算效率
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
        return DashboardStatisticsDTO.InventoryStatistics.builder()
                .totalBatches((int) totalBatches)
                .totalValue(totalValue != null ? totalValue : BigDecimal.ZERO)
                .expiringBatches(expiringBatches.size())
                .expiredBatches(expiredBatches.size())
                .lowStockItems(lowStockMaterials.size())
                .turnoverRate(BigDecimal.valueOf(4.5)) // TODO: 计算实际周转率
                .build();
    }
    private DashboardStatisticsDTO.FinanceStatistics getFinanceStatistics(String factoryId) {
        // TODO: 实现财务统计
        return DashboardStatisticsDTO.FinanceStatistics.builder()
                .totalRevenue(BigDecimal.valueOf(1000000))
                .totalCost(BigDecimal.valueOf(700000))
                .totalProfit(BigDecimal.valueOf(300000))
                .monthlyRevenue(BigDecimal.valueOf(100000))
                .monthlyCost(BigDecimal.valueOf(70000))
                .monthlyProfit(BigDecimal.valueOf(30000))
                .profitMargin(30.0)
                .accountsReceivable(BigDecimal.valueOf(50000))
                .accountsPayable(BigDecimal.valueOf(30000))
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
        // TODO: 实现质量统计
        return DashboardStatisticsDTO.QualityStatistics.builder()
                .totalProduction(BigDecimal.valueOf(10000))
                .qualifiedProduction(BigDecimal.valueOf(9800))
                .defectiveProduction(BigDecimal.valueOf(200))
                .qualityRate(98.0)
                .qualityIssues(5)
                .resolvedIssues(3)
                .firstPassRate(96.0)
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
        // 收入统计
        BigDecimal totalRevenue = BigDecimal.ZERO; // TODO: 从订单表计算
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
        // TODO: 实现质量报表统计
        report.put("totalProduction", BigDecimal.valueOf(10000));
        report.put("qualifiedProduction", BigDecimal.valueOf(9800));
        report.put("defectiveProduction", BigDecimal.valueOf(200));
        report.put("qualityRate", 98.0);
        report.put("firstPassRate", 96.0);
        report.put("reworkRate", 2.0);
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
        // TODO: 绩效指标
        report.put("attendanceRate", 95.0);
        report.put("productivity", 88.0);
        report.put("satisfaction", 4.2);
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
        // TODO: 实现销售报表
        report.put("totalOrders", 100);
        report.put("totalRevenue", BigDecimal.valueOf(1000000));
        report.put("averageOrderValue", BigDecimal.valueOf(10000));
        report.put("conversionRate", 25.0);
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
        // TODO: 实现自定义报表逻辑
        report.put("parameters", parameters);
        report.put("data", new HashMap<>());
        return report;
    }
    @Override
    public byte[] exportReportToExcel(String factoryId, String reportType, Map<String, Object> parameters) {
        log.info("导出Excel报表: factoryId={}, reportType={}", factoryId, reportType);
        // TODO: 实现Excel导出
        throw new UnsupportedOperationException("Excel导出功能待实现");
    }
    @Override
    public byte[] exportReportToPDF(String factoryId, String reportType, Map<String, Object> parameters) {
        log.info("导出PDF报表: factoryId={}, reportType={}", factoryId, reportType);
        // TODO: 实现PDF导出
        throw new UnsupportedOperationException("PDF导出功能待实现");
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
        // TODO: 实现预测逻辑
        forecast.put("forecastDays", forecastDays);
        forecast.put("expectedProduction", BigDecimal.valueOf(10000 * forecastDays));
        forecast.put("expectedRevenue", BigDecimal.valueOf(100000 * forecastDays));
        forecast.put("expectedCost", BigDecimal.valueOf(70000 * forecastDays));
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
}
