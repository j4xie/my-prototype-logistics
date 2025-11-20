package com.cretas.aims.service;

import com.cretas.aims.controller.DashboardController.*;
import com.cretas.aims.entity.ProcessingBatch;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.repository.ProcessingBatchRepository;
import com.cretas.aims.repository.QualityInspectionRepository;
import com.cretas.aims.repository.TimeClockRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 仪表板业务逻辑层
 *
 * 功能:
 * 1. 获取生产概览（今日/本周/本月统计）
 * 2. 获取生产统计（批次分布、产品类型统计、每日趋势）
 * 3. 获取设备统计（状态分布、部门分布、设备概要）
 * 4. 获取质量统计（本周/本月/本季度质检数据）
 * 5. 获取告警统计（本周/本月告警数据）
 * 6. 获取趋势分析（生产/质量趋势）
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-18
 */
@Service
public class DashboardService {

    @Autowired
    private ProcessingBatchRepository batchRepository;

    @Autowired
    private QualityInspectionRepository qualityRepository;

    @Autowired
    private TimeClockRepository timeClockRepository;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    // ========== 1. 生产概览 ==========

    /**
     * 获取生产概览
     *
     * @param factoryId 工厂ID
     * @param period 时间周期: today, week, month
     * @return 生产概览数据
     */
    public DashboardOverviewData getDashboardOverview(String factoryId, String period) {
        // 计算时间范围
        LocalDateTime[] timeRange = getTimeRange(period);
        LocalDateTime startTime = timeRange[0];
        LocalDateTime endTime = timeRange[1];

        // 获取所有批次
        List<ProcessingBatch> allBatches = batchRepository.findByFactoryId(factoryId);

        // 筛选时间范围内的批次
        List<ProcessingBatch> periodBatches = allBatches.stream()
                .filter(b -> b.getCreatedAt() != null &&
                             b.getCreatedAt().isAfter(startTime) &&
                             b.getCreatedAt().isBefore(endTime))
                .collect(Collectors.toList());

        // 计算总批次数
        int totalBatches = periodBatches.size();

        // 计算活跃批次数（planning + in_progress）
        int activeBatches = (int) periodBatches.stream()
                .filter(b -> b.getStatus() == ProcessingBatch.BatchStatus.planning ||
                            b.getStatus() == ProcessingBatch.BatchStatus.in_progress)
                .count();

        // 计算已完成批次数
        int completedBatches = (int) periodBatches.stream()
                .filter(b -> b.getStatus() == ProcessingBatch.BatchStatus.completed)
                .count();

        // 获取质检记录数
        int qualityInspections = qualityRepository.findByFactoryId(factoryId).size();

        // TODO: 告警数据需要EquipmentController实现后再集成
        int activeAlerts = 0;

        // 获取考勤数据
        // TODO: 需要优化查询，目前获取今日打卡记录
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(23, 59, 59);
        long onDutyWorkers = timeClockRepository.findDepartmentRecordsByDate(factoryId, startOfDay, endOfDay).stream()
                .filter(r -> r.getClockInTime() != null)
                .map(r -> r.getUserId())
                .distinct()
                .count();

        // TODO: 总员工数需要UserRepository
        int totalWorkers = 50; // 临时值

        // 构建概要数据
        SummaryData summary = new SummaryData(
                totalBatches,
                activeBatches,
                completedBatches,
                qualityInspections,
                activeAlerts,
                (int) onDutyWorkers,
                totalWorkers
        );

        // 计算KPI
        double productionEfficiency = totalBatches > 0 ? (completedBatches * 100.0 / totalBatches) : 0.0;
        double qualityPassRate = calculateQualityPassRate(factoryId);
        double equipmentUtilization = 0.0; // TODO: 等待EquipmentController实现

        KpiData kpi = new KpiData(productionEfficiency, qualityPassRate, equipmentUtilization);

        // 构建告警数据
        String alertStatus = activeAlerts > 10 ? "critical" : activeAlerts > 5 ? "warning" : "normal";
        AlertData alerts = new AlertData(activeAlerts, alertStatus);

        return new DashboardOverviewData(period, summary, kpi, alerts);
    }

    // ========== 2. 生产统计 ==========

