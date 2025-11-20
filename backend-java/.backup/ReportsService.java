package com.cretas.aims.service;

import com.cretas.aims.entity.ProcessingBatch;
import com.cretas.aims.repository.ProcessingBatchRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 报表业务逻辑层
 *
 * 功能:
 * 1. 时间范围成本分析（按天/周/月分组）
 * 2. 成本构成分析（材料/人工/间接费用）
 * 3. 高成本批次识别
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-18
 */
@Service
public class ReportsService {

    @Autowired
    private ProcessingBatchRepository batchRepository;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /**
     * 获取时间范围成本分析
     *
     * @param factoryId 工厂ID
     * @param startDateStr 开始日期 (yyyy-MM-dd)
     * @param endDateStr 结束日期 (yyyy-MM-dd)
     * @param groupBy 分组方式: day, week, month
     * @return 成本分析数据
     */
    public Map<String, Object> getTimeRangeCostAnalysis(
            String factoryId, String startDateStr, String endDateStr, String groupBy) {

        // 解析日期
        LocalDate startDate = LocalDate.parse(startDateStr, DATE_FORMATTER);
        LocalDate endDate = LocalDate.parse(endDateStr, DATE_FORMATTER);

        // 验证日期范围
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("结束日期不能早于开始日期");
        }

        // 验证分组方式
        if (!Arrays.asList("day", "week", "month").contains(groupBy)) {
            throw new IllegalArgumentException("分组方式只能是: day, week, month");
        }

        // 获取时间范围内的批次
        List<ProcessingBatch> batches = batchRepository.findByFactoryId(factoryId).stream()
                .filter(b -> b.getStartDate() != null)
                .filter(b -> !b.getStartDate().isBefore(startDate) && !b.getStartDate().isAfter(endDate))
                .collect(Collectors.toList());

        // 构建返回数据
        Map<String, Object> result = new HashMap<>();

        // 1. 时间范围信息
        Map<String, String> timeRange = new HashMap<>();
        timeRange.put("startDate", startDateStr);
        timeRange.put("endDate", endDateStr);
        timeRange.put("groupBy", groupBy);
        result.put("timeRange", timeRange);

        // 2. 汇总统计
        Map<String, Object> summary = calculateSummary(batches);
        result.put("summary", summary);

        // 3. 成本构成
        Map<String, Object> costBreakdown = calculateCostBreakdown(batches);
        result.put("costBreakdown", costBreakdown);

        // 4. 时间序列数据
        List<Map<String, Object>> timeSeriesData = calculateTimeSeriesData(batches, startDate, endDate, groupBy);
        result.put("timeSeriesData", timeSeriesData);

        // 5. 高成本批次Top10
        List<Map<String, Object>> topCostBatches = getTopCostBatches(batches, 10);
        result.put("topCostBatches", topCostBatches);

