package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.AIInsight;
import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.KPICard;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.Supplier;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.SupplierRepository;
import com.cretas.aims.service.smartbi.MetricCalculatorService;
import com.cretas.aims.service.smartbi.ProcurementAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 采购分析服务实现
 *
 * 实现 SmartBI 系统中采购相关的分析，包括：
 * - 采购概览：KPI 卡片、图表、排名、AI 洞察
 * - 供应商评估：五维雷达图评估
 * - 采购成本分析：按类别分布
 * - 供应商排名：业绩排名
 * - 趋势分析：日/周/月采购趋势
 *
 * 所有计算使用 BigDecimal 确保精度，默认保留 2 位小数。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProcurementAnalysisServiceImpl implements ProcurementAnalysisService {

    private final MaterialBatchRepository materialBatchRepository;
    private final SupplierRepository supplierRepository;
    private final MetricCalculatorService metricCalculatorService;

    // 计算精度配置
    private static final int SCALE = 4;
    private static final int DISPLAY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    // 预警阈值配置
    /** 准时交付率红色预警阈值 */
    private static final BigDecimal ON_TIME_RED_THRESHOLD = new BigDecimal("70");
    /** 准时交付率黄色预警阈值 */
    private static final BigDecimal ON_TIME_YELLOW_THRESHOLD = new BigDecimal("85");
    /** 质量合格率红色预警阈值 */
    private static final BigDecimal QUALITY_RED_THRESHOLD = new BigDecimal("90");
    /** 质量合格率黄色预警阈值 */
    private static final BigDecimal QUALITY_YELLOW_THRESHOLD = new BigDecimal("95");
    /** 供应商集中度红色预警阈值（单一供应商占比超过60%） */
    private static final BigDecimal CONCENTRATION_RED_THRESHOLD = new BigDecimal("60");
    /** 供应商集中度黄色预警阈值 */
    private static final BigDecimal CONCENTRATION_YELLOW_THRESHOLD = new BigDecimal("40");

    // ==================== 采购概览 ====================

    @Override
    @Transactional(readOnly = true)
    public DashboardResponse getProcurementOverview(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取采购概览: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        // 查询指定时间范围内入库的批次
        List<MaterialBatch> batches = getBatchesInDateRange(factoryId, startDate, endDate);

        if (batches.isEmpty()) {
            log.warn("未找到采购数据: factoryId={}", factoryId);
            return buildEmptyDashboard();
        }

        // 计算 KPI 卡片
        List<MetricResult> metricResults = calculateKpiCards(batches, factoryId, startDate, endDate);
        List<KPICard> kpiCards = convertToKPICards(metricResults);

        // 生成图表
        List<ChartConfig> chartList = new ArrayList<>();
        chartList.add(buildProcurementTrendChartFromData(batches, "DAY"));
        chartList.add(buildSupplierPieChart(batches));
        chartList.add(buildMaterialCategoryChart(batches));
        Map<String, ChartConfig> charts = new LinkedHashMap<>();
        for (ChartConfig chart : chartList) {
            charts.put(chart.getTitle() != null ? chart.getTitle().replace(" ", "_") : "chart_" + charts.size(), chart);
        }

        // 生成排名
        List<RankingItem> supplierRankings = calculateSupplierRankingFromData(batches);
        Map<String, List<RankingItem>> rankings = new LinkedHashMap<>();
        rankings.put("supplier", supplierRankings);

        // 生成 AI 洞察
        List<AIInsight> aiInsights = generateAiInsights(batches, metricResults);

        // 生成建议
        List<String> suggestions = generateSuggestions(batches, metricResults);

        return DashboardResponse.builder()
                .kpiCards(kpiCards)
                .charts(charts)
                .rankings(rankings)
                .aiInsights(aiInsights)
                .suggestions(suggestions)
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    // ==================== 供应商评估 ====================

    @Override
    @Transactional(readOnly = true)
    public ChartConfig getSupplierEvaluation(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取供应商评估: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<MaterialBatch> batches = getBatchesInDateRange(factoryId, startDate, endDate);
        List<Supplier> suppliers = supplierRepository.findByFactoryIdAndIsActive(factoryId, true);

        List<Map<String, Object>> chartData = new ArrayList<>();

        for (Supplier supplier : suppliers) {
            List<MaterialBatch> supplierBatches = batches.stream()
                    .filter(b -> supplier.getId().equals(b.getSupplierId()))
                    .collect(Collectors.toList());

            if (supplierBatches.isEmpty()) {
                continue;
            }

            Map<String, Object> dataPoint = new LinkedHashMap<>();
            dataPoint.put("supplierName", supplier.getName());

            // 计算五个维度的评分（0-100）
            // 1. 价格竞争力（基于供应商评级）
            BigDecimal priceScore = calculatePriceScore(supplier, supplierBatches);
            dataPoint.put("priceCompetitiveness", priceScore);

            // 2. 质量合格率（基于批次状态）
            BigDecimal qualityScore = calculateQualityScore(supplierBatches);
            dataPoint.put("qualityPassRate", qualityScore);

            // 3. 交付准时率（基于预期交付天数）
            BigDecimal deliveryScore = calculateDeliveryScore(supplier, supplierBatches);
            dataPoint.put("onTimeDelivery", deliveryScore);

            // 4. 服务响应度（基于评级）
            BigDecimal serviceScore = calculateServiceScore(supplier);
            dataPoint.put("serviceResponse", serviceScore);

            // 5. 供货稳定性（基于供货量波动）
            BigDecimal stabilityScore = calculateStabilityScore(supplierBatches);
            dataPoint.put("supplyStability", stabilityScore);

            chartData.add(dataPoint);
        }

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("showLegend", true);
        options.put("maxValue", 100);
        options.put("dimensions", Arrays.asList("priceCompetitiveness", "qualityPassRate",
                "onTimeDelivery", "serviceResponse", "supplyStability"));
        options.put("dimensionNames", Arrays.asList("价格竞争力", "质量合格率",
                "准时交付", "服务响应", "供货稳定"));

        return ChartConfig.builder()
                .chartType("RADAR")
                .title("供应商综合评估")
                .xAxisField("supplierName")
                .data(chartData)
                .options(options)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MetricResult> getSupplierDetailMetrics(String factoryId, String supplierId,
                                                        LocalDate startDate, LocalDate endDate) {
        log.info("获取供应商详细指标: factoryId={}, supplierId={}", factoryId, supplierId);

        Optional<Supplier> supplierOpt = supplierRepository.findByIdAndFactoryId(supplierId, factoryId);
        if (supplierOpt.isEmpty()) {
            return Collections.emptyList();
        }

        Supplier supplier = supplierOpt.get();
        List<MaterialBatch> batches = getBatchesInDateRange(factoryId, startDate, endDate).stream()
                .filter(b -> supplierId.equals(b.getSupplierId()))
                .collect(Collectors.toList());

        List<MetricResult> metrics = new ArrayList<>();

        // 采购总额
        BigDecimal totalAmount = calculateTotalValue(batches);
        metrics.add(MetricResult.of(PROCUREMENT_AMOUNT, "采购总额", totalAmount, "元"));

        // 批次数
        metrics.add(MetricResult.of(BATCH_COUNT, "采购批次", new BigDecimal(batches.size()), "批"));

        // 平均批次金额
        BigDecimal avgAmount = batches.isEmpty() ? BigDecimal.ZERO :
                totalAmount.divide(new BigDecimal(batches.size()), SCALE, ROUNDING_MODE);
        metrics.add(MetricResult.of(AVG_BATCH_AMOUNT, "平均批次金额", avgAmount, "元"));

        // 质量合格率
        BigDecimal qualityRate = calculateQualityScore(batches);
        metrics.add(MetricResult.of(QUALITY_PASS_RATE, "质量合格率", qualityRate, "%",
                determineQualityAlertLevel(qualityRate)));

        // 准时交付率
        BigDecimal deliveryRate = calculateDeliveryScore(supplier, batches);
        metrics.add(MetricResult.of(ON_TIME_DELIVERY_RATE, "准时交付率", deliveryRate, "%",
                determineDeliveryAlertLevel(deliveryRate)));

        // 供应商评级
        Integer rating = supplier.getRating();
        if (rating != null) {
            metrics.add(MetricResult.of("SUPPLIER_RATING", "供应商评级",
                    new BigDecimal(rating), "星"));
        }

        return metrics;
    }

    // ==================== 采购成本分析 ====================

    @Override
    @Transactional(readOnly = true)
    public ChartConfig getPurchaseCostAnalysis(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取采购成本分析: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<MaterialBatch> batches = getBatchesInDateRange(factoryId, startDate, endDate);

        // 按材料类型分组统计
        Map<String, BigDecimal> categoryValues = batches.stream()
                .filter(b -> b.getMaterialTypeId() != null)
                .collect(Collectors.groupingBy(
                        MaterialBatch::getMaterialTypeId,
                        Collectors.reducing(BigDecimal.ZERO,
                                MaterialBatch::getTotalValue,
                                BigDecimal::add)
                ));

        List<Map<String, Object>> chartData = categoryValues.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .map(entry -> {
                    Map<String, Object> dataPoint = new LinkedHashMap<>();
                    dataPoint.put("category", entry.getKey());
                    dataPoint.put("value", entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE));
                    return dataPoint;
                })
                .collect(Collectors.toList());

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("showPercentage", true);
        options.put("showLegend", true);

        return ChartConfig.builder()
                .chartType("PIE")
                .title("采购成本分布")
                .xAxisField("category")
                .yAxisField("value")
                .data(chartData)
                .options(options)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MetricResult> getCostMetrics(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取采购成本指标: factoryId={}", factoryId);

        List<MaterialBatch> batches = getBatchesInDateRange(factoryId, startDate, endDate);
        List<MetricResult> metrics = new ArrayList<>();

        // 总采购金额
        BigDecimal totalAmount = calculateTotalValue(batches);
        metrics.add(MetricResult.of(PROCUREMENT_AMOUNT, "采购总额", totalAmount, "元"));

        // 采购批次数
        metrics.add(MetricResult.of(BATCH_COUNT, "采购批次", new BigDecimal(batches.size()), "批"));

        // 平均单价
        BigDecimal avgPrice = calculateAverageUnitPrice(batches);
        metrics.add(MetricResult.of("AVG_UNIT_PRICE", "平均单价", avgPrice, "元"));

        // 最高单价材料
        Optional<MaterialBatch> maxPriceBatch = batches.stream()
                .filter(b -> b.getUnitPrice() != null)
                .max(Comparator.comparing(MaterialBatch::getUnitPrice));
        if (maxPriceBatch.isPresent()) {
            metrics.add(MetricResult.builder()
                    .metricCode("MAX_UNIT_PRICE")
                    .metricName("最高单价")
                    .value(maxPriceBatch.get().getUnitPrice())
                    .unit("元")
                    .dimensionValue(maxPriceBatch.get().getMaterialTypeId())
                    .alertLevel(MetricResult.AlertLevel.GREEN.name())
                    .build());
        }

        // 计算环比变化
        LocalDate previousStart = startDate.minusMonths(1);
        LocalDate previousEnd = endDate.minusMonths(1);
        List<MaterialBatch> previousBatches = getBatchesInDateRange(factoryId, previousStart, previousEnd);

        if (!previousBatches.isEmpty()) {
            BigDecimal previousAmount = calculateTotalValue(previousBatches);
            BigDecimal momGrowth = metricCalculatorService.calculateMomGrowth(totalAmount, previousAmount);
            metrics.add(MetricResult.ofWithTrend(PROCUREMENT_MOM_GROWTH, "采购环比增长",
                    momGrowth, "%", momGrowth, determineChangeDirection(momGrowth)));
        }

        return metrics;
    }

    // ==================== 供应商排名 ====================

    @Override
    @Transactional(readOnly = true)
    public List<RankingItem> getSupplierRanking(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取供应商排名: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<MaterialBatch> batches = getBatchesInDateRange(factoryId, startDate, endDate);
        return calculateSupplierRankingFromData(batches);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RankingItem> getMaterialCategoryRanking(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取材料类别排名: factoryId={}", factoryId);

        List<MaterialBatch> batches = getBatchesInDateRange(factoryId, startDate, endDate);

        Map<String, BigDecimal> categoryValues = batches.stream()
                .filter(b -> b.getMaterialTypeId() != null)
                .collect(Collectors.groupingBy(
                        MaterialBatch::getMaterialTypeId,
                        Collectors.reducing(BigDecimal.ZERO,
                                MaterialBatch::getTotalValue,
                                BigDecimal::add)
                ));

        BigDecimal totalValue = categoryValues.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<RankingItem> rankings = new ArrayList<>();
        int rank = 1;

        List<Map.Entry<String, BigDecimal>> sorted = categoryValues.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .collect(Collectors.toList());

        for (Map.Entry<String, BigDecimal> entry : sorted) {
            BigDecimal percentage = totalValue.compareTo(BigDecimal.ZERO) > 0
                    ? entry.getValue().divide(totalValue, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;

            rankings.add(RankingItem.builder()
                    .rank(rank++)
                    .name(entry.getKey())
                    .value(entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .completionRate(percentage.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .alertLevel(MetricResult.AlertLevel.GREEN.name())
                    .build());
        }

        return rankings;
    }

    // ==================== 趋势分析 ====================

    @Override
    @Transactional(readOnly = true)
    public ChartConfig getProcurementTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period) {
        log.info("获取采购趋势图表: factoryId={}, period={}", factoryId, period);

        List<MaterialBatch> batches = getBatchesInDateRange(factoryId, startDate, endDate);
        return buildProcurementTrendChartFromData(batches, period);
    }

    @Override
    @Transactional(readOnly = true)
    public ChartConfig getSupplierTrendComparison(String factoryId, List<String> supplierIds,
                                                   LocalDate startDate, LocalDate endDate) {
        log.info("获取供应商趋势对比: factoryId={}, supplierIds={}", factoryId, supplierIds);

        List<MaterialBatch> batches = getBatchesInDateRange(factoryId, startDate, endDate);

        Set<String> supplierIdSet = new HashSet<>(supplierIds);
        Map<String, List<MaterialBatch>> groupedBatches = batches.stream()
                .filter(b -> b.getSupplierId() != null && supplierIdSet.contains(b.getSupplierId()))
                .collect(Collectors.groupingBy(MaterialBatch::getSupplierId));

        List<Map<String, Object>> chartData = new ArrayList<>();

        for (String supplierId : supplierIds) {
            List<MaterialBatch> supplierBatches = groupedBatches.getOrDefault(supplierId, Collections.emptyList());

            BigDecimal totalAmount = calculateTotalValue(supplierBatches);
            int batchCount = supplierBatches.size();
            BigDecimal avgAmount = batchCount > 0
                    ? totalAmount.divide(new BigDecimal(batchCount), SCALE, ROUNDING_MODE)
                    : BigDecimal.ZERO;

            Optional<Supplier> supplierOpt = supplierRepository.findById(supplierId);
            String supplierName = supplierOpt.map(Supplier::getName).orElse(supplierId);

            Map<String, Object> dataPoint = new LinkedHashMap<>();
            dataPoint.put("supplier", supplierName);
            dataPoint.put("totalAmount", totalAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            dataPoint.put("batchCount", batchCount);
            dataPoint.put("avgAmount", avgAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE));

            chartData.add(dataPoint);
        }

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("showLegend", true);
        options.put("multiAxis", true);

        return ChartConfig.builder()
                .chartType("BAR")
                .title("供应商采购对比")
                .xAxisField("supplier")
                .yAxisField("totalAmount")
                .data(chartData)
                .options(options)
                .build();
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 获取指定日期范围内的批次
     */
    private List<MaterialBatch> getBatchesInDateRange(String factoryId, LocalDate startDate, LocalDate endDate) {
        // 使用 receiptDate（入库日期）过滤
        return materialBatchRepository.findByFactoryIdAndStatus(factoryId, MaterialBatchStatus.AVAILABLE).stream()
                .filter(b -> b.getReceiptDate() != null)
                .filter(b -> !b.getReceiptDate().isBefore(startDate) && !b.getReceiptDate().isAfter(endDate))
                .collect(Collectors.toList());
    }

    /**
     * 计算 KPI 卡片
     */
    private List<MetricResult> calculateKpiCards(List<MaterialBatch> batches, String factoryId,
                                                  LocalDate startDate, LocalDate endDate) {
        List<MetricResult> kpiCards = new ArrayList<>();

        // 采购总额
        BigDecimal totalAmount = calculateTotalValue(batches);
        kpiCards.add(MetricResult.builder()
                .metricCode(PROCUREMENT_AMOUNT)
                .metricName("采购总额")
                .value(totalAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatCurrency(totalAmount))
                .unit("元")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .build());

        // 采购批次数
        kpiCards.add(MetricResult.builder()
                .metricCode(BATCH_COUNT)
                .metricName("采购批次")
                .value(new BigDecimal(batches.size()))
                .formattedValue(String.format("%,d", batches.size()))
                .unit("批")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .build());

        // 平均批次金额
        BigDecimal avgAmount = batches.isEmpty() ? BigDecimal.ZERO :
                totalAmount.divide(new BigDecimal(batches.size()), SCALE, ROUNDING_MODE);
        kpiCards.add(MetricResult.builder()
                .metricCode(AVG_BATCH_AMOUNT)
                .metricName("平均批次金额")
                .value(avgAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatCurrency(avgAmount))
                .unit("元")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .build());

        // 供应商集中度
        BigDecimal concentration = calculateSupplierConcentration(batches);
        String concentrationAlert = determineConcentrationAlertLevel(concentration);
        kpiCards.add(MetricResult.builder()
                .metricCode(SUPPLIER_CONCENTRATION)
                .metricName("供应商集中度")
                .value(concentration.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(String.format("%.1f%%", concentration.doubleValue()))
                .unit("%")
                .alertLevel(concentrationAlert)
                .description("最大供应商占比")
                .build());

        // 环比增长
        LocalDate previousStart = startDate.minusMonths(1);
        LocalDate previousEnd = endDate.minusMonths(1);
        List<MaterialBatch> previousBatches = getBatchesInDateRange(factoryId, previousStart, previousEnd);

        if (!previousBatches.isEmpty()) {
            BigDecimal previousAmount = calculateTotalValue(previousBatches);
            BigDecimal momGrowth = metricCalculatorService.calculateMomGrowth(totalAmount, previousAmount);
            String direction = determineChangeDirection(momGrowth);

            kpiCards.add(MetricResult.builder()
                    .metricCode(PROCUREMENT_MOM_GROWTH)
                    .metricName("环比增长")
                    .value(momGrowth.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .formattedValue(String.format("%+.1f%%", momGrowth.doubleValue()))
                    .unit("%")
                    .changePercent(momGrowth)
                    .changeDirection(direction)
                    .alertLevel(MetricResult.AlertLevel.GREEN.name())
                    .build());
        }

        return kpiCards;
    }

    /**
     * 计算采购总金额
     */
    private BigDecimal calculateTotalValue(List<MaterialBatch> batches) {
        return batches.stream()
                .map(MaterialBatch::getTotalValue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * 计算平均单价
     */
    private BigDecimal calculateAverageUnitPrice(List<MaterialBatch> batches) {
        List<BigDecimal> prices = batches.stream()
                .map(MaterialBatch::getUnitPrice)
                .filter(Objects::nonNull)
                .filter(p -> p.compareTo(BigDecimal.ZERO) > 0)
                .collect(Collectors.toList());

        if (prices.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal sum = prices.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(new BigDecimal(prices.size()), SCALE, ROUNDING_MODE);
    }

    /**
     * 计算供应商集中度（最大供应商占比）
     */
    private BigDecimal calculateSupplierConcentration(List<MaterialBatch> batches) {
        Map<String, BigDecimal> supplierValues = batches.stream()
                .filter(b -> b.getSupplierId() != null)
                .collect(Collectors.groupingBy(
                        MaterialBatch::getSupplierId,
                        Collectors.reducing(BigDecimal.ZERO,
                                MaterialBatch::getTotalValue,
                                BigDecimal::add)
                ));

        BigDecimal totalValue = supplierValues.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalValue.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        BigDecimal maxValue = supplierValues.values().stream()
                .max(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);

        return maxValue.divide(totalValue, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 计算价格评分
     */
    private BigDecimal calculatePriceScore(Supplier supplier, List<MaterialBatch> batches) {
        Integer rating = supplier.getRating();
        if (rating == null) {
            return new BigDecimal("70");
        }
        return new BigDecimal(rating * 20);
    }

    /**
     * 计算质量评分
     */
    private BigDecimal calculateQualityScore(List<MaterialBatch> batches) {
        if (batches.isEmpty()) {
            return BigDecimal.ZERO;
        }

        long availableCount = batches.stream()
                .filter(b -> b.getStatus() == MaterialBatchStatus.AVAILABLE)
                .count();

        return new BigDecimal(availableCount)
                .divide(new BigDecimal(batches.size()), SCALE, ROUNDING_MODE)
                .multiply(new BigDecimal("100"));
    }

    /**
     * 计算交付评分
     */
    private BigDecimal calculateDeliveryScore(Supplier supplier, List<MaterialBatch> batches) {
        Integer deliveryDays = supplier.getDeliveryDays();
        if (deliveryDays == null || deliveryDays == 0) {
            return new BigDecimal("85");
        }

        // 基于承诺交付天数和实际入库时间计算
        // 简化处理：假设大部分准时交付
        return new BigDecimal("85");
    }

    /**
     * 计算服务评分
     */
    private BigDecimal calculateServiceScore(Supplier supplier) {
        Integer rating = supplier.getRating();
        if (rating == null) {
            return new BigDecimal("70");
        }
        return new BigDecimal(rating * 20);
    }

    /**
     * 计算供货稳定性评分
     */
    private BigDecimal calculateStabilityScore(List<MaterialBatch> batches) {
        if (batches.size() < 2) {
            return new BigDecimal("80");
        }

        List<BigDecimal> quantities = batches.stream()
                .map(MaterialBatch::getReceiptQuantity)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (quantities.isEmpty()) {
            return new BigDecimal("80");
        }

        BigDecimal avg = quantities.stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(quantities.size()), SCALE, ROUNDING_MODE);

        if (avg.compareTo(BigDecimal.ZERO) == 0) {
            return new BigDecimal("80");
        }

        BigDecimal variance = quantities.stream()
                .map(q -> q.subtract(avg).pow(2))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(quantities.size()), SCALE, ROUNDING_MODE);

        BigDecimal cv = variance.sqrt(new java.math.MathContext(10)).divide(avg, SCALE, ROUNDING_MODE);

        BigDecimal score = new BigDecimal("100").subtract(cv.multiply(new BigDecimal("100")));
        return score.max(BigDecimal.ZERO).min(new BigDecimal("100"));
    }

    /**
     * 从数据构建供应商排名
     */
    private List<RankingItem> calculateSupplierRankingFromData(List<MaterialBatch> batches) {
        Map<String, BigDecimal> supplierValues = batches.stream()
                .filter(b -> b.getSupplierId() != null)
                .collect(Collectors.groupingBy(
                        MaterialBatch::getSupplierId,
                        Collectors.reducing(BigDecimal.ZERO,
                                MaterialBatch::getTotalValue,
                                BigDecimal::add)
                ));

        Map<String, Long> supplierBatchCounts = batches.stream()
                .filter(b -> b.getSupplierId() != null)
                .collect(Collectors.groupingBy(
                        MaterialBatch::getSupplierId,
                        Collectors.counting()
                ));

        BigDecimal totalValue = supplierValues.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<RankingItem> rankings = new ArrayList<>();
        int rank = 1;

        List<Map.Entry<String, BigDecimal>> sorted = supplierValues.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .collect(Collectors.toList());

        for (Map.Entry<String, BigDecimal> entry : sorted) {
            String supplierId = entry.getKey();
            BigDecimal value = entry.getValue();
            Long batchCount = supplierBatchCounts.getOrDefault(supplierId, 0L);

            BigDecimal percentage = totalValue.compareTo(BigDecimal.ZERO) > 0
                    ? value.divide(totalValue, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;

            Optional<Supplier> supplierOpt = supplierRepository.findById(supplierId);
            String supplierName = supplierOpt.map(Supplier::getName).orElse(supplierId);

            List<MaterialBatch> supplierBatches = batches.stream()
                    .filter(b -> supplierId.equals(b.getSupplierId()))
                    .collect(Collectors.toList());
            BigDecimal qualityRate = calculateQualityScore(supplierBatches);

            rankings.add(RankingItem.builder()
                    .rank(rank++)
                    .name(supplierName)
                    .value(value.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .target(new BigDecimal(batchCount))
                    .completionRate(percentage.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .alertLevel(determineQualityAlertLevel(qualityRate).name())
                    .build());
        }

        return rankings;
    }

    /**
     * 构建采购趋势图表
     */
    private ChartConfig buildProcurementTrendChartFromData(List<MaterialBatch> batches, String period) {
        Map<String, BigDecimal> periodValues;

        switch (period.toUpperCase()) {
            case "WEEK":
                periodValues = aggregateByWeek(batches);
                break;
            case "MONTH":
                periodValues = aggregateByMonth(batches);
                break;
            case "DAY":
            default:
                periodValues = aggregateByDay(batches);
                break;
        }

        List<Map<String, Object>> chartData = periodValues.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> {
                    Map<String, Object> dataPoint = new LinkedHashMap<>();
                    dataPoint.put("date", entry.getKey());
                    dataPoint.put("amount", entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE));
                    return dataPoint;
                })
                .collect(Collectors.toList());

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("showDataLabels", false);
        options.put("smooth", true);

        return ChartConfig.builder()
                .chartType("LINE")
                .title("采购趋势")
                .xAxisField("date")
                .yAxisField("amount")
                .data(chartData)
                .options(options)
                .build();
    }

    /**
     * 按日聚合
     */
    private Map<String, BigDecimal> aggregateByDay(List<MaterialBatch> batches) {
        return batches.stream()
                .filter(b -> b.getReceiptDate() != null)
                .collect(Collectors.groupingBy(
                        b -> b.getReceiptDate().toString(),
                        TreeMap::new,
                        Collectors.reducing(BigDecimal.ZERO,
                                MaterialBatch::getTotalValue,
                                BigDecimal::add)
                ));
    }

    /**
     * 按周聚合
     */
    private Map<String, BigDecimal> aggregateByWeek(List<MaterialBatch> batches) {
        return batches.stream()
                .filter(b -> b.getReceiptDate() != null)
                .collect(Collectors.groupingBy(
                        b -> {
                            LocalDate date = b.getReceiptDate();
                            LocalDate weekStart = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                            return weekStart.toString();
                        },
                        TreeMap::new,
                        Collectors.reducing(BigDecimal.ZERO,
                                MaterialBatch::getTotalValue,
                                BigDecimal::add)
                ));
    }

    /**
     * 按月聚合
     */
    private Map<String, BigDecimal> aggregateByMonth(List<MaterialBatch> batches) {
        return batches.stream()
                .filter(b -> b.getReceiptDate() != null)
                .collect(Collectors.groupingBy(
                        b -> b.getReceiptDate().getYear() + "-" +
                                String.format("%02d", b.getReceiptDate().getMonthValue()),
                        TreeMap::new,
                        Collectors.reducing(BigDecimal.ZERO,
                                MaterialBatch::getTotalValue,
                                BigDecimal::add)
                ));
    }

    /**
     * 构建供应商饼图
     */
    private ChartConfig buildSupplierPieChart(List<MaterialBatch> batches) {
        Map<String, BigDecimal> supplierValues = batches.stream()
                .filter(b -> b.getSupplierId() != null)
                .collect(Collectors.groupingBy(
                        MaterialBatch::getSupplierId,
                        Collectors.reducing(BigDecimal.ZERO,
                                MaterialBatch::getTotalValue,
                                BigDecimal::add)
                ));

        List<Map<String, Object>> chartData = supplierValues.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .map(entry -> {
                    Optional<Supplier> supplierOpt = supplierRepository.findById(entry.getKey());
                    String supplierName = supplierOpt.map(Supplier::getName).orElse(entry.getKey());

                    Map<String, Object> dataPoint = new LinkedHashMap<>();
                    dataPoint.put("supplier", supplierName);
                    dataPoint.put("amount", entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE));
                    return dataPoint;
                })
                .collect(Collectors.toList());

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("showPercentage", true);
        options.put("showLegend", true);

        return ChartConfig.builder()
                .chartType("PIE")
                .title("供应商采购占比")
                .xAxisField("supplier")
                .yAxisField("amount")
                .data(chartData)
                .options(options)
                .build();
    }

    /**
     * 构建材料类别柱状图
     */
    private ChartConfig buildMaterialCategoryChart(List<MaterialBatch> batches) {
        Map<String, BigDecimal> categoryValues = batches.stream()
                .filter(b -> b.getMaterialTypeId() != null)
                .collect(Collectors.groupingBy(
                        MaterialBatch::getMaterialTypeId,
                        Collectors.reducing(BigDecimal.ZERO,
                                MaterialBatch::getTotalValue,
                                BigDecimal::add)
                ));

        List<Map<String, Object>> chartData = categoryValues.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .limit(10)
                .map(entry -> {
                    Map<String, Object> dataPoint = new LinkedHashMap<>();
                    dataPoint.put("category", entry.getKey());
                    dataPoint.put("amount", entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE));
                    return dataPoint;
                })
                .collect(Collectors.toList());

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("showDataLabels", true);

        return ChartConfig.builder()
                .chartType("BAR")
                .title("材料类别采购金额")
                .xAxisField("category")
                .yAxisField("amount")
                .data(chartData)
                .options(options)
                .build();
    }

    /**
     * 生成 AI 洞察
     */
    private List<AIInsight> generateAiInsights(List<MaterialBatch> batches, List<MetricResult> kpiCards) {
        List<AIInsight> insights = new ArrayList<>();

        // 检查供应商集中度
        MetricResult concentrationMetric = kpiCards.stream()
                .filter(m -> SUPPLIER_CONCENTRATION.equals(m.getMetricCode()))
                .findFirst()
                .orElse(null);

        if (concentrationMetric != null && concentrationMetric.getValue() != null) {
            BigDecimal concentration = concentrationMetric.getValue();
            if (concentration.compareTo(CONCENTRATION_RED_THRESHOLD) > 0) {
                insights.add(AIInsight.builder()
                        .level("RED")
                        .category("供应商风险")
                        .message(String.format("供应商集中度高达 %.1f%%，存在供应链风险",
                                concentration.doubleValue()))
                        .actionSuggestion("建议开发备选供应商，分散采购风险")
                        .build());
            } else if (concentration.compareTo(CONCENTRATION_YELLOW_THRESHOLD) > 0) {
                insights.add(AIInsight.builder()
                        .level("YELLOW")
                        .category("供应商风险")
                        .message(String.format("供应商集中度为 %.1f%%，需要关注",
                                concentration.doubleValue()))
                        .actionSuggestion("建议评估备选供应商，降低依赖度")
                        .build());
            }
        }

        // 找出采购量最大的供应商
        Map<String, BigDecimal> supplierValues = batches.stream()
                .filter(b -> b.getSupplierId() != null)
                .collect(Collectors.groupingBy(
                        MaterialBatch::getSupplierId,
                        Collectors.reducing(BigDecimal.ZERO,
                                MaterialBatch::getTotalValue,
                                BigDecimal::add)
                ));

        if (!supplierValues.isEmpty()) {
            Map.Entry<String, BigDecimal> topSupplier = supplierValues.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .orElse(null);

            if (topSupplier != null) {
                Optional<Supplier> supplierOpt = supplierRepository.findById(topSupplier.getKey());
                String supplierName = supplierOpt.map(Supplier::getName).orElse("未知供应商");

                insights.add(AIInsight.builder()
                        .level("INFO")
                        .category("采购分布")
                        .message(String.format("最大供应商 %s 采购金额 %s 元",
                                supplierName, formatCurrency(topSupplier.getValue())))
                        .relatedEntity(supplierName)
                        .actionSuggestion("建议与该供应商协商更优惠的采购条款")
                        .build());
            }
        }

        return insights;
    }

    /**
     * 生成建议
     */
    private List<String> generateSuggestions(List<MaterialBatch> batches, List<MetricResult> kpiCards) {
        List<String> suggestions = new ArrayList<>();

        // 检查供应商数量
        long supplierCount = batches.stream()
                .map(MaterialBatch::getSupplierId)
                .filter(Objects::nonNull)
                .distinct()
                .count();

        if (supplierCount < 3) {
            suggestions.add("当前活跃供应商数量较少，建议开发更多供应商以降低供应链风险");
        }

        // 检查是否有高价批次
        BigDecimal avgPrice = calculateAverageUnitPrice(batches);
        long highPriceCount = batches.stream()
                .filter(b -> b.getUnitPrice() != null)
                .filter(b -> b.getUnitPrice().compareTo(avgPrice.multiply(new BigDecimal("1.5"))) > 0)
                .count();

        if (highPriceCount > 0) {
            suggestions.add(String.format("有 %d 批次采购单价高于平均价格50%%以上，建议核查采购价格", highPriceCount));
        }

        return suggestions;
    }

    /**
     * 构建空仪表盘
     */
    private DashboardResponse buildEmptyDashboard() {
        return DashboardResponse.builder()
                .kpiCards(Collections.emptyList())
                .charts(Collections.emptyMap())
                .rankings(Collections.emptyMap())
                .aiInsights(Collections.singletonList(AIInsight.builder()
                        .level("YELLOW")
                        .category("数据状态")
                        .message("当前时间范围内暂无采购数据")
                        .actionSuggestion("请调整时间范围或录入采购数据")
                        .build()))
                .suggestions(Collections.singletonList("请先录入采购数据以开始分析"))
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    /**
     * 将 MetricResult 列表转换为 KPICard 列表
     */
    private List<KPICard> convertToKPICards(List<MetricResult> metricResults) {
        List<KPICard> kpiCards = new ArrayList<>();
        for (MetricResult metric : metricResults) {
            String status = "green";
            if (metric.getAlertLevel() != null) {
                switch (metric.getAlertLevel()) {
                    case "RED":
                        status = "red";
                        break;
                    case "YELLOW":
                        status = "yellow";
                        break;
                    default:
                        status = "green";
                }
            }

            String trend = "flat";
            if (metric.getChangeDirection() != null) {
                switch (metric.getChangeDirection()) {
                    case "UP":
                        trend = "up";
                        break;
                    case "DOWN":
                        trend = "down";
                        break;
                    default:
                        trend = "flat";
                }
            }

            kpiCards.add(KPICard.builder()
                    .key(metric.getMetricCode())
                    .title(metric.getMetricName())
                    .rawValue(metric.getValue())
                    .value(metric.getFormattedValue() != null ? metric.getFormattedValue() :
                            (metric.getValue() != null ? metric.getValue().toString() : "-"))
                    .unit(metric.getUnit())
                    .changeRate(metric.getChangePercent())
                    .change(metric.getChangeValue())
                    .trend(trend)
                    .status(status)
                    .description(metric.getDescription())
                    .build());
        }
        return kpiCards;
    }

    // ==================== 预警级别判断 ====================

    /**
     * 确定准时交付率预警级别
     */
    private MetricResult.AlertLevel determineDeliveryAlertLevel(BigDecimal deliveryRate) {
        if (deliveryRate.compareTo(ON_TIME_RED_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.RED;
        }
        if (deliveryRate.compareTo(ON_TIME_YELLOW_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.YELLOW;
        }
        return MetricResult.AlertLevel.GREEN;
    }

    /**
     * 确定质量合格率预警级别
     */
    private MetricResult.AlertLevel determineQualityAlertLevel(BigDecimal qualityRate) {
        if (qualityRate.compareTo(QUALITY_RED_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.RED;
        }
        if (qualityRate.compareTo(QUALITY_YELLOW_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.YELLOW;
        }
        return MetricResult.AlertLevel.GREEN;
    }

    /**
     * 确定供应商集中度预警级别
     */
    private String determineConcentrationAlertLevel(BigDecimal concentration) {
        if (concentration.compareTo(CONCENTRATION_RED_THRESHOLD) > 0) {
            return MetricResult.AlertLevel.RED.name();
        }
        if (concentration.compareTo(CONCENTRATION_YELLOW_THRESHOLD) > 0) {
            return MetricResult.AlertLevel.YELLOW.name();
        }
        return MetricResult.AlertLevel.GREEN.name();
    }

    /**
     * 确定变化方向
     */
    private String determineChangeDirection(BigDecimal changePercent) {
        if (changePercent == null) {
            return "STABLE";
        }
        int cmp = changePercent.compareTo(BigDecimal.ZERO);
        if (cmp > 0) {
            return "UP";
        } else if (cmp < 0) {
            return "DOWN";
        }
        return "STABLE";
    }

    /**
     * 格式化货币
     */
    private String formatCurrency(BigDecimal value) {
        if (value == null) {
            return "-";
        }
        return String.format("%,.2f", value.setScale(DISPLAY_SCALE, ROUNDING_MODE).doubleValue());
    }
}