    /**
     * 获取生产统计
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期 (可选)
     * @param endDate 结束日期 (可选)
     * @param department 部门 (可选)
     * @return 生产统计数据
     */
    public ProductionStatisticsData getProductionStatistics(
            String factoryId, String startDate, String endDate, String department) {

        // 获取所有批次
        List<ProcessingBatch> batches = batchRepository.findByFactoryId(factoryId);

        // 按日期筛选
        if (startDate != null && endDate != null) {
            LocalDate start = LocalDate.parse(startDate, DATE_FORMATTER);
            LocalDate end = LocalDate.parse(endDate, DATE_FORMATTER);
            batches = batches.stream()
                    .filter(b -> {
                        if (b.getStartDate() == null) return false;
                        return !b.getStartDate().isBefore(start) && !b.getStartDate().isAfter(end);
                    })
                    .collect(Collectors.toList());
        }

        // TODO: 按部门筛选需要批次表增加department字段
        // if (department != null) { ... }

        // 1. 批次状态分布
        Map<ProcessingBatch.BatchStatus, List<ProcessingBatch>> statusGroups = batches.stream()
                .collect(Collectors.groupingBy(ProcessingBatch::getStatus));

        List<BatchStatusStat> batchStatusDistribution = statusGroups.entrySet().stream()
                .map(entry -> {
                    int count = entry.getValue().size();
                    double totalQuantity = entry.getValue().stream()
                            .filter(b -> b.getActualQuantity() != null)
                            .mapToDouble(b -> b.getActualQuantity().doubleValue())
                            .sum();
                    return new BatchStatusStat(entry.getKey().name(), count, totalQuantity);
                })
                .collect(Collectors.toList());

        // 2. 产品类型统计
        Map<String, List<ProcessingBatch>> productTypeGroups = batches.stream()
                .filter(b -> b.getProductType() != null)
                .collect(Collectors.groupingBy(ProcessingBatch::getProductType));

        List<ProductTypeStat> productTypeStats = productTypeGroups.entrySet().stream()
                .map(entry -> {
                    int count = entry.getValue().size();
                    double totalQuantity = entry.getValue().stream()
                            .filter(b -> b.getActualQuantity() != null)
                            .mapToDouble(b -> b.getActualQuantity().doubleValue())
                            .sum();
                    double avgQuantity = count > 0 ? totalQuantity / count : 0.0;
                    return new ProductTypeStat(entry.getKey(), count, totalQuantity, avgQuantity);
                })
                .collect(Collectors.toList());

        // 3. 每日趋势统计
        Map<LocalDate, List<ProcessingBatch>> dailyGroups = batches.stream()
                .filter(b -> b.getStartDate() != null)
                .collect(Collectors.groupingBy(ProcessingBatch::getStartDate));

        List<DailyTrendStat> dailyTrends = dailyGroups.entrySet().stream()
                .map(entry -> {
                    String date = entry.getKey().format(DATE_FORMATTER);
                    int batchCount = entry.getValue().size();
                    double quantity = entry.getValue().stream()
                            .filter(b -> b.getActualQuantity() != null)
                            .mapToDouble(b -> b.getActualQuantity().doubleValue())
                            .sum();
                    int completed = (int) entry.getValue().stream()
                            .filter(b -> b.getStatus() == ProcessingBatch.BatchStatus.completed)
                            .count();
                    return new DailyTrendStat(date, batchCount, quantity, completed);
                })
                .sorted((a, b) -> a.getDate().compareTo(b.getDate()))
                .collect(Collectors.toList());

        return new ProductionStatisticsData(batchStatusDistribution, productTypeStats, dailyTrends);
    }

    // ========== 3. 设备统计 ==========

    /**
     * 获取设备统计
     *
     * TODO: 需要EquipmentController和Equipment实体实现
     * 当前返回模拟数据
     *
     * @param factoryId 工厂ID
     * @return 设备统计数据
     */
    public EquipmentDashboardData getEquipmentDashboard(String factoryId) {
        // 模拟数据 - 等待EquipmentController实现
        List<StatusDistribution> statusDistribution = Arrays.asList(
                new StatusDistribution("running", 15),
                new StatusDistribution("idle", 8),
                new StatusDistribution("maintenance", 2)
        );

        List<DepartmentDistribution> departmentDistribution = Arrays.asList(
                new DepartmentDistribution("生产部", 12),
                new DepartmentDistribution("包装部", 8),
                new DepartmentDistribution("仓储部", 5)
        );

        EquipmentSummary summary = new EquipmentSummary(25, 15, 60.0, 3);

        return new EquipmentDashboardData(statusDistribution, departmentDistribution, summary);
    }

    // ========== 4. 质量统计 ==========

    /**
     * 获取质量统计
     *
     * @param factoryId 工厂ID
     * @param period 时间周期: week, month, quarter
     * @return 质量统计数据
     */
    public Map<String, Object> getQualityDashboard(String factoryId, String period) {
        LocalDateTime[] timeRange = getTimeRange(period);
        LocalDateTime startTime = timeRange[0];
        LocalDateTime endTime = timeRange[1];

        // 获取时间范围内的质检记录
        List<QualityInspection> inspections = qualityRepository.findByFactoryId(factoryId).stream()
                .filter(qi -> qi.getInspectionDate() != null &&
                             qi.getInspectionDate().isAfter(startTime) &&
                             qi.getInspectionDate().isBefore(endTime))
                .collect(Collectors.toList());

        int totalInspections = inspections.size();
        long passedInspections = inspections.stream()
                .filter(qi -> qi.getOverallResult() == QualityInspection.InspectionResult.pass)
                .count();
        double passRate = totalInspections > 0 ? (passedInspections * 100.0 / totalInspections) : 0.0;

        Map<String, Object> result = new HashMap<>();
        result.put("period", period);
        result.put("totalInspections", totalInspections);
        result.put("passedInspections", passedInspections);
        result.put("passRate", passRate);
        result.put("failedInspections", totalInspections - passedInspections);

        return result;
    }