        return result;
    }

    /**
     * 计算汇总统计
     */
    private Map<String, Object> calculateSummary(List<ProcessingBatch> batches) {
        Map<String, Object> summary = new HashMap<>();

        int totalBatches = batches.size();
        summary.put("totalBatches", totalBatches);

        // 计算总成本
        double totalCost = batches.stream()
                .filter(b -> b.getTotalCost() != null)
                .mapToDouble(b -> b.getTotalCost().doubleValue())
                .sum();
        summary.put("totalCost", totalCost);

        // 平均每批次成本
        double averageCostPerBatch = totalBatches > 0 ? totalCost / totalBatches : 0.0;
        summary.put("averageCostPerBatch", averageCostPerBatch);

        // 总产量
        double totalQuantity = batches.stream()
                .filter(b -> b.getActualQuantity() != null)
                .mapToDouble(b -> b.getActualQuantity().doubleValue())
                .sum();
        summary.put("totalQuantity", totalQuantity);

        // 平均每公斤成本
        double averageCostPerKg = totalQuantity > 0 ? totalCost / totalQuantity : 0.0;
        summary.put("averageCostPerKg", averageCostPerKg);

        return summary;
    }

    /**
     * 计算成本构成
     */
    private Map<String, Object> calculateCostBreakdown(List<ProcessingBatch> batches) {
        Map<String, Object> breakdown = new HashMap<>();

        // 计算材料成本
        double materialCost = batches.stream()
                .filter(b -> b.getRawMaterialCost() != null)
                .mapToDouble(b -> b.getRawMaterialCost().doubleValue())
                .sum();

        // 计算人工成本
        double laborCost = batches.stream()
                .filter(b -> b.getLaborCost() != null)
                .mapToDouble(b -> b.getLaborCost().doubleValue())
                .sum();

        // 计算间接费用（设备成本）
        double overheadCost = batches.stream()
                .filter(b -> b.getEquipmentCost() != null)
                .mapToDouble(b -> b.getEquipmentCost().doubleValue())
                .sum();

        double totalCost = materialCost + laborCost + overheadCost;

        breakdown.put("materialCost", materialCost);
        breakdown.put("laborCost", laborCost);
        breakdown.put("overheadCost", overheadCost);

        if (totalCost > 0) {
            breakdown.put("materialPercentage", (materialCost / totalCost) * 100);
            breakdown.put("laborPercentage", (laborCost / totalCost) * 100);
            breakdown.put("overheadPercentage", (overheadCost / totalCost) * 100);
        } else {
            breakdown.put("materialPercentage", 0.0);
            breakdown.put("laborPercentage", 0.0);
            breakdown.put("overheadPercentage", 0.0);
        }

        return breakdown;
    }

    /**
     * 计算时间序列数据
     */
    private List<Map<String, Object>> calculateTimeSeriesData(
            List<ProcessingBatch> batches, LocalDate startDate, LocalDate endDate, String groupBy) {

        // 按日期分组
        Map<String, List<ProcessingBatch>> groupedBatches;

        if ("day".equals(groupBy)) {
            groupedBatches = batches.stream()
                    .collect(Collectors.groupingBy(b -> b.getStartDate().format(DATE_FORMATTER)));
        } else if ("week".equals(groupBy)) {
            groupedBatches = batches.stream()
                    .collect(Collectors.groupingBy(b -> getWeekKey(b.getStartDate())));
        } else { // month
            groupedBatches = batches.stream()
                    .collect(Collectors.groupingBy(b -> b.getStartDate().format(DateTimeFormatter.ofPattern("yyyy-MM"))));
        }

        // 转换为时间序列数据
        List<Map<String, Object>> timeSeriesData = new ArrayList<>();

        for (Map.Entry<String, List<ProcessingBatch>> entry : groupedBatches.entrySet()) {
            Map<String, Object> dataPoint = new HashMap<>();
            dataPoint.put("date", entry.getKey());
            dataPoint.put("batches", entry.getValue().size());

            double totalCost = entry.getValue().stream()
                    .filter(b -> b.getTotalCost() != null)
                    .mapToDouble(b -> b.getTotalCost().doubleValue())
                    .sum();
            dataPoint.put("totalCost", totalCost);

            double quantity = entry.getValue().stream()
                    .filter(b -> b.getActualQuantity() != null)
                    .mapToDouble(b -> b.getActualQuantity().doubleValue())
                    .sum();
            dataPoint.put("quantity", quantity);

            timeSeriesData.add(dataPoint);
        }

        // 按日期排序
        timeSeriesData.sort((a, b) -> ((String) a.get("date")).compareTo((String) b.get("date")));

        return timeSeriesData;
    }

    /**
     * 获取高成本批次Top N
     */
    private List<Map<String, Object>> getTopCostBatches(List<ProcessingBatch> batches, int topN) {
        return batches.stream()
                .filter(b -> b.getTotalCost() != null)
                .sorted((a, b) -> b.getTotalCost().compareTo(a.getTotalCost()))
                .limit(topN)
                .map(batch -> {
                    Map<String, Object> batchInfo = new HashMap<>();
                    batchInfo.put("batchId", batch.getId());
                    batchInfo.put("batchNumber", batch.getBatchNumber());
                    batchInfo.put("productType", batch.getProductType());
                    batchInfo.put("totalCost", batch.getTotalCost().doubleValue());
                    batchInfo.put("date", batch.getStartDate() != null ? batch.getStartDate().format(DATE_FORMATTER) : null);
                    return batchInfo;
                })
                .collect(Collectors.toList());
    }

    /**
     * 获取周键（格式: 2025-W01）
     */
    private String getWeekKey(LocalDate date) {
        int year = date.getYear();
        int weekOfYear = date.get(java.time.temporal.IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        return String.format("%d-W%02d", year, weekOfYear);
    }
}