    // ========== 5. 告警统计 ==========

    /**
     * 获取告警统计
     *
     * TODO: 需要AlertController和Alert实体实现
     * 当前返回模拟数据
     *
     * @param factoryId 工厂ID
     * @param period 时间周期: week, month
     * @return 告警统计数据
     */
    public Map<String, Object> getAlertsDashboard(String factoryId, String period) {
        // 模拟数据 - 等待AlertController实现
        Map<String, Object> result = new HashMap<>();
        result.put("period", period);
        result.put("totalAlerts", 15);
        result.put("criticalAlerts", 2);
        result.put("warningAlerts", 8);
        result.put("infoAlerts", 5);
        result.put("resolvedAlerts", 10);
        result.put("activeAlerts", 5);

        return result;
    }

    // ========== 6. 趋势分析 ==========

    /**
     * 获取趋势分析
     *
     * @param factoryId 工厂ID
     * @param period 时间周期: week, month, quarter
     * @param metric 指标类型: production, quality
     * @return 趋势分析数据
     */
    public Map<String, Object> getTrendAnalysis(String factoryId, String period, String metric) {
        LocalDateTime[] timeRange = getTimeRange(period);
        LocalDateTime startTime = timeRange[0];
        LocalDateTime endTime = timeRange[1];

        Map<String, Object> result = new HashMap<>();
        result.put("period", period);
        result.put("metric", metric);

        if ("production".equals(metric)) {
            // 生产趋势
            List<ProcessingBatch> batches = batchRepository.findByFactoryId(factoryId).stream()
                    .filter(b -> b.getCreatedAt() != null &&
                                b.getCreatedAt().isAfter(startTime) &&
                                b.getCreatedAt().isBefore(endTime))
                    .collect(Collectors.toList());

            result.put("totalBatches", batches.size());
            result.put("completedBatches", batches.stream()
                    .filter(b -> b.getStatus() == ProcessingBatch.BatchStatus.completed)
                    .count());
            result.put("trend", "increasing"); // 简化处理

        } else if ("quality".equals(metric)) {
            // 质量趋势
            List<QualityInspection> inspections = qualityRepository.findByFactoryId(factoryId).stream()
                    .filter(qi -> qi.getInspectionDate() != null &&
                                 qi.getInspectionDate().isAfter(startTime) &&
                                 qi.getInspectionDate().isBefore(endTime))
                    .collect(Collectors.toList());

            long passedInspections = inspections.stream()
                    .filter(qi -> qi.getOverallResult() == QualityInspection.InspectionResult.pass)
                    .count();
            double passRate = inspections.size() > 0 ? (passedInspections * 100.0 / inspections.size()) : 0.0;

            result.put("totalInspections", inspections.size());
            result.put("passedInspections", passedInspections);
            result.put("passRate", passRate);
            result.put("trend", passRate >= 90 ? "stable" : "declining");
        }

        return result;
    }

    // ========================================
    // 辅助方法
    // ========================================

    /**
     * 计算质量合格率
     */
    private double calculateQualityPassRate(String factoryId) {
        List<QualityInspection> allInspections = qualityRepository.findByFactoryId(factoryId);
        if (allInspections.isEmpty()) {
            return 0.0;
        }

        long passedCount = allInspections.stream()
                .filter(qi -> qi.getOverallResult() == QualityInspection.InspectionResult.pass)
                .count();

        return (passedCount * 100.0) / allInspections.size();
    }

    /**
     * 根据周期计算时间范围
     *
     * @param period today, week, month, quarter
     * @return [startTime, endTime]
     */
    private LocalDateTime[] getTimeRange(String period) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startTime;
        LocalDateTime endTime = now;

        switch (period.toLowerCase()) {
            case "today":
                startTime = now.toLocalDate().atStartOfDay();
                break;
            case "week":
                startTime = now.minusWeeks(1);
                break;
            case "month":
                startTime = now.minusMonths(1);
                break;
            case "quarter":
                startTime = now.minusMonths(3);
                break;
            default:
                startTime = now.toLocalDate().atStartOfDay();
        }

        return new LocalDateTime[]{startTime, endTime};
    }
}
